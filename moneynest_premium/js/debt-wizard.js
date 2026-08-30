/**
 * MoneyNest — js/debt-wizard.js
 * Asistente de creación de deuda en 4 pasos (nombre → tipo de deuda →
 * importes → detalles), reutilizando la misma base visual .mnbi-*
 * (ahora en css/wizard-shared.css, siempre cargada) que el resto de
 * asistentes de la app. Igual que con inversión e ingreso/gasto: al
 * finalizar, rellena el formulario clásico oculto (deudaModal) y
 * llama a guardarDeuda() ya existente — reutiliza toda su lógica ya
 * probada sin duplicarla. Editar una deuda existente sigue usando el
 * modal clásico de una sola pantalla, sin cambios.
 */
;(function () {
  'use strict';

  const TOTAL_STEPS = 4;
  let ST = null;

  function _t(key, fallback) { return (window.t ? window.t(key, fallback) : fallback); }

  function _defaultState() {
    return {
      step: 1,
      nombre: '',
      categoria: '',
      isNewCategory: false,
      newCategoryName: '',
      total: '',
      pagado: '',
      interes: '',
      vencimiento: '',
      notas: '',
    };
  }

  function open() {
    ST = _defaultState();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-overlay" id="mnDebtWizardOverlay" onclick="if(event.target===this)MNDebtWizard.close()"></div>');
    if (typeof _pushScrollLock === 'function') _pushScrollLock();
    _ensureStyles();
    _render();
    requestAnimationFrame(() => document.getElementById('mnDebtWizardOverlay')?.classList.add('open'));
  }

  function close() {
    document.getElementById('mnDebtWizardOverlay')?.remove();
    if (typeof _popScrollLock === 'function') _popScrollLock();
    ST = null;
  }

  function _overlay() { return document.getElementById('mnDebtWizardOverlay'); }

  function _ensureStyles() {
    if (document.getElementById('mn-debtwiz-style')) return;
    const s = document.createElement('style');
    s.id = 'mn-debtwiz-style';
    s.textContent = `
      #mnDebtWizardOverlay { z-index: 9600; }
      #mnDebtWizardOverlay .modal { max-width: 480px; width: 94vw; max-height: 88vh; max-height: 88dvh; padding:0; overflow:hidden; }
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
    ov.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="mnbi-wrap">
          <div class="mnbi-head">
            <div class="mnbi-title-row">
              <div class="mnbi-title">💳 ${_t('debtwiz_titulo', 'Nueva deuda')}</div>
              <button class="mnbi-close" onclick="MNDebtWizard.close()">✕</button>
            </div>
            <div class="mnbi-steps">${_stepDots()}</div>
          </div>
          <div class="mnbi-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="mnbi-footer">${footerHtml}</div>` : ''}
        </div>
      </div>`;
  }

  function _backBtn(disabled) {
    return `<button class="mnbi-btn-back" ${disabled ? 'style="visibility:hidden"' : ''} onclick="MNDebtWizard._back()">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      ${_t('bi_atras', 'Atrás')}
    </button>`;
  }
  function _back() { ST.step = Math.max(1, ST.step - 1); _render(); }

  function _render() {
    if (ST.step === 1) return _renderStep1();
    if (ST.step === 2) return _renderStep2();
    if (ST.step === 3) return _renderStep3();
    if (ST.step === 4) return _renderStep4();
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 1 — NOMBRE ────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep1() {
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 1 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('debtwiz_s1_titulo','¿Cómo se llama esta deuda?')}</div>
      <div class="mnbi-sub">${_t('debtwiz_s1_sub','Por ejemplo: "Préstamo coche", "Tarjeta de crédito", "Hipoteca"...')}</div>
      <input type="text" class="mnbi-input" id="debtwizNombre" placeholder="${_t('debtwiz_s1_placeholder','Nombre de la deuda')}" value="${(ST.nombre||'').replace(/"/g,'&quot;')}" onkeydown="if(event.key==='Enter')MNDebtWizard._toStep2()">
    `;
    const footer = `${_backBtn(true)}
      <button class="mnbi-btn-primary" id="debtwizNextBtn1" onclick="MNDebtWizard._toStep2()" ${ST.nombre?'':'disabled'}>
        ${_t('bi_continuar','Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
    setTimeout(() => {
      const inp = document.getElementById('debtwizNombre')
      inp?.focus()
      inp?.addEventListener('input', () => {
        ST.nombre = inp.value
        const btn = document.getElementById('debtwizNextBtn1')
        if (btn) btn.disabled = !inp.value.trim()
      })
    }, 80)
  }
  function _toStep2() {
    const inp = document.getElementById('debtwizNombre')
    ST.nombre = (inp?.value || '').trim()
    if (!ST.nombre) return
    ST.step = 2
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 2 — TIPO DE DEUDA (CATEGORÍA) ─────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep2() {
    const cats = (S.categorias && S.categorias.deuda) || []
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 2 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('debtwiz_s2_titulo','¿Qué tipo de deuda es?')}</div>
      <div class="mnbi-sub">${_t('debtwiz_s2_sub','Elige una categoría existente o crea una nueva.')}</div>
      <div class="mnbi-radio-row">
        ${cats.map(c => `
          <div class="mnbi-radio-card ${ST.categoria===c && !ST.isNewCategory?'selected':''}" onclick="MNDebtWizard._chooseCategoria('${c.replace(/'/g,"\\'")}')">
            <span style="font-size:1.2rem">${window.catEmoji ? catEmoji(c) : '📁'}</span>
            <div style="font-weight:700;font-size:.88rem;color:var(--text)">${c}</div>
          </div>`).join('')}
        <div class="mnbi-radio-card ${ST.isNewCategory?'selected':''}" onclick="MNDebtWizard._chooseNewCategoria()">
          <span style="font-size:1.2rem">➕</span>
          <div style="font-weight:700;font-size:.88rem;color:var(--text)">${_t('bi_nueva_categoria','Nueva categoría...')}</div>
        </div>
      </div>
      ${ST.isNewCategory ? `
        <input type="text" class="mnbi-input" id="debtwizNewCat" placeholder="${_t('invwiz_nombre_categoria','Nombre de la categoría')}" value="${(ST.newCategoryName||'').replace(/"/g,'&quot;')}" style="margin-bottom:14px">
        <button class="mnbi-btn-primary" style="width:100%" onclick="MNDebtWizard._confirmNewCategoria()">${_t('bi_continuar','Continuar')}</button>
      ` : ''}
    `;
    const footer = ST.isNewCategory ? '' : `${_backBtn(false)}<span></span>`;
    _shell(body, footer);
    if (ST.isNewCategory) setTimeout(() => document.getElementById('debtwizNewCat')?.focus(), 80)
  }

  function _chooseCategoria(cat) {
    ST.categoria = cat
    ST.isNewCategory = false
    ST.step = 3
    _render()
  }
  function _chooseNewCategoria() {
    ST.isNewCategory = true
    _render()
  }
  function _confirmNewCategoria() {
    const nombre = (document.getElementById('debtwizNewCat')?.value || '').trim()
    if (!nombre) return
    ST.newCategoryName = nombre
    ST.categoria = nombre
    ST.step = 3
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 3 — IMPORTES ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep3() {
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 3 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('debtwiz_s3_titulo','¿Cuánto es la deuda?')}</div>

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('deuda_total_lbl','Importe total adeudado')}</label>
      <input type="text" inputmode="decimal" class="mnbi-input" id="debtwizTotal" placeholder="0.00" value="${ST.total||''}" style="margin-bottom:14px">

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('deuda_pagado_lbl','Ya pagado hasta ahora')} (${_t('opcional','opcional')})</label>
      <input type="text" inputmode="decimal" class="mnbi-input" id="debtwizPagado" placeholder="0.00" value="${ST.pagado||''}" style="margin-bottom:14px">

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('deuda_interes_lbl','Interés anual (%)')} (${_t('opcional','opcional')})</label>
      <input type="text" inputmode="decimal" class="mnbi-input" id="debtwizInteres" placeholder="0" value="${ST.interes||''}">
    `;
    const footer = `${_backBtn(false)}
      <button class="mnbi-btn-primary" onclick="MNDebtWizard._toStep4()">
        ${_t('bi_continuar','Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
    setTimeout(() => document.getElementById('debtwizTotal')?.focus(), 80)
  }

  function _toStep4() {
    const raw = document.getElementById('debtwizTotal').value
    const total = window.parseAmount ? parseAmount(raw) : parseFloat(raw)
    if (!total || total <= 0) { if (window.toast) toast(_t('err_importe','Introduce un importe válido'),'error'); return }
    ST.total = raw
    ST.pagado = document.getElementById('debtwizPagado').value
    ST.interes = document.getElementById('debtwizInteres').value
    ST.step = 4
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 4 — DETALLES ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep4() {
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 4 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('debtwiz_s4_titulo','Últimos detalles')}</div>

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('deuda_vencimiento_lbl','Fecha de vencimiento')} (${_t('opcional','opcional')})</label>
      <input type="date" class="mnbi-input" id="debtwizVencimiento" value="${ST.vencimiento||''}" style="margin-bottom:14px">

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('cfg_notas','Notas')} (${_t('opcional','opcional')})</label>
      <textarea class="mnbi-input" id="debtwizNotas" rows="2" style="resize:vertical">${ST.notas||''}</textarea>
    `;
    const footer = `${_backBtn(false)}
      <button class="mnbi-btn-primary" onclick="MNDebtWizard._finish()">
        ${_t('debtwiz_crear','Crear deuda')} ✓
      </button>`;
    _shell(body, footer);
  }

  function _finish() {
    const vencimiento = document.getElementById('debtwizVencimiento').value || ''
    const notas = document.getElementById('debtwizNotas')?.value.trim() || ''

    // Reset the hidden classic form (populates the category selector
    // from scratch), then fill it with everything gathered across the
    // 4 steps, and call the REAL save function — reusing all its
    // already-proven logic instead of re-implementing it here.
    if (typeof resetDeudaForm === 'function') resetDeudaForm()

    document.getElementById('deudaNombre').value = ST.nombre
    document.getElementById('deudaTotal').value = ST.total
    document.getElementById('deudaPagado').value = ST.pagado || ''
    document.getElementById('deudaInteres').value = ST.interes || ''
    document.getElementById('deudaVencimiento').value = vencimiento
    document.getElementById('deudaNotas').value = notas

    const catSelect = document.getElementById('deudaCat')
    if (ST.isNewCategory) {
      const opt = Array.from(catSelect.options).find(o => o.value === '__custom__')
      if (opt) catSelect.value = '__custom__'
      const customInput = document.getElementById('deudaCatCustomInput')
      if (customInput) customInput.value = ST.newCategoryName
    } else if (ST.categoria) {
      catSelect.value = ST.categoria
    }

    close()
    guardarDeuda()
  }

  window.MNDebtWizard = { open, close, _back, _toStep2, _chooseCategoria, _chooseNewCategoria, _confirmNewCategoria, _toStep4, _finish };
})();
