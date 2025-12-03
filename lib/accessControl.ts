// lib/accessControl.ts

export type PlanStatus = 'trial' | 'paid' | 'canceled';

export type TrialType = 'normal' | 'referral';

export type ProfileRow = {
  id: string;
  email: string;
  account_id: string;
  trial_type: TrialType | null;
  plan_status: PlanStatus;
  registered_at: string; // ISO文字列
  cancel_at: string | null; // ISO文字列 or null
};

export type AccessState =
  | { isActive: true; trialEndsAt: Date | null }
  | { isActive: false; reasonCode: 'TRIAL_EXPIRED' | 'CANCELED'; message: string };

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export function getAccessState(profile: ProfileRow): AccessState {
  const now = new Date();

  const registeredAt = profile.registered_at ? new Date(profile.registered_at) : null;
  const trialDays = profile.trial_type === 'referral' ? 14 : 7;

  let trialEndsAt: Date | null = null;
  if (registeredAt && profile.plan_status === 'trial') {
    trialEndsAt = addDays(registeredAt, trialDays);
  }

  // 1) 解約有効日を過ぎているか？
  if (profile.plan_status === 'canceled' && profile.cancel_at) {
    const cancelAt = new Date(profile.cancel_at);
    if (now > cancelAt) {
      return {
        isActive: false,
        reasonCode: 'CANCELED',
        message: 'このアカウントは解約済みのため、サービスをご利用いただけません。',
      };
    }
  }

  // 2) トライアルが終わっているか？
  if (profile.plan_status === 'trial' && trialEndsAt && now > trialEndsAt) {
    return {
      isActive: false,
      reasonCode: 'TRIAL_EXPIRED',
      message: 'トライアル期間が終了しました。継続利用には本契約が必要です。',
    };
  }

  // 3) paid もしくは有効トライアル
  return {
    isActive: true,
    trialEndsAt,
  };
}
