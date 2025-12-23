'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ログイン/新規登録
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // 共通入力
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ログイン時のみ
  const [accountId, setAccountId] = useState('');

  const [loading, setLoading] = useState(false);

  // パスワード再設定（メール送信）
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // 紹介コード（既存仕様）
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('referral_code', ref);
  }, [searchParams]);

  const isLogin = mode === 'login';

  // ログイン（既存仕様）
  const handleLogin = async () => {
    if (!email || !password || !accountId) {
      alert('メールアドレス / アカウントID / パスワードを入力してください');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    // account_id チェック（既存仕様）
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

  // 新規登録（既存仕様）
  const handleRegister = async () => {
    if (!email || !password) {
      alert('メールアドレス / パスワードを入力してください');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

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

  // ✅ パスワード再設定メール送信（ここが「どこに入れる？」の答え）
  const handleSendResetEmail = async () => {
    const target = (forgotEmail || email).trim();
    if (!target) {
      alert('メールアドレスを入力してください');
      return;
    }

    setForgotLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: 'https://auto-post-studio.vercel.app/auth/reset',
    });

    setForgotLoading(false);

    if (error) {
      alert(`送信に失敗しました: ${error.message}`);
      return;
    }

    alert('パスワード再設定メールを送信しました。メール内リンクから再設定してください。');
    setShowForgot(false);
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_10%_10%,#ffb7c5_0%,transparent_40%),radial-gradient(circle_at_90%_20%,#b8e2ff_0%,transparent_45%),radial-gradient(circle_at_20%_90%,#d8f4d8_0%,transparent_45%),linear-gradient(180deg,#ffffff,#f8fafc)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-slate-200 p-8">
        {/* 左上の Sign in 表示（あなたの要望どおり） */}
        <div className="text-sm text-slate-500 mb-2">Sign in</div>

        <h1 className="text-3xl font-bold text-slate-900">Auto post studio</h1>
        <p className="mt-2 text-slate-700">
          URL要約・画像説明生成・Chat補助をまとめてこなす、SNS投稿サポートツールです。
        </p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                アカウントID <span className="text-slate-400">（例）12345</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
                placeholder="12345"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">パスワード</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={isLogin ? handleLogin : handleRegister}
              disabled={loading}
              className="rounded-lg bg-slate-900 text-white px-5 py-2 font-medium disabled:opacity-60"
            >
              {loading ? '処理中...' : isLogin ? 'ログイン' : '新規登録'}
            </button>

            <button
              onClick={() => setMode(isLogin ? 'register' : 'login')}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-5 py-2 font-medium"
            >
              {isLogin ? '新規登録はこちら' : 'ログインに戻る'}
            </button>

            <button
              onClick={() => setShowForgot((v) => !v)}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-5 py-2 font-medium"
            >
              パスワードを忘れた方はこちら
            </button>
          </div>

          <p className="text-sm text-slate-500">
            ※メール内のリンクからパスワード再設定ができます（リンクが無効/期限切れの場合は再送してください）
          </p>

          {/* パスワード再設定（メール送信） */}
          {showForgot && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-lg font-bold text-slate-900">パスワード再設定</div>
              <p className="text-sm text-slate-600 mt-1">
                再設定メールを送るメールアドレスを入力してください。
              </p>

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowForgot(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSendResetEmail}
                  disabled={forgotLoading}
                  className="rounded-lg bg-sky-600 text-white px-4 py-2 font-medium disabled:opacity-60"
                >
                  {forgotLoading ? '送信中...' : '再設定メールを送信'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
