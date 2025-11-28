// app/layout.tsx
export const metadata = { title: "GPT + Supabase Starter" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-4xl mx-auto p-4">
          <header className="py-4 border-b mb-6">
            <h1 className="text-xl font-semibold">Auto post studio</h1>
            <nav className="text-sm mt-2 space-x-3">
              <a href="/login">/login</a>
              <a href="/u">/u</a>
              <a href="/admin">/admin</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
