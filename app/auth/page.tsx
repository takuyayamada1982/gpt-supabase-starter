'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

// ✅ useSearchParams を Suspense 配下でのみ使う（UIは一切出さない）
function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
    }
  }, [searchParams]);

  return null;
}

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

  // ✅ 追加：パスワードリセット（メール送信）
  const handleResetPassword = async () => {
    resetState();

    if (!email) {
      setErrorMsg('パスワードリセットにはメールアドレスの入力が必要です。');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/reset`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error('resetPassword error:', error);
        setErrorMsg('パスワードリセットのメール送信に失敗しました。');
        return;
      }

      alert('パスワードリセット用のメールを送信しました。受信箱をご確認ください。');
    } catch (err) {
      console.error('resetPassword unexpected error:', err);
      setErrorMsg('予期しないエラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

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
        // -----------------------------
        // ログイン処理
        // -----------------------------
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          console.error('signIn error:', error);
          setErrorMsg('メールアドレスまたはパスワードが正しくありません。');
          return;
        }

        const user = data.user;

        // profiles からアカウントIDが一致するか確認（email + account_id でチェック）
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email) // ★ email で紐付け
          .eq('account_id', accountId) // ★ 入力されたアカウントID
          .maybeSingle();

        if (profileError) {
          console.error('profileError:', profileError);
          setErrorMsg('プロフィールの確認中にエラーが発生しました。');
          await supabase.auth.signOut();
          return;
        }

        if (!profile) {
          await supabase.auth.signOut();
          setErrorMsg('アカウントIDが登録情報と一致しません。');
          return;
        }

        // ここまで来ていれば「メール＋パスワード＋アカウントID」が全部正しい
        router.push('/u');
      } else {
        // -----------------------------
        // 新規登録処理
        // -----------------------------
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error || !data.user) {
          console.error('signUp error:', error);
          setErrorMsg('新規登録に失敗しました。すでに登録済みの可能性があります。');
          return;
        }

        const user = data.user;

        // profiles に最低限の情報を追加しつつ、account_id = '99999' を登録
        const { error: upsertError } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email,
            account_id: '99999', // ★ 無料期間中の共通アカウントID
          },
          {
            onConflict: 'id',
          }
        );

        if (upsertError) {
          console.warn('profiles upsert error:', upsertError.message);
          setErrorMsg('プロフィール情報の登録に失敗しました。');
          return;
        }

        // メッセージ表示 → ログイン画面に切り替え
        alert(
          '新規アカウントが発行されました。\n\n' +
            '無料期間中のアカウントIDは「99999」をお使いください。\n' +
            'ログイン画面で「メールアドレス」「パスワード」と合わせて入力してください。'
        );

        // ログインモードへ切り替え & 99999 をプリセット
        setMode('login');
        setAccountId('99999');
        // email / password はそのまま残しておくと、すぐにログインしやすい

        return;
      }
    } catch (err) {
      console.error('unexpected error:', err);
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
        // 淡い色のグラデーション背景（前と同じ雰囲気）
        background:
          'radial-gradient(circle at 10% 20%, #ffb8d9 0, transparent 55%),' +
          'radial-gradient(circle at 80% 25%, #b7e4ff 0, transparent 55%),' +
          'radial-gradient(circle at 30% 80%, #c8ffc4 0, transparent 55%),' +
          '#ffffff',
      }}
    >
      {/* ✅ UIを変えずに ref だけ拾う（Suspense要件対応） */}
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>

      <section
        style={{
          position: 'relative', // サインインラベル用
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderRadius: '20px',
          border: '1.6px solid rgba(140,140,140,0.28)',
          padding: '40px 36px 42px', // 左右36px
          boxShadow:
            '0 14px 40px rgba(0,0,0,0.07), 0 0 0 4px rgba(255,255,255,0.45)',
          minHeight: '640px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* カード内 左上のサインイン（固定表示） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 36, // カードpadding左と揃える
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: '#4b5563',
          }}
        >
          サインイン
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            textAlign: 'center',
            margin: '16px 0 16px',
            color: '#333',
          }}
        >
          Auto post studio
        </h1>

        {/* キャッチコピー */}
        <p
          style={{
            textAlign: 'center',
            fontSize: 14,
            lineHeight: 1.7,
            color: '#4b5563',
            marginBottom: 18,
          }}
        >
          SNS投稿の準備を、もっとシンプルに。
          <br />
          URL要約・画像説明・文章補助をまとめて行えるSNS補助ツールです。
        </p>

        {/* ログイン / 新規登録ガイド文 */}
        <p
          style={{
            textAlign: 'center',
            fontSize: 14,
            lineHeight: 1.75,
            color: '#6b7280',
            marginBottom: 28,
            opacity: 0.9,
          }}
        >
          {isLogin
            ? '登録済みの方はメール・パスワード・アカウントIDを入力してください。'
            : '初めての方はメールアドレスとパスワードを設定してください。'}
        </p>

        {/* ログイン / 新規登録 切替ブロック */}
        <div key={isLogin ? 'login' : 'register'} className="fade-wrapper">
          {/* タブ */}
          <div
            style={{
              display: 'flex',
              padding: 4,
              gap: 4,
              backgroundColor: '#f3f4f6',
              borderRadius: 999,
              marginBottom: 22,
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
                borderRadius: 999,
                border: 'none',
                fontSize: 13,
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
                borderRadius: 999,
                border: 'none',
                fontSize: 13,
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
              gap: 18,
            }}
          >
            <label
              style={{
                width: '100%',
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#444',
              }}
            >
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  padding: '12px 15px',
                  borderRadius: 10,
                  border: '1px solid #d2d2d2',
                  fontSize: 15,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                }}
                required
              />
            </label>

            <label
              style={{
                width: '100%',
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#444',
              }}
            >
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  padding: '12px 15px',
                  borderRadius: 10,
                  border: '1px solid #d2d2d2',
                  fontSize: 15,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                }}
                required
              />
            </label>

            {isLogin && (
              <label
                style={{
                  width: '100%',
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#444',
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
                    boxSizing: 'border-box',
                    marginTop: 6,
                    padding: '12px 15px',
                    borderRadius: 10,
                    border: '1px solid #d2d2d2',
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                  }}
                  required
                />
              </label>
            )}

            {errorMsg && (
              <p
                style={{
                  marginTop: 4,
                  fontSize: 12,
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
                marginTop: 8,
                width: '100%',
                padding: 14,
                borderRadius: 999,
                border: 'none',
                fontSize: 16,
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

            {/* ✅ 追加：ログイン時のみ表示（最小UI） */}
            {isLogin && (
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading}
                style={{
                  marginTop: 10,
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: 12,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                  alignSelf: 'center',
                }}
              >
                パスワードを忘れた方はこちら
              </button>
            )}
          </form>

          <p
            style={{
              marginTop: 18,
              fontSize: 12,
              textAlign: 'center',
              lineHeight: 1.7,
              color: '#9ca3af',
            }}
          >
            ※ 無料期間中で契約前のアカウントIDは99999を使用します。
            <br />
            ※ アカウントIDは契約後に払い出しされます。
          </p>
        </div>

        {/* フェードアニメーション（ログイン⇄新規登録切り替え時） */}
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
