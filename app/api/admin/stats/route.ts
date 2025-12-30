// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface Summary {
  month: string; // "2025-12"
  totalRequests: number;
  totalCost: number;
  countsByType: Partial<Record<UsageType, number>>;
  costsByType: Partial<Record<UsageType, number>>;
}

interface MonthlyRow {
  month: string; // "2025-12"
  urlCount: number;
  visionCount: number;
  chatCount: number;
  videoCount: number;
  totalCost: number;
}

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // 👇 直近24ヶ月分（ログ取得期間）
    const from = new Date(year, month - 23, 1); // 24ヶ月前の月初
    const to = new Date(year, month + 1, 1);    // 翌月1日

    const { data: logs, error } = await supabase
      .from('usage_logs')
      .select('created_at, type, cost')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString());

    if (error) {
      console.error('admin/stats usage_logs error:', error);
      return NextResponse.json(
        {
          summary: {
            month: '',
            totalRequests: 0,
            totalCost: 0,
            countsByType: {},
            costsByType: {},
          } as Summary,
          monthly: [] as MonthlyRow[],
        },
        { status: 200 },
      );
    }

    const usageLogs = logs ?? [];

    const getMonthKey = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      return `${y}-${m}`;
    };

    // 月ごと集計用
    const monthlyMap = new Map<
      string,
      { url: number; vision: number; chat: number; video: number; cost: number }
    >();

    // 今月 summary 用（種別別）
    const currentKey = getMonthKey(now);
    const currentCounts: Record<UsageType, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video: 0,
    };
    const currentCosts: Record<UsageType, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video: 0,
    };

    for (const row of usageLogs as any[]) {
      const createdAt = new Date(row.created_at);
      if (Number.isNaN(createdAt.getTime())) continue;

      const key = getMonthKey(createdAt);
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { url: 0, vision: 0, chat: 0, video: 0, cost: 0 });
      }
      const agg = monthlyMap.get(key)!;

      const type: string = row.type ?? '';
      const rawCost =
        typeof row.cost === 'number'
          ? row.cost
          : row.cost
          ? Number(row.cost)
          : 0;
      const c = Number.isNaN(rawCost) ? 0 : rawCost;

      if (type === 'url') agg.url += 1;
      else if (type === 'vision') agg.vision += 1;
      else if (type === 'chat') agg.chat += 1;
      else if (type === 'video') agg.video += 1;

      agg.cost += c;

      // 👇 今月分なら summary 用にも反映
      if (key === currentKey) {
        if (type === 'url') {
          currentCounts.url += 1;
          currentCosts.url += c;
        } else if (type === 'vision') {
          currentCounts.vision += 1;
          currentCosts.vision += c;
        } else if (type === 'chat') {
          currentCounts.chat += 1;
          currentCosts.chat += c;
        } else if (type === 'video') {
          currentCounts.video += 1;
          currentCosts.video += c;
        }
      }
    }

    // 👇 24ヶ月分すべてを埋める（ログが無い月も 0 で返す）
    const months: string[] = [];
    for (let i = 23; i >= 0; i -= 1) {
      const d = new Date(year, month - i, 1);
      months.push(getMonthKey(d));
    }

    const monthly: MonthlyRow[] = months.map((key) => {
      const agg =
        monthlyMap.get(key) ?? {
          url: 0,
          vision: 0,
          chat: 0,
          video: 0,
          cost: 0,
        };
      return {
        month: key,
        urlCount: agg.url,
        visionCount: agg.vision,
        chatCount: agg.chat,
        videoCount: agg.video,
        totalCost: agg.cost,
      };
    });

    const totalRequests =
      currentCounts.url +
      currentCounts.vision +
      currentCounts.chat +
      currentCounts.video;
    const totalCost =
      currentCosts.url +
      currentCosts.vision +
      currentCosts.chat +
      currentCosts.video;

    const summary: Summary = {
      month: currentKey,
      totalRequests,
      totalCost,
      countsByType: currentCounts,
      costsByType: currentCosts,
    };

    return NextResponse.json(
      {
        summary,
        monthly,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('admin/stats GET error:', e);
    return NextResponse.json(
      {
        summary: {
          month: '',
          totalRequests: 0,
          totalCost: 0,
          countsByType: {},
          costsByType: {},
        } as Summary,
        monthly: [] as MonthlyRow[],
      },
      { status: 200 },
    );
  }
}
