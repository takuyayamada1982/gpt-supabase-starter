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

    // ★ TypeScript がうるさいので、input 全体を any キャストして型エラーを潰す
    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input: [
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
              // OpenAI API が期待するのは「画像URLの文字列」
              image_url: imageUrl,
              // SDK 型定義上、detail が必須になっているバージョンがあるので付けておく
              detail: 'auto',
            },
          ],
        },
      ] as any, // ← ここで
