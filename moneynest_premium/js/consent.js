/**
 * MoneyNest — js/consent.js
 * Consentimiento para la analítica de producto (art. 22.2 LSSI-CE / RGPD).
 *  - Sin decisión previa NO se guarda ningún identificador ni se envía ningún evento.
 *  - «Aceptar» y «Rechazar» tienen el mismo aspecto, tamaño y nivel.
 *  - La decisión se guarda en localStorage (`mn_consent_v1`) y se puede cambiar
 *    en cualquier momento con MNConsent.open() (botón en Ajustes).
 * Solo hay una finalidad opcional: analítica de producto (eventos del embudo).
 */
;(function () {
  'use strict';

  const KEY = 'mn_consent_v1';
  const ANALYTICS_ID_KEY = 'mn_analytics_session_id';

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && (v.analytics === 'granted' || v.analytics === 'denied')) return v;
    } catch (_) {}
    return null;
  }

  function lang() {
    let l = '';
    try { l = localStorage.getItem('mn7_lang') || ''; } catch (_) {}
    l = (l || navigator.language || 'es').slice(0, 2).toLowerCase();
    return l === 'es' ? 'es' : 'en';
  }

  const TXT = {
    es: {
      title: 'Tu privacidad',
      body: 'MoneyNest puede usar un identificador anónimo en tu dispositivo y registrar eventos de uso (por ejemplo, en qué paso del registro te quedas) para mejorar el producto. No se usa para publicidad. Puedes cambiar tu elección cuando quieras en Ajustes.',
      accept: 'Aceptar',
      reject: 'Rechazar',
      more: 'Política de privacidad',
    },
    en: {
      title: 'Your privacy',
      body: 'MoneyNest may use an anonymous identifier on your device and record usage events (for example, which sign-up step you stop at) to improve the product. It is not used for advertising. You can change your choice at any time in Settings.',
      accept: 'Accept',
      reject: 'Reject',
      more: 'Privacy policy',
    },
  };

  function has(purpose) {
    const c = read();
    return !!c && c[purpose || 'analytics'] === 'granted';
  }

  function set(analytics) {
    const value = analytics ? 'granted' : 'denied';
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: value, ts: Date.now() })); } catch (_) {}
    if (value === 'denied') {
      // Rechazar o retirar el consentimiento borra el identificador de analítica.
      try { localStorage.removeItem(ANALYTICS_ID_KEY); } catch (_) {}
    }
    try { window.dispatchEvent(new CustomEvent('mn-consent-changed', { detail: { analytics: value } })); } catch (_) {}
  }

  function close() { document.getElementById('mn-consent-banner')?.remove(); }

  function open() {
    if (document.getElementById('mn-consent-banner')) return;
    const t = TXT[lang()];
    const btn = 'flex:1;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.28);background:#16203a;color:#fff;font:600 .9rem/1.2 inherit;cursor:pointer';
    const wrap = document.createElement('div');
    wrap.id = 'mn-consent-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', t.title);
    wrap.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99999;max-width:560px;margin:0 auto;background:#0D1424;color:#e8ecf5;border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:inherit';
    wrap.innerHTML =
      '<div style="font-weight:800;margin-bottom:6px">' + t.title + '</div>' +
      '<p style="margin:0 0 12px;font-size:.84rem;line-height:1.45;color:#b9c2d6">' + t.body +
      ' <a href="privacy.html" target="_blank" rel="noopener" style="color:#9fb4ff">' + t.more + '</a></p>' +
      '<div style="display:flex;gap:10px">' +
      '<button type="button" id="mn-consent-reject" style="' + btn + '">' + t.reject + '</button>' +
      '<button type="button" id="mn-consent-accept" style="' + btn + '">' + t.accept + '</button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#mn-consent-reject').addEventListener('click', () => { set(false); close(); });
    wrap.querySelector('#mn-consent-accept').addEventListener('click', () => { set(true); close(); });
  }

  function init() { if (!read()) open(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MNConsent = { has, set, open, get: read };
})();
