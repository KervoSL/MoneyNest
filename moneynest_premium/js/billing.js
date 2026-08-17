/**
 * ════════════════════════════════════════════════════════════════
 *  MoneyNest — js/billing.js  v1.0  [i18n]
 *  Mock Subscription Engine — preparado para conectar backend
 *
 *  Planes:
 *    FREE_TRIAL   → 24h acceso completo (auto-asignado)
 *    LOCAL_LIFETIME → pago único 5€, offline-first, sin expiración
 *    PRO_ANNUAL   → 3€/año, 7 días trial desde local, cloud sync
 *
 *  Todo funciona con localStorage. Arquitectura lista para reemplazar
 *  con Stripe/Paddle/Supabase en producción.
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

// Safe _bt() wrapper — billing.js may load before _bt() is defined
function _bt(key) { return (typeof window.t === 'function') ? window.t(key) : key; }

// ─── Storage keys ────────────────────────────────────────────────
const BK = {
  SUB:     'mn_billing_sub',
  HISTORY: 'mn_billing_history',
  SYNC:    'mn_billing_sync',
};

// ─── Plan definitions ────────────────────────────────────────────
const BILLING_PLANS = Object.freeze({
  FREE_TRIAL: {
    id:          'free_trial',
    name:        'Free Trial',
    price:       0,
    period:      null,
    trialDays:   1,
    features:    ['full_access_24h', 'all_screens', 'local_data', 'export_pdf'],
    cloudSync:   false,
    lifetime:    false,
    color:       '#6366F1',
    colorDark:   '#4F46E5',
    icon:        '⏳',
    bgGradient:  'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 50%)',
  },
  LOCAL_LIFETIME: {
    id:          'local_lifetime',
    name:        'Local Lifetime',
    price:       6.99,
    period:      'once',
    trialDays:   0,
    features:    ['unlimited_data', 'all_screens', 'local_data', 'export_pdf', 'export_excel', 'offline_first', 'no_expiry'],
    cloudSync:   false,
    lifetime:    true,
    color:       '#00D4AA',
    colorDark:   '#00A882',
    icon:        '💾',
    bgGradient:  'radial-gradient(ellipse at 10% 80%, rgba(0,212,170,0.12) 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, rgba(20,184,166,0.08) 0%, transparent 50%)',
  },
  PRO_ANNUAL: {
    id:          'pro_annual',
    name:        'Pro',
    price:       14.99,
    period:      'year',
    trialDays:   7,
    features:    ['unlimited_data', 'all_screens', 'local_data', 'export_pdf', 'export_excel', 'offline_first', 'cloud_sync', 'multi_device', 'priority_support', 'ai_insights'],
    cloudSync:   true,
    lifetime:    false,
    color:       '#A78BFA',
    colorDark:   '#7C3AED',
    icon:        '⚡',
    bgGradient:  'radial-gradient(ellipse at 30% 30%, rgba(167,139,250,0.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(99,102,241,0.15) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(0,212,170,0.08) 0%, transparent 40%)',
  },
});

// ─── Subscription states ──────────────────────────────────────────
const SUB_STATES = Object.freeze({
  ACTIVE_TRIAL:      'active_trial',
  TRIAL_ENDING:      'trial_ending',
  EXPIRED_TRIAL:     'expired_trial',
  LOCAL_ACTIVE:      'local_active',
  PRO_TRIALING:      'pro_trialing',
  PRO_ACTIVE:        'pro_active',
  PRO_CANCELLED:     'pro_cancelled',
  SYNCING:           'syncing',
  OFFLINE_MODE:      'offline_mode',
});

// ─── Default subscription ─────────────────────────────────────────
function _defaultSub() {
  const now = Date.now();
  return {
    plan:           'free_trial',
    state:          SUB_STATES.ACTIVE_TRIAL,
    startedAt:      now,
    expiresAt:      now + 24 * 60 * 60 * 1000,
    nextBillingAt:  null,
    cancelledAt:    null,
    proTrialUsed:   false,
    proTrialEndsAt: null,
    cloudEnabled:   false,
    syncStatus:     'disabled',   // disabled | syncing | synced | error
    lastSyncAt:     null,
    deviceCount:    1,
    invoices:       [],
    createdAt:      now,
    updatedAt:      now,
  };
}

// ════════════════════════════════════════════════════════════════
//  CRUD
// ════════════════════════════════════════════════════════════════

function getSub() {
  try {
    const raw = localStorage.getItem(BK.SUB);
    if (!raw) return null;
    return { ..._defaultSub(), ...JSON.parse(raw) };
  } catch { return null; }
}

function saveSub(sub) {
  try {
    sub.updatedAt = Date.now();
    localStorage.setItem(BK.SUB, JSON.stringify(sub));
    // Dispatch state change event
    document.dispatchEvent(new CustomEvent('mn:billing:change', { detail: { sub } }));
  } catch (e) { console.warn('[Billing] Save failed:', e); }
  return sub;
}

function patchSub(patch) {
  const current = getSub() || _defaultSub();
  return saveSub({ ...current, ...patch });
}

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════

function initBilling() {
  let sub = getSub();
  if (!sub) {
    sub = saveSub(_defaultSub());
  }
  // Sync with MNAuth state if it exists
  _syncWithMNAuth();
  _startTrialCountdown();
  return sub;
}

function _syncWithMNAuth() {
  if (!window.MNAuth) return;
  const authUser = window.MNAuth.getUser ? window.MNAuth.getUser() : null;
  if (!authUser) return;

  const sub = getSub() || _defaultSub();

  // Map MNAuth plan to billing plan
  const planMap = {
    trial:        'free_trial',
    locked_local: 'free_trial',  // expired trial — _computeState will mark it expired_trial
    local:        'local_lifetime',
    pro:          'pro_annual',
  };

  const mappedPlan = planMap[authUser.plan] || 'free_trial';
  const planChanged = mappedPlan !== sub.plan;
  const isAuthLocked = authUser.plan === 'locked_local';

  if (planChanged || isAuthLocked) {
    sub.plan = mappedPlan;
    if (authUser.trialEndsAt) sub.expiresAt = authUser.trialEndsAt;
    // If auth says locked, force expiresAt to past so _computeState returns expired_trial
    if (isAuthLocked) sub.expiresAt = Date.now() - 1;
    sub.state = _computeState(sub);
    saveSub(sub);
  }
}

function _computeState(sub) {
  const now = Date.now();
  if (sub.plan === 'free_trial') {
    if (now > sub.expiresAt) return SUB_STATES.EXPIRED_TRIAL;
    if (sub.expiresAt - now < 4 * 60 * 60 * 1000) return SUB_STATES.TRIAL_ENDING;
    return SUB_STATES.ACTIVE_TRIAL;
  }
  if (sub.plan === 'local_lifetime') return SUB_STATES.LOCAL_ACTIVE;
  if (sub.plan === 'pro_annual') {
    if (sub.cancelledAt) return SUB_STATES.PRO_CANCELLED;
    if (sub.proTrialEndsAt && now < sub.proTrialEndsAt) return SUB_STATES.PRO_TRIALING;
    return SUB_STATES.PRO_ACTIVE;
  }
  return SUB_STATES.EXPIRED_TRIAL;
}

// ════════════════════════════════════════════════════════════════
//  TRIAL ENGINE
// ════════════════════════════════════════════════════════════════

let _trialInterval = null;

function _startTrialCountdown() {
  if (_trialInterval) clearInterval(_trialInterval);
  _trialInterval = setInterval(() => {
    const sub = getSub();
    if (!sub) return;
    if (sub.plan !== 'free_trial') { clearInterval(_trialInterval); return; }
    const state = _computeState(sub);
    if (state !== sub.state) {
      sub.state = state;
      saveSub(sub);
      if (state === SUB_STATES.EXPIRED_TRIAL) {
        clearInterval(_trialInterval);
        document.dispatchEvent(new CustomEvent('mn:billing:trialExpired'));
      }
      if (state === SUB_STATES.TRIAL_ENDING) {
        document.dispatchEvent(new CustomEvent('mn:billing:trialEnding'));
      }
    }
  }, 30000); // check every 30s
}

function getTrialTimeLeft() {
  const sub = getSub();
  if (!sub || sub.plan !== 'free_trial') return { ms: 0, hours: 0, minutes: 0, label: '' };
  const ms = Math.max(0, sub.expiresAt - Date.now());
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { ms, hours, minutes, label, expired: ms === 0 };
}

// ════════════════════════════════════════════════════════════════
//  MOCK PURCHASE FLOWS
// ════════════════════════════════════════════════════════════════

/**
 * Simula compra del plan Local Lifetime (5€ pago único)
 * En producción: redirigir a Stripe checkout → webhook → activateLocal()
 */
async function mockBuyLocal(opts = {}) {
  const { email = null, onProgress } = opts;
  const steps = [
    { msg: _bt('billing_step_conectando'),  delay: 600 },
    { msg: _bt('billing_step_verificando'), delay: 900 },
    { msg: _bt('billing_step_procesando'),  delay: 1200 },
    { msg: _bt('billing_step_activando'),   delay: 600 },
    { msg: _bt('billing_step_listo'),       delay: 300 },
  ];
  for (const step of steps) {
    if (onProgress) onProgress(step.msg);
    await _delay(step.delay);
  }
  return activateLocal(email);
}

/**
 * Simula activación Pro Annual (7 días trial gratis)
 * En producción: Stripe subscription → trial_end webhook → activatePro()
 */
async function mockActivatePro(opts = {}) {
  const { email = null, onProgress } = opts;
  const steps = [
    { msg: _bt('billing_step_iniciando_pro'),    delay: 500 },
    { msg: _bt('billing_step_config_cloud'),     delay: 800 },
    { msg: _bt('billing_step_activando_sync'),   delay: 700 },
    { msg: _bt('billing_step_trial_pro'),        delay: 500 },
    { msg: _bt('billing_step_bienvenido_pro'),   delay: 300 },
  ];
  for (const step of steps) {
    if (onProgress) onProgress(step.msg);
    await _delay(step.delay);
  }
  return activatePro(email);
}

/**
 * Simula cancelación de Pro → downgrade a Local
 */
async function mockCancelPro(opts = {}) {
  const { onProgress } = opts;
  const steps = [
    { msg: _bt('billing_step_cancelando'),         delay: 700 },
    { msg: _bt('billing_step_desactivando_sync'),  delay: 600 },
    { msg: _bt('billing_step_manteniendo_datos'),  delay: 400 },
  ];
  for (const step of steps) {
    if (onProgress) onProgress(step.msg);
    await _delay(step.delay);
  }
  return cancelPro();
}

/**
 * Simula sincronización cloud
 */
async function mockSyncCloud(opts = {}) {
  const { onProgress } = opts;
  const sub = getSub();
  if (!sub || sub.plan !== 'pro_annual') return { ok: false, reason: 'not_pro' };

  patchSub({ syncStatus: 'syncing' });
  document.dispatchEvent(new CustomEvent('mn:billing:syncStart'));

  if (onProgress) onProgress(_bt('billing_step_sincronizando'));
  await _delay(800);
  if (onProgress) onProgress(_bt('billing_step_subiendo'));
  await _delay(600);
  if (onProgress) onProgress(_bt('billing_step_verificando_integ'));
  await _delay(400);

  const result = patchSub({ syncStatus: 'synced', lastSyncAt: Date.now() });
  document.dispatchEvent(new CustomEvent('mn:billing:syncEnd', { detail: { ok: true } }));
  return { ok: true, sub: result };
}

// ════════════════════════════════════════════════════════════════
//  PLAN ACTIVATION (directo, sin mock delay)
// ════════════════════════════════════════════════════════════════

function activateLocal(email = null) {
  const now = Date.now();
  const sub = patchSub({
    plan:          'local_lifetime',
    state:         SUB_STATES.LOCAL_ACTIVE,
    expiresAt:     null,
    cloudEnabled:  false,
    syncStatus:    'disabled',
    cancelledAt:   null,
    updatedAt:     now,
  });
  _addInvoice({ plan: 'local_lifetime', amount: 6.99, currency: 'EUR', status: 'paid', email });
  // Sync with MNAuth
  if (window.MNAuth?.buyLocal) window.MNAuth.buyLocal(email);
  document.dispatchEvent(new CustomEvent('mn:billing:activated', { detail: { plan: 'local_lifetime', sub } }));
  return sub;
}

function activatePro(email = null) {
  const now = Date.now();
  const sub = getSub() || _defaultSub();
  const proTrialEndsAt = sub.proTrialUsed ? null : now + 7 * 24 * 60 * 60 * 1000;
  const nextBillingAt  = proTrialEndsAt || (now + 365 * 24 * 60 * 60 * 1000);
  const result = patchSub({
    plan:           'pro_annual',
    state:          proTrialEndsAt ? SUB_STATES.PRO_TRIALING : SUB_STATES.PRO_ACTIVE,
    proTrialEndsAt,
    proTrialUsed:   true,
    nextBillingAt,
    cloudEnabled:   true,
    syncStatus:     'synced',
    lastSyncAt:     now,
    cancelledAt:    null,
    expiresAt:      null,
  });
  // Sync with MNAuth
  if (window.MNAuth?.activatePro) window.MNAuth.activatePro(email);
  document.dispatchEvent(new CustomEvent('mn:billing:activated', { detail: { plan: 'pro_annual', sub: result } }));
  return result;
}

function cancelPro() {
  const result = patchSub({
    plan:         'local_lifetime',
    state:        SUB_STATES.PRO_CANCELLED,
    cancelledAt:  Date.now(),
    cloudEnabled: false,
    syncStatus:   'disabled',
    nextBillingAt:null,
  });
  if (window.MNAuth?.cancelPro) window.MNAuth.cancelPro();
  document.dispatchEvent(new CustomEvent('mn:billing:cancelled', { detail: { sub: result } }));
  // After animation, set state to local
  setTimeout(() => patchSub({ state: SUB_STATES.LOCAL_ACTIVE, cancelledAt: null }), 3000);
  return result;
}

// ════════════════════════════════════════════════════════════════
//  ENTITLEMENTS
// ════════════════════════════════════════════════════════════════

function canUseFeature(feature) {
  const sub = getSub();
  if (!sub) return false;
  const plan = BILLING_PLANS[sub.plan?.toUpperCase().replace('-', '_')] ||
               Object.values(BILLING_PLANS).find(p => p.id === sub.plan);
  if (!plan) return false;
  const state = _computeState(sub);
  if (state === SUB_STATES.EXPIRED_TRIAL) return false;
  return plan.features.includes(feature);
}

function getCurrentPlanDef() {
  const sub = getSub() || _defaultSub();
  return Object.values(BILLING_PLANS).find(p => p.id === sub.plan) || BILLING_PLANS.FREE_TRIAL;
}

function getSubStatus() {
  const sub = getSub() || _defaultSub();
  const state = _computeState(sub);
  const planDef = getCurrentPlanDef();
  const trialLeft = getTrialTimeLeft();
  const isExpired = state === SUB_STATES.EXPIRED_TRIAL;
  const isActive = !isExpired;

  let statusLabel = '';
  let statusColor = planDef.color;
  switch (state) {
    case SUB_STATES.ACTIVE_TRIAL:   statusLabel = _bt('billing_status_trial_activo');      statusColor = '#6366F1'; break;
    case SUB_STATES.TRIAL_ENDING:   statusLabel = _bt('billing_status_trial_finalizando'); statusColor = '#F59E0B'; break;
    case SUB_STATES.EXPIRED_TRIAL:  statusLabel = _bt('billing_status_trial_expirado');    statusColor = '#F43F5E'; break;
    case SUB_STATES.LOCAL_ACTIVE:   statusLabel = _bt('billing_status_local');             statusColor = '#00D4AA'; break;
    case SUB_STATES.PRO_TRIALING:   statusLabel = _bt('billing_status_pro_trial');         statusColor = '#A78BFA'; break;
    case SUB_STATES.PRO_ACTIVE:     statusLabel = _bt('billing_status_pro_activo');        statusColor = '#A78BFA'; break;
    case SUB_STATES.PRO_CANCELLED:  statusLabel = _bt('billing_status_pro_cancelado');     statusColor = '#F43F5E'; break;
    case SUB_STATES.SYNCING:        statusLabel = _bt('billing_status_sincronizando');     statusColor = '#38BDF8'; break;
  }

  return { sub, state, planDef, trialLeft, isExpired, isActive, statusLabel, statusColor };
}

// ════════════════════════════════════════════════════════════════
//  INVOICE HISTORY
// ════════════════════════════════════════════════════════════════

function _addInvoice(opts = {}) {
  const sub = getSub() || _defaultSub();
  const invoice = {
    id:        'INV-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
    date:      Date.now(),
    plan:      opts.plan || sub.plan,
    amount:    opts.amount || 0,
    currency:  opts.currency || 'EUR',
    status:    opts.status || 'paid',
    email:     opts.email || sub.email,
  };
  sub.invoices = [invoice, ...(sub.invoices || [])].slice(0, 20);
  saveSub(sub);
  return invoice;
}

function getInvoices() {
  const sub = getSub();
  return sub?.invoices || [];
}

// ════════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════════

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatNextBilling(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ════════════════════════════════════════════════════════════════
//  EXPORTS (window global + ES module compatible)
// ════════════════════════════════════════════════════════════════

const MNBilling = {
  PLANS:         BILLING_PLANS,
  STATES:        SUB_STATES,
  init:          initBilling,
  getSub,
  saveSub,
  patchSub,
  getSubStatus,
  getTrialTimeLeft,
  canUseFeature,
  getCurrentPlanDef,
  getInvoices,
  // Mock flows
  mockBuyLocal,
  mockActivatePro,
  mockCancelPro,
  mockSyncCloud,
  // Direct activation
  activateLocal,
  activatePro,
  cancelPro,
  // Helpers
  formatNextBilling,
  formatDate,
};

window.MNBilling = MNBilling;
