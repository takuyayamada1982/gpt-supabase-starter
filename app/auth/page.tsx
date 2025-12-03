'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

// 自分用の紹介コードを適当に6文字生成
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8);
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時のみ使用
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 紹介コード（/auth?ref=xxxx の xxxx 部分）
  const [refCode, setRefCode] = useState<string | null>(null);

  const isLogin = mode === 'login';

  // URL のクエリから ?ref= を取得
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    const r = search.get('ref');
    if (r) setRefCode(r);
  }, []);

  const resetState = () => {
    setErrorMsg(null);
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
        // -------------------------
        // ① ログイン処理（元の仕様を維持）
        // -------------------------
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          setErrorMsg('メールアドレスまたはパスワードが正しくありません。');
          return;
        }

        const user = data.user;

        // profiles からアカウントIDが一致するか確認
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .eq('account_id', accountId)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          setErrorMsg('プロフィールの確認中にエラーが発生しました。');
          // 安全のためサインアウト
          await supabase.auth.signOut();
          return;
        }

        if (!profile) {
          // アカウントID不一致 → サインアウトして弾く
          await supabase.auth.signOut();
          setErrorMsg('アカウントIDが登録情報と一致しません。');
          return;
        }

        // ここで「解約済みなら弾く」等も将来追加可能

        // OKならサービスページへ
        router.push('/u');
      } else {
        // -------------------------
        // ② 新規登録処理（紹介＆トライアル対応）
        // -------------------------
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

        // 紹介経由かどうか
        const trialType = refCode ? 'referral' : 'normal'; // 紹介なら14日トライアルに使う想定
        const accountIdForTrial = '99999'; // トライアル中は共通ID
        const myReferralCode = generateReferralCode(); // 自分用の紹介コード

        const nowIso = new Date().toISOString();

        // ★ insert ではなく upsert（id が同じなら上書き）
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email: user.email,
              account_id: accountIdForTrial,
              trial_type: trialType,           // 'normal' or 'referral'
              referred_by_code: refCode,       // 紹介経由でなければ null
              referral_code: myReferralCode,   // 自分用紹介コード
              registered_at: nowIso,
              plan_status: 'trial',            // トライアル扱い
            },
            { onConflict: 'id' }
          );

        if (upsertError) {
          console.warn('profiles upsert error (ログのみ):', upsertError.message);
        }

        // Welcome メール送信（失敗しても画面動作には影響させない）
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

        // 登録成功 → サービスページへ
        router.push('/u');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('予期しないエラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // UI（以前のきれいなデザイン版）
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '16px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
          padding: '24px 20px 28px',
        }}
      >
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            marginBottom: '4px',
          }}
        >
          Auto post studio ログイン
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: '#6b7280',
            marginBottom: '20px',
          }}
        >
          {isLogin
            ? '登録済みの方はメール・パスワード・アカウントIDを入力してください。'
            : '初めての方はメールアドレスとパスワードを設定してください。'}
        </p>

        {/* 紹介経由の時だけ表示 */}
        {!isLogin && refCode && (
          <div
            style={{
              marginBottom: '12px',
              fontSize: '12px',
              color: '#065f46',
              backgroundColor: '#ecfdf3',
              borderRadius: '8px',
              padding: '8px 10px',
              border: '1px solid #bbf7d0',
            }}
          >
            紹介コード経由でのご登録です。無料期間は通常より長くなります。
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
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid '#e5e7eb',
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
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid '#e5e7eb',
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
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid '#e5e7eb',
                  fontSize: '13px',
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
