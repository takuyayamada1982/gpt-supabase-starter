// app/api/_shared/auth.ts
import { NextRequest } from 'next/server';
import { supabase } from './profile';

// Authorization: Bearer xxx からユーザーを取得
export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';

  if (!token) {
    return {
      user: null,
      error: 'missing_token' as const,
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      user: null,
      error: error ?? 'invalid_token',
    };
  }

  return {
    user: data.user,
    error: null as any,
  };
}
