// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ サーバー側専用の Supabase クライアント（Service Role Key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UsageType = 'url' | 'vision' | 'chat';

type UsageLogRow = {
  user_id: string;
  type: UsageType;
  cost: number | null;
};

export async function GET() {
  try {
    // 1) profiles 取得
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select(
        `
        id,
        email,
        account_id,
        is_master,
        registered_at,
        deleted_at,
        trial_type,
        plan_status,
        plan_tier
      `
      )
      .order('registered_at', { ascending: true });

    if (profilesErr) {
      console.error('profiles error:', profilesErr);
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    const safeProfiles = (profiles ?? []) as any[];

    // 2) 今月の usage_logs を取得（Service Role で全ユーザー分）
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    const start = new Date(year, month, 1).toISOString();   // 月初 (UTC)
    const end = new Date(year, month + 1, 1).toISOString(); // 翌月1日 (UTC)

    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('usage_logs')
      .select('user_id, type, cost')
      .gte('created_at', start)
      .lt('created_at', end);

    if (logsErr) {
      console.error('usage_logs error:', logsErr);
      const users = safeProfiles.map((p) => ({
        id: p.id,
        email: p.email,
        account_id: p.account_id,
        is_master: p.is_master,
        registered_at: p.registered_at,
        deleted_at: p.deleted_at,
        trial_type: p.trial_type,
        plan_status: p.plan_status,
        plan_tier: p.plan_tier,
        monthly_url_count: 0,
        monthly_vision_count: 0,
        monthly_chat_count: 0,
        monthly_total_cost: 0,
      }));
      return NextResponse.json({ users }, { status: 200 });
    }

    const usageLogs = (logs ?? []) as UsageLogRow[];

    // 3) ユーザーごとに今月の利用回数・金額を集計
    const grouped: Record<
      string,
      { url: number; vision: number; chat: number; cost: number }
    > = {};

    for (const log of usageLogs) {
      if (!grouped[log.user_id]) {
        grouped[log.user_id] = { url: 0, vision: 0, chat: 0, cost: 0 };
      }

      if (log.type === 'url') grouped[log.user_id].url += 1;
      if (log.type === 'vision') grouped[log.user_id].vision += 1;
      if (log.type === 'chat') grouped[log.user_id].chat += 1;

      const c = typeof log.cost === 'number' ? log.cost : 0;
      grouped[log.user_id].cost += c;
    }

    // 4) profiles + 今月分集計を合体させて返却
    const users = safeProfiles.map((p) => {
      const g = grouped[p.id] ?? { url: 0, vision: 0, chat: 0, cost: 0 };
      return {
        id: p.id,
        email: p.email,
        account_id: p.account_id,
        is_master: p.is_master,
        registered_at: p.registered_at,
        deleted_at: p.deleted_at,
        trial_type: p.trial_type,
        plan_status: p.plan_status,
        plan_tier: p.plan_tier,

        monthly_url_count: g.url,
        monthly_vision_count: g.vision,
        monthly_chat_count: g.chat,
        monthly_total_cost: g.cost,
      };
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (e) {
    console.error('admin/users GET error:', e);
    return NextResponse.json({ users: [] }, { status: 200 });
  }
}
