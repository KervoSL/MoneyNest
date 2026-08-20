-- Local is a ONE-TIME purchase (6,99€, sin suscripción) — activated
-- from a checkout.session.completed with mode:'payment', never through
-- the subscriptions table (there is no recurring subscription object
-- for a one-time payment). Records the purchase in `purchases` (schema
-- already designed for exactly this) and updates profiles.plan.
create or replace function public.activate_local_purchase(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_stripe_price_id text,
  p_amount integer,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  insert into public.purchases (
    user_id, stripe_checkout_session_id, stripe_payment_intent_id,
    stripe_customer_id, stripe_price_id, amount, currency, status, product_type, purchased_at
  ) values (
    p_user_id, p_stripe_checkout_session_id, p_stripe_payment_intent_id,
    p_stripe_customer_id, p_stripe_price_id, p_amount, p_currency, 'paid', 'local_lifetime', now()
  )
  on conflict (stripe_checkout_session_id) do nothing;

  update public.profiles
  set plan = 'local', stripe_customer_id = p_stripe_customer_id, updated_at = now()
  where id = p_user_id;

  return found;
end;
$$;

revoke execute on function public.activate_local_purchase(uuid, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.activate_local_purchase(uuid, text, text, text, text, integer, text) to service_role;
