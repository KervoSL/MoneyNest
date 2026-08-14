/**
 * MoneyNest — js/premium-empty-states.js
 * Empty states premium con ilustraciones SVG inline, CTAs contextuales
 * y soporte completo dark/light mode.
 */
;(function () {
  'use strict';

  function _t(k, fb) {
    if (typeof window.t === 'function') { const v = window.t(k); return (v && v !== k) ? v : fb; }
    return fb;
  }

  // ── SVG Illustrations ──────────────────────────────────────────
  const SVG = {
    ingresos: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--green-dim,rgba(16,185,129,0.12))" stroke="rgba(16,185,129,0.2)" stroke-width="1.5"/>
      <rect x="22" y="30" width="36" height="26" rx="5" fill="none" stroke="var(--green,#10B981)" stroke-width="2"/>
      <path d="M32 40h16M40 34v12" stroke="var(--green,#10B981)" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="54" cy="26" r="8" fill="var(--green,#10B981)" opacity=".15"/>
      <path d="M51 26l2 2 4-4" stroke="var(--green,#10B981)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    gastos: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--red-dim,rgba(244,63,94,0.1))" stroke="rgba(244,63,94,0.2)" stroke-width="1.5"/>
      <rect x="20" y="28" width="40" height="28" rx="5" fill="none" stroke="var(--red,#F43F5E)" stroke-width="2"/>
      <path d="M20 36h40" stroke="var(--red,#F43F5E)" stroke-width="2"/>
      <rect x="26" y="42" width="8" height="4" rx="1.5" fill="var(--red,#F43F5E)" opacity=".5"/>
      <rect x="38" y="42" width="16" height="4" rx="1.5" fill="var(--red,#F43F5E)" opacity=".3"/>
    </svg>`,

    inversiones: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--indigo-dim,rgba(99,102,241,0.1))" stroke="rgba(99,102,241,0.2)" stroke-width="1.5"/>
      <path d="M20 52l12-14 10 8 8-12 10 6" stroke="var(--indigo,#6366F1)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="60" cy="50" r="3" fill="var(--indigo,#6366F1)"/>
      <path d="M56 28h8v8" stroke="var(--indigo,#6366F1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M56 36l8-8" stroke="var(--indigo,#6366F1)" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

    deudas: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.2)" stroke-width="1.5"/>
      <circle cx="40" cy="40" r="16" fill="none" stroke="var(--green,#10B981)" stroke-width="2.5" stroke-dasharray="5 4" opacity=".4"/>
      <path d="M33 40l4 4 10-8" stroke="var(--green,#10B981)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 26l4 2M52 26l4-2M24 54l4-2M52 54l4 2" stroke="var(--green,#10B981)" stroke-width="1.5" stroke-linecap="round" opacity=".4"/>
    </svg>`,

    objetivos: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--gold-dim,rgba(245,158,11,0.1))" stroke="rgba(245,158,11,0.2)" stroke-width="1.5"/>
      <circle cx="40" cy="40" r="18" fill="none" stroke="var(--gold,#F59E0B)" stroke-width="2" opacity=".3"/>
      <circle cx="40" cy="40" r="10" fill="none" stroke="var(--gold,#F59E0B)" stroke-width="2" opacity=".6"/>
      <circle cx="40" cy="40" r="3" fill="var(--gold,#F59E0B)"/>
      <path d="M40 22v4M40 54v4M22 40h4M54 40h4" stroke="var(--gold,#F59E0B)" stroke-width="2" stroke-linecap="round" opacity=".4"/>
    </svg>`,

    presupuestos: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--indigo-dim,rgba(99,102,241,0.1))" stroke="rgba(99,102,241,0.2)" stroke-width="1.5"/>
      <rect x="20" y="24" width="40" height="32" rx="5" fill="none" stroke="var(--indigo,#6366F1)" stroke-width="2"/>
      <rect x="26" y="32" width="12" height="4" rx="2" fill="var(--indigo,#6366F1)" opacity=".8"/>
      <rect x="26" y="32" width="28" height="4" rx="2" fill="var(--indigo,#6366F1)" opacity=".15"/>
      <rect x="26" y="41" width="8" height="4" rx="2" fill="var(--gold,#F59E0B)" opacity=".8"/>
      <rect x="26" y="41" width="28" height="4" rx="2" fill="var(--gold,#F59E0B)" opacity=".15"/>
    </svg>`,

    cuentas: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--accent-dim,rgba(0,212,170,0.1))" stroke="rgba(0,212,170,0.2)" stroke-width="1.5"/>
      <rect x="18" y="28" width="44" height="28" rx="6" fill="none" stroke="var(--accent,#00D4AA)" stroke-width="2"/>
      <path d="M18 36h44" stroke="var(--accent,#00D4AA)" stroke-width="2"/>
      <rect x="24" y="42" width="12" height="8" rx="2" fill="var(--accent,#00D4AA)" opacity=".2"/>
      <rect x="26" y="44" width="8" height="2" rx="1" fill="var(--accent,#00D4AA)" opacity=".7"/>
      <circle cx="56" cy="46" r="4" fill="var(--accent,#00D4AA)" opacity=".3"/>
    </svg>`,

    analisis: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--indigo-dim,rgba(99,102,241,0.1))" stroke="rgba(99,102,241,0.2)" stroke-width="1.5"/>
      <rect x="20" y="50" width="8" height="10" rx="2" fill="var(--indigo,#6366F1)" opacity=".5"/>
      <rect x="32" y="40" width="8" height="20" rx="2" fill="var(--indigo,#6366F1)" opacity=".7"/>
      <rect x="44" y="32" width="8" height="28" rx="2" fill="var(--indigo,#6366F1)" opacity=".9"/>
      <path d="M22 36l14-10 14 6 8-12" stroke="var(--accent,#00D4AA)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    dashboard: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="var(--accent-dim,rgba(0,212,170,0.1))" stroke="rgba(0,212,170,0.2)" stroke-width="1.5"/>
      <rect x="20" y="20" width="16" height="18" rx="4" fill="var(--accent,#00D4AA)" opacity=".25"/>
      <rect x="44" y="20" width="16" height="10" rx="4" fill="var(--accent,#00D4AA)" opacity=".4"/>
      <rect x="44" y="34" width="16" height="26" rx="4" fill="var(--accent,#00D4AA)" opacity=".25"/>
      <rect x="20" y="42" width="16" height="18" rx="4" fill="var(--accent,#00D4AA)" opacity=".4"/>
    </svg>`,

    filtro: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="rgba(148,163,184,0.08)"/>
      <path d="M14 16h20M18 24h12M22 32h4" stroke="var(--text2,#94A3B8)" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  };

  // ── Builder genérico ───────────────────────────────────────────
  function _build({ svg, title, sub, cta, style = '' }) {
    const ctaHtml = cta ? `<button class="btn btn-primary btn-sm mn-empty-cta" onclick="${cta.onclick}">${cta.label}</button>` : '';
    return `
      <div class="mn-empty-state" style="${style}">
        <div class="mn-empty-illustration">${svg}</div>
        <div class="mn-empty-title">${title}</div>
        <div class="mn-empty-sub">${sub}</div>
        ${ctaHtml}
      </div>`;
  }

  // ── Empty states por módulo ────────────────────────────────────

  function ingresos(hasDatos, hasFilter) {
    if (hasFilter) return _build({
      svg: SVG.filtro,
      title: _t('empty_sin_resultados', 'Sin resultados'),
      sub: _t('empty_sin_resultados_sub', 'Cambia el período o limpia los filtros'),
      cta: { label: _t('empty_ver_todos', 'Ver todos los ingresos'), onclick: `_ingSearch='';_ingCatFilter='';_ingMesFilter='';_gTimePeriod='all';renderIngresos()` },
    });
    return _build({
      svg: SVG.ingresos,
      title: _t('empty_ingresos_title', 'Aún no tienes ingresos'),
      sub: _t('empty_ingresos_sub', 'Registra tu salario, freelance o cualquier entrada de dinero para empezar a controlar tus finanzas.'),
      cta: { label: '+ ' + _t('btn_nuevo_ingreso', 'Nuevo ingreso'), onclick: `openModal('ingresoModal');resetIngresoForm()` },
    });
  }

  function gastos(hasDatos, hasFilter) {
    if (hasFilter) return _build({
      svg: SVG.filtro,
      title: _t('empty_sin_resultados', 'Sin resultados'),
      sub: _t('empty_sin_resultados_sub', 'Cambia el período o limpia los filtros'),
      cta: { label: _t('empty_ver_todos', 'Ver todos los gastos'), onclick: `_gasSearch='';_gasCatFilter='';_gTimePeriod='all';renderGastos()` },
    });
    return _build({
      svg: SVG.gastos,
      title: _t('empty_gastos_title', 'Sin gastos registrados'),
      sub: _t('empty_gastos_sub', 'Anota cada compra para ver exactamente a dónde va tu dinero. Puedes importar tus datos bancarios directamente desde tu banco.'),
      cta: { label: '+ ' + _t('btn_nuevo_gasto', 'Nuevo gasto'), onclick: `openModal('gastoModal');resetGastoForm()` },
    });
  }

  function inversiones(hasFilter) {
    if (hasFilter) return _build({
      svg: SVG.filtro,
      title: _t('empty_sin_resultados', 'Sin resultados'),
      sub: _t('empty_sin_resultados_sub', 'Prueba con otros filtros'),
      style: 'grid-column:1/-1',
    });
    return _build({
      svg: SVG.inversiones,
      title: _t('empty_inversiones_title', 'Tu cartera está vacía'),
      sub: _t('empty_inversiones_sub', 'Registra ETFs, acciones, criptos o inmuebles. MoneyNest calcula tu rendimiento y ROI en tiempo real.'),
      cta: { label: '+ ' + _t('empty_nueva_inversion', 'Nueva inversión'), onclick: `openModal('inversionModal');resetInvForm()` },
      style: 'grid-column:1/-1',
    });
  }

  function deudas(hasFilter) {
    if (hasFilter) return _build({
      svg: SVG.filtro,
      title: _t('empty_sin_resultados', 'Sin resultados'),
      sub: _t('empty_sin_resultados_sub', 'Prueba con otros filtros'),
      style: 'grid-column:1/-1',
    });
    return _build({
      svg: SVG.deudas,
      title: _t('empty_deudas_title', '¡Sin deudas registradas!'),
      sub: _t('empty_deudas_sub', 'Si tienes hipoteca, préstamos o tarjetas, añádelas aquí. MoneyNest calculará la estrategia óptima para liquidarlas.'),
      cta: { label: '+ ' + _t('empty_nueva_deuda', 'Nueva deuda'), onclick: `openModal('deudaModal');resetDeudaForm()` },
      style: 'grid-column:1/-1',
    });
  }

  function objetivos(hasFilter) {
    if (hasFilter) return _build({
      svg: SVG.filtro,
      title: _t('empty_sin_resultados', 'Sin resultados'),
      sub: _t('empty_sin_resultados_sub', 'Prueba con otros filtros'),
      style: 'grid-column:1/-1',
    });
    return _build({
      svg: SVG.objetivos,
      title: _t('empty_objetivos_title', 'Define tu primera meta'),
      sub: _t('empty_objetivos_sub', 'Vacaciones, fondo de emergencia, un coche... MoneyNest calculará exactamente cuándo lo alcanzarás.'),
      cta: { label: '+ ' + _t('empty_crear_objetivo', 'Crear mi primer objetivo'), onclick: `openModal('objetivoModal');resetObjForm()` },
      style: 'grid-column:1/-1',
    });
  }

  function presupuestos() {
    return _build({
      svg: SVG.presupuestos,
      title: _t('empty_presupuestos_title', 'Sin presupuestos configurados'),
      sub: _t('empty_presupuestos_sub', 'Pon límites mensuales por categoría y MoneyNest te avisará cuando te estés acercando al tope.'),
      cta: { label: '+ ' + _t('empty_nuevo_presupuesto', 'Nuevo presupuesto'), onclick: `openModal('presupuestoModal');resetPresForm()` },
    });
  }

  function cuentas() {
    return _build({
      svg: SVG.cuentas,
      title: _t('empty_cuentas_title', 'Añade tu primera cuenta'),
      sub: _t('empty_cuentas_sub', 'Cuenta corriente, efectivo, cripto o inversiones. Todo en un solo lugar.'),
      cta: { label: '+ ' + _t('empty_nueva_cuenta', 'Nueva cuenta'), onclick: `openModal('cuentaModal');resetCuentaForm()` },
    });
  }

  function analisis() {
    return _build({
      svg: SVG.analisis,
      title: _t('empty_analisis_title', 'Añade datos para ver el análisis'),
      sub: _t('empty_analisis_sub', 'Con al menos un mes de ingresos y gastos, el análisis mostrará tendencias, anomalías y tu salud financiera.'),
      cta: { label: _t('empty_ir_dashboard', 'Ir al dashboard'), onclick: `goTo('dashboard')` },
    });
  }

  function dashboard() {
    return _build({
      svg: SVG.dashboard,
      title: _t('empty_dashboard_title', 'Empieza aquí'),
      sub: _t('empty_dashboard_sub', 'Añade tus primeros ingresos y gastos para ver tu resumen financiero completo.'),
      cta: { label: _t('empty_anadir_primer_ingreso', '+ Añadir primer ingreso'), onclick: `openModal('ingresoModal');resetIngresoForm()` },
    });
  }

  // ── Inject CSS ─────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('mn-empty-states-css')) return;
    const s = document.createElement('style');
    s.id = 'mn-empty-states-css';
    s.textContent = `
      .mn-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 48px 24px 40px;
        gap: 0;
        width: 100%;
        box-sizing: border-box;
        margin: 0 auto;
        /* Works inside grids, flex containers and table cells */
        align-self: center;
        justify-self: center;
        animation: mnEmptyIn 400ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
      }
      @keyframes mnEmptyIn {
        from { opacity: 0; transform: translateY(16px) scale(0.97); }
        to   { opacity: 1; transform: none; }
      }
      .mn-empty-illustration {
        margin-bottom: 20px;
        animation: mnEmptyPop 500ms cubic-bezier(0.34,1.56,0.64,1) 100ms both;
      }
      @keyframes mnEmptyPop {
        from { transform: scale(0.6); opacity: 0; }
        to   { transform: scale(1);   opacity: 1; }
      }
      .mn-empty-title {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--text, #E8EFF7);
        letter-spacing: -.02em;
        margin-bottom: 8px;
        line-height: 1.3;
      }
      .mn-empty-sub {
        font-size: .82rem;
        color: var(--text2, #94A3B8);
        line-height: 1.6;
        max-width: min(340px, 90vw);
        width: 100%;
        margin: 0 auto 20px;
        text-align: center;
        word-break: break-word;
        overflow-wrap: break-word;
      }
      .mn-empty-cta {
        animation: mnEmptyIn 300ms ease 300ms both;
      }

      /* Inside table cells */
      tr td .mn-empty-state {
        padding: 48px 16px;
        width: 100%;
        max-width: 100%;
        display: flex;
        margin: 0 auto;
      }
      tr td {
        text-align: center;
        width: 100%;
      }
      tr td .mn-empty-illustration svg { width: 56px; height: 56px; }
      tr td .mn-empty-title { font-size: .92rem; }

      /* Inside CSS grid (inversiones, deudas, objetivos, presupuestos) */
      [style*="grid-column:1/-1"] .mn-empty-state,
      [style*="grid-column: 1 / -1"] .mn-empty-state {
        width: 100%;
      }

      /* Wrapper div approach (deudas, inversiones use div wrapper) */
      .mn-empty-wrapper {
        width: 100%;
        grid-column: 1 / -1;
        display: flex;
        justify-content: center;
      }

      /* Light mode */
      [data-theme="light"] .mn-empty-title { color: var(--text, #0F172A); }
      [data-theme="light"] .mn-empty-sub   { color: var(--text2, #475569); }
    `;
    document.head.appendChild(s);
  }

  _injectStyles();

  window.mnEmptyStates = {
    ingresos,
    gastos,
    inversiones,
    deudas,
    objetivos,
    presupuestos,
    cuentas,
    analisis,
    dashboard,
  };
})();
