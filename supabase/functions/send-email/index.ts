/**
 * MoneyNest — send-email Edge Function v3
 *
 * Tipos:
 *   confirmacion  — email de bienvenida
 *   (otp eliminado: no lo usa ningún cliente y permitía abuso)
 *   sugerencia    — feedback de usuarios a soporte
 *
 * Variables de entorno:
 *   RESEND_API_KEY   — API key de resend.com
 *   FROM_EMAIL       — email verificado en Resend
 */

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'noreply@moneynest.app';
// H-12: configurable (variable SUPPORT_EMAIL). Mantener sincronizado con js/config.js.
const SUPPORT_EMAIL  = Deno.env.get('SUPPORT_EMAIL') ?? 'invest.grid.main@gmail.com';

// Rate limiting compartido (tabla rate_limits vía RPC), no en memoria.
async function rateAllowed(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key, p_max_attempts: max, p_window_seconds: windowSeconds,
  });
  return error ? true : data !== false;
}

const escHtml = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const LOGO_URL = 'https://jwddciqqhmfkbqhdrfre.supabase.co/storage/v1/object/public/assets/Icon-192%20sin%20letras.png';

// Envuelve cualquier card en el layout base
function wrap(cardHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background-color:#060B14;font-family:Helvetica Neue,Helvetica,Arial,sans-serif">
<table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#060B14">
<tr><td align="center" style="padding:40px 16px">
<table width="560" border="0" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- LOGO -->
  <tr><td align="center" style="padding-bottom:32px">
    <img src="${LOGO_URL}" width="160" height="90" alt="MoneyNest" style="display:block;border:0;border-radius:16px;margin:0 auto">
  </td></tr>

  <!-- CARD -->
  ${cardHtml}


</table>
</td></tr>
</table>
</body>
</html>`;
}


// ════════════════════════════════════════════════
//  TEMPLATE — BIENVENIDA
// ════════════════════════════════════════════════

function templateConfirmacion(nombre: string): { subject: string; html: string } {
  const firstName = nombre ? escHtml(nombre.split(' ')[0].slice(0, 40)) : '';
  const greeting  = firstName ? `Hola, ${firstName}!` : `Bienvenido!`;

  return {
    subject: 'Bienvenido a MoneyNest! Tu prueba gratuita ha empezado',
    html: wrap(`
      <tr><td style="background-color:#0D1424;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">

          <!-- barra gradiente -->
          <tr><td height="3" style="background:linear-gradient(90deg,#00D4AA,#6366F1,#00D4AA);font-size:0;line-height:0">&nbsp;</td></tr>

          <!-- cuerpo -->
          <tr><td style="padding:36px 36px 32px">

            <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#00D4AA;text-transform:uppercase;letter-spacing:2px">Cuenta activada</p>
            <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:900;color:#F1F5F9;letter-spacing:-1px;line-height:1.2">${greeting} &#128075;</h1>
            <p style="margin:0 0 28px 0;font-size:15px;color:#94A3B8;line-height:1.7">
              Tu cuenta MoneyNest esta lista. Tienes
              <strong style="color:#F1F5F9;background-color:rgba(0,212,170,0.12);padding:1px 7px;border-radius:5px">24 horas de prueba gratuita</strong>
              para explorar todas las funciones.
            </p>

            <!-- features 2x2 -->
            <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Que puedes hacer ahora mismo</p>
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding:0 5px 10px 0">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px">
                    <p style="margin:0 0 5px 0;font-size:20px">&#128176;</p>
                    <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#E2E8F0">Ingresos y gastos</p>
                    <p style="margin:0;font-size:11px;color:#64748B">Registra y categoriza</p>
                  </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 10px 5px">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px">
                    <p style="margin:0 0 5px 0;font-size:20px">&#128200;</p>
                    <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#E2E8F0">Inversiones</p>
                    <p style="margin:0;font-size:11px;color:#64748B">Cartera y rendimiento</p>
                  </td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 5px 0 0">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px">
                    <p style="margin:0 0 5px 0;font-size:20px">&#127919;</p>
                    <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#E2E8F0">Objetivos</p>
                    <p style="margin:0;font-size:11px;color:#64748B">Metas de ahorro</p>
                  </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 0 5px">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px">
                    <p style="margin:0 0 5px 0;font-size:20px">&#128202;</p>
                    <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#E2E8F0">Analisis</p>
                    <p style="margin:0;font-size:11px;color:#64748B">Tendencias y reportes</p>
                  </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- trial reminder -->
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:20px">
            <tr><td style="background-color:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:14px 16px">
              <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:20px;vertical-align:middle;padding-right:12px">&#9203;</td>
                <td>
                  <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#A5B4FC">Tu prueba gratuita &middot; 24 horas</p>
                  <p style="margin:0;font-size:11px;color:#64748B">Despues puedes continuar con el Plan Local por solo 5&euro; unico</p>
                </td>
              </tr>
              </table>
            </td></tr>
            </table>

          </td></tr>

          <!-- card footer -->
          <tr><td style="background-color:#080E1A;padding:16px 36px;border-top:1px solid rgba(255,255,255,0.05)">
            <p style="margin:0;font-size:11px;color:#334155;text-align:center">MoneyNest &middot; InvestGrid &middot; Si no creaste esta cuenta, ignora este email.</p>
          </td></tr>

        </table>
      </td></tr>`),
  };
}


// ════════════════════════════════════════════════
//  TEMPLATE — SUGERENCIA
// ════════════════════════════════════════════════

function templateSugerencia(tipo: string, categoria: string, mensaje: string, userEmail: string): { subject: string; html: string } {
  // Escapar caracteres especiales para evitar simbolos raros
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const hora  = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return {
    subject: `[MoneyNest] ${esc(tipo)}: ${esc(categoria)}`,
    html: wrap(`
      <tr><td style="background-color:#0D1424;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">

          <!-- barra gradiente -->
          <tr><td height="3" style="background:linear-gradient(90deg,#6366F1,#00D4AA);font-size:0;line-height:0">&nbsp;</td></tr>

          <!-- cuerpo -->
          <tr><td style="padding:32px 32px 28px">

            <!-- header -->
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:2px">Nueva ${esc(tipo.toLowerCase())}</p>
            <h1 style="margin:0 0 24px 0;font-size:22px;font-weight:900;color:#F1F5F9;letter-spacing:-0.5px">${esc(categoria)}</h1>

            <!-- meta tabla -->
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px">
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
                  <table border="0" cellpadding="0" cellspacing="0"><tr>
                    <td width="80" style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Tipo</td>
                    <td style="font-size:13px;font-weight:600;color:#E2E8F0">${esc(tipo)}</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05)">
                  <table border="0" cellpadding="0" cellspacing="0"><tr>
                    <td width="80" style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Categoria</td>
                    <td style="font-size:13px;font-weight:600;color:#E2E8F0">${esc(categoria)}</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px">
                  <table border="0" cellpadding="0" cellspacing="0"><tr>
                    <td width="80" style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">De</td>
                    <td style="font-size:13px;font-weight:600;color:#00D4AA">${esc(userEmail || 'Anonimo')}</td>
                  </tr></table>
                </td>
              </tr>
            </table>

            <!-- mensaje -->
            <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Mensaje</p>
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.07);border-left:3px solid #6366F1;border-radius:10px;padding:18px;font-size:14px;line-height:1.75;color:#CBD5E1;white-space:pre-wrap">${esc(mensaje)}</td></tr>
            </table>

            <!-- timestamp -->
            <p style="margin:16px 0 0 0;font-size:11px;color:#334155;text-align:right">${fecha} &middot; ${hora}</p>

          </td></tr>

          <!-- card footer -->
          <tr><td style="background-color:#080E1A;padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05)">
            <p style="margin:0;font-size:11px;color:#334155;text-align:center">MoneyNest &middot; InvestGrid &middot; Panel de soporte</p>
          </td></tr>

        </table>
      </td></tr>`),
  };
}


// ════════════════════════════════════════════════
//  HANDLER
// ════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);
  if (!RESEND_API_KEY)          return json({ error: 'RESEND_API_KEY not configured' }, 500);

  // Primera IP de x-forwarded-for (el resto de la cadena puede ser falsificada).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip') || 'unknown';

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const type = String(body.type ?? '');
  const nombre = String(body.nombre ?? '').slice(0, 80);
  const tipo = String(body.tipo ?? '').slice(0, 60);
  const categoria = String(body.categoria ?? '').slice(0, 60);
  const mensaje = String(body.mensaje ?? '').slice(0, 4000);

  // Usuario autenticado (opcional según el tipo).
  let user: { id: string; email?: string } | null = null;
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (jwt) {
    const { data } = await supabase.auth.getUser(jwt);
    user = data?.user ?? null;
  }

  let template: { subject: string; html: string };
  let recipient: string;
  let replyTo: string | undefined;

  if (type === 'confirmacion') {
    // El destinatario es SIEMPRE el email de la sesión; el cliente no elige `to`.
    if (!user?.email) return json({ error: 'auth_required' }, 401);
    if (!(await rateAllowed(`send-email:confirmacion:${user.id}`, 3, 3600))) return json({ error: 'rate_limited' }, 429);
    template  = templateConfirmacion(nombre);
    recipient = user.email;

  } else if (type === 'sugerencia') {
    // Destinatario fijo (soporte): no es un relé. Se permite sin sesión pero con límite.
    if (!mensaje.trim()) return json({ error: 'mensaje_required' }, 400);
    if (!(await rateAllowed(`send-email:sugerencia:ip:${ip}`, 5, 600))) return json({ error: 'rate_limited' }, 429);
    if (user && !(await rateAllowed(`send-email:sugerencia:user:${user.id}`, 10, 3600))) return json({ error: 'rate_limited' }, 429);
    const claimed = String(body.userEmail ?? '').trim().slice(0, 200);
    replyTo = user?.email ?? (EMAIL_RE.test(claimed) ? claimed : undefined);
    template  = templateSugerencia(tipo || 'Sugerencia', categoria || 'General', mensaje, replyTo ?? '');
    recipient = SUPPORT_EMAIL;

  } else {
    return json({ error: 'invalid_type' }, 400);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [recipient],
      subject: template.subject,
      html:    template.html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const result = await res.json();
  if (!res.ok) return json({ error: result?.message ?? 'resend_error' }, 502);

  return json({ ok: true, id: result.id });
});
