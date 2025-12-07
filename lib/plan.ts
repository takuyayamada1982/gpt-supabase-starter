// lib/plan.ts
// プラン・トライアル状態と利用制限をまとめて扱うユーティリティ

export type TrialType = 'normal' | 'referral' | null;
export type PlanStatus = 'trial' | 'paid' | null;
export type PlanTier = 'starter' | 'pro' | null;

export interface ProfileLike {
  registered_at: string | null;
  trial_type: TrialType;
  plan_status: PlanStatus;
  plan_tier: PlanTier;
  plan_started_at?: string | null;
  plan_valid_until?: string | null;
  is_canceled?: boolean | null;
}

// ログ集計から渡す想定の利用数
export interface UsageCounts {
  url: number;
  vision: number;
  chat: number;
  video: number;
}

// 料金テーブル（必要に応じて変更可）
export const PRICE_URL = 0.7;    // 円
export const PRICE_VISION = 1.0; // 円
export const PRICE_CHAT = 0.3;   // 円
export const PRICE_VIDEO = 20.0; // 円

// 回数制限
export const TRIAL_VIDEO_LIMIT = 10; // トライアル期間中の動画→文字
export const PRO_VIDEO_LIMIT = 30;   // Pro の月間動画→文字

export type PlanKind =
  | 'no_plan'
  | 'trial'
  | 'trial_expired'
  | 'starter'
  | 'pro';

export interface PlanState {
  kind: PlanKind;
  // ベース情報
  trialRemainingDays: number | null; // trial / trial_expired のときだけ有効
  trialTotalDays: number | null;
  isPaid: boolean;
  planTier: PlanTier;
  // UI 用のラベル
  label: string; // 例: "無料期間中（残り3日）", "Starter 契約中" など
}

/**
 * トライアル日数（normal: 7日 / referral: 14日）
 */
function getTrialDays(trialType: TrialType): number {
  if (trialType === 'referral') return 14;
  if (trialType === 'normal') return 7;
  return 0;
}

/**
 * プロファイルから現在のプラン状態を算出する。
 * - plan_status === 'paid' を最優先で見る（trial の残り日数に関係なく有料扱い）
 * - trial の残り日数 <= 0 の場合は trial_expired
 */
export function getPlanState(
  profile: ProfileLike | null,
  now: Date = new Date(),
): PlanState {
  if (!profile) {
    return {
      kind: 'no_plan',
      trialRemainingDays: null,
      trialTotalDays: null,
      isPaid: false,
      planTier: null,
      label: '未登録',
    };
  }

  // 1. 有料契約が最優先
  if (profile.plan_status === 'paid' && profile.plan_tier) {
    const tier = profile.plan_tier;
    const tierLabel = tier === 'starter' ? 'Starter' : 'Pro';

    return {
      kind: tier,
      trialRemainingDays: null,
      trialTotalDays: null,
      isPaid: true,
      planTier: tier,
      label: `${tierLabel} 契約中`,
    };
  }

  // 2. トライアル状態を判定
  if (!profile.registered_at) {
    // registered_at が無い場合は trial 概念も無いとみなす
    return {
      kind: 'no_plan',
      trialRemainingDays: null,
      trialTotalDays: null,
      isPaid: false,
      planTier: null,
      label: 'プラン未設定',
    };
  }

  const reg = new Date(profile.registered_at);
  if (Number.isNaN(reg.getTime())) {
    return {
      kind: 'no_plan',
      trialRemainingDays: null,
      trialTotalDays: null,
      isPaid: false,
      planTier: null,
      label: 'プラン未設定',
    };
  }

  const trialDays = getTrialDays(profile.trial_type);
  if (trialDays <= 0) {
    // trial_type が無い場合は trial も無い扱い
    return {
      kind: 'no_plan',
      trialRemainingDays: null,
      trialTotalDays: null,
      isPaid: false,
      planTier: null,
      label: 'プラン未設定',
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((now.getTime() - reg.getTime()) / msPerDay);
  const remaining = trialDays - diffDays;

  if (remaining > 0) {
    return {
      kind: 'trial',
      trialRemainingDays: remaining,
      trialTotalDays: trialDays,
      isPaid: false,
      planTier: null,
      label: `無料期間中（残り${remaining}日）`,
    };
  }

  const daysAgo = -remaining;
  return {
    kind: 'trial_expired',
    trialRemainingDays: 0,
    trialTotalDays: trialDays,
    isPaid: false,
    planTier: null,
    label: `無料期間終了（${daysAgo}日前）`,
  };
}

/**
 * 動画機能が利用可能かどうかを判定する。
 * - Trial / Pro のみ利用可
 * - Starter / trial_expired / no_plan は利用不可
 * - Trial: TRIAL_VIDEO_LIMIT まで
 * - Pro: PRO_VIDEO_LIMIT まで
 */
export type Feature = 'url' | 'vision' | 'chat' | 'video';

export interface FeatureAccessResult {
  ok: boolean;
  reason?:
    | 'no_plan'
    | 'trial_expired'
    | 'starter_not_allowed'
    | 'trial_video_limit'
    | 'pro_video_limit'
    | 'unknown';
  // 残り回数（video のみ意味あり）
  remaining?: number | null;
}

export function checkFeatureAccess(
  plan: PlanState,
  usage: UsageCounts | null,
  feature: Feature,
): FeatureAccessResult {
  // URL / vision / chat は現状プラン制限なしで OK （必要なら後で拡張）
  if (feature !== 'video') {
    return { ok: true };
  }

  // ここから video のみ判定
  const used = usage?.video ?? 0;

  // Trial 中
  if (plan.kind === 'trial') {
    const remaining = TRIAL_VIDEO_LIMIT - used;
    if (remaining <= 0) {
      return {
        ok: false,
        reason: 'trial_video_limit',
        remaining: 0,
      };
    }
    return { ok: true, remaining };
  }

  // Pro 契約中
  if (plan.kind === 'pro') {
    const remaining = PRO_VIDEO_LIMIT - used;
    if (remaining <= 0) {
      return {
        ok: false,
        reason: 'pro_video_limit',
        remaining: 0,
      };
    }
    return { ok: true, remaining };
  }

  // Starter / trial_expired / no_plan は video 不可
  if (plan.kind === 'starter') {
    return {
      ok: false,
      reason: 'starter_not_allowed',
      remaining: null,
    };
  }

  if (plan.kind === 'trial_expired') {
    return {
      ok: false,
      reason: 'trial_expired',
      remaining: null,
    };
  }

  return {
    ok: false,
    reason: 'no_plan',
    remaining: null,
  };
}

/**
 * プラン契約時に profiles をどう更新するかのヘルパー。
 * 実際の DB 更新は呼び出し側で行うこと。
 *
 * - トライアル中でも、expired でも、呼び出したタイミングから有料扱い
 * - plan_started_at, plan_valid_until をセット（validUntilMonths は任意）
 */
export function buildPaidPlanUpdate(options: {
  tier: Exclude<PlanTier, null>; // 'starter' | 'pro'
  now?: Date;
  validUntilMonths?: number; // 1 を渡せば1ヶ月後まで
}) {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();

  let validUntil: string | null = null;
  if (options.validUntilMonths && options.validUntilMonths > 0) {
    const dt = new Date(now.getTime());
    dt.setMonth(dt.getMonth() + options.validUntilMonths);
    validUntil = dt.toISOString();
  }

  return {
    plan_status: 'paid' as const,
    plan_tier: options.tier,
    plan_started_at: startedAt,
    plan_valid_until: validUntil,
    is_canceled: false,
  };
}
