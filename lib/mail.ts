// lib/mail.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// 例: "Auto post studio <onboarding@resend.dev>"
const MAIL_FROM =
  process.env.MAIL_FROM ?? 'Auto post studio <onboarding@resend.dev>';

// デバッグ用: 常に自分のメールにも同じ内容を飛ばす
// Vercel の Environment Variables に DEBUG_MAIL_TO を設定しておくと便利
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

  // 🔹 宛先（ユーザー + デバッグ宛先）を組み立てる
  const recipients: string | string[] =
    DEBUG_MAIL_TO && DEBUG_MAIL_TO !== to
      ? [to, DEBUG_MAIL_TO]
      : to;

  console.log('sendAccountIdEmail: from', MAIL_FROM, 'to', recipients);

  return resend.emails.send({
    from: MAIL_FROM,
    to: recipients,
    subject,
    text,
  });
}
