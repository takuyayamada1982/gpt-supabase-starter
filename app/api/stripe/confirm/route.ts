// app/api/stripe/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { session_id?: string };
    const session_id = body.session_id;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // 1) セッション取得
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return NextResponse.json({ error: 'No such checkout.session' }, { status: 404 });
    }

    // 2) 支払い確認
    // Payment Link(Checkout)は paid / complete を見るのが安全
    const paid =
      session.payment_status === 'paid' ||
      (session.status === 'complete' && session.payment_status !== 'unpaid');

    if (!paid) {
      return NextResponse.json(
        { error: 'payment_not_completed', detail: { status: session.status, payment_status: session.payment_status } },
        { status: 400 }
      );
    }

    // 3) 購入者email（Payment Linkは customer_details.email が基本）
    const email = session.customer_details?.email || session.customer_email;
    if (!email) {
      return NextResponse.json({ error: 'customer email missing' }, { status: 400 });
    }

    // 4) line items から price を取得して Starter/Pro 判定
    const items = await stripe.checkout.sessions.listLineItems(session_id, { limit: 10 });
    const priceIds = (items.data ?? [])
      .map((li) => (typeof li.price === 'string' ? li.price : li.price?.id))
      .filter(Boolean) as string[];

    const starterPrice = process.env.STRIPE_PRICE_STARTER!;
    const proPrice = process.env.STRIPE_PRICE_PRO!;

    let plan_tier: 'starter' | 'pro' | null = null;
    if (priceIds.includes(proPrice)) plan_tier = 'pro';
    if (priceIds.includes(starterPrice)) plan_tier = plan_tier ?? 'starter';

    if (!plan_tier) {
      return NextResponse.json(
        { error: 'unknown_plan_price', detail: { priceIds, starterPrice, proPrice } },
        { status: 400 }
      );
    }

    // 5) 有効期限
    // Subscriptionなら subscription を辿って current_period_end を使うのが本来。
    // ただ Payment Link が「月額サブスク」なら subscription が入る可能性があるが、
    // まずは “30日” で更新（必要なら後で subscription 対応にする）
    const plan_valid_until = addDays(new Date(), 30);

    // 6) Supabase更新（email一致のプロフィール）
    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({
        plan_status: 'paid',
        plan_tier,
        is_canceled: false,
        plan_valid_until,
      })
      .eq('email', email)
      .select('id,email,plan_status,plan_tier,plan_valid_until,is_canceled')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'supabase_update_failed', detail: error }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'profile_not_found_by_email', detail: { email } }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: 'plan updated',
      profile: updated,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: 'unexpected_error', message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
