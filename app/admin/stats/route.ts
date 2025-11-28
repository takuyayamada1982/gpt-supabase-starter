// app/api/admin/stats/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calcCostByType } from '@/lib/billings';
import type {
  AdminStatsResponse,
  MonthlyUsage,
  TopUserUsage,
  RecentLog,
  AdminUsageType,
} from '@/types/admin-stats';

// サーバー専用クライアント（環境変数はプロジェクトに合わせて設定）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // サーバー側のみで使用
);

// 'YYYY-MM' 形式の月キーを作る
function toMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${m.toString().padStart(2, '0')}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month'); // 'YYYY-MM' 指定可

    // TODO: 認証して is_master=true のユーザーだけ通す
    // ここは既存の認証ロジックに合わせて追加してください

    // 1. プロフィール数（削除されていないユーザー）
    const { count: totalUsers, error: profilesError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (profilesError) throw profilesError;

    // 2. 直近24ヶ月分のusage_logsをまとめて取得してJS側で集計
    const now = new Date();
    const twentyFourMonthsAgo = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth() - 24,
      1
    );

    const { data: logs, error: logsError } = await supabase
      .from('usage_logs')
      .select(
        `
        id,
        user_id,
        type,
        created_at,
        profiles:profiles!inner (
          id,
          email,
          account_id
        )
      `
      )
      .gte('created_at', twentyFourMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    if (logsError) throw logsError;

    const allLogs = logs ?? [];

    // 3. 月別集計（JS側でbucket化）
    const monthlyMap = new Map<
      string,
      { url: number; vision: number; chat: number }
    >();

    allLogs.forEach((row: any) => {
      const d = new Date(row.created_at);
      const key = toMonthKey(d);
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { url: 0, vision: 0, chat: 0 });
      }
      const bucket = monthlyMap.get(key)!;
      if (row.type === 'url') bucket.url += 1;
      if (row.type === 'vision') bucket.vision += 1;
      if (row.type === 'chat') bucket.chat += 1;
    });

    // 月キーでソート（昇順）
    const monthKeys = Array.from(monthlyMap.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    const monthlyUsage: MonthlyUsage[] = monthKeys.map((month) => {
      const counts = monthlyMap.get(month)!;
      const costs = calcCostByType(counts);
      return {
        month,
        urlCount: counts.url,
        visionCount: counts.vision,
        chatCount: counts.chat,
        totalCost: costs.total,
      };
    });

    // 4. 対象月（指定がない場合は最後の月＝最新）
    const targetMonth =
      monthParam && monthParam !== ''
        ? monthParam
        : monthKeys.length > 0
        ? monthKeys[monthKeys.length - 1]
        : null;

    // 5. 対象月の開始・終了
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (targetMonth) {
      const [y, m] = targetMonth.split('-').map((s) => Number(s));
      startDate = new Date(Date.UTC(y, m - 1, 1));
      endDate = new Date(Date.UTC(y, m, 1)); // 翌月1日
    }

    // 6. 対象月の回数集計 & ユーザー別集計
    let monthCountsByType = { url: 0, vision: 0, chat: 0 };
    let monthRequests = 0;

    const userMap = new Map<
      string,
      {
        userId: string;
        accountId: string;
        email: string;
        urlCount: number;
        visionCount: number;
        chatCount: number;
      }
    >();

    allLogs.forEach((row: any) => {
      const createdAt = new Date(row.created_at);

      // 対象月でなければスキップ
      if (!startDate || !endDate) return;
      if (createdAt < startDate || createdAt >= endDate) return;

      const t = row.type as AdminUsageType;

      // 月別回数
      if (t === 'url') monthCountsByType.url += 1;
      if (t === 'vision') monthCountsByType.vision += 1;
      if (t === 'chat') monthCountsByType.chat += 1;

      // ユーザー別集計
      const userId = row.user_id as string;
      const profile = row.profiles;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          accountId: profile?.account_id ?? '',
          email: profile?.email ?? '',
          urlCount: 0,
          visionCount: 0,
          chatCount: 0,
        });
      }
      const userEntry = userMap.get(userId)!;
      if (t === 'url') userEntry.urlCount += 1;
      if (t === 'vision') userEntry.visionCount += 1;
      if (t === 'chat') userEntry.chatCount += 1;
    });

    monthRequests =
      monthCountsByType.url +
      monthCountsByType.vision +
      monthCountsByType.chat;

    const monthCostsByType = calcCostByType(monthCountsByType);

    // 7. ユーザー別ランキング（対象月）
    const topUsers: TopUserUsage[] = Array.from(userMap.values())
      .map((u) => {
        const costs = calcCostByType({
          url: u.urlCount,
          vision: u.visionCount,
          chat: u.chatCount,
        });
        return {
          ...u,
          totalCost: costs.total,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    // 8. 最近のログ（直近50件）
    const recentSorted = [...allLogs].sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    const recentLogs: RecentLog[] = recentSorted
      .slice(0, 50)
      .map((row: any) => ({
        id: row.id,
        createdAt: row.created_at,
        type: row.type as AdminUsageType,
        userEmail: row.profiles?.email ?? '',
        accountId: row.profiles?.account_id ?? '',
      }));

    // 9. 全期間の総リクエスト数
    const totalRequests = allLogs.length;

    const summary = {
      totalRequests,
      totalUsers: totalUsers ?? 0,
      monthRequests,
      monthCost: monthCostsByType.total,
      monthCountsByType,
      monthCostsByType: {
        url: monthCostsByType.url,
        vision: monthCostsByType.vision,
        chat: monthCostsByType.chat,
      },
    };

    const body: AdminStatsResponse = {
      summary,
      monthlyUsage,
      topUsers,
      recentLogs,
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error('admin/stats error', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

