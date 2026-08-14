// ════════════════════════════════════════════════════════════════
// check-license
// Verifica si un email tiene una licencia REAL asociada, consultando
// la misma tabla `profiles` que ya actualiza stripe-webhook al
// completar una compra (activate_local_plan / activate_pro_plan).
// No crea ninguna estructura de datos nueva — es un simple lookup de
// solo lectura sobre la arquitectura de facturación ya existente.
// ════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')              ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  let email: string;
  try {
    const body = await req.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: 'invalid_email' }, 400);
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    const licensedPlans = ['local', 'pro'];
    const found = !!profile && licensedPlans.includes(profile.plan);

    return json({ found, plan: found ? profile.plan : null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'lookup_error' }, 500);
  }
});
