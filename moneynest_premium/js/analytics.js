/**
 * MoneyNest — js/analytics.js
 * Analítica de comportamiento propia (no de errores): permite ver en
 * qué paso del funnel se pierde la gente sin depender de ningún
 * servicio externo. Diseñada para nunca poder romper nada: todo va
 * envuelto en try/catch y nunca bloquea la interacción del usuario.
 */
;(function () {
  'use strict';

  const ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/track-event';
  const SESSION_KEY = 'mn_analytics_session_id';

  function _getSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (_) { return 'unknown'; }
  }

  function track(eventName, metadata) {
    try {
      const payload = {
        event: eventName,
        sessionId: _getSessionId(),
        metadata: metadata || null,
      };
      const headers = { 'Content-Type': 'application/json' };
      try {
        const token = window.MNSupabaseAuth?.getSession?.()?.access_token;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (_) {}

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
      } else {
        fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch (_) {
      // Tracking must never itself throw or break the app.
    }
  }

  window.MNAnalytics = { track };
})();
