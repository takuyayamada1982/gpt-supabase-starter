import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// ここ変更 ↓↓↓↓↓
const MAIL_FROM =
  process.env.MAIL_FROM ?? 'Auto post studio <onboarding@resend.dev>';

export async function sendAccountIdEmail(to: string, accountId: string) {

  // Gmailに強制送信（DEBUG_MAIL_TO優先）
  const sendTo = process.env.DEBUG_MAIL_TO ?? to;

  console.log("📧 sendAccountIdEmail TO:", sendTo);

  await resend.emails.send({
    from: MAIL_FROM,
    to: sendTo,
    subject: '【Auto post studio】アカウントIDのご案内',
    text: `
Auto post studio をご利用いただきありがとうございます。

あなたのアカウントIDは「${accountId}」です。

ログイン時に必要になりますので
メモを保存しておいてください。
    `,
  });
}
