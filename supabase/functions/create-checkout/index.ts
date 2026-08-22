import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// This function only ever talks to whichever Stripe mode matches the
// secret key that's configured. STRIPE_SECRET_KEY_TEST is checked
// first; falls back to STRIPE_SECRET_KEY (live) only if no test key is
// set — which is the account's current real configuration (live keys
// configured, no test keys yet).
const usingTestKey = !!Deno.env.get('STRIPE_SECRET_KEY_TEST');
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = new Stripe(STRIPE_KEY, {});

// ── Server-side price whitelist — NEVER trust a priceId/amount from
// the client. Both plans are annual subscriptions: Local 6,99€/año,
// Pro 14,99€/año. CRITICAL: the fallback price IDs must match whichever
// Stripe mode is actually active — a test price ID sent with a live
// secret key (or vice versa) fails with "No such price", which is
// exactly what happens if STRIPE_PRICE_LOCAL/STRIPE_PRICE_PRO aren't
// set as explicit secrets and the account only has live keys configured.
const PRICE_MAP: Record<string, string> = {
  local: Deno.env.get('STRIPE_PRICE_LOCAL') || (usingTestKey ? 'price_1U5uN8FWll222KpaX0qENvX3' : 'price_1U68YVFWll222KpaCJ6WrKWg'),
  pro:   Deno.env.get('STRIPE_PRICE_PRO')   || (usingTestKey ? 'price_1U5uNNFWll222Kpawefje59j' : 'price_1U68YaFWll222Kpa4mynzdAp'),
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

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

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const origin = req.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'invalid_origin' }, 403, cors);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing_authorization' }, 401, cors);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'invalid_session' }, 401, cors);
  const user = userData.user;
  const userEmail = user.email ?? '';

  let plan: string;
  try {
    const body = await req.json();
    plan = String(body.plan ?? '');
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }
  if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, plan)) {
    return json({ error: 'invalid_plan' }, 400, cors);
  }
  const priceId = PRICE_MAP[plan];

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, plan, pro_trial_used')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if ((existing as Stripe.Customer).deleted) customerId = null;
    } catch {
      customerId = null;
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { app: 'moneynest', user_id: user.id },
    });
    customerId = customer.id;
  }

  // Trial period on Stripe's side only ever applies to Pro (Local has
  // never had a trial-then-charge flow) — unchanged plan logic.
  const applyProTrial = plan === 'pro' && profile?.plan !== 'pro' && profile?.pro_trial_used !== true;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success&plan=${plan}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { app: 'moneynest', user_id: user.id, plan },
      subscription_data: {
        metadata: { app: 'moneynest', user_id: user.id, plan },
        ...(applyProTrial ? { trial_period_days: 7 } : {}),
      },
    });

    // IMPORTANT: this function NEVER writes plan/entitlement to Supabase
    // itself. Returning here only hands the user a URL to pay at —
    // access is granted exclusively by stripe-webhook after Stripe
    // confirms the event, never by this call or by success_url.
    return json({ url: session.url }, 200, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stripe_error';
    return json({ error: message }, 500, cors);
  }
});
