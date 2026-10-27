/**
 * MoneyNest — send-email Edge Function v4
 *
 * Tipos:
 *   confirmacion  — email de bienvenida (ES/EN según body.lang)
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
const SUPPORT_EMAIL  = Deno.env.get('SUPPORT_EMAIL') ?? 'invest.grid.main@gmail.com';

async function rateAllowed(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key, p_max_attempts: max, p_window_seconds: windowSeconds,
  });
  return error ? true : data !== false;
}

const escHtml = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const LOGO_URL = 'https://moneynest.es/assets/logo.png';

function wrap(cardHtml: string, lang = 'es'): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background-color:#060B14;font-family:Helvetica Neue,Helvetica,Arial,sans-serif">
<table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#060B14">
<tr><td align="center" style="padding:40px 16px">
<table width="560" border="0" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <tr><td align="center" style="padding-bottom:32px">
    <img src="${LOGO_URL}" width="96" height="96" alt="MoneyNest" style="display:block;border:0;border-radius:22px;margin:0 auto">
  </td></tr>

  ${cardHtml}

</table>
</td></tr>
</table>
</body>
</html>`;
}

const WELCOME_TXT: Record<string, Record<string, string>> = {
  es: {
    subject: 'Bienvenido a MoneyNest! Tu prueba gratuita ha empezado',
    hello: 'Hola, {n}!', hello0: 'Bienvenido!', badge: 'Cuenta activada',
    intro1: 'Tu cuenta MoneyNest esta lista. Tienes', intro2: 'una prueba gratuita de 100 movimientos', intro3: 'para explorar todas las funciones.',
    what: 'Que puedes hacer ahora mismo',
    f1: 'Ingresos y gastos', f1s: 'Registra y categoriza', f2: 'Inversiones', f2s: 'Cartera y rendimiento',
    f3: 'Objetivos', f3s: 'Metas de ahorro', f4: 'Analisis', f4s: 'Tendencias y reportes',
    trial: 'Tu prueba gratuita &middot; 100 movimientos', after: 'Despues puedes continuar con el Plan Local desde 1&euro; al mes',
    foot: 'Si no creaste esta cuenta, ignora este email.',
  },
  en: {
    subject: 'Welcome to MoneyNest! Your free trial has started',
    hello: 'Hi, {n}!', hello0: 'Welcome!', badge: 'Account activated',
    intro1: 'Your MoneyNest account is ready. You have', intro2: 'a free trial of 100 transactions', intro3: 'to explore every feature.',
    what: 'What you can do right now',
    f1: 'Income &amp; expenses', f1s: 'Record and categorize', f2: 'Investments', f2s: 'Portfolio and returns',
    f3: 'Goals', f3s: 'Savings targets', f4: 'Analytics', f4s: 'Trends and reports',
    trial: 'Your free trial &middot; 100 transactions', after: 'Afterwards you can continue with the Local Plan from &euro;1 per month',
    foot: "If you didn't create this account, ignore this email.",
  },
};

function card(inner: string, grad: string, pad: string, foot: string, footPad: string): string {
  return `
      <tr><td style="background-color:#0D1424;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr><td height="3" style="background:${grad};font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td style="padding:${pad}">${inner}</td></tr>
          <tr><td style="background-color:#080E1A;padding:${footPad};border-top:1px solid rgba(255,255,255,0.05)">
            <p style="margin:0;font-size:11px;color:#334155;text-align:center">${foot}</p>
          </td></tr>
        </table>
      </td></tr>`;
}

function templateConfirmacion(nombre: string, lang = 'es'): { subject: string; html: string } {
  const L = WELCOME_TXT[lang] ?? WELCOME_TXT.es;
  const firstName = nombre ? escHtml(nombre.split(' ')[0].slice(0, 40)) : '';
  const greeting  = firstName ? L.hello.replace('{n}', firstName) : L.hello0;
  const feat = (emoji: string, t: string, s: string, pr: string) => `
                <td width="50%" style="padding:${pr}">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px">
                    <p style="margin:0 0 5px 0;font-size:20px">${emoji}</p>
                    <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#E2E8F0">${t}</p>
                    <p style="margin:0;font-size:11px;color:#64748B">${s}</p>
                  </td></tr>
                  </table>
                </td>`;

  const inner = `
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#00D4AA;text-transform:uppercase;letter-spacing:2px">${L.badge}</p>
            <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:900;color:#F1F5F9;letter-spacing:-1px;line-height:1.2">${greeting} &#128075;</h1>
            <p style="margin:0 0 28px 0;font-size:15px;color:#94A3B8;line-height:1.7">
              ${L.intro1}
              <strong style="color:#F1F5F9;background-color:rgba(0,212,170,0.12);padding:1px 7px;border-radius:5px">${L.intro2}</strong>
              ${L.intro3}
            </p>
            <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">${L.what}</p>
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>${feat('&#128176;', L.f1, L.f1s, '0 5px 10px 0')}${feat('&#128200;', L.f2, L.f2s, '0 0 10px 5px')}</tr>
              <tr>${feat('&#127919;', L.f3, L.f3s, '0 5px 0 0')}${feat('&#128202;', L.f4, L.f4s, '0 0 0 5px')}</tr>
            </table>
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:20px">
            <tr><td style="background-color:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:14px 16px">
              <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:20px;vertical-align:middle;padding-right:12px">&#9203;</td>
                <td>
                  <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#A5B4FC">${L.trial}</p>
                  <p style="margin:0;font-size:11px;color:#64748B">${L.after}</p>
                </td>
              </tr>
              </table>
            </td></tr>
            </table>`;

  return {
    subject: L.subject,
    html: wrap(card(inner, 'linear-gradient(90deg,#00D4AA,#6366F1,#00D4AA)', '36px 36px 32px', `MoneyNest &middot; InvestGrid &middot; ${L.foot}`, '16px 36px'), lang),
  };
}

function templateSugerencia(tipo: string, categoria: string, mensaje: string, userEmail: string): { subject: string; html: string } {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const hora  = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const row = (label: string, val: string, color: string, last = false) => `
              <tr>
                <td style="padding:12px 16px;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.05)'}">
                  <table border="0" cellpadding="0" cellspacing="0"><tr>
                    <td width="80" style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">${label}</td>
                    <td style="font-size:13px;font-weight:600;color:${color}">${val}</td>
                  </tr></table>
                </td>
              </tr>`;

  const inner = `
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:2px">Nueva ${esc(tipo.toLowerCase())}</p>
            <h1 style="margin:0 0 24px 0;font-size:22px;font-weight:900;color:#F1F5F9;letter-spacing:-0.5px">${esc(categoria)}</h1>
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background-color:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:10px">
              ${row('Tipo', esc(tipo), '#E2E8F0')}${row('Categoria', esc(categoria), '#E2E8F0')}${row('De', esc(userEmail || 'Anonimo'), '#00D4AA', true)}
            </table>
            <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Mensaje</p>
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr><td style="background-color:#111827;border:1px solid rgba(255,255,255,0.07);border-left:3px solid #6366F1;border-radius:10px;padding:18px;font-size:14px;line-height:1.75;color:#CBD5E1;white-space:pre-wrap">${esc(mensaje)}</td></tr>
            </table>
            <p style="margin:16px 0 0 0;font-size:11px;color:#334155;text-align:right">${fecha} &middot; ${hora}</p>`;

  return {
    subject: `[MoneyNest] ${esc(tipo)}: ${esc(categoria)}`,
    html: wrap(card(inner, 'linear-gradient(90deg,#6366F1,#00D4AA)', '32px 32px 28px', 'MoneyNest &middot; InvestGrid &middot; Panel de soporte', '16px 32px')),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);
  if (!RESEND_API_KEY)          return json({ error: 'RESEND_API_KEY not configured' }, 500);

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
    if (!user?.email) return json({ error: 'auth_required' }, 401);
    if (!(await rateAllowed(`send-email:confirmacion:${user.id}`, 3, 3600))) return json({ error: 'rate_limited' }, 429);
    template  = templateConfirmacion(nombre, String(body.lang ?? '').toLowerCase().startsWith('en') ? 'en' : 'es');
    recipient = user.email;

  } else if (type === 'sugerencia') {
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
