import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ── Server-side price whitelist — NEVER trust a priceId/amount from
// the client. Local is a ONE-TIME purchase (mode:'payment'), Pro is an
// annual subscription (mode:'subscription') — per the business model:
// Local 6,99€ pago único, sin suscripción; Pro 14,99€/año.
const PRICE_MAP: Record<string, string> = {
  local: Deno.env.get('STRIPE_PRICE_LOCAL') || 'price_1U6GvUFWll222KpaM0pOY3g8',
  pro:   Deno.env.get('STRIPE_PRICE_PRO')   || 'price_1U5uNNFWll222Kpawefje59j',
};

// This function only ever talks to whichever Stripe mode matches the
// secret key that's configured. STRIPE_SECRET_KEY_TEST is checked
// first so this runs safely against test mode during Fase 3; falls
// back to STRIPE_SECRET_KEY (live) only if no test key is set.
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = new Stripe(STRIPE_KEY, {});

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
  const isSubscription = plan === 'pro';

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

  const applyProTrial = plan === 'pro' && profile?.plan !== 'pro' && profile?.pro_trial_used !== true;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success&plan=${plan}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { app: 'moneynest', user_id: user.id, plan },
      ...(isSubscription ? {
        subscription_data: {
          metadata: { app: 'moneynest', user_id: user.id, plan },
          ...(applyProTrial ? { trial_period_days: 7 } : {}),
        },
      } : {
        // One-time payment (Local): no subscription_data — Stripe
        // rejects that param outright in mode:'payment'. Identity is
        // still carried via metadata + client_reference_id above, and
        // stripe-webhook reads session.payment_intent for one-time
        // purchases (see handleCheckoutCompleted).
        payment_intent_data: {
          metadata: { app: 'moneynest', user_id: user.id, plan },
        },
      }),
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
