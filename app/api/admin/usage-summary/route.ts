// app/api/admin/usage-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

export async function GET(_req: NextRequest) {
  try {
    const { start, end } = getMonthRange();

    const { data: logs, error: logsErr } = await supabase
      .from('usage_logs')
      .select('user_id, type')
      .gte('created_at', start)
      .lt('created_at', end);

    if (logsErr) {
      return NextResponse.json(
        { error: 'usage_logs_error', message: '利用ログの取得に失敗しました。' },
        { status: 500 }
      );
    }

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, account_id, plan_status, plan_tier');

    if (profErr) {
      return NextResponse.json(
        { error: 'profiles_error', message: 'プロフィール取得に失敗しました。' },
        { status: 500 }
      );
    }

    const usageMap = new Map();

    for (const log of logs || []) {
      const uid = log.user_id;
      if (!uid) continue;

      if (!usageMap.has(uid)) {
        usageMap.set(uid, { url: 0, vision: 0, chat: 0, video: 0 });
      }

      const c = usageMap.get(uid);

      switch (log.type) {
        case 'url': c.url++; break;
        case 'vision': c.vision++; break;
        case 'chat': c.chat++; break;
        case 'video': c.video++; break;
        default: break;
      }
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const result = Array.from(usageMap.entries()).map(([userId, counts]) => {
      const prof = profileMap.get(userId);
      return {
        user_id: userId,
        email: prof?.email || null,
        account_id: prof?.account_id || null,
        plan_status: prof?.plan_status || null,
        plan_tier: prof?.plan_tier || null,
        counts,
      };
    });

    return NextResponse.json({ items: result });
  } catch (e) {
    return NextResponse.json(
      { error: 'internal_error', message: e.message },
      { status: 500 }
    );
  }
}
