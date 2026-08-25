import { createClient } from 'npm:@supabase/supabase-js@2';

// Receives client-side JS errors and unhandled promise rejections so
// real production failures are visible without depending on users
// reporting them manually. Never blocks or throws on the client side
// if this fails — error logging must never itself break the app.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_key: `log-error:${ip}`,
    p_max_attempts: 20,
    p_window_seconds: 300,
  });
  if (allowed === false) return json({ ok: false, reason: 'rate_limited' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const message = String(body.message ?? '').slice(0, 2000);
  if (!message) return json({ error: 'missing_message' }, 400);

  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (jwt) {
    const { data: userData } = await supabase.auth.getUser(jwt);
    userId = userData?.user?.id ?? null;
  }

  const { error } = await supabase.from('client_errors').insert({
    message,
    stack: body.stack ? String(body.stack).slice(0, 8000) : null,
    url: body.url ? String(body.url).slice(0, 500) : null,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    app_version: body.appVersion ? String(body.appVersion).slice(0, 20) : null,
    user_id: userId,
    fingerprint: body.fingerprint ? String(body.fingerprint).slice(0, 200) : null,
  });

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true }, 200);
});
