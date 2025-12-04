// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css'; // ★ これが必須（Tailwind＋全体のCSSを読み込む）

export const metadata: Metadata = {
  title: 'Auto post studio',
  description:
    'URL要約・画像説明生成・チャット補助で、SNS投稿を効率化するサポートツール。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      {/* 全ページ共通の背景などをここで定義してOK */}
      <body className="min-h-screen bg-[#fff8f2]">
        {children}
      </body>
    </html>
  );
}
