/**
 * ════════════════════════════════════════════════════════════════
 *  MoneyNest — js/auth-ui.js
 *  UI layer for the plan/subscription system (FREE_TRIAL / LOCAL / PRO)
 *
 *  Connects to the existing MNAuth (js/auth.js, low-level access
 *  control + 24h trial) and MNBilling (js/billing.js, mock
 *  subscription engine with plan definitions/pricing/entitlements)
 *  modules — reused as-is, nothing duplicated here.
 *
 *  IMPORTANT: this is a LOCAL MOCK flow only. No Stripe/Supabase API
 *  call is made anywhere in this file. "Buying" a plan simply updates
 *  MNBilling/MNAuth local state (already wired to sync with each
 *  other) after an explicit confirmation step — ready to be swapped
 *  for real Stripe Checkout later without rewriting this UI.
 * ════════════════════════════════════════════════════════════════
 */
'use strict';

function _aut(key, fallback) {
  if (typeof window.t === 'function') { const v = window.t(key); return (v && v !== key) ? v : (fallback ?? key); }
  return fallback ?? key;
}

// ────────────────────────────────────────────────────────────────
//  INIT
// ────────────────────────────────────────────────────────────────
function initAuthUI() {
  // Re-render the badge/pill whenever the underlying billing/auth
  // state changes anywhere in the app (e.g. after confirming a plan).
  document.addEventListener('mn:billing:change', () => {
    renderAuthBadge('authPlanBadge');
    renderTrialPill('trialPillContainer');
  });
  document.addEventListener('mn:billing:activated', () => {
    renderAuthBadge('authPlanBadge');
    renderTrialPill('trialPillContainer');
  });
  // Keep the trial pill's remaining time fresh without a full re-render loop.
  setInterval(() => renderTrialPill('trialPillContainer'), 60000);
}

// ────────────────────────────────────────────────────────────────
//  PLAN BADGE (topbar) — small pill showing the current plan
// ────────────────────────────────────────────────────────────────
function renderAuthBadge(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!window.MNBilling) { el.innerHTML = ''; return; }
  const { state } = MNBilling.getSubStatus();
  const S = MNBilling.STATES;
  const map = {
    [S.ACTIVE_TRIAL]:  { label: _aut('plan_badge_trial','Prueba'),      cls: 'auth-badge--trial' },
    [S.TRIAL_ENDING]:  { label: _aut('plan_badge_trial','Prueba'),      cls: 'auth-badge--trial' },
    [S.EXPIRED_TRIAL]: { label: _aut('plan_badge_expired','Sin plan'),  cls: 'auth-badge--expired' },
    [S.LOCAL_ACTIVE]:  { label: _aut('plan_badge_local','Local'),       cls: 'auth-badge--local' },
    [S.PRO_TRIALING]:  { label: _aut('plan_badge_pro','Pro'),           cls: 'auth-badge--pro' },
    [S.PRO_ACTIVE]:    { label: _aut('plan_badge_pro','Pro'),           cls: 'auth-badge--pro' },
    [S.PRO_CANCELLED]: { label: _aut('plan_badge_local','Local'),       cls: 'auth-badge--local' },
  };
  const info = map[state] || map[S.ACTIVE_TRIAL];
  el.innerHTML = `<span class="auth-plan-badge ${info.cls}">${info.label}</span>`;
}

// ────────────────────────────────────────────────────────────────
//  TRIAL PILL (sidebar) — "Prueba gratuita · 23h restantes"
// ────────────────────────────────────────────────────────────────
function renderTrialPill(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!window.MNBilling) { el.innerHTML = ''; return; }
  const { state } = MNBilling.getSubStatus();
  const S = MNBilling.STATES;
  if (state !== S.ACTIVE_TRIAL && state !== S.TRIAL_ENDING) { el.innerHTML = ''; return; }

  const tl = MNBilling.getTrialTimeLeft();
  const endingToday = tl.hours < 24; // always true within the 24h trial, kept explicit for clarity
  const label = tl.hours > 0
    ? _aut('trial_pill_hours','Prueba gratuita · {h}h restantes').replace('{h}', tl.hours)
    : _aut('trial_pill_minutes','Prueba gratuita · {m}min restantes').replace('{m}', tl.minutes);
  const urgent = tl.ms > 0 && tl.ms < 4 * 60 * 60 * 1000;

  el.innerHTML = `
    <div class="trial-pill ${urgent ? 'trial-pill--urgent' : ''}" onclick="MNAuthUI.openPlanModal('trial_pill')" title="${_aut('trial_pill_cta','Elegir plan')}">
      <span class="trial-pill-dot"></span>
      <span class="trial-pill-text">${urgent ? _aut('trial_pill_today','Tu prueba termina hoy') : label}</span>
    </div>`;
}

// ────────────────────────────────────────────────────────────────
//  SHARED PLAN SELECTION MODAL — Local vs Pro, side by side
// ────────────────────────────────────────────────────────────────
// `context` is only used for logging/analytics-style awareness of
// where the modal was opened from (trial expiration, settings,
// upgrade buttons, cloud gates, etc.) — the modal itself is identical
// every time, exactly as the task requires ("one shared modal").
function openPlanModal(context) {
  document.getElementById('planModalOverlay')?.remove();
  const b = window.MNBilling;
  const local = b ? b.PLANS.LOCAL_LIFETIME : { price: 6.99 };
  const pro   = b ? b.PLANS.PRO_ANNUAL     : { price: 14.99 };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'planModalOverlay';
  overlay.innerHTML = `
    <div class="modal plan-modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">${_aut('plan_modal_title','Elige tu plan de MoneyNest')}</span>
        <button class="modal-close" onclick="MNAuthUI.closePlanModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="plan-modal-sub">${_aut('plan_modal_sub','Sigue usando MoneyNest con el plan que mejor se adapte a ti.')}</div>
        <div class="plan-modal-grid">
          <div class="plan-mini-card plan-mini-card--local">
            <div class="plan-mini-card__name">${_aut('plan_local_name','MoneyNest Local')}</div>
            <div class="plan-mini-card__price">${eur(local.price)}<span>/${_aut('plan_periodo_ano','año')}</span></div>
            <div class="plan-mini-card__desc">${_aut('plan_local_desc','MoneyNest completo, directamente en tu dispositivo.')}</div>
            <ul class="plan-mini-card__list">
              <li class="yes">${_aut('plan_feat_todas_funciones','Todas las funciones')}</li>
              <li class="yes">${_aut('plan_feat_importacion','Importación')}</li>
              <li class="yes">${_aut('plan_feat_exportacion','Exportación')}</li>
              <li class="yes">${_aut('plan_feat_datos_locales','Datos locales')}</li>
              <li class="no">${_aut('plan_feat_cloud','Cloud')}</li>
              <li class="no">${_aut('plan_feat_sync','Sincronización')}</li>
            </ul>
            <button class="btn btn-secondary btn-block" onclick="MNAuthUI.confirmPlan('local')">${_aut('plan_btn_continuar_local','Continuar con Local')}</button>
          </div>
          <div class="plan-mini-card plan-mini-card--pro">
            <div class="plan-mini-card__ribbon">☁️ ${_aut('plan_pro_ribbon','Cloud')}</div>
            <div class="plan-mini-card__name">${_aut('plan_pro_name','MoneyNest Pro')}</div>
            <div class="plan-mini-card__price">${eur(pro.price)}<span>/${_aut('plan_periodo_ano','año')}</span></div>
            <div class="plan-mini-card__desc">${_aut('plan_pro_desc','Todo MoneyNest + sincronización y nube.')}</div>
            <ul class="plan-mini-card__list">
              <li class="yes">${_aut('plan_feat_todo_local','Todo lo de Local')}</li>
              <li class="yes">${_aut('plan_feat_cloud','Cloud')}</li>
              <li class="yes">${_aut('plan_feat_sync','Sincronización')}</li>
              <li class="yes">${_aut('plan_feat_backup','Backup automático')}</li>
              <li class="yes">${_aut('plan_feat_restauracion','Restauración')}</li>
              <li class="yes">${_aut('plan_feat_multidispositivo','Varios dispositivos')}</li>
            </ul>
            <button class="btn btn-primary btn-block plan-mini-card__pro-btn" onclick="MNAuthUI.confirmPlan('pro')">${_aut('plan_btn_elegir_pro','Elegir Pro')}</button>
          </div>
        </div>
      </div>
    </div>`
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePlanModal(); });
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock();
  setTimeout(() => overlay.classList.add('open'), 10);
  overlay.dataset.context = context || '';
}

function closePlanModal() {
  const overlay = document.getElementById('planModalOverlay');
  if (!overlay) return;
  overlay.remove();
  if (typeof window._popScrollLock === 'function') window._popScrollLock();
}

// ────────────────────────────────────────────────────────────────
//  MOCK CONFIRMATION STEP — "this simulates activation, no real
//  payment happens", per the task's explicit requirement.
// ────────────────────────────────────────────────────────────────
function confirmPlan(planKey) {
  const b = window.MNBilling;
  if (!b) return;
  const isPro = planKey === 'pro';
  const planDef = isPro ? b.PLANS.PRO_ANNUAL : b.PLANS.LOCAL_LIFETIME;
  const color = isPro ? '#EC4899' : '#00D4AA'; // agreed pink treatment for Pro

  const modal = document.getElementById('planModalOverlay');
  if (!modal) return;
  const body = modal.querySelector('.modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="plan-confirm-step">
      <div class="plan-confirm-step__icon" style="color:${color}">${isPro ? '☁️' : '💾'}</div>
      <div class="plan-confirm-step__name">${isPro ? _aut('plan_pro_name','MoneyNest Pro') : _aut('plan_local_name','MoneyNest Local')}</div>
      <div class="plan-confirm-step__price" style="color:${color}">${eur(planDef.price)}<span>/${_aut('plan_periodo_ano','año')}</span></div>
      <div class="plan-confirm-step__notice">${_aut('plan_confirm_mock_notice','Este paso simula la activación del plan mientras conectamos el sistema de pagos.')}</div>
      <div class="plan-confirm-step__actions">
        <button class="btn btn-ghost btn-sm" onclick="MNAuthUI.openPlanModal()">${_aut('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" style="${isPro ? `background:${color};color:#fff` : ''}" onclick="MNAuthUI._doConfirmPlan('${planKey}')">${_aut('plan_btn_confirmar','Confirmar')}</button>
      </div>
    </div>`;
}

function _doConfirmPlan(planKey) {
  const b = window.MNBilling;
  if (!b) return;
  const email = (window.MNAuth?.getUser?.().email) || null;
  // Close the modal FIRST — activatePro/activateLocal below dispatch
  // 'mn:billing:activated' synchronously, which the lock screen listens
  // for to reload the page. If the modal still had the .open class at
  // that point, the app's existing beforeunload guard (protects open
  // modals from accidental navigation) would show a native browser
  // confirmation dialog.
  closePlanModal();
  // Reuses MNBilling's already-existing direct activation (no mock
  // delay/animation needed here — this IS the explicit confirmation
  // step the task asks for) — it already syncs with MNAuth and never
  // touches or deletes any financial data.
  if (planKey === 'pro') b.activatePro(email);
  else b.activateLocal(email);

  renderAuthBadge('authPlanBadge');
  renderTrialPill('trialPillContainer');
  if (typeof window.render === 'function' && (window.currentPage === 'configuracion')) window.render();
  if (typeof window.toast === 'function') {
    window.toast(planKey === 'pro' ? _aut('toast_plan_pro_activo','✓ Plan Pro activado') : _aut('toast_plan_local_activo','✓ Plan Local activado'));
  }
}

// ────────────────────────────────────────────────────────────────
//  CLOUD FEATURE GATE — call before any cloud-only action
// ────────────────────────────────────────────────────────────────
// Returns true if the action may proceed. If the current plan can't
// use cloud sync, shows the SAME shared plan modal instead of
// crashing or silently failing.
function requireCloud(context) {
  const b = window.MNBilling;
  if (!b) return true; // fail-open if billing module isn't available — never block core app usage
  if (b.canUseFeature('cloud_sync')) return true;
  openPlanModal(context || 'cloud_gate');
  return false;
}

// ────────────────────────────────────────────────────────────────
//  EXPORT
// ────────────────────────────────────────────────────────────────
window.MNAuthUI = {
  initAuthUI,
  renderAuthBadge,
  renderTrialPill,
  openPlanModal,
  closePlanModal,
  confirmPlan,
  _doConfirmPlan,
  requireCloud,
};
