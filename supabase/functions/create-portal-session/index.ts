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

  // NOTE: the origin allowlist check that used to sit here (rejecting
  // any request whose Origin header wasn't the exact production URL)
  // was removed. This endpoint is already gated by a real, verified
  // JWT above — the origin check added no meaningful security on top
  // of that (the only thing a caller can do here is open a Stripe
  // portal session for their OWN account), while it could silently
  // reject legitimate requests whose Origin header is missing or
  // different than expected (e.g. some installed-PWA/webview
  // contexts don't always send Origin the same way a normal browser
  // tab does). Losing this check trades a low-value guard for higher
  // reliability of a feature real paying users depend on.

  // Try test mode first (Fase 5 default), fall back to live — whichever
  // Stripe mode actually has this customer id succeeds; the other
  // throws a clean 'No such customer' we can safely ignore. Errors from
  // BOTH modes are kept (not swallowed) so a genuine failure (e.g. this
  // customer's mode has no Customer Portal configured yet) is visible
  // in the response instead of collapsing into an opaque generic error.
  let portalUrl: string | null = null;
  const modeErrors: string[] = [];
  for (const [label, stripe] of [['test', stripeTest], ['live', stripeLive]] as const) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${req.headers.get('origin') || 'https://money-nest-nk2u.vercel.app'}/?portal=return`,
      });
      portalUrl = session.url;
      break;
    } catch (err) {
      modeErrors.push(`${label}: ${err instanceof Error ? err.message : 'unknown_error'}`);
    }
  }

  if (!portalUrl) return json({ error: 'portal_unavailable', detail: modeErrors.join(' | ') }, 500, cors);
  return json({ url: portalUrl }, 200, cors);
});
