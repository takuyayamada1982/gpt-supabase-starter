// app/api/_shared/planGuard.ts
import { Database } from '@/types/supabase'; // 既に型定義があればそれを利用（無ければ any でOK）
import { supabase } from './profile'; // すでにある _shared/profile.ts から再利用想定

// profiles テーブルの型（型が無ければ適宜修正 or `any` で代用）
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export type PlanGuardResult =
  | {
      allowed: true;
      reason: null;
      profile: ProfileRow;
      isTrial: boolean;
      daysLeft: number | 0;
    }
  | {
      allowed: false;
      reason: 'not_logged_in' | 'profile_not_found' | 'trial_expired';
      profile?: ProfileRow;
      isTrial?: boolean;
      daysLeft?: number | 0;
    };

// トライアル終了日と残日数を計算
function calcTrialInfo(profile: ProfileRow) {
  const registeredAt = profile.registered_at
    ? new Date(profile.registered_at)
    : null;

  if (!registeredAt) {
    return {
      isTrial: false,
      trialEnd: null as Date | null,
      daysLeft: 0,
    };
  }

  const trialType = profile.trial_type === 'referral' ? 'referral' : 'normal';
  const trialDays = trialType === 'referral' ? 30 : 7;

  const trialEnd = new Date(registeredAt);
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isTrial: true,
    trialEnd,
    daysLeft: diffDays,
  };
}

// プランの有効性を判定するメイン関数
export async function checkPlanGuardByUserId(userId?: string | null): Promise<PlanGuardResult> {
  if (!userId) {
    return {
      allowed: false,
      reason: 'not_logged_in',
    };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (error || !profile) {
    return {
      allowed: false,
      reason: 'profile_not_found',
    };
  }

  // 1. 有料プラン中なら OK
  if (profile.plan_status === 'paid') {
    // plan_valid_until がある場合は期限も見る
    if (profile.plan_valid_until) {
      const now = new Date();
      const validUntil = new Date(profile.plan_valid_until);
      if (validUntil.getTime() < now.getTime()) {
        // 有料期限切れ → トライアル扱いでもないので NG
        return {
          allowed: false,
          reason: 'trial_expired',
          profile,
          isTrial: false,
          daysLeft: 0,
        };
      }
    }

    return {
      allowed: true,
      reason: null,
      profile,
      isTrial: false,
      daysLeft: 0,
    };
  }

  // 2. 無料トライアル中かどうか
  const { isTrial, trialEnd, daysLeft } = calcTrialInfo(profile);

  if (!isTrial || !trialEnd) {
    // トライアル情報が無い or registered_at 無し → 期限切れ扱い
    return {
      allowed: false,
      reason: 'trial_expired',
      profile,
      isTrial: false,
      daysLeft: 0,
    };
  }

  // まだトライアル期間内ならOK（daysLeft が 0 以上なら当日までOK、マイナスなら終了）
  if (daysLeft >= 0) {
    return {
      allowed: true,
      reason: null,
      profile,
      isTrial: true,
      daysLeft,
    };
  }

  // トライアル終了
  return {
    allowed: false,
    reason: 'trial_expired',
    profile,
    isTrial: true,
    daysLeft,
  };
}
