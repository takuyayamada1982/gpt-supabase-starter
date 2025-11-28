'use client';

export default function AdminTestPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020617',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontSize: '24px',
        fontWeight: 'bold',
      }}
    >
      <div>これはテスト用の ADMIN-TEST ページです</div>
      <div style={{ fontSize: '14px', opacity: 0.7 }}>
        /admin-test を開いていれば、この画面が見えるはずです
      </div>
    </div>
  );
}
