// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';

type UsageType = 'url' | 'vision' | 'chat';

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
  urlCost: number;
  visionCost: number;
  chatCost: number;
  totalCost: number;
}

interface AdminStatsResponse {
  summary: Summary;
  monthly: MonthlyRow[];
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) {
          throw new Error('API error');
        }
        const data: AdminStatsResponse = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
        setErrorMsg('利用状況の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <FullScreenCenter>
        <span style={{ fontSize: 14, color: '#cbd5f5' }}>読み込み中...</span>
      </FullScreenCenter>
    );
  }

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

  const maxCount = Math.max(counts.url, counts.vision, counts.chat, 1);
  const maxCost = Math.max(costs.url, costs.vision, costs.chat, 1);

  const monthLabel = summary.month || '—';

  const formatYen = (v: number) => `¥${v.toFixed(1)}`;

  const typeLabel: Record<UsageType, string> = {
    url: 'URL要約',
    vision: '画像→SNS',
    chat: 'Chat',
  };

  const typeOrder: UsageType[] = ['url', 'vision', 'chat'];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020617', // slate-950
        color: '#e5e7eb', // slate-200
        fontFamily:
          '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>
              Admin Dashboard
            </h1>
            <p
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginTop: 4,
              }}
            >
              利用回数とAPI原価を、シンプルな棒グラフで確認できます
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
            <div>対象月: {monthLabel}</div>
            <div>URL 0.7円 / 画像 1円 / Chat 0.3円</div>
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
          <KpiCard
            title="今月の推定料金"
            value={formatYen(summary.totalCost)}
          />
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
                          backgroundColor: '#22c55e', // 緑
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
                          backgroundColor: '#38bdf8', // 青
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
                    <Th align="right">合計リクエスト</Th>
                    <Th align="right">料金合計</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} style={{ borderTop: '1px solid #1f2937' }}>
                      <Td>{m.month}</Td>
                      <Td align="right">{m.urlCount.toLocaleString()}</Td>
                      <Td align="right">{m.visionCount.toLocaleString()}</Td>
                      <Td align="right">{m.chatCount.toLocaleString()}</Td>
                      <Td align="right">
                        {(
                          m.urlCount +
                          m.visionCount +
                          m.chatCount
                        ).toLocaleString()}
                      </Td>
                      <Td align="right">{formatYen(m.totalCost)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

/* 小さいコンポーネントたち */

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
        fontFamily:
          '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
