'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function BillingSuccessPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const sessionId = sp.get('session_id');

  const [status, setStatus] = useState<'checking' | 'ok' | 'ng'>('checking');
  const [message, setMessage] = useState('購入内容を反映しています…');

  useEffect(() => {
    const run = async () => {
      // ✅ ログイン必須（ユーザー特定のため）
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        router.push('/auth');
        return;
      }

      if (!sessionId) {
        setStatus('ng');
        setMessage('session_id が見つかりませんでした。Stripeのリダイレクト設定を確認してください。');
        return;
      }

      try {
        const res = await fetch('/api/stripe/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, userId: user.id }),
        });

        const json = await res.json().catch(() => ({} as any));
        if (!res.ok || json.error) throw new Error(json.message || json.error || '購入反映に失敗しました。');

        setStatus('ok');
        setMessage(json.message || '購入を反映しました。マイページへ戻ります…');

        setTimeout(() => router.push('/mypage'), 1200);
      } catch (e: any) {
        setStatus('ng');
        setMessage(e?.message || '購入反映に失敗しました。');
      }
    };

    run();
  }, [sessionId, router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#f3f4f6',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: '#fff',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {status === 'checking' ? '決済完了' : status === 'ok' ? '反映完了' : '反映エラー'}
        </h1>

        <p style={{ fontSize: 13, color: status === 'ng' ? '#b91c1c' : '#374151' }}>{message}</p>

        {status === 'ng' && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.push('/mypage')}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              マイページへ
            </button>

            <button
              onClick={() => router.push('/auth')}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                border: 'none',
                background: '#111827',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              ログインへ
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
