import { createClient } from 'npm:@supabase/supabase-js@2';

// Read-only, side-effect-free lookup: tells the frontend whether an
// email has a paid plan on file, so the 'Restaurar acceso' modal can
// show a helpful message BEFORE asking the user to verify ownership.
// This function NEVER grants anything and NEVER reveals which plan —
// actual restoration only happens after the user proves ownership of
// the email via a real Supabase magic-link sign-in (see restore-access).
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let email = '';
  try {
    const body = await req.json();
    email = String(body.email ?? '').trim().toLowerCase();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'invalid_email' }, 400);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('email', email)
    .maybeSingle();

  const found = !!profile && (profile.plan === 'local' || profile.plan === 'pro');
  // Plan is deliberately never returned here — only whether *something*
  // paid exists, so this endpoint can't be used to probe account details.
  return json({ found });
});
