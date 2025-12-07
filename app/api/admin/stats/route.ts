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
  trial_type: string | null;   // 'normal' | 'referral' | null
  plan_status: string | null;  // 'trial' | 'paid' | null
  plan_tier: string | null;    // 'starter' | 'pro' | null
}

interface AdminUserResponse extends UserProfileRow {
  monthly_url_count: number | null;
  monthly_vision_count: number | null;
  monthly_chat_count: number | null;
  monthly_video_count: number | null;
  monthly_total_cost: number | null;
}

interface AdminUsersResponse {
  users: AdminUserResponse[];
}

// 単価（/api/admin/stats と揃える）
const UNIT_COST: Record<UsageType, number> = {
  url: 0.7,
  vision: 1.0,
  chat: 0.3,
  video: 20.0,
};

export async function GET() {
  try {
    // 今月の開始 & 終了
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // 1) プロファイル一覧取得
    const { data: rawProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select(
        'id, email, account_id, is_master, registered_at, deleted_at, trial_type, plan_status, plan_tier'
      );

    if (profileErr) {
      console.error('profiles error in /api/admin/users:', profileErr);
      return NextResponse.json(
        { error: 'db_error', message: 'profiles の取得に失敗しました' },
        { status: 500 }
      );
    }

    const profileRows: UserProfileRow[] =
      ((rawProfiles ?? []) as unknown as UserProfileRow[]);

    // 2) 今月分の usage_logs を取得（ユーザー別の件数集計用）
    const { data: rawLogs, error: logsErr } = await supabase
      .from('usage_logs')
      .select('user_id, type, created_at')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (logsErr) {
      console.error('usage_logs error in /api/admin/users:', logsErr);
      return NextResponse.json(
        { error: 'db_error', message: 'usage_logs の取得に失敗しました' },
        { status: 500 }
      );
    }

    const logs = rawLogs ?? [];

    // 3) user_id ごとに種別別の件数を集計
    type UserUsageCounts = {
      url: number;
      vision: number;
      chat: number;
      video: number;
    };

    const usageByUser = new Map<string, UserUsageCounts>();

    for (const row of logs) {
      const userId = row.user_id as string | null;
      const type = row.type as UsageType;

      if (!userId) continue;
      if (!['url', 'vision', 'chat', 'video'].includes(type)) continue;

      if (!usageByUser.has(userId)) {
        usageByUser.set(userId, { url: 0, vision: 0, chat: 0, video: 0 });
      }
      const counts = usageByUser.get(userId)!;
      counts[type] += 1;
    }

    // 4) プロファイルに今月の件数 & 料金をマージ
    const users: AdminUserResponse[] = [];

    // プロファイルが存在するユーザー
    for (const p of profileRows) {
      const counts = usageByUser.get(p.id) ?? {
        url: 0,
        vision: 0,
        chat: 0,
        video: 0,
      };

      const urlCount = counts.url;
      const visionCount = counts.vision;
      const chatCount = counts.chat;
      const videoCount = counts.video;

      const totalCost =
        urlCount * UNIT_COST.url +
        visionCount * UNIT_COST.vision +
        chatCount * UNIT_COST.chat +
        videoCount * UNIT_COST.video;

      users.push({
        ...p,
        monthly_url_count: urlCount,
        monthly_vision_count: visionCount,
        monthly_chat_count: chatCount,
        monthly_video_count: videoCount,
        monthly_total_cost: Number(totalCost.toFixed(1)),
      });
    }

    // 5) usage_logs には存在するが profiles に無い user_id があれば、
    //    ダミー行として追加（合計値を揃えたい場合用）
    for (const [userId, counts] of usageByUser.entries()) {
      const already = users.find((u) => u.id === userId);
      if (already) continue;

      const urlCount = counts.url;
      const visionCount = counts.vision;
      const chatCount = counts.chat;
      const videoCount = counts.video;

      const totalCost =
        urlCount * UNIT_COST.url +
        visionCount * UNIT_COST.vision +
        chatCount * UNIT_COST.chat +
        videoCount * UNIT_COST.video;

      users.push({
        id: userId,
        email: null,
        account_id: null,
        is_master: false,
        registered_at: null,
        deleted_at: null,
        trial_type: null,
        plan_status: null,
        plan_tier: null,
        monthly_url_count: urlCount,
        monthly_vision_count: visionCount,
        monthly_chat_count: chatCount,
        monthly_video_count: videoCount,
        monthly_total_cost: Number(totalCost.toFixed(1)),
      });
    }

    // 6) 何かしら整列したければ、登録日の新しい順などにソート
    users.sort((a, b) => {
      const ad = a.registered_at ? new Date(a.registered_at).getTime() : 0;
      const bd = b.registered_at ? new Date(b.registered_at).getTime() : 0;
      return bd - ad;
    });

    const result: AdminUsersResponse = { users };
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('internal error in /api/admin/users:', e);
    const message = e instanceof Error ? e.message : 'internal error';
    return NextResponse.json(
      { error: 'internal_error', message },
      { status: 500 }
    );
  }
}
