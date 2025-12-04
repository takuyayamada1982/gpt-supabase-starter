// app/api/vision/route.ts
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

    // ① supabase から画像を取得
    const { data, error } = await supabase.storage
      .from('uploads')
      .download(filePath);

    if (error || !data) {
      console.error('Supabase download error:', error);
      return NextResponse.json(
        { error: 'failed to download image from storage' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const base64 = buffer.toString('base64');

    // ② URL 版と同じ形式の「強制 instructions」を追加
    const instructions =
      'あなたはSNS運用アシスタントです。' +
      '絶対に画像の内容と与えられた補足説明に基づいて文章を作成してください。' +
      '本文に存在しない事実（人物名・数字・固有名詞）は勝手に作成禁止。';

    // ③ SNS 各種プロンプト（app/u/page.tsx で指定した内容）
    const userPrompt = prompt;

    // ④ モデルに渡す content
    const content: any[] = [
      {
        type: 'input_text',
        text: userPrompt,
      },
      {
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${base64}`,
        detail: 'high',
      },
    ];

    // ⑤ OpenAI 呼び出し（URL と同じ構造）
    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input: [
        {
          role: 'user',
          content,
        },
      ],
      max_output_tokens: 700,
      temperature: 0.75,
    });

    // usage ログ記録
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

    // ⑥ 生成後に画像削除
    try {
      await supabase.storage.from('uploads').remove([filePath]);
    } catch (e) {
      console.error('delete failed:', e);
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('API /api/vision error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
