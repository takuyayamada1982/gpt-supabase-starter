// app/api/_shared/plan-guard.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// profiles テーブル側の型（必要な列だけ）
type ProfileRow = {
  id: string;
  plan_status: 'trial' | 'paid' | null;
  plan_valid_until: string | null;
  is_cancel?: boolean | null;
};

type GuardOkResult = {
  supabase: ReturnType<typeof createRouteHandlerClient>;
  user: { id: string; email?: string | null };
  profile: ProfileRow;
};

/**
 * 利用可能なプランかどうかをチェックする共通ガード
 * - ログインしていない → 401
 * - プロフィールが無い → 400
 * - plan_valid_until が現在時刻より前 → 402（期限切れ）
 * - is_cancel が true なら期限内でも 402 にしておく（任意）
 */
export async function guardActivePlan(
  req: NextRequest
): Promise<GuardOkResult | NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });

  // ① ログインユーザー取得
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error: 'not_signed_in',
        message: 'ログインが必要です。サインインし直してください。',
      },
      { status: 401 }
    );
  }

  // ② profiles からプラン情報取得
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, plan_status, plan_valid_until, is_cancel')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile) {
    console.error('guardActivePlan profile error:', profileError);
    return NextResponse.json(
      {
        error: 'profile_not_found',
        message: 'プロフィール情報が取得できませんでした。',
      },
      { status: 400 }
    );
  }

  // ③ 期限チェック（plan_valid_until が過去なら NG）
  const now = Date.now();
  const validUntil = profile.plan_valid_until
    ? new Date(profile.plan_valid_until).getTime()
    : 0;

  const isExpired = !validUntil || validUntil < now;
  const isCanceled = profile.is_cancel === true;

  if (isExpired || isCanceled) {
    return NextResponse.json(
      {
        error: 'plan_expired',
        message:
          '無料期間または契約期間が終了しています。\n' +
          'マイページの「プラン変更」からご契約ください。',
      },
      { status: 402 } // Payment Required 的な扱い
    );
  }

  // ④ OK の場合は、呼び出し元でそのまま使えるように返す
  return {
    supabase,
    user: { id: user.id, email: user.email },
    profile,
  };
}
