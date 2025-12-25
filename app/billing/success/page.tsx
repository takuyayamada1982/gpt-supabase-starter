'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('決済情報が見つかりませんでした。');
      setLoading(false);
      return;
    }

    const confirmPayment = async () => {
      try {
        const res = await fetch('/api/stripe/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error ?? '決済の反映に失敗しました');
        } else {
          if (data.accountId) setAccountId(data.accountId);
          if (data.planTier) setPlanTier(data.planTier);
          if (data.validUntil) setValidUntil(data.validUntil);
        }
      } catch (e: any) {
        setError(e?.message ?? 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    void confirmPayment();
  }, [sessionId]);

  if (loading) {
    return <div className="p-6">決済を反映しています…</div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          className="underline"
          onClick={() => router.push('/u')}
        >
          マイページに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">
        ご契約ありがとうございます！
      </h1>

      {planTier && (
        <p>
          現在のプラン：<span className="font-semibold">{planTier}</span>
        </p>
      )}

      {validUntil && (
        <p className="text-sm text-gray-600">
          プラン有効期限：{new Date(validUntil).toLocaleString()}
        </p>
      )}

      {accountId && (
        <div className="border rounded-lg p-4 bg-white/60">
          <p className="font-semibold mb-2">
            あなたの正式なアカウントID
          </p>
          <p className="text-2xl font-mono tracking-[0.3em] mb-2">
            {accountId}
          </p>
          <p className="text-sm text-gray-600">
            ログイン時に必要になりますので、
            メモを取るかスクリーンショットで保存しておいてください。
            同じ内容をメールでもお送りしています。
          </p>
        </div>
      )}

      <button
        className="mt-4 inline-flex items-center gap-2 underline"
        onClick={() => router.push('/u')}
      >
        マイページへ進む
      </button>
    </div>
  );
}
