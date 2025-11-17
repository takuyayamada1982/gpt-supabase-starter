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
    const { userId, filePath, prompt } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath required' },
        { status: 400 }
      );
    }

    // Supabase Storage の署名付きURLを発行
    const { data: signed, error } = await supabase.storage
      .from('uploads')
      .createSignedUrl(filePath, 60 * 10); // 10分有効

    if (error || !signed?.signedUrl) {
      return NextResponse.json(
        { error: 'failed to create signed url' },
        { status: 500 }
      );
    }

    const imageUrl = signed.signedUrl;

    const system =
      'あなたは日本語のSNSコピーライターです。画像の内容と説明文を読み取り、指定のSNS向けに最適な文章を作成します。';

    const userContent = [
      {
        type: 'input_text',
        text:
          (prompt || '') +
          '\n\n上記の条件と、画像の内容・雰囲気・補足説明を踏まえ、SNS投稿文を日本語で作成してください。',
      },
      {
        type: 'input_image',
        image_url: { url: imageUrl },
      },
    ] as const;

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        { role: 'system', content: system },
        { role: 'user', content: userContent as any }, // SDK の型都合で any
      ],
      max_output_tokens: 800,
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

    return NextResponse.json({
      text,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
