'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ====================
// 型定義
// ====================
type Profile = {
  id: string;
  email: string | null;
  plan_valid_until: string | null;
  is_canceled: boolean | null;
  plan_status?: 'trial' | 'paid' | null;
  plan_tier?: 'starter' | 'pro' | null;
  referral_code?: string | null;
};

export default function MyPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ======================================================
  // 1. 認証チェック ＆ プロファイル取得
  // ======================================================
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        router.push('/auth');
        return;
      }

      const user = authData.session.user;

      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,plan_valid_until,is_canceled,plan_status,plan_tier,referral_code')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setError('プロフィール情報の取得に失敗しました。');
      } else {
        setProfile(data as Profile);
      }

      setCheckingAuth(false);
    };

    fetchProfile();
  }, [router]);

  // ======================================================
  // 2. 残日数計算
  // ======================================================
  const remainingDays = useMemo(() => {
    if (!profile?.plan_valid_until) return null;
    const now = new Date();
    const end = new Date(profile.plan_valid_until);
    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [profile]);

  // ======================================================
  // 3. 解約処理
  // ======================================================
  const handleCancel = async () => {
    if (!profile) return;

    const ok = window.confirm('本当に解約しますか？');
    if (!ok) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    const { error } = await supabase
      .from('profiles')
      .update({ is_canceled: true })
      .eq('id', profile.id);

    if (error) {
      console.error(error);
      setError('解約処理に失敗しました。時間をおいて再度お試しください。');
    } else {
      setProfile({ ...profile, is_canceled: true });
      setMessage('解約手続きが完了しました。');
    }

    setLoading(false);
  };

  // ======================================================
  // 4. プラン変更処理（4種類）
  // ======================================================
  const handlePlanChange = async (mode: 'starter' | 'pro' | 'upgrade' | 'downgrade') => {
    if (!profile) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    let updates: any = {};

    if (mode === 'starter') {
      updates = {
        plan_status: 'paid',
        plan_tier: 'starter',
        is_canceled: false,
      };
    }

    if (mode === 'pro') {
      updates = {
        plan_status: 'paid',
        plan_tier: 'pro',
        is_canceled: false,
      };
    }

    if (mode === 'upgrade') {
      updates = { plan_tier: 'pro' };
    }

    if (mode === 'downgrade') {
      updates = { plan_tier: 'starter' };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    if (error) {
      setError('プラン変更に失敗しました。');
    } else {
      setMessage('プラン変更が完了しました！');
      setProfile({ ...profile, ...updates });
    }

    setLoading(false);
  };

  // ======================================================
  // 5. 紹介コード生成
  // ======================================================
  const generateReferralCode = async () => {
    if (!profile) return;

    const res = await fetch('/api/referral/generate', {
      method: 'POST',
      body: JSON.stringify({ userId: profile.id }),
    });

    const j = await res.json();

    if (j.error) {
      alert('紹介コードの生成に失敗しました');
      return;
    }

    setProfile({ ...profile, referral_code: j.code });
    alert('紹介コードを発行しました！');
  };

  // ======================================================
  // ローディング（認証チェック中）
  // ======================================================
  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        ログイン状態を確認中…
      </div>
    );
  }

  // ======================================================
  // UI
  // ======================================================
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '16px',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#f3f4f6',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        
        {/* --------------------
            ヘッダー
        -------------------- */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>
              マイページ
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>
              ご契約状況とプラン変更・紹介コードの確認ができます。
            </p>
          </div>

          <button
            onClick={() => router.push('/u')}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            サービスページに戻る
          </button>
        </header>

        {/* --------------------
            契約情報
        -------------------- */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            契約状況
          </p>

          <p style={{ fontSize: '13px', marginBottom: '4px' }}>
            メールアドレス： {profile?.email ?? '-'}
          </p>

          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            現在のプラン： {profile?.plan_status === 'paid' ? profile?.plan_tier : 'トライアル'}
          </p>

          <p style={{ fontSize: '13px', marginBottom: '4px' }}>
            契約終了日：
            {profile?.plan_valid_until ? profile.plan_valid_until : '未設定'}
          </p>

          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            解約状態：{profile?.is_canceled ? '解約手続き済み' : '利用中'}
          </p>

          {remainingDays !== null && (
            <p style={{ fontSize: '13px', marginBottom: '8px' }}>
              残り利用可能日数：
              <strong>{remainingDays > 0 ? `${remainingDays} 日` : '0 日（終了）'}</strong>
            </p>
          )}

          <button
            onClick={handleCancel}
            disabled={loading || !!profile?.is_canceled}
            style={{
              padding: '10px 18px',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: profile?.is_canceled ? '#9ca3af' : '#b91c1c',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading || profile?.is_canceled ? 'not-allowed' : 'pointer',
            }}
          >
            {profile?.is_canceled ? '解約済み' : '解約手続きをする'}
          </button>

          {message && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#15803d' }}>
              {message}
            </p>
          )}
          {error && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#b91c1c' }}>
              {error}
            </p>
          )}
        </section>

        {/* --------------------
            ▼ プラン変更
        -------------------- */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            プラン変更
          </h2>

          <div style={{ display: 'grid', gap: 8 }}>

            <button
              onClick={() => handlePlanChange('starter')}
              style={btnStyle}
            >
              トライアル → Starter へ契約
            </button>

            <button
              onClick={() => handlePlanChange('pro')}
              style={btnStyle}
            >
              トライアル → Pro へ契約
            </button>

            <button
              onClick={() => handlePlanChange('upgrade')}
              style={btnStyle}
            >
              Starter → Pro に変更
            </button>

            <button
              onClick={() => handlePlanChange('downgrade')}
              style={btnStyle}
            >
              Pro → Starter に変更
            </button>

          </div>
        </section>

        {/* --------------------
            ▼ 紹介コード
        -------------------- */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            紹介コード
          </h2>

          {profile?.referral_code ? (
            <div>
              <p style={{ fontSize: 13 }}>
                あなたの紹介コード： <strong>{profile.referral_code}</strong>
              </p>

              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                このURLを送ると、相手の無料期間が7日⇒14日になります。
              </p>

              <input
                readOnly
                value={`https://yourdomain.com/auth?r=${profile.referral_code}`}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginTop: 10,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              />

              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    `https://yourdomain.com/auth?r=${profile.referral_code}`
                  )
                }
                style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: '#111827',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                }}
              >
                URLをコピー
              </button>
            </div>
          ) : (
            <button
              onClick={generateReferralCode}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                fontSize: 14,
              }}
            >
              紹介コードを発行する
            </button>
          )}
        </section>
      </div>
    </main>
  );
}

// =======================
// 共通ボタンスタイル
// =======================
const btnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#f9fafb',
  fontSize: 14,
  cursor: 'pointer',
};
