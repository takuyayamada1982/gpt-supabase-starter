// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---- Supabase クライアント（サーバー専用） ----
// Service Role があればそちら、無ければ anon を使うようにしておく
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  serviceKey && serviceKey.length > 0 ? serviceKey : anonKey
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

// /api/admin/stats と同じ単価
const UNIT_COST: Record<UsageType, number> = {
  url: 0.7,
  vision: 1.0,
  chat: 0.3,
  video: 20.0,
};

export async function GET() {
  try {
    // === 1. 今月の範囲（YYYY-MM-01〜翌月01） ===
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // === 2. profiles 一覧取得 ===
    const { data: rawProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select(
        'id, email, account_id, is_master, registered_at, deleted_at, trial_type, plan_status, plan_tier'
      );

    if (profileErr) {
      console.error('profiles error in /api/admin/users:', profileErr);
      // クライアントを落とさないため、とりあえず空配列で返す
      const empty: AdminUsersResponse = { users: [] };
      return NextResponse.json(empty, { status: 200 });
    }

    const profileRows: UserProfileRow[] =
      ((rawProfiles ?? []) as unknown as UserProfileRow[]);

    // === 3. 今月分 usage_logs 取得（user_id + type） ===
    const { data: rawLogs, error: logsErr } = await supabase
      .from('usage_logs')
      .select('user_id, type, created_at')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (logsErr) {
      console.error('usage_logs error in /api/admin/users:', logsErr);
      const empty: AdminUsersResponse = { users: [] };
      return NextResponse.json(empty, { status: 200 });
    }

    const logs = rawLogs ?? [];

    // === 4. user_id ごとの利用回数を集計 ===
    type UserUsageCounts = {
      url: number;
      vision: number;
      chat: number;
      video: number;
    };

    const usageByUser = new Map<string, UserUsageCounts>();

    for (const row of logs) {
      const userId = (row as any).user_id as string | null;
      const rawType = (row as any).type as string | null;

      if (!userId) continue;
      if (!rawType) continue;

      const type = rawType as UsageType;
      if (!['url', 'vision', 'chat', 'video'].includes(type)) continue;

      if (!usageByUser.has(userId)) {
        usageByUser.set(userId, { url: 0, vision: 0, chat: 0, video: 0 });
      }
      const counts = usageByUser.get(userId)!;
      counts[type] += 1;
    }

    // === 5. profiles に今月の回数 + コストを載せる ===
    const users: AdminUserResponse[] = [];

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

      // usageByUser から消しておけば、あとで「profiles に無い user_id」だけ拾える
      usageByUser.delete(p.id);
    }

    // === 6. usage_logs にはいるが profiles にいない user_id を追加（あれば） ===
    for (const [userId, counts] of usageByUser.entries()) {
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

    // === 7. 登録日が新しい順にソート（登録日が null のものは後ろへ） ===
    users.sort((a, b) => {
      const ad = a.registered_at ? new Date(a.registered_at).getTime() : 0;
      const bd = b.registered_at ? new Date(b.registered_at).getTime() : 0;
      return bd - ad;
    });

    const result: AdminUsersResponse = { users };
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    console.error('internal error in /api/admin/users:', e);
    // ここでも空配列を返す（/admin 側で「データなし」表示になるだけ）
    const result: AdminUsersResponse = { users: [] };
    return NextResponse.json(result, { status: 200 });
  }
}
