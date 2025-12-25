// lib/mail.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// 例: "Auto post studio <onboarding@resend.dev>"
const MAIL_FROM =
  process.env.MAIL_FROM ?? 'Auto post studio <onboarding@resend.dev>';

// デバッグ用: 必ず自分のメールにも同じ内容を飛ばす
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

  // 🔹 宛先を組み立てる: ユーザー + デバッグ用（重複は除外）
  const recipients: string | string[] =
    DEBUG_MAIL_TO && DEBUG_MAIL_TO !== to
      ? [to, DEBUG_MAIL_TO]
      : to;

  // デバッグ用ログ（必要なら残しておく）
  console.log('sendAccountIdEmail: from', MAIL_FROM, 'to', recipients);

  await resend.emails.send({
    from: MAIL_FROM,
    to: recipients,
    subject,
    text,
  });
}
