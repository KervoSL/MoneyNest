import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-04-30',
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')              ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function logEvent(
  stripeEventId: string,
  eventType: string,
  payload: unknown,
  userId: string | null,
  error?: string,
) {
  await supabase.from('billing_events').insert({
    stripe_event_id: stripeEventId,
    event_type:      eventType,
    payload,
    user_id:         userId,
    processed:       !error,
    error:           error ?? null,
  });
}

async function resolveEmail(customer: string | Stripe.Customer | null): Promise<string> {
  if (!customer) return '';
  if (typeof customer !== 'string') return customer.email ?? '';
  const c = await stripe.customers.retrieve(customer);
  return (c as Stripe.Customer).email ?? '';
}

// ── handlers ────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email  = session.customer_email ?? session.customer_details?.email ?? '';
  const custId = typeof session.customer === 'string' ? session.customer : '';
  const plan   = session.metadata?.plan;

  const { data: profileId, error: profileErr } = await supabase
    .rpc('get_or_create_profile', { user_email: email });
  if (profileErr) throw profileErr;

  if (plan === 'local_lifetime') {
    const { error } = await supabase
      .rpc('activate_local_plan', { user_email: email, customer_id: custId });
    if (error) throw error;

    await supabase.from('purchases').insert({
      user_id:                    profileId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:   typeof session.payment_intent === 'string'
                                    ? session.payment_intent : null,
      stripe_customer_id:         custId,
      stripe_price_id:            session.metadata?.priceId ?? '',
      amount:                     session.amount_total ?? 699,
      currency:                   session.currency ?? 'eur',
      status:                     'completed',
      product_type:               'local_lifetime',
    });

  } else if (plan === 'pro_annual') {
    const subId = typeof session.subscription === 'string' ? session.subscription : '';

    const { error } = await supabase
      .rpc('activate_pro_plan', { user_email: email, subscription_id: subId });
    if (error) throw error;

    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      await supabase.from('subscriptions').upsert({
        user_id:                profileId,
        stripe_subscription_id: sub.id,
        stripe_customer_id:     custId,
        stripe_price_id:        sub.items.data[0]?.price.id ?? '',
        status:                 sub.status,
        current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
        cancel_at_period_end:   sub.cancel_at_period_end,
      }, { onConflict: 'stripe_subscription_id' });
    }
  }

  // ── Enviar email de confirmación ──────────────────────────────
  if (email) {
    await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        type: plan === 'local_lifetime' ? 'purchase_local' : 'purchase_pro',
        plan: plan,
      },
    });
  }
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const email  = await resolveEmail(sub.customer);
  const custId = typeof sub.customer === 'string' ? sub.customer : '';

  // ── Resolver user_id desde profiles ──────────────────────────
  let userId: string | null = null;
  if (email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    userId = profile?.id ?? null;
  }
  // ──────────────────────────────────────────────────────────────

  await supabase.from('subscriptions').upsert({
    user_id:                userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id:     custId,
    stripe_price_id:        sub.items.data[0]?.price.id ?? '',
    status:                 sub.status,
    current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
    cancel_at_period_end:   sub.cancel_at_period_end,
    canceled_at:            sub.canceled_at
                              ? new Date(sub.canceled_at * 1000).toISOString()
                              : null,
  }, { onConflict: 'stripe_subscription_id' });

  if (sub.status === 'canceled' || sub.status === 'unpaid') {
    await supabase.rpc('cancel_pro_plan', { user_email: email });
  }

  // Re-activate if subscription becomes active again after past_due
  if (sub.status === 'active') {
    await supabase.rpc('activate_pro_plan', {
      user_email:      email,
      subscription_id: sub.id,
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (!subId) return;

  // Mark subscription active (handles renewal after past_due)
  await supabase.from('subscriptions')
    .update({ status: 'active' })
    .eq('stripe_subscription_id', subId);

  // Ensure profile plan is still pro (renewal case)
  const email = await resolveEmail(invoice.customer);
  if (email) {
    await supabase.rpc('activate_pro_plan', {
      user_email:      email,
      subscription_id: subId,
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (subId) {
    await supabase.from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', subId);
  }
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  // Used as a fallback confirmation for local_lifetime one-time payments.
  // The checkout.session.completed event is the primary handler — this
  // ensures the purchase row is marked completed if the session event
  // was missed or arrived out of order.
  await supabase.from('purchases')
    .update({ status: 'completed' })
    .eq('stripe_payment_intent_id', pi.id)
    .eq('status', 'pending');
}

// ── Handler: aviso fin de trial (3 días antes) ────────────────
async function handleTrialWillEnd(sub: Stripe.Subscription) {
  const email = await resolveEmail(sub.customer);
  if (!email) return;

  // Llama a tu función send-email con tipo 'trial_ending'
  await supabase.functions.invoke('send-email', {
    body: {
      to: email,
      type: 'trial_ending',
      trialEnd: new Date(sub.trial_end! * 1000).toISOString(),
    },
  });
}

// ── Handler: reembolso → downgrade ───────────────────────────
async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!charge.payment_intent) return;

  // Buscar la compra en purchases y marcarla como refunded
  await supabase
    .from('purchases')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent_id', charge.payment_intent as string);

  // Si era un plan local, hacer downgrade a trial bloqueado
  const email = await resolveEmail(charge.customer);
  if (email) {
    await supabase
      .from('profiles')
      .update({ plan: 'locked_local', updated_at: new Date().toISOString() })
      .eq('email', email);
  }
}

// ── main ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  const sig = req.headers.get('stripe-signature');
  if (!sig) return json({ error: 'missing_signature' }, 400);

  let event: Stripe.Event;
  let rawBody: string;

  try {
    rawBody = await req.text();
    event   = await stripe.webhooks.constructEventAsync(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'invalid_signature' }, 400);
  }

  // ── Idempotency check ─────────────────────────────────────────
  const { data: existingEvent } = await supabase
    .from('billing_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    return json({ received: true, skipped: 'duplicate' });
  }
  // ─────────────────────────────────────────────────────────────

  let handlerError: string | undefined;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
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

  // Try to resolve user_id from customer email for audit log
  let auditUserId: string | null = null;
  try {
    const obj = event.data.object as Record<string, unknown>;
    const custEmail =
      (obj.customer_email as string) ||
      ((obj.customer_details as Record<string, string>)?.email) ||
      (obj.email as string) || '';
    if (custEmail) {
      const { data: p } = await supabase
        .from('profiles').select('id').eq('email', custEmail).maybeSingle();
      auditUserId = p?.id ?? null;
    }
  } catch (_) {}

  await logEvent(event.id, event.type, event.data.object, auditUserId, handlerError);

  if (handlerError) return json({ error: handlerError }, 500);
  return json({ received: true });
});
