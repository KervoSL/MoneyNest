-- Error summary view (RLS applies: only dashboard/service role can read) + daily digest cron (applied 2026-10-28)
create or replace view public.client_errors_summary
with (security_invoker = true) as
select
  left(message, 160)                                  as message,
  split_part(coalesce(stack, ''), E'\n', 2)           as top_frame,
  count(*)                                            as occurrences,
  count(distinct user_id)                             as users,
  array_remove(array_agg(distinct app_version), null) as versions,
  min(created_at)                                     as first_seen,
  max(created_at)                                     as last_seen,
  bool_and(coalesce(user_agent, '') ~* 'bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|preview') as only_bots
from public.client_errors
group by 1, 2
order by max(created_at) desc;
revoke all on public.client_errors_summary from anon, authenticated;
-- cron job 'error-digest-daily' (0 7 * * *) posts to /functions/v1/error-digest with x-cron-secret
