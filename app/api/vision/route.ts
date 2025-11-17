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
    const { userId, prompt, filePath, imageUrl } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }

    // ---- 画像取得（基本は Supabase の filePath を優先）----
    let imageDataBase64: string | null = null;
    const pathToDelete =
      typeof filePath === 'string' && filePath.length > 0 ? filePath : null;

    if (pathToDelete) {
      // Supabase Storage から直接ダウンロード
      const { data, error } = await supabase.storage
        .from('uploads') // ← 画像を入れているバケット名
        .download(pathToDelete);

      if (error || !data) {
        console.error('Supabase download error:', error);
        return NextResponse.json(
          { error: 'failed to download image from storage' },
          { status: 400 }
        );
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageDataBase64 = buffer.toString('base64');
    } else if (imageUrl && typeof imageUrl === 'string') {
      // フォールバック（今は基本使わない想定）
      // 画像URLをそのまま OpenAI に渡す
    } else {
      return NextResponse.json(
        { error: 'filePath or imageUrl required' },
        { status: 400 }
      );
    }

    // ---- OpenAI に渡す content を組み立て ----
    const content: any[] = [
      {
        type: 'input_text',
        text: prompt as string,
      },
    ];

    if (imageDataBase64) {
      // data URL で直接渡す → OpenAI 側でのダウンロード不要
      content.push({
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${imageDataBase64}`,
        detail: 'low',
      });
    } else if (imageUrl && typeof imageUrl === 'string') {
      content.push({
        type: 'input_image',
        image_url: imageUrl,
        detail: 'low',
      });
    }

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content,
        },
      ],
      max_output_tokens: 400,
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

    // ★★★ ここが今回の本題：生成後に画像を即削除 ★★★
    if (pathToDelete) {
      try {
        const { error: delError } = await supabase.storage
          .from('uploads')
          .remove([pathToDelete]);
        if (delError) {
          console.error('failed to delete file after generation:', delError);
        }
      } catch (e) {
        console.error('exception on delete file:', e);
      }
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('API /api/vision error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
