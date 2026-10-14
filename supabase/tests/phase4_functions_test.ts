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
  stripe: { testCustomer: 'missing' | 'ok'; liveCustomer: 'missing' | 'ok'; liveCancelFails: boolean; liveSubs: { id: string; status: string }[]; testSubs: { id: string; status: string; items: { data: { price: { id: string } }[] } }[] };
};
let st: State;
const fresh = (): State => ({ user: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@test.invalid', email_confirmed_at: '2026-01-01' }, rateAllowed: true, calls: [], scrubFails: false, delCustomerFails: false, resend: [], billing: {}, profile: { stripe_customer_id: 'cus_1' },
  stripe: { testCustomer: 'missing', liveCustomer: 'ok', liveCancelFails: false, testSubs: [], liveSubs: [{ id: 'sub_a', status: 'active' }, { id: 'sub_b', status: 'canceled' }, { id: 'sub_c', status: 'past_due' }] } });

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
    if (p === '/v1/customers' && req.method === 'POST') return json({ id: 'cus_new', object: 'customer' });
    if (p.startsWith('/v1/prices/')) return json({ id: p.split('/').pop(), object: 'price', unit_amount: 100, currency: 'eur' });
    if (p.startsWith('/v1/customers/') && req.method === 'DELETE') { if (mode === 'live' && st.delCustomerFails) return json({ error: { type: 'api_error', message: 'del boom' } }, 500); if (mode === 'test') return json({ error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such customer' } }, 404); st.calls.push(`stripe.customer.del.${mode}`); return json({ id: 'cus_1', object: 'customer', deleted: true }); }
    if (p.startsWith('/v1/customers/')) { const s = mode === 'test' ? st.stripe.testCustomer : st.stripe.liveCustomer; return s === 'ok' ? json({ id: 'cus_1', object: 'customer' }) : json({ error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such customer' } }, 404); }
    if (p === '/v1/subscriptions' && req.method === 'GET') return json({ object: 'list', data: mode === 'live' ? st.stripe.liveSubs : st.stripe.testSubs, has_more: false, url: '/v1/subscriptions' });
    if (p.startsWith('/v1/subscriptions/') && req.method === 'DELETE') { if (mode === 'live' && st.stripe.liveCancelFails) return json({ error: { type: 'api_error', message: 'boom' } }, 500); st.calls.push(`stripe.cancel.${mode}.${p.split('/').pop()}`); return json({ id: p.split('/').pop(), status: 'canceled', object: 'subscription' }); }
  }
  return json({ unmocked: url.href }, 599);
}) as typeof fetch;

Deno.env.set('SUPABASE_URL', 'http://sb.test'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'srv');
Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_dummy'); Deno.env.set('STRIPE_SECRET_KEY_TEST', 'sk_test_dummy');
Deno.env.set('STRIPE_WEBHOOK_SECRET', 'whsec_live_dummy'); Deno.env.set('STRIPE_WEBHOOK_SECRET_TEST', 'whsec_test_dummy');
Deno.env.set('RESEND_API_KEY', 're_dummy'); Deno.env.set('SUPPORT_EMAIL', 'soporte@test.invalid');

let handler!: H;
(Deno as unknown as { serve: unknown }).serve = (h: H) => { handler = h; return {}; };
const load = async (fn: string) => { await import(`../functions/${fn}/index.ts?${Math.random()}`); return handler; };
const call = (h: H, body: unknown, headers: Record<string, string> = {}, origin = 'https://moneynest.es') =>
  h(new Request('http://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json', origin, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const AUTH = { authorization: 'Bearer USERJWT' };

const LOCAL_TEST = 'price_1U5uN8FWll222KpaX0qENvX3', PRO_TEST = 'price_1U5uNNFWll222Kpawefje59j';
const sub = (id: string, status: string, price: string) => ({ id, status, items: { data: [{ price: { id: price } }] } });
// ---------- H-20 suscripciones duplicadas ----------
{ const h = await load('create-payment-intent');
  for (const [label, active, wanted] of [['Local', LOCAL_TEST, LOCAL_TEST], ['Pro', PRO_TEST, PRO_TEST]] as const) {
    st = fresh(); st.stripe.testSubs = [sub('sub_1', 'active', active)];
    const r = await call(h, { priceId: wanted }, AUTH);
    check(`H-20 payment-intent: segundo ${label} con ${label} activo → 409`, r.status === 409, String(r.status));
  }
  st = fresh(); st.stripe.testSubs = [sub('sub_1', 'canceled', LOCAL_TEST)];
  let r = await call(h, { priceId: LOCAL_TEST }, AUTH);
  check('H-20 payment-intent: Local cancelado NO bloquea una nueva compra', r.status !== 409, String(r.status));
  st = fresh(); st.stripe.testSubs = [sub('sub_1', 'active', LOCAL_TEST)];
  r = await call(h, { priceId: PRO_TEST }, AUTH);
  check('H-20 payment-intent: Pro con Local activo sigue permitido (cambio de plan)', r.status !== 409, String(r.status));
  const c = await load('create-checkout');
  st = fresh(); st.stripe.testSubs = [sub('sub_1', 'trialing', LOCAL_TEST)];
  r = await call(c, { plan: 'local_monthly' }, AUTH);
  check('H-20 checkout: Local duplicado → 409', r.status === 409, String(r.status));
  st = fresh(); st.stripe.testSubs = [];
  r = await call(c, { plan: 'local_monthly' }, AUTH);
  check('H-20 checkout: sin suscripción previa no devuelve 409', r.status !== 409, String(r.status));
}
// ---------- H-12 correo de soporte configurable ----------
{ const h = await load('send-email'); st = fresh();
  const r = await call(h, { type: 'sugerencia', mensaje: 'hola' });
  check('H-12 la sugerencia va al SUPPORT_EMAIL configurado (variable de entorno)', r.status === 200 && (st.resend[0] as { to: string[] }).to[0] === 'soporte@test.invalid');
}
for (const [n, ok, e] of results) console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : '→ ' + e);
console.log(results.every((r) => r[1]) ? `ALL ${results.length} PASSED` : 'SOME FAILED');
Deno.exit(results.every((r) => r[1]) ? 0 : 1);
