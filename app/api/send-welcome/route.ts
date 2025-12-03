// app/api/send-welcome/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * 期待するリクエストボディ：
 * {
 *   email: string;
 *   accountId: string;     // 今は 99999（トライアル共通）
 *   trialType: 'normal' | 'referral';
 *   referralCode: string;  // ユーザー自身の紹介コード
 * }
 */
export async function POST(request: Request) {
  try {
    const { email, accountId, trialType, referralCode } = await request.json();

    if (!email || !accountId) {
      return NextResponse.json(
        { error: 'email と accountId は必須です。' },
        { status: 400 },
      );
    }

    const isReferral = trialType === 'referral';
    const trialDays = isReferral ? 14 : 7;

    const subject = 'AutoPost Studio｜ご登録ありがとうございます';

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7; color: #111827;">
        <h2>AutoPost Studio へのご登録ありがとうございます。</h2>

        <p>このメールは、ツールのご登録時に自動送信されています。</p>

        <h3>▼ ログイン情報</h3>
        <ul>
          <li>ログインメールアドレス：<b>${email}</b></li>
          <li>アカウントID（5桁）：<b>${accountId}</b></li>
        </ul>

        <p>
          ログインページはこちら：<br />
          <a href="https://auto-post-studio-git-main-takus-projects-2fbd9c93.vercel.app/auth">
            https://auto-post-studio-git-main-takus-projects-2fbd9c93.vercel.app/auth
          </a>
        </p>

        <h3>▼ 無料トライアルについて</h3>
        <p>
          ご利用プラン：<b>${isReferral ? '紹介経由トライアル' : '通常トライアル'}</b><br/>
          無料期間：<b>${trialDays}日間</b>
        </p>
        ${
          isReferral
            ? `<p>紹介コード経由でのご登録ありがとうございます。通常より長いトライアル期間が適用されています。</p>`
            : `<p>期間中は回数制限内で自由にお試しいただけます。</p>`
        }

        <h3>▼ あなたの紹介コード</h3>
        <p>
          このコードをお知り合いに共有すると、紹介経由での新規登録として扱われます。<br/>
          あなたの紹介コード：<b>${referralCode}</b>
        </p>

        <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
          ※ このメールに心当たりがない場合は、破棄してください。<br/>
          ※ パスワードはセキュリティ上、メールには記載していません。
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      // ドメイン認証なしで使えるテスト用 From
      from: 'AutoPost Studio <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'メール送信に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: 'サーバー側でエラーが発生しました。' },
      { status: 500 },
    );
  }
}
