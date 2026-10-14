import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripeLive = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {});
const stripeTest = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? '', {});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const ALLOWED_ORIGINS = new Set([
  'https://money-nest-nk2u.vercel.app',
  'https://moneynest.es',
  'https://www.moneynest.es',
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

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing_authorization' }, 401, cors);

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'invalid_session' }, 401, cors);
  const userId = userData.user.id;

  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_key: `delete-account:${userId}`,
    p_max_attempts: 3,
    p_window_seconds: 3600,
  });
  if (allowed === false) return json({ error: 'rate_limited' }, 429, cors);

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  // H-05: cancelar TODAS las suscripciones vivas antes de borrar nada, y no
  // seguir adelante si una cancelación falla de verdad. Un cliente de Stripe
  // existe solo en un modo (test o live): "resource_missing" en el otro modo es
  // normal y no es un error; cualquier otro fallo aborta el borrado.
  const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];
  const stripeErrors: string[] = [];
  let cancelled = 0;
  if (profile?.stripe_customer_id) {
    const modes: [string, Stripe | null][] = [
      ['test', Deno.env.get('STRIPE_SECRET_KEY_TEST') ? stripeTest : null],
      ['live', Deno.env.get('STRIPE_SECRET_KEY') ? stripeLive : null],
    ];
    for (const [label, stripe] of modes) {
      if (!stripe) continue;
      try {
        const cust = await stripe.customers.retrieve(profile.stripe_customer_id);
        if ((cust as Stripe.DeletedCustomer).deleted) continue;
        const subs = await stripe.subscriptions
          .list({ customer: profile.stripe_customer_id, status: 'all', limit: 100 })
          .autoPagingToArray({ limit: 1000 });
        for (const sub of subs) {
          if (!LIVE_STATUSES.includes(sub.status)) continue;
          await stripe.subscriptions.cancel(sub.id);
          cancelled++;
        }
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'resource_missing') continue; // el cliente no existe en este modo
        stripeErrors.push(`${label}: ${err instanceof Error ? err.message : 'unknown_stripe_error'}`);
      }
    }
    if (stripeErrors.length) {
      // No se borra nada: el usuario puede reintentar o contactar con soporte.
      return json({ error: 'stripe_cancellation_failed', cancelled, stripeErrors }, 502, cors);
    }
  }

  // H-11: borrar el cliente de Stripe (ya sin suscripciones vivas) y depurar los
  // datos personales que de otro modo sobrevivirían a la eliminación.
  // El historial de cobros/facturas permanece en Stripe (obligación contable).
  const deleteErrors: string[] = [];
  if (profile?.stripe_customer_id) {
    for (const [label, stripe] of [
      ['test', Deno.env.get('STRIPE_SECRET_KEY_TEST') ? stripeTest : null],
      ['live', Deno.env.get('STRIPE_SECRET_KEY') ? stripeLive : null],
    ] as [string, Stripe | null][]) {
      if (!stripe) continue;
      try {
        await stripe.customers.del(profile.stripe_customer_id);
      } catch (err) {
        if ((err as { code?: string })?.code === 'resource_missing') continue;
        deleteErrors.push(`${label}: ${err instanceof Error ? err.message : 'unknown_stripe_error'}`);
      }
    }
  }
  const { error: scrubErr } = await supabase.rpc('scrub_user_data', {
    p_user_id: userId,
    p_stripe_customer_id: profile?.stripe_customer_id ?? null,
  });
  if (scrubErr) deleteErrors.push(`scrub: ${scrubErr.message}`);
  if (deleteErrors.length) {
    // Aún no se ha borrado el perfil: el usuario puede reintentar sin perder la cuenta.
    return json({ error: 'cleanup_failed', cleanupErrors: deleteErrors }, 502, cors);
  }

  await supabase.from('subscriptions').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);

  const { error: deleteUserErr } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserErr) {
    return json({ error: 'user_deletion_failed', detail: deleteUserErr.message }, 500, cors);
  }

  return json({ ok: true, cancelledSubscriptions: cancelled }, 200, cors);
});
