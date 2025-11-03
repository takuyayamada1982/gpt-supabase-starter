'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // すでにログイン済みなら /u に誘導（任意）
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        window.location.href = '/u';
      }
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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    setLoading(false);

    if (error) {
      setErr(error.message || 'ログインに失敗しました。');
      return;
    }
    setOk('ログインに成功しました。ページを移動します…');
    // 成功したらユーザーページへ
    window.location.href = '/u';
  };

  const onReset = async () => {
    setErr(null);
    setOk(null);
    if (!email.trim()) {
      setErr('パスワード再設定にはメールアドレスの入力が必要です。');
      return;
    }
    // Supabase Auth → パスワードリセットメール送付
    // Supabase Auth 設定の「Reset password redirect URL」に
    // 例: https://<your-domain>/login を設定しておくとスムーズです。
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo:
        process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/login`
          : undefined,
    });
    if (error) {
      setErr(error.message || '再設定メールの送信に失敗しました。');
    } else {
      setOk('パスワード再設定メールを送信しました。受信ボックスをご確認ください。');
    }
  };

  return (
    <main className="max-w-md mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">ログイン</h2>
        <p className="text-sm text-gray-600 mb-6">
          メールアドレスとパスワードを入力してください。
        </p>

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
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
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
                autoComplete="current-password"
                placeholder="8文字以上の英数記号"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs px-2 py-1 border border-gray-300 rounded-md bg-white"
                aria-label={showPass ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showPass ? '隠す' : '表示'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl px-4 py-2 font-semibold text-white ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onReset}
            className="text-sky-700 hover:text-sky-900"
          >
            パスワードをお忘れの方
          </button>

          {/* 任意：新規登録を許可する場合 */}
          {/* <Link href="/signup" className="text-gray-700 hover:text-gray-900">
            新規登録
          </Link> */}
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>※ パスワード再設定メールが届かない場合は、迷惑メールをご確認ください。</p>
        </div>
      </div>

      {/* ナビ（任意） */}
      <div className="text-xs text-gray-500 mt-4 space-x-3">
        <Link href="/u" className="hover:underline">ユーザーページ</Link>
        <Link href="/admin" className="hover:underline">管理ページ</Link>
      </div>
    </main>
  );
}
