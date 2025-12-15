import { Suspense } from 'react';
import AuthClient from './AuthClient';

export default function Page() {
  // UIを変えないため fallback は null
  return (
    <Suspense fallback={null}>
      <AuthClient />
    </Suspense>
  );
}
