
create table if not exists user_settings(
  user_id uuid primary key,
  system_prompt text not null default 'あなたは親切なアシスタントです。',
  brand_color text default '#0ea5e9'
);
create table if not exists messages(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz default now()
);
create table if not exists usage_logs(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  model text not null,
  prompt_tokens int not null,
  completion_tokens int not null,
  total_tokens int not null,
  created_at timestamptz default now()
);
