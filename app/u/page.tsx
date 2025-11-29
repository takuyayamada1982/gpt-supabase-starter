'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ServiceHomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/auth');
        return;
      }
      setCheckingAuth(false);
    };

    checkSession();
  }, [router]);

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
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
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
              Auto post studio サービス画面
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
              }}
            >
              URL要約・画像説明生成・チャット補助などの機能をここから利用できます。
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth');
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </header>

        {/* ここに実際のサービスUI（URL/画像/Chatフォームなど）を後で追加 */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '20px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            サービス機能
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '8px',
            }}
          >
            ここに URL要約・画像説明生成・チャット補助のフォームや結果表示を配置します。
          </p>
        </section>

        {/* マイページへの動線 */}
        <section>
          <button
            onClick={() => router.push('/u/stats')}
            style={{
              padding: '10px 18px',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: '#111827',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            マイページ（利用状況）を見る
          </button>
        </section>
      </div>
    </main>
  );
}
