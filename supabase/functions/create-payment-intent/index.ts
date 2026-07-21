import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')              ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const PRICE_LOCAL    = 'price_1TTJCBFWll222Kpazyvo4A4W';
const PRICE_PRO      = 'price_1TTJD3FWll222KpaJ1T6OG6C';
const ALLOWED_PRICES = new Set([PRICE_LOCAL, PRICE_PRO]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function findOrCreateCustomer(email: string): Promise<Stripe.Customer> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('email', email)
    .single();

  if (profile?.stripe_customer_id) {
    const c = await stripe.customers.retrieve(profile.stripe_customer_id);
    if (!c.deleted) return c as Stripe.Customer;
  }

  return await stripe.customers.create({
    email,
    metadata: { app: 'moneynest' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  let priceId: string, email: string;
  try {
    const body = await req.json();
    priceId = body.priceId ?? '';
    email   = body.email   ?? '';
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!ALLOWED_PRICES.has(priceId)) return json({ error: 'invalid_price' }, 400);

  try {
    if (priceId === PRICE_LOCAL) {
      const pi = await stripe.paymentIntents.create({
        amount: 699,   // 6,99 € — MoneyNest pago único
        currency: 'eur',
        ...(email ? { receipt_email: email } : {}),
        metadata: { plan: 'local_lifetime', email },
        automatic_payment_methods: { enabled: true },
      });
      return json({ clientSecret: pi.client_secret, type: 'payment' });
    }

    // PRO — subscription with 7-day trial
    const customer = await findOrCreateCustomer(email);

    // Prevent duplicate active/trialing subscriptions
    const existing = await stripe.subscriptions.list({
      customer: customer.id,
      price: PRICE_PRO,
      limit: 1,
    });
    const activeSub = existing.data.find(
      (s) => s.status === 'active' || s.status === 'trialing',
    );
    if (activeSub) {
      return json({ error: 'already_subscribed' }, 409);
    }

    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PRICE_PRO }],
      trial_period_days: 7,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['pending_setup_intent', 'latest_invoice.payment_intent'],
      metadata: { plan: 'pro_annual', email },
    });

    const pendingSetup   = sub.pending_setup_intent as Stripe.SetupIntent | null;
    const latestInvoice  = sub.latest_invoice       as Stripe.Invoice     | null;
    const paymentIntent  = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;

    const clientSecret = pendingSetup?.client_secret ?? paymentIntent?.client_secret;
    if (!clientSecret) throw new Error('no_client_secret');

    return json({
      clientSecret,
      type:           pendingSetup ? 'setup' : 'payment',
      subscriptionId: sub.id,
    });

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'stripe_error' }, 500);
  }
});
