// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { checkPlanGuardByUserId } from '../_shared/planGuard'; // ★追加

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, userText } = await req.json();

    // 1) userId 必須チェック
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 2) プランガード（URL と同じロジック）
    const guard = await checkPlanGuardByUserId(userId);

    if (!guard.allowed) {
      if (guard.reason === 'trial_expired') {
        return NextResponse.json(
          {
            error: 'TRIAL_EXPIRED',
            message:
              '無料トライアルは終了しました。マイページからプランをご購入ください。',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: guard.reason ?? 'forbidden',
          message: '利用権限がありません。',
        },
        { status: 403 }
      );
    }

    // 3) テキスト必須チェック
    if (!userText) {
      return NextResponse.json(
        { error: 'userText required' },
        { status: 400 }
      );
    }

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

    // usage ログ（type = 'chat'）
    const usage: any = (ai as any).usage;
    if (usage) {
      const totalTokens = usage.total_tokens ?? 0;
      const cost = totalTokens * 0.003; // 0.3円/回 相当

      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: (ai as any).model ?? 'gpt-4.1-mini',
        type: 'chat', // ★ここ重要
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: totalTokens,
        cost, // ★ここも重要
      });
    }

    const text = (ai as any).output_text ?? '';

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
