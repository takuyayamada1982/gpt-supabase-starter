'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時のみ
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 新規登録完了メッセージ表示用（ページを挟む）
  const [registerDone, setRegisterDone] = useState(false);

  const isLogin = mode === 'login';

  const refCode = useMemo(() => {
    const r = sp.get('ref');
    return r ? String(r).trim() : '';
  }, [sp]);

  const resetState = () => setErrorMsg(null);

  // register完了画面を挟んだ後にログインへ
  useEffect(() => {
    if (!registerDone) return;
    const t = setTimeout(() => {
      setMode('login');
      setRegisterDone(false);
      setPassword('');
      setAccountId('99999'); // ログイン画面のID欄にデフォで入れておく（要望）
    }, 1800);
    return () => clearTimeout(t);
  }, [registerDone]);

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
        // ログイン
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

        // email + account_id で profiles を確認（あなたの仕様）
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id,email,account_id')
          .eq('email', user.email)
          .eq('account_id', accountId)
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

        router.push('/u');
      } else {
        // 新規登録
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // ※ Supabase がメール確認ONの場合、ここで確認メールが飛びます
        });

        if (error || !data.user) {
          console.error('signUp error:', error);
          setErrorMsg('新規登録に失敗しました。すでに登録済みの可能性があります。');
          return;
        }

        const user = data.user;

        // profiles に登録（最小：99999を付与）
        // すでに行がある可能性もあるので upsert にして壊れにくくする
        const now = new Date().toISOString();

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email: user.email,
              account_id: '99999',
              registered_at: now,
              plan_status: 'trial',
              trial_type: refCode ? 'referral' : 'normal',
              referred_by_code: refCode || null,
            },
            { onConflict: 'id' },
          );

        if (upsertError) {
          console.warn('profiles upsert error:', upsertError.message);
          // upsertに失敗しても「登録完了表示」は出す（UX優先）
        }

        // ★ 要望：登録後にメッセージ表示→ログインへ
        setRegisterDone(true);
      }
    } catch (err) {
      console.error('unexpected error:', err);
      setErrorMsg('予期しないエラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // 登録完了の中間画面（UI最小）
  if (registerDone) {
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
            maxWidth: 460,
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderRadius: 20,
            border: '1.6px solid rgba(140,140,140,0.28)',
            padding: '40px 36px',
            boxShadow:
              '0 14px 40px rgba(0,0,0,0.07), 0 0 0 4px rgba(255,255,255,0.45)',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            新規アカウントが発行されました
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
            無料期間のIDは <strong>99999</strong> をお使いください。
            <br />
            ログインページへ移動します…
          </p>
        </section>
      </main>
    );
  }

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
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderRadius: '20px',
          border: '1.6px solid rgba(140,140,140,0.28)',
          padding: '40px 36px 42px',
          boxShadow:
            '0 14px 40px rgba(0,0,0,0.07), 0 0 0 4px rgba(255,255,255,0.45)',
          minHeight: '640px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 36,
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

        <div key={isLogin ? 'login' : 'register'} className="fade-wrapper">
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

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <label style={{ width: '100%', display: 'block', fontSize: 14, fontWeight: 600, color: '#444' }}>
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

            <label style={{ width: '100%', display: 'block', fontSize: 14, fontWeight: 600, color: '#444' }}>
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
              <label style={{ width: '100%', display: 'block', fontSize: 14, fontWeight: 600, color: '#444' }}>
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
              <p style={{ marginTop: 4, fontSize: 12, color: '#b91c1c' }}>
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
