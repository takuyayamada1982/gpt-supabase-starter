// app/(auth)/login/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState(''); // ★ アカウントID（5桁）

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !password) {
      setMessage('メールアドレスとパスワードを入力してください。');
      return;
    }

    // ※ 今は機能を変えない前提なので、accountId は「入力だけ」してもらう状態
    //   （ログイン判定にはまだ使っていません）

    try {
      setLoading(true);

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        setMessage('登録用メールを送信しました。メールを確認してログインしてください。');
        setMode('login');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (!data.user) throw new Error('ログインに失敗しました。');

        router.push('/u');
      }
    } catch (err: any) {
      setMessage(err.message ?? 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // ====== スタイル定義（インライン） ======
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at top left, #3B82F6 0, #1D4ED8 40%, #0F172A 100%)',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, system-ui, -system-ui, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    width: 'min(960px, 100% - 32px)',
    minHeight: 420,
    borderRadius: 24,
    background: '#FFFFFF',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
    boxShadow: '0 18px 60px rgba(15,23,42,0.35)',
    overflow: 'hidden',
  };

  const leftStyle: React.CSSProperties = {
    position: 'relative',
    padding: '40px 36px',
    background:
      'radial-gradient(circle at 0% 0%, #60A5FA 0, #1D4ED8 40%, #0F172A 100%)',
    color: '#EFF6FF',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };

  const rightStyle: React.CSSProperties = {
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 8,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.9,
    lineHeight: 1.7,
    maxWidth: 320,
  };

  const inputLabel: React.CSSProperties = {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 10,
    border: '1px solid #D1D5DB',
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const primaryBtn: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 999,
    border: 'none',
    background: '#1D4ED8',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  };

  const secondaryBtn: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 999,
    border: '1px solid #E5E7EB',
    background: '#FFFFFF',
    color: '#111827',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  };

  const modeToggleBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 10px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    background: active ? '#1D4ED8' : 'transparent',
    color: active ? '#EFF6FF' : '#6B7280',
  });

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {/* 左側：Welcome エリア */}
        <section style={leftStyle}>
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                opacity: 0.8,
                marginBottom: 6,
              }}
            >
              WELCOME
            </div>
            <h1 style={titleStyle}>SNS 投稿サポートツール</h1>
            <p style={subtitleStyle}>
              URL や写真から、Instagram / Facebook / X 向けの文章をまとめて生成できます。
              ログインして、日々の SNS 投稿をもっと楽にしていきましょう。
            </p>
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            ※ この画面で入力された情報は Supabase の認証機能で安全に扱われます。
          </div>
        </section>

        {/* 右側：ログインフォーム */}
        <section style={rightStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {mode === 'login'
                  ? 'ログインしてはじめる'
                  : 'アカウントを新規作成'}
              </div>
            </div>

            <div
              style={{
                background: '#F3F4F6',
                borderRadius: 999,
                padding: 3,
                display: 'flex',
                gap: 2,
              }}
            >
              <button
                type="button"
                style={modeToggleBtn(mode === 'login')}
                onClick={() => setMode('login')}
              >
                ログイン
              </button>
              <button
                type="button"
                style={modeToggleBtn(mode === 'signup')}
                onClick={() => setMode('signup')}
              >
                新規登録
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            {/* メールアドレス */}
            <div style={{ display: 'grid', gap: 4 }}>
              <label style={inputLabel}>メールアドレス</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {/* アカウントID（5桁） */}
            <div style={{ display: 'grid', gap: 4 }}>
              <label style={inputLabel}>
                アカウントID（5桁の数字）※任意／今後の管理用
              </label>
              <input
                style={inputStyle}
                type="text"
                maxLength={5}
                value={accountId}
                onChange={(e) =>
                  setAccountId(e.target.value.replace(/[^0-9]/g, ''))
                }
                placeholder="例：12345"
              />
            </div>

            {/* パスワード */}
            <div style={{ display: 'grid', gap: 4 }}>
              <label style={inputLabel}>パスワード</label>
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上を推奨"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
            </div>

            {/* メッセージ表示 */}
            {message && (
              <div
                style={{
                  fontSize: 12,
                  color: '#B91C1C',
                  background: '#FEF2F2',
                  borderRadius: 10,
                  padding: '8px 10px',
                  marginTop: 4,
                }}
              >
                {message}
              </div>
            )}

            {/* ボタン */}
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <button type="submit" style={primaryBtn} disabled={loading}>
                {loading
                  ? '処理中...'
                  : mode === 'login'
                  ? 'ログインする'
                  : '新規登録する'}
              </button>

              <button
                type="button"
                style={secondaryBtn}
                onClick={() => {
                  setEmail('');
                  setPassword('');
                  setAccountId('');
                  setMessage(null);
                }}
              >
                入力内容をクリア
              </button>
            </div>
          </form>

          <div
            style={{
              marginTop: 16,
              fontSize: 11,
              color: '#6B7280',
              lineHeight: 1.6,
            }}
          >
            ・ログイン後は「ユーザーページ /u」から URL 要約・画像説明・チャット機能をご利用いただけます。
            <br />
            ・アカウントIDは将来の管理機能（/admin）で利用予定です。
          </div>
        </section>
      </div>
    </main>
  );
}
