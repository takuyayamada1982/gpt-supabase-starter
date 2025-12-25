// lib/mail.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const MAIL_FROM =
  process.env.MAIL_FROM ?? 'Auto post studio <onboarding@resend.dev>';

const DEBUG_MAIL_TO = process.env.DEBUG_MAIL_TO ?? '';

export async function sendAccountIdEmail(to: string, accountId: string) {
  const subject = '【Auto post studio】アカウントIDのご案内';

  const text = [
    'Auto post studio をご利用いただきありがとうございます。',
    '',
    `あなたのアカウントIDは「${accountId}」です。`,
    '',
    'ログイン時に必要になります。',
  ].join('\n');

  const recipients =
    DEBUG_MAIL_TO && DEBUG_MAIL_TO !== to ? [to, DEBUG_MAIL_TO] : to;

  // 👇👇 送信直前のログ（超重要）
  console.log('📩 sendAccountIdEmail', {
    from: MAIL_FROM,
    to,
    DEBUG_MAIL_TO,
    recipients,
  });

  return resend.emails.send({
    from: MAIL_FROM,
    to: recipients,
    subject,
    text,
  });
}
