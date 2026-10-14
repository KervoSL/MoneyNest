
// Read-only, side-effect-free lookup: tells the frontend whether an
// email has a paid plan on file, so the 'Restaurar acceso' modal can
// show a helpful message BEFORE asking the user to verify ownership.
// This function NEVER grants anything and NEVER reveals which plan —
// actual restoration only happens after the user proves ownership of
// the email via a real Supabase magic-link sign-in (see restore-access).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// H-13: DEPRECADA. Antes confirmaba si un email tenía plan de pago (enumeración
// de clientes). El front ya no la llama: "Restaurar acceso" envía siempre un
// enlace mágico con respuesta neutra. Se deja un stub que no consulta nada.
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  return json({ error: 'deprecated' }, 410);
});
