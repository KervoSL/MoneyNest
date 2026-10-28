-- Proof of acceptance of Terms/Privacy (applied 2026-10-27)
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;
-- handle_new_user() copies terms_accepted/terms_version from raw_user_meta_data (server-side now()).
-- protect_terms_columns trigger: once recorded, the client cannot alter or erase it.
