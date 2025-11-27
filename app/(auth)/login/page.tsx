'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState(''); // ⭐追加：5桁のアカウントID

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
      if (!email || !password || !accountId) {
        setError('メール・パスワード・アカウントIDを入力してください。');
        return;
      }

      if (mode === 'login') {
        // 🔑 ①メール＋パスワードで認証
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) throw signInError;
        if (!signInData?.user) throw new Error('ログインに失敗しました');

        const userId = signInData.user.id;

        // 🔑 ②アカウントID（5桁）チェック
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('account_id')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;

        if (!profile || profile.account_id !== accountId) {
          throw new Error('アカウントIDが一致しません');
        }

        // 🎉 ログイン成功
        setMessage('ログイン成功 → ユーザーページへ移動します');
        router.push('/u');

      } else {
        // 🆕 新規登録（メール＋パスワード）
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({ email, password });

        if (signUpError) throw signUpError;

        if (!signUpData?.user) {
          setMessage('確認メールを送信しました。メール内リンクを開いてください。');
          return;
        }

        // ⭐ 新規登録時に profiles 行を作成（account_id は後で付与）
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: signUpData.user.id,
            email,
            account_id: null,
            is_master: false,
          });

        if (insertError) console.error(insertError);

        setMessage('登録が完了しました → ユーザーページへ移動');
        router.push('/u');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid gap-6 md:grid-cols-[1.2fr,1fr] items-stretch">

        {/* ---- 左側の説明 ---- */}
        <section className="hidden md:flex flex-col justify-center rounded-3xl bg-slate-900 text-slate-50 p-8 shadow-xl">
          <h1 className="text-2xl font-semibold mb-3">
            SNS投稿テキスト自動生成ツール
          </h1>
          <p className="text-sm text-slate-200 mb-5 leading-relaxed">
            URL要約・画像説明文・チャットを
            1つの画面（/u）で利用できます。
          </p>
        </section>

        {/* ---- 右側のフォーム ---- */}
        <section className="rounded-3xl bg-white/90 backdrop-blur border border-slate-200 shadow-lg px-6 py-7 md:px-8 md:py-9">
          <header className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'login' ? 'ログイン' : '新規登録'}
            </h2>
          </header>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* メール */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                ログイン用メールアドレス
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* パスワード */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">パスワード</label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* ⭐ 追加：アカウントID（5桁） */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                アカウントID（5桁）
              </label>
              <input
                type="text"
                maxLength={5}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="例：10324"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* ボタン */}
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              disabled={loading}
            >
              {loading
                ? '処理中…'
                : mode === 'login'
                ? 'ログインする'
                : 'この内容で登録する'}
            </button>
          </form>

          {/* モード切替 */}
          <div className="mt-5 text-xs text-slate-600">
            {mode === 'login' ? (
              <>
                アカウントをお持ちでない場合は{' '}
                <button
                  className="underline font-semibold"
                  onClick={() => {
                    setMode('signup');
                    resetMessages();
                  }}
                >
                  新規登録
                </button>
              </>
            ) : (
              <>
                すでにアカウントがある方は{' '}
                <button
                  className="underline font-semibold"
                  onClick={() => {
                    setMode('login');
                    resetMessages();
                  }}
                >
                  ログイン
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
