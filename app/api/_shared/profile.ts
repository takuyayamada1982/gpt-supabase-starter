// app/api/_shared/profile.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PlanStatus = 'trial' | 'paid' | null;
export type PlanTier = 'starter' | 'pro' | null;

export interface ProfileRow {
  id: string;
  email: string | null;
  plan_status: PlanStatus;
  plan_tier: PlanTier;
  trial_type: string | null;
  is_canceled: boolean;
  plan_started_at: string | null;
  plan_valid_until: string | null;
  referred_by_user_id: string | null;
  referred_by_code: string | null;
}

export async function fetchProfileByIdOrEmail(params: {
  userId?: string;
  userEmail?: string;
}): Promise<{ profile: ProfileRow | null; error?: string }> {
  const { userId, userEmail } = params;

  if (!userId && !userEmail) {
    return { profile: null, error: 'userId or userEmail is required' };
  }

  let query = supabase
    .from('profiles')
    .select(
      [
        'id',
        'email',
        'plan_status',
        'plan_tier',
        'trial_type',
        'is_canceled',
        'plan_started_at',
        'plan_valid_until',
        'referred_by_user_id',
        'referred_by_code',
      ].join(',')
    )
    .limit(1);

  if (userEmail) {
    query = query.eq('email', userEmail);
  } else if (userId) {
    query = query.eq('id', userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('fetchProfileByIdOrEmail error:', error);
    return { profile: null, error: 'profile_query_error' };
  }

  return { profile: data as ProfileRow | null };
}

export { supabase }; // 共通 supabase インスタンスもここから再利用
