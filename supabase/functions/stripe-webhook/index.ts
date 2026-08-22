import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripeLive = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {});
const stripeTest = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? '', {});

const WEBHOOK_SECRET_LIVE = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const WEBHOOK_SECRET_TEST = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Local = one-time purchase (mode:'payment', both via Checkout AND via
// the embedded PaymentIntent flow), Pro = annual subscription.
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_LOCAL') || 'price_1U6GvUFWll222KpaM0pOY3g8']: 'local',
  [Deno.env.get('STRIPE_PRICE_PRO')   || 'price_1U5uNNFWll222Kpawefje59j']: 'pro',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function periodDates(sub: Stripe.Subscription): { start: string | null; end: string | null } {
  const item = sub.items?.data?.[0];
  const start = item?.current_period_start ?? (sub as unknown as Record<string, number>).current_period_start;
  const end   = item?.current_period_end   ?? (sub as unknown as Record<string, number>).current_period_end;
  return {
    start: typeof start === 'number' ? new Date(start * 1000).toISOString() : null,
    end:   typeof end   === 'number' ? new Date(end   * 1000).toISOString() : null,
  };
}

function resolvePlan(sub: Stripe.Subscription): string | null {
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === 'local' || metaPlan === 'pro') return metaPlan;
  const priceId = sub.items?.data?.[0]?.price?.id;
  return priceId ? PRICE_TO_PLAN[priceId] ?? null : null;
}

async function logEvent(stripeEventId: string, eventType: string, payload: unknown, userId: string | null, error?: string) {
  await supabase.from('billing_events').insert({
    stripe_event_id: stripeEventId, event_type: eventType, payload,
    user_id: userId, processed: !error, error: error ?? null,
  });
}

// ── Subscription (Pro) activation / cancellation ──────────────────

async function activateFromSubscription(sub: Stripe.Subscription, stripe: Stripe) {
  const userId = sub.metadata?.user_id || null;
  const plan = resolvePlan(sub);
  if (!userId || !plan) {
    throw new Error(`cannot resolve user_id/plan for subscription ${sub.id} (metadata: ${JSON.stringify(sub.metadata)})`);
  }
  const { start, end } = periodDates(sub);
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? '';

  const { error } = await supabase.rpc('activate_subscription_plan', {
    p_user_id: userId,
    p_plan: plan,
    p_stripe_customer_id: custId,
    p_stripe_subscription_id: sub.id,
    p_stripe_price_id: sub.items?.data?.[0]?.price?.id ?? '',
    p_status: sub.status,
    p_current_period_start: start,
    p_current_period_end: end,
    p_cancel_at_period_end: sub.cancel_at_period_end,
  });
  if (error) throw error;

  if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
    await reevaluateAfterLoss(userId, sub.id);
  }
}

async function reevaluateAfterLoss(userId: string, endedSubscriptionId: string) {
  const { data: others } = await supabase
    .from('subscriptions')
    .select('stripe_price_id, status')
    .eq('user_id', userId)
    .neq('stripe_subscription_id', endedSubscriptionId)
    .in('status', ['active', 'trialing']);

  const stillActivePlan = others?.map(o => PRICE_TO_PLAN[o.stripe_price_id]).find(Boolean);

  await supabase.from('profiles')
    .update({ plan: stillActivePlan ?? 'locked_local', updated_at: new Date().toISOString() })
    .eq('id', userId);
}

// ── One-time purchase (Local) activation — shared by both the
// Checkout Session flow AND the embedded PaymentIntent flow ─────────

async function activateLocalOneTime(params: {
  userId: string; customerId: string; checkoutSessionId: string;
  paymentIntentId: string; priceId: string; amount: number; currency: string;
}) {
  const { error } = await supabase.rpc('activate_local_purchase', {
    p_user_id: params.userId,
    p_stripe_customer_id: params.customerId,
    p_stripe_checkout_session_id: params.checkoutSessionId,
    p_stripe_payment_intent_id: params.paymentIntentId,
    p_stripe_price_id: params.priceId,
    p_amount: params.amount,
    p_currency: params.currency,
  });
  if (error) throw error;
}

async function activateFromOneTimePurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  if (!userId) {
    throw new Error(`cannot resolve user_id for checkout session ${session.id} (metadata: ${JSON.stringify(session.metadata)})`);
  }
  const custId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? '';
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';
  const priceId = Deno.env.get('STRIPE_PRICE_LOCAL') || 'price_1U6GvUFWll222KpaM0pOY3g8';

  await activateLocalOneTime({
    userId, customerId: custId, checkoutSessionId: session.id,
    paymentIntentId, priceId, amount: session.amount_total ?? 699, currency: session.currency ?? 'eur',
  });
}

// The embedded MNPayment flow (create-payment-intent) creates a bare
// PaymentIntent directly — no Checkout Session exists at all for this
// path, so this is the ONLY place that can activate Local when bought
// this way. Previously MISSING entirely: this event was arriving
// (already subscribed on the live webhook) but had no handler, so a
// real embedded-flow Local purchase would charge the customer and
// never activate their plan.
async function activateFromPaymentIntent(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.plan !== 'local') return; // Pro never uses this flow (subscriptions only)
  const userId = pi.metadata?.user_id || null;
  if (!userId) {
    throw new Error(`cannot resolve user_id for payment_intent ${pi.id} (metadata: ${JSON.stringify(pi.metadata)})`);
  }
  const custId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id ?? '';
  const priceId = Deno.env.get('STRIPE_PRICE_LOCAL') || 'price_1U6GvUFWll222KpaM0pOY3g8';

  // Use the payment_intent id itself as the idempotency key (in place
  // of a checkout session id, which doesn't exist for this flow) —
  // activate_local_purchase's ON CONFLICT DO NOTHING still guarantees
  // this can't double-insert if the event is ever redelivered.
  await activateLocalOneTime({
    userId, customerId: custId, checkoutSessionId: `pi_flow_${pi.id}`,
    paymentIntentId: pi.id, priceId, amount: pi.amount ?? 699, currency: pi.currency ?? 'eur',
  });
}

// ── Handlers ────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.mode === 'payment') {
    // Local via Checkout Session: one-time purchase, no subscription
    // object involved at all.
    await activateFromOneTimePurchase(session);
  } else if (session.mode === 'subscription' && session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    await activateFromSubscription(sub, stripe);
  } else {
    return;
  }

  const email = session.customer_email ?? session.customer_details?.email ?? '';
  if (email) {
    await supabase.functions.invoke('send-email', {
      body: { to: email, type: session.metadata?.plan === 'pro' ? 'purchase_pro' : 'purchase_local', plan: session.metadata?.plan },
    });
  }
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription, stripe: Stripe) {
  await activateFromSubscription(sub, stripe);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, stripe: Stripe) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return; // one-time payments don't have an associated subscription invoice
  const sub = await stripe.subscriptions.retrieve(subId);
  await activateFromSubscription(sub, stripe);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (subId) {
    await supabase.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subId);
  }
}

async function handleTrialWillEnd(sub: Stripe.Subscription) {
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const { data: profile } = await supabase.from('profiles').select('email').eq('stripe_customer_id', custId).maybeSingle();
  if (profile?.email) {
    await supabase.functions.invoke('send-email', { body: { to: profile.email, type: 'trial_ending', trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null } });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const custId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  if (!custId) return;
  await supabase.from('profiles').update({ plan: 'locked_local', updated_at: new Date().toISOString() }).eq('stripe_customer_id', custId);
}

// ── Main ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const sig = req.headers.get('stripe-signature');
  if (!sig) return json({ error: 'missing_signature' }, 400);

  const rawBody = await req.text();

  let event: Stripe.Event;
  let stripeForThisEvent: Stripe;
  try {
    event = await stripeLive.webhooks.constructEventAsync(rawBody, sig, WEBHOOK_SECRET_LIVE);
    stripeForThisEvent = stripeLive;
  } catch {
    try {
      event = await stripeTest.webhooks.constructEventAsync(rawBody, sig, WEBHOOK_SECRET_TEST);
      stripeForThisEvent = stripeTest;
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'invalid_signature' }, 400);
    }
  }

  const { data: existingEvent } = await supabase.from('billing_events').select('id').eq('stripe_event_id', event.id).maybeSingle();
  if (existingEvent) return json({ received: true, skipped: 'duplicate' });

  let handlerError: string | undefined;
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripeForThisEvent);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription, stripeForThisEvent);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, stripeForThisEvent);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'payment_intent.succeeded':
        // Local purchased via the embedded MNPayment flow (no Checkout
        // Session at all for this path) — the only place that activates
        // that specific flow. No-ops harmlessly for a Pro subscription's
        // own payment_intent.succeeded (metadata.plan !== 'local').
        await activateFromPaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }
  } catch (err) {
    handlerError = err instanceof Error ? err.message : 'handler_error';
  }

  let auditUserId: string | null = null;
  try {
    const obj = event.data.object as Record<string, unknown>;
    auditUserId = (obj.metadata as Record<string, string>)?.user_id ?? null;
  } catch { /* best-effort only */ }

  await logEvent(event.id, event.type, event.data.object, auditUserId, handlerError);

  if (handlerError) return json({ error: handlerError }, 500);
  return json({ received: true });
});
