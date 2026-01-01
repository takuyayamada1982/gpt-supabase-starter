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
    //
    // ① Authorization ヘッダーからアクセストークン取得
    //
    const auth = req.headers.get('authorization');

    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'not_auth', message: '認証情報がありません。' },
        { status: 401 }
      );
    }

    const accessToken = auth.replace('Bearer ', '');

    //
    // ② Supabase でユーザー確認
    //
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'not_auth', message: 'ログインが確認できません。' },
        { status: 401 }
      );
    }

    //
    // ③ プランガード（トライアル or 有料チェック）
    //
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
        { error: guard.reason ?? 'forbidden', message: '利用権限がありません。' },
        { status: 403 }
      );
    }

    //
    // ④ リクエストボディ取得
    //
    const body = (await req.json()) as {
      url: string;
      tone?: string;
    };

    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'bad_request', message: 'URLが指定されていません。' },
        { status: 400 }
      );
    }

    //
    // ⑤ OpenAI で要約生成
    //
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
あなたは SNS運用のプロ編集者です。
以下のURLの内容を確認して、
・200〜300文字の要約
・30文字以内のタイトルを3つ
・おすすめハッシュタグ10個
を日本語で出力してください。

URL: ${url}
              `.trim(),
            },
          ],
        },
      ],
    });

    // ★ 型安全に output からテキストを取り出す
    let raw = '';

    const firstItem = response.output[0];
    if (firstItem && firstItem.type === 'message') {
      const firstContent = firstItem.content[0];
      if (firstContent && firstContent.type === 'output_text') {
        raw = firstContent.text;
      }
    }

    //
    // ⑥ usage_logs に記録
    //
    await supabase.from('usage_logs').insert({
      user_id: user.id,
      type: 'url',
      model: 'gpt-4.1-mini',
      // token/cost を付けたい場合はここに追加
    });

    return NextResponse.json(
      {
        result: raw,
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
