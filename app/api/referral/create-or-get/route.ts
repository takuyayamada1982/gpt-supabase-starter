// app/api/referral/create-or-get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase, fetchProfileByIdOrEmail } from '../../_shared/profile';

// 6桁の英数字大文字コードを作る
function generateCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 紹介用URLのベース（.env で設定があればそちらを優先）
const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'https://example.com';

export async function POST(req: NextRequest) {
  try {
    // マイページ側から { userId, userEmail } を受け取る想定
    const body = (await req.json()) as {
      userId?: string;
      userEmail?: string;
    };

    const { userId, userEmail } = body;

    // 1. プロフィール取得（id or email）
    const { profile, error } = await fetchProfileByIdOrEmail({
      userId,
      userEmail,
    });

    if (error) {
      console.error('fetchProfileByIdOrEmail error:', error);
      return NextResponse.json(
        { error: 'profile_error', message: 'プロフィール取得に失敗しました。' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'profile_not_found', message: 'プロフィールが見つかりません。' },
        { status: 404 }
      );
    }

    // 2. すでに有効な紹介コードがあれば再利用
    const { data: existingCodes, error: codeErr } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('owner_user_id', profile.id)
      .eq('is_active', true)
      .limit(1);

    if (codeErr) {
      console.error('referral_codes query error:', codeErr);
      return NextResponse.json(
        {
          error: 'referral_query_error',
          message: '紹介コード情報の取得に失敗しました。',
        },
        { status: 500 }
      );
    }

    let codeRow: { code: string } | null =
      existingCodes && existingCodes.length > 0 ? existingCodes[0] : null;

    // 3. なければ新規発行（最大5回トライして重複チェック）
    if (!codeRow) {
      let newCode = '';
      let isUnique = false;

      for (let i = 0; i < 5; i += 1) {
        newCode = generateCode(6);

        const { data: dupCheck, error: dupErr } = await supabase
          .from('referral_codes')
          .select('id')
          .eq('code', newCode)
          .limit(1);

        if (dupErr) {
          console.error('referral_codes dupCheck error:', dupErr);
          // ここで即終了せず、次のループに回してもよいが、
          // 一旦エラーとして返す
          return NextResponse.json(
            {
              error: 'referral_dup_check_error',
              message: '紹介コードの重複チェックに失敗しました。',
            },
            { status: 500 }
          );
        }

        if (!dupCheck || dupCheck.length === 0) {
          isUnique = true;
          break;
        }
      }

      if (!isUnique) {
        return NextResponse.json(
          {
            error: 'code_generate_failed',
            message: '紹介コードの生成に失敗しました。時間をおいて再度お試しください。',
          },
          { status: 500 }
        );
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('referral_codes')
        .insert({
          owner_user_id: profile.id,
          code: newCode,
          is_active: true,
        })
        .select('*')
        .limit(1);

      if (insertErr) {
        console.error('referral_codes insert error:', insertErr);
        return NextResponse.json(
          {
            error: 'referral_insert_error',
            message: '紹介コードの登録に失敗しました。',
          },
          { status: 500 }
        );
      }

      codeRow = inserted?.[0] ?? null;
    }

    if (!codeRow) {
      return NextResponse.json(
        {
          error: 'referral_code_missing',
          message: '紹介コードの取得に失敗しました。',
        },
        { status: 500 }
      );
    }

    // 4. 紹介URLを生成（例: https://your-app.com/auth?ref=XXXXXX）
    const url = `${APP_BASE_URL}/auth?ref=${encodeURIComponent(codeRow.code)}`;

    // 5. 正常レスポンス
    return NextResponse.json({
      ok: true,
      code: codeRow.code,
      url,
    });
  } catch (e: any) {
    console.error('/api/referral/create-or-get error:', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? '予期せぬエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
