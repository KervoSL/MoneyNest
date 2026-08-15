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
  };
}
