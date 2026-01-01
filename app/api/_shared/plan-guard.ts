// app/api/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

import { supabase } from '../_shared/profile';      // ここは実際のパスに合わせて
import { checkPlanGuardByUserId } from '../_shared/planGuard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    // ① Cookie からログインユーザー取得
    const access_token = cookies().get('sb-access-token')?.value;

    if (!access_token) {
      return NextResponse.json(
        { error: 'not_auth', message: 'ログイン情報が見つかりません。' },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(access_token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'not_auth', message: 'ログイン情報が無効です。' },
        { status: 401 }
      );
    }

    // ② プランガード（トライアル/有料チェック）
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

      // profile_not_found / not_logged_in など
      return NextResponse.json(
        { error: guard.reason ?? 'forbidden', message: '利用権限がありません。' },
        { status: 403 }
      );
    }

    // ③ ここから先が「今まで通りの URL 要約処理」
    const body = (await req.json()) as {
      url: string;
      tone?: string;
      // 他にあれば追加
    };

    const { url, tone } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'bad_request', message: 'URLが指定されていません。' },
        { status: 400 }
      );
    }

    // --- ここに既存の OpenAI 呼び出しロジックをそのまま貼り直す ---
    // 例）
    // const summary = await openai.responses.create({ ... });
    // await supabase.from('usage_logs').insert({
    //   user_id: guard.profile.id,
    //   type: 'url',
    //   model: 'gpt-4.1-mini',
    //   ...token情報 / cost など
    // });

    return NextResponse.json(
      {
        // summary: ...,
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
