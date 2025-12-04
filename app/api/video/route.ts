// app/api/video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1動画あたりの原価（円）
const VIDEO_COST_YEN = 20;

// 今月の開始・終了を返すヘルパー
function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const start = new Date(year, month, 1).toISOString();   // 月初
  const end = new Date(year, month + 1, 1).toISOString(); // 翌月1日
  return { start, end };
}

export async function POST(req: NextRequest) {
  try {
    const { userId, prompt, filePath } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'filePath required' }, { status: 400 });
    }

    // 1) プロファイル取得（契約種別を確認）
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan_status, plan_tier')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('profile error:', profileErr);
      return NextResponse.json(
        { error: 'profile_error', message: 'プロフィールの取得に失敗しました。' },
        { status: 500 }
      );
    }

    const planStatus = profile?.plan_status ?? null; // 'trial' | 'paid' | null
    const planTier = profile?.plan_tier ?? null;     // 'starter' | 'pro' | null

    // 2) プランごとの上限回数を決定
    let maxVideoCount: number | null = null; // null = そもそも利用不可

    if (planStatus === 'trial') {
      // トライアル → 動画は月5回まで
      maxVideoCount = 5;
    } else if (planStatus === 'paid' && planTier === 'pro') {
      // Proプラン → 月30回まで
      maxVideoCount = 30;
    } else {
      //
