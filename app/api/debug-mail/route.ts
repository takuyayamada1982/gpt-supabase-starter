// app/api/debug-mail/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// テスト送信先：
// 1. Vercel に DEBUG_MAIL_TO を設定していればそれを使う
// 2. なければこのハードコードされたアドレスを使う
const FALLBACK_TO = 'your-test-email@example.com'; // ← デモ用メールアドレスに書き換えてOK

export async function GET() {
  try {
    const to = process.env.DEBUG_MAIL_TO ?? FALLBACK_TO;

    if (!to || to === 'your-test-email@example.com') {
      return NextResponse.json(
        {
          error:
            '送信先メールアドレスが設定されていません。DEBUG_MAIL_TO を環境変数に設定するか、FALLBACK_TO をあなたのメールアドレスに書き換えてください。',
        },
        { status: 400 }
      );
    }

    const from =
      process.env.MAIL_FROM ?? 'Auto post studio <onboarding@resend.dev>';

    const result = await resend.emails.send({
      from,
      to,
      subject: 'Auto post studio メール送信テスト',
      html: `
        <p>これは <strong>Auto post studio</strong> からのテストメールです。</p>
        <p>Resend & MAIL_FROM の設定が正しく動いているか確認できます。</p>
        <p>受信できていれば、決済完了時のアカウントIDメールも届く状態になっています。</p>
      `,
    });

    return NextResponse.json({
      ok: true,
      to,
      from,
      resendResult: result,
    });
  } catch (e: any) {
    console.error('debug-mail-error', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown error' },
      { status: 500 }
    );
  }
}
