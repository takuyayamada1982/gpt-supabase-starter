import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Body = { sessionId?: string; userId?: string };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const sessionId = body.sessionId;
    const userId = body.userId;

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY is missing' }, { status: 500 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const starterPriceId = process.env.STRIPE_PRICE_STARTER ?? '';
    const proPriceId = process.env.STRIPE_PRICE_PRO ?? '';
    if (!starterPriceId || !proPriceId) {
      return NextResponse.json(
        { error: 'price_id_missing', message: 'STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO が未設定です。' },
        { status: 500 }
      );
    }

    // ✅ Checkout Session を取得（line_items を展開）
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price'],
    });

    // ✅ 支払い完了チェック
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error: 'not_paid',
          message: `支払い未完了です（payment_status=${session.payment_status}）`,
        },
        { status: 400 }
      );
    }

    // ✅ どのプランを買ったか判定
    const items = session.line_items?.data ?? [];
    const boughtStarter = items.some((li) => li.price?.id === starterPriceId);
    const boughtPro = items.some((li) => li.price?.id === proPriceId);

    let plan_tier: 'starter' | 'pro' | null = null;
    if (boughtPro) plan_tier = 'pro';
    else if (boughtStarter) plan_tier = 'starter';

    if (!plan_tier) {
      return NextResponse.json(
        {
          error: 'unknown_plan',
          message: '購入プランを判定できませんでした。Price ID を確認してください。',
          debug: items.map((li) => ({ priceId: li.price?.id, qty: li.quantity })),
        },
        { status: 400 }
      );
    }

    // ✅ Supabase（サーバー側）で profiles を更新
    // ※ 期限は仮で30日。必要ならここをあなたのロジックに合わせて変更します。
    const updates = {
      plan_status: 'paid' as const,
      plan_tier,
      is_canceled: false,
      trial_type: null,
      plan_valid_until: addDaysISO(30),
    };

    const sb = supabaseAdmin();

    const { data: updated, error: upErr } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(
        'id,email,registered_at,plan_status,plan_tier,plan_valid_until,is_canceled,trial_type,referral_code,referred_by_code'
      )
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message || upErr }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'profile_not_found', message: 'profiles に該当ユーザーが見つかりません。', userId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `購入を反映しました（${plan_tier.toUpperCase()}）`,
      profile: updated,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
