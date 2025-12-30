// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ※ バックエンド側の type が "video_thumb" になっている想定
type UsageType = 'url' | 'vision' | 'chat' | 'video_thumb';

interface Summary {
  month: string; // "2025-12" など
  totalRequests: number;
  totalCost: number;
  countsByType: Partial<Record<UsageType, number>> & {
    // 古い "video" キーで来ても対応できるようにしておく
    video?: number;
  };
  costsByType: Partial<Record<UsageType, number>> & {
    video?: number;
  };
}

interface MonthlyRow {
  month: string;
  urlCount: number | null;
  visionCount: number | null;
  chatCount: number | null;
  videoCount: number | null;
  totalCost: number | null;
}

interface AdminStatsResponse {
  summary?: Summary;
  monthly?: MonthlyRow[];
}

interface UserProfile {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;
  deleted_at: string | null;
  trial_type: string | null; // 'normal' | 'referral'
  plan_status: string | null; // 'trial' | 'paid'
  plan_tier: string | null; // 'starter' | 'pro' | null

  // 今月分の利用内訳（/api/admin/users から返す）
  monthly_url_count?: number | null;
  monthly_vision_count?: number | null;
  monthly_chat_count?: number | null;
  monthly_video_count?: number | null;
  monthly_total_cost?: number | null;
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

        // profiles は email ベースで紐付け
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
    if (!isMaster) return;

    const fetchAll = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/users'),
        ]);

        if (!statsRes.ok) {
          console.error('statsRes not ok:', statsRes.status);
          throw new Error('stats API error');
        }
        if (!usersRes.ok) {
          console.error('usersRes not ok:', usersRes.status);
          throw new Error('users API error');
        }

        const statsJson = (await statsRes.json()) as AdminStatsResponse;
        const usersJson = (await usersRes.json()) as AdminUsersResponse;

        console.log('admin/stats raw:', statsJson);
        console.log('admin/users raw:', usersJson);

        setStats(statsJson);

        // deleted_at が入っているユーザーは一覧から除外
        const rawUsers = usersJson.users ?? [];
        const activeUsers = rawUsers.filter((u) => !u.deleted_at);
        setUsers(activeUsers);
      } catch (err: any) {
        console.error('admin fetchAll error:', err);
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

  // 権限NG
  if (!isMaster) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#fecaca' }}>
          {errorMsg ?? '管理者権限がありません'}
        </span>
      </FullScreenCenter>
    );
  }

  // ローディング or API失敗 or stats が取れていない
  if (loading || !stats) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#cbd5f5' }}>
          {loading ? '読み込み中...' : 'データがありません'}
        </span>
      </FullScreenCenter>
    );
  }
  if (errorMsg) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#fecaca' }}>{errorMsg}</span>
      </FullScreenCenter>
    );
  }

  // ======== summary / monthly を組み立て ========

  const summary: Summary =
    stats.summary ?? {
      month: '—',
      totalRequests: 0,
      totalCost: 0,
      countsByType: {},
      costsByType: {},
    };

  const monthly: MonthlyRow[] = stats.monthly ?? [];

  const countsRaw = summary.countsByType ?? {};
  const costsRaw = summary.costsByType ?? {};

  // バックエンド側が "video_thumb" でも "video" でも両方拾えるようにしておく
  const counts: Record<UsageType, number> = {
    url: countsRaw.url ?? 0,
    vision: countsRaw.vision ?? 0,
    chat: countsRaw.chat ?? 0,
    video_thumb:
      countsRaw.video_thumb ??
      (countsRaw as any).video ?? // 旧キーの保険
      0,
  };

  const costs: Record<UsageType, number> = {
    url: costsRaw.url ?? 0,
    vision: costsRaw.vision ?? 0,
    chat: costsRaw.chat ?? 0,
    video_thumb:
      costsRaw.video_thumb ??
      (costsRaw as any).video ?? // 旧キーの保険
      0,
  };

  const maxCount = Math.max(
    counts.url,
    counts.vision,
    counts.chat,
    counts.video_thumb,
    1,
  );
  const maxCost = Math.max(
    costs.url,
    costs.vision,
    costs.chat,
    costs.video_thumb,
    1,
  );

  const monthLabel = summary.month || '—';

  const formatYen = (v: number) => `¥${v.toFixed(1)}`;

  const typeLabel: Record<UsageType, string> = {
    url: 'URL要約',
    vision: '画像→SNS',
    chat: 'Chat',
    video_thumb: '動画→文字',
  };

  const typeOrder: UsageType[] = ['url', 'vision', 'chat', 'video_thumb'];

  // ======== ユーザー系 KPI（全体のユーザー数） ========

  const totalUsers = users.length;
  const paidUsers = users.filter((u) => u.plan_status === 'paid').length;
  const trialUsers = users.filter((u) => u.plan_status === 'trial').length;

  const activeUsersCount = users.filter((u) => {
    const url = Number(u.monthly_url_count ?? 0);
    const vis = Number(u.monthly_vision_count ?? 0);
    const chat = Number(u.monthly_chat_count ?? 0);
    const video = Number(u.monthly_video_count ?? 0);
    return url + vis + chat + video > 0;
  }).length;

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
              利用回数・API原価・ユーザー状態・ユーザー別内訳をダッシュボードで確認できます
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
            <div>対象月: {monthLabel}</div>
            <div>URL 0.7円 / 画像 1円 / Chat 0.3円 / 動画 20円</div>
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
        {/* KPIカード：上段は「全体のユーザー数」系、下段は利用状況系 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <KpiCard
            title="登録ユーザー数（有効）"
            value={`${totalUsers.toLocaleString()} 人`}
          />
          <KpiCard
            title="有料ユーザー数"
            value={`${paidUsers.toLocaleString()} 人`}
          />
          <KpiCard
            title="トライアルユーザー数"
            value={`${trialUsers.toLocaleString()} 人`}
          />
          <KpiCard
            title="今月利用ユーザー数"
            value={`${activeUsersCount.toLocaleString()} 人`}
          />
          <KpiCard
            title="今月の総リクエスト"
            value={summary.totalRequests.toLocaleString()}
          />
          <KpiCard
            title="今月の推定料金"
            value={formatYen(summary.totalCost)}
          />
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
          <Card title="今月の利用回数（種別別）">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {typeOrder.map((t) => {
                const count = counts[t];
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
                      <span style={{ color: '#e5e7eb' }}>{typeLabel[t]}</span>
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
          <Card title="今月の金額内訳（種別別）">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {typeOrder.map((t) => {
                const cost = costs[t];
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
                      <span style={{ color: '#e5e7eb' }}>{typeLabel[t]}</span>
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
                    <Th align="right">動画</Th>
                    <Th align="right">合計リクエスト</Th>
                    <Th align="right">料金合計</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => {
                    const url = Number(m.urlCount ?? 0);
                    const vis = Number(m.visionCount ?? 0);
                    const chat = Number(m.chatCount ?? 0);
                    const video = Number(m.videoCount ?? 0);
                    const totalCost = Number(m.totalCost ?? 0);

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
                        <Td align="right">{formatYen(totalCost)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ユーザー一覧テーブル */}
        <div style={{ marginTop: 24 }}>
          <Card title="ユーザー一覧（プラン種別・トライアル・今月の利用内訳）">
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
                    <Th>トライアル</Th>
                    <Th>登録日</Th>
                    <Th>ステータス</Th>
                    <Th align="right">URL</Th>
                    <Th align="right">画像</Th>
                    <Th align="right">Chat</Th>
                    <Th align="right">動画</Th>
                    <Th align="right">当月料金</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const trialView = getTrialStatus(u);
                    const trialTypeLabel = getTrialTypeLabel(u.trial_type);
                    const planLabel = getPlanTierLabel(u.plan_tier);
                    const regDate = formatDateYmd(u.registered_at);

                    const url = Number(u.monthly_url_count ?? 0);
                    const vis = Number(u.monthly_vision_count ?? 0);
                    const chat = Number(u.monthly_chat_count ?? 0);
                    const video = Number(u.monthly_video_count ?? 0);
                    const cost = Number(u.monthly_total_cost ?? 0);

                    return (
                      <tr
                        key={u.id}
                        style={{ borderTop: '1px solid #1f2937' }}
                      >
                        <Td>{u.account_id ?? '-'}</Td>
                        <Td>{u.email ?? '-'}</Td>
                        <Td>{planLabel}</Td>
                        <Td>{trialTypeLabel}</Td>
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
                        <Td align="right">{formatYen(cost)}</Td>
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
  // 契約者なら常に「契約中」
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

  if (remaining <= 0) {
    const daysAgo = -remaining;
    return {
      kind: 'trial_expired',
      label: `無料期間終了（${daysAgo}日前）`,
      bgColor: '#7f1d1d',
      textColor: '#fecaca',
    };
  }

  if (remaining <= 3) {
    return {
      kind: 'trial_warning',
      label: `まもなく終了（残り${remaining}日）`,
      bgColor: '#7c2d12',
      textColor: '#fed7aa',
    };
  }

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

/* ===== 小さなコンポーネント ===== */

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
      <div style={{ fontSize: 20, fontWeight: 600 }}>{props.value}</div>
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
