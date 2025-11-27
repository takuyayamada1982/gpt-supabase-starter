'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetMessages = () => {
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (!email || !password) {
        setError('メールアドレスとパスワードを入力してください。');
        return;
      }

      if (mode === 'login') {
        // ログイン
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setMessage('ログインに成功しました。ユーザーページへ移動します。');
        router.push('/u');
      } else {
        // 新規登録
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data?.user) {
          setMessage('登録が完了しました。そのままログイン状態でユーザーページへ移動します。');
          router.push('/u');
        } else {
          setMessage('登録メールを確認してください。');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'エラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center py-10">
      {/* カード全体 */}
      <div className="w-full max-w-md rounded-2xl bg-white/80 shadow-lg border border-gray-100 px-6 py-8 backdrop-blur">
        {/* タイトル */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white px-3 py-1 text-xs font-semibold mb-3">
            SNS自動投稿アシスタント
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {mode === 'login' ? 'ログイン' : '新規登録'}
          </h2>
          <p className="text-xs text-gray-500">
            1つのアカウントで URL要約・画像説明・チャットをまとめて利用できます。
          </p>
        </div>

        {/* タブ切り替え */}
        <div className="mb-5 grid grid-cols-2 rounded-full bg-gray-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              resetMessages();
            }}
            className={
              'py-2 rounded-full transition ' +
              (mode === 'login'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-900')
            }
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              resetMessages();
            }}
            className={
              'py-2 rounded-full transition ' +
              (mode === 'signup'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-900')
            }
          >
            新規登録
          </button>
        </div>

        {/* フォーム */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              メールアドレス
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              パスワード
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
              placeholder="8文字以上を推奨"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* メッセージ表示 */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {message && !error && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {message}
            </div>
          )}

          {/* ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-60"
          >
            {loading
              ? '処理中…'
              : mode === 'login'
              ? 'ログインする'
              : 'この内容で登録する'}
          </button>
        </form>

        {/* 補足テキスト */}
        <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
          <p className="text-[11px] leading-relaxed text-gray-500">
            ・メールアドレスとパスワードは、このアプリ専用に設定することをおすすめします。<br />
            ・ログイン後は上部メニューの「/u」から、SNS用テキスト自動生成ページに移動できます。
          </p>
        </div>
      </div>
    </main>
  );
}
