import { Suspense } from 'react';
import ResetClient from './ResetClient';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中…</div>}>
      <ResetClient />
    </Suspense>
  );
}
