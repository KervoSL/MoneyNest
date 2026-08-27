import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const ALLOWED_EVENTS = new Set([
  'preonboarding_demo_started',
  'preonboarding_demo_blocked_action',
  'preonboarding_signup_clicked',
  'onboarding_step_reached',
  'onboarding_completed',
  'plan_selected',
  'payment_modal_opened',
  'payment_succeeded',
  'payment_failed',
  'trial_expired',
  'account_deleted',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_key: `track-event:${ip}`,
    p_max_attempts: 60,
    p_window_seconds: 300,
  });
  if (allowed === false) return json({ ok: false, reason: 'rate_limited' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const eventName = String(body.event ?? '');
  const sessionId = String(body.sessionId ?? '');
  if (!ALLOWED_EVENTS.has(eventName)) return json({ error: 'invalid_event' }, 400);
  if (!sessionId) return json({ error: 'missing_session_id' }, 400);

  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (jwt) {
    const { data: userData } = await supabase.auth.getUser(jwt);
    userId = userData?.user?.id ?? null;
  }

  const metadata = (body.metadata && typeof body.metadata === 'object') ? body.metadata : null;
  const metadataStr = metadata ? JSON.stringify(metadata).slice(0, 1000) : null;

  const { error } = await supabase.from('product_events').insert({
    event_name: eventName,
    session_id: sessionId.slice(0, 100),
    user_id: userId,
    metadata: metadataStr ? JSON.parse(metadataStr) : null,
  });

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true }, 200);
});
