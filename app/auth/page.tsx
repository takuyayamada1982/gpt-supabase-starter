import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}

// ↓↓↓ ここから下が Client 側
function AuthInner() {
  'use client';

  // ここに「今までの /auth/page.tsx の中身」を “そのまま” 置く
  // 例：
  // import はファイル先頭に残してOK（Nextは module scope）
  // const searchParams = useSearchParams();
  // ... UI/文言/デザインは一切変えない

  return (
    <>
      {/* 既存のJSXをそのまま */}
    </>
  );
}
