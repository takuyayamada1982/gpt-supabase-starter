// app/auth/reset/page.tsx
import { Suspense } from 'react';
import ResetClient from './reset-client';

export default function ResetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <ResetClient />
    </Suspense>
  );
}
