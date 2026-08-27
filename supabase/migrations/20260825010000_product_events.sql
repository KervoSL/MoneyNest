create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  metadata jsonb
);
create index if not exists idx_product_events_created_at on public.product_events (created_at desc);
create index if not exists idx_product_events_name on public.product_events (event_name);
create index if not exists idx_product_events_session on public.product_events (session_id);
alter table public.product_events enable row level security;
drop policy if exists "anyone can insert their own event" on public.product_events;
create policy "anyone can insert their own event"
  on public.product_events for insert
  to anon, authenticated
  with check (true);
