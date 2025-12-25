'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  sessionId: string | null;
};

export default function BillingSuccessClient({ sessionId }: Props) {
  const router = useRouter();

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
          setError(
            data.error ??
              '決済の反映に失敗しました。しばらくしてから再度お試しください。'
          );
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

  const handleGoMypage = () => {
    router.push('/u');
  };

  // 共通の背景＋センタリング
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-sky-100 via-white to-pink-100 px-4">
      <div className="w-full max-w-xl">
        <div className="bg-white/80 backdrop-blur-md shadow-2xl rounded-2xl p-8 space-y-6">
          {loading ? (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                決済を反映しています…
              </h1>
              <p className="text-sm text-slate-600">
                そのままお待ちください。数秒かかる場合があります。
              </p>
            </>
          ) : error ? (
            <>
              <h1 className="text-xl font-bold text-red-600 mb-2">
                決済の反映に失敗しました
              </h1>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {error}
              </p>
              <p className="text-xs text-slate-500">
                テスト決済の場合は、Stripe のモード（テスト/本番）と
                サイトの環境変数（APIキー）の組み合わせをご確認ください。
              </p>
              <div className="pt-4">
                <button
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  onClick={handleGoMypage}
                >
                  マイページに戻る
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                ご契約ありがとうございます！
              </h1>

              {planTier && (
                <p className="text-sm text-slate-700">
                  現在のプラン：
                  <span className="font-semibold uppercase">
                    {planTier}
                  </span>
                </p>
              )}

              {validUntil && (
                <p className="text-xs text-slate-500">
                  プラン有効期限：
                  {new Date(validUntil).toLocaleString()}
                </p>
              )}

              {accountId && (
                <div className="mt-4 border rounded-xl p-4 bg-slate-50">
                  <p className="font-semibold mb-2 text-slate-800">
                    あなたの正式なアカウントID
                  </p>
                  <p className="text-2xl font-mono tracking-[0.3em] mb-2">
                    {accountId}
                  </p>
                  <p className="text-xs text-slate-500">
                    ログイン時に必要になります。必ずメモを取るかスクリーンショットで保存しておいてください。
                    メールではお送りしておりません。
                  </p>
                </div>
              )}

              <div className="pt-4">
                <button
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={handleGoMypage}
                >
                  マイページへ進む
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
