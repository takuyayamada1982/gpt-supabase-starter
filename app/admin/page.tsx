// app/admin/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// profiles テーブルの型（最低限）
type Profile = {
  id: string;
  email: string | null;
  is_master: boolean | null;
  registered_at: string | null;
  deleted_at: string | null;
};

// usage_logs テーブルの型（最低限）
type UsageLog = {
  user_id: string;
  type: 'url' | 'vision' | 'chat' | string;
  created_at: string;
};

type MonthOption = {
  label: string; // 例: "2025年11月"
  value: string; // 例: "2025-11"
  start: string; // "YYYY-MM-01T00:00:00Z" 相当
  end: string;   // 翌月1日
};

// ★ 金額設定（必要に応じて調整してください）
const PRICE_URL = 5;     // URL要約 1回あたり 5円（仮）
const PRICE_VISION = 15; // 画像API 1回あたり 15円（仮）
const PRICE_CHAT = 2;    // チャット 1回あたり 2円（仮）

// ★ 過去24ヶ月分の「月」選択肢を作る
function buildMonthOptions(): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];

  // 現在の月を 0 番目として 24 ヶ月分
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-11
    const label = `${year}年${month + 1}月`;
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    options.push({
      label,
      value,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
  }
  return options;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<'checking' | 'no-login' | 'no-master' | 'ok'>('checking');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);

  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0]?.value || '');

  // =========================================
  // 1. 認証 & マスター権限チェック
  // =========================================
  useEffect(() => {
    const checkAuth = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setAuthStatus('no-login');
        setLoading(false);
        return;
      }

      const { data: myProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !myProfile) {
        console.error('profiles 取得エラー', error);
        setAuthStatus('no-master');
        setLoading(false);
        return;
      }

      if (!myProfile.is_master) {
        setAuthStatus('no-master');
        setLoading(false);
        return;
      }

      // マスター権限OK
      setAuthStatus('ok');
      setLoading(false);
    };

    checkAuth();
  }, []);

  // =========================================
  // 2. 選択中の月のデータ取得
  // =========================================
  useEffect(() => {
    const fetchData = async () => {
      if (authStatus !== 'ok' || !selectedMonth) return;

      const month = monthOptions.find((m) => m.value === selectedMonth);
      if (!month) return;

      // profiles 全件
      const { data: profilesData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('registered_at', { ascending: true });

      if (pError) {
        console.error('profiles 取得エラー', pError);
        return;
      }

      setProfiles(profilesData || []);

      // usage_logs を該当月のみ
      const { data: logsData, error: lError } = await supabase
        .from('usage_logs')
        .select('user_id, type, created_at')
        .gte('created_at', month.start)
        .lt('created_at', month.end);

      if (lError) {
        console.error('usage_logs 取得エラー', lError);
        return;
      }

      setUsageLogs(logsData || []);
    };

    fetchData();
  }, [authStatus, selectedMonth, monthOptions]);

  // =========================================
  // 3. 集計処理
  // =========================================

  // ユーザー単位の集計
  const userStats = useMemo(() => {
    // user_id → { urlCount, visionCount, chatCount }
    const map = new Map<
      string,
      { urlCount: number; visionCount: number; chatCount: number }
    >();

    for (const log of usageLogs) {
      if (!map.has(log.user_id)) {
        map.set(log.user_id, { urlCount: 0, visionCount: 0, chatCount: 0 });
      }
      const entry = map.get(log.user_id)!;
      if (log.type === 'url') entry.urlCount++;
      else if (log.type === 'vision') entry.visionCount++;
      else if (log.type === 'chat') entry.chatCount++;
    }

    return map;
  }, [usageLogs]);

  // 全体集計（回数 & 金額）
  const totalStats = useMemo(() => {
    let totalUrl = 0;
    let totalVision = 0;
    let totalChat = 0;

    for (const log of usageLogs) {
      if (log.type === 'url') totalUrl++;
      else if (log.type === 'vision') totalVision++;
      else if (log.type === 'chat') totalChat++;
    }

    const totalUrlCost = totalUrl * PRICE_URL;
    const totalVisionCost = totalVision * PRICE_VISION;
    const totalChatCost = totalChat * PRICE_CHAT;
    const totalCost = totalUrlCost + totalVisionCost + totalChatCost;

    return {
      totalUrl,
      totalVision,
      totalChat,
      totalUrlCost,
      totalVisionCost,
      totalChatCost,
      totalCost,
    };
  }, [usageLogs]);

  // グラフ用の最大値
  const maxCount = Math.max(
    1,
    totalStats.totalUrl,
    totalStats.totalVision,
    totalStats.totalChat
  );
  const maxCost = Math.max(
    1,
    totalStats.totalUrlCost,
    totalStats.totalVisionCost,
    totalStats.totalChatCost
  );

  // =========================================
  // 4. UI
  // =========================================

  if (loading || authStatus === 'checking') {
    return (
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
        <p>読み込み中です…</p>
      </main>
    );
  }

  if (authStatus === 'no-login') {
    return (
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
        <h2>管理画面</h2>
        <p>ログインしていません。まずは /login からログインしてください。</p>
      </main>
    );
  }

  if (authStatus === 'no-master') {
    return (
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
        <h2>管理画面</h2>
        <p>このアカウントには管理者権限がありません。</p>
      </main>
    );
  }

  const monthLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label || '';

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 16,
        background: '#F3F4F6',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        管理者ダッシュボード
      </h1>

      {/* 月選択 & 概要 */}
      <section
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>対象期間</div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                marginTop: 4,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #D1D5DB',
              }}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>登録アカウント数</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {profiles.length} 件
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>今月の合計金額（概算）</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              ¥{totalStats.totalCost.toLocaleString()}
            </div>
          </div>
        </div>
      </section>

      {/* 全体グラフ（回数） */}
      <section
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          全体利用回数（{monthLabel}）
        </h2>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
          SNS要約（URL）・画像API・チャットの利用回数の合計です。
        </p>

        <div style={{ display: 'grid', gap: 8 }}>
          {[
            {
              label: 'URL要約',
              count: totalStats.totalUrl,
              color: '#3B82F6',
            },
            {
              label: '画像API',
              count: totalStats.totalVision,
              color: '#10B981',
            },
            {
              label: 'チャット',
              count: totalStats.totalChat,
              color: '#F59E0B',
            },
          ].map((row) => (
            <div key={row.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span>{row.label}</span>
                <span>{row.count} 回</span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: '#E5E7EB',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(row.count / maxCount) * 100}%`,
                    height: '100%',
                    background: row.color,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 全体グラフ（金額） */}
      <section
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          全体利用金額（概算・{monthLabel}）
        </h2>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
          単価設定（URL: ¥{PRICE_URL} / 回、画像: ¥{PRICE_VISION} / 回、チャット: ¥{PRICE_CHAT} / 回）に基づく概算です。
        </p>

        <div style={{ display: 'grid', gap: 8 }}>
          {[
            {
              label: 'URL要約',
              cost: totalStats.totalUrlCost,
              color: '#3B82F6',
            },
            {
              label: '画像API',
              cost: totalStats.totalVisionCost,
              color: '#10B981',
            },
            {
              label: 'チャット',
              cost: totalStats.totalChatCost,
              color: '#F59E0B',
            },
          ].map((row) => (
            <div key={row.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span>{row.label}</span>
                <span>¥{row.cost.toLocaleString()}</span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: '#E5E7EB',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(row.cost / maxCost) * 100}%`,
                    height: '100%',
                    background: row.color,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* アカウント一覧 */}
      <section
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 16,
          marginBottom: 32,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          アカウント別利用状況（{monthLabel}）
        </h2>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
          各登録メールアドレスごとの利用回数・金額・権限・登録/解除日時を表示します。
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                  アカウントID（5桁）
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                  メールアドレス
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  マスター権限
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  URL要約
                  <br />
                  （回 / ¥）
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  画像API
                  <br />
                  （回 / ¥）
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  チャット
                  <br />
                  （回 / ¥）
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  合計金額
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  登録日時
                </th>
                <th style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
                  解除日時
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, index) => {
                const stat = userStats.get(p.id) || {
                  urlCount: 0,
                  visionCount: 0,
                  chatCount: 0,
                };

                const urlCost = stat.urlCount * PRICE_URL;
                const visionCost = stat.visionCount * PRICE_VISION;
                const chatCost = stat.chatCount * PRICE_CHAT;
                const sumCost = urlCost + visionCost + chatCost;

                // 5桁ID（表示用）
                const accountId = String(index + 1).padStart(5, '0');

                const formatDate = (value: string | null) =>
                  value ? new Date(value).toLocaleString() : '-';

                return (
                  <tr key={p.id}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {accountId}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.email || '-'}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        textAlign: 'center',
                      }}
                    >
                      {p.is_master ? '✅' : ''}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        textAlign: 'right',
                      }}
                    >
                      {stat.urlCount} 回
                      <br />
                      ¥{urlCost.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        textAlign: 'right',
                      }}
                    >
                      {stat.visionCount} 回
                      <br />
                      ¥{visionCost.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        textAlign: 'right',
                      }}
                    >
                      {stat.chatCount} 回
                      <br />
                      ¥{chatCost.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        textAlign: 'right',
                        fontWeight: 700,
                      }}
                    >
                      ¥{sumCost.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(p.registered_at)}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #E5E7EB',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(p.deleted_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
