'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

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
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg('メールアドレスまたはパスワードが正しくありません。');
          return;
        }

        const user = data.user;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .eq('account_id', accountId)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          setErrorMsg('プロフィールの確認中にエラーが発生しました。');
          await supabase.auth.signOut();
          return;
        }

        if (!profile) {
          await supabase.auth.signOut();
          setErrorMsg('アカウントIDが登録情報と一致しません。');
          return;
        }

        router.push('/u');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error || !data.user) {
          console.error(error);
          setErrorMsg('新規登録に失敗しました。すでに登録済みの可能性があります。');
          return;
        }

        const user = data.user;

        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
        });

        if (insertError) {
          console.warn('profiles insert error:', insertError.message);
        }

        router.push('/u');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('予期しないエラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        background:
          'radial-gradient(circle at 10% 20%, #ffb8d9 0, transparent 55%),' +
          'radial-gradient(circle at 80% 25%, #b7e4ff 0, transparent 55%),' +
          'radial-gradient(circle at 30% 80%, #c8ffc4 0, transparent 55%),' +
          '#ffffff',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderRadius: '20px',
          padding: '48px 40px 42px',
          border: '1.6px solid rgba(140,140,140,0.28)',
          boxShadow:
            '0 14px 40px rgba(0,0,0,0.07), 0 0 0 4px rgba(255,255,255,0.45)',
          
          // ★ カード高さ固定
          minHeight: '640px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: '16px',
            color: '#333',
          }}
        >
          Auto post studio ログイン
        </h1>

        {/* ★追加文言 */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '14px',
            lineHeight: 1.7,
            color: '#4b5563',
            marginBottom: '14px',
            whiteSpace: 'pre-line',
          }}
        >
          URL要約・画像説明生成・Chat補助をまとめてこなす、
          SNS投稿サポートツールです。
        </p>

        {/* ★切替ガイド文（下に移動しないようマージン調整） */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '14px',
            lineHeight: 1.75,
            color: '#6b7280',
            marginBottom: '28px',
            opacity: 0.9,
          }}
        >
          {isLogin
            ? '登録済みの方はメール・パスワード・アカウントIDを入力してください。'
            : '初めての方はメールアドレスとパスワードを設定してください。'}
        </p>

        {/* ▼ フェード切替ブロック ▼ */}
        <div
          key={isLogin ? 'login' : 'register'}
          className="fade-wrapper"
        >
          {/* モード切替タブ */}
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
                color: isLogin ? '#ffffff' : '#4b5563',
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
                color: !isLogin ? '#ffffff' : '#4b5563',
              }}
            >
              新規登録
            </button>
          </div>

          {/* フォーム */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <label
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#444',
                display: 'block',
              }}
            >
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '12px 15px',
                  borderRadius: '10px',
                  border: '1px solid #d2d2d2',
                  fontSize: '15px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                }}
                required
              />
            </label>

            <label
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#444',
                display: 'block',
              }}
            >
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '12px 15px',
                  borderRadius: '10px',
                  border: '1px solid #d2d2d2',
                  fontSize: '15px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                }}
                required
              />
            </label>

            {isLogin && (
              <label
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#444',
                  display: 'block',
                }}
              >
                アカウントID（5桁）
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  maxLength={5}
                  style={{
                    width: '100%',
                    marginTop: '6px',
                    padding: '12px 15px',
                    borderRadius: '10px',
                    border: '1px solid #d2d2d2',
                    fontSize: '15px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                  }}
                  required
                />
              </label>
            )}

            {errorMsg && (
              <p
                style={{
                  marginTop: '4px',
                  fontSize: '12px',
                  color: '#b91c1c',
                }}
              >
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                width: '100%',
                padding: '14px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '16px',
                fontWeight: 700,
                background: 'linear-gradient(120deg, #bfe0ff, #ffd6f5)',
                color: '#333',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 28px rgba(150,150,150,0.28)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '処理中…' : isLogin ? 'ログイン' : '新規登録'}
            </button>
          </form>

          {/* 注意書き */}
          <p
            style={{
              marginTop: '18px',
              fontSize: '12px',
              color: '#9ca3af',
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            ※ ログイン時のみアカウントIDを使用します。<br />
            ※ アカウントIDは管理画面（admin）から後から付与できます。
          </p>
        </div>

        {/* ▼ フェードアニメーション */}
        <style jsx>{`
          .fade-wrapper {
            animation: fadeInUp 0.22s ease-out;
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </section>
    </main>
  );
}
