'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  // =========================
  // 紹介コード取得（既存）
  // =========================
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
    }
  }, [searchParams]);

  // =========================
  // ログイン（既存）
  // =========================
  const handleLogin = async () => {
    if (!email || !password || !accountId) {
      alert('すべて入力してください');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('email', email)
      .single();

    if (!profile || profile.account_id !== accountId) {
      alert('アカウントIDが正しくありません');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push('/u');
  };

  // =========================
  // 新規登録（既存）
  // =========================
  const handleRegister = async () => {
    if (!email || !password) {
      alert('すべて入力してください');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      alert(error?.message ?? '登録に失敗しました');
      setLoading(false);
      return;
    }

    const referralCode = localStorage.getItem('referral_code');

    await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      account_id: '99999',
      trial_type: referralCode ? 'referral' : 'normal',
      plan_status: 'trial',
      plan_tier: 'starter',
      referred_by_code: referralCode,
    });

    router.push('/u');
  };

  // =========================
  // ✅ パスワードリセット（←これを追加）
  // =========================
  const handleResetPassword = async () => {
    if (!email) {
      alert('メールアドレスを入力してください');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://auto-post-studio.vercel.app/auth/reset',
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      'パスワード再設定用のメールを送信しました。\n' +
        'メール内のリンクをクリックしてください。'
    );
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="auth-con
