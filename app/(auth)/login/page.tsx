'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

  // ✅ 前回と同じ要素：ログイン/新規登録モード・メール・パスワードなど
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
        // 🔑 ログイン
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setMessage('ログインに成功しました。ユーザーページへ移動します。');
        router.push('/u');
      } else {
        // 🆕 新規登録
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data?.user) {
          setMessage('登録が完了しました。そのままユーザーページへ移動します。');
          router.push('/u');
        } else {
          setMessage('登録用メールを確認してください。');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 'エラーが発生しました。時間をおいて再度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid gap-6 md:grid-cols-[1.2fr,1fr] items-stretch">
        {/* 左側：説明エリア（項目は増やさず、使い方を整理して表示） */}
        <section className="hidden md:flex flex-col justify-center rounded-3xl bg-slate-900 text-slate-50 p-8 shadow-xl">
          <h1 className="text-2xl font-semibold mb-3">
            SNS投稿テキスト自動生成ツール
          </h1>
          <p className="text-sm text-slate-200 mb-5 leading-relaxed">
            ログインすると、URL要約・画像説明文・通常チャットを
            <br />
            1つの画面（/u ページ）でまとめて使うことができます。
          </p>
          <ul className="space-y-2 text-xs text-slate-200">
            <li>・URLから要約＆Instagram / Facebook / X 用テキストを生成</li>
            <li>・画像から状況を説明するキャプションを生成</li>
            <li>・文章の整え・要約など通常チャットも利用可能</li>
          </ul>
          <div className="mt-6 text-[11px] text-slate-300 border-t border-slate-700 pt-3">
            初めての方は「新規登録」を選んで、
            <br />
            メールアドレスとパスワードを設定してください。
          </div>
        </section>

        {/* 右側：ログイン/新規登録フォーム（前回の項目を整理して配置） */}
        <section className="rounded-3xl bg-white/90 backdrop-blur border border-slate-200 shadow-lg px-6 py-7 md:px-8 md:py-9">
          {/* タイトル + モード切替（項目は変えず、見せ方だけ整理） */}
          <header className="mb-6">
            <p className="text-[11px] font-semibold text-slate-500 mb-1">
              {mode === 'login' ? 'おかえりなさい' : '初めてのご利用ですか？'}
            </p>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {mode === 'login' ? 'ログイン' : '新規登録'}
            </h2>
            <div className="text-xs text-slate-500">
              <span className="mr-1">
                {mode === 'login'
                  ? 'まだアカウントをお持ちでない方は'
                  : 'すでにアカウントをお持ちの方は'}
              </span>
              <button
                type="button"
                className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  resetMessages();
                }}
              >
                {mode === 'login' ? 'こちらから新規登録' : 'こちらからログイン'}
              </button>
            </div>
          </header>

          {/* フォーム本体：前回と同じ項目（メール / パスワード / ボタン / メッセージ） */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* メール */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                ログイン用メールアドレス
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* パスワード */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                パスワード
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                placeholder="8文字以上を推奨"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
            </div>

            {/* エラーメッセージ / 通常メッセージ */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            {message && !error && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {message}
              </div>
            )}

            {/* 送信ボタン（文言は前回の意図維持） */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {loading
                ? '処理中…'
                : mode === 'login'
                ? 'ログインする'
                : 'この内容で登録する'}
            </button>
          </form>

          {/* 補足（文言は増やしているが、機能は変えない） */}
          <footer className="mt-5 border-t border-dashed border-slate-200 pt-3">
            <p className="text-[11px] leading-relaxed text-slate-500">
              ・このログイン情報は、本アプリ内のSNSテキスト生成にのみ利用されます。
              <br />
              ・ログイン後は上部メニューの「/u」から、ユーザーページに移動できます。
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
