// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ★ video を追加
type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface Summary {
  month: string;
  totalRequests: number;
  totalCost: number;
  countsByType: Record<UsageType, number>;
  costsByType: Record<UsageType, number>;
}

interface MonthlyRow {
  month: string;
  urlCount: number;
  visionCount: number;
  chatCount: number;
  videoCount: number; // ★追加
  urlCost: number;
  visionCost: number;
  chatCost: number;
  videoCost: number; // ★追加
  totalCost: number;
}

interface AdminStatsResponse {
  summary: Summary;
  monthly: MonthlyRow[];
}

interface UserProfile {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;
  deleted_at: string | null;
  trial_type: string | null;   // 'normal' | 'referral'
  plan_status: string | null;  // 'trial' | 'paid'
  plan_tier: string | null;    // 'starter' | 'pro' | null

  // 今月の利用内訳（/api/admin/users で付けているフィールド）
  monthly_url_count: number;
  monthly_vision_count: number;
  monthly_chat_count: number;
  monthly_video_count: number;   // ★追加
  monthly_total_cost: number;
}

interface AdminUsersResponse {
  users: UserProfile[];
}

type TrialStatusKind =
  | 'trial_ok'
  | 'trial_warning'
  | 'trial_expired'
  | 'paid'
  | 'unknown';

interface TrialStatusView {
  kind: TrialStatusKind;
  label: string;
  bgColor: string;
  textColor: string;
}

export default function AdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 管理者認証チェック用
  const [authChecking, setAuthChecking] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  // ① ログイン & is_master チェック
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!user) {
          router.push('/auth');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_master')
          .eq('email', user.email)
          .maybeSingle();

        if (error) {
          console.error('admin profile error:', error);
        }

        if (!profile?.is_master) {
          setErrorMsg('管理者権限がありません');
          setAuthChecking(false);
          return;
        }

        setIsMaster(true);
      } finally {
        setAuthChecking(false);
      }
    };

    checkAdmin();
  }, [router]);

  // ② 管理者として認証できたら admin API を叩く
  useEffect(() => {
    if (!isMaster) return; // master 以外は API 呼ばない

    const fetchAll = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/users'),
        ]);

        if (!statsRes.ok) throw new Error('stats API error');
        if (!usersRes.ok) throw new Error('users API error');

        const statsJson: AdminStatsResponse = await statsRes.json();
        const usersJson: AdminUsersResponse = await usersRes.json();

        setStats(statsJson);
        setUsers(usersJson.users ?? []);
      } catch (err) {
        console.error(err);
        setErrorMsg('管理情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [isMaster]);

  // 認証確認中
  if (authChecking) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#cbd5f5' }}>認証確認中...</span>
      </FullScreenCenter>
    );
  }

  // ロード中
  if (loading) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#cbd5f5' }}>読み込み中...</span>
      </FullScreenCenter>
    );
  }

  // 権限NG or データ取得失敗
  if (errorMsg || !stats) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#fecaca' }}>
          {errorMsg ?? 'データがありません'}
        </span>
      </FullScreenCenter>
    );
  }

  const { summary, monthly } = stats;

  const counts = summary.countsByType;
  const costs = summary.costsByType;

  // video がない旧レスポンスでも落ちないように 0 デフォルト
  const maxCount = Math.max(
    counts.url ?? 0,
    counts.vision ?? 0,
    counts.chat ?? 0,
    counts.video ?? 0,
    1
  );
  const maxCost = Math.max(
    costs.url ?? 0,
    costs.vision ?? 0,
    costs.chat ?? 0,
    costs.video ?? 0,
    1
  );

  const monthLabel = summary.month || '—';

  const formatYen = (v: number) => `¥${v.toFixed(1)}`;

  const typeLabelMap: Record<UsageType, string> = {
    url: 'URL要約',
    vision: '画像→SNS',
    chat: 'Chat',
    video: '動画→文字起こし', // ★追加
  };

  // ★ 棒グラフに並べる順序
  const typeOrder: UsageType[] = ['url', 'vision', 'chat', 'video'];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020617',
        color: '#e5e7eb',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {/* ヘッダー */}
      <header
        style={{
          borderBottom: '1px solid #1f2937',
          backgroundColor: '#020617',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Admin Dashboard</h1>
            <p
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginTop: 4,
              }}
            >
              利用回数・API原価・ユーザー状態をダッシュボードで確認できます
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
            <div>対象月: {monthLabel}</div>
            <div>
              URL 0.7円 / 画像 1円 / Chat 0.3円 / 動画 20円（目安）
            </div>
          </div>
        </div>
      </header>

      {/* 本体 */}
      <main
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '24px 16px 32px',
        }}
      >
        {/* KPIカード */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <KpiCard
            title="今月の総リクエスト"
            value={summary.totalRequests.toLocaleString()}
          />
          <KpiCard title="今月の推定料金" value={formatYen(summary.totalCost)} />
          <KpiCard title="対象月" value={monthLabel} />
        </div>

        {/* 棒グラフ2つ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
          }}
        >
          {/* 利用回数 */}
          <Card title="今月の利用回数（棒グラフ）">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {typeOrder.map((t) => {
                const count = counts[t] ?? 0;
                const width = (count / maxCount) * 100;
                return (
                  <div key={t}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 4,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#e5e7eb' }}>
                        {typeLabelMap[t]}
                      </span>
                      <span style={{ color: '#9ca3af' }}>
                        {count.toLocaleString()} 回
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 8,
                        borderRadius: 9999,
                        backgroundColor: '#1f2937',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height: '100%',
                          backgroundColor: '#22c55e',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 金額内訳 */}
          <Card title="今月の金額内訳（棒グラフ）">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {typeOrder.map((t) => {
                const cost = costs[t] ?? 0;
                const width = (cost / maxCost) * 100;
                return (
                  <div key={t}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 4,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#e5e7eb' }}>
                        {typeLabelMap[t]}
                      </span>
                      <span style={{ color: '#9ca3af' }}>
                        {formatYen(cost)}
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 8,
                        borderRadius: 9999,
                        backgroundColor: '#1f2937',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height: '100%',
                          backgroundColor: '#38bdf8',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* 月次一覧テーブル */}
        <div style={{ marginTop: 24 }}>
          <Card title="月次の利用・料金一覧（最大24ヶ月）">
            <div
              style={{
                maxHeight: 320,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#020617' }}>
                    <Th>月</Th>
                    <Th align="right">URL</Th>
                    <Th align="right">画像</Th>
                    <Th align="right">Chat</Th>
                    <Th align="right">動画</Th> {/* ★追加 */}
                    <Th align="right">合計リクエスト</Th>
                    <Th align="right">料金合計</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => {
                    const url = m.urlCount ?? 0;
                    const vis = m.visionCount ?? 0;
                    const chat = m.chatCount ?? 0;
                    const video = m.videoCount ?? 0; // ★追加
                    return (
                      <tr
                        key={m.month}
                        style={{ borderTop: '1px solid #1f2937' }}
                      >
                        <Td>{m.month}</Td>
                        <Td align="right">{url.toLocaleString()}</Td>
                        <Td align="right">{vis.toLocaleString()}</Td>
                        <Td align="right">{chat.toLocaleString()}</Td>
                        <Td align="right">{video.toLocaleString()}</Td>
                        <Td align="right">
                          {(url + vis + chat + video).toLocaleString()}
                        </Td>
                        <Td align="right">{formatYen(m.totalCost)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ユーザー一覧テーブル（プラン種別 + 利用内訳） */}
        <div style={{ marginTop: 24 }}>
          <Card title="ユーザー一覧（プラン種別 & トライアル状態 & 今月の利用状況）">
            <div
              style={{
                maxHeight: 360,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#020617' }}>
                    <Th>アカウントID</Th>
                    <Th>Email</Th>
                    <Th>プラン種別</Th>
                    <Th>種別</Th>
                    <Th>登録日</Th>
                    <Th>ステータス</Th>
                    <Th align="right">今月URL</Th>
                    <Th align="right">今月画像</Th>
                    <Th align="right">今月Chat</Th>
                    <Th align="right">今月動画</Th> {/* ★追加 */}
                    <Th align="right">今月料金</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const trialView = getTrialStatus(u);
                    const typeLabel = getTrialTypeLabel(u.trial_type);
                    const regDate = formatDateYmd(u.registered_at);
                    const planLabel = getPlanTierLabel(u.plan_tier);

                    const url = u.monthly_url_count ?? 0;
                    const vis = u.monthly_vision_count ?? 0;
                    const chat = u.monthly_chat_count ?? 0;
                    const video = u.monthly_video_count ?? 0; // ★追加

                    return (
                      <tr
                        key={u.id}
                        style={{ borderTop: '1px solid #1f2937' }}
                      >
                        <Td>{u.account_id ?? '-'}</Td>
                        <Td>{u.email ?? '-'}</Td>
                        <Td>{planLabel}</Td>
                        <Td>{typeLabel}</Td>
                        <Td>{regDate}</Td>
                        <Td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: 9999,
                              fontSize: 11,
                              backgroundColor: trialView.bgColor,
                              color: trialView.textColor,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {trialView.label}
                          </span>
                        </Td>
                        <Td align="right">{url.toLocaleString()}</Td>
                        <Td align="right">{vis.toLocaleString()}</Td>
                        <Td align="right">{chat.toLocaleString()}</Td>
                        <Td align="right">{video.toLocaleString()}</Td>
                        <Td align="right">
                          {formatYen(u.monthly_total_cost)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

/* ===== ユーティリティ関数 ===== */

function getTrialTypeLabel(trialType: string | null): string {
  if (trialType === 'referral') return '紹介';
  if (trialType === 'normal') return '通常';
  return '-';
}

function getPlanTierLabel(planTier: string | null): string {
  if (planTier === 'starter') return 'Starter';
  if (planTier === 'pro') return 'Pro';
  return '-';
}

function formatDateYmd(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTrialStatus(user: UserProfile): TrialStatusView {
  // 契約者なら常に「契約中」扱い
  if (user.plan_status === 'paid') {
    return {
      kind: 'paid',
      label: '契約中',
      bgColor: '#1d4ed8',
      textColor: '#bfdbfe',
    };
  }

  if (!user.registered_at) {
    return {
      kind: 'unknown',
      label: '不明',
      bgColor: '#374151',
      textColor: '#e5e7eb',
    };
  }

  const reg = new Date(user.registered_at);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((now.getTime() - reg.getTime()) / msPerDay);

  const trialType = user.trial_type === 'referral' ? 'referral' : 'normal';
  const trialDays = trialType === 'referral' ? 30 : 7;

  const remaining = trialDays - diffDays;

  // 無料期間終了
  if (remaining <= 0) {
    const daysAgo = -remaining;
    return {
      kind: 'trial_expired',
      label: `無料期間終了（${daysAgo}日前）`,
      bgColor: '#7f1d1d',
      textColor: '#fecaca',
    };
  }

  // まもなく終了（残り1〜3日）
  if (remaining <= 3) {
    return {
      kind: 'trial_warning',
      label: `まもなく終了（残り${remaining}日）`,
      bgColor: '#7c2d12',
      textColor: '#fed7aa',
    };
  }

  // 通常の無料期間中
  if (trialType === 'referral') {
    return {
      kind: 'trial_ok',
      label: `紹介：無料期間中（残り${remaining}日）`,
      bgColor: '#14532d',
      textColor: '#bbf7d0',
    };
  }

  return {
    kind: 'trial_ok',
    label: `無料期間中（残り${remaining}日）`,
    bgColor: '#064e3b',
    textColor: '#bbf7d0',
  };
}

/* ===== 小さなコンポーネントたち ===== */

function FullScreenCenter(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020617',
        color: '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {props.children}
    </div>
  );
}

function KpiCard(props: { title: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid #1f2937',
        backgroundColor: '#020617',
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.06,
          color: '#9ca3af',
          marginBottom: 4,
        }}
      >
        {props.title}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{props.value}</div>
    </div>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        borderRadius: 16,
        border: '1px solid #1f2937',
        backgroundColor: '#020617',
        padding: 16,
        marginBottom: 8,
      }}
    >
      <h2
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function Th(props: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        padding: '4px 8px',
        textAlign: props.align ?? 'left',
        fontWeight: 500,
        color: '#9ca3af',
        position: 'sticky',
        top: 0,
        backgroundColor: '#020617',
      }}
    >
      {props.children}
    </th>
  );
}

function Td(props: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td
      style={{
        padding: '4px 8px',
        textAlign: props.align ?? 'left',
      }}
    >
      {props.children}
    </td>
  );
}
