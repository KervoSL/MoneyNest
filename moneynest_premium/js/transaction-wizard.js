/**
 * MoneyNest — js/transaction-wizard.js
 * Asistente de creación de ingreso/gasto en 3 pasos (importe+cuenta →
 * nombre+categoría → fecha+detalles), reutilizando la misma base
 * visual .mnbi-* ya usada por el importador bancario y el asistente
 * de inversión. Al finalizar, rellena el formulario clásico oculto
 * (ingresoModal/gastoModal) y llama a guardarIngreso()/guardarGasto()
 * directamente — así se reutiliza toda su lógica ya probada
 * (validación, saldo, recurrencia, aprendizaje de comercio, y el
 * modal de "¿qué quieres hacer ahora?" ya existente) sin duplicar
 * nada. Editar una transacción existente sigue usando el modal
 * clásico de una sola pantalla, sin cambios.
 */
;(function () {
  'use strict';

  const TOTAL_STEPS = 3;
  let ST = null;

  function _t(key, fallback) { return (window.t ? window.t(key, fallback) : fallback); }

  function _defaultState(tipo) {
    return {
      tipo, // 'gasto' | 'ingreso'
      step: 1,
      importe: '',
      cuentaId: '',
      nombre: '',
      categoria: '',
      isNewCategory: false,
      newCategoryName: '',
      fecha: (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10)),
      notas: '',
      recurrente: false,
      diaDelMes: '1',
      pendiente: false,
    };
  }

  function open(tipo) {
    ST = _defaultState(tipo === 'ingreso' ? 'ingreso' : 'gasto');
    // If there's only one account, resolve it silently — no point
    // asking about something with a single possible answer.
    if (S.cuentas && S.cuentas.length === 1) ST.cuentaId = S.cuentas[0].id;
    _ensureStyles();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-overlay" id="mnTxWizardOverlay" onclick="if(event.target===this)MNTxWizard.close()"></div>');
    if (typeof _pushScrollLock === 'function') _pushScrollLock();
    _render();
    requestAnimationFrame(() => document.getElementById('mnTxWizardOverlay')?.classList.add('open'));
  }

  function close() {
    document.getElementById('mnTxWizardOverlay')?.remove();
    if (typeof _popScrollLock === 'function') _popScrollLock();
    ST = null;
  }

  function _overlay() { return document.getElementById('mnTxWizardOverlay'); }

  function _ensureStyles() {
    if (document.getElementById('mn-txwiz-style')) return;
    const s = document.createElement('style');
    s.id = 'mn-txwiz-style';
    s.textContent = `
      #mnTxWizardOverlay { z-index: 9600; }
      #mnTxWizardOverlay .modal { max-width: 480px; width: 94vw; max-height: 88vh; max-height: 88dvh; padding:0; overflow:hidden; }
      .mntw-amount-input { width:100%; border:none; background:transparent; text-align:center; font-size:2.6rem; font-weight:800; color:var(--text); outline:none; padding:20px 0 8px; }
      .mntw-amount-input::placeholder { color:var(--text3); }
    `;
    document.head.appendChild(s);
  }

  function _stepDots() {
    let html = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      html += `<div class="mnbi-step-dot ${i < ST.step ? 'done' : ''} ${i === ST.step ? 'active' : ''}"></div>`;
    }
    return html;
  }

  function _shell(bodyHtml, footerHtml) {
    const ov = _overlay();
    if (!ov) return;
    const esIngreso = ST.tipo === 'ingreso';
    ov.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="mnbi-wrap">
          <div class="mnbi-head">
            <div class="mnbi-title-row">
              <div class="mnbi-title">${esIngreso ? '💰' : '💸'} ${esIngreso ? _t('txwiz_titulo_ingreso','Nuevo ingreso') : _t('txwiz_titulo_gasto','Nuevo gasto')}</div>
              <button class="mnbi-close" onclick="MNTxWizard.close()">✕</button>
            </div>
            <div class="mnbi-steps">${_stepDots()}</div>
          </div>
          <div class="mnbi-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="mnbi-footer">${footerHtml}</div>` : ''}
        </div>
      </div>`;
  }

  function _backBtn(disabled) {
    return `<button class="mnbi-btn-back" ${disabled ? 'style="visibility:hidden"' : ''} onclick="MNTxWizard._back()">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      ${_t('bi_atras','Atrás')}
    </button>`;
  }
  function _back() { ST.step = Math.max(1, ST.step - 1); _render(); }

  function _render() {
    if (ST.step === 1) return _renderStep1();
    if (ST.step === 2) return _renderStep2();
    if (ST.step === 3) return _renderStep3();
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 1 — IMPORTE + CUENTA ──────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _cuentasChipsHtml() {
    const cuentas = S.cuentas || [];
    if (cuentas.length <= 1) return '';
    return `
      <label style="font-size:.78rem;color:var(--text2);display:block;margin:18px 0 8px;text-align:center">${_t('txwiz_cuenta_lbl','¿En qué cuenta?')}</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
        ${cuentas.map(c => `<button type="button" onclick="MNTxWizard._chooseCuenta('${c.id}')" style="padding:8px 14px;border-radius:99px;font-size:.82rem;font-weight:600;cursor:pointer;border:1.5px solid ${ST.cuentaId===c.id?'var(--accent)':'var(--border2)'};background:${ST.cuentaId===c.id?'var(--accent-dim)':'var(--bg2)'};color:${ST.cuentaId===c.id?'var(--accent)':'var(--text2)'}">${c.nombre}</button>`).join('')}
      </div>`;
  }

  function _renderStep1() {
    const body = `
      <div class="mnbi-step-label" style="text-align:center">${_t('bi_paso','Paso')} 1 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <input type="text" inputmode="decimal" class="mntw-amount-input" id="txwizImporte" placeholder="0,00 €" value="${ST.importe||''}" onkeydown="if(event.key==='Enter')MNTxWizard._toStep2()">
      ${_cuentasChipsHtml()}
    `;
    const footer = `${_backBtn(true)}
      <button class="mnbi-btn-primary" id="txwizNextBtn1" onclick="MNTxWizard._toStep2()">
        ${_t('bi_continuar','Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
    setTimeout(() => document.getElementById('txwizImporte')?.focus(), 80)
  }

  function _chooseCuenta(cuentaId) {
    // Preserve whatever the user already typed before re-rendering —
    // otherwise the re-render would wipe it back to the stale ST.importe.
    const inp = document.getElementById('txwizImporte')
    if (inp) ST.importe = inp.value
    ST.cuentaId = cuentaId;
    _render();
  }

  function _toStep2() {
    const raw = document.getElementById('txwizImporte').value;
    const importe = window.parseAmount ? parseAmount(raw) : parseFloat(raw);
    if (!importe || importe <= 0) { if (window.toast) toast(_t('err_importe','Introduce un importe válido'),'error'); return }
    if ((S.cuentas||[]).length > 0 && !ST.cuentaId) { if (window.toast) toast(_t('err_selecciona_cuenta','Selecciona una cuenta'),'error'); return }
    ST.importe = raw;
    ST.step = 2;
    _render();
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 2 — NOMBRE + CATEGORÍA ─────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep2() {
    const cats = ST.tipo === 'ingreso' ? (S.categorias.ingreso||[]) : (S.categorias.gasto||[]);
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 2 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('txwiz_s2_titulo','¿En qué concepto y categoría?')}</div>
      <input type="text" class="mnbi-input" id="txwizNombre" placeholder="${_t('txwiz_s2_placeholder','Ej: Cena con amigos, Nómina...')}" value="${(ST.nombre||'').replace(/"/g,'&quot;')}" style="margin-bottom:16px" onkeydown="if(event.key==='Enter')MNTxWizard._toStep3()">
      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:8px">${_t('categoria_lbl','Categoría')}</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${cats.map(c => `<button type="button" onclick="MNTxWizard._chooseCategoria('${c.replace(/'/g,"\\'")}')" style="padding:7px 13px;border-radius:99px;font-size:.8rem;font-weight:600;cursor:pointer;border:1.5px solid ${ST.categoria===c && !ST.isNewCategory?'var(--accent)':'var(--border2)'};background:${ST.categoria===c && !ST.isNewCategory?'var(--accent-dim)':'var(--bg2)'};color:${ST.categoria===c && !ST.isNewCategory?'var(--accent)':'var(--text2)'}">${window.catEmoji ? catEmoji(c) : '📁'} ${c}</button>`).join('')}
        <button type="button" onclick="MNTxWizard._chooseNewCategoria()" style="padding:7px 13px;border-radius:99px;font-size:.8rem;font-weight:600;cursor:pointer;border:1.5px dashed var(--border2);background:transparent;color:var(--text2)">➕ ${_t('bi_nueva_categoria','Nueva categoría...')}</button>
      </div>
      ${ST.isNewCategory ? `<input type="text" class="mnbi-input" id="txwizNewCat" placeholder="${_t('invwiz_nombre_categoria','Nombre de la categoría')}" value="${(ST.newCategoryName||'').replace(/"/g,'&quot;')}" style="margin-top:12px">` : ''}
    `;
    const footer = `${_backBtn(false)}
      <button class="mnbi-btn-primary" onclick="MNTxWizard._toStep3()">
        ${_t('bi_continuar','Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
    setTimeout(() => {
      const inp = document.getElementById('txwizNombre')
      if (!ST.nombre) inp?.focus()
      document.getElementById('txwizNewCat')?.focus()
    }, 80)
  }

  function _chooseCategoria(cat) {
    ST.categoria = cat;
    ST.isNewCategory = false;
    const nombreInput = document.getElementById('txwizNombre')
    ST.nombre = (nombreInput?.value || ST.nombre || '').trim()
    if (ST.nombre) { ST.step = 3; _render(); return } // both filled — auto-advance
    _render() // just highlight the choice, wait for the name
  }
  function _chooseNewCategoria() {
    const nombreInput = document.getElementById('txwizNombre')
    if (nombreInput) ST.nombre = nombreInput.value
    ST.isNewCategory = true;
    _render();
  }

  function _toStep3() {
    const nombre = (document.getElementById('txwizNombre')?.value || '').trim()
    if (!nombre) { if (window.toast) toast(_t('err_concepto','Escribe un concepto'),'error'); document.getElementById('txwizNombre')?.focus(); return }
    ST.nombre = nombre
    if (ST.isNewCategory) {
      const newCat = (document.getElementById('txwizNewCat')?.value || '').trim()
      if (!newCat) { if (window.toast) toast(_t('err_categoria','Escribe el nombre de la categoría'),'error'); return }
      ST.newCategoryName = newCat
      ST.categoria = newCat
    }
    if (!ST.categoria) { if (window.toast) toast(_t('err_categoria_elegir','Elige una categoría'),'error'); return }
    ST.step = 3
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 3 — FECHA + DETALLES ───────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep3() {
    const esGasto = ST.tipo === 'gasto';
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 3 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('txwiz_s3_titulo','Últimos detalles')}</div>
      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('cfg_fecha','Fecha')}</label>
      <input type="date" class="mnbi-input" id="txwizFecha" value="${ST.fecha||''}" style="margin-bottom:14px">

      <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--text2);cursor:pointer;margin-bottom:10px">
        <input type="checkbox" id="txwizRecurrente" ${ST.recurrente?'checked':''} style="width:auto;margin:0" onchange="MNTxWizard._toggleRecurrente(this.checked)">
        ${esGasto ? _t('txwiz_gasto_recurrente','Gasto recurrente (cada mes)') : _t('txwiz_ingreso_recurrente','Ingreso recurrente (mensual)')}
      </label>
      ${(ST.recurrente && esGasto) ? `
        <div style="margin:-4px 0 14px 26px">
          <label style="font-size:.76rem;color:var(--text3);display:block;margin-bottom:4px">${_t('txwiz_dia_del_mes','Día del mes')}</label>
          <input type="number" min="1" max="31" class="mnbi-input" id="txwizDiaDelMes" value="${ST.diaDelMes||'1'}" style="width:90px">
        </div>
      ` : ''}

      ${!esGasto ? `
      <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--text2);cursor:pointer;margin-bottom:14px">
        <input type="checkbox" id="txwizPendiente" ${ST.pendiente?'checked':''} style="width:auto;margin:0">
        ${_t('txwiz_pendiente','Pendiente de cobro (no ingresado aún)')}
      </label>` : ''}

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('cfg_notas','Notas')} (${_t('opcional','opcional')})</label>
      <textarea class="mnbi-input" id="txwizNotas" rows="2" style="resize:vertical">${ST.notas||''}</textarea>
    `;
    const footer = `${_backBtn(false)}
      <button class="mnbi-btn-primary" onclick="MNTxWizard._finish()">
        ${_t('btn_guardar','Guardar')} ✓
      </button>`;
    _shell(body, footer);
  }

  function _toggleRecurrente(checked) {
    ST.recurrente = checked
    _render()
  }

  function _finish() {
    const fecha = document.getElementById('txwizFecha').value || ST.fecha
    const notas = document.getElementById('txwizNotas')?.value.trim() || ''
    const recurrente = document.getElementById('txwizRecurrente')?.checked || false
    const diaDelMes = document.getElementById('txwizDiaDelMes')?.value || '1'
    const pendiente = document.getElementById('txwizPendiente')?.checked || false

    const esGasto = ST.tipo === 'gasto'
    const modalId = esGasto ? 'gastoModal' : 'ingresoModal'
    const prefix = esGasto ? 'gasto' : 'ingreso'

    // Reset the hidden classic form first (clears any stray state from
    // a previous manual edit), then fill it with everything gathered
    // across the 3 steps, and call the REAL save function — reusing
    // all its already-proven logic (validation, balance updates,
    // recurrence, merchant learning, and the existing "what next?"
    // modal) instead of re-implementing any of it here.
    if (esGasto) { if (typeof resetGastoForm === 'function') resetGastoForm() }
    else { if (typeof resetIngresoForm === 'function') resetIngresoForm() }

    document.getElementById(`${prefix}Concepto`).value = ST.nombre
    document.getElementById(`${prefix}Importe`).value = ST.importe
    document.getElementById(`${prefix}Fecha`).value = fecha
    document.getElementById(`${prefix}Notas`).value = notas
    if (ST.cuentaId) document.getElementById(`${prefix}Cuenta`).value = ST.cuentaId

    // Category: if it's a brand-new one, use the same inline-create
    // path the classic form already relies on (getOrCreateCat reads
    // these exact element ids) instead of duplicating that logic.
    const catSelect = document.getElementById(`${prefix}Cat`)
    if (ST.isNewCategory) {
      let opt = Array.from(catSelect.options).find(o => o.value === '__custom__')
      if (opt) catSelect.value = '__custom__'
      const customInput = document.getElementById(`${prefix}CatCustomInput`)
      if (customInput) customInput.value = ST.newCategoryName
    } else {
      catSelect.value = ST.categoria
    }

    document.getElementById(`${prefix}Recurrente`).checked = recurrente
    if (esGasto) {
      const dayToggle = document.getElementById('gastoRecurrenteDay')
      if (dayToggle) dayToggle.checked = recurrente
      const diaInput = document.getElementById('gastoRecurrenteDia')
      if (diaInput) diaInput.value = diaDelMes
    } else {
      const pendienteEl = document.getElementById('ingresoPendiente')
      if (pendienteEl) pendienteEl.checked = pendiente
      const updateSaldoEl = document.getElementById('ingresoUpdateSaldo')
      if (updateSaldoEl) updateSaldoEl.checked = true
    }
    if (esGasto) {
      const updateSaldoEl = document.getElementById('gastoUpdateSaldo')
      if (updateSaldoEl) updateSaldoEl.checked = true
    }

    close()
    if (esGasto) guardarGasto(); else guardarIngreso()
  }

  window.MNTxWizard = { open, close, _back, _toStep2, _chooseCuenta, _chooseCategoria, _chooseNewCategoria, _toStep3, _toggleRecurrente, _finish };
})();
