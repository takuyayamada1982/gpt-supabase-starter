'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { CSSProperties } from 'react';

type Mode = 'login' | 'register';

/* ---------------------------------------------------------
   デザイン（背景・カード・入力・ボタン）をまとめたスタイル
--------------------------------------------------------- */
const loginStyles: {
  page: CSSProperties;
  card: CSSProperties;
  title: CSSProperties;
  subtitle: CSSProperties;
  label: CSSProperties;
  input: CSSProperties;
  button: CSSProperties;
  footnote: CSSProperties;
} = {
  page: {
    minHeight: '100vh',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    fontFamily:
      '"Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: `
      radial-gradient(circle at 10% 20%, #ffb8d9 0, transparent 55%),
      radial-gradient(circle at 80% 25%, #b7e4ff 0, transparent 55%),
      radial-gradient(circle at 30% 80%, #c8ffc4 0, transparent 55%),
      #ffffff
    `,
  },

  card: {
    width: '100%',
    maxWidth: '460px',
    background: 'rgba(255,255,255,0.96)',
    padding: '48px 40px 42px',
    borderRadius: '20px',
    border: '1.6px solid rgba(140,140,140,0.28)',
    boxShadow:
      '0 14px 40px rgba(0,0,0,0.07), 0 0 0 4px rgba(255,255,255,0.45)',
  },

  title: {
    fontSize: '26px',
    textAlign: 'center',
    fontWeight: 600,
    letterSpacing: '0.02em',
    marginBottom: '16px',
    color: '#333',
  },

  subtitle: {
    textAlign: 'center',
    fontSize: '14px',
    lineHeight: 1.75,
    marginBottom: '28px',
    color: '#6d6d6d',
    opacity: 0.9,
  },

  label: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#444',
  },

  input: {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '10px',
    border: '1px solid #d2d2d2',
    background: '#ffffff',
    fontSize: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    outline: 'none',
    transition: 'all .15s ease',
  },

  button: {
    marginTop: '10px',
    width: '100%',
    padding: '14px',
    borderRadius: '999px',
    background: 'linear-gradient(120deg, #bfe0ff, #ffd6f5)',
    border: 'none',
    fontSize: '16px',
    fontWeight: 700,
    color: '#333',
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(150,150,150,0.28)',
    transition: '0.12s ease',
  },

  footnote: {
    marginTop: '22px',
    fontSize: '12px',
    textAlign: 'center',
    color: '#7a7a7a',
    lineHeight: 1.6,
  },
};

/* ---------------------------------------------------------
   AuthPage 本体
--------------------------------------------------------- */
export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時のみ使用
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLogin = mode === 'login';

  const resetState = () => setErrorMsg(null);

  /* ------------------------------------------
      ログイン / 新規登録 の共通処理
  ------------------------------------------ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    if (!email || !password) {
      setErrorMsg('メールアドレスとパスワードを入力してください。');
      return;
    }
    if (isLogin && !accountId) {
      setErrorMsg('ログインにはアカウントIDが必要です。');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        /* === ▼ ログイン処理 ▼ === */
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg('メールアドレスまたはパスワードが正しくありません。');
          return;
        }

        const user = data.user;

        // profiles 取得
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_id, is_canceled, plan_valid_until')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile) {
          await supabase.auth.signOut();
          setErrorMsg('プロフィール情報の取得に失敗しました。');
          return;
        }

        if (profile.account_id !== accountId) {
          await supabase.auth.signOut();
          setErrorMsg('アカウントIDが登録情報と一致しません。');
          return;
        }

        if (profile.is_canceled) {
          const now = new Date();
          const end = new Date(profile.plan_valid_until || '');

          if (isNaN(end.getTime()) || end < now) {
            await supabase.auth.signOut();
            setErrorMsg('ご契約の有効期限が終了しています。');
            return;
          }
        }

        /* ログイン成功 → ユーザーページ */
        router.push('/u');
      } else {
        /* === ▼ 新規登録処理 ▼ === */
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg('新規登録に失敗しました。すでに登録済みの可能性があります。');
          return;
        }

        const user = data.user;

        // profiles 追加（account_idは admin が後付け）
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
        });

        router.push('/u');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('予期しないエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------
     ★ ここから画面表示 (UI)
  --------------------------------------------------------- */
  return (
    <main style={loginStyles.page}>
      <section style={loginStyles.card}>

        <h1 style={loginStyles.title}>Auto post studio ログイン</h1>

        <p style={loginStyles.subtitle}>
          {isLogin
            ? '登録済みの方はメール・パスワード・アカウントIDを入力してください。'
            : '初めての方はメールアドレスとパスワードを設定してください。'}
        </p>

        {/* モード切替 */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            backgroundColor: '#f3f4f6',
            borderRadius: '999px',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              resetState();
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '999px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: isLogin ? '#111827' : 'transparent',
              color: isLogin ? '#fff' : '#4b5563',
            }}
          >
            ログイン
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              resetState();
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '999px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: !isLogin ? '#111827' : 'transparent',
              color: !isLogin ? '#fff' : '#4b5563',
            }}
          >
            新規登録
          </button>
        </div>

        {/* 入力フォーム */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
        >
          <div>
            <label style={loginStyles.label}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={loginStyles.input}
              required
            />
          </div>

          <div>
            <label style={loginStyles.label}>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={loginStyles.input}
              required
            />
          </div>

          {isLogin && (
            <div>
              <label style={loginStyles.label}>アカウントID（5桁）</label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                maxLength={5}
                style={loginStyles.input}
                required
              />
            </div>
          )}

          {errorMsg && (
            <p style={{ fontSize: '12px', color: '#d00' }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...loginStyles.button,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '処理中…' : isLogin ? 'ログイン' : '新規登録'}
          </button>
        </form>

        <p style={loginStyles.footnote}>
          ※ ログイン時のみアカウントIDを使用します。
          <br />
          ※ アカウントIDは管理画面（admin）から後から付与・変更できます。
        </p>

      </section>
    </main>
  );
}
