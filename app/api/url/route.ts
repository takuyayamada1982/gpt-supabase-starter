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
    const { userId, url, userText } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!url) {
      return NextResponse.json({ error: 'url required' }, { status: 400 });
    }

    const instructions =
      'あなたはSNS運用アシスタントです。与えられたURLと補足テキストをもとに、日本語でSNS向けの要約・投稿案を作成します。実際のページ内容は閲覧できない可能性があるため、URLと与えられた情報から合理的な範囲で推測して文章を作成してください。';

    const prompt =
      `以下のURLについてSNS投稿案を作成してください。\n` +
      `URL: ${url}\n\n` +
      (userText
        ? `補足情報:\n${userText}\n\n`
        : '') +
      '・日本語で\n・Twitter/X や Instagram投稿を想定\n・本文とハッシュタグ案も出力してください。';

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_output_tokens: 1000,
      temperature: 0.7,
    });

    // usage ログ（type = 'url'）
    const usage: any = (ai as any).usage;
    if (usage) {
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

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
