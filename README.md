
# GPT + Supabase Starter（修正版）
- Path alias `@/` を有効化（tsconfig の baseUrl + paths）
- クライアントは `NEXT_PUBLIC_SUPABASE_ANON_KEY` のみを使用（`service_role` はサーバールートのみ）

## セットアップ
1) Supabase: Auth(Email) ON / Storage uploads作成 / SQLで schema.sql 実行
2) Vercel: 環境変数を登録
   - OPENAI_API_KEY
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
3) デプロイ後 /login → /u → /admin
