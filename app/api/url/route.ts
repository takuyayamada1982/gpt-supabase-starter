import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '../_shared/supabaseServer';
import { checkPlanGuardByUserId } from '../_shared/planGuard';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'not_auth' },
      { status: 401 }
    );
  }

  const guard = await checkPlanGuardByUserId(user.id);

  if (!guard.allowed) {
    return NextResponse.json(
      { error: 'TRIAL_EXPIRED' },
      { status: 403 }
    );
  }

  // …ここから従来の処理
}
