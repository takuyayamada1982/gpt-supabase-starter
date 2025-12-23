import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <SuccessClient />
    </Suspense>
  );
}
