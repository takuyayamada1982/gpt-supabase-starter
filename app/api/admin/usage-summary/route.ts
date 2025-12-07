// app/api/admin/usage-summary/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// サーバーサイド用 Supabase クライアント（Service Role Key 利用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 今月の開始・終了を返すヘルパー（YYYY-MM-01〜翌月01日）
function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  const start = new Date(year, month, 1);       // 今月1日
  const end = new Date(year, month + 1, 1);     // 翌月1日

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    ym: `${year}-${(month + 1).toString().padStart(2, '0')}`,
  };
}

export async function GET() {
  try {
    const { start, end, ym } = getMonthRange();

    // usage_logs から今月分を取得
    const { data, error } = await supabase
      .from('usage_logs')
      .select('type, cost')
      .gte('created_at', start)
      .lt('created_at', end);

    if (error) {
      console.error('usage_logs error:', error);
      return NextResponse.json(
        { error: 'db_error', message: 'usage_logs の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 集計用オブジェクトを初期化
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
        month: ym,            // "2025-12" のような文字列
        totalRequests,        // 今月の全リクエスト数
        totalCost,            // 今月の合計コスト
        countsByType: counts, // { url, vision, chat, video }
        costsByType: costs,   // { url, vision, chat, video }
      },
    });
  } catch (e: unknown) {
    console.error('internal error in /api/admin/usage-summary:', e);

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
