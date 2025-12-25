// lib/mail.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// 例: "Auto post studio <noreply@auto-post-studio.com>"
const MAIL_FROM =
  process.env.MAIL_FROM ?? 'Auto post studio <noreply@example.com>';

export async function sendAccountIdEmail(to: string, accountId: string) {
  const subject = '【Auto post studio】アカウントIDのご案内';

  const text = [
    'Auto post studio をご利用いただきありがとうございます。',
    '',
    '有料プランへのアップグレードが完了しました。',
    '',
    `あなたのアカウントIDは「${accountId}」です。`,
    '',
    'ログイン時に必要になりますので、メモを保存しておいてください。',
    '',
    '---',
    '本メールにお心当たりがない場合は、このメールを破棄してください。',
  ].join('\n');

  await resend.emails.send({
    from: MAIL_FROM,
    to,
    subject,
    text,
  });
}
