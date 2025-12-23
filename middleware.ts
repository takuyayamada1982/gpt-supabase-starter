import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ auth系は全部「素通し」
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // ✅ それ以外も、今は何もしない（既存の挙動を壊さない）
  return NextResponse.next();
}

// 静的ファイル等は除外
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
