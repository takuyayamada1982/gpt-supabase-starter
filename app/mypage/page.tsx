'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email: string | null;
  plan_valid_until: string | null;
  is_canceled: boolean | null;
};

export default function MyPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ログイン＆プロフィール取得
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
        .select('id,email,plan_valid_until,is_canceled')
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

  // 残日数計算
  const remainingDays = useMemo(() => {
    if (!profile?.plan_valid_until) return null;
    const now = new Date();
    const end = new Date(profile.plan_valid_until);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [profile]);

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

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        ログイン状態を確認中…
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '16px',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#f3f4f6',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '4px',
              }}
            >
              マイページ
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
              }}
            >
              ご契約状況と解約手続きができます。
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

        {/* 契約情報 */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            契約状況
          </p>

          <p style={{ fontSize: '13px', marginBottom: '4px' }}>
            メールアドレス： {profile?.email ?? '-'}
          </p>

          <p style={{ fontSize: '13px', marginBottom: '4px' }}>
            契約終了日：
            {profile?.plan_valid_until
              ? profile.plan_valid_until
              : '未設定'}
          </p>

          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            解約状態：{profile?.is_canceled ? '解約手続き済み' : '利用中'}
          </p>

          {remainingDays !== null && (
            <p style={{ fontSize: '13px', marginBottom: '8px' }}>
              残り利用可能日数：
              <strong>
                {remainingDays > 0 ? `${remainingDays} 日` : '0 日（終了）'}
              </strong>
            </p>
          )}

          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '12px',
            }}
          >
            解約後も、契約終了日まではサービスを利用できます。
            契約終了日を過ぎるとログインができなくなります。
          </p>

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
              cursor:
                loading || profile?.is_canceled ? 'not-allowed' : 'pointer',
            }}
          >
            {profile?.is_canceled ? '解約済み' : '解約手続きをする'}
          </button>

          {message && (
            <p
              style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#15803d',
              }}
            >
              {message}
            </p>
          )}
          {error && (
            <p
              style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#b91c1c',
              }}
            >
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
