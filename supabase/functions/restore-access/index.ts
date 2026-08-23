import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Real restore flow: Usuario autenticado → Supabase → Stripe Customer
// → Subscription → Entitlement. Only ever looks up Stripe by the
// caller's OWN verified email (from their real Supabase JWT) — a
// client can never supply a customer id or someone else's email here,
// closing exactly the 'vincular un Stripe Customer ajeno' risk this
// phase calls out.
const stripeLive = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {});
const stripeTest = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? '', {});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_LOCAL') || 'price_1U5uN8FWll222KpaX0qENvX3']: 'local',
  [Deno.env.get('STRIPE_PRICE_PRO')   || 'price_1U5uNNFWll222Kpawefje59j']: 'pro',
  'price_1U68YVFWll222KpaCJ6WrKWg': 'local', // live
  'price_1U68YaFWll222Kpa4mynzdAp': 'pro',   // live
};

const ALLOWED_ORIGINS = new Set([
  'https://money-nest-nk2u.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function periodDates(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0];
  const start = item?.current_period_start ?? (sub as unknown as Record<string, number>).current_period_start;
  const end   = item?.current_period_end   ?? (sub as unknown as Record<string, number>).current_period_end;
  return {
    start: typeof start === 'number' ? new Date(start * 1000).toISOString() : null,
    end:   typeof end   === 'number' ? new Date(end   * 1000).toISOString() : null,
  };
}

async function findActiveSubscription(stripe: Stripe, email: string) {
  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    if (customer.deleted) continue;
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 });
    const active = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
    if (active) return { customer, subscription: active };
  }
  return null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing_authorization' }, 401, cors);

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user?.email) return json({ error: 'invalid_session' }, 401, cors);
  const userId = userData.user.id;
  const email = userData.user.email;

  // Server-side rate limit — this endpoint makes real (costly) calls to
  // Stripe's customer/subscription search on every invocation, so it's
  // an easy target for hammering. 6 attempts per user per 10 minutes.
  const { data: allowed, error: rlError } = await supabase.rpc('check_rate_limit', {
    p_key: `restore-access:${userId}`,
    p_max_attempts: 6,
    p_window_seconds: 600,
  });
  if (!rlError && allowed === false) {
    return json({ error: 'rate_limited', message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429, cors);
  }

  // Try both Stripe modes — whichever one has a real customer for this
  // verified email wins. Harmless no-op if a mode's secret isn't set.
  let found = null;
  let plan: string | null = null;
  for (const stripe of [stripeTest, stripeLive]) {
    try {
      const result = await findActiveSubscription(stripe, email);
      if (result) {
        const p = PRICE_TO_PLAN[result.subscription.items.data[0]?.price?.id ?? ''];
        if (p) { found = result; plan = p; break; }
      }
    } catch { /* this mode's key not configured — skip */ }
  }

  if (!found || !plan) {
    return json({ restored: false, message: 'No se encontró ninguna suscripción activa para este email.' }, 200, cors);
  }

  const { start, end } = periodDates(found.subscription);
  const { error: rpcError } = await supabase.rpc('activate_subscription_plan', {
    p_user_id: userId,
    p_plan: plan,
    p_stripe_customer_id: found.customer.id,
    p_stripe_subscription_id: found.subscription.id,
    p_stripe_price_id: found.subscription.items.data[0]?.price?.id ?? '',
    p_status: found.subscription.status,
    p_current_period_start: start,
    p_current_period_end: end,
    p_cancel_at_period_end: found.subscription.cancel_at_period_end,
  });
  if (rpcError) return json({ error: rpcError.message }, 500, cors);

  return json({ restored: true, plan }, 200, cors);
});
