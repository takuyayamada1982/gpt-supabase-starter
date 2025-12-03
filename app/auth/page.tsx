'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getAccessState, type ProfileRow } from '@/lib/accessControl';

type Mode = 'login' | 'register';

const generateReferralCode = () => {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
};

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(''); // ログイン時のみ使用
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isLogin = mode === 'login';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('メールアドレスとパスワードを入力してください');
      return;
    }
    if (isLogin && !accountId) {
      setErrorMessage('アカウントIDを入力してください');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // ============================
        // ログイン処理
        // ============================
        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (authError || !authData.user) {
          setErrorMessage('メールアドレスまたはパスワードが正しくありません');
          return;
        }

        const user = authData.user;

        // profiles 取得（account_id も一致させる）
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .eq('account_id', accountId)
          .maybeSingle<ProfileRow>();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setErrorMessage('アカウントIDが登録情報と一致しません。');
          return;
        }

        // アクセス可能か判定
        const access = getAccessState(profile);
        if (!access.isActive) {
          await supabase.auth.signOut();
          setErrorMessage(access.message);
          return;
        }

        // OK → /u へ
        router.push('/u');
      } else {
        // ============================
        // 新規登録処理
        // ============================
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
          });

        if (signUpError || !signUpData.user) {
          setErrorMessage('新規登録に失敗しました。時間をおいて再度お試しください。');
          return;
        }

        const user = signUpData.user;

        // ?ref=XXXX 取得
        const refCode = searchParams.get('ref');
        const trialType: ProfileRow['trial_type'] =
          refCode ? 'referral' : 'normal';

        const fixedTrialAccountId = '99999';
        const myReferralCode = generateReferralCode();

        // profiles upsert
        const { error: upsertError } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email,
            account_id: fixedTrialAccountId,
            trial_type: trialType,
            referred_by_code: refCode ?? null,
            referral_code: myReferralCode,
            registered_at: new Date().toISOString(),
            plan_status: 'trial',
          },
          {
            onConflict: 'id',
          }
        );

        if (upsertError) {
          console.error('profiles upsert error', upsertError);
          setErrorMessage(
            'ユーザープロファイルの登録に失敗しました。時間をおいて再度お試しください。'
          );
          return;
        }

        // Welcomeメール送信（失敗しても画面動作は止めない）
        try {
          await fetch('/api/send-welcome', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              accountId: fixedTrialAccountId,
              trialType,
              referralCode: myReferralCode,
            }),
          });
        } catch (mailError) {
          console.error('send-welcome error', mailError);
        }

        // 新規登録後はそのまま /u へ
        router.push('/u');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // UI（美しめレイアウト版）
  // ============================
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at top left, #e0f2fe 0, transparent 45%), radial-gradient(circle at bottom right, #fee2e2 0, transparent 50%), #f3f4f6',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: '20px',
          backgroundColor: '#ffffff',
          boxShadow:
            '0 18px 45px rgba(15, 23, 42, 0.16), 0 6px 15px rgba(15, 23, 42, 0.10)',
          padding: '24px 24px 28px',
          position: 'relative',
        }}
      >
        {/* カード左上の「サインイン」ラベル */}
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '18px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#9ca3af',
          }}
        >
          サインイン
        </div>

        {/* タイトル部分 */}
        <div style={{ marginTop: '18px', marginBottom: '16px' }}>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '4px',
            }}
          >
            Auto post studio
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: 1.5,
            }}
          >
            URL要約・画像説明生成・Chat補助をまとめてこなす、
            SNS投稿サポートツールです。
          </p>
        </div>

        {/* タブ（ログイン / 新規登録） */}
        <div
          style={{
            display: 'flex',
            borderRadius: '999px',
            backgroundColor: '#f3f4f6',
            padding: '2px',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              borderRadius: '999px',
              padding: '8px 0',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor:
                mode === 'login' ? '#111827' : 'transparent',
              color: mode === 'login' ? '#f9fafb' : '#6b7280',
              transition: 'all 0.15s ease',
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              borderRadius: '999px',
              padding: '8px 0',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor:
                mode === 'register' ? '#111827' : 'transparent',
              color: mode === 'register' ? '#f9fafb' : '#6b7280',
              transition: 'all 0.15s ease',
            }}
          >
            新規登録
          </button>
        </div>

        {/* エラーメッセージ */}
        {errorMessage && (
          <p
            style={{
              marginBottom: '12px',
              fontSize: '12px',
              color: '#b91c1c',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              padding: '6px 8px',
            }}
          >
            {errorMessage}
          </p>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit}>
          {/* メールアドレス */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#4b5563',
              }}
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                padding: '9px 11px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#4b5563',
              }}
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                padding: '9px 11px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* アカウントID（ログイン時のみ） */}
          {isLogin && (
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="accountId"
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#4b5563',
                }}
              >
                アカウントID（5桁）
              </label>
              <input
                id="accountId"
                type="text"
                maxLength={5}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  padding: '9px 11px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* 補足テキスト */}
          <p
            style={{
              fontSize: '11px',
              color: '#9ca3af',
              marginBottom: '10px',
            }}
          >
            トライアル期間中のアカウントIDは
            <span style={{ fontWeight: 600 }}>「99999」</span>
            です。
          </p>

          {/* ボタン */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '4px',
              width: '100%',
              borderRadius: '999px',
              border: 'none',
              padding: '10px 0',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              background:
                'linear-gradient(135deg, #0f172a, #1f2937)',
              color: '#f9fafb',
            }}
          >
            {loading
              ? '処理中...'
              : isLogin
              ? 'ログイン'
              : '新規登録してはじめる'}
          </button>
        </form>
      </div>
    </main>
  );
}
