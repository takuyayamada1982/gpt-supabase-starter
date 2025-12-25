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
    '有料プランへのアップグレードが完了しました。',
    '',
    `あなたのアカウントIDは「${accountId}」です。`,
    '',
    'ログイン時に必要になりますので、メモを保存しておいてください。',
    '',
    '---',
    '本メールにお心当たりがない場合は、このメールを破棄してください。',
  ].join('\n');

  // ユーザー + 自分の Gmail にも送る（DEBUG_MAIL_TO をCC的に利用）
  const recipients =
    DEBUG_MAIL_TO && DEBUG_MAIL_TO !== to ? [to, DEBUG_MAIL_TO] : to;

  console.log('📧 sendAccountIdEmail', { to, DEBUG_MAIL_TO, recipients });

  await resend.emails.send({
    from: MAIL_FROM,
    to: recipients,
    subject,
    text,
  });
}
