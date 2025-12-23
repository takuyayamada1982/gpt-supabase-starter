// app/auth/reset/page.tsx
import { Suspense } from 'react';
import ResetClient from './ResetClient';

export default function ResetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
      <ResetClient />
    </Suspense>
  );
}
