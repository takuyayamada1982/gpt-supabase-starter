// app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#f5f5f5',
      }}
    >
      <section
        style={{
          backgroundColor: '#ffffff',
          padding: '32px 28px',
          borderRadius: '16px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
          maxWidth: '640px',
          width: '90%',
        }}
      >
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            marginBottom: '8px',
          }}
        >
          Auto post studio
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '24px',
          }}
        >
          URL要約・画像説明生成・Chat補助をまとめてこなす、
          SNS投稿サポートツールです。
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <p style={{ fontSize: '14px', color: '#333' }}>
            ログイン済みの方は「マイページへ」、<br />
            まだの方は「ログイン / 新規登録」から進んでください。
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          {/* マイページ（ダッシュボード）へのリンク。パスは実際のURLに合わせて変更 */}
          <Link
            href="/u"
            style={{
              padding: '10px 18px',
              borderRadius: '999px',
              backgroundColor: '#111827',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            マイページへ
          </Link>

          {/* 認証ページへのリンク。/auth や /login など実際のパスに合わせて変更 */}
          <Link
            href="/auth"
            style={{
              padding: '10px 18px',
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: '#111827',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            ログイン / 新規登録
          </Link>
        </div>

        <p style={{ fontSize: '11px', color: '#9ca3af' }}>
          ※ ここではリダイレクトは行わず、リンクでのみ遷移します。
          <br />
          （無限リダイレクト対策のため）
        </p>
      </section>
    </main>
  );
}
