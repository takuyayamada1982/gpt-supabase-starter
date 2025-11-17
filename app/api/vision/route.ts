// app/api/vision/route.ts
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

export async function POST(req: NextRequest) {
  try {
    const { userId, prompt, imageUrl } = await req.json();

    // 認証チェック
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // imageUrl は必須 & string URL 前提
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'imageUrl (string URL) required' },
        { status: 400 }
      );
    }

    const instructions =
      'あなたは画像付きSNS投稿のアシスタントです。画像の内容を理解し、日本語で要約やSNS向けの投稿案を提案します。';

    // 👇 型で怒られないように、input を一旦 any にする
    const input: any = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              prompt ||
              'この画像の内容を説明し、SNS向けの投稿案を日本語で提案してください。',
          },
          {
            type: 'input_image',
            image_url: imageUrl, // 文字列 URL
            detail: 'auto',      // SDK 型で必須になっている
          },
        ],
      },
    ];

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input, // ← any なのでオーバーロードエラーが出ない
      max_output_tokens: 1000,
      temperature: 0.7,
    });

    // usage ログ（type = 'vision'）
    const usage: any = (ai as any).usage;
    if (usage) {
      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: (ai as any).model ?? 'gpt-4.1-mini',
        type: 'vision',
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0,
      });
    }

    const text = (ai as any).output_text ?? '';

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
