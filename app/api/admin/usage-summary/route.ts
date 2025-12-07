// app/api/admin/usage-summary/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';

// 今月の YYYY-MM を計算
function getYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET() {
  try {
    const ym = getYearMonth();

    // usage_logs を集計
    const { data, error } = await supabase
      .from('usage_logs')
      .select('type, cost')
      .gte('created_at', `${ym}-01`)
      .lt('created_at', `${ym}-31`);

    if (error) {
      console.error('usage_logs error:', error);
      return NextResponse.json(
        { error: 'db_error', message: 'usage_logs の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 集計用オブジェクト
    const counts: Record<string, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video: 0,
    };

    const costs: Record<string, number> = {
      url: 0,
      vision: 0,
      chat: 0,
      video: 0,
    };

    let totalRequests = 0;
    let totalCost = 0;

    for (const row of data ?? []) {
      const t = row.type as string;
      const c = row.cost ?? 0;

      if (counts[t] !== undefined) {
        counts[t] += 1;
        costs[t] += c;
      }

      totalRequests += 1;
      totalCost += c;
    }

    return NextResponse.json({
      summary: {
        month: ym,
        totalRequests,
        totalCost,
        countsByType: counts,
        costsByType: costs,
      },
    });
  } catch (e: unknown) {
    console.error('internal error:', e);

    const message =
      e instanceof Error ? e.message : 'internal error';

    return NextResponse.json(
      {
        error: 'internal_error',
        message,
      },
      { status: 500 }
    );
  }
}
