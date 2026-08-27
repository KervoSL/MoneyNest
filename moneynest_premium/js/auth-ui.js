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
// Preserve the original initAuthUI from components/auth-ui.js (loaded
// first) — it registers the mn:buyLocal/mn:restoreAccess/mn:activatePro
// listeners that open the real login/account modal (showAuthModal).
// Without this, the object-merge below would silently lose them.
const _originalInitAuthUI = window.MNAuthUI?.initAuthUI;

function initAuthUI() {
  if (typeof _originalInitAuthUI === 'function') _originalInitAuthUI();

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
  // Trial/expired states show nothing here — the trial is only ever
  // surfaced inside Plan y facturación, never in the header.
  const map = {
    [S.LOCAL_ACTIVE]:  { label: _aut('plan_badge_local','Local'),       cls: 'auth-badge--local' },
    [S.PRO_TRIALING]:  { label: _aut('plan_badge_pro','Pro'),           cls: 'auth-badge--pro' },
    [S.PRO_ACTIVE]:    { label: _aut('plan_badge_pro','Pro'),           cls: 'auth-badge--pro' },
    [S.PRO_CANCELLED]: { label: _aut('plan_badge_local','Local'),       cls: 'auth-badge--local' },
  };
  const info = map[state];
  el.innerHTML = info ? `<span class="auth-plan-badge ${info.cls}">${info.label}</span>` : '';
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
            <div class="plan-mini-card__price">${eur(local.price)}<span class="plan-mini-card__period">/${_aut('plan_periodo_ano','año')}</span></div>
            <div class="plan-mini-card__desc">${_aut('plan_local_desc','MoneyNest completo, directamente en tu dispositivo.')}</div>
            <ul class="plan-mini-card__list">
              <li class="yes">${_aut('plan_feat_todas_funciones','Todas las funciones')}</li>
              <li class="yes">${_aut('plan_feat_importacion','Importación')}</li>
              <li class="yes">${_aut('plan_feat_exportacion','Exportación')}</li>
              <li class="yes">${_aut('plan_feat_datos_locales','Datos locales')}</li>
              <li class="no">${_aut('plan_feat_cloud','Cloud')}</li>
              <li class="no">${_aut('plan_feat_sync','Sincronización')}</li>
            </ul>
            <button class="btn btn-secondary btn-block" onclick="MNAuthUI._doConfirmPlan('local')">${_aut('plan_btn_comprar_local','Comprar Local')} — ${eur(local.price)}</button>
          </div>
          <div class="plan-mini-card plan-mini-card--pro">
            <div class="plan-mini-card__ribbon">☁️ ${_aut('plan_pro_ribbon','Cloud')}</div>
            <div class="plan-mini-card__name">${_aut('plan_pro_name','MoneyNest Pro')}</div>
            <div class="plan-mini-card__price">${eur(pro.price)}<span class="plan-mini-card__period">/${_aut('plan_periodo_ano','año')}</span></div>
            <div class="plan-mini-card__desc">${_aut('plan_pro_desc','Todo MoneyNest + sincronización y nube.')}</div>
            <ul class="plan-mini-card__list">
              <li class="yes">${_aut('plan_feat_todo_local','Todo lo de Local')}</li>
              <li class="yes">${_aut('plan_feat_cloud','Cloud')}</li>
              <li class="yes">${_aut('plan_feat_sync','Sincronización')}</li>
              <li class="yes">${_aut('plan_feat_backup','Backup automático')}</li>
              <li class="yes">${_aut('plan_feat_restauracion','Restauración')}</li>
              <li class="yes">${_aut('plan_feat_multidispositivo','Varios dispositivos')}</li>
            </ul>
            <button class="btn btn-primary btn-block plan-mini-card__pro-btn" onclick="MNAuthUI._doConfirmPlan('pro')">${_aut('plan_btn_elegir_pro','Elegir Pro')}</button>
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
      <div class="plan-confirm-step__notice">${_aut('plan_confirm_real_notice','Al confirmar irás a la pasarela de pago segura de Stripe. Tu plan se activará en cuanto el pago se confirme.')}</div>
      <div class="plan-confirm-step__actions">
        <button class="btn btn-ghost btn-sm" onclick="MNAuthUI.openPlanModal()">${_aut('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" style="${isPro ? `background:${color};color:#fff` : ''}" onclick="MNAuthUI._doConfirmPlan('${planKey}')">${_aut('plan_btn_confirmar','Confirmar')}</button>
      </div>
    </div>`;
}

async function _doConfirmPlan(planKey) {
  window.MNAnalytics?.track('plan_selected', { plan: planKey })
  // CRITICAL RULE (never violated): pressing this button must NEVER
  // grant Local/Pro by itself. It only ever opens the real embedded
  // payment modal (MNPayment / stripe-payment.js) — the plan is
  // granted exclusively by stripe-webhook after Stripe confirms the
  // payment, never from this client code.

  // Wait for MNSupabaseAuth to finish restoring any existing session
  // before deciding whether to show the "create account" prompt.
  // isLoggedIn() alone is only reliable AFTER init() has completed —
  // reading it too early (e.g. right after the page loads, before the
  // saved session has finished restoring) could incorrectly say "not
  // logged in" even though the account was created moments earlier in
  // this same browser. This never blocks noticeably in practice: by
  // the time someone reaches this button, init() has almost always
  // already resolved.
  if (window.MNSupabaseAuth?.ready) {
    try { await window.MNSupabaseAuth.ready() } catch (_) { /* handled by the check below */ }
  }

  // A real purchase requires a real, authenticated identity (Stripe
  // Customer must be tied to a verified user) — an anonymous/local-only
  // trial session isn't enough. Ask them to sign in/create an account
  // first, then resume this exact checkout right after.
  if (!window.MNSupabaseAuth || !window.MNSupabaseAuth.isLoggedIn()) {
    window._mnPendingCheckoutPlan = planKey;
    closePlanModal();
    if (window.MNAuthUI?.showAuthModal) window.MNAuthUI.showAuthModal('register');
    if (typeof window.toast === 'function') {
      window.toast(_aut('plan_necesita_cuenta', 'Crea una cuenta o inicia sesión para continuar con la compra.'), 'info');
    }
    return;
  }

  const priceId = planKey === 'pro' ? window.MNStripeConfig?.prices?.pro : window.MNStripeConfig?.prices?.local;
  const email = window.MNSupabaseAuth.getSession()?.user?.email || window.MNAuth?.getUser?.()?.email || '';
  if (!priceId || !window.MNPayment) {
    console.error('[MNAuthUI] No se pudo abrir el pago: MNPayment o priceId no disponibles', { priceId, hasMNPayment: !!window.MNPayment });
    if (typeof window.toast === 'function') window.toast(_aut('plan_checkout_error', 'No se pudo iniciar el pago. Inténtalo de nuevo.'), 'error');
    return;
  }
  closePlanModal();
  window.MNAnalytics?.track('payment_modal_opened', { plan: planKey })
  MNPayment.open(priceId, email);
}

// If the user was sent to sign in/register mid-purchase (see above),
// resume the exact checkout they were trying to complete right after a
// real session is established.
if (window.MNSupabaseAuth) {
  window.MNSupabaseAuth.onAuthChange((event, session) => {
    if (event === 'SIGNED_IN' && session && window._mnPendingCheckoutPlan) {
      const plan = window._mnPendingCheckoutPlan;
      window._mnPendingCheckoutPlan = null;
      if (window.MNAuthUI?.closeAuthModal) window.MNAuthUI.closeAuthModal();
      _doConfirmPlan(plan);
    }
  });
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
window.MNAuthUI = Object.assign(window.MNAuthUI || {}, {
  initAuthUI,
  renderAuthBadge,
  renderTrialPill,
  openPlanModal,
  closePlanModal,
  confirmPlan,
  _doConfirmPlan,
  requireCloud,
});
