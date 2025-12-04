// app/api/vision/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Supabase（サービスロールキーで OK）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 画像1回あたりの原価（円）
// Admin ダッシュボードで「画像 1円」としているので、ここでも 1.0 を入れておく
const VISION_UNIT_COST_YEN = 1.0;

export async function POST(req: NextRequest) {
  try {
    const { userId, prompt, filePath } = await req.json();

    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'filePath required' }, { status: 400 });
    }

    // ---- 画像を Supabase Storage から取得 ----
    const { data, error } = await supabase.storage
      .from('uploads') // ← バケット名（既存通り）
      .download(filePath);

    if (error || !data) {
      console.error('Supabase download error:', error);
      return NextResponse.json(
        { error: 'failed to download image from storage' },
        { status: 400 },
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageDataBase64 = buffer.toString('base64');

    // ---- OpenAI に渡す instructions + content ----
    // ※ここで「画像からSNS向けの文章を作るアシスタント」としての役割を固定。
    // 具体的な「Instagram用」「Facebook用」「X用」の指示は、
    // フロント側から渡される prompt に含まれている想定。
    const instructions =
      'あなたはSNS運用アシスタントです。与えられた画像とテキストの説明をもとに、日本語でSNS投稿向けの文章を作成します。' +
      '与えられた指示（Instagram用・Facebook用・X用など）に忠実に従い、' +
      '画像の内容から自然に想像できる範囲で文章を組み立ててください。' +
      '存在しない事実（人物名・企業名・日付・数値・イベント名など）を勝手に作らないでください。';

    const content: any[] = [
      // まずテキスト（フロントから渡される prompt を instructions と結合）
      {
        type: 'input_text',
        text: `${instructions}\n\n【生成指示】\n${prompt}`,
      },
      // 次に画像（data URL 形式）
      {
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${imageDataBase64}`,
        detail: 'low',
      },
    ];

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

    // ---- usage_logs に記録（type = 'vision'）----
    const usage: any = (ai as any).usage;
    if (usage) {
      // ここでは「画像1回あたり 1円」で原価を保存
      const costYen = VISION_UNIT_COST_YEN;

      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: (ai as any).model ?? 'gpt-4.1-mini',
        type: 'vision',
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0,
        cost: costYen,
      });
    }

    const text = (ai as any).output_text ?? '';

    // ---- 生成後に画像を即削除（秘匿性確保）----
    try {
      const { error: delError } = await supabase.storage
        .from('uploads')
        .remove([filePath]);
      if (delError) {
        console.error('failed to delete file after generation:', delError);
      }
    } catch (e) {
      console.error('exception on delete file:', e);
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('API /api/vision error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
