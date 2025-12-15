'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email: string | null;
  registered_at: string | null;
  plan_status: 'trial' | 'paid' | null;
  plan_tier: 'starter' | 'pro' | null;
  plan_valid_until: string | null;
  is_canceled: boolean | null;
  trial_type: 'normal' | 'referral' | null;
  referral_code: string | null;
  referred_by_code: string | null;
};

// ※あなたの環境に合わせてOK（今のままでも動く）
// /auth 側が ref を受け取るので、ここも /auth に合わせる
const REF_BASE_URL =
  process.env.NEXT_PUBLIC_APP_BASE_URL
    ? `${process.env.NEXT_PUBLIC_APP_BASE_URL}/auth`
    : 'https://gpt-supabase-starter.vercel.app/auth';

// JSON安全パース（Unexpected end of JSON input 対策）
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // HTML が返ってきた等
    return { error: 'invalid_json', raw: text.slice(0, 300) };
  }
}

export default function MyPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetMsg = () => {
    setMessage(null);
    setError(null);
  };

  // 認証 & プロフィール取得（id → email フォールバック）
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        router.push('/auth');
        return;
      }

      const user = authData.session.user;

      const cols = [
        'id',
        'email',
        'registered_at',
        'plan_status',
        'plan_tier',
        'plan_valid_until',
        'is_canceled',
        'trial_type',
        'referral_code',
        'referred_by_code',
      ].join(',');

      // まず id
      let { data, error } = await supabase
        .from('profiles')
        .select(cols)
        .eq('id', user.id)
        .maybeSingle();

      // 見つからない/エラーなら email
      if ((!data || error) && user.email) {
        const byEmail = await supabase
          .from('profiles')
          .select(cols)
          .eq('email', user.email)
          .maybeSingle();
        data = byEmail.data;
        error = byEmail.error;
      }

      if (error) {
        console.error('fetchProfile error:', error);
        setError('プロフィール情報の取得に失敗しました。');
        setProfile(null);
      } else {
        setProfile(data ? ((data as unknown) as Profile) : null);
      }

      setCheckingAuth(false);
    };

    fetchProfile();
  }, [router]);

  // 表示用：残り日数
  const remainingDays = useMemo(() => {
    if (!profile?.plan_valid_until) return null;
    const now = new Date();
    const end = new Date(profile.plan_valid_until);
    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [profile]);

  // 表示用：現在のプラン名
  const planLabel = useMemo(() => {
    if (!profile) return '未契約';
    if (profile.plan_status === 'trial') return 'トライアル';
    if (profile.plan_status === 'paid') {
      if (profile.plan_tier === 'starter') return 'Starter';
      if (profile.plan_tier === 'pro') return 'Pro';
      return '有料プラン';
    }
    return '未契約';
  }, [profile]);

  // 表示用：紹介URL
  const referralUrl = useMemo(() => {
    if (!profile?.referral_code) return '';
    return `${REF_BASE_URL}?ref=${encodeURIComponent(profile.referral_code)}`;
  }, [profile?.referral_code]);

  // 解約
  const handleCancel = async () => {
    if (!profile) return;
    const ok = window.confirm('本当に解約しますか？');
    if (!ok) return;

    resetMsg();
    setLoading(true);

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

  // プラン変更（既存のAPI前提。UI変更なし）
  type PlanAction =
    | 'trial_to_starter'
    | 'trial_to_pro'
    | 'starter_to_pro'
    | 'pro_to_starter';

  const callPlanAction = async (action: PlanAction) => {
    if (!profile) return;
    resetMsg();
    setPlanLoading(action);

    try {
      const res = await fetch('/api/plan/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const json = await safeJson(res);
      if (!res.ok || json.error) {
        throw new Error(json.message || json.error || 'プラン変更に失敗しました。');
      }

      const updated: Partial<Profile> = json.profile ?? {};
      setProfile((prev) => (prev ? ({ ...prev, ...updated } as Profile) : prev));
      setMessage(json.message || 'プランを変更しました。');
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? 'プラン変更中にエラーが発生しました。');
    } finally {
      setPlanLoading(null);
    }
  };

  // 紹介コード発行（既存 /api/referral/create-or-get を使う）
  const handleGenerateReferral = async () => {
    if (!profile) return;
    resetMsg();
    setRefLoading(true);

    try {
      const res = await fetch('/api/referral/create-or-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          userEmail: profile.email,
        }),
      });

      const json = await safeJson(res);

      if (!res.ok || json.error) {
        throw new Error(
          json.message || json.error || '紹介コードの生成に失敗しました。',
        );
      }

      const code = (json.code as string) || '';
      if (!code) throw new Error('紹介コードが取得できませんでした。');

      setProfile({ ...profile, referral_code: code });
      setMessage('紹介コードを発行しました。');
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? '紹介コードの生成中にエラーが発生しました。');
    } finally {
      setRefLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
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
        padding: 16,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#f3f4f6',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* ヘッダー */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              マイページ
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              ご契約状況とプラン変更・紹介コードの確認ができます。
            </p>
          </div>

          <button
            onClick={() => router.push('/u')}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            サービスページに戻る
          </button>
        </header>

        {/* 契約状況 */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            契約状況
          </p>

          <p style={{ fontSize: 13, marginBottom: 4 }}>
            メールアドレス： {profile?.email ?? '-'}
          </p>
          <p style={{ fontSize: 13, marginBottom: 4 }}>
            現在のプラン： {planLabel}
          </p>
          <p style={{ fontSize: 13, marginBottom: 4 }}>
            契約終了日：{profile?.plan_valid_until ?? '未設定'}
          </p>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            解約状態：{profile?.is_canceled ? '解約手続き済み' : '利用中'}
          </p>

          {remainingDays !== null && (
            <p style={{ fontSize: 13, marginBottom: 8 }}>
              残り利用可能日数：
              <strong>
                {remainingDays > 0 ? `${remainingDays} 日` : '0 日（終了）'}
              </strong>
            </p>
          )}

          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            解約後も、契約終了日まではサービスを利用できます。契約終了日を過ぎるとログインができなくなります。
          </p>

          <button
            onClick={handleCancel}
            disabled={loading || !!profile?.is_canceled}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              backgroundColor: profile?.is_canceled ? '#9ca3af' : '#b91c1c',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || profile?.is_canceled ? 'not-allowed' : 'pointer',
            }}
          >
            {profile?.is_canceled ? '解約済み' : '解約手続きをする'}
          </button>
        </section>

        {/* プラン変更 */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            プラン変更
          </p>

          <div style={{ display: 'grid', gap: 8 }}>
            <button
              onClick={() => callPlanAction('trial_to_starter')}
              disabled={!!planLoading}
              style={planButtonStyle(planLoading === 'trial_to_starter')}
            >
              トライアル → Starter へ契約
            </button>

            <button
              onClick={() => callPlanAction('trial_to_pro')}
              disabled={!!planLoading}
              style={planButtonStyle(planLoading === 'trial_to_pro')}
            >
              トライアル → Pro へ契約
            </button>

            <button
              onClick={() => callPlanAction('starter_to_pro')}
              disabled={!!planLoading}
              style={planButtonStyle(planLoading === 'starter_to_pro')}
            >
              Starter → Pro に変更
            </button>

            <button
              onClick={() => callPlanAction('pro_to_starter')}
              disabled={!!planLoading}
              style={planButtonStyle(planLoading === 'pro_to_starter')}
            >
              Pro → Starter に変更
            </button>
          </div>
        </section>

        {/* 紹介コード */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            紹介コード
          </p>

          {profile?.referral_code ? (
            <>
              <p style={{ fontSize: 13, marginBottom: 4 }}>
                あなたの紹介コード： <strong>{profile.referral_code}</strong>
              </p>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                紹介用URL：
                <br />
                <span style={{ wordBreak: 'break-all' }}>{referralUrl}</span>
              </p>
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              紹介コードはまだ発行されていません。下のボタンから生成できます。
            </p>
          )}

          <button
            onClick={handleGenerateReferral}
            disabled={refLoading}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: refLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {refLoading ? '生成中…' : '紹介コードを発行する'}
          </button>
        </section>

        {/* メッセージ */}
        {message && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#15803d' }}>
            {message}
          </p>
        )}
        {error && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#b91c1c' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function planButtonStyle(active: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    backgroundColor: active ? '#111827' : '#ffffff',
    color: active ? '#ffffff' : '#111827',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'center',
  };
}
