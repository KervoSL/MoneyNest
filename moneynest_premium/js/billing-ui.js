/**
 * ════════════════════════════════════════════════════════════════
 *  MoneyNest — js/billing-ui.js  v3.0  [i18n]
 *  Dynamic Billing Center UI — 3 Scenarios + Hard Paywall
 *
 *  Escenario A: Free Trial (24h activas)
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

  const fecha_reg      = sub.startedAt || sub.createdAt || Date.now();
  const trial_24h_gone = (Date.now() - fecha_reg) > 24 * 60 * 60 * 1000;
  const is_expired     = state === 'expired_trial' ||
                         (trial_24h_gone && !has_local && !is_pro);

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

  // 1. Paywall management (global, regardless of current page)
  _manageLockOverlay(scenario);

  // 2. Export button gating (global)
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

let _lockActive = false;

function _manageLockOverlay(scenario) {
  if (scenario === 'EXPIRED') {
    if (!_lockActive) _activateLock();
  } else {
    if (_lockActive) _deactivateLock();
  }
}

function _activateLock() {
  _lockActive = true;

  // Prevent ALL interaction with the app behind the overlay
  document.body.style.overflow = 'hidden';

  let overlay = document.getElementById('billingLockOverlay');
  if (overlay) return; // already showing

  overlay = document.createElement('div');
  overlay.id = 'billingLockOverlay';

  // Intercept ALL pointer events globally
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99000;
    display:flex;align-items:center;justify-content:center;
    padding:24px;
    background:rgba(7,10,18,0.82);
    backdrop-filter:blur(20px) saturate(0.6);
    -webkit-backdrop-filter:blur(20px) saturate(0.6);
    animation:lockOverlayIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
  `;

  overlay.innerHTML = `
  <div class="lock-wrap">
    <div class="lock-card" style="position:relative;max-width:440px;width:100%">
      <div class="lock-card-top-bar"></div>
      <div class="lock-card-glow"></div>

      <div class="lock-header">
        <div class="lock-expired-badge">
          <span class="lock-expired-dot"></span>
          ${t('billing_lock_badge')}
        </div>

        <div class="lock-icon-wrap">
          <span class="lock-icon">🔒</span>
        </div>

        <div class="lock-title">${t('billing_lock_title')}</div>
        <div class="lock-sub">${t('billing_lock_desc')}</div>
      </div>

      <div class="lock-body">
        <div class="lock-features">
          <div class="lock-feat">${t('billing_lock_feat1')}</div>
          <div class="lock-feat">${t('billing_lock_feat2')}</div>
          <div class="lock-feat">${t('billing_lock_feat3')}</div>
          <div class="lock-feat">${t('billing_lock_feat4')}</div>
        </div>

        <div class="lock-ctas">
          <!-- ÚNICO CTA principal: Local (embudo Local-First) -->
          <button class="lock-cta-primary" id="lockBuyLocalBtn"
            onclick="MNBillingUI.startBuyLocal()">
            ${t('billing_lock_cta')}
          </button>
          <div class="lock-cta-sub-note">
            ${t('billing_lock_cta_note')}
          </div>
        </div>

        <p class="lock-note">
          ${t('billing_lock_restore_q')}
          <a href="#" onclick="event.preventDefault();MNBillingUI._restoreAccess()">
            ${t('billing_lock_restore_link')}
          </a>
        </p>
      </div>
    </div>
  </div>`;

  document.body.appendChild(overlay);
}

function _deactivateLock() {
  _lockActive = false;
  document.body.style.overflow = '';

  const overlay = document.getElementById('billingLockOverlay');
  if (!overlay) return;
  overlay.style.animation = 'lockOverlayOut 0.3s ease forwards';
  setTimeout(() => overlay.remove(), 320);
}

function showLockOverlay() {
  _activateLock();
}

function hideLockOverlay() {
  _deactivateLock();
}

// Alias para el link "Restaurar acceso" — en producción haría lookup de licencia
function _restoreAccess() {
  // Por ahora abre el flow de compra
  startBuyLocal();
}

// ════════════════════════════════════════════════════════════════
//  BILLING PAGE — RENDER DISPATCHER
// ════════════════════════════════════════════════════════════════

function renderBillingPage() {
  const content = document.getElementById('content');
  if (!content) return;

  const scenario = _getScenario();

  // Empty the container first (clean slate)
  content.innerHTML = '';

  switch (scenario) {
    case 'EXPIRED': _renderExpired(content);  break;
    case 'PRO':     _renderPro(content);      break;
    case 'LOCAL':   _renderLocal(content);    break;
    default:        _renderTrial(content);    break;
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

  const totalMs  = 24 * 60 * 60 * 1000;
  const pct      = Math.max(0, Math.min(1, tl.ms / totalMs));
  const r = 28, circ = 2 * Math.PI * r;
  const offset   = (circ * (1 - pct)).toFixed(2);
  const isEnding = tl.ms > 0 && tl.ms < 4 * 60 * 60 * 1000;

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
            <span class="mn-price-amount mn-price-amount--local">5</span>
          </div>
          <div class="mn-plan-card__period">${t('billing_plan_local_period')}</div>
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
          <!-- Price breakdown: Local 5€ + Pro 5€/yr -->
          <div class="mn-plan-card__price-block mn-price-stack">
            <div class="mn-price-row mn-price-row--local">
              <span class="mn-price-row-label">Local</span>
              <span class="mn-price-row-amount">5€ <span style="font-size:.65rem;font-weight:600;opacity:.6">único</span></span>
            </div>
            <div class="mn-price-row-plus">+</div>
            <div class="mn-price-row mn-price-row--pro-yr">
              <span class="mn-price-row-label">Pro</span>
              <span class="mn-price-row-amount">5€ <span style="font-size:.65rem;font-weight:600;opacity:.6">/año</span></span>
            </div>
          </div>
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
            <span class="mn-dual-price mn-dual-price--pro">${t('billing_plan_pro_price')}</span>
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
          <div class="mn-sub-stat__value">${t('billing_plan_pro_price')}</div>
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
  scenario = scenario || _getScenario();
  const isLocked = scenario === 'TRIAL' || scenario === 'EXPIRED';

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
  if (typeof window.goTo === 'function') goTo('billing');
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
  document.getElementById('billingLockOverlay')?.remove();
  _lockActive = false;
  const email = window.MNAuth?.getUser()?.email ?? '';
  MNStripe.openPayment(MNStripeConfig.prices.local, email);
}

function startActivatePro() {
  document.getElementById('billingLockOverlay')?.remove();
  _lockActive = false;
  const email = window.MNAuth?.getUser()?.email ?? '';
  MNStripe.openPayment(MNStripeConfig.prices.pro, email);
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

  const { state } = _b()?.getSubStatus?.() || {};

  // ── Topbar "Activar Pro" button ─────────────────────────────────────
  // Show ONLY during the 7-day free trial of the Pro Annual plan (pro_trialing).
  // Hide for every other state: initial trial, expired, local, pro_active, cancelled.
  // ── Premium Topbar Pill ──────────────────────────────────────────────
  const pill     = document.getElementById('mnTrialPill');
  const pillIcon = document.getElementById('mnTrialPillIcon');
  const pillText = document.getElementById('mnTrialPillText');

  if (pill && pillIcon && pillText) {
    // Clear state classes
    pill.classList.remove('pill--pro', 'pill--trial', 'pill--urgent');

    if (state === 'pro_active') {
      // State 1: full PRO — show static badge, no action needed
      pill.style.display = 'flex';
      pill.classList.add('pill--pro');
      pillIcon.textContent = '⚡';
      pillText.textContent = 'Plan PRO';
      pill.onclick = null;
      pill.style.cursor = 'default';

    } else if (state === 'pro_trialing') {
      // State 2 & 3: trial — show countdown, clickable to upgrade
      const sub = _b()?.getSub?.();
      const endsAt = (sub && (sub.proTrialEndsAt || sub.expiresAt)) || null;
      const ms = endsAt ? Math.max(0, endsAt - Date.now()) : 0;
      const urgent = ms > 0 && ms < 86400000; // < 24h

      pill.style.display = 'flex';
      pill.classList.add(urgent ? 'pill--urgent' : 'pill--trial');
      pill.style.cursor = 'pointer';
      pill.onclick = () => _showAuthModal();

      if (ms <= 0) {
        pillIcon.textContent = '⚡';
        pillText.textContent = 'Prueba PRO';
      } else {
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        const m = Math.floor((ms % 3600000)  / 60000);
        if (urgent) {
          pillIcon.textContent = '⏰';
          pillText.textContent = h + 'h ' + m + 'm restantes';
        } else {
          pillIcon.textContent = '⚡';
          pillText.textContent = 'Prueba termina en ' + (d > 0 ? d + 'd ' : '') + h + 'h';
        }
      }

      // Live countdown — refresh every minute
      if (window._mnPillInterval) clearInterval(window._mnPillInterval);
      window._mnPillInterval = setInterval(function() {
        if (typeof _refreshBadges === 'function') _refreshBadges();
      }, 60000);

    } else {
      // All other states: hide pill
      pill.style.display = 'none';
      if (window._mnPillInterval) { clearInterval(window._mnPillInterval); window._mnPillInterval = null; }
    }
  }

  // ── Sidebar ⚡ PRO badge (next to MoneyNest logo) ───────────────────
  const proBadge = document.getElementById('sidebarProBadge');
  if (proBadge) {
    proBadge.style.display = state === 'pro_active' ? 'inline-flex' : 'none';
  }
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

  // Check paywall on boot (if trial already expired before app loaded)
  const bootScenario = _getScenario();
  if (bootScenario === 'EXPIRED') {
    setTimeout(_activateLock, 400);
  }
  _applyExportGating(bootScenario);
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
  showLockOverlay,
  hideLockOverlay,
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
