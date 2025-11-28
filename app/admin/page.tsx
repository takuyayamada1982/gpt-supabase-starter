// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

type UsageType = 'url' | 'vision' | 'chat';

interface AdminSummary {
  totalRequests: number;
  totalUsers: number;
  monthRequests: number;
  monthCost: number;
  monthCountsByType: {
    url: number;
    vision: number;
    chat: number;
  };
}

interface MonthlyUsage {
  month: string; // '2025-01'
  urlCount: number;
  visionCount: number;
  chatCount: number;
  totalCost: number;
}

interface TopUserUsage {
  userId: string;
  accountId: string;
  email: string;
  urlCount: number;
  visionCount: number;
  chatCount: number;
  totalCost: number;
}

interface RecentLog {
  id: string;
  createdAt: string;
  type: UsageType;
  userEmail: string;
  accountId: string;
}

interface AdminStatsResponse {
  summary: AdminSummary;
  monthlyUsage: MonthlyUsage[];
  topUsers: TopUserUsage[];
  recentLogs: RecentLog[];
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = selectedMonth ? `?month=${selectedMonth}` : '';
        const res = await fetch(`/api/admin/stats${params}`);
        const data: AdminStatsResponse = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch admin stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedMonth]);

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-300">Loading admin dashboard...</div>
      </div>
    );
  }

  const { summary, monthlyUsage, topUsers, recentLogs } = stats;

  const usageByTypeData = [
    { type: 'URL要約', key: 'url', count: summary.monthCountsByType.url },
    { type: '画像→SNS', key: 'vision', count: summary.monthCountsByType.vision },
    { type: 'Chat', key: 'chat', count: summary.monthCountsByType.chat },
  ];

  const pieData = usageByTypeData.map((d) => ({
    name: d.type,
    value: d.count,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* ヘッダー */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <p className="text-xs text-slate-400">
              利用状況と料金をリアルタイムにモニタリング
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 月選択（とりあえず簡易セレクト） */}
            <select
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
              value={selectedMonth ?? ''}
              onChange={(e) =>
                setSelectedMonth(e.target.value || null)
              }
            >
              <option value="">最新月</option>
              {monthlyUsage.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* KPIカード */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="今月の総リクエスト"
            value={summary.monthRequests.toLocaleString()}
            subtitle="url + vision + chat"
          />
          <KpiCard
            title="今月のURL要約"
            value={summary.monthCountsByType.url.toLocaleString()}
            subtitle="type = url"
          />
          <KpiCard
            title="今月の画像生成"
            value={summary.monthCountsByType.vision.toLocaleString()}
            subtitle="type = vision"
          />
          <KpiCard
            title="今月のChat"
            value={summary.monthCountsByType.chat.toLocaleString()}
            subtitle="type = chat"
          />
          <KpiCard
            title="今月の推定料金"
            value={`¥${summary.monthCost.toLocaleString()}`}
            subtitle="API原価ベース"
          />
          <KpiCard
            title="累計ユーザー数"
            value={summary.totalUsers.toLocaleString()}
            subtitle="profiles.count"
          />
        </section>

        {/* 利用内訳グラフ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="今月の利用回数（機能別）">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageByTypeData}>
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="今月の利用比率（機能別）">
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* 月次推移 */}
        <section>
          <Card title="月次推移（最大24ヶ月）">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyUsage}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="urlCount"
                    name="URL要約"
                  />
                  <Line
                    type="monotone"
                    dataKey="visionCount"
                    name="画像→SNS"
                  />
                  <Line
                    type="monotone"
                    dataKey="chatCount"
                    name="Chat"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* 下段テーブル */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ユーザーランキング */}
          <Card title="ユーザー別利用ランキング（上位10）">
            <div className="max-h-80 overflow-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-2 py-1">ユーザー</th>
                    <th className="px-2 py-1 text-right">URL</th>
                    <th className="px-2 py-1 text-right">画像</th>
                    <th className="px-2 py-1 text-right">Chat</th>
                    <th className="px-2 py-1 text-right">料金</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-t border-slate-800"
                    >
                      <td className="px-2 py-1">
                        <div className="font-medium">
                          {u.accountId}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {u.email}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">
                        {u.urlCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {u.visionCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {u.chatCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        ¥{u.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 最近のログ */}
          <Card title="最近の利用ログ">
            <div className="max-h-80 overflow-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-2 py-1">日時</th>
                    <th className="px-2 py-1">ユーザー</th>
                    <th className="px-2 py-1">type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-slate-800"
                    >
                      <td className="px-2 py-1">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-1">
                        <div className="font-medium">
                          {log.accountId}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {log.userEmail}
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <TypeBadge type={log.type} />
                      </td>
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

// 小さめの再利用コンポーネント

function KpiCard(props: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {props.title}
      </div>
      <div className="text-2xl font-semibold">{props.value}</div>
      {props.subtitle && (
        <div className="text-[11px] text-slate-500">
          {props.subtitle}
        </div>
      )}
    </div>
  );
}

function Card(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
      <h2 className="text-sm font-semibold">{props.title}</h2>
      {props.children}
    </section>
  );
}

function TypeBadge({ type }: { type: UsageType }) {
  const label =
    type === 'url' ? 'URL' : type === 'vision' ? '画像' : 'Chat';
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-[2px] text-[10px]">
      {label}
    </span>
  );
}
