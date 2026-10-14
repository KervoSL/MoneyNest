-- Fase 2 de la auditoría: H-17 (rate limit) y H-11 (borrado/retención de datos).

-- ── H-17 ────────────────────────────────────────────────────────────────
-- check_rate_limit es SECURITY DEFINER y, por defecto, EXECUTE se concede a
-- PUBLIC: cualquiera con la clave anon podía llamarla por RPC con claves
-- ajenas (p.ej. "delete-account:<uuid>") y bloquear a otro usuario.
-- Solo las Edge Functions (service_role) la usan.
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
revoke all on function public.cleanup_old_rate_limits() from public, anon, authenticated;
grant execute on function public.cleanup_old_rate_limits() to service_role;

-- ── H-11 ────────────────────────────────────────────────────────────────
-- Datos personales que sobrevivían a "Eliminar cuenta":
--  · billing_events.payload (objeto completo de Stripe: email, nombre, dirección…)
--    con user_id puesto a NULL por ON DELETE SET NULL;
--  · product_events / client_errors (user_id → NULL, pero con sesión y URL).
-- delete-account llama a esta función ANTES de borrar el perfil.
-- Se conserva en billing_events solo lo mínimo para auditar (tipo de evento e
-- identificadores de Stripe); el registro fiscal de cobros vive en Stripe.
create or replace function public.scrub_user_data(p_user_id uuid, p_stripe_customer_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_events
     set payload = jsonb_build_object('scrubbed', true, 'id', payload->>'id', 'object', payload->>'object'),
         user_id = null
   where user_id = p_user_id
      or (p_stripe_customer_id is not null and payload->>'customer' = p_stripe_customer_id);
  delete from public.product_events where user_id = p_user_id;
  delete from public.client_errors  where user_id = p_user_id;
end;
$$;
revoke all on function public.scrub_user_data(uuid, text) from public, anon, authenticated;
grant execute on function public.scrub_user_data(uuid, text) to service_role;

-- Retención de telemetría (plazos PROPUESTOS; confirmar con asesor jurídico).
-- Programar con pg_cron o una Scheduled Function; esta migración NO la programa.
create or replace function public.purge_old_telemetry()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_events where created_at < now() - interval '13 months';
  delete from public.client_errors  where created_at < now() - interval '90 days';
  delete from public.rate_limits    where window_start < now() - interval '1 day';
end;
$$;
revoke all on function public.purge_old_telemetry() from public, anon, authenticated;
grant execute on function public.purge_old_telemetry() to service_role;
