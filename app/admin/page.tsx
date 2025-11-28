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
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-300">読み込み中...</div>
      </div>
    );
  }

  if (errorMsg || !stats) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-sm text-red-300">{errorMsg ?? 'データがありません'}</div>
      </div>
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
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* ヘッダー */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <p className="text-xs text-slate-400">
              利用回数とAPI原価を、シンプルな棒グラフで確認できます
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>対象月: {monthLabel}</div>
            <div>URL 0.7円 / 画像 1円 / Chat 0.3円</div>
          </div>
        </div>
      </header>

      {/* 本体 */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* KPIカード */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="今月の総リクエスト" value={summary.totalRequests.toLocaleString()} />
          <KpiCard title="今月の推定料金" value={formatYen(summary.totalCost)} />
          <KpiCard title="対象月" value={monthLabel} />
        </section>

        {/* 利用回数の棒グラフ（3本） */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="今月の利用回数（棒グラフ）">
            <div className="space-y-3">
              {typeOrder.map((t) => {
                const count = counts[t];
                const width = (count / maxCount) * 100;
                return (
                  <div key={t}>
                    <div className="flex items-baseline justify-between mb-1 text-xs">
                      <span className="text-slate-200">{typeLabel[t]}</span>
                      <span className="text-slate-400">{count.toLocaleString()} 回</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${width}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 金額の棒グラフ（3本） */}
          <Card title="今月の金額内訳（棒グラフ）">
            <div className="space-y-3">
              {typeOrder.map((t) => {
                const cost = costs[t];
                const width = (cost / maxCost) * 100;
                return (
                  <div key={t}>
                    <div className="flex items-baseline justify-between mb-1 text-xs">
                      <span className="text-slate-200">{typeLabel[t]}</span>
                      <span className="text-slate-400">{formatYen(cost)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-400"
                        style={{ width: `${width}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* 月次一覧（テーブル） */}
        <section>
          <Card title="月次の利用・料金一覧（最大24ヶ月）">
            <div className="max-h-80 overflow-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-2 py-1">月</th>
                    <th className="px-2 py-1 text-right">URL</th>
                    <th className="px-2 py-1 text-right">画像</th>
                    <th className="px-2 py-1 text-right">Chat</th>
                    <th className="px-2 py-1 text-right">合計リクエスト</th>
                    <th className="px-2 py-1 text-right">料金合計</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-t border-slate-800">
                      <td className="px-2 py-1">{m.month}</td>
                      <td className="px-2 py-1 text-right">{m.urlCount.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right">
                        {m.visionCount.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-right">{m.chatCount.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right">
                        {(m.urlCount + m.visionCount + m.chatCount).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-right">{formatYen(m.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function KpiCard(props: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {props.title}
      </div>
      <div className="text-2xl font-semibold">{props.value}</div>
    </div>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <h2 className="text-sm font-semibold">{props.title}</h2>
      {props.children}
    </section>
  );
}
