// app/api/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

import { supabase } from '../_shared/profile';
import { checkPlanGuardByUserId } from '../_shared/planGuard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    // ① Cookie から Supabase ユーザーを取得
    const accessToken = cookies().get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'not_auth', message: 'ログイン情報が見つかりません。' },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'not_auth', message: 'ログイン情報が無効です。' },
        { status: 401 }
      );
    }

    // ② プランガード（トライアル／有料チェック）
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

    // ③ リクエストボディを取得（必要な項目があれば追加）
    const body = (await req.json()) as {
      url: string;
      tone?: string;
      persona?: string;
      // 他にも使っているパラメータがあればここに追加
    };

    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'bad_request', message: 'URLが指定されていません。' },
        { status: 400 }
      );
    }

    // ④ ここに「今までの URL 要約ロジック」を入れる
    //    いったんシンプルなダミー実装を入れておきます。
    //    すでに動いていたロジックがある場合は、
    //    このブロックを差し替えてください。

    const prompt = `次のURLの内容をSNS向けに要約してください: ${url}`;

    const aiRes = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt,
    });

    const outputText =
      (aiRes.output[0].content[0] as any).text ?? '要約結果を取得できませんでした。';

    // ⑤ usage_logs に記録（必要に応じてカラム名を調整）
    try {
      await supabase.from('usage_logs').insert({
        user_id: guard.profile.id,
        type: 'url',
        model: 'gpt-4.1-mini',
        // prompt_tokens / completion_tokens / total_tokens / cost など
        // トークン情報を取っている場合はここに追加
      });
    } catch (logErr) {
      console.error('usage_logs insert error:', logErr);
      // ログ記録に失敗しても、ユーザーには結果を返す
    }

    // ⑥ フロントに返すレスポンス
    return NextResponse.json(
      {
        text: outputText,
        // すでに使っているキー（summary, posts など）があればここに追加
        // summary,
        // posts,
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
