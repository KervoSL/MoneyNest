/* ─── MoneyNest Service Worker v47 ─────────────────────────────── */
// IMPORTANT: bump CACHE_NAME (and version.json) on EVERY deploy. The
// browser only detects a new app version when this file's bytes change,
// and files are served cache-first, so a deploy that forgets this bump
// never reaches users who already have the app installed.
const CACHE_NAME = 'moneynest-v59'
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-with-text.png',
  './assets/og-image.png',
  './css/styles.css',
  './css/billing.css',
  './css/wizard-shared.css',

  './css/data-manager.css',
  './css/premium-ux.css',
  './js/auth.js',
  './js/supabase-auth.js',
  './js/entitlements.js',
  './js/data.js',
  './privacy.html',
  './terms.html',
  './js/config.js',
  './js/consent.js',
  './js/error-logging.js',
  './js/investment-wizard.js',
  './js/transaction-wizard.js',
  './js/debt-wizard.js',
  './js/app.js',
  './js/i18n-patch.js',
  './js/app-i18n-patch.js',
  './js/mn-email.js',
  './components/auth-ui.js',
  './js/stripe-config.js',
  './js/stripe-payment.js',
  './js/billing.js',
  './js/billing-ui.js',
  './js/auth-ui.js',
  './js/billing-i18n-patch.js',
  './js/data-manager.js',
  './js/sync.js',

  './js/gamification-guides.js',
  './js/gamification.js',
  './js/bank-import.js',
  './js/recurring.js',
  './js/notifications.js',
  './js/kpi-animator.js',
  './js/premium-empty-states.js',
  './js/premium-features.js',
  './js/premium-ux.js',
  './js/install-prompt.js',
]
const REMOTE_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Each LOCAL_ASSETS fetch explicitly bypasses the browser's own
      // HTTP cache (cache: 'reload') — cache.addAll() alone doesn't
      // guarantee this, and without it a stale HTTP-cached copy of
      // e.g. js/app.js could get pre-cached into a brand new
      // CACHE_NAME during an update, defeating the whole update
      // mechanism silently (the SW correctly detects a new version,
      // but re-caches the same old file contents).
      Promise.all(
        LOCAL_ASSETS.map(url =>
          fetch(url, { cache: 'reload' })
            .then(r => { if (r.ok) return cache.put(url, r) })
            .catch(() => {})
        )
      ).then(() =>
        Promise.allSettled(
          REMOTE_ASSETS.map(url =>
            fetch(url, { mode: 'cors' })
              .then(r => { if (r.ok) cache.put(url, r) })
              .catch(() => {})
          )
        )
      )
    )
    // NOTE: skipWaiting() is intentionally NOT called here anymore.
    // A new worker now stays in 'waiting' until the person explicitly
    // confirms the update banner — see the 'message' listener below.
    // This never touches LocalStorage/IndexedDB either way; only the
    // Cache Storage (app files) is ever affected.
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Only path that lets a waiting worker take over: the person pressed
// "Actualizar ahora" in the app's own update banner (see app.js).
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'MoneyNest', {
    body: d.body || '',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    tag: d.tag || 'moneynest-push',
    data: { url: d.url || './' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('moneynest') || c.url.includes('localhost'))
      if (existing) return existing.focus()
      return clients.openWindow((event.notification.data && event.notification.data.url) || './')
    })
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = event.request.url
  if (url.startsWith('chrome-extension://') || url.startsWith('blob:')) return

  // version.json is always fetched fresh from the network — comparing
  // a cached copy against itself would never detect a new deploy.
  if (url.endsWith('/version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    )
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(event.request)).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.open(CACHE_NAME).then(cache => cache.match('./index.html'))
        return new Response('', { status: 503 })
      })
    })
  )
})
