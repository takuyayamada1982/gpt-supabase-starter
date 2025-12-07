// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface Summary {
  month: string;
  totalRequests: number;
  totalCost: number;
  countsByType: Partial<Record<UsageType, number>>;
  costsByType: Partial<Record<UsageType, number>>;
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
  summary: Summary;
  monthly: MonthlyRow[];
}

// 単価（ヘッダー表示と合わせる）
const UNIT_COST: Record<UsageType, number> = {
  url: 0.7,
  vision: 1.0,
  chat: 0.3,
  video: 20.0,
};

// YYYY-MM 形式のキーを作る
function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

// 直近 N ヶ月分を作る
function buildMonthList(n: number): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    list.push(`${y}-${m}`);
  }
  return list; // 新しい月 → 古い月 の順
}

export async function GET() {
  try {
    // 直近 24 ヶ月を対象にする
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 23, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { data: logs, error } = await supabase
      .from('usage_logs')
      .select('type, cost, created_at')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString());

    if (error) {
      console.error('usage_logs error in /api/admin/stats:', error);
      return NextResponse.json(
        { error: 'db_error', message: 'usage_logs の取得に失敗しました' },
        { status: 500 }
      );
    }

    const logsSafe = logs ?? [];

    // 月別集計用
    type MonthAgg = {
      counts: Record<UsageType, number>;
      totalCost: number;
    };

    const monthMap = new Map<string, MonthAgg>();

    // 今月サマリー用
    const currentMonthKey = getMonthKey(now.toISOString());
    const summaryCounts: Record<UsageType, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video: 0,
    };
    const summaryCosts: Record<UsageType, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video: 0,
    };

    for (const row of logsSafe) {
      const type = row.type as UsageType;
      if (!['url', 'vision', 'chat', 'video'].includes(type)) continue;

      const createdAt = String(row.created_at);
      const monthKey = getMonthKey(createdAt);

      // ★ cost が 0 / null のことがあるので、件数 × 単価で補完
      const rawCost = typeof row.cost === 'number' ? row.cost : 0;
      const unit = UNIT_COST[type];
      const cost = rawCost > 0 ? rawCost : unit;

      // 月別集計
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          counts: { url: 0, vision: 0, chat: 0, video: 0 },
          totalCost: 0,
        });
      }
      const agg = monthMap.get(monthKey)!;
      agg.counts[type] += 1;
      agg.totalCost += cost;

      // 今月分サマリー
      if (monthKey === currentMonthKey) {
        summaryCounts[type] += 1;
        summaryCosts[type] += cost;
      }
    }

    const totalRequests =
      summaryCounts.url +
      summaryCounts.vision +
      summaryCounts.chat +
      summaryCounts.video;

    const totalCost =
      summaryCosts.url +
      summaryCosts.vision +
      summaryCosts.chat +
      summaryCosts.video;

    const summary: Summary = {
      month: currentMonthKey,
      totalRequests,
      totalCost: Number(totalCost.toFixed(1)),
      countsByType: summaryCounts,
      costsByType: {
        url: Number(summaryCosts.url.toFixed(1)),
        vision: Number(summaryCosts.vision.toFixed(1)),
        chat: Number(summaryCosts.chat.toFixed(1)),
        video: Number(summaryCosts.video.toFixed(1)),
      },
    };

    // 月次一覧（最大 24 ヶ月分）を作成
    const monthList = buildMonthList(24); // 2025-12, 2025-11, ... の順

    const monthly: MonthlyRow[] = monthList.map((m) => {
      const agg = monthMap.get(m);
      const counts = agg?.counts ?? {
        url: 0,
        vision: 0,
        chat: 0,
        video: 0,
      };
      const cost = agg?.totalCost ?? 0;

      return {
        month: m,
        urlCount: counts.url,
        visionCount: counts.vision,
        chatCount: counts.chat,
        videoCount: counts.video,
        totalCost: Number(cost.toFixed(1)),
      };
    });

    const result: AdminStatsResponse = {
      summary,
      monthly,
    };

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('internal error in /api/admin/stats:', e);
    const message = e instanceof Error ? e.message : 'internal error';
    return NextResponse.json(
      { error: 'internal_error', message },
      { status: 500 }
    );
  }
}
