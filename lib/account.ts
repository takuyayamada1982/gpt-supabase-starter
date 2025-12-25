// lib/account.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

// プロフィールからメールアドレスを取る（id → email）
export async function getUserEmailById(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !data?.email) {
    throw new Error(
      `user_email_not_found: ${error?.message ?? 'no email in profiles'}`
    );
  }

  return data.email as string;
}

// メールアドレスからユーザーIDを取る（email → id）
export async function getUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) {
    throw new Error(
      `user_not_found_by_email: ${error?.message ?? 'no profile with email'}`
    );
  }

  return data.id as string;
}

// 必要であれば（トライアル時など）5桁アカウントIDを採番して profiles に保存する
export async function ensureAccountIdForUser(
  userId: string
): Promise<string> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('account_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error(
      `profile_not_found: ${profileError?.message ?? 'no profile'}`
    );
  }

  // すでに正式なアカウントIDがある場合はそれを返す
  if (profile.account_id && profile.account_id !== '99999') {
    return profile.account_id as string;
  }

  // ここに来たら「トライアル or 未設定」なので、新しく採番
  const { data: seqValue, error: seqError } = await supabaseAdmin.rpc(
    'get_next_account_id'
  );

  if (seqError || typeof seqValue !== 'number') {
    throw new Error(
      `account_id_seq_error: ${seqError?.message ?? 'no seq value'}`
    );
  }

  // 5桁ゼロ埋め（00001, 00002, ...）
  const nextAccountId = seqValue.toString().padStart(5, '0');

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ account_id: nextAccountId })
    .eq('id', userId);

  if (updateError) {
    throw new Error(
      `account_id_update_error: ${updateError.message}`
    );
  }

  return nextAccountId;
}

// プラン更新用ヘルパー
export async function updateUserPlan(
  userId: string,
  planTier: 'starter' | 'pro',
  validUntil: string
) {
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      plan_status: 'paid',
      plan_tier: planTier,
      plan_valid_until: validUntil,
      is_canceled: false,
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(
      `profile_plan_update_error: ${updateError.message}`
    );
  }
}
