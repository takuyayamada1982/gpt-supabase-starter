// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * トライアルが有効かどうか判定するヘルパー
 * 有効: true / 期限切れ: false
 */
function isTrialActive(profile: any): boolean {
  if (!profile?.registered_at) return false;

  const registered = new Date(profile.registered_at);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - registered.getTime()) / (1000 * 60 * 60 * 24)
  );

  const trialDays =
    profile?.trial_type === 'referral'
      ? 30 // 紹介トライアル
      : 7;  // 通常トライアル

  return diffDays < trialDays;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, userText } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!userText) {
      return NextResponse.json(
        { error: 'userText_required', message: 'テキストが空です。' },
        { status: 400 }
      );
    }

    // ① プロファイル取得（プラン & トライアル情報）
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan_status, trial_type, registered_at')
      .eq('id', userId) // Auth の UUID = profiles.id
      .maybeSingle();

    if (profileErr) {
      console.error('profile error (chat):', profileErr);
      return NextResponse.json(
        {
          error: 'profile_error',
          message: 'プロフィールの取得に失敗しました。',
        },
        { status: 500 }
      );
    }

    const planStatus = profile?.plan_status as 'trial' | 'paid' | null | undefined;

    // ② トライアル終了 & 未課金ならロック
    // plan_status !== 'paid' かつ Trial が有効でない場合 → ロック
    if (planStatus !== 'paid' && !isTrialActive(profile)) {
      return NextResponse.json(
        {
          error: 'TRIAL_EXPIRED',
          message:
            '無料トライアルは終了しました。マイページからプランをご購入ください。',
        },
        { status: 403 }
      );
    }

    // ③ OpenAI で回答生成
    const instructions =
      'あなたはSNS運用アシスタントです。与えられた文章の要約、SNS向けリライト、投稿案作成などを日本語で手伝います。';

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input: [
        {
          role: 'user',
          content: userText,
        },
      ],
      max_output_tokens: 1000,
      temperature: 0.7,
    });

    // ④ usage ログ（type = 'chat'）
    const usage: any = (ai as any).usage;
    if (usage) {
      const totalTokens = usage.total_tokens ?? 0;
      const cost = totalTokens * 0.003; // 0.3円/回 相当（仮）

      try {
        await supabase.from('usage_logs').insert({
          user_id: userId,
          model: (ai as any).model ?? 'gpt-4.1-mini',
          type: 'chat', // ★ここ重要：チャット利用
          prompt_tokens: usage.prompt_tokens ?? 0,
          completion_tokens: usage.completion_tokens ?? 0,
          total_tokens: totalTokens,
          cost,
        });
      } catch (logErr) {
        console.error('usage_logs insert (chat) error:', logErr);
        // ログ失敗は致命的ではないので続行
      }
    }

    const text = (ai as any).output_text ?? '';

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('API /api/chat error', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? '予期せぬエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
