// app/login/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login'); // ログイン / 新規登録
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');  // ★ アカウントID（5桁）
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !password) {
      setMessage('メールアドレスとパスワードを入力してください。');
      return;
    }

    // アカウントIDは任意だが、入力された場合は5桁チェック
    if (accountId && !/^\d{5}$/.test(accountId)) {
      setMessage('アカウントIDは5桁の数字で入力してください。');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        // ★ 新規登録
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // メタデータに一応保持（profilesと併用予定でもOK）
            data: accountId ? { account_id: accountId } : {},
          },
        });

        if (error) throw error;
        setMessage('仮登録が完了しました。メールに届く確認リンクをチェックしてください。');
      } else {
        // ★ ログイン
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // アカウントIDが入力されている場合のみチェック
        if (accountId) {
          const userId = data.user?.id;
          if (!userId) {
            throw new Error('ユーザー情報の取得に失敗しました。');
          }

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('account_id')
            .eq('id', userId)
            .maybeSingle();

          if (profileError) throw profileError;

          if (!profile || String(profile.account_id ?? '') !== accountId) {
            // 一致しない場合はいったんログアウトしてエラー表示
            await supabase.auth.signOut();
            throw new Error('アカウントIDが一致しません。');
          }
        }

        // OKならユーザーページへ
        router.push('/u');
      }
    } catch (err: any) {
      console.error(err);
      setMessage(err.message ?? 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* カード */}
        <div className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-8 border border-slate-200">
          {/* タイトル */}
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-slate-900">
              SNS自動生成ツール ログイン
            </h1>
            <p className="text-xs text-slate-500 mt-2">
              登録したメールアドレスとパスワード
              <br />
              ＋（任意）5桁のアカウントIDでログインできます。
            </p>
          </div>

          {/* モード切替タブ */}
          <div className="flex mb-6 border border-slate-200 rounded-full overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-semibold transition
                ${mode === 'login'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-semibold transition
                ${mode === 'signup'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              新規登録
            </button>
          </div>

          {/* メッセージ */}
          {message && (
            <div className="mb-4 text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
              {message}
            </div>
          )}

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/70 focus:border-slate-900"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* アカウントID（5桁） */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                アカウントID（5桁の数字）
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/70 focus:border-slate-900"
                placeholder="例：01234"
                value={accountId}
                onChange={(e) => {
                  // 数字のみ許可
                  const v = e.target.value.replace(/\D/g, '');
                  setAccountId(v);
                }}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                ※ マスターが発行した5桁ID。未設定の場合は空欄でもログインできます。
              </p>
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/70 focus:border-slate-900"
                placeholder="8文字以上を推奨"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {/* ボタン */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-semibold py-2.5 shadow-md shadow-slate-900/20 hover:bg-black transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === 'login'
                  ? 'ログイン中…'
                  : '登録処理中…'
                : mode === 'login'
                ? 'ログインする'
                : '新規登録する'}
            </button>
          </form>

          {/* フッター説明 */}
          <div className="mt-5 text-[10px] text-slate-500 text-center leading-relaxed">
            ログイン後は <span className="font-semibold text-slate-700">/u（ユーザーページ）</span> に移動し、<br />
            URL要約・画像からSNS原稿作成・チャット機能をご利用いただけます。
          </div>
        </div>

        {/* トップへのリンク（任意） */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
          >
            トップページへ戻る
          </button>
        </div>
      </div>
    </main>
  );
}
