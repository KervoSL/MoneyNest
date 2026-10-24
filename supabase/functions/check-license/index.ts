// H-13: DEPRECADA. Antes confirmaba si un email tenía plan de pago (enumeración
// de clientes). El front ya no la llama: "Restaurar acceso" envía siempre un
// enlace mágico con respuesta neutra. Se deja un stub que no consulta nada.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  return new Response(JSON.stringify({ error: 'deprecated' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
