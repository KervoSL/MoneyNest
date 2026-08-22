// ─── CONSTANTS ────────────────────────────────────────────────
const VERSION = '1.2'

// ─── LOGO SVGs ────────────────────────────────────────────────
const LOGO_DARK = `<svg viewBox='0 0 200 44' xmlns='http://www.w3.org/2000/svg' style='width:160px;height:44px;flex-shrink:0'>
  <defs>
    <linearGradient id='mnSbGradD' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#00D4AA'/>
      <stop offset='100%' stop-color='#00A882'/>
    </linearGradient>
  </defs>
  <path d='M8 30 Q22 36 36 30' stroke='rgba(255,255,255,0.8)' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M11 26 Q22 31 33 26' stroke='rgba(255,255,255,0.5)' stroke-width='2' fill='none' stroke-linecap='round'/>
  <polyline points='10,26 17,18 24,22 34,10' stroke='url(#mnSbGradD)' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <polyline points='29,9 34,10 33,15' stroke='url(#mnSbGradD)' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <text x='46' y='28' font-family='Inter,system-ui,sans-serif' font-size='20' font-weight='800' letter-spacing='-0.5' fill='white'>Money<tspan fill='#00D4AA'>Nest</tspan></text>
</svg>`

const LOGO_LIGHT = `<svg viewBox='0 0 200 44' xmlns='http://www.w3.org/2000/svg' style='width:160px;height:44px;flex-shrink:0'>
  <defs>
    <linearGradient id='mnSbGradL' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#009E82'/>
      <stop offset='100%' stop-color='#007A66'/>
    </linearGradient>
  </defs>
  <path d='M8 30 Q22 36 36 30' stroke='#0F172A' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M11 26 Q22 31 33 26' stroke='#334155' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.6'/>
  <polyline points='10,26 17,18 24,22 34,10' stroke='url(#mnSbGradL)' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <polyline points='29,9 34,10 33,15' stroke='url(#mnSbGradL)' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <text x='46' y='28' font-family='Inter,system-ui,sans-serif' font-size='20' font-weight='800' letter-spacing='-0.5' fill='#0F172A'>Money<tspan fill='#009E82'>Nest</tspan></text>
</svg>`

function getCurrentLogo() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? LOGO_LIGHT : LOGO_DARK
}

function updateSidebarLogo() {
  const el = document.getElementById('sidebarLogoImg')
  if (!el) return
  // Solo el SVG del logo — sin badge (el plan se ve en Facturación)
  el.innerHTML = `<span style="display:inline-block;line-height:0;flex-shrink:0">${getCurrentLogo()}</span>`
}


const SK = 'mn7_data'

// ════════════════════════════════════════════════════════════════
// ─── SISTEMA DE USUARIO — guest / trial / pro ────────────────
//  Inline version of /js/auth.js (kept in sync with that file)
// ════════════════════════════════════════════════════════════════
const USER_KEY  = 'mn_user'
const TRIAL_DAYS = 1 // 24 horas (v2 — ver js/auth.js)

const PLANS = Object.freeze({ GUEST:'trial', TRIAL:'trial', LOCKED_LOCAL:'locked_local', LOCAL:'local' })
window.PLANS = PLANS

const DEFAULT_USER = Object.freeze({
  id:           null,
  email:        null,
  plan:         'trial',
  trialEndsAt:  null,
  cloudEnabled: false,
  createdAt:    null,
  upgradedAt:   null,
})

function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return { ...DEFAULT_USER }
    return { ...DEFAULT_USER, ...JSON.parse(raw) }
  } catch { return { ...DEFAULT_USER } }
}

function saveUser(user) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch(e) {}
  return user
}

function patchUser(patch) {
  return saveUser({ ...getUser(), ...patch })
}

function _generateUserId() {
  try { return crypto.randomUUID() } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }
}

function initUser() {
  let user = getUser()
  if (!user.id) {
    user = { ...DEFAULT_USER, id: _generateUserId(), plan: 'trial', trialEndsAt: Date.now() + TRIAL_DAYS * 86400000, createdAt: Date.now() }
    saveUser(user)
  } else if (!user.createdAt) {
    saveUser({ ...user, createdAt: Date.now() })
  }
  return user
}

function checkAccess() {
  const user = getUser()
  if (user.plan === 'locked_local') {
    bloquearApp(user)
    return { ok: false, reason: 'locked_local' }
  }
  if (user.plan === 'trial') {
    if (user.trialEndsAt && Date.now() > user.trialEndsAt) {
      patchUser({ plan: 'locked_local' })
      bloquearApp(user)
      return { ok: false, reason: 'trial_expired' }
    }
    return { ok: true, reason: null }
  }
  return { ok: true, reason: null }
}

function upgradeTrial(email) {
  const trialEndsAt = Date.now() + TRIAL_DAYS * 86400000
  return patchUser({ plan:'trial', trialEndsAt, upgradedAt: Date.now(), ...(email ? { email } : {}) })
}


function downgradeGuest() {
  return patchUser({ plan:'local', trialEndsAt: null, cloudEnabled: false, upgradedAt: Date.now() })
}
// v2 aliases
function buyLocal(email)    { return patchUser({ plan:'local', trialEndsAt:null, cloudEnabled:false, upgradedAt:Date.now(), ...(email?{email}:{}) }) }
function trialMsLeft()      { const u=getUser(); if(u.plan!=='trial'||!u.trialEndsAt) return 0; return Math.max(0,u.trialEndsAt-Date.now()) }
function isLocked()         { return getUser().plan === 'locked_local' }
function isLocal()          { return getUser().plan === 'local' }

function trialDaysLeft() {
  const user = getUser()
  if (user.plan !== 'trial' || !user.trialEndsAt) return 0
  return Math.max(0, Math.ceil((user.trialEndsAt - Date.now()) / 86400000))
}

function isTrialExpired() {
  const user = getUser()
  return user.plan === 'trial' && !!user.trialEndsAt && Date.now() > user.trialEndsAt
}

function isGuest() { return getUser().plan === 'locked_local'; }

function bloquearApp(user) {
  document.body.innerHTML = `
    <div style="position:fixed;inset:0;z-index:99999;background:#0A0E17;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif;overflow-y:auto">
      <div style="position:relative;width:min(720px,100%);margin:auto 0;padding:8px 0">
        <div style="text-align:center;margin-bottom:28px">
          <span style="display:inline-block;padding:5px 14px;border-radius:99px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);color:#A5B4FC;font-size:.7rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:18px">⏳ Prueba gratuita finalizada</span>
          <div style="font-size:1.7rem;font-weight:900;color:#fff;margin-bottom:10px;letter-spacing:-.02em">Elige tu plan de MoneyNest</div>
          <div style="font-size:.9rem;color:rgba(255,255,255,0.55);line-height:1.6">
            Tu período de prueba gratuita de 24h ha concluido.<br>Tus datos siguen intactos — elige un plan para seguir usando MoneyNest.
          </div>
        </div>

        <div class="mn-lock-plans-grid" id="mn-lock-plans-grid">
          <div style="background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0));border:1.5px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px 22px;display:flex;flex-direction:column">
            <div style="font-size:.95rem;font-weight:800;color:#fff;margin-bottom:2px">MoneyNest Local</div>
            <div style="font-size:1.9rem;font-weight:900;color:#00D4AA;margin:6px 0 2px">6,99 €</div>
            <div style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:16px">Pago único</div>
            <ul style="list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:8px;flex:1">
              ${['Acceso ilimitado','Datos locales','Sin suscripción','Sin Cloud','Sin sincronización'].map(f => `<li style="font-size:.8rem;color:rgba(255,255,255,.75)"><span style="color:#00D4AA">✓</span> ${f}</li>`).join('')}
            </ul>
            <button class="mn-lock-plan-btn" data-plan="local" style="width:100%;padding:14px;border-radius:12px;border:1.5px solid rgba(0,212,170,.4);background:rgba(0,212,170,.08);color:#00D4AA;font-size:.88rem;font-weight:800;cursor:pointer;font-family:inherit">Comprar Local — 6,99 €</button>
          </div>

          <div style="background:linear-gradient(160deg,rgba(236,72,153,.1),rgba(255,255,255,0) 60%);border:1.5px solid rgba(236,72,153,.4);border-radius:20px;padding:24px 22px;display:flex;flex-direction:column;position:relative">
            <span style="position:absolute;top:-10px;right:16px;background:#EC4899;color:#fff;font-size:.62rem;font-weight:800;padding:3px 10px;border-radius:99px">☁️ CLOUD</span>
            <div style="font-size:.95rem;font-weight:800;color:#fff;margin-bottom:2px">MoneyNest Pro</div>
            <div style="font-size:1.9rem;font-weight:900;color:#EC4899;margin:6px 0 2px">14,99 €</div>
            <div style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:16px">al año</div>
            <ul style="list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:8px;flex:1">
              ${['Todo lo de Local','Cloud','Sincronización','Backup automático','Restauración','Varios dispositivos'].map(f => `<li style="font-size:.8rem;color:rgba(255,255,255,.75)"><span style="color:#EC4899">✓</span> ${f}</li>`).join('')}
            </ul>
            <button class="mn-lock-plan-btn" data-plan="pro" style="width:100%;padding:14px;border-radius:12px;border:none;background:#EC4899;color:#fff;font-size:.88rem;font-weight:800;cursor:pointer;font-family:inherit">Elegir Pro — 14,99 €/año</button>
          </div>
        </div>

        <div id="mn-lock-error" style="display:none;margin-bottom:12px;padding:12px 14px;border-radius:12px;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);color:#FCA5A5;font-size:.8rem;font-weight:600;line-height:1.5;text-align:center"></div>
        <div style="text-align:center;font-size:.78rem;color:rgba(255,255,255,0.4)">
          ¿Ya tienes licencia? <a id="mn-lock-restore-link" href="#" style="color:#00D4AA;font-weight:700;text-decoration:none">Restaurar acceso</a>
        </div>
      </div>
    </div>`

  const lockErrorEl = document.getElementById('mn-lock-error')
  const _showLockError = (msg) => {
    if (!lockErrorEl) return
    lockErrorEl.textContent = msg
    lockErrorEl.style.display = 'block'
  }
  const _hideLockError = () => { if (lockErrorEl) lockErrorEl.style.display = 'none' }

  // Both plan buttons go straight to the REAL Stripe Checkout flow
  // (MNAuthUI._doConfirmPlan) — never grant Local/Pro directly here.
  document.querySelectorAll('.mn-lock-plan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _hideLockError()
      const plan = btn.dataset.plan
      if (window.MNAuthUI && window.MNAuthUI._doConfirmPlan) {
        MNAuthUI._doConfirmPlan(plan)
        return
      }
      // Fallback to the mock plan modal, then the legacy Stripe flow,
      // only if the primary path somehow isn't loaded.
      if (window.MNAuthUI) { MNAuthUI.openPlanModal('trial_expired_lock'); return }
      const priceId = window.MNStripeConfig?.prices?.[plan]
      if (!window.MNPayment || !priceId) {
        console.error('[bloquearApp] No se pudo iniciar el checkout', { hasMNPayment: !!window.MNPayment, priceId })
        _showLockError('No se pudo iniciar el pago. Recarga la página e inténtalo de nuevo.')
        return
      }
      try { MNPayment.open(priceId, user?.email || '') } catch (err) {
        console.error('[bloquearApp] Error al abrir el checkout:', err)
        _showLockError('No se pudo iniciar el pago. Inténtalo de nuevo.')
      }
    })
  })

  // Reload once a plan is confirmed (mock or real) so the app leaves
  // the lock screen and reflects the newly unlocked state.
  document.addEventListener('mn:billing:activated', () => location.reload())
  document.addEventListener('mn:paymentSuccess', () => location.reload())

  // ── "Restaurar acceso" — modal propio de MoneyNest (sin prompt/alert nativos) ──
  const restoreLink = document.getElementById('mn-lock-restore-link')
  if (restoreLink) restoreLink.addEventListener('click', (e) => {
    e.preventDefault()
    _openRestoreAccessModal(user)
  })
}

function _openRestoreAccessModal(user) {
  document.getElementById('mn-restore-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'mn-restore-overlay'
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;
    padding:20px;padding-bottom:max(20px, env(safe-area-inset-bottom, 0px));
    background:rgba(6,11,20,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    animation:mnFadeIn .18s ease;font-family:'Inter',sans-serif;
  `
  overlay.innerHTML = `
    <div id="mn-restore-modal" style="position:relative;width:min(400px,100%);background:#0D1424;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:26px 24px;box-shadow:0 32px 80px rgba(0,0,0,.6)">
      <button id="mn-restore-close" aria-label="Cerrar" style="position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:9px;border:none;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
      <div style="font-size:1.15rem;font-weight:900;color:#fff;margin-bottom:8px">Restaurar acceso</div>
      <div style="font-size:.85rem;color:rgba(255,255,255,0.55);line-height:1.5;margin-bottom:18px">Introduce el email con el que compraste MoneyNest.</div>
      <label style="display:block;font-size:.72rem;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Email</label>
      <input id="mn-restore-email" type="email" inputmode="email" autocomplete="email" placeholder="tu@email.com" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:.9rem;font-family:inherit;box-sizing:border-box;margin-bottom:6px">
      <div id="mn-restore-msg" style="display:none;margin-top:8px;padding:10px 12px;border-radius:10px;font-size:.8rem;font-weight:600;line-height:1.5"></div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button id="mn-restore-cancel" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.7);font-size:.85rem;font-weight:700;cursor:pointer;font-family:inherit">Cancelar</button>
        <button id="mn-restore-submit" disabled style="flex:1.4;padding:12px;border-radius:12px;border:none;background:#00D4AA;color:#042b20;font-size:.85rem;font-weight:800;cursor:pointer;font-family:inherit;opacity:.5">Restaurar acceso</button>
      </div>
    </div>`
  document.body.appendChild(overlay)

  const emailInput  = overlay.querySelector('#mn-restore-email')
  const submitBtn   = overlay.querySelector('#mn-restore-submit')
  const cancelBtn   = overlay.querySelector('#mn-restore-cancel')
  const closeBtn    = overlay.querySelector('#mn-restore-close')
  const msgEl       = overlay.querySelector('#mn-restore-msg')
  const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  let submitting    = false

  const _closeRestoreModal = () => { if (!submitting) overlay.remove() }
  const _setMsg = (text, kind) => {
    if (!text) { msgEl.style.display = 'none'; return }
    msgEl.style.display = 'block'
    msgEl.textContent = text
    if (kind === 'error') { msgEl.style.background = 'rgba(244,63,94,0.1)'; msgEl.style.color = '#FCA5A5'; msgEl.style.border = '1px solid rgba(244,63,94,0.3)' }
    else if (kind === 'success') { msgEl.style.background = 'rgba(0,212,170,0.1)'; msgEl.style.color = '#5EEAD4'; msgEl.style.border = '1px solid rgba(0,212,170,0.3)' }
    else { msgEl.style.background = 'rgba(255,255,255,0.05)'; msgEl.style.color = 'rgba(255,255,255,0.6)'; msgEl.style.border = '1px solid rgba(255,255,255,0.08)' }
  }
  const _updateSubmitState = () => {
    const valid = EMAIL_RE.test((emailInput.value || '').trim())
    submitBtn.disabled = !valid || submitting
    submitBtn.style.opacity = (!valid || submitting) ? '.5' : '1'
  }

  emailInput.addEventListener('input', _updateSubmitState)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeRestoreModal() })
  closeBtn.addEventListener('click', _closeRestoreModal)
  cancelBtn.addEventListener('click', _closeRestoreModal)
  if (user?.email) { emailInput.value = user.email; _updateSubmitState() }
  setTimeout(() => emailInput.focus(), 60)

  submitBtn.addEventListener('click', async () => {
    const email = (emailInput.value || '').trim()
    if (!EMAIL_RE.test(email) || submitting) return
    submitting = true
    emailInput.disabled = true
    cancelBtn.disabled = true
    submitBtn.disabled = true
    submitBtn.style.opacity = '.6'
    const originalBtnLabel = submitBtn.textContent
    submitBtn.textContent = 'Verificando…'
    _setMsg('Buscando tu licencia…', 'pending')

    try {
      const res = await fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/check-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'lookup_failed')

      if (data.found) {
        // Security: check-license only confirms *something* exists for
        // this email — it never grants access itself (anyone could type
        // any email otherwise). Before restoring anything, we require
        // real proof of ownership via a Supabase magic link; the actual
        // Stripe↔Supabase reconciliation happens server-side in
        // restore-access, only once that proof exists.
        if (!window.MNSupabaseAuth) throw new Error('auth_unavailable')
        const { error: otpError } = await window.MNSupabaseAuth._sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: location.origin + location.pathname },
        })
        if (otpError) throw otpError
        _setMsg('✅ Licencia encontrada. Te hemos enviado un enlace a tu email — ábrelo en este dispositivo para restaurar tu acceso.', 'success')
        submitBtn.style.display = 'none'
        cancelBtn.textContent = 'Cerrar'
        submitting = false
        emailInput.disabled = true
      } else {
        _setMsg('No hemos encontrado una licencia asociada a este email.', 'error')
        submitting = false
        emailInput.disabled = false
        cancelBtn.disabled = false
        submitBtn.textContent = originalBtnLabel
        _updateSubmitState()
      }
    } catch (err) {
      console.error('[restoreAccess] Error verificando la licencia:', err)
      _setMsg('No se pudo comprobar tu licencia. Comprueba tu conexión e inténtalo de nuevo.', 'error')
      submitting = false
      emailInput.disabled = false
      cancelBtn.disabled = false
      submitBtn.textContent = originalBtnLabel
      _updateSubmitState()
    }
  })
}

// Expose on window for debugging / external use.
// Si js/auth.js (v2) ya cargó antes, ya definió window.MNAuth con funciones
// más completas (trialHoursLeft, trialTimeLeftLabel, etc.). No lo pisamos.
if (!window.MNAuth) {
  window.MNAuth = { PLANS, DEFAULT_USER, getUser, saveUser, patchUser, initUser,
      buyLocal,
      isLocked: () => getUser().plan === 'locked_local',
      isLocal:  () => getUser().plan === 'local',
      trialTimeLeftLabel: () => { const ms = trialMsLeft ? trialMsLeft() : 0; const h=Math.floor(ms/3600000); const m=Math.floor((ms%3600000)/60000); return h>0?`${h}h ${m}m`:`${m}m`; },
      trialMsLeft: () => { const u=getUser(); if(u.plan!=='trial'||!u.trialEndsAt) return 0; return Math.max(0,u.trialEndsAt-Date.now()); },
    checkAccess, upgradeTrial,
    trialDaysLeft, isTrialExpired, isGuest, bloquearApp };
}


// ─── LANGUAGE SYSTEM ──────────────────────────────────────────
const LANG_STORAGE_KEY = 'mn7_lang'
const TRANSLATIONS = {
  es: {
    // Missing keys audit fix — auth flow, hints, modals
    auth_email_requerido: 'Introduce un email válido',
    auth_error_enviar: 'No se pudo enviar el código. Inténtalo de nuevo.',
    auth_error_reenviar: 'No se pudo reenviar el código.',
    loading_entrando: 'Entrando...',
    loading_creando_cuenta: 'Creando cuenta...',
    loading_verificando: 'Verificando...',
    loading_enviando: 'Enviando...',
    loading_enviado: '✓ Enviado',
    btn_verificar_codigo: 'Verificar código',
    btn_reenviar: 'Reenviar código',
    btn_enviar_email: 'Enviar por email',
    btn_confirmar_venta: 'Confirmar venta',
    modal_proveedor_nuevo: 'Nuevo proveedor',
    modal_proveedor_editar: 'Editar proveedor',
    modal_devengo_nuevo: 'Nuevo devengo',
    modal_devengo_editar: 'Editar devengo',
    modal_activo_nuevo: 'Nuevo activo',
    modal_activo_editar: 'Editar activo',
    cuenta_hint_selecciona: 'Selecciona una cuenta',
    cuenta_disponible: 'Disponible: ',
    toast_inversion_liquidada: '💰 Inversión liquidada',
    debt_importe_valido: 'Introduce un importe mensual válido.',
    // Nav
    nav_principal: 'Principal', nav_finanzas: 'Finanzas',
    nav_planificacion: 'Planificación', nav_patrimonio_sec: 'Patrimonio',
    nav_sistema: 'Sistema',
    nav_dashboard: 'Dashboard', nav_ingresos: 'Ingresos',
    nav_gastos: 'Gastos', nav_inversiones: 'Inversiones',
    nav_deudas: 'Deudas', nav_objetivos: 'Objetivos',
    nav_presupuestos: 'Presupuestos', nav_cuentas: 'Cuentas', nav_categorias: 'Categorías', nav_sub_categorias: 'Organiza tus movimientos', cat_page_sub: 'Organiza tus gastos e ingresos',
    nav_revision: 'Revisión', nav_sub_revision: 'Movimientos pendientes',
    revision_titulo: 'Revisión', revision_sub: 'Estas transacciones necesitan tu atención.',
    revision_vacio_titulo: 'Todo revisado', revision_vacio_sub: 'Perfecto. No tienes movimientos pendientes de revisar.',
    revision_recordar: 'Recordar esta decisión', categoria_lbl: 'Categoría', sin_categoria: 'Sin categoría',
    toast_categorizado: 'Categorizado ✓', cargar_mas: 'Cargar más', restantes: 'restantes',
    revision_banner_singular: 'cosa necesita', revision_banner_plural: 'cosas necesitan', revision_banner_atencion: 'tu atención', revisar_ahora: 'Revisar',
    nav_calendario: 'Calendario', nav_sub_calendario: 'Actividad día a día',
    calendario_titulo: 'Calendario', calendario_sub: 'Tu actividad financiera día a día',
    anadir_evento: 'Añadir evento financiero', mes_anterior: 'Mes anterior', mes_siguiente: 'Mes siguiente', hoy: 'Hoy',
    cal_evento_sg: 'evento', cal_evento_pl: 'eventos', eventos_previstos: 'Eventos previstos', previsto: 'previsto',
    sin_actividad_dia: 'Sin actividad este día', balance_dia: 'Balance del día', cerrar: 'Cerrar',
    editar_evento: 'Editar evento', nuevo_evento: 'Nuevo evento financiero', titulo_lbl: 'Título',
    ph_evento_titulo: 'Alquiler, Netflix...', importe_lbl: 'Importe (€)', fecha_lbl: 'Fecha', tipo_lbl: 'Tipo',
    recurrencia_lbl: 'Repetición', rec_none: 'No se repite', rec_daily: 'Diaria', rec_weekly: 'Semanal',
    rec_monthly: 'Mensual', rec_yearly: 'Anual', descripcion_lbl: 'Descripción', opcional: 'opcional', eliminar: 'Eliminar',
    err_evento_campos: 'Completa título, importe y fecha', toast_evento_guardado: 'Evento guardado ✓',
    confirm_eliminar_evento: '¿Eliminar este evento financiero? Esto no afecta a ninguna transacción real.',
    confirm_eliminar_evento_titulo: 'Eliminar evento', toast_evento_eliminado: 'Evento eliminado',
    event_type_pago: 'Pago', event_type_prestamo: 'Préstamo', event_type_seguro: 'Seguro',
    event_type_suscripcion: 'Suscripción', event_type_alquiler: 'Alquiler', event_type_aportacion_objetivo: 'Aportación a objetivo',
    event_type_ingreso_previsto: 'Ingreso previsto', event_type_personalizado: 'Evento personalizado',
    rango_todo: 'Todo', nw_hace_3m: 'Hace 3 meses', nw_hace_6m: 'Hace 6 meses', nw_hace_1a: 'Hace 1 año', nw_inicio: 'Inicio',
    nw_construyendo_historial: 'Seguiremos construyendo tu historial de patrimonio a medida que utilices MoneyNest.',
    nw_sin_cambios: 'Sin cambios en este periodo', desde_enero: 'Desde enero', que_ha_pasado: '¿Qué ha pasado?',
    nw_actual: 'Actual', nw_resultado: 'Resultado', nw_comp_inversiones: 'Inversiones', nw_comp_efectivo: 'Efectivo / ahorro',
    nw_comp_activos: 'Activos', nw_comp_deudas: 'Deudas', nw_mayor_crecimiento: 'Mayor crecimiento', nw_mayor_impacto_neg: 'Mayor impacto negativo',
    nav_patrimonio: 'Patrimonio', nav_analisis: 'Análisis',
    nav_configuracion: 'Configuración', nav_faq: 'FAQ', nav_sugerencias: 'Sugerencias',
    nav_billing: 'Plan & Facturación',
    nav_cerrar_sesion: 'Cerrar sesión',
    // Auth UI i18n
    auth_cuenta:'Cuenta MoneyNest',auth_iniciar_sesion:'Iniciar sesión',auth_crear_cuenta_titulo:'Crear cuenta',auth_crear_cuenta:'Crear cuenta →',auth_crear_y_empezar:'Crear cuenta y empezar →',auth_ya_tienes:'¿Ya tienes cuenta?',auth_iniciar_sesion_link:'Iniciar sesión',auth_nuevo:'¿Nuevo en MoneyNest?',auth_email:'Correo electrónico',auth_password:'Contraseña',auth_password_nueva:'Contraseña (mín. 8 caracteres)',auth_confirmar_password:'Confirmar contraseña',auth_entrar:'Entrar',auth_entrando:'Entrando…',auth_enviando:'Enviando…',auth_creando:'Creando cuenta…',auth_guardando:'Guardando…',auth_olvide_contrasena:'¿Olvidaste tu contraseña?',auth_recuperar:'Recuperar acceso',auth_resetear:'Resetear contraseña',auth_reset_desc:'Te enviaremos un enlace para restablecer tu contraseña.',auth_enviar_enlace:'Enviar enlace de reseteo',auth_volver_login:'Volver al login',auth_seguridad:'Seguridad',auth_nueva_contrasena:'Nueva contraseña',auth_nueva_pw_desc:'Elige una contraseña segura para tu cuenta.',auth_guardar_contrasena:'Guardar contraseña',auth_o:'o continúa con email',auth_24h_gratis:'24h gratis',auth_24h_desc:'Registrarte activa tu prueba gratuita. Sin tarjeta.',auth_plan_prueba:'⏳ Plan de prueba',auth_tiempo_restante:'tiempo de prueba restante',auth_trial_restante:'Tiempo de prueba restante',auth_registrate_desc:'Regístrate para que tu trial de 24h quede asociado a tu email.',auth_crear_cuenta_gratis:'Crear cuenta gratuita →',auth_ya_tengo_cuenta:'Ya tengo cuenta — Iniciar sesión',auth_desbloquear_ahora:'Desbloquear ahora',auth_plan_local_desc:'Con MoneyNest (6,99€) nunca expira.',auth_comprar_local:'Comprar MoneyNest — 6,99€ →',auth_comprar_local_cta:'Comprar MoneyNest — 6,99€ →',auth_que_pasa:'¿Qué pasa cuando expire?',auth_plan_local_cta_desc:'La app se bloqueará. Con MoneyNest (6,99€) se desbloquea para siempre.',auth_acceso_bloqueado:'Acceso bloqueado',auth_prueba_expirada:'Tu prueba de 24 horas ha expirado.',auth_datos_seguros:'Tus datos están a salvo.',auth_plan_local:'Plan Local',auth_pago_unico:'pago único',auth_feat_acceso_inmediato:'Acceso inmediato sin expiración',auth_feat_datos:'Todos tus datos conservados',auth_feat_ilimitado:'Ilimitado: movimientos, categorías',auth_feat_export:'Exportación PDF y Excel',auth_restaurar:'¿Ya compraste? Restaurar acceso',auth_plan_local_activo:'Plan Local activo',auth_acceso_desbloqueado:'Acceso desbloqueado',auth_datos_locales:'Tus datos se guardan en este dispositivo.',auth_sesion_activa:'Sesión activa',auth_activar_nube:'Activa la sincronización en la nube',auth_plan_pro:'Plan Pro',auth_año:'año',auth_feat_sync:'Sincronización multi-dispositivo',auth_feat_backup:'Backup automático',auth_feat_soporte:'Soporte prioritario',auth_feat_beta:'Funciones beta primero',auth_pro_note_used:'Prueba gratuita ya usada.',auth_plan_pro_activo:'Plan Pro activo',auth_gracias_pro:'¡Gracias por ser Pro!',auth_suscripcion_activa:'suscripción activa',auth_prueba_activa:'Prueba gratuita activa',auth_hasta:'hasta el',auth_feat_cloud:'Cloud sync',auth_feat_backups:'Backups auto',auth_vincular_pago_desc:'Vincula un método de pago antes de que expire la prueba.',auth_vincular_pago:'Vincular método de pago',auth_cancelar_pro:'Cancelar suscripción Pro',auth_cancelar_pro_nota:'Si cancelas, tu plan vuelve a Local.',auth_cerrar_sesion:'Cerrar sesión',auth_sesion_cerrada:'Sesión cerrada.',auth_sesion_iniciada:'Sesión iniciada correctamente.',auth_cuenta_creada:'¡Cuenta creada y sesión iniciada!',auth_confirma_email:'¡Cuenta creada! Revisa tu email para confirmar.',auth_revisa_email:'Revisa tu bandeja de entrada para confirmar tu cuenta.',auth_enlace_enviado:'Enlace enviado. Revisa tu email.',auth_pw_actualizada:'Contraseña actualizada correctamente.',auth_ver_plan:'Ver mi plan',auth_tu_plan:'Tu plan actual',auth_plan_local_badge:'Local',auth_bloqueado:'Bloqueado',auth_confirmar_cancelar_pro:'¿Seguro que quieres cancelar el Plan Pro?',auth_pro_cancelado:'Plan Pro cancelado. Sigues con Plan Local.',auth_error_campos:'Rellena todos los campos.',auth_error_email:'Email no válido.',auth_error_pw_corta:'La contraseña debe tener al menos 8 caracteres.',auth_error_pw_no_coincide:'Las contraseñas no coinciden.',auth_error_credenciales:'Email o contraseña incorrectos.',auth_error_no_confirmado:'Confirma tu email antes de entrar.',auth_error_email_existe:'Este email ya está registrado.',auth_error_rate:'Demasiados intentos. Espera unos minutos.',auth_error_rate_reset:'Demasiadas solicitudes. Espera 1 hora.',auth_error_oauth:'Error al conectar con el proveedor.',auth_error_generico:'Se produjo un error. Inténtalo de nuevo.',
    // Topbar
    disponible: 'Disponible',
    exportar: 'Exportar',
    // Theme
    theme_dark: 'Modo oscuro', theme_light: 'Modo claro',
    // Dashboard
    patrimonio_neto: 'Patrimonio Neto',
    ingresos_mes: 'Ingresos este mes',
    gastos_mes: 'Gastos este mes',
    cash_flow: 'Cash Flow',
    ahorro_mes: 'Ahorro este mes',
    sin_movimientos: 'Sin movimientos registrados',
    actividad_reciente: 'Actividad reciente',
    ultimas_transacciones: 'Últimas transacciones',
    ver_todo: 'Ver todo →',
    evolucion_patrimonio: 'Evolución del patrimonio',
    ultimos_6_meses: 'Últimos 12 meses',
    gastos_categoria: 'Gastos por categoría',
    insights: 'Insights',
    basado_datos: 'Basado en tus datos reales',
    todo_orden: '¡Todo en orden este mes!',
    sigue_registrando: 'Sigue registrando tus movimientos.',
    primer_mes: 'Primer mes',
    ingresos_año: 'Ingresos',
    gastos_año: 'Gastos',
    resumen_financiero: 'Resumen financiero',
    hola: 'Hola,',
    // Buttons
    btn_guardar: 'Guardar', btn_cancelar: 'Cancelar',
    btn_eliminar: 'Eliminar', btn_editar: 'Editar',
    btn_nuevo: 'Nuevo', btn_exportar: '↗ Exportar',
    btn_nuevo_ingreso: '+ Nuevo ingreso',
    btn_nuevo_gasto: '+ Nuevo gasto',
    btn_nueva_inversion: '+ Nueva inversión',
    btn_nueva_deuda: '+ Nueva deuda',
    btn_nuevo_objetivo: '+ Nuevo objetivo',
    // Ingresos
    page_ingresos: 'Ingresos',
    sub_ingresos: 'Todos tus ingresos',
    // Gastos
    page_gastos: 'Gastos',
    sub_gastos: 'Todos tus gastos',
    // Inversiones
    page_inversiones: 'Inversiones',
    // Cuentas
    page_cuentas: 'Cuentas',
    // Deudas
    page_deudas: 'Deudas',
    // Objetivos
    page_objetivos: 'Objetivos',
    // Presupuestos
    page_presupuestos: 'Presupuestos',
    // Análisis
    page_analisis: 'Análisis',
    // Configuración
    page_configuracion: 'Configuración',
    page_faq: 'Preguntas frecuentes', page_sugerencias: 'Sugerencias',
    sug_tipo_sug: 'Sugerencia', sug_tipo_preg: 'Pregunta',
    sug_placeholder: 'Describe tu idea o pregunta...', sug_enviar_email: '📧 Enviar por email', sug_guardar: '💾 Guardar localmente',
    // Onboarding
    ob_bienvenida: '¡Bienvenido a MoneyNest! 🪺',
    ob_bienvenida_sub: '¿Cómo te llamas? Personalizaremos la experiencia para ti.',
    ob_idioma: 'Elige tu idioma',
    ob_idioma_sub: 'Selecciona el idioma en el que quieres usar la app.',
    ob_tema: 'Elige tu tema',
    ob_tema_sub: 'Puedes cambiarlo en cualquier momento desde la barra lateral.',
    ob_listo: '¡Todo configurado!',
    ob_listo_sub: '¿Quieres ver un tour interactivo? Te guiaremos paso a paso con datos de ejemplo.',
    ob_continuar: 'Continuar →',
    ob_empezar: '¡Empezar!',
    ob_omitir: 'Omitir',
    ob_atras: '← Atrás',
    ob_ver_tutorial: 'Ver tutorial',
    ob_ir_directo: 'Ir directo',
    ob_3min: '~3 minutos',
    ob_exploro: 'Exploro solo',
    ob_oscuro: 'Oscuro', ob_claro: 'Claro',
    ob_nombre_placeholder: 'Tu nombre...',
    // Onboarding panel texts
    ob_s1_pill: 'Paso 1 de 3 · Bienvenida',
    ob_s1_h1: 'Tu dinero,', ob_s1_h2: 'por fin <span>bajo control.</span>',
    ob_s1_lead: 'MoneyNest es tu panel financiero personal. Ingresos, gastos, inversiones y objetivos — todo en un solo lugar, siempre contigo.',
    ob_s1_placeholder: '¿Cómo te llamas?', ob_s1_hint: 'Solo para personalizar tu panel — sin cuenta, sin email',
    ob_s1_cta: 'Comenzar',
    ob_s2_pill: 'Paso 2 de 3 · Personaliza',
    ob_s2_h1: 'Tu look,', ob_s2_h2: 'tus <span>reglas.</span>',
    ob_s2_lead: 'Elige idioma y tema. Puedes cambiarlo en cualquier momento desde Configuración.',
    ob_s2_idioma_lbl: 'Idioma', ob_s2_tema_lbl: 'Apariencia',
    ob_s2_siguiente: 'Siguiente',
    ob_s3_pill: 'Paso 3 de 3 · Arrancar',
    ob_s3_h1: '¿Por dónde', ob_s3_h2: '<span>empezamos?</span>',
    ob_s3_lead: 'Tu panel está configurado. Elige cómo quieres comenzar tu experiencia con MoneyNest.',
    ob_s3_greeting: '¡Todo listo',
    ob_opt_tutorial_lbl: 'Tour guiado', ob_opt_tutorial_sub: 'Te enseñamos todo paso a paso con ejemplos reales (~3 min)',
    ob_opt_demo_lbl: 'Explorar con datos de ejemplo', ob_opt_demo_sub: 'Ve la app completa antes de añadir tus propios datos',
    ob_opt_direct_lbl: 'Empezar directamente', ob_opt_direct_sub: 'Exploro solo, ya sé lo que necesito',
    ob_s3_cta: '¡Empezar! 🚀',
    ob_continuar: 'Continuar',
    ob_bank_h1: '¿Quieres importar', ob_bank_h2: 'tus datos bancarios?',
    ob_bank_lead: 'Importa tus movimientos para empezar a utilizar MoneyNest con tus datos reales.',
    ob_bank_opt_sub: 'Sube un extracto CSV o Excel (XLSX) de tu banco',
    ob_bank_done: 'Datos importados correctamente',
    ob_bank_skip: 'Hacerlo más tarde',
    ob_left2_title: 'Diseñada para ti,', ob_left2_sub: 'desde el primer día.',
    ob_left2_desc: 'Escoge el idioma y el tema que mejor se adapta a tu forma de trabajar.',
    ob_left2_idioma_lbl: '🌍 Idioma activo', ob_left2_tema_lbl: '🎨 Tema',
    ob_feat_ingresos: 'Ingresos & Gastos', ob_feat_ingresos_sub: 'Control total de tu flujo',
    ob_feat_inv: 'Inversiones', ob_feat_inv_sub: 'Seguimiento de tu cartera',
    ob_feat_obj: 'Objetivos', ob_feat_obj_sub: 'Alcanza tus metas financieras',
    ob_feat_priv: '100% privado', ob_feat_priv_sub: 'Tus datos solo en tu dispositivo',
    ob_feat_gratis: 'Sin suscripción', ob_feat_gratis_sub: 'Todo gratis, sin límites',
    ob_left3_ready: '✨ Tu panel está listo — empieza a añadir tus datos',
    // Misc
    sin_datos: 'Sin datos suficientes',
    buscar: 'Buscar...',
    todas_cats: 'Todas las categorías',
    periodo: 'Período:',
    este_mes: 'Este mes',
    mes_anterior: 'Mes anterior',
    este_año: 'Este año',
    todo: 'Todo',
    personalizado: 'Personalizado',
    // Settings view
    cfg_perfil: 'Tu perfil', cfg_nombre: 'Nombre', cfg_guardar: '💾 Guardar',
    cfg_idioma: 'Idioma', cfg_apariencia: 'Apariencia',
    cfg_oscuro: 'Oscuro', cfg_claro: 'Claro', cfg_activo: '✓ Activo',
    cfg_apariencia_tip: 'También puedes cambiarlo desde la barra lateral.',
    cfg_datos: 'Importar / Exportar datos',
    cfg_exportar_pdf: '📊 Exportar informe completo (PDF / Excel)',
    cfg_backup_json: '📤 Copia de seguridad (JSON)',
    cfg_drive: '☁️ Guardar en Google Drive',
    cfg_importar: '↓ Importar copia de seguridad',
    cfg_borrar_todo: '🗑 Borrar todos los datos',
    cfg_demo_titulo: 'Modo demo',
    cfg_demo_activo_lbl: '● Activo · datos de ejemplo cargados',
    cfg_demo_inactivo_lbl: 'Explorar la app con datos de ejemplo',
    cfg_demo_desc_on: 'Los datos son de ejemplo. Usa el botón flotante 🟡 Modo demo (esquina inferior derecha) para salir al modo real.',
    cfg_demo_desc_off: 'Explora todas las funciones sin introducir datos propios. Elige un perfil (asalariado, freelance, familia, inversor) y carga datos realistas al instante.',
    cfg_demo_salir: '🏁 Salir al modo real',
    cfg_demo_activar: '🚀 Activar modo demo',
    cfg_info: 'Información de la app', cfg_version_lbl: 'Versión',
    cfg_ver_tutorial: '🎓 Ver tutorial',
    cfg_cats_titulo: 'Categorías personalizadas',
    cfg_cats_sub: 'Los emojis se asignan automáticamente',
    cfg_nueva_cat: 'Nueva categoría...',
    cfg_emoji_tip: 'Toca el emoji para elegir, luego escribe el nombre',
    cfg_anadir: '+ Añadir', cfg_personaliza_sub: 'Personaliza tu experiencia MoneyNest',
    cat_type_ingreso: 'Ingresos', cat_type_gasto: 'Gastos',
    cat_type_inversion: 'Inversiones', cat_type_deuda: 'Deudas', cat_type_objetivo: 'Objetivos',
    // Trial / plans
    trial_pill: 'Prueba gratuita', trial_days_left: 'días restantes',
    guest_gate_title: 'Crea tu cuenta para continuar',
    guest_gate_desc: 'Para añadir movimientos necesitas una cuenta gratuita. Empieza con 7 días de prueba completa.',
      bn_analisis: 'Análisis',
    bn_config: 'Config',
    bn_gastos: 'Gastos',
    bn_inicio: 'Inicio',
    btn_aportar_confirm: 'Aportar',
    btn_cuenta_cancelar: 'Cancelar',
    btn_cuenta_guardar: 'Guardar',
    btn_liquidar_confirm: 'Liquidar',
    btn_monthly_cerrar: 'Cerrar',
    btn_monthly_pdf: '📄 Exportar PDF',
    btn_presupuesto_cancelar: 'Cancelar',
    btn_presupuesto_guardar: 'Guardar',
    btn_registrar_pago: 'Registrar pago',
    btn_tax_cancelar: 'Cancelar',
    btn_tax_guardar: 'Guardar',
    btn_trans_cancelar: 'Cancelar',
    btn_trans_transferir: 'Transferir',
    cliente_editar: 'Editar Cliente',
    cliente_nuevo: 'Nuevo Cliente',
    cobrado_btn: '✓ Cobrado',
    confirm_borrar_todo: '¿Borrar TODOS los datos? Esta acción no se puede deshacer.',
    confirm_borrar_todo_btn: 'Borrar todo',
    confirm_borrar_todo_titulo: 'Borrar todos los datos',
    confirm_btn_cancelar: 'Cancelar',
    confirm_btn_eliminar: 'Eliminar',
    confirm_cerrar_sesion: '¿Cerrar sesión? Tu plan y datos financieros se conservarán en este dispositivo.',
    confirm_cerrar_sesion_btn: 'Cerrar sesión',
    confirm_cerrar_sesion_titulo: 'Cerrar sesión',
    confirm_eliminar_cliente: '¿Eliminar este cliente?',
    confirm_eliminar_cliente_titulo: 'Eliminar cliente',
    confirm_eliminar_cuenta: '¿Eliminar esta cuenta?',
    confirm_eliminar_cuenta_titulo: 'Eliminar cuenta',
    confirm_eliminar_deuda: '¿Eliminar esta deuda?',
    confirm_eliminar_deuda_titulo: 'Eliminar deuda',
    confirm_eliminar_gasto: '¿Eliminar este gasto?',
    confirm_eliminar_gasto_titulo: 'Eliminar gasto',
    confirm_eliminar_ingreso: '¿Eliminar este ingreso? Esta acción no se puede deshacer.',
    confirm_eliminar_ingreso_titulo: 'Eliminar ingreso',
    confirm_eliminar_inversion: '¿Eliminar esta inversión?',
    confirm_eliminar_inversion_titulo: 'Eliminar inversión',
    confirm_eliminar_objetivo: '¿Eliminar este objetivo?',
    confirm_eliminar_objetivo_titulo: 'Eliminar objetivo',
    confirm_eliminar_presupuesto: '¿Eliminar el presupuesto de',
    confirm_eliminar_presupuesto_titulo: 'Eliminar presupuesto',
    confirm_importar: '¿Importar datos? Se reemplazarán todos los datos actuales.',
    confirm_importar_btn: 'Importar',
    confirm_importar_titulo: 'Importar datos',
    confirm_saldo_neg: 'dejará la cuenta con saldo negativo. ¿Deseas continuar?',
    confirm_saldo_neg_btn: 'Continuar igualmente',
    confirm_saldo_neg_titulo: '⚠️ Saldo insuficiente',
    confirm_salir_demo: '¿Salir del modo demo y borrar los datos de ejemplo?',
    confirm_salir_demo_btn: 'Salir al modo real',
    confirm_salir_demo_titulo: 'Salir del demo',
    confirm_titulo_def: '¿Estás seguro?',
    cuenta_nombre_ph: 'Cuenta corriente Santander...',
    cuenta_sin_cuenta: 'Sin cuenta',
    deuda_calculadora_ph: '¿Cuánto puedes pagar al mes? (€)',
    deuda_calcular_btn: 'Calcular',
    deuda_input_invalido: 'Introduce un importe mensual válido.',
    deuda_libre_pagar: 'Pagando al mes estarías libre de deudas en aprox.',
    deuda_sin_pendientes: '✅ ¡No tienes deudas pendientes!',
    drive_guardado: '✓ Guardado',
    drive_guardando: '⏳ Guardando...',
    drive_local: '(descarga local)',
    err_concepto_importe: 'Concepto e importe requeridos',
    err_cuenta_no_encontrada: 'Cuenta no encontrada',
    err_cuenta_origen: 'Selecciona la cuenta donde ingresar el capital',
    err_cuentas_distintas: 'Selecciona cuentas distintas',
    err_excel: 'Error al generar el Excel',
    err_exportar: 'Error al exportar',
    err_importe_aportar: 'Introduce el importe',
    err_importe_pago: 'Introduce el importe del pago',
    err_importe_valido: 'Introduce un importe válido',
    err_inversion_no_encontrada: 'Inversión no encontrada',
    err_leer_archivo: 'Error al leer el archivo',
    err_limite_valido: 'Introduce un límite válido',
    err_nombre_importe: 'Nombre e importe requeridos',
    err_nombre_meta: 'Nombre y meta requeridos',
    err_nombre_requerido: 'Nombre requerido',
    err_pdf: 'Error al generar el PDF',
    err_selecciona_cat: 'Selecciona una categoría',
    err_selecciona_cuenta: 'Selecciona una cuenta',
    err_valor_salida: 'Introduce el valor de salida',
    gc_ahora_no: 'Ahora no',
    gc_crear: 'Crear objetivo 🎯',
    gc_sub: 'Definir una meta de ahorro es el primer paso para mejorar tus finanzas. Te ayudaremos a hacer seguimiento automático.',
    gc_titulo: '¿Qué objetivo tienes este mes?',
    guardando: '⏳ Guardando…',
    intro_tagline: 'Tus finanzas, en orden',
    inversion_saldo_hint: 'Selecciona una cuenta para ver el saldo disponible',
    inversion_ya_liquidada: 'Esta inversión ya fue liquidada el',
    libre: 'Libre',
    meses: 'meses',
    mini_intro_tagline: 'Tus finanzas, en orden',
    mission_bar_sub: 'Añade tu primer ingreso para empezar',
    mission_bar_titulo: 'Completa tu primera misión',
    mission_modal_cerrar: 'Cerrar',
    mission_modal_sub: 'Completa estas acciones para conocer MoneyNest en 5 minutos.',
    mission_modal_titulo: '🚀 Tus misiones de inicio',
    modal_aportar_cuenta_lbl: 'Cuenta origen',
    modal_aportar_existente_lbl: '🏦 Dinero existente',
    modal_aportar_existente_sub: 'Se resta del disponible',
    modal_aportar_fuente: '¿De dónde viene este dinero?',
    modal_aportar_importe_lbl: 'Importe a aportar (€) *',
    modal_aportar_nuevo_lbl: '💸 Dinero nuevo',
    modal_aportar_nuevo_sub: 'No afecta al disponible',
    modal_cuenta_color_lbl: 'Color identificativo',
    modal_cuenta_nombre_lbl: 'Nombre de la cuenta *',
    modal_cuenta_nombre_ph: 'Cuenta corriente Santander...',
    modal_cuenta_notas_lbl: 'Entidad / Notas',
    modal_cuenta_notas_ph: 'Banco Santander, ING...',
    modal_cuenta_saldo_hint: 'Libre para usar ahora mismo',
    modal_cuenta_saldo_lbl: 'Dinero disponible (€)',
    modal_cuenta_tipo_ahorro: '💰 Ahorro',
    modal_cuenta_tipo_banco: '🏦 Banco',
    modal_cuenta_tipo_cripto: '₿ Cripto',
    modal_cuenta_tipo_efectivo: '💵 Efectivo',
    modal_cuenta_tipo_inversion: '📈 Inversión',
    modal_cuenta_tipo_lbl: 'Tipo',
    modal_cuenta_tipo_otro: '📁 Otro',
    modal_cuenta_titulo: 'Nueva Cuenta',
    modal_cuenta_titulo_editar: 'Editar Cuenta',
    modal_cuenta_valor_hint: 'Saldo total incluyendo activos',
    modal_cuenta_valor_lbl: 'Valor total cuenta (€)',
    modal_deuda_cat_lbl: 'Categoría',
    modal_deuda_interes_lbl: 'Interés anual (%)',
    modal_deuda_nombre_lbl: 'Nombre *',
    modal_deuda_notas_lbl: 'Notas',
    modal_deuda_nueva_cat_lbl: 'Nueva categoría',
    modal_deuda_pagado_lbl: 'Ya pagado (€)',
    modal_deuda_total_lbl: 'Total deuda (€) *',
    modal_deuda_vencimiento_lbl: 'Vencimiento',
    modal_export_desc: 'Exporta tus datos financieros en el formato que prefieras.',
    modal_export_excel_sub: 'Ingresos, gastos, inversiones, deudas, objetivos, clientes',
    modal_export_excel_titulo: 'Excel completo (todas las hojas)',
    modal_export_json_sub: 'Todos los datos · Para restaurar más tarde',
    modal_export_json_titulo: 'Copia de seguridad (JSON)',
    modal_export_pdf_sub: 'Resumen visual con todas las secciones',
    modal_export_pdf_titulo: 'Informe PDF completo',
    modal_export_seccion: 'Exportar por sección',
    modal_export_titulo: 'Exportar datos',
    modal_gasto_cat_lbl: 'Categoría',
    modal_gasto_concepto_lbl: 'Concepto *',
    modal_gasto_cuenta_lbl: 'Cuenta *',
    modal_gasto_cuenta_sub: '(obligatoria)',
    modal_gasto_fecha_lbl: 'Fecha',
    modal_gasto_importe_lbl: 'Importe (€) *',
    modal_gasto_notas_lbl: 'Notas',
    modal_gasto_nueva_cat_lbl: 'Nueva categoría',
    modal_ingreso_cat_lbl: 'Categoría',
    modal_ingreso_concepto_lbl: 'Concepto *',
    modal_ingreso_cuenta_lbl: 'Cuenta *',
    modal_ingreso_cuenta_sub: '(obligatoria)',
    modal_ingreso_fecha_lbl: 'Fecha',
    modal_ingreso_importe_lbl: 'Importe (€) *',
    modal_ingreso_notas_lbl: 'Notas',
    modal_ingreso_nueva_cat_lbl: 'Nueva categoría',
    modal_inv_capital_lbl: 'Capital invertido (€) *',
    modal_inv_cat_lbl: 'Categoría',
    modal_inv_cuenta_lbl: 'Cuenta de origen *',
    modal_inv_fecha_lbl: 'Fecha entrada',
    modal_inv_nombre_lbl: 'Nombre *',
    modal_inv_notas_lbl: 'Notas',
    modal_inv_nueva_cat_lbl: 'Nueva categoría',
    modal_inv_rentabilidad_hint: 'Solo para activos con retorno predecible',
    modal_inv_rentabilidad_lbl: 'Rentabilidad esperada (%)',
    modal_liquidar_cuenta_lbl: 'Cuenta donde ingresar',
    modal_liquidar_info: '✓ El capital se devolverá a la cuenta · La ganancia se registrará como ingreso · La pérdida se registrará como gasto',
    modal_liquidar_rentabilidad_lbl: 'O rentabilidad real (%)',
    modal_liquidar_titulo: '💰 Liquidar inversión',
    modal_liquidar_valor_lbl: 'Valor de salida (€)',
    modal_monthly_titulo: '📋 Cierre de mes',
    modal_obj_actual_lbl: 'Ahorrado hasta ahora (€)',
    modal_obj_cat_lbl: 'Categoría',
    modal_obj_color_lbl: 'Color',
    modal_obj_fecha_lbl: 'Fecha objetivo',
    modal_obj_imagen_sub: 'Opcional · aparece como fondo de la tarjeta',
    modal_obj_imagen_titulo: 'Imagen del objetivo',
    modal_obj_meta_lbl: 'Meta (€) *',
    modal_obj_nombre_lbl: 'Nombre *',
    modal_obj_notas_lbl: 'Notas',
    modal_obj_nueva_cat_lbl: 'Nueva categoría',
    modal_obj_quitar_btn: '✕ Quitar',
    modal_obj_subir_btn: '📷 Subir imagen',
    modal_pago_fecha_lbl: 'Fecha del pago',
    modal_pago_importe_lbl: 'Importe del pago (€) *',
    modal_pres_cat_lbl: 'Categoría',
    modal_pres_limite_lbl: 'Límite mensual (€) *',
    modal_pres_nueva_cat_lbl: 'Nueva categoría',
    modal_pres_titulo: 'Establecer Presupuesto',
    modal_tax_autonomo: 'Autónomo / Freelance',
    modal_tax_custom: 'Personalizado',
    modal_tax_desc: 'En modo empresa, MoneyNest calculará automáticamente la reserva fiscal sobre tus ingresos.',
    modal_tax_empresa: 'Empresa (IS 25%)',
    modal_tax_irpf_hint: 'Retención a cuenta / Impuesto sociedades',
    modal_tax_irpf_lbl: 'IRPF / IS (%)',
    modal_tax_iva_hint: 'Porcentaje de IVA a repercutir',
    modal_tax_iva_lbl: 'IVA (%)',
    modal_tax_regimen_lbl: 'Régimen fiscal',
    modal_tax_startup: 'Startup / Nueva empresa (IS 15%)',
    modal_tax_titulo: '⚙️ Configuración de impuestos',
    modal_trans_desde_lbl: 'Desde',
    modal_trans_hacia_lbl: 'Hacia',
    modal_trans_importe_lbl: 'Importe (€) *',
    modal_trans_titulo: 'Transferencia entre cuentas',
    nav_seccion_finanzas: 'Finanzas',
    nav_seccion_patrimonio: 'Patrimonio',
    nav_seccion_planificacion: 'Planificación',
    nav_seccion_principal: 'Principal',
    nav_seccion_sistema: 'Sistema',
    nav_sub_analisis: 'Insights y tendencias',
    nav_sub_cuentas: 'Tu dinero disponible',
    nav_sub_dashboard: 'Resumen general',
    nav_sub_deudas: 'Lo que debes',
    nav_sub_faq: 'Ayuda rápida',
    nav_sub_gastos: 'Lo que sale',
    nav_sub_ingresos: 'Lo que entra',
    nav_sub_inversiones: 'Hace crecer tu dinero',
    nav_sub_objetivos: 'Tus metas de ahorro',
    nav_sub_patrimonio: 'Tu riqueza total',
    nav_sub_presupuestos: 'Límites por categoría',
    ob_skip: 'Omitir',
    quick_add_categoria: 'Categoría',
    quick_add_descripcion_ph: 'Descripción (opcional)',
    quick_add_gasto: '💸 Gasto',
    quick_add_guardar: 'Guardar',
    quick_add_ingreso: '💰 Ingreso',
    quick_add_titulo: '⚡ Añadir rápido',
    story_cerrar: 'Cerrar',
    story_siguiente: 'Siguiente →',
    toast_aportado_ok: 'Aportado al objetivo ✓',
    toast_cat_añadida: 'Categoría añadida ✓',
    toast_cat_existe: 'Esa categoría ya existe',
    toast_cuenta_eliminada: 'Cuenta eliminada',
    toast_cuenta_guardada: 'Cuenta guardada ✓',
    toast_cuenta_min: 'Necesitas al menos una cuenta',
    toast_datos_eliminados: 'Todos los datos eliminados — configuración reiniciada',
    toast_deuda_eliminada: 'Deuda eliminada',
    toast_deuda_guardada: 'Deuda guardada ✓',
    toast_deudas_exportadas: 'Deudas exportadas ✓',
    toast_drive_error: 'Drive no disponible — copia descargada localmente',
    toast_drive_ok: '☁️ Copia guardada en Google Drive ✓',
    toast_espacio_insuficiente: '💾 Espacio insuficiente. Usa una imagen más pequeña.',
    toast_excel_exportado: 'Excel exportado ✓',
    toast_exportado: 'Exportado ✓',
    toast_gasto_eliminado: 'Gasto eliminado',
    toast_gasto_guardado: 'Gasto guardado ✓',
    toast_gastos_exportados: 'Gastos exportados ✓',
    toast_guardado: 'Guardado ✓',
    toast_imagen_actualizada: 'Imagen actualizada ✓',
    toast_imagen_eliminada: 'Imagen eliminada',
    toast_ingreso_eliminado: 'Ingreso eliminado',
    toast_ingreso_guardado: 'Ingreso guardado ✓',
    toast_ingresos_exportados: 'Ingresos exportados ✓',
    toast_inversion_eliminada: 'Inversión eliminada',
    toast_inversion_guardada: 'Inversión registrada ✓ · Saldo actualizado',
    toast_inversiones_exportadas: 'Inversiones exportadas ✓',
    toast_json_exportado: 'Copia de seguridad exportada ✓',
    toast_json_importado: 'Datos importados ✓',
    toast_liquidado_ganancia: 'Inversión liquidada · Ganancia registrada',
    toast_liquidado_neutro: 'Inversión liquidada',
    toast_liquidado_perdida: 'Inversión liquidada · Pérdida registrada',
    toast_objetivo_eliminado: 'Objetivo eliminado',
    toast_objetivo_guardado: 'Objetivo guardado ✓',
    toast_objetivos_exportados: 'Objetivos exportados ✓',
    toast_pago_registrado: 'Pago registrado ✓',
    toast_pdf_exportado: 'PDF exportado ✓',
    toast_perfil_guardado: 'Perfil guardado ✓',
    toast_presupuesto_eliminado: 'Presupuesto eliminado',
    toast_presupuesto_guardado: 'Presupuesto guardado ✓',
    toast_presupuestos_exportados: 'Presupuestos exportados ✓',
    toast_transferencia_ok: 'Transferencia realizada ✓',
    topbar_activar_pro: '⚡ Activar Pro',
    topbar_cambiar_tema: 'Cambiar tema',
    topbar_disponible: 'Disponible',
    topbar_importar: '⬇ Importar',
    topbar_exportar: '⬆ Exportar',
    nav_logros: 'Logros',
    nav_facturacion: 'Plan y facturación', nav_sub_facturacion: 'Tu plan y pagos',
    nav_sub_logros: 'Tus metas conseguidas',
    cfg_notificaciones: 'Notificaciones',
    tut_salir: '✕ Salir',
    tut_siguiente: 'Siguiente →',
    ver_movimientos_btn: '📋 Ver movimientos',
    deuda_libertad_titulo: '🏁 Planificación de Libertad Financiera',
    deuda_libertad_sub: 'Define tu objetivo y calcula cuánto debes pagar',
    deuda_libertad_objetivo_lbl: 'Quiero ser libre de deudas en',
    deuda_libertad_calcular: 'Calcular cuota',
    deuda_libertad_resultado_pre: 'Para ser libre en',
    deuda_libertad_resultado_mid: 'necesitas pagar:',
    deuda_libertad_mensual: 'Mensual',
    deuda_libertad_semanal: 'Semanal',
    deuda_libertad_diario: 'Diario',
    deuda_libertad_sin_deuda: '¡Ya estás libre de deudas! 🎉',
    deuda_libertad_invalido: 'Introduce un período válido (número mayor que 0).',
    anos: 'años',
    semanas: 'semanas',
    dias: 'días',
    deuda_activar_estrategia: 'Activar esta estrategia',
    deuda_estrategia_activa: '✓ Estrategia Activa',
    deuda_info_automatizacion: 'Tus pagos se distribuirán según esta cuota para cumplir tu objetivo en el tiempo previsto.',
    topbar_prueba_termina_en: 'Prueba termina en:',
    horas: 'h',
    minutos: 'm',
},
  en: {
    // Missing keys audit fix — auth flow, hints, modals
    auth_email_requerido: 'Enter a valid email',
    // Projection/strategy keys (previously misplaced inside chartDefaults)
    proyeccion_titulo: 'Wealth projection',
    proyeccion_sub: 'Last 3 months average',
    escenario_conservador: 'Conservative',
    escenario_moderado: 'Moderate',
    escenario_optimista: 'Optimistic',
    proyeccion_negativa: 'Negative projection',
    proyeccion_negativa_msg: 'Reduce expenses or increase income.',
    proyeccion_excelente: 'Excellent projection',
    proyeccion_excelente_msg: 'Consider investing the surplus.',
    de_ingresos: 'of income',
    mes_lbl: 'month',
    crear_estrategia: 'Create strategy',
    personaliza_pago: 'Customize your monthly payment',
    desbloquear: 'Unlock',
    auth_error_enviar: 'Could not send the code. Try again.',
    auth_error_reenviar: 'Could not resend the code.',
    loading_entrando: 'Signing in...',
    loading_creando_cuenta: 'Creating account...',
    loading_verificando: 'Verifying...',
    loading_enviando: 'Sending...',
    loading_enviado: '✓ Sent',
    btn_verificar_codigo: 'Verify code',
    btn_reenviar: 'Resend code',
    btn_enviar_email: 'Send by email',
    btn_confirmar_venta: 'Confirm sale',
    modal_proveedor_nuevo: 'New provider',
    modal_proveedor_editar: 'Edit provider',
    modal_devengo_nuevo: 'New accrual',
    modal_devengo_editar: 'Edit accrual',
    modal_activo_nuevo: 'New asset',
    modal_activo_editar: 'Edit asset',
    cuenta_hint_selecciona: 'Select an account',
    cuenta_disponible: 'Available: ',
    toast_inversion_liquidada: '💰 Investment liquidated',
    debt_importe_valido: 'Enter a valid monthly amount.',
    nav_principal: 'Main', nav_finanzas: 'Finance',
    nav_planificacion: 'Planning', nav_patrimonio_sec: 'Net Worth',
    nav_sistema: 'System',
    nav_dashboard: 'Dashboard', nav_ingresos: 'Income',
    nav_gastos: 'Expenses', nav_inversiones: 'Investments',
    nav_deudas: 'Debts', nav_objetivos: 'Goals',
    nav_presupuestos: 'Budgets', nav_cuentas: 'Accounts', nav_categorias: 'Categories', nav_sub_categorias: 'Organize your transactions', cat_page_sub: 'Organize your expenses and income',
    nav_revision: 'Review', nav_sub_revision: 'Pending transactions',
    revision_titulo: 'Review', revision_sub: 'These transactions need your attention.',
    revision_vacio_titulo: 'All reviewed', revision_vacio_sub: 'Nice work. No pending transactions to review.',
    revision_recordar: 'Remember this decision', categoria_lbl: 'Category', sin_categoria: 'No category',
    toast_categorizado: 'Categorized ✓', cargar_mas: 'Load more', restantes: 'remaining',
    revision_banner_singular: 'item needs', revision_banner_plural: 'items need', revision_banner_atencion: 'your attention', revisar_ahora: 'Review',
    nav_calendario: 'Calendar', nav_sub_calendario: 'Day-by-day activity',
    calendario_titulo: 'Calendar', calendario_sub: 'Your financial activity, day by day',
    anadir_evento: 'Add financial event', mes_anterior: 'Previous month', mes_siguiente: 'Next month', hoy: 'Today',
    cal_evento_sg: 'event', cal_evento_pl: 'events', eventos_previstos: 'Planned events', previsto: 'planned',
    sin_actividad_dia: 'No activity this day', balance_dia: 'Daily balance', cerrar: 'Close',
    editar_evento: 'Edit event', nuevo_evento: 'New financial event', titulo_lbl: 'Title',
    ph_evento_titulo: 'Rent, Netflix...', importe_lbl: 'Amount (€)', fecha_lbl: 'Date', tipo_lbl: 'Type',
    recurrencia_lbl: 'Repeat', rec_none: 'Does not repeat', rec_daily: 'Daily', rec_weekly: 'Weekly',
    rec_monthly: 'Monthly', rec_yearly: 'Yearly', descripcion_lbl: 'Description', opcional: 'optional', eliminar: 'Delete',
    err_evento_campos: 'Fill in title, amount and date', toast_evento_guardado: 'Event saved ✓',
    confirm_eliminar_evento: 'Delete this financial event? This does not affect any real transaction.',
    confirm_eliminar_evento_titulo: 'Delete event', toast_evento_eliminado: 'Event deleted',
    event_type_pago: 'Payment', event_type_prestamo: 'Loan', event_type_seguro: 'Insurance',
    event_type_suscripcion: 'Subscription', event_type_alquiler: 'Rent', event_type_aportacion_objetivo: 'Goal contribution',
    event_type_ingreso_previsto: 'Expected income', event_type_personalizado: 'Custom event',
    rango_todo: 'All', nw_hace_3m: '3 months ago', nw_hace_6m: '6 months ago', nw_hace_1a: '1 year ago', nw_inicio: 'Start',
    nw_construyendo_historial: 'We will keep building your net worth history as you use MoneyNest.',
    nw_sin_cambios: 'No changes in this period', desde_enero: 'Since January', que_ha_pasado: 'What happened?',
    nw_actual: 'Now', nw_resultado: 'Result', nw_comp_inversiones: 'Investments', nw_comp_efectivo: 'Cash / savings',
    nw_comp_activos: 'Assets', nw_comp_deudas: 'Debts', nw_mayor_crecimiento: 'Biggest growth', nw_mayor_impacto_neg: 'Biggest negative impact',
    nav_patrimonio: 'Net Worth', nav_analisis: 'Analysis',
    nav_configuracion: 'Settings', nav_faq: 'FAQ', nav_sugerencias: 'Suggestions',
    nav_billing: 'Plan & Billing',
    nav_cerrar_sesion: 'Sign out',
    auth_cuenta:'MoneyNest Account',auth_iniciar_sesion:'Sign in',auth_crear_cuenta_titulo:'Create account',auth_crear_cuenta:'Create account →',auth_crear_y_empezar:'Create account and start →',auth_ya_tienes:'Already have an account?',auth_iniciar_sesion_link:'Sign in',auth_nuevo:'New to MoneyNest?',auth_email:'Email address',auth_password:'Password',auth_password_nueva:'Password (min. 8 characters)',auth_confirmar_password:'Confirm password',auth_entrar:'Sign in',auth_entrando:'Signing in…',auth_enviando:'Sending…',auth_creando:'Creating account…',auth_guardando:'Saving…',auth_olvide_contrasena:'Forgot your password?',auth_recuperar:'Recover access',auth_resetear:'Reset password',auth_reset_desc:'We will send you a link to reset your password.',auth_enviar_enlace:'Send reset link',auth_volver_login:'Back to login',auth_seguridad:'Security',auth_nueva_contrasena:'New password',auth_nueva_pw_desc:'Choose a strong password for your MoneyNest account.',auth_guardar_contrasena:'Save password',auth_o:'or continue with email',auth_24h_gratis:'24h free',auth_24h_desc:'Signing up activates your free trial. No card required.',auth_plan_prueba:'⏳ Trial plan',auth_tiempo_restante:'trial time remaining',auth_trial_restante:'Trial time remaining',auth_registrate_desc:'Sign up to link your 24h trial to your email.',auth_crear_cuenta_gratis:'Create free account →',auth_ya_tengo_cuenta:'Already have an account — Sign in',auth_desbloquear_ahora:'Unlock now',auth_plan_local_desc:'With MoneyNest (€6.99) it never expires.',auth_comprar_local:'Buy MoneyNest — €6.99 →',auth_comprar_local_cta:'Buy MoneyNest — €6.99 →',auth_que_pasa:'What happens when it expires?',auth_plan_local_cta_desc:'The app will lock. With MoneyNest (€6.99) it unlocks forever.',auth_acceso_bloqueado:'Access locked',auth_prueba_expirada:'Your 24-hour trial has expired.',auth_datos_seguros:'Your data is safe — just unlock the app.',auth_plan_local:'Local Plan',auth_pago_unico:'one-time',auth_feat_acceso_inmediato:'Immediate access, no expiry',auth_feat_datos:'All your data preserved',auth_feat_ilimitado:'Unlimited entries and categories',auth_feat_export:'PDF and Excel export',auth_restaurar:'Already purchased? Restore access',auth_plan_local_activo:'Local Plan active',auth_acceso_desbloqueado:'Access unlocked',auth_datos_locales:'Your data is stored on this device.',auth_sesion_activa:'Session active',auth_activar_nube:'Activate cloud sync',auth_plan_pro:'Pro Plan',auth_año:'year',auth_feat_sync:'Multi-device sync',auth_feat_backup:'Automatic backups',auth_feat_soporte:'Priority support',auth_feat_beta:'Beta features first',auth_pro_note_used:'Free trial already used.',auth_plan_pro_activo:'Pro Plan active',auth_gracias_pro:'Thanks for being Pro!',auth_suscripcion_activa:'subscription active',auth_prueba_activa:'Free trial active',auth_hasta:'until',auth_feat_cloud:'Cloud sync',auth_feat_backups:'Auto backups',auth_vincular_pago_desc:'Link a payment method before your trial expires.',auth_vincular_pago:'Link payment method',auth_cancelar_pro:'Cancel Pro subscription',auth_cancelar_pro_nota:'If you cancel, your plan reverts to Local.',auth_cerrar_sesion:'Sign out',auth_sesion_cerrada:'Signed out.',auth_sesion_iniciada:'Signed in successfully.',auth_cuenta_creada:'Account created and signed in!',auth_confirma_email:'Account created! Check your email to confirm.',auth_revisa_email:'Check your inbox to confirm your account.',auth_enlace_enviado:'Link sent. Check your email.',auth_pw_actualizada:'Password updated successfully.',auth_ver_plan:'View my plan',auth_tu_plan:'Your current plan',auth_plan_local_badge:'Local',auth_bloqueado:'Locked',auth_confirmar_cancelar_pro:'Are you sure you want to cancel Pro?',auth_pro_cancelado:'Pro cancelled. You still have Local plan.',auth_error_campos:'Fill in all fields.',auth_error_email:'Invalid email.',auth_error_pw_corta:'Password must be at least 8 characters.',auth_error_pw_no_coincide:'Passwords do not match.',auth_error_credenciales:'Incorrect email or password.',auth_error_no_confirmado:'Confirm your email before signing in.',auth_error_email_existe:'This email is already registered.',auth_error_rate:'Too many attempts. Please wait a few minutes.',auth_error_rate_reset:'Too many requests. Wait 1 hour.',auth_error_oauth:'Error connecting to provider.',auth_error_generico:'An error occurred. Please try again.',
    disponible: 'Available',
    exportar: 'Export',
    theme_dark: 'Dark mode', theme_light: 'Light mode',
    patrimonio_neto: 'Net Worth',
    ingresos_mes: 'Income this month',
    gastos_mes: 'Expenses this month',
    cash_flow: 'Cash Flow',
    ahorro_mes: 'Savings this month',
    sin_movimientos: 'No transactions recorded yet',
    actividad_reciente: 'Recent activity',
    ultimas_transacciones: 'Latest transactions',
    ver_todo: 'See all →',
    evolucion_patrimonio: 'Net Worth evolution',
    ultimos_6_meses: 'Last 12 months',
    gastos_categoria: 'Expenses by category',
    insights: 'Insights',
    basado_datos: 'Based on your real data',
    todo_orden: 'Everything on track this month!',
    sigue_registrando: 'Keep recording your transactions.',
    primer_mes: 'First month',
    ingresos_año: 'Income',
    gastos_año: 'Expenses',
    resumen_financiero: 'Financial summary',
    hola: 'Hello,',
    btn_guardar: 'Save', btn_cancelar: 'Cancel',
    btn_eliminar: 'Delete', btn_editar: 'Edit',
    btn_nuevo: 'New', btn_exportar: '↗ Export',
    btn_nuevo_ingreso: '+ New income',
    btn_nuevo_gasto: '+ New expense',
    btn_nueva_inversion: '+ New investment',
    btn_nueva_deuda: '+ New debt',
    btn_nuevo_objetivo: '+ New goal',
    page_ingresos: 'Income',
    sub_ingresos: 'All your income',
    page_gastos: 'Expenses',
    sub_gastos: 'All your expenses',
    page_inversiones: 'Investments',
    page_cuentas: 'Accounts',
    page_deudas: 'Debts',
    page_objetivos: 'Goals',
    page_presupuestos: 'Budgets',
    page_analisis: 'Analysis',
    page_configuracion: 'Settings',
    page_faq: 'FAQ', page_sugerencias: 'Suggestions',
    sug_tipo_sug: 'Suggestion', sug_tipo_preg: 'Question',
    sug_placeholder: 'Describe your idea or question...', sug_enviar_email: '📧 Send by email', sug_guardar: '💾 Save locally',
    ob_bienvenida: 'Welcome to MoneyNest! 🪺',
    ob_bienvenida_sub: "What's your name? We'll personalize your experience.",
    ob_idioma: 'Choose your language',
    ob_idioma_sub: 'Select the language you want to use the app in.',
    ob_tema: 'Choose your theme',
    ob_tema_sub: 'You can change it anytime from the sidebar.',
    ob_listo: 'All set!',
    ob_listo_sub: 'Want to see an interactive tour? We will guide you step by step with real demo data.',
    ob_continuar: 'Continue →',
    ob_empezar: 'Get started!',
    ob_omitir: 'Skip',
    ob_atras: '← Back',
    ob_ver_tutorial: 'See tutorial',
    ob_ir_directo: 'Go direct',
    ob_3min: '~3 minutes',
    ob_exploro: 'I\'ll explore',
    ob_oscuro: 'Dark', ob_claro: 'Light',
    ob_nombre_placeholder: 'Your name...',
    ob_s1_pill: 'Step 1 of 3 · Welcome',
    ob_s1_h1: 'Your money,', ob_s1_h2: 'finally <span>under control.</span>',
    ob_s1_lead: 'MoneyNest is your personal financial dashboard. Income, expenses, investments and goals — all in one place, always with you.',
    ob_s1_placeholder: 'What\'s your name?', ob_s1_hint: 'Just to personalize your dashboard — no account, no email',
    ob_s1_cta: 'Begin',
    ob_s2_pill: 'Step 2 of 3 · Customize',
    ob_s2_h1: 'Your look,', ob_s2_h2: 'your <span>rules.</span>',
    ob_s2_lead: 'Choose language and theme. You can change it anytime from Settings.',
    ob_s2_idioma_lbl: 'Language', ob_s2_tema_lbl: 'Appearance',
    ob_s2_siguiente: 'Next',
    ob_s3_pill: 'Step 3 of 3 · Start',
    ob_s3_h1: 'Where shall we', ob_s3_h2: '<span>begin?</span>',
    ob_s3_lead: 'Your dashboard is ready. Choose how you want to start your MoneyNest experience.',
    ob_s3_greeting: 'All set',
    ob_opt_tutorial_lbl: 'Guided tour', ob_opt_tutorial_sub: 'We\'ll show you everything step by step with real examples (~3 min)',
    ob_opt_demo_lbl: 'Explore with sample data', ob_opt_demo_sub: 'See the full app before adding your own data',
    ob_opt_direct_lbl: 'Start directly', ob_opt_direct_sub: 'I\'ll explore on my own, I know what I need',
    ob_s3_cta: 'Let\'s go! 🚀',
    ob_continuar: 'Continue',
    ob_bank_h1: 'Want to import', ob_bank_h2: 'your bank data?',
    ob_bank_lead: 'Import your transactions to start using MoneyNest with your real data.',
    ob_bank_opt_sub: 'Upload a CSV or Excel (XLSX) statement from your bank',
    ob_bank_done: 'Data imported successfully',
    ob_bank_skip: 'Do it later',
    ob_left2_title: 'Designed for you,', ob_left2_sub: 'from day one.',
    ob_left2_desc: 'Choose the language and theme that best suits your way of working.',
    ob_left2_idioma_lbl: '🌍 Active language', ob_left2_tema_lbl: '🎨 Theme',
    ob_feat_ingresos: 'Income & Expenses', ob_feat_ingresos_sub: 'Total control of your flow',
    ob_feat_inv: 'Investments', ob_feat_inv_sub: 'Track your portfolio',
    ob_feat_obj: 'Goals', ob_feat_obj_sub: 'Reach your financial targets',
    ob_feat_priv: '100% private', ob_feat_priv_sub: 'Your data only on your device',
    ob_feat_gratis: 'No subscription', ob_feat_gratis_sub: 'Everything free, no limits',
    ob_left3_ready: '✨ Your dashboard is ready — start adding your data',
    sin_datos: 'Not enough data',
    buscar: 'Search...',
    todas_cats: 'All categories',
    periodo: 'Period:',
    este_mes: 'This month',
    mes_anterior: 'Last month',
    este_año: 'This year',
    todo: 'All',
    personalizado: 'Custom',
    cfg_perfil: 'Your profile', cfg_nombre: 'Name', cfg_guardar: '💾 Save',
    cfg_idioma: 'Language', cfg_apariencia: 'Appearance',
    cfg_oscuro: 'Dark', cfg_claro: 'Light', cfg_activo: '✓ Active',
    cfg_apariencia_tip: 'You can also change it from the sidebar toggle.',
    cfg_datos: 'Import / Export data',
    cfg_exportar_pdf: '📊 Export full report (PDF / Excel)',
    cfg_backup_json: '📤 Backup (JSON)',
    cfg_drive: '☁️ Save to Google Drive',
    cfg_importar: '↓ Import backup',
    cfg_borrar_todo: '🗑 Delete all data',
    cfg_demo_titulo: 'Demo mode',
    cfg_demo_activo_lbl: '● Active · sample data loaded',
    cfg_demo_inactivo_lbl: 'Explore the app with sample data',
    cfg_demo_desc_on: 'Data is for demo. Use the floating 🟡 Demo mode button (bottom right) to exit.',
    cfg_demo_desc_off: 'Explore all features without entering your own data. Choose a profile and load realistic data instantly.',
    cfg_demo_salir: '🏁 Exit to real mode',
    cfg_demo_activar: '🚀 Activate demo mode',
    cfg_info: 'App information', cfg_version_lbl: 'Version',
    cfg_ver_tutorial: '🎓 View tutorial',
    cfg_cats_titulo: 'Custom categories',
    cfg_cats_sub: 'Emojis are assigned automatically',
    cfg_nueva_cat: 'New category...',
    cfg_emoji_tip: 'Tap the emoji to choose, then type the name',
    cfg_anadir: '+ Add', cfg_personaliza_sub: 'Customize your MoneyNest experience',
    cat_type_ingreso: 'Income', cat_type_gasto: 'Expenses',
    cat_type_inversion: 'Investments', cat_type_deuda: 'Debts', cat_type_objetivo: 'Goals',
    trial_pill: 'Free trial', trial_days_left: 'days left',
    guest_gate_title: 'Create your account to continue',
    guest_gate_desc: 'To add transactions you need a free account. Start with a 7-day full trial.',
      bn_analisis: 'Analysis',
    bn_config: 'Settings',
    bn_gastos: 'Expenses',
    bn_inicio: 'Home',
    btn_aportar_confirm: 'Contribute',
    btn_cuenta_cancelar: 'Cancel',
    btn_cuenta_guardar: 'Save',
    btn_liquidar_confirm: 'Liquidate',
    btn_monthly_cerrar: 'Close',
    btn_monthly_pdf: '📄 Export PDF',
    btn_presupuesto_cancelar: 'Cancel',
    btn_presupuesto_guardar: 'Save',
    btn_registrar_pago: 'Record payment',
    btn_tax_cancelar: 'Cancel',
    btn_tax_guardar: 'Save',
    btn_trans_cancelar: 'Cancel',
    btn_trans_transferir: 'Transfer',
    cliente_editar: 'Edit Client',
    cliente_nuevo: 'New Client',
    cobrado_btn: '✓ Collected',
    confirm_borrar_todo: 'Delete ALL data? This action cannot be undone.',
    confirm_borrar_todo_btn: 'Delete all',
    confirm_borrar_todo_titulo: 'Delete all data',
    confirm_btn_cancelar: 'Cancel',
    confirm_btn_eliminar: 'Delete',
    confirm_cerrar_sesion: 'Sign out? Your plan and financial data will remain on this device.',
    confirm_cerrar_sesion_btn: 'Sign out',
    confirm_cerrar_sesion_titulo: 'Sign out',
    confirm_eliminar_cliente: 'Delete this client?',
    confirm_eliminar_cliente_titulo: 'Delete client',
    confirm_eliminar_cuenta: 'Delete this account?',
    confirm_eliminar_cuenta_titulo: 'Delete account',
    confirm_eliminar_deuda: 'Delete this debt?',
    confirm_eliminar_deuda_titulo: 'Delete debt',
    confirm_eliminar_gasto: 'Delete this expense?',
    confirm_eliminar_gasto_titulo: 'Delete expense',
    confirm_eliminar_ingreso: 'Delete this income? This action cannot be undone.',
    confirm_eliminar_ingreso_titulo: 'Delete income',
    confirm_eliminar_inversion: 'Delete this investment?',
    confirm_eliminar_inversion_titulo: 'Delete investment',
    confirm_eliminar_objetivo: 'Delete this goal?',
    confirm_eliminar_objetivo_titulo: 'Delete goal',
    confirm_eliminar_presupuesto: 'Delete the budget for',
    confirm_eliminar_presupuesto_titulo: 'Delete budget',
    confirm_importar: 'Import data? All current data will be replaced.',
    confirm_importar_btn: 'Import',
    confirm_importar_titulo: 'Import data',
    confirm_saldo_neg: 'will leave the account with a negative balance. Continue?',
    confirm_saldo_neg_btn: 'Continue anyway',
    confirm_saldo_neg_titulo: '⚠️ Insufficient balance',
    confirm_salir_demo: 'Exit demo mode and delete sample data?',
    confirm_salir_demo_btn: 'Exit to real mode',
    confirm_salir_demo_titulo: 'Exit demo',
    confirm_titulo_def: 'Are you sure?',
    cuenta_nombre_ph: 'Santander checking account...',
    cuenta_sin_cuenta: 'No account',
    deuda_calculadora_ph: 'How much can you pay per month? (€)',
    deuda_calcular_btn: 'Calculate',
    deuda_input_invalido: 'Enter a valid monthly amount.',
    deuda_libre_pagar: 'Paying per month you would be debt-free in approx.',
    deuda_sin_pendientes: '✅ You have no pending debts!',
    drive_guardado: '✓ Saved',
    drive_guardando: '⏳ Saving...',
    drive_local: '(local download)',
    err_concepto_importe: 'Description and amount required',
    err_cuenta_no_encontrada: 'Account not found',
    err_cuenta_origen: 'Select the account to receive the capital',
    err_cuentas_distintas: 'Select different accounts',
    err_excel: 'Error generating Excel',
    err_exportar: 'Export error',
    err_importe_aportar: 'Enter the amount',
    err_importe_pago: 'Enter the payment amount',
    err_importe_valido: 'Enter a valid amount',
    err_inversion_no_encontrada: 'Investment not found',
    err_leer_archivo: 'Error reading file',
    err_limite_valido: 'Enter a valid limit',
    err_nombre_importe: 'Name and amount required',
    err_nombre_meta: 'Name and goal required',
    err_nombre_requerido: 'Name required',
    err_pdf: 'Error generating PDF',
    err_selecciona_cat: 'Select a category',
    err_selecciona_cuenta: 'Select an account',
    err_valor_salida: 'Enter the exit value',
    gc_ahora_no: 'Not now',
    gc_crear: 'Create goal 🎯',
    gc_sub: 'Setting a savings goal is the first step to improving your finances. We will help you track it automatically.',
    gc_titulo: 'What is your goal this month?',
    guardando: '⏳ Saving…',
    intro_tagline: 'Your finances, in order',
    inversion_saldo_hint: 'Select an account to see available balance',
    inversion_ya_liquidada: 'This investment was already closed on',
    libre: 'Free',
    meses: 'months',
    mini_intro_tagline: 'Your finances, in order',
    mission_bar_sub: 'Add your first income to get started',
    mission_bar_titulo: 'Complete your first mission',
    mission_modal_cerrar: 'Close',
    mission_modal_sub: 'Complete these actions to discover MoneyNest in 5 minutes.',
    mission_modal_titulo: '🚀 Your starter missions',
    modal_aportar_cuenta_lbl: 'Source account',
    modal_aportar_existente_lbl: '🏦 Existing money',
    modal_aportar_existente_sub: 'Deducted from available',
    modal_aportar_fuente: 'Where does this money come from?',
    modal_aportar_importe_lbl: 'Amount to contribute (€) *',
    modal_aportar_nuevo_lbl: '💸 New money',
    modal_aportar_nuevo_sub: 'Does not affect available',
    modal_cuenta_color_lbl: 'Identifying color',
    modal_cuenta_nombre_lbl: 'Account name *',
    modal_cuenta_nombre_ph: 'Santander checking account...',
    modal_cuenta_notas_lbl: 'Institution / Notes',
    modal_cuenta_notas_ph: 'Santander, ING...',
    modal_cuenta_saldo_hint: 'Free to use right now',
    modal_cuenta_saldo_lbl: 'Available money (€)',
    modal_cuenta_tipo_ahorro: '💰 Savings',
    modal_cuenta_tipo_banco: '🏦 Bank',
    modal_cuenta_tipo_cripto: '₿ Crypto',
    modal_cuenta_tipo_efectivo: '💵 Cash',
    modal_cuenta_tipo_inversion: '📈 Investment',
    modal_cuenta_tipo_lbl: 'Type',
    modal_cuenta_tipo_otro: '📁 Other',
    modal_cuenta_titulo: 'New Account',
    modal_cuenta_titulo_editar: 'Edit Account',
    modal_cuenta_valor_hint: 'Total balance including assets',
    modal_cuenta_valor_lbl: 'Total account value (€)',
    modal_deuda_cat_lbl: 'Category',
    modal_deuda_interes_lbl: 'Annual interest (%)',
    modal_deuda_nombre_lbl: 'Name *',
    modal_deuda_notas_lbl: 'Notes',
    modal_deuda_nueva_cat_lbl: 'New category',
    modal_deuda_pagado_lbl: 'Already paid (€)',
    modal_deuda_total_lbl: 'Total debt (€) *',
    modal_deuda_vencimiento_lbl: 'Maturity',
    modal_export_desc: 'Export your financial data in your preferred format.',
    modal_export_excel_sub: 'Income, expenses, investments, debts, goals, clients',
    modal_export_excel_titulo: 'Full Excel (all sheets)',
    modal_export_json_sub: 'All data · To restore later',
    modal_export_json_titulo: 'Backup (JSON)',
    modal_export_pdf_sub: 'Visual summary with all sections',
    modal_export_pdf_titulo: 'Full PDF report',
    modal_export_seccion: 'Export by section',
    modal_export_titulo: 'Export data',
    modal_gasto_cat_lbl: 'Category',
    modal_gasto_concepto_lbl: 'Description *',
    modal_gasto_cuenta_lbl: 'Account *',
    modal_gasto_cuenta_sub: '(required)',
    modal_gasto_fecha_lbl: 'Date',
    modal_gasto_importe_lbl: 'Amount (€) *',
    modal_gasto_notas_lbl: 'Notes',
    modal_gasto_nueva_cat_lbl: 'New category',
    modal_ingreso_cat_lbl: 'Category',
    modal_ingreso_concepto_lbl: 'Description *',
    modal_ingreso_cuenta_lbl: 'Account *',
    modal_ingreso_cuenta_sub: '(required)',
    modal_ingreso_fecha_lbl: 'Date',
    modal_ingreso_importe_lbl: 'Amount (€) *',
    modal_ingreso_notas_lbl: 'Notes',
    modal_ingreso_nueva_cat_lbl: 'New category',
    modal_inv_capital_lbl: 'Capital invested (€) *',
    modal_inv_cat_lbl: 'Category',
    modal_inv_cuenta_lbl: 'Source account *',
    modal_inv_fecha_lbl: 'Entry date',
    modal_inv_nombre_lbl: 'Name *',
    modal_inv_notas_lbl: 'Notes',
    modal_inv_nueva_cat_lbl: 'New category',
    modal_inv_rentabilidad_hint: 'Only for assets with predictable return',
    modal_inv_rentabilidad_lbl: 'Expected return (%)',
    modal_liquidar_cuenta_lbl: 'Account to deposit to',
    modal_liquidar_info: '✓ Capital will be returned · Gain recorded as income · Loss recorded as expense',
    modal_liquidar_rentabilidad_lbl: 'Or actual return (%)',
    modal_liquidar_titulo: '💰 Liquidate investment',
    modal_liquidar_valor_lbl: 'Exit value (€)',
    modal_monthly_titulo: '📋 Month close',
    modal_obj_actual_lbl: 'Saved so far (€)',
    modal_obj_cat_lbl: 'Category',
    modal_obj_color_lbl: 'Color',
    modal_obj_fecha_lbl: 'Goal date',
    modal_obj_imagen_sub: 'Optional · appears as card background',
    modal_obj_imagen_titulo: 'Goal image',
    modal_obj_meta_lbl: 'Goal (€) *',
    modal_obj_nombre_lbl: 'Name *',
    modal_obj_notas_lbl: 'Notes',
    modal_obj_nueva_cat_lbl: 'New category',
    modal_obj_quitar_btn: '✕ Remove',
    modal_obj_subir_btn: '📷 Upload image',
    modal_pago_fecha_lbl: 'Payment date',
    modal_pago_importe_lbl: 'Payment amount (€) *',
    modal_pres_cat_lbl: 'Category',
    modal_pres_limite_lbl: 'Monthly limit (€) *',
    modal_pres_nueva_cat_lbl: 'New category',
    modal_pres_titulo: 'Set Budget',
    modal_tax_autonomo: 'Self-employed / Freelance',
    modal_tax_custom: 'Custom',
    modal_tax_desc: 'In business mode, MoneyNest will automatically calculate tax reserve on your income.',
    modal_tax_empresa: 'Company (CT 25%)',
    modal_tax_irpf_hint: 'Withholding / Corporate tax',
    modal_tax_irpf_lbl: 'Income Tax (%)',
    modal_tax_iva_hint: 'VAT percentage to charge',
    modal_tax_iva_lbl: 'VAT (%)',
    modal_tax_regimen_lbl: 'Tax regime',
    modal_tax_startup: 'Startup / New company (CT 15%)',
    modal_tax_titulo: '⚙️ Tax settings',
    modal_trans_desde_lbl: 'From',
    modal_trans_hacia_lbl: 'To',
    modal_trans_importe_lbl: 'Amount (€) *',
    modal_trans_titulo: 'Transfer between accounts',
    nav_seccion_finanzas: 'Finance',
    nav_seccion_patrimonio: 'Net Worth',
    nav_seccion_planificacion: 'Planning',
    nav_seccion_principal: 'Main',
    nav_seccion_sistema: 'System',
    nav_sub_analisis: 'Insights & Trends',
    nav_sub_cuentas: 'Accounts',
    nav_sub_dashboard: 'Overview',
    nav_sub_deudas: 'Debts',
    nav_sub_faq: 'Help',
    nav_sub_gastos: 'Expenses',
    nav_sub_ingresos: 'Income',
    nav_sub_inversiones: 'Investments',
    nav_sub_objetivos: 'Goals',
    nav_sub_patrimonio: 'Your wealth',
    nav_sub_presupuestos: 'Budgets',
    ob_skip: 'Skip',
    quick_add_categoria: 'Category',
    quick_add_descripcion_ph: 'Description (optional)',
    quick_add_gasto: '💸 Expense',
    quick_add_guardar: 'Save',
    quick_add_ingreso: '💰 Income',
    quick_add_titulo: '⚡ Quick add',
    story_cerrar: 'Close',
    story_siguiente: 'Next →',
    toast_aportado_ok: 'Contributed to goal ✓',
    toast_cat_añadida: 'Category added ✓',
    toast_cat_existe: 'That category already exists',
    toast_cuenta_eliminada: 'Account deleted',
    toast_cuenta_guardada: 'Account saved ✓',
    toast_cuenta_min: 'You need at least one account',
    toast_datos_eliminados: 'All data deleted — settings reset',
    toast_deuda_eliminada: 'Debt deleted',
    toast_deuda_guardada: 'Debt saved ✓',
    toast_deudas_exportadas: 'Debts exported ✓',
    toast_drive_error: 'Drive unavailable — downloaded locally',
    toast_drive_ok: '☁️ Backup saved to Google Drive ✓',
    toast_espacio_insuficiente: '💾 Not enough space. Use a smaller image.',
    toast_excel_exportado: 'Excel exported ✓',
    toast_exportado: 'Exported ✓',
    toast_gasto_eliminado: 'Expense deleted',
    toast_gasto_guardado: 'Expense saved ✓',
    toast_gastos_exportados: 'Expenses exported ✓',
    toast_guardado: 'Saved ✓',
    toast_imagen_actualizada: 'Image updated ✓',
    toast_imagen_eliminada: 'Image removed',
    toast_ingreso_eliminado: 'Income deleted',
    toast_ingreso_guardado: 'Income saved ✓',
    toast_ingresos_exportados: 'Income exported ✓',
    toast_inversion_eliminada: 'Investment deleted',
    toast_inversion_guardada: 'Investment recorded ✓ · Balance updated',
    toast_inversiones_exportadas: 'Investments exported ✓',
    toast_json_exportado: 'Backup exported ✓',
    toast_json_importado: 'Data imported ✓',
    toast_liquidado_ganancia: 'Investment closed · Gain recorded',
    toast_liquidado_neutro: 'Investment closed',
    toast_liquidado_perdida: 'Investment closed · Loss recorded',
    toast_objetivo_eliminado: 'Goal deleted',
    toast_objetivo_guardado: 'Goal saved ✓',
    toast_objetivos_exportados: 'Goals exported ✓',
    toast_pago_registrado: 'Payment recorded ✓',
    toast_pdf_exportado: 'PDF exported ✓',
    toast_perfil_guardado: 'Profile saved ✓',
    toast_presupuesto_eliminado: 'Budget deleted',
    toast_presupuesto_guardado: 'Budget saved ✓',
    toast_presupuestos_exportados: 'Budgets exported ✓',
    toast_transferencia_ok: 'Transfer completed ✓',
    topbar_activar_pro: '⚡ Upgrade Pro',
    topbar_cambiar_tema: 'Change theme',
    topbar_disponible: 'Available',
    topbar_importar: '⬇ Import',
    topbar_exportar: '⬆ Export',
    nav_logros: 'Achievements',
    nav_facturacion: 'Billing & Plan', nav_sub_facturacion: 'Your plan and payments',
    nav_sub_logros: 'Your milestones',
    cfg_notificaciones: 'Notifications',
    tut_salir: '✕ Exit',
    tut_siguiente: 'Next →',
    ver_movimientos_btn: '📋 View movements',
    deuda_libertad_titulo: '🏁 Financial Freedom Planning',
    deuda_libertad_sub: 'Set your goal and calculate how much you need to pay',
    deuda_libertad_objetivo_lbl: 'I want to be debt-free in',
    deuda_libertad_calcular: 'Calculate payment',
    deuda_libertad_resultado_pre: 'To be free in',
    deuda_libertad_resultado_mid: 'you need to pay:',
    deuda_libertad_mensual: 'Monthly',
    deuda_libertad_semanal: 'Weekly',
    deuda_libertad_diario: 'Daily',
    deuda_libertad_sin_deuda: 'You are already debt-free! 🎉',
    deuda_libertad_invalido: 'Please enter a valid period (number greater than 0).',
    anos: 'years',
    semanas: 'weeks',
    dias: 'days',
    deuda_activar_estrategia: 'Activate this strategy',
    deuda_estrategia_activa: '✓ Active Strategy',
    deuda_info_automatizacion: 'Your payments will be distributed according to this amount to meet your goal within the planned time.',
    topbar_prueba_termina_en: 'Trial ends in:',
    horas: 'h',
    minutos: 'm',
},
  it: {
    nav_principal: 'Principale', nav_finanzas: 'Finanze',
    nav_planificacion: 'Pianificazione', nav_patrimonio_sec: 'Patrimonio',
    nav_sistema: 'Sistema',
    nav_dashboard: 'Dashboard', nav_ingresos: 'Entrate',
    nav_gastos: 'Spese', nav_inversiones: 'Investimenti',
    nav_deudas: 'Debiti', nav_objetivos: 'Obiettivi',
    nav_presupuestos: 'Budget', nav_cuentas: 'Conti', nav_categorias: 'Categorie',
    nav_patrimonio: 'Patrimonio', nav_analisis: 'Analisi',
    nav_configuracion: 'Impostazioni', nav_faq: 'FAQ', nav_sugerencias: 'Suggerimenti',
    nav_billing: 'Piano & Fatturazione',
    nav_cerrar_sesion: 'Esci',
    disponible: 'Disponibile', exportar: 'Esportare',
    theme_dark: 'Modalità scura', theme_light: 'Modalità chiara',
    patrimonio_neto: 'Patrimonio Netto',
    ingresos_mes: 'Entrate questo mese', gastos_mes: 'Spese questo mese',
    cash_flow: 'Flusso di cassa', ahorro_mes: 'Risparmio questo mese',
    sin_movimientos: 'Nessuna transazione registrata',
    actividad_reciente: 'Attività recente', ultimas_transacciones: 'Ultime transazioni',
    ver_todo: 'Vedi tutto →', evolucion_patrimonio: 'Evoluzione del patrimonio',
    ultimos_6_meses: 'Ultimi 12 mesi', gastos_categoria: 'Spese per categoria',
    insights: 'Analisi', basado_datos: 'Basato sui tuoi dati reali',
    todo_orden: 'Tutto in ordine questo mese!', sigue_registrando: 'Continua a registrare le tue transazioni.',
    primer_mes: 'Primo mese', ingresos_año: 'Entrate', gastos_año: 'Spese',
    resumen_financiero: 'Riepilogo finanziario', hola: 'Ciao,',
    btn_guardar: 'Salva', btn_cancelar: 'Annulla', btn_eliminar: 'Elimina',
    btn_editar: 'Modifica', btn_nuevo: 'Nuovo', btn_exportar: '↗ Esportare',
    btn_nuevo_ingreso: '+ Nuova entrata', btn_nuevo_gasto: '+ Nuova spesa',
    btn_nueva_inversion: '+ Nuovo investimento', btn_nueva_deuda: '+ Nuovo debito',
    btn_nuevo_objetivo: '+ Nuovo obiettivo',
    page_ingresos: 'Entrate', sub_ingresos: 'Tutte le tue entrate',
    page_gastos: 'Spese', sub_gastos: 'Tutte le tue spese',
    page_inversiones: 'Investimenti', page_cuentas: 'Conti',
    page_deudas: 'Debiti', page_objetivos: 'Obiettivi',
    page_presupuestos: 'Budget', page_analisis: 'Analisi',
    page_configuracion: 'Impostazioni',
    page_faq: 'Domande frequenti', page_sugerencias: 'Suggerimenti',
    sug_tipo_sug: 'Suggerimento', sug_tipo_preg: 'Domanda',
    sug_placeholder: 'Descrivi la tua idea o domanda...', sug_enviar_email: '📧 Invia per email', sug_guardar: '💾 Salva localmente',
    ob_bienvenida: 'Benvenuto su MoneyNest! 🪺',
    ob_bienvenida_sub: 'Come ti chiami? Personalizzeremo l\'esperienza per te.',
    ob_idioma: 'Scegli la tua lingua', ob_idioma_sub: 'Seleziona la lingua che vuoi usare.',
    ob_tema: 'Scegli il tuo tema', ob_tema_sub: 'Puoi cambiarlo in qualsiasi momento.',
    ob_listo: 'Tutto configurato!',
    ob_listo_sub: 'Vuoi vedere un tour interattivo?',
    ob_continuar: 'Continua →', ob_empezar: 'Inizia!',
    ob_omitir: 'Salta', ob_atras: '← Indietro',
    ob_ver_tutorial: 'Vedere il tutorial', ob_ir_directo: 'Vai direttamente',
    ob_3min: '~3 minuti', ob_exploro: 'Esplorerò',
    ob_oscuro: 'Scuro', ob_claro: 'Chiaro',
    ob_nombre_placeholder: 'Il tuo nome...',
    ob_s1_pill: 'Passo 1 di 3 · Benvenuto',
    ob_s1_h1: 'Il tuo denaro,', ob_s1_h2: 'finalmente <span>sotto controllo.</span>',
    ob_s1_lead: 'MoneyNest è il tuo pannello finanziario personale. Entrate, uscite, investimenti e obiettivi — tutto in un unico posto.',
    ob_s1_placeholder: 'Come ti chiami?', ob_s1_hint: 'Solo per personalizzare — nessun account, nessuna email',
    ob_s1_cta: 'Iniziare',
    ob_s2_pill: 'Passo 2 di 3 · Personalizza',
    ob_s2_h1: 'Il tuo stile,', ob_s2_h2: 'le tue <span>regole.</span>',
    ob_s2_lead: 'Scegli lingua e tema. Puoi cambiarlo quando vuoi dalle Impostazioni.',
    ob_s2_idioma_lbl: 'Lingua', ob_s2_tema_lbl: 'Aspetto',
    ob_s2_siguiente: 'Avanti',
    ob_s3_pill: 'Passo 3 di 3 · Cominciamo',
    ob_s3_h1: 'Da dove', ob_s3_h2: '<span>iniziamo?</span>',
    ob_s3_lead: 'Il tuo pannello è pronto. Scegli come vuoi iniziare la tua esperienza con MoneyNest.',
    ob_s3_greeting: 'Tutto pronto',
    ob_opt_tutorial_lbl: 'Tour guidato', ob_opt_tutorial_sub: 'Ti guidiamo passo a passo con esempi reali (~3 min)',
    ob_opt_demo_lbl: 'Esplora con dati di esempio', ob_opt_demo_sub: 'Vedi l\'app completa prima di aggiungere i tuoi dati',
    ob_opt_direct_lbl: 'Inizia direttamente', ob_opt_direct_sub: 'Esploro da solo, so già quello che mi serve',
    ob_s3_cta: 'Iniziamo! 🚀',
    ob_left2_title: 'Progettata per te,', ob_left2_sub: 'fin dal primo giorno.',
    ob_left2_desc: 'Scegli la lingua e il tema che si adatta meglio al tuo modo di lavorare.',
    ob_left2_idioma_lbl: '🌍 Lingua attiva', ob_left2_tema_lbl: '🎨 Tema',
    ob_feat_ingresos: 'Entrate & Uscite', ob_feat_ingresos_sub: 'Controllo totale del tuo flusso',
    ob_feat_inv: 'Investimenti', ob_feat_inv_sub: 'Monitora il tuo portafoglio',
    ob_feat_obj: 'Obiettivi', ob_feat_obj_sub: 'Raggiungi i tuoi traguardi finanziari',
    ob_feat_priv: '100% privato', ob_feat_priv_sub: 'I tuoi dati solo sul tuo dispositivo',
    ob_feat_gratis: 'Nessun abbonamento', ob_feat_gratis_sub: 'Tutto gratis, senza limiti',
    ob_left3_ready: '✨ Il tuo pannello è pronto — inizia ad aggiungere i tuoi dati',
    sin_datos: 'Dati insufficienti', buscar: 'Cerca...',
    todas_cats: 'Tutte le categorie', periodo: 'Periodo:',
    este_mes: 'Questo mese', mes_anterior: 'Mese scorso',
    este_año: 'Quest\'anno', todo: 'Tutto', personalizado: 'Personalizzato',
    cfg_perfil: 'Il tuo profilo', cfg_nombre: 'Nome', cfg_guardar: '💾 Salva',
    cfg_idioma: 'Lingua', cfg_apariencia: 'Aspetto',
    cfg_oscuro: 'Scuro', cfg_claro: 'Chiaro', cfg_activo: '✓ Attivo',
    cfg_apariencia_tip: 'Puoi cambiarlo in qualsiasi momento dalla barra laterale.',
    cfg_datos: 'Importa / Esporta dati',
    cfg_exportar_pdf: '📊 Esporta report completo (PDF / Excel)',
    cfg_backup_json: '📤 Backup (JSON)',
    cfg_drive: '☁️ Salva su Google Drive',
    cfg_importar: '↓ Importa backup',
    cfg_borrar_todo: '🗑 Elimina tutti i dati',
    cfg_demo_titulo: 'Modalità demo',
    cfg_demo_activo_lbl: '● Attivo · dati di esempio caricati',
    cfg_demo_inactivo_lbl: 'Esplora l\'app con dati di esempio',
    cfg_demo_desc_on: 'I dati sono di esempio. Usa il pulsante flottante 🟡 Modalità demo (in basso a destra) per cambiare profilo o uscire.',
    cfg_demo_desc_off: 'Esplora tutte le funzioni senza inserire i tuoi dati. Scegli un profilo e carica dati realistici istantaneamente.',
    cfg_demo_salir: '🏁 Esci alla modalità reale',
    cfg_demo_activar: '🚀 Attiva modalità demo',
    cfg_info: 'Informazioni sull\'app', cfg_version_lbl: 'Versione',
    cfg_ver_tutorial: '🎓 Vedi tutorial',
    cfg_cats_titulo: 'Categorie personalizzate',
    cfg_cats_sub: 'Le emoji vengono assegnate automaticamente',
    cfg_nueva_cat: 'Nuova categoria...',
    cfg_emoji_tip: 'Tocca l\'emoji per scegliere, poi scrivi il nome',
    cfg_anadir: '+ Aggiungi', cfg_personaliza_sub: 'Personalizza la tua esperienza MoneyNest',
    cat_type_ingreso: 'Entrate', cat_type_gasto: 'Spese',
    cat_type_inversion: 'Investimenti', cat_type_deuda: 'Debiti', cat_type_objetivo: 'Obiettivi',
    trial_pill: 'Prova gratuita', trial_days_left: 'giorni rimasti',
    guest_gate_title: 'Crea il tuo account per continuare',
    guest_gate_desc: 'Per aggiungere movimenti hai bisogno di un account gratuito. Inizia con 7 giorni di prova completa.',
      bn_analisis: 'Analisi',
    bn_config: 'Impostazioni',
    bn_gastos: 'Spese',
    bn_inicio: 'Home',
    btn_aportar_confirm: 'Contribuisci',
    btn_cuenta_cancelar: 'Annulla',
    btn_cuenta_guardar: 'Salva',
    btn_liquidar_confirm: 'Liquidare',
    btn_monthly_cerrar: 'Chiudi',
    btn_monthly_pdf: '📄 Esporta PDF',
    btn_presupuesto_cancelar: 'Annulla',
    btn_presupuesto_guardar: 'Salva',
    btn_registrar_pago: 'Registra pagamento',
    btn_tax_cancelar: 'Annulla',
    btn_tax_guardar: 'Salva',
    btn_trans_cancelar: 'Annulla',
    btn_trans_transferir: 'Trasferisci',
    cliente_editar: 'Modifica Cliente',
    cliente_nuevo: 'Nuovo Cliente',
    cobrado_btn: '✓ Riscosso',
    confirm_borrar_todo: 'Eliminare TUTTI i dati? L\'azione non può essere annullata.',
    confirm_borrar_todo_btn: 'Elimina tutto',
    confirm_borrar_todo_titulo: 'Elimina tutti i dati',
    confirm_btn_cancelar: 'Annulla',
    confirm_btn_eliminar: 'Elimina',
    confirm_cerrar_sesion: 'Disconnessione? Il tuo piano e i dati rimarranno su questo dispositivo.',
    confirm_cerrar_sesion_btn: 'Disconnessione',
    confirm_cerrar_sesion_titulo: 'Disconnessione',
    confirm_eliminar_cliente: 'Eliminare questo cliente?',
    confirm_eliminar_cliente_titulo: 'Elimina cliente',
    confirm_eliminar_cuenta: 'Eliminare questo conto?',
    confirm_eliminar_cuenta_titulo: 'Elimina conto',
    confirm_eliminar_deuda: 'Eliminare questo debito?',
    confirm_eliminar_deuda_titulo: 'Elimina debito',
    confirm_eliminar_gasto: 'Eliminare questa spesa?',
    confirm_eliminar_gasto_titulo: 'Elimina spesa',
    confirm_eliminar_ingreso: 'Eliminare questa entrata? L\'azione non può essere annullata.',
    confirm_eliminar_ingreso_titulo: 'Elimina entrata',
    confirm_eliminar_inversion: 'Eliminare questo investimento?',
    confirm_eliminar_inversion_titulo: 'Elimina investimento',
    confirm_eliminar_objetivo: 'Eliminare questo obiettivo?',
    confirm_eliminar_objetivo_titulo: 'Elimina obiettivo',
    confirm_eliminar_presupuesto: 'Eliminare il budget per',
    confirm_eliminar_presupuesto_titulo: 'Elimina budget',
    confirm_importar: 'Importare dati? Tutti i dati attuali saranno sostituiti.',
    confirm_importar_btn: 'Importa',
    confirm_importar_titulo: 'Importa dati',
    confirm_saldo_neg: 'lascerà il conto con saldo negativo. Continuare?',
    confirm_saldo_neg_btn: 'Continua comunque',
    confirm_saldo_neg_titulo: '⚠️ Saldo insufficiente',
    confirm_salir_demo: 'Uscire da modalità demo e eliminare dati di esempio?',
    confirm_salir_demo_btn: 'Esci a modalità reale',
    confirm_salir_demo_titulo: 'Esci demo',
    confirm_titulo_def: 'Sei sicuro?',
    cuenta_nombre_ph: 'Conto corrente Santander...',
    cuenta_sin_cuenta: 'Nessun conto',
    deuda_calculadora_ph: 'Quanto puoi pagare al mese? (€)',
    deuda_calcular_btn: 'Calcola',
    deuda_input_invalido: 'Inserisci un importo mensile valido.',
    deuda_libre_pagar: 'Pagando al mese saresti senza debiti approx.',
    deuda_sin_pendientes: '✅ Non hai debiti in sospeso!',
    drive_guardado: '✓ Salvato',
    drive_guardando: '⏳ Salvataggio...',
    drive_local: '(download locale)',
    err_concepto_importe: 'Descrizione e importo richiesti',
    err_cuenta_no_encontrada: 'Conto non trovato',
    err_cuenta_origen: 'Seleziona il conto per ricevere il capitale',
    err_cuentas_distintas: 'Seleziona conti diversi',
    err_excel: 'Errore di generazione Excel',
    err_exportar: 'Errore di esportazione',
    err_importe_aportar: 'Inserisci l\'importo',
    err_importe_pago: 'Inserisci l\'importo del pagamento',
    err_importe_valido: 'Inserisci un importo valido',
    err_inversion_no_encontrada: 'Investimento non trovato',
    err_leer_archivo: 'Errore di lettura del file',
    err_limite_valido: 'Inserisci un limite valido',
    err_nombre_importe: 'Nome e importo richiesti',
    err_nombre_meta: 'Nome e obiettivo richiesti',
    err_nombre_requerido: 'Nome richiesto',
    err_pdf: 'Errore di generazione PDF',
    err_selecciona_cat: 'Seleziona una categoria',
    err_selecciona_cuenta: 'Seleziona un conto',
    err_valor_salida: 'Inserisci il valore di uscita',
    gc_ahora_no: 'Non ora',
    gc_crear: 'Crea obiettivo 🎯',
    gc_sub: 'Impostare un obiettivo di risparmio è il primo passo. Ti aiuteremo a monitorarlo automaticamente.',
    gc_titulo: 'Qual è il tuo obiettivo questo mese?',
    guardando: '⏳ Salvataggio…',
    intro_tagline: 'Le tue finanze, in ordine',
    inversion_saldo_hint: 'Seleziona un conto per vedere il saldo disponibile',
    inversion_ya_liquidada: 'Questo investimento è stato già chiuso il',
    libre: 'Libero',
    meses: 'mesi',
    mini_intro_tagline: 'Le tue finanze, in ordine',
    mission_bar_sub: 'Aggiungi il tuo primo reddito per iniziare',
    mission_bar_titulo: 'Completa la tua prima missione',
    mission_modal_cerrar: 'Chiudi',
    mission_modal_sub: 'Completa questi step per scoprire MoneyNest in 5 minuti.',
    mission_modal_titulo: '🚀 Le tue missioni di avvio',
    modal_aportar_cuenta_lbl: 'Conto sorgente',
    modal_aportar_existente_lbl: '🏦 Denaro esistente',
    modal_aportar_existente_sub: 'Detratto dal disponibile',
    modal_aportar_fuente: 'Da dove viene questo denaro?',
    modal_aportar_importe_lbl: 'Importo da contribuire (€) *',
    modal_aportar_nuevo_lbl: '💸 Denaro nuovo',
    modal_aportar_nuevo_sub: 'Non influisce sul disponibile',
    modal_cuenta_color_lbl: 'Colore identificativo',
    modal_cuenta_nombre_lbl: 'Nome conto *',
    modal_cuenta_nombre_ph: 'Conto corrente Santander...',
    modal_cuenta_notas_lbl: 'Istituzione / Note',
    modal_cuenta_notas_ph: 'Santander, ING...',
    modal_cuenta_saldo_hint: 'Libero da usare adesso',
    modal_cuenta_saldo_lbl: 'Denaro disponibile (€)',
    modal_cuenta_tipo_ahorro: '💰 Risparmio',
    modal_cuenta_tipo_banco: '🏦 Banca',
    modal_cuenta_tipo_cripto: '₿ Crypto',
    modal_cuenta_tipo_efectivo: '💵 Contante',
    modal_cuenta_tipo_inversion: '📈 Investimento',
    modal_cuenta_tipo_lbl: 'Tipo',
    modal_cuenta_tipo_otro: '📁 Altro',
    modal_cuenta_titulo: 'Nuovo Conto',
    modal_cuenta_titulo_editar: 'Modifica Conto',
    modal_cuenta_valor_hint: 'Saldo totale incluso asset',
    modal_cuenta_valor_lbl: 'Valore totale conto (€)',
    modal_deuda_cat_lbl: 'Categoria',
    modal_deuda_interes_lbl: 'Interesse annuale (%)',
    modal_deuda_nombre_lbl: 'Nome *',
    modal_deuda_notas_lbl: 'Note',
    modal_deuda_nueva_cat_lbl: 'Nuova categoria',
    modal_deuda_pagado_lbl: 'Già pagato (€)',
    modal_deuda_total_lbl: 'Importo totale debito (€) *',
    modal_deuda_vencimiento_lbl: 'Scadenza',
    modal_export_desc: 'Esporta i tuoi dati finanziari nel formato preferito.',
    modal_export_excel_sub: 'Entrate, uscite, investimenti, debiti, obiettivi, clienti',
    modal_export_excel_titulo: 'Excel completo (tutti i fogli)',
    modal_export_json_sub: 'Tutti i dati · Per ripristinare dopo',
    modal_export_json_titulo: 'Backup (JSON)',
    modal_export_pdf_sub: 'Riassunto visuale con tutte le sezioni',
    modal_export_pdf_titulo: 'Rapporto PDF completo',
    modal_export_seccion: 'Esporta per sezione',
    modal_export_titulo: 'Esporta dati',
    modal_gasto_cat_lbl: 'Categoria',
    modal_gasto_concepto_lbl: 'Descrizione *',
    modal_gasto_cuenta_lbl: 'Conto *',
    modal_gasto_cuenta_sub: '(obbligatorio)',
    modal_gasto_fecha_lbl: 'Data',
    modal_gasto_importe_lbl: 'Importo (€) *',
    modal_gasto_notas_lbl: 'Note',
    modal_gasto_nueva_cat_lbl: 'Nuova categoria',
    modal_ingreso_cat_lbl: 'Categoria',
    modal_ingreso_concepto_lbl: 'Descrizione *',
    modal_ingreso_cuenta_lbl: 'Conto *',
    modal_ingreso_cuenta_sub: '(obbligatorio)',
    modal_ingreso_fecha_lbl: 'Data',
    modal_ingreso_importe_lbl: 'Importo (€) *',
    modal_ingreso_notas_lbl: 'Note',
    modal_ingreso_nueva_cat_lbl: 'Nuova categoria',
    modal_inv_capital_lbl: 'Capitale investito (€) *',
    modal_inv_cat_lbl: 'Categoria',
    modal_inv_cuenta_lbl: 'Conto sorgente *',
    modal_inv_fecha_lbl: 'Data di entrata',
    modal_inv_nombre_lbl: 'Nome *',
    modal_inv_notas_lbl: 'Note',
    modal_inv_nueva_cat_lbl: 'Nuova categoria',
    modal_inv_rentabilidad_hint: 'Solo per asset con rendimento prevedibile',
    modal_inv_rentabilidad_lbl: 'Rendimento atteso (%)',
    modal_liquidar_cuenta_lbl: 'Conto per depositare',
    modal_liquidar_info: '✓ Il capitale sarà restituito · Guadagno registrato come entrata · Perdita registrata come spesa',
    modal_liquidar_rentabilidad_lbl: 'O rendimento reale (%)',
    modal_liquidar_titulo: '💰 Liquidare investimento',
    modal_liquidar_valor_lbl: 'Valore di uscita (€)',
    modal_monthly_titulo: '📋 Chiusura mensile',
    modal_obj_actual_lbl: 'Risparmiato finora (€)',
    modal_obj_cat_lbl: 'Categoria',
    modal_obj_color_lbl: 'Colore',
    modal_obj_fecha_lbl: 'Data obiettivo',
    modal_obj_imagen_sub: 'Facoltativo · appare come sfondo della carta',
    modal_obj_imagen_titulo: 'Immagine obiettivo',
    modal_obj_meta_lbl: 'Obiettivo (€) *',
    modal_obj_nombre_lbl: 'Nome *',
    modal_obj_notas_lbl: 'Note',
    modal_obj_nueva_cat_lbl: 'Nuova categoria',
    modal_obj_quitar_btn: '✕ Rimuovi',
    modal_obj_subir_btn: '📷 Carica immagine',
    modal_pago_fecha_lbl: 'Data pagamento',
    modal_pago_importe_lbl: 'Importo pagamento (€) *',
    modal_pres_cat_lbl: 'Categoria',
    modal_pres_limite_lbl: 'Limite mensile (€) *',
    modal_pres_nueva_cat_lbl: 'Nuova categoria',
    modal_pres_titulo: 'Imposta Budget',
    modal_tax_autonomo: 'Freelance / Autonomo',
    modal_tax_custom: 'Personalizzato',
    modal_tax_desc: 'In modalità aziendale, MoneyNest calcolerà automaticamente la riserva fiscale.',
    modal_tax_empresa: 'Azienda (IT 25%)',
    modal_tax_irpf_hint: 'Ritenuta / Imposta aziendale',
    modal_tax_irpf_lbl: 'Imposta sul reddito (%)',
    modal_tax_iva_hint: 'Percentuale IVA da addebitare',
    modal_tax_iva_lbl: 'IVA (%)',
    modal_tax_regimen_lbl: 'Regime fiscale',
    modal_tax_startup: 'Startup / Nuova azienda (IT 15%)',
    modal_tax_titulo: '⚙️ Impostazioni fiscali',
    modal_trans_desde_lbl: 'Da',
    modal_trans_hacia_lbl: 'A',
    modal_trans_importe_lbl: 'Importo (€) *',
    modal_trans_titulo: 'Trasferimento tra conti',
    nav_seccion_finanzas: 'Finanze',
    nav_seccion_patrimonio: 'Patrimonio Netto',
    nav_seccion_planificacion: 'Pianificazione',
    nav_seccion_principal: 'Home',
    nav_seccion_sistema: 'Sistema',
    nav_sub_analisis: 'Analisi & Tendenze',
    nav_sub_cuentas: 'Conti',
    nav_sub_dashboard: 'Panoramica',
    nav_sub_deudas: 'Debiti',
    nav_sub_faq: 'Aiuto',
    nav_sub_gastos: 'Uscite',
    nav_sub_ingresos: 'Entrate',
    nav_sub_inversiones: 'Investimenti',
    nav_sub_objetivos: 'Obiettivi',
    nav_sub_patrimonio: 'La tua ricchezza',
    nav_sub_presupuestos: 'Budget',
    ob_skip: 'Salta',
    quick_add_categoria: 'Categoria',
    quick_add_descripcion_ph: 'Descrizione (facoltativo)',
    quick_add_gasto: '💸 Spesa',
    quick_add_guardar: 'Salva',
    quick_add_ingreso: '💰 Entrata',
    quick_add_titulo: '⚡ Aggiungi veloce',
    story_cerrar: 'Chiudi',
    story_siguiente: 'Avanti →',
    toast_aportado_ok: 'Contributo all\'obiettivo ✓',
    toast_cat_añadida: 'Categoria aggiunta ✓',
    toast_cat_existe: 'Questa categoria esiste già',
    toast_cuenta_eliminada: 'Conto eliminato',
    toast_cuenta_guardada: 'Conto salvato ✓',
    toast_cuenta_min: 'Hai bisogno di almeno un conto',
    toast_datos_eliminados: 'Tutti i dati eliminati — impostazioni ripristinate',
    toast_deuda_eliminada: 'Debito eliminato',
    toast_deuda_guardada: 'Debito salvato ✓',
    toast_deudas_exportadas: 'Debiti esportati ✓',
    toast_drive_error: 'Drive non disponibile — download locale',
    toast_drive_ok: '☁️ Backup salvato su Google Drive ✓',
    toast_espacio_insuficiente: '💾 Spazio insufficiente. Usa un\'immagine più piccola.',
    toast_excel_exportado: 'Excel esportato ✓',
    toast_exportado: 'Esportato ✓',
    toast_gasto_eliminado: 'Spesa eliminata',
    toast_gasto_guardado: 'Spesa salvata ✓',
    toast_gastos_exportados: 'Spese esportate ✓',
    toast_guardado: 'Salvato ✓',
    toast_imagen_actualizada: 'Immagine aggiornata ✓',
    toast_imagen_eliminada: 'Immagine rimossa',
    toast_ingreso_eliminado: 'Entrata eliminata',
    toast_ingreso_guardado: 'Entrata salvata ✓',
    toast_ingresos_exportados: 'Entrate esportate ✓',
    toast_inversion_eliminada: 'Investimento eliminato',
    toast_inversion_guardada: 'Investimento registrato ✓ · Saldo aggiornato',
    toast_inversiones_exportadas: 'Investimenti esportati ✓',
    toast_json_exportado: 'Backup esportato ✓',
    toast_json_importado: 'Dati importati ✓',
    toast_liquidado_ganancia: 'Investimento chiuso · Guadagno registrato',
    toast_liquidado_neutro: 'Investimento chiuso',
    toast_liquidado_perdida: 'Investimento chiuso · Perdita registrata',
    toast_objetivo_eliminado: 'Obiettivo eliminato',
    toast_objetivo_guardado: 'Obiettivo salvato ✓',
    toast_objetivos_exportados: 'Obiettivi esportati ✓',
    toast_pago_registrado: 'Pagamento registrato ✓',
    toast_pdf_exportado: 'PDF esportato ✓',
    toast_perfil_guardado: 'Profilo salvato ✓',
    toast_presupuesto_eliminado: 'Budget eliminato',
    toast_presupuesto_guardado: 'Budget salvato ✓',
    toast_presupuestos_exportados: 'Budget esportati ✓',
    toast_transferencia_ok: 'Trasferimento completato ✓',
    topbar_activar_pro: '⚡ Attiva Pro',
    topbar_cambiar_tema: 'Cambia tema',
    topbar_disponible: 'Disponibile',
    topbar_importar: '⬇ Importa',
    topbar_exportar: '⬆ Esporta',
    nav_logros: 'Traguardi',
    nav_facturacion: 'Piano e fatturazione', nav_sub_facturacion: 'Il tuo piano e pagamenti',
    nav_sub_logros: 'I tuoi obiettivi raggiunti',
    cfg_notificaciones: 'Notifiche',
    tut_salir: '✕ Esci',
    tut_siguiente: 'Avanti →',
    ver_movimientos_btn: '📋 Visualizza movimenti',
    deuda_libertad_titulo: '🏁 Pianificazione della Libertà Finanziaria',
    deuda_libertad_sub: 'Definisci il tuo obiettivo e calcola quanto devi pagare',
    deuda_libertad_objetivo_lbl: 'Voglio essere libero dai debiti in',
    deuda_libertad_calcular: 'Calcola rata',
    deuda_libertad_resultado_pre: 'Per essere libero in',
    deuda_libertad_resultado_mid: 'devi pagare:',
    deuda_libertad_mensual: 'Mensile',
    deuda_libertad_semanal: 'Settimanale',
    deuda_libertad_diario: 'Giornaliero',
    deuda_libertad_sin_deuda: 'Sei già libero dai debiti! 🎉',
    deuda_libertad_invalido: 'Inserisci un periodo valido (numero maggiore di 0).',
    anos: 'anni',
    semanas: 'settimane',
    dias: 'giorni',
    deuda_activar_estrategia: 'Attiva questa strategia',
    deuda_estrategia_activa: '✓ Strategia Attiva',
    deuda_info_automatizacion: 'I tuoi pagamenti saranno distribuiti secondo questo importo per raggiungere il tuo obiettivo nei tempi previsti.',
    topbar_prueba_termina_en: 'Prova termina tra:',
    horas: 'h',
    minutos: 'm',
},
  fr: {
    nav_principal: 'Principal', nav_finanzas: 'Finances',
    nav_planificacion: 'Planification', nav_patrimonio_sec: 'Patrimoine',
    nav_sistema: 'Système',
    nav_dashboard: 'Tableau de bord', nav_ingresos: 'Revenus',
    nav_gastos: 'Dépenses', nav_inversiones: 'Investissements',
    nav_deudas: 'Dettes', nav_objetivos: 'Objectifs',
    nav_presupuestos: 'Budgets', nav_cuentas: 'Comptes', nav_categorias: 'Catégories',
    nav_patrimonio: 'Patrimoine', nav_analisis: 'Analyse',
    nav_configuracion: 'Paramètres', nav_faq: 'FAQ', nav_sugerencias: 'Suggestions',
    nav_billing: 'Abonnement & Facturation',
    nav_cerrar_sesion: 'Se déconnecter',
    disponible: 'Disponible', exportar: 'Exporter',
    theme_dark: 'Mode sombre', theme_light: 'Mode clair',
    patrimonio_neto: 'Patrimoine Net',
    ingresos_mes: 'Revenus ce mois', gastos_mes: 'Dépenses ce mois',
    cash_flow: 'Flux de trésorerie', ahorro_mes: 'Épargne ce mois',
    sin_movimientos: 'Aucune transaction enregistrée',
    actividad_reciente: 'Activité récente', ultimas_transacciones: 'Dernières transactions',
    ver_todo: 'Voir tout →', evolucion_patrimonio: 'Évolution du patrimoine',
    ultimos_6_meses: '6 derniers mois', gastos_categoria: 'Dépenses par catégorie',
    insights: 'Insights', basado_datos: 'Basé sur vos données réelles',
    todo_orden: 'Tout en ordre ce mois!', sigue_registrando: 'Continuez à enregistrer vos transactions.',
    primer_mes: 'Premier mois', ingresos_año: 'Revenus', gastos_año: 'Dépenses',
    resumen_financiero: 'Résumé financier', hola: 'Bonjour,',
    btn_guardar: 'Enregistrer', btn_cancelar: 'Annuler', btn_eliminar: 'Supprimer',
    btn_editar: 'Modifier', btn_nuevo: 'Nouveau', btn_exportar: '↗ Exporter',
    btn_nuevo_ingreso: '+ Nouveau revenu', btn_nuevo_gasto: '+ Nouvelle dépense',
    btn_nueva_inversion: '+ Nouvel investissement', btn_nueva_deuda: '+ Nouvelle dette',
    btn_nuevo_objetivo: '+ Nouvel objectif',
    page_ingresos: 'Revenus', sub_ingresos: 'Tous vos revenus',
    page_gastos: 'Dépenses', sub_gastos: 'Toutes vos dépenses',
    page_inversiones: 'Investissements', page_cuentas: 'Comptes',
    page_deudas: 'Dettes', page_objetivos: 'Objectifs',
    page_presupuestos: 'Budgets', page_analisis: 'Analyse',
    page_configuracion: 'Paramètres',
    page_faq: 'FAQ', page_sugerencias: 'Suggestions',
    sug_tipo_sug: 'Suggestion', sug_tipo_preg: 'Question',
    sug_placeholder: 'Décrivez votre idée ou question...', sug_enviar_email: '📧 Envoyer par email', sug_guardar: '💾 Sauvegarder',
    ob_bienvenida: 'Bienvenue sur MoneyNest! 🪺',
    ob_bienvenida_sub: 'Comment vous appelez-vous?',
    ob_idioma: 'Choisissez votre langue', ob_idioma_sub: 'Sélectionnez la langue.',
    ob_tema: 'Choisissez votre thème', ob_tema_sub: 'Vous pouvez le changer à tout moment.',
    ob_listo: 'Tout est configuré!',
    ob_listo_sub: 'Voulez-vous voir un tour interactif?',
    ob_continuar: 'Continuer →', ob_empezar: 'Commencer!',
    ob_omitir: 'Passer', ob_atras: '← Retour',
    ob_ver_tutorial: 'Voir le tutoriel', ob_ir_directo: 'Aller directement',
    ob_3min: '~3 minutes', ob_exploro: "J'explorerai",
    ob_oscuro: 'Sombre', ob_claro: 'Clair',
    ob_nombre_placeholder: 'Votre nom...',
    ob_s1_pill: 'Étape 1 de 3 · Bienvenue',
    ob_s1_h1: 'Votre argent,', ob_s1_h2: 'enfin <span>sous contrôle.</span>',
    ob_s1_lead: 'MoneyNest est votre tableau de bord financier personnel. Revenus, dépenses, investissements et objectifs — tout en un seul endroit.',
    ob_s1_placeholder: 'Comment vous appelez-vous?', ob_s1_hint: 'Juste pour personnaliser — sans compte, sans email',
    ob_s1_cta: 'Commencer',
    ob_s2_pill: 'Étape 2 de 3 · Personnaliser',
    ob_s2_h1: 'Votre style,', ob_s2_h2: 'vos <span>règles.</span>',
    ob_s2_lead: 'Choisissez la langue et le thème. Vous pouvez les modifier à tout moment.',
    ob_s2_idioma_lbl: 'Langue', ob_s2_tema_lbl: 'Apparence',
    ob_s2_siguiente: 'Suivant',
    ob_s3_pill: 'Étape 3 de 3 · Démarrer',
    ob_s3_h1: 'Par où', ob_s3_h2: '<span>commençons?</span>',
    ob_s3_lead: 'Votre tableau de bord est prêt. Choisissez comment vous voulez commencer.',
    ob_s3_greeting: 'Tout est prêt',
    ob_opt_tutorial_lbl: 'Visite guidée', ob_opt_tutorial_sub: 'Nous vous guidons étape par étape avec de vrais exemples (~3 min)',
    ob_opt_demo_lbl: 'Explorer avec des données exemples', ob_opt_demo_sub: 'Voyez l\'app complète avant d\'ajouter vos propres données',
    ob_opt_direct_lbl: 'Commencer directement', ob_opt_direct_sub: 'J\'explore seul, je sais ce dont j\'ai besoin',
    ob_s3_cta: 'C\'est parti! 🚀',
    ob_left2_title: 'Conçue pour vous,', ob_left2_sub: 'dès le premier jour.',
    ob_left2_desc: 'Choisissez la langue et le thème qui s\'adapte le mieux à votre façon de travailler.',
    ob_left2_idioma_lbl: '🌍 Langue active', ob_left2_tema_lbl: '🎨 Thème',
    ob_feat_ingresos: 'Revenus & Dépenses', ob_feat_ingresos_sub: 'Contrôle total de vos flux',
    ob_feat_inv: 'Investissements', ob_feat_inv_sub: 'Suivez votre portefeuille',
    ob_feat_obj: 'Objectifs', ob_feat_obj_sub: 'Atteignez vos cibles financières',
    ob_feat_priv: '100% privé', ob_feat_priv_sub: 'Vos données uniquement sur votre appareil',
    ob_feat_gratis: 'Sans abonnement', ob_feat_gratis_sub: 'Tout gratuit, sans limites',
    ob_left3_ready: '✨ Votre tableau de bord est prêt — commencez à ajouter vos données',
    sin_datos: 'Données insuffisantes', buscar: 'Rechercher...',
    todas_cats: 'Toutes les catégories', periodo: 'Période:',
    este_mes: 'Ce mois', mes_anterior: 'Mois dernier',
    este_año: 'Cette année', todo: 'Tout', personalizado: 'Personnalisé',
    cfg_perfil: 'Votre profil', cfg_nombre: 'Nom', cfg_guardar: '💾 Enregistrer',
    cfg_idioma: 'Langue', cfg_apariencia: 'Apparence',
    cfg_oscuro: 'Sombre', cfg_claro: 'Clair', cfg_activo: '✓ Actif',
    cfg_apariencia_tip: 'Vous pouvez aussi le changer depuis la barre latérale.',
    cfg_datos: 'Importer / Exporter des données',
    cfg_exportar_pdf: '📊 Exporter rapport complet (PDF / Excel)',
    cfg_backup_json: '📤 Sauvegarde (JSON)',
    cfg_drive: '☁️ Sauvegarder sur Google Drive',
    cfg_importar: '↓ Importer une sauvegarde',
    cfg_borrar_todo: '🗑 Supprimer toutes les données',
    cfg_demo_titulo: 'Mode démo',
    cfg_demo_activo_lbl: '● Actif · données exemples chargées',
    cfg_demo_inactivo_lbl: 'Explorer l\'app avec des données exemples',
    cfg_demo_desc_on: 'Les données sont des exemples. Utilisez le bouton flottant 🟡 Mode démo (en bas à droite) pour changer de profil ou quitter.',
    cfg_demo_desc_off: 'Explorez toutes les fonctions sans saisir vos propres données. Choisissez un profil et chargez des données réalistes instantanément.',
    cfg_demo_salir: '🏁 Quitter le mode réel',
    cfg_demo_activar: '🚀 Activer le mode démo',
    cfg_info: 'Informations sur l\'app', cfg_version_lbl: 'Version',
    cfg_ver_tutorial: '🎓 Voir le tutoriel',
    cfg_cats_titulo: 'Catégories personnalisées',
    cfg_cats_sub: 'Les emojis sont assignés automatiquement',
    cfg_nueva_cat: 'Nouvelle catégorie...',
    cfg_emoji_tip: 'Touchez l\'emoji pour choisir, puis écrivez le nom',
    cfg_anadir: '+ Ajouter', cfg_personaliza_sub: 'Personnalisez votre expérience MoneyNest',
    cat_type_ingreso: 'Revenus', cat_type_gasto: 'Dépenses',
    cat_type_inversion: 'Investissements', cat_type_deuda: 'Dettes', cat_type_objetivo: 'Objectifs',
    trial_pill: 'Essai gratuit', trial_days_left: 'jours restants',
    guest_gate_title: 'Créez votre compte pour continuer',
    guest_gate_desc: 'Pour ajouter des transactions vous avez besoin d\'un compte gratuit. Commencez avec 7 jours d\'essai complet.',
      bn_analisis: 'Analyses',
    bn_config: 'Paramètres',
    bn_gastos: 'Dépenses',
    bn_inicio: 'Accueil',
    btn_aportar_confirm: 'Contribuer',
    btn_cuenta_cancelar: 'Annuler',
    btn_cuenta_guardar: 'Enregistrer',
    btn_liquidar_confirm: 'Liquider',
    btn_monthly_cerrar: 'Fermer',
    btn_monthly_pdf: '📄 Exporter PDF',
    btn_presupuesto_cancelar: 'Annuler',
    btn_presupuesto_guardar: 'Enregistrer',
    btn_registrar_pago: 'Enregistrer le paiement',
    btn_tax_cancelar: 'Annuler',
    btn_tax_guardar: 'Enregistrer',
    btn_trans_cancelar: 'Annuler',
    btn_trans_transferir: 'Transférer',
    cliente_editar: 'Éditer Client',
    cliente_nuevo: 'Nouveau Client',
    cobrado_btn: '✓ Collecté',
    confirm_borrar_todo: 'Supprimer TOUTES les données ? Cette action ne peut pas être annulée.',
    confirm_borrar_todo_btn: 'Supprimer tout',
    confirm_borrar_todo_titulo: 'Supprimer toutes les données',
    confirm_btn_cancelar: 'Annuler',
    confirm_btn_eliminar: 'Supprimer',
    confirm_cerrar_sesion: 'Déconnexion ? Votre plan et données resteront sur cet appareil.',
    confirm_cerrar_sesion_btn: 'Déconnexion',
    confirm_cerrar_sesion_titulo: 'Déconnexion',
    confirm_eliminar_cliente: 'Supprimer ce client ?',
    confirm_eliminar_cliente_titulo: 'Supprimer client',
    confirm_eliminar_cuenta: 'Supprimer ce compte ?',
    confirm_eliminar_cuenta_titulo: 'Supprimer compte',
    confirm_eliminar_deuda: 'Supprimer cette dette ?',
    confirm_eliminar_deuda_titulo: 'Supprimer dette',
    confirm_eliminar_gasto: 'Supprimer cette dépense ?',
    confirm_eliminar_gasto_titulo: 'Supprimer dépense',
    confirm_eliminar_ingreso: 'Supprimer ce revenu ? Cette action ne peut pas être annulée.',
    confirm_eliminar_ingreso_titulo: 'Supprimer revenu',
    confirm_eliminar_inversion: 'Supprimer cet investissement ?',
    confirm_eliminar_inversion_titulo: 'Supprimer investissement',
    confirm_eliminar_objetivo: 'Supprimer cet objectif ?',
    confirm_eliminar_objetivo_titulo: 'Supprimer objectif',
    confirm_eliminar_presupuesto: 'Supprimer le budget pour',
    confirm_eliminar_presupuesto_titulo: 'Supprimer budget',
    confirm_importar: 'Importer données ? Toutes les données actuelles seront remplacées.',
    confirm_importar_btn: 'Importer',
    confirm_importar_titulo: 'Importer données',
    confirm_saldo_neg: 'laissera le compte avec un solde négatif. Continuer ?',
    confirm_saldo_neg_btn: 'Continuer quand même',
    confirm_saldo_neg_titulo: '⚠️ Solde insuffisant',
    confirm_salir_demo: 'Quitter mode démo et supprimer exemple de données ?',
    confirm_salir_demo_btn: 'Quitter vers mode réel',
    confirm_salir_demo_titulo: 'Quitter démo',
    confirm_titulo_def: 'Êtes-vous sûr ?',
    cuenta_nombre_ph: 'Compte courant Santander...',
    cuenta_sin_cuenta: 'Pas de compte',
    deuda_calculadora_ph: 'Combien pouvez-vous payer par mois ? (€)',
    deuda_calcular_btn: 'Calculer',
    deuda_input_invalido: 'Entrez un montant mensuel valide.',
    deuda_libre_pagar: 'En payant par mois, vous seriez sans dettes approx.',
    deuda_sin_pendientes: '✅ Vous n\'avez pas de dettes !',
    drive_guardado: '✓ Enregistré',
    drive_guardando: '⏳ Enregistrement...',
    drive_local: '(téléchargement local)',
    err_concepto_importe: 'Description et montant requis',
    err_cuenta_no_encontrada: 'Compte non trouvé',
    err_cuenta_origen: 'Sélectionnez le compte pour recevoir le capital',
    err_cuentas_distintas: 'Sélectionnez des comptes différents',
    err_excel: 'Erreur de génération Excel',
    err_exportar: 'Erreur d\'exportation',
    err_importe_aportar: 'Entrez le montant',
    err_importe_pago: 'Entrez le montant du paiement',
    err_importe_valido: 'Entrez un montant valide',
    err_inversion_no_encontrada: 'Investissement non trouvé',
    err_leer_archivo: 'Erreur de lecture du fichier',
    err_limite_valido: 'Entrez une limite valide',
    err_nombre_importe: 'Nom et montant requis',
    err_nombre_meta: 'Nom et objectif requis',
    err_nombre_requerido: 'Nom requis',
    err_pdf: 'Erreur de génération PDF',
    err_selecciona_cat: 'Sélectionnez une catégorie',
    err_selecciona_cuenta: 'Sélectionnez un compte',
    err_valor_salida: 'Entrez la valeur de sortie',
    gc_ahora_no: 'Pas maintenant',
    gc_crear: 'Créer objectif 🎯',
    gc_sub: 'Définir un objectif d\'épargne est le premier pas. Nous vous aiderons à le suivre.',
    gc_titulo: 'Quel est votre objectif ce mois ?',
    guardando: '⏳ Enregistrement…',
    intro_tagline: 'Vos finances, en ordre',
    inversion_saldo_hint: 'Sélectionnez un compte pour voir le solde disponible',
    inversion_ya_liquidada: 'Cet investissement a été fermé le',
    libre: 'Libre',
    meses: 'mois',
    mini_intro_tagline: 'Vos finances, en ordre',
    mission_bar_sub: 'Ajoutez votre premier revenu pour commencer',
    mission_bar_titulo: 'Complétez votre première mission',
    mission_modal_cerrar: 'Fermer',
    mission_modal_sub: 'Complétez ces actions pour découvrir MoneyNest en 5 minutes.',
    mission_modal_titulo: '🚀 Vos missions de démarrage',
    modal_aportar_cuenta_lbl: 'Compte source',
    modal_aportar_existente_lbl: '🏦 Argent existant',
    modal_aportar_existente_sub: 'Déduit du disponible',
    modal_aportar_fuente: 'D\'où vient cet argent ?',
    modal_aportar_importe_lbl: 'Montant à contribuer (€) *',
    modal_aportar_nuevo_lbl: '💸 Argent nouveau',
    modal_aportar_nuevo_sub: 'N\'affecte pas le disponible',
    modal_cuenta_color_lbl: 'Couleur d\'identification',
    modal_cuenta_nombre_lbl: 'Nom du compte *',
    modal_cuenta_nombre_ph: 'Compte courant Santander...',
    modal_cuenta_notas_lbl: 'Institution / Notes',
    modal_cuenta_notas_ph: 'Santander, ING...',
    modal_cuenta_saldo_hint: 'Libre d\'utilisation maintenant',
    modal_cuenta_saldo_lbl: 'Argent disponible (€)',
    modal_cuenta_tipo_ahorro: '💰 Épargne',
    modal_cuenta_tipo_banco: '🏦 Banque',
    modal_cuenta_tipo_cripto: '₿ Crypto',
    modal_cuenta_tipo_efectivo: '💵 Espèces',
    modal_cuenta_tipo_inversion: '📈 Investissement',
    modal_cuenta_tipo_lbl: 'Type',
    modal_cuenta_tipo_otro: '📁 Autre',
    modal_cuenta_titulo: 'Nouveau Compte',
    modal_cuenta_titulo_editar: 'Éditer Compte',
    modal_cuenta_valor_hint: 'Solde total y compris les actifs',
    modal_cuenta_valor_lbl: 'Valeur totale du compte (€)',
    modal_deuda_cat_lbl: 'Catégorie',
    modal_deuda_interes_lbl: 'Intérêt annuel (%)',
    modal_deuda_nombre_lbl: 'Nom *',
    modal_deuda_notas_lbl: 'Notes',
    modal_deuda_nueva_cat_lbl: 'Nouvelle catégorie',
    modal_deuda_pagado_lbl: 'Déjà payé (€)',
    modal_deuda_total_lbl: 'Montant total (€) *',
    modal_deuda_vencimiento_lbl: 'Échéance',
    modal_export_desc: 'Exportez vos données financières dans le format préféré.',
    modal_export_excel_sub: 'Revenus, dépenses, investissements, dettes, objectifs, clients',
    modal_export_excel_titulo: 'Excel complet (toutes les feuilles)',
    modal_export_json_sub: 'Toutes les données · À restaurer plus tard',
    modal_export_json_titulo: 'Sauvegarde (JSON)',
    modal_export_pdf_sub: 'Résumé visuel avec toutes les sections',
    modal_export_pdf_titulo: 'Rapport PDF complet',
    modal_export_seccion: 'Exporter par section',
    modal_export_titulo: 'Exporter données',
    modal_gasto_cat_lbl: 'Catégorie',
    modal_gasto_concepto_lbl: 'Description *',
    modal_gasto_cuenta_lbl: 'Compte *',
    modal_gasto_cuenta_sub: '(obligatoire)',
    modal_gasto_fecha_lbl: 'Date',
    modal_gasto_importe_lbl: 'Montant (€) *',
    modal_gasto_notas_lbl: 'Notes',
    modal_gasto_nueva_cat_lbl: 'Nouvelle catégorie',
    modal_ingreso_cat_lbl: 'Catégorie',
    modal_ingreso_concepto_lbl: 'Description *',
    modal_ingreso_cuenta_lbl: 'Compte *',
    modal_ingreso_cuenta_sub: '(obligatoire)',
    modal_ingreso_fecha_lbl: 'Date',
    modal_ingreso_importe_lbl: 'Montant (€) *',
    modal_ingreso_notas_lbl: 'Notes',
    modal_ingreso_nueva_cat_lbl: 'Nouvelle catégorie',
    modal_inv_capital_lbl: 'Capital investi (€) *',
    modal_inv_cat_lbl: 'Catégorie',
    modal_inv_cuenta_lbl: 'Compte source *',
    modal_inv_fecha_lbl: 'Date d\'entrée',
    modal_inv_nombre_lbl: 'Nom *',
    modal_inv_notas_lbl: 'Notes',
    modal_inv_nueva_cat_lbl: 'Nouvelle catégorie',
    modal_inv_rentabilidad_hint: 'Uniquement pour les actifs à rendement prévisible',
    modal_inv_rentabilidad_lbl: 'Rendement attendu (%)',
    modal_liquidar_cuenta_lbl: 'Compte de dépôt',
    modal_liquidar_info: '✓ Le capital sera retourné · Gain enregistré comme revenu · Perte enregistrée comme dépense',
    modal_liquidar_rentabilidad_lbl: 'Ou rendement réel (%)',
    modal_liquidar_titulo: '💰 Liquider l\'investissement',
    modal_liquidar_valor_lbl: 'Valeur de sortie (€)',
    modal_monthly_titulo: '📋 Fermeture mensuelle',
    modal_obj_actual_lbl: 'Épargné jusqu\'à présent (€)',
    modal_obj_cat_lbl: 'Catégorie',
    modal_obj_color_lbl: 'Couleur',
    modal_obj_fecha_lbl: 'Date d\'objectif',
    modal_obj_imagen_sub: 'Optionnel · apparaît comme arrière-plan de carte',
    modal_obj_imagen_titulo: 'Image de l\'objectif',
    modal_obj_meta_lbl: 'Objectif (€) *',
    modal_obj_nombre_lbl: 'Nom *',
    modal_obj_notas_lbl: 'Notes',
    modal_obj_nueva_cat_lbl: 'Nouvelle catégorie',
    modal_obj_quitar_btn: '✕ Supprimer',
    modal_obj_subir_btn: '📷 Télécharger image',
    modal_pago_fecha_lbl: 'Date du paiement',
    modal_pago_importe_lbl: 'Montant du paiement (€) *',
    modal_pres_cat_lbl: 'Catégorie',
    modal_pres_limite_lbl: 'Limite mensuelle (€) *',
    modal_pres_nueva_cat_lbl: 'Nouvelle catégorie',
    modal_pres_titulo: 'Définir Budget',
    modal_tax_autonomo: 'Indépendant / Prestataire',
    modal_tax_custom: 'Personnalisé',
    modal_tax_desc: 'En mode entreprise, MoneyNest calculera automatiquement la réserve fiscale.',
    modal_tax_empresa: 'Entreprise (IS 25%)',
    modal_tax_irpf_hint: 'Retenue / Impôt entreprise',
    modal_tax_irpf_lbl: 'Impôt sur le revenu (%)',
    modal_tax_iva_hint: 'Pourcentage de TVA à facturer',
    modal_tax_iva_lbl: 'TVA (%)',
    modal_tax_regimen_lbl: 'Régime fiscal',
    modal_tax_startup: 'Startup / Nouvelle entreprise (IS 15%)',
    modal_tax_titulo: '⚙️ Paramètres fiscaux',
    modal_trans_desde_lbl: 'De',
    modal_trans_hacia_lbl: 'À',
    modal_trans_importe_lbl: 'Montant (€) *',
    modal_trans_titulo: 'Transfert entre comptes',
    nav_seccion_finanzas: 'Finances',
    nav_seccion_patrimonio: 'Patrimoine Net',
    nav_seccion_planificacion: 'Planification',
    nav_seccion_principal: 'Accueil',
    nav_seccion_sistema: 'Système',
    nav_sub_analisis: 'Analyses & Tendances',
    nav_sub_cuentas: 'Comptes',
    nav_sub_dashboard: 'Aperçu',
    nav_sub_deudas: 'Dettes',
    nav_sub_faq: 'Aide',
    nav_sub_gastos: 'Dépenses',
    nav_sub_ingresos: 'Revenus',
    nav_sub_inversiones: 'Investissements',
    nav_sub_objetivos: 'Objectifs',
    nav_sub_patrimonio: 'Votre richesse',
    nav_sub_presupuestos: 'Budgets',
    ob_skip: 'Ignorer',
    quick_add_categoria: 'Catégorie',
    quick_add_descripcion_ph: 'Description (optionnel)',
    quick_add_gasto: '💸 Dépense',
    quick_add_guardar: 'Enregistrer',
    quick_add_ingreso: '💰 Revenu',
    quick_add_titulo: '⚡ Ajout rapide',
    story_cerrar: 'Fermer',
    story_siguiente: 'Suivant →',
    toast_aportado_ok: 'Contribution à l\'objectif ✓',
    toast_cat_añadida: 'Catégorie ajoutée ✓',
    toast_cat_existe: 'Cette catégorie existe déjà',
    toast_cuenta_eliminada: 'Compte supprimé',
    toast_cuenta_guardada: 'Compte enregistré ✓',
    toast_cuenta_min: 'Vous avez besoin d\'au moins un compte',
    toast_datos_eliminados: 'Toutes les données supprimées — paramètres réinitialisés',
    toast_deuda_eliminada: 'Dette supprimée',
    toast_deuda_guardada: 'Dette enregistrée ✓',
    toast_deudas_exportadas: 'Dettes exportées ✓',
    toast_drive_error: 'Drive indisponible — téléchargement local',
    toast_drive_ok: '☁️ Sauvegarde enregistrée sur Google Drive ✓',
    toast_espacio_insuficiente: '💾 Espace insuffisant. Utilisez une image plus petite.',
    toast_excel_exportado: 'Excel exporté ✓',
    toast_exportado: 'Exporté ✓',
    toast_gasto_eliminado: 'Dépense supprimée',
    toast_gasto_guardado: 'Dépense enregistrée ✓',
    toast_gastos_exportados: 'Dépenses exportées ✓',
    toast_guardado: 'Enregistré ✓',
    toast_imagen_actualizada: 'Image mise à jour ✓',
    toast_imagen_eliminada: 'Image supprimée',
    toast_ingreso_eliminado: 'Revenu supprimé',
    toast_ingreso_guardado: 'Revenu enregistré ✓',
    toast_ingresos_exportados: 'Revenus exportés ✓',
    toast_inversion_eliminada: 'Investissement supprimé',
    toast_inversion_guardada: 'Investissement enregistré ✓ · Solde mis à jour',
    toast_inversiones_exportadas: 'Investissements exportés ✓',
    toast_json_exportado: 'Sauvegarde exportée ✓',
    toast_json_importado: 'Données importées ✓',
    toast_liquidado_ganancia: 'Investissement fermé · Gain enregistré',
    toast_liquidado_neutro: 'Investissement fermé',
    toast_liquidado_perdida: 'Investissement fermé · Perte enregistrée',
    toast_objetivo_eliminado: 'Objectif supprimé',
    toast_objetivo_guardado: 'Objectif enregistré ✓',
    toast_objetivos_exportados: 'Objectifs exportés ✓',
    toast_pago_registrado: 'Paiement enregistré ✓',
    toast_pdf_exportado: 'PDF exporté ✓',
    toast_perfil_guardado: 'Profil enregistré ✓',
    toast_presupuesto_eliminado: 'Budget supprimé',
    toast_presupuesto_guardado: 'Budget enregistré ✓',
    toast_presupuestos_exportados: 'Budgets exportés ✓',
    toast_transferencia_ok: 'Transfert complété ✓',
    topbar_activar_pro: '⚡ Passer à Pro',
    topbar_cambiar_tema: 'Changer le thème',
    topbar_disponible: 'Disponible',
    topbar_importar: '⬇ Importer',
    topbar_exportar: '⬆ Exporter',
    nav_logros: 'Succès',
    nav_facturacion: 'Forfait et facturation', nav_sub_facturacion: 'Votre forfait et paiements',
    nav_sub_logros: 'Vos objectifs atteints',
    cfg_notificaciones: 'Notifications',
    tut_salir: '✕ Quitter',
    tut_siguiente: 'Suivant →',
    ver_movimientos_btn: '📋 Voir mouvements',
    deuda_libertad_titulo: '🏁 Planification de la Liberté Financière',
    deuda_libertad_sub: 'Définissez votre objectif et calculez ce que vous devez payer',
    deuda_libertad_objetivo_lbl: 'Je veux être libre de dettes en',
    deuda_libertad_calcular: 'Calculer la mensualité',
    deuda_libertad_resultado_pre: 'Pour être libre en',
    deuda_libertad_resultado_mid: 'vous devez payer :',
    deuda_libertad_mensual: 'Mensuel',
    deuda_libertad_semanal: 'Hebdomadaire',
    deuda_libertad_diario: 'Quotidien',
    deuda_libertad_sin_deuda: 'Vous êtes déjà libre de dettes ! 🎉',
    deuda_libertad_invalido: 'Veuillez saisir une période valide (nombre supérieur à 0).',
    anos: 'ans',
    semanas: 'semaines',
    dias: 'jours',
    deuda_activar_estrategia: 'Activer cette stratégie',
    deuda_estrategia_activa: '✓ Stratégie Active',
    deuda_info_automatizacion: 'Vos paiements seront distribués selon ce montant pour atteindre votre objectif dans le délai prévu.',
    topbar_prueba_termina_en: 'Essai se termine dans:',
    horas: 'h',
    minutos: 'm',
},
  de: {
    nav_principal: 'Haupt', nav_finanzas: 'Finanzen',
    nav_planificacion: 'Planung', nav_patrimonio_sec: 'Vermögen',
    nav_sistema: 'System',
    nav_dashboard: 'Dashboard', nav_ingresos: 'Einnahmen',
    nav_gastos: 'Ausgaben', nav_inversiones: 'Investitionen',
    nav_deudas: 'Schulden', nav_objetivos: 'Ziele',
    nav_presupuestos: 'Budgets', nav_cuentas: 'Konten', nav_categorias: 'Kategorien',
    nav_patrimonio: 'Vermögen', nav_analisis: 'Analyse',
    nav_configuracion: 'Einstellungen', nav_faq: 'FAQ', nav_sugerencias: 'Vorschläge',
    nav_billing: 'Tarif & Abrechnung',
    nav_cerrar_sesion: 'Abmelden',
    disponible: 'Verfügbar', exportar: 'Exportieren',
    theme_dark: 'Dunkelmodus', theme_light: 'Hellmodus',
    patrimonio_neto: 'Nettovermögen',
    ingresos_mes: 'Einnahmen diesen Monat', gastos_mes: 'Ausgaben diesen Monat',
    cash_flow: 'Cashflow', ahorro_mes: 'Ersparnis diesen Monat',
    sin_movimientos: 'Noch keine Transaktionen',
    actividad_reciente: 'Letzte Aktivität', ultimas_transacciones: 'Letzte Transaktionen',
    ver_todo: 'Alle anzeigen →', evolucion_patrimonio: 'Vermögensentwicklung',
    ultimos_6_meses: 'Letzte 6 Monate', gastos_categoria: 'Ausgaben nach Kategorie',
    insights: 'Erkenntnisse', basado_datos: 'Basierend auf Ihren Daten',
    todo_orden: 'Alles in Ordnung diesen Monat!', sigue_registrando: 'Führen Sie Aufzeichnungen.',
    primer_mes: 'Erster Monat', ingresos_año: 'Einnahmen', gastos_año: 'Ausgaben',
    resumen_financiero: 'Finanzübersicht', hola: 'Hallo,',
    btn_guardar: 'Speichern', btn_cancelar: 'Abbrechen', btn_eliminar: 'Löschen',
    btn_editar: 'Bearbeiten', btn_nuevo: 'Neu', btn_exportar: '↗ Exportieren',
    btn_nuevo_ingreso: '+ Neue Einnahme', btn_nuevo_gasto: '+ Neue Ausgabe',
    btn_nueva_inversion: '+ Neue Investition', btn_nueva_deuda: '+ Neue Schuld',
    btn_nuevo_objetivo: '+ Neues Ziel',
    page_ingresos: 'Einnahmen', sub_ingresos: 'Alle Einnahmen',
    page_gastos: 'Ausgaben', sub_gastos: 'Alle Ausgaben',
    page_inversiones: 'Investitionen', page_cuentas: 'Konten',
    page_deudas: 'Schulden', page_objetivos: 'Ziele',
    page_presupuestos: 'Budgets', page_analisis: 'Analyse',
    page_configuracion: 'Einstellungen',
    page_faq: 'FAQ', page_sugerencias: 'Vorschläge',
    sug_tipo_sug: 'Vorschlag', sug_tipo_preg: 'Frage',
    sug_placeholder: 'Beschreiben Sie Ihre Idee oder Frage...', sug_enviar_email: '📧 Per E-Mail senden', sug_guardar: '💾 Lokal speichern',
    ob_bienvenida: 'Willkommen bei MoneyNest! 🪺',
    ob_bienvenida_sub: 'Wie heißen Sie?',
    ob_idioma: 'Sprache wählen', ob_idioma_sub: 'Wählen Sie Ihre bevorzugte Sprache.',
    ob_tema: 'Design wählen', ob_tema_sub: 'Sie können es jederzeit ändern.',
    ob_listo: 'Alles eingerichtet!',
    ob_listo_sub: 'Möchten Sie eine interaktive Tour sehen?',
    ob_continuar: 'Weiter →', ob_empezar: 'Loslegen!',
    ob_omitir: 'Überspringen', ob_atras: '← Zurück',
    ob_ver_tutorial: 'Tutorial ansehen', ob_ir_directo: 'Direkt einsteigen',
    ob_3min: '~3 Minuten', ob_exploro: 'Selbst erkunden',
    ob_oscuro: 'Dunkel', ob_claro: 'Hell',
    ob_nombre_placeholder: 'Ihr Name...',
    ob_s1_pill: 'Schritt 1 von 3 · Willkommen',
    ob_s1_h1: 'Ihr Geld,', ob_s1_h2: 'endlich <span>unter Kontrolle.</span>',
    ob_s1_lead: 'MoneyNest ist Ihr persönliches Finanz-Dashboard. Einnahmen, Ausgaben, Investitionen und Ziele — alles an einem Ort.',
    ob_s1_placeholder: 'Wie heißen Sie?', ob_s1_hint: 'Nur zur Personalisierung — kein Konto, keine E-Mail',
    ob_s1_cta: 'Starten',
    ob_s2_pill: 'Schritt 2 von 3 · Anpassen',
    ob_s2_h1: 'Ihr Stil,', ob_s2_h2: 'Ihre <span>Regeln.</span>',
    ob_s2_lead: 'Wählen Sie Sprache und Design. Sie können es jederzeit in den Einstellungen ändern.',
    ob_s2_idioma_lbl: 'Sprache', ob_s2_tema_lbl: 'Design',
    ob_s2_siguiente: 'Weiter',
    ob_s3_pill: 'Schritt 3 von 3 · Loslegen',
    ob_s3_h1: 'Wo sollen wir', ob_s3_h2: '<span>beginnen?</span>',
    ob_s3_lead: 'Ihr Dashboard ist bereit. Wählen Sie, wie Sie Ihre MoneyNest-Erfahrung starten möchten.',
    ob_s3_greeting: 'Alles bereit',
    ob_opt_tutorial_lbl: 'Geführte Tour', ob_opt_tutorial_sub: 'Wir zeigen Ihnen alles Schritt für Schritt mit echten Beispielen (~3 Min)',
    ob_opt_demo_lbl: 'Mit Beispieldaten erkunden', ob_opt_demo_sub: 'Sehen Sie die vollständige App, bevor Sie eigene Daten eingeben',
    ob_opt_direct_lbl: 'Direkt beginnen', ob_opt_direct_sub: 'Ich erkunde selbst, ich weiß was ich brauche',
    ob_s3_cta: 'Los geht\'s! 🚀',
    ob_left2_title: 'Für Sie gestaltet,', ob_left2_sub: 'vom ersten Tag an.',
    ob_left2_desc: 'Wählen Sie die Sprache und das Design, das am besten zu Ihrer Arbeitsweise passt.',
    ob_left2_idioma_lbl: '🌍 Aktive Sprache', ob_left2_tema_lbl: '🎨 Design',
    ob_feat_ingresos: 'Einnahmen & Ausgaben', ob_feat_ingresos_sub: 'Totale Kontrolle über Ihren Geldfluss',
    ob_feat_inv: 'Investitionen', ob_feat_inv_sub: 'Verfolgen Sie Ihr Portfolio',
    ob_feat_obj: 'Ziele', ob_feat_obj_sub: 'Erreichen Sie Ihre finanziellen Ziele',
    ob_feat_priv: '100% privat', ob_feat_priv_sub: 'Ihre Daten nur auf Ihrem Gerät',
    ob_feat_gratis: 'Kein Abonnement', ob_feat_gratis_sub: 'Alles kostenlos, keine Grenzen',
    ob_left3_ready: '✨ Ihr Dashboard ist bereit — fügen Sie jetzt Ihre Daten hinzu',
    sin_datos: 'Nicht genug Daten', buscar: 'Suchen...',
    todas_cats: 'Alle Kategorien', periodo: 'Zeitraum:',
    este_mes: 'Diesen Monat', mes_anterior: 'Letzten Monat',
    este_año: 'Dieses Jahr', todo: 'Alles', personalizado: 'Benutzerdefiniert',
    cfg_perfil: 'Ihr Profil', cfg_nombre: 'Name', cfg_guardar: '💾 Speichern',
    cfg_idioma: 'Sprache', cfg_apariencia: 'Erscheinungsbild',
    cfg_oscuro: 'Dunkel', cfg_claro: 'Hell', cfg_activo: '✓ Aktiv',
    cfg_apariencia_tip: 'Sie können es auch über den Schalter in der Seitenleiste ändern.',
    cfg_datos: 'Importieren / Exportieren',
    cfg_exportar_pdf: '📊 Vollständigen Bericht exportieren (PDF / Excel)',
    cfg_backup_json: '📤 Sicherungskopie (JSON)',
    cfg_drive: '☁️ Auf Google Drive speichern',
    cfg_importar: '↓ Sicherung importieren',
    cfg_borrar_todo: '🗑 Alle Daten löschen',
    cfg_demo_titulo: 'Demo-Modus',
    cfg_demo_activo_lbl: '● Aktiv · Beispieldaten geladen',
    cfg_demo_inactivo_lbl: 'App mit Beispieldaten erkunden',
    cfg_demo_desc_on: 'Die Daten sind Beispiele. Verwenden Sie den schwebenden Knopf 🟡 Demo-Modus (unten rechts), um das Profil zu wechseln oder zu beenden.',
    cfg_demo_desc_off: 'Erkunden Sie alle Funktionen ohne eigene Daten einzugeben. Wählen Sie ein Profil und laden Sie sofort realistische Daten.',
    cfg_demo_salir: '🏁 Zum echten Modus wechseln',
    cfg_demo_activar: '🚀 Demo-Modus aktivieren',
    cfg_info: 'App-Informationen', cfg_version_lbl: 'Version',
    cfg_ver_tutorial: '🎓 Tutorial ansehen',
    cfg_cats_titulo: 'Benutzerdefinierte Kategorien',
    cfg_cats_sub: 'Emojis werden automatisch zugewiesen',
    cfg_nueva_cat: 'Neue Kategorie...',
    cfg_emoji_tip: 'Tippen Sie auf das Emoji zum Auswählen, dann schreiben Sie den Namen',
    cfg_anadir: '+ Hinzufügen', cfg_personaliza_sub: 'Passen Sie Ihre MoneyNest-Erfahrung an',
    cat_type_ingreso: 'Einnahmen', cat_type_gasto: 'Ausgaben',
    cat_type_inversion: 'Investitionen', cat_type_deuda: 'Schulden', cat_type_objetivo: 'Ziele',
    trial_pill: 'Kostenlose Testversion', trial_days_left: 'Tage übrig',
    guest_gate_title: 'Erstellen Sie Ihr Konto um fortzufahren',
    guest_gate_desc: 'Um Transaktionen hinzuzufügen benötigen Sie ein kostenloses Konto. Starten Sie mit einer 7-tägigen Vollversion.',
      bn_analisis: 'Analysen',
    bn_config: 'Einstellungen',
    bn_gastos: 'Ausgaben',
    bn_inicio: 'Startseite',
    btn_aportar_confirm: 'Beitragen',
    btn_cuenta_cancelar: 'Abbrechen',
    btn_cuenta_guardar: 'Speichern',
    btn_liquidar_confirm: 'Liquidieren',
    btn_monthly_cerrar: 'Schließen',
    btn_monthly_pdf: '📄 PDF exportieren',
    btn_presupuesto_cancelar: 'Abbrechen',
    btn_presupuesto_guardar: 'Speichern',
    btn_registrar_pago: 'Zahlung erfassen',
    btn_tax_cancelar: 'Abbrechen',
    btn_tax_guardar: 'Speichern',
    btn_trans_cancelar: 'Abbrechen',
    btn_trans_transferir: 'Überweisen',
    cliente_editar: 'Kunde bearbeiten',
    cliente_nuevo: 'Neuer Kunde',
    cobrado_btn: '✓ Erhalten',
    confirm_borrar_todo: 'ALLE Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirm_borrar_todo_btn: 'Alles löschen',
    confirm_borrar_todo_titulo: 'Alle Daten löschen',
    confirm_btn_cancelar: 'Abbrechen',
    confirm_btn_eliminar: 'Löschen',
    confirm_cerrar_sesion: 'Abmelden? Dein Plan und Finanzdaten bleiben auf diesem Gerät.',
    confirm_cerrar_sesion_btn: 'Abmelden',
    confirm_cerrar_sesion_titulo: 'Abmelden',
    confirm_eliminar_cliente: 'Diesen Kunden löschen?',
    confirm_eliminar_cliente_titulo: 'Kunden löschen',
    confirm_eliminar_cuenta: 'Dieses Konto löschen?',
    confirm_eliminar_cuenta_titulo: 'Konto löschen',
    confirm_eliminar_deuda: 'Diese Schuld löschen?',
    confirm_eliminar_deuda_titulo: 'Schulden löschen',
    confirm_eliminar_gasto: 'Diese Ausgabe löschen?',
    confirm_eliminar_gasto_titulo: 'Ausgabe löschen',
    confirm_eliminar_ingreso: 'Dieses Einkommen löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirm_eliminar_ingreso_titulo: 'Einkommen löschen',
    confirm_eliminar_inversion: 'Diese Investition löschen?',
    confirm_eliminar_inversion_titulo: 'Investition löschen',
    confirm_eliminar_objetivo: 'Dieses Ziel löschen?',
    confirm_eliminar_objetivo_titulo: 'Ziel löschen',
    confirm_eliminar_presupuesto: 'Budget löschen für',
    confirm_eliminar_presupuesto_titulo: 'Budget löschen',
    confirm_importar: 'Daten importieren? Alle aktuellen Daten werden ersetzt.',
    confirm_importar_btn: 'Importieren',
    confirm_importar_titulo: 'Daten importieren',
    confirm_saldo_neg: 'wird das Konto mit negativem Saldo hinterlassen. Fortfahren?',
    confirm_saldo_neg_btn: 'Trotzdem fortfahren',
    confirm_saldo_neg_titulo: '⚠️ Unzureichender Kontostand',
    confirm_salir_demo: 'Demodmodus beenden und Beispieldaten löschen?',
    confirm_salir_demo_btn: 'In echten Modus wechseln',
    confirm_salir_demo_titulo: 'Demo beenden',
    confirm_titulo_def: 'Bist du sicher?',
    cuenta_nombre_ph: 'Santander-Girokonto...',
    cuenta_sin_cuenta: 'Kein Konto',
    deuda_calculadora_ph: 'Wie viel kannst du pro Monat zahlen? (€)',
    deuda_calcular_btn: 'Berechnen',
    deuda_input_invalido: 'Gültige Monatssumme eingeben.',
    deuda_libre_pagar: 'Mit monatlicher Zahlung wärst du schuldenfrei ca.',
    deuda_sin_pendientes: '✅ Du hast keine offenen Schulden!',
    drive_guardado: '✓ Gespeichert',
    drive_guardando: '⏳ Speichere...',
    drive_local: '(lokaler Download)',
    err_concepto_importe: 'Beschreibung und Betrag erforderlich',
    err_cuenta_no_encontrada: 'Konto nicht gefunden',
    err_cuenta_origen: 'Wähle das Konto für den Kapitalempfang',
    err_cuentas_distintas: 'Wähle unterschiedliche Konten',
    err_excel: 'Excel-Generierungsfehler',
    err_exportar: 'Exportfehler',
    err_importe_aportar: 'Betrag eingeben',
    err_importe_pago: 'Zahlungsbetrag eingeben',
    err_importe_valido: 'Gültigen Betrag eingeben',
    err_inversion_no_encontrada: 'Investition nicht gefunden',
    err_leer_archivo: 'Datei-Lesefehler',
    err_limite_valido: 'Gültige Grenze eingeben',
    err_nombre_importe: 'Name und Betrag erforderlich',
    err_nombre_meta: 'Name und Ziel erforderlich',
    err_nombre_requerido: 'Name erforderlich',
    err_pdf: 'PDF-Generierungsfehler',
    err_selecciona_cat: 'Wähle eine Kategorie',
    err_selecciona_cuenta: 'Wähle ein Konto',
    err_valor_salida: 'Ausstiegswert eingeben',
    gc_ahora_no: 'Nicht jetzt',
    gc_crear: 'Ziel erstellen 🎯',
    gc_sub: 'Ein Sparziel zu setzen ist der erste Schritt. Wir helfen dir es automatisch zu verfol',
    gc_titulo: 'Was ist dein Ziel diesen Monat?',
    guardando: '⏳ Speichere…',
    intro_tagline: 'Deine Finanzen, geordnet',
    inversion_saldo_hint: 'Wähle ein Konto, um verfügbaren Saldo zu sehen',
    inversion_ya_liquidada: 'Diese Investition wurde bereits am geschlossen',
    libre: 'Frei',
    meses: 'Monate',
    mini_intro_tagline: 'Deine Finanzen, geordnet',
    mission_bar_sub: 'Füge dein erstes Einkommen hinzu, um zu beginnen',
    mission_bar_titulo: 'Schließe deine erste Mission ab',
    mission_modal_cerrar: 'Schließen',
    mission_modal_sub: 'Vollende diese Aktionen, um MoneyNest in 5 Minuten zu entdecken.',
    mission_modal_titulo: '🚀 Deine Startmissionen',
    modal_aportar_cuenta_lbl: 'Quellkonto',
    modal_aportar_existente_lbl: '🏦 Vorhandenes Geld',
    modal_aportar_existente_sub: 'Wird vom Verfügbaren abgezogen',
    modal_aportar_fuente: 'Woher kommt dieses Geld?',
    modal_aportar_importe_lbl: 'Beitragsbetrag (€) *',
    modal_aportar_nuevo_lbl: '💸 Neues Geld',
    modal_aportar_nuevo_sub: 'Beeinflusst nicht das Verfügbare',
    modal_cuenta_color_lbl: 'Identifikationsfarbe',
    modal_cuenta_nombre_lbl: 'Kontoname *',
    modal_cuenta_nombre_ph: 'Santander-Girokonto...',
    modal_cuenta_notas_lbl: 'Institut / Notizen',
    modal_cuenta_notas_ph: 'Santander, ING...',
    modal_cuenta_saldo_hint: 'Jetzt frei zu nutzen',
    modal_cuenta_saldo_lbl: 'Verfügbares Geld (€)',
    modal_cuenta_tipo_ahorro: '💰 Ersparnisse',
    modal_cuenta_tipo_banco: '🏦 Bank',
    modal_cuenta_tipo_cripto: '₿ Krypto',
    modal_cuenta_tipo_efectivo: '💵 Bargeld',
    modal_cuenta_tipo_inversion: '📈 Investition',
    modal_cuenta_tipo_lbl: 'Typ',
    modal_cuenta_tipo_otro: '📁 Sonstiges',
    modal_cuenta_titulo: 'Neues Konto',
    modal_cuenta_titulo_editar: 'Konto bearbeiten',
    modal_cuenta_valor_hint: 'Gesamtsaldo inklusive Assets',
    modal_cuenta_valor_lbl: 'Gesamtkontowert (€)',
    modal_deuda_cat_lbl: 'Kategorie',
    modal_deuda_interes_lbl: 'Jährliche Zinsen (%)',
    modal_deuda_nombre_lbl: 'Name *',
    modal_deuda_notas_lbl: 'Notizen',
    modal_deuda_nueva_cat_lbl: 'Neue Kategorie',
    modal_deuda_pagado_lbl: 'Bereits bezahlt (€)',
    modal_deuda_total_lbl: 'Gesamtschulden (€) *',
    modal_deuda_vencimiento_lbl: 'Fälligkeitsdatum',
    modal_export_desc: 'Exportiere deine Finanzdaten in deinem bevorzugten Format.',
    modal_export_excel_sub: 'Einkommen, Ausgaben, Investitionen, Schulden, Ziele, Clients',
    modal_export_excel_titulo: 'Vollständige Excel (alle Blätter)',
    modal_export_json_sub: 'Alle Daten · Zum späteren Wiederherstellen',
    modal_export_json_titulo: 'Sicherung (JSON)',
    modal_export_pdf_sub: 'Visuelle Zusammenfassung mit allen Abschnitten',
    modal_export_pdf_titulo: 'Vollständiger PDF-Bericht',
    modal_export_seccion: 'Nach Abschnitt exportieren',
    modal_export_titulo: 'Daten exportieren',
    modal_gasto_cat_lbl: 'Kategorie',
    modal_gasto_concepto_lbl: 'Beschreibung *',
    modal_gasto_cuenta_lbl: 'Konto *',
    modal_gasto_cuenta_sub: '(erforderlich)',
    modal_gasto_fecha_lbl: 'Datum',
    modal_gasto_importe_lbl: 'Betrag (€) *',
    modal_gasto_notas_lbl: 'Notizen',
    modal_gasto_nueva_cat_lbl: 'Neue Kategorie',
    modal_ingreso_cat_lbl: 'Kategorie',
    modal_ingreso_concepto_lbl: 'Beschreibung *',
    modal_ingreso_cuenta_lbl: 'Konto *',
    modal_ingreso_cuenta_sub: '(erforderlich)',
    modal_ingreso_fecha_lbl: 'Datum',
    modal_ingreso_importe_lbl: 'Betrag (€) *',
    modal_ingreso_notas_lbl: 'Notizen',
    modal_ingreso_nueva_cat_lbl: 'Neue Kategorie',
    modal_inv_capital_lbl: 'Investiertes Kapital (€) *',
    modal_inv_cat_lbl: 'Kategorie',
    modal_inv_cuenta_lbl: 'Quellkonto *',
    modal_inv_fecha_lbl: 'Eingabedatum',
    modal_inv_nombre_lbl: 'Name *',
    modal_inv_notas_lbl: 'Notizen',
    modal_inv_nueva_cat_lbl: 'Neue Kategorie',
    modal_inv_rentabilidad_hint: 'Nur für Assets mit vorhersehbarer Rendite',
    modal_inv_rentabilidad_lbl: 'Erwartete Rendite (%)',
    modal_liquidar_cuenta_lbl: 'Konto zum Einzahlen',
    modal_liquidar_info: '✓ Kapital wird zurückgegeben · Gewinn als Einkommen erfasst · Verlust als Ausgabe erfasst',
    modal_liquidar_rentabilidad_lbl: 'Oder tatsächliche Rendite (%)',
    modal_liquidar_titulo: '💰 Investition liquidieren',
    modal_liquidar_valor_lbl: 'Ausstiegswert (€)',
    modal_monthly_titulo: '📋 Monatlicher Abschluss',
    modal_obj_actual_lbl: 'Bisher gespart (€)',
    modal_obj_cat_lbl: 'Kategorie',
    modal_obj_color_lbl: 'Farbe',
    modal_obj_fecha_lbl: 'Zieldatum',
    modal_obj_imagen_sub: 'Optional · erscheint als Kartenhintergrund',
    modal_obj_imagen_titulo: 'Zielimage',
    modal_obj_meta_lbl: 'Ziel (€) *',
    modal_obj_nombre_lbl: 'Name *',
    modal_obj_notas_lbl: 'Notizen',
    modal_obj_nueva_cat_lbl: 'Neue Kategorie',
    modal_obj_quitar_btn: '✕ Entfernen',
    modal_obj_subir_btn: '📷 Bild hochladen',
    modal_pago_fecha_lbl: 'Zahlungsdatum',
    modal_pago_importe_lbl: 'Zahlungsbetrag (€) *',
    modal_pres_cat_lbl: 'Kategorie',
    modal_pres_limite_lbl: 'Monatliches Limit (€) *',
    modal_pres_nueva_cat_lbl: 'Neue Kategorie',
    modal_pres_titulo: 'Budget festlegen',
    modal_tax_autonomo: 'Freiberufler / Unabhängig',
    modal_tax_custom: 'Benutzerdefiniert',
    modal_tax_desc: 'Im Geschäftsmodus berechnet MoneyNest automatisch die Steuerrücklage.',
    modal_tax_empresa: 'Unternehmen (ST 25%)',
    modal_tax_irpf_hint: 'Quellensteuer / Unternehmenssteuer',
    modal_tax_irpf_lbl: 'Einkommensteuer (%)',
    modal_tax_iva_hint: 'MwSt.-Satz zum Berechnen',
    modal_tax_iva_lbl: 'MwSt. (%)',
    modal_tax_regimen_lbl: 'Steuerregime',
    modal_tax_startup: 'Startup / Neues Unternehmen (ST 15%)',
    modal_tax_titulo: '⚙️ Steuereinstellungen',
    modal_trans_desde_lbl: 'Von',
    modal_trans_hacia_lbl: 'Bis',
    modal_trans_importe_lbl: 'Betrag (€) *',
    modal_trans_titulo: 'Überweisung zwischen Konten',
    nav_seccion_finanzas: 'Finanzen',
    nav_seccion_patrimonio: 'Vermögen',
    nav_seccion_planificacion: 'Planung',
    nav_seccion_principal: 'Startseite',
    nav_seccion_sistema: 'System',
    nav_sub_analisis: 'Analysen & Trends',
    nav_sub_cuentas: 'Konten',
    nav_sub_dashboard: 'Übersicht',
    nav_sub_deudas: 'Schulden',
    nav_sub_faq: 'Hilfe',
    nav_sub_gastos: 'Ausgaben',
    nav_sub_ingresos: 'Einkommen',
    nav_sub_inversiones: 'Investitionen',
    nav_sub_objetivos: 'Ziele',
    nav_sub_patrimonio: 'Dein Vermögen',
    nav_sub_presupuestos: 'Budgets',
    ob_skip: 'Überspringen',
    quick_add_categoria: 'Kategorie',
    quick_add_descripcion_ph: 'Beschreibung (optional)',
    quick_add_gasto: '💸 Ausgabe',
    quick_add_guardar: 'Speichern',
    quick_add_ingreso: '💰 Einkommen',
    quick_add_titulo: '⚡ Schnell hinzufügen',
    story_cerrar: 'Schließen',
    story_siguiente: 'Nächste →',
    toast_aportado_ok: 'Zu Ziel beigetragen ✓',
    toast_cat_añadida: 'Kategorie hinzugefügt ✓',
    toast_cat_existe: 'Diese Kategorie existiert bereits',
    toast_cuenta_eliminada: 'Konto gelöscht',
    toast_cuenta_guardada: 'Konto gespeichert ✓',
    toast_cuenta_min: 'Du brauchst mindestens ein Konto',
    toast_datos_eliminados: 'Alle Daten gelöscht — Einstellungen zurückgesetzt',
    toast_deuda_eliminada: 'Schulden gelöscht',
    toast_deuda_guardada: 'Schulden gespeichert ✓',
    toast_deudas_exportadas: 'Schulden exportiert ✓',
    toast_drive_error: 'Drive nicht verfügbar — lokaler Download',
    toast_drive_ok: '☁️ Sicherung auf Google Drive gespeichert ✓',
    toast_espacio_insuficiente: '💾 Nicht genug Platz. Verwende ein kleineres Bild.',
    toast_excel_exportado: 'Excel exportiert ✓',
    toast_exportado: 'Exportiert ✓',
    toast_gasto_eliminado: 'Ausgabe gelöscht',
    toast_gasto_guardado: 'Ausgabe gespeichert ✓',
    toast_gastos_exportados: 'Ausgaben exportiert ✓',
    toast_guardado: 'Gespeichert ✓',
    toast_imagen_actualizada: 'Bild aktualisiert ✓',
    toast_imagen_eliminada: 'Bild entfernt',
    toast_ingreso_eliminado: 'Einkommen gelöscht',
    toast_ingreso_guardado: 'Einkommen gespeichert ✓',
    toast_ingresos_exportados: 'Einkommen exportiert ✓',
    toast_inversion_eliminada: 'Investition gelöscht',
    toast_inversion_guardada: 'Investition erfasst ✓ · Saldo aktualisiert',
    toast_inversiones_exportadas: 'Investitionen exportiert ✓',
    toast_json_exportado: 'Sicherung exportiert ✓',
    toast_json_importado: 'Daten importiert ✓',
    toast_liquidado_ganancia: 'Investition geschlossen · Gewinn erfasst',
    toast_liquidado_neutro: 'Investition geschlossen',
    toast_liquidado_perdida: 'Investition geschlossen · Verlust erfasst',
    toast_objetivo_eliminado: 'Ziel gelöscht',
    toast_objetivo_guardado: 'Ziel gespeichert ✓',
    toast_objetivos_exportados: 'Ziele exportiert ✓',
    toast_pago_registrado: 'Zahlung erfasst ✓',
    toast_pdf_exportado: 'PDF exportiert ✓',
    toast_perfil_guardado: 'Profil gespeichert ✓',
    toast_presupuesto_eliminado: 'Budget gelöscht',
    toast_presupuesto_guardado: 'Budget gespeichert ✓',
    toast_presupuestos_exportados: 'Budgets exportiert ✓',
    toast_transferencia_ok: 'Überweisung abgeschlossen ✓',
    topbar_activar_pro: '⚡ Pro aktivieren',
    topbar_cambiar_tema: 'Design ändern',
    topbar_disponible: 'Verfügbar',
    topbar_importar: '⬇ Importieren',
    topbar_exportar: '⬆ Exportieren',
    nav_logros: 'Erfolge',
    nav_facturacion: 'Plan & Abrechnung', nav_sub_facturacion: 'Ihr Plan und Zahlungen',
    nav_sub_logros: 'Deine Meilensteine',
    cfg_notificaciones: 'Benachrichtigungen',
    tut_salir: '✕ Beenden',
    tut_siguiente: 'Nächste →',
    ver_movimientos_btn: '📋 Bewegungen anzeigen',
    deuda_libertad_titulo: '🏁 Finanzielle Freiheitsplanung',
    deuda_libertad_sub: 'Lege dein Ziel fest und berechne, wie viel du zahlen musst',
    deuda_libertad_objetivo_lbl: 'Ich möchte schuldenfrei sein in',
    deuda_libertad_calcular: 'Rate berechnen',
    deuda_libertad_resultado_pre: 'Um in',
    deuda_libertad_resultado_mid: 'schuldenfrei zu sein, musst du zahlen:',
    deuda_libertad_mensual: 'Monatlich',
    deuda_libertad_semanal: 'Wöchentlich',
    deuda_libertad_diario: 'Täglich',
    deuda_libertad_sin_deuda: 'Du bist bereits schuldenfrei! 🎉',
    deuda_libertad_invalido: 'Bitte gib einen gültigen Zeitraum ein (Zahl größer als 0).',
    anos: 'Jahre',
    semanas: 'Wochen',
    dias: 'Tage',
    deuda_activar_estrategia: 'Diese Strategie aktivieren',
    deuda_estrategia_activa: '✓ Aktive Strategie',
    deuda_info_automatizacion: 'Deine Zahlungen werden gemäß diesem Betrag verteilt, um dein Ziel im vorgesehenen Zeitraum zu erreichen.',
    topbar_prueba_termina_en: 'Testphase endet in:',
    horas: 'h',
    minutos: 'm',
},
  pt: {
    nav_principal: 'Principal', nav_finanzas: 'Finanças',
    nav_planificacion: 'Planeamento', nav_patrimonio_sec: 'Património',
    nav_sistema: 'Sistema',
    nav_dashboard: 'Dashboard', nav_ingresos: 'Receitas',
    nav_gastos: 'Despesas', nav_inversiones: 'Investimentos',
    nav_deudas: 'Dívidas', nav_objetivos: 'Objetivos',
    nav_presupuestos: 'Orçamentos', nav_cuentas: 'Contas', nav_categorias: 'Categorias',
    nav_patrimonio: 'Património', nav_analisis: 'Análise',
    nav_configuracion: 'Configurações', nav_faq: 'FAQ', nav_sugerencias: 'Sugestões',
    nav_billing: 'Plano & Faturação',
    nav_cerrar_sesion: 'Terminar sessão',
    disponible: 'Disponível', exportar: 'Exportar',
    theme_dark: 'Modo escuro', theme_light: 'Modo claro',
    patrimonio_neto: 'Património Líquido',
    ingresos_mes: 'Receitas este mês', gastos_mes: 'Despesas este mês',
    cash_flow: 'Fluxo de caixa', ahorro_mes: 'Poupança este mês',
    sin_movimientos: 'Sem transações registadas',
    actividad_reciente: 'Atividade recente', ultimas_transacciones: 'Últimas transações',
    ver_todo: 'Ver tudo →', evolucion_patrimonio: 'Evolução do património',
    ultimos_6_meses: 'Últimos 12 meses', gastos_categoria: 'Despesas por categoria',
    insights: 'Insights', basado_datos: 'Baseado nos seus dados reais',
    todo_orden: 'Tudo em ordem este mês!', sigue_registrando: 'Continue a registar as suas transações.',
    primer_mes: 'Primeiro mês', ingresos_año: 'Receitas', gastos_año: 'Despesas',
    resumen_financiero: 'Resumo financeiro', hola: 'Olá,',
    btn_guardar: 'Guardar', btn_cancelar: 'Cancelar', btn_eliminar: 'Eliminar',
    btn_editar: 'Editar', btn_nuevo: 'Novo', btn_exportar: '↗ Exportar',
    btn_nuevo_ingreso: '+ Nova receita', btn_nuevo_gasto: '+ Nova despesa',
    btn_nueva_inversion: '+ Novo investimento', btn_nueva_deuda: '+ Nova dívida',
    btn_nuevo_objetivo: '+ Novo objetivo',
    page_ingresos: 'Receitas', sub_ingresos: 'Todas as suas receitas',
    page_gastos: 'Despesas', sub_gastos: 'Todas as suas despesas',
    page_inversiones: 'Investimentos', page_cuentas: 'Contas',
    page_deudas: 'Dívidas', page_objetivos: 'Objetivos',
    page_presupuestos: 'Orçamentos', page_analisis: 'Análise',
    page_configuracion: 'Configurações',
    page_faq: 'Perguntas frequentes', page_sugerencias: 'Sugestões',
    sug_tipo_sug: 'Sugestão', sug_tipo_preg: 'Pergunta',
    sug_placeholder: 'Descreva a sua ideia ou pergunta...', sug_enviar_email: '📧 Enviar por email', sug_guardar: '💾 Guardar localmente',
    ob_bienvenida: 'Bem-vindo ao MoneyNest! 🪺',
    ob_bienvenida_sub: 'Qual é o seu nome?',
    ob_idioma: 'Escolha o seu idioma', ob_idioma_sub: 'Selecione o idioma que prefere.',
    ob_tema: 'Escolha o seu tema', ob_tema_sub: 'Pode alterá-lo a qualquer momento.',
    ob_listo: 'Tudo configurado!',
    ob_listo_sub: 'Quer ver um tour interativo?',
    ob_continuar: 'Continuar →', ob_empezar: 'Começar!',
    ob_omitir: 'Saltar', ob_atras: '← Anterior',
    ob_ver_tutorial: 'Ver tutorial', ob_ir_directo: 'Ir direto',
    ob_3min: '~3 minutos', ob_exploro: 'Vou explorar',
    ob_oscuro: 'Escuro', ob_claro: 'Claro',
    ob_nombre_placeholder: 'O seu nome...',
    ob_s1_pill: 'Passo 1 de 3 · Boas-vindas',
    ob_s1_h1: 'O seu dinheiro,', ob_s1_h2: 'finalmente <span>sob controlo.</span>',
    ob_s1_lead: 'MoneyNest é o seu painel financeiro pessoal. Receitas, despesas, investimentos e objetivos — tudo num só lugar.',
    ob_s1_placeholder: 'Qual é o seu nome?', ob_s1_hint: 'Só para personalizar — sem conta, sem email',
    ob_s1_cta: 'Começar',
    ob_s2_pill: 'Passo 2 de 3 · Personalizar',
    ob_s2_h1: 'O seu estilo,', ob_s2_h2: 'as suas <span>regras.</span>',
    ob_s2_lead: 'Escolha idioma e tema. Pode alterá-lo em qualquer momento nas Definições.',
    ob_s2_idioma_lbl: 'Idioma', ob_s2_tema_lbl: 'Aparência',
    ob_s2_siguiente: 'Seguinte',
    ob_s3_pill: 'Passo 3 de 3 · Arrancar',
    ob_s3_h1: 'Por onde', ob_s3_h2: '<span>começamos?</span>',
    ob_s3_lead: 'O seu painel está pronto. Escolha como quer começar a sua experiência com o MoneyNest.',
    ob_s3_greeting: 'Tudo pronto',
    ob_opt_tutorial_lbl: 'Tour guiado', ob_opt_tutorial_sub: 'Mostramos-lhe tudo passo a passo com exemplos reais (~3 min)',
    ob_opt_demo_lbl: 'Explorar com dados de exemplo', ob_opt_demo_sub: 'Veja a app completa antes de adicionar os seus dados',
    ob_opt_direct_lbl: 'Começar diretamente', ob_opt_direct_sub: 'Exploro sozinho, já sei o que preciso',
    ob_s3_cta: 'Vamos lá! 🚀',
    ob_left2_title: 'Desenhada para si,', ob_left2_sub: 'desde o primeiro dia.',
    ob_left2_desc: 'Escolha o idioma e o tema que melhor se adapta à sua forma de trabalhar.',
    ob_left2_idioma_lbl: '🌍 Idioma ativo', ob_left2_tema_lbl: '🎨 Tema',
    ob_feat_ingresos: 'Receitas & Despesas', ob_feat_ingresos_sub: 'Controlo total do seu fluxo',
    ob_feat_inv: 'Investimentos', ob_feat_inv_sub: 'Acompanhe o seu portfólio',
    ob_feat_obj: 'Objetivos', ob_feat_obj_sub: 'Alcance as suas metas financeiras',
    ob_feat_priv: '100% privado', ob_feat_priv_sub: 'Os seus dados apenas no seu dispositivo',
    ob_feat_gratis: 'Sem subscrição', ob_feat_gratis_sub: 'Tudo grátis, sem limites',
    ob_left3_ready: '✨ O seu painel está pronto — comece a adicionar os seus dados',
    sin_datos: 'Dados insuficientes', buscar: 'Pesquisar...',
    todas_cats: 'Todas as categorias', periodo: 'Período:',
    este_mes: 'Este mês', mes_anterior: 'Mês anterior',
    este_año: 'Este ano', todo: 'Tudo', personalizado: 'Personalizado',
    cfg_perfil: 'O seu perfil', cfg_nombre: 'Nome', cfg_guardar: '💾 Guardar',
    cfg_idioma: 'Idioma', cfg_apariencia: 'Aparência',
    cfg_oscuro: 'Escuro', cfg_claro: 'Claro', cfg_activo: '✓ Ativo',
    cfg_apariencia_tip: 'Também pode alterá-lo a partir da barra lateral.',
    cfg_datos: 'Importar / Exportar dados',
    cfg_exportar_pdf: '📊 Exportar relatório completo (PDF / Excel)',
    cfg_backup_json: '📤 Cópia de segurança (JSON)',
    cfg_drive: '☁️ Guardar no Google Drive',
    cfg_importar: '↓ Importar cópia de segurança',
    cfg_borrar_todo: '🗑 Apagar todos os dados',
    cfg_demo_titulo: 'Modo demo',
    cfg_demo_activo_lbl: '● Ativo · dados de exemplo carregados',
    cfg_demo_inactivo_lbl: 'Explorar a app com dados de exemplo',
    cfg_demo_desc_on: 'Os dados são de exemplo. Use o botão flutuante 🟡 Modo demo (canto inferior direito) para alterar o perfil ou sair.',
    cfg_demo_desc_off: 'Explore todas as funções sem introduzir os seus próprios dados. Escolha um perfil e carregue dados realistas instantaneamente.',
    cfg_demo_salir: '🏁 Sair para o modo real',
    cfg_demo_activar: '🚀 Ativar modo demo',
    cfg_info: 'Informações da app', cfg_version_lbl: 'Versão',
    cfg_ver_tutorial: '🎓 Ver tutorial',
    cfg_cats_titulo: 'Categorias personalizadas',
    cfg_cats_sub: 'Os emojis são atribuídos automaticamente',
    cfg_nueva_cat: 'Nova categoria...',
    cfg_emoji_tip: 'Toque no emoji para escolher, depois escreva o nome',
    cfg_anadir: '+ Adicionar', cfg_personaliza_sub: 'Personalize a sua experiência MoneyNest',
    cat_type_ingreso: 'Receitas', cat_type_gasto: 'Despesas',
    cat_type_inversion: 'Investimentos', cat_type_deuda: 'Dívidas', cat_type_objetivo: 'Objetivos',
    trial_pill: 'Avaliação gratuita', trial_days_left: 'dias restantes',
    guest_gate_title: 'Crie a sua conta para continuar',
    guest_gate_desc: 'Para adicionar movimentos precisa de uma conta gratuita. Comece com 7 dias de avaliação completa.',
      bn_analisis: 'Análises',
    bn_config: 'Configurações',
    bn_gastos: 'Despesas',
    bn_inicio: 'Início',
    btn_aportar_confirm: 'Contribuir',
    btn_cuenta_cancelar: 'Cancelar',
    btn_cuenta_guardar: 'Salvar',
    btn_liquidar_confirm: 'Liquidar',
    btn_monthly_cerrar: 'Fechar',
    btn_monthly_pdf: '📄 Exportar PDF',
    btn_presupuesto_cancelar: 'Cancelar',
    btn_presupuesto_guardar: 'Salvar',
    btn_registrar_pago: 'Registrar pagamento',
    btn_tax_cancelar: 'Cancelar',
    btn_tax_guardar: 'Salvar',
    btn_trans_cancelar: 'Cancelar',
    btn_trans_transferir: 'Transferir',
    cliente_editar: 'Editar Cliente',
    cliente_nuevo: 'Novo Cliente',
    cobrado_btn: '✓ Coletado',
    confirm_borrar_todo: 'Excluir TODOS os dados? Esta ação não pode ser desfeita.',
    confirm_borrar_todo_btn: 'Excluir tudo',
    confirm_borrar_todo_titulo: 'Excluir todos os dados',
    confirm_btn_cancelar: 'Cancelar',
    confirm_btn_eliminar: 'Excluir',
    confirm_cerrar_sesion: 'Sair? Seu plano e dados financeiros permanecerão neste dispositivo.',
    confirm_cerrar_sesion_btn: 'Sair',
    confirm_cerrar_sesion_titulo: 'Sair',
    confirm_eliminar_cliente: 'Excluir este cliente?',
    confirm_eliminar_cliente_titulo: 'Excluir cliente',
    confirm_eliminar_cuenta: 'Excluir esta conta?',
    confirm_eliminar_cuenta_titulo: 'Excluir conta',
    confirm_eliminar_deuda: 'Excluir esta dívida?',
    confirm_eliminar_deuda_titulo: 'Excluir dívida',
    confirm_eliminar_gasto: 'Excluir esta despesa?',
    confirm_eliminar_gasto_titulo: 'Excluir despesa',
    confirm_eliminar_ingreso: 'Excluir esta receita? Esta ação não pode ser desfeita.',
    confirm_eliminar_ingreso_titulo: 'Excluir receita',
    confirm_eliminar_inversion: 'Excluir este investimento?',
    confirm_eliminar_inversion_titulo: 'Excluir investimento',
    confirm_eliminar_objetivo: 'Excluir este objetivo?',
    confirm_eliminar_objetivo_titulo: 'Excluir objetivo',
    confirm_eliminar_presupuesto: 'Excluir o orçamento para',
    confirm_eliminar_presupuesto_titulo: 'Excluir orçamento',
    confirm_importar: 'Importar dados? Todos os dados atuais serão substituídos.',
    confirm_importar_btn: 'Importar',
    confirm_importar_titulo: 'Importar dados',
    confirm_saldo_neg: 'deixará a conta com saldo negativo. Continuar?',
    confirm_saldo_neg_btn: 'Continuar mesmo assim',
    confirm_saldo_neg_titulo: '⚠️ Saldo insuficiente',
    confirm_salir_demo: 'Sair do modo demo e excluir dados de exemplo?',
    confirm_salir_demo_btn: 'Sair para modo real',
    confirm_salir_demo_titulo: 'Sair da demo',
    confirm_titulo_def: 'Tem certeza?',
    cuenta_nombre_ph: 'Conta corrente Santander...',
    cuenta_sin_cuenta: 'Sem conta',
    deuda_calculadora_ph: 'Quanto você pode pagar por mês? (€)',
    deuda_calcular_btn: 'Calcular',
    deuda_input_invalido: 'Insira um valor mensal válido.',
    deuda_libre_pagar: 'Pagando por mês você estaria sem dívidas em aprox.',
    deuda_sin_pendientes: '✅ Você não tem dívidas pendentes!',
    drive_guardado: '✓ Salvo',
    drive_guardando: '⏳ Salvando...',
    drive_local: '(download local)',
    err_concepto_importe: 'Descrição e valor necessários',
    err_cuenta_no_encontrada: 'Conta não encontrada',
    err_cuenta_origen: 'Selecione a conta para receber o capital',
    err_cuentas_distintas: 'Selecione contas diferentes',
    err_excel: 'Erro ao gerar Excel',
    err_exportar: 'Erro de exportação',
    err_importe_aportar: 'Insira o valor',
    err_importe_pago: 'Insira o valor do pagamento',
    err_importe_valido: 'Insira um valor válido',
    err_inversion_no_encontrada: 'Investimento não encontrado',
    err_leer_archivo: 'Erro ao ler arquivo',
    err_limite_valido: 'Insira um limite válido',
    err_nombre_importe: 'Nome e valor necessários',
    err_nombre_meta: 'Nome e objetivo necessários',
    err_nombre_requerido: 'Nome necessário',
    err_pdf: 'Erro ao gerar PDF',
    err_selecciona_cat: 'Selecione uma categoria',
    err_selecciona_cuenta: 'Selecione uma conta',
    err_valor_salida: 'Insira o valor de saída',
    gc_ahora_no: 'Agora não',
    gc_crear: 'Criar objetivo 🎯',
    gc_sub: 'Definir uma meta de poupança é o primeiro passo. Vamos ajudar você a rastreá-la.',
    gc_titulo: 'Qual é seu objetivo este mês?',
    guardando: '⏳ Salvando…',
    intro_tagline: 'Suas finanças, em ordem',
    inversion_saldo_hint: 'Selecione uma conta para ver o saldo disponível',
    inversion_ya_liquidada: 'Este investimento foi fechado em',
    libre: 'Livre',
    meses: 'meses',
    mini_intro_tagline: 'Suas finanças, em ordem',
    mission_bar_sub: 'Adicione sua primeira receita para começar',
    mission_bar_titulo: 'Complete sua primeira missão',
    mission_modal_cerrar: 'Fechar',
    mission_modal_sub: 'Conclua essas ações para descobrir MoneyNest em 5 minutos.',
    mission_modal_titulo: '🚀 Suas missões iniciais',
    modal_aportar_cuenta_lbl: 'Conta de origem',
    modal_aportar_existente_lbl: '🏦 Dinheiro existente',
    modal_aportar_existente_sub: 'Deduzido do disponível',
    modal_aportar_fuente: 'De onde vem esse dinheiro?',
    modal_aportar_importe_lbl: 'Valor a contribuir (€) *',
    modal_aportar_nuevo_lbl: '💸 Dinheiro novo',
    modal_aportar_nuevo_sub: 'Não afeta o disponível',
    modal_cuenta_color_lbl: 'Cor identificatória',
    modal_cuenta_nombre_lbl: 'Nome da conta *',
    modal_cuenta_nombre_ph: 'Conta corrente Santander...',
    modal_cuenta_notas_lbl: 'Instituição / Notas',
    modal_cuenta_notas_ph: 'Santander, ING...',
    modal_cuenta_saldo_hint: 'Livre para usar agora',
    modal_cuenta_saldo_lbl: 'Dinheiro disponível (€)',
    modal_cuenta_tipo_ahorro: '💰 Poupança',
    modal_cuenta_tipo_banco: '🏦 Banco',
    modal_cuenta_tipo_cripto: '₿ Cripto',
    modal_cuenta_tipo_efectivo: '💵 Dinheiro',
    modal_cuenta_tipo_inversion: '📈 Investimento',
    modal_cuenta_tipo_lbl: 'Tipo',
    modal_cuenta_tipo_otro: '📁 Outro',
    modal_cuenta_titulo: 'Nova Conta',
    modal_cuenta_titulo_editar: 'Editar Conta',
    modal_cuenta_valor_hint: 'Saldo total incluindo ativos',
    modal_cuenta_valor_lbl: 'Valor total da conta (€)',
    modal_deuda_cat_lbl: 'Categoria',
    modal_deuda_interes_lbl: 'Juros anuais (%)',
    modal_deuda_nombre_lbl: 'Nome *',
    modal_deuda_notas_lbl: 'Notas',
    modal_deuda_nueva_cat_lbl: 'Nova categoria',
    modal_deuda_pagado_lbl: 'Já pago (€)',
    modal_deuda_total_lbl: 'Dívida total (€) *',
    modal_deuda_vencimiento_lbl: 'Vencimento',
    modal_export_desc: 'Exporte seus dados financeiros no formato preferido.',
    modal_export_excel_sub: 'Receita, despesas, investimentos, dívidas, objetivos, clientes',
    modal_export_excel_titulo: 'Excel completo (todas as abas)',
    modal_export_json_sub: 'Todos os dados · Para restaurar depois',
    modal_export_json_titulo: 'Backup (JSON)',
    modal_export_pdf_sub: 'Resumo visual com todas as seções',
    modal_export_pdf_titulo: 'Relatório PDF completo',
    modal_export_seccion: 'Exportar por seção',
    modal_export_titulo: 'Exportar dados',
    modal_gasto_cat_lbl: 'Categoria',
    modal_gasto_concepto_lbl: 'Descrição *',
    modal_gasto_cuenta_lbl: 'Conta *',
    modal_gasto_cuenta_sub: '(obrigatória)',
    modal_gasto_fecha_lbl: 'Data',
    modal_gasto_importe_lbl: 'Valor (€) *',
    modal_gasto_notas_lbl: 'Notas',
    modal_gasto_nueva_cat_lbl: 'Nova categoria',
    modal_ingreso_cat_lbl: 'Categoria',
    modal_ingreso_concepto_lbl: 'Descrição *',
    modal_ingreso_cuenta_lbl: 'Conta *',
    modal_ingreso_cuenta_sub: '(obrigatória)',
    modal_ingreso_fecha_lbl: 'Data',
    modal_ingreso_importe_lbl: 'Valor (€) *',
    modal_ingreso_notas_lbl: 'Notas',
    modal_ingreso_nueva_cat_lbl: 'Nova categoria',
    modal_inv_capital_lbl: 'Capital investido (€) *',
    modal_inv_cat_lbl: 'Categoria',
    modal_inv_cuenta_lbl: 'Conta de origem *',
    modal_inv_fecha_lbl: 'Data de entrada',
    modal_inv_nombre_lbl: 'Nome *',
    modal_inv_notas_lbl: 'Notas',
    modal_inv_nueva_cat_lbl: 'Nova categoria',
    modal_inv_rentabilidad_hint: 'Apenas para ativos com retorno previsível',
    modal_inv_rentabilidad_lbl: 'Retorno esperado (%)',
    modal_liquidar_cuenta_lbl: 'Conta para depositar',
    modal_liquidar_info: '✓ Capital será devolvido · Ganho registrado como receita · Perda registrada como despesa',
    modal_liquidar_rentabilidad_lbl: 'Ou retorno real (%)',
    modal_liquidar_titulo: '💰 Liquidar investimento',
    modal_liquidar_valor_lbl: 'Valor de saída (€)',
    modal_monthly_titulo: '📋 Fechamento mensal',
    modal_obj_actual_lbl: 'Poupado até agora (€)',
    modal_obj_cat_lbl: 'Categoria',
    modal_obj_color_lbl: 'Cor',
    modal_obj_fecha_lbl: 'Data do objetivo',
    modal_obj_imagen_sub: 'Opcional · aparece como fundo do cartão',
    modal_obj_imagen_titulo: 'Imagem do objetivo',
    modal_obj_meta_lbl: 'Objetivo (€) *',
    modal_obj_nombre_lbl: 'Nome *',
    modal_obj_notas_lbl: 'Notas',
    modal_obj_nueva_cat_lbl: 'Nova categoria',
    modal_obj_quitar_btn: '✕ Remover',
    modal_obj_subir_btn: '📷 Enviar imagem',
    modal_pago_fecha_lbl: 'Data do pagamento',
    modal_pago_importe_lbl: 'Valor do pagamento (€) *',
    modal_pres_cat_lbl: 'Categoria',
    modal_pres_limite_lbl: 'Limite mensal (€) *',
    modal_pres_nueva_cat_lbl: 'Nova categoria',
    modal_pres_titulo: 'Definir Orçamento',
    modal_tax_autonomo: 'Autônomo / Freelancer',
    modal_tax_custom: 'Personalizado',
    modal_tax_desc: 'No modo empresarial, MoneyNest calculará automaticamente a reserva fiscal.',
    modal_tax_empresa: 'Empresa (IR 25%)',
    modal_tax_irpf_hint: 'Retenção / Imposto corporativo',
    modal_tax_irpf_lbl: 'Imposto de Renda (%)',
    modal_tax_iva_hint: 'Percentual de IVA a cobrar',
    modal_tax_iva_lbl: 'IVA (%)',
    modal_tax_regimen_lbl: 'Regime fiscal',
    modal_tax_startup: 'Startup / Empresa nova (IR 15%)',
    modal_tax_titulo: '⚙️ Configurações fiscais',
    modal_trans_desde_lbl: 'De',
    modal_trans_hacia_lbl: 'Para',
    modal_trans_importe_lbl: 'Valor (€) *',
    modal_trans_titulo: 'Transferência entre contas',
    nav_seccion_finanzas: 'Finanças',
    nav_seccion_patrimonio: 'Patrimônio Líquido',
    nav_seccion_planificacion: 'Planejamento',
    nav_seccion_principal: 'Início',
    nav_seccion_sistema: 'Sistema',
    nav_sub_analisis: 'Análises & Tendências',
    nav_sub_cuentas: 'Contas',
    nav_sub_dashboard: 'Visão Geral',
    nav_sub_deudas: 'Dívidas',
    nav_sub_faq: 'Ajuda',
    nav_sub_gastos: 'Despesas',
    nav_sub_ingresos: 'Receita',
    nav_sub_inversiones: 'Investimentos',
    nav_sub_objetivos: 'Objetivos',
    nav_sub_patrimonio: 'Sua riqueza',
    nav_sub_presupuestos: 'Orçamentos',
    ob_skip: 'Pular',
    quick_add_categoria: 'Categoria',
    quick_add_descripcion_ph: 'Descrição (opcional)',
    quick_add_gasto: '💸 Despesa',
    quick_add_guardar: 'Salvar',
    quick_add_ingreso: '💰 Receita',
    quick_add_titulo: '⚡ Adicionar rápido',
    story_cerrar: 'Fechar',
    story_siguiente: 'Próximo →',
    toast_aportado_ok: 'Contribuído para objetivo ✓',
    toast_cat_añadida: 'Categoria adicionada ✓',
    toast_cat_existe: 'Esta categoria já existe',
    toast_cuenta_eliminada: 'Conta excluída',
    toast_cuenta_guardada: 'Conta salva ✓',
    toast_cuenta_min: 'Você precisa de pelo menos uma conta',
    toast_datos_eliminados: 'Todos os dados excluídos — configurações redefinidas',
    toast_deuda_eliminada: 'Dívida excluída',
    toast_deuda_guardada: 'Dívida salva ✓',
    toast_deudas_exportadas: 'Dívidas exportadas ✓',
    toast_drive_error: 'Drive indisponível — download local',
    toast_drive_ok: '☁️ Backup salvo no Google Drive ✓',
    toast_espacio_insuficiente: '💾 Espaço insuficiente. Use uma imagem menor.',
    toast_excel_exportado: 'Excel exportado ✓',
    toast_exportado: 'Exportado ✓',
    toast_gasto_eliminado: 'Despesa excluída',
    toast_gasto_guardado: 'Despesa salva ✓',
    toast_gastos_exportados: 'Despesas exportadas ✓',
    toast_guardado: 'Salvo ✓',
    toast_imagen_actualizada: 'Imagem atualizada ✓',
    toast_imagen_eliminada: 'Imagem removida',
    toast_ingreso_eliminado: 'Receita excluída',
    toast_ingreso_guardado: 'Receita salva ✓',
    toast_ingresos_exportados: 'Receita exportada ✓',
    toast_inversion_eliminada: 'Investimento excluído',
    toast_inversion_guardada: 'Investimento registrado ✓ · Saldo atualizado',
    toast_inversiones_exportadas: 'Investimentos exportados ✓',
    toast_json_exportado: 'Backup exportado ✓',
    toast_json_importado: 'Dados importados ✓',
    toast_liquidado_ganancia: 'Investimento fechado · Ganho registrado',
    toast_liquidado_neutro: 'Investimento fechado',
    toast_liquidado_perdida: 'Investimento fechado · Perda registrada',
    toast_objetivo_eliminado: 'Objetivo excluído',
    toast_objetivo_guardado: 'Objetivo salvo ✓',
    toast_objetivos_exportados: 'Objetivos exportados ✓',
    toast_pago_registrado: 'Pagamento registrado ✓',
    toast_pdf_exportado: 'PDF exportado ✓',
    toast_perfil_guardado: 'Perfil salvo ✓',
    toast_presupuesto_eliminado: 'Orçamento excluído',
    toast_presupuesto_guardado: 'Orçamento salvo ✓',
    toast_presupuestos_exportados: 'Orçamentos exportados ✓',
    toast_transferencia_ok: 'Transferência concluída ✓',
    topbar_activar_pro: '⚡ Ativar Pro',
    topbar_cambiar_tema: 'Mudar tema',
    topbar_disponible: 'Disponível',
    topbar_importar: '⬇ Importar',
    topbar_exportar: '⬆ Exportar',
    nav_logros: 'Conquistas',
    nav_facturacion: 'Plano e faturação', nav_sub_facturacion: 'Seu plano e pagamentos',
    nav_sub_logros: 'As suas metas alcançadas',
    cfg_notificaciones: 'Notificações',
    tut_salir: '✕ Sair',
    tut_siguiente: 'Próximo →',
    ver_movimientos_btn: '📋 Ver movimentos',
    deuda_libertad_titulo: '🏁 Planejamento de Liberdade Financeira',
    deuda_libertad_sub: 'Defina seu objetivo e calcule quanto precisa pagar',
    deuda_libertad_objetivo_lbl: 'Quero ficar livre de dívidas em',
    deuda_libertad_calcular: 'Calcular prestação',
    deuda_libertad_resultado_pre: 'Para ser livre em',
    deuda_libertad_resultado_mid: 'você precisa pagar:',
    deuda_libertad_mensual: 'Mensal',
    deuda_libertad_semanal: 'Semanal',
    deuda_libertad_diario: 'Diário',
    deuda_libertad_sin_deuda: 'Você já está livre de dívidas! 🎉',
    deuda_libertad_invalido: 'Insira um período válido (número maior que 0).',
    anos: 'anos',
    semanas: 'semanas',
    dias: 'dias',
    deuda_activar_estrategia: 'Ativar esta estratégia',
    deuda_estrategia_activa: '✓ Estratégia Ativa',
    deuda_info_automatizacion: 'Seus pagamentos serão distribuídos de acordo com este valor para cumprir seu objetivo no prazo previsto.',
    topbar_prueba_termina_en: 'Avaliação termina em:',
    horas: 'h',
    minutos: 'm',
}
}

let _currentLang = 'es'

function t(key, fallback) {
  const lang = TRANSLATIONS[_currentLang] || TRANSLATIONS['es']
  if (lang[key] !== undefined) return lang[key]
  if (TRANSLATIONS['es'][key] !== undefined) return TRANSLATIONS['es'][key]
  return fallback !== undefined ? fallback : key
}

// ════════════════════════════════════════════════════════════════
// ─── TRADUCCIONES EXTENDIDAS (PASO 1 + PASO 5) ───────────────
// Cubre el 100% de textos visibles: Dashboard, Ingresos, Gastos,
// Inversiones, Deudas, Objetivos, Cuentas, Modales, Patrimonio,
// Análisis, Health Score, filtros, tablas, vacíos y más.
// También corrige el bug del saludo (Paso 5): hola_nombre
// ════════════════════════════════════════════════════════════════
;(function _extendTranslations() {
  const EXT = {
    es: {
      // ── Análisis — proyección patrimonial ───────────────────
      proyeccion_titulo: 'Proyección patrimonial',
      proyeccion_sub: 'Media últimos 3 meses',
      escenario_conservador: 'Conservador',
      escenario_moderado: 'Moderado',
      escenario_optimista: 'Optimista',
      proyeccion_negativa: 'Proyección negativa',
      proyeccion_negativa_msg: 'Reducir gastos o aumentar ingresos.',
      proyeccion_excelente: 'Proyección excelente',
      proyeccion_excelente_msg: 'Considera invertir el excedente.',
      de_ingresos: 'de ingresos',
      mes_lbl: 'mes',

      // ── Deudas — estrategias ────────────────────────────────
      crear_estrategia: 'Crear estrategia',
      personaliza_pago: 'Personaliza tu pago mensual',

      // ── Auth ─────────────────────────────────────────────────
      desbloquear: 'Desbloquear',

      // ── Saludo Dashboard (bug fix: sin doble coma) ──────────
      hola_sin_coma: 'Hola',          // usado internamente
      dias_streak: 'días',

      // ── Dashboard – textos extra ────────────────────────────
      salud_financiera: 'Salud financiera',
      fin_de_mes: 'Fin de mes',
      estimado: 'estimado',
      posible_deficit: 'posible déficit',
      liquidez: 'Liquidez',
      invertido: 'Invertido',
      activos: 'Activos',
      deudas_lbl: 'Deudas',
      ingresos_lbl: 'Ingresos',
      gastos_lbl: 'Gastos',
      sin_deudas: 'Sin deudas ✅',
      cuentas_lbl: 'Cuentas',
      superavit: 'Superávit',
      deficit: 'Déficit',
      vs_mes_ant: 'vs. mes ant.',
      vs_ant: 'vs. ant.',
      primer_mes_lbl: 'Primer mes',
      entradas: 'entradas',
      salidas: 'salidas',
      ahorro_rate: 'Ahorro:',
      mas_ver_todo: 'más →',
      generados_tus_datos: 'Generados desde tus datos',
      aun_sin_datos: 'Aún no hay suficientes datos',
      anadir_movs: 'Añade algunos movimientos para ver insights personalizados.',
      todo_orden_mes: 'Todo en orden este mes',
      sigue_mas_detalle: 'Sigue registrando para obtener análisis más detallados.',
      sin_movimientos_aun: 'Sin movimientos registrados aún',

      // ── Ingresos ────────────────────────────────────────────
      cobrado_este_mes: 'Cobrado este mes',
      pendiente_cobro: 'Pendiente de cobro',
      top_categoria: 'Top categoría',
      mes_anterior_lbl: 'Mes anterior',
      por_categoria_mes: 'Por categoría (mes actual)',
      evolucion_6m: 'Evolución 12 meses',
      pendientes_cobro_titulo: 'Pendientes de cobro',
      ingresos_cobrados: 'Ingresos cobrados',
      cobrar_btn: '✓ Cobrado',
      estado_pendiente: '⏳ Pendiente',
      estado_recurrente: '↻ Recurrente',
      concepto: 'Concepto',
      importe: 'Importe',
      categoria: 'Categoría',
      fecha: 'Fecha',
      cuenta_destino: 'Cuenta destino',
      cuenta_lbl: 'Cuenta',
      estado: 'Estado',
      acciones: 'Acciones',
      buscar_concepto: '🔍 Buscar por concepto...',
      todas_categorias: 'Todas las categorías',
      todos_sin_filtro: 'Todos (sin filtro)',
      limpiar_filtros: '✕ Limpiar',
      ver_todos_ingresos: '🔍 Ver todos los ingresos',
      sin_resultados_periodo: 'Sin resultados en este período',
      sin_ingresos_cobrados: 'Aún no tienes ingresos cobrados',
      cambiar_periodo: 'Cambia el período o limpia los filtros para ver tus ingresos',
      primer_ingreso: 'Añade tu primer ingreso con el botón + Nuevo ingreso',
      cobrados_lbl: 'cobrado',
      cobrados_lbl_pl: 'cobrados',
      factura_lbl: 'factura',
      facturas_lbl: 'facturas',
      pendiente_lbl: 'pendiente',
      pendientes_lbl: 'pendientes',
      entrada_lbl: 'entrada',
      entradas_lbl: 'entradas',
      por_cobrar: 'por cobrar',

      // ── Gastos ──────────────────────────────────────────────
      total_este_mes_g: 'Total este mes',
      total_este_anio_g: 'Total este año',
      total_periodo_g: 'Total período',
      mayor_categoria: 'Mayor categoría',
      media_mensual_3m: 'Media mensual (3 m)',
      por_encima: '⬆ Por encima',
      por_debajo: '⬇ Por debajo',
      por_categoria: 'Por categoría',
      todos_gastos: 'Todos los gastos',
      sin_resultados: 'Sin resultados',
      ajusta_aniade: 'Ajusta el período o añade un gasto',
      control_salidas: 'Control de tus salidas de dinero',
      resultado_lbl: 'resultado',
      resultados_lbl: 'resultados',

      // ── Inversiones ─────────────────────────────────────────
      cartera_activa: 'Cartera activa',
      ganancia_realizada: 'Ganancia realizada',
      ganancia_latente: 'Ganancia latente',
      tasa_exito: 'Tasa de éxito',
      abiertas: 'abiertas',
      cerradas: 'cerradas',
      sin_inversiones: 'Aún no tienes inversiones',
      anadir_primera_inv: 'Añade tu primera inversión para ver el rendimiento de tu cartera.',
      sin_inversiones_cerradas: 'Sin inversiones cerradas',
      liquidar_btn: 'Liquidar',
      roi_real: 'ROI real',
      roi_esp: 'ROI esp.',
      capital_inv: 'Capital',
      valor_actual: 'Valor actual',
      ganancia_lbl: 'Ganancia',
      rentabilidad_lbl: 'Rentabilidad',
      abiertas_lbl: 'Abiertas',
      cerradas_lbl: 'Cerradas',
      inv_activas: 'Inversiones activas',
      inv_cerradas_titulo: 'Historial de inversiones cerradas',

      // ── Deudas ──────────────────────────────────────────────
      deuda_total: 'Deuda total',
      pagado_total: 'Pagado total',
      pendiente_total: 'Pendiente total',
      interes_medio: 'Interés medio',
      sin_deudas_titulo: 'Sin deudas registradas',
      sin_deudas_sub: '¡Enhorabuena! No tienes deudas registradas, o añade una para hacer seguimiento.',
      pagar_btn: 'Pagar',
      pagado_lbl: 'Pagado',
      pendiente_d: 'Pendiente',
      vence: 'Vence',
      interes: 'Interés',
      progreso: 'Progreso',
      cuota_mens: 'Cuota mensual',
      nombre_lbl: 'Nombre',

      // ── Objetivos ───────────────────────────────────────────
      ahorro_total_obj: 'Ahorro total',
      objetivo_mas_cercano: 'Más cercano',
      sin_objetivos: 'Aún no tienes objetivos',
      sin_objetivos_sub: 'Crea tu primer objetivo para empezar a ahorrar de forma organizada.',
      aportar_btn: 'Aportar',
      completado: 'Completado ✓',
      meta_lbl: 'Meta',
      ahorrado_lbl: 'Ahorrado',
      faltan_lbl: 'Faltan',
      dias_lbl: 'días',
      objetivo_alcanzado: '¡Objetivo alcanzado! 🎉',
      aportar_titulo: 'Añadir dinero al objetivo',
      dinero_nuevo: '💸 Dinero nuevo',
      no_afecta_disponible: 'No afecta al disponible',
      dinero_existente: '🏦 Dinero existente',
      resta_disponible: 'Se resta del disponible',

      // ── Cuentas ─────────────────────────────────────────────
      total_disponible: 'Total disponible',
      saldo_lbl: 'Saldo',
      tipo_cuenta: 'Tipo',
      banco_lbl: 'Banco',
      efectivo_lbl: 'Efectivo',
      ahorro_lbl: 'Ahorro',
      sin_cuentas: 'Sin cuentas registradas',
      nueva_cuenta_btn: '+ Nueva cuenta',
      editar_saldo: 'Editar saldo',
      ajuste_saldo: 'Ajuste de saldo',
      cuenta_principal: 'Cuenta Principal',

      // ── Presupuestos ─────────────────────────────────────────
      presupuesto_mensual: 'Presupuesto mensual',
      gasto_real: 'Gasto real',
      disponible_pres: 'Disponible',
      sin_presupuesto: 'Sin presupuesto definido',
      define_presupuesto: 'Define un presupuesto para esta categoría',
      presupuesto_lbl: 'Presupuesto',
      sobre_pres: 'sobre presupuesto',
      bajo_pres: 'bajo presupuesto',
      distribucion_503020: 'Distribución 50/30/20',
      necesidades: 'Necesidades',
      deseos: 'Deseos',
      ahorro_inv: 'Ahorro/Inv.',
      recomendado: 'recomendado',
      real_lbl: 'real',

      // ── Patrimonio ───────────────────────────────────────────
      patrimonio_lbl: 'Patrimonio',
      evolucion_pat: 'Evolución del patrimonio',
      activos_fisicos: 'Activos físicos',
      sin_activos: 'Sin activos físicos',
      anadir_activo: '+ Añadir activo',
      valor_actual_pat: 'Valor actual',
      depreciacion_lbl: 'Depreciación',
      valor_compra: 'Valor de compra',
      tipo_activo: 'Tipo de activo',

      // ── Análisis ─────────────────────────────────────────────
      ingvsgastos: 'Ingresos vs Gastos',
      tasa_ahorro: 'Tasa de ahorro',
      cashflow_mensual: 'Cash flow mensual',
      top_categorias_g: 'Top categorías de gasto',
      balance_mensual: 'Balance mensual',
      comparativa_anual: 'Comparativa anual',

      // ── Health Score factors ──────────────────────────────────
      hs_ahorro: 'Tasa de ahorro positiva',
      hs_gastos: 'Gastos controlados',
      hs_objetivos: 'Objetivos activos',
      hs_deudas: 'Sin deudas críticas',
      hs_ingresos: 'Ingresos regulares',

      // ── Modales estáticos ────────────────────────────────────
      modal_nuevo_ingreso: 'Nuevo Ingreso',
      modal_nuevo_gasto: 'Nuevo Gasto',
      modal_nueva_inv: 'Nueva Inversión',
      modal_nueva_deuda: 'Nueva Deuda',
      modal_nuevo_obj: 'Nuevo Objetivo',
      modal_liquidar: '💰 Liquidar inversión',
      modal_registrar_pago: 'Registrar pago',
      modal_aportar: 'Añadir dinero al objetivo',
      lbl_concepto: 'Concepto *',
      lbl_importe_eur: 'Importe (€) *',
      lbl_categoria: 'Categoría',
      lbl_fecha: 'Fecha',
      lbl_nueva_cat: 'Nueva categoría',
      lbl_cuenta_obl: 'Cuenta *',
      lbl_cuenta_obl_sub: '(obligatoria)',
      lbl_notas: 'Notas',
      lbl_notas_ph: 'Notas opcionales...',
      lbl_recurrente_ing: 'Ingreso recurrente (mensual)',
      lbl_pendiente_cobro: 'Pendiente de cobro (no ingresado aún)',
      lbl_actualizar_saldo: 'Actualizar saldo de cuenta',
      lbl_recurrente_gas: 'Gasto recurrente',
      lbl_descontar_saldo: 'Descontar del saldo de cuenta',
      lbl_nombre_obl: 'Nombre *',
      lbl_capital_inv: 'Capital invertido (€) *',
      lbl_rentabilidad_esp: 'Rentabilidad esperada (%)',
      lbl_rentabilidad_hint: 'Solo para activos con retorno predecible',
      lbl_fecha_entrada: 'Fecha entrada',
      lbl_cuenta_origen: 'Cuenta de origen *',
      lbl_estrategia_ph: 'Estrategia, plataforma...',
      lbl_total_deuda: 'Total deuda (€) *',
      lbl_ya_pagado: 'Ya pagado (€)',
      lbl_interes_anual: 'Interés anual (%)',
      lbl_vencimiento: 'Vencimiento',
      lbl_banco_cond: 'Banco, condiciones...',
      lbl_meta_eur: 'Meta (€) *',
      lbl_ahorrado_hasta: 'Ahorrado hasta ahora (€)',
      lbl_fecha_objetivo: 'Fecha objetivo',
      lbl_color_lbl: 'Color',
      lbl_para_que: 'Para qué es este objetivo...',
      lbl_imagen_obj: 'Imagen del objetivo',
      lbl_imagen_opcional: 'Opcional · aparece como fondo de la tarjeta',
      lbl_subir_imagen: '📷 Subir imagen',
      lbl_quitar: '✕ Quitar',
      ph_concepto_ing: 'Salario enero...',
      ph_concepto_gas: 'Supermercado...',
      ph_nombre_inv: 'Tesla, BTC, ETF World...',
      ph_hipoteca: 'Hipoteca, tarjeta...',
      ph_fondo_emerg: 'Fondo de emergencia...',
      ph_cat_custom: 'Nombre de la categoría',
      ph_estrategia: 'Estrategia, plataforma...',
      cat_custom_lbl: '+ Categoría personalizada',
      btn_cobrado: '✓ Cobrado',
      btn_liquidar: 'Liquidar',
      btn_registrar_pago: 'Registrar pago',
      btn_aportar: 'Aportar',
      lbl_valor_salida: 'Valor de salida (€)',
      lbl_o_rentabilidad: 'O rentabilidad real (%)',
      lbl_cuenta_ingresar: 'Cuenta donde ingresar',
      liq_info: '✓ El capital se devolverá a la cuenta · La ganancia se registrará como ingreso · La pérdida se registrará como gasto',
      lbl_importe_pago: 'Importe del pago (€) *',
      lbl_fecha_pago: 'Fecha del pago',
      lbl_fuente_dinero: '¿De dónde viene este dinero?',
      lbl_importe_aportar: 'Importe a aportar (€) *',
      lbl_seleccionar_cuenta: 'Selecciona una cuenta para ver el saldo disponible',
    },
    en: {
      hola_sin_coma: 'Hello',
      dias_streak: 'days',
      salud_financiera: 'Financial Health',
      fin_de_mes: 'End of month',
      estimado: 'estimated',
      posible_deficit: 'possible deficit',
      liquidez: 'Liquidity',
      invertido: 'Invested',
      activos: 'Assets',
      deudas_lbl: 'Debts',
      ingresos_lbl: 'Income',
      gastos_lbl: 'Expenses',
      sin_deudas: 'No debts ✅',
      cuentas_lbl: 'Accounts',
      superavit: 'Surplus',
      deficit: 'Deficit',
      vs_mes_ant: 'vs. prev. month',
      vs_ant: 'vs. prev.',
      primer_mes_lbl: 'First month',
      entradas: 'entries',
      salidas: 'exits',
      ahorro_rate: 'Savings:',
      mas_ver_todo: 'more →',
      generados_tus_datos: 'Generated from your data',
      aun_sin_datos: 'Not enough data yet',
      anadir_movs: 'Add some transactions to see personalized insights.',
      todo_orden_mes: 'All on track this month',
      sigue_mas_detalle: 'Keep recording to get more detailed analysis.',
      sin_movimientos_aun: 'No transactions recorded yet',

      cobrado_este_mes: 'Collected this month',
      pendiente_cobro: 'Pending collection',
      top_categoria: 'Top category',
      mes_anterior_lbl: 'Previous month',
      por_categoria_mes: 'By category (current month)',
      evolucion_6m: 'Evolution 12 months',
      pendientes_cobro_titulo: 'Pending collection',
      ingresos_cobrados: 'Collected income',
      cobrar_btn: '✓ Collected',
      estado_pendiente: '⏳ Pending',
      estado_recurrente: '↻ Recurring',
      concepto: 'Description',
      importe: 'Amount',
      categoria: 'Category',
      fecha: 'Date',
      cuenta_destino: 'Target account',
      cuenta_lbl: 'Account',
      estado: 'Status',
      acciones: 'Actions',
      buscar_concepto: '🔍 Search by description...',
      todas_categorias: 'All categories',
      todos_sin_filtro: 'All (no filter)',
      limpiar_filtros: '✕ Clear',
      ver_todos_ingresos: '🔍 View all income',
      sin_resultados_periodo: 'No results for this period',
      sin_ingresos_cobrados: 'You have no collected income yet',
      cambiar_periodo: 'Change the period or clear filters to see your income',
      primer_ingreso: 'Add your first income with the + New income button',
      cobrados_lbl: 'collected',
      cobrados_lbl_pl: 'collected',
      factura_lbl: 'invoice',
      facturas_lbl: 'invoices',
      pendiente_lbl: 'pending',
      pendientes_lbl: 'pending',
      entrada_lbl: 'entry',
      entradas_lbl: 'entries',
      por_cobrar: 'to collect',

      total_este_mes_g: 'Total this month',
      total_este_anio_g: 'Total this year',
      total_periodo_g: 'Total period',
      mayor_categoria: 'Top category',
      media_mensual_3m: 'Monthly average (3 m)',
      por_encima: '⬆ Above average',
      por_debajo: '⬇ Below average',
      por_categoria: 'By category',
      todos_gastos: 'All expenses',
      sin_resultados: 'No results',
      ajusta_aniade: 'Adjust the period or add an expense',
      control_salidas: 'Track your outgoing money',
      resultado_lbl: 'result',
      resultados_lbl: 'results',

      cartera_activa: 'Active portfolio',
      ganancia_realizada: 'Realized gain',
      ganancia_latente: 'Unrealized gain',
      tasa_exito: 'Success rate',
      abiertas: 'open',
      cerradas: 'closed',
      sin_inversiones: 'No investments yet',
      anadir_primera_inv: 'Add your first investment to track your portfolio performance.',
      sin_inversiones_cerradas: 'No closed investments',
      liquidar_btn: 'Close',
      roi_real: 'Real ROI',
      roi_esp: 'Exp. ROI',
      capital_inv: 'Capital',
      valor_actual: 'Current value',
      ganancia_lbl: 'Gain',
      rentabilidad_lbl: 'Return',
      abiertas_lbl: 'Open',
      cerradas_lbl: 'Closed',
      inv_activas: 'Active investments',
      inv_cerradas_titulo: 'Closed investments history',

      deuda_total: 'Total debt',
      pagado_total: 'Total paid',
      pendiente_total: 'Total pending',
      interes_medio: 'Average interest',
      sin_deudas_titulo: 'No debts recorded',
      sin_deudas_sub: 'Congratulations! You have no debts, or add one to track it.',
      pagar_btn: 'Pay',
      pagado_lbl: 'Paid',
      pendiente_d: 'Pending',
      vence: 'Due',
      interes: 'Interest',
      progreso: 'Progress',
      cuota_mens: 'Monthly payment',
      nombre_lbl: 'Name',

      ahorro_total_obj: 'Total savings',
      objetivo_mas_cercano: 'Closest',
      sin_objetivos: 'No goals yet',
      sin_objetivos_sub: 'Create your first goal to start saving in an organized way.',
      aportar_btn: 'Contribute',
      completado: 'Completed ✓',
      meta_lbl: 'Goal',
      ahorrado_lbl: 'Saved',
      faltan_lbl: 'Remaining',
      dias_lbl: 'days',
      objetivo_alcanzado: 'Goal reached! 🎉',
      aportar_titulo: 'Add money to goal',
      dinero_nuevo: '💸 New money',
      no_afecta_disponible: 'Does not affect balance',
      dinero_existente: '🏦 Existing money',
      resta_disponible: 'Deducted from balance',

      total_disponible: 'Total available',
      saldo_lbl: 'Balance',
      tipo_cuenta: 'Type',
      banco_lbl: 'Bank',
      efectivo_lbl: 'Cash',
      ahorro_lbl: 'Savings',
      sin_cuentas: 'No accounts recorded',
      nueva_cuenta_btn: '+ New account',
      editar_saldo: 'Edit balance',
      ajuste_saldo: 'Balance adjustment',
      cuenta_principal: 'Main Account',

      presupuesto_mensual: 'Monthly budget',
      gasto_real: 'Actual spending',
      disponible_pres: 'Available',
      sin_presupuesto: 'No budget defined',
      define_presupuesto: 'Define a budget for this category',
      presupuesto_lbl: 'Budget',
      sobre_pres: 'over budget',
      bajo_pres: 'under budget',
      distribucion_503020: '50/30/20 Distribution',
      necesidades: 'Needs',
      deseos: 'Wants',
      ahorro_inv: 'Savings/Inv.',
      recomendado: 'recommended',
      real_lbl: 'actual',

      patrimonio_lbl: 'Net Worth',
      evolucion_pat: 'Net Worth evolution',
      activos_fisicos: 'Physical assets',
      sin_activos: 'No physical assets',
      anadir_activo: '+ Add asset',
      valor_actual_pat: 'Current value',
      depreciacion_lbl: 'Depreciation',
      valor_compra: 'Purchase value',
      tipo_activo: 'Asset type',

      ingvsgastos: 'Income vs Expenses',
      tasa_ahorro: 'Savings rate',
      cashflow_mensual: 'Monthly cash flow',
      top_categorias_g: 'Top expense categories',
      balance_mensual: 'Monthly balance',
      comparativa_anual: 'Annual comparison',

      hs_ahorro: 'Positive savings rate',
      hs_gastos: 'Controlled expenses',
      hs_objetivos: 'Active goals',
      hs_deudas: 'No critical debts',
      hs_ingresos: 'Regular income',

      modal_nuevo_ingreso: 'New Income',
      modal_nuevo_gasto: 'New Expense',
      modal_nueva_inv: 'New Investment',
      modal_nueva_deuda: 'New Debt',
      modal_nuevo_obj: 'New Goal',
      modal_liquidar: '💰 Close investment',
      modal_registrar_pago: 'Record payment',
      modal_aportar: 'Add money to goal',
      lbl_concepto: 'Description *',
      lbl_importe_eur: 'Amount (€) *',
      lbl_categoria: 'Category',
      lbl_fecha: 'Date',
      lbl_nueva_cat: 'New category',
      lbl_cuenta_obl: 'Account *',
      lbl_cuenta_obl_sub: '(required)',
      lbl_notas: 'Notes',
      lbl_notas_ph: 'Optional notes...',
      lbl_recurrente_ing: 'Recurring income (monthly)',
      lbl_pendiente_cobro: 'Pending collection (not yet received)',
      lbl_actualizar_saldo: 'Update account balance',
      lbl_recurrente_gas: 'Recurring expense',
      lbl_descontar_saldo: 'Deduct from account balance',
      lbl_nombre_obl: 'Name *',
      lbl_capital_inv: 'Invested capital (€) *',
      lbl_rentabilidad_esp: 'Expected return (%)',
      lbl_rentabilidad_hint: 'Only for assets with predictable returns',
      lbl_fecha_entrada: 'Entry date',
      lbl_cuenta_origen: 'Source account *',
      lbl_estrategia_ph: 'Strategy, platform...',
      lbl_total_deuda: 'Total debt (€) *',
      lbl_ya_pagado: 'Already paid (€)',
      lbl_interes_anual: 'Annual interest (%)',
      lbl_vencimiento: 'Due date',
      lbl_banco_cond: 'Bank, conditions...',
      lbl_meta_eur: 'Goal (€) *',
      lbl_ahorrado_hasta: 'Saved so far (€)',
      lbl_fecha_objetivo: 'Target date',
      lbl_color_lbl: 'Color',
      lbl_para_que: 'What is this goal for...',
      lbl_imagen_obj: 'Goal image',
      lbl_imagen_opcional: 'Optional · appears as card background',
      lbl_subir_imagen: '📷 Upload image',
      lbl_quitar: '✕ Remove',
      ph_concepto_ing: 'January salary...',
      ph_concepto_gas: 'Supermarket...',
      ph_nombre_inv: 'Tesla, BTC, ETF World...',
      ph_hipoteca: 'Mortgage, credit card...',
      ph_fondo_emerg: 'Emergency fund...',
      ph_cat_custom: 'Category name',
      ph_estrategia: 'Strategy, platform...',
      cat_custom_lbl: '+ Custom category',
      btn_cobrado: '✓ Collected',
      btn_liquidar: 'Close',
      btn_registrar_pago: 'Record payment',
      btn_aportar: 'Contribute',
      lbl_valor_salida: 'Exit value (€)',
      lbl_o_rentabilidad: 'Or actual return (%)',
      lbl_cuenta_ingresar: 'Account to receive',
      liq_info: '✓ Capital returned to account · Gain recorded as income · Loss recorded as expense',
      lbl_importe_pago: 'Payment amount (€) *',
      lbl_fecha_pago: 'Payment date',
      lbl_fuente_dinero: 'Where does this money come from?',
      lbl_importe_aportar: 'Amount to contribute (€) *',
      lbl_seleccionar_cuenta: 'Select an account to see available balance',
    },
  }
  // Copy ES keys to IT/FR/DE/PT with fallback to ES (only keys not yet defined)
  const FALLBACK_LANGS = ['it','fr','de','pt','ca']
  Object.keys(EXT.es).forEach(key => {
    FALLBACK_LANGS.forEach(lang => {
      if (!EXT[lang]) EXT[lang] = {}
      if (EXT[lang][key] === undefined) EXT[lang][key] = EXT.es[key]
    })
  })
  // Merge into TRANSLATIONS
  Object.keys(EXT).forEach(lang => {
    if (!TRANSLATIONS[lang]) TRANSLATIONS[lang] = {}
    Object.assign(TRANSLATIONS[lang], EXT[lang])
  })
})()


// ─── CATEGORY TRANSLATIONS ─────────────────────────────────────
// Default category names keyed by ES name → per-language translation
// Custom categories (not in this map) are always shown as-is.
const CAT_TRANSLATIONS = {
  // Ingresos
  'Salario':        { en:'Salary',      it:'Stipendio',    fr:'Salaire',    de:'Gehalt',    pt:'Salário'    },
  'Freelance':      { en:'Freelance',   it:'Freelance',    fr:'Freelance',  de:'Freelance', pt:'Freelance'  },
  'Alquiler':       { en:'Rent',        it:'Affitto',      fr:'Loyer',      de:'Miete',     pt:'Aluguel'    },
  'Dividendos':     { en:'Dividends',   it:'Dividendi',    fr:'Dividendes', de:'Dividenden',pt:'Dividendos' },
  'Venta':          { en:'Sale',        it:'Vendita',      fr:'Vente',      de:'Verkauf',   pt:'Venda'      },
  'Bono':           { en:'Bonus',       it:'Bonus',        fr:'Prime',      de:'Bonus',     pt:'Bónus'      },
  // Gastos
  'Vivienda':       { en:'Housing',     it:'Abitazione',   fr:'Logement',   de:'Wohnen',    pt:'Habitação'  },
  'Alimentación':   { en:'Food',        it:'Alimentazione',fr:'Alimentation',de:'Ernährung',pt:'Alimentação'},
  'Transporte':     { en:'Transport',   it:'Trasporto',    fr:'Transport',  de:'Transport', pt:'Transporte' },
  'Salud':          { en:'Health',      it:'Salute',       fr:'Santé',      de:'Gesundheit',pt:'Saúde'      },
  'Ocio':           { en:'Leisure',     it:'Svago',        fr:'Loisirs',    de:'Freizeit',  pt:'Lazer'      },
  'Ropa':           { en:'Clothing',    it:'Abbigliamento',fr:'Vêtements',  de:'Kleidung',  pt:'Roupa'      },
  'Educación':      { en:'Education',   it:'Istruzione',   fr:'Éducation',  de:'Bildung',   pt:'Educação'   },
  'Suscripciones':  { en:'Subscriptions',it:'Abbonamenti', fr:'Abonnements',de:'Abonnements',pt:'Assinaturas'},
  'Restaurantes':   { en:'Restaurants', it:'Ristoranti',   fr:'Restaurants',de:'Restaurants',pt:'Restaurantes'},
  'Tecnología':     { en:'Technology',  it:'Tecnologia',   fr:'Technologie',de:'Technologie',pt:'Tecnologia' },
  'Seguros':        { en:'Insurance',   it:'Assicurazioni',fr:'Assurances', de:'Versicherungen',pt:'Seguros' },
  'Tabaco':         { en:'Tobacco',     it:'Tabacco',      fr:'Tabac',      de:'Tabak',     pt:'Tabaco'     },
  'Efectivo':       { en:'Cash',        it:'Contanti',     fr:'Espèces',    de:'Bargeld',   pt:'Dinheiro'   },
  // Inversiones
  'Acciones':       { en:'Stocks',      it:'Azioni',       fr:'Actions',    de:'Aktien',    pt:'Ações'      },
  'ETF':            { en:'ETF',         it:'ETF',          fr:'ETF',        de:'ETF',       pt:'ETF'        },
  'Cripto':         { en:'Crypto',      it:'Cripto',       fr:'Crypto',     de:'Krypto',    pt:'Cripto'     },
  'Inmuebles':      { en:'Real Estate', it:'Immobili',     fr:'Immobilier', de:'Immobilien',pt:'Imóveis'    },
  'Bonos':          { en:'Bonds',       it:'Obbligazioni', fr:'Obligations',de:'Anleihen',  pt:'Obrigações' },
  'Fondo indexado': { en:'Index Fund',  it:'Fondo indicizzato',fr:'Fonds indiciel',de:'Indexfonds',pt:'Fundo índice'},
  'Startups':       { en:'Startups',    it:'Startup',      fr:'Startups',   de:'Startups',  pt:'Startups'   },
  // Deudas
  'Hipoteca':       { en:'Mortgage',    it:'Mutuo',        fr:'Hypothèque', de:'Hypothek',  pt:'Hipoteca'   },
  'Préstamo personal':{ en:'Personal Loan',it:'Prestito personale',fr:'Prêt personnel',de:'Privatkredit',pt:'Empréstimo pessoal'},
  'Tarjeta crédito':{ en:'Credit Card', it:'Carta di credito',fr:'Carte de crédit',de:'Kreditkarte',pt:'Cartão crédito'},
  'Préstamo coche': { en:'Car Loan',    it:'Prestito auto', fr:'Prêt voiture',de:'Autokredit',pt:'Empréstimo carro'},
  // Objetivos
  'Emergencia':     { en:'Emergency',   it:'Emergenza',    fr:'Urgence',    de:'Notfall',   pt:'Emergência' },
  'Viaje':          { en:'Travel',      it:'Viaggio',      fr:'Voyage',     de:'Reise',     pt:'Viagem'     },
  'Coche':          { en:'Car',         it:'Auto',         fr:'Voiture',    de:'Auto',      pt:'Carro'      },
  'Casa':           { en:'Home',        it:'Casa',         fr:'Maison',     de:'Haus',      pt:'Casa'       },
  'Jubilación':     { en:'Retirement',  it:'Pensione',     fr:'Retraite',   de:'Rente',     pt:'Reforma'    },
  // Shared
  'Otro':           { en:'Other',       it:'Altro',        fr:'Autre',      de:'Andere',    pt:'Outro'      },

  ca: {
    // ── Nav ─────────────────────────────────────────────────────
    nav_principal: 'Principal', nav_finanzas: 'Finances',
    nav_planificacion: 'Planificació', nav_patrimonio_sec: 'Patrimoni',
    // ── Dashboard ───────────────────────────────────────────────
    hola_sin_coma: 'Hola,', resumen_financiero: 'Resum financer',
    ingresos_mes: 'Ingressos del mes', gastos_mes: 'Despeses del mes',
    cash_flow: 'Flux de caixa', patrimonio_neto: 'Patrimoni net',
    evolucion_patrimonio: 'Evolució del patrimoni', ultimos_6_meses: 'Últims 6 mesos',
    actividad_reciente: 'Activitat recent', ultimas_transacciones: 'Últimes transaccions',
    gastos_categoria: 'Despeses per categoria', generados_tus_datos: 'Generats amb les teves dades',
    ver_todo: 'Veure tot', sin_movimientos_aun: 'Encara no hi ha moviments',
    // ── Sidebar nav ─────────────────────────────────────────────
    nav_dashboard: 'Inici', nav_ingresos: 'Ingressos', nav_gastos: 'Despeses',
    nav_deudas: 'Deutes', nav_objetivos: 'Objectius', nav_presupuestos: 'Pressupostos',
    nav_inversiones: 'Inversions', nav_cuentas: 'Comptes', nav_patrimonio: 'Patrimoni', nav_categorias: 'Categories',
    nav_analisis: 'Anàlisi', nav_configuracion: 'Configuració',
    // ── Period filter ───────────────────────────────────────────
    periodo: 'Període', este_mes: 'Aquest mes', mes_anterior: 'Mes anterior',
    este_año: 'Aquest any', todo: 'Tot', personalizado: 'Personalitzat',
    // ── Ingresos ────────────────────────────────────────────────
    ingresos_cobrados: 'Ingressos cobrats', cobrar_btn: 'Cobrar',
    estado_pendiente: 'Pendent', buscar_concepto: '🔍 Cercar concepte',
    todas_categorias: 'Totes les categories', limpiar_filtros: 'Netejar filtres',
    // ── Gastos ──────────────────────────────────────────────────
    nuevo_gasto: '+ Nova despesa', nuevo_ingreso: '+ Nou ingrés',
    btn_editar: 'Editar', btn_eliminar: 'Eliminar',
    // ── Deutes ──────────────────────────────────────────────────
    proyeccion_deuda: 'Projecció del deute', proyeccion_deuda_sub: 'Evolució del saldo total',
    estrategias_pago: 'Estratègies de pagament', estrategias_pago_sub: 'Selecciona el teu ritme',
    bola_nieve: 'Bola de neu', avalancha: 'Allau',
    bola_nieve_desc: 'Comença pel deute més petit per guanyar impuls psicològic.',
    avalancha_desc: 'Comença pel de major interès — estalvies més diners a llarg termini.',
    orden_pago: 'Ordre de pagament recomanat',
    libertad_financiera: 'Data de llibertat financera',
    estrategia_personalizada: 'Estratègia personalitzada',
    crear_estrategia: 'Crear estratègia', personaliza_pago: 'Personalitza el teu pagament mensual',
    sin_deudas: 'Sense deutes', sin_deudas_pendientes: 'No hi ha deutes pendents per calcular',
    // ── Objectius ───────────────────────────────────────────────
    sin_objetivos: 'Sense objectius', nuevo_objetivo: '+ Nou objectiu',
    // ── Pressupostos ────────────────────────────────────────────
    presupuesto: 'Pressupost', sin_presupuestos: 'Sense pressupostos',
    // ── Inversions ──────────────────────────────────────────────
    sin_inversiones: 'Sense inversions', nueva_inversion: '+ Nova inversió',
    // ── Comptes ─────────────────────────────────────────────────
    sin_cuentas: 'Sense comptes', nueva_cuenta: '+ Nou compte',
    // ── Configuració ────────────────────────────────────────────
    cfg_idioma: 'Idioma', cfg_apariencia: 'Aparença',
    cfg_perfil: 'El teu perfil', cfg_nombre: 'Nom', cfg_guardar: '💾 Desar',
    cfg_oscuro: 'Fosc', cfg_claro: 'Clar', cfg_activo: 'Actiu',
    cfg_datos: 'Dades',
    // ── Misc ────────────────────────────────────────────────────
    concepto: 'Concepte', importe: 'Import', categoria: 'Categoria',
    fecha: 'Data', acciones: 'Accions', estado: 'Estat',
    meses: 'mesos', mes_lbl: 'mes', guardar: 'Desar',
    cancelar: 'Cancel·lar', eliminar: 'Eliminar', editar: 'Editar',
    confirmar: 'Confirmar', cerrar: 'Tancar', buscar: 'Cercar',
    liquidez: 'Liquiditat', invertido: 'Invertit', activos: 'Actius',
    deudas_lbl: 'Deutes', ingresos_lbl: 'Ingressos', gastos_lbl: 'Despeses',
    // ── Auth ────────────────────────────────────────────────────
    auth_email: 'Adreça electrònica', auth_password: 'Contrasenya',
    auth_entrar: 'Entrar', auth_crear_cuenta: 'Crear compte →',
    auth_iniciar_sesion: 'Iniciar sessió',
    auth_plan_local_activo: 'Pla Local actiu',
    auth_acceso_desbloqueado: 'Accés desbloquejat',
    auth_datos_locales: 'Les teves dades es guarden en aquest dispositiu.',
  },
}

/** Translate a category name respecting user-created custom ones */
function tCat(name) {
  if (_currentLang === 'es') return name
  const tr = CAT_TRANSLATIONS[name]
  return (tr && tr[_currentLang]) ? tr[_currentLang] : name
}

function setLang(code) {
  _currentLang = code
  try { localStorage.setItem(LANG_STORAGE_KEY, code) } catch(e) {}
  document.documentElement.setAttribute('lang', code)
  if (window.MNGamification && window.MNGamification.checkAchievement) {
    window.MNGamification.checkAchievement('settings_change');
    window.MNGamification.checkAchievement('lang_change');
  }
  // Brief fade transition
  const contentEl = document.getElementById('content')
  if (contentEl) {
    contentEl.style.transition = 'opacity .15s ease'
    contentEl.style.opacity = '0'
    setTimeout(() => {
      _updateSidebarLang()
      render()
      translateDOM()          // PASO 3: traducir modales estáticos del HTML
      contentEl.style.opacity = '1'
      setTimeout(() => { contentEl.style.transition = '' }, 200)
    }, 150)
  } else {
    _updateSidebarLang()
    render()
  }
}

function loadLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved && TRANSLATIONS[saved]) { _currentLang = saved; return }
    // Auto-detect from browser only if no saved preference.
    // Default to 'es' so iOS/Safari users (often 'en') don't get English
    // unexpectedly. The user can always change it in Settings.
    const nav = (navigator.language || navigator.userLanguage || 'es').toLowerCase().slice(0,2)
    _currentLang = TRANSLATIONS[nav] ? nav : 'es'
  } catch(e) { _currentLang = 'es' }
}

// ════════════════════════════════════════════════════════════════
// ─── PASO 3: translateDOM() ───────────────────────────────────
// Recorre el DOM buscando atributos data-i18n y data-i18n-placeholder
// y aplica la traducción correcta según _currentLang.
// Llamar tras setLang() y en init() para modales estáticos de index.html
// ════════════════════════════════════════════════════════════════
function translateDOM(root) {
  const el = root || document
  // Text content
  el.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.getAttribute('data-i18n')
    const tr  = t(key)
    if (tr) node.textContent = tr
  })
  // Placeholder
  el.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
    const key = node.getAttribute('data-i18n-placeholder')
    const tr  = t(key)
    if (tr) node.placeholder = tr
  })
  // Title attr (tooltips)
  el.querySelectorAll('[data-i18n-title]').forEach(node => {
    const key = node.getAttribute('data-i18n-title')
    const tr  = t(key)
    if (tr) node.title = tr
  })
  // Modal titles via innerHTML (allows emoji + translated text safely)
  el.querySelectorAll('[data-i18n-html]').forEach(node => {
    const key = node.getAttribute('data-i18n-html')
    const tr  = t(key)
    if (tr) node.innerHTML = tr
  })
}

function _updateSidebarLang() {
  if (typeof S === 'undefined') return
  const navMap = {
    'nav-dashboard':     'nav_dashboard',
    'nav-ingresos':      'nav_ingresos',
    'nav-gastos':        'nav_gastos',
    'nav-inversiones':   'nav_inversiones',
    'nav-deudas':        'nav_deudas',
    'nav-objetivos':     'nav_objetivos',
    'nav-presupuestos':  'nav_presupuestos',
    'nav-cuentas':       'nav_cuentas',
    'nav-patrimonio':    'nav_patrimonio',
    'nav-analisis':      'nav_analisis',
    'nav-logros':        'nav_logros',
    'nav-configuracion': 'nav_configuracion',
    'nav-billing':       'nav_billing',
    'nav-faq':           'nav_faq',
    'nav-sugerencias':   'nav_sugerencias',
    'nav-cerrar-sesion': 'nav_cerrar_sesion',
  }
  Object.entries(navMap).forEach(([id, key]) => {
    const el = document.getElementById(id)
    if (el) {
      const icon = el.querySelector('.nav-icon')
      if (icon) {
        // Keep only the icon span, replace text
        el.textContent = ''
        el.appendChild(icon)
        el.appendChild(document.createTextNode(t(key)))
        // Re-add badge if deudas
        if (id === 'nav-deudas') {
          const badge = document.createElement('span')
          badge.className = 'nav-badge'
          badge.id = 'deudas-badge'
          badge.style.display = 'none'
          el.appendChild(badge)
        }
      }
    }
  })
  // Section labels
  const sections = document.querySelectorAll('.nav-section')
  const sectionKeys = ['nav_principal','nav_finanzas','nav_planificacion','nav_sistema']
  sections.forEach((el, i) => { if (sectionKeys[i]) el.textContent = t(sectionKeys[i]) })
  // Theme toggle
  const themeLabel = document.getElementById('theme-label')
  if (themeLabel) {
    const isDark = S.theme !== 'light'
    themeLabel.textContent = isDark ? t('theme_dark') : t('theme_light')
  }
  // Topbar
  const dineroLabel = document.querySelector('.dinero-label')
  if (dineroLabel) dineroLabel.textContent = t('disponible')
  updateBadges()
}


// Activos volátiles — no mostrar rentabilidad esperada
const VOLATILE_CATS = ['Acciones','Cripto','Startups','ETF']

// Emojis por categoría para UI más visual
const CAT_EMOJIS = {
  // ingresos
  'Salario':'💼','Freelance':'💻','Alquiler':'🏠','Dividendos':'📈',
  'Venta':'🛒','Bono':'🎁','Otro':'✨',
  // gastos
  'Vivienda':'🏠','Alimentación':'🍔','Transporte':'🚗','Salud':'🏥',
  'Ocio':'🎮','Ropa':'👕','Educación':'🎓','Suscripciones':'📱',
  'Restaurantes':'🍽️','Tecnología':'💻','Seguros':'🛡️','Impuestos':'📋',
  'Tabaco':'🚬','Efectivo':'💵',
  // inversiones
  'Acciones':'📊','ETF':'🌐','Cripto':'₿','Inmuebles':'🏢',
  'Bonos':'📜','Fondo indexado':'🌍','Startups':'🚀',
  // deudas
  'Hipoteca':'🏦','Préstamo personal':'👤','Tarjeta crédito':'💳',
  'Préstamo coche':'🚗',
  // objetivos
  'Emergencia':'🛡️','Viaje':'✈️','Coche':'🚗','Casa':'🏠',
  'Jubilación':'🌅','Educación':'🎓',
}


// Get custom color for a category
function catColor(cat) {
  if (!cat) return null
  return (S.catColors && S.catColors[cat]) || null
}

function catEmoji(cat) {
  const custom = (S.categoriaEmojis || {})[cat]
  return custom || CAT_EMOJIS[cat] || '📌'
}

// ─── DEFAULT STATE ─────────────────────────────────────────────
function defaultState() {
  return {
    usuario: { nombre: 'Usuario', empresa: '', mode: 'personal', partnerName: '', partnerEmail: '' },
    cuentas: [
      { id: 'c1', nombre: 'Efectivo', tipo: 'efectivo', saldo: 0, valorTotal: 0, color: '#F59E0B' }
    ],
    ingresos: [],
    gastos: [],
    inversiones: [],
    deudas: [],
    objetivos: [],
    presupuestos: {},
    clientes: [],
    proveedores: [],
    devengos: [],
    assets: [],
    eventosFinancieros: [],
    categorias: {
      ingreso: ['Salario','Freelance','Alquiler','Dividendos','Venta','Bono','Otro'],
      gasto: ['Vivienda','Alimentación','Transporte','Salud','Ocio','Ropa','Educación','Suscripciones','Restaurantes','Tecnología','Seguros','Otro','Tabaco','Efectivo'],
      inversion: ['Acciones','ETF','Cripto','Inmuebles','Bonos','Fondo indexado','Startups','Otro'],
      deuda: ['Hipoteca','Préstamo personal','Tarjeta crédito','Préstamo coche','Otro'],
      objetivo: ['Emergencia','Viaje','Coche','Casa','Jubilación','Educación','Otro']
    },
    patrimonio_hist: [],
    catColors: {},
    categoriaEmojis: {},
    deudaHiddenStrats: [],
    deudaEstrategiaActiva: null, // {key, appliedAt} — solo se establece cuando el usuario confirma explícitamente "Aplicar estrategia", nunca por defecto
    theme: 'dark'
  }
}

// ─── GLOBAL TIME FILTER ────────────────────────────────────────
// preset: 'month' | 'lastmonth' | 'year' | 'all' | 'custom'
// ─── FORM SUBMISSION GUARD (prevent duplicate submissions) ──────
const _formGuard = {
  _active: new Set(),
  lock(id) {
    if (this._active.has(id)) return false
    this._active.add(id)
    const btn = document.querySelector(`#${id} .btn-primary`)
    if (btn) { btn.disabled = true; btn.dataset._origText = btn.textContent; btn.textContent = t('guardando') }
    return true
  },
  unlock(id) {
    this._active.delete(id)
    const btn = document.querySelector(`#${id} .btn-primary`)
    if (btn) { btn.disabled = false; if (btn.dataset._origText) btn.textContent = btn.dataset._origText }
  }
}

// Global period filter (must be on window for onclick handlers to work)
window._gTimePeriod = window._gTimePeriod || 'month'   // default: this month
window._gDateFrom   = window._gDateFrom || ''        // ISO date string (for custom)
window._gDateTo     = window._gDateTo || ''        // ISO date string (for custom)

function _gPeriodLabel() {
  const m = currentMonth()
  if (window._gTimePeriod === 'month')     return monthLabel(m)
  if (window._gTimePeriod === 'lastmonth') return monthLabel(prevMonth(m))
  if (window._gTimePeriod === 'year')      return new Date().getFullYear() + ''
  if (window._gTimePeriod === 'all')       return t('todo')
  if (window._gTimePeriod === 'custom')    return (window._gDateFrom||'') + ' → ' + (window._gDateTo||'')
  return monthLabel(m)
}

function _gDateInPeriod(dateStr) {
  if (!dateStr) return false
  const m = currentMonth()
  if (window._gTimePeriod === 'month')     return dateStr.startsWith(m)
  if (window._gTimePeriod === 'lastmonth') return dateStr.startsWith(prevMonth(m))
  if (window._gTimePeriod === 'year')      return dateStr.startsWith(new Date().getFullYear()+'')
  if (window._gTimePeriod === 'all')       return true
  if (window._gTimePeriod === 'custom') {
    if (window._gDateFrom && dateStr < window._gDateFrom) return false
    if (window._gDateTo   && dateStr > window._gDateTo)   return false
    return true
  }
  return dateStr.startsWith(m)
}

function _gFilterBar(onChangeFn) {
  const m = currentMonth()
  const yr = new Date().getFullYear()
  // FIX: Use window function wrapper to avoid quote escaping issues in onclick
  const makeHandler = (period) => `window._setPeriodAndRender('${period}','${onChangeFn}')`

  return `<div class="time-filter-bar">
    <span class="time-filter-label">${t('periodo')}</span>
    <button class="time-pill ${window._gTimePeriod==='month'?'active':''}"     onclick="${makeHandler('month')}">${t('este_mes')}</button>
    <button class="time-pill ${window._gTimePeriod==='lastmonth'?'active':''}" onclick="${makeHandler('lastmonth')}">${t('mes_anterior')}</button>
    <button class="time-pill ${window._gTimePeriod==='year'?'active':''}"      onclick="${makeHandler('year')}">${t('este_año')}</button>
    <button class="time-pill ${window._gTimePeriod==='all'?'active':''}"       onclick="${makeHandler('all')}">${t('todo')}</button>
    <button class="time-pill ${window._gTimePeriod==='custom'?'active':''}"    onclick="${makeHandler('custom')}">${t('personalizado')}</button>
    ${window._gTimePeriod==='custom'?`
      <input type="date" value="${window._gDateFrom}" onchange="window._gDateFrom=this.value;window._callRenderFn('${onChangeFn}')"
        style="padding:4px 8px;background:var(--bg);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:.78rem">
      <span style="color:var(--text2);font-size:.78rem">→</span>
      <input type="date" value="${window._gDateTo}" onchange="window._gDateTo=this.value;window._callRenderFn('${onChangeFn}')"
        style="padding:4px 8px;background:var(--bg);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:.78rem">
    `:''}
  </div>`
}

// Helper function to set period and call render function safely
window._setPeriodAndRender = function(period, renderFnName) {
  window._gTimePeriod = period
  // If switching to non-custom, clear date range
  if (period !== 'custom') { window._gDateFrom = ''; window._gDateTo = '' }
  // Reset any local section filters so global takes effect
  if (typeof _ingMesFilter !== 'undefined') { _ingMesFilter = null }
  if (typeof _gasMesFilter !== 'undefined') { _gasMesFilter = '' }
  try {
    const fn = renderFnName.replace('()','')
    if (fn && typeof window[fn] === 'function') window[fn]()
  } catch(e) {
    console.error('[Period Filter]', e)
  }
}

window._callRenderFn = function(renderFnName) {
  try {
    if (renderFnName && typeof window[renderFnName.replace('()','')]  === 'function') {
      window[renderFnName.replace('()','')]()
    }
  } catch(e) {
    console.error('[Period Filter] Error calling render function:', e)
  }
}

// Filtered calc helpers using global period
function calcIngresosperiodo() {
  return S.ingresos.filter(i=>i.status!=='pending'&&_gDateInPeriod(i.fecha)).reduce((a,i)=>a+(Number(i.importe)||0),0)
}
function calcGastosperiodo() {
  return S.gastos.filter(g=>_gDateInPeriod(g.fecha)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
}
// Global app state — populated by load() in init()
let S = null

let currentPage = 'dashboard'
let charts = {}
let aportarTipo = 'nuevo'

// ─── STORAGE ───────────────────────────────────────────────────
function save() {
  try { localStorage.setItem(SK, JSON.stringify(S)) } catch(e) {}
  try { updateDocTitle() } catch(e) {}
  try { document.dispatchEvent(new CustomEvent('mn:saved')) } catch(e) {}
  // Confetti: primer mes con cashflow positivo
  try {
    const _cfKey = 'mn_cf_celebrated'
    if (!localStorage.getItem(_cfKey) && typeof calcCashFlow === 'function' && typeof currentMonth === 'function') {
      const cf = calcCashFlow(currentMonth())
      if (cf > 0 && S.gastos.length >= 3 && S.ingresos.length >= 1) {
        localStorage.setItem(_cfKey, '1')
        setTimeout(() => {
          if (window.MNConfetti) window.MNConfetti.fire('cashflow')
          document.dispatchEvent(new CustomEvent('mn:cashflow:positivo'))
        }, 800)
      }
    }
  } catch(e) {}
}
function load() {
  S = defaultState() // always start from clean default
  try {
    const raw = localStorage.getItem(SK)
    if (raw) {
      const parsed = JSON.parse(raw)
      S = Object.assign(defaultState(), parsed)
      S.categorias = Object.assign(defaultState().categorias, parsed.categorias || {})
      S.usuario = Object.assign(defaultState().usuario, parsed.usuario || {})
    }
    // Defensive initialization — never crash on missing/corrupt data
    if (!Array.isArray(S.ingresos)) S.ingresos = []
    if (!Array.isArray(S.gastos)) S.gastos = []
    if (!Array.isArray(S.inversiones)) S.inversiones = []
    if (!Array.isArray(S.deudas)) S.deudas = []
    if (!Array.isArray(S.objetivos)) S.objetivos = []
    if (!Array.isArray(S.cuentas) || !S.cuentas.length) S.cuentas = defaultState().cuentas
    if (!Array.isArray(S.assets)) S.assets = []
    if (!Array.isArray(S.eventosFinancieros)) S.eventosFinancieros = []
    if (S.deudaEstrategiaActiva === undefined) S.deudaEstrategiaActiva = null
    ;(S.inversiones || []).forEach(inv => {
      if (!Array.isArray(inv.beneficiosRetirados)) return
      inv.beneficiosRetirados.forEach(b => {
        if (b.id) return // ya migrado
        b.id = uid()
        // Best-effort: buscar el ingreso que este beneficio genero,
        // usando fecha+importe+categoria (nunca solo el nombre del
        // activo) y que aun no este vinculado a ningun otro beneficio.
        const alreadyLinked = new Set(
          (S.inversiones || []).flatMap(i => (i.beneficiosRetirados || []).map(x => x.incomeId).filter(Boolean))
        )
        const match = S.ingresos.find(inc =>
          !inc._profitWithdrawalId && !alreadyLinked.has(inc.id) &&
          inc.categoria === 'Dividendos' && inc.fecha === b.fecha &&
          Math.abs(Number(inc.importe) - Number(b.importe)) < 0.01 &&
          inc.concepto && inc.concepto.includes(inv.nombre)
        )
        if (match) {
          b.incomeId = match.id
          match._investmentId = inv.id
          match._profitWithdrawalId = b.id
        }
      })
    })
    if (!Array.isArray(S.patrimonio_hist)) S.patrimonio_hist = []
    if (!S.presupuestos || typeof S.presupuestos !== 'object') S.presupuestos = {}
    if (!Array.isArray(S.clientes)) S.clientes = []
    if (!Array.isArray(S.proveedores)) S.proveedores = []
    if (!Array.isArray(S.devengos)) S.devengos = []
    // Guard categorias — each sub-array must exist
    const defCats = defaultState().categorias
    if (!S.categorias || typeof S.categorias !== 'object') S.categorias = defCats
    for (const k of Object.keys(defCats)) {
      if (!Array.isArray(S.categorias[k])) S.categorias[k] = defCats[k]
    }
    // Migracion: anadir Tabaco/Efectivo a usuarios existentes que ya
    // tenian S.categorias.gasto guardado (creado antes de que estas 2
    // categorias se incluyeran por defecto), sin duplicar si el usuario
    // ya las tenia por su cuenta.
    ;['Tabaco','Efectivo'].forEach(c => { if (!S.categorias.gasto.includes(c)) S.categorias.gasto.push(c) })
    // Guard usuario
    if (!S.usuario || typeof S.usuario !== 'object') S.usuario = defaultState().usuario
    S.cuentas = S.cuentas.map(c => ({...c, valorTotal: c.valorTotal !== undefined ? c.valorTotal : c.saldo}))
    migrateOldData()
  } catch(e) { S = defaultState() }
}
function migrateOldData() {
  const keys = ['mn_ingresos','mn_gastos','mn_inversiones','mn_deudas','mn_objetivos']
  for (const k of keys) {
    const v = localStorage.getItem(k)
    if (v) {
      try {
        const arr = JSON.parse(v)
        const section = k.replace('mn_','')
        if (arr.length && S[section] && S[section].length === 0) {
          S[section] = arr
        }
      } catch(e) {}
    }
  }
}

// ─── UTILS ─────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }
function fmt(n, d=2) { return new Intl.NumberFormat('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n)||0) }
function eur(n) { return fmt(n) + '\u00A0€' }

// ── parseAmount: unica utilidad reutilizable para parsear CUALQUIER
// importe/cantidad introducido por el usuario, aceptando indistintamente
// coma y punto como separador decimal (5,35 y 5.35 son equivalentes).
// Tambien reconoce el separador de miles cuando aparecen AMBOS
// caracteres (1.250,75 o 1,250.75): el que aparece MAS A LA DERECHA es
// el decimal, el otro se descarta como separador de miles. Nunca lanza
// — ante cualquier entrada invalida o vacia devuelve 0.
function parseAmount(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  let s = String(value).trim().replace(/[^\d.,-]/g, '') // strip currency symbols/spaces
  if (!s) return 0
  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present — whichever is rightmost is the decimal separator,
    // the other is a thousands separator to strip out.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // Only comma — always the decimal separator (never thousands here,
    // since amount fields don't need grouping while typing).
    s = s.replace(',', '.')
  }
  // Only-dot case needs no change — already valid JS float syntax.
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

// ── Sanitiza en tiempo real un <input> de importe/cantidad: permite
// solo digitos y UN separador decimal (coma o punto), sin romper la
// posicion del cursor mientras el usuario escribe (5, / 5,3 / 5,35
// deben quedar exactamente como el usuario los teclea, nunca revertirse
// a mitad de escritura). Se usa via oninput="_sanitizeAmountInput(this)".
function _sanitizeAmountInput(el) {
  const start = el.selectionStart
  const before = el.value
  // Keep digits, at most one comma AND at most one dot (both can
  // coexist — e.g. "1.250,75" — parseAmount() decides afterwards
  // which one is the decimal separator based on position).
  let seenComma = false, seenDot = false
  let out = ''
  for (const ch of before) {
    if (ch >= '0' && ch <= '9') { out += ch; continue }
    if (ch === ',' && !seenComma) { out += ch; seenComma = true; continue }
    if (ch === '.' && !seenDot)   { out += ch; seenDot = true; continue }
    // drop any other character (letters, extra separators, minus, etc.)
  }
  if (out !== before) {
    el.value = out
    const diff = before.length - out.length
    const pos = Math.max(0, (start ?? out.length) - diff)
    try { el.setSelectionRange(pos, pos) } catch (_) {}
  }
}
function pct(n, d=1) { return fmt(n,d) + '%' }
function fmtDate(d) { if(!d) return '—'; const locale = {'es':'es-ES','en':'en-GB','it':'it-IT','fr':'fr-FR','de':'de-DE','pt':'pt-PT'}[_currentLang]||'es-ES'; return new Date(d+'T12:00:00').toLocaleDateString(locale,{day:'2-digit',month:'short',year:'numeric'}) }
function todayISO() { return new Date().toISOString().slice(0,10) }
function currentMonth() { return new Date().toISOString().slice(0,7) }
function monthLabel(m) {
  if (!m) return ''
  const [y,mo] = m.split('-')
  const monthNames = {
    es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    it: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
    fr: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
    de: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
    pt: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  }
  const months = monthNames[_currentLang] || monthNames['es']
  return months[parseInt(mo)-1] + ' ' + y
}
function prevMonth(m) {
  const d = new Date(m+'-01')
  d.setMonth(d.getMonth()-1)
  return d.toISOString().slice(0,7)
}
function deltaClass(n) { return n > 0 ? 'up' : n < 0 ? 'down' : 'neu' }
function deltaIcon(n) { return n > 0 ? '↑' : n < 0 ? '↓' : '→' }
function clamp(v,min,max) { return Math.min(max,Math.max(min,v)) }
function getMonths(count=12) {
  const months = []
  const d = new Date()
  for (let i=count-1; i>=0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth()-i, 1)
    months.push(dd.toISOString().slice(0,7))
  }
  return months
}

// ─── FINANCIAL CALCS ───────────────────────────────────────────
// ─── TRANSACTION TYPES ─────────────────────────────────────────
// Extend types without breaking existing 'ingresos'/'gastos' arrays.
// goal_transfer entries live in S.gastos with tipo='goal_transfer'.
// They are excluded from real expense calculations (Task 4, 5).
const TX_TYPES = Object.freeze({
  INCOME:        'income',
  EXPENSE:       'expense',
  GOAL_TRANSFER: 'goal_transfer',
  INVESTMENT:    'investment',
})

// ─── PERIOD HELPERS (Task 1) ────────────────────────────────────
// Derive period dynamically from a date string — never stored on the record.
function derivePeriod(dateStr, mode = 'monthly') {
  if (!dateStr) return null
  if (mode === 'monthly') return dateStr.slice(0, 7)          // YYYY-MM
  if (mode === 'yearly')  return dateStr.slice(0, 4)          // YYYY
  if (mode === 'weekly') {
    // ISO week: YYYY-Www
    const d = new Date(dateStr)
    const jan4 = new Date(d.getFullYear(), 0, 4)
    const startOfWeek1 = new Date(jan4)
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    const weekNum = Math.floor((d - startOfWeek1) / (7 * 86400000)) + 1
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }
  return dateStr.slice(0, 7)
}

// Returns all unique monthly periods present in an array of records
function uniqueMonths(records) {
  return [...new Set(records.map(r => derivePeriod(r.fecha, 'monthly')).filter(Boolean))].sort().reverse()
}

function calcIngresosMes(month) {
  // Only count received income (status !== 'pending') in financial totals
  return S.ingresos.filter(i=>i.fecha&&i.fecha.startsWith(month)&&i.status!=='pending').reduce((a,i)=>a+(Number(i.importe)||0),0)
}
function calcIngresosMesPending(month) {
  return S.ingresos.filter(i=>i.fecha&&i.fecha.startsWith(month)&&i.status==='pending').reduce((a,i)=>a+(Number(i.importe)||0),0)
}
// Task 5: exclude goal_transfer entries from real expense totals
function calcGastosMes(month) {
  return S.gastos.filter(g=>g.fecha&&g.fecha.startsWith(month)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
}
// Includes goal_transfer — used only when explicitly needed (e.g. full ledger view)
function calcGastosMesTotal(month) {
  return S.gastos.filter(g=>g.fecha&&g.fecha.startsWith(month)).reduce((a,g)=>a+(Number(g.importe)||0),0)
}
function calcCashFlow(month) { return calcIngresosMes(month) - calcGastosMes(month) }
function calcSavingsRate(month) {
  const ing = calcIngresosMes(month)
  if (!ing) return 0
  return clamp((calcCashFlow(month)/ing)*100,-100,100)
}
function calcDineroDisponible() {
  return S.cuentas.reduce((a,c)=>a+(Number(c.saldo)||0),0)
}
// Cartera = solo capital invertido en activos abiertos (ganancias no se suman al patrimonio)
function calcCartera() {
  return S.inversiones.filter(i=>!i.cerrada).reduce((a,i)=>a+(Number(i.importe)||0),0)
}
// Ganancia latente = diferencia valor-capital (solo en sección inversiones)
function calcGananciaLatente() {
  return S.inversiones.filter(i=>!i.cerrada).reduce((a,i)=>{
    if (VOLATILE_CATS.includes(i.categoria)) return a
    return a + Number(i.importe)*(Number(i.rentabilidad)||0)/100
  },0)
}
function calcTotalDeuda() {
  return S.deudas.reduce((a,d)=>a+(Number(d.importeTotal)||0)-(Number(d.importePagado)||0),0)
}
function calcGananciaTotal() {
  return S.inversiones.filter(i=>i.cerrada).reduce((a,i)=>a+(Number(i.ganancia)||0),0)
}
// Assets value — only active ones count toward net worth
function calcAssetsValue() {
  if (!S.assets) return 0
  return S.assets.filter(a=>a.status==='active').reduce((sum,a)=>{
    let val = Number(a.valor)||0
    if (a.depreciacion && a.depPct && a.fecha) {
      const years = (Date.now() - new Date(a.fecha).getTime()) / (1000*60*60*24*365.25)
      val = val * Math.pow(1 - (Number(a.depPct)||0)/100, Math.max(0,years))
    }
    return sum + val
  },0)
}
// Patrimonio = liquidez + capital invertido + activos físicos activos − deudas
function calcPatrimonio() {
  return calcDineroDisponible() + calcCartera() + calcAssetsValue() - calcTotalDeuda()
}
function calcROI(inv) {
  if (inv.cerrada) return Number(inv.roiReal)||0
  if (!inv.importe) return 0

  const beneficiosRetirados = ((inv.beneficiosRetirados||[]).reduce((s,b)=>s+(Number(b.importe)||0),0))

  // Si tiene revalorizaciones, calcular ROI basado en último valor + beneficios ya retirados
  if (inv.revalorizaciones && inv.revalorizaciones.length > 0) {
    const ultimaRev = inv.revalorizaciones[inv.revalorizaciones.length - 1]
    const gananciaTotal = (ultimaRev.valor - Number(inv.importe)) + beneficiosRetirados
    return (gananciaTotal / Number(inv.importe)) * 100
  }

  if (VOLATILE_CATS.includes(inv.categoria)) {
    // For volatile: only ROI from withdrawn benefits
    return inv.importe ? (beneficiosRetirados / Number(inv.importe)) * 100 : 0
  }
  return Number(inv.rentabilidad)||0
}
function isVolatile(inv) { return VOLATILE_CATS.includes(inv.categoria) }
function calcValorInv(inv) {
  if (inv.cerrada) return Number(inv.valorFinal)||0

  // Beneficios ya retirados — son ganancia realizada, no reducen el capital base
  const beneficiosRetirados = ((inv.beneficiosRetirados||[]).reduce((s,b)=>s+(Number(b.importe)||0),0))

  // Si tiene revalorizaciones, usar última revalorización (capital actual)
  if (inv.revalorizaciones && inv.revalorizaciones.length > 0) {
    // valor actual del capital + beneficios ya realizados
    return inv.revalorizaciones[inv.revalorizaciones.length - 1].valor + beneficiosRetirados
  }

  if (isVolatile(inv)) return Number(inv.importe) + beneficiosRetirados // no projected value for volatile
  return Number(inv.importe)*(1+(Number(inv.rentabilidad)||0)/100)
}
function gastosMesByCat(month) {
  const map = {}
  // Exclude internal goal transfers — not real spending
  S.gastos.filter(g=>g.fecha&&g.fecha.startsWith(month)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).forEach(g=>{
    const cat = g.categoria||'Sin categoría'
    map[cat] = (map[cat]||0)+(Number(g.importe)||0)
  })
  return map
}
function ingresosMesByCat(month) {
  const map = {}
  S.ingresos.filter(i=>i.fecha&&i.fecha.startsWith(month)).forEach(i=>{
    const cat = i.categoria||'Sin categoría'
    map[cat] = (map[cat]||0)+(Number(i.importe)||0)
  })
  return map
}
function getCuenta(id) { return S.cuentas.find(c=>c.id===id) }

// ─── NAVIGATION ────────────────────────────────────────────────
const _pageKeyMap = {
  dashboard:'nav_dashboard', ingresos:'nav_ingresos', gastos:'nav_gastos',
  inversiones:'nav_inversiones', deudas:'nav_deudas', objetivos:'nav_objetivos',
  presupuestos:'nav_presupuestos', cuentas:'nav_cuentas', categorias:'nav_categorias',
  analisis:'nav_analisis', configuracion:'nav_configuracion', billing:'nav_billing',
  patrimonio:'nav_patrimonio', revision:'nav_revision', calendario:'nav_calendario'
}
function goTo(page) {
  // Redirige cualquier navegación antigua (enlaces guardados, código
  // legacy) hacia Análisis con la tab correspondiente — Revisión y
  // Calendario ya no son páginas independientes.
  if (page === 'revision') { window._analisisActiveTab = 'revision'; page = 'analisis' }
  else if (page === 'calendario') { window._analisisActiveTab = 'calendario'; page = 'analisis' }
  else if (page === 'analisis') { window._analisisActiveTab = 'resumen' }

  currentPage = page
  S._currentPage = page // Track for achievements
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'))
  const nav = document.getElementById('nav-'+page)
  if (nav) nav.classList.add('active')
  document.getElementById('pageTitle').textContent = _pageKeyMap[page] ? t(_pageKeyMap[page]) : page
  closeSidebar()
  destroyAllCharts()
  syncBottomNav(page)
  render()
  // Evita que la página nueva herede el scroll de la anterior
  // (p.ej. venir de un Dashboard scrolleado hacia abajo).
  const contentEl = document.getElementById('content')
  if (contentEl) contentEl.scrollTop = 0
  _updateSidebarLang()
  updateDocTitle()
  // Achievement tracking: page visits
  if (window.MNGamification && window.MNGamification.checkAchievement) {
    window.MNGamification.checkAchievement('page_visit');
  }
  // Dynamic billing background
  if (window.MNBillingUI) {
    if (page === 'billing') {
      setTimeout(() => window.MNBillingUI.initDynamicBg(), 0)
    } else {
      window.MNBillingUI.cleanupDynamicBg()
    }
  }
}
// render() is defined later after all renderXxx functions are declared
function updateTopBar() {
  const el = document.getElementById('topDinero')
  if (!el) return
  const newVal = eur(calcDineroDisponible())
  if (el.textContent !== newVal) {
    el.style.transition = 'color .3s'
    el.style.color = 'var(--accent)'
    el.textContent = newVal
    setTimeout(() => { el.style.color = '' }, 600)
  }
  const lbl = document.getElementById('topDineroLabel')
  if (lbl) lbl.textContent = t('disponible')
}
function updateBadges() {
  const vencidas = S.deudas.filter(d=>{
    if (!d.vencimiento) return false
    return new Date(d.vencimiento) < new Date() && (Number(d.importeTotal)||0)-(Number(d.importePagado)||0) > 0
  }).length
  const badge = document.getElementById('deudas-badge')
  if (badge) {
    badge.style.display = vencidas ? 'inline-flex' : 'none'
    badge.textContent = vencidas
  }
  // Also sync bottom nav alert badge (budget overruns + expired debts)
  const m = currentMonth()
  const catMap = gastosMesByCat(m)
  const presAlerts = Object.keys(S.presupuestos).filter(c=>{
    const gast = Number(catMap[c])||0
    const lim  = Number(S.presupuestos[c])||0
    return lim > 0 && gast >= lim
  }).length
  const totalAlerts = vencidas + presAlerts
  const bnBadge = document.getElementById('bn-alert-badge')
  if (bnBadge) bnBadge.style.display = totalAlerts > 0 ? 'block' : 'none'
}

// ─── RECORD PATRIMONIO ──────────────────────────────────────────
// Reconstruye el patrimonio neto historico para un mes pasado,
// deshaciendo desde el patrimonio ACTUAL (misma formula que Dashboard:
// calcPatrimonio() = liquidez + cartera + activos - deudas) los
// ingresos/gastos que ocurrieron DESPUES de ese mes. cuenta.saldo es un
// campo acumulativo sin historico propio, asi que los movimientos con
// fecha real (ingresos/gastos) son la unica fuente fiable para
// reconstruir retroactivamente cuanta liquidez habia en un momento
// pasado. Para el mes actual o futuro, devuelve el patrimonio real tal
// cual (sin ningun ajuste) — exactamente el mismo valor que Dashboard.
function calcPatrimonioHistoricoMes(monthStr) {
  const currentM = currentMonth()
  if (monthStr >= currentM) return calcPatrimonio()
  let valor = calcPatrimonio()
  // Un ingreso posterior aumento la liquidez actual, pero aun no habia
  // ocurrido en el mes solicitado — se resta para "retroceder" en el tiempo.
  S.ingresos.forEach(i => { if (i.fecha && i.fecha.slice(0,7) > monthStr) valor -= Number(i.importe)||0 })
  // Un gasto posterior redujo la liquidez actual, pero aun no habia
  // ocurrido en el mes solicitado — se suma de vuelta.
  S.gastos.forEach(g => { if (g.fecha && g.fecha.slice(0,7) > monthStr) valor += Number(g.importe)||0 })
  return valor
}

function recordPatrimonio() {
  const month = currentMonth()
  const valor = calcPatrimonio()
  const existing = S.patrimonio_hist.find(h=>h.mes===month)
  if (existing) { existing.valor = valor } else { S.patrimonio_hist.push({mes:month,valor}) }

  // Reconstruir tambien cualquier mes PASADO que tenga movimientos
  // reales, en vez de dejarlo vacio (o desactualizado) solo porque el
  // usuario no abrio la app exactamente en ese mes — asi el grafico de
  // evolucion representa la caida/subida real, no el patrimonio actual
  // repetido ni huecos en la linea.
  const monthsWithActivity = new Set()
  S.ingresos.forEach(i => { if (i.fecha) monthsWithActivity.add(i.fecha.slice(0,7)) })
  S.gastos.forEach(g => { if (g.fecha) monthsWithActivity.add(g.fecha.slice(0,7)) })
  monthsWithActivity.forEach(m => {
    if (m >= month) return // el mes actual ya se registro arriba con el valor real; meses futuros se ignoran
    const v = calcPatrimonioHistoricoMes(m)
    const ex = S.patrimonio_hist.find(h => h.mes === m)
    if (ex) ex.valor = v
    else S.patrimonio_hist.push({ mes: m, valor: v })
  })

  S.patrimonio_hist.sort((a, b) => a.mes.localeCompare(b.mes))
  // keep last 24 months
  S.patrimonio_hist = S.patrimonio_hist.slice(-24)
  save()
}

// ─── DASHBOARD ─────────────────────────────────────────────────
// El usuario "ha completado una importacion bancaria" si existe al menos
// un gasto o ingreso real con origen:'bank-import' — el mismo campo que ya
// escribe _runImport() en bank-import.js. Esto es persistente por
// construccion: S.gastos/S.ingresos se guardan via save() igual que
// cualquier otro dato del usuario (localStorage/Supabase segun el backend
// activo), sobreviven a recargar la pagina y a cerrar sesion y volver a
// entrar, sin necesitar ningun mecanismo de persistencia nuevo. Cancelar
// el wizard o que la importacion falle nunca crea estos registros, asi
// que el CTA se mantiene visible correctamente en esos casos.
function _hasCompletedBankImport() {
  return (S.gastos||[]).some(g => g.origen === 'bank-import') ||
         (S.ingresos||[]).some(i => i.origen === 'bank-import')
}

function renderDashboard() {
  const m  = currentMonth()
  const mp = prevMonth(m)
  const yr = new Date().getFullYear() + ''
  // Period-aware KPIs — respect global filter
  const ing  = S.ingresos.filter(i=>i.status!=='pending'&&_gDateInPeriod(i.fecha)).reduce((a,i)=>a+(Number(i.importe)||0),0)
  const gas  = S.gastos.filter(g=>_gDateInPeriod(g.fecha)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
  const cf   = ing - gas
  const ingP = calcIngresosMes(mp)
  const gasP = calcGastosMes(mp)
  const pat  = calcPatrimonio()
  const patP = (() => { const h = S.patrimonio_hist.find(h=>h.mes===mp); return h ? h.valor : null })()
  const patDelta = patP !== null ? ((pat - patP) / Math.abs(patP || 1)) * 100 : null
  const dis  = calcDineroDisponible()
  // Year-to-date totals
  const ingYTD = S.ingresos.filter(i=>i.status!=='pending'&&(i.fecha||'').startsWith(yr)).reduce((a,i)=>a+(Number(i.importe)||0),0)
  const gasYTD = S.gastos.filter(g=>(g.fecha||'').startsWith(yr)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)

  // Recent transactions (last 6 across income + real expenses — no internal transfers)
  const recentMovs = [
    ...S.ingresos.map(i=>({...i,_tipo:'ingreso',_sign:'+',_color:'var(--green)'})),
    ...S.gastos.filter(g=>g.tipo!==TX_TYPES.GOAL_TRANSFER).map(g=>({...g,_tipo:'gasto',_sign:'−',_color:'var(--red)'}))
  ].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,6)

  const recentRows = recentMovs.length ? recentMovs.map(m=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div style="width:32px;height:32px;border-radius:8px;background:${m._tipo==='ingreso'?'var(--green-dim)':'var(--red-dim)'};
          display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">
          ${m._tipo==='ingreso'?'💰':'💳'}
        </div>
        <div style="min-width:0">
          <div style="font-size:.88rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${m.concepto||'—'}</div>
          <div style="font-size:.72rem;color:var(--text2)">${fmtDate(m.fecha)} · <span style="font-size:.78rem">${catEmoji(m.categoria)}</span> ${m.categoria||'—'}</div>
        </div>
      </div>
      <div style="font-size:.9rem;font-weight:700;color:${m._color};flex-shrink:0;margin-left:12px">${m._sign}${eur(m.importe)}</div>
    </div>`).join('') :
    '<div style="padding:20px 12px;text-align:center">' +
      '<div style="font-size:.85rem;color:var(--text2);margin-bottom:12px">' + t('sin_movimientos_aun') + '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="window.MNBankImport&&MNBankImport.open()" style="background:var(--accent-dim);border-color:rgba(0,212,170,.3);color:var(--accent)">🏦 ' + t('btn_importar_datos_bancarios','Importar datos bancarios') + '</button>' +
    '</div>'

  // Compact assets preview for dashboard sidebar
  const activeAssets = (S.assets||[]).filter(a=>a.status==='active')
  const assetsVal    = calcAssetsValue()
  const assetsPreviewHtml = activeAssets.length
    ? activeAssets.slice(0,4).map(a=>{
        const icons = {vehicle:'🚗',property:'🏠',electronics:'💻',jewelry:'💎',business:'🏢',other:'📦',car:'🚗',house:'🏠'}
        const icon = icons[a.tipo]||'📦'
        let cv = Number(a.valor)||0
        if (a.depreciacion && a.depPct && a.fecha) {
          const yrs = (Date.now()-new Date(a.fecha).getTime())/(1000*60*60*24*365.25)
          cv = cv*Math.pow(1-(Number(a.depPct)||0)/100,Math.max(0,yrs))
        }
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:.9rem">${icon}</span>
            <span style="font-size:.8rem;color:var(--text);font-weight:600;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nombre}</span>
          </div>
          <span style="font-size:.8rem;font-weight:700;color:var(--text);flex-shrink:0">${eur(cv)}</span>
        </div>`
      }).join('') +
      (activeAssets.length > 4 ? `<div style="font-size:.72rem;color:var(--text2);padding-top:8px;text-align:center">+${activeAssets.length-4} más → <span style="color:var(--accent);cursor:pointer" onclick="goTo('patrimonio')">ver todo</span></div>` : '')
    : `<div style="padding:16px 0;text-align:center;color:var(--text2);font-size:.8rem">
        <div style="font-size:1.4rem;margin-bottom:6px">🏠</div>
        ${t('sin_activos')}
        <div style="margin-top:6px"><span style="color:var(--accent);cursor:pointer;font-size:.75rem" onclick="goTo('patrimonio')">${t('anadir_activo')}</span></div>
      </div>`

  const monthlySummary = checkMonthSummary()
  const streak = getStreak()
  const insights = generarInsights() // null = not enough data, [] = no relevant insights

  // Build insights HTML — smart pill list, real empty state
  const insightsHtml = (() => {
    if (insights === null) return `
      <div class="insight-empty">
        <div class="insight-empty-icon">📊</div>
        <div style="font-weight:600;color:var(--text);margin-bottom:4px">${t('aun_sin_datos')}</div>
        <div>${t('anadir_movs')}</div>
      </div>`
    if (insights.length === 0) return `
      <div class="insight-empty">
        <div class="insight-empty-icon">✅</div>
        <div style="font-weight:600;color:var(--text);margin-bottom:4px">${t('todo_orden_mes')}</div>
        <div>${t('sigue_mas_detalle')}</div>
      </div>`
    return `<div class="insight-pill-list">${insights.map(i=>`
      <div class="insight-pill">
        <div class="insight-pill-icon" style="background:${i.bg}">${i.icon}</div>
        <div class="insight-pill-text">${i.text}</div>
      </div>`).join('')}</div>`
  })()

  const _revCount = _reviewCount()
  const revisionBanner = _revCount > 0 ? `
    <div class="card" style="margin-bottom:16px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;border-color:var(--gold,#F5A623);background:rgba(245,166,35,.08)" onclick="goTo('revision')">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div style="font-size:1.3rem;flex-shrink:0">🔔</div>
        <div style="font-weight:700;color:var(--text);font-size:.9rem">${_revCount} ${_revCount===1 ? t('revision_banner_singular','cosa necesita') : t('revision_banner_plural','cosas necesitan')} ${t('revision_banner_atencion','tu atención')}</div>
      </div>
      <span style="color:var(--gold,#F5A623);font-weight:700;font-size:.82rem;flex-shrink:0;white-space:nowrap">${t('revisar_ahora','Revisar')} →</span>
    </div>` : ''

  const html = `
  <!-- ── HEADER ───────────────────────────────────────────────── -->
  <div class="section-header" style="margin-bottom:20px;align-items:flex-start">
    <div>
      <div class="page-h1">${t('hola_sin_coma')} <span style="color:var(--accent)">${S.usuario.nombre}</span>
        ${streak >= 3 ? `<span class="streak-badge" style="font-size:.7rem;vertical-align:middle;margin-left:8px">🔥 ${streak} días</span>` : ''}
      </div>
      <div class="page-sub">${_gPeriodLabel()} · ${t('resumen_financiero')}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0" class="ytd-strip">
      <div style="display:flex;align-items:center;gap:9px;padding:9px 14px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm)">
        <div style="width:28px;height:28px;background:var(--green-dim);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.82rem;flex-shrink:0">📥</div>
        <div>
          <div style="font-size:.6rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">${yr}</div>
          <div style="font-size:.95rem;font-weight:800;color:var(--green)" data-animate-ytd-raw="${ingYTD}">${eur(ingYTD)}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:9px;padding:9px 14px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm)">
        <div style="width:28px;height:28px;background:var(--red-dim);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.82rem;flex-shrink:0">📤</div>
        <div>
          <div style="font-size:.6rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">${yr}</div>
          <div style="font-size:.95rem;font-weight:800;color:var(--red)" data-animate-ytd-raw="${gasYTD}">${eur(gasYTD)}</div>
        </div>
      </div>
    </div>
  </div>

  ${revisionBanner}

  <!-- ── IMPORTAR DATOS BANCARIOS (CTA de primera importacion, mismo flujo real) ── -->
  ${_hasCompletedBankImport() ? '' : `
  <div onclick="window.MNBankImport&&MNBankImport.open()" style="display:flex;align-items:center;gap:14px;padding:16px 18px;margin-bottom:14px;background:linear-gradient(135deg, var(--accent-dim), rgba(0,212,170,.03));border:1px solid rgba(0,212,170,.3);border-radius:var(--radius);cursor:pointer">
    <div style="width:44px;height:44px;border-radius:12px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">🏦</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.95rem;font-weight:800;color:var(--text)">${t('btn_importar_datos_bancarios','Importar datos bancarios')}</div>
      <div style="font-size:.78rem;color:var(--text2)">${t('importar_datos_bancarios_sub','Sube un extracto CSV o Excel (XLSX) de tu banco y crea tus movimientos automáticamente')}</div>
    </div>
    <button class="btn btn-primary btn-sm" style="flex-shrink:0;pointer-events:none">${t('importar_ahora_cta','Importar')} →</button>
  </div>`}

  <!-- ── MONTH SUMMARY BANNER (new month only) ────────────────── -->
  ${renderMonthSummaryBanner(monthlySummary)}

  <!-- ── COMPACT HEALTH SCORE ─────────────────────────────────── -->
  ${renderHealthScore()}

  <!-- ── PATRIMONIO HERO ───────────────────────────────────────── -->
  <div style="display:grid;grid-template-columns:1fr 270px;gap:14px;margin-bottom:14px" class="dash-hero-grid">
    <div class="patrimonio-hero" style="margin-bottom:0">
      <div class="patrimonio-label">${t('patrimonio_neto')}</div>
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
        <div class="patrimonio-num" data-animate-raw="${pat}" data-sparkline-off="patrimonio">${eur(pat)}</div>
        ${patDelta !== null ? `<span class="kpi-delta ${deltaClass(patDelta)}" style="font-size:.82rem">${deltaIcon(patDelta)} ${pct(Math.abs(patDelta))} vs. mes ant.</span>` : ''}
      </div>
      <div class="patrimonio-stats" style="margin-top:12px">
        <div class="patrimonio-stat"><span class="patrimonio-stat-label">💰 ${t('liquidez')}</span><span class="patrimonio-stat-val">${eur(dis)}</span></div>
        <div class="patrimonio-stat"><span class="patrimonio-stat-label">📈 ${t('invertido')}</span><span class="patrimonio-stat-val">${eur(calcCartera())}</span></div>
        <div class="patrimonio-stat"><span class="patrimonio-stat-label">🏠 ${t('activos')}</span><span class="patrimonio-stat-val">${eur(assetsVal)}</span></div>
        <div class="patrimonio-stat"><span class="patrimonio-stat-label">📉 ${t('deudas_lbl')}</span><span class="patrimonio-stat-val" style="color:${calcTotalDeuda()>0?'var(--red)':'var(--green)'}">${calcTotalDeuda()>0?'−'+eur(calcTotalDeuda()):t('sin_deudas')}</span></div>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:.7rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${t('cuentas_lbl')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">
          ${S.cuentas.map(c=>`<div onclick="verDetalleCuenta('${c.id}')" style="display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:99px;background:${c.color||'#00D4AA'}18;border:1px solid ${c.color||'#00D4AA'}30;cursor:pointer;transition:all .15s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''"><span style="width:7px;height:7px;border-radius:50%;background:${c.color||'#00D4AA'};flex-shrink:0"></span><span style="font-size:.73rem;color:var(--text2)">${c.nombre}</span><span style="font-size:.8rem;font-weight:700;color:var(--text)">${eur(c.saldo||0)}</span></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column">
      <div class="card-header" style="flex-shrink:0;margin-bottom:8px">
        <div><div class="card-title">🏠 ${t('activos')}</div><div class="card-subtitle">${eur(assetsVal)} total</div></div>
        <span class="pat-inv-link" onclick="goTo('patrimonio')" style="font-size:.72rem">Ver →</span>
      </div>
      <div style="flex:1">${assetsPreviewHtml}</div>
      ${calcTotalDeuda()>0?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:.67rem;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${t('deudas_lbl')}</div>
        ${S.deudas.slice(0,2).map(d=>`<div style="display:flex;justify-content:space-between;font-size:.77rem;padding:3px 0"><span style="color:var(--text2)">${d.nombre||'—'}</span><span style="color:var(--red);font-weight:700">${eur((Number(d.importeTotal)||0)-(Number(d.importePagado)||0))}</span></div>`).join('')}
        ${S.deudas.length>2?`<div style="font-size:.7rem;color:var(--text3);margin-top:4px;cursor:pointer" onclick="goTo('deudas')">+${S.deudas.length-2} más →</div>`:''}
      </div>`:''}
    </div>
  </div>

  <!-- ── PERIOD FILTER ────────────────────────────────────────── -->
  ${_gFilterBar('renderDashboard()')}

  <!-- ── KPI STRIP ─────────────────────────────────────────────── -->
  <div class="kpi-grid kpi-grid-3" style="margin-bottom:14px">
    <div class="kpi-card" data-sparkline-off="ingresos">
      <div class="kpi-icon" style="background:var(--green-dim)">💰</div>
      <div class="kpi-label">${t('ingresos_lbl','Ingresos')} · ${_gPeriodLabel()}</div>
      <div class="kpi-value" data-animate-raw="${ing}">${eur(ing)}</div>
      ${ingP ? `<span class="kpi-delta ${deltaClass(ing-ingP)}">${deltaIcon(ing-ingP)} ${pct(Math.abs(ingP?((ing-ingP)/ingP*100):0))} vs. ant.</span>` : '<span class="kpi-delta neu">Primer mes</span>'}
      <div class="kpi-sub" style="margin-top:5px">${S.ingresos.filter(i=>i.status!=='pending'&&_gDateInPeriod(i.fecha)).length} entradas</div>
    </div>
    <div class="kpi-card" data-sparkline-off="gastos">
      <div class="kpi-icon" style="background:var(--red-dim)">💳</div>
      <div class="kpi-label">${t('gastos_lbl','Gastos')} · ${_gPeriodLabel()}</div>
      <div class="kpi-value" data-animate-raw="${gas}">${eur(gas)}</div>
      ${gasP ? `<span class="kpi-delta ${gas>gasP?'down':'up'}">${gas>gasP?'↑':'↓'} ${pct(Math.abs(gasP?((gas-gasP)/gasP*100):0))} vs. ant.</span>` : '<span class="kpi-delta neu">Primer mes</span>'}
      <div class="kpi-sub" style="margin-top:5px">${S.gastos.filter(g=>g.tipo!==TX_TYPES.GOAL_TRANSFER&&_gDateInPeriod(g.fecha)).length} salidas</div>
    </div>
    <div class="kpi-card" data-sparkline-off="cashflow">
      <div class="kpi-icon" style="background:${cf>=0?'var(--accent-dim)':'var(--red-dim)'}">${cf>=0?'📊':'⚠️'}</div>
      <div class="kpi-label">${t('cash_flow')}</div>
      <div class="kpi-value" style="color:${cf>=0?'var(--accent)':'var(--red)'}" data-animate-raw="${cf}">${cf>=0?'+':''}${eur(cf)}</div>
      <span class="kpi-delta ${cf>=0?'up':'down'}">${cf>=0?'Superávit':'Déficit'} · ${_gPeriodLabel()}</span>
      <div class="kpi-sub" style="margin-top:5px">Ahorro: <strong style="color:${calcSavingsRate(m)>=20?'var(--green)':'var(--gold)'}">${pct(Math.max(0,calcSavingsRate(m)))}</strong></div>
    </div>
  </div>

  <!-- ── CHARTS + RECENT ───────────────────────────────────────── -->
  <div class="grid-2" style="margin-bottom:14px">
    <div class="card" style="min-width:0">
      <div class="card-header">
        <div><div class="card-title">📈 ${t('evolucion_patrimonio')}</div><div class="card-subtitle">${t('ultimos_6_meses')}</div></div>
      </div>
      <div class="chart-container"><canvas id="chartPatrimonio"></canvas></div>
    </div>
    <div class="card" style="min-width:0">
      <div class="card-header">
        <div><div class="card-title">🕐 ${t('actividad_reciente')}</div><div class="card-subtitle">${t('ultimas_transacciones')}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="goTo('ingresos')" style="font-size:.75rem">${t('ver_todo')}</button>
      </div>
      <div>${recentRows}</div>
    </div>
  </div>

  <!-- ── DONUT + SMART INSIGHTS ─────────────────────────────────── -->
  <div class="grid-2" style="margin-bottom:14px">
    <div class="card dash-donut-card">
      <div class="card-header">
        <div><div class="card-title">🍩 ${t('gastos_categoria')}</div><div class="card-subtitle">${monthLabel(m)}</div></div>
      </div>
      <div style="display:flex;gap:16px;align-items:center;min-width:0">
        <div class="donut-chart-wrap"><canvas id="chartDonut"></canvas></div>
        <div class="legend" id="donutLegend" style="flex:1;margin-top:0;min-width:0"></div>
      </div>
    </div>
    <div class="card" style="min-width:0">
      <div class="card-header">
        <div><div class="card-title">💡 Insights</div><div class="card-subtitle">${t('generados_tus_datos')}</div></div>
      </div>
      <div id="insightsContainer">${insightsHtml}</div>
    </div>
  </div>

  ${renderPresupuestosResumen()}
  ${renderDash503020()}
  ${renderSubscriptionDetector()}
  `
  document.getElementById('content').innerHTML = html

  // ── Animate health score ring ──────────────────────────────────
  const scoreVal = calcHealthScore()
  const scoreEl  = document.getElementById('healthScoreNum')
  const ringEl   = document.getElementById('healthRingFill')
  const r = 22, circum = 2 * Math.PI * r
  if (scoreEl && ringEl && scoreVal > 0) {
    scoreEl.textContent = '0'
    const dur = 1200, start = performance.now()
    function animScore(now) {
      const p   = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1-p, 3)
      const cur  = Math.round(ease * scoreVal)
      scoreEl.textContent = cur
      ringEl.style.strokeDashoffset = circum - (cur/100) * circum
      if (p < 1) requestAnimationFrame(animScore)
      else { scoreEl.textContent = scoreVal; ringEl.style.strokeDashoffset = circum - (scoreVal/100)*circum }
    }
    requestAnimationFrame(animScore)
  }

  document.querySelectorAll('.kpi-value[data-target]').forEach(el => animateCounter(el, el.dataset.target))
  requestAnimationFrame(() => setTimeout(() => { renderChartPatrimonio(); renderChartDonut() }, 80))
  syncBottomNav('dashboard')
  updateDocTitle()
}


// ─── DASHBOARD 50/30/20 MINI WIDGET ────────────────────────────
function renderDash503020() {
  const m = currentMonth()
  const d50 = calc503020(m)
  if (!d50.total || d50.total === 0) return ''
  const necOk  = d50.pctNec <= 50
  const desOk  = d50.pctDes <= 30
  const ahOk   = d50.pctAh  >= 20
  const allOk  = necOk && desOk && ahOk
  return `<div class="card" style="margin-bottom:14px">
    <div class="card-header">
      <div>
        <div class="card-title">⚖️ ${t('regla_503020','Regla 50/30/20')}</div>
        <div class="card-subtitle">${t('distribucion_optima','Distribución óptima de tu dinero este mes')}</div>
      </div>
      <span style="font-size:1.2rem" title="${allOk?'¡Todo en orden!':'Hay categorías fuera del rango óptimo'}">${allOk?'✅':'⚠️'}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:3px">
          <span style="color:var(--text2)">🏠 Necesidades <span style="color:var(--text3)">(≤50%)</span></span>
          <span style="font-weight:700;color:${necOk?'var(--green)':'var(--red)'}">${Math.round(d50.pctNec)}% ${necOk?'✓':'↑'}</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(d50.pctNec,100)}%;background:${necOk?'var(--indigo)':'var(--red)'}"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:3px">
          <span style="color:var(--text2)">🎉 Deseos <span style="color:var(--text3)">(≤30%)</span></span>
          <span style="font-weight:700;color:${desOk?'var(--green)':'var(--red)'}">${Math.round(d50.pctDes)}% ${desOk?'✓':'↑'}</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(d50.pctDes,100)}%;background:${desOk?'var(--gold)':'var(--red)'}"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:3px">
          <span style="color:var(--text2)">💰 Ahorro <span style="color:var(--text3)">(≥20%)</span></span>
          <span style="font-weight:700;color:${ahOk?'var(--green)':'var(--gold)'}">${Math.round(d50.pctAh)}% ${ahOk?'✓':'↓'}</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(d50.pctAh,100)}%;background:${ahOk?'var(--green)':'var(--gold)'}"></div></div>
      </div>
    </div>
    ${!allOk?`<div style="margin-top:10px;padding:8px 12px;background:var(--bg2);border-radius:var(--radius-sm);font-size:.75rem;color:var(--text2)">
      💡 ${!necOk?'Tus necesidades superan el 50% — revisa gastos fijos.':!desOk?'Tus gastos de ocio superan el 30% recomendado.':'Intenta ahorrar al menos el 20% de tus ingresos.'}
      <span style="color:var(--accent);cursor:pointer;margin-left:4px" onclick="goTo('analisis')">Ver análisis completo →</span>
    </div>`:''}
  </div>`
}

// ─── SUBSCRIPTION DETECTOR ──────────────────────────────────────
function renderSubscriptionDetector() {
  const subsKeywords = ['netflix','spotify','amazon prime','hbo','disney','youtube premium','apple music','apple tv','google one','microsoft 365','office 365','adobe','dropbox','icloud','gym','gimnasio','suscripción','subscripción','monthly']
  // Excluir gastos de categorías que claramente no son suscripciones digitales
  const excludeCategories = ['Vivienda','Alquiler','Hipoteca','Transporte','Alimentación','Salud','Seguros']
  const excludeKeywords   = ['alquiler','hipoteca','comunidad','seguro','luz','agua','gas','internet','telefon','móvil']
  const recurrentes = S.gastos.filter(g => {
    if (g.tipo === TX_TYPES.GOAL_TRANSFER) return false
    const conceptoLower = (g.concepto||'').toLowerCase()
    const cat = (g.categoria||'')
    // Excluir gastos de vivienda/servicios aunque sean recurrentes
    if (excludeCategories.includes(cat)) return false
    if (excludeKeywords.some(k => conceptoLower.includes(k))) return false
    if (g.recurrente) return true
    return subsKeywords.some(k => conceptoLower.includes(k))
  })
  if (recurrentes.length < 2) return ''
  const totalSubs = recurrentes.reduce((a,g) => a + (Number(g.importe)||0), 0)
  const unique = []
  const seen = new Set()
  recurrentes.forEach(g => {
    const key = (g.concepto||'').toLowerCase().slice(0,15)
    if (!seen.has(key)) { seen.add(key); unique.push(g) }
  })
  return `<div class="card" style="margin-bottom:14px">
    <div class="card-header">
      <div>
        <div class="card-title">🔄 ${t('suscripciones_detectadas','Suscripciones detectadas')}</div>
        <div class="card-subtitle">${unique.length} activas · <strong style="color:var(--text)">${eur(totalSubs)}/mes</strong> · ${eur(totalSubs*12)}/año</div>
      </div>
      <button class="btn btn-ghost btn-xs" onclick="goTo('gastos')">Ver todas →</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${unique.slice(0,5).map(g=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:.9rem">${catEmoji(g.categoria)}</span>
            <span style="font-size:.82rem;color:var(--text);font-weight:600">${g.concepto||'—'}</span>
            ${g.recurrente?'<span class="badge badge-accent" style="font-size:.6rem">↻</span>':'<span class="badge badge-gray" style="font-size:.6rem">auto</span>'}
          </div>
          <span style="font-size:.85rem;font-weight:700;color:var(--red)">−${eur(g.importe)}/mes</span>
        </div>`).join('')}
      ${unique.length>5?`<div style="font-size:.72rem;color:var(--text3);text-align:center;padding-top:4px">+${unique.length-5} suscripciones más</div>`:''}
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:var(--red-dim);border-radius:var(--radius-sm);font-size:.75rem;color:var(--red)">
      💡 ¿Todas siguen activas? Revisa tus suscripciones periódicamente para ahorrar hasta <strong>${eur(totalSubs*0.2)}/mes</strong>.
    </div>
  </div>`
}

function renderPresupuestosResumen() {
  const cats = Object.keys(S.presupuestos)
  if (!cats.length) return ''
  const m = currentMonth()
  const catMap = gastosMesByCat(m)
  const items = cats.map(cat=>{
    const limite = Number(S.presupuestos[cat])||0
    const gastado = Number(catMap[cat])||0
    const pctVal = limite ? clamp((gastado/limite)*100,0,100) : 0
    const cls = pctVal>=100?'progress-danger':pctVal>=80?'progress-warn':'progress-ok'
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:4px">
        <span style="color:var(--text);font-weight:600"><span style="font-size:.85rem;margin-right:4px">${catEmoji(cat)}</span>${cat}</span>
        <span style="color:var(--text2)">${eur(gastado)} / ${eur(limite)}</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar ${cls}" style="width:${pctVal}%"></div></div>
    </div>`
  }).join('')
  return `<div class="card" style="margin-bottom:14px">
    <div class="card-header"><div class="card-title">📊 ${t('presupuestos_del_mes','Presupuestos del mes')}</div><button class="btn btn-ghost btn-xs" onclick="goTo('presupuestos')">${t('ver_todos','Ver todos')} →</button></div>
    ${items}
  </div>`
}

// ─── INGRESOS ──────────────────────────────────────────────────
let _ingSearch = '', _ingCatFilter = '', _ingMesFilter = ''
let _ingSort = { col: 'fecha', dir: 'desc' }
let _ingSelected = new Set()

function _ingSetSort(col) {
  if (_ingSort.col === col) _ingSort.dir = _ingSort.dir === 'asc' ? 'desc' : 'asc'
  else { _ingSort.col = col; _ingSort.dir = col === 'fecha' ? 'desc' : 'asc' }
  renderIngresos()
}
function _ingToggleSelect(id) {
  if (_ingSelected.has(id)) _ingSelected.delete(id); else _ingSelected.add(id)
  const bar = document.getElementById('_ingBulkBar')
  if (bar) bar.style.display = _ingSelected.size ? 'flex' : 'none'
  const countEl = document.getElementById('_ingBulkCount')
  if (countEl) countEl.textContent = _ingSelected.size
}
function _ingBulkDelete() {
  if (!_ingSelected.size) return
  const ids = [..._ingSelected]
  confirmar(
    `¿Eliminar ${ids.length} ingreso${ids.length>1?'s':''}?`,
    () => {
      removeTransactions(ids, 'ingreso')
      _ingSelected.clear()
      save(); render()
    },
    {titulo:t('confirm_eliminar_ingreso_titulo','Eliminar'), icono:'🗑️', btnLabel:t('btn_eliminar','Eliminar')}
  )
}

window._showNotaTooltip = function(el) {
  const id = el.getAttribute('data-nota-id')
  const item = S.ingresos.find(i => i.id === id) || S.gastos.find(g => g.id === id)
  if (!item || !item.notas) return

  // Remove existing tooltip if any
  const existing = document.getElementById('mn-nota-tooltip')
  if (existing) existing.remove()

  const rect = el.getBoundingClientRect()
  const tip = document.createElement('div')
  tip.id = 'mn-nota-tooltip'
  tip.style.cssText = `position:fixed;z-index:99999;top:${rect.bottom+6}px;left:${Math.max(8,rect.left-100)}px;max-width:260px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:.8rem;color:var(--text);line-height:1.4`
  tip.textContent = item.notas
  document.body.appendChild(tip)

  const closeTip = (e) => {
    if (!tip.contains(e.target) && e.target !== el) {
      tip.remove()
      document.removeEventListener('click', closeTip)
    }
  }
  setTimeout(() => document.addEventListener('click', closeTip), 10)
}

function renderIngresos() {
  console.log('[renderIngresos] Called with period:', window._gTimePeriod, '| _ingMesFilter:', _ingMesFilter, '| Total ingresos:', S.ingresos.length)
  const m = currentMonth()
  const mp = prevMonth(m)
  // KPI total: active month filter → that month; otherwise use global period filter
  const total = S.ingresos.filter(i => {
    if (i.status === 'pending') return false
    if (_ingMesFilter) return (i.fecha||'').startsWith(_ingMesFilter)
    return _gDateInPeriod(i.fecha)
  }).reduce((a,i)=>a+(Number(i.importe)||0),0)
  const totalP   = calcIngresosMes(mp)
  const pending  = S.ingresos.filter(i=>i.status==='pending').reduce((a,i)=>a+(Number(i.importe)||0),0)
  const catMapPeriod = {}
  S.ingresos.filter(i=>i.status!=='pending'&&_gDateInPeriod(i.fecha)).forEach(i=>{
    const cat=i.categoria||'Sin categoría'; catMapPeriod[cat]=(catMapPeriod[cat]||0)+(Number(i.importe)||0)
  })
  const topCat   = Object.entries(catMapPeriod).sort((a,b)=>b[1]-a[1])[0]
  const allCats  = [...new Set(S.ingresos.map(i=>i.categoria).filter(Boolean))]
  // All unique months derived dynamically from dates (Task 1 — never stored)
  const allMeses = uniqueMonths(S.ingresos)
  // catMap for chart — use the ACTIVE period, not just current month
  const catMap = (() => {
    const map = {}
    S.ingresos
      .filter(i => i.status !== 'pending' && (_ingMesFilter ? (i.fecha||'').startsWith(_ingMesFilter) : _gDateInPeriod(i.fecha)))
      .forEach(i => { const c = i.categoria||'Sin categoría'; map[c]=(map[c]||0)+(Number(i.importe)||0) })
    return map
  })()

  // Split: pending always shown, received filtered by month or all-time
  const pendingIngs  = S.ingresos.filter(i=>i.status==='pending').sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))
  const receivedIngs = [...S.ingresos]
    .filter(i => {
      if (i.status === 'pending') return false
      // Month filter (legacy per-month dropdown) takes priority
      if (_ingMesFilter) {
        if (!i.fecha || !i.fecha.startsWith(_ingMesFilter)) return false
      } else {
        // Use global period filter (this month / last month / this year / all / custom)
        if (!_gDateInPeriod(i.fecha)) return false
      }
      const q = _ingSearch.toLowerCase()
      if (q && !(i.concepto||'').toLowerCase().includes(q)) return false
      if (_ingCatFilter && i.categoria !== _ingCatFilter) return false
      return true
    })
    .sort((a,b) => {
      const col = _ingSort.col, dir = _ingSort.dir === 'asc' ? 1 : -1
      if (col === 'importe') return dir * ((Number(a.importe)||0) - (Number(b.importe)||0))
      if (col === 'categoria') return dir * (a.categoria||'').localeCompare(b.categoria||'')
      return dir * (b.fecha||'').localeCompare(a.fecha||'') * -1
    })

  const _ingSortIcon = (col) => {
    if (_ingSort.col !== col) return '<span style="opacity:.3;font-size:.65rem">⇅</span>'
    return `<span style="font-size:.65rem;color:var(--accent)">${_ingSort.dir==='asc'?'↑':'↓'}</span>`
  }

  const pendingRows = pendingIngs.map(i=>`
    <tr style="background:rgba(245,158,11,0.05)">
      <td class="td-main td-desc-tx">
        ${i.concepto||'—'}
        ${i.notas ? `<span class="nota-badge" data-nota-id="${i.id}" onclick="event.stopPropagation();window._showNotaTooltip(this)" title="Ver nota" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--accent-dim);color:var(--accent);font-size:.65rem;font-weight:800;cursor:pointer;margin-left:5px;flex-shrink:0;vertical-align:middle">!</span>` : ''}
      </td>
      <td class="td-amount" style="color:var(--gold)">+${eur(i.importe)}</td>
      <td><span class="cat-with-emoji"><span class="cat-emoji">${catEmoji(i.categoria)}</span><span class="tag">${i.categoria||'—'}</span></span></td>
      <td>${fmtDate(i.fecha)}</td>
      <td>${i.cuentaId?getCuenta(i.cuentaId)?.nombre||'—':'—'}</td>
      <td><span class="badge badge-gold">${t('estado_pendiente')}</span></td>
      <td><div class="action-row">
        <button class="btn btn-primary btn-xs" onclick="marcarIngresoCobrado('${i.id}')">${t('cobrar_btn')}</button>
        <button class="btn-edit" onclick="editarIngreso('${i.id}')">${t('btn_editar')}</button>
        <button class="btn-del" onclick="borrarIngreso('${i.id}')">${t('btn_eliminar')}</button>
      </div></td>
    </tr>`).join('')

  const rows = receivedIngs.map(i=>`
    <tr class="${_ingSelected.has(i.id)?'row-selected':''}">
      <td style="width:28px"><input type="checkbox" ${_ingSelected.has(i.id)?'checked':''} onchange="_ingToggleSelect('${i.id}')" style="cursor:pointer"></td>
      <td class="td-main td-desc-tx">${i.concepto||'—'}${i.notas ? `<span class="nota-badge" data-nota-id="${i.id}" onclick="event.stopPropagation();window._showNotaTooltip(this)" title="Ver nota" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--accent-dim);color:var(--accent);font-size:.65rem;font-weight:800;cursor:pointer;margin-left:5px;flex-shrink:0;vertical-align:middle">!</span>` : ''}</td>
      <td class="td-amount td-pos">+${eur(i.importe)}</td>
      <td><span class="cat-with-emoji"><span class="cat-emoji">${catEmoji(i.categoria)}</span><span class="tag">${i.categoria||'—'}</span></span></td>
      <td>${fmtDate(i.fecha)}</td>
      <td>${i.cuentaId?getCuenta(i.cuentaId)?.nombre||'—':'—'}</td>
      <td>${i.recurrente?"<span class=\"badge badge-accent\">" + t('estado_recurrente') + "</span>":''}</td>
      <td><div class="action-row">
        <button class="btn-edit" onclick="editarIngreso('${i.id}')">${t('btn_editar')}</button>
        <button class="btn-del" onclick="borrarIngreso('${i.id}')">${t('btn_eliminar')}</button>
      </div></td>
    </tr>`).join('') || (() => {
      // Fallback: if there are incomes but none match the current period/filter, show helpful message
      const hasAny = S.ingresos.filter(i=>i.status!=='pending').length > 0
      const emptyTitle = hasAny ? 'Sin resultados en este período' : 'Aún no tienes ingresos cobrados'
      const emptySub = hasAny
        ? 'Cambia el período o limpia los filtros para ver tus ingresos'
        : 'Añade tu primer ingreso con el botón + Nuevo ingreso'
      const clearBtn = (hasAny && (_ingSearch||_ingCatFilter))
        ? `<button class="btn btn-ghost btn-sm" onclick="_ingSearch='';_ingCatFilter='';_ingMesFilter='';window._gTimePeriod='all';renderIngresos()">🔍 Ver todos los ingresos</button>` : ''
      const _es = window.mnEmptyStates
      return `<tr><td colspan="7">${_es ? _es.ingresos(hasAny, hasAny && (_ingSearch||_ingCatFilter)) : `<div class="empty"><div class="empty-icon">💰</div><div class="empty-title">${emptyTitle}</div><div class="empty-sub">${emptySub}</div>${clearBtn}</div>`}</td></tr>`
    })()

  const ingPeriodLabel = _ingMesFilter ? monthLabel(_ingMesFilter) : 'Todos'
  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> ${t('page_ingresos')}</div><div class="page-sub">${ingPeriodLabel} · ${S.ingresos.filter(i=>i.status!=='pending').length} cobrados · ${pendingIngs.length} pendientes</div></div>
    <div class="section-actions">
      <button class="btn btn-secondary btn-sm" onclick="window.MNBankImport&&MNBankImport.open()" style="background:var(--accent-dim);border-color:rgba(0,212,170,.35);color:var(--accent)">🏦 ${t('btn_importar_datos_bancarios','Importar datos bancarios')}</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('ingresoModal');resetIngresoForm()">${t('btn_nuevo_ingreso','+ Nuevo ingreso')}</button>
    </div>
  </div>

  ${_gFilterBar('renderIngresos()')}

  <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">📥</div>
      <div class="kpi-label">${window._currentLang==='en'?'Collected':'Cobrado'} · ${_gPeriodLabel()}</div>
      <div class="kpi-value">${eur(total)}</div>
      ${totalP?`<span class="kpi-delta ${deltaClass(total-totalP)}">${deltaIcon(total-totalP)} ${pct(totalP?Math.abs((total-totalP)/totalP*100):0)} vs. ant.</span>`:'<span class="kpi-delta neu">Primer mes</span>'}
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">⏳</div>
      <div class="kpi-label">${t('pendiente_cobro')}</div>
      <div class="kpi-value" style="color:var(--gold)">${eur(pending)}</div>
      <div class="kpi-sub">${pendingIngs.length} factura${pendingIngs.length!==1?'s':''} pendiente${pendingIngs.length!==1?'s':''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">🏷</div>
      <div class="kpi-label">${t('top_categoria')}</div>
      <div class="kpi-value sm">${topCat?topCat[0]:'—'}</div>
      <div class="kpi-sub">${topCat?eur(topCat[1]):''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">📅</div>
      <div class="kpi-label">${t('mes_anterior_lbl')}</div>
      <div class="kpi-value">${eur(totalP)}</div>
    </div>
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card" style="min-width:0">
      <div class="card-header"><div class="card-title">📊 ${t('por_categoria_mes')}</div></div>
      <div style="display:flex;gap:16px;align-items:center;min-width:0">
        <div class="donut-chart-wrap-sm"><canvas id="chartIngCat"></canvas></div>
        <div class="legend" id="ingLegend" style="flex:1;margin-top:0;min-width:0"></div>
      </div>
    </div>
    <div class="card" style="min-width:0">
      <div class="card-header"><div class="card-title">📈 ${t('evolucion_6m')}</div></div>
      <div class="chart-container"><canvas id="chartIngEvo"></canvas></div>
    </div>
  </div>

  ${pendingIngs.length ? `
  <div class="card" style="margin-bottom:14px;border-color:rgba(245,158,11,0.3)">
    <div class="card-header">
      <div>
        <div class="card-title" style="color:var(--gold)">⏳ ${t('pendientes_cobro_titulo')}</div>
        <div class="card-subtitle">${pendingIngs.length} entrada${pendingIngs.length!==1?'s':''} · ${eur(pending)} por cobrar</div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>${t('concepto')}</th><th>${t('importe')}</th><th>${t('categoria')}</th><th>${t('fecha')}</th><th>${t('cuenta_destino')}</th><th>${t('estado')}</th><th>${t('acciones')}</th></tr></thead>
        <tbody>${pendingRows}</tbody>
      </table>
    </div>
  </div>` : ''}

  <div class="search-bar">
    <input class="search-input" type="text" placeholder="${t('buscar_concepto')}" value="${_ingSearch}" oninput="_ingSearch=this.value;renderIngresos()">
    <select class="filter-select" onchange="_ingCatFilter=this.value;renderIngresos()">
      <option value="">${t('todas_categorias')}</option>
      ${allCats.map(c=>`<option value="${c}" ${_ingCatFilter===c?'selected':''}>${catEmoji(c)} ${c}</option>`).join('')}
    </select>
    ${_ingSearch||_ingCatFilter?`<button class="btn btn-ghost btn-sm" onclick="_ingSearch='';_ingCatFilter='';renderIngresos()">${t('limpiar_filtros')}</button>`:''}
    <span style="margin-left:auto;font-size:.78rem;color:var(--text2)">${receivedIngs.length} cobrado${receivedIngs.length!==1?'s':''} · ${_gPeriodLabel()}</span>
  </div>

  <!-- Bulk action bar -->
  <div id="_ingBulkBar" style="display:none;align-items:center;gap:10px;padding:8px 14px;background:var(--indigo-dim);border:1px solid rgba(99,102,241,.3);border-radius:var(--radius-sm);margin-bottom:8px">
    <span style="font-size:.82rem;font-weight:700;color:var(--indigo)"><span id="_ingBulkCount">0</span> seleccionados</span>
    <button class="btn btn-primary btn-sm" style="background:var(--red);box-shadow:none" onclick="_ingBulkDelete()">🗑 ${t('btn_eliminar','Eliminar')}</button>
    <button class="btn btn-ghost btn-sm" onclick="_ingSelected.clear();renderIngresos()">✕ ${t('limpiar','Cancelar')}</button>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">✅ ${t('ingresos_cobrados')}</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:28px"><input type="checkbox" onchange="if(this.checked){receivedIngs.forEach(i=>_ingSelected.add(i.id))}else{_ingSelected.clear()};renderIngresos()" style="cursor:pointer"></th>
          <th style="cursor:pointer" onclick="_ingSetSort('concepto')">${t('concepto')} ${_ingSortIcon('concepto')}</th>
          <th style="cursor:pointer" onclick="_ingSetSort('importe')">${t('importe')} ${_ingSortIcon('importe')}</th>
          <th style="cursor:pointer" onclick="_ingSetSort('categoria')">${t('categoria')} ${_ingSortIcon('categoria')}</th>
          <th style="cursor:pointer" onclick="_ingSetSort('fecha')">${t('fecha')} ${_ingSortIcon('fecha')}</th>
          <th>${t('cuenta_lbl')}</th><th></th><th>${t('acciones')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`

  setTimeout(()=>{
    renderDonutCat('chartIngCat','ingLegend',catMap,'ingreso')
    renderLineEvo('chartIngEvo','ingreso')
  },50)
}

function exportarIngresos() {
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Concepto','Categoría','Importe (€)','Fecha','Cliente','Cuenta','Recurrente','Estado']
    const rows = S.ingresos.map(i=>[i.concepto||'',i.categoria||'',Number(i.importe)||0,i.fecha||'',i.cliente||'',getCuenta(i.cuentaId)?.nombre||'',i.recurrente?'Sí':'No',i.status==='pending'?'Pendiente':'Cobrado'])
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos')
    XLSX.writeFile(wb, `MoneyNest_Ingresos_${todayISO()}.xlsx`)
    toast(t('toast_ingresos_exportados'))
  } catch(e) { toast(t('err_exportar'),'error') }
}
// ─── GASTOS ────────────────────────────────────────────────────
let _gasSearch = '', _gasCatFilter = '', _gasMesFilter = ''
let _gasSort = { col: 'fecha', dir: 'desc' }
let _gasSelected = new Set()

function _gasSetSort(col) {
  if (_gasSort.col === col) _gasSort.dir = _gasSort.dir === 'asc' ? 'desc' : 'asc'
  else { _gasSort.col = col; _gasSort.dir = col === 'fecha' ? 'desc' : 'asc' }
  renderGastos()
}
function _gasToggleSelect(id) {
  if (_gasSelected.has(id)) _gasSelected.delete(id); else _gasSelected.add(id)
  const bar = document.getElementById('_gasBulkBar')
  if (bar) bar.style.display = _gasSelected.size ? 'flex' : 'none'
  const countEl = document.getElementById('_gasBulkCount')
  if (countEl) countEl.textContent = _gasSelected.size
}
function _gasBulkDelete() {
  if (!_gasSelected.size) return
  const ids = [..._gasSelected]
  confirmar(
    `¿Eliminar ${ids.length} gasto${ids.length>1?'s':''}?`,
    () => {
      removeTransactions(ids, 'gasto')
      _gasSelected.clear()
      save(); render()
    },
    {titulo:t('confirm_eliminar_gasto_titulo','Eliminar'), icono:'🗑️', btnLabel:t('btn_eliminar','Eliminar')}
  )
}

function renderGastos() {
  console.log('[renderGastos] Called with period:', window._gTimePeriod, '| Total gastos:', S.gastos.length)
  const m = currentMonth()
  const mp = prevMonth(m)
  // Use global period filter
  const total = S.gastos.filter(g=>_gDateInPeriod(g.fecha)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
  const totalP = calcGastosMes(mp)
  const catMap = {}
  S.gastos.filter(g=>_gDateInPeriod(g.fecha)&&g.tipo!==TX_TYPES.GOAL_TRANSFER).forEach(g=>{
    const cat=g.categoria||'Sin categoría'; catMap[cat]=(catMap[cat]||0)+(Number(g.importe)||0)
  })
  const topCat = Object.entries(catMap).sort((a,b)=>b[1]-a[1])[0]
  const allCats = [...new Set(S.gastos.map(g=>g.categoria).filter(Boolean))]
  const mediaGasto = (() => {
    const ms = getMonths(3)
    const vals = ms.map(mo => calcGastosMes(mo)).filter(v=>v>0)
    return vals.length ? vals.reduce((a,v)=>a+v,0)/vals.length : 0
  })()
  const mediaColor = total > mediaGasto ? 'var(--red)' : 'var(--green)'
  const mediaText  = total > mediaGasto ? t('por_encima') : t('por_debajo')

  const todos = [...S.gastos]
    .filter(g => {
      if (g.tipo === TX_TYPES.GOAL_TRANSFER) return false // internal — not a real expense
      const inPeriod = _gDateInPeriod(g.fecha)
      if (!inPeriod) {
        console.log('[renderGastos] Filtered out:', g.concepto, '| Date:', g.fecha, '| Period:', window._gTimePeriod)
        return false
      }
      const q = _gasSearch.toLowerCase()
      if (q && !(g.concepto||'').toLowerCase().includes(q)) return false
      if (_gasCatFilter && g.categoria !== _gasCatFilter) return false
      return true
    })
    .sort((a, b) => {
      const col = _gasSort.col, dir = _gasSort.dir === 'asc' ? 1 : -1
      if (col === 'importe') return dir * ((Number(a.importe)||0) - (Number(b.importe)||0))
      if (col === 'categoria') return dir * (a.categoria||'').localeCompare(b.categoria||'')
      return dir * ((b.fecha||'').localeCompare(a.fecha||'') * -1)
    })

  const _gasSortIcon = (col) => {
    if (_gasSort.col !== col) return '<span style="opacity:.3;font-size:.65rem">⇅</span>'
    return `<span style="font-size:.65rem;color:var(--accent)">${_gasSort.dir==='asc'?'↑':'↓'}</span>`
  }

  const rows = todos.map(g=>`
    <tr class="${_gasSelected.has(g.id)?'row-selected':''}">
      <td style="width:28px"><input type="checkbox" ${_gasSelected.has(g.id)?'checked':''} onchange="_gasToggleSelect('${g.id}')" style="cursor:pointer"></td>
      <td class="td-main td-desc-tx">${g.concepto||'—'}</td>
      <td class="td-amount td-neg">−${eur(g.importe)}</td>
      <td><span class="cat-with-emoji"><span class="cat-emoji">${catEmoji(g.categoria)}</span><span class="tag">${g.categoria||'—'}</span></span></td>
      <td>${fmtDate(g.fecha)}</td>
      <td>${g.cuentaId?getCuenta(g.cuentaId)?.nombre||'—':'—'}</td>
      <td>${g.recurrente?"<span class=\"badge badge-gold\">" + t('estado_recurrente') + "</span>":''}</td>
      <td><div class="action-row">
        <button class="btn-edit" onclick="editarGasto('${g.id}')">${t('btn_editar')}</button>
        <button class="btn-del" onclick="borrarGasto('${g.id}')">${t('btn_eliminar')}</button>
      </div></td>
    </tr>`).join('') || `<tr><td colspan="7">${window.mnEmptyStates ? window.mnEmptyStates.gastos(false, !!(_gasSearch||_gasCatFilter)) : `<div class="empty"><div class="empty-icon">💳</div><div class="empty-title">${t('sin_resultados')}</div><div class="empty-sub">${t('ajusta_aniade')}</div></div>`}</td></tr>`

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> ${t('page_gastos')}</div><div class="page-sub">${_gPeriodLabel()} · ${t('control_salidas')}</div></div>
    <div class="section-actions">
      <button class="btn btn-secondary btn-sm" onclick="window.MNBankImport&&MNBankImport.open()" style="background:var(--accent-dim);border-color:rgba(0,212,170,.35);color:var(--accent)">🏦 ${t('btn_importar_datos_bancarios','Importar datos bancarios')}</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('gastoModal');resetGastoForm()">${t('btn_nuevo_gasto')}</button>
    </div>
  </div>

  ${_gFilterBar('renderGastos()')}

  <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--red-dim)">📤</div>
      <div class="kpi-label">${t('total_lbl','Total')} ${window._gTimePeriod==='month'?t('este_mes','este mes'):window._gTimePeriod==='year'?t('este_anio','este año'):t('periodo_lbl','período')}</div>
      <div class="kpi-value">${eur(total)}</div>
      ${totalP?`<span class="kpi-delta ${total>totalP?'down':'up'}">${total>totalP?'↑':'↓'} ${pct(Math.abs(totalP?((total-totalP)/totalP*100):0))} ${t('vs_mes_ant','vs. mes ant.')}</span>`:`<span class="kpi-delta neu">${t('primer_mes','Primer mes')}</span>`}
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">${topCat?catEmoji(topCat[0]):'🏷'}</div>
      <div class="kpi-label">${t('mayor_categoria')}</div>
      <div class="kpi-value sm">${topCat?topCat[0]:'—'}</div>
      <div class="kpi-sub">${topCat?eur(topCat[1]):''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">📅</div>
      <div class="kpi-label">${t('media_mensual_3m')}</div>
      <div class="kpi-value sm">${eur(mediaGasto)}</div>
      <div class="kpi-sub" style="color:${mediaColor}">${mediaText}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">📆</div>
      <div class="kpi-label">${t('mes_anterior','Mes anterior')}</div>
      <div class="kpi-value">${eur(totalP)}</div>
    </div>
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card" style="min-width:0">
      <div class="card-header"><div class="card-title">🍩 ${t('por_categoria')}</div><div class="card-subtitle">${_gPeriodLabel()}</div></div>
      <div style="display:flex;gap:16px;align-items:center;min-width:0">
        <div class="donut-chart-wrap-sm"><canvas id="chartGasCat"></canvas></div>
        <div class="legend" id="gasLegend" style="flex:1;margin-top:0;min-width:0"></div>
      </div>
    </div>
    <div class="card" style="min-width:0">
      <div class="card-header"><div class="card-title">📈 ${t('evolucion_6m')}</div></div>
      <div class="chart-container"><canvas id="chartGasEvo"></canvas></div>
    </div>
  </div>

  <div class="search-bar">
    <input class="search-input" type="text" placeholder="${t('buscar_concepto')}" value="${_gasSearch}" oninput="_gasSearch=this.value;renderGastos()">
    <select class="filter-select" onchange="_gasCatFilter=this.value;renderGastos()">
      <option value="">${t('todas_categorias')}</option>
      ${allCats.map(c=>`<option value="${c}" ${_gasCatFilter===c?'selected':''}>${catEmoji(c)} ${c}</option>`).join('')}
    </select>
    ${_gasSearch||_gasCatFilter?`<button class="btn btn-ghost btn-sm" onclick="_gasSearch='';_gasCatFilter='';renderGastos()">${t('limpiar_filtros')}</button>`:''}
    <span style="margin-left:auto;font-size:.78rem;color:var(--text2)">${todos.length} resultado${todos.length!==1?'s':''} · ${_gPeriodLabel()}</span>
  </div>

  <!-- Bulk action bar -->
  <div id="_gasBulkBar" style="display:none;align-items:center;gap:10px;padding:8px 14px;background:var(--indigo-dim);border:1px solid rgba(99,102,241,.3);border-radius:var(--radius-sm);margin-bottom:8px">
    <span style="font-size:.82rem;font-weight:700;color:var(--indigo)"><span id="_gasBulkCount">0</span> seleccionados</span>
    <button class="btn btn-primary btn-sm" style="background:var(--red);box-shadow:none" onclick="_gasBulkDelete()">🗑 ${t('btn_eliminar','Eliminar')}</button>
    <button class="btn btn-ghost btn-sm" onclick="_gasSelected.clear();renderGastos()">✕ ${t('limpiar','Cancelar')}</button>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">${t('todos_gastos')}</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:28px"><input type="checkbox" onchange="if(this.checked){todos.forEach(g=>_gasSelected.add(g.id))}else{_gasSelected.clear()};renderGastos()" style="cursor:pointer"></th>
          <th style="cursor:pointer" onclick="_gasSetSort('concepto')">${t('concepto')} ${_gasSortIcon('concepto')}</th>
          <th style="cursor:pointer" onclick="_gasSetSort('importe')">${t('importe')} ${_gasSortIcon('importe')}</th>
          <th style="cursor:pointer" onclick="_gasSetSort('categoria')">${t('categoria')} ${_gasSortIcon('categoria')}</th>
          <th style="cursor:pointer" onclick="_gasSetSort('fecha')">${t('fecha')} ${_gasSortIcon('fecha')}</th>
          <th>${t('cuenta_lbl')}</th><th></th><th>${t('acciones')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`

  setTimeout(()=>{
    renderDonutCat('chartGasCat','gasLegend',catMap,'gasto')
    renderLineEvo('chartGasEvo','gasto')
  },50)
}

function exportarGastos() {
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Concepto','Categoría','Importe (€)','Fecha','Cuenta','Recurrente','Notas']
    const rows = S.gastos.map(g=>[g.concepto||'',g.categoria||'',Number(g.importe)||0,g.fecha||'',getCuenta(g.cuentaId)?.nombre||'',g.recurrente?'Sí':'No',g.notas||''])
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos')
    XLSX.writeFile(wb, `MoneyNest_Gastos_${todayISO()}.xlsx`)
    toast(t('toast_gastos_exportados'))
  } catch(e) { toast(t('err_exportar','Error al exportar'),'error') }
}
// ─── INVERSIONES ───────────────────────────────────────────────
function renderInversiones() {
  const abiertas = S.inversiones.filter(i=>!i.cerrada)
  const cerradas = S.inversiones.filter(i=>i.cerrada)
  const cartera = calcCartera()
  const gananciaRealizada = calcGananciaTotal()
  const gananciaLatente = calcGananciaLatente()
  const bestInv = [...cerradas].sort((a,b)=>Number(b.roiReal||0)-Number(a.roiReal||0))[0]
  const aciertos = cerradas.length ? cerradas.filter(i=>(Number(i.ganancia)||0)>0).length/cerradas.length*100 : 0

  // Filtro por estado
  const _invFiltro = window._invFiltro || 'todas'
  const allCats = [...new Set(S.inversiones.map(i=>i.categoria).filter(Boolean))]
  const _invCat = window._invCat || ''

  const filtradas = S.inversiones.filter(inv => {
    if (_invFiltro === 'abiertas' && inv.cerrada) return false
    if (_invFiltro === 'cerradas' && !inv.cerrada) return false
    if (_invCat && inv.categoria !== _invCat) return false
    // Period filter: by start date (or all if period is 'all')
    // Open positions are always visible regardless of period (they span multiple months)
    // Closed positions: filter by liquidation date if available
    if (!inv.cerrada && inv.status !== 'liquidated') return true // always show open
    if (window._gTimePeriod !== 'all') {
      const closeDate = inv.fechaCierre || inv.liquidatedAt || inv.fecha
      if (closeDate && !_gDateInPeriod(closeDate)) return false
    }
    return true
  })

  const cards = filtradas.map(inv=>{
    const volatile_ = isVolatile(inv)
    const roi = calcROI(inv)
    const ganancia = inv.cerrada ? Number(inv.ganancia)||0 : (volatile_ ? 0 : Number(inv.importe)*(Number(inv.rentabilidad)||0)/100)
    const totalConGanancia = Number(inv.importe) + ganancia
    return `
    <div class="inv-card ${inv.cerrada?'cerrada':''}">
      <div class="inv-name">${inv.nombre||'—'}</div>
      <div class="inv-meta">
        <span class="cat-with-emoji"><span class="cat-emoji">${catEmoji(inv.categoria)}</span><span class="cat-label">${inv.categoria||'—'}</span></span>
        · ${fmtDate(inv.fecha)}${inv.cerrada&&inv.fechaCierre?' → '+fmtDate(inv.fechaCierre):''}
        ${volatile_?'<span class="badge badge-gold" style="margin-left:4px;font-size:.6rem">⚡ Volátil</span>':''}
      </div>
      <div class="inv-stats">
        <div class="inv-stat">
          <div class="inv-stat-label">Capital invertido</div>
          <div class="inv-stat-val">${eur(inv.importe)}</div>
        </div>
        ${!volatile_ && !inv.cerrada ? `
        <div class="inv-stat">
          <div class="inv-stat-label">Rentab. esperada</div>
          <div class="inv-stat-val" style="color:${roi>=0?'var(--green)':'var(--red)'}">${roi>=0?'+':''}${pct(roi)}</div>
        </div>` : inv.cerrada ? `
        <div class="inv-stat">
          <div class="inv-stat-label">ROI real</div>
          <div class="inv-stat-val" style="color:${roi>=0?'var(--green)':'var(--red)'}">${roi>=0?'+':''}${pct(roi)}</div>
        </div>` : `
        <div class="inv-stat">
          <div class="inv-stat-label">Tipo de activo</div>
          <div class="inv-stat-val" style="color:var(--gold)">Volátil 📊</div>
        </div>`}
        <div class="inv-stat">
          <div class="inv-stat-label">${inv.cerrada?'Ganancia realizada':'Ganancia est.'}</div>
          <div class="inv-stat-val" style="color:${ganancia>=0?'var(--green)':'var(--red)'}">${ganancia===0&&volatile_&&!inv.cerrada?'—':(ganancia>=0?'+':'')+eur(ganancia)}</div>
        </div>
        ${inv.cerrada ? `
        <div class="inv-stat">
          <div class="inv-stat-label">Valor de salida</div>
          <div class="inv-stat-val">${eur(inv.valorFinal||0)}</div>
        </div>` : !volatile_ && !inv.cerrada ? `
        <div class="inv-stat">
          <div class="inv-stat-label">Valor proyectado</div>
          <div class="inv-stat-val" style="color:var(--accent)">${eur(totalConGanancia)}</div>
        </div>` : ''}
      </div>
      ${inv.notas?`<div style="font-size:.73rem;color:var(--text2);padding:5px 8px;background:var(--bg2);border-radius:5px;margin-bottom:10px">${inv.notas}</div>`:''}
      ${(() => {
        const revals = inv.revalorizaciones || []
        const benefs = inv.beneficiosRetirados || []
        const total = revals.length + benefs.length
        if (total === 0) return ''
        const totalBenef = benefs.reduce((sum, b) => sum + Number(b.importe), 0)
        return `
      <div style="margin-bottom:10px">
        <div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <span>📊 Historial (${total})</span>
          ${totalBenef > 0 ? `<span style="color:var(--green);font-size:.75rem">💰 +${eur(totalBenef)} retirados</span>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto">
          ${[...revals.map(r => ({ tipo: 'rev', fecha: r.fecha, data: r })), ...benefs.map(b => ({ tipo: 'ben', fecha: b.fecha, data: b }))].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 4).map(item => {
            if (item.tipo === 'rev') {
              const r = item.data
              return `<div style="font-size:.72rem;color:var(--text2);display:flex;justify-content:space-between;padding:4px 8px;background:var(--bg2);border-radius:4px">
                <span>📊 ${fmtDate(r.fecha)}</span>
                <strong style="color:${r.valor >= Number(inv.importe) ? 'var(--green)' : 'var(--red)'}">${eur(r.valor)}</strong>
              </div>`
            } else {
              const b = item.data
              return `<div style="font-size:.72rem;color:var(--green);display:flex;justify-content:space-between;padding:4px 8px;background:rgba(0,212,170,.08);border-radius:4px">
                <span>💰 ${fmtDate(b.fecha)}</span>
                <strong>+${eur(b.importe)}</strong>
              </div>`
            }
          }).join('')}
          ${total > 4 ? `<div style="font-size:.7rem;color:var(--text3);text-align:center">+${total - 4} más</div>` : ''}
        </div>
      </div>`
      })()}
      <div class="action-row">
        ${!inv.cerrada?`<button class="btn btn-accent btn-xs" onclick="abrirRevalorizar('${inv.id}')">📊 Revalorizar</button>`:''}
        ${!inv.cerrada?`<button class="btn btn-primary btn-xs" onclick="abrirLiquidar('${inv.id}')">💰 Liquidar</button>`:''}
        <button class="btn-edit" onclick="editarInversion('${inv.id}')">${t('btn_editar')}</button>
        <button class="btn-del" onclick="borrarInversion('${inv.id}')">${t('btn_eliminar')}</button>
      </div>
    </div>`
  }).join('') || (window.mnEmptyStates ? window.mnEmptyStates.inversiones(_invFiltro!=='todas'||!!_invCat) : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📈</div><div class="empty-title">${_invFiltro!=='todas'||_invCat?'Sin resultados':'Tu cartera está vacía'}</div></div>`)

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div>
      <div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> ${t('page_inversiones')}</div>
      <div class="page-sub">${t('inv_page_sub','Cartera de inversiones')}</div>
    </div>
    <div class="section-actions">
      <button class="btn btn-primary btn-sm" onclick="openModal('inversionModal');resetInvForm()">${t('btn_nueva_inversion','+ Nueva inversión')}</button>
    </div>
  </div>

  ${_gFilterBar('renderInversiones()')}

  <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">💎</div>
      <div class="kpi-label">${t('inv_capital_invertido','Capital invertido')}</div>
      <div class="kpi-value">${eur(cartera)}</div>
      <div class="kpi-sub">${abiertas.length} ${t('inv_abiertas','abiertas')} · ${cerradas.length} ${t('inv_liquidadas','liquidadas')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">📊</div>
      <div class="kpi-label">${t('inv_ganancia_latente','Ganancia latente')}</div>
      <div class="kpi-value sm" style="color:${gananciaLatente>=0?'var(--green)':'var(--red)'}">${gananciaLatente>=0?'+':''}${eur(gananciaLatente)}</div>
      <div class="kpi-sub">${t('inv_solo_predecibles','Solo activos predecibles')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:${gananciaRealizada>=0?'var(--green-dim)':'var(--red-dim)'}">✅</div>
      <div class="kpi-label">${t('inv_ganancia_realizada','Ganancia realizada')}</div>
      <div class="kpi-value sm" style="color:${gananciaRealizada>=0?'var(--green)':'var(--red)'}">${gananciaRealizada>=0?'+':''}${eur(gananciaRealizada)}</div>
      <div class="kpi-sub">${cerradas.length} ${t('inv_cerradas','cerradas')} · ${pct(aciertos,0)} ${t('inv_aciertos','de aciertos')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">🏆</div>
      <div class="kpi-label">${t('inv_mejor_operacion','Mejor operación')}</div>
      <div class="kpi-value sm">${bestInv?bestInv.nombre:'—'}</div>
      <div class="kpi-sub">${bestInv?`ROI: ${pct(Number(bestInv.roiReal||0))}`:''}</div>
    </div>
  </div>

  ${(() => {
    const totalDisponible = calcDineroDisponible()
    if (totalDisponible <= 0 && S.inversiones.filter(i=>!i.cerrada).length === 0) {
      return '<div style="background:var(--gold-dim);border:1px solid rgba(245,158,11,.25);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:20px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:1.4rem">⚠️</span>' +
        `<div><div style="font-size:.88rem;font-weight:700;color:var(--gold)">${t('inv_necesitas_fondos','Necesitas fondos en una cuenta para invertir')}</div>` +
        `<div style="font-size:.78rem;color:var(--text2);margin-top:2px">${t('inv_aniade_dinero','Añade dinero a tus cuentas antes de registrar una inversión.')}</div></div>` +
        `<button class="btn btn-secondary btn-xs" style="margin-left:auto;white-space:nowrap" onclick="goTo('cuentas')">${t('ir_cuentas','Ir a Cuentas →')}</button>` +
        '</div>'
    }
    return ''
  })()}
  <div style="background:var(--indigo-dim);border:1px solid rgba(99,102,241,.2);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:20px;font-size:.8rem;color:var(--text2)">
    ℹ️ <strong style="color:var(--text)">${t('inv_regla_titulo','Regla de inversiones:')}</strong> ${t('inv_regla_desc','La ganancia latente de activos volátiles (cripto, acciones, ETF) no se muestra ni suma al patrimonio. La ganancia solo se contabiliza al liquidar. Los activos predecibles (bonos, inmuebles) sí proyectan rentabilidad.')}
  </div>

  <div class="search-bar" style="margin-bottom:16px">
    <div class="tabs" style="margin:0;border:none;background:transparent;padding:0">
      <div class="tab ${_invFiltro==='todas'?'active':''}" onclick="window._invFiltro='todas';renderInversiones()">${t('inv_tab_todas','Todas')} (${S.inversiones.length})</div>
      <div class="tab ${_invFiltro==='abiertas'?'active':''}" onclick="window._invFiltro='abiertas';renderInversiones()">${t('inv_tab_abiertas','Abiertas')} (${abiertas.length})</div>
      <div class="tab ${_invFiltro==='cerradas'?'active':''}" onclick="window._invFiltro='cerradas';renderInversiones()">${t('inv_tab_liquidadas','Liquidadas')} (${cerradas.length})</div>
    </div>
    <select class="filter-select" style="margin-left:auto" onchange="window._invCat=this.value;renderInversiones()">
      <option value="">${t('todas_categorias','Todas las categorías')}</option>
      ${allCats.map(c=>`<option value="${c}" ${_invCat===c?'selected':''}>${catEmoji(c)} ${c}</option>`).join('')}
    </select>
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card col-span-2">
      <div class="card-header">
        <div><div class="card-title">📊 ${t('inv_roi_titulo','ROI General')}</div><div class="card-subtitle">${t('inv_roi_sub','Evolución de rentabilidad promedio en tiempo real')}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-xs" onclick="window._roiView='monthly';renderChartInvROI()" style="background:${window._roiView==='monthly'||!window._roiView?'var(--accent-dim)':'transparent'};color:${window._roiView==='monthly'||!window._roiView?'var(--accent)':'var(--text3)'}">${t('mensual','Mensual')}</button>
          <button class="btn btn-ghost btn-xs" onclick="window._roiView='yearly';renderChartInvROI()" style="background:${window._roiView==='yearly'?'var(--accent-dim)':'transparent'};color:${window._roiView==='yearly'?'var(--accent)':'var(--text3)'}">${t('anual','Anual')}</button>
        </div>
      </div>
      <div class="chart-container"><canvas id="chartInvROI"></canvas></div>
    </div>
  </div>

  <div class="inv-grid">${cards}</div>`

  setTimeout(()=>renderChartInvROI(),50)
}

function exportarInversiones() {
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Nombre','Categoría','Capital (€)','ROI (%)','Ganancia (€)','Valor actual (€)','Estado','Fecha entrada','Fecha cierre','Notas']
    const rows = S.inversiones.map(i=>[
      i.nombre||'',i.categoria||'',Number(i.importe)||0,calcROI(i),
      i.cerrada?Number(i.ganancia)||0:(isVolatile(i)?0:Number(i.importe)*(Number(i.rentabilidad)||0)/100),
      calcValorInv(i),i.cerrada?'Liquidada':'Activa',i.fecha||'',i.fechaCierre||'',i.notas||''
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Inversiones')
    XLSX.writeFile(wb, `MoneyNest_Inversiones_${todayISO()}.xlsx`)
    toast(t('toast_inversiones_exportadas'))
  } catch(e) { toast(t('err_exportar','Error al exportar'),'error') }
}
// ─── DEUDAS ────────────────────────────────────────────────────
let _deudaSearch = ''
let _deudaCatFilter = ''

function calcDebtStrategy(totalPendiente, interesMedio, multiplier) {
  // multiplier: 0.6 = conservador, 1.0 = moderado, 1.6 = agresivo
  const basePayment = totalPendiente > 0 ? Math.max(50, totalPendiente * 0.03) : 0
  const monthlyPayment = basePayment * multiplier
  let months = 0
  if (monthlyPayment > 0 && totalPendiente > 0) {
    if (interesMedio > 0) {
      const r = interesMedio / 100 / 12
      months = Math.ceil(Math.log(monthlyPayment / (monthlyPayment - r * totalPendiente)) / Math.log(1 + r))
      if (!isFinite(months) || months <= 0) months = Math.ceil(totalPendiente / monthlyPayment)
    } else {
      months = Math.ceil(totalPendiente / monthlyPayment)
    }
  }
  return { monthlyPayment, months }
}

function fmtMonths(m) {
  if (!m || m <= 0) return '—'
  const y = Math.floor(m/12), rem = m%12
  if (y && rem) return `${y}a ${rem}m`
  if (y) return `${y} año${y>1?'s':''}`
  return `${m} ${t('meses')}`
}

function renderDeudas() {
  const totalDeuda = S.deudas.reduce((a,d)=>a+(Number(d.importeTotal)||0),0)
  const totalPagado = S.deudas.reduce((a,d)=>a+(Number(d.importePagado)||0),0)
  const pendiente = totalDeuda - totalPagado
  const progPct = totalDeuda ? (totalPagado/totalDeuda*100) : 0
  const interesMedio = S.deudas.length ? S.deudas.reduce((a,d)=>a+(Number(d.interes)||0),0)/S.deudas.length : 0

  // Estrategias de pago
  const strats = [
    { key:'conservador', icon:'🐢', name:'Conservador', desc:'Pago mensual bajo, liquidación gradual y cómoda', mul:0.6, color:'var(--text2)' },
    { key:'moderado', icon:'⚖️', name:'Moderado', desc:'Equilibrio entre comodidad y velocidad de pago', mul:1.0, color:'var(--accent)' },
    { key:'agresivo', icon:'🚀', name:'Agresivo', desc:'Pago mensual alto, libre de deudas en menor tiempo', mul:1.6, color:'var(--red)' },
  ]

  // Persist active strategy in S — never assumed by default. null means
  // the user has never explicitly confirmed one yet.
  const activeStrat = S.deudaEstrategiaActiva?.key || null
  const activeStratData = strats.find(s=>s.key===activeStrat) || null
  const {monthlyPayment: activePago, months: activeMonths} = activeStratData
    ? calcDebtStrategy(pendiente, interesMedio, activeStratData.mul)
    : { monthlyPayment: 0, months: 0 }

  // Deuda prioritaria según la estrategia activa (o avalancha por defecto
  // para el calculo de "próxima deuda" cuando aún no hay estrategia)
  const priorityOrder = activeStrat === 'agresivo'
    ? [...S.deudas].filter(d=>(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)>0.01).sort((a,b)=>(Number(b.interes)||0)-(Number(a.interes)||0))
    : [...S.deudas].filter(d=>(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)>0.01).sort((a,b)=>((Number(a.importeTotal)||0)-(Number(a.importePagado)||0))-((Number(b.importeTotal)||0)-(Number(b.importePagado)||0)))
  const deudaPrioritaria = priorityOrder[0] || null

  // Confirma explícitamente una estrategia como ACTIVA — nunca registra
  // ningún pago. Separado a propósito de "Registrar pagos" (Bloque 8).
  window._confirmarEstrategiaDeuda = function(key) {
    S.deudaEstrategiaActiva = { key, appliedAt: todayISO() }
    save()
    render()
    const s = strats.find(x=>x.key===key)
    toast(`✓ ${t('estrategia_activa','Estrategia activa')}: ${s ? s.icon+' '+s.name : key}`)
  }

  // toggleStratMenu helper
  window.toggleStratMenu = function() {
    const m = document.getElementById('stratMenu')
    if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none'
  }

  const stratCards = activeStratData ? (() => {
    const active = activeStratData
    const others = strats.filter(s => s.key !== activeStrat)
    const {monthlyPayment: aPago, months: aMeses} = calcDebtStrategy(pendiente, interesMedio, active.mul)
    const changeOpts = others.map(x => {
      const {monthlyPayment: xPago, months: xMeses} = calcDebtStrategy(pendiente, interesMedio, x.mul)
      return `<div onclick="document.getElementById('stratMenu').style.display='none';window._confirmarEstrategiaDeuda('${x.key}')"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;font-size:.85rem;font-weight:600;color:var(--text2)"
        onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">
        <span style="font-size:1.2rem">${x.icon}</span>
        <div><div style="font-weight:700;color:var(--text)">${x.name}</div><div style="font-size:.72rem;color:var(--text3)">${eur(xPago)}/mes · libre en ${fmtMonths(xMeses)}</div></div>
      </div>`
    }).join('')
    return `<div class="debt-strategy-card debt-strategy-active"
      style="border-top:3px solid ${active.color};grid-column:1/-1;display:flex;align-items:center;gap:16px;text-align:left;padding:16px 20px;cursor:default;position:relative">
      <div style="font-size:2rem;flex-shrink:0">${active.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-size:.95rem;font-weight:800;color:${active.color}">${active.name}</span>
          <span style="background:${active.color}22;color:${active.color};font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px">✓ ${t('estrategia_activa','Estrategia activa')}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text2);margin-bottom:8px">${active.desc}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
          <span style="font-size:.85rem;font-weight:700;color:var(--accent)">💳 ${eur(aPago)}/mes</span>
          <span style="font-size:.78rem;color:var(--text2)">⏱ Libre en <strong style="color:var(--text)">${fmtMonths(aMeses)}</strong></span>
        </div>
      </div>
      <div style="position:relative;flex-shrink:0">
        <button onclick="event.stopPropagation();toggleStratMenu()"
          style="background:var(--border);border:1px solid var(--border2);border-radius:8px;padding:6px 12px;cursor:pointer;color:var(--text2);font-size:1.1rem;line-height:1"
          title="Cambiar estrategia">⋯</button>
        <div id="stratMenu" style="display:none;position:absolute;right:0;top:40px;background:var(--card);border:1px solid var(--border2);border-radius:var(--radius);box-shadow:var(--shadow-lg);z-index:50;min-width:220px;overflow:hidden">
          <div style="padding:8px 14px 6px;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Cambiar estrategia</div>
          ${changeOpts}
        </div>
      </div>
    </div>`
  })() : `<div class="mn-insight" style="grid-column:1/-1">
    <span class="mn-insight-icon">👇</span>
    <div class="mn-insight-body"><strong>${t('deuda_sin_estrategia','Aún no has aplicado ninguna estrategia')}</strong> — ${t('deuda_sin_estrategia_desc','elige una de las opciones de abajo y pulsa "Aplicar esta estrategia" para activarla.')}</div>
  </div>`

  // Filtros
  const allCats = [...new Set(S.deudas.map(d=>d.categoria).filter(Boolean))]
  const deudas = S.deudas
    .filter(d => {
      const q = _deudaSearch.toLowerCase()
      if (q && !( (d.nombre||'').toLowerCase().includes(q) || (d.categoria||'').toLowerCase().includes(q) )) return false
      if (_deudaCatFilter && d.categoria !== _deudaCatFilter) return false
      return true
    })

  const cards = deudas.map(d=>{
    const pendD = (Number(d.importeTotal)||0) - (Number(d.importePagado)||0)
    const pctD = d.importeTotal ? clamp((Number(d.importePagado)||0)/Number(d.importeTotal)*100,0,100) : 0
    const vencida = d.vencimiento && new Date(d.vencimiento) < new Date() && pendD > 0
    return `
    <div class="debt-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div class="debt-name">${d.nombre||'—'}</div>
        ${vencida?'<span class="badge badge-red">⚠ Vencida</span>':''}
      </div>
      <div class="debt-meta">
        <span class="cat-with-emoji"><span class="cat-emoji">${catEmoji(d.categoria)}</span><span class="tag">${d.categoria||'—'}</span></span>
        ${d.interes?' · <strong style="color:var(--gold)">'+pct(d.interes)+' anual</strong>':''}
        ${d.vencimiento?' · Vence: '+fmtDate(d.vencimiento):''}
      </div>
      <div class="progress-info">
        <span class="progress-label">Pagado: ${eur(d.importePagado||0)}</span>
        <span class="progress-pct" style="color:${pctD>=80?'var(--green)':pctD>=50?'var(--gold)':'var(--text)'}">${pct(pctD)}</span>
      </div>
      <div class="progress-wrap" style="margin-bottom:8px"><div class="progress-bar ${pctD>=100?'progress-ok':pctD>=80?'progress-accent':'progress-warn'}" style="width:${pctD}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text2);margin-bottom:12px">
        <span>Total: <strong style="color:var(--text)">${eur(d.importeTotal)}</strong></span>
        <span>Pendiente: <strong style="color:${pendD>0?'var(--red)':'var(--green)'}">${pendD>0?eur(pendD):'¡Saldada!'}</strong></span>
      </div>
      ${d.notas?`<div style="font-size:.75rem;color:var(--text2);margin-bottom:10px;padding:6px 8px;background:var(--bg2);border-radius:6px">${d.notas}</div>`:''}
      <div class="action-row">
        ${pendD>0?`<button class="btn btn-primary btn-xs" onclick="abrirPago('${d.id}')">💳 Registrar pago</button>`:'<span class="badge badge-green">✓ Saldada</span>'}
        <button class="btn-edit" onclick="editarDeuda('${d.id}')">${t('btn_editar')}</button>
        <button class="btn-del" onclick="borrarDeuda('${d.id}')">${t('btn_eliminar')}</button>
      </div>
    </div>`
  }).join('') || (window.mnEmptyStates ? window.mnEmptyStates.deudas(!!(_deudaSearch||_deudaCatFilter)) : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📉</div><div class="empty-title">${_deudaSearch||_deudaCatFilter?'Sin resultados':'Sin deudas registradas'}</div></div>`)

  // Calcular fecha exacta de libertad financiera para estrategia activa
  const _fechaLibertad = (months) => {
    if (!months || months <= 0) return null
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString(_currentLang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' })
  }

  // Construir lista de orden de pago
  const _makeOrderList = (arr) => `<div class="mn-debt-order">
    ${arr.map((d, i) => {
      const pend = (Number(d.importeTotal)||0) - (Number(d.importePagado)||0)
      return `<div class="mn-debt-order-item">
        <div class="mn-debt-order-num">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div class="mn-debt-order-name">${d.nombre||'—'}</div>
          <div class="mn-debt-order-meta">
            ${t('deuda_pendiente_lbl','Pendiente')}: <strong style="color:var(--text)">${eur(pend)}</strong>
            ${d.interes ? ` · <span style="color:var(--gold)">${pct(d.interes)} ${t('interes_anual','anual')}</span>` : ''}
          </div>
        </div>
      </div>`
    }).join('')}
  </div>`

  document.getElementById('content').innerHTML = `
  <!-- ── HEADER ────────────────────────────────────────────────── -->
  <div class="section-header mn-section">
    <div>
      <div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/></svg> ${t('deudas_lbl','Deudas')}</div>
      <div class="page-sub">${t('deudas_page_sub','Seguimiento, reducción y estrategia de pago')}</div>
    </div>
    <div class="section-actions">
      <button class="btn btn-primary btn-sm" onclick="openModal('deudaModal');resetDeudaForm()">${t('btn_nueva_deuda','+ Nueva deuda')}</button>
    </div>
  </div>

  <!-- ── KPIs ──────────────────────────────────────────────────── -->
  <div class="kpi-grid kpi-grid-5 mn-section">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--red-dim)">💸</div>
      <div class="kpi-label">${t('deuda_total_lbl','Deuda total')}</div>
      <div class="kpi-value">${eur(totalDeuda)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">✅</div>
      <div class="kpi-label">${t('deuda_pagado_lbl','Pagado')}</div>
      <div class="kpi-value">${eur(totalPagado)}</div>
      <span class="kpi-delta ${progPct>50?'up':'neu'}">${pct(progPct)}</span>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">⏳</div>
      <div class="kpi-label">${t('deuda_pendiente_lbl','Pendiente')}</div>
      <div class="kpi-value" style="color:var(--red)">${eur(pendiente)}</div>
      <div class="kpi-sub">${S.deudas.length} ${t('deudas_label','deudas')} · ${S.deudas.filter(d=>(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)<=0).length} ${t('saldadas','saldadas')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">🏁</div>
      <div class="kpi-label">${t('libertad_financiera','Libertad financiera')}</div>
      <div class="kpi-value sm" style="color:var(--accent)">
        ${activeStratData ? (_fechaLibertad(activeMonths) || (pendiente<=0 ? `✅ ${t('sin_deudas','Sin deudas')}` : '—')) : '—'}
      </div>
      <div class="kpi-sub">${activeStratData ? `${activeStratData.icon} ${activeStratData.name} · ${eur(activePago)}/${t('mes_lbl','mes')}` : t('deuda_sin_estrategia_kpi','Sin estrategia activa')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--red-dim)">🎯</div>
      <div class="kpi-label">${t('deuda_proxima_lbl','Próxima deuda')}</div>
      <div class="kpi-value sm">${deudaPrioritaria ? deudaPrioritaria.nombre : (pendiente<=0 ? `✅ ${t('sin_deudas','Sin deudas')}` : '—')}</div>
      <div class="kpi-sub">${deudaPrioritaria ? `${eur((Number(deudaPrioritaria.importeTotal)||0)-(Number(deudaPrioritaria.importePagado)||0))} ${t('deuda_pendiente_lbl','pendiente').toLowerCase()}` : ''}</div>
    </div>
  </div>

  <!-- ── ESTRATEGIAS DE PAGO ───────────────────────────────────── -->
  ${pendiente > 0 ? `
  <div class="card mn-section">
    <div class="card-header">
      <div><div class="card-title">⚡ ${t('estrategias_pago','Estrategias de pago')}</div><div class="card-subtitle">${t('estrategias_pago_sub','Selecciona tu ritmo')}${interesMedio>0?` · ${t('interes_medio','Interés medio')}: ${pct(interesMedio)}/año`:''}</div></div>
      ${(S.deudaHiddenStrats||[]).length ? `<button class="btn btn-ghost btn-xs" onclick="window._restoreDefaultStrats()">↺ Restaurar predefinidas</button>` : ''}
    </div>
    <div class="mn-strat-grid" id="stratPickerInline">
      ${strats.filter(s => !(S.deudaHiddenStrats||[]).includes(s.key)).map(s => {
        const {monthlyPayment: sPago, months: sMeses} = calcDebtStrategy(pendiente, interesMedio, s.mul)
        const isActive = s.key === activeStrat
        const fechaS = _fechaLibertad(sMeses)
        return `<div class="mn-strat-card ${isActive ? 'active' : ''}" style="position:relative">
          <span onclick="event.stopPropagation();window._hideDefaultStrat('${s.key}')" title="Ocultar" style="position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;background:var(--bg2);color:var(--text3);display:flex;align-items:center;justify-content:center;font-size:.7rem;cursor:pointer;z-index:2">✕</span>
          <div class="mn-strat-card-icon">${s.icon}</div>
          <div class="mn-strat-card-name">${s.name}</div>
          <div class="mn-strat-card-pay">${eur(sPago)}/${t('mes_lbl','mes')}</div>
          <div class="mn-strat-card-months">${fmtMonths(sMeses)}</div>
          <div class="mn-strat-card-date">${fechaS || '—'}</div>
          ${isActive
            ? `<div style="margin-top:8px;font-size:.65rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;text-align:center">✓ ${t('estrategia_activa','Activa')}</div>`
            : `<button class="btn btn-secondary btn-xs" style="width:100%;margin-top:8px" onclick="event.stopPropagation();window._confirmarEstrategiaDeuda('${s.key}')">${t('deuda_activar_estrategia','Activar esta estrategia')}</button>`}
        </div>`
      }).join('')}
      <!-- Custom saved strategies, inline in the same grid -->
      ${(window._customDebtStrategies||[]).map(cs => `
        <div class="mn-strat-card" style="position:relative;border-color:var(--accent);background:var(--accent-dim)">
          <span onclick="event.stopPropagation();window._deleteCustomStrategy('${cs.id}')" title="Borrar" style="position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.15);color:var(--text2);display:flex;align-items:center;justify-content:center;font-size:.7rem;cursor:pointer;z-index:2">✕</span>
          <div class="mn-strat-card-icon">${cs.icon||'🎯'}</div>
          <div class="mn-strat-card-name" title="${cs.name}">${cs.name}</div>
          <div class="mn-strat-card-pay" style="color:var(--accent)">${eur(cs.monthlyPayment)}/${t('mes_lbl','mes')}</div>
          <div class="mn-strat-card-months">${fmtMonths(cs.months)}</div>
          <div class="mn-strat-card-date">${cs.date || '—'}</div>
          <button class="btn btn-primary btn-xs" style="width:100%;margin-top:8px" onclick="event.stopPropagation();openApplyStrategyModal('${cs.id}')">⚡ ${t('aplicar','Aplicar')}</button>
        </div>`).join('')}
      <!-- Create Custom Strategy card -->
      <div class="mn-strat-card custom" onclick="openCustomDebtModal()">
        <div style="text-align:center">
          <div style="font-size:2rem;margin-bottom:6px">➕</div>
          <div style="font-size:.85rem;font-weight:800;color:var(--text)">${t('crear_estrategia','Crear estrategia')}</div>
          <div style="font-size:.7rem;color:var(--text3);margin-top:3px">${t('personaliza_pago','Personaliza tu pago mensual')}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── PAGOS DE LA ESTRATEGIA (Bloque 8B) ───────────────────────
       Separado a propósito de "Aplicar estrategia" de arriba: aquí sí
       se registran pagos reales, solo disponible cuando hay una
       estrategia realmente confirmada por el usuario. -->
  ${activeStratData ? `
  <div class="card mn-section">
    <div class="card-header">
      <div><div class="card-title">💳 ${t('deuda_pagos_estrategia','Pagos de la estrategia')}</div><div class="card-subtitle">${t('deuda_pagos_estrategia_sub','Registra el pago mensual repartido según tu estrategia activa')}</div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 16px;background:var(--bg2);border-radius:12px">
      <div>
        <div style="font-size:.78rem;color:var(--text2)">${t('deuda_pago_recomendado','Pago recomendado este mes')}</div>
        <div style="font-size:1.2rem;font-weight:900;color:var(--accent)">${eur(activePago)}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openApplyStrategyModal()">${t('deuda_registrar_pagos','Registrar pagos de este mes')}</button>
    </div>
  </div>` : ''}

  <div class="card mn-section">
    <!-- Multi-payment feature card — bigger, more visible -->
    <div onclick="openMultiPagoModal()" style="padding:18px 20px;border-radius:14px;border:1.5px solid var(--border2);background:var(--bg2);cursor:pointer;display:flex;align-items:center;gap:16px;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">
      <div style="width:48px;height:48px;border-radius:12px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">💳</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.95rem;font-weight:800;color:var(--text)">${t('pago_multiple','Pagar varias deudas a la vez')}</div>
        <div style="font-size:.78rem;color:var(--text2);margin-top:2px">${t('pago_multiple_sub','Selecciona varias deudas y regístralas todas en un solo paso')}</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text3);flex-shrink:0"><path d="M9 18l6-6-6-6"/></svg>
    </div>

    ${activeStratData ? `
    <!-- Libertad financiera card -->
    <div class="mn-freedom-card" style="margin-top:16px">
      <div style="font-size:.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">🏁 ${t('libertad_financiera','Fecha de libertad financiera')}</div>
      <div class="mn-freedom-date">${_fechaLibertad(activeMonths) || '—'}</div>
      <div class="mn-freedom-sub">${activeStratData.icon} ${activeStratData.name} · ${eur(activePago)}/${t('mes_lbl','mes')} · ${fmtMonths(activeMonths)}</div>
    </div>` : ''}
  </div>

  <!-- ── PROYECCIÓN + ORDEN DE PAGO ───────────────────────────── -->
  <div class="grid-2 mn-section">
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">📉 ${t('proyeccion_deuda','Proyección de deuda')}</div><div class="card-subtitle">${t('proyeccion_deuda_sub','Evolución del saldo total')}</div></div>
      </div>
      <div class="chart-container" style="height:180px"><div id="chartDeudaProyeccion"></div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 ${t('orden_pago','Orden de pago recomendado')}</div>
      </div>
      <div class="tabs" style="margin-bottom:12px">
        <div class="tab active" id="tab-snowball" onclick="switchDebtTab('snowball')">❄️ ${t('bola_nieve','Bola de nieve')}</div>
        <div class="tab" id="tab-avalanche" onclick="switchDebtTab('avalanche')">🌊 ${t('avalancha','Avalancha')}</div>
      </div>
      <div id="debt-snowball">
        <div style="font-size:.75rem;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--bg2);border-radius:8px;border-left:3px solid var(--indigo)">
          <strong style="color:var(--text)">❄️ ${t('bola_nieve','Bola de nieve')}:</strong> ${t('bola_nieve_desc','Empieza por la deuda más pequeña para ganar impulso psicológico.')}
        </div>
        ${_makeOrderList(debtSnowball())}
      </div>
      <div id="debt-avalanche" style="display:none">
        <div style="font-size:.75rem;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--bg2);border-radius:8px;border-left:3px solid var(--accent)">
          <strong style="color:var(--text)">🌊 ${t('avalancha','Avalancha')}:</strong> ${t('avalancha_desc','Empieza por la de mayor interés — ahorras más dinero a largo plazo.')}
        </div>
        ${_makeOrderList(debtAvalanche())}
      </div>
    </div>
  </div>` : ''}

  <!-- ── BUSCADOR + TARJETAS ───────────────────────────────────── -->
  <div class="search-bar mn-section">
    <input class="search-input" type="text" placeholder="${t('placeholder_buscar_deuda','🔍 Buscar deuda...')}" value="${_deudaSearch}" oninput="_deudaSearch=this.value;renderDeudas()">
    <select class="filter-select" onchange="_deudaCatFilter=this.value;renderDeudas()">
      <option value="">${t('todas_categorias','Todas las categorías')}</option>
      ${allCats.map(c=>`<option value="${c}" ${_deudaCatFilter===c?'selected':''}>${catEmoji(c)} ${c}</option>`).join('')}
    </select>
    ${_deudaSearch||_deudaCatFilter?`<button class="btn btn-ghost btn-sm" onclick="_deudaSearch='';_deudaCatFilter='';renderDeudas()">✕ ${t('limpiar','Limpiar')}</button>`:''}
  </div>

  <div class="grid-3 mn-section">${cards}</div>`

  if (pendiente > 0) {
    // Use requestAnimationFrame + extra delay to ensure DOM is painted
    requestAnimationFrame(() => setTimeout(() => renderChartDeudaProyeccion(pendiente, activePago), 80))
  }
}

/**
 * Reemplaza el gráfico de línea feo por barras horizontales por deuda.
 * Muestra el estado actual de cada deuda: pagado vs pendiente.
 * Mucho más legible y útil que una línea de amortización.
 */
function renderChartDeudaProyeccion(totalPendiente, mensualPago) {
  const container = document.getElementById('chartDeudaProyeccion')
  if (!container) return

  const interesMedio = S.deudas.length
    ? S.deudas.reduce((a,d) => a + (Number(d.interes)||0), 0) / S.deudas.length
    : 0

  // Calcular meses por deuda según estrategia activa
  const estrategia = window._deudaStrat || 'moderado'
  const mulMap = { conservador: 0.6, moderado: 1.0, agresivo: 1.6 }
  const mul = mulMap[estrategia] || 1.0

  const deudas = S.deudas.filter(d => {
    const pend = (Number(d.importeTotal)||0) - (Number(d.importePagado)||0)
    return pend > 0
  }).sort((a, b) => {
    // Ordenar según estrategia activa
    if (estrategia === 'agresivo') return (Number(b.interes)||0) - (Number(a.interes)||0)
    const pA = (Number(a.importeTotal)||0) - (Number(a.importePagado)||0)
    const pB = (Number(b.importeTotal)||0) - (Number(b.importePagado)||0)
    return pA - pB // snowball por defecto
  })

  if (!deudas.length) {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--green);font-weight:700">✅ ${t('sin_deudas','Sin deudas pendientes')}</div>`
    return
  }

  // Calcular cuándo se paga cada deuda de forma acumulada
  const { monthlyPayment } = calcDebtStrategy(totalPendiente, interesMedio, mul)
  let presupuesto = monthlyPayment
  let acumMeses = 0
  const deudaInfo = deudas.map(d => {
    const total  = Number(d.importeTotal) || 0
    const pagado = Number(d.importePagado) || 0
    const pend   = Math.max(0, total - pagado)
    const pct2   = total > 0 ? (pagado / total) * 100 : 0
    const r      = (Number(d.interes)||0) / 100 / 12
    let meses
    if (r > 0 && presupuesto > r * pend) {
      meses = Math.ceil(Math.log(presupuesto / (presupuesto - r * pend)) / Math.log(1 + r))
    } else {
      meses = Math.ceil(pend / Math.max(presupuesto, 1))
    }
    if (!isFinite(meses) || meses <= 0) meses = 1
    acumMeses += meses
    const fechaLibre = (() => {
      const fd = new Date(); fd.setMonth(fd.getMonth() + acumMeses)
      return fd.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    })()
    // Siguiente deuda recibe el pago liberado (efecto bola de nieve / avalancha)
    presupuesto += pend / Math.max(meses, 1) * 0.3
    return { nombre: d.nombre || '—', total, pagado, pend, pct: pct2, meses, fechaLibre, interes: Number(d.interes)||0 }
  })

  // Renderizar como barras horizontales
  container.innerHTML = deudaInfo.map(d => {
    const urgencyColor = d.interes > 15 ? '#F43F5E' : d.interes > 8 ? '#F59E0B' : '#00D4AA'
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px;min-width:0">
            <span style="width:8px;height:8px;border-radius:50%;background:${urgencyColor};flex-shrink:0;
              box-shadow:0 0 5px ${urgencyColor}88"></span>
            <span style="font-size:.82rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${d.nombre}</span>
            ${d.interes > 0 ? `<span style="font-size:.62rem;color:var(--gold);font-weight:600">${pct(d.interes)}</span>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:8px">
            <span style="font-size:.78rem;font-weight:800;color:var(--text)">${eur(d.pend)}</span>
            <span style="font-size:.64rem;color:var(--text3);margin-left:4px">→ ${d.fechaLibre}</span>
          </div>
        </div>
        <div style="height:8px;background:var(--border);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${d.pct.toFixed(1)}%;background:${urgencyColor};border-radius:99px;
            transition:width .6s cubic-bezier(0.16,1,0.3,1);
            box-shadow:0 0 8px ${urgencyColor}66"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.63rem;color:var(--text3);margin-top:2px">
          <span>${t('pagado','Pagado')}: ${eur(d.pagado)} (${d.pct.toFixed(0)}%)</span>
          <span>${fmtMonths(d.meses)}</span>
        </div>
      </div>`
  }).join('')
}

/**
 * Calculador de deuda:
 * El usuario da cuántos meses/años quiere tardar → se calcula cuánto pagar /mes, /semana, /día.
 * Botón "Confirmar estrategia" aplica la cuota y actualiza la libertad financiera.
 */
function calcLibertad3Cards() {
  const input = document.getElementById('libertadN')
  const unitEl = document.getElementById('libertadUnit')
  const unit  = unitEl?.value
  const box   = document.getElementById('libertad3Cards')
  if (!box) return

  const n = parseAmount(input?.value)
  if (!n || n <= 0) {
    box.innerHTML = `<div class="mn-insight mn-insight--alert"><span class="mn-insight-icon">⚠️</span><div class="mn-insight-body">${t('err_periodo_invalido','Introduce un período válido.')}</div></div>`
    return
  }

  const pend = S.deudas.reduce((a,d) => a + Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)), 0)
  if (pend <= 0) {
    box.innerHTML = `<div class="mn-insight mn-insight--ok"><span class="mn-insight-icon">🎉</span><div class="mn-insight-body"><strong>${t('deuda_libertad_exito','¡Ya estás libre de deudas!')}</strong></div></div>`
    return
  }

  const intMed = S.deudas.length ? S.deudas.reduce((a,d) => a+(Number(d.interes)||0),0)/S.deudas.length : 0
  const meses  = unit === 'anos' ? Math.round(n * 12) : Math.round(n)
  if (meses < 1) { box.innerHTML = ''; return }

  // Cuota mensual con fórmula de amortización
  let mensual
  if (intMed > 0) {
    const r = intMed / 100 / 12
    mensual = (pend * r * Math.pow(1+r, meses)) / (Math.pow(1+r, meses) - 1)
  } else {
    mensual = pend / meses
  }
  if (!isFinite(mensual) || mensual <= 0) { box.innerHTML = ''; return }

  const semanal = mensual * 12 / 52
  const diario  = mensual * 12 / 365
  const totalIntereses = Math.max(0, mensual * meses - pend)

  const fechaLibre = (() => {
    const fd = new Date(); fd.setMonth(fd.getMonth() + meses)
    return fd.toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })
  })()

  box.innerHTML = `
    <!-- Resultado -->
    <div style="background:rgba(0,212,170,0.06);border:1px solid rgba(0,212,170,0.2);border-radius:12px;padding:14px 16px;margin-bottom:10px">
      <div style="font-size:.65rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">🏁 ${t('libertad_financiera','Libertad financiera')}</div>
      <div style="font-size:1.15rem;font-weight:900;color:var(--accent)">${fechaLibre}</div>
      <div style="font-size:.72rem;color:var(--text2);margin-top:3px">${fmtMonths(meses)}${intMed>0?` · ${eur(totalIntereses)} ${t('en_intereses','en intereses')}`:''}</div>
    </div>

    <!-- Desglose /mes /semana /día -->
    <div class="mn-3col-grid" style="margin-bottom:10px">
      ${[
        { label:t('al_mes','/mes'),    amount:mensual, color:'#00D4AA' },
        { label:t('a_la_semana','/sem'),amount:semanal,color:'#6366F1' },
        { label:t('al_dia','/día'),   amount:diario,  color:'#F59E0B' },
      ].map(c=>`
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:11px 8px;text-align:center;min-width:0">
          <div style="font-size:.95rem;font-weight:900;color:${c.color};letter-spacing:-.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eur(c.amount)}</div>
          <div style="font-size:.62rem;color:var(--text3);margin-top:2px;font-weight:600">${c.label}</div>
        </div>`).join('')}
    </div>

    <!-- Confirmar estrategia -->
    <button onclick="calcLibertad3Cards._apply(${mensual.toFixed(2)})"
      style="width:100%;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),#00A882);color:#0A0E17;font-size:.84rem;font-weight:800;cursor:pointer;font-family:inherit">
      ✓ ${t('aplicar_como_estrategia','Confirmar estrategia')}
    </button>
    ${intMed>0?`<div style="font-size:.65rem;color:var(--text3);text-align:center;margin-top:5px">* ${t('incluye_interes','Incluye interés medio del')} ${pct(intMed)}/año</div>`:''}
  `
}

calcLibertad3Cards._apply = function(cuotaStr) {
  const cuotaMensual = parseFloat(cuotaStr)
  window._deudaCustomPago = cuotaMensual
  toast(`✅ ${t('estrategia_aplicada','Estrategia aplicada')}: ${eur(cuotaMensual)}/${t('mes_lbl','mes')}`)
  const pend = S.deudas.reduce((a,d) => a + Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)), 0)
  // Actualizar la tarjeta de libertad financiera en el KPI
  render()
  setTimeout(() => renderChartDeudaProyeccion(pend, cuotaMensual), 60)
}

function calcDeudaPersonalizada() {
  const inputEl = document.getElementById('deudaCalcInput')
  const monthly = parseAmount(inputEl?.value)
  const result  = document.getElementById('deudaCalcResult')
  if (!result) return
  if (!monthly || monthly <= 0) { result.innerHTML = '<span style="color:var(--red)">' + t('deuda_input_invalido') + '</span>'; return }
  const totalPend = calcTotalDeuda()
  if (!totalPend) { result.innerHTML = '<span style="color:var(--green)">' + t('deuda_sin_pendientes') + '</span>'; return }
  const interesMedio = S.deudas.length ? S.deudas.reduce((a,d)=>a+(Number(d.interes)||0),0)/S.deudas.length : 0
  let months
  if (interesMedio > 0) {
    const r = interesMedio / 100 / 12
    months = Math.ceil(Math.log(monthly/(monthly - r*totalPend)) / Math.log(1+r))
    if (!isFinite(months) || months <= 0) months = Math.ceil(totalPend/monthly)
  } else {
    months = Math.ceil(totalPend/monthly)
  }
  result.innerHTML = '⏱ ' + t('deuda_libre_pagar') + ' <strong style="color:var(--accent)">' + fmtMonths(months) + '</strong> (' + eur(monthly) + '/mes).'
}

function switchDebtTab(tab) {
  // Mostrar/ocultar listas
  const snow = document.getElementById('debt-snowball')
  const aval = document.getElementById('debt-avalanche')
  if (snow) snow.style.display = tab === 'snowball'  ? 'block' : 'none'
  if (aval) aval.style.display = tab === 'avalanche' ? 'block' : 'none'
  // Actualizar tabs activos (cualquier container que los tenga)
  document.querySelectorAll('#tab-snowball, #tab-avalanche').forEach(el => el.classList.remove('active'))
  const activeTab = document.getElementById('tab-' + tab)
  if (activeTab) activeTab.classList.add('active')
  // Refrescar proyección
  const pend = S && S.deudas ? S.deudas.reduce((a,d) => a + Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)), 0) : 0
  const intM  = S && S.deudas ? S.deudas.reduce((a,d)=>a+(Number(d.interes)||0),0)/(S.deudas.length||1) : 0
  const { monthlyPayment } = calcDebtStrategy(pend, intM, { conservador:0.6, moderado:1.0, agresivo:1.6 }[window._deudaStrat||'moderado'] || 1.0)
  setTimeout(() => renderChartDeudaProyeccion(pend, window._deudaCustomPago || monthlyPayment), 40)
}

function exportarDeudas() {
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Nombre','Categoría','Total (€)','Pagado (€)','Pendiente (€)','Interés (%)','Vencimiento','Notas']
    const rows = S.deudas.map(d => [
      d.nombre||'', d.categoria||'',
      Number(d.importeTotal)||0, Number(d.importePagado)||0,
      (Number(d.importeTotal)||0)-(Number(d.importePagado)||0),
      d.interes||0, d.vencimiento||'', d.notas||''
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Deudas')
    XLSX.writeFile(wb, `MoneyNest_Deudas_${todayISO()}.xlsx`)
    toast(t('toast_deudas_exportadas'))
  } catch(e) { toast(t('err_exportar','Error al exportar'),'error'); console.error(e) }
}

// ─── OBJETIVOS ─────────────────────────────────────────────────
let _objSearch = ''
let _objCatFilter = ''

function renderObjetivos() {
  const allCats = [...new Set(S.objetivos.map(o=>o.categoria).filter(Boolean))]
  // No period filter for objectives — always show all
  const filtered = S.objetivos.filter(o => {
    const q = _objSearch.toLowerCase()
    if (q && !((o.nombre||'').toLowerCase().includes(q))) return false
    if (_objCatFilter && o.categoria !== _objCatFilter) return false
    return true
  })


  // KPIs
  const totalMeta = S.objetivos.reduce((a,o)=>a+(Number(o.objetivo)||0),0)
  const totalActual = S.objetivos.reduce((a,o)=>a+(Number(o.actual)||0),0)
  const completados = S.objetivos.filter(o=>((Number(o.actual)||0)>=(Number(o.objetivo)||1))).length

  // Split into in-progress and completed
  const inProgress = filtered.filter(o => (Number(o.actual)||0) < (Number(o.objetivo)||1))
  const done       = filtered.filter(o => (Number(o.actual)||0) >= (Number(o.objetivo)||1))

  // Build a map of card html by id
  const cards_map = {}
  const makeCards = (list) => list.map(obj=>cards_map[obj.id]||'').join('')
  filtered.forEach(obj => {
    const pctVal = obj.objetivo ? clamp((Number(obj.actual)||0)/Number(obj.objetivo)*100,0,100) : 0
    const falta  = Math.max(0,(Number(obj.objetivo)||0)-(Number(obj.actual)||0))
    let prediccion = ''
    const contribs = (obj.aportaciones||[])
    const avgMonthly = (() => {
      if (contribs.length >= 2) {
        const total = contribs.reduce((a,c)=>a+(Number(c.importe)||0),0)
        const months = Math.max(1, contribs.length)
        return total / months
      }
      const m2 = currentMonth()
      const sr2 = calcSavingsRate(m2)
      const ing2 = calcIngresosMes(m2)
      return ing2 > 0 ? (ing2 * sr2/100) / Math.max(S.objetivos.length,1) : 0
    })()
    if (obj.fechaObjetivo && falta > 0) {
      const today  = new Date()
      const target = new Date(obj.fechaObjetivo)
      const meses  = Math.max(0,(target-today)/(1000*60*60*24*30.44))
      if (meses > 0) prediccion = `Necesitas <strong>${eur(falta/meses)}/mes</strong>`
    }
    let etaText = ''
    if (falta > 0 && avgMonthly > 0) {
      const mesesETA = Math.ceil(falta / avgMonthly)
      const etaDate = new Date()
      etaDate.setMonth(etaDate.getMonth() + mesesETA)
      const _etaLoc={'es':'es-ES','en':'en-GB'}[_currentLang]||'es-ES'; const etaLabel = etaDate.toLocaleDateString(_etaLoc,{month:'short',year:'numeric'})
      etaText = `A este ritmo: <strong>${etaLabel}</strong> (${mesesETA} ${mesesETA===1?'mes':'meses'})`
    } else if (falta <= 0) {
      etaText = '🎉 ¡Meta alcanzada!'
    }
    const color   = obj.color||'#00D4AA'
    const hasBgImg = obj.avatar && obj.avatar.startsWith('data:')
    const bgStyle = hasBgImg
      ? `background-image:url(${obj.avatar});background-size:cover;background-position:center;`
      : `background:var(--card);`
    const overlayStyle = hasBgImg
      ? `position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,rgba(0,0,0,0.75) 100%);border-radius:var(--radius);z-index:0;`
      : `display:none;`
    const textColor = hasBgImg ? '#fff' : 'var(--text)'
    const textColor2 = hasBgImg ? 'rgba(255,255,255,0.8)' : 'var(--text2)'
    const emojiContent = !hasBgImg ? (obj.emoji || catEmoji(obj.categoria) || '🎯') : ''
    const borderTopStyle = hasBgImg ? '' : `border-top:3px solid ${color};`
    cards_map[obj.id] = `
    <div class="goal-card ${hasBgImg?'has-img':''}" style="${borderTopStyle}position:relative;${bgStyle}overflow:hidden">
      <div style="${overlayStyle}"></div>
      <div style="position:relative;z-index:1">
      ${!hasBgImg ? `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
        <div class="obj-avatar" style="background:${color}22;border-color:${color}44">${emojiContent || catEmoji(obj.categoria) || '🎯'}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
            <div class="goal-name" style="color:${textColor}">${obj.nombre||'—'}</div>
            <span class="badge" style="background:${color}22;color:${color};flex-shrink:0">${obj.categoria||'Objetivo'}</span>
          </div>
          <div class="goal-meta" style="color:${textColor2}">${obj.fechaObjetivo?'📅 Meta: '+fmtDate(obj.fechaObjetivo):'Sin fecha límite'}</div>
        </div>
      </div>` : `
      <div style="margin-bottom:12px;padding-top:4px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px">
          <div class="goal-name" style="color:${textColor};text-shadow:0 1px 3px rgba(0,0,0,0.5)">${obj.nombre||'—'}</div>
          <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;flex-shrink:0;backdrop-filter:blur(4px)">${obj.categoria||'Objetivo'}</span>
        </div>
        <div class="goal-meta" style="color:${textColor2}">${obj.fechaObjetivo?'📅 Meta: '+fmtDate(obj.fechaObjetivo):'Sin fecha límite'}</div>
      </div>`}
      <div class="progress-info">
        <span class="progress-label" style="${hasBgImg?'color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7)':''}">${eur(obj.actual||0)} de ${eur(obj.objetivo)}</span>
        <span class="progress-pct" style="color:${hasBgImg?'#fff':color};font-weight:800;${hasBgImg?'text-shadow:0 1px 3px rgba(0,0,0,.7)':''}">${pct(pctVal)}</span>
      </div>
      <div class="progress-wrap" style="margin-bottom:8px;${hasBgImg?'background:rgba(255,255,255,0.2)':''}"><div class="progress-bar" style="width:${pctVal}%;background:${hasBgImg?'rgba(255,255,255,0.9)':color}"></div></div>
      <div style="font-size:.78rem;margin-bottom:${prediccion?'6':'10'}px;${hasBgImg?'color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,.6)':'color:var(--text2)'}">Falta: <strong style="${hasBgImg?'color:#fff':'color:var(--text)'};font-size:.9rem">${eur(falta)}</strong></div>
      ${prediccion?`<div style="font-size:.75rem;color:var(--text2);margin-bottom:6px;padding:6px 10px;background:var(--bg2);border-radius:6px">📅 ${prediccion}</div>`:''}
      ${etaText&&falta>0?`<div style="font-size:.75rem;color:var(--accent);margin-bottom:10px;padding:6px 10px;background:var(--accent-dim);border-radius:6px;font-weight:600">🚀 ${etaText}</div>`:''}
      ${pctVal>=100?'<div style="text-align:center;margin-bottom:10px"><span class="badge badge-green" style="font-size:.85rem">🎉 ¡Objetivo alcanzado!</span></div>':''}
      <div class="action-row" style="${hasBgImg?'background:rgba(0,0,0,0.3);border-radius:var(--radius-sm);padding:4px 6px;':''}">
        <button class="btn btn-primary btn-xs" onclick="abrirAportar('${obj.id}')">💸 Aportar</button>
        <button class="btn-edit" onclick="editarObjetivo('${obj.id}')" style="${hasBgImg?'background:rgba(255,255,255,0.15);color:#fff;':''}">${t('btn_editar')}</button>
        <button class="btn-del" onclick="borrarObjetivo('${obj.id}')" style="${hasBgImg?'background:rgba(255,80,80,0.25);color:#fca5a5;':''}"></button>
      </div>
      </div>
    </div>`
  })

  const emptyHtml = (window.mnEmptyStates ? window.mnEmptyStates.objetivos(!!(_objSearch||_objCatFilter)) : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🎯</div><div class="empty-title">${_objSearch||_objCatFilter?'Sin resultados':'Define tu próxima meta'}</div></div>`)

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${t('page_objetivos','Objetivos')}</div><div class="page-sub">${t('obj_page_sub','Metas financieras y predicciones')}</div></div>
    <div class="section-actions">
      <button class="btn btn-primary btn-sm" onclick="openModal('objetivoModal');resetObjForm()">${t('btn_nuevo_objetivo','+ Nuevo objetivo')}</button>
    </div>
  </div>

  <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">🎯</div>
      <div class="kpi-label">${t('obj_activos_lbl','Objetivos activos')}</div>
      <div class="kpi-value">${S.objetivos.length}</div>
      <div class="kpi-sub">${completados} ${t('completados','completados')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">💰</div>
      <div class="kpi-label">${t('obj_total_ahorrado','Total ahorrado')}</div>
      <div class="kpi-value sm">${eur(totalActual)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">🏆</div>
      <div class="kpi-label">${t('obj_meta_total','Meta total')}</div>
      <div class="kpi-value sm">${eur(totalMeta)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">📊</div>
      <div class="kpi-label">${t('obj_progreso_global','Progreso global')}</div>
      <div class="kpi-value sm" style="color:var(--accent)">${pct(totalMeta?clamp(totalActual/totalMeta*100,0,100):0)}</div>
    </div>
  </div>

  <div class="search-bar">
    <input class="search-input" type="text" placeholder="${t('placeholder_buscar_objetivo','🔍 Buscar objetivo...')}" value="${_objSearch}" oninput="_objSearch=this.value;renderObjetivos()">
    <select class="filter-select" onchange="_objCatFilter=this.value;renderObjetivos()">
      <option value="">${t('todas_categorias','Todas las categorías')}</option>
      ${allCats.map(c=>`<option value="${c}" ${_objCatFilter===c?'selected':''}>${catEmoji(c)} ${c}</option>`).join('')}
    </select>
    ${_objSearch||_objCatFilter?`<button class="btn btn-ghost btn-sm" onclick="_objSearch='';_objCatFilter='';renderObjetivos()">✕ ${t('limpiar','Limpiar')}</button>`:''}
  </div>

  ${inProgress.length > 0 ? `
  <div style="margin-bottom:8px;margin-top:4px">
    <div style="font-size:.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;padding-left:2px">
      🚀 ${window._currentLang==='en'?'In progress':'En progreso'} · ${inProgress.length}
    </div>
    <div class="grid-3">${inProgress.map(o=>cards_map[o.id]).join('')}</div>
  </div>` : (!done.length ? emptyHtml : '')}

  ${done.length > 0 ? `
  <div style="margin-top:24px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-left:2px">
      <div style="flex:1;height:1px;background:var(--border)"></div>
      <div style="font-size:.72rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap">
        🏆 ${window._currentLang==='en'?'Completed':'Completados'} · ${done.length}
      </div>
      <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>
    <div class="grid-3" style="opacity:0.7">${done.map(o=>cards_map[o.id]).join('')}</div>
  </div>` : ''}`
}

function exportarObjetivos() {
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Nombre','Categoría','Meta (€)','Ahorrado (€)','% Completado','Falta (€)','Fecha objetivo','Notas']
    const rows = S.objetivos.map(o => [
      o.nombre||'', o.categoria||'',
      Number(o.objetivo)||0, Number(o.actual)||0,
      o.objetivo ? Math.round((Number(o.actual)||0)/(Number(o.objetivo)||1)*100) : 0,
      Math.max(0,(Number(o.objetivo)||0)-(Number(o.actual)||0)),
      o.fechaObjetivo||'', o.notas||''
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Objetivos')
    XLSX.writeFile(wb, `MoneyNest_Objetivos_${todayISO()}.xlsx`)
    toast(t('toast_objetivos_exportados'))
  } catch(e) { toast(t('err_exportar','Error al exportar'),'error'); console.error(e) }
}

// Avatar helpers for objetivos
let _objAvatarTarget = null
let _objAvatarPending = null

function abrirObjAvatar(objId) {
  _objAvatarTarget = objId
  const obj  = S.objetivos.find(x=>x.id===objId)
  _objAvatarPending = obj?.avatar || obj?.emoji || catEmoji(obj?.categoria) || '🎯'
  const prev = document.getElementById('objAvatarPreviewBig')
  if (prev) {
    if (_objAvatarPending && _objAvatarPending.startsWith('data:')) {
      prev.innerHTML = `<img src="${_objAvatarPending}" style="width:100%;height:100%;object-fit:cover">`
    } else {
      prev.textContent = _objAvatarPending
    }
  }
  openModal('objAvatarModal')
}
function setObjEmoji(emoji) {
  _objAvatarPending = emoji
  const prev = document.getElementById('objAvatarPreviewBig')
  if (prev) prev.textContent = emoji
}
function applyObjAvatarFile(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    if (!checkImageSize(e.target.result)) { input.value = ''; return }
    _objAvatarPending = e.target.result
    const prev = document.getElementById('objAvatarPreviewBig')
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`
  }
  reader.readAsDataURL(file)
}

function clearObjAvatar() {
  _objAvatarPending = null
  const prev = document.getElementById('objAvatarPreviewBig')
  if (prev) prev.innerHTML = ''
  const fi = document.getElementById('objAvatarFileInput')
  if (fi) fi.value = ''
}
function confirmarObjAvatar() {
  if (!_objAvatarTarget) { closeModal('objAvatarModal'); return }
  const idx = S.objetivos.findIndex(x=>x.id===_objAvatarTarget)
  if (idx >= 0) {
    if (!_objAvatarPending) {
      // Clear both avatar and emoji
      S.objetivos[idx].avatar = null
      S.objetivos[idx].emoji  = null
    } else if (typeof _objAvatarPending === 'string' && _objAvatarPending.startsWith('data:')) {
      S.objetivos[idx].avatar = _objAvatarPending
      S.objetivos[idx].emoji  = null
    } else {
      S.objetivos[idx].emoji  = _objAvatarPending
      S.objetivos[idx].avatar = null
    }
  }
  save(); closeModal('objAvatarModal'); render()
  toast(t(_objAvatarPending ? 'toast_imagen_actualizada' : 'toast_imagen_eliminada'))
}

// ─── PRESUPUESTOS ──────────────────────────────────────────────
function renderPresupuestos() {
  // Ensure presupuestosV2 exists (migrate legacy)
  if (!S.presupuestosV2) S.presupuestosV2 = {}
  Object.keys(S.presupuestos).forEach(cat => {
    if (!S.presupuestosV2[cat]) S.presupuestosV2[cat] = { limite: S.presupuestos[cat], tipo: 'monthly' }
  })

  if (!window._presPeriod) window._presPeriod = 'month'
  const m = window._presPeriod === 'lastmonth' ? prevMonth(currentMonth()) : currentMonth()
  const yr = currentMonth().slice(0, 4)
  const quarterStart = (() => { const mo = parseInt(m.slice(5,7))-1; const qs = Math.floor(mo/3)*3; const d = new Date(); d.setFullYear(parseInt(yr), qs, 1); return d.toISOString().slice(0,7) })()

  const catMap = gastosMesByCat(m)
  const catMapYear = {}
  const catMapQ = {}
  ;(S.gastos||[]).forEach(g => {
    if (!g.fecha || !g.categoria) return
    if (g.fecha.startsWith(yr)) { catMapYear[g.categoria] = (catMapYear[g.categoria]||0) + (Number(g.importe)||0) }
    if (g.fecha >= quarterStart && g.fecha <= m+'-31') { catMapQ[g.categoria] = (catMapQ[g.categoria]||0) + (Number(g.importe)||0) }
  })

  const cats = Object.keys(S.presupuestosV2)
  const totalLimiteM = cats.reduce((a,c) => {
    const { limite, tipo } = S.presupuestosV2[c] || { limite: 0, tipo: 'monthly' }
    return a + (tipo==='annual' ? (Number(limite)||0)/12 : tipo==='quarterly' ? (Number(limite)||0)/3 : (Number(limite)||0))
  }, 0)
  const totalGastadoM = cats.reduce((a,c)=>a+(Number(catMap[c])||0),0)
  const enRojo = cats.filter(c => {
    const { limite, tipo } = S.presupuestosV2[c] || { limite: S.presupuestos[c], tipo: 'monthly' }
    const spent = tipo==='annual' ? (catMapYear[c]||0) : tipo==='quarterly' ? (catMapQ[c]||0) : (catMap[c]||0)
    return spent >= (Number(limite)||0)
  }).length

  const tipoLabel = { monthly: window._currentLang==='en'?'Monthly':'Mensual', quarterly: window._currentLang==='en'?'Quarterly':'Trimestral', annual: window._currentLang==='en'?'Annual':'Anual' }
  const tipoIcon = { monthly: '📅', quarterly: '📆', annual: '🗓️' }

  const items = cats.map(cat => {
    const { limite, tipo } = S.presupuestosV2[cat] || { limite: S.presupuestos[cat], tipo: 'monthly' }
    const limiteN = Number(limite)||0
    const gastado = tipo==='annual' ? (catMapYear[cat]||0) : tipo==='quarterly' ? (catMapQ[cat]||0) : (catMap[cat]||0)
    const pctVal = limiteN ? clamp((gastado/limiteN)*100,0,120) : 0
    const cls = pctVal>=100?'progress-danger':pctVal>=80?'progress-warn':'progress-ok'
    const badge = pctVal>=100
      ? '<span class="badge badge-red">⚠ Superado</span>'
      : pctVal>=80 ? '<span class="badge badge-gold">⚡ Alerta</span>'
      : '<span class="badge badge-green">✓ OK</span>'
    return `
    <div class="budget-item">
      <div class="budget-header">
        <div class="budget-cat">
          <span style="font-size:1rem">${catEmoji(cat)}</span> ${cat} ${badge}
          <span style="font-size:.68rem;color:var(--text2);margin-left:6px">${tipoIcon[tipo]||''} ${tipoLabel[tipo]||tipo}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="budget-nums">${eur(gastado)} / <strong>${eur(limiteN)}</strong></div>
          <button class="btn-del" style="padding:3px 8px;font-size:.7rem" onclick="borrarPresupuesto(this.dataset.cat)" data-cat="${cat}"></button>
        </div>
      </div>
      <div class="progress-wrap"><div class="progress-bar ${cls}" style="width:${Math.min(pctVal,100)}%"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:.75rem;color:var(--text2)">
        <span>Disponible: <strong style="color:var(--text)">${eur(Math.max(0,limiteN-gastado))}</strong></span>
        <span>${pct(pctVal)} usado</span>
      </div>
    </div>`
  }).join('') || (window.mnEmptyStates ? window.mnEmptyStates.presupuestos() : '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Aún no tienes presupuestos</div></div>')

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg> ${t('page_presupuestos','Presupuestos')}</div><div class="page-sub">${monthLabel(m)} · ${t('pres_page_sub','Control de límites por categoría')}</div></div>
    <div class="section-actions">
      <button class="btn btn-primary btn-sm" onclick="openModal('presupuestoModal');resetPresForm()">${t('btn_nuevo_presupuesto','+ Nuevo presupuesto')}</button>
    </div>
  </div>

  <div class="time-filter-bar">
    <span class="time-filter-label">${t('periodo','Período')}</span>
    <button class="time-pill ${window._presPeriod==='month'?'active':''}" onclick="window._presPeriod='month';renderPresupuestos()">${t('este_mes','Este mes')}</button>
    <button class="time-pill ${window._presPeriod==='lastmonth'?'active':''}" onclick="window._presPeriod='lastmonth';renderPresupuestos()">${t('mes_anterior','Mes anterior')}</button>
  </div>

  <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">💰</div>
      <div class="kpi-label">${t('pres_total_presupuestado','Total presupuestado')}</div>
      <div class="kpi-value">${eur(totalLimiteM)}<span style="font-size:.6em;color:var(--text2)">/mes</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--red-dim)">💳</div>
      <div class="kpi-label">${t('pres_total_gastado','Total gastado')}</div>
      <div class="kpi-value">${eur(totalGastadoM)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">✅</div>
      <div class="kpi-label">${t('pres_disponible','Disponible')}</div>
      <div class="kpi-value">${eur(Math.max(0,totalLimiteM-totalGastadoM))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--red-dim)">⚠️</div>
      <div class="kpi-label">${t('pres_en_rojo','Categorías en rojo')}</div>
      <div class="kpi-value" style="color:${enRojo?'var(--red)':'var(--green)'}">
        ${enRojo}</div>
    </div>
  </div>

  <div class="card">${items}</div>`

  if (window.MNPremiumFeatures) setTimeout(window.MNPremiumFeatures.enhanceBudgetCards, 80)
}

function exportarPresupuestos() {
  const m = currentMonth()
  const catMap = gastosMesByCat(m)
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Categoría','Límite (€)','Gastado (€)','Disponible (€)','% Usado','Estado']
    const rows = Object.keys(S.presupuestos).map(cat => {
      const limite = Number(S.presupuestos[cat])||0
      const gastado = Number(catMap[cat])||0
      const pctVal = limite ? Math.round(gastado/limite*100) : 0
      const estado = pctVal>=100?'Superado':pctVal>=80?'En alerta':'OK'
      return [cat, limite, gastado, Math.max(0,limite-gastado), pctVal+'%', estado]
    })
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuestos')
    XLSX.writeFile(wb, `MoneyNest_Presupuestos_${todayISO()}.xlsx`)
    toast(t('toast_presupuestos_exportados'))
  } catch(e) { toast(t('err_exportar','Error al exportar'),'error') }
}
function renderCuentas() {
  const totalSaldo = calcDineroDisponible()
  const totalValor = S.cuentas.reduce((a,c)=>a+(Number(c.valorTotal)||Number(c.saldo)||0),0)
  const tiposIcon = {banco:"🏦",efectivo:"💵",cripto:"₿",inversion:"📈",ahorro:"💰",otro:"📁"}

  const cards = S.cuentas.map(c=>{
    const saldo = Number(c.saldo)||0
    const valorTotal = Number(c.valorTotal)||saldo
    // Capital invertido: suma de inversiones abiertas originadas en esta cuenta
    // Solo cuenta inversiones que tienen cuentaId explícitamente asignado a esta cuenta
    const invertidoCuenta = S.inversiones
      .filter(i => !i.cerrada && i.cuentaId && i.cuentaId === c.id)
      .reduce((a, i) => a + (Number(i.importe) || 0), 0)
    // No usar valorTotal-saldo como fallback — eso confunde al usuario
    const comprometido = invertidoCuenta
    const gastosCuenta = S.gastos.filter(g=>g.cuentaId===c.id&&g.tipo!==TX_TYPES.GOAL_TRANSFER).length
    const ingresosCuenta = S.ingresos.filter(i=>i.cuentaId===c.id).length
    const invCuenta = S.inversiones.filter(i=>i.cuentaId===c.id&&!i.cerrada).length
    const totalGastado = S.gastos.filter(g=>g.cuentaId===c.id&&g.tipo!==TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
    const totalIngresado = S.ingresos.filter(i=>i.cuentaId===c.id).reduce((a,i)=>a+(Number(i.importe)||0),0)
    return `
    <div class="cuenta-card" onclick="verDetalleCuenta('${c.id}')" style="cursor:pointer" title="Ver movimientos de ${c.nombre}">
      <div class="cuenta-accent" style="background:${c.color||"#00D4AA"}"></div>
      <div class="cuenta-tipo">${tiposIcon[c.tipo]||"📁"} ${c.tipo||"banco"}</div>
      <div class="cuenta-name">${c.nombre||"—"}</div>
      ${c.notas ? `<div style="font-size:.72rem;color:var(--text3);margin-bottom:4px">${c.notas}</div>` : ""}
      <div class="cuenta-balance" style="color:${saldo>=0?"var(--accent)":"var(--red)"}">${eur(saldo)}</div>
      <div style="font-size:.72rem;color:var(--text2);margin-bottom:10px">💰 Disponible</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:var(--bg2);border-radius:6px;padding:7px 9px">
          <div style="font-size:.62rem;color:var(--text3);font-weight:700;text-transform:uppercase">Valor total</div>
          <div style="font-size:.88rem;font-weight:700;color:var(--text)">${eur(valorTotal)}</div>
        </div>
        <div style="background:var(--bg2);border-radius:6px;padding:7px 9px">
          <div style="font-size:.62rem;color:var(--text3);font-weight:700;text-transform:uppercase">${t('invertido','Invertido')}</div>
          <div style="font-size:.88rem;font-weight:700;color:${comprometido>0?'var(--indigo)':'var(--text3)'}">${eur(comprometido)}</div>
        </div>
        <div style="background:var(--bg2);border-radius:6px;padding:7px 9px">
          <div style="font-size:.62rem;color:var(--green);font-weight:700;text-transform:uppercase">📥 Total entradas</div>
          <div style="font-size:.82rem;font-weight:700;color:var(--green)">${eur(totalIngresado)}</div>
        </div>
        <div style="background:var(--bg2);border-radius:6px;padding:7px 9px">
          <div style="font-size:.62rem;color:var(--red);font-weight:700;text-transform:uppercase">📤 Total salidas</div>
          <div style="font-size:.82rem;font-weight:700;color:var(--red)">${eur(totalGastado)}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:.7rem;color:var(--text2);background:var(--border);padding:2px 7px;border-radius:99px">${ingresosCuenta} ingresos</span>
        <span style="font-size:.7rem;color:var(--text2);background:var(--border);padding:2px 7px;border-radius:99px">${gastosCuenta} gastos</span>
        ${invCuenta ? `<span style="font-size:.7rem;color:var(--accent);background:var(--accent-dim);padding:2px 7px;border-radius:99px">📈 ${invCuenta} inversiones</span>` : ""}
      </div>
      <div class="action-row">
        <button class="btn btn-ghost btn-xs" onclick="verDetalleCuenta('${c.id}')">📋 Ver movimientos</button>
        <button class="btn-edit" onclick="editarCuenta('${c.id}')"></button>
        <button class="btn-del" onclick="borrarCuenta('${c.id}')"></button>
      </div>
    </div>`
  }).join("") || (window.mnEmptyStates ? window.mnEmptyStates.cuentas() : "<div class=\"empty\"><div class=\"empty-icon\">🏦</div><div class=\"empty-title\">Sin cuentas</div></div>")

  document.getElementById("content").innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg> ${t('page_cuentas','Cuentas')}</div><div class="page-sub">${t('cuentas_page_sub','Dinero disponible y valor total por cuenta')}</div></div>
    <div class="section-actions">
      <button class="btn btn-secondary btn-sm" onclick="window.MNBankImport&&MNBankImport.open()" style="background:var(--accent-dim);border-color:rgba(0,212,170,.35);color:var(--accent)">🏦 ${t('btn_importar_datos_bancarios','Importar datos bancarios')}</button>
      <button class="btn btn-ghost btn-sm" onclick="openModal('transModal');poblarTransModal()">⇄ Transferir</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('cuentaModal');resetCuentaForm()">+ Nueva cuenta</button>
    </div>
  </div>
  <div class="kpi-grid kpi-grid-3" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">💰</div>
      <div class="kpi-label">${t('cuentas_disponible_total','Dinero disponible total')}</div>
      <div class="kpi-value">${eur(totalSaldo)}</div>
      <div class="kpi-sub">${t('cuentas_listo_usar','Listo para usar')} · ${S.cuentas.length} ${t('cuentas_lbl','cuentas')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">🏦</div>
      <div class="kpi-label">${t('cuentas_valor_total','Valor total cuentas')}</div>
      <div class="kpi-value">${eur(totalValor)}</div>
      <div class="kpi-sub">${t('cuentas_incluye_activos','Incluye activos e inversiones')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">🔒</div>
      <div class="kpi-label">${t('cuentas_invertido_lbl','Invertido')}</div>
      <div class="kpi-value sm" style="color:var(--gold)">${eur(totalValor-totalSaldo)}</div>
      <div class="kpi-sub">${t('cuentas_en_inversiones','En inversiones u otros activos')}</div>
    </div>
  </div>
  <div class="grid-3">${cards}</div>`
}

function resetCuentaForm() {
  document.getElementById("cuentaId").value = ""
  document.getElementById("cuentaModalTitle").textContent = t("modal_cuenta_titulo")
  document.getElementById("cuentaNombre").value = ""
  document.getElementById("cuentaTipo").value = "banco"
  document.getElementById("cuentaSaldo").value = ""
  const vt = document.getElementById("cuentaValorTotal")
  if (vt) vt.value = ""
  document.getElementById("cuentaColor").value = "#00D4AA"
  const n = document.getElementById("cuentaNotas"); if (n) n.value = ""
}
function editarCuenta(id) {
  const c = getCuenta(id)
  if (!c) return
  resetCuentaForm()
  document.getElementById("cuentaId").value = id
  document.getElementById("cuentaModalTitle").textContent = t("modal_cuenta_titulo_editar")
  document.getElementById("cuentaNombre").value = c.nombre||""
  document.getElementById("cuentaTipo").value = c.tipo||"banco"
  document.getElementById("cuentaSaldo").value = c.saldo||""
  const vt = document.getElementById("cuentaValorTotal")
  if (vt) vt.value = c.valorTotal !== undefined ? c.valorTotal : (c.saldo||"")
  document.getElementById("cuentaColor").value = c.color||"#00D4AA"
  const n = document.getElementById("cuentaNotas"); if (n) n.value = c.notas||""
  openModal("cuentaModal")
}
function guardarCuenta() {
  if (!_formGuard.lock('cuentaModal')) return
  const _unlock = () => _formGuard.unlock('cuentaModal')
  const nombre = document.getElementById("cuentaNombre").value.trim()
  if (!nombre) { toast(t('err_nombre_requerido'),'error'); _unlock(); return }
  const id = document.getElementById("cuentaId").value
  const saldo = parseAmount(document.getElementById("cuentaSaldo").value)||0
  const vtEl = document.getElementById("cuentaValorTotal")
  const valorTotal = vtEl && vtEl.value !== "" ? parseAmount(vtEl.value)||0 : saldo
  const nEl = document.getElementById("cuentaNotas")
  const data = {nombre, tipo:document.getElementById("cuentaTipo").value, saldo, valorTotal, color:document.getElementById("cuentaColor").value||"#00D4AA", notas: nEl ? nEl.value.trim() : ""}
  let newId = id
  if (id) {
    const idx = S.cuentas.findIndex(c=>c.id===id)
    if (idx>=0) S.cuentas[idx] = {...S.cuentas[idx],...data}
  } else {
    newId = uid()
    S.cuentas.push({id:newId,...data})
  }
  if (window.MNGamification) { MNGamification.checkAchievement('cuenta_added'); MNGamification.checkAchievement('data_check'); }
  save()
  if (!id) _resolveInlineCreate('cuenta', newId)
  closeModal("cuentaModal"); _unlock(); render(); toast(t('toast_cuenta_guardada'))
}
function borrarCuenta(id) {
  if (S.cuentas.length <= 1) { toast(t('toast_cuenta_min'),'error'); return }
  confirmar(t('confirm_eliminar_cuenta'), ()=>{
    S.cuentas = S.cuentas.filter(c=>c.id!==id)
    save(); render(); toast(t('toast_cuenta_eliminada'))
  }, {titulo:t('confirm_eliminar_cuenta_titulo'),icono:'🗑️'})
}

// ─── CONFIGURACION ─────────────────────────────────────────────
// ─── CATEGORIAS (seccion dedicada, accesible desde la navegacion) ──
// Reutiliza EXACTAMENTE el mismo sistema que Configuracion (misma
// fuente de verdad: S.categorias.gasto/ingreso, S.categoriaEmojis,
// catEmoji(), catColor(), removeCat(), _openCreateCategoryModal(), _buildEmojiPicker())
// — solo cambia la presentacion: aqui se muestran unicamente los 2
// grupos Gastos/Ingresos, con acceso directo sin pasar por Ajustes.
// ════════════════════════════════════════════════════════════════
// ── CENTRO DE REVISIÓN ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════════
// A transaction "needs review" if its explicit _needsReview flag is
// true (set by the bank importer when neither the user's own choice
// in the wizard nor the detection engine resolved a category — see
// bank-import.js _runImport()), or — for transactions created BEFORE
// that flag existed — if it fell into the generic 'Otro' fallback
// during a bank import specifically (the only historical source of
// that behavior). A category of 'Otro' picked anywhere else (the
// manual Gasto/Ingreso form, editing, Revisión itself) is always a
// deliberate user decision and never needs review.
function _txNeedsReview(tx) {
  if (tx._needsReview === true) return true
  if (tx._needsReview === false) return false
  return tx.origen === 'bank-import' && tx.categoria === 'Otro'
}
function _getReviewItems() {
  const gastos   = (S.gastos||[]).filter(_txNeedsReview).map(tx => ({ ...tx, _tipo: 'gasto' }))
  const ingresos = (S.ingresos||[]).filter(_txNeedsReview).map(tx => ({ ...tx, _tipo: 'ingreso' }))
  return [...gastos, ...ingresos].sort((a, b) => (b.fecha||'').localeCompare(a.fecha||''))
}
function _reviewCount() {
  return (S.gastos||[]).filter(_txNeedsReview).length + (S.ingresos||[]).filter(_txNeedsReview).length
}

const REVISION_PAGE_SIZE = 50 // reuse simple incremental rendering so hundreds/thousands of pending items never render at once
let _revisionRenderLimit = REVISION_PAGE_SIZE

function renderRevision() {
  const items = _getReviewItems()
  const visibleItems = items.slice(0, _revisionRenderLimit)
  const hasMore = items.length > _revisionRenderLimit

  const emptyHtml = `
    <div class="empty" style="padding:60px 20px;text-align:center">
      <div class="empty-icon">✅</div>
      <div class="empty-title">${t('revision_vacio_titulo','Todo revisado')}</div>
      <div class="empty-sub" style="color:var(--text2);margin-top:4px">${t('revision_vacio_sub','Perfecto. No tienes movimientos pendientes de revisar.')}</div>
    </div>`

  const _analisisTarget = (currentPage === 'analisis') ? document.getElementById('analisisTabContent') : document.getElementById('content')
  if (!_analisisTarget) return
  _analisisTarget.innerHTML = `
  <div class="section-header">
    <div>
      <div class="page-h1">🔔 ${t('revision_titulo','Revisión')}</div>
      <div class="page-sub">${items.length ? t('revision_sub','Estas transacciones necesitan tu atención.') : ''}</div>
    </div>
  </div>
  ${items.length ? `
    <div id="revisionList">${visibleItems.map(_revisionItemHtml).join('')}</div>
    ${hasMore ? `
      <div style="text-align:center;margin-top:16px">
        <button class="btn btn-ghost btn-sm" onclick="_revisionRenderLimit+=${REVISION_PAGE_SIZE};renderRevision()">
          ${t('cargar_mas','Cargar más')} (${items.length - _revisionRenderLimit} ${t('restantes','restantes')})
        </button>
      </div>` : ''}
  ` : emptyHtml}`
}

function _revisionItemHtml(tx) {
  const isIngreso = tx._tipo === 'ingreso'
  const cats = isIngreso ? (S.categorias.ingreso||[]) : (S.categorias.gasto||[])
  const signColor = isIngreso ? 'var(--green)' : 'var(--red)'
  const sign = isIngreso ? '+' : '−'
  const typeLabel = isIngreso ? `🟢 ${t('cat_type_ingreso','Ingreso')}` : `🔴 ${t('cat_type_gasto','Gasto')}`
  const domId = `${tx._tipo}-${tx.id}`
  return `
    <div class="card" id="revItem-${domId}" style="margin-bottom:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="min-width:0;flex:1">
          <div style="font-weight:700;font-size:.92rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tx.concepto||'—'}</div>
          <div style="font-size:.75rem;color:var(--text2);margin-top:2px">${typeLabel} · ${fmtDate(tx.fecha)}</div>
        </div>
        <div style="font-weight:800;font-size:1rem;color:${signColor};flex-shrink:0">${sign}${eur(tx.importe)}</div>
      </div>
      <div style="margin-top:10px">
        <label style="font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text3);display:block;margin-bottom:4px">${t('categoria_lbl','Categoría')}</label>
        <select id="revCat-${domId}" style="width:100%;padding:8px 10px;background:var(--bg2);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:.85rem" onchange="_categorizeFromRevision('${tx._tipo}','${tx.id}', this.value)">
          <option value="" selected>${t('sin_categoria','Sin categoría')}</option>
          ${cats.map(c => `<option value="${c.replace(/"/g,'&quot;')}">${catEmoji(c)} ${tCat(c)}</option>`).join('')}
          <option value="__new__">➕ ${t('bi_nueva_categoria','Nueva categoría...')}</option>
        </select>
      </div>
      <div class="form-check" style="margin-top:8px">
        <input type="checkbox" id="revRemember-${domId}" checked>
        <label for="revRemember-${domId}" style="font-size:.75rem;color:var(--text2)">${t('revision_recordar','Recordar esta decisión')}</label>
      </div>
    </div>`
}

// Opening "+ Nueva categoría..." from a select briefly leaves it on
// that sentinel value — revert it visually while the shared category
// modal is open, exactly like every other "+ Categoría personalizada"
// entry point in the app.
function _categorizeFromRevision(tipo, id, categoria) {
  const sel = document.getElementById(`revCat-${tipo}-${id}`)
  if (categoria === '__new__') {
    if (sel) sel.value = ''
    _openCreateCategoryModal(tipo, (nombre) => { _applyRevisionCategory(tipo, id, nombre) })
    return
  }
  if (!categoria) return
  _applyRevisionCategory(tipo, id, categoria)
}

function _applyRevisionCategory(tipo, id, categoria) {
  const list = tipo === 'ingreso' ? S.ingresos : S.gastos
  const tx = list.find(x => x.id === id)
  if (!tx) return
  tx.categoria = categoria
  tx._needsReview = false

  // Learning: reuse the bank importer's existing merchant→category map
  // instead of a second, disconnected mechanism — only when the user
  // opts in and there's a normalized merchant to safely associate the
  // decision with.
  const rememberEl = document.getElementById(`revRemember-${tipo}-${id}`)
  if (rememberEl && rememberEl.checked && tx.merchant && window.MNBankImport && MNBankImport.loadMerchantMap) {
    try {
      const map = MNBankImport.loadMerchantMap(tipo)
      map[tx.merchant] = categoria
      MNBankImport.saveMerchantMap(map, tipo)
    } catch (e) { /* learning is a best-effort convenience, never block categorization */ }
  }

  save()
  // Remove just this item from the DOM — no full reload, no losing the
  // scroll position/state of the rest of the review list.
  const el = document.getElementById(`revItem-${tipo}-${id}`)
  if (el) el.remove()
  _updateRevisionBadges()
  toast(t('toast_categorizado','Categorizado ✓'))
  if (!_getReviewItems().length) renderRevision() // show the empty state once nothing is left
}

// Keeps the Dashboard/sidebar "needs attention" badge in sync without
// a full render() — called after each inline categorization so the
// counter is always accurate immediately, per the task's requirement.
function _updateRevisionBadges() {
  const count = _reviewCount()
  document.querySelectorAll('[data-revision-count]').forEach(el => {
    el.textContent = count
    const wrap = el.closest('[data-revision-badge]')
    if (wrap) wrap.style.display = count > 0 ? '' : 'none'
  })
}

// ════════════════════════════════════════════════════════════════
// ── CALENDARIO FINANCIERO ───────────────────────────────────────
// ════════════════════════════════════════════════════════════════
// Financial events are planned items that are NEVER auto-converted
// into real transactions — a completely separate, lightweight model
// from MNRecurring (which does create real transactions each month).
// They exist purely as a visual planning layer on top of the
// calendar; S.ingresos/S.gastos remain the only source of truth for
// anything that already happened.
const EVENT_TYPES = {
  pago:                 { icon: '💳' },
  prestamo:             { icon: '🏦' },
  seguro:               { icon: '🛡️' },
  suscripcion:          { icon: '📱' },
  alquiler:             { icon: '🏠' },
  aportacion_objetivo:  { icon: '🎯' },
  ingreso_previsto:     { icon: '💰' },
  personalizado:        { icon: '📌' },
}
function _eventTypeLabel(tipo) {
  const fallback = { pago:'Pago', prestamo:'Préstamo', seguro:'Seguro', suscripcion:'Suscripción', alquiler:'Alquiler', aportacion_objetivo:'Aportación a objetivo', ingreso_previsto:'Ingreso previsto', personalizado:'Evento personalizado' }
  return t('event_type_'+tipo, fallback[tipo] || tipo)
}
function _isEventIncome(evento) { return evento.tipo === 'ingreso_previsto' }

function _dISO(d) { return d.toISOString().slice(0,10) } // same UTC-based pattern already used by todayISO() throughout the app

// Returns every ISO date within the given month (0-indexed) where this
// event occurs, according to its recurrence. A monthly/yearly event
// whose day doesn't exist in a given month (e.g. day 31 in February)
// falls back to that month's last day instead of being silently
// skipped.
function _eventOccurrencesInMonth(evento, year, month) {
  const start = new Date(evento.fecha + 'T00:00:00')
  if (isNaN(start)) return []
  const monthStart = new Date(year, month, 1)
  const monthEnd   = new Date(year, month + 1, 0)
  if (start > monthEnd) return []
  const rec = evento.recurrencia || 'none'

  if (rec === 'none') {
    return (start >= monthStart && start <= monthEnd) ? [evento.fecha] : []
  }
  if (rec === 'monthly') {
    const day = Math.min(start.getDate(), monthEnd.getDate())
    const occ = new Date(year, month, day)
    return (occ >= start) ? [_dISO(occ)] : []
  }
  if (rec === 'yearly') {
    if (month !== start.getMonth()) return []
    const daysInThisMonth = new Date(year, month + 1, 0).getDate()
    const occ = new Date(year, month, Math.min(start.getDate(), daysInThisMonth))
    return (occ >= start) ? [_dISO(occ)] : []
  }
  if (rec === 'weekly') {
    const results = []
    let cursor = new Date(start)
    while (cursor <= monthEnd) {
      if (cursor >= monthStart) results.push(_dISO(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
    return results
  }
  if (rec === 'daily') {
    const results = []
    let cursor = new Date(Math.max(start.getTime(), monthStart.getTime()))
    while (cursor <= monthEnd) {
      results.push(_dISO(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return results
  }
  return []
}

// Indexes every event's occurrences for a whole month in one pass
// (dateISO -> [events]), instead of recomputing per-day when rendering
// every cell of the calendar grid.
function _monthEventsIndex(year, month) {
  const idx = {}
  ;(S.eventosFinancieros||[]).forEach(ev => {
    _eventOccurrencesInMonth(ev, year, month).forEach(dateISO => {
      (idx[dateISO] = idx[dateISO] || []).push(ev)
    })
  })
  return idx
}

// Real daily activity — reuses S.ingresos/S.gastos directly, never a
// duplicated total. Pending income and internal goal transfers are
// excluded, consistent with how the rest of the app treats them.
function _dailyRealData(dateISO) {
  const ingresos = (S.ingresos||[]).filter(i => i.fecha === dateISO && i.status !== 'pending' && i.status !== 'pendiente')
  const gastos   = (S.gastos||[]).filter(g => g.fecha === dateISO && g.tipo !== TX_TYPES.GOAL_TRANSFER)
  const totalIngresos = ingresos.reduce((a,i)=>a+(Number(i.importe)||0),0)
  const totalGastos   = gastos.reduce((a,g)=>a+(Number(g.importe)||0),0)
  return { ingresos, gastos, totalIngresos, totalGastos, balance: totalIngresos - totalGastos }
}

let _calYear  = new Date().getFullYear()
let _calMonth = new Date().getMonth() // 0-indexed

function renderCalendario() {
  const monthEventsIdx = _monthEventsIndex(_calYear, _calMonth)
  const firstOfMonth = new Date(_calYear, _calMonth, 1)
  const daysInMonth  = new Date(_calYear, _calMonth + 1, 0).getDate()
  const startWeekday = (firstOfMonth.getDay() + 6) % 7 // Monday=0 ... Sunday=6
  const todayIso = todayISO()

  const locale = {'es':'es-ES','en':'en-GB','it':'it-IT','fr':'fr-FR','de':'de-DE','pt':'pt-PT'}[_currentLang]||'es-ES'
  const monthLabel = firstOfMonth.toLocaleDateString(locale, { month:'long', year:'numeric' })
  const weekdayLabels = [0,1,2,3,4,5,6].map(i => {
    const d = new Date(2024, 0, 1 + i) // a known Monday
    return d.toLocaleDateString(locale, { weekday:'short' }).slice(0,3)
  })

  let cellsHtml = ''
  for (let i=0;i<startWeekday;i++) cellsHtml += `<div class="cal-cell cal-cell--empty"></div>`
  for (let d=1; d<=daysInMonth; d++) {
    const dateISO = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const real = _dailyRealData(dateISO)
    const events = monthEventsIdx[dateISO] || []
    const hasActivity = real.ingresos.length > 0 || real.gastos.length > 0
    const isToday = dateISO === todayIso

    let balanceHtml = ''
    if (hasActivity) {
      const dot = real.balance > 0 ? '🟢' : (real.balance < 0 ? '🔴' : '⚪')
      const color = real.balance > 0 ? 'var(--green)' : (real.balance < 0 ? 'var(--red)' : 'var(--text2)')
      balanceHtml = `<div class="cal-cell-balance" style="color:${color}">${dot} ${real.balance>=0?'+':''}${eur(real.balance)}</div>`
    }
    const eventsHtml = events.length
      ? `<div class="cal-cell-events">🔵 ${events.length} ${events.length===1?t('cal_evento_sg','evento'):t('cal_evento_pl','eventos')}</div>`
      : ''

    cellsHtml += `<div class="cal-cell ${isToday?'cal-cell--today':''}" onclick="_openDayDetail('${dateISO}')">
      <div class="cal-cell-day">${d}</div>
      ${balanceHtml}
      ${eventsHtml}
    </div>`
  }

  const _analisisTarget = (currentPage === 'analisis') ? document.getElementById('analisisTabContent') : document.getElementById('content')
  if (!_analisisTarget) return
  _analisisTarget.innerHTML = `
  <div class="section-header">
    <div>
      <div class="page-h1">📅 ${t('calendario_titulo','Calendario')}</div>
      <div class="page-sub">${t('calendario_sub','Tu actividad financiera día a día')}</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="_openEventModal()">➕ ${t('anadir_evento','Añadir evento financiero')}</button>
  </div>
  <div class="card" style="padding:14px 16px 18px">
    <div class="cal-nav">
      <button class="btn btn-ghost btn-sm" onclick="_calNavigate(-1)" aria-label="${t('mes_anterior','Mes anterior')}">←</button>
      <div class="cal-nav-center">
        <div class="cal-nav-label">${monthLabel}</div>
        <button class="btn btn-ghost btn-xs" onclick="_calGoToday()">${t('hoy','Hoy')}</button>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="_calNavigate(1)" aria-label="${t('mes_siguiente','Mes siguiente')}">→</button>
    </div>
    <div class="cal-grid cal-grid-header">
      ${weekdayLabels.map(w=>`<div class="cal-weekday">${w}</div>`).join('')}
    </div>
    <div class="cal-grid">${cellsHtml}</div>
  </div>`
}

function _calNavigate(delta) {
  _calMonth += delta
  if (_calMonth < 0)  { _calMonth = 11; _calYear-- }
  if (_calMonth > 11) { _calMonth = 0;  _calYear++ }
  renderCalendario()
}
function _calGoToday() {
  const now = new Date()
  _calYear = now.getFullYear()
  _calMonth = now.getMonth()
  renderCalendario()
}

// ── Day detail modal ─────────────────────────────────────────────
function _openDayDetail(dateISO) {
  document.getElementById('calDayDetailOverlay')?.remove()
  const real = _dailyRealData(dateISO)
  const [y, m] = dateISO.split('-').map(Number)
  const events = (_monthEventsIndex(y, m - 1)[dateISO]) || []
  const locale = {'es':'es-ES','en':'en-GB','it':'it-IT','fr':'fr-FR','de':'de-DE','pt':'pt-PT'}[_currentLang]||'es-ES'
  const dateLabel = new Date(dateISO + 'T12:00:00').toLocaleDateString(locale, { day:'numeric', month:'long' })
  const hasAnything = real.ingresos.length || real.gastos.length || events.length

  const rowHtml = (label, amountStr, color, extra='') => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${label}</span>
      <span style="flex-shrink:0;font-weight:700;color:${color}">${amountStr}${extra}</span>
    </div>`

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'calDayDetailOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">📅 ${dateLabel}</span>
        <button class="modal-close" onclick="_closeDayDetail()">✕</button>
      </div>
      <div class="modal-body">
        ${real.ingresos.length ? `
          <div class="cal-section-label" style="color:var(--green)">${t('ingresos_lbl','Ingresos')}</div>
          ${real.ingresos.map(i => rowHtml(`${catEmoji(i.categoria)} ${i.concepto||'—'}`, `+${eur(i.importe)}`, 'var(--green)')).join('')}
        ` : ''}
        ${real.gastos.length ? `
          <div class="cal-section-label" style="color:var(--red);margin-top:${real.ingresos.length?'14px':'0'}">${t('gastos_lbl','Gastos')}</div>
          ${real.gastos.map(g => rowHtml(`${catEmoji(g.categoria)} ${g.concepto||'—'}`, `−${eur(g.importe)}`, 'var(--red)')).join('')}
        ` : ''}
        ${events.length ? `
          <div class="cal-section-label" style="color:var(--blue,#4A9EFF);margin-top:${(real.ingresos.length||real.gastos.length)?'14px':'0'}">🔵 ${t('eventos_previstos','Eventos previstos')}</div>
          ${events.map(ev => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${EVENT_TYPES[ev.tipo]?.icon||'📌'} ${ev.titulo} <span style="color:var(--text3);font-size:.72rem">· ${t('previsto','previsto')}</span></span>
              <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                <span style="font-weight:700;color:var(--blue,#4A9EFF)">${_isEventIncome(ev)?'+':'−'}${eur(ev.importe)}</span>
                <button class="btn btn-ghost btn-xs" onclick="_closeDayDetail();_openEventModal('${ev.id}')" title="${t('btn_editar','Editar')}">✏️</button>
              </div>
            </div>`).join('')}
        ` : ''}
        ${!hasAnything ? `<div style="text-align:center;padding:30px 10px;color:var(--text2);font-size:.88rem">${t('sin_actividad_dia','Sin actividad este día')}</div>` : ''}
        ${(real.ingresos.length || real.gastos.length) ? `
          <div style="margin-top:16px;padding-top:14px;border-top:2px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:800;color:var(--text)">${t('balance_dia','Balance del día')}</span>
            <span style="font-weight:800;font-size:1.1rem;color:${real.balance>=0?'var(--green)':'var(--red)'}">${real.balance>=0?'+':''}${eur(real.balance)}</span>
          </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="_closeDayDetail()">${t('cerrar','Cerrar')}</button>
        <button class="btn btn-primary btn-sm" onclick="_closeDayDetail();_openEventModal(null,'${dateISO}')">➕ ${t('anadir_evento','Añadir evento')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeDayDetail() })
  setTimeout(() => overlay.classList.add('open'), 10)
}
function _closeDayDetail() { document.getElementById('calDayDetailOverlay')?.remove() }

// ── Create/edit event modal ──────────────────────────────────────
function _openEventModal(eventId, defaultDate) {
  document.getElementById('eventModalOverlay')?.remove()
  const ev = eventId ? (S.eventosFinancieros||[]).find(e => e.id === eventId) : null
  const esc = (s) => (s||'').replace(/"/g,'&quot;')

  const recOptions = [
    ['none', t('rec_none','No se repite')], ['daily', t('rec_daily','Diaria')],
    ['weekly', t('rec_weekly','Semanal')], ['monthly', t('rec_monthly','Mensual')],
    ['yearly', t('rec_yearly','Anual')],
  ]

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay mn-modal-inline-top'
  overlay.id = 'eventModalOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="max-width:420px">
      <div class="modal-header">
        <span class="modal-title">📅 ${ev ? t('editar_evento','Editar evento') : t('nuevo_evento','Nuevo evento financiero')}</span>
        <button class="modal-close" onclick="_closeEventModal()">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="eventId" value="${ev ? ev.id : ''}">
        <div class="form-group">
          <label>${t('titulo_lbl','Título')} *</label>
          <input type="text" id="eventTitulo" value="${ev?esc(ev.titulo):''}" placeholder="${t('ph_evento_titulo','Alquiler, Netflix...')}">
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label>${t('importe_lbl','Importe (€)')} *</label>
            <input type="text" inputmode="decimal" id="eventImporte" value="${ev?ev.importe:''}" min="0" step="0.01" placeholder="0.00" oninput="_sanitizeAmountInput(this)">
          </div>
          <div class="form-group">
            <label>${t('fecha_lbl','Fecha')} *</label>
            <input type="date" id="eventFecha" value="${ev?ev.fecha:(defaultDate||todayISO())}">
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label>${t('tipo_lbl','Tipo')}</label>
            <select id="eventTipo">
              ${Object.keys(EVENT_TYPES).map(k => `<option value="${k}" ${ev&&ev.tipo===k?'selected':''}>${EVENT_TYPES[k].icon} ${_eventTypeLabel(k)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>${t('recurrencia_lbl','Repetición')}</label>
            <select id="eventRecurrencia">
              ${recOptions.map(([k,label]) => `<option value="${k}" ${ev&&ev.recurrencia===k?'selected':(!ev&&k==='none'?'selected':'')}>${label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>${t('descripcion_lbl','Descripción')} <span style="color:var(--text3);font-weight:400">(${t('opcional','opcional')})</span></label>
          <input type="text" id="eventDescripcion" value="${ev?esc(ev.descripcion):''}">
        </div>
      </div>
      <div class="modal-footer">
        ${ev ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);margin-right:auto" onclick="_deleteEvent('${ev.id}')">🗑️ ${t('eliminar','Eliminar')}</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="_closeEventModal()">${t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="_saveEvent()">${t('btn_guardar','Guardar')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeEventModal() })
  setTimeout(() => overlay.classList.add('open'), 10)
  setTimeout(() => document.getElementById('eventTitulo')?.focus(), 60)
}
function _closeEventModal() { document.getElementById('eventModalOverlay')?.remove() }

function _saveEvent() {
  const titulo   = document.getElementById('eventTitulo').value.trim()
  const importe  = parseAmount(document.getElementById('eventImporte').value)
  const fecha    = document.getElementById('eventFecha').value
  if (!titulo || !importe || importe <= 0 || !fecha) { toast(t('err_evento_campos','Completa título, importe y fecha'),'error'); return }
  const tipo         = document.getElementById('eventTipo').value
  const recurrencia  = document.getElementById('eventRecurrencia').value
  const descripcion  = document.getElementById('eventDescripcion').value.trim()
  const id = document.getElementById('eventId').value

  S.eventosFinancieros = S.eventosFinancieros || []
  if (id) {
    const idx = S.eventosFinancieros.findIndex(e => e.id === id)
    if (idx >= 0) S.eventosFinancieros[idx] = { ...S.eventosFinancieros[idx], titulo, importe, fecha, tipo, recurrencia, descripcion }
  } else {
    S.eventosFinancieros.push({ id: uid(), titulo, importe, fecha, tipo, recurrencia, descripcion })
  }
  save()
  _closeEventModal()
  if (currentPage === 'calendario') renderCalendario()
  toast(t('toast_evento_guardado','Evento guardado ✓'))
}

function _deleteEvent(id) {
  // Close the event edit modal first — it uses a higher z-index than
  // the generic confirm modal, so leaving both open would visually
  // bury the confirmation behind it and make it unreachable.
  _closeEventModal()
  confirmar(t('confirm_eliminar_evento','¿Eliminar este evento financiero? Esto no afecta a ninguna transacción real.'), () => {
    S.eventosFinancieros = (S.eventosFinancieros||[]).filter(e => e.id !== id)
    save()
    _closeDayDetail()
    if (currentPage === 'calendario') renderCalendario()
    toast(t('toast_evento_eliminado','Evento eliminado'))
  }, { titulo: t('confirm_eliminar_evento_titulo','Eliminar evento'), icono: '🗑️' })
}

// ════════════════════════════════════════════════════════════════
// ── PATRIMONIO: COMPARACIÓN Y EXPLICACIÓN POR PERIODO ───────────
// ════════════════════════════════════════════════════════════════
// Reconstructs cartera/activos/deuda for a past month using each
// model's OWN reliable date fields (investment open/close dates, asset
// purchase/sale dates, each individual debt payment's date) — never a
// generic approximation. Liquidez is intentionally excluded here: the
// caller derives it as the residual needed to make the breakdown
// reconcile exactly with the REAL total change already recorded in
// S.patrimonio_hist (the same source of truth used by the existing
// evolution chart), so small historical-reconstruction gaps never
// produce a mathematically contradictory total.
function _calcComponentesNoLiquidos(monthStr) {
  if (monthStr >= currentMonth()) {
    return { cartera: calcCartera(), activos: calcAssetsValue(), deuda: calcTotalDeuda() }
  }
  const cartera = (S.inversiones||[]).reduce((sum, inv) => {
    if (!inv.fecha || inv.fecha.slice(0,7) > monthStr) return sum // not opened yet
    if (inv.cerrada && inv.fechaCierre && inv.fechaCierre.slice(0,7) <= monthStr) return sum // already closed
    return sum + (Number(inv.importe)||0)
  }, 0)
  const activos = (S.assets||[]).reduce((sum, a) => {
    if (!a.fecha || a.fecha.slice(0,7) > monthStr) return sum // not bought yet
    if (a.status === 'sold' && a.fechaVenta && a.fechaVenta.slice(0,7) <= monthStr) return sum // already sold
    let val = Number(a.valor)||0
    if (a.depreciacion && a.depPct && a.fecha) {
      const years = (new Date(monthStr+'-15').getTime() - new Date(a.fecha).getTime()) / (1000*60*60*24*365.25)
      val = val * Math.pow(1 - (Number(a.depPct)||0)/100, Math.max(0,years))
    }
    return sum + val
  }, 0)
  // Debts have no reliable creation date, so importeTotal is assumed to
  // have existed in full from the start; only the payments (which DO
  // have a reliable date each) are undone going backward in time.
  const deuda = (S.deudas||[]).reduce((sum, d) => {
    const pagadoHastaEntonces = (d.pagos||[]).filter(p => p.fecha && p.fecha.slice(0,7) <= monthStr).reduce((a,p)=>a+(Number(p.importe)||0),0)
    return sum + Math.max(0, (Number(d.importeTotal)||0) - pagadoHastaEntonces)
  }, 0)
  return { cartera, activos, deuda }
}

// Net worth TOTAL at/around a given month — S.patrimonio_hist (the
// same infrastructure the existing evolution chart already uses)
// stays the single source of truth, falling back to
// calcPatrimonioHistoricoMes() on the fly for a month not recorded yet.
function _patrimonioAt(monthStr) {
  const rec = S.patrimonio_hist.find(h => h.mes === monthStr)
  if (rec) return rec.valor
  return calcPatrimonioHistoricoMes(monthStr)
}

const NW_RANGE_MONTHS = { '1M':1, '3M':3, '6M':6, '1A':12 }
function _monthsAgoStr(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0,7)
}

// Full comparison payload for one range key ('1M'|'3M'|'6M'|'1A'|'TODO'):
// current/starting values, absolute + percentage change, and a
// component breakdown that ALWAYS reconciles exactly with that change.
function _buildNetWorthComparison(rangeKey) {
  const current = calcPatrimonio()
  const currentM = currentMonth()
  const hasAnyHistory = S.patrimonio_hist.length > 0

  let startMonth
  if (rangeKey === 'TODO') {
    startMonth = hasAnyHistory ? S.patrimonio_hist[0].mes : currentM
  } else {
    startMonth = _monthsAgoStr(NW_RANGE_MONTHS[rangeKey] || 1)
  }
  // Reliable comparison requires either a recorded point at/before the
  // start month, or the start month being the current one (no history
  // needed to compare "now" against "now").
  const hasHistory = startMonth === currentM || S.patrimonio_hist.some(h => h.mes <= startMonth) || rangeKey === 'TODO' && hasAnyHistory

  const startValue = hasHistory ? _patrimonioAt(startMonth) : current
  const change = current - startValue
  const pct = startValue !== 0 ? (change / Math.abs(startValue)) * 100 : null

  const compNow   = { cartera: calcCartera(), activos: calcAssetsValue(), deuda: calcTotalDeuda() }
  const compStart = hasHistory ? _calcComponentesNoLiquidos(startMonth) : compNow
  const deltaCartera  = compNow.cartera - compStart.cartera
  const deltaActivos  = compNow.activos - compStart.activos
  const deltaDeuda    = -(compNow.deuda - compStart.deuda) // rising debt subtracts from net worth
  const deltaLiquidez = change - deltaCartera - deltaActivos - deltaDeuda // residual: guarantees exact reconciliation

  const components = [
    { key:'cartera',  label:t('nw_comp_inversiones','Inversiones'),      icon:'📈', value: deltaCartera },
    { key:'liquidez', label:t('nw_comp_efectivo','Efectivo / ahorro'),   icon:'💰', value: deltaLiquidez },
    { key:'activos',  label:t('nw_comp_activos','Activos'),              icon:'🏠', value: deltaActivos },
    { key:'deuda',    label:t('nw_comp_deudas','Deudas'),                icon:'💳', value: deltaDeuda },
  ].filter(c => Math.abs(c.value) >= 0.005) // nothing reliable to explain for a ~0 contribution

  return { current, startValue, startMonth, change, pct, hasHistory, components }
}

// Deterministic highlights — no AI/external calls, just picking the
// largest positive and largest negative contributor from the same
// reconciled breakdown.
function _netWorthHighlights(components) {
  const highlights = []
  const positives = components.filter(c => c.value > 0).sort((a,b) => b.value - a.value)
  const negatives = components.filter(c => c.value < 0).sort((a,b) => a.value - b.value)
  if (positives.length) highlights.push(`${positives[0].icon} ${t('nw_mayor_crecimiento','Mayor crecimiento')}: ${positives[0].label}`)
  if (negatives.length) highlights.push(`${negatives[0].icon} ${t('nw_mayor_impacto_neg','Mayor impacto negativo')}: ${negatives[0].label}`)
  return highlights
}

function renderCategorias() {
  const groups = [
    { key:'gasto',     label:t('cat_type_gasto','Gastos'),      icon:'💳' },
    { key:'ingreso',   label:t('cat_type_ingreso','Ingresos'),   icon:'💰' },
    { key:'inversion', label:t('cat_type_inversion','Inversiones'), icon:'📈' },
    { key:'deuda',     label:t('cat_type_deuda','Deudas'),       icon:'📉' },
    { key:'objetivo',  label:t('cat_type_objetivo','Objetivos'), icon:'🎯' },
  ]
  const sections = groups.map(g => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">${g.icon} ${g.label}</div>
        <button class="btn btn-ghost btn-sm" onclick="_openCreateCategoryModal('${g.key}', (nombre)=>{render()}, {allowMultiple:true})" title="${t('crear_categoria','Crear categoría')}">+</button>
      </div>
      <div class="cat-pills" id="pills-${g.key}">
        ${(S.categorias[g.key]||[]).map(c=>{
          const cc = catColor(c)
          const dot = cc ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cc};margin-right:4px;flex-shrink:0"></span>` : ''
          return `<span class="cat-pill" style="${cc?`border-color:${cc}44;background:${cc}12`:''}">
            <span onclick="_openEditCategoryModal('${g.key}','${c.replace(/'/g,"\\'")}')" style="cursor:pointer" title="${t('editar_cat_tip','Editar')}">${dot}${catEmoji(c)} ${tCat(c)}</span>
            <input type="color" title="Color" value="${cc||'#00D4AA'}"
              style="width:14px;height:14px;border:none;background:none;cursor:pointer;padding:0;margin:0 2px;border-radius:50%;opacity:.6;vertical-align:middle"
              onchange="S.catColors=S.catColors||{};S.catColors['${c.replace(/'/g,"\\'")}']= this.value;save();render()">
            <span class="remove" data-key="${g.key}" data-cat="${c.replace(/"/g,'&quot;')}" onclick="removeCatEl(this)">✕</span>
          </span>`
        }).join('')}
      </div>
    </div>`).join('')

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg> ${t('nav_categorias','Categorías')}</div><div class="page-sub">${t('cat_page_sub','Organiza tus gastos e ingresos')}</div></div>
    <button class="btn btn-primary btn-sm" onclick="_openCreateCategoryModal('gasto', (nombre)=>{render()}, {allowMultiple:true})">🏷️ ${t('crear_categoria','Crear categoría')}</button>
  </div>
  ${sections}
  `
}

function renderConfiguracion() {
  const isDark = S.theme !== 'light'

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> ${t('page_configuracion')}</div><div class="page-sub">${t('cfg_personaliza_sub')} · v${VERSION}</div></div>
  </div>

  <div class="grid-2">
    <!-- Columna izquierda -->
    <div style="display:flex;flex-direction:column;gap:20px">

      <!-- Perfil -->
      <div class="card">
        <div class="card-header"><div class="card-title">👤 ${t('cfg_perfil')}</div></div>
        <div class="form-group" style="margin-bottom:12px">
          <label>${t('cfg_nombre')}</label>
          <input type="text" id="cfgNombre" value="${S.usuario.nombre||''}" placeholder="${t('cfg_nombre')}">
        </div>
        <button class="btn btn-primary btn-sm" onclick="guardarPerfil()">${t('cfg_guardar')}</button>
      </div>

      </div>


      <!-- Idioma -->
      <div class="card">
        <div class="card-header"><div class="card-title">🌐 ${t('cfg_idioma')}</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">
          ${[['es','🇪🇸','Español'],['en','🇬🇧','English']].map(([code,flag,name])=>`
            <div onclick="setLang('${code}');renderConfiguracion()" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-sm);background:var(--bg2);border:1.5px solid ${_currentLang===code?'var(--accent)':'var(--border)'};cursor:pointer;transition:all .15s;${_currentLang===code?'background:var(--accent-dim)':''}">
              <span style="font-size:1.1rem">${flag}</span>
              <span style="font-size:.82rem;font-weight:600;color:${_currentLang===code?'var(--accent)':'var(--text2)'}">${name}</span>
              ${_currentLang===code?'<span style="margin-left:auto;font-size:.68rem;color:var(--accent)">✓</span>':''}
            </div>`).join('')}
        </div>
      </div>

      <!-- Apariencia -->
      <div class="card">
        <div class="card-header"><div class="card-title">🎨 ${t('cfg_apariencia')}</div></div>
        <div style="display:flex;gap:12px;margin-bottom:8px">
          <div onclick="cfgSetTheme('dark')" style="flex:1;padding:16px 12px;border-radius:var(--radius-sm);background:#0F1420;border:2px solid ${isDark?'var(--accent)':'rgba(255,255,255,0.08)'};cursor:pointer;text-align:center;transition:all .15s">
            <div style="font-size:1.4rem">🌙</div>
            <div style="font-size:.8rem;color:#94A3B8;margin-top:6px;font-weight:700">${t('cfg_oscuro')}</div>
            ${isDark?`<div style="font-size:.68rem;color:var(--accent);margin-top:2px">${t('cfg_activo')}</div>`:''}
          </div>
          <div onclick="cfgSetTheme('light')" style="flex:1;padding:16px 12px;border-radius:var(--radius-sm);background:#F8FAFC;border:2px solid ${!isDark?'var(--accent)':'#E2E8F0'};cursor:pointer;text-align:center;transition:all .15s">
            <div style="font-size:1.4rem">☀️</div>
            <div style="font-size:.8rem;color:#475569;margin-top:6px;font-weight:700">${t('cfg_claro')}</div>
            ${!isDark?`<div style="font-size:.68rem;color:var(--accent);margin-top:2px">${t('cfg_activo')}</div>`:''}
          </div>
        </div>
        <div style="font-size:.75rem;color:var(--text3)">${t('cfg_apariencia_tip')}</div>
      </div>

      <!-- Datos -->
      <div class="card">
        <div class="card-header"><div class="card-title">📦 ${t('cfg_datos')}</div><div class="card-subtitle">MoneyNest v${VERSION}</div></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="openDmPanel('dm-export-panel')">${t('cfg_exportar_pdf')}</button>
          <button class="btn btn-secondary btn-sm" onclick="dmExportMoneynest()">${t('cfg_backup_json')}</button>
          <button class="btn btn-secondary btn-sm" id="driveBackupBtn" onclick="exportarADrive()" style="background:var(--indigo-dim);border-color:var(--indigo-dim);color:var(--indigo)">
            ${t('cfg_drive')}
            <span id="driveBackupStatus" style="font-size:.7rem;margin-left:6px;opacity:.8"></span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openDmPanel('dm-import-panel')" style="cursor:pointer;justify-content:flex-start">
            ${t('cfg_importar')}
          </button>
          <hr style="border:none;border-top:1px solid var(--border);margin:4px 0">
          <button class="btn btn-danger btn-sm" onclick="borrarTodo()">${t('cfg_borrar_todo')}</button>
        </div>
      </div>

      <!-- Modo uso: personal / pareja (próximamente v2) -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">👥 Modo de uso</div>
            <div class="card-subtitle">Personal · Pareja · Familia</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--bg2);border-radius:12px;border:1px dashed var(--border2)">
          <span style="font-size:1.8rem;flex-shrink:0">🚧</span>
          <div>
            <div style="font-size:.88rem;font-weight:700;color:var(--text)">Próximamente en la v2</div>
            <div style="font-size:.78rem;color:var(--text2);margin-top:3px;line-height:1.5">
              Compartir presupuesto con tu pareja o familia, con sincronización en la nube, llegará en una próxima actualización.
            </div>
          </div>
        </div>
      </div>

      <!-- Instalar app -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📲 ${t('install_cfg_titulo','Instalar app')}</div>
            <div class="card-subtitle">${t('install_cfg_sub','Acceso rápido · offline · sin navegador')}</div>
          </div>
        </div>
        ${window.MNInstall ? window.MNInstall.renderInstallCard() : ''}
      </div>

      <!-- Demo Mode -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🔍 ${t('cfg_demo_titulo','Modo demo')}</div>
            <div class="card-subtitle">${isDemoMode()
              ? `<span style="color:var(--gold);font-weight:700">${t('cfg_demo_activo_lbl','● Activo')}</span>`
              : t('cfg_demo_inactivo_lbl','Explorar la app con datos de ejemplo')}</div>
          </div>
          ${isDemoMode() ? `<span style="font-size:.68rem;padding:3px 10px;background:var(--gold-dim);color:var(--gold);border-radius:99px;font-weight:700">DEMO</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isDemoMode()
            ? `<button class="btn btn-danger btn-sm" onclick="confirmar(t('confirm_salir_demo'),()=>{clearDemoData()},{titulo:t('confirm_salir_demo_titulo'),icono:'🏁',btnLabel:t('confirm_salir_demo_btn')})">${t('cfg_demo_salir','🏁 Desactivar demo')}</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="activateDemoWithConfig()" style="background:var(--gold-dim);border-color:rgba(245,158,11,.2);color:var(--gold);font-weight:700">${t('cfg_demo_activar','🚀 Activar modo demo')}</button>`}
        </div>
      </div>

      <!-- Notificaciones -->
      <div class="card">
        <div class="card-header"><div class="card-title">🔔 ${t('cfg_notificaciones') || 'Notificaciones'}</div></div>
        <div id="mn-notif-settings-container"></div>
      </div>

      <!-- Info -->
      <div class="card">
        <div class="card-header"><div class="card-title">ℹ️ ${t('cfg_info')}</div></div>
        <div class="stat-row"><span class="stat-key">${t('cfg_version_lbl')}</span><span class="stat-val" style="color:var(--accent);font-weight:800">MoneyNest v${VERSION} · ${_currentLang.toUpperCase()}</span></div>
        <div class="stat-row"><span class="stat-key">💰 ${t('page_ingresos')}</span><span class="stat-val">${S.ingresos.length}</span></div>
        <div class="stat-row"><span class="stat-key">💳 ${t('page_gastos')}</span><span class="stat-val">${S.gastos.length}</span></div>
        <div class="stat-row"><span class="stat-key">📈 ${t('page_inversiones')}</span><span class="stat-val">${S.inversiones.length}</span></div>
        <div class="stat-row"><span class="stat-key">📉 ${t('page_deudas')}</span><span class="stat-val">${S.deudas.length}</span></div>
        <div class="stat-row"><span class="stat-key">🎯 ${t('page_objetivos')}</span><span class="stat-val">${S.objetivos.length}</span></div>

        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="lanzarTutorial()">${t('cfg_ver_tutorial')}</button>
          <button class="btn btn-ghost btn-sm" onclick="if(confirm('¿Repetir el onboarding inicial? Se recargará la página.')){localStorage.removeItem('${OB_FLAG_KEY}');localStorage.removeItem('${TUT_FLAG_KEY}');location.reload()}" title="Volver a ver el onboarding completo">🔄 Repetir onboarding</button>
        </div>
      </div>
    </div>

    <!-- Columna derecha: Categorías personalizadas se eliminó — ya tiene su propia sección en el sidebar -->
    <div class="card" style="align-self:start">
      <div class="card-header"><div class="card-title">🏷️ ${t('cfg_cats_titulo')}</div></div>
      <div style="text-align:center;padding:16px 8px">
        <div style="font-size:.85rem;color:var(--text2);margin-bottom:14px">${t('cfg_cats_movido','La gestión de categorías ahora tiene su propia sección.')}</div>
        <button class="btn btn-primary btn-sm" onclick="goTo('categorias')">🏷️ ${t('nav_categorias','Categorías')} →</button>
      </div>
    </div>
  </div>

  <!-- FAQ — ancho completo, todas las preguntas desplegadas (Bloque 6) -->
  <div class="card" style="margin-top:20px;max-width:1100px">
    <div class="card-header">
      <div><div class="card-title">❓ ${t('cfg_faq_titulo','Preguntas frecuentes')}</div><div class="card-subtitle">${t('cfg_faq_sub','Dudas comunes sobre MoneyNest')}</div></div>
    </div>
    ${_faqBodyHtml()}
  </div>`

  // Notifications settings panel (post-render)
  const nc = document.getElementById('mn-notif-settings-container')
  if (nc) {
    if (window.MNNotifications?.renderSettingsUI) {
      MNNotifications.renderSettingsUI('mn-notif-settings-container')
    } else {
      nc.innerHTML = '<p style="font-size:.8rem;color:var(--text2)">Las notificaciones push no están disponibles en este dispositivo.</p>'
    }
  }

  // Real subscription status (Fase 5) — fetched from Supabase directly
  // (RLS already scopes this to the caller's own row), never from the
  // local mock cache.
  if (document.getElementById('mn-sub-status-info')) _loadRealSubscriptionStatus()
}
function renderFacturacion() {
  const el = document.getElementById('content')
  if (!el) return
  const e = window.MNEntitlements
  const isTrial   = e ? e.isTrial() : true
  const isPro     = e ? e.isPro() : false
  const isLocal   = e ? e.isLocal() : false
  const hasPlan   = isPro || isLocal
  const pink      = '#EC4899'
  const localPrice = window.MNBilling ? MNBilling.PLANS.LOCAL_LIFETIME.price : 6.99
  const proPrice   = window.MNBilling ? MNBilling.PLANS.PRO_ANNUAL.price : 14.99

  // ── "Tu plan" — current status, with real management actions ──
  const currentPlanHtml = (() => {
    if (isPro) return `
      <div class="card" style="background:linear-gradient(160deg, rgba(236,72,153,.1), var(--card) 65%);border:1.5px solid rgba(236,72,153,.4)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text)">☁️ ${_aut('plan_pro_name','MoneyNest Pro')}</div>
            <div style="font-size:1.5rem;font-weight:900;color:${pink};margin:4px 0">${eur(proPrice)}<span style="font-size:.72rem;font-weight:600;color:var(--text2)">/${_aut('plan_periodo_ano','año')}</span></div>
          </div>
          <span style="font-size:.65rem;font-weight:800;color:${pink};background:rgba(236,72,153,.15);padding:3px 10px;border-radius:99px;text-transform:uppercase">${_aut('cfg_pro_activo','PRO ACTIVO')}</span>
        </div>
        <ul style="list-style:none;padding:0;margin:14px 0;display:flex;flex-direction:column;gap:6px">
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_todo_local','Todo lo de Local')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_cloud','Cloud')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_sync','Sincronización')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_backup','Backup automático')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_restauracion','Restauración')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_multidispositivo','Varios dispositivos')}</li>
        </ul>
        <div id="mn-sub-status-info" style="font-size:.78rem;color:var(--text3);margin-bottom:14px"></div>
        <button class="btn btn-sm" style="background:${pink};color:#fff;border:none;width:100%" onclick="_openStripeCustomerPortal(this)">${_aut('cfg_btn_gestionar_suscripcion','Gestionar suscripción')}</button>
      </div>`

    if (isLocal) return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text)">💾 ${_aut('plan_local_name','MoneyNest Local')}</div>
            <div style="font-size:1.5rem;font-weight:900;color:var(--accent);margin:4px 0">${eur(localPrice)} <span style="font-size:.72rem;font-weight:700;color:var(--text2);text-transform:uppercase">— ${_aut('plan_pago_unico','Pago único')}</span></div>
          </div>
          <span style="font-size:.65rem;font-weight:800;color:var(--accent);background:var(--accent-dim);padding:3px 10px;border-radius:99px;text-transform:uppercase">${_aut('cfg_estado_activo','Activo')}</span>
        </div>
        <ul style="list-style:none;padding:0;margin:14px 0;display:flex;flex-direction:column;gap:6px">
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_ilimitado','Acceso ilimitado')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_datos_locales','Datos locales')}</li>
          <li style="font-size:.84rem;color:var(--text)">✓ ${_aut('plan_feat_sin_suscripcion','Sin suscripción')}</li>
          <li style="font-size:.84rem;color:var(--text3)">✕ ${_aut('plan_feat_cloud','Cloud')}</li>
        </ul>
        <div id="mn-sub-status-info" style="font-size:.78rem;color:var(--text3);margin-bottom:14px"></div>
        <button class="btn btn-sm" style="background:${pink};color:#fff;border:none;width:100%" onclick="MNAuthUI.openPlanModal('facturacion')">${_aut('cfg_btn_mejorar_pro','Mejorar a Pro')}</button>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" onclick="_openStripeCustomerPortal(this)">${_aut('cfg_btn_gestionar_suscripcion','Gestionar suscripción')}</button>
      </div>`

    // Trial / sin plan
    const state = e?.getServerState()
    const trialEndsAt = state?.trial_ends_at ? new Date(state.trial_ends_at).getTime() : null
    const hoursLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 3600000)) : 24
    const expired = e ? e.isTrialExpired() : false
    return `
      <div class="card">
        <div style="font-size:.68rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${_aut('cfg_plan_actual_lbl','Plan actual')}</div>
        ${expired ? `
          <div style="font-size:1.1rem;font-weight:800;color:var(--text)">${_aut('cfg_plan_expirado','Prueba gratuita finalizada')}</div>
          <div style="font-size:.85rem;color:var(--text2);margin-top:6px">${_aut('cfg_plan_expirado_desc','Elige un plan para seguir usando MoneyNest. Tus datos siguen intactos.')}</div>
        ` : `
          <div style="font-size:1.1rem;font-weight:800;color:var(--gold)">⏳ ${_aut('plan_trial_name','Prueba gratuita')} <span style="font-weight:600;font-size:.85rem;color:var(--text2)">· ${_aut('cfg_te_quedan','Te quedan')} ${hoursLeft}h</span></div>
          <div style="font-size:.85rem;color:var(--text2);margin-top:8px">${_aut('cfg_plan_trial_desc','Estás probando MoneyNest completo.')}</div>
        `}
      </div>`
  })()

  // ── Comparación Local vs Pro — botones reales: nunca conceden nada,
  // abren el modal de pago antiguo (MNPayment) directamente ──
  const comparisonHtml = `
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">⚖️ ${_aut('cfg_comparar_planes','Compara los planes')}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="padding:16px;border-radius:12px;border:1.5px solid var(--border2);${isLocal ? 'border-color:var(--accent);background:var(--accent-dim)' : ''}">
          <div style="font-size:.9rem;font-weight:800;color:var(--text)">💾 ${_aut('plan_local_name','MoneyNest Local')}</div>
          <div style="font-size:1.3rem;font-weight:900;color:var(--accent);margin:6px 0 2px">${eur(localPrice)}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">${_aut('plan_pago_unico','Pago único')}</div>
          <ul style="list-style:none;padding:0;margin:0 0 12px;display:flex;flex-direction:column;gap:4px">
            <li style="font-size:.78rem;color:var(--text)">✓ ${_aut('plan_feat_ilimitado','Acceso ilimitado')}</li>
            <li style="font-size:.78rem;color:var(--text)">✓ ${_aut('plan_feat_sin_suscripcion','Sin suscripción')}</li>
            <li style="font-size:.78rem;color:var(--text3)">✕ ${_aut('plan_feat_cloud','Cloud')}</li>
          </ul>
          ${isLocal
            ? `<div style="text-align:center;font-size:.72rem;font-weight:800;color:var(--accent);text-transform:uppercase">✓ ${_aut('cfg_estado_activo','Activo')}</div>`
            : `<button class="btn btn-secondary btn-sm" style="width:100%" onclick="MNAuthUI._doConfirmPlan('local')">${_aut('plan_btn_comprar_local','Comprar Local')}</button>`}
        </div>
        <div style="padding:16px;border-radius:12px;border:1.5px solid ${isPro ? pink : 'var(--border2)'};${isPro ? 'background:rgba(236,72,153,.08)' : ''}">
          <div style="font-size:.9rem;font-weight:800;color:var(--text)">☁️ ${_aut('plan_pro_name','MoneyNest Pro')}</div>
          <div style="font-size:1.3rem;font-weight:900;color:${pink};margin:6px 0 2px">${eur(proPrice)}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">/${_aut('plan_periodo_ano','año')}</div>
          <ul style="list-style:none;padding:0;margin:0 0 12px;display:flex;flex-direction:column;gap:4px">
            <li style="font-size:.78rem;color:var(--text)">✓ ${_aut('plan_feat_todo_local','Todo lo de Local')}</li>
            <li style="font-size:.78rem;color:var(--text)">✓ ${_aut('plan_feat_cloud','Cloud')}</li>
            <li style="font-size:.78rem;color:var(--text)">✓ ${_aut('plan_feat_sync','Sincronización')}</li>
          </ul>
          ${isPro
            ? `<div style="text-align:center;font-size:.72rem;font-weight:800;color:${pink};text-transform:uppercase">✓ PRO ACTIVO</div>`
            : `<button class="btn btn-sm" style="background:${pink};color:#fff;border:none;width:100%" onclick="MNAuthUI._doConfirmPlan('pro')">${_aut('plan_btn_elegir_pro','Elegir Pro')}</button>`}
        </div>
      </div>
    </div>`

  // ── Acciones adicionales: restaurar acceso y código promocional ──
  const actionsHtml = `
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">🔑 ${_aut('cfg_mas_opciones','Más opciones')}</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;justify-content:flex-start" onclick="_openRestoreAccessModal(window.MNAuth?.getUser?.() ?? null)">🔓 ${_aut('cfg_btn_restaurar_acceso','Restaurar acceso')}</button>
        <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;justify-content:flex-start" onclick="MNAuthUI._doConfirmPlan('${isPro ? 'pro' : 'local'}')">🏷️ ${_aut('cfg_btn_codigo_promo','Introducir código promocional')}</button>
      </div>
    </div>
    <div style="font-size:.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px">${_aut('cfg_historial_pagos','Historial de pagos')}</div>
    <div class="card" style="text-align:center;padding:20px;color:var(--text3);font-size:.8rem">${_aut('cfg_historial_vacio','El historial de pagos aparecerá aquí.')}</div>`

  // Order: no plan yet → pick-a-plan comparison comes first; already
  // Local/Pro → current status comes first, comparison/upsell last.
  const sections = hasPlan
    ? [currentPlanHtml, comparisonHtml, actionsHtml]
    : [comparisonHtml, currentPlanHtml, actionsHtml]

  el.innerHTML = `
  <div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:18px">
    <div class="section-header">
      <div>
        <div class="page-h1">🧾 ${_aut('cfg_plan_titulo','Plan y facturación')}</div>
        <div class="page-sub">${_aut('cfg_plan_sub','Tu plan actual y opciones de facturación')}</div>
      </div>
    </div>
    ${sections.join('')}
  </div>`

  if (document.getElementById('mn-sub-status-info')) _loadRealSubscriptionStatus()
}

function renderLogros() {
  const el = document.getElementById('content')
  if (!el) return
  el.innerHTML = `
  <div class="section-header">
    <div><div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> ${t('nav_logros') || 'Logros'}</div><div class="page-sub">${t('nav_sub_logros') || 'Tu progreso en MoneyNest'}</div></div>
  </div>
  <div id="achievementsContainer"></div>`

  function _tryRender(attempt) {
    if (window.MNGamification && window.MNGamification.renderAchievementsPanel) {
      const ac = document.getElementById('achievementsContainer')
      if (ac) MNGamification.renderAchievementsPanel('achievementsContainer')
    } else if (attempt < 10) {
      // Retry up to 10 times (max 1s wait)
      setTimeout(() => _tryRender(attempt + 1), 100)
    } else {
      const ac = document.getElementById('achievementsContainer')
      if (ac) ac.innerHTML = '<div class="empty"><div class="empty-icon">🏆</div><div class="empty-title">No se pudo cargar el sistema de logros</div><div class="empty-sub">Recarga la página para intentarlo de nuevo.</div></div>'
    }
  }
  _tryRender(0)
}

// ─── CHARTS ────────────────────────────────────────────────────
const CHART_COLORS = ['#00D4AA','#6366F1','#F59E0B','#F43F5E','#10B981','#8B5CF6','#EC4899','#3B82F6','#14B8A6','#F97316']
function chartDefaults() {
  const isLight = S && S.theme === 'light'
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg(),
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: tooltipText(),
        bodyColor: isLight ? '#475569' : '#94A3B8',
        padding: { x: 14, y: 10 },
        cornerRadius: 10,
        titleFont: { size: 11, weight: '700' },
        bodyFont: { size: 12, weight: '600' },
        displayColors: false,
        caretSize: 5,
        callbacks: {}
      }
    }
    // Sin scales en el default — cada gráfico los define explícitamente
    // (los doughnuts no deben heredar ejes X/Y)
  }
}

// Scales estándar para gráficos de línea/barra
function _chartScales(yCallback) {
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 480
  return {
    x: { grid: { color: 'transparent' }, border: { color: 'transparent' },
      ticks: { color: labelColor(), font: { size: 11 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: isNarrow ? 6 : 12 } },
    y: { grid: { color: gridColor() }, border: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 11 }, callback: yCallback || (v => v) } }
  }
}
function destroyChart(id) {
  if (charts[id]) { try { charts[id].destroy() } catch(e){} delete charts[id] }
}
function destroyAllCharts() {
  Object.keys(charts).forEach(k=>destroyChart(k))
  // The custom-debt-strategy modal chart lives outside the shared `charts`
  // registry (its overlay is appended to document.body, not #content), so
  // navigating away without explicitly closing that modal would otherwise
  // leave this Chart.js instance alive with a canvas about to become
  // detached/orphaned.
  if (window._customDebtChartInstance) {
    try { window._customDebtChartInstance.destroy() } catch(e){}
    window._customDebtChartInstance = null
  }
}
function gridColor()  { return S && S.theme==='light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)' }
function labelColor() { return S && S.theme==='light' ? '#94A3B8' : '#4B5563' }
function tooltipBg()  { return S.theme==='light' ? 'rgba(255,255,255,0.98)' : 'rgba(15,20,35,0.95)' }
function tooltipText(){ return S.theme==='light' ? '#0F172A' : '#E8EFF7' }

// ── Gradient helper ─────────────────────────────────────────────
function _chartGradient(ctx2, color, alphaTop = 0.22, alphaBot = 0.0, height = 220) {
  try {
    const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, height)
    g.addColorStop(0, color.replace(')', `,${alphaTop})`).replace('rgb', 'rgba'))
    g.addColorStop(1, color.replace(')', `,${alphaBot})`).replace('rgb', 'rgba'))
    return g
  } catch { return color + '18' }
}
function _hexGradient(canvas, hex, alphaTop = 0.22, alphaBot = 0.0) {
  try {
    const h = canvas.height || 220
    const g = canvas.getContext('2d').createLinearGradient(0, 0, 0, h)
    const r = parseInt(hex.slice(1,3),16)
    const gr = parseInt(hex.slice(3,5),16)
    const b = parseInt(hex.slice(5,7),16)
    g.addColorStop(0, `rgba(${r},${gr},${b},${alphaTop})`)
    g.addColorStop(1, `rgba(${r},${gr},${b},${alphaBot})`)
    return g
  } catch { return hex + '20' }
}

function renderChartPatrimonio() {
  const ctx = document.getElementById('chartPatrimonio')
  if (!ctx) return
  destroyChart('patrimonio')
  const months = getMonths(12)
  recordPatrimonio()
  const vals = months.map(m => {
    const h = S.patrimonio_hist.find(h => h.mes === m)
    return h ? h.valor : null
  })
  const nonNullVals = vals.filter(v => v !== null)
  const maxVal = nonNullVals.length ? Math.max(...nonNullVals) : 0
  const minVal = nonNullVals.length ? Math.min(...nonNullVals) : 0
  const yPad = (maxVal - minVal) * 0.15 || Math.abs(maxVal) * 0.15 || 100
  charts['patrimonio'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: vals,
        borderColor: '#00D4AA',
        backgroundColor: (c) => {
          try {
            const h = c.chart.chartArea?.bottom || 220
            const g = c.chart.ctx.createLinearGradient(0, 0, 0, h)
            g.addColorStop(0, 'rgba(0,212,170,0.18)')
            g.addColorStop(0.7, 'rgba(0,212,170,0.04)')
            g.addColorStop(1, 'rgba(0,212,170,0)')
            return g
          } catch { return 'rgba(0,212,170,0.1)' }
        },
        fill: true, tension: 0.42,
        pointRadius: nonNullVals.length <= 1 ? 5 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#00D4AA',
        pointBorderColor: 'transparent',
        pointBorderWidth: 0,
        borderWidth: 2.5, spanGaps: true
      }]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins,
        tooltip: { ...chartDefaults().plugins.tooltip,
          callbacks: {
            title: (items) => items[0].label,
            label: (c) => ' Patrimonio: ' + eur(c.raw),
          }
        }
      },
      scales: {
        x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 11 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
        y: { grid: { color: gridColor(), drawBorder: false }, ticks: { color: labelColor(), font: { size: 11 }, callback: v => eur(v) },
          suggestedMin: minVal - yPad,
          suggestedMax: maxVal + yPad,
          border: { color: 'transparent' }
        }
      }
    }
  })
}

function renderChartCashFlow() {
  const ctx = document.getElementById('chartCashFlow')
  if (!ctx) return
  destroyChart('cashflow')
  const months = getMonths(12)
  const cfData = months.map(m => calcCashFlow(m))
  const lastPositive = cfData[cfData.length - 1] >= 0
  charts['cashflow'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: cfData,
        borderColor: lastPositive ? '#00D4AA' : '#F43F5E',
        backgroundColor: (c) => {
          try {
            const h = c.chart.chartArea?.bottom || 200
            const g = c.chart.ctx.createLinearGradient(0, 0, 0, h)
            if (lastPositive) {
              g.addColorStop(0, 'rgba(0,212,170,0.2)')
              g.addColorStop(1, 'rgba(0,212,170,0)')
            } else {
              g.addColorStop(0, 'rgba(244,63,94,0.18)')
              g.addColorStop(1, 'rgba(244,63,94,0)')
            }
            return g
          } catch { return lastPositive ? 'rgba(0,212,170,0.1)' : 'rgba(244,63,94,0.1)' }
        },
        fill: true, tension: 0.42, pointRadius: 4, pointHoverRadius: 6,
        pointBackgroundColor: cfData.map(v => v >= 0 ? '#00D4AA' : '#F43F5E'),
        pointBorderColor: 'transparent',
        pointBorderWidth: 2,
        borderWidth: 2.5, spanGaps: true,
        segment: { borderColor: c => cfData[c.p0DataIndex] >= 0 ? '#00D4AA' : '#F43F5E' }
      }]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins,
        tooltip: { ...chartDefaults().plugins.tooltip,
          callbacks: {
            title: (i) => i[0].label,
            label: (c) => ' Cashflow: ' + (c.raw >= 0 ? '+' : '') + eur(c.raw)
          }
        }
      },
      scales: {
        x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 11 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
        y: { grid: { color: gridColor() }, border: { color: 'transparent' },
          ticks: { color: labelColor(), font: { size: 11 }, callback: v => (v >= 0 ? '+' : '') + eur(v) },
          afterDataLimits: scale => { const m = Math.max(Math.abs(scale.min), Math.abs(scale.max)); scale.min = -m; scale.max = m }
        }
      }
    }
  })
}

function renderChartIngVsGas() {
  const ctx = document.getElementById('chartIngVsGas')
  if (!ctx) return
  destroyChart('ingvsgas')
  const months = getMonths(12)
  const ingData = months.map(m => calcIngresosMes(m))
  const gasData = months.map(m => calcGastosMes(m))
  const allVals = [...ingData, ...gasData].filter(v => v > 0)
  const maxVal = allVals.length ? Math.max(...allVals) : 100
  const _mkGrad = (c, hex, a1, a2) => {
    try {
      const h2 = c.chart.chartArea?.bottom || 220
      const g = c.chart.ctx.createLinearGradient(0, 0, 0, h2)
      const [r2, g2, b2] = [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]
      g.addColorStop(0, `rgba(${r2},${g2},${b2},${a1})`); g.addColorStop(1, `rgba(${r2},${g2},${b2},${a2})`)
      return g
    } catch { return hex + '18' }
  }
  charts['ingvsgas'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: t('nav_ingresos'), data: ingData, borderColor: '#10B981',
          backgroundColor: c => _mkGrad(c, '#10B981', 0.18, 0),
          fill: true, tension: 0.42, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: '#10B981', pointBorderColor: 'transparent', pointBorderWidth: 0, borderWidth: 2.5, spanGaps: true },
        { label: t('nav_gastos'), data: gasData, borderColor: '#F43F5E',
          backgroundColor: c => _mkGrad(c, '#F43F5E', 0.12, 0),
          fill: true, tension: 0.42, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: '#F43F5E', pointBorderColor: 'transparent', pointBorderWidth: 0, borderWidth: 2.5, spanGaps: true }
      ]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins,
        legend: { display: true, labels: { color: labelColor(), boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 11, weight: '600' } } },
        tooltip: { ...chartDefaults().plugins.tooltip,
          callbacks: { title: i => i[0].label, label: c => ' ' + c.dataset.label + ': ' + eur(c.raw) }
        }
      },
      scales: {
        x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 11 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
        y: { grid: { color: gridColor() }, border: { color: 'transparent' },
          ticks: { color: labelColor(), font: { size: 11 }, callback: v => eur(v) },
          suggestedMin: 0, suggestedMax: maxVal > 0 ? maxVal * 1.15 : 100
        }
      }
    }
  })
}

function _donutOptions(total) {
  return {
    ...chartDefaults(),
    cutout: '72%',
    plugins: { ...chartDefaults().plugins,
      tooltip: { ...chartDefaults().plugins.tooltip,
        callbacks: {
          title: i => i[0].label,
          label: c => ' ' + eur(c.raw) + '  (' + pct(total ? c.raw / total * 100 : 0, 1) + ')'
        }
      }
    }
  }
}

function renderChartDonut() {
  const ctx = document.getElementById('chartDonut')
  const legendEl = document.getElementById('donutLegend')
  if (!ctx) return
  destroyChart('donut')
  const m = currentMonth()
  const catMap = gastosMesByCat(m)
  const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6)
  if (!entries.length) return
  const total = entries.reduce((a,e)=>a+e[1],0)
  const bg = S.theme === 'light' ? '#F8FAFC' : '#0F1724'
  charts['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: CHART_COLORS,
        borderWidth: 3,
        borderColor: bg,
        hoverBorderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: _donutOptions(total),
  })
  if (legendEl) {
    legendEl.innerHTML = entries.map((e, i) => `
      <div class="legend-item">
        <span style="width:10px;height:10px;border-radius:3px;background:${CHART_COLORS[i]};flex-shrink:0;
          box-shadow:0 0 6px ${CHART_COLORS[i]}88"></span>
        <span class="legend-label" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e[0]}</span>
        <span style="font-size:.75rem;font-weight:700;color:var(--text)">${pct(total ? e[1]/total*100 : 0, 0)}</span>
      </div>`).join('')
  }
}

function renderDonutCat(canvasId, legendId, catMap, type) {
  const ctx = document.getElementById(canvasId)
  const legendEl = document.getElementById(legendId)
  if (!ctx) return
  destroyChart(canvasId)
  const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,7)
  if (!entries.length) return
  const total = entries.reduce((a,e)=>a+e[1],0)
  const bg = S.theme === 'light' ? '#F8FAFC' : '#0F1724'
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e=>e[0]),
      datasets: [{
        data: entries.map(e=>e[1]),
        backgroundColor: CHART_COLORS,
        borderWidth: 3,
        borderColor: bg,
        hoverBorderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: { ..._donutOptions(total), cutout: '68%' }
  })
  if (legendEl) {
    legendEl.innerHTML = entries.map((e,i)=>`
      <div class="legend-item">
        <span style="width:9px;height:9px;border-radius:2px;background:${CHART_COLORS[i]};flex-shrink:0;
          box-shadow:0 0 5px ${CHART_COLORS[i]}88"></span>
        <span class="legend-label" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e[0]}</span>
        <span style="font-size:.73rem;font-weight:700;color:var(--text)">${eur(e[1])}</span>
      </div>`).join('')
  }
}

function renderLineEvo(canvasId, type) {
  const ctx = document.getElementById(canvasId)
  if (!ctx) return
  destroyChart(canvasId)
  const months = getMonths(12)
  const color = type==='ingreso' ? '#10B981' : '#F43F5E'
  const fn = type==='ingreso' ? calcIngresosMes : calcGastosMes
  const vals = months.map(fn)
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(monthLabel),
      datasets: [{
        data: vals,
        borderColor: color,
        backgroundColor: c => {
          try {
            const h2 = c.chart.chartArea?.bottom || 200
            const r = parseInt(color.slice(1,3),16), g2 = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16)
            const gr = c.chart.ctx.createLinearGradient(0,0,0,h2)
            gr.addColorStop(0, `rgba(${r},${g2},${b},0.18)`)
            gr.addColorStop(1, `rgba(${r},${g2},${b},0)`)
            return gr
          } catch { return color + '18' }
        },
        fill: true, tension: 0.42,
        pointRadius: 4, pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: 'transparent',
        borderWidth: 2.5
      }]
    },
    options: { ...chartDefaults(), scales: {
      x: { grid:{color:'transparent'}, border:{color:'transparent'}, ticks:{color:labelColor(),font:{size:11},autoSkip:true,maxRotation:60,minRotation:0,maxTicksLimit:(typeof window!=='undefined'&&window.innerWidth<480)?6:12} },
      y: { grid:{color:gridColor()}, border:{color:'transparent'}, ticks:{color:labelColor(),font:{size:11},callback:v=>eur(v)} }
    }}
  })
}

function renderChartInvROI() {
  const ctx = document.getElementById('chartInvROI')
  if (!ctx) return
  destroyChart('invROI')

  // Check if there are any investments (active or closed)
  if (!S.inversiones.length) {
    const parent = ctx.parentElement
    if (parent) parent.innerHTML = '<div class=empty style=padding:20px><div class=empty-icon>📊</div><div class=empty-title>Sin inversiones</div><div class=empty-sub>Añade inversiones para ver el gráfico de ROI</div></div>'
    return
  }

  const view = window._roiView || 'monthly' // 'monthly' or 'yearly'

  // Calculate ROI over time based on liquidation dates
  // For each period (month or year), calculate average ROI of all investments liquidated up to that point
  const roiByPeriod = {}

  S.inversiones.forEach(inv => {
    if (!inv.cerrada || !inv.fechaCierre) return
    const roi = Number(inv.roiReal) || 0
    const closeDate = new Date(inv.fechaCierre)
    if (isNaN(closeDate.getTime())) return

    const period = view === 'yearly'
      ? closeDate.getFullYear().toString()
      : closeDate.toISOString().slice(0, 7) // YYYY-MM

    if (!roiByPeriod[period]) {
      roiByPeriod[period] = { sum: 0, count: 0, rois: [] }
    }
    roiByPeriod[period].sum += roi
    roiByPeriod[period].count++
    roiByPeriod[period].rois.push(roi)
  })

  // If no liquidated investments yet, show all active investments at 0% for current period
  if (Object.keys(roiByPeriod).length === 0) {
    const parent = ctx.parentElement
    if (parent) parent.innerHTML = '<div class=empty style=padding:20px><div class=empty-icon>⏳</div><div class=empty-title>Sin inversiones liquidadas aún</div><div class=empty-sub>El ROI se calculará cuando liquides inversiones</div></div>'
    return
  }

  // Sort periods chronologically
  const periods = Object.keys(roiByPeriod).sort()

  // Calculate cumulative average ROI over time
  let cumulativeSum = 0
  let cumulativeCount = 0
  const labels = []
  const avgROI = []

  periods.forEach(period => {
    cumulativeSum += roiByPeriod[period].sum
    cumulativeCount += roiByPeriod[period].count
    const avg = cumulativeCount > 0 ? cumulativeSum / cumulativeCount : 0

    labels.push(view === 'yearly' ? period : formatMonthLabel(period))
    avgROI.push(Number(avg.toFixed(2)))
  })

  // Helper function to format month labels
  function formatMonthLabel(yyyymm) {
    const [y, m] = yyyymm.split('-')
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${months[parseInt(m)-1]} ${y.slice(2)}`
  }

  // Determine color based on final ROI
  const finalROI = avgROI[avgROI.length - 1] || 0
  const lineColor = finalROI >= 0 ? '#10B981' : '#F43F5E'
  const fillColor = finalROI >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'

  charts['invROI'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'ROI Promedio',
        data: avgROI,
        borderColor: lineColor,
        backgroundColor: (context) => {
          const chart = context.chart
          const {ctx, chartArea} = chart
          if (!chartArea) return fillColor
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, fillColor)
          gradient.addColorStop(1, 'transparent')
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 3,
      }]
    },
    options: {
      ...chartDefaults(),
      interaction: { mode: 'index', intersect: false },
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false },
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            title: (ctx) => {
              const period = periods[ctx[0].dataIndex]
              const data = roiByPeriod[period]
              return `${ctx[0].label} — ${data.count} ${data.count === 1 ? 'inversión liquidada' : 'inversiones liquidadas'}`
            },
            label: (ctx) => {
              const roi = ctx.parsed.y
              return ` ROI Promedio: ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`
            },
            afterLabel: (ctx) => {
              const period = periods[ctx.dataIndex]
              const data = roiByPeriod[period]
              const min = Math.min(...data.rois)
              const max = Math.max(...data.rois)
              return `Rango: ${min >= 0 ? '+' : ''}${min.toFixed(1)}% a ${max >= 0 ? '+' : ''}${max.toFixed(1)}%`
            }
          }
        }
      },
      scales: {
        x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 10 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
        y: {
          grid: { color: gridColor() },
          border: { color: 'transparent' },
          ticks: {
            color: labelColor(),
            font: { size: 10 },
            callback: (v) => (v >= 0 ? '+' : '') + v + '%'
          },
          // Add zero line
          afterDataLimits: (scale) => {
            const max = Math.max(Math.abs(scale.min), Math.abs(scale.max), 5)
            scale.min = -max * 1.1
            scale.max = max * 1.1
          }
        }
      }
    }
  })
}

// ─── INSIGHTS ──────────────────────────────────────────────────
// ─── SMART INSIGHTS ENGINE ─────────────────────────────────────
// Only generates insights from REAL user data. Never static or generic.
// Returns null (not []) when there is not enough data yet.
function generarInsights() {
  const m  = currentMonth()
  const mp = prevMonth(m)

  // ── Minimum data threshold ─────────────────────────────────────
  const gastosMes = S.gastos.filter(g =>
    g.tipo !== TX_TYPES.GOAL_TRANSFER && (g.fecha||'').startsWith(m)
  )
  const ingresosMes = S.ingresos.filter(i =>
    i.status !== 'pending' && (i.fecha||'').startsWith(m)
  )
  const totalTxAllTime = S.ingresos.length + S.gastos.length

  // Not enough data → return null so UI can show empty state
  if (totalTxAllTime < 5 || gastosMes.length < 2) return null

  const insights = []
  const ing  = calcIngresosMes(m)
  const gas  = calcGastosMes(m)
  const ingP = calcIngresosMes(mp)
  const gasP = calcGastosMes(mp)

  // ── CASE A: Recurring expense detection ────────────────────────
  // Detect transactions that repeat across ≥2 months with same concept + similar amount (±10%)
  const prevGastos = S.gastos.filter(g =>
    g.tipo !== TX_TYPES.GOAL_TRANSFER && (g.fecha||'').startsWith(mp)
  )
  const recurringDetected = gastosMes.filter(g => {
    const amt = Number(g.importe) || 0
    return prevGastos.some(pg => {
      const pgAmt = Number(pg.importe) || 0
      const sameConcept = pg.concepto && g.concepto &&
        pg.concepto.toLowerCase().trim() === g.concepto.toLowerCase().trim()
      const similarAmt = Math.abs(amt - pgAmt) / Math.max(pgAmt, 1) <= 0.1
      return (sameConcept || pg.recurrente || g.recurrente) && similarAmt && amt > 0
    })
  })
  if (recurringDetected.length >= 2) {
    const totalRec = recurringDetected.reduce((a,g) => a + (Number(g.importe)||0), 0)
    insights.push({
      icon: '🔄',
      bg:   'var(--indigo-dim)',
      text: `Tienes <strong>${recurringDetected.length} gastos recurrentes</strong> detectados este mes que suman <strong>${eur(totalRec)}</strong> (~${eur(Math.round(totalRec))}/mes).`
    })
  }

  // ── CASE B: Top spending category (vs total expenses, not income) ─
  if (gas > 0) {
    const catMap = gastosMesByCat(m)
    const topCat = Object.entries(catMap).sort((a,b) => b[1]-a[1])[0]
    if (topCat) {
      const share = topCat[1] / gas * 100
      if (share >= 35) {
        insights.push({
          icon: '🏷',
          bg:   'var(--gold-dim)',
          text: `El <strong>${Math.round(share)}% de tus gastos</strong> va en <strong>${topCat[0]}</strong> (${eur(topCat[1])}). Es tu categoría más alta este mes.`
        })
      }
    }
  }

  // ── CASE C: Month-over-month spending change ────────────────────
  if (gasP > 0 && gas > 0) {
    const delta = (gas - gasP) / gasP * 100
    if (delta >= 12) {
      insights.push({
        icon: '📈',
        bg:   'var(--red-dim)',
        text: `Tus gastos han <strong>subido un ${Math.round(delta)}%</strong> respecto al mes anterior — de ${eur(gasP)} a ${eur(gas)}.`
      })
    } else if (delta <= -12) {
      insights.push({
        icon: '📉',
        bg:   'var(--green-dim)',
        text: `Has <strong>reducido tus gastos un ${Math.round(Math.abs(delta))}%</strong> vs el mes pasado (${eur(gasP)} → ${eur(gas)}). Buen trabajo.`
      })
    }
  }

  // ── CASE D: Savings rate (only shown when income data exists) ───
  if (ing > 0 && ingresosMes.length >= 1) {
    const sr = (ing - gas) / ing * 100
    if (sr < 0) {
      insights.push({
        icon: '🚨',
        bg:   'var(--red-dim)',
        text: `<strong>Gastas más de lo que ingresas</strong> este mes. Déficit de ${eur(Math.abs(ing-gas))}. Revisa tus gastos.`
      })
    } else if (sr < 10 && gas > 0) {
      insights.push({
        icon: '⚠️',
        bg:   'var(--gold-dim)',
        text: `Tu tasa de ahorro es del <strong>${Math.round(sr)}%</strong> — por debajo del 10%. Considera reducir gastos variables.`
      })
    } else if (sr >= 25) {
      insights.push({
        icon: '✅',
        bg:   'var(--green-dim)',
        text: `Estás ahorrando el <strong>${Math.round(sr)}% de tus ingresos</strong> este mes (${eur(ing - gas)}). Por encima de la media.`
      })
    }
  }

  // ── CASE E: Small impulse expenses accumulation ─────────────────
  const smallTx = gastosMes.filter(g => {
    const amt = Number(g.importe) || 0
    return amt > 0 && amt < 15
  })
  if (smallTx.length >= 6) {
    const totalSmall = smallTx.reduce((a,g) => a + (Number(g.importe)||0), 0)
    insights.push({
      icon: '☕',
      bg:   'var(--gold-dim)',
      text: `<strong>${smallTx.length} gastos pequeños</strong> (< 15€) suman <strong>${eur(totalSmall)}</strong> este mes. Las compras pequeñas se acumulan rápido.`
    })
  }

  // ── CASE F: Budget overrun (only if budgets exist) ──────────────
  if (Object.keys(S.presupuestos).length > 0 && gas > 0) {
    const catMap = gastosMesByCat(m)
    const overrun = Object.keys(S.presupuestos).filter(c => {
      const spent = Number(catMap[c]) || 0
      const limit = Number(S.presupuestos[c]) || 0
      return limit > 0 && spent > limit
    })
    if (overrun.length) {
      insights.push({
        icon: '🚫',
        bg:   'var(--red-dim)',
        text: `Superaste el presupuesto en: <strong>${overrun.join(', ')}</strong> este mes.`
      })
    }
  }

  // Cap at 3 insights max — keep it scannable
  return insights.slice(0, 3)
}

// ─── MODALS ────────────────────────────────────────────────────
function openModal(id) {
  // Guest users cannot write data — show account creation prompt
  const WRITE_MODALS = ['ingresoModal','gastoModal','inversionModal','deudaModal','objetivoModal','cuentaModal','presupuestoModal']
  if (isGuest() && WRITE_MODALS.includes(id)) {
    _showGuestGateModal()
    return
  }
  const el = document.getElementById(id)
  if (el) { el.classList.add('open'); _pushScrollLock() }
}
function closeModal(id) {
  const el = document.getElementById(id)
  if (el) { const wasOpen = el.classList.contains('open'); el.classList.remove('open'); el.classList.remove('mn-modal-inline-top'); if (wasOpen) _popScrollLock() }
  if (id === 'cuentaModal')    _revertInlineCreateIfPending('cuenta')
  if (id === 'clienteModal')   _revertInlineCreateIfPending('cliente')
  if (id === 'proveedorModal') _revertInlineCreateIfPending('proveedor')
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(el=>{ el.classList.remove('open') })
  _forceReleaseScrollLock()
}

function confirmar(msg, onOk, opts={}) {
  document.getElementById('confirmMsg').textContent = msg
  document.getElementById('confirmTitle').textContent = opts.titulo||'¿Estás seguro?'
  document.getElementById('confirmIcon').textContent = opts.icono||'⚠️'
  const btn = document.getElementById('confirmBtn')
  btn.textContent = opts.btnLabel||'Eliminar'
  btn.onclick = ()=>{ closeModal('confirmModal'); onOk() }
  const cancelBtn = document.getElementById('confirmCancelBtn')
  if (cancelBtn) {
    cancelBtn.onclick = () => { closeModal('confirmModal'); if (typeof opts.onCancel === 'function') opts.onCancel() }
  }
  openModal('confirmModal')
}

// Mapea el select de categoria al tipo (gasto/ingreso) que debe usar
// el nuevo modal con emoji. Solo gasto/ingreso/presupuesto (que usa
// categorias de gasto) entran en el alcance de esta fase — el resto
// (inversion, deuda, objetivo: listas de categorias completamente
// distintas) sigue con el campo de texto simple ya existente.
function _catSelectTipo(selectId) {
  if (selectId === 'gastoCat' || selectId === 'presCat') return 'gasto'
  if (selectId === 'ingresoCat') return 'ingreso'
  return null
}

function checkCustomCat(selectId, fieldId) {
  const sel = document.getElementById(selectId)
  const field = document.getElementById(fieldId)
  if (!sel) return
  const tipo = _catSelectTipo(selectId)
  if (sel.value === '__custom__' && tipo) {
    const prevValue = sel.dataset.mnPrevCatValue || ''
    sel.value = prevValue
    _openCreateCategoryModal(tipo, (nombre) => { poblarSelect(selectId, tipo, nombre) })
    return
  }
  if (sel.value !== '__custom__') sel.dataset.mnPrevCatValue = sel.value
  if (!field) return
  if (sel.value === '__custom__') { field.classList.add('show') }
  else { field.classList.remove('show') }
}

function getOrCreateCat(selectId, inputId, catKey) {
  const sel = document.getElementById(selectId)
  if (!sel) return ''
  if (sel.value === '__custom__') {
    const input = document.getElementById(inputId)
    const newCat = (input?.value||'').trim()
    if (!newCat) return ''
    if (!S.categorias[catKey].includes(newCat)) {
      S.categorias[catKey].push(newCat)
      save()
    }
    return newCat
  }
  return sel.value
}

function poblarSelect(selectId, catKey, selected='') {
  const sel = document.getElementById(selectId)
  if (!sel) return
  const cats = S.categorias[catKey]||[]
  // PASO 4: Las categorías por defecto se traducen via tCat().
  // Las categorías personalizadas del usuario NO se tocan (tCat devuelve el nombre original si no existe traducción).
  sel.innerHTML = cats.map(c=>`<option value="${c}" ${c===selected?'selected':''}>${catEmoji(c)} ${tCat(c)}</option>`).join('') +
    `<option value="__custom__">${t('cat_custom_lbl')}</option>`
  checkCustomCat(selectId, selectId.replace('Cat','CatCustom').replace('Pres','Pres'))
}

function poblarCuentaSelect(selectId, selectedId='') {
  const sel = document.getElementById(selectId)
  if (!sel) return
  sel.innerHTML = '<option value="">Sin cuenta</option>' +
    S.cuentas.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.nombre}</option>`).join('') +
    `<option value="__create_new__">+ ${t('modal_cuenta_titulo','Nueva cuenta')}</option>`
  if (!sel.dataset.mnInlineCreateBound) {
    sel.dataset.mnInlineCreateBound = '1'
    sel.addEventListener('change', () => _handleInlineCreateSelect(sel, 'cuenta'))
  }
  _renderDependencyHint(sel, S.cuentas.length === 0, {
    message: t('hint_sin_cuentas','No tienes cuentas todavía.'),
    btnLabel: t('btn_crear_cuenta_hint','Crear cuenta'),
    onClick: () => _handleInlineCreateSelect(sel, 'cuenta', true),
  })
}

// Aviso accionable, visible de inmediato (sin necesitar abrir el
// select), para cuando la dependencia requerida todavia no existe.
// Se inserta/actualiza justo despues del select correspondiente y
// desaparece automaticamente en cuanto la dependencia SI existe.
function _renderDependencyHint(sel, show, { message, btnLabel, onClick }) {
  const hintId = sel.id + '-dep-hint'
  let hint = document.getElementById(hintId)
  if (!show) { if (hint) hint.remove(); return }
  if (!hint) {
    hint = document.createElement('div')
    hint.id = hintId
    hint.className = 'form-dependency-hint'
    sel.insertAdjacentElement('afterend', hint)
  }
  hint.innerHTML = `<span>${message}</span><button type="button">${btnLabel}</button>`
  hint.querySelector('button').onclick = (e) => { e.preventDefault(); onClick() }
}

// ─── CREACION INLINE DE DEPENDENCIAS (sin abandonar el formulario) ──
// Si el usuario elige '+ Nueva cuenta' (o '+ Nuevo cliente'/'+ Nuevo
// proveedor') en un select dentro de un formulario, se abre el modal
// correspondiente POR ENCIMA (el formulario original nunca se cierra,
// solo queda tapado) y, al guardar, se repuebla este mismo select con
// la entidad recien creada ya seleccionada — sin recargar nada y sin
// perder ningun otro dato ya introducido en el formulario original.
const _MN_INLINE_CREATE = {
  cuenta:     { sentinel: '__create_new__', modal: 'cuentaModal',     reset: 'resetCuentaForm',     repoblar: 'poblarCuentaSelect' },
  cliente:    { sentinel: '__create_new_cliente__',  modal: 'clienteModal',  reset: 'resetClienteForm',  repoblar: '_repoblarDevengoContacto' },
  proveedor:  { sentinel: '__create_new_proveedor__',modal: 'proveedorModal',reset: 'resetProveedorForm',repoblar: '_repoblarDevengoContacto' },
}
let _mnInlineCreateTarget = null // { selectId, kind, previousValue }

function _handleInlineCreateSelect(sel, kind, forceOpen) {
  const cfg = _MN_INLINE_CREATE[kind]
  if (!cfg) return
  if (!forceOpen && sel.value !== cfg.sentinel) { sel.dataset.mnPrevValue = sel.value; return }
  _mnInlineCreateTarget = { selectId: sel.id, kind, previousValue: sel.dataset.mnPrevValue || sel.value || '' }
  if (typeof window[cfg.reset] === 'function') window[cfg.reset]()
  openModal(cfg.modal)
  document.getElementById(cfg.modal)?.classList.add('mn-modal-inline-top')
}

// Llamado desde guardarCuenta()/guardarCliente()/guardarProveedor() tras
// un guardado exitoso — si esa creacion vino de un select "+ Nueva X"
// dentro de otro formulario, selecciona la entidad recien creada ahi y
// limpia el estado pendiente. No hace nada (no-op) en el flujo normal
// de crear una cuenta/cliente/proveedor desde su propia pagina.
function _resolveInlineCreate(kind, newId) {
  if (!_mnInlineCreateTarget || _mnInlineCreateTarget.kind !== kind) return
  const { selectId } = _mnInlineCreateTarget
  const cfg = _MN_INLINE_CREATE[kind]
  _mnInlineCreateTarget = null
  const sel = document.getElementById(selectId)
  if (!sel || typeof window[cfg.repoblar] !== 'function') return
  window[cfg.repoblar](selectId, newId)
  sel.dataset.mnPrevValue = newId
}

// Si el usuario ABRE el modal de creacion pero lo CANCELA (boton
// cerrar/click fuera) sin guardar, el select vuelve a su valor previo
// en vez de quedarse "atascado" en la opcion especial.
function _revertInlineCreateIfPending(kind) {
  if (!_mnInlineCreateTarget || _mnInlineCreateTarget.kind !== kind) return
  const { selectId, previousValue } = _mnInlineCreateTarget
  _mnInlineCreateTarget = null
  const sel = document.getElementById(selectId)
  if (sel) sel.value = previousValue
}

// Reconstruye el select combinado clientes+proveedores de Devengo,
// preservando las 2 opciones de creacion inline, y selecciona la
// entidad indicada (usado tras crear un cliente o proveedor nuevo
// desde ese mismo select).
function _repoblarDevengoContacto(selectId, selectedId) {
  const sel = document.getElementById(selectId)
  if (!sel) return
  const clis = (S.clientes||[]).map(c => `<option value="${c.id}">👥 ${c.nombre}</option>`).join('')
  const pros = (S.proveedores||[]).map(p => `<option value="${p.id}">🏭 ${p.nombre}</option>`).join('')
  sel.innerHTML = '<option value="">Sin asociar</option>' + clis + pros +
    '<option value="__create_new_cliente__">+ Nuevo cliente</option>' +
    '<option value="__create_new_proveedor__">+ Nuevo proveedor</option>'
  sel.value = selectedId
  document.getElementById(selectId + '-dep-hint')?.remove()
}


// ─── INGRESO CRUD ───────────────────────────────────────────────
function resetIngresoForm() {
  document.getElementById('ingresoId').value = ''
  document.getElementById('ingresoModalTitle').textContent = t('modal_nuevo_ingreso')
  document.getElementById('ingresoConcepto').value = ''
  document.getElementById('ingresoImporte').value = ''
  document.getElementById('ingresoFecha').value = todayISO()
  document.getElementById('ingresoNotas').value = ''
  document.getElementById('ingresoRecurrente').checked = false
  document.getElementById('ingresoPendiente').checked = false
  document.getElementById('ingresoUpdateSaldo').checked = true
  poblarSelect('ingresoCat','ingreso')
  poblarCuentaSelect('ingresoCuenta')
  const cl = document.getElementById('ingresoClienteLink')
  if (cl) cl.value = ''
}
function editarIngreso(id) {
  const i = S.ingresos.find(x=>x.id===id)
  if (!i) return
  resetIngresoForm()
  document.getElementById('ingresoId').value = id
  document.getElementById('ingresoModalTitle').textContent = t('btn_editar') + ' ' + t('page_ingresos')
  document.getElementById('ingresoConcepto').value = i.concepto||''
  document.getElementById('ingresoImporte').value  = i.importe||''
  document.getElementById('ingresoFecha').value    = i.fecha||todayISO()
  document.getElementById('ingresoNotas').value    = i.notas||''
  document.getElementById('ingresoRecurrente').checked = !!i.recurrente
  document.getElementById('ingresoPendiente').checked  = i.status === 'pending'
  document.getElementById('ingresoUpdateSaldo').checked = false
  poblarSelect('ingresoCat','ingreso',i.categoria||'')
  poblarCuentaSelect('ingresoCuenta',i.cuentaId||'')
  openModal('ingresoModal')
}
function guardarIngreso() {
  if (!_formGuard.lock('ingresoModal')) return
  const _unlock = () => _formGuard.unlock('ingresoModal')
  const concepto = document.getElementById('ingresoConcepto').value.trim()
  const importe  = parseAmount(document.getElementById('ingresoImporte').value)
  if (!concepto || !importe || importe <= 0) { toast(t('err_concepto_importe'),'error'); _unlock(); return }
  const cuentaId   = document.getElementById('ingresoCuenta').value || null
  if (!cuentaId && S.cuentas.length > 0) { toast(t('err_selecciona_cuenta'),'error'); _unlock(); return }
  const cat        = getOrCreateCat('ingresoCat','ingresoCatCustomInput','ingreso') || S.categorias.ingreso[0]
  const fecha      = document.getElementById('ingresoFecha').value || todayISO()
  const updateSaldo= document.getElementById('ingresoUpdateSaldo').checked
  const pending    = document.getElementById('ingresoPendiente')?.checked || false
  const id         = document.getElementById('ingresoId').value
  const base = {
    concepto, importe, categoria: cat, fecha,
    notas:      document.getElementById('ingresoNotas').value.trim(),
    recurrente: document.getElementById('ingresoRecurrente').checked,
    status:     pending ? 'pending' : 'paid',
    cuentaId
  }
  if (id) {
    const idx = S.ingresos.findIndex(x=>x.id===id)
    // _afectaSaldo NO se toca aqui a proposito — ver el mismo comentario
    // en guardarGasto(): el checkbox se fuerza a false al editar, asi que
    // no refleja si la transaccion afecto el saldo cuando se CREO.
    // _needsReview se limpia siempre: editar y guardar desde el
    // formulario normal es en si mismo una revision consciente de la
    // transaccion (incluida su categoria), manteniendo la consistencia
    // con el Centro de Revision.
    if (idx>=0) S.ingresos[idx] = {...S.ingresos[idx], ...base, _needsReview: false}
  } else {
    const clienteId = window._ingresoClienteId || null
    window._ingresoClienteId = null
    S.ingresos.push({id:uid(), ...base, clienteId, _afectaSaldo: !!(updateSaldo && cuentaId && !pending)})
    if (updateSaldo && cuentaId && !pending) {
      const c = getCuenta(cuentaId)
      if (c) c.saldo = (Number(c.saldo)||0) + importe
    }
  }
  save()
  updateStreak()
  if (window.MNGamification) { MNGamification.checkAchievement('ingreso_added'); MNGamification.checkAchievement('data_check'); }
  // Clear month filter so all incomes are visible after saving
  if (!id) _ingMesFilter = ''
  closeModal('ingresoModal')
  _unlock()
  render()
  toast(t('toast_ingreso_guardado'))
  // Post-save modal (solo al CREAR, no al editar) — ofrece continuar
  // añadiendo con la misma fecha/cuenta/categoría, con otra fecha, o
  // cerrar. Sustituye por completo al viejo "Guardar y añadir otro".
  if (!id) _openPostSaveModal('ingreso')
}

// Reseteo PARCIAL para el modal post-guardado ("Misma fecha"): mantiene
// fecha y cuenta (lo mas util al introducir varias transacciones
// seguidas del mismo dia/cuenta), pero NUNCA copia importe, concepto ni
// categoria — cada transaccion debe introducirse explicitamente para
// evitar duplicados accidentales por descuido.
function _resetIngresoFormKeepingContext() {
  document.getElementById('ingresoId').value = ''
  document.getElementById('ingresoModalTitle').textContent = t('modal_nuevo_ingreso')
  document.getElementById('ingresoConcepto').value = ''
  document.getElementById('ingresoImporte').value = ''
  document.getElementById('ingresoNotas').value = ''
  document.getElementById('ingresoPendiente').checked = false
  poblarSelect('ingresoCat','ingreso')
  const concepto = document.getElementById('ingresoConcepto')
  if (concepto) concepto.focus()
}
// Reseteo COMPLETO para el modal post-guardado ("Otra fecha"): igual
// que el anterior, pero fecha y cuenta tambien vuelven a su valor por
// defecto — el usuario elige una fecha nueva libremente.
function _resetIngresoFormFull() {
  _resetIngresoFormKeepingContext()
  const fechaEl = document.getElementById('ingresoFecha')
  if (fechaEl) fechaEl.value = todayISO()
  const cuentaEl = document.getElementById('ingresoCuenta')
  if (cuentaEl) cuentaEl.selectedIndex = 0
}
// Unico punto de eliminacion de gastos/ingresos — usado tanto por el
// borrado individual (borrarGasto/borrarIngreso) como por el borrado en
// bloque (_gasBulkDelete/_ingBulkDelete), tal como pide la arquitectura:
// una sola fuente de verdad para eliminar transacciones y mantener el
// resto de datos financieros (saldo de cuenta, Net Worth, Dashboard,
// Analytics) correctamente sincronizados, sin duplicar la logica de
// recalculo entre el flujo individual y el flujo en bloque.
//
// ids: array de uno o mas ids a eliminar. tipo: 'gasto' | 'ingreso'.
function removeTransactions(ids, tipo) {
  if (!ids || !ids.length) return 0
  const idSet = new Set(ids)
  const list = tipo === 'ingreso' ? S.ingresos : S.gastos
  let removed = 0
  list.forEach(tx => {
    if (!idSet.has(tx.id)) return
    removed++
    if (!tx.cuentaId) return
    // Transacciones creadas tras este fix llevan el flag explicito
    // _afectaSaldo, que refleja exactamente si esa transaccion concreta
    // modifico el saldo al crearse. Para transacciones ya existentes sin
    // ese flag, se usa la mejor aproximacion posible con los datos
    // disponibles: si tenia cuenta asociada y no estaba pendiente de
    // cobro, se asume que si afecto el saldo (comportamiento por
    // defecto ya usado en el resto de la app). 'pendiente' (español) se
    // reconoce junto a 'pending' (ingles) porque los datos de demo
    // (loadDemoData, una ruta de generacion completamente distinta a
    // guardarIngreso) usan el status en español — sin esto, eliminar un
    // ingreso demo pendiente restaba incorrectamente su importe de un
    // saldo que nunca habia llegado a afectar.
    const PENDING_STATUSES = ['pending', 'pendiente']
    const afectaSaldo = tx._afectaSaldo !== undefined ? tx._afectaSaldo : !PENDING_STATUSES.includes(tx.status)
    if (!afectaSaldo) return
    const c = getCuenta(tx.cuentaId)
    if (!c) return
    // Gasto: al crearse RESTO del saldo -> al eliminar se SUMA de vuelta.
    // Ingreso: al crearse SUMO al saldo -> al eliminar se RESTA de vuelta.
    const importe = Number(tx.importe) || 0
    c.saldo = (Number(c.saldo) || 0) + (tipo === 'gasto' ? importe : -importe)
  })
  if (tipo === 'ingreso') S.ingresos = S.ingresos.filter(x => !idSet.has(x.id))
  else S.gastos = S.gastos.filter(x => !idSet.has(x.id))
  return removed
}

function borrarIngreso(id) {
  confirmar(t('confirm_eliminar_ingreso'), ()=>{
    removeTransactions([id], 'ingreso')
    save(); render(); toast(t('toast_ingreso_eliminado'))
  }, {titulo:t('confirm_eliminar_ingreso_titulo'),icono:'🗑️'})
}

// ─── GASTO CRUD ─────────────────────────────────────────────────
window._toggleRecurrenteDay = function() {
  const checked = document.getElementById('gastoRecurrente')?.checked
  const dayRow  = document.getElementById('gastoRecurrenteDay')
  if (dayRow) dayRow.style.display = checked ? 'block' : 'none'
}

function resetGastoForm() {
  document.getElementById('gastoId').value = ''
  document.getElementById('gastoModalTitle').textContent = t('modal_nuevo_gasto')
  document.getElementById('gastoConcepto').value = ''
  document.getElementById('gastoImporte').value = ''
  document.getElementById('gastoFecha').value = todayISO()
  document.getElementById('gastoNotas').value = ''
  document.getElementById('gastoRecurrente').checked = false
  document.getElementById('gastoUpdateSaldo').checked = true
  const dayRow = document.getElementById('gastoRecurrenteDay')
  if (dayRow) dayRow.style.display = 'none'
  const diaEl = document.getElementById('gastoRecurrenteDia')
  if (diaEl) diaEl.value = new Date().getDate()
  poblarSelect('gastoCat','gasto')
  poblarCuentaSelect('gastoCuenta')
  poblarProveedorSelect('gastoProveedor','')
  window._gastoProveedorId = null
}
function editarGasto(id) {
  const g = S.gastos.find(x=>x.id===id)
  if (!g) return
  resetGastoForm()
  document.getElementById('gastoId').value = id
  document.getElementById('gastoModalTitle').textContent = t('btn_editar') + ' ' + t('page_gastos')
  document.getElementById('gastoConcepto').value = g.concepto||''
  document.getElementById('gastoImporte').value = g.importe||''
  document.getElementById('gastoFecha').value = g.fecha||todayISO()
  document.getElementById('gastoNotas').value = g.notas||''
  document.getElementById('gastoRecurrente').checked = !!g.recurrente
  const dayRow = document.getElementById('gastoRecurrenteDay')
  if (dayRow) dayRow.style.display = g.recurrente ? 'block' : 'none'
  document.getElementById('gastoUpdateSaldo').checked = false
  poblarSelect('gastoCat','gasto',g.categoria||'')
  poblarCuentaSelect('gastoCuenta',g.cuentaId||'')
  poblarProveedorSelect('gastoProveedor',g.proveedorId||'')
  openModal('gastoModal')
}
function guardarGasto() {
  if (!_formGuard.lock('gastoModal')) return
  const _unlock = () => _formGuard.unlock('gastoModal')
  const concepto = document.getElementById('gastoConcepto').value.trim()
  const importe  = parseAmount(document.getElementById('gastoImporte').value)
  if (!concepto || !importe || importe <= 0) { toast('Concepto e importe requeridos','error'); _unlock(); return }
  const cuentaId   = document.getElementById('gastoCuenta').value || null
  if (!cuentaId && S.cuentas.length > 0) { toast(t('err_selecciona_cuenta'),'error'); _unlock(); return }
  const cat        = getOrCreateCat('gastoCat','gastoCatCustomInput','gasto') || S.categorias.gasto[0]
  const fecha      = document.getElementById('gastoFecha').value || todayISO()
  const updateSaldo= document.getElementById('gastoUpdateSaldo').checked
  const id         = document.getElementById('gastoId').value
  const provEl = document.getElementById('gastoProveedor')
  const proveedorId = provEl ? (provEl.value || window._gastoProveedorId || null) : (window._gastoProveedorId || null)
  window._gastoProveedorId = null
  const base = { concepto, importe, categoria:cat, fecha,
    notas: document.getElementById('gastoNotas').value.trim(),
    recurrente: document.getElementById('gastoRecurrente').checked,
    cuentaId, proveedorId }
  const _doSaveGasto = () => {
    if (id) {
      const idx = S.gastos.findIndex(x=>x.id===id)
      // _afectaSaldo NO se toca aqui a proposito: el checkbox 'Descontar
      // del saldo' siempre se muestra desmarcado al editar (el ajuste de
      // saldo nunca se re-aplica en una edicion), asi que su valor actual
      // no refleja si la transaccion afecto el saldo cuando se CREO. El
      // spread preserva el flag original ya guardado. _needsReview SI se
      // limpia siempre: editar y guardar es en si mismo una revision
      // consciente de la transaccion, manteniendo la consistencia con el
      // Centro de Revision.
      if (idx>=0) S.gastos[idx] = {...S.gastos[idx], ...base, _needsReview: false}
    } else {
      S.gastos.push({id:uid(), ...base, _afectaSaldo: !!(updateSaldo && cuentaId)})
      if (updateSaldo && cuentaId) {
        const c = getCuenta(cuentaId)
        if (c) c.saldo = (Number(c.saldo)||0) - importe
      }
    }
    save(); updateStreak(); if (window.MNGamification) { MNGamification.checkAchievement('gasto_added'); MNGamification.checkAchievement('data_check'); }
    // If recurrente + día del mes → register in MNRecurring for auto-add next month
    if (base.recurrente && !id && window.MNRecurring) {
      const dia = parseInt(document.getElementById('gastoRecurrenteDia')?.value) || new Date().getDate()
      try {
        MNRecurring.addRecurring({
          type: 'gasto', nombre: base.concepto, importe: base.importe,
          categoria: base.categoria, cuentaId: base.cuentaId,
          frecuencia: 'mensual', diaDelMes: dia, emoji: '💸'
        })
      } catch(e) {}
    }
    closeModal('gastoModal'); _unlock(); render(); toast(t('toast_gasto_guardado'))
    // Post-save modal (solo al CREAR) — sustituye al viejo "Guardar y
    // añadir otro".
    if (!id) _openPostSaveModal('gasto')
  }

  // Warn if operation would leave account in negative balance
  if (!id && updateSaldo && cuentaId) {
    const cuentaGasto = getCuenta(cuentaId)
    if (cuentaGasto && (Number(cuentaGasto.saldo)||0) < importe) {
      confirmar(
        '"' + cuentaGasto.nombre + '" ' + t('confirm_saldo_neg') + ' (' + eur((Number(cuentaGasto.saldo)||0) - importe) + ')',
        _doSaveGasto,
        {titulo:t('confirm_saldo_neg_titulo'), icono:'⚠️', btnLabel:t('confirm_saldo_neg_btn'), onCancel:_unlock}
      )
      return
    }
  }
  _doSaveGasto()
}

// Reseteo PARCIAL para el modal post-guardado ("Misma fecha"): mantiene
// fecha, cuenta y proveedor (utiles al introducir varias transacciones
// seguidas), pero NUNCA copia importe, concepto ni categoria.
function _resetGastoFormKeepingContext() {
  document.getElementById('gastoId').value = ''
  document.getElementById('gastoModalTitle').textContent = t('modal_nuevo_gasto')
  document.getElementById('gastoConcepto').value = ''
  document.getElementById('gastoImporte').value = ''
  document.getElementById('gastoNotas').value = ''
  poblarSelect('gastoCat','gasto')
  const concepto = document.getElementById('gastoConcepto')
  if (concepto) concepto.focus()
}
// Reseteo COMPLETO para el modal post-guardado ("Otra fecha"): igual
// que el anterior, pero fecha, cuenta y proveedor tambien vuelven a su
// valor por defecto.
function _resetGastoFormFull() {
  _resetGastoFormKeepingContext()
  const fechaEl = document.getElementById('gastoFecha')
  if (fechaEl) fechaEl.value = todayISO()
  const cuentaEl = document.getElementById('gastoCuenta')
  if (cuentaEl) cuentaEl.selectedIndex = 0
  const provEl = document.getElementById('gastoProveedor')
  if (provEl) provEl.selectedIndex = 0
  window._gastoProveedorId = null
}

// ─── MODAL POST-GUARDADO (ingreso/gasto) ─────────────────────────
// Sustituye al viejo botón "Guardar y añadir otro". Modal propio de
// MoneyNest (sin alert/confirm nativos), reutiliza el sistema central
// de scroll-lock. Mismo comportamiento para ingresos y gastos.
function _openPostSaveModal(tipo) {
  document.getElementById('postSaveOverlay')?.remove()
  const esIngreso = tipo === 'ingreso'
  const color = esIngreso ? 'var(--accent)' : 'var(--red)'
  const overlay = document.createElement('div')
  overlay.id = 'postSaveOverlay'
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-body" style="text-align:center;padding:28px 24px 20px">
        <div style="font-size:2rem;margin-bottom:10px">✓</div>
        <div style="font-size:1.05rem;font-weight:800;color:var(--text);margin-bottom:6px">${t('postsave_titulo','¿Qué quieres hacer ahora?')}</div>
        <div style="font-size:.82rem;color:var(--text2);margin-bottom:20px">${esIngreso ? t('postsave_sub_ingreso','Tu ingreso se ha guardado correctamente.') : t('postsave_sub_gasto','Tu gasto se ha guardado correctamente.')}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary btn-sm" style="width:100%;background:${color};border-color:${color}" onclick="_postSaveChoice('${tipo}','misma')">📅 ${t('postsave_misma_fecha','Crear otro con la misma fecha')}</button>
          <button class="btn btn-secondary btn-sm" style="width:100%" onclick="_postSaveChoice('${tipo}','otra')">🗓️ ${t('postsave_otra_fecha','Crear otro con otra fecha')}</button>
          <button class="btn btn-ghost btn-sm" style="width:100%" onclick="_postSaveChoice('${tipo}','cerrar')">${t('btn_cerrar','Cerrar')}</button>
        </div>
      </div>
    </div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  _pushScrollLock()
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _postSaveChoice(tipo, 'cerrar') })
}

function _postSaveChoice(tipo, choice) {
  const overlay = document.getElementById('postSaveOverlay')
  if (overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 200) }
  _popScrollLock()

  if (choice === 'cerrar') return

  const modalId = tipo === 'ingreso' ? 'ingresoModal' : 'gastoModal'
  if (choice === 'misma') {
    if (tipo === 'ingreso') _resetIngresoFormKeepingContext(); else _resetGastoFormKeepingContext()
  } else {
    if (tipo === 'ingreso') _resetIngresoFormFull(); else _resetGastoFormFull()
  }
  openModal(modalId)
}

function borrarGasto(id) {
  confirmar(t('confirm_eliminar_gasto'), ()=>{
    removeTransactions([id], 'gasto')
    if (window.MNGamification) MNGamification.checkAchievement('gasto_deleted')
    save(); render(); toast(t('toast_gasto_eliminado'))
  }, {titulo:t('confirm_eliminar_gasto_titulo'),icono:'🗑️'})
}

// ─── INVERSION CRUD ─────────────────────────────────────────────
function resetInvForm() {
  document.getElementById('invId').value = ''
  document.getElementById('invModalTitle').textContent = t('modal_nueva_inv')
  document.getElementById('invNombre').value = ''
  document.getElementById('invImporte').value = ''
  document.getElementById('invRentabilidad').value = ''
  document.getElementById('invFecha').value = todayISO()
  document.getElementById('invNotas').value = ''
  // cuenta required - saldo update is automatic
  poblarSelect('invCat','inversion')
  poblarCuentaSelect('invCuenta')
  toggleInvRoi()
  setTimeout(mostrarSaldoCuenta, 50)
}

/** Muestra/oculta campo de rentabilidad esperada según si el activo es volátil */
function toggleInvRoi() {
  const sel   = document.getElementById('invCat')
  const group = document.getElementById('invRoiGroup')
  if (!sel || !group) return
  const cat     = sel.value
  const volatile_ = VOLATILE_CATS.includes(cat) || cat === '__custom__'
  group.style.display = volatile_ ? 'none' : 'block'
  if (volatile_) {
    const inp = document.getElementById('invRentabilidad')
    if (inp) inp.value = ''
  }
}
function editarInversion(id) {
  const i = S.inversiones.find(x=>x.id===id)
  if (!i) return
  resetInvForm()
  document.getElementById('invId').value = id
  document.getElementById('invModalTitle').textContent = t('btn_editar') + ' ' + t('page_inversiones')
  document.getElementById('invNombre').value    = i.nombre||''
  document.getElementById('invImporte').value   = i.importe||''
  document.getElementById('invRentabilidad').value = i.rentabilidad||''
  document.getElementById('invFecha').value     = i.fecha||todayISO()
  document.getElementById('invNotas').value     = i.notas||''
  // editing - no saldo update needed
  poblarSelect('invCat','inversion',i.categoria||'')
  poblarCuentaSelect('invCuenta',i.cuentaId||'')
  toggleInvRoi()
  openModal('inversionModal')
}
function guardarInversion() {
  if (!_formGuard.lock('inversionModal')) return
  const _unlock = () => _formGuard.unlock('inversionModal')
  const nombre = document.getElementById('invNombre').value.trim()
  const importe = parseAmount(document.getElementById('invImporte').value)
  if (!nombre || !importe || importe <= 0) { toast(t('err_nombre_importe'),'error'); _unlock(); return }
  const cuentaId = document.getElementById('invCuenta').value || null
  const id = document.getElementById('invId').value

  if (!id && !cuentaId && S.cuentas.length > 0) { toast(t('err_selecciona_cuenta'),'error'); _unlock(); return }

  const cat = getOrCreateCat('invCat','invCatCustomInput','inversion') || S.categorias.inversion[0]
  const rentabilidad = parseAmount(document.getElementById('invRentabilidad').value)||0
  const fecha = document.getElementById('invFecha').value||todayISO()
  const notas = document.getElementById('invNotas').value.trim()

  const _doSaveInv = () => {
    if (id) {
      const idx = S.inversiones.findIndex(x=>x.id===id)
      if (idx>=0) S.inversiones[idx] = {...S.inversiones[idx],nombre,importe,rentabilidad,categoria:cat,fecha,notas,cuentaId}
    } else {
      S.inversiones.push({id:uid(),nombre,importe,rentabilidad,categoria:cat,fecha,notas,cuentaId,cerrada:false})
      const cuentaOrigen = getCuenta(cuentaId)
      if (cuentaOrigen) cuentaOrigen.saldo = (Number(cuentaOrigen.saldo)||0) - importe
    }
    save(); if (window.MNGamification) MNGamification.checkAchievement('inversion_added'); closeModal('inversionModal'); _unlock(); render(); toast(t('toast_inversion_guardada'))
  }

  // Warn if operation would leave account in negative balance
  if (!id && cuentaId) {
    const cuentaInv = getCuenta(cuentaId)
    if (cuentaInv && (Number(cuentaInv.saldo)||0) < importe) {
      confirmar(
        'Esta operación dejará la cuenta "' + cuentaInv.nombre + '" con saldo negativo (' +
        eur((Number(cuentaInv.saldo)||0) - importe) + '). ¿Deseas continuar?',
        _doSaveInv,
        {titulo:'⚠️ Saldo insuficiente', icono:'⚠️', btnLabel:'Continuar igualmente', onCancel:_unlock}
      )
      return
    }
  }
  _doSaveInv()
}
function borrarInversion(id) {
  const inv = S.inversiones.find(x=>x.id===id)
  if (!inv) return
  const msg = inv.cerrada
    ? t('confirm_eliminar_inversion')
    : t('confirm_eliminar_inversion') + ' "' + inv.nombre + '"'
  confirmar(msg, ()=>{
    // Devolver capital a la cuenta si la inversión estaba abierta
    if (!inv.cerrada && inv.cuentaId) {
      const cuenta = getCuenta(inv.cuentaId)
      if (cuenta) {
        cuenta.saldo = (Number(cuenta.saldo)||0) + (Number(inv.importe)||0)
      }
    }
    // Eliminar en cascada TODOS los beneficios retirados asociados y
    // los ingresos que generaron — nunca deben quedar ingresos
    // huerfanos apuntando a una inversion que ya no existe.
    const beneficios = inv.beneficiosRetirados || []
    const incomeIdsToRemove = new Set(beneficios.map(b => b.incomeId).filter(Boolean))
    if (incomeIdsToRemove.size > 0) {
      // Revertir el saldo que cada beneficio habia añadido a su cuenta
      beneficios.forEach(b => {
        if (!b.incomeId) return // beneficio antiguo sin relacion estable — no se puede revertir con seguridad
        const c = getCuenta(b.cuentaId)
        if (c) c.saldo = (Number(c.saldo)||0) - (Number(b.importe)||0)
      })
      S.ingresos = S.ingresos.filter(i => !incomeIdsToRemove.has(i.id))
    }
    S.inversiones = S.inversiones.filter(x=>x.id!==id)
    save(); render()
    toast(inv.cerrada ? t('toast_inversion_eliminada') : t('toast_inversion_eliminada') + ' · ' + eur(inv.importe) + ' devueltos')
  }, {titulo:t('confirm_eliminar_inversion_titulo'), icono:'🗑️', btnLabel:t('btn_eliminar')})
}

// ─── LIQUIDACION ────────────────────────────────────────────────
function abrirLiquidar(id) {
  const inv = S.inversiones.find(x=>x.id===id)
  if (!inv) { toast(t('err_inversion_no_encontrada'),'error'); return }
  // Task 2: guard — already liquidated investments cannot be re-liquidated
  if (inv.cerrada || inv.status === 'liquidated') {
    toast(t('inversion_ya_liquidada') + ' ' + (inv.liquidatedAt || inv.fechaCierre || '—'), 'error')
    return
  }
  document.getElementById('liqInvId').value = id
  document.getElementById('liqValor').value = ''
  document.getElementById('liqRentPct').value = ''
  document.getElementById('liqPreview').style.display = 'none'
  poblarCuentaSelect('liqCuenta', inv.cuentaId||'')
  document.getElementById('liqInvInfo').innerHTML = `
    <div style="background:var(--bg2);border-radius:var(--radius-sm);padding:12px 14px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <strong style="color:var(--text);font-size:.95rem">${inv.nombre}</strong>
          <div style="font-size:.78rem;color:var(--text2);margin-top:3px">
            Capital: <strong style="color:var(--accent)">${eur(inv.importe)}</strong> · 
            Cuenta: <strong style="color:var(--text)">${getCuenta(inv.cuentaId)?.nombre || 'Sin cuenta'}</strong>
          </div>
        </div>
        <span class="badge badge-gold">${catEmoji(inv.categoria)} ${inv.categoria||'—'}</span>
      </div>
    </div>`
  openModal('liquidarModal')
}
function syncLiq(from) {
  const inv = S.inversiones.find(x=>x.id===document.getElementById('liqInvId').value)
  if (!inv) return
  const importe = Number(inv.importe)||0
  // toFixed (dot decimal) is fine here — parseAmount() accepts both dot and comma when read back
  if (from === 'valor') {
    const val = parseAmount(document.getElementById('liqValor').value)||0
    if (importe > 0) document.getElementById('liqRentPct').value = (((val-importe)/importe)*100).toFixed(2)
  } else {
    const pctVal = parseAmount(document.getElementById('liqRentPct').value)||0
    document.getElementById('liqValor').value = (importe*(1+pctVal/100)).toFixed(2)
  }
  updateLiqPreview()
}
function updateLiqPreview() {
  const inv = S.inversiones.find(x=>x.id===document.getElementById('liqInvId').value)
  if (!inv) return
  const valorFinal = parseAmount(document.getElementById('liqValor').value)||0
  const importe = Number(inv.importe)||0
  if (!valorFinal) { document.getElementById('liqPreview').style.display='none'; return }

  const beneficiosRetirados = (inv.beneficiosRetirados || []).reduce((sum, b) => sum + Number(b.importe), 0)
  const ganancia = valorFinal - importe                          // ganancia/pérdida del precio
  const gananciaTotal = ganancia + beneficiosRetirados           // beneficio real total de la inversión
  const pendienteRegistrar = ganancia - beneficiosRetirados      // lo que se registrará ahora como ingreso/gasto
  // ROI sobre capital total: (precio final - precio entrada + ya retirado) / capital
  const roiReal = importe ? (gananciaTotal / importe) * 100 : 0
  const totalColor = gananciaTotal >= 0 ? 'var(--green)' : 'var(--red)'
  const pendColor  = pendienteRegistrar >= 0 ? 'var(--green)' : 'var(--red)'

  document.getElementById('liqPreview').style.display = 'block'
  document.getElementById('liqPreview').innerHTML = `
    <div class="liq-preview-row"><span>Capital inicial</span><span>${eur(importe)}</span></div>
    <div class="liq-preview-row"><span>Valor de salida</span><span>${eur(valorFinal)}</span></div>
    ${beneficiosRetirados > 0 ? `
      <div class="liq-preview-row"><span>Beneficios ya retirados</span><span style="color:var(--green)">+${eur(beneficiosRetirados)}</span></div>
    ` : ''}
    <hr class="liq-preview-divider">
    <div class="liq-preview-row liq-ganancia">
      <span><strong>Beneficio total real</strong></span>
      <span style="color:${totalColor}"><strong>${gananciaTotal>=0?'+':''}${eur(gananciaTotal)}</strong></span>
    </div>
    <div class="liq-preview-row"><span>ROI total</span><span style="color:${totalColor}">${roiReal>=0?'+':''}${pct(roiReal)}</span></div>
    ${beneficiosRetirados > 0 && pendienteRegistrar !== 0 ? `
      <div class="liq-preview-row" style="margin-top:6px;font-size:.78rem;color:var(--text2)">
        <span>${pendienteRegistrar > 0 ? 'Ganancia adicional a registrar' : 'Pérdida a registrar'}</span>
        <span style="color:${pendColor}">${pendienteRegistrar>=0?'+':''}${eur(pendienteRegistrar)}</span>
      </div>
    ` : beneficiosRetirados > 0 ? `
      <div class="liq-preview-row" style="margin-top:6px;font-size:.78rem;color:var(--text2)">
        <span>✓ Toda la ganancia ya fue retirada</span>
        <span style="color:var(--text3)">—</span>
      </div>
    ` : ''}`
}
function spawnMoneyParticles(x, y) {
  const emojis = ['💰','✨','📈','🤑','💵']
  for (let i = 0; i < 7; i++) {
    const el = document.createElement('div')
    el.className = 'money-particle'
    el.textContent = emojis[i % emojis.length]
    el.style.left = (x + (Math.random()-0.5)*80) + 'px'
    el.style.top  = (y + (Math.random()-0.5)*40) + 'px'
    el.style.animationDelay = (i * 0.07) + 's'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1200)
  }
}

function confirmarLiquidacion() {
  const id = document.getElementById('liqInvId').value
  const inv = S.inversiones.find(x=>x.id===id)
  if (!inv) { toast('Inversión no encontrada','error'); return }
  const valorFinal = parseAmount(document.getElementById('liqValor').value)
  if (!valorFinal || valorFinal <= 0) { toast(t('err_valor_salida'),'error'); return }
  const ganancia = valorFinal - Number(inv.importe)
  const roiReal = inv.importe ? (ganancia/Number(inv.importe))*100 : 0
  const cuentaId = document.getElementById('liqCuenta').value
  if (!cuentaId) { toast(t('err_cuenta_origen'),'error'); return }
  const cuenta = getCuenta(cuentaId)
  if (!cuenta) { toast(t('err_cuenta_no_encontrada'),'error'); return }

  // 1) Return full value to account
  cuenta.saldo = (Number(cuenta.saldo)||0) + valorFinal

  // 2) Register only the REMAINING gain (total gain minus already-withdrawn benefits).
  // beneficiosRetirados were already booked as income when withdrawn — don't double-count.
  const beneficiosRetirados = (inv.beneficiosRetirados || []).reduce((sum, b) => sum + Number(b.importe), 0)
  const gananciaFinal = ganancia - beneficiosRetirados // Only book the portion not yet realized

  if (gananciaFinal > 0) {
    S.ingresos.push({
      id: uid(), concepto: '💰 Ganancia final: ' + inv.nombre,
      importe: gananciaFinal, categoria: 'Dividendos',
      fecha: todayISO(), cuentaId,
      notas: `ROI real: ${pct(roiReal)} · Capital: ${eur(Number(inv.importe))}${beneficiosRetirados > 0 ? ` · Ya retirado previamente: ${eur(beneficiosRetirados)}` : ''}`
    })
  } else if (gananciaFinal < 0) {
    S.gastos.push({
      id: uid(), concepto: '📉 Pérdida final: ' + inv.nombre,
      importe: Math.abs(gananciaFinal), categoria: 'Otro',
      fecha: todayISO(), cuentaId,
      notas: `ROI real: ${pct(roiReal)} · Capital: ${eur(Number(inv.importe))}${beneficiosRetirados > 0 ? ` · Ya retirado previamente: ${eur(beneficiosRetirados)}` : ''}`
    })
  }

  // 3) Task 2: Mark as liquidated instead of deleting — preserves history
  const idx = S.inversiones.findIndex(x=>x.id===id)
  if (idx !== -1) {
    S.inversiones[idx] = {
      ...S.inversiones[idx],
      cerrada: true,                   // backward compat flag kept
      status: 'liquidated',            // new explicit status field
      liquidatedAt: todayISO(),        // when it was closed
      liquidationAmount: valorFinal,   // exit value
      profit: ganancia,                // realized gain/loss
      roiReal,
      valorFinal,
      ganancia,
      fechaCierre: todayISO(),
    }
  }

  save(); closeModal('liquidarModal'); render()
  toast(`${t('toast_inversion_liquidada')} · ${ganancia>=0?'+':''}${eur(ganancia)} · ROI ${ganancia>=0?'+':''}${pct(roiReal)}`)
  if (window.MNGamification) {
    MNGamification.checkAchievement('inversion_liquidada')
  }
  setTimeout(() => {
    const rect = document.querySelector('.btn-primary')?.getBoundingClientRect()
    if (rect) spawnMoneyParticles(rect.left + rect.width/2, rect.top)
  }, 100)
}

// ─── REVALORIZAR / BENEFICIO ────────────────────────────────────
window.cambiarTipoRev = function(tipo) {
  const btnReval = document.getElementById('revTipoRevalBtn')
  const btnBenef = document.getElementById('revTipoBenefBtn')
  const formReval = document.getElementById('revFormRevalorizacion')
  const formBenef = document.getElementById('revFormBeneficio')

  if (tipo === 'revalorizacion') {
    btnReval.style.background = 'var(--accent-dim)'
    btnReval.style.color = 'var(--accent)'
    btnReval.style.borderColor = 'var(--accent)'
    btnBenef.style.background = 'var(--border)'
    btnBenef.style.color = 'var(--text2)'
    btnBenef.style.borderColor = 'var(--border2)'
    formReval.style.display = 'block'
    formBenef.style.display = 'none'
  } else {
    btnBenef.style.background = 'var(--green-dim)'
    btnBenef.style.color = 'var(--green)'
    btnBenef.style.borderColor = 'var(--green)'
    btnReval.style.background = 'var(--border)'
    btnReval.style.color = 'var(--text2)'
    btnReval.style.borderColor = 'var(--border2)'
    formBenef.style.display = 'block'
    formReval.style.display = 'none'
  }
  window._revTipo = tipo
}

function abrirRevalorizar(id) {
  const inv = S.inversiones.find(x=>x.id===id)
  if (!inv) { toast(t('err_inversion_no_encontrada'),'error'); return }
  if (inv.cerrada) {
    toast(t('inversion_ya_liquidada') + ' ' + (inv.fechaCierre || '—'), 'error')
    return
  }

  const valorActual = inv.revalorizaciones && inv.revalorizaciones.length > 0
    ? inv.revalorizaciones[inv.revalorizaciones.length - 1].valor
    : Number(inv.importe)

  const beneficiosRetirados = inv.beneficiosRetirados || []
  const totalBeneficios = beneficiosRetirados.reduce((sum, b) => sum + Number(b.importe), 0)

  document.getElementById('revInvId').value = id
  document.getElementById('revValor').value = ''
  document.getElementById('revFecha').value = todayISO()
  document.getElementById('revNotas').value = ''
  document.getElementById('revBeneficio').value = ''
  document.getElementById('revBeneficioFecha').value = todayISO()
  document.getElementById('revBeneficioNotas').value = ''
  poblarCuentaSelect('revBeneficioCuenta', inv.cuentaId || '')

  window._revTipo = 'revalorizacion'
  cambiarTipoRev('revalorizacion')

  document.getElementById('revInvInfo').innerHTML = `
    <div style="background:var(--bg2);border-radius:var(--radius-sm);padding:12px 14px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <strong style="color:var(--text);font-size:.95rem">${inv.nombre}</strong>
          <div style="font-size:.78rem;color:var(--text2);margin-top:3px">
            Capital inicial: <strong style="color:var(--accent)">${eur(inv.importe)}</strong> ·
            Valor actual: <strong style="color:${valorActual >= Number(inv.importe) ? 'var(--green)' : 'var(--red)'}">${eur(valorActual)}</strong>
          </div>
        </div>
        <span class="badge badge-gold">${catEmoji(inv.categoria)} ${inv.categoria||'—'}</span>
      </div>
    </div>`

  // Mostrar historial combinado (revalorizaciones + beneficios)
  const revalorizaciones = inv.revalorizaciones || []
  const beneficios = inv.beneficiosRetirados || []
  const totalOperaciones = revalorizaciones.length + beneficios.length

  if (totalOperaciones > 0) {
    // Combinar y ordenar por fecha
    const historial = [
      ...revalorizaciones.map(r => ({ tipo: 'revalorizacion', fecha: r.fecha, data: r })),
      ...beneficios.map(b => ({ tipo: 'beneficio', fecha: b.fecha, data: b }))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    document.getElementById('revHistorial').innerHTML = `
      <div style="font-size:.75rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">📊 Historial (${totalOperaciones})</div>
      <div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
        ${historial.map(item => {
          if (item.tipo === 'revalorizacion') {
            const r = item.data
            const idx = revalorizaciones.indexOf(r)
            const prevVal = idx === 0 ? Number(inv.importe) : revalorizaciones[idx - 1].valor
            const cambio = r.valor - prevVal
            return `
              <div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:.78rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <strong style="color:var(--text)">📊 ${fmtDate(r.fecha)}</strong>
                  <strong style="color:${r.valor >= prevVal ? 'var(--green)' : 'var(--red)'}">${eur(r.valor)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text3)">
                  <span>${cambio >= 0 ? '+' : ''}${eur(cambio)} (${cambio >= 0 ? '+' : ''}${pct((cambio/prevVal)*100)})</span>
                  ${r.notas ? `<span style="font-style:italic;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notas}</span>` : ''}
                </div>
              </div>`
          } else {
            const b = item.data
            return `
              <div style="background:rgba(0,212,170,.04);border:1px solid rgba(0,212,170,.2);border-radius:6px;padding:8px 10px;font-size:.78rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
                  <strong style="color:var(--green)">💰 ${fmtDate(b.fecha)}</strong>
                  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    <strong style="color:var(--green)">+${eur(b.importe)}</strong>
                    ${b.id ? `
                      <button onclick="event.stopPropagation();editarBeneficioRetirado('${inv.id}','${b.id}')" title="${t('btn_editar','Editar')}" style="background:transparent;border:none;color:var(--text3);cursor:pointer;padding:2px;font-size:.85rem">✏️</button>
                      <button onclick="event.stopPropagation();eliminarBeneficioRetirado('${inv.id}','${b.id}')" title="${t('btn_eliminar','Eliminar')}" style="background:transparent;border:none;color:var(--text3);cursor:pointer;padding:2px;font-size:.85rem">🗑️</button>
                    ` : ''}
                  </div>
                </div>
                <div style="font-size:.72rem;color:var(--text3)">
                  ${b.concepto || 'Beneficio retirado'}
                </div>
              </div>`
          }
        }).join('')}
      </div>`
  } else {
    document.getElementById('revHistorial').innerHTML = `
      <div style="font-size:.8rem;color:var(--text3);text-align:center;padding:12px">
        Sin operaciones registradas aún
      </div>`
  }

  openModal('revalorizarModal')
}

function confirmarRevalorizacion() {
  const id = document.getElementById('revInvId').value
  const inv = S.inversiones.find(x=>x.id===id)
  if (!inv) { toast('Inversión no encontrada','error'); return }

  const tipo = window._revTipo || 'revalorizacion'

  if (tipo === 'revalorizacion') {
    // Revalorización normal
    const nuevoValor = parseAmount(document.getElementById('revValor').value)
    if (!nuevoValor || nuevoValor <= 0) { toast(t('err_valor_salida'),'error'); return }

    const fecha = document.getElementById('revFecha').value || todayISO()
    const notas = document.getElementById('revNotas').value.trim()

    if (!inv.revalorizaciones) inv.revalorizaciones = []
    inv.revalorizaciones.push({
      fecha,
      valor: nuevoValor,
      notas,
      timestamp: Date.now()
    })

    inv.revalorizaciones.sort((a,b) => new Date(a.fecha) - new Date(b.fecha))

    const valorPrevio = inv.revalorizaciones.length > 1
      ? inv.revalorizaciones[inv.revalorizaciones.length - 2].valor
      : Number(inv.importe)
    const cambio = nuevoValor - valorPrevio
    const pctCambio = valorPrevio > 0 ? (cambio / valorPrevio) * 100 : 0

    save(); closeModal('revalorizarModal'); render()

    if (currentPage === 'inversiones') {
      setTimeout(() => renderChartInvROI(), 150)
    }

    const signo = cambio >= 0 ? '+' : ''
    toast(`📊 ${t('toast_revalorizacion_guardada','Revalorización guardada')} · ${signo}${eur(cambio)} (${signo}${pct(pctCambio)})`, cambio >= 0 ? 'success' : 'warning')
    if (window.MNGamification) MNGamification.checkAchievement('revalorizacion_done')

  } else {
    // Retiro de beneficio
    const importe = parseAmount(document.getElementById('revBeneficio').value)
    if (!importe || importe <= 0) { toast('Introduce un importe válido','error'); return }

    const cuentaId = document.getElementById('revBeneficioCuenta').value
    if (!cuentaId) { toast('Selecciona una cuenta destino','error'); return }

    const fecha = document.getElementById('revBeneficioFecha').value || todayISO()
    const concepto = document.getElementById('revBeneficioNotas').value.trim() || 'Beneficio retirado'

    // Guardar beneficio retirado — con IDs estables, nunca basado en
    // texto: el beneficio referencia su ingreso (incomeId) y el ingreso
    // referencia de vuelta la inversion y el beneficio. Esto es lo que
    // permite editar/eliminar sin depender del nombre del activo.
    if (!inv.beneficiosRetirados) inv.beneficiosRetirados = []
    const beneficioId = uid()
    const incomeId = uid()
    inv.beneficiosRetirados.push({
      id: beneficioId,
      incomeId,
      fecha,
      importe,
      concepto,
      cuentaId,
      timestamp: Date.now()
    })

    // Añadir dinero a la cuenta
    const cuenta = getCuenta(cuentaId)
    if (cuenta) {
      cuenta.saldo = (Number(cuenta.saldo)||0) + importe
    }

    // Registrar como ingreso, vinculado de forma estable a la inversion
    // y al beneficio (no solo por el nombre del activo en el texto)
    S.ingresos.push({
      id: incomeId,
      concepto: `💰 ${concepto}: ${inv.nombre}`,
      importe,
      categoria: 'Dividendos',
      fecha,
      cuentaId,
      notas: `Beneficio parcial de inversión (${inv.categoria})`,
      _investmentId: inv.id,
      _profitWithdrawalId: beneficioId
    })

    save(); closeModal('revalorizarModal'); render()

    if (currentPage === 'inversiones') {
      setTimeout(() => renderChartInvROI(), 150)
    }

    toast(`💰 ${t('beneficio_retirado','Beneficio retirado')} · +${eur(importe)}`, 'success')
  }
}

// ─── EDITAR / ELIMINAR BENEFICIO RETIRADO ─────────────────────────
// Modelo: cada beneficio tiene un id propio y un incomeId estable que
// lo vincula a SU ingreso — nunca se busca por nombre/texto. Editar
// actualiza el mismo ingreso (nunca crea uno nuevo); eliminar borra
// ambos y revierte el saldo de cuenta afectado.

function editarBeneficioRetirado(invId, beneficioId) {
  const inv = S.inversiones.find(x => x.id === invId)
  if (!inv) { toast(t('err_inversion_no_encontrada'), 'error'); return }
  const b = (inv.beneficiosRetirados || []).find(x => x.id === beneficioId)
  if (!b) { toast('Beneficio no encontrado', 'error'); return }

  document.getElementById('editBeneficioOverlay')?.remove()
  const cuentasOptions = S.cuentas.map(c => `<option value="${c.id}" ${c.id===b.cuentaId?'selected':''}>${c.nombre}</option>`).join('')

  const overlay = document.createElement('div')
  overlay.id = 'editBeneficioOverlay'
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <span class="modal-title">✏️ ${t('modal_editar_beneficio','Editar beneficio')}</span>
        <button class="modal-close" onclick="document.getElementById('editBeneficioOverlay').remove();_popScrollLock()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.8rem;color:var(--text2);margin-bottom:14px">${inv.nombre}</div>
        <div class="form-group">
          <label>${t('importe_lbl','Importe (€)')} *</label>
          <input type="text" inputmode="decimal" id="editBeneficioImporte" value="${b.importe}" oninput="_sanitizeAmountInput(this)" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>${t('modal_liquidar_cuenta_lbl','Cuenta donde ingresar')}</label>
          <select id="editBeneficioCuenta">${cuentasOptions}</select>
        </div>
        <div class="form-group">
          <label>${t('fecha_lbl','Fecha')}</label>
          <input type="date" id="editBeneficioFecha" value="${b.fecha}">
        </div>
        <div class="form-group">
          <label>${t('notas_lbl','Notas')}</label>
          <input type="text" id="editBeneficioConcepto" value="${(b.concepto||'').replace(/"/g,'&quot;')}" placeholder="Beneficio retirado">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('editBeneficioOverlay').remove();_popScrollLock()">${t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="guardarEdicionBeneficio('${invId}','${beneficioId}')">${t('btn_guardar','Guardar')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  _pushScrollLock()
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); _popScrollLock() } })
}

function guardarEdicionBeneficio(invId, beneficioId) {
  const inv = S.inversiones.find(x => x.id === invId)
  if (!inv) return
  const idx = (inv.beneficiosRetirados || []).findIndex(x => x.id === beneficioId)
  if (idx < 0) return
  const b = inv.beneficiosRetirados[idx]

  const nuevoImporte = parseAmount(document.getElementById('editBeneficioImporte').value)
  if (!nuevoImporte || nuevoImporte <= 0) { toast('Introduce un importe válido', 'error'); return }
  const nuevaCuentaId = document.getElementById('editBeneficioCuenta').value
  const nuevaFecha = document.getElementById('editBeneficioFecha').value || b.fecha
  const nuevoConcepto = document.getElementById('editBeneficioConcepto').value.trim() || 'Beneficio retirado'

  // Revertir el ajuste de saldo ANTERIOR (cuenta e importe viejos)
  // antes de aplicar el nuevo — incluso si la cuenta destino cambió.
  const cuentaVieja = getCuenta(b.cuentaId)
  if (cuentaVieja) cuentaVieja.saldo = (Number(cuentaVieja.saldo)||0) - (Number(b.importe)||0)
  const cuentaNueva = getCuenta(nuevaCuentaId)
  if (cuentaNueva) cuentaNueva.saldo = (Number(cuentaNueva.saldo)||0) + nuevoImporte

  // Actualizar el beneficio
  inv.beneficiosRetirados[idx] = { ...b, importe: nuevoImporte, cuentaId: nuevaCuentaId, fecha: nuevaFecha, concepto: nuevoConcepto }

  // Actualizar el MISMO ingreso vinculado — nunca crea uno nuevo. Si el
  // beneficio es antiguo y no tiene incomeId (datos previos a esta
  // funcionalidad), no hay ingreso que sincronizar con seguridad.
  if (b.incomeId) {
    const income = S.ingresos.find(i => i.id === b.incomeId)
    if (income) {
      income.importe = nuevoImporte
      income.cuentaId = nuevaCuentaId
      income.fecha = nuevaFecha
      income.concepto = `💰 ${nuevoConcepto}: ${inv.nombre}`
    }
  }

  document.getElementById('editBeneficioOverlay')?.remove()
  _popScrollLock()
  save(); render()
  if (currentPage === 'inversiones') setTimeout(() => renderChartInvROI(), 150)
  if (document.getElementById('revalorizarModal')?.classList.contains('open')) abrirRevalorizar(invId)
  toast('✓ Beneficio actualizado')
}

function eliminarBeneficioRetirado(invId, beneficioId) {
  const inv = S.inversiones.find(x => x.id === invId)
  if (!inv) return
  const b = (inv.beneficiosRetirados || []).find(x => x.id === beneficioId)
  if (!b) return

  confirmar('¿Eliminar este beneficio retirado? El ingreso asociado también se eliminará.', () => {
    // Revertir el saldo que este beneficio había añadido
    const cuenta = getCuenta(b.cuentaId)
    if (cuenta) cuenta.saldo = (Number(cuenta.saldo)||0) - (Number(b.importe)||0)

    // Eliminar el ingreso vinculado — nunca queda huérfano
    if (b.incomeId) S.ingresos = S.ingresos.filter(i => i.id !== b.incomeId)

    inv.beneficiosRetirados = (inv.beneficiosRetirados || []).filter(x => x.id !== beneficioId)

    save(); render()
    if (currentPage === 'inversiones') setTimeout(() => renderChartInvROI(), 150)
    if (document.getElementById('revalorizarModal')?.classList.contains('open')) abrirRevalorizar(invId)
    toast('Beneficio eliminado')
  }, { titulo: 'Eliminar beneficio', icono: '🗑️', btnLabel: t('btn_eliminar','Eliminar') })
}

// ─── DEUDA CRUD ─────────────────────────────────────────────────
function resetDeudaForm() {
  document.getElementById('deudaId').value = ''
  document.getElementById('deudaModalTitle').textContent = t('modal_nueva_deuda')
  document.getElementById('deudaNombre').value = ''
  document.getElementById('deudaTotal').value = ''
  document.getElementById('deudaPagado').value = ''
  document.getElementById('deudaInteres').value = ''
  document.getElementById('deudaVencimiento').value = ''
  document.getElementById('deudaNotas').value = ''
  poblarSelect('deudaCat','deuda')
}
function editarDeuda(id) {
  const d = S.deudas.find(x=>x.id===id)
  if (!d) return
  resetDeudaForm()
  document.getElementById('deudaId').value = id
  document.getElementById('deudaModalTitle').textContent = t('btn_editar') + ' ' + t('page_deudas')
  document.getElementById('deudaNombre').value = d.nombre||''
  document.getElementById('deudaTotal').value = d.importeTotal||''
  document.getElementById('deudaPagado').value = d.importePagado||''
  document.getElementById('deudaInteres').value = d.interes||''
  document.getElementById('deudaVencimiento').value = d.vencimiento||''
  document.getElementById('deudaNotas').value = d.notas||''
  poblarSelect('deudaCat','deuda',d.categoria||'')
  openModal('deudaModal')
}
function guardarDeuda() {
  if (!_formGuard.lock('deudaModal')) return
  const _unlock = () => _formGuard.unlock('deudaModal')
  const nombre = document.getElementById('deudaNombre').value.trim()
  const importeTotal = parseAmount(document.getElementById('deudaTotal').value)
  if (!nombre || !importeTotal || importeTotal <= 0) { toast('Nombre e importe requeridos','error'); _unlock(); return }
  const cat = getOrCreateCat('deudaCat','deudaCatCustomInput','deuda') || S.categorias.deuda[0]
  const id = document.getElementById('deudaId').value
  const data = {nombre, importeTotal, importePagado:parseAmount(document.getElementById('deudaPagado').value)||0, interes:parseAmount(document.getElementById('deudaInteres').value)||0, categoria:cat, vencimiento:document.getElementById('deudaVencimiento').value||'', notas:document.getElementById('deudaNotas').value.trim(), pagos:[]}

  if (id) {
    const idx = S.deudas.findIndex(x=>x.id===id)
    if (idx>=0) S.deudas[idx] = {...S.deudas[idx],...data}
  } else {
    S.deudas.push({id:uid(),...data})
  }
  save(); if (window.MNGamification) MNGamification.checkAchievement('deuda_added'); if (window.MNGamification) MNGamification.checkAchievement('data_check'); closeModal('deudaModal'); _unlock(); render(); toast(t('toast_deuda_guardada'))
}
function borrarDeuda(id) {
  confirmar(t('confirm_eliminar_deuda'), ()=>{
    S.deudas = S.deudas.filter(x=>x.id!==id)
    save(); render(); toast(t('toast_deuda_eliminada'))
  }, {titulo:t('confirm_eliminar_deuda_titulo'),icono:'🗑️'})
}
function abrirPago(id) {
  const d = S.deudas.find(x=>x.id===id)
  if (!d) return
  document.getElementById('pagoDeudaId').value = id
  document.getElementById('pagoImporte').value = ''
  document.getElementById('pagoFecha').value = todayISO()
  const pendiente = (Number(d.importeTotal)||0)-(Number(d.importePagado)||0)
  document.getElementById('pagoDeudaInfo').textContent = `Deuda: ${d.nombre} · Pendiente: ${eur(pendiente)}`
  openModal('pagoModal')
}
function registrarPago() {
  const id = document.getElementById('pagoDeudaId').value
  const importe = parseAmount(document.getElementById('pagoImporte').value)
  if (!importe || importe <= 0) { toast(t('err_importe_pago'),'error'); return }
  const idx = S.deudas.findIndex(x=>x.id===id)
  if (idx<0) return
  S.deudas[idx].importePagado = Math.min(Number(S.deudas[idx].importeTotal), (Number(S.deudas[idx].importePagado)||0)+importe)
  if (!S.deudas[idx].pagos) S.deudas[idx].pagos = []
  S.deudas[idx].pagos.push({fecha:document.getElementById('pagoFecha').value||todayISO(),importe})
  // Confetti when debt is fully paid
  const deudaSaldada = S.deudas[idx].importePagado >= Number(S.deudas[idx].importeTotal)
  if (deudaSaldada) {
    setTimeout(() => {
      if (window.MNConfetti) window.MNConfetti.fire('debt')
      document.dispatchEvent(new CustomEvent('mn:deuda:saldada', { detail: { deuda: S.deudas[idx] } }))
    }, 300)
  }
  if (window.MNGamification) {
    MNGamification.checkAchievement('pago_deuda')
    MNGamification.checkAchievement('deuda_updated')
    if (deudaSaldada) MNGamification.checkAchievement('deuda_saldada')
    MNGamification.checkAchievement('data_check')
  }
  save(); closeModal('pagoModal'); render(); toast(eur(importe) + ' – ' + t('toast_pago_registrado'))
}

// ─── OBJETIVO CRUD ──────────────────────────────────────────────
function previewObjModalAvatar(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    if (!checkImageSize(e.target.result)) { input.value = ''; return }
    document.getElementById('objAvatarData').value = e.target.result
    const prev = document.getElementById('objModalAvatarPreview')
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`
  }
  reader.readAsDataURL(file)
}
function limpiarObjModalAvatar() {
  document.getElementById('objAvatarData').value = ''
  const prev = document.getElementById('objModalAvatarPreview')
  if (prev) prev.innerHTML = '🎯'
  const fi = document.getElementById('objModalAvatarFile')
  if (fi) fi.value = ''
}

function resetObjForm() {
  document.getElementById('objId').value = ''
  document.getElementById('objModalTitle').textContent = t('modal_nuevo_obj')
  document.getElementById('objNombre').value = ''
  document.getElementById('objMeta').value = ''
  document.getElementById('objActual').value = ''
  document.getElementById('objFecha').value = ''
  document.getElementById('objNotas').value = ''
  document.getElementById('objColor').value = '#00D4AA'
  document.getElementById('objAvatarData').value = ''
  const prev = document.getElementById('objModalAvatarPreview')
  if (prev) prev.innerHTML = '🎯'
  poblarSelect('objCat','objetivo')
}
function editarObjetivo(id) {
  const o = S.objetivos.find(x=>x.id===id)
  if (!o) return
  resetObjForm()
  document.getElementById('objId').value = id
  document.getElementById('objModalTitle').textContent = t('btn_editar') + ' ' + t('page_objetivos')
  document.getElementById('objNombre').value = o.nombre||''
  document.getElementById('objMeta').value = o.objetivo||''
  document.getElementById('objActual').value = o.actual||''
  document.getElementById('objFecha').value = o.fechaObjetivo||''
  document.getElementById('objNotas').value = o.notas||''
  document.getElementById('objColor').value = o.color||'#00D4AA'
  // Restore avatar in modal
  if (o.avatar && o.avatar.startsWith('data:')) {
    document.getElementById('objAvatarData').value = o.avatar
    const prev = document.getElementById('objModalAvatarPreview')
    if (prev) prev.innerHTML = `<img src="${o.avatar}" style="width:100%;height:100%;object-fit:cover">`
  } else if (o.emoji) {
    const prev = document.getElementById('objModalAvatarPreview')
    if (prev) prev.textContent = o.emoji
  }
  poblarSelect('objCat','objetivo',o.categoria||'')
  openModal('objetivoModal')
}
function guardarObjetivo() {
  if (!_formGuard.lock('objetivoModal')) return
  const _unlock = () => _formGuard.unlock('objetivoModal')
  const nombre = document.getElementById('objNombre').value.trim()
  const objetivo = parseAmount(document.getElementById('objMeta').value)
  if (!nombre || !objetivo || objetivo <= 0) { toast(t('err_nombre_meta'),'error'); _unlock(); return }
  const cat = getOrCreateCat('objCat','objCatCustomInput','objetivo') || S.categorias.objetivo[0]
  const id = document.getElementById('objId').value
  const avatarData = document.getElementById('objAvatarData').value || null
  const data = {
    nombre, objetivo,
    actual: parseAmount(document.getElementById('objActual').value)||0,
    categoria: cat,
    fechaObjetivo: document.getElementById('objFecha').value||'',
    color: document.getElementById('objColor').value||'#00D4AA',
    notas: document.getElementById('objNotas').value.trim(),
    avatar: avatarData || null,
    emoji: avatarData ? null : undefined
  }
  if (id) {
    const idx = S.objetivos.findIndex(x=>x.id===id)
    if (idx>=0) S.objetivos[idx] = {...S.objetivos[idx], ...data}
  } else {
    S.objetivos.push({id:uid(), ...data})
  }
  save(); if (window.MNGamification) MNGamification.checkAchievement('objetivo_added'); closeModal('objetivoModal'); _unlock(); render(); toast(t('toast_objetivo_guardado'))
}
function borrarObjetivo(id) {
  confirmar(t('confirm_eliminar_objetivo'), ()=>{
    S.objetivos = S.objetivos.filter(x=>x.id!==id)
    save(); render(); toast(t('toast_objetivo_eliminado'))
  }, {titulo:t('confirm_eliminar_objetivo_titulo'),icono:'🗑️'})
}
function abrirAportar(id) {
  const o = S.objetivos.find(x=>x.id===id)
  if (!o) return
  document.getElementById('aportarObjId').value = id
  document.getElementById('aportarImporte').value = ''
  document.getElementById('aportarObjInfo').textContent = `Objetivo: ${o.nombre} · Meta: ${eur(o.objetivo)} · Ahorrado: ${eur(o.actual||0)}`
  selectRadio('nuevo')
  poblarCuentaSelect('aportarCuenta')
  openModal('aportarModal')
}
function selectRadio(tipo) {
  aportarTipo = tipo
  document.getElementById('radioNuevo').classList.toggle('selected', tipo==='nuevo')
  document.getElementById('radioExistente').classList.toggle('selected', tipo==='existente')
  document.getElementById('aportarCuentaGroup').style.display = tipo==='existente'?'block':'none'
}
function confirmarAportar() {
  const id = document.getElementById('aportarObjId').value
  const importe = parseAmount(document.getElementById('aportarImporte').value)
  if (!importe || importe <= 0) { toast(t('err_importe_aportar'),'error'); return }
  const idx = S.objetivos.findIndex(x=>x.id===id)
  if (idx < 0) return
  const obj = S.objetivos[idx]

  if (aportarTipo === 'nuevo') {
    // Task 3 — NEW money: create income entry so wallet balance increases,
    // then record an internal goal_transfer (not a real expense) to show movement.
    S.ingresos.push({
      id: uid(),
      concepto: `🎯 Aportación a objetivo: ${obj.nombre}`,
      importe,
      categoria: 'Otro',
      fecha: todayISO(),
      notas: `Ingreso para objetivo "${obj.nombre}"`,
    })
    // Record as goal_transfer (internal — excluded from real expense calcs)
    S.gastos.push({
      id: uid(),
      concepto: `🎯 Transferencia a objetivo: ${obj.nombre}`,
      importe,
      categoria: 'Objetivos',
      tipo: TX_TYPES.GOAL_TRANSFER, // excluded from calcGastosMes
      fecha: todayISO(),
      notas: `Asignación interna a "${obj.nombre}"`,
    })
  } else {
    // Task 3 — EXISTING money: deduct from chosen account (real movement of existing balance),
    // no new income created. Also record as goal_transfer so expenses stay clean.
    const cuentaId = document.getElementById('aportarCuenta').value
    if (cuentaId) {
      const c = getCuenta(cuentaId)
      if (c) c.saldo = (Number(c.saldo)||0) - importe
    }
    S.gastos.push({
      id: uid(),
      concepto: `🎯 Transferencia a objetivo: ${obj.nombre}`,
      importe,
      categoria: 'Objetivos',
      tipo: TX_TYPES.GOAL_TRANSFER, // excluded from calcGastosMes
      fecha: todayISO(),
      cuentaId: cuentaId || undefined,
      notas: `Asignación interna a "${obj.nombre}"`,
    })
  }

  // Increase goal progress regardless of source
  S.objetivos[idx].actual = (Number(S.objetivos[idx].actual)||0) + importe

  // Confetti when goal is completed (100%)
  const obj2 = S.objetivos[idx]
  const isNowComplete = (Number(obj2.actual)||0) >= (Number(obj2.objetivo)||1)
  if (isNowComplete) {
    setTimeout(() => {
      if (window.MNConfetti) window.MNConfetti.fire('goal')
      document.dispatchEvent(new CustomEvent('mn:objetivo:completado', { detail: { obj: obj2 } }))
    }, 300)
  }

  if (window.MNGamification) {
    MNGamification.checkAchievement('aportacion_done')
    MNGamification.checkAchievement('data_check')
    if (isNowComplete) MNGamification.checkAchievement('objetivo_done')
  }
  save(); closeModal('aportarModal'); render(); toast(eur(importe) + ' ' + t('toast_aportado_ok'))
}

// ─── PRESUPUESTO CRUD ───────────────────────────────────────────
function resetPresForm() {
  document.getElementById('presLimite').value = ''
  const tipoEl = document.getElementById('presTipo')
  if (tipoEl) tipoEl.value = 'monthly'
  window._updatePresLabel()
  poblarSelect('presCat','gasto')
}
window._updatePresLabel = function() {
  const tipoEl = document.getElementById('presTipo')
  const labelEl = document.getElementById('presLimiteLabel')
  if (!tipoEl || !labelEl) return
  const labels = { monthly: 'Límite mensual (€) *', quarterly: 'Límite trimestral (€) *', annual: 'Límite anual (€) *' }
  labelEl.textContent = labels[tipoEl.value] || labels.monthly
}
function guardarPresupuesto() {
  if (!_formGuard.lock('presupuestoModal')) return
  const _unlock = () => _formGuard.unlock('presupuestoModal')
  const cat = getOrCreateCat('presCat','presCatCustomInput','gasto')
  if (!cat) { toast(t('err_selecciona_cat'),'error'); _unlock(); return }
  const limite = parseAmount(document.getElementById('presLimite').value)
  if (!limite || limite <= 0) { toast(t('err_limite_valido'),'error'); _unlock(); return }
  const tipo = (document.getElementById('presTipo')?.value) || 'monthly'
  // Store as object with type info; keep backward compat (plain number = monthly)
  if (!S.presupuestosV2) S.presupuestosV2 = {}
  S.presupuestosV2[cat] = { limite, tipo }
  // Also update legacy S.presupuestos with monthly-equivalent for charts
  S.presupuestos[cat] = tipo === 'annual' ? limite/12 : tipo === 'quarterly' ? limite/3 : limite
  save(); if (window.MNGamification) MNGamification.checkAchievement('presupuesto_added'); closeModal('presupuestoModal'); _unlock(); render(); toast(t('toast_presupuesto_guardado'))
}
function borrarPresupuesto(cat) {
  confirmar(t('confirm_eliminar_presupuesto') + ' "' + cat + '"?', ()=>{
    delete S.presupuestos[cat]
    save(); render(); toast(t('toast_presupuesto_eliminado'))
  }, {titulo:t('confirm_eliminar_presupuesto_titulo'),icono:'🗑️'})
}

// ─── CUENTA CRUD ────────────────────────────────────────────────
function poblarTransModal() {
  poblarCuentaSelect('transDesde')
  poblarCuentaSelect('transHacia')
  document.getElementById('transImporte').value = ''
}
function realizarTransferencia() {
  const desdeId = document.getElementById('transDesde').value
  const haciaId = document.getElementById('transHacia').value
  const importe = parseAmount(document.getElementById('transImporte').value)
  if (!desdeId||!haciaId||desdeId===haciaId) { toast(t('err_cuentas_distintas'),'error'); return }
  if (!importe||importe<=0) { toast(t('err_importe_valido'),'error'); return }
  const desde = getCuenta(desdeId)
  const hacia = getCuenta(haciaId)
  if (!desde||!hacia) return

  // Actualizar saldos
  desde.saldo = (Number(desde.saldo)||0) - importe
  hacia.saldo = (Number(hacia.saldo)||0) + importe

  // Registrar como movimiento en ambas cuentas para que aparezca en el historial
  const fecha = todayISO()
  const txId  = uid()
  const concepto = `${t('transferencia_hacia','Transferencia hacia')} ${hacia.nombre}`
  const conceptoEntrada = `${t('transferencia_desde','Transferencia desde')} ${desde.nombre}`

  // Salida de la cuenta origen
  S.gastos.push({
    id: txId + '_out',
    concepto,
    importe,
    categoria: t('transferencia_cat','Transferencia'),
    fecha,
    cuentaId: desdeId,
    tipo: TX_TYPES.ACCOUNT_TRANSFER || 'account_transfer',
    recurrente: false,
    _transferRef: txId,
  })

  // Entrada en la cuenta destino
  S.ingresos.push({
    id: txId + '_in',
    concepto: conceptoEntrada,
    importe,
    categoria: t('transferencia_cat','Transferencia'),
    fecha,
    cuentaId: haciaId,
    status: 'cobrado',
    tipo: TX_TYPES.ACCOUNT_TRANSFER || 'account_transfer',
    _transferRef: txId,
  })

  save(); closeModal('transModal'); render(); toast(t('toast_transferencia_ok') + ': ' + eur(importe))
}

// ─── CONFIGURACION CRUD ─────────────────────────────────────────
function guardarPerfil() {
  S.usuario.nombre = document.getElementById('cfgNombre').value.trim() || 'Usuario'
  save(); render(); toast(t('toast_perfil_guardado'))
}

// Config page theme helpers
function cfgToggleTheme() {
  cfgSetTheme(S.theme === 'dark' ? 'light' : 'dark')
}
function cfgSetTheme(t) {
  S.theme = t; save(); applyTheme(); renderConfiguracion()
}
function cfgSetMode(m) {
  // Mode switching disabled - personal only
}
// ─── EMOJI PICKER ──────────────────────────────────────────────
const PICKER_EMOJIS = {
  finanzas: ['💰','💵','💴','💶','💷','💸','🤑','💳','🏦','📈','📉','📊','💹','🏧','💎','🪙'],
  trabajo:  ['💼','👔','🖥️','💻','📱','📋','📝','✏️','🖊️','📌','📎','🗂️','📂','🏢','🤝','⚙️'],
  hogar:    ['🏠','🏡','🏘️','🛒','🛍️','🍔','🍽️','☕','🛋️','🛏️','🚿','💡','🔑','🪟','🌿','🧹'],
  movilidad:['🚗','🚙','🚌','✈️','🚂','🛵','🚲','⛽','🛣️','🏎️','🚕','🛺','⚓','🚢','🚁','🛸'],
  salud:    ['🏥','💊','🩺','🧬','🏋️','🧘','🩹','👁️','🦷','🧪','🩻','💉','🧠','❤️','🫀','🫁'],
  ocio:     ['🎮','🎬','🎵','🎸','📚','🏖️','⚽','🎾','🏄','🎨','🎭','🎪','🎢','🎠','🎯','🎲'],
  educacion:['🎓','📚','✏️','🔬','🔭','🏫','📐','🧮','💡','🧩','🏆','🥇','🎖️','📜','🗺️','🌍'],
  otros:    ['⭐','✨','🔥','💫','🌟','🎁','🎀','🎊','🎉','🛡️','🚀','🌈','🌺','🍀','🦋','📌'],
}
const _emojiPickerState = {} // key → chosen emoji

function _openEmojiPicker(key) {
  // Close any other open pickers first
  document.querySelectorAll('.emoji-dropdown.open').forEach(d=>{
    if (d.dataset.key !== key) d.classList.remove('open')
  })
  const dd = document.getElementById('emoji-dd-'+key)
  if (dd) dd.classList.toggle('open')
}

function _selectEmoji(key, emoji) {
  _emojiPickerState[key] = emoji
  const trigger = document.getElementById('emoji-trigger-'+key)
  if (trigger) trigger.textContent = emoji
  const manualInput = document.getElementById('newcat-emoji-'+key)
  if (manualInput) manualInput.value = emoji
  // Update selected highlight
  const dd = document.getElementById('emoji-dd-'+key)
  if (dd) {
    dd.querySelectorAll('.emoji-opt').forEach(el => {
      el.classList.toggle('selected', el.dataset.emoji === emoji)
    })
    dd.classList.remove('open')
  }
}

function _buildEmojiPicker(key) {
  const current = _emojiPickerState[key] || ''
  const allEmojis = Object.values(PICKER_EMOJIS).flat()
  const grid = allEmojis.map(e =>
    `<div class="emoji-opt${current===e?' selected':''}" data-emoji="${e}" onclick="_selectEmoji('${key}','${e}')" title="${e}">${e}</div>`
  ).join('')
  return `
    <div class="emoji-picker-wrap">
      <div class="emoji-trigger" id="emoji-trigger-${key}" onclick="_openEmojiPicker('${key}')" title="Seleccionar emoji">${current || '😀'}</div>
      <div class="emoji-dropdown" id="emoji-dd-${key}" data-key="${key}">
        <div class="emoji-manual-row">
          <input type="text" id="newcat-emoji-${key}" class="emoji-manual-input" maxlength="8"
            placeholder="${t('emoji_manual_ph','Escribe o pega un emoji…')}"
            value="${/^\p{Extended_Pictographic}/u.test(current) ? current : ''}"
            oninput="_onManualEmojiInput('${key}', this.value)"
            onclick="event.stopPropagation()">
        </div>
        ${grid}
      </div>
    </div>`
}

// Manual keyboard entry of an emoji (typed or pasted), as an alternative
// to picking one from the visual grid — both converge on the same
// _emojiPickerState so whichever method the user finishes with wins.
function _onManualEmojiInput(key, value) {
  const v = (value || '').trim()
  if (!v) return
  _emojiPickerState[key] = v
  const trigger = document.getElementById('emoji-trigger-'+key)
  if (trigger) trigger.textContent = v
  const dd = document.getElementById('emoji-dd-'+key)
  if (dd) dd.querySelectorAll('.emoji-opt').forEach(el => el.classList.toggle('selected', el.dataset.emoji === v))
}

// Close pickers on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.emoji-picker-wrap')) {
    document.querySelectorAll('.emoji-dropdown.open').forEach(d => d.classList.remove('open'))
  }
}, true)

function removeCatEl(el) {
  const key = el.dataset.key
  const cat = el.dataset.cat
  removeCat(key, cat)
}
// Cuenta cuantos movimientos/entradas existentes usan esta categoria,
// para decidir si eliminarla 'esta permitido' sin friccion o si hay
// que avisar primero del impacto (los movimientos existentes
// conservarian el nombre de categoria, pero dejaria de estar
// disponible para seleccionar en nuevos movimientos).
function _categoryUsageCount(key, cat) {
  if (key === 'gasto') {
    const enGastos = (S.gastos||[]).filter(g => g.categoria === cat).length
    const enPresupuesto = (S.presupuestos && S.presupuestos[cat] !== undefined) ? 1 : 0
    return enGastos + enPresupuesto
  }
  if (key === 'ingreso')   return (S.ingresos||[]).filter(i => i.categoria === cat).length
  if (key === 'inversion') return (S.inversiones||[]).filter(i => i.categoria === cat).length
  if (key === 'deuda')     return (S.deudas||[]).filter(d => d.categoria === cat).length
  if (key === 'objetivo')  return (S.objetivos||[]).filter(o => o.categoria === cat).length
  return 0
}
function removeCat(key, cat) {
  const doRemove = () => {
    S.categorias[key] = S.categorias[key].filter(c=>c!==cat)
    save(); render()
    toast(t('toast_cat_eliminada','Categoría eliminada'))
  }
  const usageCount = _categoryUsageCount(key, cat)
  if (usageCount > 0) {
    confirmar(
      `${t('confirm_cat_en_uso_pre','Esta categoría se usa en')} ${usageCount} ${usageCount===1?t('confirm_cat_en_uso_uno','movimiento'):t('confirm_cat_en_uso_varios','movimientos')}. ${t('confirm_cat_en_uso_post','Los movimientos existentes conservarán el nombre, pero ya no podrás elegirla en nuevos movimientos.')}`,
      doRemove,
      {titulo:t('confirm_cat_en_uso_titulo','Categoría en uso'), icono:'⚠️'}
    )
  } else {
    doRemove()
  }
}

// ════════════════════════════════════════════════════════════════
// ── CREAR CATEGORIA — modal reutilizable desde cualquier flujo ──
// ════════════════════════════════════════════════════════════════
// Unico punto de creacion de categorias con nombre+tipo+emoji en toda
// la app, usado tanto desde la seccion dedicada 'Categorías' como
// desde el boton '+ Crear categoría' de cualquier otro formulario
// (gasto, ingreso, presupuesto...). Se abre POR ENCIMA del
// modal/pagina actual sin cerrarlo (mismo patron ya usado para crear
// cuenta/cliente/proveedor inline), y al guardar invoca
// onCreated(nombreCategoria, tipo) para que el llamador actualice su
// propio select y seleccione la nueva categoria — sin duplicar
// ninguna logica de creacion de categorias en ningun otro sitio.
const _CREATE_CAT_PICKER_KEY = '__newcat_modal__'
let _mnEditingCategory = null // { key, oldName } | null while editing an existing category

function _openCreateCategoryModal(defaultTipo, onCreated, opts) {
  document.getElementById('mnCreateCatOverlay')?.remove()
  delete _emojiPickerState[_CREATE_CAT_PICKER_KEY]
  _mnEditingCategory = null
  window._mnCreateCatAllowMultiple = !!(opts && opts.allowMultiple)

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay mn-modal-inline-top'
  overlay.id = 'mnCreateCatOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-header">
        <span class="modal-title">🏷️ ${t('modal_nueva_cat_titulo','Nueva categoría')}</span>
        <button class="modal-close" onclick="_closeCreateCategoryModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>${t('modal_cat_nombre_lbl','Nombre')}</label>
          <input type="text" id="mnNewCatNombre" placeholder="${t('ph_nueva_categoria','Ej. Tabaco')}">
        </div>
        <div class="form-group">
          <label>${t('modal_cat_tipo_lbl','Tipo')}</label>
          <select id="mnNewCatTipo">
            <option value="gasto" ${defaultTipo==='gasto'?'selected':''}>💳 ${t('cat_type_gasto','Gasto')}</option>
            <option value="ingreso" ${defaultTipo==='ingreso'?'selected':''}>💰 ${t('cat_type_ingreso','Ingreso')}</option>
            <option value="inversion" ${defaultTipo==='inversion'?'selected':''}>📈 ${t('cat_type_inversion','Inversión')}</option>
            <option value="deuda" ${defaultTipo==='deuda'?'selected':''}>📉 ${t('cat_type_deuda','Deuda')}</option>
            <option value="objetivo" ${defaultTipo==='objetivo'?'selected':''}>🎯 ${t('cat_type_objetivo','Objetivo')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${t('modal_cat_emoji_lbl','Emoji')}</label>
          ${_buildEmojiPicker(_CREATE_CAT_PICKER_KEY)}
        </div>
        <div id="mnNewCatSuccess" style="display:none;font-size:.78rem;font-weight:700;color:var(--accent);margin-top:2px">✓ ${t('toast_cat_añadida','Categoría añadida')}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="_closeCreateCategoryModal()">${window._mnCreateCatAllowMultiple ? t('btn_cerrar','Cerrar') : t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="_confirmCreateCategory()">${t('btn_guardar','Guardar')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeCreateCategoryModal() })
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => overlay.classList.add('open'), 10)
  setTimeout(() => document.getElementById('mnNewCatNombre')?.focus(), 60)

  window._mnCreateCatCallback = onCreated
}

// Modo edicion del mismo modal: nombre y emoji pre-rellenados con los
// valores actuales, sin selector de tipo (una categoria no cambia de
// lista gasto/ingreso al editarla — para eso se elimina y se crea una
// nueva en el grupo correcto). Al guardar, _confirmCreateCategory()
// renombra en cascada todas las referencias existentes en vez de
// crear una categoria nueva.
function _openEditCategoryModal(key, cat) {
  document.getElementById('mnCreateCatOverlay')?.remove()
  delete _emojiPickerState[_CREATE_CAT_PICKER_KEY]
  _emojiPickerState[_CREATE_CAT_PICKER_KEY] = catEmoji(cat)
  _mnEditingCategory = { key, oldName: cat }
  window._mnCreateCatAllowMultiple = false

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay mn-modal-inline-top'
  overlay.id = 'mnCreateCatOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-header">
        <span class="modal-title">✏️ ${t('modal_editar_cat_titulo','Editar categoría')}</span>
        <button class="modal-close" onclick="_closeCreateCategoryModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>${t('modal_cat_nombre_lbl','Nombre')}</label>
          <input type="text" id="mnNewCatNombre" value="${cat.replace(/"/g,'&quot;')}">
        </div>
        <div class="form-group">
          <label>${t('modal_cat_emoji_lbl','Emoji')}</label>
          ${_buildEmojiPicker(_CREATE_CAT_PICKER_KEY)}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="_closeCreateCategoryModal()">${t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="_confirmCreateCategory()">${t('btn_guardar','Guardar')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeCreateCategoryModal() })
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => overlay.classList.add('open'), 10)
  setTimeout(() => document.getElementById('mnNewCatNombre')?.focus(), 60)
}

function _closeCreateCategoryModal() {
  const overlay = document.getElementById('mnCreateCatOverlay')
  if (overlay) overlay.remove()
  if (typeof window._popScrollLock === 'function') window._popScrollLock()
  delete _emojiPickerState[_CREATE_CAT_PICKER_KEY]
  window._mnCreateCatCallback = null
  window._mnCreateCatAllowMultiple = false
  _mnEditingCategory = null
}

function _confirmCreateCategory() {
  const nombre = (document.getElementById('mnNewCatNombre')?.value || '').trim()
  if (!nombre) { toast(t('err_nombre_requerido','El nombre es requerido'),'error'); return }
  const emoji = _emojiPickerState[_CREATE_CAT_PICKER_KEY] || (document.getElementById('newcat-emoji-'+_CREATE_CAT_PICKER_KEY)?.value || '').trim()

  // ── Modo edicion: renombrar en cascada en vez de crear ──
  if (_mnEditingCategory) {
    const { key, oldName } = _mnEditingCategory
    if (nombre !== oldName && (S.categorias[key]||[]).includes(nombre)) {
      toast(t('toast_cat_existe','Esa categoría ya existe'),'error')
      return
    }
    const idx = S.categorias[key].indexOf(oldName)
    if (idx >= 0) S.categorias[key][idx] = nombre
    if (nombre !== oldName) {
      // Propaga el nuevo nombre a todos los registros existentes que
      // referencian esta categoria, segun su tipo.
      const refsByKey = {
        gasto:     () => (S.gastos||[]).forEach(x => { if (x.categoria === oldName) x.categoria = nombre }),
        ingreso:   () => (S.ingresos||[]).forEach(x => { if (x.categoria === oldName) x.categoria = nombre }),
        inversion: () => (S.inversiones||[]).forEach(x => { if (x.categoria === oldName) x.categoria = nombre }),
        deuda:     () => (S.deudas||[]).forEach(x => { if (x.categoria === oldName) x.categoria = nombre }),
        objetivo:  () => (S.objetivos||[]).forEach(x => { if (x.categoria === oldName) x.categoria = nombre }),
      }
      if (refsByKey[key]) refsByKey[key]()
      if (key === 'gasto') {
        if (S.presupuestos && S.presupuestos[oldName] !== undefined) { S.presupuestos[nombre] = S.presupuestos[oldName]; delete S.presupuestos[oldName] }
        if (S.presupuestosV2 && S.presupuestosV2[oldName] !== undefined) { S.presupuestosV2[nombre] = S.presupuestosV2[oldName]; delete S.presupuestosV2[oldName] }
      }
      if (S.catColors && S.catColors[oldName] !== undefined) { S.catColors[nombre] = S.catColors[oldName]; delete S.catColors[oldName] }
      S.categoriaEmojis = S.categoriaEmojis || {}
      delete S.categoriaEmojis[oldName]
    }
    if (emoji) { S.categoriaEmojis = S.categoriaEmojis || {}; S.categoriaEmojis[nombre] = emoji }
    save()
    _closeCreateCategoryModal()
    render()
    toast(t('toast_cat_editada','Categoría actualizada ✓'))
    return
  }

  // ── Modo creacion ──
  const tipo = document.getElementById('mnNewCatTipo')?.value || 'gasto'
  if (!S.categorias[tipo]) S.categorias[tipo] = []
  if (S.categorias[tipo].includes(nombre)) {
    toast(t('toast_cat_existe','Esa categoría ya existe'),'error')
    return
  }
  S.categorias[tipo].push(nombre)
  if (emoji) { S.categoriaEmojis = S.categoriaEmojis || {}; S.categoriaEmojis[nombre] = emoji }
  save()
  const cb = window._mnCreateCatCallback

  if (window._mnCreateCatAllowMultiple) {
    // Crear varias sin cerrar: notificar al llamador, resetear el
    // formulario (conservando el tipo elegido) y mostrar un indicador
    // de exito discreto dentro del propio modal en vez de un toast.
    if (typeof cb === 'function') cb(nombre, tipo)
    const nameInput = document.getElementById('mnNewCatNombre')
    if (nameInput) nameInput.value = ''
    delete _emojiPickerState[_CREATE_CAT_PICKER_KEY]
    const trigger = document.getElementById('emoji-trigger-'+_CREATE_CAT_PICKER_KEY)
    if (trigger) trigger.textContent = '😀'
    const manualInput = document.getElementById('newcat-emoji-'+_CREATE_CAT_PICKER_KEY)
    if (manualInput) manualInput.value = ''
    const successEl = document.getElementById('mnNewCatSuccess')
    if (successEl) {
      successEl.style.display = 'block'
      clearTimeout(window._mnCreateCatSuccessTimer)
      window._mnCreateCatSuccessTimer = setTimeout(() => { successEl.style.display = 'none' }, 1800)
    }
    if (nameInput) nameInput.focus()
    return
  }

  _closeCreateCategoryModal()
  if (typeof cb === 'function') cb(nombre, tipo)
  toast(t('toast_cat_añadida','Categoría añadida ✓'))
}
// ─── CERRAR SESIÓN ───────────────────────────────────────────────
// Limpia la sesión de MNAuth (plan, trial) y recarga la app para
// volver al onboarding. Los datos financieros (S) se conservan.
function mnCerrarSesion() {
  confirmar(
    t('confirm_cerrar_sesion'),
    async () => {
      // Sign out from Supabase
      if (window.MNSupabaseAuth) {
        try { await window.MNSupabaseAuth.signOut() } catch(e) {}
      }
      // Clear auth state but keep financial data
      try { localStorage.removeItem('mn_supabase_session') } catch(e) {}
      try { localStorage.removeItem('mn_auth_user') } catch(e) {}
      try { localStorage.removeItem('mn_billing_sub') } catch(e) {}
      try { localStorage.removeItem('mn_billing_history') } catch(e) {}
      // Clear onboarding flag so it shows again
      try { localStorage.removeItem(OB_FLAG_KEY) } catch(e) {}
      try { localStorage.removeItem(TUT_FLAG_KEY) } catch(e) {}
      // Show onboarding
      obStep = 1
      obData = { nombre: '', email: '', password: '', mode: 'personal', lang: _currentLang || 'es', theme: S.theme || 'dark', plan: 'trial', startTutorial: false, loadDemo: false }
      const ov = document.getElementById('onboardingOverlay')
      if (ov) {
        ov.style.display = 'flex'
        requestAnimationFrame(() => ov.classList.add('ob-visible'))
        _pushScrollLock()
        obRender()
      }
    },
    { titulo: t('confirm_cerrar_sesion_titulo'), icono: '🚪', btnLabel: t('confirm_cerrar_sesion_btn') }
  )
}

function borrarTodo() {
  confirmar(t('confirm_borrar_todo'), ()=>{
    // Preserve user identity — only clear financial data
    const _savedNombre = S.usuario?.nombre || ''
    const _savedEmail  = S.usuario?.email  || ''
    S = defaultState()
    S.usuario.nombre = _savedNombre
    if (_savedEmail) S.usuario.email = _savedEmail
    S.ingresos = []; S.gastos = []; S.inversiones = []; S.deudas = []
    S.objetivos = []; S.presupuestos = {}; S.assets = []; S.patrimonio_hist = []
    S.clientes = []; S.proveedores = []; S.devengos = []
    S.cuentas = defaultState().cuentas
    // Reset all global filter/search state — prevents stale UI after reset
    try {
      window._gTimePeriod = 'month'; window._gDateFrom = ''; window._gDateTo = ''
      _ingSearch = ''; _ingCatFilter = ''; _ingMesFilter = ''
      _gasSearch = ''; _gasCatFilter = ''; _gasMesFilter = ''
      _deudaSearch = ''; _deudaCatFilter = ''
      window._invFiltro = 'todas'; window._invCat = ''
      window._deudaStrat = 'moderado'
      _objSearch = ''; _objCatFilter = ''
    } catch(e) {}
    currentPage = 'dashboard'
    save()
    // Do NOT reset onboarding flags — user stays logged in, just data cleared
    destroyAllCharts()
    currentPage = 'dashboard'
    render()
    _updateSidebarLang()
    updateSidebarLogo()
    toast(t('toast_datos_eliminados'))
  }, {titulo:t('confirm_borrar_todo_titulo'),icono:'⚠️',btnLabel:t('confirm_borrar_todo_btn')})
}


// Auto-clear stale flags when no data exists at all (safety net)
function _autoResetFlagsIfEmpty() {
  const hasAnyData = (S.ingresos||[]).length || (S.gastos||[]).length ||
                     (S.inversiones||[]).length || (S.deudas||[]).length ||
                     (S.objetivos||[]).length || (S.assets||[]).length ||
                     (S.cuentas||[]).some(c => (Number(c.saldo)||0) !== 0) ||
                     (S.usuario.nombre && S.usuario.nombre !== 'Usuario')
  if (!hasAnyData && _obFlagSeen()) {
    try {
      localStorage.removeItem(OB_FLAG_KEY)
      localStorage.removeItem(TUT_FLAG_KEY)
    } catch(e) {}
  }
}

// ─── CLIENTES ──────────────────────────────────────────────────
let _clienteSearch = ''
let _clienteCatFilter = ''

function renderClientes() {
  goTo('dashboard')
}

function exportarClientes() {
  try {
    const wb = XLSX.utils.book_new()
    const headers = ['Nombre','Empresa','Email','Teléfono','Facturado (€)','Facturas','Pendiente (€)','Notas']
    const rows = (S.clientes||[]).map(c => {
      const facturado = S.ingresos.filter(i=>i.clienteId===c.id).reduce((a,i)=>a+(Number(i.importe)||0),0)
      const facturas = S.ingresos.filter(i=>i.clienteId===c.id).length
      const pendiente = S.ingresos.filter(i=>i.clienteId===c.id&&i.status==='pending').reduce((a,i)=>a+(Number(i.importe)||0),0)
      return [c.nombre||'', c.empresa||'', c.email||'', c.telefono||'', facturado, facturas, pendiente, c.notas||'']
    })
    const ws = XLSX.utils.aoa_to_sheet([headers,...rows])
    ws['!cols'] = headers.map(h=>({wch:Math.max(h.length,14)}))
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `MoneyNest_Clientes_${todayISO()}.xlsx`)
    toast(t('toast_clientes_exportados','Clientes exportados ✓'))
  } catch(e) { toast(t('err_exportar','Error al exportar'),'error'); console.error(e) }
}

function cambiarModoEmpresa() {
  // Disabled - personal-only app
}

function resetClienteForm() {
  document.getElementById('clienteId').value   = ''
  document.getElementById('clienteModalTitle').textContent = t('cliente_nuevo')
  document.getElementById('clienteNombre').value   = ''
  document.getElementById('clienteEmpresa').value  = ''
  document.getElementById('clienteEmail').value    = ''
  document.getElementById('clienteTelefono').value = ''
  document.getElementById('clienteNotas').value    = ''
  document.getElementById('clienteColor').value    = '#00D4AA'
  document.getElementById('clienteAvatar').value   = ''
  const ct = document.getElementById('clienteTipo'); if(ct) ct.value = 'empresa'
  document.getElementById('clienteAvatarEmoji').style.display = 'block'
  document.getElementById('clienteAvatarImg').style.display   = 'none'
  document.getElementById('clienteAvatarImg').src  = ''
}

function editarCliente(id) {
  const c = (S.clientes||[]).find(x=>x.id===id)
  if (!c) return
  resetClienteForm()
  document.getElementById('clienteId').value   = id
  document.getElementById('clienteModalTitle').textContent = t('cliente_editar')
  document.getElementById('clienteNombre').value   = c.nombre||''
  document.getElementById('clienteEmpresa').value  = c.empresa||''
  document.getElementById('clienteEmail').value    = c.email||''
  document.getElementById('clienteTelefono').value = c.telefono||''
  document.getElementById('clienteNotas').value    = c.notas||''
  document.getElementById('clienteColor').value    = c.color||'#00D4AA'
  document.getElementById('clienteAvatar').value   = c.avatar||''
  const ctEl = document.getElementById('clienteTipo'); if(ctEl) ctEl.value = c.tipo||'empresa'
  if (c.avatar) {
    document.getElementById('clienteAvatarEmoji').style.display = 'none'
    document.getElementById('clienteAvatarImg').style.display   = 'block'
    document.getElementById('clienteAvatarImg').src = c.avatar
  }
  openModal('clienteModal')
}


// ─── STORAGE LIMIT CHECK ────────────────────────────────────────
function checkStorageLimit() {
  try {
    let total = 0
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        total += (localStorage.getItem(key)||'').length + key.length
      }
    }
    return total < 4 * 1024 * 1024 / 2  // 4MB limit
  } catch(e) { return true }
}
function checkImageSize(dataUrl) {
  const currentSize = (localStorage.getItem('mn7_data')||'').length
  const imgSize = (dataUrl||'').length
  if (currentSize + imgSize > 4 * 1024 * 1024 / 2) {
    toast(t('toast_espacio_insuficiente'),'error')
    return false
  }
  return true
}

function previewClienteAvatar(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    // Check if adding this image would exceed storage limit
    if (!checkImageSize(e.target.result)) { input.value = ''; return }
    document.getElementById('clienteAvatar').value = e.target.result
    document.getElementById('clienteAvatarEmoji').style.display = 'none'
    document.getElementById('clienteAvatarImg').style.display   = 'block'
    document.getElementById('clienteAvatarImg').src = e.target.result
  }
  reader.readAsDataURL(file)
}

function guardarCliente() {
  const nombre = document.getElementById('clienteNombre').value.trim()
  if (!nombre) { toast(t('err_nombre_requerido','El nombre es requerido'),'error'); return }
  if (!S.clientes) S.clientes = []
  const id  = document.getElementById('clienteId').value
  const data = {
    nombre,
    empresa:  document.getElementById('clienteEmpresa').value.trim(),
    email:    document.getElementById('clienteEmail').value.trim(),
    telefono: document.getElementById('clienteTelefono').value.trim(),
    notas:    document.getElementById('clienteNotas').value.trim(),
    color:    document.getElementById('clienteColor').value || '#00D4AA',
    avatar:   document.getElementById('clienteAvatar').value || null,
    tipo:     document.getElementById('clienteTipo')?.value || 'empresa'
  }
  let newId = id
  if (id) {
    const idx = S.clientes.findIndex(x=>x.id===id)
    if (idx>=0) S.clientes[idx] = {...S.clientes[idx], ...data}
  } else {
    newId = uid()
    S.clientes.push({id: newId, ...data})
  }
  save()
  if (!id) _resolveInlineCreate('cliente', newId)
  closeModal('clienteModal'); render(); toast(t('toast_cliente_guardado','Cliente guardado ✓'))
}

function borrarCliente(id) {
  confirmar(t('confirm_eliminar_cliente'), ()=>{
    S.clientes = (S.clientes||[]).filter(x=>x.id!==id)
    save(); render(); toast(t('toast_cliente_eliminado','Cliente eliminado'))
  }, {titulo:t('confirm_eliminar_cliente_titulo'),icono:'🗑️'})
}

/** Abre el modal de ingreso con el clienteId preseleccionado */
function nuevoIngresoCliente(clienteId) {
  resetIngresoForm()
  // Store clienteId for association when saving
  window._ingresoClienteId = clienteId
  // Pre-fill concepto hint
  const c = (S.clientes||[]).find(x=>x.id===clienteId)
  if (c) document.getElementById('ingresoConcepto').value = ''
  openModal('ingresoModal')
}

// ─── EXPORT ────────────────────────────────────────────────────
// ─── GOOGLE DRIVE BACKUP ──────────────────────────────────────
// Uses the Anthropic MCP proxy already connected to the user's Drive.
// Falls back to a plain download if Drive is not available.
async function exportarADrive() {
  const btn = document.getElementById('driveBackupBtn')
  const status = document.getElementById('driveBackupStatus')
  if (btn) { btn.disabled = true }
  if (status) status.textContent = t('drive_guardando')

  try {
    const data = JSON.stringify(S, null, 2)
    const fecha = new Date().toISOString().slice(0,10)
    const filename = `MoneyNest_backup_${fecha}.json`

    // Try Anthropic Google Drive MCP endpoint
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role:'user', content: `Sube este JSON a Google Drive con el nombre "${filename}". Contenido: ${data.slice(0,500)}...` }],
        mcp_servers: [{ type:'url', url:'https://drivemcp.googleapis.com/mcp/v1', name:'gdrive' }]
      })
    })

    if (resp.ok) {
      if (status) status.textContent = t('drive_guardado')
      toast(t('toast_drive_ok'))
    } else {
      throw new Error('Drive no disponible')
    }
  } catch(e) {
    // Fallback: plain file download
    exportarJSON()
    if (status) status.textContent = t('drive_local')
    toast(t('toast_drive_error'),'error')
  } finally {
    if (btn) btn.disabled = false
    setTimeout(() => { if (status) status.textContent = '' }, 4000)
  }
}

function exportarJSON() {
  const blob = new Blob([JSON.stringify(S,null,2)], {type:'application/json'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `MoneyNest_backup_${todayISO()}.json`
  a.click(); URL.revokeObjectURL(a.href)
  toast(t('toast_json_exportado'))
}
function importarJSON(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result)
      confirmar(t('confirm_importar'), ()=>{
        S = Object.assign(defaultState(), data)
        save(); render(); toast(t('toast_json_importado'))
      }, {titulo:t('confirm_importar_titulo'),icono:'📥',btnLabel:t('confirm_importar_btn')})
    } catch { toast(t('err_leer_archivo'),'error') }
  }
  reader.readAsText(file)
  input.value = ''
}

function exportarPDF() {
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' })
    const m = currentMonth()
    const ing  = calcIngresosMes(m)
    const gas  = calcGastosMes(m)
    const pat  = calcPatrimonio()
    const cf   = ing - gas
    const TEAL = [0,212,170]; const DARK=[17,24,39]; const GRAY=[100,116,139]
    const WHITE=[255,255,255]; const LIGHT=[248,250,252]

    // ── PAGE 1: COVER ────────────────────────────────────────
    // Full-bleed header
    doc.setFillColor(...TEAL)
    doc.rect(0,0,210,80,'F')
    // Decorative circles
    doc.setFillColor(0,180,144); doc.circle(190,20,50,'F')
    doc.setFillColor(0,155,120); doc.circle(195,75,30,'F')

    // Logo area
    doc.setTextColor(...WHITE); doc.setFont('helvetica','bold')
    doc.setFontSize(32); doc.text('Money', 16, 38)
    doc.setFillColor(0,155,120); doc.roundedRect(69,24,30,14,3,3,'F')
    doc.setFontSize(32); doc.text('Nest', 70, 38)

    doc.setFontSize(11); doc.setFont('helvetica','normal')
    doc.text('Informe Financiero Personal', 16, 52)
    doc.setFontSize(9)
    doc.text(monthLabel(m) + '  ·  ' + new Date().toLocaleDateString('es-ES'), 16, 62)
    doc.text(`${S.usuario.nombre}${S.usuario.empresa?' · '+S.usuario.empresa:''}`, 16, 70)

    let y = 96

    // ── KPI CARDS ────────────────────────────────────────────
    const kpis = [
      { label:'Ingresos mes',     val:eur(ing),              color:[16,185,129],  bg:[240,253,244] },
      { label:'Gastos mes',       val:eur(gas),              color:[244,63,94],   bg:[255,241,242] },
      { label:'Cash Flow',        val:(cf>=0?'+':'')+eur(cf),color:cf>=0?[0,180,144]:[244,63,94], bg:cf>=0?[240,253,249]:[255,241,242] },
      { label:'Patrimonio Neto',  val:eur(pat),              color:[99,102,241],  bg:[245,243,255] },
      { label:'Tasa de ahorro',   val:pct(calcSavingsRate(m)),color:[245,158,11], bg:[255,251,235] },
      { label:'Capital invertido',val:eur(calcCartera()),    color:[139,92,246],  bg:[250,245,255] },
    ]
    const cw=60, ch=20, gap=6, startX=14
    kpis.forEach((k,i) => {
      const kx = startX + (i%3)*(cw+gap)
      const ky = y + Math.floor(i/3)*(ch+8)
      doc.setFillColor(...k.bg); doc.roundedRect(kx, ky, cw, ch, 3, 3, 'F')
      doc.setDrawColor(...k.color); doc.setLineWidth(0.5)
      doc.roundedRect(kx, ky, cw, ch, 3, 3, 'S')
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...GRAY)
      doc.text(k.label.toUpperCase(), kx+4, ky+7)
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...k.color)
      doc.text(k.val, kx+4, ky+15)
    })
    y += 62

    // Helper: section title bar
    const sectionTitle = (title, color=TEAL) => {
      y += 6
      doc.setFillColor(...color)
      doc.roundedRect(14, y, 182, 7, 2, 2, 'F')
      doc.setTextColor(...WHITE); doc.setFontSize(8.5); doc.setFont('helvetica','bold')
      doc.text(title, 18, y+5)
      y += 10
    }

    // Helper: add autoTable and track y
    const addTable = (headers, rows, headColor=TEAL) => {
      if (!rows.length) return
      doc.autoTable({
        startY: y,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: headColor, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: 7.5, textColor: DARK, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: LIGHT },
        footStyles: { fillColor: [230,252,245], textColor: DARK, fontStyle: 'bold', fontSize: 7.5 },
        margin: { left: 14, right: 14 },
        tableWidth: 182,
        didDrawPage: () => {}
      })
      y = doc.lastAutoTable.finalY + 4
    }

    // ── INGRESOS ─────────────────────────────────────────────
    if (S.ingresos.length) {
      sectionTitle('INGRESOS', [16,185,129])
      const ingTotal = S.ingresos.reduce((a,i)=>a+(Number(i.importe)||0),0)
      addTable(
        ['Concepto','Categoría','Fecha','Importe'],
        [
          ...S.ingresos.map(i=>[i.concepto||'—', i.categoria||'—', fmtDate(i.fecha), eur(i.importe)]),
          ['TOTAL','','',eur(ingTotal)]
        ],
        [16,185,129]
      )
    }

    // ── GASTOS ───────────────────────────────────────────────
    const realGastos = S.gastos.filter(g=>g.tipo!==TX_TYPES.GOAL_TRANSFER)
    if (realGastos.length) {
      sectionTitle('GASTOS', [244,63,94])
      const gasTotal = realGastos.reduce((a,g)=>a+(Number(g.importe)||0),0)
      addTable(
        ['Concepto','Categoría','Fecha','Importe'],
        [
          ...realGastos.map(g=>[g.concepto||'—', g.categoria||'—', fmtDate(g.fecha), eur(g.importe)]),
          ['TOTAL','','',eur(gasTotal)]
        ],
        [244,63,94]
      )
    }

    // ── INVERSIONES ──────────────────────────────────────────
    if (S.inversiones.length) {
      sectionTitle('INVERSIONES', [99,102,241])
      addTable(
        ['Nombre','Categoría','Capital','ROI','Valor actual','Estado'],
        S.inversiones.map(i=>[
          i.nombre||'—', i.categoria||'—', eur(i.importe),
          pct(calcROI(i)), eur(calcValorInv(i)), i.cerrada?'Liquidada':'Activa'
        ]),
        [99,102,241]
      )
    }

    // ── DEUDAS ───────────────────────────────────────────────
    if (S.deudas.length) {
      sectionTitle('DEUDAS', [245,158,11])
      const deuTotal = S.deudas.reduce((a,d)=>a+((Number(d.importeTotal)||0)-(Number(d.importePagado)||0)),0)
      addTable(
        ['Nombre','Categoría','Total','Pagado','Pendiente'],
        [
          ...S.deudas.map(d=>[
            d.nombre||'—', d.categoria||'—',
            eur(d.importeTotal), eur(d.importePagado||0),
            eur((Number(d.importeTotal)||0)-(Number(d.importePagado)||0))
          ]),
          ['TOTAL PENDIENTE','','','',eur(deuTotal)]
        ],
        [245,158,11]
      )
    }

    // ── FOOTER on every page ─────────────────────────────────
    const pages = doc.internal.getNumberOfPages()
    for (let p=1; p<=pages; p++) {
      doc.setPage(p)
      doc.setFillColor(241,245,249); doc.rect(0,287,210,10,'F')
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica','normal')
      doc.text('MoneyNest v'+VERSION+'  ·  '+new Date().toLocaleDateString('es-ES')+'  ·  '+S.usuario.nombre, 14, 293)
      doc.text('Página '+p+' de '+pages, 196, 293, { align:'right' })
      // Teal top strip on pages > 1
      if (p > 1) {
        doc.setFillColor(...TEAL); doc.rect(0,0,210,4,'F')
      }
    }

    doc.save(`MoneyNest_Informe_${todayISO()}.pdf`)
    toast(t('toast_pdf_exportado'))
  } catch(e) { toast(t('err_pdf'),'error'); console.error(e) }
}

function exportarExcel() {
  try {
    const wb = XLSX.utils.book_new()
    const m = currentMonth()

    // Helper: create a styled worksheet with bold header row, auto-width cols, and optional totals
    const makeSheet = (headers, rows, totalsRow) => {
      const data = [headers, ...rows]
      if (totalsRow) data.push(totalsRow)
      const ws = XLSX.utils.aoa_to_sheet(data)

      // Bold header row
      headers.forEach((_, ci) => {
        const cell = XLSX.utils.encode_cell({r:0, c:ci})
        if (!ws[cell]) ws[cell] = {v: headers[ci], t:'s'}
        ws[cell].s = { font:{bold:true, color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'00D4AA'}}, alignment:{horizontal:'center'} }
      })

      // Bold totals row if present
      if (totalsRow) {
        const tr = rows.length + 1
        totalsRow.forEach((_, ci) => {
          const cell = XLSX.utils.encode_cell({r:tr, c:ci})
          if (ws[cell]) ws[cell].s = { font:{bold:true}, fill:{fgColor:{rgb:'E8FDF8'}} }
        })
      }

      // Auto column widths
      ws['!cols'] = headers.map((h, ci) => {
        const maxLen = Math.max(h.length, ...rows.map(r => String(r[ci]||'').length), totalsRow ? String(totalsRow[ci]||'').length : 0)
        return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }
      })
      return ws
    }

    // ─── RESUMEN ───────────────────────────────────────────────
    const resumenRows = [
      ['MoneyNest v'+VERSION, ''],
      ['Generado el', new Date().toLocaleDateString('es-ES')],
      ['',''],
      ['── MES ACTUAL ──', ''],
      ['Ingresos', calcIngresosMes(m)],
      ['Gastos', calcGastosMes(m)],
      ['Cash Flow', calcCashFlow(m)],
      ['Tasa de ahorro (%)', calcSavingsRate(m)],
      ['',''],
      ['── GLOBAL ──', ''],
      ['Patrimonio Neto', calcPatrimonio()],
      ['Dinero disponible', calcDineroDisponible()],
      ['Capital invertido', calcCartera()],
      ['Ganancia realizada', calcGananciaTotal()],
      ['Deuda pendiente', calcTotalDeuda()],
    ]
    const wsRes = XLSX.utils.aoa_to_sheet([['Indicador','Valor'], ...resumenRows])
    wsRes['!cols'] = [{wch:28},{wch:20}]
    // Style header
    ;['A1','B1'].forEach(c=>{ if(!wsRes[c]) return; wsRes[c].s = {font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'00D4AA'}}} })
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

    // ─── INGRESOS ──────────────────────────────────────────────
    const ingHeaders = ['Concepto','Categoría','Importe (€)','Fecha','Cliente','Cuenta','Recurrente','Estado']
    const ingRows = S.ingresos.map(i=>[
      i.concepto||'', i.categoria||'', Number(i.importe)||0, i.fecha||'',
      i.cliente||'', getCuenta(i.cuentaId)?.nombre||'',
      i.recurrente?'Sí':'No', i.status==='pending'?'Pendiente':'Cobrado'
    ])
    const ingTotal = ingRows.reduce((a,r)=>a+(r[2]||0),0)
    const wsIng = makeSheet(ingHeaders, ingRows, ['TOTAL','',ingTotal,'','','','',''])
    XLSX.utils.book_append_sheet(wb, wsIng, 'Ingresos')

    // ─── GASTOS ────────────────────────────────────────────────
    const gasHeaders = ['Concepto','Categoría','Importe (€)','Fecha','Cuenta','Recurrente','Notas']
    const gasRows = S.gastos
      .filter(g=>g.tipo!==TX_TYPES.GOAL_TRANSFER) // exclude internal goal transfers
      .map(g=>[
        g.concepto||'', g.categoria||'', Number(g.importe)||0, g.fecha||'',
        getCuenta(g.cuentaId)?.nombre||'', g.recurrente?'Sí':'No', g.notas||''
      ])
    const gasTotal = gasRows.reduce((a,r)=>a+(r[2]||0),0)
    const wsGas = makeSheet(gasHeaders, gasRows, ['TOTAL','',gasTotal,'','','',''])
    XLSX.utils.book_append_sheet(wb, wsGas, 'Gastos')

    // ─── INVERSIONES ───────────────────────────────────────────
    const invHeaders = ['Nombre','Categoría','Capital (€)','ROI (%)','Valor actual (€)','Estado','Ganancia (€)','Fecha entrada','Fecha cierre']
    const invRows = S.inversiones.map(i=>[
      i.nombre||'', i.categoria||'', Number(i.importe)||0,
      parseFloat(calcROI(i).toFixed(2)), parseFloat(calcValorInv(i).toFixed(2)),
      i.cerrada?'Liquidada':'Activa',
      parseFloat((calcValorInv(i)-Number(i.importe)).toFixed(2)),
      i.fecha||'', i.fechaCierre||''
    ])
    const wsInv = makeSheet(invHeaders, invRows, null)
    XLSX.utils.book_append_sheet(wb, wsInv, 'Inversiones')

    // ─── DEUDAS ────────────────────────────────────────────────
    const deuHeaders = ['Nombre','Categoría','Total (€)','Pagado (€)','Pendiente (€)','Interés (%)','Vencimiento','Notas']
    const deuRows = S.deudas.map(d=>[
      d.nombre||'', d.categoria||'', Number(d.importeTotal)||0,
      Number(d.importePagado)||0,
      (Number(d.importeTotal)||0)-(Number(d.importePagado)||0),
      d.interes||0, d.vencimiento||'', d.notas||''
    ])
    const deuTotal = deuRows.reduce((a,r)=>a+(r[4]||0),0)
    const wsDeu = makeSheet(deuHeaders, deuRows, ['TOTAL','','','',deuTotal,'','',''])
    XLSX.utils.book_append_sheet(wb, wsDeu, 'Deudas')

    // ─── OBJETIVOS ─────────────────────────────────────────────
    const objHeaders = ['Nombre','Categoría','Meta (€)','Ahorrado (€)','% Completado','Fecha objetivo']
    const objRows = S.objetivos.map(o=>[
      o.nombre||'', o.categoria||'', Number(o.objetivo)||0, Number(o.actual)||0,
      o.objetivo ? Math.round((Number(o.actual)||0)/(Number(o.objetivo)||1)*100) : 0,
      o.fechaObjetivo||''
    ])
    const wsObj = makeSheet(objHeaders, objRows, null)
    XLSX.utils.book_append_sheet(wb, wsObj, 'Objetivos')

    // ─── CLIENTES (if any) ─────────────────────────────────────
    if ((S.clientes||[]).length) {
      const cliHeaders = ['Nombre','Empresa','Email','Teléfono','Facturado (€)']
      const cliRows = (S.clientes||[]).map(c=>{
        const fac = S.ingresos.filter(i=>i.clienteId===c.id).reduce((a,i)=>a+(Number(i.importe)||0),0)
        return [c.nombre||'', c.empresa||'', c.email||'', c.telefono||'', fac]
      })
      XLSX.utils.book_append_sheet(wb, makeSheet(cliHeaders, cliRows, null), 'Clientes')
    }

    // ─── PROVEEDORES (if any) ──────────────────────────────────
    if ((S.proveedores||[]).length) {
      const provHeaders = ['Nombre','Empresa','Email','Teléfono','Categoría','Total Pagado (€)']
      const provRows = (S.proveedores||[]).map(p=>{
        const pag = S.gastos.filter(g=>g.proveedorId===p.id).reduce((a,g)=>a+(Number(g.importe)||0),0)
        return [p.nombre||'', p.empresa||'', p.email||'', p.telefono||'', p.categoria||'', pag]
      })
      XLSX.utils.book_append_sheet(wb, makeSheet(provHeaders, provRows, null), 'Proveedores')
    }

    // ─── DEVENGOS (if any) ─────────────────────────────────────
    if ((S.devengos||[]).length) {
      const devHeaders = ['Concepto','Tipo','Importe (€)','Fecha Devengo','Fecha Cobro','Estado']
      const devRows = (S.devengos||[]).map(d=>[
        d.concepto||'', d.tipo||'', Number(d.importe)||0,
        d.fecha||'', d.fechaCobro||'', d.estado||''
      ])
      XLSX.utils.book_append_sheet(wb, makeSheet(devHeaders, devRows, null), 'Devengos')
    }

    XLSX.writeFile(wb, `MoneyNest_Completo_${todayISO()}.xlsx`)
    toast(t('toast_excel_exportado'))
  } catch(e) { toast(t('err_excel'),'error'); console.error(e) }
}

// ─── THEME ─────────────────────────────────────────────────────
function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark'
  applyTheme(); save()
  // Achievement: settings change
  if (window.MNGamification && window.MNGamification.checkAchievement) {
    window.MNGamification.checkAchievement('settings_change');
  }
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.theme||'dark')
  const sw = document.getElementById('themeSwitch')
  const lbl = document.getElementById('theme-label')
  const topBtn = document.getElementById('topThemeBtn'); if(topBtn) topBtn.textContent = (S.theme==='dark'?'🌙':'☀️')
  if (sw) sw.classList.toggle('on', S.theme==='dark')
  if (lbl) lbl.textContent = S.theme==='dark' ? t('theme_dark') : t('theme_light')

  setTimeout(updateSidebarLogo, 0)
}

// ─── SIDEBAR MOBILE ─────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar')
  const ov = document.getElementById('sidebarOverlay')
  const isOpen = sb.classList.toggle('open')
  ov.classList.toggle('open', isOpen)
  if (isOpen) _pushScrollLock(); else _popScrollLock()
}
function closeSidebar() {
  const wasOpen = document.getElementById('sidebar').classList.contains('open')
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebarOverlay').classList.remove('open')
  if (wasOpen) _popScrollLock()
}
// Robust cross-browser (incl. iOS Safari) scroll lock, reference-counted so
// nested overlays (e.g. a confirm dialog opened on top of a form modal) don't
// prematurely unlock the body when the inner one closes.
// `overflow:hidden` alone does NOT reliably block background scroll/touch on
// iOS Safari — position:fixed + restoring scrollY on release is the standard fix.
let _scrollLockCount = 0
let _scrollLockY = 0
function _pushScrollLock() {
  if (_scrollLockCount === 0) {
    _scrollLockY = window.scrollY || window.pageYOffset || 0
    document.body.style.position = 'fixed'
    document.body.style.top = `-${_scrollLockY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
  }
  _scrollLockCount++
}
function _popScrollLock() {
  _scrollLockCount = Math.max(0, _scrollLockCount - 1)
  if (_scrollLockCount === 0) _forceReleaseScrollLock()
}
function _forceReleaseScrollLock() {
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  document.body.style.overflow = ''
  window.scrollTo(0, _scrollLockY)
  _scrollLockCount = 0
}

// ─── TOAST — PREMIUM SYSTEM ────────────────────────────────────
// El sistema premium (premium-ux.js) se carga DESPUÉS de app.js.
// Esta función actúa como puente: si el sistema premium está listo
// lo usa; si no, cae al comportamiento legacy.
let toastTimer = null
function toast(msg, type='success') {
  // Si premium-ux.js ya cargó y sobrescribió window.toast, usarlo
  if (window._mnPremiumToastReady) {
    window._mnPremiumToast(msg, type)
    return
  }
  // Fallback legacy mientras carga
  const el = document.getElementById('toast')
  if (el) {
    el.textContent = msg
    el.className = `show ${type}`
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(()=>{ el.className=''; }, 3000)
  }
}

// ─── KEYBOARD ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAllModals()
    return
  }
  // Enter key: submit the active creation modal form
  if (e.key === 'Enter') {
    // Avoid triggering when focus is on a textarea, select, or button
    const tag = document.activeElement ? document.activeElement.tagName : ''
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return

    const modalMap = {
      ingresoModal:    guardarIngreso,
      gastoModal:      guardarGasto,
      inversionModal:  guardarInversion,
      revalorizarModal: confirmarRevalorizacion,
      liquidarModal:   confirmarLiquidacion,
      deudaModal:      guardarDeuda,
      objetivoModal:   guardarObjetivo,
      presupuestoModal:guardarPresupuesto,
      cuentaModal:     guardarCuenta,
      pagoModal:       registrarPago,
      aportarModal:    () => {
        const btn = document.querySelector('#aportarModal .btn-primary')
        if (btn) btn.click()
      }
    }

    for (const [id, fn] of Object.entries(modalMap)) {
      const el = document.getElementById(id)
      if (el && el.classList.contains('open')) {
        e.preventDefault()
        fn()
        return
      }
    }
  }
})
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) closeModal(el.id) })
})

// Protect against accidental page close when a modal is open
window.addEventListener('beforeunload', e => {
  const hasOpenModal = document.querySelector('.modal-overlay.open')
  if (hasOpenModal) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
})

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: MODO PERSONAL / EMPRESA ─────────────────────────
// ════════════════════════════════════════════════════════════════
const currentMode = 'personal' // Fixed: personal-only app

function toggleMode() {
  // Mode switching disabled - personal-only app
}

function updateModeUI() {
  // Personal-only: nothing to toggle
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: IMPUESTOS ────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/** Devuelve la reserva fiscal estimada para el mes actual */
function calcTaxReserved(month) {
  month = month || currentMonth()
  const cfg = S.taxConfig || { iva: 21, irpf: 15 }
  const ing = calcIngresosMes(month)
  // IVA repercutido + IRPF a retener sobre base imponible
  const ivaAmount  = ing * (Number(cfg.iva)  / 100)
  const irpfAmount = ing * (Number(cfg.irpf) / 100)
  return ivaAmount + irpfAmount
}

/** Dinero disponible = saldo total de cuentas */
function calcDineroReal() {
  return calcDineroDisponible()
}

function guardarImpuestos() {
  const iva  = parseAmount(document.getElementById('taxIVA').value)  || 21
  const irpf = parseAmount(document.getElementById('taxIRPF').value) || 15
  const regimen = document.getElementById('taxRegimen').value
  S.taxConfig = { iva, irpf, regimen }
  save()
  closeModal('taxModal')
  updateModeUI()
  toast('Impuestos configurados ✓')
}

function abrirTaxModal() {
  const cfg = S.taxConfig || { iva: 21, irpf: 15, regimen: 'autonomo' }
  document.getElementById('taxIVA').value   = cfg.iva   || 21
  document.getElementById('taxIRPF').value  = cfg.irpf  || 15
  document.getElementById('taxRegimen').value = cfg.regimen || 'autonomo'
  openModal('taxModal')
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: FONDO DE EMERGENCIA ─────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Calcula el fondo de emergencia recomendado (gasto medio × 6 meses)
 * @returns {number} Importe recomendado
 */
function calcEmergencyFund() {
  const months = getMonths(12)
  const gastosMensuales = months.map(m => calcGastosMes(m)).filter(v => v > 0)
  if (!gastosMensuales.length) return 0
  const mediaGastos = gastosMensuales.reduce((a, v) => a + v, 0) / gastosMensuales.length
  return mediaGastos * 6
}

/** Porcentaje de cobertura del fondo de emergencia actual */
function calcEmergencyCoverage() {
  const target  = calcEmergencyFund()
  const current = calcDineroDisponible()
  if (!target) return 100
  return clamp((current / target) * 100, 0, 100)
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: REGLA 50/30/20 ──────────────────────────────────
// ════════════════════════════════════════════════════════════════

// categoryType en cada gasto: 'necesidad' | 'deseo' | 'ahorro'
const CAT_TYPES_DEFAULT = {
  'Vivienda': 'necesidad', 'Alimentación': 'necesidad', 'Transporte': 'necesidad',
  'Salud': 'necesidad', 'Educación': 'necesidad',
  'Ocio': 'deseo', 'Ropa': 'deseo', 'Restaurantes': 'deseo',
  'Suscripciones': 'deseo', 'Tecnología': 'deseo'
}

/**
 * Calcula la distribución real 50/30/20 para un mes
 * @returns {{ necesidad, deseo, ahorro, total, pctNec, pctDes, pctAh }}
 */
function calc503020(month) {
  month = month || currentMonth()
  const gastos = S.gastos.filter(g => g.fecha && g.fecha.startsWith(month) && g.tipo!==TX_TYPES.GOAL_TRANSFER)
  let necesidad = 0, deseo = 0

  gastos.forEach(g => {
    const tipo = g.categoryType || CAT_TYPES_DEFAULT[g.categoria] || 'deseo'
    if (tipo === 'necesidad') necesidad += Number(g.importe) || 0
    else deseo += Number(g.importe) || 0
  })

  const ing     = calcIngresosMes(month)
  const cf      = ing - calcGastosMes(month)
  const ahorro  = Math.max(0, cf)
  const total   = ing || 1

  return {
    necesidad, deseo, ahorro,
    total: ing,
    pctNec: (necesidad / total) * 100,
    pctDes: (deseo     / total) * 100,
    pctAh:  (ahorro    / total) * 100
  }
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: ASISTENTE DE DEUDAS ─────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Método BOLA DE NIEVE — pagar primero las deudas más pequeñas
 * @returns {Array} deudas ordenadas
 */
function debtSnowball() {
  // Sort: smallest balance first — gain momentum by clearing small debts first
  return [...S.deudas]
    .filter(d => (Number(d.importeTotal) - Number(d.importePagado || 0)) > 0)
    .sort((a, b) => {
      const pendA = Number(a.importeTotal) - Number(a.importePagado || 0)
      const pendB = Number(b.importeTotal) - Number(b.importePagado || 0)
      return pendA - pendB  // ascending: smallest first
    })
}

/**
 * Método AVALANCHA — pagar primero las deudas con mayor interés
 * @returns {Array} deudas ordenadas por interés descendente
 */
function debtAvalanche() {
  // Sort: highest interest rate first — minimize total interest paid
  return [...S.deudas]
    .filter(d => (Number(d.importeTotal) - Number(d.importePagado || 0)) > 0)
    .sort((a, b) => Number(b.interes || 0) - Number(a.interes || 0))  // descending: highest interest first
}

/**
 * Calcula cómo se repartiría el pago de UN mes entre las deudas
 * según el orden dado (avalancha/nieve/personalizado).
 * Devuelve un array [{id, nombre, importe}] — solo deudas con importe > 0
 */
function calcMonthlyAllocation(monthlyBudget, orderedDebts) {
  if (!monthlyBudget || monthlyBudget <= 0 || !orderedDebts.length) return []
  const debts = orderedDebts.map(d => ({
    id: d.id,
    nombre: d.nombre || '—',
    balance: Math.max(0, (Number(d.importeTotal)||0) - (Number(d.importePagado)||0)),
    minPay: Math.max(10, (Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0))) * 0.02),
    pay: 0
  })).filter(d => d.balance > 0)

  let remaining = monthlyBudget

  // Pagos mínimos primero
  debts.forEach(d => {
    const minPay = Math.min(d.minPay, d.balance, remaining)
    d.pay += minPay
    remaining -= minPay
  })

  // El resto va a la primera deuda activa según el orden (avalancha/nieve)
  for (let i = 0; i < debts.length; i++) {
    if (remaining <= 0) break
    const room = debts[i].balance - debts[i].pay
    const extra = Math.min(remaining, room)
    if (extra > 0) { debts[i].pay += extra; remaining -= extra }
  }

  return debts.filter(d => d.pay > 0.01).map(d => ({ id: d.id, nombre: d.nombre, importe: Math.round(d.pay * 100) / 100 }))
}

/**
 * Simula el pago mes a mes con un método dado (snowball/avalanche).
 * Devuelve { months, totalInterest, payoffOrder }
 */
function simulateDebtPayoff(monthlyBudget, orderedDebts) {
  if (!monthlyBudget || monthlyBudget <= 0 || !orderedDebts.length) return { months: 0, totalInterest: 0 }
  // Deep copy balances
  const debts = orderedDebts.map(d => ({
    id: d.id,
    nombre: d.nombre||'—',
    balance: Math.max(0, (Number(d.importeTotal)||0) - (Number(d.importePagado)||0)),
    rate: (Number(d.interes)||0) / 100 / 12,  // monthly rate
    minPay: Math.max(10, (Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0))) * 0.02)
  })).filter(d => d.balance > 0)

  let months = 0
  let totalInterest = 0
  const MAX_MONTHS = 600

  while (debts.some(d => d.balance > 0) && months < MAX_MONTHS) {
    months++
    let remaining = monthlyBudget

    // Apply minimum payments first
    debts.forEach(d => {
      if (d.balance <= 0) return
      const interest = d.balance * d.rate
      const minPay = Math.min(d.minPay, d.balance + interest)
      const actualMin = Math.min(minPay, remaining)
      totalInterest += interest
      d.balance = Math.max(0, d.balance + interest - actualMin)
      remaining -= actualMin
    })

    // Apply extra to first active debt (the ordered priority)
    for (let i = 0; i < debts.length; i++) {
      if (debts[i].balance > 0 && remaining > 0) {
        const pay = Math.min(remaining, debts[i].balance)
        debts[i].balance = Math.max(0, debts[i].balance - pay)
        remaining -= pay
        if (debts[i].balance <= 0.01) debts[i].balance = 0
        break
      }
    }
  }

  return { months, totalInterest }
}

/** Calcula cuántos meses aproximados para saldar todas las deudas */
function calcDebtFreeMonths(monthlyPayment) {
  if (!monthlyPayment || monthlyPayment <= 0) return null
  const totalPending = calcTotalDeuda()
  return Math.ceil(totalPending / monthlyPayment)
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: CIERRE DE MES ───────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Genera el informe de cierre de mes
 * @param {string} month — YYYY-MM
 * @returns {Object} revisión completa
 */
function generateMonthlyReview(month) {
  month = month || currentMonth()
  const mp  = prevMonth(month)
  const ing  = calcIngresosMes(month)
  const gas  = calcGastosMes(month)
  const ingP = calcIngresosMes(mp)
  const gasP = calcGastosMes(mp)
  const cf   = ing - gas

  // Detectar anomalías
  const anomalies = []

  if (gas > ing) {
    anomalies.push({ type: 'danger', msg: `Déficit mensual: gastas ${eur(gas - ing)} más de lo que ingresas.` })
  }
  if (gasP > 0 && gas > gasP * 1.3) {
    anomalies.push({ type: 'warning', msg: `Gastos un ${pct((gas - gasP) / gasP * 100)} superiores al mes anterior.` })
  }
  const catMap  = gastosMesByCat(month)
  const catMapP = gastosMesByCat(mp)
  Object.entries(catMap).forEach(([cat, val]) => {
    const prev = catMapP[cat] || 0
    if (prev > 0 && val > prev * 1.5 && val > 50) {
      anomalies.push({ type: 'warning', msg: `"${cat}" subió un ${pct((val - prev) / prev * 100)} respecto al mes anterior.` })
    }
  })

  // Top gastos del mes
  const topGastos = [...S.gastos]
    .filter(g => g.tipo!==TX_TYPES.GOAL_TRANSFER && g.fecha && g.fecha.startsWith(month))
    .sort((a, b) => Number(b.importe) - Number(a.importe))
    .slice(0, 5)

  const dist = calc503020(month)
  const sr   = calcSavingsRate(month)

  return { month, ing, gas, cf, sr, anomalies, topGastos, dist, ingP, gasP }
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: PREVISIÓN DE GASTOS ─────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Detecta gastos recurrentes y predice los del próximo mes
 * @returns {Array} gastos esperados próximo mes
 */
function predictUpcomingExpenses() {
  const m = currentMonth()
  const months3 = [m, prevMonth(m), prevMonth(prevMonth(m))]

  // Agrupar por concepto
  const conceptMap = {}
  S.gastos
    .filter(g => g.tipo!==TX_TYPES.GOAL_TRANSFER && g.fecha && months3.some(mo => g.fecha.startsWith(mo)))
    .forEach(g => {
      const key = (g.concepto || '').toLowerCase().trim()
      if (!key) return
      if (!conceptMap[key]) conceptMap[key] = []
      conceptMap[key].push(g)
    })

  const predicted = []
  Object.entries(conceptMap).forEach(([key, entries]) => {
    // Si aparece en 2+ de los últimos 3 meses → recurrente
    const uniqueMonths = new Set(entries.map(e => e.fecha.slice(0, 7))).size
    if (uniqueMonths >= 2) {
      const avgImporte = entries.reduce((a, e) => a + Number(e.importe), 0) / entries.length
      const last = entries.sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
      predicted.push({
        concepto:   last.concepto,
        categoria:  last.categoria,
        importe:    avgImporte,
        confidence: uniqueMonths >= 3 ? 'alta' : 'media'
      })
    }
  })

  // Añadir también los marcados explícitamente como recurrentes
  S.gastos.filter(g => g.recurrente && g.fecha && g.fecha.startsWith(m)).forEach(g => {
    const alreadyIn = predicted.find(p => p.concepto.toLowerCase() === (g.concepto || '').toLowerCase())
    if (!alreadyIn) {
      predicted.push({ concepto: g.concepto, categoria: g.categoria, importe: Number(g.importe), confidence: 'alta' })
    }
  })

  return predicted.sort((a, b) => b.importe - a.importe).slice(0, 10)
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: FACTURAS / INGRESOS PENDIENTES ──────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Obtiene ingresos marcados como pendientes (status: 'pending')
 * @returns {Array} facturas pendientes de cobro
 */
function getPendingIncome() {
  return S.ingresos.filter(i => i.status === 'pending')
}

function getPendingTotal() {
  return getPendingIncome().reduce((a, i) => a + (Number(i.importe) || 0), 0)
}

function marcarIngresoCobrado(id) {
  const idx = S.ingresos.findIndex(i => i.id === id)
  if (idx < 0) return
  S.ingresos[idx].status = 'paid'
  const cuentaId = S.ingresos[idx].cuentaId
  if (cuentaId) {
    const c = getCuenta(cuentaId)
    if (c) c.saldo = (Number(c.saldo) || 0) + (Number(S.ingresos[idx].importe) || 0)
  }
  save(); render(); toast('Factura marcada como cobrada ✓')
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: PROYECCIÓN FINANCIERA ───────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Proyecta la evolución del patrimonio para los próximos N meses
 * @param {number} months — número de meses a proyectar
 * @returns {Array<{mes, conservador, moderado, optimista}>}
 */
function projectWealth(months) {
  months = months || 12
  const currentPat = calcPatrimonio()
  const months6    = getMonths(12)

  // Calcular CF medio de los últimos 12 meses
  const cfHistory = months6.map(m => calcCashFlow(m)).filter(v => v !== 0)
  const avgCF     = cfHistory.length
    ? cfHistory.reduce((a, v) => a + v, 0) / cfHistory.length
    : 0

  // Rentabilidad media de inversiones activas
  const activas = S.inversiones.filter(i => !i.cerrada)
  const avgRoi  = activas.length
    ? activas.reduce((a, i) => a + (Number(i.rentabilidad) || 0), 0) / activas.length
    : 5
  const invMonthly = (calcCartera() * (avgRoi / 100)) / 12

  const scenarios = []
  let patCons = currentPat
  let patMod  = currentPat
  let patOpt  = currentPat

  for (let i = 1; i <= months; i++) {
    const d    = new Date()
    d.setMonth(d.getMonth() + i)
    const mes  = d.toISOString().slice(0, 7)

    patCons += avgCF * 0.7  + invMonthly * 0.8
    patMod  += avgCF        + invMonthly
    patOpt  += avgCF * 1.2  + invMonthly * 1.15

    scenarios.push({ mes, conservador: patCons, moderado: patMod, optimista: patOpt })
  }
  return scenarios
}

// ════════════════════════════════════════════════════════════════
// ─── PÁGINAS NUEVAS: ANÁLISIS & HERRAMIENTAS ─────────────────
// ════════════════════════════════════════════════════════════════

function _renderDayOfWeekHeatmap() {
  // Agrupa gastos de los últimos 3 meses por día de semana
  const months3 = getMonths(3)
  const dayTotals  = Array(7).fill(0)  // 0=Dom, 1=Lun... 6=Sáb
  const dayCounts  = Array(7).fill(0)
  S.gastos.filter(g => {
    if (g.tipo === TX_TYPES.GOAL_TRANSFER) return false
    return months3.some(m => (g.fecha || '').startsWith(m))
  }).forEach(g => {
    if (!g.fecha) return
    const dow = new Date(g.fecha + 'T12:00:00').getDay()
    dayTotals[dow] += Number(g.importe) || 0
    dayCounts[dow]++
  })

  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  // Reorder Mon-Sun
  const order = [1, 2, 3, 4, 5, 6, 0]
  const vals   = order.map(i => dayTotals[i])
  const maxVal = Math.max(...vals, 1)

  const bars = order.map((i, idx) => {
    const val  = dayTotals[i]
    const pct2 = (val / maxVal * 100).toFixed(1)
    const isWeekend = i === 0 || i === 6
    const color = val === maxVal ? 'var(--red)' : isWeekend ? 'var(--gold)' : 'var(--accent)'
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
        <div style="font-size:.68rem;font-weight:700;color:var(--text2)">${labels[i]}</div>
        <div style="width:100%;background:var(--border);border-radius:4px;height:60px;position:relative;overflow:hidden">
          <div style="position:absolute;bottom:0;left:0;right:0;background:${color};border-radius:4px;height:${pct2}%;opacity:0.8;transition:height .6s ease"></div>
        </div>
        <div style="font-size:.65rem;color:${val>0?'var(--text)':'var(--text3)'};font-weight:${val===maxVal?'800':'600'};max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${val>0?eur(val).replace(' €',''):'—'}</div>
      </div>`
  }).join('')

  const total3m = vals.reduce((a,v)=>a+v,0)
  if (total3m === 0) return `<div class="empty" style="padding:20px"><div class="empty-icon">📅</div><div class="empty-title" style="font-size:.85rem">Sin datos suficientes</div></div>`

  return `
    <div style="padding:4px 0 8px">
      <div style="display:flex;gap:6px;align-items:flex-end;padding:0 4px;min-width:0">${bars}</div>
      <div style="margin-top:10px;font-size:.72rem;color:var(--text2);text-align:center">
        Gasto total 3 meses: <strong style="color:var(--text)">${eur(total3m)}</strong>
      </div>
    </div>`
}

function _analisisSwitchTab(tab) {
  window._analisisActiveTab = tab
  renderAnalisis()
}

function renderAnalisis() {
  const m   = currentMonth()
  const rev = generateMonthlyReview(m)
  const d50 = calc503020(m)
  const ef  = calcEmergencyFund()
  const efCov = calcEmergencyCoverage()
  const prev = predictUpcomingExpenses()
  const pending = getPendingIncome()

  // ── Burn rate ──
  const avgMonthlySpend = (() => {
    const months = getMonths(3)
    const total = months.reduce((a,mo)=>a+calcGastosMes(mo),0)
    return total/3
  })()
  const burnMonths = avgMonthlySpend > 0 ? Math.floor(calcDineroDisponible()/avgMonthlySpend) : 0

  // ── Investment performance ──
  const invAbiertas = S.inversiones.filter(i=>!i.cerrada)
  const invCerradas = S.inversiones.filter(i=>i.cerrada)
  const totalInv = invAbiertas.reduce((a,i)=>a+(Number(i.importe)||0),0)
  const gananciaLatente = calcGananciaLatente()
  const gananciaRealizada = calcGananciaTotal()
  const roiMedio = invCerradas.length ? invCerradas.reduce((a,i)=>a+(Number(i.roiReal)||0),0)/invCerradas.length : 0
  const tasaAhorro = calcSavingsRate(m)

  // ── Category spending breakdown (uses global period) ──
  const catMap = (() => {
    const map = {}
    S.gastos.filter(g => _gDateInPeriod(g.fecha) && g.tipo !== TX_TYPES.GOAL_TRANSFER)
      .forEach(g => { const c = g.categoria||'Sin categoría'; map[c]=(map[c]||0)+(Number(g.importe)||0) })
    return map
  })()
  const topCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const totalGas = Object.values(catMap).reduce((a,v)=>a+v,0)||1

  const anomHtml = rev.anomalies.length
    ? rev.anomalies.map(a => `
        <div class="insight-item">
          <div class="insight-icon" style="background:${a.type==='danger'?'var(--red-dim)':'var(--gold-dim)'}">${a.type==='danger'?'🚨':'⚠️'}</div>
          <div class="insight-text">${a.msg}</div>
        </div>`).join('')
    : '<div class="insight-item"><div class="insight-icon" style="background:var(--green-dim)">✅</div><div class="insight-text"><strong>¡Sin anomalías este mes!</strong> Tus finanzas están en orden.</div></div>'

  const prevRows = prev.length
    ? prev.map(p => `<tr>
        <td class="td-main">${p.concepto}</td>
        <td><span class="tag">${p.categoria||'—'}</span></td>
        <td class="td-amount td-neg">~${eur(p.importe)}</td>
        <td><span class="badge badge-${p.confidence==='alta'?'green':'gold'}">${p.confidence==='alta'?'🟢 Alta':'🟡 Media'}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:20px">Sin suficientes datos para predecir</td></tr>'

  const pendingRows = pending.length
    ? pending.map(p => `<tr>
        <td class="td-main">${p.concepto}</td>
        <td class="td-amount td-pos">+${eur(p.importe)}</td>
        <td>${p.cliente||'—'}</td>
        <td>${fmtDate(p.fecha)}</td>
        <td><button class="btn btn-primary btn-xs" onclick="marcarIngresoCobrado('${p.id}')">${t('cobrar_btn')}</button></td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:20px">Sin facturas pendientes</td></tr>'

  const catBreakdown = topCats.map(([cat, val]) => {
    const pctVal = (val/totalGas*100).toFixed(1)
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
        <span style="color:var(--text);font-weight:600">${catEmoji(cat)} ${cat}</span>
        <span style="color:var(--text2)">${eur(val)} <strong style="color:var(--text)">${pctVal}%</strong></span>
      </div>
      <div class="progress-wrap"><div class="progress-bar progress-accent" style="width:${pctVal}%"></div></div>
    </div>`
  }).join('') || '<div style="color:var(--text2);font-size:.85rem;padding:12px 0">Sin gastos este mes.</div>'

  // ── Month-over-month comparisons ──
  const prevMonth = (() => { const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7) })()
  const ingM  = calcIngresosMes(m),  ingP  = calcIngresosMes(prevMonth)
  const gasM  = calcGastosMes(m),    gasP  = calcGastosMes(prevMonth)
  const tasaP = calcSavingsRate(prevMonth)
  const momIng  = ingP  > 0 ? ((ingM  - ingP)  / ingP  * 100).toFixed(1) : null
  const momGas  = gasP  > 0 ? ((gasM  - gasP)  / gasP  * 100).toFixed(1) : null
  const momTasa = tasaP > 0 ? ((tasaAhorro - tasaP)).toFixed(1) : null
  const momBadge = (val, inverse) => {
    if (val === null) return ''
    const n = parseFloat(val)
    const good = inverse ? n <= 0 : n >= 0
    const color = good ? 'var(--green)' : 'var(--red)'
    const arrow = n >= 0 ? '▲' : '▼'
    return `<span style="font-size:.72rem;font-weight:700;color:${color};margin-left:6px">${arrow} ${Math.abs(n)}% vs mes ant.</span>`
  }

  // ── Insights personalizados ──
  const insightTips = (() => {
    const mo3 = getMonths(3)
    const tips = []
    const avgInc = mo3.reduce((a,mo)=>a+calcIngresosMes(mo),0)/3
    const avgGas = mo3.reduce((a,mo)=>a+calcGastosMes(mo),0)/3
    if (avgInc>0 && avgGas/avgInc>0.9) tips.push({cls:'alert',icon:'⚠️',txt:`${t('insight_gastos_alto','Tus gastos representan el')} <strong>${((avgGas/avgInc)*100).toFixed(0)}%</strong> ${t('insight_gastos_alto2','de tus ingresos medios. Intenta bajar de 80%.')}`})
    else if (avgInc>0 && avgGas/avgInc<0.6) tips.push({cls:'ok',icon:'🌟',txt:`${t('insight_gastos_excelente','Excelente: gastas solo el')} <strong>${((avgGas/avgInc)*100).toFixed(0)}%</strong> ${t('insight_gastos_excelente2','de tus ingresos. Considera aumentar inversiones.')}`})
    const recGas = S.gastos.filter(g=>g.recurrente&&g.tipo!==TX_TYPES.GOAL_TRANSFER)
    if (recGas.length>0) {
      const totalRec = recGas.reduce((a,g)=>a+(Number(g.importe)||0),0)
      tips.push({cls:'info',icon:'🔄',txt:`${t('insight_recurrentes','Tienes')} <strong>${recGas.length} ${t('insight_recurrentes2','gastos recurrentes')}</strong> ${t('por','por')} <strong>${eur(totalRec)}/mes</strong>. ${t('insight_recurrentes3','Revísalos periódicamente.')}`})
    }
    const cmByCat = gastosMesByCat(currentMonth())
    const cmEntries = Object.entries(cmByCat).sort((a,b)=>b[1]-a[1])
    const cmTotal = cmEntries.reduce((a,[,v])=>a+v,0)
    if (cmEntries.length && cmTotal>0 && cmEntries[0][1]/cmTotal>0.4) tips.push({cls:'warn',icon:'🏷',txt:`<strong>${cmEntries[0][0]}</strong> ${t('insight_top_cat','representa el')} <strong>${((cmEntries[0][1]/cmTotal)*100).toFixed(0)}%</strong> ${t('insight_top_cat2','de tus gastos. ¿Hay margen de mejora?')}`})
    if (S.inversiones.filter(i=>!i.cerrada).length===0 && avgInc>500) tips.push({cls:'info',icon:'📈',txt:t('insight_sin_inversiones','No tienes inversiones activas. Con ingresos regulares, considera un fondo indexado.')})
    if (!tips.length) tips.push({cls:'ok',icon:'✅',txt:t('insight_finanzas_ok','¡Tus finanzas se ven equilibradas! Sigue registrando para obtener más insights personalizados.')})
    return tips
  })()

  // ── Proyección patrimonial ──
  const mo3P = getMonths(3)
  const avgInc3 = mo3P.reduce((a,mo)=>a+calcIngresosMes(mo),0)/3
  const avgGas3 = mo3P.reduce((a,mo)=>a+calcGastosMes(mo),0)/3
  const cfPlanner = avgInc3 - avgGas3
  const saldoIni = S.cuentas.reduce((a,c)=>a+(Number(c.saldo)||0),0)
  const buildSeries = mul => { let v=saldoIni; return Array.from({length:12},()=>{ v+=cfPlanner*mul; return Math.round(v) }) }
  const serCons=buildSeries(0.8), serMod=buildSeries(1.0), serOpt=buildSeries(1.2)
  const planScenarios = [
    {label:t('escenario_conservador','Conservador'),icon:'🐢',val:serCons[11],dif:serCons[11]-saldoIni,color:'#F87171',bg:'rgba(248,113,113,0.08)',border:'rgba(248,113,113,0.2)'},
    {label:t('escenario_moderado','Moderado'),icon:'⚖️',val:serMod[11],dif:serMod[11]-saldoIni,color:'#00D4AA',bg:'rgba(0,212,170,0.08)',border:'rgba(0,212,170,0.2)'},
    {label:t('escenario_optimista','Optimista'),icon:'🚀',val:serOpt[11],dif:serOpt[11]-saldoIni,color:'#10B981',bg:'rgba(16,185,129,0.08)',border:'rgba(16,185,129,0.2)'},
  ]

  // ── Proyección próximo mes (3 months history + 1 projected) ──
  const mo3History = getMonths(3).reverse() // oldest to newest
  const nextMonthDate = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0,7) })()
  const projectionData = {
    months: [...mo3History, nextMonthDate],
    income: [...mo3History.map(mo => calcIngresosMes(mo)), avgInc3],
    expenses: [...mo3History.map(mo => calcGastosMes(mo)), avgGas3],
    savings: [...mo3History.map(mo => calcIngresosMes(mo) - calcGastosMes(mo)), cfPlanner],
  }
  const projectionAlert = (() => {
    if (cfPlanner < 0) return { type: 'alert', icon: '🚨', msg: `${t('proyeccion_negativa', 'Proyección negativa')}: ${eur(cfPlanner)}/${t('mes_lbl','mes')}. ${t('proyeccion_negativa_msg','Reducir gastos o aumentar ingresos.')}` }
    if (cfPlanner > avgInc3 * 0.3) return { type: 'ok', icon: '🎉', msg: `${t('proyeccion_excelente', 'Proyección excelente')}: ${eur(cfPlanner)}/${t('mes_lbl','mes')} (${pct((cfPlanner/avgInc3)*100)} ${t('de_ingresos','de ingresos')}). ${t('proyeccion_excelente_msg','Considera invertir el excedente.')}` }
    if (cfPlanner > avgInc3 * 0.15) return { type: 'ok', icon: '✅', msg: `${t('proyeccion_positiva', 'Proyección positiva')}: ${eur(cfPlanner)}/${t('mes_lbl','mes')}. ${t('proyeccion_positiva_msg','Mantén el ritmo.')}` }
    return { type: 'warn', icon: '⚠️', msg: `${t('proyeccion_ajustada', 'Proyección ajustada')}: ${eur(cfPlanner)}/${t('mes_lbl','mes')}. ${t('proyeccion_ajustada_msg','Margen de mejora disponible.')}` }
  })()

  const _analisisResumenHtml = `
  <!-- ── HEADER ────────────────────────────────────────────────── -->
  <div class="section-header mn-section">
    <div>
      <div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> ${t('page_analisis','Análisis')}</div>
      <div class="page-sub">${_gPeriodLabel()}</div>
    </div>
    <div class="section-actions" style="flex-wrap:wrap;gap:6px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">${t('comparar_con','Comparar:')}</span>
        <select onchange="window._analisisCompareMonth=this.value;renderAnalisis?.()"
          style="font-size:.78rem;padding:5px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);cursor:pointer;font-family:inherit;max-width:140px">
          <option value="">${t('ninguno','Sin comparar')}</option>
          ${(typeof getMonths==='function'?getMonths(12):[]).filter(m2=>m2!==currentMonth()).map(m2=>`
            <option value="${m2}" ${window._analisisCompareMonth===m2?'selected':''}>${monthLabel(m2)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="abrirCierreMes()">📋 ${t('btn_monthly_cerrar','Cierre')}</button>
    </div>
  </div>

  <!-- ── COMPARATIVA AÑO ACTUAL VS ANTERIOR ─────────────────────── -->
  ${(() => {
    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    // Calcular totales del año actual (2026)
    const ingresosActual = S.ingresos.filter(i => i.fecha?.startsWith(String(currentYear))).reduce((a,i)=>a+(Number(i.importe)||0),0)
    const gastosActual = S.gastos.filter(g => g.fecha?.startsWith(String(currentYear)) && g.tipo !== TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
    const patrimonioActual = calcPatrimonio()

    // Calcular totales del año anterior (2025)
    const ingresosAnterior = S.ingresos.filter(i => i.fecha?.startsWith(String(lastYear))).reduce((a,i)=>a+(Number(i.importe)||0),0)
    const gastosAnterior = S.gastos.filter(g => g.fecha?.startsWith(String(lastYear)) && g.tipo !== TX_TYPES.GOAL_TRANSFER).reduce((a,g)=>a+(Number(g.importe)||0),0)
    const patrimonioAnterior = S.patrimonio_hist?.find(h => h.mes?.startsWith(String(lastYear)))?.valor || 0

    // Calcular deltas
    const deltaIngresos = ingresosAnterior > 0 ? ((ingresosActual - ingresosAnterior) / ingresosAnterior * 100).toFixed(1) : null
    const deltaGastos = gastosAnterior > 0 ? ((gastosActual - gastosAnterior) / gastosAnterior * 100).toFixed(1) : null
    const deltaPatrimonio = patrimonioAnterior > 0 ? ((patrimonioActual - patrimonioAnterior) / patrimonioAnterior * 100).toFixed(1) : null

    const deltaIcon = (val) => val >= 0 ? '▲' : '▼'
    const deltaColor = (val, inverse = false) => {
      if (val === null) return 'var(--text2)'
      const n = parseFloat(val)
      const good = inverse ? n <= 0 : n >= 0
      return good ? 'var(--green)' : 'var(--red)'
    }

    return `<div class="mn-section">
      <div class="card" style="padding:20px 24px;background:linear-gradient(135deg, rgba(0,212,170,0.06) 0%, rgba(99,102,241,0.06) 100%);border:1px solid var(--border2)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
          <div style="font-size:1.4rem">📅</div>
          <div>
            <div style="font-size:1.05rem;font-weight:800;color:var(--text)">${t('comparativa_anual_titulo', 'Comparativa Anual')}</div>
            <div style="font-size:0.8rem;color:var(--text2)">${currentYear} vs ${lastYear}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
          <!-- Ingresos -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">💰 ${t('ingresos_label', 'Ingresos')}</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:0.82rem;color:var(--text2)">${currentYear}</span>
              <span style="font-size:1.1rem;font-weight:800;color:var(--green)">${eur(ingresosActual)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
              <span style="font-size:0.82rem;color:var(--text2)">${lastYear}</span>
              <span style="font-size:0.95rem;font-weight:600;color:var(--text3)">${eur(ingresosAnterior)}</span>
            </div>
            ${deltaIngresos !== null ? `
              <div style="padding:6px 10px;background:${deltaColor(deltaIngresos, false) === 'var(--green)' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)'};border-radius:8px;text-align:center">
                <span style="font-size:0.85rem;font-weight:800;color:${deltaColor(deltaIngresos, false)}">${deltaIcon(deltaIngresos)} ${Math.abs(deltaIngresos)}%</span>
              </div>
            ` : '<div style="text-align:center;font-size:0.8rem;color:var(--text3)">Sin datos año anterior</div>'}
          </div>

          <!-- Gastos -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">💸 ${t('gastos_label', 'Gastos')}</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:0.82rem;color:var(--text2)">${currentYear}</span>
              <span style="font-size:1.1rem;font-weight:800;color:var(--red)">${eur(gastosActual)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
              <span style="font-size:0.82rem;color:var(--text2)">${lastYear}</span>
              <span style="font-size:0.95rem;font-weight:600;color:var(--text3)">${eur(gastosAnterior)}</span>
            </div>
            ${deltaGastos !== null ? `
              <div style="padding:6px 10px;background:${deltaColor(deltaGastos, true) === 'var(--green)' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)'};border-radius:8px;text-align:center">
                <span style="font-size:0.85rem;font-weight:800;color:${deltaColor(deltaGastos, true)}">${deltaIcon(deltaGastos)} ${Math.abs(deltaGastos)}%</span>
              </div>
            ` : '<div style="text-align:center;font-size:0.8rem;color:var(--text3)">Sin datos año anterior</div>'}
          </div>

          <!-- Patrimonio Neto -->
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">🏡 ${t('patrimonio_label', 'Patrimonio Neto')}</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:0.82rem;color:var(--text2)">${currentYear}</span>
              <span style="font-size:1.1rem;font-weight:800;color:var(--accent)">${eur(patrimonioActual)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
              <span style="font-size:0.82rem;color:var(--text2)">${lastYear}</span>
              <span style="font-size:0.95rem;font-weight:600;color:var(--text3)">${eur(patrimonioAnterior)}</span>
            </div>
            ${deltaPatrimonio !== null ? `
              <div style="padding:6px 10px;background:${deltaColor(deltaPatrimonio, false) === 'var(--green)' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)'};border-radius:8px;text-align:center">
                <span style="font-size:0.85rem;font-weight:800;color:${deltaColor(deltaPatrimonio, false)}">${deltaIcon(deltaPatrimonio)} ${Math.abs(deltaPatrimonio)}%</span>
              </div>
            ` : '<div style="text-align:center;font-size:0.8rem;color:var(--text3)">Sin datos año anterior</div>'}
          </div>
        </div>
      </div>
    </div>`
  })()}

  <!-- ── KPIs ──────────────────────────────────────────────────── -->
  <div class="kpi-grid kpi-grid-4 mn-section">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">🔥</div>
      <div class="kpi-label">${t('burn_rate','Burn Rate')}</div>
      <div class="kpi-value" style="color:${burnMonths>=6?'var(--green)':burnMonths>=3?'var(--gold)':'var(--red)'}">${burnMonths}m</div>
      <div class="kpi-sub">${eur(calcDineroDisponible())} ${t('topbar_disponible','disp.')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">💰</div>
      <div class="kpi-label">${t('tasa_ahorro','Tasa de ahorro')}</div>
      <div class="kpi-value" style="color:${tasaAhorro>=20?'var(--green)':tasaAhorro>=10?'var(--gold)':'var(--red)'}">${pct(tasaAhorro)}</div>
      <div class="kpi-sub">${tasaAhorro>=20?t('rating_excelente','Excelente'):tasaAhorro>=10?t('rating_mejorable','Mejorable'):t('rating_bajo','Bajo')}${momBadge(momTasa,false)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">📈</div>
      <div class="kpi-label">${t('cartera_inversion','Cartera')}</div>
      <div class="kpi-value sm">${eur(totalInv)}</div>
      <div class="kpi-sub" style="color:${gananciaLatente>=0?'var(--green)':'var(--red)'}">${gananciaLatente>=0?'+':''}${eur(gananciaLatente)} ${t('inv_ganancia_latente','latente')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">🏆</div>
      <div class="kpi-label">${t('inv_ganancia_realizada','Realizado')}</div>
      <div class="kpi-value sm" style="color:${gananciaRealizada>=0?'var(--green)':'var(--red)'}">${gananciaRealizada>=0?'+':''}${eur(gananciaRealizada)}</div>
      <div class="kpi-sub">ROI ${roiMedio?pct(roiMedio):'—'}</div>
    </div>
  </div>

  <!-- ── GRÁFICOS — CASHFLOW + PATRIMONIO ─────────────────────── -->
  <div class="grid-2 mn-section">
    <div class="card" style="min-width:0">
      <div class="card-header">
        <div><div class="card-title">📊 ${t('analisis_cashflow_titulo','Cashflow mensual')}</div><div class="card-subtitle">${t('ultimos_12_meses','Últimos 12 meses')}</div></div>
      </div>
      <div class="chart-container" style="height:170px;min-width:0"><canvas id="chartCashflowBars"></canvas></div>
    </div>
    <div class="card" style="min-width:0">
      <div class="card-header">
        <div><div class="card-title">📈 ${t('evolucion_patrimonio','Patrimonio neto')}</div><div class="card-subtitle">${t('ultimos_12_meses','Últimos 12 meses')}</div></div>
      </div>
      <div class="chart-container" style="height:170px;min-width:0"><canvas id="chartAnalisisPatrimonio"></canvas></div>
    </div>
  </div>

  <!-- ── GRÁFICO INGvsGAS + HEATMAP ───────────────────────────── -->
  <div class="grid-2 mn-section">
    <div class="card" style="min-width:0">
      <div class="card-header"><div class="card-title">🍩 ${t('analisis_ing_vs_gas','Ingresos vs Gastos')}</div><div class="card-subtitle">${t('tendencia_mensual','Tendencia 12 meses')}</div></div>
      <div class="chart-container" style="height:170px;min-width:0"><canvas id="chartAnalisisTendencia"></canvas></div>
    </div>
    <div class="card" style="min-width:0">
      <div class="card-header">
        <div><div class="card-title">🗓 ${t('analisis_heatmap_titulo','Gastos por día')}</div><div class="card-subtitle">${t('analisis_heatmap_sub','Últimos 3 meses')}</div></div>
      </div>
      ${_renderDayOfWeekHeatmap()}
    </div>
  </div>

  <!-- ── DESGLOSE CATEGORÍAS + FONDO EMERGENCIA ───────────────── -->
  <div class="grid-2 mn-section">
    <div class="card">
      <div class="card-header"><div class="card-title">🏷 ${t('desglose_categorias','Desglose por categoría')}</div><div class="card-subtitle">${monthLabel(m)}</div></div>
      ${catBreakdown || `<div style="padding:12px 0;color:var(--text2);font-size:.85rem">${t('sin_gastos_mes','Sin gastos este mes.')}</div>`}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">🛡 ${t('fondo_emergencia','Fondo de emergencia')}</div><div class="card-subtitle">${t('fondo_cobertura_rec','Cobertura recomendada: 6 meses')}</div></div>
      <div class="kpi-grid kpi-grid-2" style="margin-bottom:12px">
        <div class="kpi-card">
          <div class="kpi-label">${t('fondo_objetivo','Objetivo')}</div>
          <div class="kpi-value sm">${eur(ef)}</div>
          <div class="kpi-sub">${t('fondo_basado_gasto','Gasto medio × 6')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('fondo_cobertura','Cobertura')}</div>
          <div class="kpi-value sm" style="color:${efCov>=100?'var(--green)':efCov>=50?'var(--gold)':'var(--red)'}">${pct(efCov)}</div>
          <div class="kpi-sub">${eur(calcDineroDisponible())}</div>
        </div>
      </div>
      <div class="progress-info"><span class="progress-label">${t('progreso','Progreso')}</span><span class="progress-pct">${pct(efCov)}</span></div>
      <div class="progress-wrap"><div class="progress-bar ${efCov>=100?'progress-ok':efCov>=50?'progress-warn':'progress-danger'}" style="width:${clamp(efCov,0,100)}%"></div></div>
      <div style="margin-top:8px;font-size:.78rem;color:var(--text2)">
        ${efCov<100
          ? `${t('faltan','Faltan')} <strong style="color:var(--text)">${eur(Math.max(0,ef-calcDineroDisponible()))}</strong> ${t('para_completarlo','para completarlo.')}`
          : `<span style="color:var(--green)">✅ ${t('fondo_completo','¡Fondo completo!')}</span>`}
      </div>
    </div>
  </div>

  <!-- ── REGLA 50/30/20 + ANOMALÍAS ───────────────────────────── -->
  <div class="grid-2 mn-section">
    <div class="card">
      <div class="card-header"><div class="card-title">⚖️ ${t('regla_503020','Regla 50/30/20')}</div><div class="card-subtitle">${t('distribucion_gasto','Distribución del gasto mensual')}</div></div>
      <div class="rule-bar-wrap">
        <div class="rule-bar-header">
          <span class="rule-bar-label"><span style="color:var(--indigo)">■</span> ${t('necesidades','Necesidades')}</span>
          <span class="rule-bar-vals">${eur(d50.necesidad)} · <strong>${pct(d50.pctNec)}</strong> <span style="color:var(--text3)">(≤50%)</span></span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${clamp(d50.pctNec,0,100)}%;background:var(--indigo)"></div></div>
      </div>
      <div class="rule-bar-wrap">
        <div class="rule-bar-header">
          <span class="rule-bar-label"><span style="color:var(--gold)">■</span> ${t('deseos','Deseos')}</span>
          <span class="rule-bar-vals">${eur(d50.deseo)} · <strong>${pct(d50.pctDes)}</strong> <span style="color:var(--text3)">(≤30%)</span></span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${clamp(d50.pctDes,0,100)}%;background:var(--gold)"></div></div>
      </div>
      <div class="rule-bar-wrap">
        <div class="rule-bar-header">
          <span class="rule-bar-label"><span style="color:var(--green)">■</span> ${t('ahorro_lbl','Ahorro')}</span>
          <span class="rule-bar-vals">${eur(d50.ahorro)} · <strong>${pct(d50.pctAh)}</strong> <span style="color:var(--text3)">(≥20%)</span></span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${clamp(d50.pctAh,0,100)}%;background:var(--green)"></div></div>
      </div>
      <div style="margin-top:8px;font-size:.72rem;color:var(--text3)">💡 ${t('regla_nota','Los gastos sin categorizar cuentan como "Deseos".')}</div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">🔍 ${t('anomalias_titulo','Anomalías detectadas')}</div><div class="card-subtitle">${monthLabel(m)}</div></div>
      ${rev.anomalies.length
        ? rev.anomalies.map(a=>`<div class="mn-insight mn-insight--${a.type==='danger'?'alert':'warn'}"><span class="mn-insight-icon">${a.type==='danger'?'🚨':'⚠️'}</span><div class="mn-insight-body">${a.msg}</div></div>`).join('')
        : `<div class="mn-insight mn-insight--ok"><span class="mn-insight-icon">✅</span><div class="mn-insight-body"><strong>${t('sin_anomalias','¡Sin anomalías!')}</strong> ${t('sin_anomalias_sub','Tus finanzas están en orden.')}</div></div>`}
    </div>
  </div>

  <!-- ── INSIGHTS PERSONALIZADOS ──────────────────────────────── -->
  <div class="card mn-section">
    <div class="card-header"><div class="card-title">🧠 ${t('insights_titulo','Insights personalizados')}</div><div class="card-subtitle">${t('insights_sub','Basados en tus datos reales')}</div></div>
    ${insightTips.map(tip=>`<div class="mn-insight mn-insight--${tip.cls}"><span class="mn-insight-icon">${tip.icon}</span><div class="mn-insight-body">${tip.txt}</div></div>`).join('')}
  </div>

  <!-- ── PREVISIÓN GASTOS ──────────────────────────────────────── -->
  <div class="card mn-section">
    <div class="card-header">
      <div><div class="card-title">🔮 ${t('prevision_titulo','Previsión próximo mes')}</div><div class="card-subtitle">${t('prevision_sub','Basada en patrones de los últimos 3 meses')}</div></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>${t('concepto','Concepto')}</th><th>${t('categoria','Categoría')}</th><th>${t('importe','Importe')}</th><th>${t('confianza','Confianza')}</th></tr></thead>
        <tbody>${prev.length
          ? prev.map(p=>`<tr>
              <td class="td-main">${p.concepto}</td>
              <td><span class="tag">${p.categoria||'—'}</span></td>
              <td class="td-amount td-neg">~${eur(p.importe)}</td>
              <td><span class="badge badge-${p.confidence==='alta'?'green':'gold'}">${p.confidence==='alta'?`🟢 ${t('alta','Alta')}`:`🟡 ${t('media','Media')}`}</span></td>
            </tr>`).join('')
          : `<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:24px">${t('sin_datos_predecir','Sin datos suficientes para predecir')}</td></tr>`}
        </tbody>
      </table>
    </div>
    ${prev.length?`<div style="margin-top:10px;padding:10px 14px;background:var(--bg2);border-radius:var(--radius-sm);font-size:.8rem;color:var(--text2)">${t('total_estimado','Total estimado')}: <strong style="color:var(--text)">${eur(prev.reduce((a,p)=>a+p.importe,0))}</strong></div>`:''}
  </div>

  <!-- ── FACTURAS PENDIENTES ───────────────────────────────────── -->
  ${pending.length ? `
  <div class="card mn-section">
    <div class="card-header">
      <div><div class="card-title">🧾 ${t('facturas_pendientes','Facturas pendientes')}</div><div class="card-subtitle">${t('facturas_pendientes_sub','Ingresos aún no cobrados')}</div></div>
      <span class="badge badge-gold">${eur(getPendingTotal())}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>${t('concepto','Concepto')}</th><th>${t('importe','Importe')}</th><th>${t('cliente','Cliente')}</th><th>${t('fecha','Fecha')}</th><th></th></tr></thead>
        <tbody>${pending.map(p=>`<tr>
          <td class="td-main">${p.concepto}</td>
          <td class="td-amount td-pos">+${eur(p.importe)}</td>
          <td>${p.cliente||'—'}</td>
          <td>${fmtDate(p.fecha)}</td>
          <td><button class="btn btn-primary btn-xs" onclick="marcarIngresoCobrado('${p.id}')">${t('cobrar_btn','Cobrar')}</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- ── PROYECCIÓN PRÓXIMO MES ────────────────────────────────── -->
  ${(avgInc3>0||avgGas3>0) ? `
  <div class="card mn-section">
    <div class="card-header">
      <div>
        <div class="card-title">🔮 ${t('proyeccion_proximo_mes_titulo','Proyección próximo mes')}</div>
        <div class="card-subtitle">${t('proyeccion_basada_3m','Basada en media de últimos 3 meses')}</div>
      </div>
    </div>
    <!-- Alert banner -->
    <div class="mn-insight mn-insight--${projectionAlert.type}" style="margin-bottom:16px">
      <span class="mn-insight-icon">${projectionAlert.icon}</span>
      <div class="mn-insight-body">${projectionAlert.msg}</div>
    </div>
    <!-- Bar chart: 3 historical months + 1 projected -->
    <div class="chart-container" style="height:240px;margin-bottom:16px"><canvas id="chartProximoMes"></canvas></div>
    <!-- Summary cards -->
    <div class="mn-3col-grid">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;min-width:0">
        <div style="font-size:.65rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">💰 ${t('ingresos_estimados','Ingresos')}</div>
        <div style="font-size:1rem;font-weight:800;color:var(--green);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eur(avgInc3)}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;min-width:0">
        <div style="font-size:.65rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">💸 ${t('gastos_estimados','Gastos')}</div>
        <div style="font-size:1rem;font-weight:800;color:var(--red);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eur(avgGas3)}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;min-width:0">
        <div style="font-size:.65rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">📈 ${t('ahorro_estimado','Ahorro')}</div>
        <div style="font-size:1rem;font-weight:800;color:${cfPlanner>=0?'var(--accent)':'var(--red)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cfPlanner>=0?'+':''}${eur(cfPlanner)}</div>
      </div>
    </div>
  </div>` : ''}

  <!-- ── PROYECCIÓN PATRIMONIAL ANUAL ───────────────────────────── -->
  ${(avgInc3>0||avgGas3>0) ? `
  <div class="card mn-section">
    <div class="card-header">
      <div>
        <div class="card-title">🔭 ${t('proyeccion_titulo','Proyección patrimonial')}</div>
        <div class="card-subtitle">${t('proyeccion_sub','Últimos 3 meses de media')} · ${cfPlanner>=0?'+':''}${eur(cfPlanner)}/${t('mes_lbl','mes')}</div>
      </div>
    </div>
    <div class="mn-scenario-grid">
      ${planScenarios.map(s=>`
        <div style="background:${s.bg};border:1px solid ${s.border};border-radius:12px;padding:16px 12px;text-align:center;min-width:0">
          <div style="font-size:1.4rem;margin-bottom:6px">${s.icon}</div>
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${s.color};margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.label}</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eur(s.val)}</div>
          <div style="font-size:.72rem;font-weight:700;color:${s.dif>=0?'var(--green)':'var(--red)'};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.dif>=0?'+':''}${eur(s.dif)}</div>
          <div style="font-size:.65rem;color:var(--text3);margin-top:2px">${t('en_12_meses','en 12 meses')}</div>
        </div>`).join('')}
    </div>
    <div class="chart-container" style="height:200px"><canvas id="chartFinancialPlanner"></canvas></div>
    <div style="margin-top:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      ${planScenarios.map(s=>`<div style="display:flex;align-items:center;gap:5px;font-size:.72rem;color:var(--text2);font-weight:600"><span style="width:14px;height:3px;border-radius:99px;background:${s.color};display:inline-block"></span>${s.label}</div>`).join('')}
    </div>
  </div>` : ''}
`

  const _analisisTab = window._analisisActiveTab || 'resumen'
  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div>
      <div class="page-h1">📊 ${t('page_analisis','Análisis')}</div>
      <div class="page-sub">${t('analisis_sub','Resumen, revisión, calendario y tendencias en un solo lugar')}</div>
    </div>
  </div>
  <div class="analisis-tabs" role="tablist">
    <button class="analisis-tab-btn ${_analisisTab==='resumen'?'active':''}" onclick="_analisisSwitchTab('resumen')">📈 ${t('analisis_tab_resumen','Resumen')}</button>
    <button class="analisis-tab-btn ${_analisisTab==='revision'?'active':''}" onclick="_analisisSwitchTab('revision')">🔔 ${t('analisis_tab_revision','Revisión')}${_reviewCount()>0?` <span class="analisis-tab-badge">${_reviewCount()}</span>`:''}</button>
    <button class="analisis-tab-btn ${_analisisTab==='calendario'?'active':''}" onclick="_analisisSwitchTab('calendario')">📅 ${t('analisis_tab_calendario','Calendario financiero')}</button>
  </div>
  <div id="analisisTabContent">${_analisisTab==='resumen' ? _analisisResumenHtml : ''}</div>
  `
  if (_analisisTab === 'revision') { renderRevision(); return }
  if (_analisisTab === 'calendario') { renderCalendario(); return }

  // Charts
  setTimeout(()=>{
    // Cashflow barras 12 meses
    const cfBarsCtx = document.getElementById('chartCashflowBars')
    if (cfBarsCtx) {
      destroyChart('cfBars')
      const m12 = getMonths(12)
      const cfVals = m12.map(mo => calcIngresosMes(mo) - calcGastosMes(mo))
      charts['cfBars'] = new Chart(cfBarsCtx, {
        type: 'bar',
        data: {
          labels: m12.map(mo => monthLabel(mo).slice(0,3)),
          datasets: [{
            data: cfVals,
            backgroundColor: cfVals.map(v => v >= 0 ? 'rgba(0,212,170,0.75)' : 'rgba(244,63,94,0.75)'),
            borderColor: cfVals.map(v => v >= 0 ? '#00D4AA' : '#F43F5E'),
            borderWidth: 1,
            borderRadius: 5,
            categoryPercentage: 0.7,
            barPercentage: 0.85,
          }]
        },
        options: { ...chartDefaults(),
          plugins: { ...chartDefaults().plugins,
            tooltip: { ...chartDefaults().plugins.tooltip,
              callbacks: { label: c => ' ' + (c.raw >= 0 ? '+' : '') + eur(c.raw) }
            }
          },
          scales: {
            x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 10 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
            y: { grid: { color: gridColor() }, border: { color: 'transparent' },
              ticks: { color: labelColor(), font: { size: 10 }, callback: v => (v >= 0 ? '+' : '') + eur(v) },
              afterDataLimits: s => { const mx = Math.max(Math.abs(s.min), Math.abs(s.max)); s.min = -mx * 1.1; s.max = mx * 1.1 }
            }
          }
        }
      })
    }

    const patCtx = document.getElementById('chartAnalisisPatrimonio')
    if (patCtx) {
      destroyChart('analisisPat')
      recordPatrimonio() // mismo patron que renderChartPatrimonio() del Dashboard: asegura que el historico este actualizado y reconstruido antes de leerlo, sin importar si el usuario llego aqui sin pasar por Dashboard
      const meses = getMonths(12)
      const patVals = meses.map(mo => { const h = S.patrimonio_hist.find(x => x.mes === mo); return h ? h.valor : null })
      charts['analisisPat'] = new Chart(patCtx, {
        type: 'line',
        data: {
          labels: meses.map(monthLabel),
          datasets: [{
            label: t('patrimonio_neto','Patrimonio'),
            data: patVals,
            borderColor: '#00D4AA',
            backgroundColor: c => {
              try {
                const h2 = c.chart.chartArea?.bottom || 200
                const g = c.chart.ctx.createLinearGradient(0, 0, 0, h2)
                g.addColorStop(0, 'rgba(0,212,170,0.2)'); g.addColorStop(1, 'rgba(0,212,170,0)')
                return g
              } catch { return 'rgba(0,212,170,0.1)' }
            },
            fill: true, tension: 0.42,
            pointRadius: 4, pointHoverRadius: 6,
            pointBackgroundColor: '#00D4AA',
            pointBorderColor: 'transparent',
            pointBorderWidth: 2,
            borderWidth: 2.5, spanGaps: true,
          }]
        },
        options: { ...chartDefaults(),
          plugins: { ...chartDefaults().plugins,
            tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: c => ' ' + eur(c.raw) } }
          },
          scales: {
            x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 10 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
            y: { grid: { color: gridColor() }, border: { color: 'transparent' },
              ticks: { color: labelColor(), font: { size: 10 }, callback: v => eur(v) }
            }
          }
        }
      })
    }
    // Tendencia ingvsgasto — barras agrupadas con colores premium
    const tendCtx = document.getElementById('chartAnalisisTendencia')
    if (tendCtx) {
      destroyChart('analisisTend')
      const meses = getMonths(12)
      const mesesIngData = meses.map(calcIngresosMes)
      const mesesGasData = meses.map(calcGastosMes)
      const allVals = [...mesesIngData, ...mesesGasData].filter(v => v > 0)
      const nonZero = meses.filter((_, i) => mesesIngData[i] > 0 || mesesGasData[i] > 0).length
      const tendBarPct = nonZero <= 1 ? 0.2 : nonZero <= 3 ? 0.5 : 0.75
      charts['analisisTend'] = new Chart(tendCtx, {
        type: 'bar',
        data: {
          labels: meses.map(monthLabel),
          datasets: [
            { label: t('nav_ingresos','Ingresos'), data: mesesIngData,
              backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 5,
              borderColor: '#10B981', borderWidth: 1,
              categoryPercentage: tendBarPct, barPercentage: 0.85 },
            { label: t('nav_gastos','Gastos'), data: mesesGasData,
              backgroundColor: 'rgba(244,63,94,0.75)', borderRadius: 5,
              borderColor: '#F43F5E', borderWidth: 1,
              categoryPercentage: tendBarPct, barPercentage: 0.85 }
          ]
        },
        options: { ...chartDefaults(),
          plugins: { ...chartDefaults().plugins,
            legend: { display: true, labels: { color: labelColor(), boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 11, weight: '600' } } },
            tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { title: i => i[0].label, label: c => ' ' + c.dataset.label + ': ' + eur(c.raw) } }
          },
          scales: {
            x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 10 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
            y: { grid: { color: gridColor() }, border: { color: 'transparent' },
              ticks: { color: labelColor(), font: { size: 10 }, callback: v => eur(v) },
              suggestedMin: 0, suggestedMax: allVals.length ? Math.max(...allVals) * 1.2 : 100
            }
          }
        }
      })
    }
    // Próximo mes projection chart (3 historical + 1 projected)
    const projMesCtx = document.getElementById('chartProximoMes')
    if (projMesCtx) {
      destroyChart('proximoMes')
      const mo3Hist = getMonths(3).reverse()
      const nextMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0,7) })()
      const allMonths = [...mo3Hist, nextMonth]
      const avgInc = mo3Hist.reduce((a,mo)=>a+calcIngresosMes(mo),0)/3
      const avgGas = mo3Hist.reduce((a,mo)=>a+calcGastosMes(mo),0)/3
      const avgSav = avgInc - avgGas

      charts['proximoMes'] = new Chart(projMesCtx, {
        type: 'bar',
        data: {
          labels: allMonths.map((mo, i) => i === 3 ? `📅 ${monthLabel(mo)}` : monthLabel(mo)),
          datasets: [
            {
              label: t('ingresos_label','Ingresos'),
              data: [...mo3Hist.map(calcIngresosMes), avgInc],
              backgroundColor: (ctx) => ctx.dataIndex === 3 ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.8)',
              borderColor: '#10B981',
              borderWidth: (ctx) => ctx.dataIndex === 3 ? 2 : 1,
              borderRadius: 5,
              borderDash: (ctx) => ctx.dataIndex === 3 ? [4, 3] : []
            },
            {
              label: t('gastos_label','Gastos'),
              data: [...mo3Hist.map(calcGastosMes), avgGas],
              backgroundColor: (ctx) => ctx.dataIndex === 3 ? 'rgba(244,63,94,0.5)' : 'rgba(244,63,94,0.75)',
              borderColor: '#F43F5E',
              borderWidth: (ctx) => ctx.dataIndex === 3 ? 2 : 1,
              borderRadius: 5,
              borderDash: (ctx) => ctx.dataIndex === 3 ? [4, 3] : []
            },
            {
              label: t('ahorro_label','Ahorro'),
              data: [...mo3Hist.map(mo => calcIngresosMes(mo) - calcGastosMes(mo)), avgSav],
              backgroundColor: (ctx) => {
                const val = ctx.parsed.y
                const isProj = ctx.dataIndex === 3
                if (val >= 0) return isProj ? 'rgba(0,212,170,0.5)' : 'rgba(0,212,170,0.8)'
                return isProj ? 'rgba(248,113,113,0.5)' : 'rgba(248,113,113,0.75)'
              },
              borderColor: (ctx) => ctx.parsed.y >= 0 ? '#00D4AA' : '#F87171',
              borderWidth: (ctx) => ctx.dataIndex === 3 ? 2 : 1,
              borderRadius: 5,
              borderDash: (ctx) => ctx.dataIndex === 3 ? [4, 3] : []
            }
          ]
        },
        options: {
          ...chartDefaults(),
          plugins: {
            ...chartDefaults().plugins,
            legend: { display: true, labels: { color: labelColor(), boxWidth: 10, font: { size: 11, weight: '600' } } },
            tooltip: {
              ...chartDefaults().plugins.tooltip,
              callbacks: {
                title: (ctx) => ctx[0].dataIndex === 3 ? `${ctx[0].label} (proyectado)` : ctx[0].label,
                label: (ctx) => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y >= 0 ? '+' : '') + eur(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 10 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
            y: {
              grid: { color: gridColor() },
              border: { color: 'transparent' },
              ticks: { color: labelColor(), font: { size: 10 }, callback: v => eur(v) }
            }
          }
        }
      })
    }

    // Financial Planner chart (annual)
    const planCtx = document.getElementById('chartFinancialPlanner')
    if(planCtx){
      destroyChart('financialPlanner')
      const months3p = getMonths(3)
      const avgInc3p = months3p.reduce((a,mo)=>a+calcIngresosMes(mo),0)/3
      const avgGas3p = months3p.reduce((a,mo)=>a+calcGastosMes(mo),0)/3
      const cfp = avgInc3p - avgGas3p
      const saldo0 = S.cuentas.reduce((a,c)=>a+(Number(c.saldo)||0),0)
      const mkSeries = mul => { let v=saldo0; return Array.from({length:12},()=>{ v+=cfp*mul; return Math.round(v) }) }
      const labels12 = Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()+i+1);return d.toLocaleString('es-ES',{month:'short'})})
      charts['financialPlanner'] = new Chart(planCtx,{type:'line',data:{labels:labels12,datasets:[
        {label:'Optimista',   data:mkSeries(1.2),borderColor:'#10B981',fill:false,tension:.4,pointRadius:0,borderWidth:2},
        {label:'Moderado',    data:mkSeries(1.0),borderColor:'#00D4AA',fill:'+1',tension:.4,pointRadius:0,borderWidth:2,backgroundColor:'rgba(0,212,170,0.06)'},
        {label:'Conservador', data:mkSeries(0.8),borderColor:'#F87171',borderDash:[4,3],fill:false,tension:.4,pointRadius:0,borderWidth:1.5}
      ]},options:{...chartDefaults(),plugins:{...chartDefaults().plugins,legend:{display:true,labels:{color:labelColor(),boxWidth:10,font:{size:10}}}},scales:{x:{grid:{color:gridColor()},ticks:{color:labelColor(),font:{size:10},autoSkip:true,maxRotation:60,minRotation:0,maxTicksLimit:(typeof window!=='undefined'&&window.innerWidth<480)?6:12}},y:{grid:{color:gridColor()},ticks:{color:labelColor(),font:{size:10},callback:v=>eur(v)}}}}})
    }
  },60)
}

function renderHerramientas() {
  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1">🛠 Herramientas</div><div class="page-sub">Asistentes financieros</div></div>
  </div>
  <div>
    <div id="debtAdvisorCard" class="card"><div class="card-header"><div class="card-title">💳 Asistente de deudas</div><div class="card-subtitle">Estrategias para saldar deudas</div></div>${renderDebtAdvisor()}</div>
  </div>
  `
}

function renderDebtAdvisor() {
  if (!S.deudas.length) return `
    <div class="empty">
      <div class="empty-icon">🎉</div>
      <div class="empty-title">¡Sin deudas!</div>
      <div class="empty-sub">Enhorabuena — una posición financiera envidiable.</div>
      <button class="btn btn-ghost btn-sm" onclick="goTo('deudas')">Ver sección deudas →</button>
    </div>`

  const pendienteTotal = calcTotalDeuda()
  const interesMedio = S.deudas.length ? S.deudas.reduce((a,d)=>a+(Number(d.interes)||0),0)/S.deudas.length : 0
  const snowball  = debtSnowball()
  const avalanche = debtAvalanche()

  const makeList = (arr) => arr.map((d, i) => {
    const pend = Number(d.importeTotal) - Number(d.importePagado || 0)
    return `<div class="debt-order-item">
      <div class="debt-order-num">${i + 1}</div>
      <div class="debt-order-info">
        <div class="debt-order-name">${d.nombre}</div>
        <div class="debt-order-meta">Pendiente: <strong style="color:var(--text)">${eur(pend)}</strong> · ${d.interes ? '<span style="color:var(--gold)">'+pct(d.interes)+' int.</span>' : 'Sin interés'}</div>
      </div>
    </div>`
  }).join('')

  // Estrategias rápidas
  const strats = [
    { icon:'🐢', name:'Conservador', mul:0.6, color:'var(--text2)' },
    { icon:'⚖️', name:'Moderado',    mul:1.0, color:'var(--accent)' },
    { icon:'🚀', name:'Agresivo',    mul:1.6, color:'var(--red)' },
  ]
  const stratHtml = strats.map(s => {
    const {monthlyPayment, months} = calcDebtStrategy(pendienteTotal, interesMedio, s.mul)
    return `<div style="flex:1;padding:10px;border-radius:var(--radius-sm);background:var(--bg2);border:1px solid var(--border);text-align:center">
      <div style="font-size:1.2rem">${s.icon}</div>
      <div style="font-size:.75rem;font-weight:700;color:${s.color};margin:4px 0">${s.name}</div>
      <div style="font-size:.8rem;font-weight:700;color:var(--text)">${eur(monthlyPayment)}<span style="font-size:.65rem;color:var(--text2)">/mes</span></div>
      <div style="font-size:.68rem;color:var(--text2)">${fmtMonths(months)}</div>
    </div>`
  }).join('')

  // Calcular proyección de saldo para ambas estrategias (pago moderado)
  const modPay = calcDebtStrategy(pendienteTotal, interesMedio, 1.0).monthlyPayment
  const _simDebtEvolution = (ordered, monthly) => {
    let saldos = ordered.map(d => Number(d.importeTotal) - Number(d.importePagado || 0))
    const series = [saldos.reduce((a, v) => a + v, 0)]
    let extraFromPaid = 0
    for (let i = 0; i < 60; i++) {  // max 60 meses
      let payment = monthly + extraFromPaid
      extraFromPaid = 0
      saldos = saldos.map(s => {
        if (s <= 0) return 0
        const paid = Math.min(payment, s)
        payment -= paid
        const remaining = s - paid
        if (remaining <= 0) extraFromPaid += (paid - s + remaining) // excess goes to next
        return Math.max(0, remaining)
      })
      const total = saldos.reduce((a, v) => a + v, 0)
      series.push(Math.round(total))
      if (total <= 0) break
    }
    return series
  }
  const snowSeries  = _simDebtEvolution(snowball,  modPay)
  const avalSeries  = _simDebtEvolution(avalanche, modPay)
  const maxMonths   = Math.max(snowSeries.length, avalSeries.length)
  const chartLabels = Array.from({ length: maxMonths }, (_, i) => i === 0 ? 'Hoy' : `M${i}`)

  // Fecha estimada de libertad financiera (moderado)
  const snowMonths = snowSeries.findIndex(v => v <= 0) || snowSeries.length
  const avalMonths = avalSeries.findIndex(v => v <= 0) || avalSeries.length
  const freeDate = (months) => {
    const d = new Date(); d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  // Ahorro de intereses (avalancha vs bola de nieve)
  const interestDiff = interesMedio > 0
    ? Math.round(pendienteTotal * (interesMedio / 100 / 12) * Math.max(0, snowMonths - avalMonths))
    : 0

  return `
  <!-- Estrategias de pago -->
  <div style="display:flex;gap:8px;margin-bottom:16px">${stratHtml}</div>

  <!-- Comparativa visual: libertad financiera -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div style="padding:14px;border-radius:12px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);text-align:center">
      <div style="font-size:.7rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">❄️ Bola de nieve</div>
      <div style="font-size:1.15rem;font-weight:800;color:var(--text)">${fmtMonths(snowMonths)}</div>
      <div style="font-size:.7rem;color:var(--text2);margin-top:3px">${snowMonths > 0 ? freeDate(snowMonths) : '—'}</div>
    </div>
    <div style="padding:14px;border-radius:12px;background:rgba(0,212,170,.08);border:1px solid rgba(0,212,170,.2);text-align:center">
      <div style="font-size:.7rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">🌊 Avalancha</div>
      <div style="font-size:1.15rem;font-weight:800;color:var(--accent)">${fmtMonths(avalMonths)}</div>
      <div style="font-size:.7rem;color:var(--text2);margin-top:3px">${avalMonths > 0 ? freeDate(avalMonths) : '—'}</div>
    </div>
  </div>

  ${interestDiff > 0 ? `<div style="padding:10px 14px;border-radius:10px;background:var(--green-dim);border:1px solid rgba(16,185,129,.2);font-size:.78rem;color:var(--text2);margin-bottom:14px">
    💡 Con <strong style="color:var(--text)">Avalancha</strong> ahorras aprox. <strong style="color:var(--green)">${eur(interestDiff)}</strong> en intereses frente a Bola de nieve.
  </div>` : ''}

  <!-- Gráfico evolución saldo -->
  <div style="margin-bottom:14px">
    <div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:6px">📉 Evolución del saldo total</div>
    <div class="chart-container" style="height:140px"><canvas id="chartDebtEvolution"></canvas></div>
  </div>

  <!-- Orden de pago -->
  <div class="tabs" style="margin-bottom:12px">
    <div class="tab active" id="tab-snowball" onclick="switchDebtTab('snowball')">❄️ Bola de nieve</div>
    <div class="tab" id="tab-avalanche" onclick="switchDebtTab('avalanche')">🌊 Avalancha</div>
  </div>
  <div id="debt-snowball">
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:10px;padding:7px 10px;background:var(--bg2);border-radius:6px">
      <strong style="color:var(--text)">Bola de nieve:</strong> empieza por la deuda más pequeña para ganar impulso psicológico.
    </div>
    ${makeList(snowball)}
  </div>
  <div id="debt-avalanche" style="display:none">
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:10px;padding:7px 10px;background:var(--bg2);border-radius:6px">
      <strong style="color:var(--text)">Avalancha:</strong> empieza por la de mayor interés — ahorras más dinero a largo plazo.
    </div>
    ${makeList(avalanche)}
  </div>

  <!-- Calculadora personalizada -->
  <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
    <div style="font-size:.78rem;color:var(--text2);font-weight:600;margin-bottom:8px">🧮 Calculadora personalizada</div>
    <div style="display:flex;gap:8px;align-items:center">
      <input type="text" inputmode="decimal" id="monthlyPayInput" placeholder="€ / mes que puedes pagar" style="flex:1" oninput="_sanitizeAmountInput(this)">
      <button class="btn btn-primary btn-sm" onclick="calcDebtFree()">Calcular</button>
    </div>
    <div id="debtFreeResult" style="margin-top:8px;font-size:.82rem;color:var(--text2)"></div>
  </div>`

  // Render chart after DOM exists
  setTimeout(() => {
    const dCtx = document.getElementById('chartDebtEvolution')
    if (!dCtx) return
    destroyChart('debtEvolution')
    const maxL = Math.max(snowSeries.length, avalSeries.length)
    const labels = Array.from({ length: maxL }, (_, i) => i === 0 ? 'Hoy' : `M${i}`)
    charts['debtEvolution'] = new Chart(dCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '❄️ Bola de nieve', data: snowSeries.concat(Array(maxL - snowSeries.length).fill(0)),
            borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.06)', fill: true, tension: 0.3,
            pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
          { label: '🌊 Avalancha',     data: avalSeries.concat(Array(maxL - avalSeries.length).fill(0)),
            borderColor: '#00D4AA', backgroundColor: 'rgba(0,212,170,0.06)', fill: true, tension: 0.3,
            pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
        ]
      },
      options: { ...chartDefaults(),
        plugins: { ...chartDefaults().plugins,
          legend: { display: true, labels: { color: labelColor(), boxWidth: 8, font: { size: 10, weight: '700' } } },
          tooltip: { ...chartDefaults().plugins.tooltip,
            callbacks: { label: c => ' ' + c.dataset.label + ': ' + eur(c.raw) }
          }
        },
        scales: {
          x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 9 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 8 }, border: { color: 'transparent' } },
          y: { grid: { color: gridColor() }, border: { color: 'transparent' },
            ticks: { color: labelColor(), font: { size: 9 }, callback: v => eur(v) },
            suggestedMin: 0
          }
        }
      }
    })
  }, 80)
}

// switchDebtTab definida anteriormente (línea ~5513) — esta es un duplicado eliminado

function calcDebtFree() {
  const monthly = parseAmount(document.getElementById('monthlyPayInput').value)
  const result  = document.getElementById('debtFreeResult')
  if (!monthly || monthly <= 0) { result.textContent = t('debt_importe_valido'); return }
  const months  = calcDebtFreeMonths(monthly)
  if (!months)  { result.innerHTML = '<span style="color:var(--green)">✅ Sin deudas pendientes.</span>'; return }
  result.innerHTML = `⏱ Estarías libre de deudas en aprox. <strong style="color:var(--accent)">${fmtMonths(months)}</strong> pagando <strong style="color:var(--text)">${eur(monthly)}/mes</strong>.`
}

function renderProjection() {
  const scenarios = projectWealth(12)
  if (!scenarios.length) return '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Sin datos suficientes</div></div>'

  const last = scenarios[scenarios.length - 1]
  const curr = calcPatrimonio()

  return `
  <div class="kpi-grid kpi-grid-3" style="margin-bottom:16px">
    <div class="proj-scenario">
      <div class="proj-dot" style="background:var(--text3)"></div>
      <div><div style="font-size:.72rem;color:var(--text2);font-weight:600">Conservador</div><div style="font-size:.9rem;font-weight:700;color:var(--text)">${eur(last.conservador)}</div></div>
    </div>
    <div class="proj-scenario">
      <div class="proj-dot" style="background:var(--accent)"></div>
      <div><div style="font-size:.72rem;color:var(--text2);font-weight:600">Moderado</div><div style="font-size:.9rem;font-weight:700;color:var(--accent)">${eur(last.moderado)}</div></div>
    </div>
    <div class="proj-scenario">
      <div class="proj-dot" style="background:var(--green)"></div>
      <div><div style="font-size:.72rem;color:var(--text2);font-weight:600">Optimista</div><div style="font-size:.9rem;font-weight:700;color:var(--green)">${eur(last.optimista)}</div></div>
    </div>
  </div>
  <div class="chart-container" style="height:160px"><canvas id="chartProjection"></canvas></div>
  <div style="margin-top:10px;font-size:.75rem;color:var(--text3)">Proyección a 12 meses basada en tu cash flow histórico e inversiones.</div>`
}

function renderProjectionChart() {
  const ctx = document.getElementById('chartProjection')
  if (!ctx) return
  destroyChart('projection')
  const sc = projectWealth(12)
  const labels = sc.map(s => monthLabel(s.mes))
  charts['projection'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Optimista',   data: sc.map(s=>s.optimista),   borderColor:'#10B981', borderDash:[],  fill:false, tension:.4, pointRadius:0, borderWidth:2 },
        { label:'Moderado',    data: sc.map(s=>s.moderado),    borderColor:'#00D4AA', borderDash:[],  fill:'+1',  tension:.4, pointRadius:0, borderWidth:2, backgroundColor:'rgba(0,212,170,0.06)' },
        { label:'Conservador', data: sc.map(s=>s.conservador), borderColor:'#475569', borderDash:[4,3],fill:false,tension:.4, pointRadius:0, borderWidth:1.5 }
      ]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins, legend:{ display:true, labels:{ color:labelColor(), boxWidth:10, font:{size:10} } } },
      scales: {
        x: { grid:{color:gridColor()}, ticks:{color:labelColor(),font:{size:10},autoSkip:true,maxRotation:60,minRotation:0,maxTicksLimit:(typeof window!=='undefined'&&window.innerWidth<480)?6:12} },
        y: { grid:{color:gridColor()}, ticks:{color:labelColor(),font:{size:10},callback:v=>eur(v)} }
      }
    }
  })
}

function renderTaxSummary() {
  const m   = currentMonth()
  const cfg = S.taxConfig || { iva:21, irpf:15 }
  const ing = calcIngresosMes(m)
  const gas = calcGastosMes(m)
  // IVA repercutido (cobrado a clientes en facturas emitidas)
  const ivaRepercutido = ing * (Number(cfg.iva) / 100)
  // IVA soportado (pagado a proveedores, deducible)
  const ivaSoportado   = gas * (Number(cfg.iva) / 100)
  // IVA a liquidar (diferencia a ingresar a Hacienda)
  const ivaLiquidar    = Math.max(0, ivaRepercutido - ivaSoportado)
  const irpf           = ing * (Number(cfg.irpf) / 100)
  const totalReserva   = ivaLiquidar + irpf
  const net            = ing - totalReserva
  const reservaPct     = ing > 0 ? (totalReserva / ing * 100) : 0

  return `
  <div class="kpi-grid kpi-grid-3" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">💶</div>
      <div class="kpi-label">Ingresos brutos</div>
      <div class="kpi-value sm">${eur(ing)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--gold-dim)">🧾</div>
      <div class="kpi-label">Reserva fiscal</div>
      <div class="kpi-value sm" style="color:var(--gold)">${eur(totalReserva)}</div>
      <div class="kpi-sub">${pct(reservaPct)} de los ingresos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">✅</div>
      <div class="kpi-label">Ingreso neto real</div>
      <div class="kpi-value sm" style="color:var(--green)">${eur(net)}</div>
    </div>
  </div>
  <div class="stat-row"><span class="stat-key">IVA repercutido (emitido, ${cfg.iva}%)</span><span class="stat-val" style="color:var(--gold)">${eur(ivaRepercutido)}</span></div>
  <div class="stat-row"><span class="stat-key">IVA soportado (deducible, ${cfg.iva}%)</span><span class="stat-val" style="color:var(--green)">−${eur(ivaSoportado)}</span></div>
  <div class="stat-row"><span class="stat-key"><strong>IVA a liquidar</strong></span><span class="stat-val" style="color:var(--gold)"><strong>${eur(ivaLiquidar)}</strong></span></div>
  <div class="stat-row"><span class="stat-key">IRPF / IS retenido (${cfg.irpf}%)</span><span class="stat-val" style="color:var(--gold)">${eur(irpf)}</span></div>
  <div style="margin-top:12px;padding:10px 12px;background:var(--gold-dim);border-radius:var(--radius-sm);border:1px solid rgba(245,158,11,.15)">
    <div style="font-size:.78rem;color:var(--gold);font-weight:700">⚠️ Reserva total a apartar este mes: ${eur(totalReserva)}</div>
    <div style="font-size:.72rem;color:var(--text2);margin-top:4px">Estimación orientativa. Consulta con tu asesor fiscal para importes definitivos.</div>
  </div>`
}

// ─── CIERRE DE MES ─────────────────────────────────────────────
function abrirCierreMes() {
  const rev = generateMonthlyReview(currentMonth())
  const anomHtml = rev.anomalies.map(a => `
    <div class="insight-item" style="margin-bottom:8px">
      <div class="insight-icon" style="background:${a.type==='danger'?'var(--red-dim)':'var(--gold-dim)'}">${a.type==='danger'?'🚨':'⚠️'}</div>
      <div class="insight-text">${a.msg}</div>
    </div>`).join('') || '<div class="insight-item"><div class="insight-icon" style="background:var(--green-dim)">✅</div><div class="insight-text"><strong>¡Sin anomalías!</strong></div></div>'

  document.getElementById('monthlyBody').innerHTML = `
  <div class="kpi-grid kpi-grid-3" style="margin-bottom:14px">
    <div class="kpi-card"><div class="kpi-label">Ingresos</div><div class="kpi-value sm td-pos">+${eur(rev.ing)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Gastos</div><div class="kpi-value sm td-neg">-${eur(rev.gas)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Cash Flow</div><div class="kpi-value sm" style="color:${rev.cf>=0?'var(--accent)':'var(--red)'}">${rev.cf>=0?'+':''}${eur(rev.cf)}</div></div>
  </div>
  <div style="margin-bottom:16px"><div style="font-size:.82rem;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Anomalías</div>${anomHtml}</div>
  <div style="margin-bottom:16px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Top 5 gastos del mes</div>
    ${rev.topGastos.map(g=>`<div class="stat-row"><span class="stat-key">${g.concepto} <span class="tag" style="margin-left:4px">${g.categoria||'—'}</span></span><span class="stat-val td-neg">-${eur(g.importe)}</span></div>`).join('')}
  </div>
  <div style="font-size:.82rem;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Tasa de ahorro</div>
  <div class="progress-info"><span class="progress-label">${pct(rev.sr)}</span><span class="progress-pct" style="color:${rev.sr>=20?'var(--green)':rev.sr>=10?'var(--gold)':'var(--red)'}">${rev.sr>=20?'Excelente':rev.sr>=10?'Mejorable':'Bajo'}</span></div>
  <div class="progress-wrap"><div class="progress-bar ${rev.sr>=20?'progress-ok':rev.sr>=10?'progress-warn':'progress-danger'}" style="width:${clamp(rev.sr,0,100)}%"></div></div>`

  openModal('monthlyModal')
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: ONBOARDING — PREMIUM SPLIT EXPERIENCE ───────────
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ─── ONBOARDING — PREMIUM FINTECH FLOW v2 ────────────────────
//  5 steps: Lang → Name → Appearance → Account → Start
// ════════════════════════════════════════════════════════════════
const OB_TOTAL = 6
let obStep = 1
let obData = { nombre: '', email: '', password: '', mode: 'personal', lang: 'es', theme: 'dark', plan: 'trial', startTutorial: false, loadDemo: false }

// ── Left panel: ambient visuals that evolve with each step ────
function _obLeftHTML(step) {
  const brand = `
    <div class="ob-brand">
      <div class="ob-brand-icon">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 16 L8 9 L11 13 L15 7 L19 11" stroke="#0A0E17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="ob-brand-name">MoneyNest</span>
    </div>`

  // STEP 1: Auth — left panel shows language selector + brand tagline
  if (step === 1) {
    const langs = [['es','🇪🇸','Español'],['en','🇬🇧','English']]
    return `
    <div class="ob-left-content ob-left-content--auth">
      ${brand}
      <div class="ob-left-hero" style="margin-bottom:28px">
        <div class="ob-left-title" style="font-size:2rem;line-height:1.15">Tu dinero,<br><span style="color:#00D4AA">bajo control.</span></div>
        <div class="ob-left-sub" style="margin-top:10px">Finanzas personales inteligentes. Ingresos, gastos, inversiones y patrimonio en un solo lugar.</div>
      </div>
      <div class="ob-left-lang-section">
        <div style="font-size:.68rem;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Elige tu idioma</div>
        <div class="ob-lang-grid-left">
          ${langs.map(([code, flag, name]) => `
            <div class="ob-lang-tile-left ${obData.lang === code ? 'selected' : ''}" onclick="obSelectLang('${code}')">
              <span>${flag}</span>
              <span>${name}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="ob-left-trust">
        <div class="ob-trust-item"><span class="ob-stat-dot green" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10B981;flex-shrink:0"></span><span>Datos 100% privados</span></div>
        <div class="ob-trust-item"><span class="ob-stat-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#6366F1;flex-shrink:0"></span><span>Sin rastreo publicitario</span></div>
        <div class="ob-trust-item"><span class="ob-stat-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00D4AA;flex-shrink:0"></span><span>Prueba gratuita 24h</span></div>
      </div>
    </div>`
  }

  if (step === 2) return `
    <div class="ob-left-content">
      ${brand}
      <div class="ob-left-hero">
        <div class="ob-globe">👤</div>
        <div class="ob-left-title">Hola,<br><span id="obLeftName" style="color:#00D4AA">${obData.nombre || '…'}</span></div>
        <div class="ob-left-sub">Tu nombre aparecerá en tu dashboard y en tus informes personalizados.</div>
      </div>
      <div class="ob-left-stat-card">
        <div class="ob-stat-row"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10B981;flex-shrink:0"></span><span class="ob-stat-lbl">Datos 100% locales</span></div>
        <div class="ob-stat-row"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#6366F1;flex-shrink:0"></span><span class="ob-stat-lbl">Sin rastreo</span></div>
        <div class="ob-stat-row"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00D4AA;flex-shrink:0"></span><span class="ob-stat-lbl">Cifrado en tu dispositivo</span></div>
      </div>
    </div>`

  if (step === 3) return `
    <div class="ob-left-content">
      ${brand}
      <div class="ob-left-hero">
        <div class="ob-globe">${obData.theme === 'light' ? '☀️' : obData.theme === 'auto' ? '⚙️' : '🌙'}</div>
        <div class="ob-left-title">Tu apariencia,<br>en tiempo real.</div>
        <div class="ob-left-sub">Estás viendo el resultado ahora mismo. Puedes cambiarlo cuando quieras.</div>
      </div>
      <div class="ob-left-theme-demo">
        <div class="ob-theme-mini-preview" id="obThemePreviewLeft">
          <div class="ob-mini-topbar"></div>
          <div class="ob-mini-sidebar"></div>
          <div class="ob-mini-content">
            <div class="ob-mini-card"></div>
            <div class="ob-mini-card ob-mini-card--sm"></div>
          </div>
        </div>
      </div>
    </div>`

  // STEP 4: Plan selector — left shows plan benefits
  if (step === 4) {
    const planInfo = {
      trial: { icon: '🕐', color: '#F59E0B', label: 'Free Trial', desc: '24 horas gratuitas' },
      local: { icon: '💾', color: '#10B981', label: 'Local', desc: 'Pago único 5€' },
    }
    const p = planInfo[obData.plan] || planInfo.trial
    return `
    <div class="ob-left-content">
      ${brand}
      <div class="ob-left-hero">
        <div class="ob-globe">${p.icon}</div>
        <div class="ob-left-title" style="color:#fff">Plan<br><span style="color:${p.color}">${p.label}</span></div>
        <div class="ob-left-sub">${p.desc}</div>
      </div>
      <div class="ob-left-stat-card">
        <div class="ob-stat-row"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10B981;flex-shrink:0"></span><span class="ob-stat-lbl">Siempre puedes cambiar de plan</span></div>
        <div class="ob-stat-row"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#6366F1;flex-shrink:0"></span><span class="ob-stat-lbl">Tus datos nunca se borran</span></div>
        <div class="ob-stat-row"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00D4AA;flex-shrink:0"></span><span class="ob-stat-lbl">Sin compromisos</span></div>
      </div>
    </div>`
  }

  // step 5
  const nombre = obData.nombre || 'Usuario'
  return `
    <div class="ob-left-content">
      ${brand}
      <div class="ob-visual-preview">
        <div class="ob-preview-header">
          <div class="ob-preview-dot" style="background:#F43F5E"></div>
          <div class="ob-preview-dot" style="background:#F59E0B"></div>
          <div class="ob-preview-dot" style="background:#10B981"></div>
          <div class="ob-preview-title-bar"></div>
        </div>
        <div class="ob-preview-body" style="flex-direction:column;gap:8px">
          <div style="padding:6px 2px;font-size:.7rem;font-weight:700;color:rgba(255,255,255,0.5)">Hola, <span style="color:#00D4AA">${nombre}</span> 👋</div>
          <div class="ob-kpi-row">
            <div class="ob-kpi-mini"><div class="ob-kpi-lbl">Ahorro</div><div class="ob-kpi-val green">€0</div></div>
            <div class="ob-kpi-mini"><div class="ob-kpi-lbl">Gastos</div><div class="ob-kpi-val red">€0</div></div>
          </div>
          <div style="background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:8px;padding:8px 10px;font-size:.62rem;color:rgba(255,255,255,0.45)">
            Todo listo para empezar 🚀
          </div>
        </div>
      </div>
      <div class="ob-feats">
        <div class="ob-feat"><div class="ob-feat-icon">🔒</div><div class="ob-feat-text"><strong>${t('ob_feat_priv')}</strong>${t('ob_feat_priv_sub')}</div></div>
        <div class="ob-feat"><div class="ob-feat-icon">⚡</div><div class="ob-feat-text"><strong>${t('ob_feat_gratis')}</strong>${t('ob_feat_gratis_sub')}</div></div>
      </div>
    </div>`
}

// ── Right panel: interactive step content ─────────────────────
function _obRightHTML(step) {
  const backBtn = obStep > 1
    ? `<button class="ob-back-btn" onclick="obPrev()">${t('ob_atras')}</button>`
    : ''

  // ── STEP 1: Auth (register / login) ──────────────────────────
  if (step === 1) {
    const isLogin = obData._authMode === 'login'
    return `
    <div class="ob-step-pill"><div class="ob-step-pill-dot"></div>${t('ob_paso','Paso')} 1 ${t('ob_de','de')} ${OB_TOTAL}</div>
    <div class="ob-headline">${isLogin
      ? `${t('ob_auth_login_h1','Bienvenido')}<br><span class="ob-headline-accent">${t('ob_auth_login_h2','de nuevo')}</span>`
      : `${t('ob_auth_reg_h1','Crea tu')}<br><span class="ob-headline-accent">${t('ob_auth_reg_h2','cuenta gratis')}</span>`}</div>
    <p class="ob-lead">${isLogin
      ? t('ob_auth_login_lead','Inicia sesión para continuar con tus datos.')
      : t('ob_auth_reg_lead','Sin tarjeta. Sin compromisos. 24h de prueba incluidas.')}</p>

    <div class="ob-fields">
      <div class="ob-field-wrap">
        <label class="ob-field-label">${t('auth_email','Correo electrónico')}</label>
        <div class="ob-input-wrap">
          <span class="ob-input-icon">✉️</span>
          <input class="ob-field-input" id="obEmail" type="email" placeholder="${t('placeholder_email','tu@email.com')}"
            value="${obData.email}" autocomplete="email"
            oninput="obData.email=this.value"
            onkeydown="if(event.key==='Enter')document.getElementById('obPassword')?.focus()">
        </div>
      </div>
      <div class="ob-field-wrap">
        <label class="ob-field-label">${t('auth_password','Contraseña')}${isLogin ? '' : ` <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text2)">(${t('ob_pw_min','mín. 8 caracteres')})</span>`}</label>
        <div class="ob-input-wrap">
          <span class="ob-input-icon">🔑</span>
          <input class="ob-field-input" id="obPassword" type="password" placeholder="${isLogin ? '••••••••' : t('ob_pw_placeholder','Mínimo 8 caracteres')}"
            value="${obData.password}" autocomplete="${isLogin ? 'current-password' : 'new-password'}"
            oninput="obData.password=this.value;${isLogin ? '' : '_obCheckPwStrength(this.value)'}"
            onkeydown="if(event.key==='Enter')${isLogin ? 'obNext()' : "document.getElementById('obPassword2')?.focus()"}">
          <button class="ob-pw-toggle" onclick="_obTogglePw()" tabindex="-1">👁</button>
        </div>
        ${isLogin ? '' : `
        <div class="ob-pw-strength" id="obPwStrength" style="display:none">
          <div class="ob-pw-bar"><div class="ob-pw-fill" id="obPwFill"></div></div>
          <span class="ob-pw-label" id="obPwLabel"></span>
        </div>`}
      </div>
      ${isLogin ? `
      <div style="text-align:right;margin-top:-6px">
        <button style="background:none;border:none;font-size:.75rem;color:rgba(255,255,255,0.4);cursor:pointer;font-family:inherit;padding:0" onclick="_obForgotPassword()">${t('auth_olvide_contrasena','¿Olvidaste tu contraseña?')}</button>
      </div>` : `
      <div class="ob-field-wrap">
        <label class="ob-field-label">${t('auth_confirmar_password','Confirmar contraseña')}</label>
        <div class="ob-input-wrap">
          <span class="ob-input-icon">🔑</span>
          <input class="ob-field-input" id="obPassword2" type="password" placeholder="${t('ob_pw_repeat','Repite la contraseña')}"
            value="${obData.password2 || ''}" autocomplete="new-password"
            oninput="obData.password2=this.value"
            onkeydown="if(event.key==='Enter')obNext()">
          <button class="ob-pw-toggle" onclick="_obTogglePw2()" tabindex="-1">👁</button>
        </div>
      </div>`}
      <div class="ob-field-error" id="obAccountError" style="display:none"></div>
    </div>

    <div class="ob-actions-row" style="margin-top:16px">
      <button class="ob-next-btn" onclick="obNext()">
        ${isLogin ? t('btn_entrar','Entrar') : t('ob_auth_reg_cta','Crear cuenta')}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline;vertical-align:middle"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

    <div style="text-align:center;margin-top:14px">
      <span style="font-size:.78rem;color:rgba(255,255,255,0.35)">${isLogin ? t('ob_no_tienes_cuenta','¿No tienes cuenta?') : t('auth_ya_tienes','¿Ya tienes cuenta?')} </span>
      <button style="background:none;border:none;font-size:.78rem;color:#00D4AA;font-weight:700;cursor:pointer;font-family:inherit;padding:0" onclick="_obToggleAuthMode()">
        ${isLogin ? t('ob_auth_reg_cta','Crear cuenta →') : t('auth_iniciar_sesion_link','Iniciar sesión →')}
      </button>
    </div>`
  }

  // ── STEP 2: Name ─────────────────────────────────────────────
  if (step === 2) return `
    <div class="ob-step-pill"><div class="ob-step-pill-dot"></div>${t('ob_paso','Paso')} 2 ${t('ob_de','de')} ${OB_TOTAL}</div>
    <div class="ob-headline">${t('ob_s1_h1')}<br>${t('ob_s1_h2')}</div>
    <p class="ob-lead">${t('ob_s1_lead')}</p>
    <div class="ob-name-wrap">
      <span class="ob-name-prefix">👤</span>
      <input class="ob-name-input" id="obNombre" type="text" placeholder="${t('ob_s1_placeholder')}" maxlength="40"
        value="${obData.nombre}" autocomplete="given-name"
        oninput="obData.nombre=this.value;var el=document.getElementById('obLeftName');if(el)el.textContent=this.value||'…'"
        onkeydown="if(event.key==='Enter') obNext()">
    </div>
    <p class="ob-name-hint">${t('ob_s1_hint')}</p>
    <div class="ob-actions-row">
      ${backBtn}
      <button class="ob-next-btn" onclick="obNext()">
        ${t('ob_s1_cta')} <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline;vertical-align:middle"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`

  // ── STEP 3: Appearance — 3 cards in a row ───────────────────
  if (step === 3) return `
    <div class="ob-step-pill"><div class="ob-step-pill-dot"></div>${t('ob_paso','Paso')} 3 ${t('ob_de','de')} ${OB_TOTAL}</div>
    <div class="ob-headline">${t('ob_s2_h1')}<br>${t('ob_s2_h2')}</div>
    <p class="ob-lead">${t('ob_s2_lead')}</p>
    <div class="ob-theme-cards ob-theme-cards--3col" id="obThemeCards">
      <div class="ob-theme-card ${obData.theme === 'dark' ? 'selected' : ''}" onclick="obSelectTheme('dark')">
        <div class="ob-theme-preview ob-theme-preview--dark">
          <div class="ob-tp-bar"></div><div class="ob-tp-side"></div>
          <div class="ob-tp-body"><div class="ob-tp-card"></div><div class="ob-tp-card ob-tp-card--sm"></div></div>
        </div>
        <div class="ob-theme-card-label">🌙 ${t('ob_oscuro')}<div class="ob-theme-check">${obData.theme === 'dark' ? '✓' : ''}</div></div>
      </div>
      <div class="ob-theme-card ${obData.theme === 'light' ? 'selected' : ''}" onclick="obSelectTheme('light')">
        <div class="ob-theme-preview ob-theme-preview--light">
          <div class="ob-tp-bar"></div><div class="ob-tp-side"></div>
          <div class="ob-tp-body"><div class="ob-tp-card"></div><div class="ob-tp-card ob-tp-card--sm"></div></div>
        </div>
        <div class="ob-theme-card-label">☀️ ${t('ob_claro')}<div class="ob-theme-check">${obData.theme === 'light' ? '✓' : ''}</div></div>
      </div>
      <div class="ob-theme-card ${obData.theme === 'auto' ? 'selected' : ''}" onclick="obSelectTheme('auto')">
        <div class="ob-theme-preview ob-theme-preview--auto">
          <div class="ob-tp-half ob-tp-half--dark"></div><div class="ob-tp-half ob-tp-half--light"></div>
        </div>
        <div class="ob-theme-card-label">⚙️ Auto<div class="ob-theme-check">${obData.theme === 'auto' ? '✓' : ''}</div></div>
      </div>
    </div>
    <div class="ob-actions-row">
      ${backBtn}
      <button class="ob-next-btn" onclick="obNext()">
        ${t('ob_s1_cta')} <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline;vertical-align:middle"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`

  // ── STEP 4: Plan selector ─────────────────────────────────────
  if (step === 4) return `
    <div class="ob-step-pill"><div class="ob-step-pill-dot"></div>${t('ob_paso','Paso')} 4 ${t('ob_de','de')} ${OB_TOTAL}</div>
    <div class="ob-headline">${t('ob_plan_h1','Elige tu')}<br><span class="ob-headline-accent">${t('ob_plan_h2','plan')}</span></div>
    <p class="ob-lead">Sin permanencia. Cambia cuando quieras.</p>
    <div class="ob-plan-cards" id="obPlanCards">

      <div class="ob-plan-card ob-plan-card--trial ${obData.plan === 'trial' ? 'selected' : ''}" onclick="obSelectPlan('trial')">
        <div class="ob-pc-top">
          <span class="ob-pc-emoji">🕐</span>
          <span class="ob-pc-tag ob-pc-tag--free">Gratis</span>
        </div>
        <div class="ob-pc-name">Free Trial</div>
        <div class="ob-pc-price-main">0<span class="ob-pc-cur">€</span></div>
        <div class="ob-pc-period">durante 24 horas</div>
        <div class="ob-pc-divider"></div>
        <ul class="ob-pc-feats">
          <li class="ok">Acceso completo 24h</li>
          <li class="ok">Todos los módulos</li>
          <li class="no">Sin sincronización cloud</li>
        </ul>
        <div class="ob-pc-check ${obData.plan === 'trial' ? 'active' : ''}">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>

      <div class="ob-plan-card ob-plan-card--local ${obData.plan === 'local' ? 'selected' : ''}" onclick="obSelectPlan('local')">
        <div class="ob-pc-top">
          <span class="ob-pc-emoji">💾</span>
          <span class="ob-pc-tag ob-pc-tag--local">Pago único</span>
        </div>
        <div class="ob-pc-name">MoneyNest Local</div>
        <div class="ob-pc-price-main">6,99<span class="ob-pc-cur">€</span></div>
        <div class="ob-pc-period">para siempre</div>
        <div class="ob-pc-divider"></div>
        <ul class="ob-pc-feats">
          <li class="ok">Acceso ilimitado</li>
          <li class="ok">Sin suscripción</li>
          <li class="no">Sin sincronización cloud</li>
        </ul>
        <div class="ob-pc-check ${obData.plan === 'local' ? 'active' : ''}">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>

      <div class="ob-plan-card ob-plan-card--pro ${obData.plan === 'pro' ? 'selected' : ''}" onclick="obSelectPlan('pro')">
        <div class="ob-pc-popular">Más popular</div>
        <div class="ob-pc-top">
          <span class="ob-pc-emoji">☁️</span>
          <span class="ob-pc-tag ob-pc-tag--pro">Anual</span>
        </div>
        <div class="ob-pc-name">MoneyNest Pro</div>
        <div class="ob-pc-price-main">14,99<span class="ob-pc-cur">€</span></div>
        <div class="ob-pc-period">al año</div>
        <div class="ob-pc-divider"></div>
        <ul class="ob-pc-feats">
          <li class="ok">Todo lo de Local</li>
          <li class="ok">Sincronización cloud</li>
          <li class="ok">Backup y restauración</li>
        </ul>
        <div class="ob-pc-check ${obData.plan === 'pro' ? 'active' : ''}">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      </div>

    </div>
    <div class="ob-actions-row" style="margin-top:20px">
      ${backBtn}
      <button class="ob-next-btn" onclick="obNext()">
        Continuar <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline;vertical-align:middle"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`

  // ── STEP 5: Start mode ───────────────────────────────────────
  if (step === 5) {
  const nombre = obData.nombre || 'Usuario'
  return `
    <div class="ob-step-pill"><div class="ob-step-pill-dot"></div>${t('ob_paso','Paso')} 5 ${t('ob_de','de')} ${OB_TOTAL}</div>
    <div class="ob-headline">${t('ob_s3_h1')}<br>${t('ob_s3_h2')}</div>
    <p class="ob-lead">${t('ob_s3_lead')}</p>
    <div class="ob-options" id="obOptions">
      <div class="ob-opt ${obData.loadDemo ? 'selected' : ''}" onclick="obSelectOpt('demo')">
        <div class="ob-opt-emoji">🔍</div>
        <div class="ob-opt-info"><div class="ob-opt-label">${t('ob_opt_demo_lbl')}</div><div class="ob-opt-sub">${t('ob_opt_demo_sub')}</div></div>
        <div class="ob-opt-radio"><div class="ob-opt-radio-dot"></div></div>
      </div>
      <div class="ob-opt ${!obData.loadDemo ? 'selected' : ''}" onclick="obSelectOpt('direct')">
        <div class="ob-opt-emoji">⚡</div>
        <div class="ob-opt-info"><div class="ob-opt-label">${t('ob_opt_direct_lbl')}</div><div class="ob-opt-sub">${t('ob_opt_direct_sub')}</div></div>
        <div class="ob-opt-radio"><div class="ob-opt-radio-dot"></div></div>
      </div>
    </div>
    <div style="margin-top:20px;padding:14px 18px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:12px;display:flex;align-items:flex-start;gap:12px">
      <div style="font-size:1.3rem;flex-shrink:0">💡</div>
      <div style="flex:1">
        <div style="font-size:0.88rem;font-weight:700;color:var(--accent);margin-bottom:4px">${t('ob_logros_tip_titulo', '¿Primera vez usando MoneyNest?')}</div>
        <div style="font-size:0.8rem;color:var(--text2);line-height:1.5">${t('ob_logros_tip_desc', 'Ve completando los logros de la sección 🏆 Logros. Ellos te enseñarán paso a paso cómo funciona la aplicación.')}</div>
      </div>
    </div>
    <div class="ob-actions-row">
      ${backBtn}
      <button class="ob-next-btn" onclick="obNext()">
        ${t('ob_continuar','Continuar')} <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline;vertical-align:middle"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`
  }

  // ── STEP 6: Importar datos bancarios (mismo importador real) ──
  return `
    <div class="ob-step-pill"><div class="ob-step-pill-dot"></div>${t('ob_paso','Paso')} 6 ${t('ob_de','de')} ${OB_TOTAL}</div>
    <div class="ob-headline">${t('ob_bank_h1','¿Quieres importar')}<br><span class="ob-headline-accent">${t('ob_bank_h2','tus datos bancarios?')}</span></div>
    <p class="ob-lead">${t('ob_bank_lead','Importa tus movimientos para empezar a utilizar MoneyNest con tus datos reales.')}</p>
    <div class="ob-options" id="obBankImportOptions" style="margin-top:8px">
      <div class="ob-opt" onclick="obGoBankImport()" style="cursor:pointer">
        <div class="ob-opt-emoji">🏦</div>
        <div class="ob-opt-info"><div class="ob-opt-label">${t('btn_importar_datos_bancarios','Importar datos bancarios')}</div><div class="ob-opt-sub">${t('ob_bank_opt_sub','Sube un extracto CSV o Excel (XLSX) de tu banco')}</div></div>
      </div>
    </div>
    <div id="obBankImportedNotice" style="display:none;margin-top:14px;padding:12px 16px;background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.3);border-radius:12px;color:var(--accent);font-size:.85rem;font-weight:700">
      ✅ ${t('ob_bank_done','Datos importados correctamente')}
    </div>
    <div class="ob-actions-row" style="margin-top:20px">
      ${backBtn}
      <button class="ob-next-btn ob-next-btn--finish" onclick="obNext()">
        🚀 ${t('ob_bank_skip','Hacerlo más tarde')}
      </button>
    </div>`
}

function obSelectPlan(plan) {
  obData.plan = plan
  document.querySelectorAll('#obPlanCards .ob-plan-card').forEach(el => {
    el.classList.remove('selected')
    const chk = el.querySelector('.ob-pc-check')
    if (chk) chk.classList.remove('active')
  })
  const map = { trial: 0, local: 1, pro: 2 }
  const els = document.querySelectorAll('#obPlanCards .ob-plan-card')
  if (els[map[plan]]) {
    els[map[plan]].classList.add('selected')
    const chk = els[map[plan]].querySelector('.ob-pc-check')
    if (chk) chk.classList.add('active')
  }
  const leftPanel = document.getElementById('obLeftPanel')
  if (leftPanel) leftPanel.innerHTML = _obLeftHTML(4)
}

function obSelectOpt(mode) {
  if (mode === 'tutorial') { obData.startTutorial = true;  obData.loadDemo = false }
  if (mode === 'demo')     { obData.startTutorial = false; obData.loadDemo = true  }
  if (mode === 'direct')   { obData.startTutorial = false; obData.loadDemo = false }
  document.querySelectorAll('#obOptions .ob-opt').forEach(el => el.classList.remove('selected'))
  const map = { demo: 0, direct: 1, tutorial: 2 }
  const idx = map[mode]
  const els = document.querySelectorAll('#obOptions .ob-opt')
  if (els[idx]) els[idx].classList.add('selected')
}

// Abre el importador bancario REAL ya existente en la app — el mismo
// que se usa desde Dashboard/Ingresos/Gastos/Cuentas — sin crear ningun
// flujo alternativo. El overlay del onboarding nunca se cierra (solo
// queda tapado por el del importador, que tiene un z-index superior),
// asi que al cerrar el importador el onboarding reaparece exactamente
// en el mismo paso, de forma natural. Se observa (sin tocar nada de
// bank-import.js) si el cierre vino acompañado de una importacion real,
// solo para mostrar una confirmacion visual dentro de este paso.
function obGoBankImport() {
  if (!window.MNBankImport) return
  const countImports = () => (S.gastos||[]).filter(g=>g.origen==='bank-import').length + (S.ingresos||[]).filter(g=>g.origen==='bank-import').length
  const before = countImports()
  MNBankImport.open()
  setTimeout(() => {
    const overlay = document.getElementById('mnBankImportOverlay')
    if (!overlay) return
    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('open')) {
        observer.disconnect()
        if (countImports() > before) {
          const notice = document.getElementById('obBankImportedNotice')
          if (notice) notice.style.display = 'block'
        }
      }
    })
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] })
  }, 50)
}

function obRender(direction) {
  const bar = document.getElementById('obGlobalBar')
  if (bar) {
    bar.style.transition = 'width .4s cubic-bezier(.4,0,.2,1)'
    bar.style.width = ((obStep / OB_TOTAL) * 100) + '%'
  }
  // Update step dots
  for (let i = 1; i <= OB_TOTAL; i++) {
    const dot = document.getElementById('obDot' + i)
    if (!dot) continue
    dot.classList.toggle('active', i === obStep)
    dot.classList.toggle('done', i < obStep)
  }
  const leftPanel = document.getElementById('obLeftPanel')
  if (leftPanel) {
    leftPanel.style.transition = 'opacity .25s'
    leftPanel.style.opacity = '0'
    setTimeout(() => {
      leftPanel.innerHTML = _obLeftHTML(obStep)
      leftPanel.style.opacity = '1'
    }, 120)
  }
  const contentArea = document.getElementById('obContentArea')
  if (!contentArea) return
  const exitClass  = direction === 'back' ? 'ob-enter' : 'ob-exit'
  const enterClass = direction === 'back' ? 'ob-exit'  : 'ob-enter'
  contentArea.classList.add(exitClass)
  setTimeout(() => {
    contentArea.innerHTML = _obRightHTML(obStep)
    contentArea.classList.remove(exitClass)
    contentArea.classList.add(enterClass)
    requestAnimationFrame(() => requestAnimationFrame(() => contentArea.classList.remove(enterClass)))
    if (obStep === 1) setTimeout(() => document.getElementById('obEmail')?.focus(), 80)
    if (obStep === 2) setTimeout(() => document.getElementById('obNombre')?.focus(), 80)
    // Apply real-time theme preview on step 3
    if (obStep === 3) _obApplyThemePreview(obData.theme)
  }, 160)
}

function _obUpdateLeftLive() { /* handled per-step in obRender */ }

function obSelectLang(l) {
  obData.lang = l
  _currentLang = l
  // Persist immediately so t() picks it up in the re-render
  try { localStorage.setItem(LANG_STORAGE_KEY, l) } catch(e) {}

  // Actualizar tiles visuales
  document.querySelectorAll('.ob-lang-tile, .ob-lang-tile-left').forEach(el => el.classList.remove('selected'))
  const sel = document.querySelector(`.ob-lang-tile[onclick*="'${l}'"], .ob-lang-tile-left[onclick*="'${l}'"]`)
  if (sel) sel.classList.add('selected')

  // Re-render completo del onboarding en el nuevo idioma
  // Pequeño delay para que el DOM procese el cambio de _currentLang antes de re-render
  const contentArea = document.getElementById('obContentArea')
  const leftPanel   = document.getElementById('obLeftPanel')

  if (contentArea) {
    contentArea.style.opacity = '0'
    contentArea.style.transition = 'opacity .15s'
  }
  if (leftPanel) {
    leftPanel.style.opacity = '0'
    leftPanel.style.transition = 'opacity .15s'
  }

  setTimeout(() => {
    if (contentArea) {
      contentArea.innerHTML = _obRightHTML(obStep)
      contentArea.style.opacity = '1'
    }
    if (leftPanel) {
      leftPanel.innerHTML = _obLeftHTML(obStep)
      leftPanel.style.opacity = '1'
    }
  }, 80)
}

function obSelectTheme(theme) {
  obData.theme = theme
  // Real-time preview — apply to whole app immediately
  _obApplyThemePreview(theme)
  document.querySelectorAll('#obThemeCards .ob-theme-card').forEach((el, i) => {
    const isSelected = (theme === 'dark' && i === 0) || (theme === 'light' && i === 1) || (theme === 'auto' && i === 2)
    el.classList.toggle('selected', isSelected)
    const check = el.querySelector('.ob-theme-check')
    if (check) check.textContent = isSelected ? '✓' : ''
  })
  // Update left panel globe emoji
  const globe = document.querySelector('#obLeftPanel .ob-globe')
  if (globe) globe.textContent = theme === 'light' ? '☀️' : theme === 'auto' ? '⚙️' : '🌙'
}

function _obApplyThemePreview(theme) {
  let resolved = theme
  if (theme === 'auto') resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', resolved)
}

function _obCheckPwStrength(pw) {
  const bar   = document.getElementById('obPwStrength')
  const fill  = document.getElementById('obPwFill')
  const label = document.getElementById('obPwLabel')
  if (!bar || !fill || !label) return
  if (!pw) { bar.style.display = 'none'; return }
  bar.style.display = 'flex'
  let score = 0
  if (pw.length >= 8)  score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const levels = [
    { pct: '25%', color: '#F43F5E', text: 'Muy débil' },
    { pct: '50%', color: '#F59E0B', text: 'Débil' },
    { pct: '75%', color: '#6366F1', text: 'Buena' },
    { pct: '100%', color: '#00D4AA', text: 'Fuerte ✓' },
  ]
  const lv = levels[Math.max(0, score - 1)]
  fill.style.width     = lv.pct
  fill.style.background = lv.color
  label.textContent    = lv.text
  label.style.color    = lv.color
}

function _obTogglePw() {
  const inp = document.getElementById('obPassword')
  if (!inp) return
  inp.type = inp.type === 'password' ? 'text' : 'password'
}

function _obTogglePw2() {
  const inp = document.getElementById('obPassword2')
  if (!inp) return
  inp.type = inp.type === 'password' ? 'text' : 'password'
}

function _obToggleAuthMode() {
  obData._authMode = obData._authMode === 'login' ? 'register' : 'login'
  const contentArea = document.getElementById('obContentArea')
  if (!contentArea) return
  contentArea.style.transition = 'opacity .15s'
  contentArea.style.opacity = '0'
  setTimeout(() => {
    contentArea.innerHTML = _obRightHTML(obStep)
    contentArea.style.opacity = '1'
    setTimeout(() => document.getElementById('obEmail')?.focus(), 60)
  }, 120)
}

async function _obForgotPassword() {
  const email = (document.getElementById('obEmail')?.value || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const errEl = document.getElementById('obAccountError')
    if (errEl) { errEl.textContent = t('auth_email_requerido'); errEl.style.display = 'block' }
    document.getElementById('obEmail')?.focus()
    return
  }
  try {
    await window.MNSupabaseAuth.resetPassword(email)
    const errEl = document.getElementById('obAccountError')
    if (errEl) { errEl.textContent = t('auth_enlace_enviado'); errEl.style.display = 'block'; errEl.style.color = '#00D4AA' }
  } catch {
    const errEl = document.getElementById('obAccountError')
    if (errEl) { errEl.textContent = t('auth_error_enviar'); errEl.style.display = 'block' }
  }
}

async function obNext() {
  // ── Validaciones por paso ──────────────────────────────────
  // Step 1: Auth validation
  if (obStep === 1) {
    const email   = (document.getElementById('obEmail')?.value || '').trim()
    const pw      = document.getElementById('obPassword')?.value || ''
    const pw2     = document.getElementById('obPassword2')?.value || ''
    const errEl   = document.getElementById('obAccountError')
    const isLogin = obData._authMode === 'login'

    const showErr = (msg, color = '#F43F5E') => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; errEl.style.color = color }
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErr('⚠ Introduce un correo electrónico válido.'); document.getElementById('obEmail')?.focus(); return
    }
    if (pw.length < 8) {
      showErr('⚠ La contraseña debe tener al menos 8 caracteres.'); document.getElementById('obPassword')?.focus(); return
    }
    if (!isLogin && pw !== pw2) {
      showErr('⚠ Las contraseñas no coinciden.'); document.getElementById('obPassword2')?.focus(); return
    }

    obData.email    = email
    obData.password = pw
    if (errEl) errEl.style.display = 'none'

    if (isLogin) {
      const btn = document.querySelector('#obContentArea .ob-next-btn')
      if (btn) { btn.disabled = true; btn.textContent = t('loading_entrando') }
      try {
        await window.MNSupabaseAuth.signIn(email, pw)
        window.MNAuth && window.MNAuth.upgradeTrial && window.MNAuth.upgradeTrial(email)
        // Login = returning user who already created an account.
        // They may not have completed onboarding on this device,
        // but they chose to log in → mark onboarding done and go to dashboard.
        _setObSeen()
        _setTutDone()
        document.getElementById('onboardingOverlay').style.display = 'none'
        _forceReleaseScrollLock()
        render()
        toast(`${t('bienvenido_de_vuelta', 'Bienvenido de vuelta')}! 👋`)
        return
      } catch (err) {
        const code = err?.code || ''
        const map = {
          invalid_credentials: '⚠ Email o contraseña incorrectos.',
          rate_limited: '⚠ Demasiados intentos. Espera unos minutos.',
        }
        showErr(map[code] || '⚠ ' + (err?.message || 'Error al iniciar sesión.'))
        if (btn) { btn.disabled = false; btn.innerHTML = 'Entrar <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline;vertical-align:middle"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' }
        return
      }
    } else {
      const btn = document.querySelector('#obContentArea .ob-next-btn')
      if (btn) { btn.disabled = true; btn.textContent = t('loading_creando_cuenta') }
      // Register in background — never block onboarding flow
      obData._registered = true
      window.MNAuth && window.MNAuth.upgradeTrial && window.MNAuth.upgradeTrial(email)
      window.MNSupabaseAuth && window.MNSupabaseAuth.signUp(email, pw).catch(() => {})
      obStep++
      obRender('forward')
      return
    }
  }

  // Step 2: Name validation
  if (obStep === 2) {
    const nombre = document.getElementById('obNombre')?.value?.trim() || ''
    if (!nombre) {
      const inp = document.getElementById('obNombre')
      if (inp) { inp.style.borderColor = '#F43F5E'; inp.focus(); inp.addEventListener('input', () => { inp.style.borderColor = '' }, { once: true }) }
      return
    }
    obData.nombre = nombre
  }

  // Step 4: Plan selector — Local/Pro opens the real payment modal
  // instead of just advancing. Trial (or no selection) continues
  // normally. If the user cancels/closes the payment modal, onboarding
  // still continues — "sin permanencia, cambia cuando quieras".
  if (obStep === 4 && (obData.plan === 'local' || obData.plan === 'pro')) {
    const priceId = obData.plan === 'pro' ? window.MNStripeConfig?.prices?.pro : window.MNStripeConfig?.prices?.local
    if (priceId && window.MNPayment) {
      const proceedToNext = () => {
        document.removeEventListener('mn:paymentModalClosed', proceedToNext)
        obStep++
        obRender('forward')
      }
      document.addEventListener('mn:paymentModalClosed', proceedToNext, { once: true })

      // Step 1's signUp() is fire-and-forget — give the session a
      // brief moment to establish if it somehow hasn't yet (steps 2-3
      // usually take long enough that this never actually waits).
      let waited = 0
      while (!window.MNSupabaseAuth?.isLoggedIn() && waited < 3000) {
        await new Promise(r => setTimeout(r, 300))
        waited += 300
      }
      if (!window.MNSupabaseAuth?.isLoggedIn()) {
        document.removeEventListener('mn:paymentModalClosed', proceedToNext)
        toast('No se pudo verificar tu cuenta todavía. Puedes elegir un plan luego desde Plan y facturación.')
        obStep++
        obRender('forward')
        return
      }
      const email = window.MNSupabaseAuth.getSession()?.user?.email || obData.email || ''
      MNPayment.open(priceId, email)
      return
    }
  }

  if (obStep === OB_TOTAL) { finishOnboarding(); return }

  obStep++
  obRender('forward')
}

function obPrev() {
  if (obStep <= 1) return
  obStep--
  obRender('back')
}


// ════════════════════════════════════════════════════════════════
// OTP VERIFICATION OVERLAY
// Shown after signup to verify email before proceeding.
// Uses Supabase built-in OTP (sent by Supabase) + Resend custom email.
// ════════════════════════════════════════════════════════════════

function _obShowOtpOverlay(email) {
  // Remove any existing overlay
  document.getElementById('obOtpOverlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'obOtpOverlay'
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(6,11,20,0.92);backdrop-filter:blur(12px);
    animation:mnFadeIn 200ms ease;
  `
  overlay.innerHTML = `
    <div style="
      background:#0D1424;border:1px solid rgba(255,255,255,0.08);border-radius:24px;
      padding:40px 36px;max-width:420px;width:calc(100% - 32px);
      box-shadow:0 32px 80px rgba(0,0,0,0.6);text-align:center;
    ">
      <!-- icon -->
      <div style="
        width:64px;height:64px;margin:0 auto 20px;border-radius:16px;
        background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);
        display:flex;align-items:center;justify-content:center;font-size:28px;
      ">📬</div>

      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:2px">Verificación de email</p>
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#F1F5F9;letter-spacing:-0.5px">Revisa tu bandeja</h2>
      <p style="margin:0 0 28px;font-size:14px;color:#64748B;line-height:1.65">
        Hemos enviado un código de 6 dígitos a<br>
        <strong style="color:#94A3B8">${email}</strong>
      </p>

      <!-- OTP input row -->
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px" id="obOtpInputs">
        ${[0,1,2,3,4,5].map(i => `
          <input id="obOtpD${i}" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1"
            autocomplete="${i===0?'one-time-code':'off'}"
            style="
              width:44px;height:56px;border-radius:12px;border:1.5px solid rgba(99,102,241,0.3);
              background:#111827;color:#A5B4FC;font-size:24px;font-weight:900;text-align:center;
              font-family:inherit;outline:none;transition:border-color 150ms;
            "
            oninput="_obOtpInput(this,${i})"
            onkeydown="_obOtpKey(event,${i})"
            onpaste="_obOtpPaste(event)">
        `).join('')}
      </div>
      <p style="margin:0 0 24px;font-size:12px;color:#475569">Caduca en <strong style="color:#94A3B8">15 minutos</strong></p>

      <div id="obOtpError" style="display:none;font-size:13px;color:#F43F5E;margin-bottom:16px;padding:10px 14px;background:rgba(244,63,94,0.08);border-radius:8px"></div>

      <button id="obOtpVerifyBtn" onclick="_obVerifyOtp()" style="
        width:100%;padding:14px;border-radius:12px;border:none;cursor:pointer;
        background:linear-gradient(135deg,#6366F1,#4F46E5);color:#fff;
        font-size:15px;font-weight:700;font-family:inherit;
        transition:opacity 150ms;
      ">Verificar código</button>

      <div style="margin-top:20px;display:flex;align-items:center;gap:8px;justify-content:center">
        <span style="font-size:13px;color:#475569">¿No llegó el email?</span>
        <button id="obOtpResendBtn" onclick="_obResendOtp()" style="
          background:none;border:none;font-size:13px;color:#00D4AA;font-weight:700;
          cursor:pointer;font-family:inherit;padding:0;
        ">Reenviar</button>
      </div>

      <div style="margin-top:12px">
        <button onclick="_obCloseOtpOverlay()" style="
          background:none;border:none;font-size:12px;color:rgba(255,255,255,0.2);
          cursor:pointer;font-family:inherit;padding:0;
        ">Volver atrás</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => document.getElementById('obOtpD0')?.focus(), 100)
}

function _obOtpInput(el, idx) {
  el.value = el.value.replace(/\D/g, '').slice(-1)
  if (el.value && idx < 5) {
    document.getElementById(`obOtpD${idx+1}`)?.focus()
  }
  // Auto-verify when all 6 digits filled
  const code = [0,1,2,3,4,5].map(i => document.getElementById(`obOtpD${i}`)?.value || '').join('')
  if (code.length === 6) setTimeout(_obVerifyOtp, 80)
}

function _obOtpKey(e, idx) {
  if (e.key === 'Backspace' && !e.target.value && idx > 0) {
    const prev = document.getElementById(`obOtpD${idx-1}`)
    if (prev) { prev.value = ''; prev.focus() }
  }
  if (e.key === 'Enter') _obVerifyOtp()
}

function _obOtpPaste(e) {
  e.preventDefault()
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0,6)
  text.split('').forEach((ch, i) => {
    const inp = document.getElementById(`obOtpD${i}`)
    if (inp) inp.value = ch
  })
  document.getElementById(`obOtpD${Math.min(text.length, 5)}`)?.focus()
  if (text.length === 6) setTimeout(_obVerifyOtp, 80)
}

async function _obVerifyOtp() {
  const code = [0,1,2,3,4,5].map(i => document.getElementById(`obOtpD${i}`)?.value || '').join('')
  if (code.length < 6) return

  const errEl = document.getElementById('obOtpError')
  const btn   = document.getElementById('obOtpVerifyBtn')
  if (btn) { btn.disabled = true; btn.textContent = t('loading_verificando') }
  if (errEl) errEl.style.display = 'none'

  // Highlight inputs while verifying
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById(`obOtpD${i}`)
    if (inp) inp.style.borderColor = 'rgba(99,102,241,0.6)'
  }

  try {
    await window.MNSupabaseAuth.verifyEmailOtp(obData.email, code)
    // OTP verified — close overlay and advance onboarding
    _obCloseOtpOverlay()
    obStep++
    obRender('forward')
  } catch (err) {
    if (errEl) {
      errEl.textContent = err?.message?.includes('expired')
        ? '⚠ El código ha caducado. Reenvía uno nuevo.'
        : '⚠ Código incorrecto. Compruébalo e inténtalo de nuevo.'
      errEl.style.display = 'block'
    }
    // Shake inputs on error
    for (let i = 0; i < 6; i++) {
      const inp = document.getElementById(`obOtpD${i}`)
      if (inp) { inp.style.borderColor = '#F43F5E'; inp.value = '' }
    }
    document.getElementById('obOtpD0')?.focus()
    if (btn) { btn.disabled = false; btn.textContent = t('btn_verificar_codigo') }
  }
}

async function _obResendOtp() {
  const email = obData.email
  const btn   = document.getElementById('obOtpResendBtn')
  if (!email || !window.MNSupabaseAuth) return
  if (btn) { btn.disabled = true; btn.textContent = t('loading_enviando') }
  try {
    await window.MNSupabaseAuth.resendVerificationEmail(email)
    if (btn) {
      btn.textContent = t('loading_enviado')
      btn.style.color = '#00D4AA'
      setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = t('btn_reenviar'); btn.style.color = '' } }, 30000)
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = t('btn_reenviar') }
    const errEl = document.getElementById('obOtpError')
    if (errEl) { errEl.textContent = '⚠ ' + (err?.message || t('auth_error_reenviar')); errEl.style.display = 'block' }
  }
}

function _obCloseOtpOverlay() {
  const overlay = document.getElementById('obOtpOverlay')
  if (overlay) {
    overlay.style.opacity = '0'
    overlay.style.transition = 'opacity 150ms'
    setTimeout(() => overlay.remove(), 150)
    window._popScrollLock && window._popScrollLock()
  }
}


// ═══════════════════════════════════════════════════════════════
// CINEMATIC INTRO
// ═══════════════════════════════════════════════════════════════
function runCinematicIntro(onComplete) {
  const intro = document.getElementById('mnIntro')
  if (!intro) { onComplete(); return }

  intro.style.display = 'flex'

  // Phase 1: fade in background (0ms)
  const bg = document.getElementById('mnIntroBg')
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (bg) bg.classList.add('visible')
    })
  })

  // Phase 2: reveal content (150ms)
  setTimeout(() => {
    const content = document.getElementById('mnIntroContent')
    if (content) content.classList.add('visible')
    const wordmark = document.getElementById('mnIntroWordmark')
    if (wordmark) wordmark.classList.add('visible')
    const tagline = document.getElementById('mnIntroTagline')
    if (tagline) tagline.classList.add('visible')
  }, 150)

  // Phase 3: trigger SVG stroke animation (250ms)
  setTimeout(() => {
    const svg = document.getElementById('mnIntroSvg')
    if (svg) svg.classList.add('animate')
  }, 250)

  // Phase 4: hold, then fade out (2100ms total)
  setTimeout(() => {
    intro.classList.add('fade-out')
    setTimeout(() => {
      intro.style.display = 'none'
      onComplete()
    }, 500)
  }, 2100)
}

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO_FLAG = 'mn7_demo_mode'
const REAL_DATA_BACKUP_KEY = 'mn7_real_data_backup'
function isDemoMode() { try { return localStorage.getItem(DEMO_FLAG) === 'true' } catch(e){ return false } }

function loadDemoData(scenario, nombreOverride) {
  try {
    // Backup del estado REAL del usuario (cuentas, ingresos, gastos,
    // etc. ya introducidos) ANTES de sobrescribirlo con los datos de
    // demo. Sin esto, si un usuario con datos propios activaba el
    // demo desde Ajustes para probarlo, esos datos se perdian de
    // forma permanente e irreversible al volver al modo real
    // (clearDemoData() reseteaba todo a un estado vacio). Solo se
    // hace backup si el usuario NO estaba ya en modo demo, para no
    // sobrescribir un backup real valido con datos de demo si por
    // cualquier motivo loadDemoData() se llamara dos veces seguidas.
    if (!isDemoMode()) {
      try { localStorage.setItem(REAL_DATA_BACKUP_KEY, JSON.stringify(S)) } catch(e){}
    }
    localStorage.setItem(DEMO_FLAG, 'true')
    if (window.MNGamification) MNGamification.checkAchievement('demo_mode')
    // Guardar el nombre real del usuario antes de entrar al modo demo
    if (S.usuario.nombre && S.usuario.nombre !== 'Demo' && S.usuario.nombre !== 'Usuario') {
      localStorage.setItem('mn_real_user_name', S.usuario.nombre)
    }
  } catch(e){}
  const hoy = new Date()
  const mes = (offset) => new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1).toISOString().slice(0,7)
  const d = (m, dia) => `${m}-${String(dia).padStart(2,'0')}`
  const jitter = (base, pct=0.07) => Math.round(base * (1 + (Math.random()-0.5)*pct*2))
  const uid2 = (prefix, n) => `${prefix}${n}`

  // Perfil único maximizado: Demo User — profesional con todo tipo de activos
  // ── CATEGORIAS ────────────────────────────────────────────────
  // 'Viajes' se usa extensamente en los gastos y presupuestos demo de
  // abajo, pero no forma parte de la lista de categorias por defecto
  // — se añade aqui, solo para la sesion de demo (S.categorias vuelve
  // a los valores por defecto al salir del demo o para un usuario
  // nuevo), para que la categoria sea coherente en selects/iconos.
  if (!S.categorias.gasto.includes('Viajes')) S.categorias.gasto.push('Viajes')

  // ── CUENTAS ──────────────────────────────────────────────────────
  S.cuentas = [
    { id:'dc1', nombre:'BBVA Cuenta Nómina',  tipo:'banco',    saldo:5840,  valorTotal:5840,  color:'#00D4AA' },
    { id:'dc2', nombre:'ING Cuenta Ahorro',   tipo:'ahorro',   saldo:22300, valorTotal:22300, color:'#6366F1' },
    { id:'dc3', nombre:'Revolut Metal',       tipo:'banco',    saldo:1240,  valorTotal:1240,  color:'#F59E0B' },
    { id:'dc4', nombre:'Coinbase Portfolio',  tipo:'cripto',   saldo:2800,  valorTotal:5200,  color:'#F43F5E' },
    { id:'dc5', nombre:'Efectivo cartera',    tipo:'efectivo', saldo:240,   valorTotal:240,   color:'#10B981' },
  ]

  // ── INGRESOS: 13 meses, múltiples fuentes ──────────────────────
  const ingresos = []
  for (let i = 0; i <= 12; i++) {
    const mi = mes(-i)
    const idx = String(i).padStart(2,'0')
    ingresos.push({ id:`di${idx}a`, concepto:'Nómina mensual — Empresa Tech SL', importe:jitter(3950 + (i<6?0:80), .015), categoria:'Salario', fecha:d(mi,'01'), cuentaId:'dc1', status:'cobrado', recurrente:true })
    if (i % 3 === 0 || i === 0)
      ingresos.push({ id:`di${idx}b`, concepto:['Proyecto UX — Startup Valencia','Consultoría digital B2B','Diseño web cliente nuevo','Auditoría SEO mensual'][i%4], importe:jitter([1400,980,1150,820][i%4], .12), categoria:'Freelance', fecha:d(mi,'12'), cuentaId:'dc3', status:'cobrado' })
    if (i % 3 === 0)
      ingresos.push({ id:`di${idx}c`, concepto:'Dividendos ETF + acciones', importe:jitter(210,.15), categoria:'Dividendos', fecha:d(mi,'20'), cuentaId:'dc2', status:'cobrado' })
    if (i === 0)  ingresos.push({ id:`di${idx}e`, concepto:'Alquiler habitación (Airbnb)', importe:520, categoria:'Alquiler', fecha:d(mi,'06'), cuentaId:'dc1', status:'pendiente' })
    if (i === 1)  ingresos.push({ id:`di${idx}f`, concepto:'Bono Q4 desempeño', importe:3200, categoria:'Bono', fecha:d(mi,'15'), cuentaId:'dc1', status:'cobrado' })
    if (i === 3)  ingresos.push({ id:`di${idx}g`, concepto:'Venta curso online Udemy', importe:680, categoria:'Freelance', fecha:d(mi,'22'), cuentaId:'dc3', status:'cobrado' })
    if (i === 5)  ingresos.push({ id:`di${idx}h`, concepto:'Reembolso Hacienda IRPF', importe:1240, categoria:'Otro', fecha:d(mi,'18'), cuentaId:'dc1', status:'cobrado' })
    if (i === 7)  ingresos.push({ id:`di${idx}i`, concepto:'Venta moto segunda mano', importe:3800, categoria:'Venta', fecha:d(mi,'08'), cuentaId:'dc1', status:'cobrado' })
    if (i === 9)  ingresos.push({ id:`di${idx}j`, concepto:'Comisiones afiliados web', importe:290, categoria:'Freelance', fecha:d(mi,'25'), cuentaId:'dc3', status:'cobrado' })
    if (i === 11) ingresos.push({ id:`di${idx}k`, concepto:'Bonus incorporación empresa', importe:5000, categoria:'Bono', fecha:d(mi,'01'), cuentaId:'dc1', status:'cobrado' })
  }
  S.ingresos = ingresos

  // ── GASTOS: 13 meses, +200 transacciones reales ────────────────
  const g = []
  const supermarkets = ['Mercadona','Lidl','Carrefour','Aldi','El Corte Inglés Supermercado']
  const cafes = ['Nespresso Boutique','Bar Colón','Café Central','Costa Coffee','Starbucks','El Fornet']
  const restaurants = ['Sal Gorda Bistró','Sushi Planet','La Pepita Brunch','Goiko Grill','Llatassis Pasta','Lateral','Compañía del Trópico']
  for (let i = 0; i <= 12; i++) {
    const mi = mes(-i)
    const p = `dg${i}_`
    g.push([`${p}01`,'Alquiler piso centro', jitter(1100,.0),'Vivienda',mi,'01','dc1',true])
    g.push([`${p}02`,'Comunidad propietarios', jitter(82,.02),'Vivienda',mi,'05','dc1',true])
    g.push([`${p}03`,'Endesa — electricidad', jitter(88,.15),'Vivienda',mi,'08','dc1',true])
    g.push([`${p}04`,'Naturgy — gas', jitter(56,.18),'Vivienda',mi,'10','dc1',true])
    g.push([`${p}05`,'Vodafone fibra+móvil', jitter(52,.02),'Vivienda',mi,'12','dc1',true])
    g.push([`${p}10`,supermarkets[i%5], jitter(98,.12),'Alimentación',mi,'03','dc1'])
    g.push([`${p}11`,supermarkets[(i+2)%5], jitter(62,.12),'Alimentación',mi,'10','dc1'])
    g.push([`${p}12`,'Mercadona compra semanal', jitter(91,.10),'Alimentación',mi,'17','dc1'])
    g.push([`${p}13`,'Frutas y verduras mercado', jitter(28,.18),'Alimentación',mi,'20','dc4'])
    g.push([`${p}14`,supermarkets[(i+1)%5], jitter(74,.10),'Alimentación',mi,'26','dc1'])
    g.push([`${p}16`,cafes[i%6], jitter(4.5,.25),'Restaurantes',mi,'02','dc4'])
    g.push([`${p}17`,'Almuerzo menú trabajo', jitter(13,.20),'Restaurantes',mi,'07','dc3'])
    g.push([`${p}18`,cafes[(i+2)%6], jitter(5.8,.25),'Restaurantes',mi,'09','dc3'])
    g.push([`${p}19`,restaurants[i%7], jitter(54,.18),'Restaurantes',mi,'14','dc1'])
    g.push([`${p}20`,cafes[(i+4)%6], jitter(3.2,.25),'Restaurantes',mi,'16','dc4'])
    g.push([`${p}21`,'Delivery Glovo', jitter(28,.20),'Restaurantes',mi,'22','dc3'])
    if (i%2===0) g.push([`${p}22`,restaurants[(i+3)%7], jitter(72,.20),'Restaurantes',mi,'27','dc1'])
    g.push([`${p}30`,'Netflix Premium', 19.99,'Suscripciones',mi,'05','dc3',true])
    g.push([`${p}31`,'Spotify Family', 16.99,'Suscripciones',mi,'05','dc3',true])
    g.push([`${p}32`,'Amazon Prime', 9.99,'Suscripciones',mi,'07','dc3',true])
    g.push([`${p}33`,'ChatGPT Plus', 21.99,'Suscripciones',mi,'10','dc3',true])
    g.push([`${p}34`,'Adobe CC All Apps', 59.99,'Suscripciones',mi,'12','dc3',true])
    g.push([`${p}36`,'iCloud+ 2TB', 3.99,'Suscripciones',mi,'01','dc3',true])
    g.push([`${p}37`,'HBO Max', 9.99,'Suscripciones',mi,'06','dc3',true])
    if (i<=3) g.push([`${p}35`,'GitHub Copilot Pro', 10,'Suscripciones',mi,'14','dc3',true])
    g.push([`${p}40`,'Repsol gasolina', jitter(78,.12),'Transporte',mi,'06','dc1'])
    g.push([`${p}41`,'Tarjeta transporte mensual', 21.20,'Transporte',mi,'01','dc1',true])
    if (i%3===0) g.push([`${p}42`,'Renfe AVE Madrid-Barcelona', jitter(62,.18),'Transporte',mi,'18','dc1'])
    if (i%4===0) g.push([`${p}44`,'Taxi aeropuerto', jitter(32,.20),'Transporte',mi,'22','dc4'])
    g.push([`${p}50`,'Adeslas seguro médico', jitter(68,.02),'Salud',mi,'02','dc1',true])
    g.push([`${p}51`,'Basic-Fit gimnasio', 29.99,'Salud',mi,'01','dc1',true])
    if (i%2===0) g.push([`${p}52`,'Farmacia', jitter(24,.22),'Salud',mi,'16','dc4'])
    if (i%3===0) g.push([`${p}53`,'Dentista revisión', jitter(85,.10),'Salud',mi,'20','dc1'])
    if (i===2) g.push([`${p}54`,'Fisioterapeuta 5 sesiones', 220,'Salud',mi,'12','dc1'])
    if (i===0) g.push([`${p}60`,'Curso React Advanced', 190,'Educación',mi,'14','dc3'])
    if (i===2) g.push([`${p}61`,'Certificación AWS', 300,'Educación',mi,'08','dc2'])
    if (i===4) g.push([`${p}62`,'Libros técnicos Amazon', jitter(58,.20),'Educación',mi,'22','dc3'])
    if (i===6) g.push([`${p}63`,'Masterclass Design Thinking', 180,'Educación',mi,'10','dc2'])
    if (i%3===1) g.push([`${p}64`,'Audible mensual', 9.99,'Educación',mi,'15','dc3',true])
    g.push([`${p}70`,'Cine Yelmo entradas x2', jitter(18,.20),'Ocio',mi,'12','dc3'])
    if (i%2===0) g.push([`${p}71`,'Entrada concierto', jitter(48,.25),'Ocio',mi,'24','dc1'])
    if (i===0)  g.push([`${p}72`,'PS5 — juego nuevo', 69,'Ocio',mi,'16','dc3'])
    if (i===3)  g.push([`${p}73`,'Nintendo Switch juego', 49,'Ocio',mi,'19','dc3'])
    if (i%4===0) g.push([`${p}74`,'Escape room amigos', jitter(28,.15),'Ocio',mi,'25','dc4'])
    if (i%2===0) g.push([`${p}80`,'Zara temporada', jitter(92,.20),'Ropa',mi,'18','dc1'])
    if (i===1)  g.push([`${p}81`,'New Balance 993', 180,'Ropa',mi,'08','dc1'])
    if (i===3)  g.push([`${p}82`,'Massimo Dutti traje', 290,'Ropa',mi,'15','dc1'])
    if (i===5)  g.push([`${p}83`,'Nike Air Max 90', 150,'Ropa',mi,'22','dc1'])
    if (i%3===0) g.push([`${p}84`,'Accesorios varios', jitter(38,.20),'Ropa',mi,'28','dc4'])
    g.push([`${p}90`,'Mapfre seguro coche', jitter(82,.02),'Seguros',mi,'03','dc1',true])
    if (i===0||i===6) g.push([`${p}91`,'Seguro hogar anual', jitter(28,.05),'Seguros',mi,'15','dc1'])
    if (i===0) g.push([`${p}95`,'Keychron Q5 teclado', 179,'Tecnología',mi,'11','dc3'])
    if (i===1) g.push([`${p}96`,'LG UltraWide 34"', 649,'Tecnología',mi,'16','dc2'])
    if (i===2) g.push([`${p}97`,'AirPods Pro 2', 279,'Tecnología',mi,'22','dc1'])
    if (i===4) g.push([`${p}98`,'iPhone 16 Pro 256GB', 1199,'Tecnología',mi,'05','dc1'])
    if (i===7) g.push([`${p}99`,'iPad Air M2', 749,'Tecnología',mi,'18','dc2'])
    if (i===9) g.push([`${p}9a`,'StandingDesk eléctrico', 390,'Tecnología',mi,'12','dc2'])
    if (i===1) { g.push([`${p}v1`,'Vuelo Madrid–Lisboa ida/vuelta', jitter(148,.15),'Viajes',mi,'10','dc1']); g.push([`${p}v2`,'Hotel Lisboa 3 noches', jitter(320,.10),'Viajes',mi,'12','dc1']); g.push([`${p}v3`,'Actividades Lisboa', jitter(80,.20),'Viajes',mi,'14','dc4']) }
    if (i===4) { g.push([`${p}v4`,'Vuelo Barcelona–París', jitter(189,.18),'Viajes',mi,'18','dc1']); g.push([`${p}v5`,'Airbnb París 4 noches', jitter(480,.12),'Viajes',mi,'19','dc1']); g.push([`${p}v6`,'Eurostar Londres', jitter(95,.10),'Viajes',mi,'22','dc3']) }
    if (i===8) { g.push([`${p}v7`,'Vuelo a Tokio', jitter(680,.15),'Viajes',mi,'05','dc2']); g.push([`${p}v8`,'Hotel Tokio 7 noches', jitter(1100,.10),'Viajes',mi,'06','dc2']); g.push([`${p}v9`,'JR Pass ferroviario', jitter(420,.05),'Viajes',mi,'07','dc2']) }
  }
  S.gastos = g.map(([id,concepto,importe,categoria,mes2,dia,cuentaId,recurrente]) => ({
    id, concepto, importe, categoria,
    fecha: `${mes2}-${String(dia).padStart(2,'0')}`,
    cuentaId, recurrente: !!recurrente, _demo: true
  }))

  // ── INVERSIONES ───────────────────────────────────────────────
  S.inversiones = [
    { id:'dinv1',  nombre:'Vanguard FTSE All-World ETF',    importe:12000, rentabilidad:16.4, categoria:'ETF',           fecha:d(mes(-8),'10'),  cuentaId:'dc2', cerrada:false },
    { id:'dinv2',  nombre:'iShares S&P 500 UCITS',           importe:8500,  rentabilidad:18.2, categoria:'Fondo indexado', fecha:d(mes(-7),'15'),  cuentaId:'dc2', cerrada:false },
    { id:'dinv3',  nombre:'Acciones Microsoft (MSFT)',        importe:4200,  rentabilidad:22.1, categoria:'Acciones',      fecha:d(mes(-5),'20'),  cuentaId:'dc2', cerrada:false },
    { id:'dinv4',  nombre:'Bitcoin (BTC)',                    importe:3000,  rentabilidad:45.2, categoria:'Cripto',        fecha:d(mes(-3),'08'),  cuentaId:'dc4', cerrada:false },
    { id:'dinv5',  nombre:'Ethereum (ETH)',                   importe:1800,  rentabilidad:28.6, categoria:'Cripto',        fecha:d(mes(-2),'18'),  cuentaId:'dc4', cerrada:false },
    { id:'dinv6',  nombre:'AMUNDI Bonos Tesoro EU',           importe:5000,  rentabilidad:4.1,  categoria:'Bonos',         fecha:d(mes(-6),'01'),  cuentaId:'dc2', cerrada:false },
    { id:'dinv7',  nombre:'Acciones Inditex (ITX)',           importe:2800,  rentabilidad:11.8, categoria:'Acciones',      fecha:d(mes(-4),'05'),  cuentaId:'dc2', cerrada:false },
    { id:'dinv8',  nombre:'Pimco Income Fund',               importe:3500,  rentabilidad:5.6,  categoria:'Fondo indexado', fecha:d(mes(-9),'12'),  cuentaId:'dc2', cerrada:false },
    { id:'dinv9',  nombre:'Tesla TSLA (vendida)',             importe:2200,  rentabilidad:0, categoria:'Acciones', fecha:d(mes(-10),'12'), cuentaId:'dc2', cerrada:true, ganancia:880,   roiReal:40,  fechaCierre:d(mes(-4),'15'), valorSalida:3080 },
    { id:'dinv10', nombre:'Solana (vendida)',                 importe:800,   rentabilidad:0, categoria:'Cripto',   fecha:d(mes(-9),'20'),  cuentaId:'dc4', cerrada:true, ganancia:-280,  roiReal:-35, fechaCierre:d(mes(-5),'10'), valorSalida:520  },
    { id:'dinv11', nombre:'Vanguard LifeStrategy 80 (liquidado)', importe:6000, rentabilidad:0, categoria:'ETF',  fecha:d(mes(-12),'05'), cuentaId:'dc2', cerrada:true, ganancia:1560,  roiReal:26,  fechaCierre:d(mes(-3),'20'), valorSalida:7560 },
    { id:'dinv12', nombre:'Acciones BBVA (vendidas)',         importe:1400,  rentabilidad:0, categoria:'Acciones', fecha:d(mes(-8),'14'),  cuentaId:'dc2', cerrada:true, ganancia:196,   roiReal:14,  fechaCierre:d(mes(-2),'08'), valorSalida:1596 },
  ]

  // ── DEUDAS ────────────────────────────────────────────────────
  S.deudas = [
    { id:'dd1', nombre:'Hipoteca — Piso Madrid 75m²', importeTotal:188000, importePagado:42000, interes:2.65, categoria:'Hipoteca',         vencimiento:'2052-06-01', pagos:[] },
    { id:'dd2', nombre:'Préstamo coche — Seat León',   importeTotal:18000,  importePagado:11200, interes:4.9,  categoria:'Préstamo personal', vencimiento:'2026-12-01', pagos:[] },
    { id:'dd3', nombre:'Tarjeta Visa Oro BBVA',        importeTotal:3200,   importePagado:1400,  interes:22,   categoria:'Tarjeta crédito',   vencimiento:'2025-12-01', pagos:[] },
    { id:'dd4', nombre:'Préstamo estudios máster',     importeTotal:10000,  importePagado:6500,  interes:3.1,  categoria:'Préstamo personal', vencimiento:'2027-09-01', pagos:[] },
    { id:'dd5', nombre:'Préstamo personal amigo',      importeTotal:2000,   importePagado:2000,  interes:0,    categoria:'Préstamo personal', pagos:[] },
    { id:'dd6', nombre:'Tarjeta crédito antigua',      importeTotal:1500,   importePagado:1500,  interes:0,    categoria:'Tarjeta crédito',   pagos:[] },
  ]

  // ── OBJETIVOS ─────────────────────────────────────────────────
  S.objetivos = [
    { id:'do1', nombre:'Fondo emergencia 12 meses', objetivo:48000, actual:22300, categoria:'Emergencia', color:'#00D4AA', emoji:'🛡️', fechaObjetivo:'2027-12-01',
      aportaciones:[{importe:2000,fecha:d(mes(-5),'01')},{importe:1800,fecha:d(mes(-4),'01')},{importe:2200,fecha:d(mes(-3),'01')},{importe:1900,fecha:d(mes(-2),'01')},{importe:2100,fecha:d(mes(-1),'01')}] },
    { id:'do2', nombre:'Viaje Japón + Corea del Sur', objetivo:8500, actual:4200, categoria:'Viaje', color:'#6366F1', emoji:'✈️', fechaObjetivo:'2026-10-01',
      aportaciones:[{importe:800,fecha:d(mes(-4),'15')},{importe:900,fecha:d(mes(-3),'15')},{importe:850,fecha:d(mes(-2),'15')},{importe:800,fecha:d(mes(-1),'15')}] },
    { id:'do3', nombre:'Tesla Model Y 2026', objetivo:65000, actual:18000, categoria:'Coche', color:'#F43F5E', emoji:'🚗', fechaObjetivo:'2028-09-01',
      aportaciones:[{importe:3000,fecha:d(mes(-6),'01')},{importe:3000,fecha:d(mes(-5),'01')},{importe:3000,fecha:d(mes(-4),'01')},{importe:3000,fecha:d(mes(-3),'01')},{importe:3000,fecha:d(mes(-2),'01')},{importe:3000,fecha:d(mes(-1),'01')}] },
    { id:'do4', nombre:'Inversión inicial vivienda', objetivo:60000, actual:38000, categoria:'Casa', color:'#8B5CF6', emoji:'🏠', fechaObjetivo:'2027-06-01',
      aportaciones:[{importe:4000,fecha:d(mes(-5),'01')},{importe:4000,fecha:d(mes(-4),'01')},{importe:3500,fecha:d(mes(-3),'01')},{importe:3500,fecha:d(mes(-2),'01')},{importe:4000,fecha:d(mes(-1),'01')}] },
    { id:'do5', nombre:'MacBook Pro M4 Max', objetivo:4200, actual:4200, categoria:'Tecnología', color:'#F59E0B', emoji:'💻', fechaObjetivo:'2026-03-01',
      aportaciones:[{importe:1400,fecha:d(mes(-3),'10')},{importe:1400,fecha:d(mes(-2),'10')},{importe:1400,fecha:d(mes(-1),'10')}] },
    { id:'do6', nombre:'Colchón inicial 3 meses', objetivo:12000, actual:12000, categoria:'Emergencia', color:'#10B981', emoji:'🏦', fechaObjetivo:d(mes(-8),'01'),
      aportaciones:[{importe:4000,fecha:d(mes(-11),'01')},{importe:4000,fecha:d(mes(-10),'01')},{importe:4000,fecha:d(mes(-9),'01')}] },
    { id:'do7', nombre:'Vacaciones Lisboa + Oporto', objetivo:2200, actual:2200, categoria:'Viaje', color:'#EC4899', emoji:'🗺️', fechaObjetivo:d(mes(-4),'01'),
      aportaciones:[{importe:750,fecha:d(mes(-7),'01')},{importe:750,fecha:d(mes(-6),'01')},{importe:700,fecha:d(mes(-5),'01')}] },
    { id:'do8', nombre:'Setup escritorio gaming', objetivo:2800, actual:2800, categoria:'Tecnología', color:'#38BDF8', emoji:'🖥️', fechaObjetivo:d(mes(-10),'01'),
      aportaciones:[{importe:950,fecha:d(mes(-13),'01')},{importe:950,fecha:d(mes(-12),'01')},{importe:900,fecha:d(mes(-11),'01')}] },
  ]

  // ── PRESUPUESTOS ──────────────────────────────────────────────
  S.presupuestos = { 'Alimentación':380,'Transporte':140,'Restaurantes':180,'Ocio':130,'Suscripciones':160,'Ropa':180,'Salud':150,'Tecnología':250,'Seguros':120,'Viajes':400 }
  S.presupuestosV2 = {
    'Alimentación':  { limite:380,  tipo:'monthly' },
    'Transporte':    { limite:140,  tipo:'monthly' },
    'Restaurantes':  { limite:180,  tipo:'monthly' },
    'Ocio':          { limite:130,  tipo:'monthly' },
    'Suscripciones': { limite:160,  tipo:'monthly' },
    'Ropa':          { limite:600,  tipo:'quarterly' },
    'Salud':         { limite:150,  tipo:'monthly' },
    'Tecnología':    { limite:2400, tipo:'annual' },
    'Seguros':       { limite:120,  tipo:'monthly' },
    'Viajes':        { limite:3600, tipo:'annual' },
  }

  // ── ACTIVOS ───────────────────────────────────────────────────
  S.assets = [
    { id:'da1', nombre:'Piso Madrid 60% propiedad', tipo:'property',   valor:198000, valorCompra:172000, fecha:d(mes(-42),'01'), status:'active', notas:'Hipoteca activa desde 2021.' },
    { id:'da2', nombre:'Seat León ST 2022',         tipo:'vehicle',    valor:22000,  valorCompra:30500,  fecha:d(mes(-24),'15'), status:'active', depreciacion:true, depPct:10 },
    { id:'da3', nombre:'MacBook Pro M3 Max 16"',    tipo:'electronics',valor:2900,   valorCompra:3400,   fecha:d(mes(-10),'10'), status:'active', depreciacion:true, depPct:22 },
    { id:'da4', nombre:'Cartera NFT Blue Chip',     tipo:'other',      valor:1800,   valorCompra:3200,   fecha:d(mes(-18),'05'), status:'active' },
    { id:'da5', nombre:'Moto Honda CB650R vendida', tipo:'vehicle',    valor:6200,   valorCompra:8500,   fecha:d(mes(-36),'01'), status:'sold', fechaVenta:d(mes(-7),'08'), valorVenta:6200 },
  ]

  // ── PATRIMONIO HISTÓRICO — 13 meses con tendencia alcista ─────
  S.patrimonio_hist = []
  const basePatr = 42000
  for (let i = 12; i >= 0; i--) {
    const dt   = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1)
    const mesi = dt.toISOString().slice(0,7)
    const trend = (12 - i) * 1450
    const seasonal = Math.sin((12-i) * 0.5) * 800
    const noise = Math.round(Math.random() * 600 - 200)
    S.patrimonio_hist.push({ mes: mesi, valor: Math.round(basePatr + trend + seasonal + noise) })
  }

  // Ensure current month patrimonio is recorded
  try { recordPatrimonio() } catch(e) {}
}

function clearDemoData() {
  try { localStorage.removeItem(DEMO_FLAG) } catch(e){}
  const theme  = S.theme

  // Si el usuario ya tenia datos reales propios antes de activar el
  // demo, restaurarlos intactos en vez de perderlos. Solo si NUNCA
  // hubo datos reales (backup inexistente) se cae al comportamiento
  // anterior: estado vacio + nombre recuperado por separado.
  let backupState = null
  try {
    const backup = localStorage.getItem(REAL_DATA_BACKUP_KEY)
    if (backup) backupState = JSON.parse(backup)
    localStorage.removeItem(REAL_DATA_BACKUP_KEY)
  } catch(e){}

  if (backupState) {
    S = backupState
    S.theme = theme
    save()
    ;['demo-mode-chip','demoFab','demoFabReal','demoPanelModal'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.remove()
    })
    render()
    setTimeout(_renderDemoFab, 300)
    toast(t('toast_modo_real','✅ Modo real activado — app lista para tus datos'))
    return
  }

  // Recuperar el nombre real guardado antes de entrar al modo demo
  let realName = 'Usuario'
  try {
    const savedName = localStorage.getItem('mn_real_user_name')
    if (savedName) {
      realName = savedName
      localStorage.removeItem('mn_real_user_name')
    }
  } catch(e){}

  S = defaultState()
  S.usuario.nombre = realName
  S.theme = theme
  save()
  // Remove all demo UI elements
  ;['demo-mode-chip','demoFab','demoFabReal','demoPanelModal'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.remove()
  })
  render()
  // Show the "real mode" subtle FAB
  setTimeout(_renderDemoFab, 300)
  toast(t('toast_modo_real','✅ Modo real activado — app lista para tus datos'))
}

function showDemoChip() { _renderDemoFab() }  // Alias kept for compatibility

// ─── DEMO FAB & PANEL ──────────────────────────────────────────
let _demoPanelOpen = false

let _renderDemoFabPending = false
function _renderDemoFab() {
  // Debounce: if called multiple times in the same tick, only run once
  if (_renderDemoFabPending) return
  _renderDemoFabPending = true
  setTimeout(() => { _renderDemoFabPending = false }, 50)

  // Remove any existing FABs or chips — semicolon needed to avoid ASI issue with leading [
  ;['demo-mode-chip','demoFab','demoFabReal','demoPanelModal'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.remove()
  })
  // 2. MODO DEMO: Only render FAB when in demo mode
  if (isDemoMode()) {
    // Gold FAB when demo is active
    const fab = document.createElement('button')
    fab.id = 'demoFab'
    fab.innerHTML = `<span class="fab-dot"></span><span class="fab-label">Modo demo<span class="fab-sub">Datos de ejemplo activos</span></span>`
    fab.title = 'Gestionar modo demo'
    fab.onclick = toggleDemoPanel
    document.body.appendChild(fab)

    // Build panel — simple: solo modo real + configuración
    const panel = document.createElement('div')
    panel.id = 'demoPanelModal'
    panel.innerHTML = _buildDemoPanel()
    document.body.appendChild(panel)
    panel.style.cssText += 'min-width:220px;max-width:260px;'

    // Close on outside click
    document.addEventListener('pointerdown', _demoOutsideClick, { capture: true })
  }
}

function _demoOutsideClick(e) {
  const panel = document.getElementById('demoPanelModal')
  const fab   = document.getElementById('demoFab') || document.getElementById('demoFabReal')
  if (!panel || !panel.classList.contains('open')) return
  if (panel.contains(e.target) || (fab && fab.contains(e.target))) return
  panel.classList.remove('open')
  _demoPanelOpen = false
}

function toggleDemoPanel() {
  const panel = document.getElementById('demoPanelModal')
  if (!panel) return
  _demoPanelOpen = !panel.classList.contains('open')
  panel.classList.toggle('open', _demoPanelOpen)
}

function _buildDemoPanel() {
  return `
    <div class="dpm-title">🟡 ${t('demo_label','Modo demo')}</div>
    <div class="dpm-sub" style="font-size:.78rem;color:var(--text2);margin:6px 0 12px;line-height:1.5">
      ${t('demo_sublabel','Datos de ejemplo activos')}
    </div>
    <div class="dpm-actions" style="display:flex;flex-direction:column;gap:8px">
      <button class="dpm-btn-danger" onclick="toggleDemoPanel();confirmar(t('confirm_salir_demo'),()=>{clearDemoData()},{titulo:t('confirm_salir_demo_titulo'),icono:'🏁',btnLabel:t('confirm_salir_demo_btn')})">
        🏁 ${t('cfg_demo_salir','Ir al modo real')}
      </button>
      <button class="dpm-btn-ghost" onclick="goTo('configuracion');toggleDemoPanel()">
        ⚙️ ${t('ver_configuracion','Ver en Configuración')}
      </button>
    </div>`
}


function activateDemoWithConfig() {
  loadDemoData('standard', null)
  save()
  // Mostrar todos los datos del demo (no solo el mes actual)
  if (typeof window._gTimePeriod !== 'undefined') window._gTimePeriod = 'all'
  if (typeof window._ingMesFilter !== 'undefined') window._ingMesFilter = ''
  if (typeof window._gasMesFilter !== 'undefined') window._gasMesFilter = ''
  // Ir al dashboard para que el usuario vea todo
  if (typeof goTo === 'function') goTo('dashboard')
  else render()
  _renderDemoFab()
  toast(t('toast_modo_demo','✅ Modo demo activado — explora sin límites'))
}


function finishOnboarding() {
  if (obData.nombre) S.usuario.nombre = obData.nombre
  S.usuario.mode = 'personal'

  if (obData.theme) {
    let resolved = obData.theme
    if (resolved === 'auto') resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    S.theme = resolved
  }

  if (obData.lang) { _currentLang = obData.lang; try { localStorage.setItem(LANG_STORAGE_KEY, obData.lang) } catch(e){} }
  _setObSeen()
  document.getElementById('onboardingOverlay').style.display = 'none'
  _forceReleaseScrollLock()
  applyTheme()
  updateModeUI()

  if (obData.loadDemo) {
    loadDemoData('standard', obData.nombre || 'Demo')
    _setTutDone()
    save()
    render()
    toast(t('toast_demo_cargados','Datos de ejemplo cargados — explora libremente'))
    _renderDemoFab()
    // Register in background after demo loaded
    _obRegisterSupabase()
    return
  }

  save()
  render()

  // ── Registro en Supabase con el email/password del onboarding ──
  _obRegisterSupabase()

  if (obData.startTutorial === true) {
    setTimeout(() => startTutorial(), 400)
  } else {
    _setTutDone()
    toast(`${t('hola')} ${S.usuario.nombre || 'Usuario'}! 🎉`)
  }

  // Modal de instalación PWA — aparece 15 segundos después de terminar el onboarding
  setTimeout(() => {
    if (window.MNInstall && typeof window.MNInstall.showOnboardingModal === 'function') {
      window.MNInstall.showOnboardingModal()
    }
  }, 15000)
}

window._openStripePortal = async function() {
  const btn = event?.target
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Abriendo...' }
  try {
    let token = ''
    try {
      if (window.MNSupabaseAuth?.getSession) {
        const session = await window.MNSupabaseAuth.getSession()
        token = session?.access_token || ''
      }
    } catch(_) {}

    const res = await fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({})
    })
    const data = await res.json()
    if (res.ok && data.url) {
      window.open(data.url, '_blank')
      return
    }
    if (data.error === 'no_customer') {
      toast('Aún no tienes ningún pago registrado con este email', 'info')
    } else if (data.error === 'unauthorized') {
      toast('Inicia sesión con el email de tu compra para gestionar tu facturación', 'info')
    } else {
      throw new Error(data.error || 'unknown')
    }
  } catch(e) {
    console.warn('[Billing] Portal error:', e)
    toast('No se pudo abrir el panel de facturación. Inténtalo más tarde.', 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💳 Gestionar facturación en Stripe' }
  }
}

async function _openStripeCustomerPortal(btn) {
  if (!window.MNSupabaseAuth || !window.MNSupabaseAuth.isLoggedIn()) {
    if (typeof toast === 'function') toast(_aut('cfg_portal_necesita_sesion', 'Inicia sesión o usa "Restaurar acceso" primero.'), 'warning')
    return
  }
  const originalLabel = btn ? btn.textContent : null
  if (btn) { btn.disabled = true; btn.textContent = '⏳ ' + _aut('cfg_abriendo', 'Abriendo…') }
  try {
    const token = window.MNSupabaseAuth.getSession()?.access_token
    const res = await fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      if (data.error === 'no_customer') {
        _showManagePlanPlaceholder()
      } else {
        if (typeof toast === 'function') toast(_aut('cfg_portal_error', 'No se pudo abrir la gestión de facturación. Inténtalo de nuevo.'), 'error')
      }
      return
    }
    location.href = data.url
  } catch (err) {
    console.error('[_openStripeCustomerPortal] error:', err)
    if (typeof toast === 'function') toast(_aut('cfg_portal_error', 'No se pudo abrir la gestión de facturación. Inténtalo de nuevo.'), 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalLabel }
  }
}

async function _loadRealSubscriptionStatus() {
  const el = document.getElementById('mn-sub-status-info')
  if (!el) return
  if (!window.MNSupabaseAuth || !window.MNSupabaseAuth.isLoggedIn()) {
    el.textContent = _aut('cfg_sin_sesion_vinculada', 'Aún no tienes una sesión vinculada a este plan en este dispositivo.')
    return
  }
  try {
    const sb = window.MNSupabaseAuth._sb
    const userId = window.MNSupabaseAuth.getUserId()
    const { data, error } = await sb
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!document.getElementById('mn-sub-status-info')) return // page changed while awaiting
    if (error || !data) {
      el.textContent = _aut('cfg_sin_suscripcion_stripe', 'No se encontró ninguna suscripción de Stripe asociada todavía.')
      return
    }
    const dateStr = data.current_period_end ? fmtDate(data.current_period_end.slice(0, 10)) : '—'
    if (data.status === 'past_due') {
      el.innerHTML = `<span style="color:var(--red);font-weight:700">⚠️ ${_aut('cfg_pago_fallido', 'Hubo un problema con tu último pago. Actualiza tu método de pago para no perder el acceso.')}</span>`
    } else if (data.cancel_at_period_end) {
      el.textContent = `⏳ ${_aut('cfg_finaliza_el', 'Tu plan finaliza el')} ${dateStr} ${_aut('cfg_no_se_renovara', '(no se renovará automáticamente)')}`
    } else if (data.status === 'active' || data.status === 'trialing') {
      el.textContent = `🔄 ${_aut('cfg_se_renueva_el', 'Se renueva automáticamente el')} ${dateStr}`
    } else {
      el.textContent = `${_aut('cfg_estado_lbl', 'Estado')}: ${data.status}`
    }
  } catch (err) {
    console.warn('[_loadRealSubscriptionStatus] error:', err)
    el.textContent = _aut('cfg_sin_suscripcion_stripe', 'No se encontró ninguna suscripción de Stripe asociada todavía.')
  }
}

function _showManagePlanPlaceholder() {
  document.getElementById('mn-manage-plan-placeholder')?.remove()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'mn-manage-plan-placeholder'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-header">
        <span class="modal-title">☁️ ${_aut('cfg_btn_gestionar_plan','Gestionar plan')}</span>
        <button class="modal-close" onclick="document.getElementById('mn-manage-plan-placeholder').remove(); window._popScrollLock&&window._popScrollLock()">✕</button>
      </div>
      <div class="modal-body" style="text-align:center;padding:10px 4px 20px">
        <div style="font-size:2rem;margin-bottom:10px">🔧</div>
        <div style="font-size:.88rem;color:var(--text2);line-height:1.6">${_aut('cfg_gestionar_plan_placeholder','La gestión completa de tu suscripción (cambiar método de pago, ver recibos, cancelar) estará disponible en cuanto conectemos el sistema de facturación.')}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary btn-sm" style="width:100%" onclick="document.getElementById('mn-manage-plan-placeholder').remove(); window._popScrollLock&&window._popScrollLock()">${_aut('btn_entendido','Entendido')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); if (window._popScrollLock) window._popScrollLock() } })
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => overlay.classList.add('open'), 10)
}

function _showPaymentPrompt(email) {
  const priceId = window.MNStripeConfig?.prices?.local
  if (!priceId || !window.MNPayment) return

  const overlay = document.createElement('div')
  overlay.id = 'mn-payment-prompt'
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .3s ease'
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:24px;width:min(420px,100%);padding:32px 28px;font-family:inherit;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.4)">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:2.5rem;margin-bottom:10px">🎉</div>
        <div style="font-size:1.25rem;font-weight:800;color:var(--text);margin-bottom:6px">Todo listo, ${S.usuario.nombre || 'hola'}!</div>
        <div style="font-size:.87rem;color:var(--text2);line-height:1.6">MoneyNest es tuyo de por vida por un único pago. Sin suscripciones, sin sorpresas.</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:20px 22px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-size:1rem;font-weight:700;color:var(--text)">MoneyNest</div>
            <div style="font-size:.75rem;color:var(--text2)">Pago único · Tuyo para siempre</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.6rem;font-weight:900;color:var(--accent)">6,99€</div>
            <div style="font-size:.68rem;color:var(--text3)">IVA incluido</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${["Acceso ilimitado a todas las funciones","Datos almacenados localmente","Sin suscripción mensual","Actualizaciones incluidas"].map(f =>
            `<div style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--text2)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              ${f}</div>`
          ).join("")}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="window._startStripeCheckout('local')" style="width:100%;padding:14px;border-radius:12px;border:none;background:var(--accent);color:#042b20;font-size:.95rem;font-weight:800;cursor:pointer;font-family:inherit">
          🔓 Comprar MoneyNest — 6,99€
        </button>
        <button onclick="document.getElementById('mn-payment-prompt').remove();window._popScrollLock&&window._popScrollLock()" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:.8rem;cursor:pointer;font-family:inherit">
          Ahora no — recordar más tarde
        </button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  // Clicking outside must release the SAME scroll-lock push this overlay
  // made when it opened — previously it only removed the element,
  // leaving the shared scroll-lock counter permanently off by one and
  // the background scroll stuck after closing (root cause of the
  // reported bug).
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); if (typeof window._popScrollLock === 'function') window._popScrollLock() } })

  window._startStripeCheckout = function(type) {
    const pid = window.MNStripeConfig?.prices?.[type === 'bundle' ? 'pro' : 'local'] || priceId
    overlay.remove()
    // Release THIS overlay's own scroll-lock push before MNPayment.open()
    // makes its own — otherwise the counter ends up one push ahead with
    // no matching pop, so closing the payment modal afterward never
    // fully releases the scroll lock.
    if (typeof window._popScrollLock === 'function') window._popScrollLock()
    if (window.MNPayment) MNPayment.open(pid, email)
  }
}


async function _obRegisterSupabase() {
  // Account was already created during OTP verification (obNext step 1).
  // Just sync the auth badge and send welcome email.
  if (!obData.email) return
  if (window.MNEmail && obData._registered && !obData._welcomeSent) {
    obData._welcomeSent = true
    MNEmail.sendWelcome(obData.email, obData.nombre || '')
  }
  if (window.MNAuthUI) {
    window.MNAuthUI.renderAuthBadge('authPlanBadge')
    window.MNAuthUI.renderTrialPill('trialPillContainer')
  }
}

function skipOnboarding() {
  _setObSeen()
  _setTutDone()
  document.getElementById('onboardingOverlay').style.display = 'none'
  _forceReleaseScrollLock()
  render()
  _updateSidebarLang()
  toast(t('page_configuracion') + ' — ⚙️')
}

// ─── ONBOARDING FLAGS (persistent, never fail silently) ────────
// v2 suffix forces all existing users to see onboarding once more
// (old 'mn7_ob_seen' flag is ignored — only 'mn7_ob_seen_v2' counts)
const OB_FLAG_KEY  = 'mn7_ob_seen_v2'
const TUT_FLAG_KEY = 'mn7_tut_done'

function _obFlagSeen()  { return localStorage.getItem(OB_FLAG_KEY)  === 'true' }
function _tutFlagDone() { return localStorage.getItem(TUT_FLAG_KEY) === 'true' }
function _setObSeen()   { try { localStorage.setItem(OB_FLAG_KEY,  'true') } catch(e){} }
function _setTutDone()  { try { localStorage.setItem(TUT_FLAG_KEY, 'true') } catch(e){} }

function checkOnboarding() {
  const flagValue = localStorage.getItem(OB_FLAG_KEY)
  console.log('[checkOnboarding] Flag value:', flagValue)

  if (_obFlagSeen()) {
    console.log('[checkOnboarding] Onboarding already completed - skipping')
    return
  }

  console.log('[checkOnboarding] Starting onboarding flow...')
  obStep = 1
  obData = { nombre:'', email:'', password:'', mode:'personal', lang: _currentLang || 'es', theme: S?.theme || 'dark', startTutorial:false, loadDemo:false }

  // FIX: Show onboarding IMMEDIATELY without cinematic intro
  obRender()
  const ov = document.getElementById('onboardingOverlay')
  if (ov) {
    ov.style.display = 'flex'
    requestAnimationFrame(() => ov.classList.add('ob-visible'))
    _pushScrollLock()
    console.log('[checkOnboarding] Onboarding overlay displayed')
  } else {
    console.error('[checkOnboarding] Onboarding overlay element not found!')
  }
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: TUTORIAL INTERACTIVO ────────────────────────────
// Tutorial uses MOCK data — never touches real S state
// ════════════════════════════════════════════════════════════════
let tutStep = 0
let _tutMockActive = false

// ── Inject / remove mock data ──────────────────────────────────
function _tutInjectMock() {
  if (_tutMockActive) return
  _tutMockActive = true
  const today = todayISO()
  const cuentaId = S.cuentas[0]?.id || 'c1'

  // Fake income
  S.ingresos.unshift({
    id: '__tut_ing__', concepto: '💼 Salario (demo)', importe: 2500,
    categoria: 'Salario', fecha: today, cuentaId, _tutorial: true
  })
  // Update account saldo temporarily
  const cuenta = getCuenta(cuentaId)
  if (cuenta) cuenta._tutSaldoOrig = cuenta.saldo
  if (cuenta) cuenta.saldo = (Number(cuenta.saldo)||0) + 2500

  // Fake investment
  S.inversiones.unshift({
    id: '__tut_inv__', nombre: '📈 Fondo indexado S&P500 (demo)',
    importe: 500, categoria: 'Fondo indexado', rentabilidad: 8,
    fecha: today, cuentaId, cerrada: false, _tutorial: true
  })
  if (cuenta) cuenta.saldo = Math.max(0, (Number(cuenta.saldo)||0) - 500)

  // Fake physical asset
  if (!S.assets) S.assets = []
  S.assets.unshift({
    id: '__tut_asset__', nombre: '🚗 Audi A3 (demo)', tipo: 'vehicle',
    valorCompra: 22000, valor: 18000, fecha: todayISO(), status: 'active',
    depreciacion: false, depPct: 0, notas: 'Demo tutorial', _tutorial: true
  })

  save()
}

function _tutClearMock() {
  if (!_tutMockActive) return
  _tutMockActive = false
  S.ingresos = S.ingresos.filter(i => !i._tutorial)
  S.gastos   = S.gastos.filter(g => !g._tutorial)
  S.inversiones = S.inversiones.filter(i => !i._tutorial)
  S.assets   = (S.assets||[]).filter(a => !a._tutorial)
  // Restore account saldo
  S.cuentas.forEach(c => {
    if (c._tutSaldoOrig !== undefined) {
      c.saldo = c._tutSaldoOrig
      delete c._tutSaldoOrig
    }
  })
  save()
}

// ── Tutorial steps ─────────────────────────────────────────────
const TUT_STEPS = [
  { title: 'Bienvenido al tour 👋',
    text: 'Tour rápido con datos de demo. Tus datos reales no se tocarán.',
    target: null, page: 'dashboard' },
  { title: 'Patrimonio neto',
    text: 'Tu riqueza real: liquidez + inversiones + activos físicos − deudas.',
    target: '.patrimonio-hero', page: 'dashboard' },
  { title: 'KPIs del mes',
    text: 'Ingresos, gastos y cash flow. El porcentaje compara con el mes anterior.',
    target: '.kpi-grid', page: 'dashboard' },
  { title: 'Ingresos',
    text: 'Registra tus entradas. Demo: salario de 2.500 € ya añadido.',
    target: '#nav-ingresos', page: 'ingresos' },
  { title: 'Gastos',
    text: 'Registra y categoriza tus salidas. Usa presupuestos para controlar límites.',
    target: '#nav-gastos', page: 'gastos' },
  { title: 'Inversiones',
    text: 'Sigue tu cartera. Pulsa Liquidar para cerrar posiciones con ganancia/pérdida.',
    target: '#nav-inversiones', page: 'inversiones' },
  { title: 'Deudas',
    text: 'Gestiona préstamos con 3 estrategias: Conservador, Moderado o Agresivo.',
    target: '#nav-deudas', page: 'deudas' },
  { title: 'Objetivos',
    text: 'Define metas financieras. MoneyNest calcula cuándo las alcanzarás.',
    target: '#nav-objetivos', page: 'objetivos' },
  { title: 'Análisis avanzado',
    text: 'Burn rate, regla 50/30/20, fondo de emergencia y predicciones.',
    target: '#nav-analisis', page: 'analisis' },
  { title: '¡Listo! 🎉',
    text: 'Demo eliminada. Añade tus cuentas reales y empieza a registrar.',
    target: null, page: 'dashboard' }
]

function startTutorial() {
  tutStep = 0
  _tutInjectMock()
  destroyAllCharts()
  renderDashboard()
  currentPage = 'dashboard'
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'))
  const nav = document.getElementById('nav-dashboard')
  if (nav) nav.classList.add('active')
  document.getElementById('tutorialOverlay').style.display = 'block'
  renderTutStep()
}

function renderTutStep() {
  const step    = TUT_STEPS[tutStep]
  const overlay = document.getElementById('tutorialOverlay')
  const hl      = document.getElementById('tutHighlight')
  const tooltip = document.getElementById('tutTooltip')
  if (!overlay || !step) return

  // Navigate to step page
  const pageFns = {
    dashboard:renderDashboard, ingresos:renderIngresos, gastos:renderGastos,
    inversiones:renderInversiones, deudas:renderDeudas, cuentas:renderCuentas,
    objetivos:renderObjetivos, presupuestos:renderPresupuestos,
    analisis:renderAnalisis, configuracion:renderConfiguracion,
    patrimonio:renderPatrimonio, // billing removed logros:renderLogros
  }
  if (step.page && step.page !== currentPage) {
    currentPage = step.page
    destroyAllCharts()
    if (pageFns[step.page]) pageFns[step.page]()
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'))
    const nav = document.getElementById('nav-'+step.page)
    if (nav) nav.classList.add('active')
    const contentEl = document.getElementById('content')
    if (contentEl) contentEl.scrollTop = 0
  }

  // Update tooltip text
  const gi = (id) => document.getElementById(id)
  if (gi('tutTitle'))   gi('tutTitle').textContent   = step.title
  if (gi('tutText'))    gi('tutText').innerHTML      = step.text
  if (gi('tutStepNum')) gi('tutStepNum').textContent = `Paso ${tutStep+1} de ${TUT_STEPS.length}`
  if (gi('tutCounter')) gi('tutCounter').textContent = `${tutStep+1}/${TUT_STEPS.length}`
  const dotsEl = gi('tutDots')
  if (dotsEl) dotsEl.innerHTML = TUT_STEPS.map((_,i)=>`<div class="tut-dot${i===tutStep?' active':''}"></div>`).join('')
  if (gi('tutNextBtn')) gi('tutNextBtn').textContent = tutStep === TUT_STEPS.length-1 ? 'Finalizar ✓' : 'Siguiente →'
  if (gi('tutBack'))    gi('tutBack').style.display  = tutStep > 0 ? 'inline-flex' : 'none'

  // Animate in
  tooltip.style.opacity = '0'
  tooltip.style.transform = 'translateY(4px)'
  tooltip.style.display = 'block'
  tooltip.className = 'tut-tooltip'
  requestAnimationFrame(() => {
    tooltip.style.transition = 'opacity .15s ease, transform .15s ease'
    tooltip.style.opacity = '1'
    tooltip.style.transform = 'translateY(0)'
  })

  setTimeout(() => {
    const ttW = 320, ttH = 200
    const targetEl = step.target ? document.querySelector(step.target) : null

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setTimeout(() => {
        const r = targetEl.getBoundingClientRect()
        // Highlight box
        hl.style.cssText = [
          'display:block', 'position:fixed', 'pointer-events:none', 'z-index:9998',
          `top:${r.top-5}px`, `left:${r.left-5}px`,
          `width:${r.width+10}px`, `height:${r.height+10}px`,
          'border:2px solid var(--accent)', 'border-radius:8px',
          'box-shadow:0 0 0 4000px rgba(0,0,0,0.5)',
          'transition:all .15s ease'
        ].join(';')
        // Position tooltip
        const sp = window.innerWidth - r.right - 12
        const sl = r.left - 12
        let tL, tT
        if (sp >= ttW)      { tL = r.right+12;      tT = Math.max(12, r.top) }
        else if (sl >= ttW) { tL = r.left-ttW-12;   tT = Math.max(12, r.top) }
        else                { tL = Math.max(12, r.left); tT = r.bottom+12 }
        tL = Math.max(12, Math.min(tL, window.innerWidth-ttW-12))
        tT = Math.max(12, Math.min(tT, window.innerHeight-ttH-12))
        tooltip.style.cssText = `display:block;position:fixed;top:${tT}px;left:${tL}px;max-width:${ttW}px;z-index:9999;opacity:1;transform:none;transition:none`
      }, 85)
    } else {
      if (hl) hl.style.cssText = 'display:none'
      const tL = Math.max(12, (window.innerWidth-ttW)/2)
      const tT = Math.max(12, (window.innerHeight-ttH)/2)
      tooltip.style.cssText = `display:block;position:fixed;top:${tT}px;left:${tL}px;max-width:${ttW}px;z-index:9999;opacity:1;transform:none;transition:none`
    }
  }, 72)
}

function tutNext() {
  if (tutStep >= TUT_STEPS.length - 1) { endTutorial(); return }
  tutStep++
  renderTutStep()
}
function tutPrev() {
  if (tutStep <= 0) return
  tutStep--
  renderTutStep()
}
function endTutorial() {
  _tutClearMock()
  _setTutDone()
  const ov = document.getElementById('tutorialOverlay')
  const hl = document.getElementById('tutHighlight')
  const tt = document.getElementById('tutTooltip')
  if (ov) ov.style.display = 'none'
  if (hl) hl.style.cssText = 'display:none'
  if (tt) tt.style.display = 'none'
  destroyAllCharts()
  currentPage = 'dashboard'
  render()
  toast(t('toast_tour_completado','¡Tour completado! 🎉 Añade tus cuentas reales para empezar.'))
}
function lanzarTutorial() { startTutorial() }


// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// PROVEEDORES (disabled in personal mode)
// ══════════════════════════════════════════════════════════════
var _provSearch = ""

function renderProveedores() { goTo('dashboard') }

function resetProveedorForm() {
  document.getElementById("proveedorId").value = ""
  document.getElementById("proveedorModalTitle").textContent = t('modal_proveedor_nuevo')
  ;["proveedorNombre","proveedorEmpresa","proveedorEmail","proveedorTelefono","proveedorCategoria","proveedorNotas"].forEach(function(id){ document.getElementById(id).value = "" })
  document.getElementById("proveedorColor").value = "#6366F1"
  document.getElementById("proveedorAvatar").value = ""
  document.getElementById("proveedorAvatarEmoji").style.display = "block"
  document.getElementById("proveedorAvatarImg").style.display = "none"
  document.getElementById("proveedorAvatarImg").src = ""
}

function editarProveedor(id) {
  var p = (S.proveedores||[]).find(function(x){ return x.id===id })
  if (!p) return
  resetProveedorForm()
  document.getElementById("proveedorId").value = id
  document.getElementById("proveedorModalTitle").textContent = t('modal_proveedor_editar')
  document.getElementById("proveedorNombre").value = p.nombre||""
  document.getElementById("proveedorEmpresa").value = p.empresa||""
  document.getElementById("proveedorEmail").value = p.email||""
  document.getElementById("proveedorTelefono").value = p.telefono||""
  document.getElementById("proveedorCategoria").value = p.categoria||""
  document.getElementById("proveedorNotas").value = p.notas||""
  document.getElementById("proveedorColor").value = p.color||"#6366F1"
  document.getElementById("proveedorAvatar").value = p.avatar||""
  if (p.avatar) {
    document.getElementById("proveedorAvatarEmoji").style.display = "none"
    document.getElementById("proveedorAvatarImg").style.display = "block"
    document.getElementById("proveedorAvatarImg").src = p.avatar
  }
  openModal("proveedorModal")
}

function guardarProveedor() {
  var nombre = document.getElementById("proveedorNombre").value.trim()
  if (!nombre) { toast(t('err_nombre_requerido','El nombre es requerido'),'error'); return }
  if (!S.proveedores) S.proveedores = []
  var id = document.getElementById("proveedorId").value
  var data = {
    nombre: nombre,
    empresa: document.getElementById("proveedorEmpresa").value.trim(),
    email: document.getElementById("proveedorEmail").value.trim(),
    telefono: document.getElementById("proveedorTelefono").value.trim(),
    categoria: document.getElementById("proveedorCategoria").value.trim(),
    notas: document.getElementById("proveedorNotas").value.trim(),
    color: document.getElementById("proveedorColor").value||"#6366F1",
    avatar: document.getElementById("proveedorAvatar").value||null
  }
  var newId = id
  if (id) {
    var idx = S.proveedores.findIndex(function(x){ return x.id===id })
    if (idx>=0) S.proveedores[idx] = Object.assign({}, S.proveedores[idx], data)
  } else {
    newId = uid()
    S.proveedores.push(Object.assign({id:newId}, data))
  }
  save()
  if (!id) _resolveInlineCreate('proveedor', newId)
  closeModal("proveedorModal"); render(); toast(t('toast_proveedor_guardado','Proveedor guardado ✓'))
}

function borrarProveedor(id) {
  confirmar("¿Eliminar este proveedor?", function(){
    S.proveedores = (S.proveedores||[]).filter(function(x){ return x.id!==id })
    save(); render(); toast(t('toast_proveedor_eliminado','Proveedor eliminado'))
  }, {titulo:"Eliminar proveedor",icono:"🗑️"})
}

function previewProveedorAvatar(input) {
  var file = input.files[0]
  if (!file) return
  var reader = new FileReader()
  reader.onload = function(e) {
    document.getElementById("proveedorAvatar").value = e.target.result
    document.getElementById("proveedorAvatarEmoji").style.display = "none"
    document.getElementById("proveedorAvatarImg").style.display = "block"
    document.getElementById("proveedorAvatarImg").src = e.target.result
  }
  reader.readAsDataURL(file)
}

function nuevoGastoProveedor(proveedorId) {
  resetGastoForm()
  window._gastoProveedorId = proveedorId
  setTimeout(function(){
    var sel = document.getElementById("gastoProveedor")
    if (sel) sel.value = proveedorId
  }, 50)
  openModal("gastoModal")
}

function poblarClienteSelect(selectId, selectedId) {
  // Personal mode — cliente link is hidden field, nothing to populate
}

function poblarProveedorSelect(selectId, selectedId) {
  const sel = document.getElementById(selectId)
  if (!sel || sel.type === 'hidden') return
  sel.innerHTML = '<option value="">Sin proveedor</option>' +
    (S.proveedores||[]).map(p =>
      `<option value="${p.id}" ${p.id===(selectedId||'')?'selected':''}>${p.nombre}${p.empresa?' ('+p.empresa+')':''}</option>`
    ).join('')
}

function exportarProveedores() {
  try {
    var wb = XLSX.utils.book_new()
    var headers = ["Nombre","Empresa","Email","Teléfono","Categoría","Total Pagado (€)","Facturas"]
    var rows = (S.proveedores||[]).map(function(p) {
      var gastado = S.gastos.filter(function(g){ return g.proveedorId===p.id }).reduce(function(a,g){ return a+(Number(g.importe)||0) },0)
      var facturas = S.gastos.filter(function(g){ return g.proveedorId===p.id }).length
      return [p.nombre||"",p.empresa||"",p.email||"",p.telefono||"",p.categoria||"",gastado,facturas]
    })
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows))
    ws["!cols"] = headers.map(function(h){ return {wch:Math.max(h.length,14)} })
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores")
    XLSX.writeFile(wb, "MoneyNest_Proveedores_"+todayISO()+".xlsx")
    toast(t('toast_proveedores_exportados','Proveedores exportados ✓'))
  } catch(e) { toast("Error al exportar","error") }
}

// ══════════════════════════════════════════════════════════════
// DEVENGO
// ══════════════════════════════════════════════════════════════
var _devSearch = "", _devTipoFilter = "", _devEstadoFilter = ""

function renderDevengo() { goTo('dashboard') }

// ─── FAQ ───────────────────────────────────────────────────────
if (!window._faqOpen) window._faqOpen = {}
function toggleFAQ(id) {
  window._faqOpen[id] = !window._faqOpen[id]
  const body = document.getElementById('faq-body-'+id)
  const arrow = document.getElementById('faq-arrow-'+id)
  if (body) body.style.display = window._faqOpen[id] ? 'block' : 'none'
  if (arrow) arrow.textContent = window._faqOpen[id] ? '▲' : '▼'
}

function _faqBodyHtml() {
  const faqs = [
    { group: '🚀 ' + t('faq_g_inicio','Primeros pasos'), color: 'var(--accent)', items: [
      { q: t('faq_q1','¿Cómo añado un ingreso?'), a: t('faq_a1','Ve a la sección <strong>Ingresos</strong> desde la barra lateral. Haz clic en <strong>+ Nuevo ingreso</strong>. Rellena el importe, categoría, fecha y descripción opcional. Pulsa <strong>Guardar</strong>.') },
      { q: t('faq_q2','¿Cómo añado un gasto?'), a: t('faq_a2','Ve a la sección <strong>Gastos</strong>. Pulsa <strong>+ Nuevo gasto</strong>. Introduce el importe, elige la categoría, la fecha y una descripción. Guarda y aparecerá en el dashboard automáticamente.') },
      { q: t('faq_q3','¿Cómo creo categorías personalizadas?'), a: t('faq_a3','En <strong>Configuración → Categorías</strong> encontrarás las listas de ingresos y gastos. Escribe el nombre en el campo de texto y pulsa <strong>Añadir</strong>.') },
      { q: t('faq_q_cuenta','¿Cómo creo una cuenta bancaria?'), a: t('faq_a_cuenta','Ve a <strong>Cuentas</strong> desde la barra lateral y pulsa <strong>+ Nueva cuenta</strong>. Elige un nombre, tipo (banco, efectivo, tarjeta…) y saldo inicial.') },
      { q: t('faq_q_import_banco','¿Cómo importo datos bancarios?'), a: t('faq_a_import_banco','Desde la barra superior pulsa <strong>Importar banco</strong>, selecciona el archivo de tu banco (CSV/Excel) y MoneyNest categorizará automáticamente los movimientos, pidiéndote confirmación para los que no reconozca.') },
    ]},
    { group: '📚 ' + t('faq_g_conceptos','Conceptos financieros'), color: 'var(--indigo)', items: [
      { q: t('faq_q4','¿Qué es el patrimonio neto?'), a: t('faq_a4','El patrimonio neto es la diferencia entre todos tus activos (cuentas, inversiones, inmuebles…) y tus pasivos (deudas). MoneyNest lo calcula automáticamente en la sección <strong>Patrimonio</strong>.') },
      { q: t('faq_q5','¿Cómo funciona el análisis?'), a: t('faq_a5','El <strong>Análisis</strong> cruza tus datos de ingresos, gastos, inversiones y deudas para generar insights personalizados: tasa de ahorro, categorías con mayor gasto, evolución mensual y regla 50/30/20.') },
      { q: t('faq_q6','¿Cómo interpreto los gráficos?'), a: t('faq_a6','Los gráficos de líneas muestran evolución temporal. Los de dona muestran distribución por categorías. Los KPI en verde indican mejora y en rojo empeoramiento respecto al período anterior.') },
      { q: t('faq_q_inversiones','¿Cómo funcionan las inversiones?'), a: t('faq_a_inversiones','En <strong>Inversiones</strong> registra cada activo (fondo, acción, cripto…) con su importe invertido. MoneyNest calcula la ganancia latente y realizada, y el ROI medio al cerrar una posición.') },
    ]},
    { group: '💳 ' + t('faq_g_deudas','Deudas'), color: 'var(--red)', items: [
      { q: t('faq_q7','¿Qué es una estrategia de pago?'), a: t('faq_a7','Es un plan para liquidar tus deudas de forma ordenada. MoneyNest ofrece tres ritmos: <strong>Conservador</strong> 🐢, <strong>Moderado</strong> ⚖️ y <strong>Agresivo</strong> 🚀.') },
      { q: t('faq_q8','¿Cuál es la diferencia entre Bola de nieve y Avalancha?'), a: t('faq_a8','<strong>❄️ Bola de nieve:</strong> pagas primero la deuda más pequeña.<br><strong>🌊 Avalancha:</strong> pagas primero la de mayor interés, ahorrando más dinero a largo plazo.') },
      { q: t('faq_q9','¿Cómo se calcula el tiempo para quedar libre de deudas?'), a: t('faq_a9','MoneyNest usa la fórmula financiera estándar de amortización considerando el saldo pendiente total, el interés medio anual y el pago mensual estimado.') },
    ]},
    { group: '📦 ' + t('faq_g_datos','Datos y dispositivos'), color: 'var(--gold)', items: [
      { q: t('faq_q10','¿Cómo exporto mis datos?'), a: t('faq_a10','Ve a <strong>Configuración → Importar / Exportar datos</strong>. Puedes exportar en PDF, Excel o descargar una copia de seguridad JSON.') },
      { q: t('faq_q11','¿Cómo importo una copia de seguridad?'), a: t('faq_a11','En <strong>Configuración → Importar / Exportar datos</strong>, pulsa <strong>Importar copia de seguridad</strong> y selecciona tu archivo .json. <em>⚠️ Esto sobreescribe los datos actuales.</em>') },
      { q: t('faq_q12','¿Cómo traslado MoneyNest a otro dispositivo?'), a: t('faq_a12','<strong>1.</strong> Exporta desde Configuración → Copia de seguridad (JSON).<br><strong>2.</strong> En el nuevo dispositivo abre MoneyNest.<br><strong>3.</strong> Ve a Configuración → Importar y selecciona el archivo .json.') },
      { q: t('faq_q13','¿Qué pasa si reseteo la app?'), a: t('faq_a13','El reset elimina <strong>todos los datos permanentemente</strong>. Exporta siempre una copia de seguridad antes.') },
    ]},
    { group: '💳 ' + t('faq_g_plan','Plan y facturación'), color: 'var(--gold)', items: [
      { q: t('faq_q_local_pro','¿Cuál es la diferencia entre Local y Pro?'), a: t('faq_a_local_pro','<strong>Local</strong> (6,99€ pago único) te da acceso ilimitado a MoneyNest en este dispositivo, sin suscripción. <strong>Pro</strong> (14,99€/año) añade Cloud: sincronización automática entre dispositivos, backup y restauración.') },
      { q: t('faq_q_cloud','¿Cómo funciona Cloud?'), a: t('faq_a_cloud','Con el plan Pro, tus datos se sincronizan automáticamente en la nube. Así puedes acceder a tu información desde cualquier dispositivo y siempre tienes una copia de seguridad actualizada.') },
      { q: t('faq_q_recuperar','¿Cómo recupero mis datos si cambio de dispositivo?'), a: t('faq_a_recuperar','Si ya tienes una licencia, usa <strong>Restaurar acceso</strong> desde la pantalla de inicio de sesión con el email de tu compra. Si eres Pro, tus datos se sincronizan automáticamente al iniciar sesión.') },
    ]},
    { group: '⚙️ ' + t('faq_g_uso','Uso de la app'), color: 'var(--green)', items: [
      { q: t('faq_q14','¿Cómo cambio el idioma?'), a: t('faq_a14','Ve a <strong>Configuración → Idioma</strong> y haz clic en el idioma que quieres. El cambio es inmediato.') },
      { q: t('faq_q15','¿Por qué no aparecen mis datos?'), a: t('faq_a15','Los datos se guardan en el navegador (localStorage). Usa siempre la exportación JSON como respaldo regular.') },
      { q: t('faq_q16','¿Cómo reseteo la app correctamente?'), a: t('faq_a16','<strong>1.</strong> Exporta tu copia de seguridad.<br><strong>2.</strong> Ve a Configuración → Zona de peligro.<br><strong>3.</strong> Haz clic en Resetear todo y confirma.') },
    ]},
  ]

  return faqs.map((group, gi) => {
    const items = group.items.map((item, qi) => {
      const id = `faq-${gi}-${qi}`
      // All questions start expanded — individually collapsible, but
      // never collapsed by default (Bloque 6: "mostrar TODAS las
      // preguntas desplegadas verticalmente").
      const isOpen = !window._faqOpen || window._faqOpen[id] !== false
      return `
      <div class="faq-item" id="faqitem-${id}">
        <button class="faq-q" onclick="toggleFAQ('${id}')" aria-expanded="${isOpen}">
          <span class="faq-q-text">${item.q}</span>
          <span class="faq-chevron" id="faq-arrow-${id}">${isOpen ? '▲' : '▼'}</span>
        </button>
        <div class="faq-a" id="faq-body-${id}" style="display:${isOpen?'block':'none'}">${item.a}</div>
      </div>`
    }).join('')

    return `
    <div class="faq-group">
      <div class="faq-group-header">
        <span class="faq-group-dot" style="background:${group.color}"></span>
        <span class="faq-group-title">${group.group}</span>
      </div>
      <div class="faq-group-items">${items}</div>
    </div>`
  }).join('')
}

function renderFAQ() {
  const faqHtml = _faqBodyHtml()

  document.getElementById('content').innerHTML = `
  <div style="max-width:720px;margin:0 auto">
    <div class="section-header">
      <div>
        <div class="page-h1">❓ ${t('faq_titulo','Preguntas frecuentes')}</div>
        <div class="page-sub">${t('faq_sub_v2','Guías paso a paso y respuestas a las dudas más comunes')}</div>
      </div>
    </div>

    ${faqHtml}

    <div style="margin-top:32px;padding:16px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);text-align:center">
      <div style="font-size:.82rem;color:var(--text2)">${t('faq_contacto_intro','¿No encuentras lo que buscas?')}</div>
      <a href="mailto:invest.grid.main@gmail.com" style="font-size:.88rem;font-weight:700;color:var(--accent);text-decoration:none;user-select:text">invest.grid.main@gmail.com</a>
    </div>
  </div>`
}

// ─── SUGERENCIAS ───────────────────────────────────────────────
try { if (!window._sugerencias) window._sugerencias = JSON.parse(localStorage.getItem('mn_sugerencias')||'[]') } catch(e) { window._sugerencias = [] }

function saveSugerencia() {
  const input = document.getElementById('sug-input')
  const cat = document.getElementById('sug-cat')
  const tipoEl = document.querySelector('input[name="sug-tipo"]:checked')
  if (!input) return
  const text = (input.value||'').trim()
  if (!text) { toast(t('err_sugerencia_vacia','Escribe una sugerencia primero'),'error'); return }
  const sug = { id: Date.now(), text, categoria: cat?.value||'General', tipo: tipoEl?.value||'Sugerencia', fecha: new Date().toISOString().slice(0,10), votos: 0 }
  window._sugerencias.unshift(sug)
  try { localStorage.setItem('mn_sugerencias', JSON.stringify(window._sugerencias)) } catch(e) {}
  toast(t('toast_sugerencia_guardada','¡Sugerencia guardada! Gracias 🙏'),'success')
  renderFAQ()
}

function votarSugerencia(id) {
  const sug = window._sugerencias.find(s=>s.id===id)
  if (sug) sug.votos = (sug.votos||0)+1
  try { localStorage.setItem('mn_sugerencias', JSON.stringify(window._sugerencias)) } catch(e) {}
  renderFAQ()
}

function borrarSugerencia(id) {
  window._sugerencias = window._sugerencias.filter(s=>s.id!==id)
  try { localStorage.setItem('mn_sugerencias', JSON.stringify(window._sugerencias)) } catch(e) {}
  renderFAQ()
}

function copiarEmailSugerencias() {
  const email = 'invest.grid.main@gmail.com'
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(()=>toast(t('toast_email_copiado','Email copiado al portapapeles 📋'))).catch(()=>{
      _copiarEmailFallback(email)
    })
  } else {
    _copiarEmailFallback(email)
  }
}
function _copiarEmailFallback(email) {
  const ta = document.createElement('textarea')
  ta.value = email; ta.style.position='fixed'; ta.style.opacity='0'
  document.body.appendChild(ta); ta.select()
  try { document.execCommand('copy'); toast(t('toast_email_copiado','Email copiado al portapapeles 📋')) }
  catch(e) { toast('Copia manualmente: '+email,'error') }
  document.body.removeChild(ta)
}

function enviarSugerenciaEmail() {
  const input  = document.getElementById('sug-input')
  const cat    = document.getElementById('sug-cat')
  const tipoEl = document.querySelector('input[name="sug-tipo"]:checked')
  if (!input) return
  const text = (input.value||'').trim()
  if (!text) { toast(t('err_mensaje_vacio','Escribe un mensaje primero'),'error'); return }

  const tipo      = tipoEl?.value || 'Sugerencia'
  const categoria = cat?.value    || 'General'
  const userEmail = window.MNSupabaseAuth?.getEmail() || MNAuth?.getUser()?.email || ''

  const btn = document.querySelector('[onclick="enviarSugerenciaEmail()"]')
  if (btn) { btn.disabled = true; btn.textContent = t('loading_enviando') }

  fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRjaXFxaG1ma2JxaGRyZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjkyMjcsImV4cCI6MjA5NDM0NTIyN30.Gqz39AWpW1BkWXhfhnR_vOUYUy93bgdSNvBfXYQ3VGk' },
    body: JSON.stringify({ type: 'sugerencia', tipo, categoria, mensaje: text, userEmail }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      toast(t('toast_sugerencia_enviada','✅ Sugerencia enviada directamente. ¡Gracias!'), 'success')
      if (input) input.value = ''
      renderFAQ()
    } else {
      toast('⚠ ' + t('err_enviar_sugerencia','Error al enviar') + ': ' + (data.error || t('intentalo_de_nuevo','inténtalo de nuevo')), 'error')
    }
  })
  .catch(() => toast('⚠ ' + t('err_conexion','No se pudo enviar. Comprueba tu conexión.'), 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = t('btn_enviar_email') }
  })
}

function renderSugerencias() {
  try { if (!window._sugerencias) window._sugerencias = JSON.parse(localStorage.getItem('mn_sugerencias')||'[]') } catch(e) { window._sugerencias = [] }
  const cats = ['General','UI / Diseño','Nuevas funciones','Rendimiento','Idioma / Traducción','Otro']
  const list = (window._sugerencias||[]).map(s=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:600;color:var(--text);margin-bottom:5px">${s.text}</div>
        <div style="font-size:.73rem;color:var(--text3)">${s.fecha} · <span style="background:var(--border);padding:2px 8px;border-radius:99px;font-weight:600;color:var(--text2)">${s.categoria}</span>${s.tipo?` · <span style="font-size:.7rem;color:var(--accent)">${s.tipo}</span>`:''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0">
        <button onclick="votarSugerencia(${s.id})" style="background:var(--accent-dim);border:1px solid rgba(0,212,170,.2);color:var(--accent);border-radius:8px;padding:4px 10px;font-size:.78rem;font-weight:700;cursor:pointer;min-width:52px">👍 ${s.votos||0}</button>
        <button onclick="borrarSugerencia(${s.id})" style="background:transparent;border:none;color:var(--text3);font-size:.72rem;cursor:pointer" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'">✕ ${t('btn_eliminar','Eliminar')}</button>
      </div>
    </div>`).join('') || `<div class="empty"><div class="empty-icon">💬</div><div class="empty-title">${t('sug_vacio_titulo','Aún no hay sugerencias')}</div><div class="empty-sub">${t('sug_vacio_sub','¡Sé el primero en proponer una mejora!')}</div></div>`

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div><div class="page-h1">💡 ${t('page_sugerencias')}</div><div class="page-sub">Propón mejoras — se guardan localmente en tu dispositivo</div></div>
  </div>
  <div style="max-width:680px">
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">✍️ Nueva sugerencia</div>
      <div class="form-group">
        <label>Tipo</label>
        <div style="display:flex;gap:10px;margin-bottom:4px">
          <label style="display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border2);background:var(--bg2);cursor:pointer;flex:1;font-size:.85rem;font-weight:600;color:var(--text2);transition:all .15s" id="sug-tipo-label-sug">
            <input type="radio" name="sug-tipo" value="Sugerencia" id="sug-tipo-sug" checked style="accent-color:var(--accent)" onchange="document.getElementById('sug-tipo-label-sug').style.borderColor='var(--accent)';document.getElementById('sug-tipo-label-sug').style.color='var(--accent)';document.getElementById('sug-tipo-label-preg').style.borderColor='var(--border2)';document.getElementById('sug-tipo-label-preg').style.color='var(--text2)'">
            💡 ${t('sug_tipo_sug')}
          </label>
          <label style="display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border2);background:var(--bg2);cursor:pointer;flex:1;font-size:.85rem;font-weight:600;color:var(--text2);transition:all .15s" id="sug-tipo-label-preg">
            <input type="radio" name="sug-tipo" value="Pregunta" id="sug-tipo-preg" style="accent-color:var(--accent)" onchange="document.getElementById('sug-tipo-label-preg').style.borderColor='var(--accent)';document.getElementById('sug-tipo-label-preg').style.color='var(--accent)';document.getElementById('sug-tipo-label-sug').style.borderColor='var(--border2)';document.getElementById('sug-tipo-label-sug').style.color='var(--text2)'">
            ❓ ${t('sug_tipo_preg')}
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <select id="sug-cat">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>Mensaje</label>
        <textarea id="sug-input" placeholder="${t('sug_placeholder')}" style="min-height:90px;-webkit-user-select:text;user-select:text"></textarea>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" onclick="saveSugerencia()">${t('sug_guardar')}</button>
        <button class="btn btn-secondary" onclick="enviarSugerenciaEmail()">${t('sug_enviar_email')}</button>
        <button class="btn btn-ghost" onclick="copiarEmailSugerencias()" title="Copiar email" style="font-size:.78rem;padding:7px 10px">📋 Copiar email</button>
      </div>
      <div style="margin-top:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:.72rem;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Contacto:</span>
        <span style="font-size:.82rem;font-weight:700;color:var(--accent);user-select:text;-webkit-user-select:text">invest.grid.main@gmail.com</span>
      </div>
    </div>
    <div class="card">
      <div class="card-header" style="margin-bottom:12px">
        <div class="card-title">📋 Sugerencias enviadas</div>
        <span class="badge badge-accent">${(window._sugerencias||[]).length}</span>
      </div>
      ${list}
    </div>
  </div>`

  // Highlight the initially-selected radio
  setTimeout(()=>{
    const lbl = document.getElementById('sug-tipo-label-sug')
    if (lbl) { lbl.style.borderColor='var(--accent)'; lbl.style.color='var(--accent)' }
  }, 0)
}


function abrirDevengoModal() {
  document.getElementById("devengoId").value = ""
  document.getElementById("devengoModalTitle").textContent = t('modal_devengo_nuevo')
  ;["devengoConcepto","devengoImporte","devengoNotas"].forEach(function(id){ document.getElementById(id).value = "" })
  document.getElementById("devengoTipo").value = "ingreso"
  document.getElementById("devengoFecha").value = todayISO()
  document.getElementById("devengoCobro").value = ""
  document.getElementById("devengoEstado").value = "pendiente"
  var sel = document.getElementById("devengoContacto")
  if (sel) {
    var clis = (S.clientes||[]).map(function(c){ return "<option value=\""+c.id+"\">👥 "+c.nombre+"</option>" }).join("")
    var pros = (S.proveedores||[]).map(function(p){ return "<option value=\""+p.id+"\">🏭 "+p.nombre+"</option>" }).join("")
    sel.innerHTML = "<option value=\"\">Sin asociar</option>" + clis + pros +
      "<option value=\"__create_new_cliente__\">+ Nuevo cliente</option>" +
      "<option value=\"__create_new_proveedor__\">+ Nuevo proveedor</option>"
    if (!sel.dataset.mnInlineCreateBound) {
      sel.dataset.mnInlineCreateBound = '1'
      sel.addEventListener('change', function() { _handleDevengoContactoSelect(sel) })
    }
    var noContactos = (S.clientes||[]).length === 0 && (S.proveedores||[]).length === 0
    var hintId = sel.id + '-dep-hint'
    var hint = document.getElementById(hintId)
    if (!noContactos) { if (hint) hint.remove() }
    else {
      if (!hint) {
        hint = document.createElement('div')
        hint.id = hintId
        hint.className = 'form-dependency-hint'
        sel.insertAdjacentElement('afterend', hint)
      }
      hint.innerHTML = '<span>' + t('hint_sin_clientes_proveedores','Todavía no tienes clientes ni proveedores.') + '</span>' +
        '<span style="display:flex;gap:6px;flex-shrink:0">' +
        '<button type="button" id="' + hintId + '-cli">' + t('btn_crear_cliente_hint','Crear cliente') + '</button>' +
        '<button type="button" id="' + hintId + '-pro">' + t('btn_crear_proveedor_hint','Crear proveedor') + '</button>' +
        '</span>'
      document.getElementById(hintId + '-cli').onclick = function(e) { e.preventDefault(); _handleInlineCreateSelect(sel, 'cliente', true) }
      document.getElementById(hintId + '-pro').onclick = function(e) { e.preventDefault(); _handleInlineCreateSelect(sel, 'proveedor', true) }
    }
  }
  openModal("devengoModal")
}

// devengoContacto combina clientes+proveedores en un unico select, asi
// que puede disparar la creacion inline de CUALQUIERA de los 2 tipos
// desde el mismo control (a diferencia de los selects de cuenta, que
// solo manejan un tipo).
function _handleDevengoContactoSelect(sel) {
  if (sel.value === '__create_new_cliente__') { _handleInlineCreateSelect(sel, 'cliente'); return }
  if (sel.value === '__create_new_proveedor__') { _handleInlineCreateSelect(sel, 'proveedor'); return }
  sel.dataset.mnPrevValue = sel.value
}

function editarDevengo(id) {
  var d = (S.devengos||[]).find(function(x){ return x.id===id })
  if (!d) return
  abrirDevengoModal()
  setTimeout(function(){
    document.getElementById("devengoId").value = id
    document.getElementById("devengoModalTitle").textContent = t('modal_devengo_editar')
    document.getElementById("devengoConcepto").value = d.concepto||""
    document.getElementById("devengoImporte").value = d.importe||""
    document.getElementById("devengoTipo").value = d.tipo||"ingreso"
    document.getElementById("devengoFecha").value = d.fecha||todayISO()
    document.getElementById("devengoCobro").value = d.fechaCobro||""
    document.getElementById("devengoEstado").value = d.estado||"pendiente"
    document.getElementById("devengoNotas").value = d.notas||""
    var s = document.getElementById("devengoContacto"); if(s) s.value = d.contactoId||""
  }, 60)
}

function guardarDevengo() {
  var concepto = document.getElementById("devengoConcepto").value.trim()
  var importe = parseAmount(document.getElementById("devengoImporte").value)
  if (!concepto || !importe || importe<=0) { toast("Concepto e importe requeridos","error"); return }
  if (!S.devengos) S.devengos = []
  var id = document.getElementById("devengoId").value
  var data = {
    concepto: concepto, importe: importe,
    tipo: document.getElementById("devengoTipo").value,
    fecha: document.getElementById("devengoFecha").value||todayISO(),
    fechaCobro: document.getElementById("devengoCobro").value||"",
    contactoId: document.getElementById("devengoContacto").value||null,
    estado: document.getElementById("devengoEstado").value,
    notas: document.getElementById("devengoNotas").value.trim()
  }
  if (id) {
    var idx = S.devengos.findIndex(function(x){ return x.id===id })
    if (idx>=0) S.devengos[idx] = Object.assign({}, S.devengos[idx], data)
  } else {
    S.devengos.push(Object.assign({id:uid()}, data))
  }
  save(); closeModal("devengoModal"); render(); toast(t('toast_devengo_guardado','Devengo guardado ✓'))
}

function borrarDevengo(id) {
  confirmar("¿Eliminar este registro de devengo?", function(){
    S.devengos = (S.devengos||[]).filter(function(x){ return x.id!==id })
    save(); render(); toast(t('toast_devengo_eliminado','Devengo eliminado'))
  }, {titulo:"Eliminar devengo",icono:"🗑️"})
}

function marcarDevengoCobrado(id) {
  var idx = (S.devengos||[]).findIndex(function(x){ return x.id===id })
  if (idx<0) return
  S.devengos[idx].estado = "cobrado"
  S.devengos[idx].fechaCobro = S.devengos[idx].fechaCobro || todayISO()
  save(); render(); toast("Marcado como cobrado/pagado ✓")
}

function exportarDevengos() {
  try {
    var wb = XLSX.utils.book_new()
    var headers = ["Concepto","Tipo","Importe (€)","Fecha Devengo","Fecha Cobro/Pago","Contacto","Estado","Notas"]
    function getNombre(cid) {
      var c = (S.clientes||[]).find(function(x){ return x.id===cid }); if(c) return c.nombre
      var p = (S.proveedores||[]).find(function(x){ return x.id===cid }); if(p) return p.nombre
      return ""
    }
    var rows = (S.devengos||[]).map(function(d){
      return [d.concepto||"",d.tipo||"",Number(d.importe)||0,d.fecha||"",d.fechaCobro||"",getNombre(d.contactoId),d.estado||"",d.notas||""]
    })
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows))
    ws["!cols"] = headers.map(function(h){ return {wch:Math.max(h.length,14)} })
    XLSX.utils.book_append_sheet(wb, ws, "Devengo")
    XLSX.writeFile(wb, "MoneyNest_Devengo_"+todayISO()+".xlsx")
    toast(t('toast_devengos_exportados','Devengos exportados ✓'))
  } catch(e) { toast("Error al exportar","error") }
}



function verDetalleCuenta(cuentaId) {
  const cuenta = getCuenta(cuentaId)
  if (!cuenta) return
  const ings = S.ingresos.filter(i=>i.cuentaId===cuentaId).sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0)
  const gas  = S.gastos.filter(g=>g.cuentaId===cuentaId).sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0)
  const invs = S.inversiones.filter(i=>i.cuentaId===cuentaId).sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0)

  const allMov = [
    ...ings.map(i=>({...i, _tipo:'ingreso', _sign:'+', _color:'var(--green)'})),
    ...gas.map(g=>({...g, _tipo:'gasto', _sign:'−', _color:'var(--red)'})),
    ...invs.map(i=>({...i, _tipo:'inversion', _sign:'−', _color:'var(--gold)', concepto:i.nombre, importe:i.importe}))
  ].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))

  const rows = allMov.slice(0,50).map(m=>{
    const tipoBadge = m._tipo==='ingreso'
      ? '<span class="badge badge-green">💰 Ingreso</span>'
      : m._tipo==='gasto'
        ? '<span class="badge badge-red">💳 Gasto</span>'
        : '<span class="badge badge-gold">📈 Inversión</span>'
    return `<tr>
      <td>${fmtDate(m.fecha)}</td>
      <td class="td-main">${m.concepto||'—'}</td>
      <td>${tipoBadge}</td>
      <td class="td-amount" style="color:${m._color}">${m._sign}${eur(m.importe)}</td>
      <td><span class="tag">${m.categoria||'—'}</span></td>
    </tr>`
  }).join('') || `<tr><td colspan="5"><div class="empty">
    <div class="empty-icon">📋</div>
    <div class="empty-title">${t('sin_movimientos_aun','Todavía no tienes movimientos.')}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MNBankImport&&MNBankImport.open()" style="margin-top:10px;background:var(--accent-dim);border-color:rgba(0,212,170,.3);color:var(--accent)">🏦 ${t('btn_importar_datos_bancarios','Importar datos bancarios')}</button>
  </div></td></tr>`

  const totalEnt = ings.reduce((a,i)=>a+(Number(i.importe)||0),0)
  const totalSal = gas.reduce((a,g)=>a+(Number(g.importe)||0),0) + invs.filter(i=>!i.cerrada).reduce((a,i)=>a+(Number(i.importe)||0),0)

  document.getElementById('content').innerHTML = `
  <div class="section-header">
    <div>
      <div class="page-h1" style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-ghost btn-sm" onclick="goTo('cuentas')" style="font-size:.85rem">← Cuentas</button>
        <span style="width:12px;height:12px;border-radius:50%;background:${cuenta.color||'#00D4AA'};display:inline-block"></span>
        ${cuenta.nombre}
      </div>
      <div class="page-sub">Historial completo de movimientos</div>
    </div>
    <div class="section-actions">
      <button class="btn-edit" onclick="editarCuenta('${cuentaId}')">Editar cuenta</button>
    </div>
  </div>

  <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--accent-dim)">💰</div>
      <div class="kpi-label">Saldo disponible</div>
      <div class="kpi-value" style="color:var(--accent)">${eur(cuenta.saldo||0)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--green-dim)">📥</div>
      <div class="kpi-label">Total entradas</div>
      <div class="kpi-value sm" style="color:var(--green)">${eur(totalEnt)}</div>
      <div class="kpi-sub">${ings.length} ingresos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--red-dim)">📤</div>
      <div class="kpi-label">Total salidas</div>
      <div class="kpi-value sm" style="color:var(--red)">${eur(totalSal)}</div>
      <div class="kpi-sub">${gas.length} gastos · ${invs.filter(i=>!i.cerrada).length} inversiones activas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:var(--indigo-dim)">📊</div>
      <div class="kpi-label">Total movimientos</div>
      <div class="kpi-value">${allMov.length}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title">📋 Movimientos</div>
      <span style="font-size:.78rem;color:var(--text2)">${allMov.length > 50 ? 'Mostrando últimos 50' : allMov.length + ' movimientos'}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th><th>Categoría</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`
}


function mostrarSaldoCuenta() {
  const sel = document.getElementById('invCuenta')
  const hint = document.getElementById('invCuentaSaldoHint')
  if (!sel || !hint) return
  const cuentaId = sel.value
  if (!cuentaId) { hint.textContent = t('cuenta_hint_selecciona'); hint.style.color='var(--text3)'; return }
  const cuenta = getCuenta(cuentaId)
  if (!cuenta) return
  const saldo = Number(cuenta.saldo)||0
  hint.textContent = t('cuenta_disponible') + eur(saldo)
  hint.style.color = saldo > 0 ? 'var(--green)' : 'var(--red)'
}

// ════════════════════════════════════════════════════════════════
// ─── MÓDULO: PATRIMONIO ──────────────────────────────────────
// ════════════════════════════════════════════════════════════════

let _nwRange = '1M'

function _setNwRange(rangeKey) {
  _nwRange = rangeKey
  document.querySelectorAll('.nw-range-btn').forEach(b => b.classList.toggle('active', b.dataset.range === rangeKey))
  const body = document.getElementById('nwComparisonBody')
  if (body) body.innerHTML = _renderNetWorthComparisonBody()
}

function _nwRangeStartLabel(rangeKey) {
  const labels = { '1M': t('mes_anterior','Mes anterior'), '3M': t('nw_hace_3m','Hace 3 meses'), '6M': t('nw_hace_6m','Hace 6 meses'), '1A': t('nw_hace_1a','Hace 1 año'), 'TODO': t('nw_inicio','Inicio') }
  return labels[rangeKey] || rangeKey
}

function _renderNetWorthComparisonBody() {
  const comp = _buildNetWorthComparison(_nwRange)

  if (!comp.hasHistory) {
    return `<div style="text-align:center;padding:34px 16px;color:var(--text2)">
      <div style="font-size:1.7rem;margin-bottom:10px">🌱</div>
      <div style="font-size:.9rem;max-width:360px;margin:0 auto">${t('nw_construyendo_historial','Seguiremos construyendo tu historial de patrimonio a medida que utilices MoneyNest.')}</div>
      <div style="margin-top:16px;font-size:1.4rem;font-weight:800;color:var(--text)">${eur(comp.current)}</div>
    </div>`
  }

  const changeColor = comp.change > 0 ? 'var(--green)' : (comp.change < 0 ? 'var(--red)' : 'var(--text2)')
  const changeIcon  = comp.change > 0 ? '🟢' : (comp.change < 0 ? '🔴' : '⚪')
  const pctStr = comp.pct !== null ? ` · ${comp.pct>=0?'+':''}${pct(comp.pct)}` : ''

  const componentsHtml = comp.components.length ? comp.components.map(c => `
    <div class="nw-comp-row">
      <span class="nw-comp-label">${c.icon} ${c.label}</span>
      <span class="nw-comp-value" style="color:${c.value>=0?'var(--green)':'var(--red)'}">${c.value>=0?'+':'−'}${eur(Math.abs(c.value))}</span>
    </div>`).join('') : `<div style="text-align:center;padding:14px;color:var(--text2);font-size:.85rem">${t('nw_sin_cambios','Sin cambios en este periodo')}</div>`

  const highlights = _netWorthHighlights(comp.components)

  // "Desde enero" — only shown when a January record for the current
  // year actually exists; never fabricated.
  const janMonth = new Date().getFullYear() + '-01'
  const janRecord = S.patrimonio_hist.find(h => h.mes === janMonth)
  const sinceJanHtml = janRecord ? (() => {
    const changeJan = comp.current - janRecord.valor
    const pctJan = janRecord.valor !== 0 ? (changeJan/Math.abs(janRecord.valor))*100 : null
    return `<div class="nw-since-jan">
      <span>${t('desde_enero','Desde enero')}</span>
      <span style="color:${changeJan>=0?'var(--green)':'var(--red)'};font-weight:800">${changeJan>=0?'+':''}${eur(changeJan)}${pctJan!==null?' · '+(pctJan>=0?'+':'')+pct(pctJan):''}</span>
    </div>`
  })() : ''

  return `
    <div class="nw-summary-row">
      <div>
        <div class="nw-summary-label">${t('nw_actual','Actual')}</div>
        <div class="nw-summary-value">${eur(comp.current)}</div>
      </div>
      <div class="nw-summary-arrow">→</div>
      <div style="text-align:right">
        <div class="nw-summary-label">${_nwRangeStartLabel(_nwRange)}</div>
        <div class="nw-summary-value" style="color:var(--text2)">${eur(comp.startValue)}</div>
      </div>
    </div>
    <div class="nw-change-badge" style="color:${changeColor}">${changeIcon} ${comp.change>=0?'+':''}${eur(comp.change)}${pctStr}</div>
    ${sinceJanHtml}
    <div class="nw-section-label">${t('que_ha_pasado','¿Qué ha pasado?')}</div>
    <div class="nw-comp-list">${componentsHtml}</div>
    ${comp.components.length ? `<div class="nw-result-row"><span>${t('nw_resultado','Resultado')}</span><span style="color:${changeColor};font-weight:800">${comp.change>=0?'+':''}${eur(comp.change)}</span></div>` : ''}
    ${highlights.length ? `<div class="nw-highlights">${highlights.map(h=>`<div class="nw-highlight-item">${h}</div>`).join('')}</div>` : ''}
  `
}

function renderPatrimonio() {
  if (!S.assets) S.assets = []
  const pat       = calcPatrimonio()
  const dis       = calcDineroDisponible()
  const cartera   = calcCartera()
  const assetsVal = calcAssetsValue()
  const deuda     = calcTotalDeuda()
  const m         = currentMonth()
  const mp        = prevMonth(m)
  const patP      = (() => { const h = S.patrimonio_hist.find(h=>h.mes===mp); return h ? h.valor : null })()
  const patDelta  = patP !== null ? ((pat - patP) / Math.abs(patP || 1)) * 100 : null

  // Investment aggregates
  const invAbiertas = S.inversiones.filter(i=>!i.cerrada)
  const totalInv    = invAbiertas.reduce((a,i)=>a+(Number(i.importe)||0),0)
  const totalRet    = calcGananciaLatente()
  const totalRealiz = calcGananciaTotal()
  const roiPct      = totalInv ? (totalRet/totalInv*100) : 0

  // Accounts
  const cuentasHtml = S.cuentas.map(c=>`
    <div onclick="verDetalleCuenta('${c.id}')" style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 12px;border-radius:var(--radius-sm);background:var(--bg2);
      border:1px solid var(--border);margin-bottom:6px;cursor:pointer;transition:all .15s"
      onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${c.color||'#00D4AA'};flex-shrink:0"></span>
        <div>
          <div style="font-size:.88rem;font-weight:600;color:var(--text)">${c.nombre}</div>
          <div style="font-size:.7rem;color:var(--text2)">${c.tipo||'banco'}</div>
        </div>
      </div>
      <span style="font-size:.95rem;font-weight:700;color:var(--text)">${eur(c.saldo||0)}</span>
    </div>`).join('')

  // Assets — active & sold
  const activeAssets = S.assets.filter(a=>a.status==='active')
  const soldAssets   = S.assets.filter(a=>a.status==='sold')

  function getAssetIcon(tipo) {
    const icons = {vehicle:'🚗',property:'🏠',electronics:'💻',jewelry:'💎',business:'🏢',other:'📦'}
    return icons[tipo] || '📦'
  }
  function getAssetBg(tipo) {
    const bgs = {vehicle:'var(--gold-dim)',property:'var(--indigo-dim)',electronics:'var(--accent-dim)',jewelry:'var(--red-dim)',business:'var(--green-dim)',other:'var(--border)'}
    return bgs[tipo] || 'var(--border)'
  }
  function getAssetLabel(tipo, customLabel) {
    if (tipo==='__custom__' || (customLabel && tipo==='other')) return customLabel||'Otro'
    const labels = {vehicle:'Vehículo',property:'Inmueble',electronics:'Electrónica',jewelry:'Joyería / Arte',business:'Negocio',other:'Otro'}
    return labels[tipo] || tipo
  }
  function assetCurrentVal(a) {
    let val = Number(a.valor)||0
    if (a.depreciacion && a.depPct && a.fecha) {
      const years = (Date.now()-new Date(a.fecha).getTime())/(1000*60*60*24*365.25)
      val = val*Math.pow(1-(Number(a.depPct)||0)/100,Math.max(0,years))
    }
    return val
  }

  function renderAssetCard(a, isSold) {
    // For a SOLD asset, the result must be computed from the REAL sale
    // price (a.precioVenta, saved at the moment of the sale) — never
    // from the last market valuation (a.valor), which only reflects
    // "Actualizar valor" updates and can be stale (or simply wrong) by
    // the time the asset is actually sold. Active (not yet sold) assets
    // keep using their live current value exactly as before.
    const vc = Number(a.valorCompra)||Number(a.valor)||0
    const displayVal = isSold
      ? (a.precioVenta !== undefined ? Number(a.precioVenta)||0 : assetCurrentVal(a)) // fallback for sales recorded before this fix
      : assetCurrentVal(a)
    const gainLoss = displayVal - vc
    const icon = getAssetIcon(a.tipo)
    const label = getAssetLabel(a.tipo, a.tipoCustom)

    // Same visual language as goal-card: optional background image with
    // a gradient overlay for legibility, falling back to the emoji/icon
    // avatar when no image was uploaded — reusing the exact same image
    // infrastructure already built for Objetivos (data: URL avatars),
    // not a second parallel system.
    const hasBgImg = a.avatar && a.avatar.startsWith('data:')
    const bgStyle = hasBgImg
      ? `background-image:url(${a.avatar});background-size:cover;background-position:center;`
      : `background:var(--card);`
    const overlayStyle = hasBgImg
      ? `position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,rgba(0,0,0,0.78) 100%);border-radius:var(--radius);z-index:0;`
      : `display:none;`
    const textColor  = hasBgImg ? '#fff' : (isSold ? 'var(--text2)' : 'var(--text)')
    const textColor2 = hasBgImg ? 'rgba(255,255,255,0.8)' : 'var(--text2)'
    const gainColor  = gainLoss>=0 ? (hasBgImg?'#6EE7B7':'var(--green)') : (hasBgImg?'#FCA5A5':'var(--red)')
    const borderTopStyle = hasBgImg ? '' : `border-top:3px solid ${isSold?'var(--border)':'var(--gold,#F5A623)'};`

    return `
    <div class="goal-card asset-card ${hasBgImg?'has-img':''}" style="${borderTopStyle}position:relative;${bgStyle}overflow:hidden${isSold?';opacity:.85':''}">
      <div style="${overlayStyle}"></div>
      <div style="position:relative;z-index:1">
      ${!hasBgImg ? `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
        <div class="obj-avatar" style="background:var(--gold-dim,rgba(245,166,35,.14));border-color:var(--gold,#F5A623)44">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
            <div class="goal-name" style="color:${textColor}">${a.nombre||'—'}</div>
            <span class="badge" style="background:var(--gold-dim,rgba(245,166,35,.14));color:var(--gold,#F5A623);flex-shrink:0">${label}</span>
          </div>
          <div class="goal-meta" style="color:${textColor2};margin-bottom:0">${a.fecha?'📅 '+t('compra_lbl','Compra')+': '+fmtDate(a.fecha):''}${a.fechaVenta?' · '+t('venta_lbl','Venta')+': '+fmtDate(a.fechaVenta):''}</div>
        </div>
      </div>` : `
      <div style="margin-bottom:10px;padding-top:4px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px">
          <div class="goal-name" style="color:${textColor};text-shadow:0 1px 3px rgba(0,0,0,0.5)">${a.nombre||'—'}</div>
          <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;flex-shrink:0;backdrop-filter:blur(4px)">${label}</span>
        </div>
        <div class="goal-meta" style="color:${textColor2}">${a.fecha?'📅 '+t('compra_lbl','Compra')+': '+fmtDate(a.fecha):''}${a.fechaVenta?' · '+t('venta_lbl','Venta')+': '+fmtDate(a.fechaVenta):''}</div>
      </div>`}

      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:${textColor2};margin-bottom:2px">${isSold?t('precio_venta','Precio de venta'):t('valor_actual','Valor actual')}</div>
      <div style="font-size:1.35rem;font-weight:800;color:${textColor};margin-bottom:4px${hasBgImg?';text-shadow:0 1px 3px rgba(0,0,0,.5)':''}">${eur(displayVal)}</div>
      ${vc?`<div style="font-size:.78rem;font-weight:700;color:${gainColor};margin-bottom:10px">${gainLoss>=0?'▲':'▼'} ${eur(Math.abs(gainLoss))} ${isSold?t('resultado','resultado'):t('vs_compra','vs compra')}</div>`:'<div style="margin-bottom:10px"></div>'}

      <div style="font-size:.78rem;${hasBgImg?'color:rgba(255,255,255,0.85);text-shadow:0 1px 2px rgba(0,0,0,.6)':'color:var(--text2)'};margin-bottom:10px">
        ${t('precio_compra','Precio de compra')}: <strong style="${hasBgImg?'color:#fff':'color:var(--text)'}">${eur(a.valorCompra||0)}</strong>
      </div>

      <div class="action-row" style="${hasBgImg?'background:rgba(0,0,0,0.3);border-radius:var(--radius-sm);padding:4px 6px;':''}">
        ${!isSold?`
          <button class="btn-edit" onclick="editarAsset('${a.id}')" style="${hasBgImg?'background:rgba(255,255,255,0.15);color:#fff;':''}">${t('btn_editar','Editar')}</button>
          <button class="btn btn-ghost btn-xs" onclick="quickUpdateAssetValue('${a.id}')" style="${hasBgImg?'background:rgba(255,255,255,0.15);color:#fff;':''}">💰 ${t('actualizar_valor','Revalorizar')}</button>
          <button class="btn btn-ghost btn-xs" onclick="marcarAssetVendido('${a.id}')" style="${hasBgImg?'background:rgba(255,80,80,0.25);color:#fca5a5;':'color:var(--red)'}">🔴 ${t('vender','Vender')}</button>
          <button class="btn-del" onclick="borrarAsset('${a.id}')" style="${hasBgImg?'background:rgba(255,80,80,0.25);color:#fca5a5;':''}"></button>
        `:`
          <button class="btn-del" onclick="borrarAsset('${a.id}')" style="${hasBgImg?'background:rgba(255,80,80,0.25);color:#fca5a5;':''};margin-left:auto">${t('eliminar','Eliminar')}</button>
        `}
      </div>
      </div>
    </div>`
  }

  document.getElementById('content').innerHTML = `
  <div class="section-header" style="margin-bottom:16px">
    <div>
      <div class="page-h1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.85"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> ${t('patrimonio_neto','Patrimonio Neto')}</div>
      <div class="page-sub">${t('pat_page_sub','Vista completa de tu riqueza financiera')}</div>
    </div>
  </div>

  <!-- NET WORTH HERO -->
  <div class="pat-hero">
    <div class="pat-nw-label">${t('patrimonio_neto','Patrimonio Neto Total')}</div>
    <div class="pat-nw-row">
      <div class="pat-nw-value">${eur(pat)}</div>
    </div>
    <div class="pat-breakdown">
      <div class="pat-bd-item">
        <div class="pat-bd-label">💰 ${t('liquidez','Liquidez')}</div>
        <div class="pat-bd-value" style="color:var(--accent)">${eur(dis)}</div>
      </div>
      <div class="pat-bd-item">
        <div class="pat-bd-label">📈 ${t('nav_inversiones','Inversiones')}</div>
        <div class="pat-bd-value" style="color:var(--indigo)">${eur(cartera)}</div>
      </div>
      <div class="pat-bd-item">
        <div class="pat-bd-label">🏠 ${t('activos_fisicos','Activos físicos')}</div>
        <div class="pat-bd-value" style="color:var(--gold)">${eur(assetsVal)}</div>
      </div>
      <div class="pat-bd-item">
        <div class="pat-bd-label">${t('deudas_lbl')}</div>
        <div class="pat-bd-value" style="color:${deuda>0?'var(--red)':'var(--green)'}">${deuda>0?'−'+eur(deuda):t('sin_deudas','Sin deudas ✅')}</div>
      </div>
    </div>
  </div>

  <!-- NET WORTH COMPARISON & EXPLANATION -->
  <div class="card" style="margin-bottom:16px">
    <div class="nw-range-row">
      ${['1M','3M','6M','1A','TODO'].map(r=>`<button type="button" class="nw-range-btn ${r===_nwRange?'active':''}" data-range="${r}" onclick="_setNwRange('${r}')">${r==='TODO'?t('rango_todo','Todo'):r}</button>`).join('')}
    </div>
    <div id="nwComparisonBody">${_renderNetWorthComparisonBody()}</div>
  </div>

  <!-- SPLIT VIEW: LEFT = Accounts + Investments + Evolution (Physical Assets now full-width below) -->
  <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:16px" class="pat-split-grid">

    <!-- LEFT PANEL -->
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Accounts -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${t('cuentas_lbl')}</div>
            <div class="card-subtitle">${t('total_liquidez','Total liquidez')}: ${eur(dis)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="goTo('cuentas')" style="font-size:.75rem">${t('gestionar','Gestionar')} →</button>
        </div>
        ${cuentasHtml||(window.mnEmptyStates ? window.mnEmptyStates.cuentas() : '<div class="empty"><div class="empty-icon">🏦</div><div class="empty-title">Sin cuentas</div></div>')}
      </div>

      <!-- Investments summary -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📈 ${t('activos_financieros','Activos Financieros')}</div>
            <div class="card-subtitle">${t('cartera_inversion','Cartera de inversión')}</div>
          </div>
          <span class="pat-inv-link" onclick="goTo('inversiones')">${t('ver_detalle','Ver detalle')} →</span>
        </div>
        <div class="kpi-grid kpi-grid-3" style="margin-bottom:0">
          <div class="kpi-card">
            <div class="kpi-label">${t('inv_capital_invertido','Capital')}</div>
            <div class="kpi-value sm">${eur(totalInv)}</div>
            <div class="kpi-sub">${invAbiertas.length} ${t('inv_activas','activas')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${t('inv_ganancia_latente','Ganancia latente')}</div>
            <div class="kpi-value sm" style="color:${totalRet>=0?'var(--green)':'var(--red)'}">${totalRet>=0?'+':''}${eur(totalRet)}</div>
            <div class="kpi-sub">${t('no_realizada','No realizada')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${t('rendimiento','Rendimiento')}</div>
            <div class="kpi-value sm" style="color:${roiPct>=0?'var(--green)':'var(--red)'}">${roiPct>=0?'+':''}${pct(roiPct)}</div>
            <div class="kpi-sub">${t('realizado','Realizado')}: ${eur(totalRealiz)}</div>
          </div>
        </div>
      </div>

      <!-- Wealth evolution chart -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 ${t('evolucion_patrimonio','Evolución del patrimonio')}</div>
          <div class="card-subtitle">${t('ultimos_12_meses','Últimos 12 meses')}</div>
        </div>
        ${S.patrimonio_hist.length>=2
          ?`<div class="chart-container"><canvas id="chartPatrimonioPage"></canvas></div>`
          :(window.mnEmptyStates ? window.mnEmptyStates.pocoDatos() : `<div class="empty"><div class="empty-icon">📈</div><div class="empty-title">Pocos datos</div></div>`)}
      </div>
    </div>
  </div>

  <!-- PHYSICAL ASSETS — full-width section, visual grid like Objetivos -->
  <div class="section-header" style="margin-bottom:16px;margin-top:8px">
    <div>
      <div class="card-title" style="font-size:1.05rem">🏠 ${t('activos_fisicos','Activos Físicos')}</div>
      <div class="card-subtitle">${activeAssets.length} ${t('activos','activos')} · ${eur(assetsVal)}</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="openModal('assetModal');resetAssetForm()">${t('btn_nuevo_activo','+ Añadir activo')}</button>
  </div>
  ${activeAssets.length
    ? `<div class="grid-3">${activeAssets.map(a=>renderAssetCard(a,false)).join('')}</div>`
    : (window.mnEmptyStates ? window.mnEmptyStates.activos() : '<div class="empty"><div class="empty-icon">🏠</div><div class="empty-title">Sin activos físicos</div></div>')}
  ${soldAssets.length?`
  <details style="margin-top:16px">
    <summary style="font-size:.78rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;cursor:pointer;padding:10px 2px;border-top:1px solid var(--border)">
      📦 ${t('ver_vendidos','Ver')} ${soldAssets.length} ${soldAssets.length!==1?t('activos_vendidos_pl','activos vendidos'):t('activo_vendido_sg','activo vendido')}
    </summary>
    <div class="grid-3" style="opacity:.75;margin-top:10px">${soldAssets.map(a=>renderAssetCard(a,true)).join('')}</div>
  </details>`:''}`

  if (S.patrimonio_hist.length >= 2) {
    setTimeout(renderChartPatrimonioPage, 80)
  }
}

function renderChartPatrimonioPage() {
  const ctx = document.getElementById('chartPatrimonioPage')
  if (!ctx) return
  destroyChart('chartPatrimonioPage')
  const hist = S.patrimonio_hist.slice(-12)
  const labels = hist.map(h => monthLabel(h.mes))
  const data   = hist.map(h => h.valor)
  const minVal = Math.min(...data.filter(v => v != null))
  const maxVal = Math.max(...data.filter(v => v != null))
  const yPad   = (maxVal - minVal) * 0.15 || Math.abs(maxVal) * 0.15 || 100

  charts['chartPatrimonioPage'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t('patrimonio_neto', 'Patrimonio neto'),
        data,
        borderColor: '#00D4AA',
        backgroundColor: c => {
          try {
            const h2 = c.chart.chartArea?.bottom || 300
            const g = c.chart.ctx.createLinearGradient(0, 0, 0, h2)
            g.addColorStop(0, 'rgba(0,212,170,0.25)')
            g.addColorStop(0.6, 'rgba(0,212,170,0.06)')
            g.addColorStop(1, 'rgba(0,212,170,0)')
            return g
          } catch { return 'rgba(0,212,170,0.1)' }
        },
        fill: true, tension: 0.42,
        pointRadius: 5, pointHoverRadius: 7,
        pointBackgroundColor: '#00D4AA',
        pointBorderColor: 'transparent',
        pointBorderWidth: 2,
        borderWidth: 2.5, spanGaps: true,
      }]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins,
        tooltip: { ...chartDefaults().plugins.tooltip,
          callbacks: {
            title: i => i[0].label,
            label: c => ' Patrimonio: ' + eur(c.raw),
            afterLabel: c => {
              const idx = c.dataIndex
              if (idx === 0) return ''
              const prev = data[idx - 1]
              if (prev == null) return ''
              const delta = c.raw - prev
              return (delta >= 0 ? ' ▲ +' : ' ▼ ') + eur(Math.abs(delta))
            }
          }
        }
      },
      scales: {
        x: { grid: { color: 'transparent' }, ticks: { color: labelColor(), font: { size: 11 }, autoSkip: true, maxRotation: 60, minRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 12 }, border: { color: 'transparent' } },
        y: { grid: { color: gridColor() }, border: { color: 'transparent' },
          ticks: { color: labelColor(), font: { size: 11 }, callback: v => eur(v) },
          suggestedMin: minVal - yPad,
          suggestedMax: maxVal + yPad,
        }
      }
    }
  })
}

// ─── ASSET CRUD ────────────────────────────────────────────────
function previewAssetModalAvatar(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    if (!checkImageSize(e.target.result)) { input.value = ''; return }
    document.getElementById('assetAvatarData').value = e.target.result
    const prev = document.getElementById('assetModalAvatarPreview')
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`
  }
  reader.readAsDataURL(file)
}
function limpiarAssetModalAvatar() {
  document.getElementById('assetAvatarData').value = ''
  const prev = document.getElementById('assetModalAvatarPreview')
  if (prev) prev.innerHTML = '📦'
  const fi = document.getElementById('assetModalAvatarFile')
  if (fi) fi.value = ''
}

function checkAssetCustomCat() {
  const sel = document.getElementById('assetTipo')
  const box = document.getElementById('assetTipoCustom')
  if (!sel || !box) return
  box.style.display = sel.value === '__custom__' ? 'block' : 'none'
}

function resetAssetForm() {
  document.getElementById('assetId').value = ''
  document.getElementById('assetModalTitle').textContent = t('modal_activo_nuevo')
  document.getElementById('assetNombre').value = ''
  document.getElementById('assetTipo').value = 'vehicle'
  document.getElementById('assetTipoCustom').style.display = 'none'
  document.getElementById('assetTipoCustomInput').value = ''
  document.getElementById('assetValorCompra').value = ''
  document.getElementById('assetValor').value = ''
  document.getElementById('assetFecha').value = ''
  document.getElementById('assetFechaVenta').value = ''
  document.getElementById('assetEstado').value = 'active'
  document.getElementById('assetNotas').value = ''
  document.getElementById('assetDepPct').value = ''
  document.getElementById('assetDepPct').disabled = true
  document.getElementById('assetAvatarData').value = ''
  const avPrev = document.getElementById('assetModalAvatarPreview')
  if (avPrev) avPrev.innerHTML = '📦'
  const sw = document.getElementById('depToggleSwitch')
  if (sw) sw.classList.remove('on')
}

function toggleDepreciacion() {
  const sw  = document.getElementById('depToggleSwitch')
  const inp = document.getElementById('assetDepPct')
  if (!sw || !inp) return
  const isOn = sw.classList.toggle('on')
  inp.disabled = !isOn
  if (!isOn) inp.value = ''
}

function editarAsset(id) {
  const a = (S.assets||[]).find(x=>x.id===id)
  if (!a) return
  resetAssetForm()
  document.getElementById('assetId').value = id
  document.getElementById('assetModalTitle').textContent = t('modal_activo_editar')
  document.getElementById('assetNombre').value = a.nombre||''
  // Handle legacy tipo values
  const tipoVal = a.tipo==='car'?'vehicle':a.tipo==='house'?'property':a.tipo||'other'
  document.getElementById('assetTipo').value = tipoVal
  if (a.tipoCustom) {
    document.getElementById('assetTipo').value = '__custom__'
    document.getElementById('assetTipoCustom').style.display = 'block'
    document.getElementById('assetTipoCustomInput').value = a.tipoCustom
  }
  document.getElementById('assetValorCompra').value = a.valorCompra||a.valor||''
  document.getElementById('assetValor').value  = a.valor||''
  document.getElementById('assetFecha').value  = a.fecha||''
  document.getElementById('assetFechaVenta').value = a.fechaVenta||''
  document.getElementById('assetEstado').value = a.status||'active'
  document.getElementById('assetNotas').value  = a.notas||''
  if (a.avatar && a.avatar.startsWith('data:')) {
    document.getElementById('assetAvatarData').value = a.avatar
    const prev = document.getElementById('assetModalAvatarPreview')
    if (prev) prev.innerHTML = `<img src="${a.avatar}" style="width:100%;height:100%;object-fit:cover">`
  }
  if (a.depreciacion) {
    const sw = document.getElementById('depToggleSwitch')
    if (sw) sw.classList.add('on')
    document.getElementById('assetDepPct').disabled = false
    document.getElementById('assetDepPct').value = a.depPct||''
  }
  openModal('assetModal')
}

function guardarAsset() {
  const nombre = document.getElementById('assetNombre').value.trim()
  const valor  = parseAmount(document.getElementById('assetValor').value)
  if (!nombre) { toast(t('err_nombre_obligatorio','El nombre es obligatorio'),'error'); return }
  if (isNaN(valor)||valor<0) { toast('Introduce un valor actual válido','error'); return }
  if (!S.assets) S.assets = []
  const id   = document.getElementById('assetId').value
  const depOn = document.getElementById('depToggleSwitch')?.classList.contains('on')
  const tipoSel = document.getElementById('assetTipo').value
  const tipoFinal = tipoSel === '__custom__' ? 'other' : tipoSel
  const tipoCustom = tipoSel === '__custom__' ? document.getElementById('assetTipoCustomInput').value.trim() : null
  const valorCompra = parseAmount(document.getElementById('assetValorCompra').value) || valor
  const avatarData = document.getElementById('assetAvatarData').value || null
  const data = {
    nombre,
    tipo:       tipoFinal,
    tipoCustom: tipoCustom||null,
    valorCompra,
    valor,
    fecha:      document.getElementById('assetFecha').value||null,
    fechaVenta: document.getElementById('assetFechaVenta').value||null,
    status:     document.getElementById('assetEstado').value,
    notas:      document.getElementById('assetNotas').value.trim(),
    depreciacion: depOn,
    depPct: depOn ? parseAmount(document.getElementById('assetDepPct').value)||0 : 0,
    avatar: avatarData
  }
  if (id) {
    const idx = S.assets.findIndex(x=>x.id===id)
    if (idx>=0) S.assets[idx] = {...S.assets[idx],...data}
  } else {
    S.assets.push({id:uid(),...data})
  }
  recordPatrimonio()
  save()
  closeModal('assetModal')
  if (currentPage==='patrimonio') renderPatrimonio()
  toast(t('toast_activo_guardado','Activo guardado ✓'))
}

function borrarAsset(id) {
  confirmar('¿Eliminar este activo?', ()=>{
    S.assets = (S.assets||[]).filter(x=>x.id!==id)
    recordPatrimonio()
    save()
    if (currentPage==='patrimonio') renderPatrimonio()
    toast(t('toast_activo_eliminado','Activo eliminado'))
  }, {titulo:'Eliminar activo',icono:'🗑️'})
}

function marcarAssetVendido(id) {
  const a = (S.assets||[]).find(x=>x.id===id)
  if (!a) return
  // Build account options for the sale proceeds
  const cuentaOpts = S.cuentas.map(c=>`<option value="${c.id}">${c.nombre} (${eur(c.saldo||0)})</option>`).join('')
  const currentVal = (() => {
    let val = Number(a.valor)||0
    if (a.depreciacion && a.depPct && a.fecha) {
      const years = (Date.now()-new Date(a.fecha).getTime())/(1000*60*60*24*365.25)
      val = val*Math.pow(1-(Number(a.depPct)||0)/100,Math.max(0,years))
    }
    return val
  })()

  // Use confirm modal body for sale dialog
  const body = document.getElementById('confirmBody')
  const btn  = document.getElementById('confirmBtn')
  if (!body || !btn) return
  body.innerHTML = `
    <div class="confirm-icon">🏷</div>
    <div class="confirm-title">${t('confirm_title_vender_activo','Vender activo')}</div>
    <div class="confirm-msg" style="text-align:left;margin-top:12px">
      <div style="font-size:.88rem;color:var(--text2);margin-bottom:12px">
        Vender <strong style="color:var(--text)">${a.nombre}</strong> generará un ingreso automático en la cuenta seleccionada.
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label style="font-size:.8rem">Valor de venta (€)</label>
        <input type="text" inputmode="decimal" id="_saleValue" value="${currentVal.toFixed(2)}" step="0.01" min="0" oninput="_sanitizeAmountInput(this)"
          style="width:100%;padding:8px 12px;background:var(--bg2);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:.9rem;margin-top:4px">
      </div>
      <div class="form-group">
        <label style="font-size:.8rem">Cuenta que recibe el dinero *</label>
        <select id="_saleCuenta" style="width:100%;padding:8px 12px;background:var(--bg2);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:.85rem;margin-top:4px">
          <option value="">— Selecciona cuenta —</option>
          ${cuentaOpts}
        </select>
      </div>
    </div>`
  btn.textContent = t('btn_confirmar_venta')
  btn.className = 'btn btn-primary btn-sm'
  btn.onclick = () => {
    const saleVal  = parseAmount(document.getElementById('_saleValue')?.value) || 0
    const cuentaId = document.getElementById('_saleCuenta')?.value
    if (!cuentaId) { toast(t('err_selecciona_cuenta'),'error'); return }
    // Create income transaction
    S.ingresos.push({
      id: uid(),
      concepto: `Venta: ${a.nombre}`,
      importe: saleVal,
      categoria: 'Venta',
      fecha: todayISO(),
      cuentaId,
      status: 'paid',
      notas: `Activo vendido · Valor compra: ${eur(Number(a.valorCompra)||Number(a.valor)||0)}`
    })
    // Update account balance
    const cuenta = getCuenta(cuentaId)
    if (cuenta) cuenta.saldo = (Number(cuenta.saldo)||0) + saleVal
    // Mark asset as sold — precioVenta is the REAL sale price, kept
    // separate from `valor` (last market valuation) so the sale result
    // is always computed from what the asset actually sold for, never
    // from a stale valuation. `valor` itself is left untouched, since a
    // valuation update is conceptually different from a sale and its
    // history shouldn't be overwritten by the sale event.
    a.status = 'sold'
    a.fechaVenta = todayISO()
    a.precioVenta = saleVal
    recordPatrimonio()
    save()
    closeModal('confirmModal')
    render()
    toast(`Activo vendido · +${eur(saleVal)} ingresado ✓`)
  }
  openModal('confirmModal')
}

function quickUpdateAssetValue(id) {
  const a = (S.assets||[]).find(x=>x.id===id)
  if (!a) return
  const body = document.getElementById('confirmBody')
  const btn  = document.getElementById('confirmBtn')
  if (!body || !btn) return
  body.innerHTML = `
    <div class="confirm-icon">💰</div>
    <div class="confirm-title">${t('confirm_title_actualizar_valor','Actualizar valor actual')}</div>
    <div class="confirm-msg" style="text-align:left;margin-top:12px">
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:10px"><strong>${a.nombre}</strong> — Valor actual: <strong>${eur(Number(a.valor)||0)}</strong></div>
      <div class="form-group">
        <label style="font-size:.8rem">Nuevo valor de mercado (€)</label>
        <input type="text" inputmode="decimal" id="_quickVal" value="${a.valor||''}" step="0.01" min="0" oninput="_sanitizeAmountInput(this)"
          style="width:100%;padding:8px 12px;background:var(--bg2);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:.9rem;margin-top:4px">
      </div>
    </div>`
  btn.textContent = t('btn_actualizar','✓ Actualizar')
  btn.className = 'btn btn-primary btn-sm'
  btn.onclick = () => {
    const newVal = parseAmount(document.getElementById('_quickVal')?.value)
    if (isNaN(newVal) || newVal < 0) { toast(t('err_valor_invalido','Valor inválido'),'error'); return }
    a.valor = newVal
    recordPatrimonio()
    save()
    closeModal('confirmModal')
    if (currentPage === 'patrimonio') renderPatrimonio()
    toast(t('toast_valor_actualizado','Valor actualizado') + ': ' + eur(newVal) + ' ✓')
  }
  openModal('confirmModal')
}

function assetIcon(tipo) {
  if (tipo==='car') return {icon:'🚗',bg:'var(--gold-dim)'}
  if (tipo==='house') return {icon:'🏠',bg:'var(--indigo-dim)'}
  return {icon:'📦',bg:'var(--border)'}
}

// ─── RENDER: full routing ──────────────────────────────────────
function renderBilling() { renderConfiguracion(); }

function render() {
  if (!S) return // Safety: S must be loaded before rendering
  // En modo demo siempre mostrar todo el período para ver datos históricos
  if (isDemoMode() && (window._gTimePeriod === 'month' || window._gTimePeriod === 'lastmonth')) {
    window._gTimePeriod = 'year'
  }
  updateTopBar()
  updateBadges()
  syncBottomNav(currentPage)
  // Show or hide demo mode FAB
  const hasDemoFab  = !!document.getElementById('demoFab')
  const hasRealFab  = !!document.getElementById('demoFabReal')
  const isDemo      = isDemoMode()
  if (isDemo && !hasDemoFab)  _renderDemoFab()
  if (!isDemo && !hasRealFab) _renderDemoFab()
  const fn = {
    dashboard:    renderDashboard,
    ingresos:     renderIngresos,
    gastos:       renderGastos,
    inversiones:  renderInversiones,
    deudas:       renderDeudas,
    objetivos:    renderObjetivos,
    presupuestos: renderPresupuestos,
    cuentas:      renderCuentas,
    categorias:   renderCategorias,
    revision:     renderRevision,
    calendario:   renderCalendario,
    analisis:     renderAnalisis,
    configuracion:renderConfiguracion,
    // billing: removed
    patrimonio:   renderPatrimonio,
    faq:          renderFAQ,
    sugerencias:  renderFAQ,
    logros:       renderLogros,
    facturacion:  renderFacturacion,
  }
  const pageKeyMap = {
    dashboard:'nav_dashboard', ingresos:'nav_ingresos', gastos:'nav_gastos',
    inversiones:'nav_inversiones', deudas:'nav_deudas', objetivos:'nav_objetivos',
    presupuestos:'nav_presupuestos', cuentas:'nav_cuentas', categorias:'nav_categorias',
    revision:'nav_revision', calendario:'nav_calendario',
    analisis:'nav_analisis', configuracion:'nav_configuracion',
    patrimonio:'nav_patrimonio', faq:'nav_faq', sugerencias:'nav_sugerencias', billing:'nav_billing',
    logros:'nav_logros', facturacion:'nav_facturacion',
  }
  const el = document.getElementById('pageTitle')
  if (el) el.textContent = pageKeyMap[currentPage] ? t(pageKeyMap[currentPage]) : currentPage
  if (typeof _updateRevisionBadges === 'function') _updateRevisionBadges()
  const renderFn = fn[currentPage]
  if (renderFn) {
    destroyAllCharts()
    document.getElementById('content').innerHTML = ''
    renderFn()
    if (currentPage === 'analisis') setTimeout(renderProjectionChart, 80)
    // KPI counter animations — dashboard only
    if (currentPage === 'dashboard' && window.MNKPIAnimator) {
      requestAnimationFrame(() => {
        window.MNKPIAnimator.runDashboardAnimations()
        // Animate health score ring + number
        const scoreEl = document.getElementById('healthScoreNum')
        const ringEl  = document.getElementById('healthRingFill')
        if (scoreEl && ringEl) {
          const target      = parseInt(scoreEl.getAttribute('data-score') || '0') || 0
          const arcLen      = parseFloat(ringEl.getAttribute('stroke-dasharray')) || 100
          const finalOffset = parseFloat(ringEl.getAttribute('data-final-offset') || String(arcLen)) || 0
          if (target > 0) {
            let start = null
            scoreEl.textContent = '0'
            ringEl.style.strokeDashoffset = String(arcLen)
            const duration = 900
            requestAnimationFrame(function anim(ts) {
              if (!start) start = ts
              const p = Math.min((ts - start) / duration, 1)
              const ease = 1 - Math.pow(2, -10 * p)
              scoreEl.textContent = String(Math.round(target * ease))
              ringEl.style.strokeDashoffset = String(arcLen - (arcLen - finalOffset) * ease)
              if (p < 1) requestAnimationFrame(anim)
              else { scoreEl.textContent = String(target); ringEl.style.strokeDashoffset = String(finalOffset) }
            })
          }
        }
        // Animate EOM value
        if (window.MNKPIAnimator) window.MNKPIAnimator.runDashboardAnimations()
        // Sparklines desactivados por petición del usuario
      })
    }
  }
}

// ─── PATCH: init() — personal-only ─────────────────────────────
// ─── FINANCIAL HEALTH SCORE ────────────────────────────────────
function calcHealthScore() {
  const m  = currentMonth()
  const mp = prevMonth(m)
  const ing  = calcIngresosMes(m)
  const gas  = calcGastosMes(m)
  const ingP = calcIngresosMes(mp)
  const gasP = calcGastosMes(mp)

  // Need at least some data to compute a meaningful score
  const totalTx = S.ingresos.length + S.gastos.length
  if (totalTx < 3) return 0

  // ── FACTOR 1: Savings rate (weight 40 pts) ─────────────────────
  let f1 = 0
  if (ing > 0) {
    const sr = (ing - gas) / ing * 100
    if (sr >= 30)      f1 = 40
    else if (sr >= 20) f1 = 32
    else if (sr >= 10) f1 = 22
    else if (sr >= 0)  f1 = 10
    else               f1 = 0   // deficit
  }

  // ── FACTOR 2: Expense stability month-over-month (weight 20 pts) ─
  let f2 = 10 // neutral if no previous month data
  if (gasP > 0 && gas > 0) {
    const variation = Math.abs(gas - gasP) / gasP * 100
    if (variation <= 10)      f2 = 20
    else if (variation <= 20) f2 = 15
    else if (variation <= 35) f2 = 8
    else                      f2 = 2
  }

  // ── FACTOR 3: Category balance — no single cat > 50% of expenses (weight 20 pts) ─
  let f3 = 20
  if (gas > 0) {
    const catMap = gastosMesByCat(m)
    const topVal = Math.max(...Object.values(catMap).map(Number))
    const topPct = topVal / gas * 100
    if (topPct > 80)      f3 = 2
    else if (topPct > 65) f3 = 8
    else if (topPct > 50) f3 = 14
    else                  f3 = 20
  }

  // ── FACTOR 4: Recurring burden — % of income locked in recurring (weight 20 pts) ─
  let f4 = 20
  if (ing > 0) {
    const recurringGas = S.gastos
      .filter(g => g.recurrente && (g.fecha||'').startsWith(m))
      .reduce((a,g) => a + (Number(g.importe)||0), 0)
    const recurPct = recurringGas / ing * 100
    if (recurPct <= 30)      f4 = 20
    else if (recurPct <= 45) f4 = 14
    else if (recurPct <= 60) f4 = 8
    else                     f4 = 2
  }

  return Math.min(100, Math.max(0, Math.round(f1 + f2 + f3 + f4)))
}

// Returns the 4 individual factor scores for display purposes
function calcHealthFactors() {
  const m  = currentMonth()
  const mp = prevMonth(m)
  const ing  = calcIngresosMes(m)
  const gas  = calcGastosMes(m)
  const gasP = calcGastosMes(mp)

  const sr = ing > 0 ? (ing - gas) / ing * 100 : 0
  const savingsOk = sr >= 20

  let stabilityOk = true
  if (gasP > 0 && gas > 0) {
    stabilityOk = Math.abs(gas - gasP) / gasP * 100 <= 20
  }

  let balanceOk = true
  if (gas > 0) {
    const catMap = gastosMesByCat(m)
    const topVal = Math.max(...Object.values(catMap).map(Number))
    balanceOk = topVal / gas * 100 <= 50
  }

  let recurOk = true
  if (ing > 0) {
    const rec = S.gastos.filter(g=>g.recurrente&&(g.fecha||'').startsWith(m)).reduce((a,g)=>a+(Number(g.importe)||0),0)
    recurOk = rec / ing * 100 <= 45
  }

  return [
    { label: 'Ahorro',      ok: savingsOk },
    { label: 'Estabilidad', ok: stabilityOk },
    { label: 'Distribución',ok: balanceOk },
    { label: 'Fijos',       ok: recurOk },
  ]
}

function healthScoreLabel(score) {
  if (score >= 80) return { label: '¡Excelente!',  color: 'var(--green)' }
  if (score >= 65) return { label: 'Muy buena',    color: 'var(--accent)' }
  if (score >= 45) return { label: 'En progreso',  color: 'var(--gold)' }
  if (score >= 25) return { label: 'Mejorable',    color: 'var(--gold)' }
  if (score === 0) return { label: 'Sin datos',    color: 'var(--text3)' }
  return             { label: 'Crítica',           color: 'var(--red)' }
}

function renderHealthScore() {
  const score   = calcHealthScore()
  const factors = calcHealthFactors()
  const { label, color } = healthScoreLabel(score)
  const eom = calcEOMBalance()

  // Círculo simple — radio 20, circunferencia ≈ 125.66
  const R = 20
  const C = 2 * Math.PI * R   // ≈ 125.66
  const filled = score > 0 ? (score / 100) * C : 0
  const dashOffset = C - filled  // parte vacía al final

  const factorDots = factors.map(f => `
    <div class="hsc-factor">
      <div class="hsc-factor-dot" style="background:${f.ok ? 'var(--green)' : 'var(--red)'}"></div>
      <span>${f.label}</span>
    </div>`).join('')

  return `<div class="health-score-compact">
    <div class="hsc-ring-wrap">
      <svg width="50" height="50" viewBox="0 0 50 50" style="transform:rotate(-90deg)">
        <!-- Track — círculo completo como base -->
        <circle cx="25" cy="25" r="${R}"
          fill="none"
          stroke="var(--border2)"
          stroke-width="4"/>
        <!-- Fill — mismo origen, se anima con stroke-dashoffset -->
        <circle cx="25" cy="25" r="${R}"
          fill="none"
          stroke="${color}"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray="${C.toFixed(2)}"
          stroke-dashoffset="${C.toFixed(2)}"
          id="healthRingFill"
          data-final-offset="${dashOffset.toFixed(2)}"/>
      </svg>
      <div class="hsc-num" id="healthScoreNum" data-score="${score}">${score > 0 ? '0' : '—'}</div>
    </div>
    <div class="hsc-info">
      <div class="hsc-title">${t('salud_financiera')}</div>
      <div class="hsc-label" style="color:${color}">${label}</div>
      <div class="hsc-factors">${factorDots}</div>
    </div>
    <div class="hsc-eom">
      <div class="hsc-eom-label">${t('fin_de_mes')}</div>
      <div class="hsc-eom-val" data-animate-raw="${eom}" style="color:${eom>=0?'var(--accent)':'var(--red)'}">${eom>=0?'+':''}${eur(eom)}</div>
      <div class="hsc-eom-sub">${eom>=0?t('estimado'):t('posible_deficit')}</div>
    </div>
  </div>`
}

// ─── END OF MONTH BALANCE PREDICTION ───────────────────────────
function calcEOMBalance() {
  const m = currentMonth()
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate()
  const dayOfMonth  = today.getDate()
  const daysLeft    = daysInMonth - dayOfMonth
  const hoyStr      = today.toISOString().slice(0,10)

  // 1. Base: saldo real actual en todas las cuentas
  const saldoActual = calcDineroDisponible()

  // 2. Ingresos pendientes de cobro este mes (status 'pending' con fecha en el mes)
  const ingresosPendientes = S.ingresos
    .filter(i => i.status === 'pending' && (i.fecha||'').startsWith(m))
    .reduce((a,i) => a + (Number(i.importe)||0), 0)

  // 3. Gastos recurrentes que faltan por ocurrir este mes
  const gastosRecurrentesPendientes = S.gastos
    .filter(g => {
      if (g.tipo === TX_TYPES.GOAL_TRANSFER) return false
      if (!g.recurrente) return false
      // Tiene fecha futura en el mes actual
      if ((g.fecha||'').startsWith(m) && g.fecha > hoyStr) return true
      // Es recurrente de meses anteriores (se asume que repetirá)
      if (g.fecha && g.fecha < hoyStr && !(g.fecha||'').startsWith(m)) return true
      return false
    })
    .reduce((a,g) => a + (Number(g.importe)||0), 0)

  // 4. Proyección conservadora del gasto no-recurrente restante
  //    (ritmo diario de lo ya gastado × días que quedan × 0.7)
  const gastosMes   = calcGastosMes(m)
  const gastosDiario = dayOfMonth > 0 ? gastosMes / dayOfMonth : 0
  const gastosRestantes = gastosDiario * daysLeft * 0.7

  return Math.round(saldoActual + ingresosPendientes - gastosRecurrentesPendientes - gastosRestantes)
}

// ─── STREAK TRACKING ───────────────────────────────────────────
function updateStreak() {
  const today = todayISO()
  if (!S.streak) S.streak = { count: 0, lastDate: '' }
  if (S.streak.lastDate === today) return // already recorded today
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yd = yesterday.toISOString().slice(0,10)
  if (S.streak.lastDate === yd) {
    S.streak.count = (S.streak.count || 0) + 1
  } else if (S.streak.lastDate !== today) {
    S.streak.count = 1
  }
  S.streak.lastDate = today
  save()
  if (window.MNGamification) MNGamification.checkAchievement('streak')
}

function getStreak() {
  if (!S.streak) return 0
  const today = todayISO()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yd = yesterday.toISOString().slice(0,10)
  if (S.streak.lastDate !== today && S.streak.lastDate !== yd) return 0
  return S.streak.count || 0
}

// ─── TIP OF THE DAY ────────────────────────────────────────────
const TIPS = [
  { icon:'💡', text:'<strong>Regla del 50/30/20:</strong> destina el 50% a necesidades, 30% a deseos y 20% a ahorro e inversión.' },
  { icon:'🏦', text:'<strong>Fondo de emergencia:</strong> mantén entre 3 y 6 meses de gastos en una cuenta de fácil acceso.' },
  { icon:'📈', text:'<strong>Interés compuesto:</strong> con la regla del 72, divide 72 entre tu rentabilidad anual para saber en cuántos años doblas tu dinero.' },
  { icon:'🔄', text:'<strong>Gastos recurrentes:</strong> revisa tus suscripciones cada trimestre. El coste medio oculto es de 180€/año.' },
  { icon:'🎯', text:'<strong>Objetivos SMART:</strong> tus metas financieras deben ser específicas, medibles y con fecha límite.' },
  { icon:'💳', text:'<strong>Deuda buena vs mala:</strong> la deuda que genera valor (formación, vivienda) es diferente a la de consumo.' },
  { icon:'🌍', text:'<strong>Diversificación:</strong> no concentres más del 5% de tu cartera en un solo activo.' },
  { icon:'📉', text:'<strong>Método bola de nieve:</strong> paga primero la deuda más pequeña para ganar impulso psicológico.' },
  { icon:'⚡', text:'<strong>Automatiza el ahorro:</strong> transfiere a ahorro el mismo día que cobras, antes de gastar.' },
  { icon:'🏠', text:'<strong>Vivienda:</strong> el coste total (hipoteca + gastos) no debería superar el 28-30% de tus ingresos.' },
  { icon:'🔮', text:'<strong>Inflación:</strong> el dinero parado pierde valor. Una inflación del 3% hace que en 24 años pierda la mitad de su poder adquisitivo.' },
  { icon:'📅', text:'<strong>Revisión mensual:</strong> 15 minutos al mes revisando tus finanzas vale más que cualquier app.' },
]
function getTipOfDay() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000)
  return TIPS[dayOfYear % TIPS.length]
}

// ─── MONTH SUMMARY (first access of new month) ─────────────────
function checkMonthSummary() {
  const m = currentMonth()
  if (!S._lastRenderedMonth) { S._lastRenderedMonth = m; save(); return null }
  if (S._lastRenderedMonth === m) return null
  // New month! Generate summary of previous month
  const prevM = S._lastRenderedMonth
  S._lastRenderedMonth = m
  save()
  const ingP = calcIngresosMes(prevM)
  const gasP = calcGastosMes(prevM)
  const cfP  = ingP - gasP
  const srP  = ingP > 0 ? Math.round((cfP/ingP)*100) : 0
  const catMap = gastosMesByCat(prevM)
  const topCat = Object.entries(catMap).sort((a,b)=>b[1]-a[1])[0]
  return { prevM, ingP, gasP, cfP, srP, topCat }
}

function renderMonthSummaryBanner(summary) {
  if (!summary) return ''
  const { prevM, ingP, gasP, cfP, srP, topCat } = summary
  return `<div class="month-summary-banner" id="monthSummaryBanner">
    <button class="month-summary-close" onclick="document.getElementById('monthSummaryBanner').remove()">✕</button>
    <div class="msb-title">📅 Tu resumen de ${monthLabel(prevM)}</div>
    <div class="msb-stats">
      <div class="msb-stat">Ingresaste <strong style="color:var(--green)">${eur(ingP)}</strong></div>
      <div class="msb-stat">Gastaste <strong style="color:var(--red)">${eur(gasP)}</strong></div>
      <div class="msb-stat">Ahorraste <strong style="color:var(--accent)">${eur(Math.max(0,cfP))}</strong> (${srP}%)</div>
      ${topCat ? `<div class="msb-stat">Mayor gasto: <strong>${topCat[0]}</strong> (${eur(topCat[1])})</div>` : ''}
    </div>
  </div>`
}

// ─── ANIMATED KPI COUNTER ──────────────────────────────────────
function animateCounter(el, target) {
  if (!el) return
  const isEur = target.includes('€')
  const num = parseAmount(target) || 0
  const start = 0
  const duration = 700
  const startTime = performance.now()
  el.classList.add('anim')
  function step(now) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    const current = start + (num - start) * ease
    el.textContent = isEur ? fmt(current) + '\u00A0€' : fmt(current)
    if (progress < 1) requestAnimationFrame(step)
    else el.textContent = target
  }
  requestAnimationFrame(step)
}

// ─── BOTTOM NAV SYNC ───────────────────────────────────────────
function syncBottomNav(page) {
  const map = {
    dashboard:    'bn-dashboard',
    gastos:       'bn-gastos',
    analisis:     'bn-analisis',
    // billing: removed
    configuracion:'bn-config'
  }
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'))
  const id = map[page]
  if (id) { const el = document.getElementById(id); if (el) el.classList.add('active') }
}

// ─── QUICK ADD FUNCTIONALITY ────────────────────────────────────
let _qaType = 'gasto'
let _qaCat  = ''

function openQuickAdd() {
  if (isGuest()) { _showGuestGateModal(); return }
  _qaType = 'gasto'
  _qaCat  = ''
  document.getElementById('quickAmount').value = ''
  document.getElementById('quickConcepto').value = ''
  setQuickType('gasto')
  document.getElementById('quickAddModal').classList.add('open')
  setTimeout(() => {
    document.getElementById('quickAmount').focus()
    document.dispatchEvent(new CustomEvent('mn:quickadd:open'))
    if (window.MNPremiumFeatures) window.MNPremiumFeatures.initQuickAddPredictor()
  }, 120)
}

function closeQuickAdd() {
  document.getElementById('quickAddModal').classList.remove('open')
}

function setQuickType(type) {
  _qaType = type
  _qaCat  = ''
  document.getElementById('qat-gasto').className = 'quick-add-type' + (type==='gasto'?' gasto-active':'')
  document.getElementById('qat-ingreso').className = 'quick-add-type' + (type==='ingreso'?' active':'')
  const cats = type === 'gasto'
    ? (S.categorias.gasto || [])
    : (S.categorias.ingreso || [])
  const activeClass = type === 'gasto' ? 'gasto-active' : 'active'
  document.getElementById('quickCatRow').innerHTML = cats.map(c =>
    `<div class="quick-cat-btn" onclick="selectQuickCat('${c}',this,'${activeClass}')">${catEmoji(c)} ${c}</div>`
  ).join('')
}

function selectQuickCat(cat, el, activeClass) {
  _qaCat = cat
  document.querySelectorAll('#quickCatRow .quick-cat-btn').forEach(b => b.className='quick-cat-btn')
  el.className = `quick-cat-btn ${activeClass}`
}

function saveQuickAdd() {
  if (isGuest()) { closeQuickAdd(); _showGuestGateModal(); return }
  const importe = parseAmount(document.getElementById('quickAmount').value)
  if (!importe || importe <= 0) { toast('Introduce un importe válido','error'); return }
  const concepto = document.getElementById('quickConcepto').value.trim() || (_qaCat || (_qaType==='gasto'?'Gasto':'Ingreso'))
  const cat = _qaCat || (_qaType==='gasto' ? 'Otro' : 'Otro')
  const fecha = todayISO()
  if (_qaType === 'gasto') {
    S.gastos.push({ id:uid(), concepto, importe, categoria:cat, fecha, recurrente:false })
    // Deduct from first account
    if (S.cuentas.length) S.cuentas[0].saldo = (Number(S.cuentas[0].saldo)||0) - importe
  } else {
    S.ingresos.push({ id:uid(), concepto, importe, categoria:cat, fecha, status:'cobrado' })
    if (S.cuentas.length) S.cuentas[0].saldo = (Number(S.cuentas[0].saldo)||0) + importe
  }
  save()
  updateStreak()
  closeQuickAdd()
  render()
  toast((_qaType==='gasto'?t('nav_gastos','Gasto'):t('nav_ingresos','Ingreso')) + ' ' + eur(importe) + ' ✓')
  // Haptic feedback on mobile
  if (navigator.vibrate) navigator.vibrate(10)
}

// ─── TITLE WITH AVAILABLE BALANCE ──────────────────────────────
function updateDocTitle() {
  const dis = calcDineroDisponible()
  document.title = `MoneyNest · ${eur(dis)}`
}

// ═══════════════════════════════════════════════════════════════
// MINI INTRO — runs every app open, max 1.5s, skippable
// Completely separate from runCinematicIntro (first-time only)
// ═══════════════════════════════════════════════════════════════
function runMiniIntro(onComplete) {
  const overlay  = document.getElementById('mnMiniIntro')
  const stage    = document.getElementById('mnMiniStage')
  const logo     = document.getElementById('mnMiniLogo')
  const svg      = document.getElementById('mnMiniSvg')
  const wordmark = document.getElementById('mnMiniWordmark')
  const tagline  = document.getElementById('mnMiniTagline')
  const appEl    = document.querySelector('.app')

  // Safety: if elements missing, skip immediately
  if (!overlay || !stage) { if (onComplete) onComplete(); return }

  let done = false

  // ── Apply blur to app shell behind the overlay ─────────────────
  if (appEl) appEl.classList.add('mn-intro-blur')

  // ── SKIP handler — click or scroll dismisses immediately ────────
  function skip() {
    if (done) return
    done = true
    cleanup()
    if (onComplete) onComplete()
  }

  function cleanup() {
    // Remove blur transition class from app
    if (appEl) {
      appEl.classList.add('mn-intro-unblur')
      // Remove blur classes after transition ends
      setTimeout(() => {
        appEl.classList.remove('mn-intro-blur', 'mn-intro-unblur')
      }, 320)
    }
    // Fade out overlay + stage simultaneously
    stage.classList.add('mn-stage-out')
    overlay.classList.add('mn-exiting')
    // Remove from DOM after exit transition
    setTimeout(() => {
      overlay.remove()
    }, 280)
    // Remove listeners
    document.removeEventListener('pointerdown', skip, true)
    document.removeEventListener('keydown',     skip, true)
    document.removeEventListener('wheel',       skip, true)
  }

  // Attach skip listeners — use capture so they fire even if intro has pointer-events:all
  document.addEventListener('pointerdown', skip, { capture:true, once:true })
  document.addEventListener('keydown',     skip, { capture:true, once:true })
  document.addEventListener('wheel',       skip, { capture:true, once:true })

  // ── PHASE 1: Trigger entrance animations (rAF guarantees paint first) ──
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Stage scales in
      stage.classList.add('mn-stage-in')
      // Logo slides up
      logo.classList.add('mn-logo-in')
      // SVG strokes draw
      svg.classList.add('mn-svg-run')
      // Wordmark fades up (delay built into CSS)
      wordmark.classList.add('mn-word-in')
      // Tagline fades in last
      tagline.classList.add('mn-tag-in')
    })
  })

  // ── PHASE 2: Hold, then begin exit sequence at 1100ms ──────────
  // Total budget: 1500ms. Exit takes ~280ms. So start exit at 1100ms.
  const holdTimer = setTimeout(() => {
    if (done) return
    done = true
    cleanup()
    if (onComplete) onComplete()
  }, 1100)

  // Failsafe: hard kill at 1600ms no matter what
  setTimeout(() => {
    if (!done) { done = true; cleanup(); if (onComplete) onComplete() }
  }, 1600)
}

function init() {
  // ── Auth: inicializar usuario y verificar acceso ────────────
  initUser()
  const access = checkAccess()
  if (!access.ok) return // bloquearApp() ya fue llamado internamente
  // ──────────────────────────────────────────────────────────
  try { load() } catch(e) { S = defaultState() }
  try { loadLang() } catch(e) {}
  // Guarantee every required field exists — defensive after any crash or corrupt data
  if (!S || typeof S !== 'object') S = defaultState()
  if (!S.usuario || typeof S.usuario !== 'object') S.usuario = defaultState().usuario
  S.usuario.mode = 'personal'
  if (!Array.isArray(S.clientes))   S.clientes   = []
  if (!Array.isArray(S.proveedores)) S.proveedores = []
  if (!Array.isArray(S.devengos))   S.devengos   = []
  if (!Array.isArray(S.assets))     S.assets     = []
  if (!Array.isArray(S.deudaHiddenStrats)) S.deudaHiddenStrats = []
  if (!Array.isArray(S.ingresos))   S.ingresos   = []
  if (!Array.isArray(S.gastos))     S.gastos     = []
  if (!Array.isArray(S.inversiones)) S.inversiones = []
  if (!Array.isArray(S.deudas))     S.deudas     = []
  if (!Array.isArray(S.objetivos))  S.objetivos  = []
  if (!Array.isArray(S.cuentas) || !S.cuentas.length) S.cuentas = defaultState().cuentas
  if (!Array.isArray(S.patrimonio_hist)) S.patrimonio_hist = []
  if (!S.presupuestos || typeof S.presupuestos !== 'object') S.presupuestos = {}
  document.documentElement.setAttribute('lang', _currentLang)
  applyTheme()
  recordPatrimonio()
  updateSidebarLogo()
  updateStreak()
  if (window.MNRecurring) try { MNRecurring.processDueRecurrings() } catch {}
  render()                    // ← app renders first (visible behind overlay)
  _updateSidebarLang()
  translateDOM()              // PASO 3: traduce modales estáticos index.html
  _autoResetFlagsIfEmpty()
  updateDocTitle()
  // Show demo/real FAB
  setTimeout(_renderDemoFab, 400)
  // ── Mini intro runs every open EXCEPT first-time (which uses cinematic intro) ──
  if (_obFlagSeen()) {
    // Returning user: show mini intro, then nothing
    runMiniIntro(() => {})
  } else {
    // First-time user: show onboarding immediately
    const miniEl = document.getElementById('mnMiniIntro')
    if (miniEl) miniEl.remove()
    const appEl = document.querySelector('.app')
    if (appEl) appEl.classList.remove('mn-intro-blur')
    checkOnboarding()
  }
}


// ─── BEFOREUNLOAD: warn if modal open ──────────────────────────
window.addEventListener('beforeunload', function(e) {
  const hasOpenModal = document.querySelector('.modal-overlay.open')
  if (hasOpenModal) {
    e.preventDefault()
    e.returnValue = '¿Seguro que quieres salir? Tienes cambios sin guardar.'
    return e.returnValue
  }
})


// ════════════════════════════════════════════════════════════════
// APP_NAME CONSTANT
// ════════════════════════════════════════════════════════════════
const APP_NAME = 'MoneyNest'

// ════════════════════════════════════════════════════════════════
// ─── MODO HISTORIA — Monthly & Annual Story Slides ────────────
// ════════════════════════════════════════════════════════════════
const MONTHLY_STORY_KEY = 'mn_monthly_story_shown'
const YEARLY_STORY_KEY  = 'mn_yearly_story_shown'

let _smSlides = []
let _smStep   = 0

function _buildMonthlySlides() {
  const now   = new Date()
  const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevKey = prevM.toISOString().slice(0, 7)
  const monthName = prevM.toLocaleString('es', { month: 'long', year: 'numeric' })

  // Gather data from previous month
  const prevIngresos = (S.ingresos || []).filter(i => i.fecha && i.fecha.startsWith(prevKey))
  const prevGastos   = (S.gastos   || []).filter(g => g.fecha && g.fecha.startsWith(prevKey))
  const prevM2       = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
  const prev2Gastos  = (S.gastos   || []).filter(g => g.fecha && g.fecha.startsWith(prevM2))

  const totalIngr = prevIngresos.reduce((a, i) => a + (Number(i.importe) || 0), 0)
  const totalGast = prevGastos  .reduce((a, g) => a + (Number(g.importe) || 0), 0)
  const totalGast2= prev2Gastos .reduce((a, g) => a + (Number(g.importe) || 0), 0)
  const ahorro    = totalIngr - totalGast
  const ahorroSign = ahorro >= 0 ? 'green' : 'red'
  const deltaGast  = totalGast2 > 0 ? ((totalGast - totalGast2) / totalGast2 * 100).toFixed(0) : null

  // Top category
  const catMap = {}
  prevGastos.forEach(g => { const c = g.categoria || 'Otros'; catMap[c] = (catMap[c] || 0) + (Number(g.importe) || 0) })
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]

  const euroFmt = v => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

  // Highlights
  const highlights = []
  if (ahorro > 0) highlights.push({ icon: '💚', text: `Has ahorrado <strong style="color:var(--accent)">€${euroFmt(ahorro)}</strong>`, sub: 'Sigue así — cada euro cuenta' })
  if (ahorro < 0) highlights.push({ icon: '⚠️', text: `Has gastado <strong style="color:var(--red)">€${euroFmt(Math.abs(ahorro))}</strong> más de lo que ingresaste`, sub: 'Intenta reducir gastos el próximo mes' })
  if (topCat) highlights.push({ icon: '📊', text: `Tu categoría top: <strong>${topCat[0]}</strong> (€${euroFmt(topCat[1])})`, sub: 'La partida que más peso tiene' })
  if (deltaGast !== null) {
    const dir = Number(deltaGast) <= 0 ? '📉' : '📈'
    const col = Number(deltaGast) <= 0 ? 'var(--accent)' : 'var(--red)'
    highlights.push({ icon: dir, text: `Gastos ${Number(deltaGast) <= 0 ? 'reducidos' : 'aumentados'} un <strong style="color:${col}">${Math.abs(deltaGast)}%</strong> vs mes anterior`, sub: 'Comparativa mensual' })
  }

  const slides = [
    // Slide 1 — intro
    {
      heroIcon: '📅',
      heroGrad: 'linear-gradient(135deg,rgba(0,212,170,.25),rgba(99,102,241,.15))',
      glowColor: '#00D4AA',
      eyebrow: `Resumen de ${monthName}`,
      title: `Este mes has hecho esto 👇`,
      subtitle: `Aquí está tu resumen financiero de ${monthName}. Tómate un momento para verlo.`,
      extra: `<div class="sm-stats">
        <div class="sm-stat" style="animation-delay:.05s">
          <div class="sm-stat-val" style="color:var(--accent)">€${euroFmt(totalIngr)}</div>
          <div class="sm-stat-lbl">Ingresos</div>
        </div>
        <div class="sm-stat" style="animation-delay:.1s">
          <div class="sm-stat-val" style="color:var(--red)">€${euroFmt(totalGast)}</div>
          <div class="sm-stat-lbl">Gastos</div>
        </div>
        <div class="sm-stat" style="animation-delay:.15s">
          <div class="sm-stat-val" style="color:var(--${ahorroSign === 'green' ? 'accent' : 'red'})">€${euroFmt(ahorro)}</div>
          <div class="sm-stat-lbl">Ahorro neto</div>
          ${deltaGast !== null ? `<div class="sm-stat-delta ${Number(deltaGast) <= 0 ? 'up' : 'down'}">${Number(deltaGast) <= 0 ? '▼' : '▲'} ${Math.abs(deltaGast)}%</div>` : ''}
        </div>
      </div>`
    }
  ]

  // Slide 2 — highlights (if any)
  if (highlights.length > 0) {
    slides.push({
      heroIcon: '✨',
      heroGrad: 'linear-gradient(135deg,rgba(245,158,11,.2),rgba(244,63,94,.1))',
      glowColor: '#F59E0B',
      eyebrow: 'Lo más destacado',
      title: `Tu mes, en detalle`,
      subtitle: 'Los momentos más relevantes de tus finanzas este mes.',
      extra: `<div class="sm-highlights">` +
        highlights.slice(0, 3).map((h, i) =>
          `<div class="sm-highlight" style="animation-delay:${i * .07}s">
            <div class="sm-highlight-icon">${h.icon}</div>
            <div class="sm-highlight-text">${h.text}<span>${h.sub}</span></div>
          </div>`).join('') +
        `</div>`
    })
  }

  // Slide 3 — forward look
  slides.push({
    heroIcon: '🚀',
    heroGrad: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(0,212,170,.15))',
    glowColor: '#6366F1',
    eyebrow: `Nuevo mes, nueva oportunidad`,
    title: '¡Adelante con el nuevo mes!',
    subtitle: ahorro >= 0
      ? `Terminaste en positivo. Mantener este ritmo te acerca a tus objetivos financieros.`
      : `El próximo mes es una nueva oportunidad. Pequeños cambios producen grandes resultados.`,
    extra: ''
  })

  return slides
}

function _buildYearlySlides() {
  const prevYear = new Date().getFullYear() - 1
  const yearStr  = String(prevYear)

  const yIngresos = (S.ingresos  || []).filter(i => i.fecha && i.fecha.startsWith(yearStr))
  const yGastos   = (S.gastos    || []).filter(g => g.fecha && g.fecha.startsWith(yearStr))

  const totalIngr = yIngresos.reduce((a, i) => a + (Number(i.importe) || 0), 0)
  const totalGast = yGastos  .reduce((a, g) => a + (Number(g.importe) || 0), 0)
  const totalAhor = totalIngr - totalGast

  // Monthly breakdown for chart
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${yearStr}-${String(i + 1).padStart(2, '0')}`
    const ing = (S.ingresos || []).filter(x => x.fecha && x.fecha.startsWith(key)).reduce((a, x) => a + (Number(x.importe) || 0), 0)
    const gas = (S.gastos   || []).filter(x => x.fecha && x.fecha.startsWith(key)).reduce((a, x) => a + (Number(x.importe) || 0), 0)
    return { key, ing, gas, sav: ing - gas }
  })

  const bestMonth  = months.reduce((a, b) => b.sav > a.sav ? b : a, months[0])
  const worstMonth = months.reduce((a, b) => b.sav < a.sav ? b : a, months[0])
  const maxVal = Math.max(...months.map(m => Math.max(m.ing, m.gas)), 1)

  const catMap = {}
  yGastos.forEach(g => { const c = g.categoria || 'Otros'; catMap[c] = (catMap[c] || 0) + (Number(g.importe) || 0) })
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]

  const euroFmt = v => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  const barHtml = `
    <div class="sm-year-bars">
      ${months.map((m, i) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%">
          <div class="sm-year-bar" style="width:100%;background:${m.sav >= 0 ? '#00D4AA' : '#F43F5E'};height:${Math.round((Math.max(m.ing, m.gas) / maxVal) * 100)}%"></div>
        </div>`).join('')}
    </div>
    <div class="sm-year-bar-lbl">
      <span>${monthNames[0]}</span><span>${monthNames[5]}</span><span>${monthNames[11]}</span>
    </div>`

  return [
    {
      heroIcon: '🎊',
      heroGrad: 'linear-gradient(135deg,rgba(245,158,11,.3),rgba(244,63,94,.15))',
      glowColor: '#F59E0B',
      eyebrow: `Tu año ${prevYear} en ${APP_NAME}`,
      title: `¡Otro año completado!`,
      subtitle: `Esto es lo que has logrado en ${prevYear}. Tómate un momento para verlo.`,
      extra: `<div class="sm-stats">
        <div class="sm-stat"><div class="sm-stat-val" style="color:var(--accent)">€${euroFmt(totalIngr)}</div><div class="sm-stat-lbl">Ingresos</div></div>
        <div class="sm-stat"><div class="sm-stat-val" style="color:var(--red)">€${euroFmt(totalGast)}</div><div class="sm-stat-lbl">Gastos</div></div>
        <div class="sm-stat"><div class="sm-stat-val" style="color:${totalAhor >= 0 ? 'var(--accent)' : 'var(--red)'}">€${euroFmt(totalAhor)}</div><div class="sm-stat-lbl">Ahorro total</div></div>
      </div>`
    },
    {
      heroIcon: '📊',
      heroGrad: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(0,212,170,.1))',
      glowColor: '#6366F1',
      eyebrow: 'Evolución mensual',
      title: `Mes a mes, aquí tu huella`,
      subtitle: `${bestMonth ? `Tu mejor mes fue ${monthNames[months.indexOf(bestMonth)]} con €${euroFmt(bestMonth.sav)} de ahorro.` : ''}`,
      extra: barHtml + (topCat ? `<div class="sm-highlight" style="margin-top:8px"><div class="sm-highlight-icon">🏆</div><div class="sm-highlight-text">Categoría top: <strong>${topCat[0]}</strong> · €${euroFmt(topCat[1])}<span>Tu partida de gasto más importante del año</span></div></div>` : '')
    },
    {
      heroIcon: '⭐',
      heroGrad: 'linear-gradient(135deg,rgba(0,212,170,.2),rgba(99,102,241,.2))',
      glowColor: '#00D4AA',
      eyebrow: `Bienvenido a ${new Date().getFullYear()}`,
      title: `Un nuevo año por delante`,
      subtitle: totalAhor > 0
        ? `Ahorraste €${euroFmt(totalAhor)} el año pasado. ¡Este año puedes ir aún más lejos!`
        : `Un nuevo comienzo. Pequeños cambios consistentes producen grandes resultados.`,
      extra: ''
    }
  ]
}

function _smRenderSlide(animate) {
  const s = _smSlides[_smStep]
  if (!s) return
  const wrap = document.getElementById('smSlideWrap')
  if (!wrap) return

  const total = _smSlides.length
  const prog  = document.getElementById('smProgress')
  if (prog) prog.innerHTML = Array.from({ length: total }, (_, i) =>
    `<div class="sm-pdot ${i === _smStep ? 'active' : ''}"></div>`).join('')

  const nextBtn = document.getElementById('smNextBtn')
  if (nextBtn) nextBtn.textContent = _smStep === total - 1 ? '¡Entendido! ✓' : 'Siguiente →'

  const html = `
    <div class="sm-hero" style="background:${s.heroGrad}">
      <div class="sm-hero-glow" style="background:${s.glowColor}"></div>
      <div class="sm-hero-icon">${s.heroIcon}</div>
    </div>
    <div class="sm-body">
      <div class="sm-eyebrow"><div class="sm-eyebrow-dot"></div>${s.eyebrow}</div>
      <div class="sm-title">${s.title}</div>
      <div class="sm-subtitle">${s.subtitle}</div>
      ${s.extra || ''}
    </div>`

  if (animate) {
    wrap.classList.add('sm-exit')
    setTimeout(() => {
      wrap.innerHTML = html
      wrap.classList.remove('sm-exit')
      wrap.classList.add('sm-enter')
      requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.remove('sm-enter')))
    }, 180)
  } else {
    wrap.innerHTML = html
  }
}

function smNext() {
  if (_smStep >= _smSlides.length - 1) { smClose(); return }
  _smStep++
  _smRenderSlide(true)
}

function smClose() {
  const modal = document.getElementById('storyModal')
  if (!modal) return
  modal.style.animation = 'smFadeIn .25s ease reverse forwards'
  setTimeout(() => {
    modal.classList.remove('sm-visible')
    modal.style.animation = ''
  }, 250)
}

function showMonthlySummary() {
  if (!S) return
  const prevM = new Date()
  prevM.setDate(0) // last day of prev month
  const prevKey = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}`

  const hasData = (S.ingresos || []).some(i => i.fecha && i.fecha.startsWith(prevKey)) ||
                  (S.gastos   || []).some(g => g.fecha && g.fecha.startsWith(prevKey))
  if (!hasData) return

  _smSlides = _buildMonthlySlides()
  _smStep   = 0
  const modal = document.getElementById('storyModal')
  if (!modal) return
  _smRenderSlide(false)
  modal.classList.add('sm-visible')
  try { localStorage.setItem(MONTHLY_STORY_KEY, new Date().toISOString().slice(0, 7)) } catch(e) {}
}

function showYearlySummary() {
  const prevYear = new Date().getFullYear() - 1
  const yearStr  = String(prevYear)
  const hasData  = (S.ingresos || []).some(i => i.fecha && i.fecha.startsWith(yearStr)) ||
                   (S.gastos   || []).some(g => g.fecha && g.fecha.startsWith(yearStr))
  if (!hasData) return

  _smSlides = _buildYearlySlides()
  _smStep   = 0
  const modal = document.getElementById('storyModal')
  if (!modal) return
  _smRenderSlide(false)
  modal.classList.add('sm-visible')
  try { localStorage.setItem(YEARLY_STORY_KEY, String(new Date().getFullYear())) } catch(e) {}
}

function checkStories() {
  if (!_obFlagSeen()) return // No mostrar si no ha pasado por el onboarding
  const now = new Date()
  const curMonth = now.toISOString().slice(0, 7)
  const curYear  = String(now.getFullYear())

  try {
    const shownM = localStorage.getItem(MONTHLY_STORY_KEY)
    const shownY = localStorage.getItem(YEARLY_STORY_KEY)

    // Annual: show on January if prev year not shown
    if (now.getMonth() === 0 && shownY !== curYear) {
      setTimeout(() => showYearlySummary(), 1800)
      return
    }
    // Monthly: show if current month not shown
    if (shownM !== curMonth) {
      setTimeout(() => showMonthlySummary(), 1800)
    }
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
// ─── OBJETIVO GUIADO — Goal Coach ────────────────────────────
// ════════════════════════════════════════════════════════════════
const GC_FLAG = 'mn_goal_coach_shown'

function gcSetAmount(v) {
  const inp = document.getElementById('gcAmount')
  if (inp) { inp.value = v }
  document.querySelectorAll('.gc-chip').forEach(c => {
    c.classList.toggle('selected', c.textContent.replace(/[^0-9]/g,'') == String(v))
  })
}

function gcClose() {
  try { localStorage.setItem(GC_FLAG, 'true') } catch(e) {}
  const modal = document.getElementById('goalCoachModal')
  if (modal) { modal.style.animation = 'smFadeIn .25s ease reverse forwards'; setTimeout(() => { modal.classList.remove('gc-visible'); modal.style.animation = '' }, 250) }
}

function gcCreate() {
  const amt = parseAmount(document.getElementById('gcAmount')?.value) || 0
  if (amt <= 0) { document.getElementById('gcAmount')?.focus(); return }
  const now = new Date()
  const meta = amt
  const nombre = `Ahorro ${now.toLocaleString('es', { month: 'long' })} ${now.getFullYear()}`
  const nuevoObj = {
    id: 'gc_' + Date.now(),
    nombre, meta,
    actual: 0,
    fecha: now.toISOString().slice(0, 10),
    completado: false
  }
  if (!Array.isArray(S.objetivos)) S.objetivos = []
  S.objetivos.push(nuevoObj)
  save()
  render()
  gcClose()
  toast('🎯 ' + t('toast_objetivo_creado','Objetivo creado') + ': ' + nombre)
}

function checkGoalCoach() {
  if (!S || !_obFlagSeen()) return
  try { if (localStorage.getItem(GC_FLAG) === 'true') return } catch(e) {}
  const hasObj  = Array.isArray(S.objetivos) && S.objetivos.length > 0
  const hasData = (S.ingresos || []).length > 0 || (S.gastos || []).length > 0
  if (hasObj || !hasData) return
  setTimeout(() => {
    const modal = document.getElementById('goalCoachModal')
    if (modal) modal.classList.add('gc-visible')
  }, 3000)
}

// ════════════════════════════════════════════════════════════════
// ─── MISIONES TOUR — Active Mission System ───────────────────
// ════════════════════════════════════════════════════════════════
const MISION_FLAG = 'mn_misiones_done'
const MISION_STATE_KEY = 'mn_misiones_state'

function _getMisionState() {
  try {
    const s = JSON.parse(localStorage.getItem(MISION_STATE_KEY) || '{}')
    return { m1: s.m1 || false, m2: s.m2 || false, m3: s.m3 || false, dismissed: s.dismissed || false }
  } catch(e) { return { m1: false, m2: false, m3: false, dismissed: false } }
}

function _saveMisionState(state) {
  try { localStorage.setItem(MISION_STATE_KEY, JSON.stringify(state)) } catch(e) {}
}

function _checkMisionProgress() {
  const state = _getMisionState()
  state.m1 = (S.ingresos  || []).length > 0
  state.m2 = (S.gastos    || []).length > 0
  state.m3 = (S.objetivos || []).length > 0
  _saveMisionState(state)
  return state
}

function misionDone() {
  try { localStorage.setItem(MISION_FLAG, 'true') } catch(e) {}
  const bar = document.getElementById('misionBar')
  if (bar) { bar.style.transform = 'translateX(-50%) scale(.9)'; bar.style.opacity = '0'; setTimeout(() => bar.style.display = 'none', 300) }
}

function misionDismiss() {
  const state = _getMisionState()
  state.dismissed = true
  _saveMisionState(state)
  const bar = document.getElementById('misionBar')
  if (bar) { bar.style.animation = 'none'; bar.style.opacity = '0'; setTimeout(() => bar.style.display = 'none', 300) }
}

function checkMisiones() {
  if (!_obFlagSeen()) return
  try { if (localStorage.getItem(MISION_FLAG) === 'true') return } catch(e) {}
  const state = _checkMisionProgress()
  if (state.dismissed) return
  if (state.m1 && state.m2 && state.m3) {
    // All done — show completion modal
    _showMisionComplete()
    return
  }
  updateMisionBar()
  const bar = document.getElementById('misionBar')
  if (bar) { bar.style.display = 'flex' }
}

function updateMisionBar() {
  const state = _checkMisionProgress()
  const done  = [state.m1, state.m2, state.m3].filter(Boolean).length
  const pct   = Math.round((done / 3) * 100)
  const bar   = document.getElementById('misionBar')
  if (!bar) return
  const icons   = ['🎯', '📊', '✅']
  const titles  = ['Añade tu primer ingreso', 'Registra un gasto', 'Crea tu primer objetivo']
  const subs    = ['Paso 1 de 3 — empieza aquí', 'Paso 2 de 3 — registra un gasto', 'Paso 3 de 3 — define una meta']
  const nextIdx = state.m1 ? (state.m2 ? 2 : 1) : 0
  document.getElementById('mbIcon').textContent = icons[nextIdx]
  document.getElementById('mbTitle').textContent = titles[nextIdx]
  document.getElementById('mbSub').textContent   = subs[nextIdx]
  document.getElementById('mbFill').style.width  = pct + '%'
  document.getElementById('mbPct').textContent   = pct + '%'
  if (done === 3) { misionDone(); return }
}

function misionOpenModal() {
  const state = _checkMisionProgress()
  const done  = [state.m1, state.m2, state.m3].filter(Boolean).length
  const pct   = Math.round((done / 3) * 100)
  const mmFill = document.getElementById('mmFill')
  const mmPct  = document.getElementById('mmPctLabel')
  if (mmFill) mmFill.style.width = pct + '%'
  if (mmPct)  mmPct.textContent  = `${done} de 3 completadas`

  const missions = [
    { title: 'Añade tu primer ingreso', sub: 'Ve a Ingresos y registra tu primera entrada de dinero.', done: state.m1, action: () => { misionCloseModal(); goTo('ingresos') } },
    { title: 'Registra un gasto',        sub: 'Ve a Gastos y apunta tu primer desembolso.',             done: state.m2, action: () => { misionCloseModal(); goTo('gastos')   } },
    { title: 'Crea un objetivo',          sub: 'Define una meta de ahorro en la sección Objetivos.',     done: state.m3, action: () => { misionCloseModal(); goTo('objetivos') } },
  ]
  const cont = document.getElementById('mmMissions')
  if (cont) cont.innerHTML = missions.map((m, i) => {
    const prevDone = i === 0 || missions[i - 1].done
    const cls = m.done ? 'done' : (prevDone ? 'active' : '')
    const badgeLabel = m.done ? 'Hecho' : (prevDone ? 'Siguiente' : 'Bloqueado')
    const badgeCls   = m.done ? 'done-badge' : (prevDone ? 'active-badge' : 'lock-badge')
    return `<div class="mm-mission ${cls}" onclick="${prevDone && !m.done ? `(_mmActions[${i}])()` : ''}">
      <div class="mm-check">${m.done ? '✓' : (i + 1)}</div>
      <div class="mm-info">
        <div class="mm-mission-title">${m.title}</div>
        <div class="mm-mission-sub">${m.sub}</div>
      </div>
      <span class="mm-badge ${badgeCls}">${badgeLabel}</span>
    </div>`
  }).join('')

  // Store actions for inline onclick
  window._mmActions = missions.map(m => m.action)

  const modal = document.getElementById('misionModal')
  if (modal) modal.classList.add('mm-visible')
}

function misionCloseModal() {
  const modal = document.getElementById('misionModal')
  if (modal) modal.classList.remove('mm-visible')
}

function _showMisionComplete() {
  misionDone()
  // Create a custom completion modal
  const overlay = document.createElement('div')
  overlay.id = 'misionCompleteOverlay'
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9300;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.8);backdrop-filter:blur(10px);animation:smFadeIn .3s ease forwards'
  overlay.innerHTML = `
    <div style="background:var(--card);border-radius:24px;width:min(420px,calc(100vw - 32px));padding:36px 32px;text-align:center;animation:smCardIn .4s cubic-bezier(0.22,1,0.36,1) forwards;box-shadow:0 40px 100px rgba(0,0,0,.7)">
      <div style="font-size:3rem;margin-bottom:16px;animation:smPop .5s cubic-bezier(0.34,1.56,.64,1) .1s both">🏆</div>
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.4rem;font-weight:800;color:var(--text);letter-spacing:-.04em;margin-bottom:8px">¡Misiones completadas!</div>
      <div style="font-size:.875rem;color:var(--text2);line-height:1.6;margin-bottom:28px">Ya conoces lo esencial de ${APP_NAME}. ¿Qué quieres hacer con los datos de práctica?</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="document.getElementById('misionCompleteOverlay').remove();window._popScrollLock&&window._popScrollLock();toast(t('toast_datos_guardados','✅ Datos guardados — ¡bienvenido!'))" style="padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#00D4AA,#00A882);color:#0A0E17;font-size:.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(0,212,170,.3)">${t('mision_mantener','Mantener datos y continuar 🚀')}</button>
        <button onclick="document.getElementById('misionCompleteOverlay').remove();window._popScrollLock&&window._popScrollLock();const s=defaultState();s.usuario.nombre=S.usuario.nombre;s.theme=S.theme;S=s;save();render();toast(t('toast_app_reiniciada','App reiniciada — empieza con tus datos reales 🚀'))" style="padding:13px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--text2);font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .18s">${t('mision_empezar_limpio','Empezar limpio (borrar práctica)')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
}

// ════════════════════════════════════════════════════════════════
// ─── CHAT FAQ — Offline keyword assistant ────────────────────
// ════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════
// ─── HOOKS INTO INIT ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ─── AUTH UI ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

function _renderAuthBadge() {
  // v2 — delegado a MNAuthUI
  if (window.MNAuthUI) { MNAuthUI.renderAuthBadge('authPlanBadge'); }
  // Also refresh the ⚡ PRO badge next to the sidebar logo
  updateSidebarLogo();
}

function _renderTrialPill() {
  // v2 — delegado a MNAuthUI
  if (window.MNAuthUI) { MNAuthUI.renderTrialPill('trialPillContainer'); return; }
}

function _renderTrialBanner() { _renderTrialPill() }

function _showAuthModal() {
  // v2 — delegado a MNAuthUI (components/auth-ui.js)
  if (window.MNAuthUI && window.MNAuthUI.showAuthModal) {
    window.MNAuthUI.showAuthModal();
    return;
  }
  // Fallback: abrir modal legacy si MNAuthUI no está disponible
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
}

function _authStartTrial() {
  // v2: el trial ya se activa en initUser(). Esta función es un alias de compatibilidad.
  upgradeTrial();
  document.getElementById('authModal').style.display = 'none';
  const gg = document.getElementById('guestGateModal');
  if (gg) gg.style.display = 'none';
  _renderAuthBadge();
  _renderTrialPill();
  toast(t('toast_trial_activada','⏳ ¡Prueba de 24h activada! Explora todas las funciones.'));
}

function _authActivatePro() {
  // v2: dispatch event — el listener en index.html llama a MNAuth.activatePro()
  document.getElementById('authModal').style.display = 'none';
  const gg = document.getElementById('guestGateModal');
  if (gg) gg.style.display = 'none';
  _renderTrialPill();
  _renderAuthBadge();
  if (window.MNAuthUI) { MNAuthUI.showAuthModal('plan'); }
}

/** Guest-gate modal: shown when a locked_local user tries to add a movement */
function _showGuestGateModal() {
  // If we have MNAuthUI, open the plan modal directly — it has all the logic
  if (window.MNAuthUI) {
    MNAuthUI.showAuthModal('plan')
    return
  }
  // Fallback if MNAuthUI not loaded
  let modal = document.getElementById('guestGateModal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'guestGateModal'
    modal.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)'
    document.body.appendChild(modal)
  }
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:24px;width:min(420px,calc(100vw-32px));padding:36px 32px;text-align:center;box-shadow:0 40px 100px rgba(0,0,0,.6);animation:smCardIn .4s cubic-bezier(0.22,1,0.36,1) forwards">
      <div style="font-size:3rem;margin-bottom:12px">🔒</div>
      <div style="font-size:1.25rem;font-weight:800;color:var(--text);letter-spacing:-.04em;margin-bottom:8px">Tu prueba de 24h ha expirado</div>
      <div style="font-size:.85rem;color:var(--text2);line-height:1.6;margin-bottom:28px">Tus datos están a salvo. Elige un plan para seguir usando MoneyNest.</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        
        <button onclick="document.getElementById('guestGateModal').style.display='none'" style="padding:11px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--text3);font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit">Solo explorar</button>
      </div>
    </div>`
  modal.style.display = 'flex'
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none' }
}

function _postInitHooks() {
  // Run after app is initialized and rendered
  _renderAuthBadge()
  _renderTrialPill()
  checkStories()
  checkGoalCoach()
  checkMisiones()
  document.addEventListener('mn:saved', () => {
    updateMisionBar()
  })
  document.addEventListener('mn:restoreAccess',  () => _showAuthModal())
}





window.addEventListener('DOMContentLoaded', function() {
  init()
  setTimeout(_postInitHooks, 600)

  // Re-render sidebar badge whenever billing plan changes
  
})

/* ─── PWA Service Worker Registration + Update System ───────────
   Patron estandar (Workbox/Notion/Telegram Web): un nuevo deploy no
   se activa solo — el navegador instala el nuevo worker en segundo
   plano y lo deja en estado 'waiting' junto al que ya controla la
   pagina. Solo cuando la persona pulsa "Actualizar ahora" en el
   banner propio de MoneyNest se le pide que tome el control y se
   recarga. Nunca toca LocalStorage ni IndexedDB — solo reemplaza los
   archivos de la app (Cache Storage). */
if ('serviceWorker' in navigator) {
  // Captured BEFORE registering anything — tells us whether this page
  // load was already controlled by a service worker. Only an actual
  // controller HANDOVER (this was true, then changes) means a real
  // update happened; the very first install also fires
  // 'controllerchange' once, and that must never trigger a reload.
  const hadControllerAlready = !!navigator.serviceWorker.controller

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        console.log('[MoneyNest] SW registered:', reg.scope)

        // A worker already waiting from a previous visit (e.g. the
        // banner was dismissed with "Más tarde" and the tab was closed
        // before updating) — show the banner again right away.
        if (reg.waiting && navigator.serviceWorker.controller) {
          _showUpdateBanner(reg)
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // 'installed' + an existing controller means this is a
            // genuine update (not the very first install ever).
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              _showUpdateBanner(reg)
            }
          })
        })
      })
      .catch(err => console.warn('[MoneyNest] SW registration failed:', err))

    // Reload only once the NEW worker has actually taken control of a
    // page that was already controlled by a previous one — never on
    // the very first install (no previous version to "update" from).
    let _mnReloadedForUpdate = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerAlready || _mnReloadedForUpdate) return
      _mnReloadedForUpdate = true
      window.location.reload()
    })
  })

  // Shown once per version, right after the app finishes updating —
  // reuses the version already fetched for the update banner.
  window.addEventListener('load', () => {
    setTimeout(_maybeShowChangelog, 1200)
  })
}

async function _fetchAppVersionInfo() {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (_) {
    return null
  }
}

async function _showUpdateBanner(registration) {
  if (document.getElementById('mnUpdateBanner')) return // already showing
  const info = await _fetchAppVersionInfo()

  const el = document.createElement('div')
  el.id = 'mnUpdateBanner'
  el.className = 'mn-update-banner'
  el.innerHTML = `
    <div class="mn-update-banner__icon">🚀</div>
    <div class="mn-update-banner__body">
      <div class="mn-update-banner__title">${_aut ? _aut('update_titulo','Actualización disponible') : 'Actualización disponible'}</div>
      <div class="mn-update-banner__sub">${info?.version ? `MoneyNest ${info.version} ya está lista.` : 'Hay una nueva versión de MoneyNest lista.'} <span class="mn-update-banner__badge">🔒 Datos conservados</span></div>
    </div>
    <div class="mn-update-banner__actions">
      <button class="mn-update-banner__later" id="mnUpdateLaterBtn">Más tarde</button>
      <button class="mn-update-banner__now" id="mnUpdateNowBtn">Actualizar ahora</button>
    </div>`
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('mn-update-banner--in'))

  document.getElementById('mnUpdateLaterBtn').onclick = () => {
    el.classList.remove('mn-update-banner--in')
    setTimeout(() => el.remove(), 300)
  }
  document.getElementById('mnUpdateNowBtn').onclick = () => _applyUpdate(registration)
}

function _applyUpdate(registration) {
  const btn = document.getElementById('mnUpdateNowBtn')
  if (btn) { btn.disabled = true; btn.textContent = 'Actualizando…' }
  const waitingWorker = registration.waiting
  if (!waitingWorker) { window.location.reload(); return }
  waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  // controllerchange (registered above) triggers the actual reload —
  // this only kicks off the handover.
}

// Shows the "what's new" modal at most once per version, right after
// an update was applied (or on first load if the version.json fetch
// succeeds and differs from what was last acknowledged).
async function _maybeShowChangelog() {
  const full = await _fetchAppVersionInfo()
  if (!full || !full.version || !full.changelog) return
  const lastSeen = localStorage.getItem('mn_last_seen_version')
  if (lastSeen === full.version) return
  // First-ever load (no previous version acknowledged yet) shouldn't
  // show a changelog — just silently record the current version.
  if (!lastSeen) { localStorage.setItem('mn_last_seen_version', full.version); return }

  document.getElementById('mnChangelogOverlay')?.remove()
  const overlay = document.createElement('div')
  overlay.id = 'mnChangelogOverlay'
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-body" style="text-align:center;padding:32px 26px 24px">
        <div style="font-size:2.2rem;margin-bottom:8px">🎉</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:4px">${full.changelog.title || 'Novedades'}</div>
        <div style="font-size:.8rem;color:var(--text2);margin-bottom:18px">Lo nuevo en MoneyNest</div>
        <div style="text-align:left;display:flex;flex-direction:column;gap:10px;margin-bottom:22px">
          ${(full.changelog.items||[]).map(item => `
            <div style="display:flex;gap:10px;align-items:flex-start;font-size:.85rem;color:var(--text)">
              <span style="color:var(--accent);flex-shrink:0">✓</span>
              <span>${item}</span>
            </div>`).join('')}
        </div>
        <button class="btn btn-primary btn-sm" style="width:100%" id="mnChangelogCloseBtn">Continuar</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  _pushScrollLock()

  const close = () => {
    overlay.classList.remove('open')
    _popScrollLock()
    localStorage.setItem('mn_last_seen_version', full.version)
    setTimeout(() => overlay.remove(), 250)
  }
  document.getElementById('mnChangelogCloseBtn').onclick = close
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
}


/* ═══════════════════════════════════════════════════════════════════
   OPCIÓN C — ANIMATION PATCH (app.js addendum)
   Principios:
     · Patcha las funciones de cierre existentes para animar la salida
       antes de ocultar el elemento (evita el "snap" abrupto).
     · La doble validación (Gate 1 / Gate 2) permanece intacta.
     · Nunca modifica display/visibility directamente — delega al CSS.
     · Utiliza un helper _mnAnimatedClose() reutilizable.
   ═══════════════════════════════════════════════════════════════════ */

// ─── HELPER: cierre animado genérico ─────────────────────────────────
/**
 * Anima la salida de un overlay añadiendo la clase CSS 'mn-closing'.
 * Espera al fin de la animación (transitionend / animationend) y luego
 * ejecuta el callback de limpieza (ocultar el elemento, etc.).
 *
 * @param {HTMLElement} el       - El elemento overlay a cerrar.
 * @param {Function}    cleanup  - Función a ejecutar tras la animación.
 * @param {number}      [fallbackMs=250] - Timeout de seguridad (ms).
 */
function _mnAnimatedClose(el, cleanup, fallbackMs = 250) {
  if (!el) { if (cleanup) cleanup(); return }

  // Si ya está cerrando, no apilamos otra animación
  if (el.classList.contains('mn-closing')) return

  el.classList.add('mn-closing')

  // Limpiamos will-change tras animar (buena práctica de rendimiento)
  function _done() {
    el.removeEventListener('animationend', _done)
    el.style.willChange = 'auto'
    el.classList.remove('mn-closing')
    if (cleanup) cleanup()
  }

  el.addEventListener('animationend', _done, { once: true })

  // Fallback por si animationend no dispara (e.g., display:none previo)
  setTimeout(() => {
    el.removeEventListener('animationend', _done)
    el.style.willChange = 'auto'
    el.classList.remove('mn-closing')
    if (cleanup) cleanup()
  }, fallbackMs)
}

// ─── HELPER: feedback de shake (Gate rechazado) ───────────────────────
/**
 * Añade la clase mn-shake al elemento y la elimina cuando termina.
 * Se llama desde los guards cuando el usuario intenta ejecutar la
 * acción sin permisos (Gate 1 visual o Gate 2 de seguridad).
 *
 * @param {HTMLElement|string} elOrId - Elemento o ID del card a sacudir.
 */
function _mnShakeFeedback(elOrId) {
  const el = typeof elOrId === 'string'
    ? document.getElementById(elOrId)
    : elOrId
  if (!el) return
  el.classList.remove('mn-shake') // reset si ya estaba
  void el.offsetWidth            // fuerza reflow para reiniciar animación
  el.classList.add('mn-shake')
  el.addEventListener('animationend', () => el.classList.remove('mn-shake'), { once: true })
}

// ─── PATCH: closeQuickAdd — salida animada ────────────────────────────
/**
 * Sobrescribimos closeQuickAdd para animar la salida antes de quitar .open.
 * Gate 1 y Gate 2 en openQuickAdd / saveQuickAdd se mantienen sin cambios.
 */
;(function _patchCloseQuickAdd() {
  const _orig = window.closeQuickAdd
  window.closeQuickAdd = function closeQuickAdd() {
    const modal = document.getElementById('quickAddModal')
    if (!modal || !modal.classList.contains('open')) return
    _mnAnimatedClose(modal, () => {
      // Tras la animación de salida, quitamos .open (display:none)
      modal.classList.remove('open')
    }, 220)
  }
})()

// ─── PATCH: _showGuestGateModal — añadir ARIA y cierre animado ────────
/**
 * Mejoramos el GuestGate con:
 *   · role="dialog" + aria-modal para lectores de pantalla.
 *   · Foco atrapado en el modal mientras está abierto (focus trap básico).
 *   · La X y el botón "Continuar explorando" cierran CON animación.
 * Gate 1 (openQuickAdd) y Gate 2 (saveQuickAdd) no se tocan.
 */
;(function _patchGuestGateModal() {
  const _orig = window._showGuestGateModal
  window._showGuestGateModal = function _showGuestGateModal() {
    // 1. Llamamos a la función original (crea el modal si no existe, rellena innerHTML)
    _orig()

    const modal = document.getElementById('guestGateModal')
    if (!modal) return

    // 2. Mejoras de accesibilidad
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'ggModalTitle')

    // Añadimos id al título si existe para el aria-labelledby
    const titleEl = modal.querySelector('div[style*="font-size:1.25rem"]')
    if (titleEl && !titleEl.id) titleEl.id = 'ggModalTitle'

    // 3. Reemplazamos los onclick de cierre por versión animada
    // El botón "Continuar explorando" (último button del modal)
    const buttons = modal.querySelectorAll('button')
    buttons.forEach(btn => {
      const txt = btn.textContent.trim()
      if (txt.includes('explorando') || txt.includes('✕')) {
        btn.onclick = () => _mnCloseGuestGate()
      }
    })

    // 4. Backdrop click también anima la salida
    modal.onclick = (e) => { if (e.target === modal) _mnCloseGuestGate() }

    // 5. Escape key cierra el modal
    function _escHandler(e) {
      if (e.key === 'Escape') { _mnCloseGuestGate(); document.removeEventListener('keydown', _escHandler) }
    }
    document.addEventListener('keydown', _escHandler)

    // 6. Foco al primer botón interactivo (accesibilidad)
    const firstBtn = modal.querySelector('button')
    if (firstBtn) setTimeout(() => firstBtn.focus(), 80)
  }
})()

/**
 * Cierra el GuestGate con animación.
 * Función global para que los onclick inline del innerHTML puedan llamarla.
 */
function _mnCloseGuestGate() {
  const modal = document.getElementById('guestGateModal')
  _mnAnimatedClose(modal, () => {
    if (modal) modal.style.display = 'none'
  }, 220)
}

// ─── PATCH: AuthModal — salida animada ───────────────────────────────
/**
 * El authModal se cierra en varios puntos del código con style.display='none'.
 * Creamos _mnCloseAuthModal() para centralizar el cierre animado y lo exponemos
 * globalmente para el onclick inline del botón ✕ en _showAuthModal().
 */
function _mnCloseAuthModal() {
  const modal = document.getElementById('authModal')
  _mnAnimatedClose(modal, () => {
    if (modal) modal.style.display = 'none'
  }, 220)
}

// ─── PATCH: _renderTrialPill — will-change cleanup ────────────────────
/**
 * Parcheamos _renderTrialPill para:
 *   · Animar la salida del pill anterior antes de quitarlo del DOM.
 *   · Añadir min touch-target y ARIA al nuevo pill.
 *   · Limpiar will-change tras la animación de entrada.
 */
;(function _patchRenderTrialPill() {
  const _orig = window._renderTrialPill
  window._renderTrialPill = function _renderTrialPill() {
    // Animamos la salida del pill existente antes de que _orig() lo elimine
    const existingPill = document.getElementById('trialPill')
    if (existingPill) {
      existingPill.classList.add('mn-pill-out')
      existingPill.addEventListener('animationend', () => existingPill.remove(), { once: true })
      // Breve retardo para que la salida sea visible antes de crear el nuevo
      setTimeout(() => {
        _orig()
        _mnSetupNewPill()
      }, 180)
      return
    }

    // No hay pill existente: mostramos directo
    _orig()
    _mnSetupNewPill()
  }

  function _mnSetupNewPill() {
    const pill = document.getElementById('trialPill')
    if (!pill) return

    // Accesibilidad
    pill.setAttribute('role', 'button')
    pill.setAttribute('aria-label', 'Ver tu plan de prueba — abrir opciones')
    pill.setAttribute('tabindex', '0')

    // Soporte teclado (Enter / Space activa el click)
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pill.click() }
    })

    // Limpiamos will-change tras la animación de entrada (ahorro de memoria GPU)
    pill.addEventListener('animationend', () => {
      pill.style.willChange = 'auto'
      // El hover de CSS ya maneja el estado visual — quitamos los listeners JS inline
      pill.onmouseenter = null
      pill.onmouseleave = null
    }, { once: true })
  }
})()

/* ─── GATE SHAKE INTEGRATION ─────────────────────────────────────────
 * Cuando el guard de openQuickAdd dispara (_showGuestGateModal),
 * sacudimos el botón FAB para reforzar el feedback visual del Gate 1.
 * Cuando saveQuickAdd dispara el Gate 2, sacudimos el modal.
 * Usamos MutationObserver para detectar el momento exacto.
 */
;(function _patchGateShake() {
  // Gate 1: shake al FAB del bottom-nav cuando openQuickAdd bloquea
  const _origOpen = window.openQuickAdd
  window.openQuickAdd = function openQuickAdd() {
    if (isGuest()) {
      // ── Gate 1 intacto ─────────────────────────────────────────────
      _showGuestGateModal()
      // Shake feedback en el botón + (bottom-nav-add)
      const fab = document.querySelector('.bottom-nav-add')
      if (fab) _mnShakeFeedback(fab)
      return
    }
    _origOpen()
  }

  // Gate 2: shake al card del quickAddModal cuando saveQuickAdd bloquea
  const _origSave = window.saveQuickAdd
  window.saveQuickAdd = function saveQuickAdd() {
    if (isGuest()) {
      // ── Gate 2 intacto ─────────────────────────────────────────────
      closeQuickAdd()
      _showGuestGateModal()
      const fab = document.querySelector('.bottom-nav-add')
      if (fab) _mnShakeFeedback(fab)
      return
    }
    _origSave()
  }
})()

// ─── Exportar helpers para tests / extensibilidad ────────────────────
window._mnAnimatedClose   = _mnAnimatedClose
window._mnShakeFeedback   = _mnShakeFeedback
window._mnCloseGuestGate  = _mnCloseGuestGate
window._mnCloseAuthModal  = _mnCloseAuthModal

// ════════════════════════════════════════════════════════════════════
//  CUSTOM DEBT STRATEGY CALCULATOR — Modal premium con gráfico
// ════════════════════════════════════════════════════════════════════

window.openCustomDebtModal = function() {
  // Remove stale overlay if any
  const old = document.getElementById('customDebtModalOverlay')
  if (old) old.remove()
  if (window._customDebtChartInstance) {
    try { window._customDebtChartInstance.destroy() } catch(_) {}
    window._customDebtChartInstance = null
  }

  const pend = S.deudas.reduce((a,d) => a + Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)), 0)
  if (pend <= 0) {
    toast(t('sin_deudas_pendientes','No hay deudas pendientes para calcular'), 'info')
    return
  }

  const intMed = S.deudas.length ? S.deudas.reduce((a,d) => a+(Number(d.interes)||0),0)/S.deudas.length : 0

  // Default: suggest 3% of balance (moderado)
  const suggestedPayment = Math.max(50, pend * 0.03)

  // State
  let currentMethod = 'avalanche' // or 'snowball'
  let currentPayment = suggestedPayment

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay mn-custom-modal'
  overlay.id = 'customDebtModalOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">🎯 ${t('estrategia_personalizada','Estrategia personalizada')}</span>
        <button class="modal-close" onclick="closeCustomDebtModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.85rem;color:var(--text2);margin-bottom:16px">${t('calc_custom_desc','Introduce tu pago mensual personalizado y compara métodos.')}</div>

        <!-- Input principal -->
        <div class="mn-custom-input-wrap">
          <span style="font-size:1.2rem;color:var(--text2)">💳</span>
          <input type="text" inputmode="decimal" id="customPayInput" class="mn-custom-input" placeholder="${suggestedPayment.toFixed(0)}"
            value="${suggestedPayment.toFixed(0)}" step="1" min="1"
            oninput="_sanitizeAmountInput(this);updateCustomCalc()" onkeydown="if(event.key==='Enter')event.target.blur()">
          <span style="font-size:.9rem;color:var(--text2);font-weight:700">/mes</span>
        </div>

        <!-- Results cards -->
        <div class="mn-custom-results" id="customResults">
          <!-- filled by updateCustomCalc() -->
        </div>

        <!-- Method toggle: Avalanche vs Snowball -->
        <div class="mn-custom-method-toggle">
          <button class="mn-custom-method-btn active" id="btnAvalanche" onclick="toggleCustomMethod('avalanche')">
            🌊 ${t('avalancha','Avalancha')}
          </button>
          <button class="mn-custom-method-btn" id="btnSnowball" onclick="toggleCustomMethod('snowball')">
            ❄️ ${t('bola_nieve','Bola de nieve')}
          </button>
        </div>

        <!-- Comparison chart -->
        <div class="mn-custom-chart-wrap">
          <canvas id="customDebtChart"></canvas>
        </div>

        <!-- Name input -->
        <input type="text" id="customStratName" class="mn-custom-name-input"
          placeholder="🎯 ${t('nombre_estrategia_default','Mi estrategia')}" maxlength="30"
          value="${t('nombre_estrategia_default','Mi estrategia')}">

        <!-- Motivation / savings card -->
        <div class="mn-custom-save-card" id="customSaveCard">
          <!-- filled by updateCustomCalc() -->
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="closeCustomDebtModal()">${t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="saveCustomStrategy()">${t('btn_guardar','Guardar estrategia')}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCustomDebtModal() })
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => overlay.classList.add('open'), 10)

  // Initialize calculation after DOM is ready
  requestAnimationFrame(() => {
    window._customDebtMethod = 'avalanche'
    window._customDebtCalc = null
    updateCustomCalc()
  })
}

window.closeCustomDebtModal = function() {
  const overlay = document.getElementById('customDebtModalOverlay')
  if (overlay) {
    overlay.classList.remove('open')
    setTimeout(() => overlay.remove(), 200)
    window._popScrollLock && window._popScrollLock()
  }
  // The chart's canvas lives inside this overlay — without destroying the
  // Chart.js instance here too, removing the overlay leaves a detached
  // canvas + a live Chart.js instance (event listeners, ResizeObserver)
  // dangling in memory until the modal happens to be reopened.
  if (window._customDebtChartInstance) {
    try { window._customDebtChartInstance.destroy() } catch(_) {}
    window._customDebtChartInstance = null
  }
}

window.toggleCustomMethod = function(method) {
  const btnAva = document.getElementById('btnAvalanche')
  const btnSno = document.getElementById('btnSnowball')
  if (method === 'avalanche') {
    btnAva.classList.add('active')
    btnSno.classList.remove('active')
  } else {
    btnSno.classList.add('active')
    btnAva.classList.remove('active')
  }
  window._customDebtMethod = method
  updateCustomCalc()
}

window.updateCustomCalc = function() {
  const inputEl = document.getElementById('customPayInput')
  const resultsBox = document.getElementById('customResults')
  const saveCard = document.getElementById('customSaveCard')
  if (!inputEl || !resultsBox || !saveCard) return

  const monthlyPay = parseAmount(inputEl.value) || 0
  if (monthlyPay <= 0) {
    resultsBox.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:.8rem">${t('introduce_pago','Introduce un pago mensual')}</div>`
    saveCard.innerHTML = ''
    return
  }

  const method = window._customDebtMethod || 'avalanche'
  const orderedDebts = method === 'snowball' ? debtSnowball() : debtAvalanche()

  // Simulate with chosen method
  const { months, totalInterest } = simulateDebtPayoff(monthlyPay, orderedDebts)

  const pend = S.deudas.reduce((a,d) => a + Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)), 0)

  const fechaLibre = (() => {
    if (!months) return '—'
    const fd = new Date()
    fd.setMonth(fd.getMonth() + months)
    return fd.toLocaleDateString(_currentLang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' })
  })()

  // Calculate baseline (minimum payment = 2% of balance)
  const baselinePayment = Math.max(20, pend * 0.02)
  const { months: baselineMonths, totalInterest: baselineInterest } = simulateDebtPayoff(baselinePayment, method === 'snowball' ? debtSnowball() : debtAvalanche())
  const interestSavings = Math.max(0, baselineInterest - totalInterest)

  // Results cards
  resultsBox.innerHTML = `
    <div class="mn-custom-result-card">
      <div class="mn-custom-result-label">⏱ ${t('tiempo','Tiempo')}</div>
      <div class="mn-custom-result-value accent">${fmtMonths(months)}</div>
    </div>
    <div class="mn-custom-result-card">
      <div class="mn-custom-result-label">📅 ${t('fecha','Fecha')}</div>
      <div class="mn-custom-result-value">${fechaLibre}</div>
    </div>
    <div class="mn-custom-result-card">
      <div class="mn-custom-result-label">💰 ${t('intereses','Intereses')}</div>
      <div class="mn-custom-result-value">${eur(totalInterest)}</div>
    </div>
  `

  // Order of payment display
  const orderHtml = orderedDebts.slice(0,5).map((d,i) => {
    const bal = Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0))
    return `<span style="font-size:.72rem;color:var(--text2);margin-right:6px">${i+1}. <strong style="color:var(--text)">${d.nombre||'—'}</strong> (${eur(bal)})</span>`
  }).join('') + (orderedDebts.length > 5 ? `<span style="font-size:.72rem;color:var(--text3)">+${orderedDebts.length-5} más</span>` : '')

  const percentFaster = baselineMonths > 0 ? Math.round(((baselineMonths - months) / baselineMonths) * 100) : 0
  saveCard.innerHTML = `
    <div class="mn-custom-save-icon">💎</div>
    <div class="mn-custom-save-text">
      ${interestSavings > 0
        ? `<strong>${t('ahorraras','Ahorrarás')} ${eur(interestSavings)}</strong> ${t('en_intereses_vs_minimo','en intereses vs. pago mínimo')}. `
        : ''
      }
      ${percentFaster > 0
        ? `<strong>${percentFaster}% ${t('mas_rapido','más rápido')}</strong> ${t('que_pago_minimo','que el pago mínimo')}.`
        : t('muy_cerca_pago_minimo','Estás cerca del pago mínimo.')
      }
      ${orderedDebts.length > 1 ? `<div style="margin-top:6px;font-size:.72rem;color:var(--text3)">Orden de pago: ${orderHtml}</div>` : ''}
    </div>
  `

  window._customDebtCalc = { monthlyPay, months, fechaLibre, totalInterest, interestSavings, baselineInterest }

  // Render comparison chart — guard against missing canvas
  try {
    renderCustomDebtChart(monthlyPay, months, baselinePayment, baselineMonths, pend)
  } catch(e) {
    console.warn('[CustomDebt] Chart render error:', e)
  }
}

function renderCustomDebtChart(customPay, customMonths, basePay, baseMonths, totalDebt) {
  const ctx = document.getElementById('customDebtChart')
  if (!ctx) return

  // Destroy previous chart
  if (window._customDebtChartInstance) {
    window._customDebtChartInstance.destroy()
  }

  const maxMonths = Math.max(customMonths, baseMonths)
  const labels = []
  const baselineData = []
  const customData = []

  for (let i = 0; i <= maxMonths; i++) {
    labels.push(i)
    // Baseline (minimum payment) line - red
    if (i <= baseMonths) {
      baselineData.push(Math.max(0, totalDebt - (basePay * i)))
    } else {
      baselineData.push(0)
    }
    // Custom strategy line - teal/green
    if (i <= customMonths) {
      customData.push(Math.max(0, totalDebt - (customPay * i)))
    } else {
      customData.push(0)
    }
  }

  window._customDebtChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('pago_minimo','Pago mínimo'),
          data: baselineData,
          borderColor: '#F43F5E',
          backgroundColor: 'rgba(244,63,94,0.1)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: t('tu_estrategia','Tu estrategia'),
          data: customData,
          borderColor: '#00D4AA',
          backgroundColor: 'rgba(0,212,170,0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11, weight: '600' } } },
        tooltip: {
          backgroundColor: 'rgba(10,14,23,0.95)',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(0,212,170,0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: function(ctx) {
              return `${ctx.dataset.label}: ${eur(ctx.parsed.y)}`
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: t('meses','Meses'), color: 'rgba(255,255,255,0.5)', font: { size: 10, weight: '600' } },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, autoSkip: true, maxRotation: 0, maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 480) ? 6 : 10 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: t('deuda_pendiente','Deuda pendiente'), color: 'rgba(255,255,255,0.5)', font: { size: 10, weight: '600' } },
          ticks: {
            color: 'rgba(255,255,255,0.4)',
            font: { size: 9 },
            callback: function(val) { return eur(val) }
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true
        }
      }
    }
  })
}

window.saveCustomStrategy = function() {
  // Always recalc to ensure fresh data
  if (typeof updateCustomCalc === 'function') updateCustomCalc()
  const calc = window._customDebtCalc
  const nameInput = document.getElementById('customStratName')
  const method = window._customDebtMethod || 'avalanche'

  if (!calc || !calc.monthlyPay || calc.monthlyPay <= 0) {
    toast(t('err_calculo_invalido','Introduce un pago mensual válido primero'), 'error')
    return
  }
  if (!isFinite(calc.months) || calc.months <= 0) {
    // Fallback: estimate from balance / payment
    const pend = S.deudas.reduce((a,d)=>a+Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)),0)
    calc.months = pend > 0 ? Math.ceil(pend / calc.monthlyPay) : 1
  }

  const name = (nameInput?.value || t('nombre_estrategia_default','Mi estrategia')).trim()
  const calcData = window._customDebtCalc

  const newStrategy = {
    id: 'cs_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    icon: '🎯',
    name: name,
    monthlyPayment: calcData.monthlyPay,
    months: calcData.months,
    date: calcData.fechaLibre,
    savings: calcData.interestSavings || 0,
    method: method,
  }

  if (!Array.isArray(window._customDebtStrategies)) window._customDebtStrategies = []
  window._customDebtStrategies.push(newStrategy)

  // Persist to localStorage
  try {
    localStorage.setItem('mn_custom_debt_strategies', JSON.stringify(window._customDebtStrategies))
  } catch(_) {}

  // Achievement: custom debt strategy
  if (window.MNGamification && window.MNGamification.checkAchievement) {
    window.MNGamification.checkAchievement('custom_debt');
  }

  toast(`✅ ${t('estrategia_guardada','Estrategia guardada')}: ${name}`, 'success')
  closeCustomDebtModal()
  setTimeout(() => renderDeudas(), 50)
}

window._deleteCustomStrategy = function(id) {
  if (!Array.isArray(window._customDebtStrategies)) return
  window._customDebtStrategies = window._customDebtStrategies.filter(s => s.id !== id)
  try { localStorage.setItem('mn_custom_debt_strategies', JSON.stringify(window._customDebtStrategies)) } catch(_) {}
  renderDeudas()
}

window._hideDefaultStrat = function(key) {
  if (!Array.isArray(S.deudaHiddenStrats)) S.deudaHiddenStrats = []
  if (!S.deudaHiddenStrats.includes(key)) S.deudaHiddenStrats.push(key)
  save()
  renderDeudas()
}

window._restoreDefaultStrats = function() {
  S.deudaHiddenStrats = []
  save()
  renderDeudas()
}

// Load custom strategies on init (migrate legacy single-strategy format if present)
;(function() {
  try {
    const savedArr = localStorage.getItem('mn_custom_debt_strategies')
    if (savedArr) {
      window._customDebtStrategies = JSON.parse(savedArr)
    } else {
      // Migrate legacy single strategy key
      const legacy = localStorage.getItem('mn_custom_debt_strategy')
      if (legacy) {
        const parsed = JSON.parse(legacy)
        parsed.id = parsed.id || ('cs_' + Date.now().toString(36))
        window._customDebtStrategies = [parsed]
        localStorage.setItem('mn_custom_debt_strategies', JSON.stringify(window._customDebtStrategies))
        localStorage.removeItem('mn_custom_debt_strategy')
      } else {
        window._customDebtStrategies = []
      }
    }
  } catch(_) { window._customDebtStrategies = [] }
})()

// ─── APLICAR PAGO AUTOMÁTICO SEGÚN ESTRATEGIA ─────────────────────
window.openApplyStrategyModal = function(customId) {
  const old = document.getElementById('applyStrategyOverlay')
  if (old) old.remove()

  // Determine payment amount + method from the given custom strategy, or the active preset
  let monthlyBudget, method, strategyLabel
  const customStrat = customId ? (window._customDebtStrategies||[]).find(s => s.id === customId) : null
  if (customStrat) {
    monthlyBudget = Number(customStrat.monthlyPayment) || 0
    method = customStrat.method || 'avalanche'
    strategyLabel = customStrat.name
  } else {
    const pend = S.deudas.reduce((a,d) => a + Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)), 0)
    const intMed = S.deudas.length ? S.deudas.reduce((a,d) => a+(Number(d.interes)||0),0)/S.deudas.length : 0
    const mul = { conservador:0.6, moderado:1.0, agresivo:1.6 }[window._deudaStrat || 'moderado'] || 1.0
    const calc = calcDebtStrategy(pend, intMed, mul)
    monthlyBudget = calc.monthlyPayment
    method = 'avalanche'
    strategyLabel = { conservador:'🐢 Conservador', moderado:'⚖️ Moderado', agresivo:'🚀 Agresivo' }[window._deudaStrat || 'moderado']
  }

  if (!monthlyBudget || monthlyBudget <= 0) {
    toast(t('sin_deudas_pendientes','No hay deudas pendientes para calcular'), 'info')
    return
  }

  const orderedDebts = method === 'snowball' ? debtSnowball() : debtAvalanche()
  const allocation = calcMonthlyAllocation(monthlyBudget, orderedDebts)

  if (!allocation.length) {
    toast(t('sin_deudas_pendientes','No hay deudas pendientes para calcular'), 'info')
    return
  }

  const rows = allocation.map(a => {
    const d = S.deudas.find(x => x.id === a.id)
    const pendiente = d ? Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0)) : 0
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg2);border-radius:10px;margin-bottom:8px">
      <div>
        <div style="font-size:.85rem;font-weight:700;color:var(--text)">${a.nombre}</div>
        <div style="font-size:.72rem;color:var(--text3)">Pendiente: ${eur(pendiente)}</div>
      </div>
      <div style="font-size:.95rem;font-weight:800;color:var(--accent)">${eur(a.importe)}</div>
    </div>`
  }).join('')

  const total = allocation.reduce((s,a) => s + a.importe, 0)

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'applyStrategyOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">⚡ ${t('aplicar_pago_mensual','Aplicar pago mensual')}</span>
        <button class="modal-close" onclick="document.getElementById('applyStrategyOverlay').remove();window._popScrollLock&&window._popScrollLock()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.82rem;color:var(--text2);margin-bottom:14px">
          ${t('reparto_segun_estrategia','Reparto según')} <strong style="color:var(--text)">${strategyLabel}</strong> — ${t('se_registrara_pago_hoy','se registrará como pago de hoy en cada deuda')}.
        </div>
        <div>${rows}</div>
        <div style="display:flex;justify-content:space-between;padding:12px 14px;margin-top:6px;border-top:1.5px solid var(--border)">
          <span style="font-size:.85rem;font-weight:700;color:var(--text2)">${t('total','Total')}</span>
          <span style="font-size:1.05rem;font-weight:900;color:var(--accent)">${eur(total)}</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('applyStrategyOverlay').remove();window._popScrollLock&&window._popScrollLock()">${t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="window._confirmApplyStrategy()">✅ ${t('confirmar_pagos','Confirmar pagos')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); window._popScrollLock && window._popScrollLock() } })
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => overlay.classList.add('open'), 10)

  window._pendingAllocation = allocation
}

window._confirmApplyStrategy = function() {
  const allocation = window._pendingAllocation || []
  const today = todayISO()
  let anySaldada = false

  allocation.forEach(a => {
    const idx = S.deudas.findIndex(x => x.id === a.id)
    if (idx < 0) return
    S.deudas[idx].importePagado = Math.min(Number(S.deudas[idx].importeTotal), (Number(S.deudas[idx].importePagado)||0) + a.importe)
    if (!S.deudas[idx].pagos) S.deudas[idx].pagos = []
    S.deudas[idx].pagos.push({ fecha: today, importe: a.importe })
    if (S.deudas[idx].importePagado >= Number(S.deudas[idx].importeTotal)) anySaldada = true
  })

  if (window.MNGamification) {
    MNGamification.checkAchievement('pago_deuda')
    MNGamification.checkAchievement('deuda_updated')
    if (anySaldada) MNGamification.checkAchievement('deuda_saldada')
    MNGamification.checkAchievement('data_check')
  }
  if (anySaldada && window.MNConfetti) setTimeout(() => MNConfetti.fire('debt'), 300)

  const overlay = document.getElementById('applyStrategyOverlay')
  if (overlay) overlay.remove()
  window._pendingAllocation = null

  save()
  render()
  toast(`✅ ${allocation.length} ${t('pagos_registrados','pagos registrados')}`)
}

// ─── PAGO MÚLTIPLE MANUAL ──────────────────────────────────────────
window.openMultiPagoModal = function() {
  const old = document.getElementById('multiPagoOverlay')
  if (old) old.remove()

  const pendientes = S.deudas.filter(d => (Number(d.importeTotal)||0) - (Number(d.importePagado)||0) > 0.01)
  if (!pendientes.length) {
    toast(t('sin_deudas_pendientes','No hay deudas pendientes para calcular'), 'info')
    return
  }

  const rows = pendientes.map(d => {
    const pend = Math.max(0,(Number(d.importeTotal)||0)-(Number(d.importePagado)||0))
    return `
    <div class="mn-multipago-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg2);border-radius:10px;margin-bottom:8px">
      <input type="checkbox" class="mn-multipago-check" data-id="${d.id}" data-max="${pend}" onchange="window._toggleMultiPagoRow(this)" style="width:18px;height:18px;flex-shrink:0;cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:.84rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.nombre||'—'}</div>
        <div style="font-size:.7rem;color:var(--text3)">Pendiente: ${eur(pend)}</div>
      </div>
      <input type="text" inputmode="decimal" class="mn-multipago-amount" data-id="${d.id}" placeholder="0.00" min="0.01" step="0.01" disabled
        oninput="_sanitizeAmountInput(this)"
        style="width:100px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.85rem">
    </div>`
  }).join('')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'multiPagoOverlay'
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">💳📋 ${t('pago_multiple','Pagar varias deudas a la vez')}</span>
        <button class="modal-close" onclick="document.getElementById('multiPagoOverlay').remove();window._popScrollLock&&window._popScrollLock()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:.8rem;color:var(--text2);margin-bottom:12px">${t('selecciona_deudas_pagar','Selecciona las deudas y el importe a pagar en cada una')}.</div>
        <div>${rows}</div>
        <div class="form-group" style="margin-top:10px">
          <label style="font-size:.78rem">${t('fecha_pago','Fecha del pago')}</label>
          <input type="date" id="multiPagoFecha" value="${todayISO()}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('multiPagoOverlay').remove();window._popScrollLock&&window._popScrollLock()">${t('btn_cancelar','Cancelar')}</button>
        <button class="btn btn-primary btn-sm" onclick="window._confirmMultiPago()">✅ ${t('registrar_pagos','Registrar pagos')}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); window._popScrollLock && window._popScrollLock() } })
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock()
  setTimeout(() => overlay.classList.add('open'), 10)
}

window._toggleMultiPagoRow = function(checkbox) {
  const id = checkbox.getAttribute('data-id')
  const amountInput = document.querySelector(`.mn-multipago-amount[data-id="${id}"]`)
  if (!amountInput) return
  amountInput.disabled = !checkbox.checked
  if (checkbox.checked && !amountInput.value) {
    amountInput.value = checkbox.getAttribute('data-max')
  }
}

window._confirmMultiPago = function() {
  const checks = document.querySelectorAll('.mn-multipago-check:checked')
  if (!checks.length) {
    toast(t('selecciona_al_menos_una','Selecciona al menos una deuda'), 'error')
    return
  }
  const fecha = document.getElementById('multiPagoFecha')?.value || todayISO()
  let count = 0
  let anySaldada = false

  checks.forEach(chk => {
    const id = chk.getAttribute('data-id')
    const amountInput = document.querySelector(`.mn-multipago-amount[data-id="${id}"]`)
    const importe = parseAmount(amountInput?.value)
    if (!importe || importe <= 0) return
    const idx = S.deudas.findIndex(x => x.id === id)
    if (idx < 0) return
    S.deudas[idx].importePagado = Math.min(Number(S.deudas[idx].importeTotal), (Number(S.deudas[idx].importePagado)||0) + importe)
    if (!S.deudas[idx].pagos) S.deudas[idx].pagos = []
    S.deudas[idx].pagos.push({ fecha, importe })
    if (S.deudas[idx].importePagado >= Number(S.deudas[idx].importeTotal)) anySaldada = true
    count++
  })

  if (!count) {
    toast(t('err_importe_pago','Introduce un importe válido'), 'error')
    return
  }

  if (window.MNGamification) {
    MNGamification.checkAchievement('pago_deuda')
    MNGamification.checkAchievement('deuda_updated')
    if (anySaldada) MNGamification.checkAchievement('deuda_saldada')
    MNGamification.checkAchievement('data_check')
  }
  if (anySaldada && window.MNConfetti) setTimeout(() => MNConfetti.fire('debt'), 300)

  const overlay = document.getElementById('multiPagoOverlay')
  if (overlay) overlay.remove()

  save()
  render()
  toast(`✅ ${count} ${t('pagos_registrados','pagos registrados')}`)
}



