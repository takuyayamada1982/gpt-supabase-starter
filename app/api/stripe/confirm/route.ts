import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // ✅ body / query どちらからでも session_id を受け取る
    const sessionId =
      body.session_id ||
      new URL(req.url).searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Stripe セッション取得
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const userId = session.metadata?.user_id;
    const plan = session.metadata?.plan;

    if (!userId || !plan) {
      return NextResponse.json(
        { error: 'metadata missing' },
        { status: 400 }
      );
    }

    // Supabase 更新
    const { error } = await supabase
      .from('profiles')
      .update({
        plan,
        plan_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '決済を確認しました',
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
