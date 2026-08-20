/**
 * MoneyNest — components/auth-ui.js  v4.0
 * Production auth modal: email/password, Google, Apple,
 * update-password, plan management. Fully integrated with
 * the app's i18n, dark/light mode, and design system.
 *
 * Dependencies:
 *   • js/auth.js           → window.MNAuth
 *   • js/supabase-auth.js  → window.MNSupabaseAuth
 */
'use strict';

// ─── Auth dependency resolver ────────────────────────────────────
const _auth = (() => {
  if (typeof window !== 'undefined' && window.MNAuth) return window.MNAuth;
  return new Proxy({}, { get(_, k) { throw new Error(`[MNAuthUI] MNAuth.${k} not available`); } });
})();

// ─── Design tokens (match app design system) ─────────────────────
const C = {
  accent:     '#00D4AA',
  accentDark: '#00A882',
  indigo:     '#6366F1',
  indigoDark: '#4F46E5',
  red:        '#F43F5E',
  gold:       '#F59E0B',
};

// ─── i18n helper — uses app's t() if available ───────────────────
function _t(key, fallback) {
  if (typeof window.t === 'function') {
    const val = window.t(key);
    return (val && val !== key) ? val : fallback;
  }
  return fallback;
}

// ─── HTML escape helper — prevents XSS in innerHTML contexts ─────
function _escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Modal mode ──────────────────────────────────────────────────
// 'plan' | 'login' | 'register' | 'verify-otp' | 'forgot' | 'update-password'
let _modalMode = 'plan';
let _modalLoading = false;
let _pendingEmail = '';  // email esperando verificación OTP


// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════

function initAuthUI() {
  if (!document.getElementById('authModal')) _injectModalShell();
  _injectGlobalStyles();

  // Paywall events — both open the correct modal view
  document.addEventListener('mn:buyLocal',      () => showAuthModal('plan'));
  document.addEventListener('mn:restoreAccess', () => showAuthModal('login'));
  document.addEventListener('mn:activatePro',   () => showAuthModal('plan'));

  // Escape closes this modal too — the app's global Escape handler
  // (closeAllModals) only targets .modal-overlay.open, which this
  // modal doesn't use (it toggles style.display directly).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('authModal')?.style.display === 'flex') closeAuthModal();
  });
}

function showAuthModal(mode) {
  const modal = document.getElementById('authModal');
  const card  = document.getElementById('authModalCard');
  if (!modal || !card) return;

  const user      = _auth.getUser();
  const isLoggedIn = window.MNSupabaseAuth?.isLoggedIn() ?? false;

  // Route: if requesting login but already logged in → show plan
  if (mode === 'login' && isLoggedIn) mode = 'plan';
  _modalMode = mode || (isLoggedIn ? 'plan' : 'login');

  const wasOpen = modal.style.display === 'flex';
  card.innerHTML = _buildContent(user);
  modal.style.display = 'flex';
  modal.onclick = (e) => { if (e.target === modal) closeAuthModal(); };
  _attachListeners(user);
  if (!wasOpen && typeof window._pushScrollLock === 'function') window._pushScrollLock();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  const wasOpen = modal && modal.style.display === 'flex';
  if (modal) modal.style.display = 'none';
  _modalLoading = false;
  if (wasOpen && typeof window._popScrollLock === 'function') window._popScrollLock();
}

function renderAuthBadge(containerId = 'authPlanBadge') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const user = _auth.getUser();
  const cfg  = _planBadgeConfig(user);
  el.innerHTML = `
    <div style="display:inline-flex;align-items:center;gap:6px;
      background:${cfg.bg};border:1px solid ${cfg.border};
      color:${cfg.color};font-size:.7rem;font-weight:700;
      text-transform:uppercase;letter-spacing:.08em;
      padding:4px 10px;border-radius:99px;cursor:pointer;transition:all .18s;"
      onclick="MNAuthUI.showAuthModal()" title="${_escHtml(_t('auth_ver_plan','Ver mi plan'))}">
      ${_escHtml(cfg.icon)} ${_escHtml(cfg.label)}
    </div>`;
}

function renderTrialPill(containerId = 'trialPillContainer') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const user = _auth.getUser();
  // Only show after onboarding is complete and user explicitly chose trial
  const obSeen = localStorage.getItem('mn7_ob_seen') === 'true';
  if (user.plan !== 'trial' || !obSeen) { el.innerHTML = ''; return; }
  const label = _auth.trialTimeLeftLabel ? _auth.trialTimeLeftLabel() : '—';
  el.innerHTML = `
    <div style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;
      background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);
      font-size:.85rem;font-weight:600;
      padding:5px 14px;border-radius:99px;transition:all .18s;"
      onclick="MNAuthUI.showAuthModal()" title="${_t('auth_trial_restante','Tiempo de prueba restante')}">
      <span style="opacity:.8">⏳</span>
      <span style="color:var(--text);font-weight:700">Prueba PRO:</span>
      <span style="color:#fff;font-weight:700">${label}</span>
      <span style="color:${C.indigo};font-size:.75rem;font-weight:700">· ${_t('desbloquear','Desbloquear')}</span>
    </div>`;
  if (!el._mnTimerId) {
    el._mnTimerId = setInterval(() => renderTrialPill(containerId), 60_000);
  }
}

// ─── Trial countdown banner (prominent, top of page) ─────────────
function renderTrialBanner() {
  const user = _auth.getUser();

  // Remove banner if plan is no longer trial or onboarding not yet completed
  const existing = document.getElementById('mn-trial-banner');
  const obSeen = localStorage.getItem('mn7_ob_seen') === 'true';
  if (user.plan !== 'trial' || !obSeen) {
    if (existing) existing.remove();
    return;
  }

  const ms    = _auth.trialMsLeft ? _auth.trialMsLeft() : 0;
  const label = _auth.trialTimeLeftLabel ? _auth.trialTimeLeftLabel() : '—';
  const h     = Math.floor(ms / 3600000);

  // Urgency colours: <2h red, <6h amber, else indigo
  const urgent  = h < 2;
  const warning = h < 6;
  const accent  = urgent ? '#F43F5E' : warning ? '#F59E0B' : C.indigo;
  const accentBg = urgent
    ? 'rgba(244,63,94,.1)'
    : warning
      ? 'rgba(245,158,11,.1)'
      : 'rgba(99,102,241,.1)';
  const accentBorder = urgent
    ? 'rgba(244,63,94,.35)'
    : warning
      ? 'rgba(245,158,11,.35)'
      : 'rgba(99,102,241,.3)';
  const emoji = urgent ? '🚨' : warning ? '⚠️' : '⏳';

  const html = `
    <div id="mn-trial-banner" style="
      position:fixed;top:0;left:0;right:0;z-index:8800;
      background:${accentBg};
      border-bottom:1px solid ${accentBorder};
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      display:flex;align-items:center;justify-content:center;gap:10px;
      padding:8px 16px;font-size:.78rem;font-weight:600;
      font-family:inherit;
      animation:mnTrialBannerIn .35s ease forwards;
    ">
      <span style="color:${accent}">${emoji} Prueba gratuita: queda <strong style="color:#fff">${label}</strong></span>
      <button onclick="MNAuthUI.showAuthModal()" style="
        padding:4px 14px;border-radius:99px;border:1.5px solid ${accent};
        background:transparent;color:${accent};font-size:.72rem;font-weight:800;
        cursor:pointer;font-family:inherit;transition:all .15s;
        white-space:nowrap;
      " onmouseover="this.style.background='${accent}';this.style.color='#0A0E17'"
         onmouseout="this.style.background='transparent';this.style.color='${accent}'">
        Desbloquear →
      </button>
      <button onclick="document.getElementById('mn-trial-banner').remove()" style="
        position:absolute;right:12px;background:none;border:none;
        color:rgba(255,255,255,.3);font-size:1rem;cursor:pointer;
        padding:2px 6px;border-radius:6px;font-family:inherit;
        transition:color .15s;
      " onmouseover="this.style.color='rgba(255,255,255,.7)'"
         onmouseout="this.style.color='rgba(255,255,255,.3)'" aria-label="Cerrar">✕</button>
    </div>`;

  if (existing) {
    existing.outerHTML = html;
  } else {
    document.body.insertAdjacentHTML('afterbegin', html);
  }

  // Inject keyframe once
  if (!document.getElementById('mn-trial-banner-kf')) {
    const s = document.createElement('style');
    s.id = 'mn-trial-banner-kf';
    s.textContent = `@keyframes mnTrialBannerIn{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
  }

  // Refresh every minute
  if (!renderTrialBanner._timer) {
    renderTrialBanner._timer = setInterval(renderTrialBanner, 60_000);
  }
}


// ════════════════════════════════════════════════════════════════
//  CONTENT ROUTER
// ════════════════════════════════════════════════════════════════

function _buildContent(user) {
  const isLoggedIn = window.MNSupabaseAuth?.isLoggedIn() ?? false;

  if (_modalMode === 'login')           return _buildLoginView();
  if (_modalMode === 'register')        return _buildRegisterView();
  if (_modalMode === 'forgot')          return _buildForgotView();
  if (_modalMode === 'update-password') return _buildUpdatePasswordView();

  // Plan views — show plan view directly if user has any plan (even without Supabase session)
  // Only show guest view if user has no local identity at all
  const hasPlan = user.plan && user.plan !== 'trial' || (user.plan === 'trial' && user.id);
  if (!isLoggedIn && !hasPlan) return _buildGuestPlanView(user);

  switch (user.plan) {
    case 'trial':        return _buildTrialView(user);
    case 'locked_local': return _buildLockedView(user);
    case 'local':        return _buildLocalView(user);
    case 'pro':          return _buildProView(user);
    default:             return _buildTrialView(user);
  }
}


// ════════════════════════════════════════════════════════════════
//  AUTH VIEWS
// ════════════════════════════════════════════════════════════════

function _buildLoginView() {
  return `
    ${_closeBtn()}
    <div class="mn-auth-modal-header">
      <div class="mn-auth-eyebrow">${_t('auth_cuenta','Cuenta MoneyNest')}</div>
      <div class="mn-auth-headline" style="color:${C.accent}">${_t('auth_iniciar_sesion','Iniciar sesión')}</div>
    </div>

    <div class="mn-auth-form-col">
      ${_field('email', 'mn-login-email', _t('auth_email','Correo electrónico'), 'email', 'tu@email.com', 'email')}
      ${_fieldPassword('mn-login-password', _t('auth_password','Contraseña'), 'current-password')}
      <div class="mn-auth-msg" id="mn-login-msg" style="display:none"></div>
      <button class="mn-btn-primary mn-btn-full" id="mn-login-submit-btn">
        ${_t('auth_entrar','Entrar')}
      </button>
    </div>

    <div style="text-align:center;margin-top:10px">
      <button class="mn-link-btn" id="mn-forgot-link">${_t('auth_olvide_contrasena','¿Olvidaste tu contraseña?')}</button>
    </div>

    <div class="mn-auth-divider"></div>

    <div style="text-align:center">
      <span style="font-size:.8rem;color:var(--text2,#94A3B8)">${_t('auth_nuevo','¿Nuevo en MoneyNest?')} </span>
      <button class="mn-link-btn mn-link-btn--accent" id="mn-go-register">${_t('auth_crear_cuenta','Crear cuenta →')}</button>
    </div>`;
}

function _buildRegisterView() {
  return `
    ${_closeBtn()}
    <div class="mn-auth-modal-header">
      <div class="mn-auth-eyebrow">${_t('auth_cuenta','Cuenta MoneyNest')}</div>
      <div class="mn-auth-headline" style="color:${C.accent}">${_t('auth_crear_cuenta_titulo','Crear cuenta')}</div>
    </div>

    <div class="mn-auth-trial-note">
      <span style="font-weight:700;color:${C.accent}">⏳ ${_t('auth_24h_gratis','24h gratis')}</span>
      &nbsp;— ${_t('auth_24h_desc','Registrarte activa tu prueba gratuita. Sin tarjeta.')}
    </div>

    <div class="mn-auth-form-col">
      ${_field('email', 'mn-reg-email', _t('auth_email','Correo electrónico'), 'email', 'tu@email.com', 'email')}
      ${_fieldPasswordStrength('mn-reg-password', _t('auth_password_nueva','Contraseña (mín. 8 caracteres)'), 'new-password')}
      ${_fieldPassword('mn-reg-password2', _t('auth_confirmar_password','Confirmar contraseña'), 'new-password')}
      <div class="mn-auth-msg" id="mn-reg-msg" style="display:none"></div>
      <!-- Cloudflare Turnstile anti-bot widget -->
      <div id="mn-turnstile-container" style="margin-top:2px"></div>
      <button class="mn-btn-primary mn-btn-full" id="mn-reg-submit-btn">
        ${_t('auth_crear_y_empezar','Crear cuenta y empezar →')}
      </button>
    </div>

    <div class="mn-auth-divider"></div>

    <div style="text-align:center">
      <span style="font-size:.8rem;color:var(--text2,#94A3B8)">${_t('auth_ya_tienes','¿Ya tienes cuenta?')} </span>
      <button class="mn-link-btn mn-link-btn--accent" id="mn-go-login">${_t('auth_iniciar_sesion_link','Iniciar sesión')}</button>
    </div>`;
}

function _buildVerifyOtpView() {
  const masked = _pendingEmail
    ? _pendingEmail.replace(/(.{2}).*(@.*)/, '$1••••$2')
    : '••••@••••';
  return `
    ${_closeBtn()}
    <div class="mn-auth-modal-header">
      <div class="mn-auth-eyebrow">${_t('auth_verificacion','Verificación de email')}</div>
      <div class="mn-auth-headline" style="color:${C.indigo}">🔐 ${_t('auth_codigo_titulo','Introduce el código')}</div>
    </div>

    <div style="background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.18);border-radius:14px;padding:16px 18px;margin-bottom:20px;text-align:center">
      <div style="font-size:1.6rem;margin-bottom:8px">📬</div>
      <div style="font-size:.85rem;color:var(--text,#E8EFF7);font-weight:700;margin-bottom:4px">${_t('auth_codigo_enviado','Código enviado a')}</div>
      <div style="font-size:.9rem;color:${C.indigo};font-weight:800">${masked}</div>
      <div style="font-size:.72rem;color:var(--text2,#94A3B8);margin-top:6px">${_t('auth_codigo_desc','Revisa tu bandeja de entrada (y carpeta de spam)')}</div>
    </div>

    <div class="mn-auth-form-col">
      <div>
        <label class="mn-auth-field-label">${_t('auth_codigo_label','Código de 6 dígitos')}</label>
        <input class="mn-auth-input" type="text" id="mn-otp-input"
          placeholder="000000"
          maxlength="6"
          autocomplete="one-time-code"
          inputmode="numeric"
          style="font-size:1.6rem;font-weight:800;letter-spacing:.25em;text-align:center;padding:14px;"
          oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,6)">
      </div>
      <div class="mn-auth-msg" id="mn-otp-msg" style="display:none"></div>
      <button class="mn-btn-primary mn-btn-full" id="mn-otp-submit-btn">
        ✓ ${_t('auth_verificar','Verificar y entrar')}
      </button>
    </div>

    <div style="text-align:center;margin-top:14px">
      <span style="font-size:.78rem;color:var(--text2,#94A3B8)">${_t('auth_no_recibido','¿No lo recibiste?')} </span>
      <button class="mn-link-btn mn-link-btn--accent" id="mn-otp-resend">${_t('auth_reenviar','Reenviar código')}</button>
    </div>

    <div class="mn-auth-divider"></div>
    <div style="text-align:center">
      <button class="mn-link-btn" id="mn-otp-back">← ${_t('auth_volver_registro','Volver')}</button>
    </div>`;
}

function _buildForgotView() {
  return `
    ${_closeBtn()}
    <div class="mn-auth-modal-header">
      <div class="mn-auth-eyebrow">${_t('auth_recuperar','Recuperar acceso')}</div>
      <div class="mn-auth-headline" style="color:${C.indigo}">${_t('auth_resetear','Resetear contraseña')}</div>
    </div>

    <p style="font-size:.82rem;color:var(--text2,#94A3B8);line-height:1.65;margin-bottom:16px">
      ${_t('auth_reset_desc','Te enviaremos un enlace para restablecer tu contraseña.')}
    </p>

    <div class="mn-auth-form-col">
      ${_field('email', 'mn-forgot-email', _t('auth_email','Correo electrónico'), 'email', 'tu@email.com', 'email')}
      <div class="mn-auth-msg" id="mn-forgot-msg" style="display:none"></div>
      <button class="mn-btn-primary mn-btn-full" id="mn-forgot-submit-btn">
        ${_t('auth_enviar_enlace','Enviar enlace de reseteo')}
      </button>
    </div>

    <div class="mn-auth-divider"></div>
    <div style="text-align:center">
      <button class="mn-link-btn" id="mn-back-to-login">← ${_t('auth_volver_login','Volver al login')}</button>
    </div>`;
}

function _buildUpdatePasswordView() {
  return `
    ${_closeBtn()}
    <div class="mn-auth-modal-header">
      <div class="mn-auth-eyebrow">${_t('auth_seguridad','Seguridad')}</div>
      <div class="mn-auth-headline" style="color:${C.accent}">${_t('auth_nueva_contrasena','Nueva contraseña')}</div>
    </div>

    <p style="font-size:.82rem;color:var(--text2,#94A3B8);line-height:1.65;margin-bottom:16px">
      ${_t('auth_nueva_pw_desc','Elige una contraseña segura para tu cuenta MoneyNest.')}
    </p>

    <div class="mn-auth-form-col">
      ${_fieldPasswordStrength('mn-newpw-password', _t('auth_nueva_contrasena','Nueva contraseña'), 'new-password')}
      ${_fieldPassword('mn-newpw-password2', _t('auth_confirmar_password','Confirmar contraseña'), 'new-password')}
      <div class="mn-auth-msg" id="mn-newpw-msg" style="display:none"></div>
      <button class="mn-btn-primary mn-btn-full" id="mn-newpw-submit-btn">
        ${_t('auth_guardar_contrasena','Guardar contraseña')}
      </button>
    </div>`;
}


// ════════════════════════════════════════════════════════════════
//  PLAN VIEWS
// ════════════════════════════════════════════════════════════════

function _buildGuestPlanView(user) {
  const timeLabel = _auth.trialTimeLeftLabel ? _auth.trialTimeLeftLabel() : '—';
  const hoursLeft = _auth.trialHoursLeft     ? _auth.trialHoursLeft()     : 0;
  const pct       = Math.min(100, Math.round((hoursLeft / 24) * 100));

  return `
    ${_closeBtn()}
    ${_planHeader(_t('auth_plan_prueba','⏳ Plan de prueba'), C.indigo)}

    <div class="mn-auth-trial-box">
      <div class="mn-auth-trial-time">${timeLabel}</div>
      <div class="mn-auth-trial-label">${_t('auth_tiempo_restante','tiempo de prueba restante')}</div>
      <div class="mn-auth-progress-track">
        <div class="mn-auth-progress-bar" style="width:${pct}%;background:${pct > 25 ? C.indigo : C.red}"></div>
      </div>
    </div>

    <p style="font-size:.82rem;color:var(--text2,#94A3B8);line-height:1.65;margin-bottom:16px">
      ${_t('auth_registrate_desc','Regístrate para que tu trial de 24h quede asociado a tu email y puedas recuperar el acceso desde cualquier dispositivo.')}
    </p>

    <button class="mn-btn-primary mn-btn-full" id="mn-go-register-cta">
      ${_t('auth_crear_cuenta_gratis','Crear cuenta gratuita →')}
    </button>
    <div style="text-align:center;margin-top:10px">
      <button class="mn-link-btn" id="mn-go-login-link">${_t('auth_ya_tengo_cuenta','Ya tengo cuenta — Iniciar sesión')}</button>
    </div>

    <div class="mn-auth-divider"></div>

    <div class="mn-auth-cta-box">
      <div class="mn-auth-cta-label">🔓 ${_t('auth_desbloquear_ahora','Desbloquear ahora')}</div>
      <div class="mn-auth-cta-desc">${_t('auth_plan_local_desc','Con el Plan Local (5€ único) nunca expira.')}</div>
      <button class="mn-btn-secondary mn-btn-full" id="mn-buy-local-btn" style="margin-top:12px">
        💾 ${_t('auth_comprar_local','Comprar Plan Local — 6,99€ →')}
      </button>
    </div>

    ${_modalFooter(user)}`;
}

function _buildTrialView(user) {
  const timeLabel  = _auth.trialTimeLeftLabel ? _auth.trialTimeLeftLabel() : '—';
  const hoursLeft  = _auth.trialHoursLeft     ? _auth.trialHoursLeft()     : 0;
  const pct        = Math.min(100, Math.round((hoursLeft / 24) * 100));
  const email      = window.MNSupabaseAuth?.getEmail() || user.email || '';
  const isLoggedIn = !!email;

  return `
    ${_closeBtn()}
    ${_planHeader(_t('auth_plan_prueba','⏳ Plan de prueba'), C.indigo)}

    <div class="mn-auth-trial-box">
      <div class="mn-auth-trial-time">${timeLabel}</div>
      <div class="mn-auth-trial-label">${_t('auth_tiempo_restante','tiempo de prueba restante')}</div>
      <div class="mn-auth-progress-track">
        <div class="mn-auth-progress-bar" style="width:${pct}%;background:${pct > 25 ? C.indigo : C.red}"></div>
      </div>
    </div>

    ${isLoggedIn ? `<div class="mn-auth-session-chip">✅ ${_t('auth_sesion_activa','Sesión activa')}: <strong>${_escHtml(email)}</strong></div>` : ''}

    <div class="mn-auth-cta-box">
      <div class="mn-auth-cta-label">🔒 ${_t('auth_que_pasa','¿Qué pasa cuando expire?')}</div>
      <div class="mn-auth-cta-desc">${_t('auth_plan_local_cta_desc','La app se bloqueará. Con MoneyNest (6,99€ pago único) se desbloquea para siempre.')}</div>
      <button class="mn-btn-primary mn-btn-full" id="mn-buy-local-btn" style="margin-top:12px">
        🔓 ${_t('auth_comprar_local','Comprar MoneyNest — 6,99€ pago único')}
      </button>
    </div>

    <div class="mn-auth-divider"></div>
    ${isLoggedIn
      ? `<button class="mn-btn-ghost mn-btn-full" id="mn-logout-btn">${_t('auth_cerrar_sesion','Cerrar sesión')}</button>`
      : `<div style="text-align:center"><button class="mn-link-btn" id="mn-go-login-link">${_t('auth_ya_tengo_cuenta','Ya tengo cuenta — Iniciar sesión')}</button></div>`
    }
    ${_modalFooter(user)}`;
}

function _buildLockedView(user) {
  return `
    ${_closeBtn()}
    ${_planHeader('🔒 ' + _t('auth_acceso_bloqueado','Acceso bloqueado'), C.red)}

    <div class="mn-auth-alert-box">
      <div class="mn-auth-alert-icon">⏰</div>
      <div class="mn-auth-alert-text">
        ${_t('auth_prueba_expirada','Tu prueba de 24 horas ha expirado.')}<br>
        ${_t('auth_datos_seguros','Tus datos están a salvo — solo necesitas desbloquear la app.')}
      </div>
    </div>

    <div class="mn-auth-price-card">
      <div class="mn-auth-price-label">${_t('auth_plan_local','MoneyNest')}</div>
      <div class="mn-auth-price-amount">6,99€ <span>${_t('auth_pago_unico','pago único')}</span></div>
      <div class="mn-auth-price-features">
        <div class="mn-auth-pf">✅ ${_t('auth_feat_acceso_inmediato','Acceso inmediato sin fecha de expiración')}</div>
        <div class="mn-auth-pf">✅ ${_t('auth_feat_datos','Todos tus datos conservados')}</div>
        <div class="mn-auth-pf">✅ ${_t('auth_feat_ilimitado','Ilimitado: movimientos, categorías, cuentas')}</div>
        <div class="mn-auth-pf">✅ ${_t('auth_feat_export','Exportación PDF y Excel')}</div>
      </div>
    </div>

    <button class="mn-btn-primary mn-btn-full mn-btn-large" id="mn-buy-local-btn">
      🔓 ${_t('auth_comprar_local_cta','Comprar MoneyNest — 6,99€ →')}
    </button>
    <div style="margin-top:10px">
      <button class="mn-btn-ghost mn-btn-full" id="mn-restore-btn">${_t('auth_restaurar','¿Ya compraste? Restaurar acceso')}</button>
    </div>
    ${_modalFooter(user)}`;
}

function _buildLocalView(user) {
  const email = window.MNSupabaseAuth?.getEmail() || user.email || '';
  return `
    ${_closeBtn()}
    ${_planHeader('💾 ' + _t('auth_plan_local_activo','MoneyNest activo'), C.accent)}

    <div class="mn-auth-status-box mn-status-ok">
      <span class="mn-status-icon">✅</span>
      <div>
        <div class="mn-status-title">${_t('auth_acceso_desbloqueado','Acceso desbloqueado')}</div>
        <div class="mn-status-desc">${email ? `${_t('auth_cuenta','Cuenta')}: ${_escHtml(email)}` : _t('auth_datos_locales','Tus datos se guardan en este dispositivo.')}</div>
      </div>
    </div>

    <div class="mn-auth-divider"></div>
    <button class="mn-btn-ghost mn-btn-full" id="mn-logout-btn">${_t('auth_cerrar_sesion','Cerrar sesión')}</button>
    ${_modalFooter(user)}`;
}

function _buildProView(user) {
  const inProTrial  = user.proTrialEndsAt && Date.now() < user.proTrialEndsAt;
  const proExpLabel = user.proTrialEndsAt
    ? `${_t('auth_hasta','hasta el')} ${new Date(user.proTrialEndsAt).toLocaleDateString('es-ES', { day:'numeric', month:'long' })}`
    : _t('auth_suscripcion_activa','suscripción activa');
  const email = window.MNSupabaseAuth?.getEmail() || user.email || '';

  return `
    ${_closeBtn()}
    ${_planHeader('⚡ ' + _t('auth_plan_pro_activo','Plan Pro activo'), C.accent)}

    <div class="mn-auth-status-box mn-status-pro">
      <span class="mn-status-icon">⚡</span>
      <div>
        <div class="mn-status-title">${_t('auth_gracias_pro','¡Gracias por ser Pro!')}</div>
        <div class="mn-status-desc">${inProTrial ? _t('auth_prueba_activa','Prueba gratuita activa') + ' ' + proExpLabel : proExpLabel}</div>
      </div>
    </div>

    ${email ? `<div class="mn-auth-session-chip">${_t('auth_cuenta','Cuenta')}: <strong>${_escHtml(email)}</strong></div>` : ''}

    <div class="mn-auth-features-grid">
      <div class="mn-auth-fg">☁️ ${_t('auth_feat_cloud','Cloud sync')}</div>
      <div class="mn-auth-fg">🔄 ${_t('auth_feat_backups','Backups auto')}</div>
      <div class="mn-auth-fg">⚡ ${_t('auth_feat_soporte','Soporte prio.')}</div>
      <div class="mn-auth-fg">🚀 ${_t('auth_feat_beta','Beta primero')}</div>
    </div>

    ${inProTrial ? `
    <div class="mn-auth-trial-reminder">
      💳 ${_t('auth_vincular_pago_desc','Para mantener el Pro, vincula un método de pago antes de que expire la prueba.')}
      <button class="mn-btn-secondary mn-btn-sm" id="mn-link-payment-btn" style="margin-top:10px">${_t('auth_vincular_pago','Vincular método de pago')}</button>
    </div>` : ''}

    <div class="mn-auth-divider"></div>
    <button class="mn-btn-ghost mn-btn-full mn-btn-danger" id="mn-cancel-pro-btn">${_t('auth_cancelar_pro','Cancelar suscripción Pro')}</button>
    <div class="mn-auth-cancel-note">${_t('auth_cancelar_pro_nota','Si cancelas, tu plan vuelve a Local. Nunca perderás el acceso.')}</div>
    <div style="margin-top:8px">
      <button class="mn-btn-ghost mn-btn-full" id="mn-logout-btn">${_t('auth_cerrar_sesion','Cerrar sesión')}</button>
    </div>
    ${_modalFooter(user)}`;
}


// ════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════════════

function _attachListeners(user) {
  // ── Navigation ───────────────────────────────────────────────
  _on('mn-go-register',     () => _switchMode('register'));
  _on('mn-go-register-cta', () => _switchMode('register'));
  _on('mn-go-login',        () => _switchMode('login'));
  _on('mn-go-login-link',   () => _switchMode('login'));
  _on('mn-forgot-link',     () => _switchMode('forgot'));
  _on('mn-back-to-login',   () => _switchMode('login'));

  // ── Login ────────────────────────────────────────────────────
  _on('mn-login-submit-btn', () => _handleLogin());
  _onKey('mn-login-password', 'Enter', () => _handleLogin());

  // ── Register ─────────────────────────────────────────────────
  _on('mn-reg-submit-btn', () => _handleRegister());
  _onKey('mn-reg-password2', 'Enter', () => _handleRegister());
  // Init Turnstile widget after DOM renders
  setTimeout(() => _initTurnstile(), 80);

  // ── Forgot password ──────────────────────────────────────────
  _on('mn-forgot-submit-btn', () => _handleForgot());
  _onKey('mn-forgot-email', 'Enter', () => _handleForgot());

  // ── Update password (post-reset) ─────────────────────────────
  _on('mn-newpw-submit-btn', () => _handleUpdatePassword());
  _onKey('mn-newpw-password2', 'Enter', () => _handleUpdatePassword());

  // ── Logout ───────────────────────────────────────────────────
  _on('mn-logout-btn', () => _handleLogout());

  // ── Buy Local ────────────────────────────────────────────────
  _on('mn-buy-local-btn', () => {
    const email = window.MNSupabaseAuth?.getEmail() || user.email || '';
    closeAuthModal();
    document.dispatchEvent(new CustomEvent('mn:buyLocal', { detail: { source:'modal', user } }));
    if (window.MNPayment) MNPayment.open(MNStripeConfig.prices.local, email);
  });

  // ── Cancel Pro ───────────────────────────────────────────────
  _on('mn-cancel-pro-btn', () => {
    if (!confirm(_t('auth_confirmar_cancelar_pro','¿Seguro que quieres cancelar el Plan Pro? Tu plan volverá a Local sin bloqueos.'))) return;
    document.dispatchEvent(new CustomEvent('mn:cancelPro', { detail: { source:'modal' } }));
    _auth.cancelPro && _auth.cancelPro();
    closeAuthModal();
    renderAuthBadge();
    renderTrialPill();
    if (typeof updateSidebarLogo === 'function') updateSidebarLogo();
    _toast(_t('auth_pro_cancelado','Plan Pro cancelado. Sigues con Plan Local.'));
  });

  // ── Link payment ─────────────────────────────────────────────
  _on('mn-link-payment-btn', () => {
    document.dispatchEvent(new CustomEvent('mn:linkPayment', { detail: { source:'modal' } }));
  });

  // ── Restore ──────────────────────────────────────────────────
  _on('mn-restore-btn', () => {
    document.dispatchEvent(new CustomEvent('mn:restoreAccess', { detail: { source:'modal' } }));
  });
}


// ════════════════════════════════════════════════════════════════
//  AUTH HANDLERS
// ════════════════════════════════════════════════════════════════

async function _handleLogin() {
  if (_modalLoading) return;
  const email = _val('mn-login-email');
  const pass  = _val('mn-login-password');
  const msg   = document.getElementById('mn-login-msg');
  const btn   = document.getElementById('mn-login-submit-btn');

  if (!email || !pass) { _showMsg(msg, '⚠ ' + _t('auth_error_campos','Rellena todos los campos.'), 'error'); return; }
  if (!_validEmail(email)) { _showMsg(msg, '⚠ ' + _t('auth_error_email','Email no válido.'), 'error'); return; }

  _setBtnLoading(btn, true, _t('auth_entrando','Entrando…'));
  _modalLoading = true;
  try {
    await window.MNSupabaseAuth.signIn(email, pass);
    _toast('✅ ' + _t('auth_sesion_iniciada','Sesión iniciada correctamente.'));
    closeAuthModal();
    renderAuthBadge();
    renderTrialPill();
    if (typeof updateSidebarLogo === 'function') updateSidebarLogo();
  } catch (err) {
    const code = err?.code || '';
    const map = {
      rate_limited:        _t('auth_error_rate','Demasiados intentos. Espera unos minutos.'),
      invalid_credentials: _t('auth_error_credenciales','Email o contraseña incorrectos.'),
    };
    _showMsg(msg, '⚠ ' + (map[code] || err?.message || _t('auth_error_generico','Error al iniciar sesión.')), 'error');
  } finally {
    _setBtnLoading(btn, false, _t('auth_entrar','Entrar'));
    _modalLoading = false;
  }
}

// ── Turnstile state ───────────────────────────────────────────────
let _turnstileToken = null;
let _turnstileWidgetId = null;

function _initTurnstile() {
  const container = document.getElementById('mn-turnstile-container');
  if (!container) return;
  // Only init if Turnstile SDK loaded and site key configured
  const siteKey = window._MN_TURNSTILE_SITE_KEY;
  if (!siteKey || typeof window.turnstile === 'undefined') return;
  try {
    _turnstileToken = null;
    if (_turnstileWidgetId !== null) {
      try { window.turnstile.remove(_turnstileWidgetId); } catch(_) {}
    }
    _turnstileWidgetId = window.turnstile.render(container, {
      sitekey:  siteKey,
      theme:    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
      size:     'flexible',
      callback: (token) => { _turnstileToken = token; },
      'expired-callback': () => { _turnstileToken = null; },
      'error-callback':   () => { _turnstileToken = null; },
    });
  } catch(_) {}
}

async function _handleRegister() {
  if (_modalLoading) return;
  const email = _val('mn-reg-email');
  const pass  = _val('mn-reg-password');
  const pass2 = _val('mn-reg-password2');
  const msg   = document.getElementById('mn-reg-msg');
  const btn   = document.getElementById('mn-reg-submit-btn');

  if (!email || !pass || !pass2) { _showMsg(msg, '⚠ ' + _t('auth_error_campos','Rellena todos los campos.'), 'error'); return; }
  if (!_validEmail(email)) { _showMsg(msg, '⚠ ' + _t('auth_error_email','Email no válido.'), 'error'); return; }
  if (pass.length < 8) { _showMsg(msg, '⚠ ' + _t('auth_error_pw_corta','La contraseña debe tener al menos 8 caracteres.'), 'error'); return; }
  if (pass !== pass2) { _showMsg(msg, '⚠ ' + _t('auth_error_pw_no_coincide','Las contraseñas no coinciden.'), 'error'); return; }
  // Turnstile check — only if configured (sitekey present)
  if (window._MN_TURNSTILE_SITE_KEY && !_turnstileToken) {
    _showMsg(msg, '⚠ ' + _t('auth_error_captcha', 'Completa la verificación anti-bot.'), 'error'); return;
  }

  _setBtnLoading(btn, true, _t('auth_creando','Creando cuenta…'));
  _modalLoading = true;
  try {
    const data = await window.MNSupabaseAuth.signUp(email, pass);

    _auth.upgradeTrial && _auth.upgradeTrial(email);
    if (window.MNEmail) MNEmail.sendWelcome(email, '');
    _toast('✅ ' + _t('auth_cuenta_creada','¡Cuenta creada! Bienvenido a MoneyNest.'));
    closeAuthModal();
    renderAuthBadge();
    renderTrialPill();
    document.dispatchEvent(new CustomEvent('mn:registered', { detail: { email } }));
  } catch (err) {
    const code = err?.code || '';
    if (code === 'email_exists') {
      const html = `⚠ ${_t('auth_error_email_existe','Este email ya está registrado.')} <button class="mn-link-btn mn-link-btn--accent" id="mn-switch-login-inline" style="font-size:.78rem">${_t('auth_iniciar_sesion_link','Iniciar sesión →')}</button>`;
      _showMsgHtml(msg, html, 'error');
      setTimeout(() => _on('mn-switch-login-inline', () => _switchMode('login')), 50);
    } else if (code === 'rate_limited') {
      _showMsg(msg, '⚠ ' + _t('auth_error_rate','Demasiados intentos. Espera unos minutos.'), 'error');
    } else {
      _showMsg(msg, '⚠ ' + (err?.message || _t('auth_error_generico','Error al crear cuenta.')), 'error');
    }
  } finally {
    _setBtnLoading(btn, false, _t('auth_crear_y_empezar','Crear cuenta y empezar →'));
    _modalLoading = false;
  }
}

async function _handleForgot() {
  if (_modalLoading) return;
  const email = _val('mn-forgot-email');
  const msg   = document.getElementById('mn-forgot-msg');
  const btn   = document.getElementById('mn-forgot-submit-btn');

  if (!_validEmail(email)) { _showMsg(msg, '⚠ ' + _t('auth_error_email','Email no válido.'), 'error'); return; }

  _setBtnLoading(btn, true, _t('auth_enviando','Enviando…'));
  _modalLoading = true;
  try {
    await window.MNSupabaseAuth.resetPassword(email);
    _showMsg(msg, '✅ ' + _t('auth_enlace_enviado','Enlace enviado. Revisa tu email.'), 'ok');
  } catch (err) {
    const code = err?.code || '';
    _showMsg(msg, '⚠ ' + (code === 'rate_limited'
      ? _t('auth_error_rate_reset','Demasiadas solicitudes. Espera 1 hora.')
      : (err?.message || _t('auth_error_generico','Error al enviar.'))), 'error');
  } finally {
    _setBtnLoading(btn, false, _t('auth_enviar_enlace','Enviar enlace de reseteo'));
    _modalLoading = false;
  }
}

async function _handleUpdatePassword() {
  if (_modalLoading) return;
  const pass  = _val('mn-newpw-password');
  const pass2 = _val('mn-newpw-password2');
  const msg   = document.getElementById('mn-newpw-msg');
  const btn   = document.getElementById('mn-newpw-submit-btn');

  if (pass.length < 8) { _showMsg(msg, '⚠ ' + _t('auth_error_pw_corta','Mínimo 8 caracteres.'), 'error'); return; }
  if (pass !== pass2)  { _showMsg(msg, '⚠ ' + _t('auth_error_pw_no_coincide','Las contraseñas no coinciden.'), 'error'); return; }

  _setBtnLoading(btn, true, _t('auth_guardando','Guardando…'));
  _modalLoading = true;
  try {
    await window.MNSupabaseAuth.updatePassword(pass);
    _toast('✅ ' + _t('auth_pw_actualizada','Contraseña actualizada correctamente.'));
    closeAuthModal();
    _switchMode('plan');
  } catch (err) {
    _showMsg(msg, '⚠ ' + (err?.message || _t('auth_error_generico','Error al actualizar.')), 'error');
  } finally {
    _setBtnLoading(btn, false, _t('auth_guardar_contrasena','Guardar contraseña'));
    _modalLoading = false;
  }
}

async function _handleLogout() {
  if (window.MNSupabaseAuth) await window.MNSupabaseAuth.signOut();
  closeAuthModal();
  renderAuthBadge();
  renderTrialPill();
  if (typeof updateSidebarLogo === 'function') updateSidebarLogo();
  _toast(_t('auth_sesion_cerrada','Sesión cerrada.'));
}


// ════════════════════════════════════════════════════════════════
//  SHARED UI HELPERS
// ════════════════════════════════════════════════════════════════

function _closeBtn() {
  return `<button class="mn-auth-close-btn" onclick="MNAuthUI.closeAuthModal()" aria-label="Cerrar">✕</button>`;
}

function _planHeader(title, color) {
  return `
    <div class="mn-auth-modal-header">
      <div class="mn-auth-eyebrow">${_t('auth_tu_plan','Tu plan actual')}</div>
      <div class="mn-auth-headline" style="color:${color}">${title}</div>
    </div>`;
}

function _field(type, id, label, autocomplete, placeholder, inputMode) {
  return `
    <div class="mn-auth-field-wrap">
      <label class="mn-auth-field-label">${label}</label>
      <input class="mn-auth-input" type="${type}" id="${id}"
        placeholder="${placeholder}" autocomplete="${autocomplete || 'off'}"
        ${inputMode ? `inputmode="${inputMode}"` : ''}>
    </div>`;
}

function _fieldPassword(id, label, autocomplete) {
  return `
    <div class="mn-auth-field-wrap">
      <label class="mn-auth-field-label">${label}</label>
      <div style="position:relative">
        <input class="mn-auth-input" type="password" id="${id}"
          placeholder="••••••••" autocomplete="${autocomplete || 'current-password'}"
          style="padding-right:42px">
        <button class="mn-pw-toggle-btn" type="button"
          onclick="_mnTogglePw('${id}',this)" tabindex="-1" aria-label="Mostrar contraseña">👁</button>
      </div>
    </div>`;
}

function _fieldPasswordStrength(id, label, autocomplete) {
  return `
    <div class="mn-auth-field-wrap">
      <label class="mn-auth-field-label">${label}</label>
      <div style="position:relative">
        <input class="mn-auth-input" type="password" id="${id}"
          placeholder="••••••••" autocomplete="${autocomplete || 'new-password'}"
          style="padding-right:42px"
          oninput="_mnCheckPwStrength(this.value,'${id}-strength')">
        <button class="mn-pw-toggle-btn" type="button"
          onclick="_mnTogglePw('${id}',this)" tabindex="-1" aria-label="Mostrar contraseña">👁</button>
      </div>
      <div class="mn-pw-strength-bar" id="${id}-strength" style="display:none">
        <div class="mn-pw-bar-track"><div class="mn-pw-bar-fill" id="${id}-strength-fill"></div></div>
        <span class="mn-pw-bar-label" id="${id}-strength-label"></span>
      </div>
    </div>`;
}

function _modalFooter(user) {
  const id = _escHtml((user.id || '').slice(0, 14));
  return `<div class="mn-auth-footer">ID: <code>${id}…</code>${user.email ? ` · ${_escHtml(user.email)}` : ''}</div>`;
}

function _switchMode(mode) {
  _modalMode = mode;
  const card = document.getElementById('authModalCard');
  if (!card) return;
  card.innerHTML = _buildContent(_auth.getUser());
  _attachListeners(_auth.getUser());
}


// ════════════════════════════════════════════════════════════════
//  DOM HELPERS
// ════════════════════════════════════════════════════════════════

function _on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function _onKey(id, key, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', (e) => { if (e.key === key) fn(); });
}

function _val(id) {
  return (document.getElementById(id)?.value || '').trim();
}

function _validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function _showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  el.style.color = type === 'error' ? C.red : C.accent;
}

function _showMsgHtml(el, html, type) {
  if (!el) return;
  el.innerHTML = html;
  el.style.display = 'block';
  el.style.color = type === 'error' ? C.red : C.accent;
}

function _setBtnLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? text : text;
  btn.style.opacity = loading ? '0.7' : '1';
}

function _toast(msg) {
  if (typeof window.toast === 'function') { window.toast(msg); return; }
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111827;color:#E8EFF7;padding:12px 20px;border-radius:12px;font-size:.85rem;font-weight:600;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);pointer-events:none';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function _planBadgeConfig(user) {
  const hoursLeft  = _auth.trialHoursLeft ? _auth.trialHoursLeft() : 0;
  const isLoggedIn = window.MNSupabaseAuth?.isLoggedIn() ?? false;
  const suffix     = isLoggedIn ? '' : ' · ' + _t('auth_sin_sesion', 'sin sesión');
  const configs = {
    trial:        { icon:'⏳', label:`Trial · ${Math.ceil(hoursLeft)}h${suffix}`, color:C.indigo,  bg:'rgba(99,102,241,.1)',  border:'rgba(99,102,241,.25)' },
    locked_local: { icon:'🔒', label:_t('auth_bloqueado','Bloqueado'),             color:C.red,     bg:'rgba(244,63,94,.1)',   border:'rgba(244,63,94,.25)'  },
    local:        { icon:'💾', label:_t('auth_plan_local_badge','Local'),           color:C.accent,  bg:'rgba(0,212,170,.1)',   border:'rgba(0,212,170,.25)'  },
    pro:          { icon:'⚡', label:_t('auth_plan_pro_badge', 'Pro'),              color:C.accent,  bg:'rgba(0,212,170,.12)',  border:'rgba(0,212,170,.3)'   },
  };
  return configs[user.plan] || configs.trial;
}


// ════════════════════════════════════════════════════════════════
//  INJECT MODAL SHELL + STYLES
// ════════════════════════════════════════════════════════════════

function _injectModalShell() {
  const overlay = document.createElement('div');
  overlay.id = 'authModal';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9900',
    'display:none', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,.65)', 'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
  ].join(';');
  overlay.innerHTML = `
    <div id="authModalCard" style="
      background:var(--card,#111827);
      border:1px solid var(--border2,rgba(255,255,255,.08));
      border-radius:24px;
      width:min(460px,calc(100vw - 32px));
      max-height:calc(100dvh - 48px);
      overflow-y:auto;
      padding:32px 28px 24px;
      box-shadow:0 40px 100px rgba(0,0,0,.65);
      animation:mnCardIn .4s cubic-bezier(0.22,1,0.36,1) forwards;
      position:relative;
      scrollbar-width:thin;
    "></div>`;
  document.body.appendChild(overlay);
}

function _injectGlobalStyles() {
  if (document.getElementById('mn-auth-ui-styles')) return;
  const style = document.createElement('style');
  style.id = 'mn-auth-ui-styles';
  style.textContent = `
    @keyframes mnCardIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:none} }

    /* ── Layout ────────────────────────────────────────────────── */
    .mn-auth-modal-header { margin-bottom:20px; position:relative; }
    .mn-auth-eyebrow      { font-size:.68rem;font-weight:700;color:var(--text3,#94A3B8);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px; }
    .mn-auth-headline     { font-size:1.3rem;font-weight:800;letter-spacing:-.03em;line-height:1.2; }
    .mn-auth-section      { margin-bottom:16px; }
    .mn-auth-divider      { border:none;border-top:1px solid var(--border2,rgba(255,255,255,.08));margin:18px 0; }
    .mn-auth-form-col     { display:flex;flex-direction:column;gap:12px; }
    .mn-auth-field-wrap   { display:flex;flex-direction:column;gap:5px; }
    .mn-auth-field-label  { font-size:.72rem;font-weight:700;color:var(--text2,#94A3B8);text-transform:uppercase;letter-spacing:.06em; }
    .mn-auth-msg          { font-size:.78rem;margin-top:2px;line-height:1.5; }

    /* ── Close button ──────────────────────────────────────────── */
    .mn-auth-close-btn {
      position:absolute;top:0;right:0;
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);
      color:#64748B;font-size:.75rem;width:28px;height:28px;
      border-radius:50%;cursor:pointer;display:flex;align-items:center;
      justify-content:center;transition:all .15s;font-family:inherit;
      z-index:1;
    }
    .mn-auth-close-btn:hover { background:rgba(255,255,255,.1);color:#E8EFF7; }

    /* ── Or divider ────────────────────────────────────────────── */
    .mn-auth-or {
      display:flex;align-items:center;gap:10px;
      margin:14px 0;font-size:.7rem;color:var(--text3,#64748B);font-weight:600;
    }
    .mn-auth-or::before,.mn-auth-or::after {
      content:'';flex:1;height:1px;background:var(--border2,rgba(255,255,255,.08));
    }

    /* ── Trial note ────────────────────────────────────────────── */
    .mn-auth-trial-note {
      background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.18);
      border-radius:12px;padding:11px 14px;font-size:.8rem;
      color:var(--text2,#94A3B8);line-height:1.6;margin-bottom:14px;
    }

    /* ── Session chip ──────────────────────────────────────────── */
    .mn-auth-session-chip {
      text-align:center;font-size:.75rem;color:var(--text2,#94A3B8);
      margin-bottom:12px;padding:7px 12px;
      background:rgba(0,212,170,.06);border:1px solid rgba(0,212,170,.12);
      border-radius:10px;
    }
    .mn-auth-session-chip strong { color:var(--text,#E8EFF7); }

    /* ── Trial box ─────────────────────────────────────────────── */
    .mn-auth-trial-box {
      background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);
      border-radius:16px;padding:20px;text-align:center;margin-bottom:18px;
    }
    .mn-auth-trial-time  { font-size:2.4rem;font-weight:800;color:#6366F1;letter-spacing:-.06em;line-height:1; }
    .mn-auth-trial-label { font-size:.75rem;color:var(--text2,#94A3B8);margin:4px 0 12px; }
    .mn-auth-progress-track { height:6px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden; }
    .mn-auth-progress-bar   { height:100%;border-radius:99px;transition:width .6s; }

    /* ── CTA box ───────────────────────────────────────────────── */
    .mn-auth-cta-box {
      background:rgba(0,212,170,.06);border:1px solid rgba(0,212,170,.15);
      border-radius:16px;padding:18px;margin-bottom:4px;
    }
    .mn-auth-cta-label { font-size:.75rem;font-weight:700;color:${C.accent};margin-bottom:6px; }
    .mn-auth-cta-desc  { font-size:.78rem;color:var(--text2,#94A3B8);line-height:1.55; }

    /* ── Alert box ─────────────────────────────────────────────── */
    .mn-auth-alert-box {
      display:flex;align-items:center;gap:14px;
      background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.2);
      border-radius:14px;padding:16px;margin-bottom:18px;
    }
    .mn-auth-alert-icon { font-size:2rem;flex-shrink:0; }
    .mn-auth-alert-text { font-size:.82rem;color:var(--text,#E8EFF7);line-height:1.6; }

    /* ── Price card ────────────────────────────────────────────── */
    .mn-auth-price-card {
      background:linear-gradient(135deg,rgba(0,212,170,.1),rgba(0,212,170,.04));
      border:1px solid rgba(0,212,170,.25);border-radius:16px;padding:20px;margin-bottom:18px;
    }
    .mn-auth-price-label  { font-size:.68rem;font-weight:700;color:${C.accent};text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px; }
    .mn-auth-price-amount { font-size:2rem;font-weight:800;color:var(--text,#E8EFF7);letter-spacing:-.05em;line-height:1;margin-bottom:10px; }
    .mn-auth-price-amount span { font-size:.9rem;font-weight:600;color:var(--text2,#94A3B8); }
    .mn-auth-price-features { display:flex;flex-direction:column;gap:6px; }
    .mn-auth-pf { font-size:.78rem;color:var(--text2,#94A3B8); }

    /* ── Status boxes ──────────────────────────────────────────── */
    .mn-auth-status-box { display:flex;align-items:center;gap:14px;border-radius:14px;padding:16px;margin-bottom:18px; }
    .mn-status-ok  { background:rgba(0,212,170,.08);border:1px solid rgba(0,212,170,.2); }
    .mn-status-pro { background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3); }
    .mn-status-icon  { font-size:1.8rem;flex-shrink:0; }
    .mn-status-title { font-size:.95rem;font-weight:700;color:var(--text,#E8EFF7); }
    .mn-status-desc  { font-size:.78rem;color:var(--text2,#94A3B8);margin-top:2px; }

    /* ── Upgrade box ───────────────────────────────────────────── */
    .mn-auth-upgrade-box {
      background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.03));
      border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:20px;
    }
    .mn-auth-upgrade-header   { display:flex;align-items:center;gap:12px;margin-bottom:14px;font-size:1.5rem; }
    .mn-auth-upgrade-title    { font-size:.9rem;font-weight:700;color:var(--text,#E8EFF7); }
    .mn-auth-upgrade-subtitle { font-size:.75rem;color:${C.indigo};font-weight:600; }
    .mn-auth-upgrade-features { display:flex;flex-direction:column;gap:6px;margin-bottom:16px; }
    .mn-auth-uf     { font-size:.78rem;color:var(--text2,#94A3B8); }
    .mn-auth-pro-note { font-size:.7rem;color:var(--text2,#94A3B8);text-align:center;margin-top:8px; }

    /* ── Features grid ─────────────────────────────────────────── */
    .mn-auth-features-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px; }
    .mn-auth-fg {
      background:rgba(0,212,170,.06);border:1px solid rgba(0,212,170,.12);
      border-radius:10px;padding:10px 12px;font-size:.78rem;
      color:var(--text,#E8EFF7);font-weight:600;
    }

    /* ── Trial reminder ────────────────────────────────────────── */
    .mn-auth-trial-reminder {
      background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);
      border-radius:12px;padding:14px;font-size:.78rem;color:var(--text2,#94A3B8);
      line-height:1.5;margin-bottom:16px;text-align:center;
    }

    /* ── Cancel ────────────────────────────────────────────────── */
    .mn-btn-danger { color:${C.red}!important;border-color:rgba(244,63,94,.25)!important; }
    .mn-btn-danger:hover { border-color:${C.red}!important;background:rgba(244,63,94,.08)!important; }
    .mn-auth-cancel-note { font-size:.7rem;color:var(--text2,#94A3B8);text-align:center;margin-top:6px; }

    /* ── Footer ────────────────────────────────────────────────── */
    .mn-auth-footer { font-size:.65rem;color:var(--text3,#64748B);text-align:center;margin-top:18px;line-height:1.5;opacity:.7; }
    .mn-auth-footer code { font-size:.62rem; }

    /* ── Input ─────────────────────────────────────────────────── */
    .mn-auth-input {
      width:100%;padding:11px 14px;border-radius:10px;
      border:1.5px solid var(--border2,rgba(255,255,255,.1));
      background:var(--input-bg,rgba(255,255,255,.05));
      color:var(--text,#E8EFF7);font-family:inherit;font-size:.88rem;
      outline:none;transition:border-color .18s;box-sizing:border-box;
    }
    .mn-auth-input:focus { border-color:${C.accent}; }

    /* ── Password toggle ───────────────────────────────────────── */
    .mn-pw-toggle-btn {
      position:absolute;right:10px;top:50%;transform:translateY(-50%);
      background:none;border:none;cursor:pointer;font-size:.9rem;
      color:var(--text2,#94A3B8);padding:2px;line-height:1;
    }

    /* ── Password strength ─────────────────────────────────────── */
    .mn-pw-strength-bar { display:flex;align-items:center;gap:8px;margin-top:4px; }
    .mn-pw-bar-track { flex:1;height:4px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden; }
    .mn-pw-bar-fill  { height:100%;border-radius:99px;transition:width .3s,background .3s;width:0; }
    .mn-pw-bar-label { font-size:.68rem;font-weight:700;min-width:56px;text-align:right; }

    /* ── Link buttons ──────────────────────────────────────────── */
    .mn-link-btn { background:none;border:none;cursor:pointer;font-size:.8rem;color:var(--text2,#94A3B8);font-family:inherit;padding:2px;transition:color .15s; }
    .mn-link-btn:hover { color:var(--text,#E8EFF7); }
    .mn-link-btn--accent { color:${C.accent}; }
    .mn-link-btn--accent:hover { color:${C.accentDark}; }

    /* ── Buttons ───────────────────────────────────────────────── */
    .mn-btn-primary, .mn-btn-pro, .mn-btn-secondary, .mn-btn-ghost {
      padding:13px 20px;border-radius:13px;border:none;
      font-size:.88rem;font-weight:800;cursor:pointer;
      font-family:inherit;letter-spacing:-.01em;
      transition:transform .18s,box-shadow .18s,opacity .18s;
    }
    .mn-btn-full  { width:100%;display:block;text-align:center; }
    .mn-btn-large { padding:16px!important;font-size:1rem!important; }
    .mn-btn-sm    { padding:9px 14px!important;font-size:.8rem!important;width:auto!important; }

    .mn-btn-primary {
      background:linear-gradient(135deg,${C.accent},${C.accentDark});
      color:#0A0E17;box-shadow:0 6px 20px rgba(0,212,170,.3);
    }
    .mn-btn-primary:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,212,170,.4); }
    .mn-btn-primary:disabled { opacity:.6;cursor:default;transform:none; }

    .mn-btn-pro {
      background:linear-gradient(135deg,${C.indigo},${C.indigoDark});
      color:#fff;box-shadow:0 6px 20px rgba(99,102,241,.3);
    }
    .mn-btn-pro:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 10px 30px rgba(99,102,241,.4); }

    .mn-btn-secondary {
      background:rgba(255,255,255,.06);
      border:1.5px solid var(--border2,rgba(255,255,255,.1))!important;
      color:var(--text,#E8EFF7);
    }
    .mn-btn-secondary:hover { border-color:${C.accent}!important;color:${C.accent}; }

    .mn-btn-ghost {
      background:transparent;
      border:1.5px solid var(--border2,rgba(255,255,255,.1))!important;
      color:var(--text2,#94A3B8);
    }
    .mn-btn-ghost:hover { border-color:${C.accent}!important;color:${C.accent}; }

    /* ── Light mode overrides ──────────────────────────────────── */
    [data-theme="light"] .mn-auth-input {
      background:rgba(0,0,0,.04);
      border-color:rgba(0,0,0,.12);
      color:#0F172A;
    }
    [data-theme="light"] .mn-auth-input:focus { border-color:${C.accent}; }
    [data-theme="light"] .mn-auth-trial-box { background:rgba(99,102,241,.06); border-color:rgba(99,102,241,.18); }
    [data-theme="light"] .mn-auth-cta-box { background:rgba(0,212,170,.04); border-color:rgba(0,212,170,.2); }
    [data-theme="light"] .mn-auth-alert-box { background:rgba(244,63,94,.05); }
    [data-theme="light"] .mn-auth-price-card { background:linear-gradient(135deg,rgba(0,212,170,.07),rgba(0,212,170,.02)); }
    [data-theme="light"] .mn-auth-status-box.mn-status-ok { background:rgba(0,212,170,.05); }
    [data-theme="light"] .mn-auth-status-box.mn-status-pro { background:rgba(0,212,170,.07); }
    [data-theme="light"] .mn-auth-upgrade-box { background:linear-gradient(135deg,rgba(99,102,241,.05),rgba(99,102,241,.02)); }
    [data-theme="light"] .mn-auth-session-chip { background:rgba(0,212,170,.04); }
    [data-theme="light"] .mn-auth-trial-reminder { background:rgba(245,158,11,.05); }
    [data-theme="light"] .mn-btn-secondary { background:rgba(0,0,0,.03); border-color:rgba(0,0,0,.1)!important; color:#0F172A; }
    [data-theme="light"] .mn-btn-ghost { border-color:rgba(0,0,0,.12)!important; color:#475569; }
    [data-theme="light"] .mn-auth-close-btn { background:rgba(0,0,0,.05); border-color:rgba(0,0,0,.08); color:#64748B; }
    [data-theme="light"] .mn-auth-close-btn:hover { background:rgba(0,0,0,.1); color:#0F172A; }
    [data-theme="light"] .mn-auth-fg { background:rgba(0,212,170,.04); border-color:rgba(0,212,170,.1); color:#0F172A; }
    [data-theme="light"] .mn-auth-divider { border-color:rgba(0,0,0,.08); }
    [data-theme="light"] .mn-auth-trial-note { background:rgba(99,102,241,.04); border-color:rgba(99,102,241,.12); }
    [data-theme="light"] .mn-pw-bar-track { background:rgba(0,0,0,.06); }
  `;
  document.head.appendChild(style);
}


// ════════════════════════════════════════════════════════════════
//  GLOBAL HELPERS (called from inline HTML attrs)
// ════════════════════════════════════════════════════════════════

window._mnTogglePw = function(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = inp.type === 'password' ? '👁' : '🙈';
};

window._mnCheckPwStrength = function(pw, barId) {
  const wrapId  = barId;
  const fillId  = barId + '-fill';
  const labelId = barId + '-label';
  const wrap    = document.getElementById(wrapId);
  const fill    = document.getElementById(fillId);
  const label   = document.getElementById(labelId);
  if (!wrap || !fill || !label) return;
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const _tw = (k, fb) => (typeof window.t === 'function' ? window.t(k) || fb : fb);
  const levels = [
    { pct:'25%',  color:'#F43F5E', text: _tw('auth_pw_muy_debil',  'Muy débil') },
    { pct:'50%',  color:'#F59E0B', text: _tw('auth_pw_debil',      'Débil')     },
    { pct:'75%',  color:'#6366F1', text: _tw('auth_pw_buena',      'Buena')     },
    { pct:'100%', color:'#00D4AA', text: _tw('auth_pw_fuerte',     'Fuerte ✓')  },
  ];
  const lv = levels[Math.max(0, score - 1)];
  fill.style.width      = lv.pct;
  fill.style.background = lv.color;
  label.textContent     = lv.text;
  label.style.color     = lv.color;
};


// ════════════════════════════════════════════════════════════════
//  EXPORT
// ════════════════════════════════════════════════════════════════

window.MNAuthUI = {
  initAuthUI,
  showAuthModal,
  closeAuthModal,
  renderAuthBadge,
  renderTrialPill,
  renderTrialBanner,
};

window._showAuthModal = showAuthModal;
