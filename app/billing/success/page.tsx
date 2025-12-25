// app/billing/success/page.tsx
import BillingSuccessClient from './BillingSuccessClient';

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function BillingSuccessPage({ searchParams }: PageProps) {
  const raw = searchParams?.session_id;
  const sessionId = Array.isArray(raw) ? raw[0] : raw ?? null;

  return <BillingSuccessClient sessionId={sessionId} />;
}
