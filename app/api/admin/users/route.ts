// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface UserProfileRow {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;
  deleted_at: string | null;
  trial_type: string | null;   // 'normal' | 'referral'
  plan_status: string | null;  // 'trial' | 'paid'
  plan_tier: string | null;    // 'starter' | 'pro' | null
}

// 今月の開始・終了
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function GET() {
  try {
    const { start, end } = getCurrentMonthRange();

    // 1) 全ユーザープロファイルを取得
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(
        [
          'id',
          'email',
          'account_id',
          'is_master',
          'registered_at',
          'deleted_at',
          'trial_type',
          'plan_status',
          'plan_tier',
        ].join(',')
      );

    if (profilesError) {
      console.error('profiles error:', profilesError);
      return NextResponse.json(
        { error: 'db_error', message: 'profiles の取得に失敗しました' },
        { status: 500 }
      );
    }

    // ★ 型の取り扱いで怒られていたので、unknown を挟んで安全にキャスト
    const profileRows: UserProfileRow[] = (profiles ?? []) as unknown as UserProfileRow[];

    if (profileRows.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // 2) 今月の usage_logs をユーザー別に集計
    const { data: logs, error: logsError } = await supabase
      .from('usage_logs')
      .select('user_id, type, cost')
      .gte('created_at', start)
      .lt('created_at', end);

    if (logsError) {
      console.error('usage_logs error:', logsError);
      return NextResponse.json(
        { error: 'db_error', message: 'usage_logs の取得に失敗しました' },
        { status: 500 }
      );
    }

    type UserUsage = {
      url: number;
      vision: number;
      chat: number;
      video: number;
      totalCost: number;
    };

    const usageMap = new Map<string, UserUsage>();

    for (const row of logs ?? []) {
      const userId = row.user_id as string;
      if (!userId) continue;

      const type = row.type as UsageType;
      const cost = Number(row.cost ?? 0);

      if (!usageMap.has(userId)) {
        usageMap.set(userId, {
          url: 0,
          vision: 0,
          chat: 0,
          video: 0,
          totalCost: 0,
        });
      }

      const u = usageMap.get(userId)!;

      if (type === 'url') u.url += 1;
      if (type === 'vision') u.vision += 1;
      if (type === 'chat') u.chat += 1;
      if (type === 'video') u.video += 1;
      u.totalCost += cost;
    }

    // 3) profiles に monthly_* をマージ
    const usersWithUsage = profileRows.map((p) => {
      const u = usageMap.get(p.id);
      return {
        ...p,
        monthly_url_count: u?.url ?? 0,
        monthly_vision_count: u?.vision ?? 0,
        monthly_chat_count: u?.chat ?? 0,
        monthly_video_count: u?.video ?? 0,
        monthly_total_cost: u ? Number(u.totalCost.toFixed(1)) : 0,
      };
    });

    return NextResponse.json({
      users: usersWithUsage,
    });
  } catch (e: unknown) {
    console.error('internal error in /api/admin/users:', e);
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
