import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is missing');
if (!appBaseUrl) throw new Error('NEXT_PUBLIC_APP_BASE_URL is missing');

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { priceId?: string; userId?: string };
    const priceId = body.priceId;

    if (!priceId) {
      return NextResponse.json({ error: 'priceId is required' }, { status: 400 });
    }

    // ✅ Checkout Session をサーバで作る（ここで success_url に session_id を仕込める）
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/mypage`,
      // customer_email を入れたい場合はここで入れる（要件次第）
      // customer_email: ...
      metadata: body.userId ? { user_id: body.userId } : undefined,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
