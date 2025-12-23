// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ ここは「認証なしで素通し」させる
  const publicPaths = [
    '/', // LP/トップ
    '/auth', // ログイン
    '/auth/reset', // パスワード再設定の着地点（最重要）
    '/auth/callback', // OAuth等を将来使うなら
    '/auth/confirm', // メール確認等を将来使うなら
  ];

  // publicPaths は必ず素通し
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // 画像/CSS/JSなども素通し（念のため）
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // ここから先は「認証必須ページ」扱いにする場合だけ
  // あなたの実装で cookie/session 判定しているならここに入れる
  // いったん安全に全部通すなら next() にしてOK
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
