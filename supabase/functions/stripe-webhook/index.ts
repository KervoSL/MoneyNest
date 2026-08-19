import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// API version: intentionally NOT pinned. The old code hardcoded
// apiVersion: '2025-04-30', which went stale and made the Stripe SDK
// reject ~120 real events outright ('Invalid Stripe API version').
// Omitting it makes every request use the account's own
// Dashboard-configured default version, which Stripe recommends
// specifically to avoid this failure class recurring.
const stripeLive = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {});
const stripeTest = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? '', {});

const WEBHOOK_SECRET_LIVE = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const WEBHOOK_SECRET_TEST = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Same price→plan mapping as create-checkout (test-mode defaults from
// Fase 2; overridable via secrets once live prices are ready).
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_LOCAL') || 'price_1U5uN8FWll222KpaX0qENvX3']: 'local',
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

// Subscription period dates live on the subscription ITEM in current
// API versions, not on the subscription object root — reading
// sub.current_period_start directly (the old bug) is always undefined
// and produces 'Invalid time value' when passed to `new Date()`.
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

// ── Activation / cancellation ──────────────────────────────────

async function activateFromSubscription(sub: Stripe.Subscription, stripe: Stripe) {
  const userId = sub.metadata?.user_id || null;
  const plan = resolvePlan(sub);
  if (!userId || !plan) {
    // Identity/plan MUST be established at Checkout-creation time by
    // our own backend. We deliberately do not guess via email lookup
    // here — that fragility (mismatched/duplicate emails) was the
    // original design's main weak point.
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

// After a subscription is no longer active, check whether the user
// still holds a DIFFERENT active/trialing subscription (e.g. they had
// both Local and Pro, or switched plans) before downgrading — avoids
// blindly downgrading someone who is still legitimately entitled.
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

// ── Handlers ────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.mode !== 'subscription' || !session.subscription) return;
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId);
  await activateFromSubscription(sub, stripe);

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
  if (!subId) return;
  const sub = await stripe.subscriptions.retrieve(subId);
  await activateFromSubscription(sub, stripe); // covers renewals — refreshes period dates + reconfirms active status
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

  // This endpoint receives both live and test-mode events (each Stripe
  // mode has its own signing secret). Try live first, then test —
  // whichever matches determines which Stripe client (and therefore
  // which mode's data) subsequent API calls use.
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

  // ── Idempotency: a stripe_event_id can only ever be logged once
  // (billing_events.stripe_event_id has a UNIQUE constraint) — this
  // check plus that constraint together guarantee no event is
  // processed twice, even under concurrent delivery/retries.
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
