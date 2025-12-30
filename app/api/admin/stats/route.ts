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
    // ① 期間：直近 24 ヶ月ぶんだけ見る
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // 24 ヶ月前（だいたいで OK）
    const from = new Date(year, month - 23, 1);
    const to = new Date(year, month + 1, 1); // 来月 1 日

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
          } satisfies Summary,
          monthly: [] as MonthlyRow[],
        },
        { status: 200 },
      );
    }

    const usageLogs = logs ?? [];

    // ② 月ごとの集計用マップ
    const monthlyMap = new Map<
      string,
      {
        url: number;
        vision: number;
        chat: number;
        video: number;
        cost: number;
      }
    >();

    const getMonthKey = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      return `${y}-${m}`;
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
      if (type === 'url') agg.url += 1;
      else if (type === 'vision') agg.vision += 1;
      else if (type === 'chat') agg.chat += 1;
      else if (type === 'video') agg.video += 1;

      const c =
        typeof row.cost === 'number'
          ? row.cost
          : row.cost
          ? Number(row.cost)
          : 0;
      if (!Number.isNaN(c)) {
        agg.cost += c;
      }
    }

    // ③ 月次一覧を作成（キーでソート）
    const monthKeys = Array.from(monthlyMap.keys()).sort(); // 昇順
    const monthly: MonthlyRow[] = monthKeys.map((key) => {
      const agg = monthlyMap.get(key)!;
      return {
        month: key,
        urlCount: agg.url,
        visionCount: agg.vision,
        chatCount: agg.chat,
        videoCount: agg.video,
        totalCost: agg.cost,
      };
    });

    // ④ 今月分の summary を計算
    const currentKey = getMonthKey(now);
    const currentAgg =
      monthlyMap.get(currentKey) ??
      ({ url: 0, vision: 0, chat: 0, video: 0, cost: 0 } as const);

    const totalRequests =
      currentAgg.url + currentAgg.vision + currentAgg.chat + currentAgg.video;

    const summary: Summary = {
      month: currentKey,
      totalRequests,
      totalCost: currentAgg.cost,
      countsByType: {
        url: currentAgg.url,
        vision: currentAgg.vision,
        chat: currentAgg.chat,
        video: currentAgg.video,
      },
      costsByType: {
        // 単価は既に usage_logs.cost に反映済みなので、そのまま合計値だけ持つ
        url: 0, // 種別別の金額を分けたい場合は、上のループで type ごとに cost を分けて集計する
        vision: 0,
        chat: 0,
        video: 0,
      },
    };

    // ★ costsByType も「ちゃんと種別ごとに見たい」場合は、
    //    上のループを少し複雑にして type ごとの cost を分けて集計する実装に差し替えてください。
    //    まずは「総額」と「リクエスト数」が正しく動くことを優先しています。

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
        } satisfies Summary,
        monthly: [] as MonthlyRow[],
      },
      { status: 200 },
    );
  }
}
