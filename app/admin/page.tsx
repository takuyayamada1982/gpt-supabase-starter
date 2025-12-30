'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type UsageType = 'url' | 'vision' | 'chat' | 'video_thumb';

type UsageLog = {
  id: string;
  user_id: string;
  type: UsageType;
  cost: number | null;
  created_at: string;
};

type Profile = {
  id: string;
  email: string;
  account_id: string | null;
  plan_status: 'trial' | 'paid' | null;
  plan_tier: 'starter' | 'pro' | null;
  trial_type: 'normal' | 'referral' | null;
  registered_at: string | null;
};

function monthRange(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1).toISOString();
  const end = new Date(y, m + 1, 1).toISOString();
  return { start, end, ym: `${y}-${String(m + 1).padStart(2, '0')}` };
}

function addMonths(base: Date, diff: number) {
  return new Date(base.getFullYear(), base.getMonth() + diff, 1);
}

const typeLabel: Record<UsageType, string> = {
  url: 'URL要約',
  vision: '画像→SNS',
  chat: 'Chat',
  video_thumb: '動画→文字',
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);

  const [logsThisMonth, setLogsThisMonth] = useState<UsageLog[]>([]);
  const [logsManyMonths, setLogsManyMonths] = useState<UsageLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const targetDate = useMemo(() => new Date(), []);
  const { start: thisStart, end: thisEnd, ym: thisYm } = useMemo(
    () => monthRange(targetDate),
    [targetDate],
  );

  // ===== データ取得 =====
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // 1) 今月分の usage_logs
        const { data: logsNow, error: e1 } = await supabase
          .from('usage_logs')
          .select('id,user_id,type,cost,created_at')
          .gte('created_at', thisStart)
          .lt('created_at', thisEnd);

        if (e1) throw e1;
        setLogsThisMonth((logsNow || []) as UsageLog[]);

        // 2) 過去24カ月分の usage_logs
        const oldest = monthRange(addMonths(targetDate, -23)).start;
        const { data: logsAll, error: e2 } = await supabase
          .from('usage_logs')
          .select('id,user_id,type,cost,created_at')
          .gte('created_at', oldest)
          .lt('created_at', thisEnd);

        if (e2) throw e2;
        setLogsManyMonths((logsAll || []) as UsageLog[]);

        // 3) 今月利用しているユーザーの profiles
        const userIds = Array.from(
          new Set((logsNow || []).map((l) => l.user_id)),
        );
        if (userIds.length > 0) {
          const { data: profs, error: e3 } = await supabase
            .from('profiles')
            .select(
              'id,email,account_id,plan_status,plan_tier,trial_type,registered_at',
            )
            .in('id', userIds);

          if (e3) throw e3;
          setProfiles((profs || []) as Profile[]);
        } else {
          setProfiles([]);
        }
      } catch (e: any) {
        console.error(e);
        setErrorMsg('データ取得中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    })();
  }, [thisStart, thisEnd, targetDate]);

  // ===== 今月の集計（回数 & 金額） =====
  const thisMonthStats = useMemo(() => {
    const initCounts: Record<UsageType, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video_thumb: 0,
    };
    const initCosts: Record<UsageType, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video_thumb: 0,
    };

    const counts = { ...initCounts };
    const costs = { ...initCosts };

    for (const log of logsThisMonth) {
      if (!log.type) continue;
      const t = log.type as UsageType;
      if (!(t in counts)) continue;
      counts[t] += 1;
      costs[t] += Number(log.cost || 0);
    }

    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);

    return { counts, costs, totalCount, totalCost };
  }, [logsThisMonth]);

  // ===== 月次24カ月分の集計 =====
  const monthlyList = useMemo(() => {
    type Row = {
      ym: string;
      url: number;
      vision: number;
      chat: number;
      video_thumb: number;
      total: number;
      cost: number;
    };

    const map = new Map<string, Row>();

    for (const log of logsManyMonths) {
      const d = new Date(log.created_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      const type = log.type as UsageType;
      if (!['url', 'vision', 'chat', 'video_thumb'].includes(type)) continue;

      let row = map.get(ym);
      if (!row) {
        row = {
          ym,
          url: 0,
          vision: 0,
          chat: 0,
          video_thumb: 0,
          total: 0,
          cost: 0,
        };
        map.set(ym, row);
      }
      row[type] += 1;
      row.total += 1;
      row.cost += Number(log.cost || 0);
    }

    // 直近24カ月分を、新しい月が上になるよう並べる
    const rows: Row[] = [];
    for (let i = 0; i < 24; i += 1) {
      const d = addMonths(targetDate, -i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      const row = map.get(ym) || {
        ym,
        url: 0,
        vision: 0,
        chat: 0,
        video_thumb: 0,
        total: 0,
        cost: 0,
      };
      rows.push(row);
    }
    return rows;
  }, [logsManyMonths, targetDate]);

  // ===== ユーザー別（今月） =====
  const userRows = useMemo(() => {
    type URow = {
      userId: string;
      accountId: string;
      email: string;
      plan: string;
      trialLabel: string;
      registeredAt: string;
      status: string;
      url: number;
      vision: number;
      chat: number;
      video_thumb: number;
      cost: number;
    };

    const byUser: Record<string, URow> = {};

    for (const p of profiles) {
      byUser[p.id] = {
        userId: p.id,
        accountId: p.account_id || '',
        email: p.email,
        plan:
          p.plan_status === 'paid'
            ? p.plan_tier === 'pro'
              ? 'Pro'
              : 'Starter'
            : '無料',
        trialLabel:
          p.plan_status === 'trial'
            ? p.trial_type === 'referral'
              ? '紹介トライアル'
              : '通常トライアル'
            : '',
        registeredAt: p.registered_at
          ? p.registered_at.slice(0, 10)
          : '',
        status: p.plan_status === 'paid' ? '契約中' : '無料',
        url: 0,
        vision: 0,
        chat: 0,
        video_thumb: 0,
        cost: 0,
      };
    }

    for (const log of logsThisMonth) {
      const u = log.user_id;
      if (!byUser[u]) {
        byUser[u] = {
          userId: u,
          accountId: '',
          email: '(不明なユーザー)',
          plan: '',
          trialLabel: '',
          registeredAt: '',
          status: '',
          url: 0,
          vision: 0,
          chat: 0,
          video_thumb: 0,
          cost: 0,
        };
      }
      const row = byUser[u];
      const t = log.type as UsageType;
      if (t in row) {
        // @ts-ignore
        row[t] += 1;
      }
      row.cost += Number(log.cost || 0);
    }

    return Object.values(byUser).sort((a, b) =>
      a.accountId.localeCompare(b.accountId),
    );
  }, [profiles, logsThisMonth]);

  // ===== スタイル共通 =====
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#020617',
    color: '#e5e7eb',
    padding: 16,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    border: '1px solid #1f2937',
    boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
    marginBottom: 16,
  };

  const chipStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid #1f2937',
    backgroundColor: '#0b1220',
  };

  return (
    <main style={pageStyle}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            利用回数・API原価・ユーザー状況を
            1画面でざっくり把握できるページです
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
          <div>対象月: {thisYm}</div>
          <div>
            URL 0.7円 / 画像 1円 / Chat 0.3円 / 動画 20円
          </div>
        </div>
      </header>

      {errorMsg && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            borderRadius: 8,
            backgroundColor: '#7f1d1d',
            color: '#fee2e2',
            fontSize: 12,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* 上部サマリー */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={panelStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
            今月のリクエスト数
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {thisMonthStats.totalCount.toLocaleString()} 回
          </div>
        </div>
        <div style={panelStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
            今月の金額（概算）
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            ¥{thisMonthStats.totalCost.toLocaleString()}
          </div>
        </div>
        <div style={panelStyle}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
            集計対象月
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{thisYm}</div>
        </div>
      </section>

      {/* 今月の利用回数（種別別） */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>今月の利用回数（種別別）</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Object.keys(typeLabel) as UsageType[]).map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <span>{typeLabel[t]}</span>
              <span>{thisMonthStats.counts[t].toLocaleString()} 回</span>
            </div>
          ))}
        </div>
      </section>

      {/* 今月の金額内訳（種別別） */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>今月の金額内訳（種別別）</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Object.keys(typeLabel) as UsageType[]).map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <span>{typeLabel[t]}</span>
              <span>
                ¥{thisMonthStats.costs[t].toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 月次の利用・料金一覧（24カ月） */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>
          月次の利用・料金一覧（最大24カ月）
        </h2>
        <div
          style={{
            overflowX: 'auto',
            fontSize: 12,
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 640,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#020617' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>月</th>
                <th style={{ textAlign: 'right', padding: 6 }}>URL</th>
                <th style={{ textAlign: 'right', padding: 6 }}>画像</th>
                <th style={{ textAlign: 'right', padding: 6 }}>Chat</th>
                <th style={{ textAlign: 'right', padding: 6 }}>動画</th>
                <th style={{ textAlign: 'right', padding: 6 }}>合計リクエスト</th>
                <th style={{ textAlign: 'right', padding: 6 }}>料金合計</th>
              </tr>
            </thead>
            <tbody>
              {monthlyList.map((row) => (
                <tr
                  key={row.ym}
                  style={{
                    borderTop: '1px solid #1f2937',
                    backgroundColor:
                      row.ym === thisYm ? '#020617' : 'transparent',
                  }}
                >
                  <td style={{ padding: 6 }}>{row.ym}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {row.url || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {row.vision || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {row.chat || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {row.video_thumb || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {row.total || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    ¥{row.cost.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ユーザー一覧（今月利用分） */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>
          ユーザー一覧（プラン種別・トライアル・今月の利用内訳）
        </h2>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
          利用が 0 件のユーザーは表示していません
        </div>
        <div style={{ overflowX: 'auto', fontSize: 12 }}>
          <table
            style={{
              width: '100%',
              minWidth: 720,
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#020617' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>アカウントID</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Email</th>
                <th style={{ textAlign: 'left', padding: 6 }}>プラン種別</th>
                <th style={{ textAlign: 'left', padding: 6 }}>トライアル</th>
                <th style={{ textAlign: 'left', padding: 6 }}>登録日</th>
                <th style={{ textAlign: 'left', padding: 6 }}>ステータス</th>
                <th style={{ textAlign: 'right', padding: 6 }}>URL</th>
                <th style={{ textAlign: 'right', padding: 6 }}>画像</th>
                <th style={{ textAlign: 'right', padding: 6 }}>Chat</th>
                <th style={{ textAlign: 'right', padding: 6 }}>動画</th>
                <th style={{ textAlign: 'right', padding: 6 }}>当月料金</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => (
                <tr
                  key={u.userId}
                  style={{ borderTop: '1px solid #1f2937' }}
                >
                  <td style={{ padding: 6 }}>{u.accountId || '-'}</td>
                  <td style={{ padding: 6 }}>{u.email}</td>
                  <td style={{ padding: 6 }}>
                    {u.plan && <span style={chipStyle}>{u.plan}</span>}
                  </td>
                  <td style={{ padding: 6 }}>
                    {u.trialLabel && <span style={chipStyle}>{u.trialLabel}</span>}
                  </td>
                  <td style={{ padding: 6 }}>{u.registeredAt}</td>
                  <td style={{ padding: 6 }}>{u.status}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {u.url || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {u.vision || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {u.chat || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {u.video_thumb || '-'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    ¥{u.cost.toLocaleString()}
                  </td>
                </tr>
              ))}
              {userRows.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}
                  >
                    今月まだ利用ログがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {loading && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          読み込み中…
        </div>
      )}
    </main>
  );
}
