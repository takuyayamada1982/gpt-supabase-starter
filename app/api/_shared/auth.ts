// app/api/_shared/auth.ts
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function getUserFromCookies() {
  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return {
      user: null,
      error,
    } as const;
  }

  return {
    user: data.user,
    error: null,
  } as const;
}
