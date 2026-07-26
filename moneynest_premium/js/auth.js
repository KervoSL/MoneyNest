/**
 * ════════════════════════════════════════════════════════════════
 *  MoneyNest — js/auth.js  v2.0
 *  Modelo de negocio:
 *    trial       → 24h de prueba gratuita (al registrarse)
 *    locked_local→ trial expirado, app bloqueada. Requiere Plan Local
 *    local       → pago único 5€. Datos en localStorage, sin expiración
 *    pro         → suscripción 3€/año (7 días gratis desde local).
 *                  Si cancela → vuelve a local (nunca se bloquea de nuevo)
 *
 *  Uso (ES modules):
 *    import { initUser, checkAccess, getUser, … } from './js/auth.js'
 *
 *  Uso global (sin bundler):
 *    window.MNAuth.initUser()
 *    window.MNAuth.checkAccess()
 * ════════════════════════════════════════════════════════════════
 */

const MN_USER_KEY        = 'mn_user';
const TRIAL_DURATION_MS  = 24 * 60 * 60 * 1000;
const PRO_TRIAL_DAYS     = 7;

// Estas constantes son usadas por auth.js internamente y exportadas a window.MNAuth.
// app.js también las define con el mismo valor — cuando app.js carga, sobreescribe
// las globales. auth.js usa sus propias referencias locales, no las globales.
const _AUTH_PLANS = Object.freeze({
  GUEST:        'trial',
  TRIAL:        'trial',
  LOCKED_LOCAL: 'locked_local',
  LOCAL:        'local',
  PRO:          'pro',
});

const _AUTH_DEFAULT_USER = Object.freeze({
  id:              null,
  plan:            'trial',
  trialEndsAt:     null,
  createdAt:       null,
  upgradedAt:      null,
  email:           null,
  supabaseId:      null,
  cloudEnabled:    false,
  proTrialUsed:    false,
  proTrialEndsAt:  null,
});

const _AUTH_TRIAL_DAYS = 1;


// ════════════════════════════════════════════════════════════════
//  CRUD BÁSICO
// ════════════════════════════════════════════════════════════════

/**
 * Lee el usuario desde localStorage.
 * Si no existe o está corrupto devuelve _AUTH_DEFAULT_USER (sin tocar storage).
 * @returns {Object}
 */
function getUser() {
  try {
    const raw = localStorage.getItem(MN_USER_KEY);
    if (!raw) return { ..._AUTH_DEFAULT_USER };
    const parsed = JSON.parse(raw);
    return { ..._AUTH_DEFAULT_USER, ...parsed };
  } catch {
    return { ..._AUTH_DEFAULT_USER };
  }
}

/**
 * Persiste el usuario en localStorage.
 * @param {Object} user
 * @returns {Object}
 */
function saveUser(user) {
  try {
    localStorage.setItem(MN_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('[MNAuth] No se pudo guardar el usuario:', e);
  }
  return user;
}

/**
 * Actualiza solo los campos indicados y persiste.
 * @param {Object} patch
 * @returns {Object}
 */
function patchUser(patch) {
  const updated = { ...getUser(), ...patch };
  return saveUser(updated);
}


// ════════════════════════════════════════════════════════════════
//  CICLO DE VIDA
// ════════════════════════════════════════════════════════════════

/**
 * initUser() — llamar obligatoriamente al arrancar la app.
 * • Primera visita → crea identidad + trial de 24h.
 * • Visita posterior → garantiza coherencia de campos.
 * @returns {Object} usuario activo
 */
function initUser() {
  let user = getUser();

  if (!user.id) {
    // ── Primera visita ──────────────────────────────────────────
    const now = Date.now();
    user = {
      ..._AUTH_DEFAULT_USER,
      id:          _generateId(),
      plan:        _AUTH_PLANS.TRIAL,
      trialEndsAt: now + TRIAL_DURATION_MS,
      createdAt:   now,
    };
    saveUser(user);
    console.info('[MNAuth] Nuevo usuario — trial 24h hasta:', new Date(user.trialEndsAt).toLocaleString());
  } else {
    // ── Visita posterior — migración de campos ──────────────────
    let dirty = false;
    if (!user.createdAt) { user.createdAt = Date.now(); dirty = true; }
    // Migrar plan 'guest' legacy → 'trial'
    if (user.plan === 'guest') { user.plan = _AUTH_PLANS.TRIAL; dirty = true; }
    if (dirty) saveUser(user);
  }

  return user;
}

/**
 * checkAccess() — comprueba si el usuario puede usar la app.
 * Debe llamarse después de initUser() en cada arranque.
 *
 * • pro/local → siempre ok.
 * • trial → comprueba los 24h. Si expiró → pasa a locked_local y bloquea.
 * • locked_local → bloquea directamente.
 *
 * @returns {{ ok: boolean, reason: string|null }}
 */
function checkAccess() {
  const user = getUser();

  switch (user.plan) {
    // ── Planes desbloqueados ────────────────────────────────────
    case _AUTH_PLANS.PRO:
      _checkProSubscription(user); // puede hacer downgrade silencioso a local
      return { ok: true, reason: null };

    case _AUTH_PLANS.LOCAL:
      return { ok: true, reason: null };

    // ── Trial activo ────────────────────────────────────────────
    case _AUTH_PLANS.TRIAL: {
      const now = Date.now();
      if (user.trialEndsAt && now > user.trialEndsAt) {
        // Trial expirado → bloquear
        patchUser({ plan: _AUTH_PLANS.LOCKED_LOCAL, upgradedAt: now });
        bloquearApp();
        return { ok: false, reason: 'trial_expired' };
      }
      return { ok: true, reason: null };
    }

    // ── Bloqueado ───────────────────────────────────────────────
    case _AUTH_PLANS.LOCKED_LOCAL:
      bloquearApp();
      return { ok: false, reason: 'locked_local' };

    default:
      return { ok: true, reason: null };
  }
}

/**
 * Verifica silenciosamente si la suscripción Pro sigue activa.
 * Si el periodo de prueba Pro expiró y no hay suscripción pagada,
 * hace downgrade a 'local' (nunca a locked_local).
 * En producción, aquí se consultaría el backend/webhook de Stripe.
 * @param {Object} [user]
 */
function _checkProSubscription(user) {
  const u = user || getUser();
  if (u.plan !== _AUTH_PLANS.PRO) return;

  // Si tiene proTrialEndsAt significa que está en periodo de prueba Pro
  // y aún no ha vinculado pago. Downgrade silencioso al expirar.
  if (u.proTrialEndsAt && Date.now() > u.proTrialEndsAt && !u.proSubscriptionActive) {
    cancelPro();
    console.info('[MNAuth] Prueba Pro expirada → plan local restaurado.');
  }
}


// ════════════════════════════════════════════════════════════════
//  GESTIÓN DE PLANES
// ════════════════════════════════════════════════════════════════

/**
 * upgradeTrial(email?) — [re]inicia el trial de 24h.
 * Útil si el usuario se registra por primera vez con email.
 * @param {string} [email]
 * @returns {Object}
 */
function upgradeTrial(email) {
  const now = Date.now();
  const trialEndsAt = now + TRIAL_DURATION_MS;
  const user = patchUser({
    plan:        _AUTH_PLANS.TRIAL,
    trialEndsAt,
    upgradedAt:  now,
    ...(email ? { email } : {}),
  });
  console.info('[MNAuth] Trial activado. Expira:', new Date(trialEndsAt).toLocaleString());
  return user;
}

/**
 * buyLocal(email?) — activa el Plan Local (pago único 5€).
 * Llama a esta función DESPUÉS de confirmar el pago con tu pasarela.
 * @param {string} [email]
 * @returns {Object}
 */
function buyLocal(email) {
  const user = patchUser({
    plan:            _AUTH_PLANS.LOCAL,
    trialEndsAt:     null,   // el trial ya no aplica
    cloudEnabled:    false,
    upgradedAt:      Date.now(),
    ...(email ? { email } : {}),
  });
  console.info('[MNAuth] Plan Local activado.');
  return user;
}

/**
 * activatePro(email?) — activa el Plan Pro (3€/año).
 * • Si !proTrialUsed: incluye 7 días de prueba gratuita.
 * • Llama DESPUÉS de confirmar suscripción con tu pasarela.
 * @param {string} [email]
 * @param {boolean} [skipTrial=false] — true si el usuario ya pagó directo
 * @returns {Object}
 */
function activatePro(email, skipTrial = false) {
  const current = getUser();
  const now = Date.now();
  const useFreeTrial = !current.proTrialUsed && !skipTrial;

  const user = patchUser({
    plan:                  _AUTH_PLANS.PRO,
    cloudEnabled:          true,
    proTrialEndsAt:        useFreeTrial ? now + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000 : null,
    proTrialUsed:          true,
    proSubscriptionActive: !useFreeTrial, // true si pagó directo (no trial)
    upgradedAt:            now,
    ...(email ? { email } : {}),
  });
  console.info('[MNAuth] Plan Pro activado. Trial gratis:', useFreeTrial);
  return user;
}

/**
 * cancelPro() — cancela la suscripción Pro y vuelve a local.
 * NUNCA genera locked_local. Los datos del usuario se conservan.
 * @returns {Object}
 */
function cancelPro() {
  const user = patchUser({
    plan:                  _AUTH_PLANS.LOCAL,
    cloudEnabled:          false,
    proTrialEndsAt:        null,
    proSubscriptionActive: false,
    upgradedAt:            Date.now(),
  });
  console.info('[MNAuth] Suscripción Pro cancelada → plan local.');
  return user;
}

/** @deprecated — alias para compatibilidad con app.js legacy */
function upgradePro(email)  { return activatePro(email); }
/** @deprecated — alias para compatibilidad con app.js legacy */
function downgradeGuest()   { return cancelPro(); }


// ════════════════════════════════════════════════════════════════
//  HELPERS DE ESTADO
// ════════════════════════════════════════════════════════════════

/** Milisegundos restantes de trial (0 si no aplica o expiró). */
function trialMsLeft() {
  const user = getUser();
  if (user.plan !== _AUTH_PLANS.TRIAL || !user.trialEndsAt) return 0;
  return Math.max(0, user.trialEndsAt - Date.now());
}

/** Horas restantes de trial (decimal, 0 si expiró). */
function trialHoursLeft() {
  return trialMsLeft() / (60 * 60 * 1000);
}

/**
 * Representación legible del tiempo de trial restante.
 * @returns {string} p.ej. "18h 34m" o "45m"
 */
function trialTimeLeftLabel() {
  const ms = trialMsLeft();
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** @deprecated — alias legacy (devuelve días redondeados) */
function trialDaysLeft() {
  return Math.ceil(trialHoursLeft() / 24);
}

function isTrialExpired() {
  const user = getUser();
  return (user.plan === _AUTH_PLANS.TRIAL || user.plan === _AUTH_PLANS.LOCKED_LOCAL)
    && !!user.trialEndsAt && Date.now() > user.trialEndsAt;
}

function isTrial()       { return getUser().plan === _AUTH_PLANS.TRIAL;        }
function isLocked()      { return getUser().plan === _AUTH_PLANS.LOCKED_LOCAL;  }
function isLocal()       { return getUser().plan === _AUTH_PLANS.LOCAL;         }
function isPro()         { return getUser().plan === _AUTH_PLANS.PRO;           }
/** @deprecated — en el nuevo modelo no hay plan 'guest' */
function isGuest()       { return isTrial();                              }


// ════════════════════════════════════════════════════════════════
//  PAYWALL — bloquearApp()
// ════════════════════════════════════════════════════════════════

/**
 * bloquearApp() — reemplaza el <body> con la pantalla de bloqueo.
 * Se muestra cuando plan = 'locked_local' (trial de 24h expirado).
 * Compatible con el sistema de temas de MoneyNest (data-theme).
 */
function bloquearApp() {
  const user = getUser();
  document.body.style.overflow = 'hidden';
  document.body.innerHTML = _buildPaywallHTML(user);
}


// ════════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ════════════════════════════════════════════════════════════════

function _generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}

function _pw(key, fallback) {
  if (typeof window.t === 'function') {
    const v = window.t(key);
    return (v && v !== key) ? v : fallback;
  }
  return fallback;
}

function _buildPaywallHTML(user) {
  const theme  = (() => { try { return document.documentElement.getAttribute('data-theme') || 'dark'; } catch { return 'dark'; } })();
  const isDark = theme === 'dark';

  const bg     = isDark ? '#0A0E17' : '#F1F5F9';
  const card   = isDark ? '#111827' : '#FFFFFF';
  const text   = isDark ? '#E8EFF7' : '#0F172A';
  const text2  = isDark ? '#94A3B8' : '#475569';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const accent = '#00D4AA';
  const red    = '#F43F5E';

  return /* html */`
    <!DOCTYPE html>
    <html lang="es" data-theme="${theme}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MoneyNest — Acceso Expirado</title>
      <script src="https://js.stripe.com/v3/"></script>
    </head>
    <body>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: ${bg};
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; padding: 24px;
      }

      .pw-wrap {
        width: 100%; max-width: 460px; text-align: center;
        animation: pwIn .5s cubic-bezier(0.22,1,0.36,1) forwards;
      }
      @keyframes pwIn {
        from { opacity: 0; transform: scale(.96) translateY(16px); }
        to   { opacity: 1; transform: none; }
      }

      .pw-card {
        background: ${card};
        border: 1px solid ${border};
        border-radius: 24px;
        padding: 40px 36px 32px;
        box-shadow: 0 32px 80px rgba(0,0,0,${isDark ? '.7' : '.12'});
        margin-bottom: 16px;
      }

      .pw-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(244,63,94,.12); border: 1px solid rgba(244,63,94,.25);
        color: ${red}; font-size: .7rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: .1em;
        padding: 4px 12px; border-radius: 99px; margin-bottom: 24px;
      }
      .pw-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: ${red}; }

      .pw-icon {
        font-size: 3.5rem; margin-bottom: 16px; display: block;
        animation: pwPop .5s cubic-bezier(0.34,1.56,.64,1) .1s both;
      }
      @keyframes pwPop { from { transform: scale(0); } to { transform: scale(1); } }

      .pw-title {
        font-size: 1.6rem; font-weight: 800; color: ${text};
        letter-spacing: -.04em; line-height: 1.2; margin-bottom: 10px;
      }
      .pw-sub {
        font-size: .9rem; color: ${text2}; line-height: 1.65; margin-bottom: 28px;
      }

      /* Pricing card */
      .pw-price-card {
        background: linear-gradient(135deg, rgba(0,212,170,.1), rgba(0,212,170,.04));
        border: 1px solid rgba(0,212,170,.25);
        border-radius: 16px; padding: 20px; margin-bottom: 20px;
      }
      .pw-price-label {
        font-size: .68rem; font-weight: 700; color: ${accent};
        text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px;
      }
      .pw-price-amount {
        font-size: 2.2rem; font-weight: 800; color: ${text};
        letter-spacing: -.05em; line-height: 1;
      }
      .pw-price-amount span { font-size: 1rem; font-weight: 600; color: ${text2}; }
      .pw-price-desc {
        font-size: .78rem; color: ${text2}; margin-top: 6px; line-height: 1.5;
      }

      /* Feature list */
      .pw-features { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; text-align: left; }
      .pw-feat {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px;
        background: rgba(0,212,170,.06); border: 1px solid rgba(0,212,170,.12);
        border-radius: 10px; font-size: .82rem; color: ${text}; font-weight: 600;
      }
      .pw-feat-icon { font-size: 1rem; flex-shrink: 0; }

      /* Buttons */
      .pw-btn-primary {
        width: 100%; padding: 16px; border-radius: 14px; border: none;
        background: linear-gradient(135deg, #00D4AA, #00A882);
        color: #0A0E17; font-size: 1rem; font-weight: 800;
        cursor: pointer; font-family: inherit; letter-spacing: -.01em;
        box-shadow: 0 6px 24px rgba(0,212,170,.35);
        transition: transform .2s, box-shadow .2s;
        margin-bottom: 10px;
      }
      .pw-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 36px rgba(0,212,170,.45); }

      .pw-btn-ghost {
        width: 100%; padding: 13px; border-radius: 12px;
        border: 1.5px solid ${border};
        background: transparent; color: ${text2};
        font-size: .85rem; font-weight: 600;
        cursor: pointer; font-family: inherit; transition: all .18s;
      }
      .pw-btn-ghost:hover { border-color: ${accent}; color: ${accent}; }

      .pw-note { font-size: .72rem; color: ${text2}; line-height: 1.5; }
      .pw-note a { color: ${accent}; text-decoration: none; font-weight: 600; }
    </style>

    <div class="pw-wrap">
      <div class="pw-card">
        <div class="pw-badge"><div class="pw-badge-dot"></div>${_pw('paywall_badge','Prueba de 24h finalizada')}</div>
        <span class="pw-icon">🔒</span>
        <div class="pw-title">${_pw('paywall_title','Tu acceso ha expirado')}</div>
        <div class="pw-sub">
          ${_pw('paywall_sub','Tus datos están a salvo. Elige el plan que mejor se adapte a ti para seguir usando MoneyNest.')}
        </div>

        <!-- Plan Local -->
        <div class="pw-price-card" style="margin-bottom:10px">
          <div class="pw-price-label">💾 ${_pw('paywall_local_label','Plan Local — pago único')}</div>
          <div class="pw-price-amount">5€ <span>${_pw('paywall_local_period','para siempre')}</span></div>
          <div class="pw-price-desc" style="margin-bottom:12px">${_pw('paywall_local_desc','Sin suscripción. Sin sorpresas. Tus datos en tu dispositivo.')}</div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;text-align:left">
            <div class="pw-feat" style="padding:7px 12px"><span class="pw-feat-icon">✅</span>${_pw('paywall_local_feat1','Todos tus datos conservados')}</div>
            <div class="pw-feat" style="padding:7px 12px"><span class="pw-feat-icon">✅</span>${_pw('paywall_local_feat2','Ingresos, gastos, inversiones ilimitados')}</div>
            <div class="pw-feat" style="padding:7px 12px"><span class="pw-feat-icon">✅</span>${_pw('paywall_local_feat3','Exportación PDF y Excel')}</div>
          </div>
          <button class="pw-btn-primary" id="pw-buy-local-btn" style="margin-bottom:0">
            🔓 ${_pw('paywall_local_cta','Comprar Plan Local — 6,99€ →')}
          </button>
        </div>

        <!-- Plan Pro -->
        <div style="
          background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(99,102,241,.04));
          border:1px solid rgba(99,102,241,.3);border-radius:16px;padding:18px;margin-bottom:16px;
        ">
          <div style="font-size:.68rem;font-weight:700;color:#A5B4FC;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">⚡ ${_pw('paywall_pro_label','Plan Pro — todo incluido')}</div>
          <div style="font-size:1.6rem;font-weight:800;color:${text};letter-spacing:-.04em;line-height:1;margin-bottom:4px">
            6,99€ <span style="font-size:.9rem;font-weight:600;color:${text2}">${_pw('paywall_pro_price_sub','Local + 3€/año Pro')}</span>
          </div>
          <div style="font-size:.75rem;color:#A5B4FC;margin-bottom:12px">${_pw('paywall_pro_trial','7 días gratis · Sin compromiso')}</div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;text-align:left">
            <div class="pw-feat" style="padding:7px 12px;background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.15)"><span class="pw-feat-icon">☁️</span>${_pw('paywall_pro_feat1','Sincronización multi-dispositivo')}</div>
            <div class="pw-feat" style="padding:7px 12px;background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.15)"><span class="pw-feat-icon">🔄</span>${_pw('paywall_pro_feat2','Backup automático en la nube')}</div>
            <div class="pw-feat" style="padding:7px 12px;background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.15)"><span class="pw-feat-icon">⚡</span>${_pw('paywall_pro_feat3','Todo lo del Plan Local incluido')}</div>
          </div>
          <button style="
            width:100%;padding:13px;border-radius:12px;border:none;
            background:linear-gradient(135deg,#6366F1,#4F46E5);
            color:#fff;font-size:.88rem;font-weight:800;cursor:pointer;font-family:inherit;
            box-shadow:0 6px 20px rgba(99,102,241,.35);
          " id="pw-buy-pro-btn">
            ⚡ ${_pw('paywall_pro_cta','Activar Plan Pro — 7 días gratis →')}
          </button>
        </div>

        <button class="pw-btn-ghost" id="pw-restore-btn-inline">
          ${_pw('paywall_restore_btn','¿Ya compraste? Restaurar acceso')}
        </button>
      </div>

      <p class="pw-note">
        ${_pw('paywall_note','Tus datos no se han borrado y están seguros.')} ·
        <a href="#" id="pw-restore-link">${_pw('paywall_restore_link','Restaurar licencia')}</a>
      </p>
    </div>

    <script>
      // Stripe config
      const STRIPE_KEY = 'pk_live_51T57NbFWll222Kpac9uR0087YoUUATVJCxRg3TzYSC7y0EacJnpooDne5ty7vZOEGrkqA35mj6Rf5unOsDiMzBlp00h0Q8bEJt';
      const PRICE_LOCAL = 'price_1TTJCBFWll222Kpazyvo4A4W';
      const PRICE_PRO = 'price_1TTJD3FWll222KpaJ1T6OG6C';
      const CHECKOUT_ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-checkout';

      const stripe = Stripe(STRIPE_KEY);

      async function openCheckout(priceId) {
        const btn = event.target;
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.textContent = '⏳ Abriendo checkout...';

        try {
          const res = await fetch(CHECKOUT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId, email: '' })
          });

          if (!res.ok) throw new Error('Error al crear checkout');

          const { url } = await res.json();
          if (url) window.location.href = url;
          else throw new Error('No URL returned');

        } catch (err) {
          alert('Error al abrir el pago. Por favor recarga la página e inténtalo de nuevo.');
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.textContent = btn.id === 'pw-buy-local-btn'
            ? '🔓 Comprar Plan Local — 6,99€ →'
            : '⚡ Activar Plan Pro — 7 días gratis →';
        }
      }

      document.getElementById('pw-buy-local-btn').addEventListener('click', () => openCheckout(PRICE_LOCAL));
      document.getElementById('pw-buy-pro-btn').addEventListener('click', () => openCheckout(PRICE_PRO));

      document.getElementById('pw-restore-btn-inline').addEventListener('click', () => {
        window.location.reload();
      });
      document.getElementById('pw-restore-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.reload();
      });
    </script>
    </body>
    </html>
  `;
}

// _initPaywallListeners removed — now inline in HTML with Stripe.js


// ════════════════════════════════════════════════════════════════
//  EXPORT GLOBAL (para entornos sin ES modules)
// ════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.MNAuth = {
    // Constantes
    PLANS:      _AUTH_PLANS,
    _AUTH_DEFAULT_USER,
    TRIAL_DAYS: _AUTH_TRIAL_DAYS,
    // CRUD
    getUser,
    saveUser,
    patchUser,
    // Lifecycle
    initUser,
    checkAccess,
    // Plan management
    upgradeTrial,
    buyLocal,
    activatePro,
    cancelPro,
    // Aliases legacy
    upgradePro:    activatePro,
    downgradeGuest: cancelPro,
    // Helpers de estado
    trialMsLeft,
    trialHoursLeft,
    trialTimeLeftLabel,
    trialDaysLeft,   // legacy
    isTrialExpired,
    isTrial,
    isLocked,
    isLocal,
    isPro,
    isGuest,         // legacy
    // UI
    bloquearApp,
  };
}
