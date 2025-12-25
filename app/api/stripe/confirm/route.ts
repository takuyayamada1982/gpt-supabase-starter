// app/api/stripe/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  ensureAccountIdForUser,
  getUserEmailById,
  getUserIdByEmail,
  updateUserPlan,
} from '@/lib/account';
import { sendAccountIdEmail } from '@/lib/mail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const PRICE_STARTER = process.env.STRIPE_PRICE_STARTER!;
const PRICE_PRO = process.env.STRIPE_PRICE_PRO!;

function getPlanFromPriceId(priceId: string) {
  if (priceId === PRICE_STARTER) {
    return { tier: 'starter' as const };
  }
  if (priceId === PRICE_PRO) {
    return { tier: 'pro' as const };
  }
  throw new Error(`unknown_plan_price: ${priceId}`);
}

async function resolveUserIdAndEmail(
  session: Stripe.Checkout.Session
): Promise<{ userId: string; email: string }> {
  const metaUserId = session.metadata?.userId as string | undefined;
  const sessionEmail =
    session.customer_details?.email ?? session.customer_email ?? undefined;

  if (metaUserId) {
    const email = await getUserEmailById(metaUserId);
    return { userId: metaUserId, email };
  }

  if (sessionEmail) {
    const userId = await getUserIdByEmail(sessionEmail);
    return { userId, email: sessionEmail };
  }

  throw new Error('cannot_resolve_user: neither metadata.userId nor email');
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'session_id missing' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price'],
    });

    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const isLiveKey = secretKey.startsWith('sk_live_');

    if (isLiveKey && session.
