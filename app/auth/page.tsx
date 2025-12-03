'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'login' | 'register';

// 6文字の紹介コードを自動生成
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8);
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [refCode, setRefCode] = useState<string | null>(null);

  const isLogin = mode === 'login';

  // URL から ?ref= を取得
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    const r = search.get('ref');
    if (r) setRefCode(r);
  }, []);

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

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .eq('account_id', accountId)
          .maybeSingle();

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
          setErrorMsg('新規登録に失敗しました。すでに登録済みの可能性があります。');
          return;
        }

        const user = data.user;

        const trialType = refCode ? 'referral' : 'normal'; 
        const accountIdForTrial = '99999';
        const myReferralCode = generateReferralCode();

        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          account_id: accountIdForTrial,
          trial_type: trialType,
          referred_by_code: refCode,
          referral_code: myReferralCode,
          registered_at: new Date().toISOString(),
          plan_status: 'trial',
        });

        // Welcomeメール
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
        } catch {}

        router.push('/u');
      }
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // UI（以前の美しいデザインに復元）
  // -----------------------
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
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
          padding: '32px 26px 32px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            marginBottom: '6px',
            color: '#111827',
          }}
        >
          Auto Post Studio
        </h1>

        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
          SNS投稿をもっとシンプルに。  
          {isLogin ? 'ログインして続けてください。' : '新規登録を進めてください。'}
        </p>
