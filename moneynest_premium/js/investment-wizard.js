/**
 * MoneyNest — js/investment-wizard.js
 * Asistente de creación de inversión en 4 pasos (nombre → de dónde sale
 * el dinero → tipo de inversión → detalles), reutilizando la misma
 * base visual del asistente de importación bancaria (clases .mnbi-*
 * ya cargadas) en vez de construir un sistema de pasos nuevo desde
 * cero. La edición de una inversión existente sigue usando el modal
 * clásico de una sola pantalla (más rápido para corregir un campo) —
 * este asistente es solo para CREAR.
 */
;(function () {
  'use strict';

  const TOTAL_STEPS = 4;
  let ST = null;

  function _defaultState() {
    return {
      step: 1,
      nombre: '',
      moneySource: null,      // 'link-expense' | 'new-expense' | 'no-deduct'
      linkedExpenseId: null,
      cuentaId: '',
      categoria: '',
      isNewCategory: false,
      newCategoryName: '',
      newCategoryVolatile: false,
      importe: '',
      fecha: '',
      rentabilidad: '',
      notas: '',
    };
  }

  function _t(key, fallback) { return (window.t ? window.t(key, fallback) : fallback); }

  function open() {
    ST = _defaultState();
    ST.fecha = (window.todayISO ? todayISO() : new Date().toISOString().slice(0,10));
    _ensureStyles();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-overlay" id="mnInvWizardOverlay" onclick="if(event.target===this)MNInvWizard.close()"></div>');
    if (typeof _pushScrollLock === 'function') _pushScrollLock();
    _render();
    requestAnimationFrame(() => document.getElementById('mnInvWizardOverlay')?.classList.add('open'));
  }

  function close() {
    document.getElementById('mnInvWizardOverlay')?.remove();
    if (typeof _popScrollLock === 'function') _popScrollLock();
    ST = null;
  }

  function _overlay() { return document.getElementById('mnInvWizardOverlay'); }

  function _ensureStyles() {
    if (document.getElementById('mn-invwiz-style')) return;
    const s = document.createElement('style');
    s.id = 'mn-invwiz-style';
    // Only the overlay-specific sizing/z-index needs to be defined here —
    // every .mnbi-* class itself is already loaded globally by the bank
    // import wizard's stylesheet and is fully reused as-is.
    s.textContent = `
      #mnInvWizardOverlay { z-index: 9600; }
      #mnInvWizardOverlay .modal { max-width: 520px; width: 94vw; max-height: 88vh; max-height: 88dvh; padding:0; overflow:hidden; }
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
              <div class="mnbi-title">📈 ${_t('invwiz_titulo', 'Nueva inversión')}</div>
              <button class="mnbi-close" onclick="MNInvWizard.close()">✕</button>
            </div>
            <div class="mnbi-steps">${_stepDots()}</div>
          </div>
          <div class="mnbi-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="mnbi-footer">${footerHtml}</div>` : ''}
        </div>
      </div>`;
  }

  function _backBtn(disabled) {
    return `<button class="mnbi-btn-back" ${disabled ? 'style="visibility:hidden"' : ''} onclick="MNInvWizard._back()">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      ${_t('bi_atras', 'Atrás')}
    </button>`;
  }

  function _back() {
    ST.step = Math.max(1, ST.step - 1);
    _render();
  }

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
      <div class="mnbi-h1">${_t('invwiz_s1_titulo','¿Cómo se llama esta inversión?')}</div>
      <div class="mnbi-sub">${_t('invwiz_s1_sub','Por ejemplo: "Cuenta fondeada FTMO", "ETF S&P 500", "Piso en alquiler"...')}</div>
      <input type="text" class="mnbi-input" id="invwizNombre" placeholder="${_t('invwiz_s1_placeholder','Nombre de la inversión')}" value="${(ST.nombre||'').replace(/"/g,'&quot;')}" onkeydown="if(event.key==='Enter')MNInvWizard._toStep2()">
    `;
    const footer = `${_backBtn(true)}
      <button class="mnbi-btn-primary" id="invwizNextBtn1" onclick="MNInvWizard._toStep2()" ${ST.nombre?'':'disabled'}>
        ${_t('bi_continuar','Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
    setTimeout(() => {
      const inp = document.getElementById('invwizNombre')
      inp?.focus()
      inp?.addEventListener('input', () => {
        ST.nombre = inp.value
        const btn = document.getElementById('invwizNextBtn1')
        if (btn) btn.disabled = !inp.value.trim()
      })
    }, 80)
  }
  function _toStep2() {
    const inp = document.getElementById('invwizNombre')
    ST.nombre = (inp?.value || '').trim()
    if (!ST.nombre) return
    ST.step = 2
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 2 — DE DÓNDE SALE EL DINERO ───────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _cuentasOptionsHtml(selectedId) {
    const cuentas = S.cuentas || []
    return cuentas.map(c => `<option value="${c.id}" ${selectedId===c.id?'selected':''}>${c.nombre}</option>`).join('')
  }

  function _renderStep2() {
    const src = ST.moneySource
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 2 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('invwiz_s2_titulo','¿De dónde sale el dinero?')}</div>
      <div class="mnbi-sub">${_t('invwiz_s2_sub','Elige la opción que encaje con esta inversión.')}</div>
      <div class="mnbi-radio-row">
        <div class="mnbi-radio-card ${src==='link-expense'?'selected':''}" onclick="MNInvWizard._chooseSource('link-expense')">
          <span style="font-size:1.3rem">🔗</span>
          <div>
            <div style="font-weight:700;font-size:.9rem;color:var(--text)">${_t('invwiz_s2_link','Ya pagué esto — vincular con un gasto')}</div>
            <div style="font-size:.78rem;color:var(--text2)">${_t('invwiz_s2_link_sub','Convierte un gasto ya registrado en esta inversión')}</div>
          </div>
        </div>
        <div class="mnbi-radio-card ${src==='new-expense'?'selected':''}" onclick="MNInvWizard._chooseSource('new-expense')">
          <span style="font-size:1.3rem">💳</span>
          <div>
            <div style="font-weight:700;font-size:.9rem;color:var(--text)">${_t('invwiz_s2_new','Descontar de una cuenta ahora')}</div>
            <div style="font-size:.78rem;color:var(--text2)">${_t('invwiz_s2_new_sub','El importe se resta de la cuenta que elijas')}</div>
          </div>
        </div>
        <div class="mnbi-radio-card ${src==='no-deduct'?'selected':''}" onclick="MNInvWizard._chooseSource('no-deduct')">
          <span style="font-size:1.3rem">✅</span>
          <div>
            <div style="font-weight:700;font-size:.9rem;color:var(--text)">${_t('invwiz_s2_none','Ya estaba invertido — no descontar nada')}</div>
            <div style="font-size:.78rem;color:var(--text2)">${_t('invwiz_s2_none_sub','El dinero ya salió de tus cuentas antes de usar la app')}</div>
          </div>
        </div>
      </div>
      ${src === 'link-expense' ? `
        <input type="text" class="mnbi-input" id="invwizExpenseSearch" placeholder="🔍 ${_t('invwiz_buscar_gasto','Buscar gasto...')}" oninput="MNInvWizard._filterExpenses(this.value)" style="margin-bottom:10px">
        <div id="invwizExpenseList" style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto">${_expenseListHtml('')}</div>
      ` : ''}
      ${src === 'new-expense' ? `
        <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('invwiz_cuenta_lbl','Cuenta de origen')}</label>
        <select class="mnbi-input" id="invwizCuentaSelect" onchange="MNInvWizard._chooseCuenta(this.value)">
          <option value="">${_t('bi_elegir','Elegir...')}</option>
          ${_cuentasOptionsHtml(ST.cuentaId)}
        </select>
      ` : ''}
    `;
    const footer = `${_backBtn(false)}<span></span>`;
    _shell(body, footer);
  }

  function _chooseSource(source) {
    ST.moneySource = source
    ST.linkedExpenseId = null
    ST.cuentaId = ''
    if (source === 'no-deduct') { ST.step = 3; _render(); return } // nothing else needed — auto-advance
    _render() // reveal the relevant sub-picker below, stay on step 2
  }

  function _expenseListHtml(query) {
    const gastos = (S.gastos || []).slice().sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))
    const q = (query||'').toLowerCase()
    const filtered = !q ? gastos.slice(0, 30) : gastos.filter(g => (g.concepto||'').toLowerCase().includes(q)).slice(0, 30)
    if (!filtered.length) return `<div style="text-align:center;color:var(--text3);font-size:.82rem;padding:16px 0">${_t('bi_sin_resultados','Sin resultados')}</div>`
    return filtered.map(g => `
      <div class="mnbi-radio-card" style="padding:10px 14px" onclick="MNInvWizard._chooseExpense('${g.id}')">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.85rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.concepto||'—'}</div>
          <div style="font-size:.72rem;color:var(--text2)">${window.fmtDate ? fmtDate(g.fecha) : g.fecha}</div>
        </div>
        <div style="font-weight:800;color:var(--red)">−${window.eur ? eur(g.importe) : g.importe+'€'}</div>
      </div>`).join('')
  }
  function _filterExpenses(q) {
    const list = document.getElementById('invwizExpenseList')
    if (list) list.innerHTML = _expenseListHtml(q)
  }
  function _chooseExpense(expenseId) {
    ST.linkedExpenseId = expenseId
    ST.step = 3
    _render()
  }
  function _chooseCuenta(cuentaId) {
    if (!cuentaId) return
    ST.cuentaId = cuentaId
    ST.step = 3
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 3 — TIPO DE INVERSIÓN ──────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep3() {
    const cats = (S.categorias && S.categorias.inversion) || []
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 3 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('invwiz_s3_titulo','¿Qué tipo de inversión es?')}</div>
      <div class="mnbi-sub">${_t('invwiz_s3_sub','Elige una categoría existente o crea una nueva.')}</div>
      <div class="mnbi-radio-row">
        ${cats.map(c => `
          <div class="mnbi-radio-card ${ST.categoria===c && !ST.isNewCategory?'selected':''}" onclick="MNInvWizard._chooseCategoria('${c.replace(/'/g,"\\'")}')">
            <span style="font-size:1.2rem">${window.catEmoji ? catEmoji(c) : '📁'}</span>
            <div style="font-weight:700;font-size:.88rem;color:var(--text)">${c}</div>
          </div>`).join('')}
        <div class="mnbi-radio-card ${ST.isNewCategory?'selected':''}" onclick="MNInvWizard._chooseNewCategoria()">
          <span style="font-size:1.2rem">➕</span>
          <div style="font-weight:700;font-size:.88rem;color:var(--text)">${_t('bi_nueva_categoria','Nueva categoría...')}</div>
        </div>
      </div>
      ${ST.isNewCategory ? `
        <input type="text" class="mnbi-input" id="invwizNewCat" placeholder="${_t('invwiz_nombre_categoria','Nombre de la categoría')}" value="${(ST.newCategoryName||'').replace(/"/g,'&quot;')}" style="margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--text2);cursor:pointer;margin-bottom:14px">
          <input type="checkbox" id="invwizNewCatVolatile" ${ST.newCategoryVolatile?'checked':''} style="width:auto;margin:0">
          ${_t('modal_inv_cat_volatil_lbl','Es un activo variable (cripto, acciones...), sin % fijo esperado')}
        </label>
        <button class="mnbi-btn-primary" style="width:100%" onclick="MNInvWizard._confirmNewCategoria()">${_t('bi_continuar','Continuar')}</button>
      ` : ''}
    `;
    const footer = ST.isNewCategory ? '' : `${_backBtn(false)}<span></span>`;
    _shell(body, footer);
    if (ST.isNewCategory) setTimeout(() => document.getElementById('invwizNewCat')?.focus(), 80)
  }

  function _chooseCategoria(cat) {
    ST.categoria = cat
    ST.isNewCategory = false
    ST.step = 4
    _render()
  }
  function _chooseNewCategoria() {
    ST.isNewCategory = true
    _render()
  }
  function _confirmNewCategoria() {
    const nombre = (document.getElementById('invwizNewCat')?.value || '').trim()
    if (!nombre) return
    ST.newCategoryName = nombre
    ST.newCategoryVolatile = !!document.getElementById('invwizNewCatVolatile')?.checked
    ST.categoria = nombre
    ST.step = 4
    _render()
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 4 — DETALLES ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _isVolatileCategory() {
    if (ST.isNewCategory) return ST.newCategoryVolatile
    const VOLATILE = (window.VOLATILE_CATS || ['Acciones','Cripto','Startups','ETF'])
    if (VOLATILE.includes(ST.categoria)) return true
    return (S.categoriasInvVolatilesCustom || []).includes(ST.categoria)
  }

  function _linkedExpense() {
    if (!ST.linkedExpenseId) return null
    return (S.gastos || []).find(g => g.id === ST.linkedExpenseId) || null
  }

  function _renderStep4() {
    const linkedExp = _linkedExpense()
    const prefillImporte = linkedExp ? linkedExp.importe : (ST.importe || '')
    if (linkedExp && !ST.fecha_touched) ST.fecha = linkedExp.fecha || ST.fecha
    const volatile_ = _isVolatileCategory()
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso','Paso')} 4 ${_t('bi_de','de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('invwiz_s4_titulo','Últimos detalles')}</div>
      ${linkedExp ? `<div class="mnbi-sub">🔗 ${_t('invwiz_s4_vinculado','Vinculada al gasto')} "${linkedExp.concepto}" — ${_t('invwiz_s4_vinculado_sub','el importe y la fecha vienen de ahí')}.</div>` : ''}
      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('inv_importe_lbl','Importe invertido')}</label>
      <input type="text" inputmode="decimal" class="mnbi-input" id="invwizImporte" placeholder="0.00" value="${prefillImporte}" ${linkedExp?'readonly style="opacity:.7"':''} style="margin-bottom:14px">

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('cfg_fecha','Fecha')}</label>
      <input type="date" class="mnbi-input" id="invwizFecha" value="${ST.fecha||''}" style="margin-bottom:14px">

      ${!volatile_ ? `
      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('modal_inv_rentabilidad_lbl','Rentabilidad esperada (%)')}</label>
      <input type="text" inputmode="decimal" class="mnbi-input" id="invwizRentabilidad" placeholder="8.5" value="${ST.rentabilidad||''}" style="margin-bottom:14px">
      ` : ''}

      <label style="font-size:.78rem;color:var(--text2);display:block;margin-bottom:6px">${_t('cfg_notas','Notas')} (${_t('opcional','opcional')})</label>
      <textarea class="mnbi-input" id="invwizNotas" rows="2" style="resize:vertical">${ST.notas||''}</textarea>
    `;
    const footer = `${_backBtn(false)}
      <button class="mnbi-btn-primary" onclick="MNInvWizard._finish()">
        ${_t('invwiz_crear','Crear inversión')} ✓
      </button>`;
    _shell(body, footer);
  }

  function _finish() {
    const importe = window.parseAmount ? parseAmount(document.getElementById('invwizImporte').value) : parseFloat(document.getElementById('invwizImporte').value)
    if (!importe || importe <= 0) { if (window.toast) toast(_t('err_importe','Introduce un importe válido'),'error'); return }
    const fecha = document.getElementById('invwizFecha').value || ST.fecha
    const rentabilidad = document.getElementById('invwizRentabilidad') ? (window.parseAmount ? parseAmount(document.getElementById('invwizRentabilidad').value) : 0) : 0
    const notas = document.getElementById('invwizNotas')?.value.trim() || ''

    // New category: add it to the real list (and remember if it's
    // volatile), exactly like the classic single-page form already does.
    if (ST.isNewCategory && ST.newCategoryName) {
      if (!S.categorias.inversion.includes(ST.newCategoryName)) S.categorias.inversion.push(ST.newCategoryName)
      if (ST.newCategoryVolatile) {
        if (!Array.isArray(S.categoriasInvVolatilesCustom)) S.categoriasInvVolatilesCustom = []
        if (!S.categoriasInvVolatilesCustom.includes(ST.newCategoryName)) S.categoriasInvVolatilesCustom.push(ST.newCategoryName)
      }
    }

    let cuentaId = ST.cuentaId
    let noDeduct = false

    if (ST.moneySource === 'link-expense') {
      // Convert the expense into the investment: remove the expense
      // (returning its amount to its account), then deduct the same
      // amount from that same account as the investment's capital —
      // net effect on the balance is identical, the money only leaves
      // once, and it's no longer double-represented as both an expense
      // and an investment.
      const exp = _linkedExpense()
      if (exp) {
        cuentaId = exp.cuentaId
        const cuenta = window.getCuenta ? getCuenta(exp.cuentaId) : null
        if (cuenta) cuenta.saldo = (Number(cuenta.saldo)||0) + Number(exp.importe) // undo the expense
        S.gastos = S.gastos.filter(g => g.id !== exp.id)
      }
    }

    if (ST.moneySource === 'no-deduct') {
      noDeduct = true
      cuentaId = ST.cuentaId || (S.cuentas[0] && S.cuentas[0].id) || ''
    }

    S.inversiones.push({
      id: window.uid ? uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      nombre: ST.nombre, importe, rentabilidad, categoria: ST.categoria,
      fecha, notas, cuentaId, cerrada: false, noDeduct,
    })

    if (!noDeduct) {
      const cuenta = window.getCuenta ? getCuenta(cuentaId) : null
      if (cuenta) cuenta.saldo = (Number(cuenta.saldo)||0) - importe
    }

    if (window.save) save()
    close()
    if (window.render) render()
    if (window.MNGamification) MNGamification.checkAchievement('inversion_added')
    if (window.toast) toast(_t('toast_inversion_guardada','Inversión guardada'))
  }

  window.MNInvWizard = { open, close, _back, _toStep2, _chooseSource, _filterExpenses, _chooseExpense, _chooseCuenta, _chooseCategoria, _chooseNewCategoria, _confirmNewCategoria, _finish };
})();
