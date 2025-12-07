import { NextRequest, NextResponse } from 'next/server';
import {
  supabase,
  fetchProfileByIdOrEmail,
  PlanTier,
  ProfileRow,
} from '../../_shared/profile';

// 6ヶ月後の日付を返す（ざっくりでOK）
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      userEmail?: string;
      planTier?: PlanTier;
    };

    const { userId, userEmail, planTier } = body;

    if (!planTier || (planTier !== 'starter' && planTier !== 'pro')) {
      return NextResponse.json(
        { error: 'invalid_plan_tier' },
        { status: 400 }
      );
    }

    const { profile, error } = await fetchProfileByIdOrEmail({
      userId,
      userEmail,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'profile_not_found' },
        { status: 404 }
      );
    }

    // すでに有料ならエラー
    if (profile.plan_status === 'paid') {
      return NextResponse.json(
        {
          error: 'already_paid',
          message: 'すでに有料プランをご契約いただいています。',
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const validUntil = addMonths(now, 6); // 6ヶ月縛りの例

    const { data: updatedProfiles, error: updateErr } = await supabase
      .from('profiles')
      .update({
        plan_status: 'paid',
        plan_tier: planTier,
        is_canceled: false,
        plan_started_at: now.toISOString(),
        plan_valid_until: validUntil.toISOString(),
      })
      .eq('id', profile.id)
      .select('*')
      .limit(1);

    if (updateErr) {
      console.error('/api/plan/subscribe update error:', updateErr);
      return NextResponse.json(
        { error: 'update_failed' },
        { status: 500 }
      );
    }

    const updatedProfile = (updatedProfiles?.[0] ?? null) as ProfileRow | null;

    // 紹介経由なら referrals を更新（あれば）
    if (updatedProfile?.referred_by_user_id) {
      const referrerId = updatedProfile.referred_by_user_id;
      const code = updatedProfile.referred_by_code ?? null;

      // すでに row があれば更新、なければ insert
      const { data: existingReferral, error: refErr } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', referrerId)
        .eq('referred_user_id', updatedProfile.id)
        .limit(1)
        .maybeSingle();

      if (refErr) {
        console.error('referrals query error:', refErr);
      } else if (existingReferral) {
        if (!existingReferral.converted_at) {
          await supabase
            .from('referrals')
            .update({
              converted_at: now.toISOString(),
              initial_plan_tier: planTier,
            })
            .eq('id', existingReferral.id);
        }
      } else {
        await supabase.from('referrals').insert({
          referrer_user_id: referrerId,
          referred_user_id: updatedProfile.id,
          referral_code: code ?? 'unknown',
          converted_at: now.toISOString(),
          initial_plan_tier: planTier,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      profile: updatedProfile,
    });
  } catch (e: any) {
    console.error('/api/plan/subscribe error:', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? '予期せぬエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
