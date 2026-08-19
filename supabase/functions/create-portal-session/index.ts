import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// apiVersion intentionally omitted — see stripe-webhook for why a
// hardcoded version silently goes stale.
const stripeLive = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {});
const stripeTest = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? '', {});

const supabase = createClient(
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

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing_authorization' }, 401, cors);

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'invalid_session' }, 401, cors);

  // Look up by id (the real, stable primary key) rather than email —
  // stricter and avoids any edge case around email changes/duplicates.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return json({ error: 'no_customer', message: 'No tienes ninguna suscripción asociada todavía.' }, 404, cors);
  }

  const origin = req.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'invalid_origin' }, 403, cors);

  // Try test mode first (Fase 5 default), fall back to live — whichever
  // Stripe mode actually has this customer id succeeds; the other
  // throws a clean 'No such customer' we can safely ignore.
  let portalUrl: string | null = null;
  for (const stripe of [stripeTest, stripeLive]) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${origin}/?portal=return`,
      });
      portalUrl = session.url;
      break;
    } catch { /* not this mode — try the other */ }
  }

  if (!portalUrl) return json({ error: 'portal_unavailable' }, 500, cors);
  return json({ url: portalUrl }, 200, cors);
});
