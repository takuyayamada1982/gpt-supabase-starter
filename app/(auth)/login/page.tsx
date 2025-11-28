'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();

  // mode: login or register
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時だけ使用
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
      alert('アカウントIDを入力してください');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // ログイン
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // ここで accountId チェックを入れたい場合は、profiles を読んで一致確認してもOK
        // ひとまずログイン成功後は /u へ遷移
        router.push('/u');
      } else {
        // 新規登録（アカウントIDはここでは聞かない）
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        alert('登録用メールを送信しました。メール内のリンクから認証を完了してください。');
      }
    } catch (err: any) {
      alert(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ===== スタイル =====
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
    background:
      'radial-gradient(circle at top left, #1d4ed8 0, #0f172a 40%, #020617 100%)',
    boxSizing: 'border-box',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 18px 45px rgba(15,23,42,0.45)',
    boxSizing: 'border-box',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 4,
    color: '#0f172a',
    textAlign: 'center',
  };

  const subTitleStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    padding: '10px 14px',
    fontSize: 13,
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
  };

  const mainButtonStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 360,
    display: 'block',
    margin: '16px auto 8px',
    padding: '12px 16px',
    borderRadius: 999,
    border: 'none',
    background:
      'linear-gradient(135deg, rgba(59,130,246,1), rgba(96,165,250,1))',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.08em',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const, // スマホで縦にバラけないように
    boxShadow: '0 8px 18px rgba(37,99,235,0.35)',
  };

  const switchAreaStyle: React.CSSProperties = {
    marginTop: 4,
    fontSize: 11,
    textAlign: 'center',
    color: '#6b7280',
  };

  const switchLinkStyle: React.CSSProperties = {
    color: '#2563eb',
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '1px dashed rgba(37,99,235,0.4)',
  };

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={titleStyle}>
            SNS投稿サポートツール
          </h1>
          <p style={subTitleStyle}>
            {isLogin
              ? 'メールアドレスとアカウントIDでログインしてください。'
              : '最初にメールアドレスとパスワードだけ登録します。アカウントIDは後から管理者が付与します。'}
          </p>
        </div>

        {/* ログイン / 新規登録 タブ（小さめ） */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: 'none',
              backgroundColor: isLogin ? '#111827' : 'transparent',
              color: isLogin ? '#f9fafb' : '#6b7280',
              fontWeight: isLogin ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: 'none',
              backgroundColor: !isLogin ? '#111827' : 'transparent',
              color: !isLogin ? '#f9fafb' : '#6b7280',
              fontWeight: !isLogin ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          {/* メールアドレス */}
          <div>
            <label style={labelStyle}>メールアドレス</label>
            <input
              type="email"
              style={inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {/* アカウントID（ログイン時のみ表示） */}
          {isLogin && (
            <div>
              <label style={labelStyle}>アカウントID（5桁）</label>
              <input
                type="text"
                style={inputStyle}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="例: 12345"
                maxLength={5}
                inputMode="numeric"
              />
            </div>
          )}

          {/* パスワード */}
          <div>
            <label style={labelStyle}>パスワード</label>
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上のパスワード"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {/* メインボタン */}
          <button type="submit" style={mainButtonStyle} disabled={loading}>
            {loading
              ? isLogin
                ? 'ログイン処理中…'
                : '登録処理中…'
              : 'ログインして始める'}
          </button>

          {/* ログイン / 新規登録の切替（←ここを「ボタンの下」に置いた） */}
          <div style={switchAreaStyle}>
            {isLogin ? (
              <>
                初めてご利用の方は{' '}
                <span
                  style={switchLinkStyle}
                  onClick={() => setMode('register')}
                >
                  新規登録
                </span>
                へ
              </>
            ) : (
              <>
                すでにアカウントをお持ちの方は{' '}
                <span
                  style={switchLinkStyle}
                  onClick={() => setMode('login')}
                >
                  ログイン
                </span>
                へ
              </>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
