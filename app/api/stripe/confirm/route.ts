// app/api/stripe/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  ensureAccountIdForUser,
  getUserEmailById,
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

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id missing' },
        { status: 400 }
      );
    }

    // Stripe Checkout Session を取得
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price'],
    });

    // prod / preview 混在防止（livemodeチェック）
    const isProd = process.env.VERCEL_ENV === 'production';
    if (isProd && session.livemode !== true) {
      return NextResponse.json(
        { error: 'Stripe session is not live mode' },
        { status: 400 }
      );
    }
    if (!isProd && session.livemode !== false) {
      return NextResponse.json(
        { error: 'Stripe session is not test mode' },
        { status: 400 }
      );
    }

    // ユーザーID（metadata に入れている前提）
    const userId = session.metadata?.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'userId missing from metadata' },
        { status: 400 }
      );
    }

    // price_id を取得（line_items から or metadata から）
    const lineItemPrice =
      session.line_items?.data[0]?.price as Stripe.Price | undefined;

    const priceId =
      lineItemPrice?.id ??
      (session.metadata?.price_id as string | undefined);

    if (!priceId) {
      return NextResponse.json(
        { error: 'price_id missing' },
        { status: 400 }
      );
    }

    const { tier } = getPlanFromPriceId(priceId);

    // 有効期限（例：1カ月後）
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + 1);

    // 1) 必要なら 5桁アカウントIDを採番して profiles に保存
    const accountId = await ensureAccountIdForUser(userId);

    // 2) プラン情報を更新
    await updateUserPlan(
      userId,
      tier,
      validUntil.toISOString()
    );

    // 3) ユーザーにメールでアカウントIDを送信
    try {
      const email = await getUserEmailById(userId);
      await sendAccountIdEmail(email, accountId);
    } catch (mailError) {
      console.error('sendAccountIdEmail_error', mailError);
      // メール失敗しても課金は成功扱いにする想定なら、ここは握りつぶし
    }

    // フロント（billing/success）で使う
    return NextResponse.json({
      ok: true,
      planTier: tier,
      accountId,
      validUntil: validUntil.toISOString(),
    });
  } catch (e: any) {
    console.error('stripe_confirm_error', e);
    return NextResponse.json(
      { error: e?.message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
