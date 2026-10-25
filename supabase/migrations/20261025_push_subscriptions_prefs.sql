alter table public.push_subscriptions add column if not exists prefs jsonb not null default '{}'::jsonb;
