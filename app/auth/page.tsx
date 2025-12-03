'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

// 自分用紹介コード 6文字生成
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8);
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時のみ
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ?ref=xxxx の取得
  const [refCode, setRefCode] = useState<string | null>(null);
  const isLogin = mode === 'login';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('ref');
    if (r) setRefCode(r);
  }, []);

  const resetState = () => setErrorMsg(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        // ===== ログイン処理 =====
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
          await supabase.auth.signOut();
          setErrorMsg('プロフィールの確認中にエラーが発生しました。');
          return;
        }

        if (!profile) {
          await supabase.auth.signOut();
          setErrorMsg('アカウントIDが登録情報と一致しません。');
          return;
        }

        router.push('/u');
      } else {
        // ===== 新規登録処理 =====
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

        const trialType = refCode ? 'referral' : 'normal'; // 紹介なら14日トライアル用に利用
        const accountIdForTrial = '99999';                 // トライアル共通ID
        const myReferralCode = generateReferralCode();     // 自分の紹介コード

        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          account_id: accountIdForTrial,
          trial_type: trialType,
          referred_by_code: refCode,
          referral_code: myReferralCode,
          registered_at: new Date().toISOString(),
          plan_status: 'trial',
        });

        if (insertError) {
          console.warn('profiles insert error:', insertError.message);
        }

        // Welcome メール（失敗しても致命的ではないので握りつぶす）
        try {
          await fetch('/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              accountId: accountIdForTrial,
              trialType,
              referralCode: myReferralCode,
            }),
          });
        } catch (err) {
          console.error('send-welcome failed:', err);
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

  // ===== UI（以前のきれいなデザインに戻した版） =====
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '32px 26px',
          boxShadow: '0 16px 40px rgba(15,23,42,0.15)',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '4px',
            color: '#111827',
          }}
        >
          Auto post studio ログイン
        </h1>

        <p
          style={{
            fontSize: '13px',
            color: '#6b7280',
            marginBottom: '18px',
          }}
        >
          {isLogin
            ? '登録済みの方はメール・パスワード・アカウントIDを入力してください。'
            : '初めての方はメールアドレスとパスワードを設定してください。'}
        </p>

        {/* 紹介経由のときのバナー */}
        {!isLogin && refCode && (
          <div
            style={{
              marginBottom: '14px',
              padding: '8px 10px',
              borderRadius: '10px',
              backgroundColor: '#ecfdf3',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '12px',
            }}
          >
            紹介コード経由でのご登録です。無料期間が延長されます。
          </div>
        )}

        {/* モード切り替えタブ */}
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

        {/* フォーム本体 */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                marginTop: '4px',
                padding: '9px 10px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                fontSize: '13px',
              }}
              required
            />
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                marginTop: '4px',
                padding: '9px 10px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                fontSize: '13px',
              }}
              required
            />
          </label>

          {isLogin && (
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              アカウントID（5桁）
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                maxLength={5}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  fontSize: '13px',
                }}
                required
              />
            </label>
          )}

          {errorMsg && (
            <p
              style={{
                marginTop: '2px',
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
              marginTop: '8px',
              width: '100%',
              padding: '10px',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: loading ? '#6b7280' : '#111827',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '処理中…' : isLogin ? 'ログイン' : '新規登録'}
          </button>
        </form>

        <p
          style={{
            marginTop: '14px',
            fontSize: '11px',
            color: '#9ca3af',
            lineHeight: 1.5,
          }}
        >
          ※ ログイン時のみアカウントIDを使用します。
          <br />
          ※ アカウントIDは管理画面（admin）から後から付与・変更できます。
        </p>
      </section>
    </main>
  );
}
