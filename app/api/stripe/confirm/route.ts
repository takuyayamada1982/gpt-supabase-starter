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

    if (isLiveKey && session.livemode !== true) {
      return NextResponse.json(
        { ok: false, error: 'Stripe session is not live mode' },
        { status: 400 }
      );
    }
    if (!isLiveKey && session.livemode !== false) {
      return NextResponse.json(
        { ok: false, error: 'Stripe session is not test mode' },
        { status: 400 }
      );
    }

    const { userId, email } = await resolveUserIdAndEmail(session);

    // ★ ここで「どのアドレスに送る予定か」をログ出力
    console.log('📨 will send account ID email to:', email);

    const lineItemPrice =
      session.line_items?.data[0]?.price as Stripe.Price | undefined;

    const priceId =
      lineItemPrice?.id ??
      (session.metadata?.price_id as string | undefined);

    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: 'price_id missing' },
        { status: 400 }
      );
    }

    const { tier } = getPlanFromPriceId(priceId);

    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + 1);

    const accountId = await ensureAccountIdForUser(userId);

    await updateUserPlan(userId, tier, validUntil.toISOString());

    // 🔹 メール送信の成否も返す
    let emailSent = false;
    let emailError: string | null = null;
    try {
      // ★ 実際に送る直前もログ出力
      console.log('📩 call sendAccountIdEmail:', { email, accountId });

      await sendAccountIdEmail(email, accountId);
      emailSent = true;
    } catch (e: any) {
      console.error('sendAccountIdEmail_error', e);
      emailError = e?.message ?? 'unknown email error';
    }

    return NextResponse.json({
      ok: true,
      planTier: tier,
      accountId,
      validUntil: validUntil.toISOString(),
      emailSent,
      emailError,
    });
  } catch (e: any) {
    console.error('stripe_confirm_error', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
