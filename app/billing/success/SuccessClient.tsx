'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState('決済を確認しています…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session_id = searchParams.get('session_id');

    // session_id が無い場合でも画面は落とさない
    if (!session_id) {
      setMessage('決済完了を確認しました。マイページへ戻ります。');
      setTimeout(() => router.push('/mypage'), 1200);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch('/api/stripe/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id }),
        });

        const json = await res.json().catch(() => ({} as any));
        if (!res.ok || json.error) {
          throw new Error(json.message || json.error || '決済確認に失敗しました。');
        }

        setMessage(json.message || '決済を確認しました。マイページへ戻ります。');
        setTimeout(() => router.push('/mypage'), 1200);
      } catch (e: any) {
        setError(e?.message ?? 'エラーが発生しました。');
      }
    };

    run();
  }, [router, searchParams]);

  return (
    <main style={{ minHeight: '100vh', padding: 16, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>お支払い完了</h1>

        {!error ? (
          <p style={{ fontSize: 14, color: '#374151' }}>{message}</p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>
            <button
              onClick={() => router.push('/mypage')}
              style={{
                marginTop: 12,
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              マイページへ戻る
            </button>
          </>
        )}
      </div>
    </main>
  );
}
