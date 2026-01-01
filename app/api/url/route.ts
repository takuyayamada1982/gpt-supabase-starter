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
    // ③ プランガード
    //
    const guard = await checkPlanGuardByUserId(user.id);

    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.reason ?? 'forbidden' },
        { status: 403 }
      );
    }

    //
    // ④ リクエスト内容取得
    //
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: 'bad_request', message: 'URLが指定されていません。' },
        { status: 400 }
      );
    }

    //
    // ⑤ OpenAI 要約
    //
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: `
あなたは SNS運用のプロ編集者です。
以下のURLの内容を確認して、
・200〜300文字の要約
・30文字以内のタイトルを3つ
・おすすめハッシュタグ10個
を出力してください。

URL: ${url}
      `,
    });

    const raw =
      response.output[0]?.type === 'output_text'
        ? response.output[0].content[0].text
        : '';

    //
    // ⑥ 使用ログ記録（今まで通り）
    //
    await supabase.from('usage_logs').insert({
      user_id: user.id,
      type: 'url',
    });

    return NextResponse.json({ result: raw }, { status: 200 });
  } catch (e) {
    console.error('API /api/url error:', e);
    return NextResponse.json(
      {
        error: 'server_error',
      },
      { status: 500 }
    );
  }
}
