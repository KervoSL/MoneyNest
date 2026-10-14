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

// ---------- H-11 delete-account (limpieza) ----------
{ const h = await load('delete-account');
  st = fresh(); let r = await call(h, {}, AUTH);
  const i = (c: string) => st.calls.indexOf(c);
  check('H-11 borra el cliente de Stripe y depura datos ANTES de borrar el usuario', r.status === 200 && i('stripe.customer.del.live') >= 0 && i('rpc.scrub') >= 0 && i('stripe.customer.del.live') < i('auth.deleteUser') && i('rpc.scrub') < i('subscriptions.DELETE') && i('rpc.scrub') < i('auth.deleteUser'), st.calls.join(','));
  st = fresh(); st.scrubFails = true; r = await call(h, {}, AUTH); let j = await r.json();
  check('H-11 si falla la depuración → 502 y no se borra la cuenta (se puede reintentar)', r.status === 502 && j.error === 'cleanup_failed' && !st.calls.includes('auth.deleteUser') && !st.calls.includes('profiles.DELETE'), st.calls.join(','));
  st = fresh(); st.delCustomerFails = true; r = await call(h, {}, AUTH);
  check('H-11 si falla el borrado del cliente Stripe → 502 y no se borra la cuenta', r.status === 502 && !st.calls.includes('auth.deleteUser'), st.calls.join(','));
}
// ---------- H-13 check-license ----------
{ const h = await load('check-license'); st = fresh();
  const r = await call(h, { email: 'cliente@test.invalid' }); const j = await r.json();
  check('H-13 check-license ya no revela nada (410, sin consultas a la base de datos)', r.status === 410 && j.found === undefined && st.calls.length === 0);
}
for (const [n, ok, e] of results) console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : '→ ' + e);
console.log(results.every((r) => r[1]) ? `ALL ${results.length} PASSED` : 'SOME FAILED');
Deno.exit(results.every((r) => r[1]) ? 0 : 1);
