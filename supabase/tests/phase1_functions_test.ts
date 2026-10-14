// Pruebas con mocks (sin red, sin claves reales): fetch global sustituido.
type H = (req: Request) => Promise<Response>;
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, extra = '') => { results.push([name, ok, extra]); };

const json = (b: unknown, status = 200) => status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
type State = {
  user: { id: string; email: string; email_confirmed_at: string | null } | null;
  rateAllowed: boolean;
  calls: string[]; scrubFails: boolean; delCustomerFails: boolean;
  resend: unknown[];
  billing: Record<string, { processed: boolean }>;
  profile: { stripe_customer_id: string | null } | null;
  stripe: { testCustomer: 'missing' | 'ok'; liveCustomer: 'missing' | 'ok'; liveCancelFails: boolean; liveSubs: { id: string; status: string }[] };
};
let st: State;
const fresh = (): State => ({ user: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@test.invalid', email_confirmed_at: '2026-01-01' }, rateAllowed: true, calls: [], scrubFails: false, delCustomerFails: false, resend: [], billing: {}, profile: { stripe_customer_id: 'cus_1' },
  stripe: { testCustomer: 'missing', liveCustomer: 'ok', liveCancelFails: false, liveSubs: [{ id: 'sub_a', status: 'active' }, { id: 'sub_b', status: 'canceled' }, { id: 'sub_c', status: 'past_due' }] } });

globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url); const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : '';
  const key = (req.headers.get('authorization') ?? '');
  if (url.host === 'api.resend.com') { st.resend.push(JSON.parse(body)); return json({ id: 're_1' }); }
  if (url.pathname.endsWith('/auth/v1/user')) return st.user && key.includes('USERJWT') ? json({ id: st.user.id, email: st.user.email, email_confirmed_at: st.user.email_confirmed_at, aud: 'authenticated' }) : json({ msg: 'bad' }, 401);
  if (url.pathname.includes('/auth/v1/admin/users/')) { st.calls.push('auth.deleteUser'); return json({}); }
  if (url.pathname.endsWith('/rpc/check_rate_limit')) return json(st.rateAllowed);
  if (url.pathname.endsWith('/rpc/scrub_user_data')) { if (st.scrubFails) return json({ message: 'scrub boom' }, 500); st.calls.push('rpc.scrub'); return json(null, 204); }
  if (url.pathname.endsWith('/rpc/activate_subscription_plan')) { st.calls.push('rpc.activate'); return json(null, 204); }
  if (url.pathname.endsWith('/rest/v1/billing_events')) {
    if (req.method === 'GET') { const id = url.searchParams.get('stripe_event_id')?.replace('eq.', '') ?? ''; const r = st.billing[id]; return json(r ? { id: 1, processed: r.processed } : null); }
    const rows = JSON.parse(body); const row = Array.isArray(rows) ? rows[0] : rows; st.calls.push(`billing.${req.method}.${url.searchParams.get('on_conflict') ?? 'none'}.processed=${row.processed}`); st.billing[row.stripe_event_id] = { processed: row.processed }; return json(null, 201);
  }
  if (url.pathname.endsWith('/rest/v1/profiles')) { if (req.method === 'GET') return json(st.profile); st.calls.push(`profiles.${req.method}`); return json(null, 204); }
  if (url.pathname.endsWith('/rest/v1/subscriptions')) { if (req.method === 'DELETE') st.calls.push('subscriptions.DELETE'); return req.method === 'GET' ? json([]) : json(null, 204); }
  if (url.host === 'api.stripe.com') {
    const mode = key.includes('sk_test') ? 'test' : 'live';
    const p = url.pathname;
    if (p.startsWith('/v1/customers/') && req.method === 'DELETE') { if (mode === 'live' && st.delCustomerFails) return json({ error: { type: 'api_error', message: 'del boom' } }, 500); if (mode === 'test') return json({ error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such customer' } }, 404); st.calls.push(`stripe.customer.del.${mode}`); return json({ id: 'cus_1', object: 'customer', deleted: true }); }
    if (p.startsWith('/v1/customers/')) { const s = mode === 'test' ? st.stripe.testCustomer : st.stripe.liveCustomer; return s === 'ok' ? json({ id: 'cus_1', object: 'customer' }) : json({ error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such customer' } }, 404); }
    if (p === '/v1/subscriptions' && req.method === 'GET') return json({ object: 'list', data: mode === 'live' ? st.stripe.liveSubs : [], has_more: false, url: '/v1/subscriptions' });
    if (p.startsWith('/v1/subscriptions/') && req.method === 'DELETE') { if (mode === 'live' && st.stripe.liveCancelFails) return json({ error: { type: 'api_error', message: 'boom' } }, 500); st.calls.push(`stripe.cancel.${mode}.${p.split('/').pop()}`); return json({ id: p.split('/').pop(), status: 'canceled', object: 'subscription' }); }
  }
  return json({ unmocked: url.href }, 599);
}) as typeof fetch;

Deno.env.set('SUPABASE_URL', 'http://sb.test'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'srv');
Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_dummy'); Deno.env.set('STRIPE_SECRET_KEY_TEST', 'sk_test_dummy');
Deno.env.set('STRIPE_WEBHOOK_SECRET', 'whsec_live_dummy'); Deno.env.set('STRIPE_WEBHOOK_SECRET_TEST', 'whsec_test_dummy');
Deno.env.set('RESEND_API_KEY', 're_dummy');

let handler!: H;
(Deno as unknown as { serve: unknown }).serve = (h: H) => { handler = h; return {}; };
const load = async (fn: string) => { await import(`../functions/${fn}/index.ts?${Math.random()}`); return handler; };
const call = (h: H, body: unknown, headers: Record<string, string> = {}, origin = 'https://moneynest.es') =>
  h(new Request('http://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json', origin, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const AUTH = { authorization: 'Bearer USERJWT' };

// ---------- H-03 send-email ----------
{ const h = await load('send-email'); st = fresh();
  let r = await call(h, { type: 'confirmacion', to: 'victim@test.invalid', nombre: 'x' });
  check('H-03 confirmacion sin sesión → 401', r.status === 401 && st.resend.length === 0);
  st = fresh(); r = await call(h, { type: 'confirmacion', to: 'victim@test.invalid', nombre: '<img src=x onerror=alert(1)> Ana' }, AUTH);
  const sent = st.resend[0] as { to: string[]; html: string } | undefined;
  check('H-03 confirmacion con sesión envía SOLO al email de la sesión (ignora `to`)', r.status === 200 && sent?.to.length === 1 && sent.to[0] === 'owner@test.invalid', JSON.stringify(sent?.to));
  check('H-03 nombre escapado (sin HTML inyectado)', !!sent && !sent.html.includes('<img src=x') && sent.html.includes('&lt;img'));
  st = fresh(); r = await call(h, { type: 'otp', to: 'victim@test.invalid', codigo: '123456' }, AUTH);
  check('H-03 tipo otp eliminado → 400', r.status === 400 && st.resend.length === 0);
  st = fresh(); r = await call(h, { type: 'sugerencia', mensaje: 'hola', to: 'victim@test.invalid', userEmail: 'a@test.invalid' });
  check('H-03 sugerencia va siempre a soporte (no es relé)', r.status === 200 && (st.resend[0] as { to: string[] }).to[0] === 'invest.grid.main@gmail.com');
  st = fresh(); st.rateAllowed = false; r = await call(h, { type: 'sugerencia', mensaje: 'hola' });
  check('H-03 límite compartido → 429', r.status === 429 && st.resend.length === 0);
}
// ---------- H-04 webhook ----------
{
  const h = await load('stripe-webhook');
  const sign = async (payload: string, secret: string) => { const t = Math.floor(Date.now() / 1000); const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${payload}`))); return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, '0')).join('')}`; };
  const evt = async (id: string) => { const payload = JSON.stringify({ id, object: 'event', type: 'customer.subscription.deleted', data: { object: { id: 'sub_x', object: 'subscription', status: 'canceled', customer: 'cus_1', metadata: { user_id: '11111111-1111-4111-8111-111111111111', plan: 'pro' }, items: { data: [{ price: { id: 'p' } }] }, cancel_at_period_end: false } } });
    return { payload, sig: await sign(payload, 'whsec_live_dummy') }; };
  const send = (e: { payload: string; sig: string }) => h(new Request('http://fn.test/', { method: 'POST', headers: { 'stripe-signature': e.sig }, body: e.payload }));
  st = fresh(); st.billing['evt_failed'] = { processed: false };
  let r = await send(await evt('evt_failed')); let j = await r.json();
  check('H-04 evento fallido previo SE REPROCESA', r.status === 200 && st.calls.includes('rpc.activate') && j.skipped !== 'duplicate', st.calls.join(','));
  check('H-04 el log usa upsert por stripe_event_id y queda processed=true', st.calls.some((c) => c === 'billing.POST.stripe_event_id.processed=true') && st.billing['evt_failed'].processed === true, st.calls.join(','));
  st = fresh(); st.billing['evt_ok'] = { processed: true };
  r = await send(await evt('evt_ok')); j = await r.json();
  check('H-04 evento ya procesado → duplicado, sin reprocesar', j.skipped === 'duplicate' && !st.calls.includes('rpc.activate'));
}
// ---------- H-05 delete-account ----------
{ const h = await load('delete-account');
  st = fresh(); let r = await call(h, {}, AUTH);
  check('H-05 cliente solo en live (test → resource_missing es normal): cancela activas/past_due, ignora canceladas y borra', r.status === 200 && st.calls.includes('stripe.cancel.live.sub_a') && st.calls.includes('stripe.cancel.live.sub_c') && !st.calls.includes('stripe.cancel.live.sub_b') && st.calls.includes('auth.deleteUser'), st.calls.join(','));
  st = fresh(); st.stripe.liveCancelFails = true; r = await call(h, {}, AUTH); const j = await r.json();
  check('H-05 si falla la cancelación REAL → 502 y NO se borra nada', r.status === 502 && j.error === 'stripe_cancellation_failed' && !st.calls.includes('auth.deleteUser') && !st.calls.includes('subscriptions.DELETE') && !st.calls.includes('profiles.DELETE'), st.calls.join(','));
  st = fresh(); st.profile = { stripe_customer_id: null }; r = await call(h, {}, AUTH);
  check('H-05 sin cliente Stripe → borra normalmente', r.status === 200 && st.calls.includes('auth.deleteUser'));
  st = fresh(); r = await call(h, {}, AUTH, 'https://moneynest.es');
  check('H-02 delete-account: CORS permite moneynest.es', r.headers.get('access-control-allow-origin') === 'https://moneynest.es');
  st = fresh(); r = await call(h, {}, AUTH, 'https://evil.example');
  check('H-02 delete-account: otro origen NO permitido', r.headers.get('access-control-allow-origin') === '');
}
// ---------- H-09 restore-access + H-02 portal/checkout ----------
{ const h = await load('restore-access');
  st = fresh(); st.user!.email_confirmed_at = null; let r = await call(h, {}, AUTH);
  check('H-09 email sin verificar → 403 y no se activa nada', r.status === 403 && !st.calls.includes('rpc.activate'));
  st = fresh(); r = await call(h, {}, AUTH);
  check('H-09 email verificado → continúa (sin 403)', r.status !== 403, String(r.status));
  check('H-02 restore-access: CORS moneynest.es', r.headers.get('access-control-allow-origin') === 'https://moneynest.es');
  const p = await load('create-portal-session'); st = fresh();
  r = await call(p, {}, AUTH); check('H-02 portal: CORS moneynest.es', r.headers.get('access-control-allow-origin') === 'https://moneynest.es');
  const c = await load('create-checkout'); st = fresh();
  r = await call(c, { plan: 'bogus' }, AUTH); check('H-02 checkout: moneynest.es ya no recibe 403 invalid_origin', r.status !== 403, String(r.status));
  r = await call(c, { plan: 'bogus' }, AUTH, 'https://evil.example'); check('H-02 checkout: origen ajeno sigue en 403', r.status === 403);
}
for (const [n, ok, e] of results) console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : '→ ' + e);
console.log(results.every((r) => r[1]) ? `ALL ${results.length} PASSED` : 'SOME FAILED');
Deno.exit(results.every((r) => r[1]) ? 0 : 1);
