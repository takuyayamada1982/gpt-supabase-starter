// app/layout.tsx
export const metadata = { title: 'Auto post studio' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* 共通ヘッダーをなくして、各ページ側で好きにレイアウト */}
        {children}
      </body>
    </html>
  );
}
