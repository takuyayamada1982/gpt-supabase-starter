// app/api/url/route.ts
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
    const { userId, url, viewpoint } = await req.json();

    // URL は必須
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url required' }, { status: 400 });
    }

    // 立場の解釈
    // フロントから "1" / "2" / "3" が来ても "self" などにマップできるようにしておく
    let viewpointLabel = '中立・客観';
    if (viewpoint === '1' || viewpoint === 'self') {
      viewpointLabel = '自分が作成した記事を自分目線で紹介する';
    } else if (viewpoint === '2' || viewpoint === 'introducer') {
      viewpointLabel = '他人が書いた記事を自分が紹介者として紹介する';
    } else if (viewpoint === '3' || viewpoint === 'neutral') {
      viewpointLabel = '第三者として中立・客観的に紹介する';
    }

    const instructions =
      'あなたはSNS運用アシスタントです。与えられたURLの記事をもとに、日本語でSNS向けの紹介コンテンツを作成します。実際の記事本文は参照できない可能性があるので、URLと前提条件から合理的な範囲で想像して構いません。';

    // —— モデルへの具体的な指示 ——
    const userPrompt =
      `次のURLの記事について、${viewpointLabel}立場でSNS投稿に使える素材を作成してください。\n` +
      `URL: ${url}\n\n` +
      `【出力してほしいもの】\n` +
      `1. 記事の要約（200〜300文字程度の日本語）\n` +
      `2. SNS向けの題名案を3つ（1行ずつ）\n` +
      `3. ハッシュタグ候補を10〜15個（#付き、日本語・英語どちらでも可）\n` +
      `4. 各SNS向けの投稿文\n` +
      `   - X（旧Twitter）向け：150文字程度\n` +
      `   - Instagram向け：少し感情表現を増やした300〜400文字程度\n` +
      `   - Facebook向け：背景や補足も少し足した500〜700文字程度\n` +
      `\n` +
      `【書式】必ず次のラベルを付けて出力してください：\n` +
      `---\n` +
      `【要約】\n` +
      `（要約）\n\n` +
      `【題名案】\n` +
      `1. ...\n` +
      `2. ...\n` +
      `3. ...\n\n` +
      `【ハッシュタグ候補】\n` +
      `#タグ1 #タグ2 ... （10〜15個）\n\n` +
      `【X向け投稿案】\n` +
      `...\n\n` +
      `【Instagram向け投稿案】\n` +
      `...\n\n` +
      `【Facebook向け投稿案】\n` +
      `...\n` +
      `---\n` +
      `このフォーマットを守って出力してください。`;

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_output_tokens: 1500,
      temperature: 0.7,
    });

    // usage ログ（type = 'url'）：userId があるときだけ保存
    const usage: any = (ai as any).usage;
    if (userId && usage) {
      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: (ai as any).model ?? 'gpt-4.1-mini',
        type: 'url',
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0,
      });
    }

    const text = (ai as any).output_text ?? '';

    // フロントは res.text をそのまま受け取って、
    // 要約欄 / 題名欄 / ハッシュタグ欄 / 各SNS欄 に分割して使う想定
    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('API /api/url error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
