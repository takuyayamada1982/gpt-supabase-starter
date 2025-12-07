// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface Summary {
  month: string; // "2025-12"
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

// 直近24か月分の "YYYY-MM" を新しい順に返す
function getLastMonths(n: number): string[] {
  const res: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;
    res.push(ym);
  }
  return res;
}

// 指定月の1日〜翌月1日をISOで返す
function getMonthRange(year: number, month0: number) {
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function GET() {
  try {
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;

    // 直近24か月ぶんのリスト（新しい順）
    const monthsDesc = getLastMonths(24);
    // 月 → 集計値 のハッシュ
    const monthlyMap: Record<
      string,
      {
        urlCount: number;
        visionCount: number;
        chatCount: number;
        videoCount: number;
        totalCost: number;
      }
    > = {};

    monthsDesc.forEach((ym) => {
      monthlyMap[ym] = {
        urlCount: 0,
        visionCount: 0,
        chatCount: 0,
        videoCount: 0,
        totalCost: 0,
      };
    });

    // 24か月前の月初から、今月末までの範囲で usage_logs を取得
    const oldest = monthsDesc[monthsDesc.length - 1]; // 一番古い "YYYY-MM"
    const [oldY, oldM] = oldest.split('-').map((v) => Number(v));
    const fromRange = getMonthRange(oldY, oldM - 1).start;

    const { start: currentStart, end: currentEnd } = getMonthRange(
      now.getFullYear(),
      now.getMonth()
    );

    const { data, error } = await supabase
      .from('usage_logs')
      .select('type, cost, created_at')
      .gte('created_at', fromRange)
      .lt('created_at', currentEnd);

    if (error) {
      console.error('usage_logs error:', error);
      return NextResponse.json(
        { error: 'db_error', message: 'usage_logs の取得に失敗しました' },
        { status: 500 }
      );
    }

    // サマリ（今月分）
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
    let totalRequests = 0;
    let totalCost = 0;

    for (const row of data ?? []) {
      const created = new Date(row.created_at as string);
      const ym = `${created.getFullYear()}-${(created.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;

      const type = row.type as UsageType;
      const cost = Number(row.cost ?? 0);

      // 月次マップに存在しない月（24か月より前）は無視
      const m = monthlyMap[ym];
      if (m) {
        if (type === 'url') m.urlCount += 1;
        if (type === 'vision') m.visionCount += 1;
        if (type === 'chat') m.chatCount += 1;
        if (type === 'video') m.videoCount += 1;
        m.totalCost += cost;
      }

      // 今月分のサマリ計算
      if (
        created.toISOString() >= currentStart &&
        created.toISOString() < currentEnd
      ) {
        if (summaryCounts[type] !== undefined) {
          summaryCounts[type] += 1;
          summaryCosts[type] += cost;
        }
        totalRequests += 1;
        totalCost += cost;
      }
    }

    const summary: Summary = {
      month: currentYm,
      totalRequests,
      totalCost,
      countsByType: summaryCounts,
      costsByType: summaryCosts,
    };

    // 月次テーブル用に配列へ（新しい月が上に来るように）
    const monthlyRows: MonthlyRow[] = monthsDesc.map((ym) => {
      const m = monthlyMap[ym];
      return {
        month: ym,
        urlCount: m.urlCount,
        visionCount: m.visionCount,
        chatCount: m.chatCount,
        videoCount: m.videoCount,
        totalCost: Number(m.totalCost.toFixed(1)),
      };
    });

    return NextResponse.json({
      summary,
      monthly: monthlyRows,
    });
  } catch (e: unknown) {
    console.error('internal error in /api/admin/stats:', e);
    const message = e instanceof Error ? e.message : 'internal error';

    return NextResponse.json(
      {
        error: 'internal_error',
        message,
      },
      { status: 500 }
    );
  }
}
