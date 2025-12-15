'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

// ✅ useSearchParams を使うのはこの中だけ（Suspense配下に置く）
function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      // 既存仕様：localStorage に一時保存
      localStorage.setItem('referral_code', ref);
    }
  }, [searchParams]);

  return null; // UIは変えない
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
          .eq('email', user.email)       // ★ email で紐付け
          .eq('account_id', accountId)   // ★ 入力されたアカウントID
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
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(
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
      {/* ✅ UIは変えず、ref取得だけ仕込む（Suspense要件対応） */}
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
