import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'fs';
const M=new URL('../migrations/', import.meta.url).pathname;
const db = new PGlite({ extensions: { uuid_ossp } });
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
 create extension if not exists "uuid-ossp";
`);
await db.exec(`
 create table public.profiles (id uuid primary key default uuid_generate_v4(), email text unique not null,
  plan text not null default 'trial', trial_ends_at timestamptz, pro_trial_ends_at timestamptz,
  pro_trial_used boolean default false, stripe_customer_id text unique, cloud_enabled boolean default false,
  last_sync_at timestamptz, display_name text, session_id text, created_at timestamptz default now(), updated_at timestamptz default now());
 alter table public.profiles enable row level security;
 create policy "Users can view own profile" on public.profiles for select using (auth.uid()=id);
 create policy "Users can update own profile" on public.profiles for update using (auth.uid()=id);
 grant usage on schema public, auth to anon, authenticated, service_role;
 grant select, update on public.profiles to authenticated; grant all on public.profiles to service_role;
 grant execute on function auth.uid() to anon, authenticated, service_role;
 create function public.activate(p uuid) returns void language plpgsql security definer as $$ begin update public.profiles set plan='pro', cloud_enabled=true where id=p; end $$;
 grant execute on function public.activate(uuid) to authenticated, service_role;
`);
await db.exec(fs.readFileSync(M+'20261013000001_protect_profile_entitlements.sql','utf8'));
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222';
await db.exec(`insert into public.profiles(id,email) values ('${A}','a@test.invalid'),('${B}','b@test.invalid')`);
const as = async (role, uid, sql) => { await db.exec(`set role ${role}; select set_config('test.uid','${uid}',false);`); try { const r = await db.query(sql); await db.exec('reset role'); return 'ok:'+(r.affectedRows ?? r.rows.length); } catch(e){ await db.exec('reset role'); return 'ERR:'+e.message; } };
const res = {};
res.selfPlan      = await as('authenticated',A,`update public.profiles set plan='pro' where id='${A}'`);
res.selfCloud     = await as('authenticated',A,`update public.profiles set cloud_enabled=true where id='${A}'`);
res.selfCustomer  = await as('authenticated',A,`update public.profiles set stripe_customer_id='cus_x' where id='${A}'`);
res.selfTrialUsed = await as('authenticated',A,`update public.profiles set pro_trial_used=false, trial_ends_at=now() where id='${A}'`);
res.selfEmail     = await as('authenticated',A,`update public.profiles set email='x@test.invalid' where id='${A}'`);
res.selfSession   = await as('authenticated',A,`update public.profiles set session_id='s1', display_name='n' where id='${A}'`);
res.otherRow      = await as('authenticated',A,`update public.profiles set display_name='hack' where id='${B}'`);
res.service       = await as('service_role',A,`update public.profiles set plan='local' where id='${A}'`);
res.definerFn     = await as('authenticated',A,`select public.activate('${A}')`);
const final = (await db.query(`select plan, cloud_enabled, stripe_customer_id, display_name from public.profiles where id='${A}'`)).rows[0];
console.log(JSON.stringify(res,null,1)); console.log(final);
const expect = { selfPlan:/ERR/, selfCloud:/ERR/, selfCustomer:/ERR/, selfTrialUsed:/ERR/, selfEmail:/ERR/, selfSession:/ok:1/, otherRow:/ok:0/, service:/ok:1/, definerFn:/ok/ };
const bad = Object.entries(expect).filter(([k,re])=>!re.test(res[k]));
console.log(bad.length ? 'FAIL '+JSON.stringify(bad) : 'ALL H-01 CHECKS PASSED');
process.exit(bad.length?1:0);
