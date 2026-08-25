/* ─── MoneyNest Service Worker v9 ─────────────────────────────── */
const CACHE_NAME = 'moneynest-v9'
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-with-text.png',
  './css/styles.css',
  './css/billing.css',
  './css/data-manager.css',
  './css/premium-ux.css',
  './js/auth.js',
  './js/supabase-auth.js',
  './js/entitlements.js',
  './js/data.js',
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
      cache.addAll(LOCAL_ASSETS).then(() =>
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

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('moneynest') || c.url.includes('localhost'))
      if (existing) return existing.focus()
      return clients.openWindow('./')
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
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html')
        return new Response('', { status: 503 })
      })
    })
  )
})
