import { NextRequest, NextResponse } from 'next/server';
import {
  supabase,
  fetchProfileByIdOrEmail,
  ProfileRow,
} from '../../_shared/profile';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      userEmail?: string;
      toTier?: string;
    };

    const { userId, userEmail } = body;

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

    if (profile.plan_status !== 'paid' || profile.plan_tier !== 'starter') {
      return NextResponse.json(
        {
          error: 'upgrade_not_allowed',
          message: 'Starterプラン契約中のユーザーのみアップグレードできます。',
        },
        { status: 400 }
      );
    }

    const { data: updatedProfiles, error: updateErr } = await supabase
      .from('profiles')
      .update({
        plan_tier: 'pro',
      })
      .eq('id', profile.id)
      .select('*')
      .limit(1);

    if (updateErr) {
      console.error('/api/plan/upgrade update error:', updateErr);
      return NextResponse.json(
        { error: 'update_failed' },
        { status: 500 }
      );
    }

    const updatedProfile = (updatedProfiles?.[0] ?? null) as ProfileRow | null;

    return NextResponse.json({
      ok: true,
      profile: updatedProfile,
    });
  } catch (e: any) {
    console.error('/api/plan/upgrade error:', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? '予期せぬエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
