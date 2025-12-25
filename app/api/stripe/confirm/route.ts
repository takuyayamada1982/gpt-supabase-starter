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

// price_id → プラン種別
function getPlanFromPriceId(priceId: string) {
  if (priceId === PRICE_STARTER) {
    return { tier: 'starter' as const };
  }
  if (priceId === PRICE_PRO) {
    return { tier: 'pro' as const };
  }
  throw new Error(`unknown_plan_price: ${priceId}`);
}

// Checkout Session から userId と email を特定する
// 1) metadata.userId があればそれを優先
// 2) 無い場合は Stripe の customer email から profiles を検索
async function resolveUserIdAndEmail(
  session: Stripe.Checkout.Session
): Promise<{
  userId: string;
  email: string;
}> {
  const metaUserId = session.metadata?.userId as string | undefined;
  const sessionEmail =
    session.customer_details?.email ?? session.customer_email ?? undefined;

  // ① API で Checkout Session を作っているパターン
  if (metaUserId) {
    const email = await getUserEmailById(metaUserId);
    return { userId: metaUserId, email };
  }

  // ② Payment Link パターン（metadata.userId が無い）
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
        { error: 'session_id missing' },
        { status: 400 }
      );
    }

    // Stripe Checkout Session を取得
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price'],
    });

    // ✅ ここを修正：VERCEL_ENV ではなく Stripeキーの種類で判定
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const isLiveKey = secretKey.startsWith('sk_live_');

    if (isLiveKey && session.livemode !== true) {
      // liveキーなのに testセッションを読もうとしている
      return NextResponse.json(
        { error: 'Stripe session is not live mode' },
        { status: 400 }
      );
    }
    if (!isLiveKey && session.livemode !== false) {
      // testキーなのに liveセッションを読もうとしている
      return NextResponse.json(
        { error: 'Stripe session is not test mode' },
        { status: 400 }
      );
    }

    // 決済したユーザーを特定（trial でも本会員でもここで1ユーザーに絞る）
    const { userId, email } = await resolveUserIdAndEmail(session);

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

    // 1) 必要なら 5桁アカウントIDを採番（trial の 99999 → 正式ID）
    const accountId = await ensureAccountIdForUser(userId);

    // 2) プラン情報を更新（trial → starter/pro もここで一括反映）
    await updateUserPlan(userId, tier, validUntil.toISOString());

    // 3) ユーザーにメールでアカウントIDを送信
    try {
      await sendAccountIdEmail(email, accountId);
    } catch (mailError) {
      console.error('sendAccountIdEmail_error', mailError);
      // メール失敗しても課金は成功扱いにするならここは握りつぶし
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
