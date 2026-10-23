-- Internal helpers must only be callable by the backend (service_role), never from the public REST API.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_old_rate_limits() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.touch_last_seen() from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.cleanup_old_rate_limits() to service_role;
