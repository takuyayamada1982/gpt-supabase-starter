// app/api/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookies } from '../_shared/auth';
import OpenAI from 'openai';

import { supabase as adminSupabase } from '../_shared/profile';
import { checkPlanGuardByUserId } from '../_shared/planGuard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    // ① Cookie からユーザー取得
    const { user, error } = await getUserFromCookies();

    if (error || !user) {
      return NextResponse.json(
        { error: 'not_auth', message: 'ログイン情報が見つかりません。' },
        { status: 401 }
      );
    }

    // ② プランガード
    const guard = await checkPlanGuardByUserId(user.id);

    if (!guard.allowed) {
      if (guard.reason === 'trial_expired') {
        return NextResponse.json(
          {
            error: 'TRIAL_EXPIRED',
            message:
              '無料トライアルは終了しました。マイページからプランをご購入ください。',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: guard.reason ?? 'forbidden',
          message: '利用権限がありません。',
        },
        { status: 403 }
      );
    }

    // ③ リクエストボディ
    const body = (await req.json()) as {
      url: string;
      tone?: string;
    };

    const { url, tone } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'bad_request', message: 'URLが指定されていません。' },
        { status: 400 }
      );
    }

    // ④ URL fetch
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'fetch_failed', message: 'URLの取得に失敗しました。' },
        { status: 400 }
      );
    }

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    const toneText =
      tone === 'self'
        ? '投稿者本人の目線'
        : tone === 'other'
        ? '第三者が他人の記事を紹介する目線'
        : '中立的な第三者目線';

    const prompt = `
あなたはSNSマーケティング担当者です。
以下のWebページ本文を読み、次のフォーマットで日本語のSNS投稿用テキストを作成してください。

- summary: 200〜300文字の要約
- summary_copy: summaryを元にした「コピペ用の要約文」
- titleIdeas: 投稿タイトル案を3つ
- hashtags: ハッシュタグ候補を10〜15個
- posts.instagram: Instagram向けの投稿文案を3パターン
- posts.facebook: Facebook向けの投稿文案を3パターン
- posts.x: X向けの投稿文案を3パターン

出力は JSON のみで返してください。

口調や視点は「${toneText}」を想定してください。

===== ここから本文 =====
${text}
===== 本文ここまで =====
`.trim();

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt,
    });

    const outputItem = (response as any).output?.[0] as any;
    const raw: string = outputItem?.content?.[0]?.text ?? '';

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return NextResponse.json(
        { error: 'parse_error', message: 'AIレスポンスの解析に失敗しました。' },
        { status: 500 }
      );
    }

    const totalTokens =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);

    const cost = totalTokens * 0.002;

    await adminSupabase.from('usage_logs').insert({
      user_id: guard.profile.id,
      type: 'url',
      model: 'gpt-4.1-mini',
      prompt_tokens: response.usage?.input_tokens ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      total_tokens: totalTokens,
      cost,
    });

    return NextResponse.json(parsed, { status: 200 });
  } catch (e) {
    console.error('API /api/url error:', e);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'サーバーエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
