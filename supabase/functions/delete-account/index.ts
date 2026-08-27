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

  const stripeErrors: string[] = [];
  if (profile?.stripe_customer_id) {
    for (const stripe of [stripeTest, stripeLive]) {
      try {
        const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 10 });
        for (const sub of subs.data) {
          if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (err) {
        stripeErrors.push(err instanceof Error ? err.message : 'unknown_stripe_error');
      }
    }
  }

  await supabase.from('subscriptions').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);

  const { error: deleteUserErr } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserErr) {
    return json({ error: 'user_deletion_failed', detail: deleteUserErr.message, stripeErrors }, 500, cors);
  }

  return json({ ok: true, stripeErrors: stripeErrors.length ? stripeErrors : undefined }, 200, cors);
});
