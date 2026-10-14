import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const M = new URL('../migrations/', import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users (id uuid primary key);
 create table public.billing_events (id serial primary key, user_id uuid, event_type text, stripe_event_id text unique, payload jsonb, processed boolean, error text);
 grant usage on schema public to anon, authenticated, service_role;
`);
for (const f of ['20260823000000_rate_limiting.sql','20260825000000_client_errors.sql','20260825010000_product_events.sql','20261014000001_privacy_hardening.sql'])
  await db.exec(fs.readFileSync(M + f, 'utf8'));
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
await db.exec(`
 insert into auth.users values ('${A}'),('${B}');
 insert into public.billing_events(user_id,event_type,stripe_event_id,payload) values
  ('${A}','invoice.paid','e1','{"id":"in_1","object":"invoice","customer":"cus_A","customer_email":"a@test.invalid","customer_name":"Ana"}'),
  (null,'charge.refunded','e2','{"id":"ch_1","object":"charge","customer":"cus_A","billing_details":{"email":"a@test.invalid"}}'),
  ('${B}','invoice.paid','e3','{"id":"in_2","object":"invoice","customer":"cus_B","customer_email":"b@test.invalid"}');
 insert into public.product_events(event_name,session_id,user_id) values ('plan_selected','s1','${A}'),('plan_selected','s2','${B}');
 insert into public.client_errors(message,url,user_id) values ('x','/','${A}'),('y','/','${B}');
 insert into public.product_events(event_name,session_id,created_at) values ('old','s3', now() - interval '14 months');
 insert into public.client_errors(message,created_at) values ('old', now() - interval '91 days');
`);
const as = async (role, sql) => { await db.exec(`set role ${role}`); try { const r = await db.query(sql); await db.exec('reset role'); return 'ok'; } catch (e) { await db.exec('reset role'); return 'ERR:' + e.message; } };
const res = {};
res.anonRL = await as('anon', `select public.check_rate_limit('delete-account:${B}', 3, 3600)`);
res.authRL = await as('authenticated', `select public.check_rate_limit('delete-account:${B}', 3, 3600)`);
res.serviceRL = await as('service_role', `select public.check_rate_limit('k', 3, 60)`);
res.anonScrub = await as('anon', `select public.scrub_user_data('${A}','cus_A')`);
res.authScrub = await as('authenticated', `select public.scrub_user_data('${A}','cus_A')`);
res.anonPurge = await as('authenticated', `select public.purge_old_telemetry()`);
res.serviceScrub = await as('service_role', `select public.scrub_user_data('${A}','cus_A')`);
const be = (await db.query(`select stripe_event_id, user_id, payload from public.billing_events order by id`)).rows;
const pe = (await db.query(`select session_id from public.product_events where user_id is not null`)).rows.map(r => r.session_id);
const ce = (await db.query(`select message from public.client_errors where user_id is not null`)).rows.map(r => r.message);
res.servicePurge = await as('service_role', `select public.purge_old_telemetry()`);
const old = (await db.query(`select (select count(*) from public.product_events where event_name='old')::int pe, (select count(*) from public.client_errors where message='old')::int ce`)).rows[0];
console.log(res, JSON.stringify(be), pe, ce, old);
const checks = [
  ['anon NO puede ejecutar check_rate_limit', /ERR.*permission denied/.test(res.anonRL)],
  ['authenticated NO puede ejecutar check_rate_limit', /ERR.*permission denied/.test(res.authRL)],
  ['service_role sí', res.serviceRL === 'ok'],
  ['anon/authenticated NO pueden ejecutar scrub_user_data ni purge', /ERR/.test(res.anonScrub) && /ERR/.test(res.authScrub) && /ERR/.test(res.anonPurge)],
  ['scrub: payload de A (por user_id y por customer) sin email/nombre', be[0].payload.scrubbed === true && !JSON.stringify(be[0].payload).includes('a@test') && !JSON.stringify(be[1].payload).includes('a@test') && be[0].user_id === null],
  ['scrub: datos de B intactos', be[2].payload.customer_email === 'b@test.invalid' && be[2].user_id === B],
  ['scrub: product_events/client_errors de A borrados, los de B no', JSON.stringify(pe) === '["s2"]' && JSON.stringify(ce) === '["y"]'],
  ['purge: borra telemetría antigua', old.pe === 0 && old.ce === 0],
];
for (const [n, ok] of checks) console.log(ok ? 'PASS' : 'FAIL', n);
const ok = checks.every(c => c[1]); console.log(ok ? `ALL ${checks.length} PASSED` : 'SOME FAILED'); process.exit(ok ? 0 : 1);
