import { NextRequest, NextResponse } from 'next/server';
import {
  supabase,
  fetchProfileByIdOrEmail,
  ProfileRow,
} from '../../_shared/profile';

// 6桁の英数字大文字コードを作る
function generateCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'https://example.com';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      userEmail?: string;
    };

    const { userId, userEmail } = body;

    const { profile, error } = await fetchProfileByIdOrEmail({
      userId,
      userEmail,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'profile_not_found' },
        { status: 404 }
      );
    }

    // すでに有効な紹介コードがあれば再利用
    const { data: existingCodes, error: codeErr } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('owner_user_id', profile.id)
      .eq('is_active', true)
      .limit(1);

    if (codeErr) {
      console.error('referral_codes query error:', codeErr);
      return NextResponse.json(
        { error: 'referral_query_error' },
        { status: 500 }
      );
    }

    let codeRow: { code: string } | null =
      existingCodes && existingCodes.length > 0
        ? existingCodes[0]
        : null;

    // なければ新規発行
    if (!codeRow) {
      let newCode = '';
      let isUnique = false;

      for (let i = 0; i < 5; i += 1) {
        newCode = generateCode(6);
        const { data: dupCheck } = await supabase
          .from('referral_codes')
          .select('id')
          .eq('code', newCode)
          .limit(1);

        if (!dupCheck || dupCheck.length === 0) {
          isUnique = true;
          break;
        }
      }

      if (!isUnique) {
        return NextResponse.json(
          { error: 'code_generate_failed' },
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
          { error: 'referral_insert_error' },
          { status: 500 }
        );
      }

      codeRow = inserted?.[0] ?? null;
    }

    if (!codeRow) {
      return NextResponse.json(
        { error: 'referral_code_missing' },
        { status: 500 }
      );
    }

    const url = `${APP_BASE_URL}/auth?ref=${encodeURIComponent(
      codeRow.code
    )}`;

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
