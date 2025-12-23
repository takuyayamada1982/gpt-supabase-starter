'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // mode: login or register
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const isLogin = mode === 'login';

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // login only
  const [password, setPassword] = useState('');

  // reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const [loading, setLoading] = useState(false);

  // =========
  // referral
  // =========
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('referral_code', ref);
  }, [searchParams]);

  // =========
  // base url
  // =========
  const appBaseUrl = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      'https://auto-post-studio.vercel.app'
    );
  }, []);

  // =========
  // login
  // =========
  const handleLogin = async () => {
    if (!email || !password || !accountId) {
      alert('メールアドレス / パスワード / アカウントID を入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // account_id check
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('email', email)
        .single();

      if (pErr || !profile) {
        await supabase.auth.signOut();
        throw new Error('プロフィールが取得できませんでした');
      }

      if (profile.account_id !== accountId) {
        await supabase.auth.signOut();
        throw new Error('アカウントIDが正しくありません');
      }

      router.push('/u');
    } catch (e: any) {
      alert(e?.message ?? 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // =========
  // register
  // =========
  const handleRegister = async () => {
    if (!email || !password) {
      alert('メールアドレス / パスワード を入力してください');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) throw new Error(error?.message ?? '登録に失敗しました');

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
    } catch (e: any) {
      alert(e?.message ?? '新規登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // =========
  // reset password mail
  // =========
  const handleSendReset = async () => {
    const target = (resetEmail || email).trim();
    if (!target) {
      alert('メールアドレスを入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${appBaseUrl}/auth/reset`,
      });
      if (error) throw error;

      alert('パスワード再設定メールを送信しました。メールをご確認ください。');
      setResetOpen(false);
    } catch (e: any) {
      alert(e?.message ?? '再設定メールの送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // =========
  // UI
  // =========
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* vivid gradient background (前の雰囲気に近い鮮やか系) */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-300 via-emerald-100 to-sky-300" />
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/40 blur-2xl" />
      <div className="absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-white/35 blur-2xl" />

      <div className="relative min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white/80 backdrop-blur shadow-xl border border-white/60">
          <div className="p-8">
            {/* header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">Sign in</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  Auto post studio
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  URL要約・画像説明生成・Chat補助をまとめてこなす、SNS投稿サポートツールです。
                </p>
              </div>

              <div className="shrink-0">
                <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-semibold">
                  {isLogin ? 'ログイン' : '新規登録'}
                </span>
              </div>
            </div>

            {/* form */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              {isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    アカウントID
                  </label>
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="例）12345"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              <button
                onClick={isLogin ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? '処理中...' : isLogin ? 'ログイン' : '新規登録'}
              </button>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setMode(isLogin ? 'register' : 'login')}
                  disabled={loading}
                  className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  {isLogin ? '新規登録はこちら' : 'ログインに戻る'}
                </button>

                <button
                  onClick={() => {
                    setResetEmail(email);
                    setResetOpen(true);
                  }}
                  disabled={loading}
                  className="text-sm font-semibold text-sky-700 hover:text-sky-900"
                >
                  パスワードを忘れた方はこちら
                </button>
              </div>

              <p className="pt-2 text-xs text-slate-500">
                ※メール内のリンクからパスワード再設定ができます（リンクが無効/期限切れの場合は再送してください）
              </p>
            </div>
          </div>
        </div>

        {/* reset modal */}
        {resetOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center p-6">
            <div className="absolute inset-0 bg-black/30" onClick={() => setResetOpen(false)} />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900">パスワード再設定</h2>
              <p className="mt-1 text-sm text-slate-600">
                再設定メールを送るメールアドレスを入力してください。
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setResetOpen(false)}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSendReset}
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? '送信中...' : '再設定メールを送信'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
