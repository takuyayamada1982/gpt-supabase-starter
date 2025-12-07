// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// フロントと合わせた種別
type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface Summary {
  month: string; // "2025-12"
  totalRequests: number;
  totalCost: number;
  countsByType: Partial<Record<UsageType, number>>;
  costsByType: Partial<Record<UsageType, number>>;
}

interface MonthlyRow {
  month: string; // "YYYY-MM"
  urlCount: number | null;
  visionCount: number | null;
  chatCount: number | null;
  videoCount: number | null;
  totalCost: number | null;
}

// usage_logs から取る列
interface UsageLogRow {
  type: UsageType | null;
  created_at: string | null;
}

// 単価（フロントの表示と合わせる）
const PRICE: Record<UsageType, number> = {
  url: 0.7,
  vision: 1.0,
  chat: 0.3,
  video: 20,
};

// "2025-12" のようなキーを作る
function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

// 24 ヶ月分のキー配列（新しい順で返す）
function buildLast24Months(): string[] {
  const now = new Date();
  const list: string[] = [];
  // 現在月から過去 23 ヶ月
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(toMonthKey(d));
  }
  return list;
}

// 24 ヶ月分の先頭日を出す（クエリの開始日用：一番古い月の 1 日）
function getStartDateFor24Months(): string {
  const now = new Date();
  const oldest = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  return oldest.toISOString();
}

export async function GET() {
  try {
    const monthKeys = buildLast24Months(); // [ "2025-12", "2025-11", ... ]
    const startIso = getStartDateFor24Months();

    // 24 ヶ月分の usage_logs をまとめて取得
    const { data, error } = await supabase
      .from('usage_logs')
      .select('type, created_at')
      .gte('created_at', startIso);

    if (error) {
      console.error('[admin/stats] supabase error:', error);
      return NextResponse.json(
        { error: 'supabase_error', message: error.message },
        { status: 500 },
      );
    }

    const logs = (data ?? []) as UsageLogRow[];

    // 月 × 種別 のカウンタ
    const monthTypeCounts: Record<
      string,
      Partial<Record<UsageType, number>>
    > = {};

    // 初期化（24 ヶ月ぶん全部 0 で作っておく）
    for (const key of monthKeys) {
      monthTypeCounts[key] = { url: 0, vision: 0, chat: 0, video: 0 };
    }

    // ログを集計
    for (const row of logs) {
      if (!row.created_at || !row.type) continue;
      const d = new Date(row.created_at);
      const key = toMonthKey(d);

      // 24 ヶ月の範囲外ならスキップ
      if (!monthKeys.includes(key)) continue;

      const t = row.type as UsageType;
      const bucket = monthTypeCounts[key] ?? {
        url: 0,
        vision: 0,
        chat: 0,
        video: 0,
      };
      bucket[t] = (bucket[t] ?? 0) + 1;
      monthTypeCounts[key] = bucket;
    }

    // ===== current month summary を作成 =====
    const currentMonthKey = monthKeys[0]; // buildLast24Months の先頭 = 今月
    const currentCounts = monthTypeCounts[currentMonthKey] ?? {};

    const countsByType: Partial<Record<UsageType, number>> = {
      url: currentCounts.url ?? 0,
      vision: currentCounts.vision ?? 0,
      chat: currentCounts.chat ?? 0,
      video: currentCounts.video ?? 0,
    };

    const costsByType: Partial<Record<UsageType, number>> = {
      url: (countsByType.url ?? 0) * PRICE.url,
      vision: (countsByType.vision ?? 0) * PRICE.vision,
      chat: (countsByType.chat ?? 0) * PRICE.chat,
      video: (countsByType.video ?? 0) * PRICE.video,
    };

    const totalRequests =
      (countsByType.url ?? 0) +
      (countsByType.vision ?? 0) +
      (countsByType.chat ?? 0) +
      (countsByType.video ?? 0);

    const totalCost =
      (costsByType.url ?? 0) +
      (costsByType.vision ?? 0) +
      (costsByType.chat ?? 0) +
      (costsByType.video ?? 0);

    const summary: Summary = {
      month: currentMonthKey,
      totalRequests,
      totalCost,
      countsByType,
      costsByType,
    };

    // ===== 月別一覧（24 ヶ月ぶん）を作成 =====
    const monthly: MonthlyRow[] = monthKeys.map((key) => {
      const c = monthTypeCounts[key] ?? {};
      const url = c.url ?? 0;
      const vision = c.vision ?? 0;
      const chat = c.chat ?? 0;
      const video = c.video ?? 0;
      const cost =
        url * PRICE.url +
        vision * PRICE.vision +
        chat * PRICE.chat +
        video * PRICE.video;

      return {
        month: key,
        urlCount: url,
        visionCount: vision,
        chatCount: chat,
        videoCount: video,
        totalCost: cost,
      };
    });

    // フロントの期待する形
    return NextResponse.json(
      {
        summary,
        monthly,
      },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('[admin/stats] unexpected error:', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? 'unknown error',
      },
      { status: 500 },
    );
  }
}
