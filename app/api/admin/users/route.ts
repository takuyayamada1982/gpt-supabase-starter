// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 今月の開始・終了（日本時間ベースにしたければここで調整）
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

type UsageType = 'url' | 'vision' | 'chat' | 'video';

interface UserProfileRow {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;
  deleted_at: string | null;
  trial_type: string | null;   // 'normal' | 'referral' | null
  plan_status: string | null;  // 'trial' | 'paid' | null
  plan_tier: string | null;    // 'starter' | 'pro' | null
}

interface UsageLogRow {
  user_id: string;
  type: UsageType;
  cost: number | null;
}

// SSG されないように明示
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { start, end } = getCurrentMonthRange();

    // 1) プロファイル一覧（ここで account_id を必ず取得）
    const { data: profiles, error: profilesErr } = await supabase
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
        ].join(', ')
      )
      .order('registered_at', { ascending: false });

    if (profilesErr) {
      console.error('profiles error:', profilesErr);
      return NextResponse.json(
        { error: 'profiles_error', message: 'プロフィールの取得に失敗しました。' },
        { status: 500 }
      );
    }

    const profileRows: UserProfileRow[] = (profiles ?? []) as UserProfileRow[];

    if (profileRows.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // 2) 今月分の usage_logs を全部取って、ユーザーごと・種別ごとに集計
    const { data: logs, error: logsErr } = await supabase
      .from('usage_logs')
      .select('user_id, type, cost')
      .gte('created_at', start)
      .lt('created_at', end);

    if (logsErr) {
      console.error('usage_logs error:', logsErr);
      return NextResponse.json(
        { error: 'usage_logs_error', message: '利用ログの取得に失敗しました。' },
        { status: 500 }
      );
    }

    const usageRows: UsageLogRow[] = (logs ?? []) as UsageLogRow[];

    type UsageAgg = {
      url: number;
      vision: number;
      chat: number;
      video: number;
      totalCost: number;
    };

    const usageByUser: Record<string, UsageAgg> = {};

    for (const log of usageRows) {
      const uid = log.user_id;
      if (!uid) continue;

      if (!usageByUser[uid]) {
        usageByUser[uid] = {
          url: 0,
          vision: 0,
          chat: 0,
          video: 0,
          totalCost: 0,
        };
      }

      const agg = usageByUser[uid];

      if (log.type === 'url') agg.url += 1;
      else if (log.type === 'vision') agg.vision += 1;
      else if (log.type === 'chat') agg.chat += 1;
      else if (log.type === 'video') agg.video += 1;

      const c = Number(log.cost ?? 0);
      if (!Number.isNaN(c)) {
        agg.totalCost += c;
      }
    }

    // 3) プロファイル + 今月の利用集計をマージして返す
    const users = profileRows.map((p) => {
      const usage = usageByUser[p.id] ?? {
        url: 0,
        vision: 0,
        chat: 0,
        video: 0,
        totalCost: 0,
      };

      return {
        id: p.id,
        email: p.email,
        account_id: p.account_id, // ★ここが常に profiles.account_id
        is_master: p.is_master,
        registered_at: p.registered_at,
        deleted_at: p.deleted_at,
        trial_type: p.trial_type,
        plan_status: p.plan_status,
        plan_tier: p.plan_tier,
        monthly_url_count: usage.url,
        monthly_vision_count: usage.vision,
        monthly_chat_count: usage.chat,
        monthly_video_count: usage.video,
        monthly_total_cost: usage.totalCost,
      };
    });

    return NextResponse.json({ users });
  } catch (e: any) {
    console.error('API /api/admin/users error', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? '予期せぬエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
