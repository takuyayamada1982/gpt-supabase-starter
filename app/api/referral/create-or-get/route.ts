import { NextRequest, NextResponse } from 'next/server';
import { supabase, fetchProfileByIdOrEmail } from '../../_shared/profile';

function generateCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'https://gpt-supabase-starter.vercel.app';

export async function POST(req: NextRequest) {
  try {
    // ✅ 空ボディ対策（Unexpected end of JSON input を潰す）
    const raw = await req.text();
    const body = raw ? (JSON.parse(raw) as { userId?: string; userEmail?: string }) : {};
    const { userId, userEmail } = body;

    const { profile, error } = await fetchProfileByIdOrEmail({ userId, userEmail });
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });

    // ✅ profiles.referral_code があれば最優先（マイページ表示と一致）
    const profReferral = (profile as any).referral_code;
    if (profReferral) {
      const code = String(profReferral);
      const url = `${APP_BASE_URL}/auth?ref=${encodeURIComponent(code)}`;
      return NextResponse.json({ ok: true, code, url });
    }

    // referral_codes に既存があれば再利用
    let code = '';
    const { data: existingCodes, error: codeErr } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('owner_user_id', profile.id)
      .eq('is_active', true)
      .limit(1);

    if (!codeErr && existingCodes?.length) code = existingCodes[0].code;

    // なければ新規発行
    if (!code) {
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
        return NextResponse.json({ error: 'code_generate_failed' }, { status: 500 });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('referral_codes')
        .insert({ owner_user_id: profile.id, code: newCode, is_active: true })
        .select('code')
        .limit(1);

      if (insertErr) {
        console.error('referral_codes insert error:', insertErr);
        return NextResponse.json({ error: 'referral_insert_error' }, { status: 500 });
      }

      code = inserted?.[0]?.code ?? '';
    }

    if (!code) return NextResponse.json({ error: 'referral_code_missing' }, { status: 500 });

    // ✅ 最小修正：profiles.referral_code にも保存（表示NULLを防ぐ）
    const { error: profUpdateErr } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', profile.id);

    if (profUpdateErr) console.warn('profiles.referral_code update failed:', profUpdateErr);

    const url = `${APP_BASE_URL}/auth?ref=${encodeURIComponent(code)}`;
    return NextResponse.json({ ok: true, code, url });
  } catch (e: any) {
    console.error('/api/referral/create-or-get error:', e);
    return NextResponse.json(
      { error: 'internal_error', message: e?.message ?? '予期せぬエラーが発生しました。' },
      { status: 500 },
    );
  }
}
