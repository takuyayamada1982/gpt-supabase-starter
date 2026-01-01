// app/api/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { supabase } from '../_shared/profile';
import { checkPlanGuardByUserId } from '../_shared/planGuard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    // ① Authorization ヘッダからアクセストークン取得
    const authHeader = req.headers.get('authorization');
    const accessToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'not_auth', message: 'アクセストークンがありません。再ログインしてください。' },
        { status: 401 }
      );
    }

    // ② トークンからユーザー取得
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error('supabase.auth.getUser error:', userError);
      return NextResponse.json(
        { error: 'not_auth', message: 'ログイン情報が無効です。' },
        { status: 401 }
      );
    }

    // ③ プランガード（トライアル / 有料チェック）
    const guard = await checkPlanGuardByUserId(user.id);

    if (!guard.allowed) {
      if (guard.reason === 'trial_expired') {
        return NextResponse.json(
          {
            error: 'TRIAL_EXPIRED',
            message: '無料トライアルは終了しました。マイページからプランをご購入ください。',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: guard.reason ?? 'forbidden', message: '利用権限がありません。' },
        { status: 403 }
      );
    }

    // ④ リクエストボディ
    const body = (await req.json()) as {
      url: string;
      tone?: string;
      // 必要なら他のパラメータも
    };

    const { url, tone } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'bad_request', message: 'URLが指定されていません。' },
        { status: 400 }
      );
    }

    // ⑤ プロンプト生成（もともとのロジックをここに戻す）
    const toneText =
      tone && tone.trim().length > 0
        ? `（トーンは「${tone}」で書いてください）`
        : '';

    const prompt = `
以下のURLの記事を読んで、SNS投稿向けの文章を生成してください。

- 対象URL: ${url}
- 出力内容:
  1. 200〜300字程度の「要約」
  2. その要約をベースにした「投稿用キャッチコピー（30文字×3案）」
  3. 関連しそうなハッシュタグ候補（10〜15個）

${toneText}

出力は必ず以下のJSON形式で返してください（日本語）:

{
  "summary": "ここに要約文",
  "titles": ["タイトル案1", "タイトル案2", "タイトル案3"],
  "hashtags": ["#ハッシュタグ1", "#ハッシュタグ2", "..."]
}
`.trim();

    // ⑥ OpenAI 呼び出し
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // ⑦ テキスト取り出し（型エラー回避のため any キャスト）
    const firstOutput: any = response.output[0];
    const firstContent = firstOutput?.content?.[0];

    const raw =
      firstContent && firstContent.type === 'output_text'
        ? firstContent.text
        : '';

    if (!raw) {
      console.error('OpenAI response has no text:', JSON.stringify(response, null, 2));
      return NextResponse.json(
        {
          error: 'openai_no_text',
          message: '文章生成に失敗しました。時間をおいて再度お試しください。',
        },
        { status: 500 }
      );
    }

    // ⑧ JSON パース
    let parsed: {
      summary: string;
      titles: string[];
      hashtags: string[];
    };

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse OpenAI JSON:', raw);
      return NextResponse.json(
        {
          error: 'openai_parse_error',
          message: '生成結果の解析に失敗しました。',
        },
        { status: 500 }
      );
    }

    // ⑨ 利用ログ保存（必要に応じて）
    try {
      await supabase.from('usage_logs').insert({
        user_id: user.id,
        type: 'url',
        model: 'gpt-4.1-mini',
        // tokens や cost を計算していればここに入れる
      });
    } catch (logError) {
      console.error('usage_logs insert error:', logError);
      // ログ失敗は致命的ではないので処理は続行
    }

    // ⑩ フロントへ返却
    return NextResponse.json(
      {
        summary: parsed.summary,
        titles: parsed.titles,
        hashtags: parsed.hashtags,
      },
      { status: 200 }
    );
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
