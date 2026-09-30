/**
 * ════════════════════════════════════════════════════════════════
 *  MoneyNest — js/billing-ui.js  v3.0  [i18n]
 *  Dynamic Billing Center UI — 3 Scenarios + Hard Paywall
 *
 *  Escenario A: Free Trial (100 movimientos)
 *  Escenario B: Local Lifetime — upsell a Pro
 *  Escenario C: Pro Active — dashboard de suscripción limpio
 *  Paywall:     Trial expirado → bloqueo total, embudo Local-First
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

// ────────────────────────────────────────────────────────────────
//  GLOBAL STATE BUS
//  Reactivo: cualquier cambio en MNBilling dispara _onStateChange()
//  que re-renderiza INMEDIATAMENTE sin reload.
// ────────────────────────────────────────────────────────────────

let _lastScenario = null;   // para evitar re-renders innecesarios
let _uiBillingPeriod = 'annual';

function _toggleBillingPeriod(p) {
  _uiBillingPeriod = p;
  const isAnnual = p === 'annual';
  document.querySelectorAll('[data-price-monthly]').forEach(el => {
    el.textContent = isAnnual ? el.dataset.priceYearly : el.dataset.priceMonthly;
  });
  document.querySelectorAll('[data-period-monthly]').forEach(el => {
    el.textContent = isAnnual ? el.dataset.periodYearly : el.dataset.periodMonthly;
  });
  document.querySelectorAll('[data-equiv-yearly]').forEach(el => {
    el.textContent = isAnnual ? el.dataset.equivYearly : '';
    el.style.display = isAnnual ? '' : 'none';
  });
  document.querySelectorAll('.mn-billing-toggle-btn').forEach(btn => {
    const isActive = btn.dataset.period === p;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? 'var(--accent,#00D4AA)' : 'transparent';
    btn.style.color = isActive ? '#0A0E17' : 'rgba(255,255,255,.5)';
  });
  document.querySelectorAll('.mn-billing-savings-note').forEach(el => {
    el.style.display = isAnnual ? '' : 'none';
  });
}
window._toggleBillingPeriod = _toggleBillingPeriod;

function _b() { return window.MNBilling; }

/**
 * Derive the current scenario from MNBilling state.
 * Returns: 'TRIAL' | 'LOCAL' | 'PRO' | 'EXPIRED'
 */
function _getScenario() {
  const b = _b();
  if (!b) return 'TRIAL';
  const { sub, state } = b.getSubStatus();

  const has_local = sub.plan === 'local_lifetime';
  const is_pro    = sub.plan === 'pro_annual' &&
                    (state === 'pro_active' || state === 'pro_trialing');

  const authUser       = window.MNAuth?.getUser?.() || {};
  const is_expired     = state === 'expired_trial' ||
                         (authUser.plan === 'locked_local' && !has_local && !is_pro);

  if (is_expired) return 'EXPIRED';
  if (is_pro)     return 'PRO';
  if (has_local)  return 'LOCAL';
  return 'TRIAL';
}

/**
 * Central handler — called on every billing state change.
 * Manages paywall + billing page reactively.
 */
function _onStateChange() {
  const scenario = _getScenario();

  // 1. Export button gating (global)
  _applyExportGating(scenario);

  // 3. Dynamic background — only applied when inside the billing view
  if (_isBillingPageActive()) {
    initDynamicBg();
  }

  // 4. Global UI badges
  _refreshBadges();

  // 5. If billing page is visible — re-render it reactively
  if (_isBillingPageActive()) {
    renderBillingPage();
  }

  _lastScenario = scenario;
}

function _isBillingPageActive() {
  // Support both: app.js local `currentPage` and window.currentPage alias
  const cp = (typeof currentPage !== 'undefined' ? currentPage : null) ||
             window.currentPage;
  return cp === 'billing';
}

// ────────────────────────────────────────────────────────────────
//  PAYWALL MANAGER — Hard block, no read-only
// ────────────────────────────────────────────────────────────────

// NOTA: el bloqueo de acceso por trial expirado vive únicamente en
// bloquearApp() (app.js), conectado al flujo real de auth/checkAccess.
// Este archivo antes tenía un SEGUNDO sistema de bloqueo independiente
// (_activateLock/_deactivateLock, con su propio overlay y CTA) que se
// disparaba en paralelo vía _onStateChange() — dos pantallas de
// bloqueo superpuestas con diseños distintos. Eliminado por completo.

// Alias para el link "Restaurar acceso" — abre el modal compartido de
// planes, que a su vez ofrece el flujo real de restauración.
function _restoreAccess() {
  if (window.MNAuthUI?.openPlanModal) { window.MNAuthUI.openPlanModal('restore_link'); return; }
  startBuyLocal();
}

// ════════════════════════════════════════════════════════════════
//  BILLING PAGE — RENDER DISPATCHER
// ════════════════════════════════════════════════════════════════

function renderBillingPage() {
  const content = document.getElementById('content');
  if (!content) return;

  const scenario = _getScenario();
  const isAnnual = _uiBillingPeriod === 'annual';
  const isPro    = scenario === 'PRO';
  const isLocal  = scenario === 'LOCAL';
  const isExpired = scenario === 'EXPIRED';
  const isTrial  = scenario === 'TRIAL';
  const pink     = '#EC4899';

  // ── Movement counter (recalculated on every render) ──
  const trialUsed = (typeof _countTrialMovements === 'function')
    ? _countTrialMovements()
    : ((window.S?.ingresos?.length || 0) + (window.S?.gastos?.length || 0));
  const LIMIT = window.TRIAL_MOVEMENT_LIMIT || 100;
  const trialRemaining = Math.max(0, LIMIT - trialUsed);
  const trialPct = Math.min(100, (trialUsed / LIMIT) * 100);

  // ── Banner ──
  let bannerHtml = '';
  if (isTrial) {
    bannerHtml = `
    <div class="mn-plan-trialbanner">
      <div style="flex:1">
        <div style="font-size:.95rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px">🕐 Prueba activa · Te quedan <strong style="color:var(--accent,#00D4AA)">${trialRemaining}</strong> movimientos de ${LIMIT}</div>
        <div style="margin-top:10px;height:6px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden">
          <div style="height:100%;width:${trialPct}%;border-radius:99px;background:var(--accent,#00D4AA);transition:width .3s"></div>
        </div>
        <div style="font-size:.72rem;color:var(--text3,rgba(255,255,255,.45));margin-top:4px">${trialUsed} / ${LIMIT} usados</div>
      </div>
    </div>`;
  } else if (isExpired) {
    bannerHtml = `
    <div class="mn-plan-trialbanner" style="background:linear-gradient(135deg,rgba(244,63,94,.25),rgba(244,63,94,.08))">
      <div>
        <div style="font-size:.95rem;font-weight:800;color:#fff">⚠️ Prueba finalizada · Elige un plan para continuar</div>
        <div style="font-size:.82rem;color:rgba(255,255,255,.75);margin-top:6px">Has usado tus ${LIMIT} movimientos. Tus datos siguen intactos — elige un plan para seguir.</div>
      </div>
    </div>`;
  } else if (isLocal) {
    bannerHtml = `
    <div class="mn-plan-trialbanner" style="background:linear-gradient(135deg,rgba(0,212,170,.15),rgba(0,212,170,.04))">
      <div style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:.95rem;font-weight:800;color:#fff">🟢 Plan Local activo</div>
        <button class="btn btn-ghost btn-sm" onclick="document.querySelector('.mn-plan-card--pro .mn-plan-btn-pro')?.click()" style="white-space:nowrap">Cambiar a Pro →</button>
      </div>
    </div>`;
  } else if (isPro) {
    bannerHtml = `
    <div class="mn-plan-trialbanner" style="background:linear-gradient(135deg,rgba(236,72,153,.15),rgba(236,72,153,.04))">
      <div style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:.95rem;font-weight:800;color:#fff">🔵 Plan Pro activo · Cloud Sync habilitado</div>
        <button class="btn btn-ghost btn-sm" onclick="_openStripeCustomerPortal(this)" style="white-space:nowrap">Gestionar suscripción</button>
      </div>
    </div>`;
  }

  // ── Toggle (pill — switches prices via data attributes, no full re-render) ──
  const toggleHtml = `
    <div class="mn-billing-toggle" style="display:inline-flex;background:rgba(255,255,255,.05);border-radius:99px;padding:3px;gap:2px;margin-bottom:24px">
      <button class="mn-billing-toggle-btn${!isAnnual?' active':''}" data-period="monthly" onclick="_toggleBillingPeriod('monthly')" style="padding:8px 20px;border-radius:99px;border:none;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;${!isAnnual?'background:var(--accent,#00D4AA);color:#0A0E17':'background:transparent;color:rgba(255,255,255,.5)'}">Mensual</button>
      <button class="mn-billing-toggle-btn${isAnnual?' active':''}" data-period="annual" onclick="_toggleBillingPeriod('annual')" style="padding:8px 20px;border-radius:99px;border:none;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;${isAnnual?'background:var(--accent,#00D4AA);color:#0A0E17':'background:transparent;color:rgba(255,255,255,.5)'}">Anual · Ahorra hasta 4 €</button>
    </div>`;

  // ── Initial price text (based on current toggle state) ──
  const localPriceInit  = isAnnual ? '9,99 €' : '1 €';
  const localPeriodInit = isAnnual ? '/año' : '/mes';
  const proPriceInit    = isAnnual ? '19,99 €' : '2 €';
  const proPeriodInit   = isAnnual ? '/año' : '/mes';

  // ── Local card ──
  const cardLocal = `
    <div class="mn-plan-card${isLocal ? ' mn-plan-card--current mn-plan-card--accent' : ''}">
      ${isLocal ? '<div class="mn-plan-card__ribbon" style="background:var(--accent-dim,rgba(0,212,170,.12));color:var(--accent,#00D4AA)">✓ PLAN ACTUAL</div>' : ''}
      <div class="mn-plan-card__icon">💾</div>
      <div class="mn-plan-card__name">MoneyNest Local</div>
      <div style="font-size:.78rem;color:var(--text3,rgba(255,255,255,.45));margin-bottom:8px">Tus finanzas. En tu dispositivo.</div>
      <div class="mn-plan-card__price"><span data-price-monthly="1 €" data-price-yearly="9,99 €">${localPriceInit}</span><span data-period-monthly="/mes" data-period-yearly="/año">${localPeriodInit}</span></div>
      <div data-equiv-yearly="equivale a 0,83 €/mes" style="font-size:.72rem;color:var(--text3,rgba(255,255,255,.45));margin-top:-2px${isAnnual?'':';display:none'}">${isAnnual ? 'equivale a 0,83 €/mes' : ''}</div>
      <ul class="mn-plan-card__feats">
        <li class="ok">Todas las herramientas financieras</li>
        <li class="ok">Ingresos, gastos, inversiones, deudas</li>
        <li class="ok">Importación bancaria</li>
        <li class="ok">Datos 100% locales y privados</li>
        <li class="no">Cloud Sync</li>
        <li class="no">Sincronización entre dispositivos</li>
      </ul>
      ${isLocal
        ? '<button class="btn btn-secondary btn-sm" style="width:100%" disabled>✓ Plan actual</button>'
        : `<button class="mn-plan-btn-local" style="width:100%;padding:12px 0;border-radius:12px;font-size:.85rem;font-weight:700;cursor:pointer;border:2px solid var(--accent,#00D4AA);background:transparent;color:var(--accent,#00D4AA);font-family:inherit;transition:all .15s" onclick="MNAuthUI._doConfirmPlan(_uiBillingPeriod==='annual'?'local_yearly':'local_monthly')">Elegir Local</button>`}
    </div>`;

  // ── Pro card ──
  const cardPro = `
    <div class="mn-plan-card mn-plan-card--pro${isPro ? ' mn-plan-card--current' : ''}">
      <div class="mn-plan-card__ribbon${isPro ? '' : ' mn-plan-card__ribbon--pro'}" style="${isPro ? `background:${pink}22;color:${pink}` : ''}">${isPro ? '✓ PLAN ACTUAL' : '⭐ MÁS ELEGIDO'}</div>
      <div class="mn-plan-card__icon">☁️</div>
      <div class="mn-plan-card__name">MoneyNest Pro</div>
      <div style="font-size:.78rem;color:var(--text3,rgba(255,255,255,.45));margin-bottom:8px">Tus finanzas. En todas partes.</div>
      <div class="mn-plan-card__price" style="color:${pink}"><span data-price-monthly="2 €" data-price-yearly="19,99 €">${proPriceInit}</span><span data-period-monthly="/mes" data-period-yearly="/año">${proPeriodInit}</span></div>
      <div data-equiv-yearly="equivale a 1,67 €/mes" style="font-size:.72rem;color:var(--text3,rgba(255,255,255,.45));margin-top:-2px${isAnnual?'':';display:none'}">${isAnnual ? 'equivale a 1,67 €/mes' : ''}</div>
      <ul class="mn-plan-card__feats">
        <li class="ok">Todo lo de Local</li>
        <li class="ok">Cloud Sync automático</li>
        <li class="ok">Sincronización entre dispositivos</li>
        <li class="ok">Backup en la nube</li>
        <li class="ok">Futuras funciones Pro</li>
      </ul>
      ${isPro
        ? '<button class="btn btn-secondary btn-sm" style="width:100%" disabled>✓ Plan actual</button>'
        : `<button class="mn-plan-btn-pro" style="width:100%;padding:12px 0;border-radius:12px;font-size:.85rem;font-weight:700;cursor:pointer;border:none;background:var(--accent,#00D4AA);color:#0A0E17;font-family:inherit;transition:all .15s" onclick="MNAuthUI._doConfirmPlan(_uiBillingPeriod==='annual'?'pro_yearly':'pro_monthly')">Elegir Pro</button>`}
    </div>`;

  // ── Subscription status (paid plans only) ──
  const subStatusHtml = (isPro || isLocal) ? `
    <div class="card">
      <div id="mn-sub-status-info" style="font-size:.8rem;color:var(--text3,rgba(255,255,255,.45))"></div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" onclick="_openStripeCustomerPortal(this)">Gestionar suscripción</button>
    </div>` : '';

  // ── Restore + history ──
  const actionsHtml = `
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">🔑 Más opciones</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;justify-content:flex-start" onclick="_openRestoreAccessModal(window.MNAuth?.getUser?.() ?? null)">🔓 Restaurar acceso</button>
      </div>
    </div>
    <div style="font-size:.72rem;font-weight:700;color:var(--text2,#94A3B8);text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px">Historial de pagos</div>
    <div class="card" style="text-align:center;padding:20px;color:var(--text3,rgba(255,255,255,.45));font-size:.8rem">El historial de pagos aparecerá aquí.</div>`;

  // ── Status badge ──
  const statusBadge = isPro
    ? `<span class="mn-plan-statusbadge" style="color:${pink};border-color:${pink}66;background:${pink}22">PRO ACTIVO</span>`
    : isLocal
    ? '<span class="mn-plan-statusbadge" style="color:var(--accent,#00D4AA);border-color:rgba(0,212,170,.4);background:rgba(0,212,170,.12)">LOCAL ACTIVO</span>'
    : isExpired
    ? '<span class="mn-plan-statusbadge" style="color:var(--red,#F43F5E);border-color:rgba(244,63,94,.4);background:rgba(244,63,94,.12)">PRUEBA FINALIZADA</span>'
    : '<span class="mn-plan-statusbadge" style="color:var(--gold,#F59E0B);border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.12)">TRIAL ACTIVO</span>';

  content.innerHTML = `
  <div style="max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
    <div class="section-header">
      <div>
        <div class="page-h1">💳 Plan y facturación</div>
        <div class="page-sub">Gestiona tu suscripción y acceso a MoneyNest</div>
      </div>
      ${statusBadge}
    </div>
    ${bannerHtml}
    <div>
      <div style="font-size:.72rem;font-weight:700;color:var(--text2,#94A3B8);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Elige tu plan</div>
      <div style="font-size:.82rem;color:var(--text3,rgba(255,255,255,.45));margin-bottom:14px">Sin permanencia. Cambia cuando quieras.</div>
      ${toggleHtml}
      <div class="mn-plan-grid" style="grid-template-columns:repeat(2,1fr)">
        ${cardLocal}
        ${cardPro}
      </div>
      <div class="mn-billing-savings-note" style="font-size:.72rem;color:var(--text3,rgba(255,255,255,.45));margin-top:8px;text-align:center${isAnnual?'':';display:none'}">Local anual: equivale a 0,83 €/mes · Pro anual: equivale a 1,67 €/mes</div>
    </div>
    ${subStatusHtml}
    ${actionsHtml}
  </div>`;

  if (document.getElementById('mn-sub-status-info') && typeof _loadRealSubscriptionStatus === 'function') {
    _loadRealSubscriptionStatus();
  }
}

// ════════════════════════════════════════════════════════════════
//  ESCENARIO A — Free Trial
// ════════════════════════════════════════════════════════════════

function _renderTrial(content) {
  const b = _b();
  const { sub } = b.getSubStatus();
  const trialUsed = sub?.proTrialUsed;
  const tl = b.getTrialTimeLeft();

  const pct      = 1;
  const r = 28, circ = 2 * Math.PI * r;
  const offset   = '0.00';
  const isEnding = false;
  const isAnnual = _uiBillingPeriod === 'annual';
  const _lp = b.PLANS.LOCAL_LIFETIME;
  const _pp = b.PLANS.PRO_ANNUAL;
  const localDisplayPrice = isAnnual ? _lp.price : _lp.priceMonthly;
  const proDisplayPrice   = isAnnual ? _pp.price : _pp.priceMonthly;
  const periodSuffix      = isAnnual ? '/año' : '/mes';

  const trialBannerSub = t('billing_trial_banner_sub').replace('{time}', `<strong id="trialCountdownTime">${tl.label || '0m'}</strong>`);

  content.innerHTML = `
  <div class="billing-page">
    <div class="section-header">
      <div>
        <div class="page-h1">${t('billing_page_title')}</div>
        <div class="page-sub">${t('billing_page_sub')}</div>
      </div>
      <span class="plan-status-badge badge--trial">
        <span class="badge-dot"></span> ${t('billing_status_trial_activo')}
      </span>
    </div>

    <!-- Trial banner -->
    <div class="mn-trial-banner ${isEnding ? 'mn-trial-banner--ending' : ''}">
      <div class="mn-trial-banner__text">
        <div class="mn-trial-banner__headline">
          ${isEnding ? t('billing_trial_banner_ending') : t('billing_trial_banner_active')}
        </div>
        <div class="mn-trial-banner__sub">
          ${trialBannerSub}
        </div>
      </div>
      <div class="mn-trial-banner__ring">
        <svg width="64" height="64" viewBox="0 0 64 64" style="transform:rotate(-90deg)">
          <circle cx="32" cy="32" r="${r}" fill="none"
            stroke="rgba(255,255,255,0.10)" stroke-width="4"/>
          <circle cx="32" cy="32" r="${r}" fill="none"
            stroke="${isEnding ? '#FBBF24' : '#A78BFA'}" stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}"
            stroke-dashoffset="${offset}"/>
        </svg>
      </div>
    </div>

    <!-- Plan grid -->
    <div class="billing-section" style="padding:28px">
      <div class="billing-section-title">${t('billing_plans_section_title')}</div>
      <div class="mn-section-sub">${t('billing_plans_section_sub')}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:20px;background:rgba(255,255,255,.05);border-radius:12px;padding:4px;max-width:420px">
        <button onclick="_toggleBillingPeriod('monthly')" style="flex:1;padding:10px 16px;border-radius:10px;font-size:.82rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;transition:all .15s;${!isAnnual?'background:#00D4AA;color:#0A0E17':'background:transparent;color:rgba(255,255,255,.5)'}">Mensual</button>
        <button onclick="_toggleBillingPeriod('annual')" style="flex:1;padding:10px 16px;border-radius:10px;font-size:.82rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;transition:all .15s;${isAnnual?'background:#00D4AA;color:#0A0E17':'background:transparent;color:rgba(255,255,255,.5)'}">Anual — ahorra 2 meses</button>
      </div>
      <div class="mn-trial-grid">

        <!-- Free Trial (dim, actual) -->
        <div class="mn-plan-card mn-plan-card--trial mn-plan-card--current-dim">
          <div class="mn-plan-card__badge">${t('billing_badge_plan_actual')}</div>
          <div class="mn-plan-card__icon">⏳</div>
          <div class="mn-plan-card__name">${t('billing_plan_free_name')}</div>
          <div class="mn-plan-card__price-block">
            <span class="mn-price-flat">${t('billing_plan_free_price')}</span>
          </div>
          <div class="mn-plan-card__period">${t('billing_plan_free_period')}</div>
          <ul class="mn-plan-card__features">
            <li>${t('billing_plan_feat_pantallas')}</li>
            <li>${t('billing_plan_feat_datos_locales')}</li>
            <li>${t('billing_plan_feat_pdf')}</li>
            <li class="mn-feat--locked">${t('billing_plan_feat_no_excel')}</li>
            <li class="mn-feat--locked">${t('billing_plan_feat_no_cloud')}</li>
          </ul>
          <div class="mn-plan-card__cta mn-plan-card__cta--current">${t('billing_plan_cta_actual')}</div>
        </div>

        <!-- Local Lifetime (HERO — objetivo conversión) -->
        <div class="mn-plan-card mn-plan-card--local mn-plan-card--hero">
          <div class="mn-plan-card__popular-tag">${t('billing_plan_popular')}</div>
          <div class="mn-plan-card__glow"></div>
          <div class="mn-plan-card__icon">💾</div>
          <div class="mn-plan-card__name">${t('billing_plan_local_name')}</div>
          <div class="mn-plan-card__price-block">
            <span class="mn-price-currency mn-price-currency--local">€</span>
            <span class="mn-price-amount mn-price-amount--local">${localDisplayPrice}</span>
            <span style="font-size:.85rem;font-weight:600;color:rgba(255,255,255,.5)">${periodSuffix}</span>
          </div>
          ${isAnnual ? `<div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-top:2px">equivale a ${(_lp.price/12).toFixed(2).replace('.',',')} €/mes</div>` : ''}
          <div class="mn-plan-card__period">${isAnnual ? '10 €/año · ahorra 2 meses' : t('billing_plan_local_period')}</div>
          <ul class="mn-plan-card__features">
            <li>${t('billing_plan_feat_ilimitados')}</li>
            <li>${t('billing_plan_feat_excel')}</li>
            <li>${t('billing_plan_feat_offline')}</li>
            <li>${t('billing_plan_feat_no_expiry')}</li>
            <li>${t('billing_plan_feat_privado')}</li>
          </ul>
          <button class="mn-plan-card__cta mn-plan-card__cta--local"
            onclick="MNBillingUI.startBuyLocal()">
            ${t('billing_plan_cta_local')}
          </button>
          <div class="mn-plan-card__guarantee">${t('billing_plan_guarantee')}</div>
        </div>

        <!-- Pro Annual -->
        <div class="mn-plan-card mn-plan-card--pro">
          <div class="mn-plan-card__icon">⚡</div>
          <div class="mn-plan-card__name">${t('billing_plan_pro_name')}</div>
          <div class="mn-plan-card__price-block">
            <span class="mn-price-currency" style="color:#A78BFA">€</span>
            <span class="mn-price-amount" style="color:#A78BFA">${proDisplayPrice}</span>
            <span style="font-size:.85rem;font-weight:600;color:rgba(255,255,255,.5)">${periodSuffix}</span>
          </div>
          ${isAnnual ? `<div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-top:2px">equivale a ${(_pp.price/12).toFixed(2).replace('.',',')} €/mes</div>` : ''}
          <div class="mn-plan-card__period" style="color:rgba(255,255,255,0.4);font-size:.72rem">${t('billing_plan_pro_trial_included')}</div>
          <ul class="mn-plan-card__features">
            <li>${t('billing_plan_feat_cloud')}</li>
            <li>${t('billing_plan_feat_multi')}</li>
            <li>${t('billing_plan_feat_backup')}</li>
            <li>${t('billing_plan_feat_ai')}</li>
            <li>${t('billing_plan_feat_support')}</li>
          </ul>
          <button class="mn-plan-card__cta mn-plan-card__cta--pro"
            onclick="MNBillingUI.startActivatePro()">
            ${trialUsed ? t('billing_cta_activar_pro') : t('billing_cta_iniciar_trial')}
          </button>
        </div>

      </div>
    </div>

    ${_sectionInvoices()}
  </div>`;

  _startCountdownTimer();
}

// ════════════════════════════════════════════════════════════════
//  ESCENARIO B — Local Lifetime: comparativa + upsell Pro
// ════════════════════════════════════════════════════════════════

function _renderLocal(content) {
  const b = _b();
  const { sub } = b.getSubStatus();
  const trialUsed = sub?.proTrialUsed;

  content.innerHTML = `
  <div class="billing-page">
    <div class="section-header">
      <div>
        <div class="page-h1">${t('billing_page_title')}</div>
        <div class="page-sub">${t('billing_page_sub')}</div>
      </div>
      <span class="plan-status-badge badge--local">
        <span class="badge-dot"></span> ${t('billing_status_local')}
      </span>
    </div>

    <!-- COMPARATIVA DUAL -->
    <div class="billing-section" style="padding:28px">
      <div class="billing-section-title">${t('billing_local_vs_title')}</div>
      <div class="mn-dual-compare">

        <!-- Izquierda: Local (actual) -->
        <div class="mn-dual-card mn-dual-card--local">
          <div class="mn-dual-card__header">
            <div class="mn-dual-card__icon">💾</div>
            <div>
              <div class="mn-dual-card__name">${t('billing_plan_local_name')}</div>
              <div class="mn-dual-card__tagline">${t('billing_local_tagline')}</div>
            </div>
          </div>
          <div class="mn-dual-card__current-tag">
            <span>✓</span> ${t('billing_local_current_tag')}
          </div>
          <ul class="mn-dual-card__features">
            <li class="mn-feat--ok">${t('billing_plan_feat_ilimitados')}</li>
            <li class="mn-feat--ok">${t('billing_plan_feat_pdf')}</li>
            <li class="mn-feat--ok">${t('billing_plan_feat_excel')}</li>
            <li class="mn-feat--ok">${t('billing_plan_feat_offline')}</li>
            <li class="mn-feat--ok">${t('billing_plan_feat_no_expiry')}</li>
            <li class="mn-feat--ok">${t('billing_plan_feat_privado')}</li>
            <li class="mn-feat--no">${t('billing_local_feat_no_cloud')}</li>
            <li class="mn-feat--no">${t('billing_local_feat_no_multi')}</li>
            <li class="mn-feat--no">${t('billing_local_feat_no_backup')}</li>
          </ul>
          <div class="mn-dual-card__price-row">
            <span class="mn-dual-price mn-dual-price--paid">${t('billing_local_paid')}</span>
          </div>
        </div>

        <!-- Separador -->
        <div class="mn-dual-arrow">
          <div class="mn-dual-arrow__line"></div>
          <div class="mn-dual-arrow__label">${t('billing_local_upgrade_label')}</div>
          <div class="mn-dual-arrow__icon">→</div>
        </div>

        <!-- Derecha: Pro (upsell) -->
        <div class="mn-dual-card mn-dual-card--pro">
          <div class="mn-dual-card__glow"></div>
          <div class="mn-dual-card__pro-badge">⚡ ${t('billing_plan_pro_name')}</div>
          <div class="mn-dual-card__header">
            <div class="mn-dual-card__icon mn-dual-card__icon--pro">⚡</div>
            <div>
              <div class="mn-dual-card__name">${t('billing_pro_annual_name')}</div>
              <div class="mn-dual-card__tagline">${t('billing_pro_annual_tagline')}</div>
            </div>
          </div>
          <div class="mn-dual-card__upgrade-highlights">
            <div class="mn-upgrade-item">
              <span class="mn-upgrade-item__icon">☁️</span>
              <div>
                <div class="mn-upgrade-item__title">${t('billing_upgrade_cloud_title')}</div>
                <div class="mn-upgrade-item__desc">${t('billing_upgrade_cloud_desc')}</div>
              </div>
            </div>
            <div class="mn-upgrade-item">
              <span class="mn-upgrade-item__icon">📦</span>
              <div>
                <div class="mn-upgrade-item__title">${t('billing_upgrade_backup_title')}</div>
                <div class="mn-upgrade-item__desc">${t('billing_upgrade_backup_desc')}</div>
              </div>
            </div>
            <div class="mn-upgrade-item">
              <span class="mn-upgrade-item__icon">🖥️</span>
              <div>
                <div class="mn-upgrade-item__title">${t('billing_upgrade_multi_title')}</div>
                <div class="mn-upgrade-item__desc">${t('billing_upgrade_multi_desc')}</div>
              </div>
            </div>
            <div class="mn-upgrade-item">
              <span class="mn-upgrade-item__icon">✨</span>
              <div>
                <div class="mn-upgrade-item__title">${t('billing_upgrade_ai_title')}</div>
                <div class="mn-upgrade-item__desc">${t('billing_upgrade_ai_desc')}</div>
              </div>
            </div>
          </div>
          <div class="mn-dual-card__price-row">
            <span class="mn-dual-price mn-dual-price--pro">${_b().PLANS.PRO_ANNUAL.price} €/año</span>
            ${!trialUsed ? `<span class="mn-dual-trial-tag">${t('billing_trial_tag')}</span>` : ''}
          </div>
          <button class="mn-dual-card__cta" onclick="MNBillingUI.startActivatePro()">
            ${trialUsed ? t('billing_cta_activar_pro') : t('billing_cta_try_pro')}
          </button>
        </div>

      </div>
    </div>

    <!-- Gestión cuenta local -->
    <div class="billing-section">
      <div class="billing-section-title">${t('billing_local_account_title')}</div>
      <div class="billing-row">
        <span class="billing-row-label">📦 ${t('billing_sub_stat_plan_label')}</span>
        <span class="billing-row-value">${t('billing_local_plan_row')}</span>
      </div>
      <div class="billing-row">
        <span class="billing-row-label">✅ ${t('billing_local_expiry_label')}</span>
        <span class="billing-row-value positive">${t('billing_local_expiry')}</span>
      </div>
      <div class="billing-row">
        <span class="billing-row-label">📦 ${t('billing_local_backup_label')}</span>
        <span class="billing-row-value">
          <button onclick="if(typeof exportarJSON==='function')exportarJSON()"
            style="font-size:.72rem;padding:4px 10px;border-radius:7px;border:1px solid rgba(0,212,170,0.3);background:rgba(0,212,170,0.08);color:#00D4AA;cursor:pointer;font-family:inherit;font-weight:700">
            ${t('billing_local_export_json')}
          </button>
        </span>
      </div>
    </div>

    ${_sectionInvoices()}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  ESCENARIO C — Pro Active: dashboard premium limpio
// ════════════════════════════════════════════════════════════════

function _renderPro(content) {
  const b = _b();
  const { sub, state } = b.getSubStatus();
  const isTrialing = state === 'pro_trialing';

  const trialDaysLeft = sub.proTrialEndsAt
    ? Math.ceil(Math.max(0, sub.proTrialEndsAt - Date.now()) / 86400000)
    : 0;
  const trialPct = isTrialing
    ? Math.max(5, ((7 - trialDaysLeft) / 7) * 100).toFixed(1)
    : 100;

  const nextBilling = sub.nextBillingAt ? b.formatNextBilling(sub.nextBillingAt) : '—';
  const lastSync    = sub.lastSyncAt    ? b.formatDate(sub.lastSyncAt)           : t('billing_sync_today');
  const renewDate   = sub.nextBillingAt ? b.formatNextBilling(sub.nextBillingAt) : '—';

  const deviceCount = sub.deviceCount || 1;
  const deviceLabel = deviceCount !== 1
    ? t('billing_benefit_multi_desc_plural').replace('{n}', deviceCount)
    : t('billing_benefit_multi_desc_single').replace('{n}', deviceCount);

  const trialDaysLabel = trialDaysLeft !== 1
    ? t('billing_pro_days_remaining_plural').replace('{n}', trialDaysLeft)
    : t('billing_pro_days_remaining_single').replace('{n}', trialDaysLeft);

  const proHeroSub = isTrialing
    ? t('billing_pro_hero_trialing').replace('{days}', `<strong>${trialDaysLabel}</strong>`)
    : t('billing_pro_hero_active');

  content.innerHTML = `
  <div class="billing-page">
    <div class="section-header">
      <div>
        <div class="page-h1">${t('billing_page_title')}</div>
        <div class="page-sub">${t('billing_page_sub')}</div>
      </div>
      <span class="plan-status-badge badge--pro">
        <span class="badge-dot"></span> ${isTrialing ? t('billing_badge_pro_trial') : t('billing_badge_pro_active')}
      </span>
    </div>

    <!-- PRO HERO -->
    <div class="mn-pro-hero">
      <div class="mn-pro-hero__glow"></div>
      <div class="mn-pro-hero__content">
        <div class="mn-pro-hero__icon">☁️</div>
        <div class="mn-pro-hero__title">${t('billing_pro_hero_title')}</div>
        <div class="mn-pro-hero__sub">${proHeroSub}</div>

        ${isTrialing ? `
        <div class="mn-pro-trial-bar">
          <div class="mn-pro-trial-bar__label">
            <span>${t('billing_pro_trial_bar_start')}</span>
            <span>${trialDaysLabel}</span>
            <span>${t('billing_pro_trial_bar_end')}</span>
          </div>
          <div class="mn-pro-trial-bar__track">
            <div class="mn-pro-trial-bar__fill" style="width:${trialPct}%"></div>
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- SUBSCRIPTION DASHBOARD -->
    <div class="billing-section" style="padding:28px">
      <div class="billing-section-title">${t('billing_sub_dash_title')}</div>

      <div class="mn-sub-dashboard">
        <div class="mn-sub-stat">
          <div class="mn-sub-stat__icon">✅</div>
          <div class="mn-sub-stat__label">${t('billing_sub_stat_estado')}</div>
          <div class="mn-sub-stat__value mn-sub-stat__value--pro">
            ${isTrialing ? t('billing_sub_stat_trialing') : t('billing_sub_stat_activo')}
          </div>
        </div>
        <div class="mn-sub-stat">
          <div class="mn-sub-stat__icon">📅</div>
          <div class="mn-sub-stat__label">${t('billing_sub_stat_cobro')}</div>
          <div class="mn-sub-stat__value">${renewDate}</div>
        </div>
        <div class="mn-sub-stat">
          <div class="mn-sub-stat__icon">💶</div>
          <div class="mn-sub-stat__label">${t('billing_sub_stat_importe')}</div>
          <div class="mn-sub-stat__value">${_b().PLANS.PRO_ANNUAL.price} €/año</div>
        </div>
        <div class="mn-sub-stat">
          <div class="mn-sub-stat__icon">☁️</div>
          <div class="mn-sub-stat__label">${t('billing_sub_stat_sync')}</div>
          <div class="mn-sub-stat__value">${lastSync}</div>
        </div>
      </div>

      <!-- CTA principal de gestión -->
      <div class="mn-sub-manage-cta">
        <button class="mn-sub-manage-btn"
          onclick="MNBillingUI.openStripePortal()">
          ${t('billing_sub_manage_btn')}
        </button>
        <button class="mn-sub-invoices-btn"
          onclick="MNBillingUI.openStripePortal()">
          ${t('billing_sub_invoices_btn')}
        </button>
      </div>
    </div>

    <!-- VENTAJAS ACTIVAS -->
    <div class="billing-section" style="padding:28px">
      <div class="billing-section-title">${t('billing_pro_benefits_title')}</div>
      <div class="mn-pro-benefits">
        <div class="mn-pro-benefit">
          <div class="mn-pro-benefit__icon">☁️</div>
          <div>
            <div class="mn-pro-benefit__title">${t('billing_benefit_cloud_title')}</div>
            <div class="mn-pro-benefit__desc">${t('billing_benefit_cloud_desc_prefix')} ${lastSync}</div>
          </div>
          <button onclick="MNBillingUI.triggerSync()" class="mn-pro-benefit__action">${t('billing_benefit_cloud_btn')}</button>
        </div>
        <div class="mn-pro-benefit">
          <div class="mn-pro-benefit__icon">🖥️</div>
          <div>
            <div class="mn-pro-benefit__title">${t('billing_benefit_multi_title')}</div>
            <div class="mn-pro-benefit__desc">${deviceLabel}</div>
          </div>
        </div>
        <div class="mn-pro-benefit">
          <div class="mn-pro-benefit__icon">📦</div>
          <div>
            <div class="mn-pro-benefit__title">${t('billing_upgrade_backup_title')}</div>
            <div class="mn-pro-benefit__desc">${t('billing_benefit_backup_desc')}</div>
          </div>
          <span class="mn-pro-benefit__status-ok">${t('billing_benefit_status_active')}</span>
        </div>
        <div class="mn-pro-benefit">
          <div class="mn-pro-benefit__icon">🔐</div>
          <div>
            <div class="mn-pro-benefit__title">${t('billing_benefit_encrypt_title')}</div>
            <div class="mn-pro-benefit__desc">${t('billing_benefit_encrypt_desc')}</div>
          </div>
          <span class="mn-pro-benefit__status-ok">${t('billing_benefit_status_enabled')}</span>
        </div>
        <div class="mn-pro-benefit">
          <div class="mn-pro-benefit__icon">✨</div>
          <div>
            <div class="mn-pro-benefit__title">${t('billing_upgrade_ai_title')}</div>
            <div class="mn-pro-benefit__desc">${t('billing_upgrade_ai_desc')}</div>
          </div>
          <span class="mn-pro-benefit__status-ok">${t('billing_benefit_status_active')}</span>
        </div>
      </div>
    </div>

    <!-- Cancelar Pro -->
    <div class="billing-section">
      <div class="billing-section-title">${t('billing_advanced_title')}</div>
      <div id="cancelProArea">
        <button onclick="MNBillingUI.showCancelConfirm()"
          style="width:100%;padding:11px;border-radius:10px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);color:#FB7185">
          ${t('billing_cancel_pro_btn')}
        </button>
      </div>
    </div>

    ${_sectionInvoices()}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  ESCENARIO EXPIRED — vista fantasma (el overlay cubre todo)
// ════════════════════════════════════════════════════════════════

function _renderExpired(content) {
  // We just show the dashboard shell behind the overlay — it's blurred anyway
  content.innerHTML = `
  <div class="billing-page" style="pointer-events:none;user-select:none">
    <div class="section-header">
      <div>
        <div class="page-h1">${t('billing_page_title')}</div>
        <div class="page-sub">${t('billing_expired_sub')}</div>
      </div>
    </div>
    <div style="height:300px;display:flex;align-items:center;justify-content:center;opacity:.3;font-size:.9rem;color:var(--text2)">
      ${t('billing_expired_no_content')}
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  SHARED SECTION BUILDERS
// ════════════════════════════════════════════════════════════════

function _sectionInvoices() {
  const b = _b();
  const invoices = b.getInvoices();
  return `
  <div class="billing-section">
    <div class="billing-section-title">${t('billing_invoices_title')}</div>
    ${invoices.length === 0
      ? `<div style="padding:20px;text-align:center;color:var(--text2);font-size:.82rem">
           ${t('billing_invoices_empty')}
         </div>`
      : invoices.map(inv => `
        <div class="invoice-row">
          <span class="invoice-plan-tag">${inv.plan === 'local_lifetime' ? t('billing_invoice_tag_local') : t('billing_invoice_tag_pro')}</span>
          <span class="invoice-date">${b.formatDate(inv.date)}</span>
          <span class="invoice-amount">€${inv.amount.toFixed(2)}</span>
          <span class="invoice-status">${inv.status === 'paid' ? t('billing_invoice_paid') : inv.status}</span>
        </div>`).join('')}
  </div>`;
}



// ════════════════════════════════════════════════════════════════
//  COUNTDOWN TIMER
// ════════════════════════════════════════════════════════════════

let _cdTimer = null;

function _startCountdownTimer() {
  if (_cdTimer) clearInterval(_cdTimer);
  _cdTimer = setInterval(() => {
    const el = document.getElementById('trialCountdownTime');
    if (!el) { clearInterval(_cdTimer); return; }
    const tl = _b().getTrialTimeLeft();
    if (tl.ms <= 0) {
      clearInterval(_cdTimer);
      // Trigger state change which will handle everything
      _onStateChange();
      return;
    }
    el.textContent = tl.label;
    el.classList.add('counter-animate');
    setTimeout(() => el.classList.remove('counter-animate'), 300);
  }, 60000);
}

// ════════════════════════════════════════════════════════════════
//  EXPORT BUTTON GATING
// ════════════════════════════════════════════════════════════════

function _applyExportGating(scenario) {
  // MNEntitlements (Fase 4) is the real source of truth; only fall
  // back to the local scenario/mock check if it hasn't loaded.
  const isLocked = window.MNEntitlements
    ? !window.MNEntitlements.hasExportAccess()
    : (scenario || _getScenario()) === 'EXPIRED';

  document.querySelectorAll(
    '[onclick*="exportarGastos"], [onclick*="exportarPDF"], [onclick*="exportarIngresos"]'
  ).forEach(btn => {
    if (isLocked && !btn.dataset.locked) {
      btn.dataset.originalOnclick = btn.getAttribute('onclick');
      btn.setAttribute('onclick', 'MNBillingUI._exportBlocked()');
      btn.dataset.locked = '1';
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = t('billing_export_tooltip');
    } else if (!isLocked && btn.dataset.locked) {
      btn.setAttribute('onclick', btn.dataset.originalOnclick || '');
      delete btn.dataset.locked;
      delete btn.dataset.originalOnclick;
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.title = '';
    }
  });
}

function _exportBlocked() {
  if (typeof window.toast === 'function') {
    toast(t('billing_export_blocked_toast'), 'warning');
  }
  if (window.MNAuthUI) MNAuthUI.openPlanModal('export_gate');
}

// ════════════════════════════════════════════════════════════════
//  CHECKOUT FLOWS
// ════════════════════════════════════════════════════════════════

function _showCheckoutModal(color, onStart) {
  document.getElementById('billingCheckoutModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'billingCheckoutModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99500;display:flex;align-items:center;
    justify-content:center;padding:24px;
    background:rgba(10,14,23,0.85);
    backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
    animation:lockOverlayIn 0.3s ease forwards;`;
  modal.innerHTML = `
  <div style="background:var(--card,#111827);border:1px solid rgba(255,255,255,0.08);
    border-radius:24px;width:min(420px,100%);overflow:hidden;
    box-shadow:0 40px 100px rgba(0,0,0,0.7);
    animation:lockCardIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards">
    <div style="height:4px;background:linear-gradient(90deg,${color},${color}88)"></div>
    <div id="billingCheckoutBody" style="padding:32px">
      <div class="billing-processing">
        <div class="billing-processing-icon" style="border-top-color:${color}"></div>
        <div class="billing-processing-msg" id="billingCheckoutMsg">${t('billing_step_iniciando')}</div>
      </div>
    </div>
  </div>`;

  document.body.appendChild(modal);
  onStart(modal);
}

function _closeCheckoutModal() {
  const m = document.getElementById('billingCheckoutModal');
  if (!m) return;
  m.style.animation = 'lockOverlayIn 0.25s reverse forwards';
  setTimeout(() => m.remove(), 260);
}

function startBuyLocal() {
  // Mock plan flow for now (no Stripe connection in this phase) — see
  // js/auth-ui.js. Falls back to the real Stripe flow only if the mock
  // UI module somehow isn't loaded, so this never silently does nothing.
  if (window.MNAuthUI) { MNAuthUI.openPlanModal('billing_lock'); return; }
  const email = window.MNAuth?.getUser()?.email ?? '';
  MNStripe.openPayment(MNStripeConfig.prices.local.yearly, email);
}

function startActivatePro() {
  if (window.MNAuthUI) { MNAuthUI.openPlanModal('billing_lock'); return; }
  const email = window.MNAuth?.getUser()?.email ?? '';
  MNStripe.openPayment(MNStripeConfig.prices.pro.yearly, email);
}

async function triggerSync() {
  const b = _b();
  if (!b.getSub() || b.getSub().plan !== 'pro_annual') return;
  document.querySelectorAll('.sync-indicator').forEach(el => {
    el.className = 'sync-indicator sync-indicator--syncing';
    el.innerHTML = `<div class="sync-spinner"></div> ${t('billing_status_sincronizando')}`;
  });
  await b.mockSyncCloud({});
  if (typeof window.toast === 'function') toast(t('billing_sync_done'));
  // _onStateChange will re-render if on billing page
}

async function confirmCancelPro() {
  const area = document.getElementById('cancelProArea');
  if (area) area.innerHTML = `<div style="font-size:.8rem;color:var(--text2);text-align:center;padding:12px">${t('billing_step_cancelando')}</div>`;
  await _b().mockCancelPro({
    onProgress: (m) => { if (area) area.innerHTML = `<div style="font-size:.8rem;color:var(--text2);text-align:center;padding:12px">${m}</div>`; }
  });
  // _onStateChange fires via mn:billing:cancelled → renders LOCAL scenario
}

function showCancelConfirm() {
  const area = document.getElementById('cancelProArea');
  if (!area) return;
  area.innerHTML = `
  <div class="cancel-confirm-card">
    <p>${t('billing_cancel_confirm_text')}</p>
    <div class="cancel-confirm-btns">
      <button class="btn-cancel-confirm btn-cancel-keep" onclick="MNBillingUI.hideCancelConfirm()">${t('billing_cancel_keep_btn')}</button>
      <button class="btn-cancel-confirm btn-cancel-go" onclick="MNBillingUI.confirmCancelPro()">${t('billing_cancel_go_btn')}</button>
    </div>
  </div>`;
}

function hideCancelConfirm() {
  const area = document.getElementById('cancelProArea');
  if (!area) return;
  area.innerHTML = `
  <button onclick="MNBillingUI.showCancelConfirm()"
    style="width:100%;padding:11px;border-radius:10px;font-size:.78rem;font-weight:700;
    cursor:pointer;font-family:inherit;background:rgba(244,63,94,0.08);
    border:1px solid rgba(244,63,94,0.2);color:#FB7185">
    ${t('billing_cancel_pro_btn')}
  </button>`;
}

// ════════════════════════════════════════════════════════════════
//  DYNAMIC BACKGROUNDS
// ════════════════════════════════════════════════════════════════

// ── Dynamic background: BILLING PAGE ONLY ───────────────────────
// Applies plan-colored canvas + orbs exclusively inside the billing view.
// Must never pollute the global layout (dashboard, etc.).

function initDynamicBg() {
  // Guard: only apply when the billing page is the active view
  if (!_isBillingPageActive()) {
    cleanupDynamicBg();
    return;
  }

  const b = _b();
  if (!b) return;
  const plan = b.getSub()?.plan || 'free_trial';

  let canvas = document.getElementById('mn-bg-canvas');
  if (!canvas) {
    canvas = document.createElement('div');
    canvas.id = 'mn-bg-canvas';
    // Scoped to billing content area — never injected globally into body
    const content = document.getElementById('content');
    const parent = content || document.body;
    parent.insertBefore(canvas, parent.firstChild);
  }

  canvas.className = '';
  // Strip any stale plan classes from body (safety)
  document.body.className = document.body.className.replace(/\bplan-[\w-]+\b/g, '').trim();

  const bgMap = { free_trial:'mn-bg--trial', local_lifetime:'mn-bg--local', pro_annual:'mn-bg--pro' };
  canvas.classList.add(bgMap[plan] || 'mn-bg--trial');
  // Scope plan class to canvas only — NOT body
  canvas.classList.add('plan-' + plan.replace(/_/g, '-'));

  document.querySelectorAll('.pro-orb').forEach(o => o.remove());
  if (plan === 'pro_annual') {
    [
      { size:400, top:'10%', left:'-10%', color:'#A78BFA', dur:'18s' },
      { size:300, top:'60%', right:'-5%', color:'#6366F1', dur:'24s' },
      { size:200, top:'40%', left:'40%',  color:'#00D4AA', dur:'15s' },
    ].forEach(o => {
      const el = document.createElement('div');
      el.className = 'pro-orb';
      el.style.cssText = `width:${o.size}px;height:${o.size}px;background:${o.color};
        top:${o.top||'auto'};left:${o.left||'auto'};right:${o.right||'auto'};
        animation-duration:${o.dur}`;
      // Orbs scoped to billing content, not body
      (document.getElementById('content') || document.body).appendChild(el);
    });
  }
}

/**
 * cleanupDynamicBg() — removes all dynamic background artifacts injected by initDynamicBg().
 * Called on every navigation away from the billing page to restore the clean global layout.
 */
function cleanupDynamicBg() {
  const canvas = document.getElementById('mn-bg-canvas');
  if (canvas) canvas.remove();
  document.querySelectorAll('.pro-orb').forEach(o => o.remove());
  // Strip any residual plan-* classes from body (belt-and-suspenders)
  document.body.className = document.body.className.replace(/\bplan-[\w-]+\b/g, '').trim();
}

// ════════════════════════════════════════════════════════════════
//  BADGES / GLOBAL REFRESH
// ════════════════════════════════════════════════════════════════

function renderStatusBadge(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  const { state, statusLabel } = _b().getSubStatus();
  const cls = {
    active_trial:'trial', trial_ending:'trial-ending', expired_trial:'expired',
    local_active:'local', pro_trialing:'pro', pro_active:'pro',
    pro_cancelled:'expired', syncing:'syncing'
  }[state] || 'trial';
  const dot = ['active_trial','trial_ending','local_active','pro_trialing','pro_active','syncing'].includes(state);
  el.innerHTML = `<span class="plan-status-badge badge--${cls}">${dot?'<span class="badge-dot"></span>':''}${statusLabel}</span>`;
}

function _refreshBadges() {
  if (window.MNAuthUI?.renderAuthBadge) window.MNAuthUI.renderAuthBadge('authPlanBadge');
  if (window.MNAuthUI?.renderTrialPill) window.MNAuthUI.renderTrialPill('trialPillContainer');
}

function refreshAll() {
  _onStateChange();
}

// ════════════════════════════════════════════════════════════════
//  INIT — Register all event listeners
// ════════════════════════════════════════════════════════════════

function initBillingUI() {
  const b = _b();
  if (!b) { console.warn('[MNBillingUI] MNBilling not loaded'); return; }

  b.init();
  // Dynamic background only if billing page is the entry point (rare, but safe)
  if (_isBillingPageActive()) {
    initDynamicBg();
  }
  _refreshBadges();

  // ── Core reactive listener ──
  // Every billing state change flows through _onStateChange()
  document.addEventListener('mn:billing:change', _onStateChange);

  // Trial expired mid-session
  document.addEventListener('mn:billing:trialExpired', _onStateChange);

  // After purchase/cancel
  document.addEventListener('mn:billing:activated', (e) => {
    if (typeof window.toast === 'function') {
      const msgs = {
        local_lifetime: t('billing_toast_local'),
        pro_annual:     t('billing_toast_pro'),
      };
      toast(msgs[e.detail?.plan] || t('billing_toast_generic'));
    }
    // _onStateChange fires via mn:billing:change which activateXxx already dispatches
  });

  document.addEventListener('mn:billing:cancelled', _onStateChange);

  // Export gating: re-apply after every page navigation
  document.addEventListener('mn:navigate', () => setTimeout(() => _applyExportGating(), 80));

  _applyExportGating(_getScenario());
}

// ════════════════════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  STRIPE CUSTOMER PORTAL
// ════════════════════════════════════════════════════════════════

async function openStripePortal() {
  // Requires the user to have a Supabase session and a Stripe customer ID.
  // Calls the create-portal Edge Function, which returns a redirect URL.
  const PORTAL_ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-portal-session';

  // Show loading state
  if (typeof window.toast === 'function') toast('⏳ Abriendo portal de facturación…');

  try {
    const session = window.MNSupabaseAuth?.getSession?.();
    const token   = session?.access_token;

    const res = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        return_url: window.location.href,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      throw new Error(data.error || 'No se pudo abrir el portal');
    }

    // Open in same tab (portal redirects back to return_url)
    window.location.href = data.url;

  } catch (err) {
    console.warn('[MNBillingUI] Portal error:', err);
    // Graceful fallback: show message instead of crashing
    if (typeof window.toast === 'function') {
      toast('⚠ ' + (err.message || 'Error al abrir el portal. Contacta con soporte.'), 'error');
    }
  }
}

window.MNBillingUI = {
  init:              initBillingUI,
  renderBillingPage,
  renderStatusBadge,
  initDynamicBg,
  cleanupDynamicBg,
  refreshAll,
  // Checkout
  startBuyLocal,
  startActivatePro,
  triggerSync,
  showCancelConfirm,
  hideCancelConfirm,
  confirmCancelPro,
  // Portal
  openStripePortal,
  // Export gating
  _exportBlocked,
  _applyExportGating,
  // Lock internals
  _restoreAccess,
  _getScenario,
};
