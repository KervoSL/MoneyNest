import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// apiVersion intentionally omitted — see stripe-webhook for why a
// hardcoded version silently goes stale.
const usingTestKey = !!Deno.env.get('STRIPE_SECRET_KEY_TEST');
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '', {});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')              ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Both plans are annual subscriptions: Local 6,99€/año, Pro 14,99€/año.
// CRITICAL: fallback price IDs must match whichever Stripe mode the
// active secret key belongs to — mixing a test price with a live key
// (or vice versa) fails with "No such price". This is exactly what
// happens if STRIPE_PRICE_LOCAL/STRIPE_PRICE_PRO aren't set explicitly
// and only live keys are configured (the account's current real state).
const PRICE_LOCAL = Deno.env.get('STRIPE_PRICE_LOCAL') || (usingTestKey ? 'price_1U5uN8FWll222KpaX0qENvX3' : 'price_1U68YVFWll222KpaCJ6WrKWg');
const PRICE_PRO   = Deno.env.get('STRIPE_PRICE_PRO')   || (usingTestKey ? 'price_1U5uNNFWll222Kpawefje59j' : 'price_1U68YaFWll222Kpa4mynzdAp');
const ALLOWED_PRICES = new Set([PRICE_LOCAL, PRICE_PRO]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Inlined from _shared/stripe-promo.ts (deploy tool couldn't resolve
// the relative import) — always validated server-side against Stripe,
// never trusting a client-claimed discount.
async function validatePromoCode(code: string) {
  const trimmed = (code || '').trim();
  if (!trimmed) return { valid: false as const, reason: 'invalid' as const };
  const list = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1, expand: ['data.coupon'] });
  const promo = list.data[0];
  if (!promo) return { valid: false as const, reason: 'invalid' as const };
  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) return { valid: false as const, reason: 'expired' as const };
  if (typeof promo.max_redemptions === 'number' && promo.times_redeemed >= promo.max_redemptions) return { valid: false as const, reason: 'exhausted' as const };
  const coupon = promo.coupon as Stripe.Coupon | null;
  if (!coupon || coupon.valid === false) return { valid: false as const, reason: 'not_applicable' as const };
  return { valid: true as const, promotionCodeId: promo.id, percentOff: coupon.percent_off ?? null, amountOff: coupon.amount_off ?? null };
}
function computeDiscount(originalAmount: number, result: { percentOff?: number | null; amountOff?: number | null }) {
  let discountAmount = 0;
  if (result.percentOff) discountAmount = Math.round(originalAmount * (result.percentOff / 100));
  else if (typeof result.amountOff === 'number') discountAmount = Math.min(result.amountOff, originalAmount);
  return { discountAmount, finalAmount: Math.max(0, originalAmount - discountAmount) };
}

async function findOrCreateCustomer(userId: string, email: string): Promise<Stripe.Customer> {
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
  if (profile?.stripe_customer_id) {
    try {
      const c = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!(c as Stripe.DeletedCustomer).deleted) return c as Stripe.Customer;
    } catch { /* stale/cross-mode id — recreate below */ }
  }
  return await stripe.customers.create({ email, metadata: { app: 'moneynest', user_id: userId } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing_authorization' }, 401);
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'invalid_session' }, 401);
  if (!userData.user.email) return json({ error: 'email_required', message: 'Añade un email a tu cuenta antes de comprar.' }, 400);
  const userId = userData.user.id;
  const email = userData.user.email;

  let priceId: string, promoCode: string | undefined;
  try {
    const body = await req.json();
    priceId   = body.priceId   ?? '';
    promoCode = body.promoCode || undefined;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!ALLOWED_PRICES.has(priceId)) return json({ error: 'invalid_price' }, 400);

  let promo: Awaited<ReturnType<typeof validatePromoCode>> | null = null;
  if (promoCode) {
    promo = await validatePromoCode(promoCode);
    if (!promo.valid) return json({ error: 'invalid_promo_code', reason: promo.reason }, 400);
  }

  try {
    // Amount always re-derived from the live Stripe Price object —
    // never a hardcoded local constant that could drift from Stripe.
    const priceObj = await stripe.prices.retrieve(priceId);
    const baseAmount = priceObj.unit_amount ?? 0;

    // Both Local and Pro are subscriptions now — same creation path,
    // only the trial (Pro-only, unchanged plan logic) differs.
    const customer = await findOrCreateCustomer(userId, email);
    const isPro = priceId === PRICE_PRO;

    if (isPro) {
      const existing = await stripe.subscriptions.list({ customer: customer.id, price: PRICE_PRO, limit: 1 });
      const activeSub = existing.data.find((s) => s.status === 'active' || s.status === 'trialing');
      if (activeSub) return json({ error: 'already_subscribed' }, 409);
    }

    const { data: profile } = await supabase.from('profiles').select('plan, pro_trial_used').eq('id', userId).maybeSingle();
    const applyProTrial = isPro && profile?.plan !== 'pro' && profile?.pro_trial_used !== true;

    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      ...(applyProTrial ? { trial_period_days: 7 } : {}),
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription', payment_method_types: ['card'] },
      ...(promo ? { discounts: [{ promotion_code: promo.promotionCodeId! }] } : {}),
      expand: ['pending_setup_intent', 'latest_invoice.payment_intent'],
      metadata: { app: 'moneynest', plan: isPro ? 'pro' : 'local', user_id: userId, ...(promo ? { promotion_code: promo.promotionCodeId ?? '' } : {}) },
    });

    const pendingSetup  = sub.pending_setup_intent as Stripe.SetupIntent | null;
    const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;
    const clientSecret  = pendingSetup?.client_secret ?? paymentIntent?.client_secret;
    if (!clientSecret) throw new Error('no_client_secret');

    const discount = promo ? computeDiscount(baseAmount, promo) : { discountAmount: 0, finalAmount: baseAmount };
    return json({
      clientSecret, type: pendingSetup ? 'setup' : 'payment', subscriptionId: sub.id,
      pricing: { originalAmount: baseAmount, discountAmount: discount.discountAmount, finalAmount: discount.finalAmount, currency: priceObj.currency },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'stripe_error' }, 500);
  }
});
