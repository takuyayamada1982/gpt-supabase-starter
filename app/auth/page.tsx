'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthPage() {
  const router = useRouter();

  // mode: login or register
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時のみ使用
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      alert('メールアドレスとパスワードを入力してください');
      return;
    }
    if (isLogin && !accountId) {
      alert('アカウントID（5桁）を入力してください');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // ---------------------------
        // ① Supabase Auth でサインイン
        // ---------------------------
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError || !signInData.user) {
          console.error('signIn error:', signInError);
          alert('メールアドレスまたはパスワードが正しくありません');
          return;
        }

        const user = signInData.user;

        // ---------------------------------------------
        // ② profiles から account_id を取得して照合する
        // ---------------------------------------------
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('account_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          console.error('profile error:', profileError);
          alert(
            'プロフィール情報が見つかりません。管理者にお問い合わせください。'
          );
          await supabase.auth.signOut();
          return;
        }

        if (String(profile.account_id) !== String(accountId)) {
          // アカウントID不一致 → 強制サインアウト
          await supabase.auth.signOut();
          alert('アカウントIDが正しくありません');
          return;
        }

        // ---------------------------
        // ③ ログイン成功 → ユーザーページへ
        // ---------------------------
        router.push('/u'); // 実際のユーザーダッシュボードのパスに合わせて変更
      } else {
        // ---------------------------
        // 新規登録モード
        // ---------------------------
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
          });

        if (signUpError || !signUpData.user) {
          console.error('signUp error:', signUpError);
          alert('ユーザー登録に失敗しました');
          return;
        }

        const user = signUpData.user;

        // profiles にレコード作成
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email,
            // トライアル発行時にここへ 99999 などを入れてもOK
            account_id: accountId || null,
            is_master: false,
          });

        if (profileInsertError) {
          console.error('profile insert error:', profileInsertError);
          alert('プロフィールの作成に失敗しました');
          return;
        }

        alert('登録が完了しました。サインインしてください。');
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fff8f2]">
      {/* 背景：パレットっぽい淡い色のドットを散らす */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 left-6 w-16 h-16 rounded-full bg-[#ffd6e3] opacity-70" />
        <div className="absolute top-10 right-10 w-20 h-20 rounded-full bg-[#ffe9a9] opacity-70" />
        <div className="absolute bottom-10 left-10 w-24 h-24 rounded-full bg-[#cdeefc] opacity-70" />
        <div className="absolute -bottom-8 right-6 w-16 h-16 rounded-full bg-[#d6f7d8] opacity-70" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* ロゴ＆キャッチ */}
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 shadow-sm border border-[#f3d7c5]">
            <span className="w-3 h-3 rounded-full bg-[#ffb7c5]" />
            <span className="w-3 h-3 rounded-full bg-[#ffe27a]" />
            <span className="w-3 h-3 rounded-full bg-[#8fd5ff]" />
            <span className="text-xs font-medium text-slate-700">
              AutoPost Studio
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            活動はしているのに、SNSが追いつかない。<br />
            そんな毎日を、ちょっとカラフルに整えるツールです。
          </p>
        </div>

        {/* カード本体 */}
        <div className="bg-white/90 rounded-2xl shadow-xl border border-[#f3d7c5] px-7 py-8">
          {/* サインイン / 新規登録 タイトル（カード左上） */}
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="text-lg font-semibold text-slate-900">
              {isLogin ? 'サインイン' : '新規登録'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffb7c5]/70 focus:border-transparent bg-white"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffb7c5]/70 focus:border-transparent bg-white"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>

            {isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  アカウントID（5桁）
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffe27a]/70 focus:border-transparent bg-white"
                  maxLength={5}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  管理者から発行された 5 桁の番号を入力してください。
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white bg-[#ff8ba7] hover:bg-[#ff7596] disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {loading
                ? '処理中...'
                : isLogin
                ? 'サインインする'
                : '登録してはじめる'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-600">
            {isLogin ? (
              <>
                まだアカウントをお持ちでない方は{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-semibold text-[#ff8ba7] underline underline-offset-2"
                >
                  新規登録
                </button>
              </>
            ) : (
              <>
                すでにアカウントをお持ちの方は{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-[#ff8ba7] underline underline-offset-2"
                >
                  サインイン
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-3 text-[10px] text-center text-slate-500">
          通常のご利用範囲を超えるアクセスが検知された場合、<br />
          アカウントの一時停止やご連絡を行うことがあります。
        </p>
      </div>
    </main>
  );
}
