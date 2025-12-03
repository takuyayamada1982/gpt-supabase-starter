'use client';

export default function AuthPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}
    >
      <div
        style={{
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Auth test
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          これはビルドテスト用のシンプルな画面です。
        </p>
      </div>
    </main>
  );
}
