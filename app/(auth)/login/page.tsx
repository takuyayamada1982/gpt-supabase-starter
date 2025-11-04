'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  // 新規登録とログインの切り替えモード
  const [isSignup, setIsSignup] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAlreadyLoggedIn(!!data.user);
      setChecking(false);
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!email.trim() || !pass) {
      setErr('メールアドレスとパスワードを入力してください。');
      return;
    }
    setLoading(true);

    if (isSignup) {
      // 新規登録
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
      });
      setLoading(false);
      if (error) setErr(error.message || '登録に失敗しました。');
      else setOk('登録メールを送信しました。メールを確認してアカウントを有効化してください。');
    } else {
      // ログイン
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      setLoading(false);
      if (error) setErr(error.message || 'ログインに失敗しました。');
      else {
        setOk('ログインに成功しました。ページを移動します…');
        window.location.href = '/u';
      }
    }
  };

  const goToU = () => (window.location.href = '/u');
  const onLogout = async () => {
    await supabase.auth.signOut();
    setAlreadyLoggedIn(false);
    setOk('ログアウトしました。');
  };

  return (
    <main className="max-w-md mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <h2 className="text-xl font-semibold mb-1">
          {isSignup ? '新規登録' : 'ログイン'}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {isSignup
            ? 'アカウントを作成するにはメールアドレスとパスワードを入力してください。'
            : '登録済みのメールアドレスとパスワードでログインしてください。'}
        </p>

        {!checking && alreadyLoggedIn && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-3 py-2">
            すでにログイン済みです。
            <div className="mt-2 flex gap-8">
              <button onClick={goToU} className="underline">
                ユーザーページへ
              </button>
              <button onClick={onLogout} className="underline">
                ログアウト
              </button>
            </div>
          </div>
        )}

        {err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            {err}
          </div>
        )}
        {ok && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">
            {ok}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-sky-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="8文字以上の英数記号"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 pr-12 focus:ring-2 focus:ring-sky-400"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                {showPass ? '隠す' : '表示'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl px-4 py-2 font-semibold text-white ${
              loading ? 'bg-gray-400' : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {loading
              ? '送信中…'
              : isSignup
              ? '登録メールを送信'
              : 'ログイン'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {isSignup ? (
            <p>
              すでにアカウントをお持ちですか？{' '}
              <button
                onClick={() => setIsSignup(false)}
                className="text-sky-700 hover:text-sky-900 underline"
              >
                ログインへ戻る
              </button>
            </p>
          ) : (
            <p>
              初めての方は{' '}
              <button
                onClick={() => setIsSignup(true)}
                className="text-sky-700 hover:text-sky-900 underline"
              >
                新規登録
              </button>
            </p>
          )}
        </div>

        {!isSignup && (
          <div className="mt-4 text-sm">
            <button
              onClick={async () => {
                if (!email.trim())
                  return setErr('再設定にはメールアドレスが必要です。');
                const { error } = await supabase.auth.resetPasswordForEmail(
                  email.trim(),
                  {
                    redirectTo:
                      process.env.NEXT_PUBLIC_SITE_URL
                        ? `${process.env.NEXT_PUBLIC_SITE_URL}/login`
                        : undefined,
                  }
                );
                if (error) setErr(error.message);
                else
                  setOk(
                    'パスワード再設定メールを送信しました。受信ボックスをご確認ください。'
                  );
              }}
              className="text-sky-700 hover:text-sky-900"
            >
              パスワードをお忘れの方
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
