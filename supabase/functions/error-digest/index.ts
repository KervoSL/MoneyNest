// Daily digest of real-user client errors. Called by pg_cron (pg_net) with header x-cron-secret.
// Sends ONE email to SUPPORT_EMAIL only when there are new non-bot errors in the last 24h.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@moneynest.app';
const TO_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'invest.grid.main@gmail.com';
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|preview/i;

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const { data: cfg } = await supabase.from('app_private').select('value').eq('key', 'cron_secret').maybeSingle();
  if (!cfg?.value || req.headers.get('x-cron-secret') !== cfg.value) return json({ error: 'forbidden' }, 403);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('client_errors')
    .select('message, stack, url, user_agent, app_version, user_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return json({ error: error.message }, 500);

  const real = (rows ?? []).filter((r) => !BOT_RE.test(r.user_agent ?? ''));
  if (!real.length) return json({ sent: false, reason: 'no_real_errors', total: rows?.length ?? 0 });

  const groups = new Map<string, { message: string; stack: string; count: number; users: Set<string>; versions: Set<string>; last: string; url: string }>();
  for (const r of real) {
    const top = (r.stack ?? '').split('\n')[1] ?? '';
    const key = (r.message ?? '').slice(0, 120) + '|' + top.trim().slice(0, 120);
    const g = groups.get(key) ?? { message: r.message ?? '', stack: r.stack ?? '', count: 0, users: new Set(), versions: new Set(), last: r.created_at, url: r.url ?? '' };
    g.count++;
    if (r.user_id) g.users.add(r.user_id);
    if (r.app_version) g.versions.add(r.app_version);
    groups.set(key, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 15);

  const items = sorted.map((g) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
      <div style="font-weight:700;color:#111827">${esc(g.message.slice(0, 200))}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">${g.count}× · ${g.users.size} usuario(s) · v${esc([...g.versions].join(', ') || '?')} · ${esc(g.url)}</div>
      <pre style="font-size:11px;color:#374151;background:#f3f4f6;padding:8px;border-radius:6px;white-space:pre-wrap;margin:6px 0 0">${esc(g.stack.split('\n').slice(0, 4).join('\n'))}</pre>
    </td></tr>`).join('');

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
    <h2 style="margin:0 0 4px">MoneyNest · errores de las últimas 24 h</h2>
    <p style="color:#6b7280;margin:0 0 12px">${real.length} errores de usuarios reales (bots excluidos), ${groups.size} tipos distintos.</p>
    <table width="100%" cellpadding="0" cellspacing="0">${items}</table>
  </div>`;

  if (!RESEND_API_KEY) return json({ sent: false, reason: 'no_resend_key', real: real.length });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [TO_EMAIL], subject: `[MoneyNest] ${real.length} errores en las últimas 24 h`, html }),
  });
  const out = await res.json();
  if (!res.ok) return json({ sent: false, error: out?.message ?? 'resend_error' }, 502);
  return json({ sent: true, errors: real.length, types: groups.size });
});
