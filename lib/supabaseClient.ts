
import { createClient } from "@supabase/supabase-js";

/**
 * クライアント（ブラウザ）側では anon key のみ使用。
 * service_role は /app/api/* のサーバールート内だけで使用してください。
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
