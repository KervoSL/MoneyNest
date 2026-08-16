window.MNPayment = (() => {
  const ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-payment-intent';
  const VALIDATE_PROMO_ENDPOINT = 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/validate-promo-code';

  function _spt(key, fallback) {
    if (typeof window.t === 'function') { const v = window.t(key); return (v && v !== key) ? v : fallback; }
    return fallback;
  }

  let _stripe   = null;
  let _elements = null;
  let _overlay  = null;
  let _promoCode = null;
  let _activePaymentIntentId = null;

  function _getStripe() {
    if (!_stripe) _stripe = Stripe(MNStripeConfig.publishableKey);
    return _stripe;
  }

  // ── Overlay DOM ────────────────────────────────────────────────

  function _buildOverlay() {
    if (document.getElementById('mnPaymentOverlay')) return;

    const el = document.createElement('div');
    el.id = 'mnPaymentOverlay';
    el.innerHTML = `
      <div class="mnpo-backdrop"></div>
      <div class="mnpo-sheet" id="mnPaymentSheet" role="dialog" aria-modal="true" aria-label="Pago seguro">

        <!-- CLOSE -->
        <button class="mnpo-close" id="mnPoClose" aria-label="Cerrar">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>

        <!-- SPLIT LAYOUT -->
        <div class="mnpo-split">

          <!-- LEFT: plan info -->
          <div class="mnpo-left" id="mnPoPlanSummary"></div>

          <!-- RIGHT: payment form -->
          <div class="mnpo-right" id="mnPoBody">
            <div class="mnpo-right-title" id="mnPoRightTitle">${_spt('payment_title','Pago seguro')}</div>
            <div class="mnpo-right-sub">${_spt('payment_ssl','Tu información está cifrada con SSL')}</div>
            <div class="mnpo-price-summary" id="mnPoPriceSummary" style="display:none"></div>

            <!-- Discount code -->
            <div class="mnpo-promo-wrap">
              <button type="button" class="mnpo-promo-toggle" id="mnPoPromoToggle">
                🏷️ ${_spt('payment_promo_toggle','¿Tienes un código de descuento?')}
              </button>
              <div class="mnpo-promo-box" id="mnPoPromoBox" style="display:none">
                <div class="mnpo-promo-input-row">
                  <input type="text" id="mnPoPromoInput" class="mnpo-promo-input" placeholder="${_spt('payment_promo_placeholder','Código de descuento')}" autocomplete="off" autocapitalize="characters">
                  <button type="button" class="mnpo-promo-apply-btn" id="mnPoPromoApplyBtn">${_spt('payment_promo_apply','Aplicar')}</button>
                </div>
                <div class="mnpo-promo-msg" id="mnPoPromoMsg" style="display:none"></div>
              </div>
            </div>

            <div class="mnpo-stripe-wrap">
              <div id="mnPoElement"></div>
            </div>
            <div class="mnpo-error" id="mnPoError" style="display:none"></div>
            <button class="mnpo-pay-btn" id="mnPoPayBtn">
              <span id="mnPoPayBtnText">${_spt('payment_confirm','Confirmar pago')}</span>
              <span class="mnpo-pay-spinner" id="mnPoSpinner" style="display:none"></span>
            </button>
            <div class="mnpo-badges">
              <span class="mnpo-badge">🔒 SSL</span>
              <span class="mnpo-badge">Stripe</span>
              <span class="mnpo-badge">VISA</span>
              <span class="mnpo-badge">Mastercard</span>
            </div>
          </div>

        </div>

        <!-- SUCCESS (full width) -->
        <div class="mnpo-success" id="mnPoSuccess" style="display:none">
          <div class="mnpo-success-ring">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none"><path d="M6 15l6 6 12-12" stroke="#041510" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="mnpo-success-title" id="mnPoSuccessTitle">${_spt('payment_success_title','¡Plan activado!')}</div>
          <div class="mnpo-success-sub" id="mnPoSuccessSub"></div>
          <button class="mnpo-success-btn" id="mnPoSuccessBtn">${_spt('payment_continue','Continuar →')}</button>
        </div>

      </div>
    `;
    document.body.appendChild(el);
    _overlay = el;

    document.getElementById('mnPoClose').addEventListener('click', close);
    el.querySelector('.mnpo-backdrop').addEventListener('click', close);
    document.getElementById('mnPoPayBtn').addEventListener('click', _handlePay);
    document.getElementById('mnPoSuccessBtn').addEventListener('click', close);

    // Discount code toggle + apply
    const promoToggle = document.getElementById('mnPoPromoToggle');
    const promoBox    = document.getElementById('mnPoPromoBox');
    if (promoToggle && promoBox) {
      promoToggle.addEventListener('click', () => {
        const isOpen = promoBox.style.display !== 'none';
        promoBox.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) setTimeout(() => document.getElementById('mnPoPromoInput')?.focus(), 50);
      });
    }
    const promoApplyBtn = document.getElementById('mnPoPromoApplyBtn');
    if (promoApplyBtn) promoApplyBtn.addEventListener('click', _applyPromoCode);
    const promoInput = document.getElementById('mnPoPromoInput');
    if (promoInput) promoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); _applyPromoCode(); } });
  }

  async function _applyPromoCode() {
    const input    = document.getElementById('mnPoPromoInput');
    const msgEl    = document.getElementById('mnPoPromoMsg');
    const applyBtn = document.getElementById('mnPoPromoApplyBtn');
    if (!input || !msgEl) return;
    const code = (input.value || '').trim();
    if (!code) {
      msgEl.style.display = 'block';
      msgEl.className = 'mnpo-promo-msg error';
      msgEl.textContent = _spt('payment_promo_empty', 'Introduce un código');
      return;
    }

    input.disabled = true;
    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '…'; }
    msgEl.style.display = 'block';
    msgEl.className = 'mnpo-promo-msg pending';
    msgEl.textContent = _spt('payment_promo_checking', 'Comprobando código…');

    try {
      const res = await fetch(VALIDATE_PROMO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, priceId: _activePriceId }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        _showPromoResult(false, data.reason);
        input.disabled = false;
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = _spt('payment_promo_apply', 'Aplicar'); }
        return;
      }

      // Código real y válido según Stripe — ahora se re-crea el
      // PaymentIntent/Subscription con el descuento realmente aplicado
      // (el backend vuelve a validar el código antes de aplicarlo).
      _promoCode = data.code;
      input.disabled = true;
      if (applyBtn) { applyBtn.style.display = 'none'; }
      _setLoading(true);
      await _createAndMountPayment(_activePriceId, _activeEmail, _promoCode);

    } catch (err) {
      _showPromoResult(false, 'invalid');
      input.disabled = false;
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = _spt('payment_promo_apply', 'Aplicar'); }
    }
  }

  function _removePromoCode() {
    _promoCode = null;
    _resetPromoUI();
    _setLoading(true);
    _createAndMountPayment(_activePriceId, _activeEmail, null);
  }

  function _resetPromoUI() {
    const input    = document.getElementById('mnPoPromoInput');
    const applyBtn = document.getElementById('mnPoPromoApplyBtn');
    const msgEl    = document.getElementById('mnPoPromoMsg');
    const removeRow = document.getElementById('mnPoPromoApplied');
    if (input)  { input.disabled = false; input.value = ''; }
    if (applyBtn) { applyBtn.disabled = false; applyBtn.style.display = ''; applyBtn.textContent = _spt('payment_promo_apply', 'Aplicar'); }
    if (msgEl)  { msgEl.style.display = 'none'; msgEl.textContent = ''; }
    if (removeRow) removeRow.remove();
    _setPriceSummary(null);
  }

  // Muestra el resultado de validar el codigo: exito (con el resumen de
  // precios ya calculado por Stripe) o un motivo de rechazo especifico
  // en lenguaje humano — nunca un codigo/mensaje tecnico de Stripe.
  function _showPromoResult(valid, reason, pricing) {
    const msgEl = document.getElementById('mnPoPromoMsg');
    const promoBox = document.getElementById('mnPoPromoBox');
    if (!msgEl) return;
    msgEl.style.display = 'block';

    if (valid) {
      msgEl.className = 'mnpo-promo-msg ok';
      const pct = pricing?.discountAmount && pricing.originalAmount
        ? Math.round((pricing.discountAmount / pricing.originalAmount) * 100)
        : null;
      msgEl.textContent = pct
        ? `✅ ${_spt('payment_promo_applied','Código aplicado')}: -${pct}%`
        : `✅ ${_spt('payment_promo_applied','Código aplicado')}`;

      // Fila con el codigo aplicado + boton para quitarlo
      if (promoBox && !document.getElementById('mnPoPromoApplied')) {
        const row = document.createElement('div');
        row.id = 'mnPoPromoApplied';
        row.className = 'mnpo-promo-applied-row';
        row.innerHTML = `
          <span>🏷️ ${_promoCode}</span>
          <button type="button" id="mnPoPromoRemoveBtn">${_spt('payment_promo_remove','Quitar')}</button>`;
        promoBox.appendChild(row);
        document.getElementById('mnPoPromoRemoveBtn').addEventListener('click', _removePromoCode);
      }
      return;
    }

    const reasonMsgs = {
      invalid:        _spt('payment_promo_invalid',       'Código no válido'),
      expired:        _spt('payment_promo_expired',       'Este código ha caducado'),
      not_applicable: _spt('payment_promo_not_applicable','Este código no es aplicable a este plan'),
      exhausted:      _spt('payment_promo_exhausted',     'Este código ya no está disponible'),
    };
    msgEl.className = 'mnpo-promo-msg error';
    msgEl.textContent = '⚠ ' + (reasonMsgs[reason] || reasonMsgs.invalid);
  }

  // Muestra precio original tachado + precio final en el resumen del
  // plan (panel izquierdo) cuando hay un descuento real aplicado.
  function _applyPricingToSummary(priceId, pricing) {
    if (!pricing || !pricing.discountAmount) { _setPriceSummary(null); return; }
    _setPriceSummary(pricing);
  }

  function _fmtCents(cents, currency) {
    const value = (Number(cents) || 0) / 100;
    const symbol = (currency || 'eur').toLowerCase() === 'eur' ? '€' : (currency || '').toUpperCase();
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + symbol;
  }

  function _setPriceSummary(pricing) {
    const el = document.getElementById('mnPoPriceSummary');
    if (!el) return;
    if (!pricing || !pricing.discountAmount) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'flex';
    el.innerHTML = `
      <span class="mnpo-price-original">${_fmtCents(pricing.originalAmount, pricing.currency)}</span>
      <span class="mnpo-price-final">${_fmtCents(pricing.finalAmount, pricing.currency)}</span>`;
  }

  function _setPlanSummary(priceId) {
    const isLocal = priceId === MNStripeConfig.prices.local;
    const titleEl = document.getElementById('mnPoTitle');
    if (titleEl) titleEl.textContent = isLocal
      ? _spt('payment_local_plan_title', 'Activar MoneyNest — 6,99€')
      : _spt('payment_pro_plan_title',   'Activar Sync — 3€/año');

    const rightTitleEl = document.getElementById('mnPoRightTitle');
    if (rightTitleEl) rightTitleEl.textContent = isLocal
      ? _spt('payment_local_plan_title', 'Activar MoneyNest — 6,99€')
      : _spt('payment_pro_plan_title',   'Activar Sync — 3€/año');

    document.getElementById('mnPoPlanSummary').innerHTML = isLocal ? `
      <div class="mnpo-left-inner mnpo-left-inner--local">
        <div class="mnpo-left-brand">
          <div class="mnpo-left-logo"><svg width="14" height="14" viewBox="0 0 22 22" fill="none"><path d="M4 16L8 9l3 4 4-6 4 4" stroke="#00D4AA" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <span>MoneyNest</span>
        </div>
        <div class="mnpo-left-emoji">💾</div>
        <div class="mnpo-left-plan-name">MoneyNest</div>
        <div class="mnpo-left-price">6<span style="font-size:.55em">,99</span><span class="mnpo-left-cur">€</span></div>
        <div class="mnpo-left-period">pago único · tuyo para siempre</div>
        <div class="mnpo-left-divider"></div>
        <ul class="mnpo-left-feats">
          <li>Acceso ilimitado a todo</li>
          <li>Datos en tu dispositivo</li>
          <li>Sin suscripción anual</li>
          <li>Exportación PDF y Excel</li>
          <li>Sin conexión (offline)</li>
        </ul>
        <div class="mnpo-left-guarantee">✓ Sin riesgo · Reembolso 14 días</div>
      </div>` : `
      <div class="mnpo-left-inner mnpo-left-inner--pro">
        <div class="mnpo-left-brand">
          <div class="mnpo-left-logo"><svg width="14" height="14" viewBox="0 0 22 22" fill="none"><path d="M4 16L8 9l3 4 4-6 4 4" stroke="#00D4AA" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <span>MoneyNest</span>
        </div>
        <div class="mnpo-left-emoji">⚡</div>
        <div class="mnpo-left-plan-name">MoneyNest + Sync</div>
        <div class="mnpo-left-price-stack">
          <div class="mnpo-left-price-row">
            <span class="mnpo-left-price-lbl mnpo-left-price-lbl--local">MoneyNest</span>
            <span class="mnpo-left-price-val">6,99€</span>
            <span class="mnpo-left-price-sub">único</span>
          </div>
          <div class="mnpo-left-price-plus">+</div>
          <div class="mnpo-left-price-row">
            <span class="mnpo-left-price-lbl mnpo-left-price-lbl--pro">Sync</span>
            <span class="mnpo-left-price-val">3€</span>
            <span class="mnpo-left-price-sub">/año</span>
          </div>
        </div>
        <div class="mnpo-left-period">Sync en la nube · anual</div>
        <div class="mnpo-left-divider"></div>
        <ul class="mnpo-left-feats">
          <li>Todo lo del Plan Local</li>
          <li>Sincronización en la nube</li>
          <li>Acceso multidevice</li>
          <li>Backups automáticos</li>
          <li>7 días sin cargo</li>
        </ul>
        <div class="mnpo-left-guarantee">✓ Cancela cuando quieras</div>
      </div>`;
  }

  function _setLoading(on) {
    const btn     = document.getElementById('mnPoPayBtn');
    const txt     = document.getElementById('mnPoPayBtnText');
    const spinner = document.getElementById('mnPoSpinner');
    btn.disabled       = on;
    txt.style.opacity  = on ? '0.5' : '1';
    spinner.style.display = on ? 'inline-block' : 'none';
  }

  function _showError(msg) {
    const el = document.getElementById('mnPoError');
    el.textContent    = msg;
    el.style.display  = 'block';
    _setLoading(false);
  }

  function _hideError() {
    document.getElementById('mnPoError').style.display = 'none';
  }

  function _showSuccess(priceId) {
    const isLocal = priceId === MNStripeConfig.prices.local;
    const split = document.querySelector('#mnPaymentSheet .mnpo-split');
    if (split) split.style.display = 'none';
    document.getElementById('mnPoSuccess').style.display = 'flex';
    document.getElementById('mnPoSuccessTitle').textContent = isLocal
      ? _spt('payment_success_local_title', '¡Plan Local activado!')
      : _spt('payment_success_pro_title',   '¡Pro activado!');
    document.getElementById('mnPoSuccessSub').textContent = isLocal
      ? _spt('payment_success_local_sub', 'Acceso ilimitado desbloqueado sin suscripción.')
      : _spt('payment_success_pro_sub',   '7 días de prueba gratuita iniciados. Disfruta de MoneyNest Pro.');

    if (!isLocal) {
      // Store pro trial end date
      if (window.MNAuth) {
        const proTrialEndsAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
        window.MNAuth.patchUser({ plan: 'pro', cloudEnabled: true, proTrialEndsAt, proTrialUsed: true });
      }
      // Inject 7-day trial badge
      const successEl = document.getElementById('mnPoSuccess');
      const existingBadge = document.getElementById('mnPoProTrialBadge');
      if (successEl && !existingBadge) {
        const badge = document.createElement('div');
        badge.id = 'mnPoProTrialBadge';
        badge.innerHTML = `
          <div style="margin-top:16px;padding:16px 20px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:14px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#6366F1;letter-spacing:-.05em;line-height:1">7 días</div>
            <div style="font-size:.75rem;font-weight:700;color:#94A3B8;margin-top:4px">de prueba gratuita incluidos</div>
            <div style="font-size:.7rem;color:#64748B;margin-top:6px;line-height:1.5">
              Tu tarjeta no será cobrada hasta el día 8.<br>Cancela cuando quieras.
            </div>
            <div style="margin-top:10px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
              <span style="background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.2);color:#00D4AA;padding:4px 10px;border-radius:99px;font-size:.68rem;font-weight:700">☁️ Cloud sync</span>
              <span style="background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.2);color:#00D4AA;padding:4px 10px;border-radius:99px;font-size:.68rem;font-weight:700">🔄 Backups</span>
              <span style="background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.2);color:#00D4AA;padding:4px 10px;border-radius:99px;font-size:.68rem;font-weight:700">⚡ Prioritario</span>
            </div>
          </div>`;
        successEl.appendChild(badge);
      }
    }
  }

  // ── Payment flow ───────────────────────────────────────────────

  let _activePriceId  = null;
  let _activeEmail    = null;
  let _activeFlowType = 'payment'; // 'payment' | 'setup'

  async function _handlePay() {
    _hideError();

    // Guard: elements not ready yet
    if (!_elements) {
      _showError(_spt('payment_not_ready', 'El formulario de pago aún está cargando. Espera un momento.'));
      return;
    }

    _setLoading(true);

    const stripe = _getStripe();
    const cfg = window.MNStripeConfig;
    const isLocal = _activePriceId === cfg.prices.local;
    const returnUrl = `${location.origin}${location.pathname}?checkout=success&plan=${isLocal ? 'local' : 'pro'}`;

    const confirmFn = _activeFlowType === 'setup'
      ? stripe.confirmSetup.bind(stripe)
      : stripe.confirmPayment.bind(stripe);

    const { error } = await confirmFn({
      elements: _elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (error) {
      _showError(error.message ?? _spt('payment_error_generic', 'Error al procesar el pago. Inténtalo de nuevo.'));
      return;
    }

    _onPaymentSuccess(_activePriceId, _activeEmail);
  }

  function _onPaymentSuccess(priceId, email) {
    const isLocal = priceId === MNStripeConfig.prices.local;
    // Sync MNAuth (source of truth for plan state)
    if (isLocal) {
      if (window.MNAuth?.buyLocal) MNAuth.buyLocal(email);
    } else {
      if (window.MNAuth?.activatePro) MNAuth.activatePro(email);
    }
    // Sync MNBilling (source of truth for billing-ui)
    if (window.MNBilling) {
      if (isLocal) {
        window.MNBilling.activateLocal(email);
      } else {
        window.MNBilling.activatePro(email);
      }
    }
    // Refresh billing UI badges immediately
    if (window.MNBillingUI?.refreshAll) window.MNBillingUI.refreshAll();
    if (typeof updateSidebarLogo === 'function') updateSidebarLogo();
    _showSuccess(priceId);
    document.dispatchEvent(new CustomEvent('mn:paymentSuccess', {
      detail: { plan: isLocal ? 'local_lifetime' : 'pro_annual', email },
    }));
  }

  // ── Handle return from 3DS redirect ───────────────────────────

  async function _checkReturnParams() {
    const params   = new URLSearchParams(location.search);
    const checkout = params.get('checkout');
    const plan     = params.get('plan');

    if (checkout === 'success' && plan) {
      // Clean URL immediately
      history.replaceState({}, '', location.pathname);

      const priceId = plan === 'local' ? MNStripeConfig.prices.local : MNStripeConfig.prices.pro;
      const email   = MNAuth.getUser()?.email ?? '';

      // Stripe Checkout session redirect — webhook may already have updated Supabase.
      // Apply local state optimistically, then sync from server to confirm.
      _onPaymentSuccess(priceId, email);

      // Sync plan from Supabase (webhook runs async — retry a few times)
      _syncPlanFromServer(plan);
      return;
    }

    // Elements flow: payment_intent or setup_intent in URL (3DS redirect)
    const pi = params.get('payment_intent');
    const si = params.get('setup_intent');
    if ((pi || si) && plan) {
      history.replaceState({}, '', location.pathname);
      const stripe = _getStripe();
      if (pi) await stripe.retrievePaymentIntent(params.get('payment_intent_client_secret') ?? '');
      const email = MNAuth.getUser()?.email ?? '';
      _onPaymentSuccess(
        plan === 'local' ? MNStripeConfig.prices.local : MNStripeConfig.prices.pro,
        email,
      );
    }
  }

  async function _syncPlanFromServer(plan, retries = 4, delayMs = 2000) {
    if (!window.MNSupabaseAuth?.isLoggedIn()) return;
    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 1000 : delayMs));
      try {
        const profile = await window.MNSupabaseAuth.getProfile(true);
        if (!profile) continue;
        const expectedPlan = plan === 'local' ? 'local' : 'pro';
        if (profile.plan === expectedPlan || profile.plan === 'local_lifetime' || profile.plan === 'pro_annual' || profile.plan === 'pro') {
          // Server confirmed — re-sync to localStorage
          await window.MNSupabaseAuth._sb.auth.getSession(); // refresh session
          // Trigger the sync path in supabase-auth.js
          const { data: { session } } = await window.MNSupabaseAuth._sb.auth.getSession();
          if (session?.user) {
            // Force profile re-sync
            if (window.MNAuthUI) {
              window.MNAuthUI.renderAuthBadge('authPlanBadge');
              window.MNAuthUI.renderTrialPill('trialPillContainer');
            }
            // Sync MNBilling with confirmed server plan
            if (window.MNBilling) {
              const targetBillingPlan = plan === 'local' ? 'local_lifetime' : 'pro_annual';
              const currentSub = window.MNBilling.getSub();
              if (!currentSub || currentSub.plan !== targetBillingPlan) {
                if (plan === 'local') {
                  window.MNBilling.activateLocal();
                } else {
                  window.MNBilling.activatePro();
                }
              }
            }
            // Refresh billing UI reactively
            if (window.MNBillingUI?.refreshAll) window.MNBillingUI.refreshAll();
          }
          break;
        }
      } catch (_) {}
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  async function open(priceId, email) {
    _buildOverlay();
    _activePriceId = priceId;
    _activeEmail   = email ?? '';
    _promoCode     = null;

    // Cerrar cualquier modal que esté abierto por encima (authModal, billingCheckoutModal)
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';
    const checkoutModal = document.getElementById('billingCheckoutModal');
    if (checkoutModal) checkoutModal.remove();

    // Reset state
    const split = document.querySelector('#mnPaymentSheet .mnpo-split');
    if (split) split.style.display = '';
    document.getElementById('mnPoSuccess').style.display = 'none';
    document.getElementById('mnPoElement').innerHTML     = '';
    _hideError();
    _resetPromoUI();
    _setLoading(true);
    _setPlanSummary(priceId);

    // Open overlay
    _overlay.classList.add('mnpo--open');
    if (typeof window._pushScrollLock === 'function') window._pushScrollLock(); else document.body.style.overflow = 'hidden';

    await _createAndMountPayment(priceId, email, null);
  }

  // Crea (o re-crea, si ya se habia creado antes) el PaymentIntent/
  // Subscription real en Stripe y monta el formulario de tarjeta.
  // `promoCode` ya debe venir VALIDADO (via /validate-promo-code) —
  // este endpoint TAMBIEN lo revalida server-side antes de aplicar
  // ningun descuento real al importe cobrado.
  async function _createAndMountPayment(priceId, email, promoCode) {
    try {
      // Safety timeout on the network request itself: if the backend has
      // a slow cold start or the connection simply hangs without ever
      // failing or resolving, abort after a reasonable wait instead of
      // leaving the promise pending forever. Aborting throws, which the
      // catch block below already handles by trying the checkout-redirect
      // fallback — exactly the right behavior here.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, email, promoCode: promoCode || undefined }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'invalid_promo_code') {
          // El backend rechazo el codigo en la revalidacion final —
          // no se crea ningun cargo con descuento fantasma.
          _showPromoResult(false, data.reason);
          _setLoading(false);
          return;
        }
        throw new Error(data.error ?? 'server_error');
      }

      _activeFlowType = data.type ?? 'payment';
      if (data.paymentIntentId) _activePaymentIntentId = data.paymentIntentId;
      if (data.pricing) _applyPricingToSummary(priceId, data.pricing);

      const stripe   = _getStripe();
      const appearance = {
        theme: 'night',
        variables: {
          colorPrimary:        '#00D4AA',
          colorBackground:     '#111827',
          colorText:           '#F1F5F9',
          colorTextSecondary:  '#94A3B8',
          colorTextPlaceholder:'#4B5563',
          colorDanger:         '#FB7185',
          fontFamily:          '"Inter", "Plus Jakarta Sans", system-ui, sans-serif',
          fontSizeBase:        '14px',
          borderRadius:        '10px',
          spacingUnit:         '5px',
          spacingGridColumn:   '16px',
          spacingGridRow:      '16px',
        },
        rules: {
          '.Input': {
            backgroundColor: '#1A2235',
            border:          '1px solid rgba(255,255,255,0.09)',
            color:           '#F1F5F9',
            boxShadow:       'none',
            padding:         '12px 14px',
          },
          '.Input:focus': {
            border:    '1px solid #00D4AA',
            boxShadow: '0 0 0 3px rgba(0,212,170,0.12)',
          },
          '.Input--invalid': {
            border: '1px solid rgba(251,113,133,0.5)',
          },
          '.Label': {
            color: '#94A3B8', fontWeight: '600', fontSize: '12px',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          },
          '.Tab': {
            backgroundColor: '#1A2235',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94A3B8',
            boxShadow: 'none',
          },
          '.Tab:hover': {
            backgroundColor: '#1E2A3F',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#F1F5F9',
          },
          '.Tab--selected': {
            backgroundColor: 'rgba(0,212,170,0.08)',
            borderColor: '#00D4AA',
            color: '#00D4AA',
            boxShadow: '0 0 0 1px #00D4AA',
          },
          '.TabIcon--selected': { fill: '#00D4AA' },
          '.TabLabel--selected': { color: '#00D4AA' },
          '.Block': { backgroundColor: '#1A2235', border: '1px solid rgba(255,255,255,0.08)' },
          '.PickerItem': { backgroundColor: '#1A2235', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' },
          '.PickerItem--selected': { backgroundColor: 'rgba(0,212,170,0.08)', borderColor: '#00D4AA', color: '#00D4AA' },
        },
      };

      // Si ya habia un formulario montado (re-creacion tras aplicar un
      // codigo promocional), lo desmontamos antes de montar el nuevo.
      if (_elements) {
        try { _elements.getElement('payment')?.unmount(); } catch (_) { /* ignore */ }
        _elements = null;
        document.getElementById('mnPoElement').innerHTML = '';
      }

      _elements = stripe.elements({
        clientSecret: data.clientSecret,
        appearance,
      });

      const paymentElement = _elements.create('payment');
      paymentElement.mount('#mnPoElement');

      // Safety timeout: if the embedded Stripe iframe never fires
      // 'ready' (blocked by an ad/privacy blocker or browser extension,
      // or a transient network issue loading Stripe's internal resources
      // that happens AFTER the initial fetch already succeeded), the
      // loading spinner would otherwise spin forever with no error and
      // no way to recover — this is the root cause of the button
      // appearing permanently stuck. Whichever fires first — 'ready' or
      // this timeout — wins; the other becomes a no-op.
      let readyFired = false;
      paymentElement.on('ready', () => { readyFired = true; _setLoading(false); });
      setTimeout(() => {
        if (readyFired) return;
        // Don't touch anything if the user already closed the modal.
        if (!_overlay || !_overlay.classList.contains('mnpo--open')) return;
        console.warn('[MNPayment] Payment element never fired "ready" — surfacing a recoverable error instead of leaving the spinner stuck.');
        _showError(_spt('payment_error_timeout', 'El formulario de pago está tardando demasiado en cargar. Comprueba tu conexión, desactiva bloqueadores de anuncios/privacidad si los tienes activos, y vuelve a intentarlo.'));
      }, 10000);

      if (promoCode) _showPromoResult(true, null, data.pricing);

    } catch (err) {
      // Fallback: if the embedded payment-intent endpoint is unavailable,
      // try the redirect-based Stripe Checkout flow instead.
      console.warn('[MNPayment] Embedded payment failed, trying checkout redirect fallback:', err);
      try {
        const fbController = new AbortController();
        const fbTimeoutId = setTimeout(() => fbController.abort(), 15000);
        const checkoutRes = await fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId, email, promoCode: promoCode || undefined }),
          signal: fbController.signal,
        });
        clearTimeout(fbTimeoutId);
        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }
        throw new Error(checkoutData.error ?? 'checkout_fallback_failed');
      } catch (fallbackErr) {
        console.error('[MNPayment] Checkout fallback also failed:', fallbackErr);
        _showError(_spt('payment_error_init', 'No se pudo iniciar el pago. Comprueba tu conexión e inténtalo de nuevo.'));
        _setLoading(false);
      }
    }
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('mnpo--open');
    if (typeof window._popScrollLock === 'function') window._popScrollLock(); else document.body.style.overflow = '';
    // Small delay so close animation plays before cleanup
    setTimeout(() => {
      if (_elements) {
        try { _elements.getElement('payment')?.unmount(); } catch (_) { /* ignore */ }
      }
      _elements = null;
    }, 300);
  }

  function init() {
    _checkReturnParams();
  }

  return { open, close, init };
})();
