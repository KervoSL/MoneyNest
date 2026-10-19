// Daily re-engagement pushes. Called by pg_cron (pg_net) with header x-cron-secret.
// Secrets: VAPID_PRIVATE_KEY (Edge secret). Cron secret lives in table app_private.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = 'BNRtUPwIF2L3DncNvx0yZOuQQxXPPCeMd0ZkdZRUKSwTo2PbsFyIaJ1I9ZyE5VMRB8bq3SwYjvoswOmIbEOE1xo'
const SITE = 'https://money-nest-nk2u.vercel.app/'
const DAY = 86400000

type Msg = { kind: string; title: string; body: string }

function pick<T>(a: T[], seed: number): T { return a[seed % a.length] }

function messageFor(days: number, name: string, seed: number): Msg | null {
  const hi = name ? `${name}, ` : ''
  if (days >= 30) return { kind: 'away30', title: '¿Seguimos? 💙', body: `${hi}hace un mes que no pasas por MoneyNest. Tus números siguen aquí, a un toque.` }
  if (days >= 14) return { kind: 'away14', title: pick(['Tus finanzas te echan de menos', 'Dos semanas sin verte 👀'], seed), body: `${hi}hace ${days} días que no entras. Ponerlo al día te llevará 2 minutos.` }
  if (days >= 7) return { kind: 'away7', title: 'Una semana sin entrar', body: `${hi}¿registramos los gastos de estos días? Cuanto antes, menos cuesta.` }
  if (days >= 5) return { kind: 'away5', title: `Hace ${days} días que no entras`, body: `${hi}tu racha está en pausa. Un gasto apuntado y vuelves a la carrera 🔥` }
  if (days >= 3) return { kind: 'away3', title: pick(['¿Qué tal van esos gastos?', 'Un repaso rápido 💡'], seed), body: `${hi}llevas ${days} días sin pasar por aquí. ¿Algún gasto por apuntar?` }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg } = await sb.from('app_private').select('value').eq('key', 'cron_secret').maybeSingle()
  if (!cfg?.value || req.headers.get('x-cron-secret') !== cfg.value) return new Response('forbidden', { status: 403 })

  const { data: vk } = await sb.from('app_private').select('value').eq('key', 'vapid_private_key').maybeSingle()
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') || vk?.value
  if (!priv) return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY missing' }), { status: 500 })
  webpush.setVapidDetails('mailto:joanmanenribas@gmail.com', VAPID_PUBLIC, priv)

  const { data: subs, error } = await sb.from('push_subscriptions').select('*')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const now = Date.now()
  let sent = 0, removed = 0, skipped = 0
  for (const s of subs ?? []) {
    // max one push per 24h per device
    if (s.last_sent_at && now - new Date(s.last_sent_at).getTime() < DAY - 3600000) { skipped++; continue }
    const { data: p } = await sb.from('profiles').select('last_seen_at, display_name').eq('id', s.user_id).maybeSingle()
    const seen = p?.last_seen_at ? new Date(p.last_seen_at).getTime() : null
    if (!seen) { skipped++; continue }
    const days = Math.floor((now - seen) / DAY)
    const name = String((p as any)?.display_name || '').trim().split(/\s+/)[0] || ''
    const m = messageFor(days, name, Math.floor(now / DAY))
    if (!m) { skipped++; continue }
    // don't repeat the same escalation step twice in a row
    if (s.last_kind === m.kind && days < 30) { skipped++; continue }
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: m.title, body: m.body, tag: 'reengage', url: SITE }),
        { TTL: 43200 },
      )
      await sb.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), last_kind: m.kind }).eq('id', s.id)
      sent++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { await sb.from('push_subscriptions').delete().eq('id', s.id); removed++ }
    }
  }
  return new Response(JSON.stringify({ sent, removed, skipped }), { headers: { 'content-type': 'application/json' } })
})
