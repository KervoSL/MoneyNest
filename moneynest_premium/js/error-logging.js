/**
 * MoneyNest — js/error-logging.js
 * Captura errores JS reales y promesas rechazadas no manejadas en
 * producción, y los envía a log-error para poder verlos sin depender
 * de que el usuario los reporte manualmente con una captura de pantalla.
 * Diseñado para NUNCA poder romper nada por sí mismo: todo va envuelto
 * en try/catch, y nunca bloquea ni ralentiza la app.
 */
;(function () {
  'use strict';

  const ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/log-error';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRjaXFxaG1ma2JxaGRyZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjkyMjcsImV4cCI6MjA5NDM0NTIyN30.Gqz39AWpW1BkWXhfhnR_vOUYUy93bgdSNvBfXYQ3VGk';

  // Known-noisy errors that come from the browser/extensions/network,
  // not from a real bug in our own code — reporting these would just
  // add noise that makes real bugs harder to spot.
  const IGNORE_PATTERNS = [
    /ResizeObserver loop/i,
    /Script error\.?$/,               // cross-origin script errors with no real detail
    /Non-Error promise rejection captured/i,
    /Load failed/i,                    // often ad-blockers/network blips, not app bugs
    /ChunkLoadError/i,
  ];

  // Per-session dedupe: never send the exact same error more than a
  // handful of times in one page load (protects against error loops
  // flooding the endpoint, and keeps the table useful/readable).
  const seenCounts = {};
  const MAX_PER_FINGERPRINT = 3;

  function _fingerprint(message, stack) {
    const firstStackLine = (stack || '').split('\n')[1] || '';
    return (message + firstStackLine).slice(0, 200);
  }

  function _shouldIgnore(message) {
    return IGNORE_PATTERNS.some(re => re.test(message || ''));
  }

  function report(message, stack, extra) {
    try {
      if (!message || _shouldIgnore(message)) return;
      const fp = _fingerprint(message, stack);
      seenCounts[fp] = (seenCounts[fp] || 0) + 1;
      if (seenCounts[fp] > MAX_PER_FINGERPRINT) return;

      const payload = {
        message: String(message).slice(0, 2000),
        stack: stack ? String(stack).slice(0, 8000) : null,
        url: location.href,
        appVersion: (typeof window.VERSION !== 'undefined') ? window.VERSION : null,
        fingerprint: fp,
        ...extra,
      };

      const headers = { 'Content-Type': 'application/json', 'apikey': ANON_KEY };
      // Include the user's own session if available, so errors can be
      // linked to a real account for easier follow-up — never required.
      try {
        const token = window.MNSupabaseAuth?.getSession?.()?.access_token;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (_) {}

      // sendBeacon survives the page unloading right after a crash;
      // fall back to fetch if unavailable. Never awaited, never throws.
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT + '?apikey=' + encodeURIComponent(ANON_KEY), blob);
      } else {
        fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch (_) {
      // Logging must never itself throw or break the app.
    }
  }

  window.addEventListener('error', (event) => {
    // Ignore errors from other origins loading resources we don't control.
    if (event.message === 'Script error.' && !event.filename) return;
    report(event.message, event.error?.stack, { });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason);
    report(message, reason?.stack, {});
  });

  window.MNErrorLogging = { report };
})();
