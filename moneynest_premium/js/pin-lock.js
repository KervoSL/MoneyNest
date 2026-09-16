/**
 * MoneyNest — js/pin-lock.js
 * Bloqueo de la app con PIN numérico (4-6 dígitos). Es una pantalla de
 * privacidad local (evitar que alguien que coja el móvil vea las
 * finanzas), NO un sistema de cifrado — los datos en localStorage
 * siguen igual de accesibles a bajo nivel que antes. El PIN nunca se
 * guarda en texto plano, solo su hash SHA-256.
 */
;(function () {
  'use strict';

  const LS_HASH    = 'mn_pin_hash';
  const LS_ENABLED = 'mn_pin_enabled';
  const LS_TIMING  = 'mn_pin_timing'; // 'immediate' | '1min' | '5min'
  const LS_LENGTH  = 'mn_pin_length'; // 4 | 6

  let _hiddenAt = null;
  let _overlayEl = null;
  let _enteredDigits = '';
  let _failCount = 0;

  function _t(key, fb) { return (typeof window.t === 'function' ? window.t(key, fb) : fb); }

  function _hasEligiblePlan() {
    try { return typeof getUser === 'function' && (getUser().plan === 'local' || getUser().plan === 'pro'); }
    catch (_) { return false; }
  }

  function isEnabled() {
    try {
      const enabled = localStorage.getItem(LS_ENABLED) === 'true' && !!localStorage.getItem(LS_HASH);
      if (enabled && !_hasEligiblePlan()) {
        // Plan lapsed since the PIN was set up (e.g. subscription
        // expired) — auto-disable rather than lock someone out of
        // their own data over a premium feature they no longer have.
        disable();
        return false;
      }
      return enabled;
    }
    catch (_) { return false; }
  }

  function getPinLength() {
    try { return Number(localStorage.getItem(LS_LENGTH)) || 4; }
    catch (_) { return 4; }
  }

  function getTiming() {
    try { return localStorage.getItem(LS_TIMING) || 'immediate'; }
    catch (_) { return 'immediate'; }
  }

  function setTiming(val) {
    try { localStorage.setItem(LS_TIMING, val); } catch (_) {}
  }

  async function _hash(pin) {
    const enc = new TextEncoder().encode('mn_pin_salt_v1:' + pin);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function setup(pin) {
    const h = await _hash(pin);
    try {
      localStorage.setItem(LS_HASH, h);
      localStorage.setItem(LS_ENABLED, 'true');
      localStorage.setItem(LS_LENGTH, String(pin.length));
    } catch (_) {}
  }

  function disable() {
    try {
      localStorage.removeItem(LS_HASH);
      localStorage.removeItem(LS_ENABLED);
    } catch (_) {}
  }

  async function _verify(pin) {
    try {
      const stored = localStorage.getItem(LS_HASH);
      if (!stored) return false;
      const h = await _hash(pin);
      return h === stored;
    } catch (_) { return false; }
  }

  // ── Auto-lock timing: re-lock when returning from background if
  // enough time passed while hidden. 'immediate' always re-locks. ──
  function _timingMs(timing) {
    if (timing === '1min') return 60 * 1000;
    if (timing === '5min') return 5 * 60 * 1000;
    return 0; // immediate
  }

  document.addEventListener('visibilitychange', () => {
    if (!isEnabled()) return;
    if (document.hidden) {
      _hiddenAt = Date.now();
    } else if (_hiddenAt) {
      const elapsed = Date.now() - _hiddenAt;
      const threshold = _timingMs(getTiming());
      if (elapsed >= threshold) lock();
      _hiddenAt = null;
    }
  });

  function checkOnLoad() {
    if (isEnabled()) lock();
  }

  function lock() {
    if (_overlayEl) return; // already locked
    _enteredDigits = '';
    _overlayEl = document.createElement('div');
    _overlayEl.id = 'mnPinLockOverlay';
    _overlayEl.innerHTML = _renderScreen();
    document.body.appendChild(_overlayEl);
    _wireKeypad();
  }

  function _unlock() {
    if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
    _enteredDigits = '';
    _failCount = 0;
  }

  function _renderScreen() {
    const len = getPinLength();
    const dots = Array.from({ length: len }).map((_, i) =>
      `<div class="mnpin-dot" data-i="${i}"></div>`
    ).join('');
    const keys = [1,2,3,4,5,6,7,8,9,'','0','del'].map(k => {
      if (k === '') return '<div class="mnpin-key mnpin-key--empty"></div>';
      if (k === 'del') return `<button class="mnpin-key mnpin-key--del" data-key="del" aria-label="Borrar">⌫</button>`;
      return `<button class="mnpin-key" data-key="${k}">${k}</button>`;
    }).join('');
    return `
      <div class="mnpin-wrap">
        <div class="mnpin-icon">🔒</div>
        <div class="mnpin-title">${_t('pin_titulo','Introduce tu PIN')}</div>
        <div class="mnpin-dots" id="mnpinDots">${dots}</div>
        <div class="mnpin-error" id="mnpinError" style="display:none">${_t('pin_incorrecto','PIN incorrecto')}</div>
        <div class="mnpin-keypad">${keys}</div>
        <button class="mnpin-forgot" id="mnpinForgot">${_t('pin_olvidaste','¿Olvidaste tu PIN?')}</button>
      </div>`;
  }

  function _wireKeypad() {
    if (!_overlayEl) return;
    _overlayEl.querySelectorAll('.mnpin-key[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'del') { _enteredDigits = _enteredDigits.slice(0, -1); }
        else if (_enteredDigits.length < getPinLength()) { _enteredDigits += key; }
        _updateDots();
        if (_enteredDigits.length === getPinLength()) _attemptUnlock();
      });
    });
    const forgotBtn = _overlayEl.querySelector('#mnpinForgot');
    if (forgotBtn) forgotBtn.addEventListener('click', _showForgotFlow);
  }

  function _updateDots() {
    if (!_overlayEl) return;
    _overlayEl.querySelectorAll('.mnpin-dot').forEach((dot, i) => {
      dot.classList.toggle('filled', i < _enteredDigits.length);
    });
  }

  async function _attemptUnlock() {
    const ok = await _verify(_enteredDigits);
    if (ok) { _unlock(); return; }
    _failCount++;
    const wrap = _overlayEl?.querySelector('.mnpin-wrap');
    const errorEl = _overlayEl?.querySelector('#mnpinError');
    if (errorEl) errorEl.style.display = 'block';
    if (wrap) {
      wrap.classList.add('mnpin-shake');
      setTimeout(() => wrap.classList.remove('mnpin-shake'), 400);
    }
    _enteredDigits = '';
    _updateDots();
    // Small growing delay after repeated failures — a mild deterrent
    // against someone who picked up the phone trying combinations,
    // without being punitive for genuine typos (first 2 attempts are
    // instant).
    if (_failCount > 2) {
      const keypad = _overlayEl?.querySelector('.mnpin-keypad');
      if (keypad) {
        keypad.style.pointerEvents = 'none';
        setTimeout(() => { if (keypad) keypad.style.pointerEvents = ''; }, Math.min(_failCount * 500, 3000));
      }
    }
  }

  // ── "Forgot PIN" recovery. This is a local privacy screen, not a
  // vault — the goal here isn't to make recovery impossible, it's to
  // add real friction so a stranger holding the phone can't just tap
  // through it. If the person has a real MoneyNest account, verify
  // their actual password before disabling the PIN; if they're a
  // fully local user with no account, fall back to a plain confirm
  // (there's no other identity to check in that case).
  function _showForgotFlow() {
    const hasAccount = window.MNSupabaseAuth?.isLoggedIn?.() && !window.MNSupabaseAuth?.getProvider?.();
    if (hasAccount) {
      _showPasswordPrompt();
    } else {
      if (typeof confirmar === 'function') {
        confirmar(
          _t('pin_olvidaste_confirm','¿Quitar el bloqueo por PIN? Esto no borra ningún dato, solo desactiva el PIN.'),
          () => { disable(); _unlock(); },
          { titulo: _t('pin_olvidaste_titulo','Quitar bloqueo'), icono: '🔓' }
        );
      } else if (confirm(_t('pin_olvidaste_confirm','¿Quitar el bloqueo por PIN?'))) {
        disable(); _unlock();
      }
    }
  }

  function _showPasswordPrompt() {
    if (!_overlayEl) return;
    const wrap = _overlayEl.querySelector('.mnpin-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="mnpin-icon">🔑</div>
      <div class="mnpin-title">${_t('pin_verifica_password','Verifica tu contraseña de MoneyNest')}</div>
      <div class="mnpin-sub">${_t('pin_verifica_password_sub','Para quitar el bloqueo por PIN, confirma que eres tú.')}</div>
      <input type="password" id="mnpinPasswordInput" class="mnpin-password-input" placeholder="${_t('pin_password_placeholder','Contraseña')}" autocomplete="current-password">
      <div class="mnpin-error" id="mnpinPasswordError" style="display:none">${_t('pin_password_incorrecta','Contraseña incorrecta')}</div>
      <button class="mnpin-confirm-btn" id="mnpinPasswordConfirm">${_t('pin_confirmar','Confirmar')}</button>
      <button class="mnpin-forgot" id="mnpinCancelPassword">${_t('bi_cancelar','Cancelar')}</button>
    `;
    const input = wrap.querySelector('#mnpinPasswordInput');
    const errorEl = wrap.querySelector('#mnpinPasswordError');
    input?.focus();
    const doVerify = async () => {
      const pwd = input.value;
      if (!pwd) return;
      const btn = wrap.querySelector('#mnpinPasswordConfirm');
      if (btn) { btn.disabled = true; btn.textContent = '…'; }
      try {
        const email = window.MNSupabaseAuth.getSession()?.user?.email;
        const result = await window.MNSupabaseAuth.verifyPassword?.(email, pwd);
        if (result) { disable(); _unlock(); if (typeof toast === 'function') toast(_t('pin_desactivado','PIN desactivado'), 'success'); }
        else { errorEl.style.display = 'block'; if (btn) { btn.disabled = false; btn.textContent = _t('pin_confirmar','Confirmar'); } }
      } catch (_) {
        errorEl.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = _t('pin_confirmar','Confirmar'); }
      }
    };
    wrap.querySelector('#mnpinPasswordConfirm')?.addEventListener('click', doVerify);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') doVerify(); });
    wrap.querySelector('#mnpinCancelPassword')?.addEventListener('click', () => {
      wrap.innerHTML = _renderScreen().match(/<div class="mnpin-wrap">([\s\S]*)<\/div>\s*$/)[1];
      _wireKeypad();
    });
  }

  // ── Setup flow (Configuración → activar/cambiar PIN) ────────────
  // Runs inside the classic modal system (pinSetupModal), reusing the
  // exact same visual keypad language as the lock screen itself.
  let _setupLength = 4;
  let _setupFirstPin = '';
  let _setupStage = 'length'; // 'length' | 'create' | 'confirm'
  let _setupDigits = '';
  let _onSetupDone = null;

  function startSetup(onDone) {
    _setupStage = 'length';
    _setupFirstPin = '';
    _setupDigits = '';
    _onSetupDone = onDone || null;
    if (typeof openModal === 'function') openModal('pinSetupModal');
    _renderSetupStage();
  }

  function _cancelSetup() {
    if (typeof closeModal === 'function') closeModal('pinSetupModal');
    if (_onSetupDone) _onSetupDone(false);
  }

  function _renderSetupStage() {
    const body = document.getElementById('pinSetupBody');
    const titleEl = document.getElementById('pinSetupTitle');
    if (!body) return;

    if (_setupStage === 'length') {
      if (titleEl) titleEl.textContent = _t('pin_elige_longitud','Elige la longitud del PIN');
      body.innerHTML = `
        <div class="mnpin-wrap" style="padding:8px 0">
          <div style="display:flex;gap:12px;width:100%">
            <button class="btn btn-secondary" style="flex:1" id="pinLen4">${_t('pin_4_digitos','4 dígitos')}</button>
            <button class="btn btn-secondary" style="flex:1" id="pinLen6">${_t('pin_6_digitos','6 dígitos')}</button>
          </div>
        </div>`;
      body.querySelector('#pinLen4').addEventListener('click', () => { _setupLength = 4; _setupStage = 'create'; _setupDigits=''; _renderSetupStage(); });
      body.querySelector('#pinLen6').addEventListener('click', () => { _setupLength = 6; _setupStage = 'create'; _setupDigits=''; _renderSetupStage(); });
      return;
    }

    const isConfirm = _setupStage === 'confirm';
    if (titleEl) titleEl.textContent = isConfirm ? _t('pin_confirma','Confirma tu PIN') : _t('pin_crea','Crea tu PIN');
    const dots = Array.from({ length: _setupLength }).map((_, i) =>
      `<div class="mnpin-dot" data-i="${i}"></div>`
    ).join('');
    const keys = [1,2,3,4,5,6,7,8,9,'','0','del'].map(k => {
      if (k === '') return '<div class="mnpin-key mnpin-key--empty"></div>';
      if (k === 'del') return `<button class="mnpin-key mnpin-key--del" data-key="del" aria-label="Borrar">⌫</button>`;
      return `<button class="mnpin-key" data-key="${k}">${k}</button>`;
    }).join('');
    body.innerHTML = `
      <div class="mnpin-wrap" style="padding:8px 0">
        <div class="mnpin-dots" id="pinSetupDots">${dots}</div>
        <div class="mnpin-error" id="pinSetupError" style="display:none">${_t('pin_no_coincide','Los PIN no coinciden. Inténtalo de nuevo.')}</div>
        <div class="mnpin-keypad">${keys}</div>
      </div>`;
    body.querySelectorAll('.mnpin-key[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'del') { _setupDigits = _setupDigits.slice(0, -1); }
        else if (_setupDigits.length < _setupLength) { _setupDigits += key; }
        body.querySelectorAll('.mnpin-dot').forEach((dot, i) => dot.classList.toggle('filled', i < _setupDigits.length));
        if (_setupDigits.length === _setupLength) _advanceSetup();
      });
    });
  }

  async function _advanceSetup() {
    if (_setupStage === 'create') {
      _setupFirstPin = _setupDigits;
      _setupDigits = '';
      _setupStage = 'confirm';
      _renderSetupStage();
      return;
    }
    // confirm stage
    if (_setupDigits === _setupFirstPin) {
      await setup(_setupDigits);
      if (typeof closeModal === 'function') closeModal('pinSetupModal');
      if (typeof toast === 'function') toast(_t('pin_activado','PIN activado'), 'success');
      if (_onSetupDone) _onSetupDone(true);
    } else {
      const errorEl = document.getElementById('pinSetupError');
      if (errorEl) errorEl.style.display = 'block';
      _setupDigits = '';
      _setupFirstPin = '';
      _setupStage = 'create';
      setTimeout(_renderSetupStage, 700);
    }
  }

  window.MNPinLock = { isEnabled, setup, disable, checkOnLoad, lock, getPinLength, getTiming, setTiming, hasEligiblePlan: _hasEligiblePlan, startSetup, _cancelSetup };
})();
