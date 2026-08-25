create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null,
  stack text,
  url text,
  user_agent text,
  app_version text,
  user_id uuid references auth.users(id) on delete set null,
  fingerprint text
);
create index if not exists idx_client_errors_created_at on public.client_errors (created_at desc);
create index if not exists idx_client_errors_fingerprint on public.client_errors (fingerprint);
alter table public.client_errors enable row level security;
drop policy if exists "anyone can insert their own error" on public.client_errors;
create policy "anyone can insert their own error"
  on public.client_errors for insert
  to anon, authenticated
  with check (true);
