/**
 * MoneyNest — js/mn-email.js
 * Helper para enviar emails via la Edge Function send-email.
 * Usado en: registro, onboarding, sugerencias.
 */
;(function () {
  'use strict';

  const ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/send-email';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRjaXFxaG1ma2JxaGRyZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjkyMjcsImV4cCI6MjA5NDM0NTIyN30.Gqz39AWpW1BkWXhfhnR_vOUYUy93bgdSNvBfXYQ3VGk';

  async function _send(payload) {
    try {
      const headers = { 'Content-Type': 'application/json', 'apikey': ANON_KEY };
      try {
        const token = window.MNSupabaseAuth?.getSession?.()?.access_token;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (_) {}
      const res = await fetch(ENDPOINT, {
        method:  'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Envía el email de bienvenida al nuevo usuario.
   * @param {string} to   — email del usuario
   * @param {string} nombre — nombre opcional
   */
  async function sendWelcome(to, nombre) {
    if (!to) return;
    // El servidor envía siempre al email de la sesión; `to` ya no se usa como destinatario.
    let lang = 'es';
    try { lang = (window._currentLang || localStorage.getItem('mn7_lang') || 'es'); } catch (_) {}
    return _send({ type: 'confirmacion', nombre: nombre || '', lang });
  }

  /**
   * Envía una sugerencia directamente a soporte.
   * @param {string} tipo
   * @param {string} categoria
   * @param {string} mensaje
   * @param {string} userEmail — email del remitente (reply-to)
   */
  async function sendSugerencia(tipo, categoria, mensaje, userEmail) {
    return _send({ type: 'sugerencia', tipo, categoria, mensaje, userEmail });
  }

  window.MNEmail = { sendWelcome, sendSugerencia };
})();
