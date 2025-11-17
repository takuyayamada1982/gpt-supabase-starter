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

    // 立場のテキスト（①自分目線 / ②紹介者 / ③中立）
    let viewpointLabel = '第三者として中立・客観的に紹介する';
    if (viewpoint === '1' || viewpoint === 'self') {
      viewpointLabel = '自分が作成した記事を自分目線で紹介する';
    } else if (viewpoint === '2' || viewpoint === 'introducer') {
      viewpointLabel = '他人が書いた記事を自分が紹介者として紹介する';
    } else if (viewpoint === '3' || viewpoint === 'neutral') {
      viewpointLabel = '第三者として中立・客観的に紹介する';
    }

    const instructions =
      'あなたはSNS運用アシスタントです。与えられたURLの記事をもとに、日本語でSNS向けの紹介コンテンツを作成します。' +
      '実際の記事本文は参照できない可能性があるので、URLと前提条件から合理的な範囲で想像して構いません。';

    // モデルには「JSONだけ返して」と明示しておく
    const userPrompt =
      `次のURLの記事について、「${viewpointLabel}」立場でSNS投稿に使える素材を作成してください。\n` +
      `URL: ${url}\n\n` +
      `【出力フォーマット】\n` +
      `以下のキーを持つ JSON オブジェクト「だけ」を出力してください。説明文や日本語コメントは不要です。\n` +
      `{\n` +
      `  "summary": "記事の要約（200〜300文字程度）",\n` +
      `  "titles": ["題名案1", "題名案2", "題名案3"],\n` +
      `  "hashtags": ["#タグ1", "#タグ2", "... 10〜15個"],\n` +
      `  "x": "X（旧Twitter）向け投稿文（200〜280文字程度）",\n` +
      `  "instagram": "Instagram向け投稿文（感情多め・300〜400文字程度）",\n` +
      `  "facebook": "Facebook向け投稿文（背景説明も少し足した400〜500文字程度）"\n` +
      `}\n` +
      `JSON 以外の文字（例: 「以下が結果です」など）は一切出力しないでください。`;

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

    const raw = (ai as any).output_text ?? '';

    // モデルからの JSON をパース
    let parsed: {
      summary?: string;
      titles?: string[];
      hashtags?: string[];
      x?: string;
      instagram?: string;
      facebook?: string;
    } = {};

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse JSON from OpenAI:', raw);
      // 失敗したら最低限の形で返す（フロントで raw を見る用）
      return NextResponse.json({
        summary: raw,
        titles: [],
        hashtags: [],
        x: '',
        instagram: '',
        facebook: '',
      });
    }

    // 安全にデフォルトを補う
    const result = {
      summary: parsed.summary ?? '',
      titles: Array.isArray(parsed.titles) ? parsed.titles : [],
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      x: parsed.x ?? '',
      instagram: parsed.instagram ?? '',
      facebook: parsed.facebook ?? '',
    };

    // ここでフィールド別に返す → フロントが各SNS欄にセットしやすい形
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('API /api/url error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
