// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COST = {
  url: 0.7,
  vision: 1.0,
  chat: 0.3,
} as const;

type UsageType = 'url' | 'vision' | 'chat';

type Counts = Record<UsageType, number>;
type Costs = Record<UsageType, number>;

interface MonthlyRow {
  month: string; // 'YYYY-MM'
  urlCount: number;
  visionCount: number;
  chatCount: number;
  urlCost: number;
  visionCost: number;
  chatCost: number;
  totalCost: number;
}

interface Summary {
  month: string;
  totalRequests: number;
  totalCost: number;
  countsByType: Counts;
  costsByType: Costs;
}

interface ApiResponse {
  summary: Summary;
  monthly: MonthlyRow[];
}

function toMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${m.toString().padStart(2, '0')}`;
}

function calcCosts(counts: Counts): Costs {
  return {
    url: counts.url * COST.url,
    vision: counts.vision * COST.vision,
    chat: counts.chat * COST.chat,
  };
}

export async function GET(req: Request) {
  try {
    // 直近24ヶ月を対象にする
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1));

    const { data: logs, error } = await supabase
      .from('usage_logs')
      .select('id,type,created_at')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('admin stats logs error', error);
      return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
    }

    const allLogs = (logs ?? []).filter((row: any) =>
      row.type === 'url' || row.type === 'vision' || row.type === 'chat'
    );

    // 月別に bucket
    const monthlyMap = new Map<string, Counts>();

    allLogs.forEach((row: any) => {
      const createdAt = new Date(row.created_at);
      const key = toMonthKey(createdAt);
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { url: 0, vision: 0, chat: 0 });
      }
      const bucket = monthlyMap.get(key)!;
      bucket[row.type as UsageType] += 1;
    });

    const monthKeys = Array.from(monthlyMap.keys()).sort((a, b) => a.localeCompare(b));

    let monthly: MonthlyRow[] = [];

    monthKeys.forEach((month) => {
      const counts = monthlyMap.get(month)!;
      const costs = calcCosts(counts);
      monthly.push({
        month,
        urlCount: counts.url,
        visionCount: counts.vision,
        chatCount: counts.chat,
        urlCost: costs.url,
        visionCost: costs.vision,
        chatCost: costs.chat,
        totalCost: costs.url + costs.vision + costs.chat,
      });
    });

    // ログが全く無い場合用：現在の月で0を返す
    if (monthly.length === 0) {
      const currentMonth = toMonthKey(now);
      monthly = [
        {
          month: currentMonth,
          urlCount: 0,
          visionCount: 0,
          chatCount: 0,
          urlCost: 0,
          visionCost: 0,
          chatCost: 0,
          totalCost: 0,
        },
      ];
    }

    const target = monthly[monthly.length - 1]; // 最新月

    const countsByType: Counts = {
      url: target.urlCount,
      vision: target.visionCount,
      chat: target.chatCount,
    };

    const costsByType = calcCosts(countsByType);

    const summary: Summary = {
      month: target.month,
      totalRequests: target.urlCount + target.visionCount + target.chatCount,
      totalCost: costsByType.url + costsByType.vision + costsByType.chat,
      countsByType,
      costsByType,
    };

    const body: ApiResponse = {
      summary,
      monthly,
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error('admin stats GET error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
