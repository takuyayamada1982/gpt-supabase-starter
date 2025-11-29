// app/layout.tsx
import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}
