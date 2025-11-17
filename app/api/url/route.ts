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

    // ★ ここを「嘘をつかない」方針に変更
    const instructions =
      'あなたはSNS運用アシスタントです。与えられたURLをもとに、日本語でSNS向けの紹介コンテンツを作成します。' +
      '重要：あなたは記事本文そのものにはアクセスできない前提です。URLから確実に読み取れる情報（ドメイン、パス、クエリのキーワードなど）以外の具体的な事実（数値、日付、人物名、企業名、固有の事例など）を勝手に作らないでください。' +
      'わからない情報は推測せず、抽象的な表現（「〜に関する情報」「〜をテーマにした記事」など）にとどめ、嘘になりうる具体的記述は避けてください。' +
      '「〜かもしれません」「おそらく〜です」のような推測表現も使用しないでください。';

    // モデルには「JSONだけ返して」と明示
    const userPrompt =
      `次のURLの記事について、「${viewpointLabel}」立場でSNS投稿に使える素材を作成してください。\n` +
      `URL: ${url}\n\n` +
      `【前提】\n` +
      `- 記事本文にはアクセスできない前提で、URLに含まれる単語やドメイン名から分かる範囲の一般的な内容だけを使ってください。\n` +
      `- 具体的な数字・日付・人名・企業名・事例など、URLから明らかでない情報を作り出さないでください。\n` +
      `- 必要であれば「このURLの記事では◯◯に関する情報がまとめられています」「詳細は記事本文をご覧ください」のように、抽象度を上げた表現を使ってください。\n\n` +
      `【出力フォーマット】\n` +
      `以下のキーを持つ JSON オブジェクト「だけ」を出力してください。説明文や日本語コメントは不要です。\n` +
      `{\n` +
      `  "summary": "記事の要約（200〜300文字程度。あくまで一般的・抽象的な内容で、具体的な事実は書かない）",\n` +
      `  "titles": ["題名案1", "題名案2", "題名案3"],\n` +
      `  "hashtags": ["#タグ1", "#タグ2", "... 10〜15個"],\n` +
      `  "x": "X（旧Twitter）向け投稿文（200〜280文字程度。URL先の記事を紹介する文章。事実が不明な部分は抽象的に）",\n` +
      `  "instagram": "Instagram向け投稿文（感情多め・300〜400文字程度。ただし事実は勝手に作らない）",\n` +
      `  "facebook": "Facebook向け投稿文（背景説明も少し足すが、具体的な数字・事例は作らず抽象的に）"\n` +
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
      temperature: 0.4, // 嘘を減らすためにやや低め
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

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('API /api/url error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
