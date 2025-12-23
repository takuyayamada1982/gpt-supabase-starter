import { Suspense } from 'react';
import ResetClient from './ResetClient';

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="p-6">読み込み中...</div>}>
      <ResetClient />
    </Suspense>
  );
}
