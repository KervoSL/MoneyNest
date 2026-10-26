// Daily re-engagement pushes. Called by pg_cron (pg_net) with header x-cron-secret.
// Secrets: VAPID_PRIVATE_KEY (Edge secret). Cron secret lives in table app_private.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = 'BNRtUPwIF2L3DncNvx0yZOuQQxXPPCeMd0ZkdZRUKSwTo2PbsFyIaJ1I9ZyE5VMRB8bq3SwYjvoswOmIbEOE1xo'
const SITE = 'https://moneynest.es/'
const DAY = 86400000

type Msg = { kind: string; title: string; body: string }

function pick<T>(a: T[], seed: number): T { return a[seed % a.length] }

function streakMessage(n: number, name: string, seed: number, en = false): Msg {
  const hi = name ? `${name}, ` : ''
  if (en) {
    if (n >= 30) return { kind: `streak-${n}`, title: `🔥 ${n}-day streak!`, body: `${hi}a champion's streak. Don't let it slip: open the app today and add one more day.` }
    if (n >= 7) return { kind: `streak-${n}`, title: pick([`🔥 ${n} days in a row`, `Don't lose your ${n}-day streak`], seed), body: `${hi}you just need to open the app today to keep it. It takes 10 seconds.` }
    return { kind: `streak-${n}`, title: pick([`🔥 You're on a ${n}-day streak`, `Your ${n}-day streak is waiting`], seed), body: `${hi}open the app today and keep what you've built.` }
  }
  if (n >= 30) return { kind: `streak-${n}`, title: `🔥 ¡${n} días de racha!`, body: `${hi}una racha de campeón. No la dejes escapar: entra hoy y suma un día más.` }
  if (n >= 7) return { kind: `streak-${n}`, title: pick([`🔥 ${n} días seguidos`, `No pierdas tu racha de ${n} días`], seed), body: `${hi}te falta entrar hoy para mantenerla. Te lleva 10 segundos.` }
  return { kind: `streak-${n}`, title: pick([`🔥 Llevas ${n} días de racha`, `Tu racha de ${n} días te espera`], seed), body: `${hi}entra hoy y no pierdas lo que has conseguido.` }
}

function messageFor(days: number, name: string, seed: number, en = false): Msg | null {
  const hi = name ? `${name}, ` : ''
  if (en) {
    if (days >= 30) return { kind: 'away30', title: 'Shall we continue? 💙', body: `${hi}it's been a month since you visited MoneyNest. Your numbers are still here, one tap away.` }
    if (days >= 14) return { kind: 'away14', title: pick(['Your finances miss you', 'Two weeks without you 👀'], seed), body: `${hi}it's been ${days} days since you last opened the app. Catching up takes 2 minutes.` }
    if (days >= 7) return { kind: 'away7', title: 'A week without opening the app', body: `${hi}shall we log the last few days' expenses? The sooner, the easier.` }
    if (days >= 5) return { kind: 'away5', title: `It's been ${days} days`, body: `${hi}your streak is paused. Log one expense and you're back in the race 🔥` }
    if (days >= 3) return { kind: 'away3', title: pick(['How are those expenses going?', 'A quick check-in 💡'], seed), body: `${hi}you haven't stopped by in ${days} days. Any expenses to log?` }
    return null
  }
  if (days >= 30) return { kind: 'away30', title: '¿Seguimos? 💙', body: `${hi}hace un mes que no pasas por MoneyNest. Tus números siguen aquí, a un toque.` }
  if (days >= 14) return { kind: 'away14', title: pick(['Tus finanzas te echan de menos', 'Dos semanas sin verte 👀'], seed), body: `${hi}hace ${days} días que no entras. Ponerlo al día te llevará 2 minutos.` }
  if (days >= 7) return { kind: 'away7', title: 'Una semana sin entrar', body: `${hi}¿registramos los gastos de estos días? Cuanto antes, menos cuesta.` }
  if (days >= 5) return { kind: 'away5', title: `Hace ${days} días que no entras`, body: `${hi}tu racha está en pausa. Un gasto apuntado y vuelves a la carrera 🔥` }
  if (days >= 3) return { kind: 'away3', title: pick(['¿Qué tal van esos gastos?', 'Un repaso rápido 💡'], seed), body: `${hi}llevas ${days} días sin pasar por aquí. ¿Algún gasto por apuntar?` }
  return null
}

async function sendTo(sb: any, subs: any[], payload: Record<string, string>) {
  let sent = 0, removed = 0, errors: string[] = []
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 43200, urgency: 'high' },
      )
      sent++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { await sb.from('push_subscriptions').delete().eq('id', s.id); removed++ }
      else errors.push(`${e?.statusCode ?? ''} ${String(e?.body ?? e?.message ?? e).slice(0, 160)}`)
    }
  }
  return { sent, removed, errors }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: vk } = await sb.from('app_private').select('value').eq('key', 'vapid_private_key').maybeSingle()
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') || vk?.value
  if (!priv) return json({ error: 'VAPID_PRIVATE_KEY missing' }, 500)
  webpush.setVapidDetails('mailto:joanmanenribas@gmail.com', VAPID_PUBLIC, priv)

  let body: any = {}
  try { body = await req.json() } catch { /* empty body */ }

  // ── Test push for the signed-in user (button in Settings) ──
  if (body?.test) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: u } = await sb.auth.getUser(token)
    if (!u?.user) return json({ error: 'unauthorized' }, 401)
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', u.user.id)
    if (!subs?.length) return json({ error: 'no_subscription' }, 404)
    const r = await sendTo(sb, subs, { title: 'MoneyNest — Prueba ✅', body: 'Las notificaciones push funcionan en este dispositivo.', tag: 'push-test', url: SITE })
    return json(r)
  }

  const { data: cfg } = await sb.from('app_private').select('value').eq('key', 'cron_secret').maybeSingle()
  if (!cfg?.value || req.headers.get('x-cron-secret') !== cfg.value) return json({ error: 'forbidden' }, 403)

  // ── Operator test to one user (cron secret only) ──
  if (body?.force_user) {
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', body.force_user)
    const r = await sendTo(sb, subs ?? [], { title: body.title || 'MoneyNest', body: body.body || 'Prueba de notificación', tag: 'push-test', url: SITE })
    return json({ subs: subs?.length ?? 0, ...r })
  }

  const { data: subs, error } = await sb.from('push_subscriptions').select('*')
  if (error) return json({ error: error.message }, 500)

  const now = Date.now()
  let sent = 0, removed = 0, skipped = 0
  for (const s of subs ?? []) {
    // max one push per 24h per device
    if (s.last_sent_at && now - new Date(s.last_sent_at).getTime() < DAY - 3600000) { skipped++; continue }
    const { data: p } = await sb.from('profiles').select('last_seen_at, display_name, streak, streak_date').eq('id', s.user_id).maybeSingle()
    const seen = p?.last_seen_at ? new Date(p.last_seen_at).getTime() : new Date(s.created_at).getTime()
    const days = Math.floor((now - seen) / DAY)
    const name = String((p as any)?.display_name || '').trim().split(/\s+/)[0] || ''
    // Streak at risk: opened yesterday (UTC) but not yet today → remind them, takes priority
    const todayStr = new Date(now).toISOString().slice(0, 10)
    const yesterdayStr = new Date(now - DAY).toISOString().slice(0, 10)
    const sd = (p as any)?.streak_date ? String((p as any).streak_date) : ''
    const sn = Number((p as any)?.streak) || 0
    const atRisk = sn >= 2 && sd === yesterdayStr && sd !== todayStr
    // Per-device preferences chosen in the app (empty object = defaults)
    const pr = (s.prefs && typeof s.prefs === 'object') ? s.prefs : {}
    const wantStreak = pr.streak !== false, wantAway = pr.reminders !== false, wantDaily = pr.daily === true
    const seenToday = new Date(seen).toISOString().slice(0, 10) === todayStr
    let m: Msg | null = null
    const en = !!pr.lang && pr.lang !== 'es'
    if (atRisk && wantStreak) m = streakMessage(sn, name, Math.floor(now / DAY), en)
    else if (wantAway) m = messageFor(days, name, Math.floor(now / DAY), en)
    if (!m && wantDaily && !seenToday && days < 3) {
      const hi = name ? `${name}, ` : ''
      m = en
        ? { kind: 'daily', title: pick(['📝 Have you logged today\'s expenses?', 'One minute for your finances'], Math.floor(now / DAY)), body: `${hi}log today's while you still remember.` }
        : { kind: 'daily', title: pick(['📝 ¿Has apuntado tus gastos de hoy?', 'Un minuto para tus finanzas'], Math.floor(now / DAY)), body: `${hi}anota lo de hoy mientras lo recuerdas.` }
    }
    if (!m) { skipped++; continue }
    // don't repeat the same escalation step twice in a row
    if (s.last_kind === m.kind && m.kind !== 'daily' && days < 30) { skipped++; continue }
    const r = await sendTo(sb, [s], { title: m.title, body: m.body, tag: 'reengage', url: SITE })
    if (r.sent) { await sb.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), last_kind: m.kind }).eq('id', s.id); sent++ }
    removed += r.removed
  }
  return json({ sent, removed, skipped })
})
