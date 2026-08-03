/* ═══════════════════════════════════════════════════════════════
   MoneyNest · Data Manager v3
   Premium Import / Export / Save system
   ═══════════════════════════════════════════════════════════════ */

;(function() {
'use strict';

// ── Constants ──────────────────────────────────────────────────
const DM_FORMAT   = 'moneynest';
const DM_VERSION  = '3.0';
const DM_EXT      = '.moneynest';

function _dm(key, fallback) {
  if (typeof window.t === 'function') { const v = window.t(key); return (v && v !== key) ? v : fallback; }
  return fallback;
}

// ── Toast Stack ────────────────────────────────────────────────
let _toastStack = null;

function _getToastStack() {
  if (!_toastStack) {
    _toastStack = document.createElement('div');
    _toastStack.className = 'dm-toast-stack';
    document.body.appendChild(_toastStack);
  }
  return _toastStack;
}

function _dmEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function dmToast(msg, type = 'success') {
  const stack = _getToastStack();
  const el = document.createElement('div');
  el.className = `dm-toast dm-toast--${type}`;
  el.innerHTML = `<div class="dm-toast-dot"></div><span class="dm-toast-msg">${_dmEsc(msg)}</span>`;
  stack.appendChild(el);

  // Auto-remove
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

// ── SVG Icons ─────────────────────────────────────────────────
const ICONS = {
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  upload:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  save:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  loader:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  alert:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  file:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  merge:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 012 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`,
  plus:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  swap:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  arrow:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg>`,
  theme:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
};

// ── Helpers ────────────────────────────────────────────────────
function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('es-ES') : n;
}

function _fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Build .moneynest export payload ───────────────────────────
function _buildExportPayload() {
  // S is the global app state
  const state = (typeof S !== 'undefined') ? S : {};
  return {
    _format:  DM_FORMAT,
    _version: DM_VERSION,
    _created: new Date().toISOString(),
    _app:     'MoneyNest',
    _counts: {
      ingresos:    (state.ingresos    || []).length,
      gastos:      (state.gastos      || []).length,
      inversiones: (state.inversiones || []).length,
      deudas:      (state.deudas      || []).length,
      objetivos:   (state.objetivos   || []).length,
      cuentas:     (state.cuentas     || []).length,
    },
    data: state
  };
}

// ── Validate import file ───────────────────────────────────────
function _validate(parsed) {
  const errors = [];
  const warnings = [];

  if (!parsed || typeof parsed !== 'object') {
    errors.push('El archivo no es un JSON válido.');
    return { ok: false, errors, warnings, data: null };
  }

  let data = parsed;

  // Detect .moneynest wrapper
  const isWrapped = parsed._format === DM_FORMAT;
  if (isWrapped) {
    data = parsed.data;
    // Version check
    const ver = parseFloat(parsed._version || '0');
    if (ver < 2) warnings.push('Archivo de versión antigua — algunos datos podrían no importarse.');
  } else {
    // Plain JSON backup — try to read directly
    warnings.push('Formato JSON genérico detectado. Se intentará importar como datos MoneyNest.');
  }

  if (!data || typeof data !== 'object') {
    errors.push('Los datos del archivo están vacíos o son inválidos.');
    return { ok: false, errors, warnings, data: null };
  }

  // Verify at least some recognizable fields
  const knownFields = ['ingresos','gastos','inversiones','deudas','objetivos','cuentas','usuario'];
  const found = knownFields.filter(k => k in data);
  if (found.length === 0) {
    errors.push('No se encontraron datos financieros reconocibles en el archivo.');
    return { ok: false, errors, warnings, data: null };
  }

  // Array validations
  const arrayFields = ['ingresos','gastos','inversiones','deudas','objetivos','cuentas'];
  for (const f of arrayFields) {
    if (f in data && !Array.isArray(data[f])) {
      warnings.push(`El campo "${f}" tiene un formato inesperado y será ignorado.`);
      delete data[f];
    }
  }

  return { ok: true, errors, warnings, data, meta: parsed._counts || null, version: parsed._version || 'legacy', created: parsed._created || null };
}

// ── Build data counts for preview ─────────────────────────────
function _counts(data) {
  return [
    { key: 'Ingresos',    val: (data.ingresos    || []).length },
    { key: 'Gastos',      val: (data.gastos      || []).length },
    { key: 'Inversiones', val: (data.inversiones || []).length },
    { key: 'Deudas',      val: (data.deudas      || []).length },
    { key: 'Objetivos',   val: (data.objetivos   || []).length },
    { key: 'Cuentas',     val: (data.cuentas     || []).length },
  ];
}

// ── Merge strategy ─────────────────────────────────────────────
function _mergeData(current, incoming) {
  const merged = JSON.parse(JSON.stringify(current));

  // For arrays: append items with new IDs if they don't exist
  const arrayFields = ['ingresos','gastos','inversiones','deudas','objetivos','clientes','proveedores','devengos','assets','patrimonio_hist'];

  for (const field of arrayFields) {
    if (!Array.isArray(incoming[field])) continue;
    if (!Array.isArray(merged[field])) merged[field] = [];

    const existingIds = new Set(merged[field].map(i => i.id).filter(Boolean));
    for (const item of incoming[field]) {
      if (!item.id || !existingIds.has(item.id)) {
        // Assign new ID if collision
        const newItem = { ...item };
        if (item.id && existingIds.has(item.id)) {
          newItem.id = `${item.id}_${Date.now()}`;
        }
        merged[field].push(newItem);
        if (newItem.id) existingIds.add(newItem.id);
      }
    }
  }

  // Merge categories
  if (incoming.categorias) {
    merged.categorias = merged.categorias || {};
    for (const k of Object.keys(incoming.categorias || {})) {
      if (!Array.isArray(incoming.categorias[k])) continue;
      merged.categorias[k] = [...new Set([
        ...(merged.categorias[k] || []),
        ...incoming.categorias[k]
      ])];
    }
  }

  // Merge cuentas (keep existing, add new)
  if (Array.isArray(incoming.cuentas)) {
    const existingCuentaIds = new Set((merged.cuentas || []).map(c => c.id));
    for (const c of incoming.cuentas) {
      if (c.id && !existingCuentaIds.has(c.id)) {
        merged.cuentas.push(c);
        existingCuentaIds.add(c.id);
      }
    }
  }

  return merged;
}

// ══════════════════════════════════════════════════════════════
// EXPORT PANEL
// ══════════════════════════════════════════════════════════════

function buildExportPanel() {
  const panel = document.getElementById('dm-export-panel');
  if (!panel) return;

  const body = panel.querySelector('.dm-panel-body');
  if (!body) return;

  // Plan check: PDF/Excel require Local or Pro
  const plan = (typeof window.MNAuth !== 'undefined') ? window.MNAuth.getUser().plan : 'trial';
  const canExportReports = plan === 'local' || plan === 'pro';

  const lockBadge = `<span style="
    display:inline-flex;align-items:center;gap:4px;
    background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.25);
    color:#F59E0B;font-size:.65rem;font-weight:700;
    padding:2px 8px;border-radius:99px;
  ">🔒 Premium</span>`;

  const pdfBtn = canExportReports
    ? `<button class="dm-export-card dm-export-card--pdf" onclick="dmExportPDF()">
        <div class="dm-card-icon dm-card-icon--pdf">📄</div>
        <div class="dm-card-content">
          <div class="dm-card-title">Informe PDF completo</div>
          <div class="dm-card-desc">Resumen visual con todas las secciones</div>
        </div>
        <span class="dm-card-arrow">${ICONS.arrow}</span>
      </button>`
    : `<button class="dm-export-card" style="opacity:.6;cursor:default" onclick="dmToast('El PDF requiere MoneyNest 🔒','warn')">
        <div class="dm-card-icon dm-card-icon--pdf">📄</div>
        <div class="dm-card-content">
          <div class="dm-card-title">Informe PDF completo ${lockBadge}</div>
          <div class="dm-card-desc">Disponible con MoneyNest (6,99€)</div>
        </div>
      </button>`;

  const excelBtn = canExportReports
    ? `<button class="dm-export-card dm-export-card--excel" onclick="dmExportExcel()">
        <div class="dm-card-icon dm-card-icon--excel">📊</div>
        <div class="dm-card-content">
          <div class="dm-card-title">Excel completo</div>
          <div class="dm-card-desc">Todas las hojas · Ingresos, gastos, inversiones...</div>
        </div>
        <span class="dm-card-arrow">${ICONS.arrow}</span>
      </button>`
    : `<button class="dm-export-card" style="opacity:.6;cursor:default" onclick="dmToast('El Excel requiere MoneyNest 🔒','warn')">
        <div class="dm-card-icon dm-card-icon--excel">📊</div>
        <div class="dm-card-content">
          <div class="dm-card-title">Excel completo ${lockBadge}</div>
          <div class="dm-card-desc">Disponible con MoneyNest (6,99€)</div>
        </div>
      </button>`;

  body.innerHTML = `
    <div>
      <div class="dm-section-label">Copia de seguridad completa</div>
      <div class="dm-export-cards">
        <button class="dm-export-card dm-export-card--primary" onclick="dmExportMoneynest()">
          <div class="dm-card-icon dm-card-icon--mn">🪺</div>
          <div class="dm-card-content">
            <div class="dm-card-title">Exportar como .moneynest</div>
            <div class="dm-card-desc">Backup completo con versionado · Recomendado</div>
          </div>
          <span class="dm-card-badge">Gratis</span>
          <span class="dm-card-arrow">${ICONS.arrow}</span>
        </button>
        <button class="dm-export-card" onclick="dmExportJSON()">
          <div class="dm-card-icon dm-card-icon--json">📦</div>
          <div class="dm-card-content">
            <div class="dm-card-title">Exportar JSON estándar</div>
            <div class="dm-card-desc">Compatible con versiones anteriores</div>
          </div>
          <span class="dm-card-arrow">${ICONS.arrow}</span>
        </button>
      </div>
    </div>

    <hr class="dm-divider">

    <div>
      <div class="dm-section-label">Informes</div>
      <div class="dm-export-cards">
        ${pdfBtn}
        ${excelBtn}
      </div>
      ${!canExportReports ? `<div style="margin-top:10px;text-align:center">
        <button onclick="closeDmPanel('dm-export-panel');if(window.MNAuthUI)MNAuthUI.showAuthModal('plan')" style="
          background:linear-gradient(135deg,#00D4AA,#00A882);color:#0A0E17;
          border:none;border-radius:10px;padding:10px 20px;
          font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit;
        ">🔓 Desbloquear MoneyNest — 6,99€ →</button>
      </div>` : ''}
    </div>

    <hr class="dm-divider">

    <div>
      <div class="dm-section-label">Exportar por sección</div>
      <div class="dm-grid-2">
        <button class="dm-mini-card" onclick="dmSectionExport('ingresos')"><span>💰</span> Ingresos</button>
        <button class="dm-mini-card" onclick="dmSectionExport('gastos')"><span>💳</span> Gastos</button>
        <button class="dm-mini-card" onclick="dmSectionExport('inversiones')"><span>📈</span> Inversiones</button>
        <button class="dm-mini-card" onclick="dmSectionExport('deudas')"><span>📉</span> Deudas</button>
        <button class="dm-mini-card" onclick="dmSectionExport('objetivos')"><span>🎯</span> Objetivos</button>
        <button class="dm-mini-card" onclick="dmSectionExport('presupuestos')"><span>📋</span> Presupuestos</button>
      </div>
    </div>
  `;
}

// ── Export actions ─────────────────────────────────────────────
window.dmExportMoneynest = function() {
  try {
    const payload = _buildExportPayload();

    // ✨ Personalizar nombre del archivo con datos del usuario
    const state = (typeof S !== 'undefined') ? S : {};
    const userName = (state.usuario?.nombre || '').trim();
    const currentYear = new Date().getFullYear();

    // Limpiar nombre de usuario para nombre de archivo válido
    const safeUserName = userName
      ? userName.replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ]/g, '_').substring(0, 30)
      : 'usuario';

    // Formato: datos_[nombre]_2026.moneynest
    const fileName = `datos_${safeUserName}_${currentYear}${DM_EXT}`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    dmToast(_dm('dm_exportado_moneynest', '✅ Archivo .moneynest exportado correctamente'), 'success');
    _showExportSuccess(fileName);
  } catch(e) {
    dmToast(_dm('dm_error_exportar', '❌ Error al exportar') + ': ' + e.message, 'error');
  }
};

window.dmExportJSON = function() {
  try {
    const state = (typeof S !== 'undefined') ? S : {};
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MoneyNest_backup_${_today()}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    dmToast(_dm('dm_json_exportado', '📦 JSON exportado'), 'success');
  } catch(e) {
    dmToast(_dm('dm_error_exportar_json', '❌ Error al exportar JSON'), 'error');
  }
};

window.dmExportPDF = function() {
  const plan = (typeof window.MNAuth !== 'undefined') ? window.MNAuth.getUser().plan : 'trial';
  if (plan !== 'local' && plan !== 'pro') {
    dmToast(_dm('dm_pdf_requiere_plan', '🔒 El PDF requiere MoneyNest'), 'warn');
    if (window.MNAuthUI) MNAuthUI.showAuthModal('plan');
    return;
  }
  closeDmPanel('dm-export-panel');
  if (typeof exportarPDF === 'function') exportarPDF();
  else dmToast(_dm('dm_pdf_no_disponible', 'PDF no disponible en este momento'), 'warn');
};

window.dmExportExcel = function() {
  const plan = (typeof window.MNAuth !== 'undefined') ? window.MNAuth.getUser().plan : 'trial';
  if (plan !== 'local' && plan !== 'pro') {
    dmToast(_dm('dm_excel_requiere_plan', '🔒 El Excel requiere MoneyNest'), 'warn');
    if (window.MNAuthUI) MNAuthUI.showAuthModal('plan');
    return;
  }
  closeDmPanel('dm-export-panel');
  if (typeof exportarExcel === 'function') exportarExcel();
  else dmToast(_dm('dm_excel_no_disponible', 'Excel no disponible en este momento'), 'warn');
};

window.dmSectionExport = function(section) {
  closeDmPanel('dm-export-panel');
  const fnMap = {
    ingresos:    () => typeof exportarIngresos    === 'function' && exportarIngresos(),
    gastos:      () => typeof exportarGastos      === 'function' && exportarGastos(),
    inversiones: () => typeof exportarInversiones === 'function' && exportarInversiones(),
    deudas:      () => typeof exportarDeudas      === 'function' && exportarDeudas(),
    objetivos:   () => typeof exportarObjetivos   === 'function' && exportarObjetivos(),
    presupuestos:() => typeof exportarPresupuestos=== 'function' && exportarPresupuestos(),
  };
  if (fnMap[section]) fnMap[section]();
  else dmToast(_dm('dm_funcion_no_disponible', 'Función no disponible'), 'warn');
};

function _showExportSuccess(filename) {
  const body = document.querySelector('#dm-export-panel .dm-panel-body');
  if (!body) return;
  const success = document.createElement('div');
  success.className = 'dm-export-success';
  success.innerHTML = `
    <div class="dm-success-ring">✓</div>
    <div class="dm-success-title">${_dm('dm_exportado_ok','¡Exportado correctamente!')}</div>
    <div class="dm-success-desc">${filename}<br>${_dm('dm_descargado_desc','se ha descargado en tu dispositivo.')}</div>
  `;
  body.insertBefore(success, body.firstChild);
  setTimeout(() => {
    success.style.transition = 'opacity .4s';
    success.style.opacity = '0';
    setTimeout(() => success.remove(), 400);
  }, 3000);
}

// ══════════════════════════════════════════════════════════════
// IMPORT PANEL
// ══════════════════════════════════════════════════════════════

let _importState = {
  file: null,
  parsed: null,
  validation: null,
  option: 'replace',
};

function resetImportState() {
  _importState = { file: null, parsed: null, validation: null, option: 'replace' };
}

function buildImportPanel() {
  const panel = document.getElementById('dm-import-panel');
  if (!panel) return;

  const body = panel.querySelector('.dm-panel-body');
  if (!body) return;

  resetImportState();

  body.innerHTML = `
    <!-- Drop zone -->
    <div id="dm-dropzone" class="dm-dropzone" onclick="document.getElementById('dm-file-input').click()"
         ondragover="dmDragOver(event)" ondragleave="dmDragLeave(event)" ondrop="dmDrop(event)">
      <input type="file" id="dm-file-input" accept=".moneynest,.json" style="display:none" onchange="dmFileSelected(this)">
      <div class="dm-dropzone-inner">
        <div class="dm-dropzone-icon" style="font-size:2.5rem;margin-bottom:10px">📂</div>
        <div class="dm-dropzone-title">Arrastra tu backup aquí</div>
        <div class="dm-dropzone-sub">o <strong style="color:var(--accent);text-decoration:underline;cursor:pointer">haz clic para abrir el explorador</strong></div>
        <div class="dm-dropzone-formats" style="margin-top:10px">
          <span class="dm-format-tag">.moneynest</span>
          <span class="dm-format-tag">.json</span>
        </div>
        <div style="margin-top:8px;font-size:.72rem;color:var(--text3)">Tus datos nunca salen del dispositivo</div>
      </div>
    </div>

    <!-- Steps (hidden until file selected) -->
    <div id="dm-import-steps" class="dm-steps">
      <!-- File info -->
      <div id="dm-file-info-row"></div>

      <!-- Validation -->
      <div id="dm-validation-row"></div>

      <!-- Progress bar -->
      <div id="dm-progress-row" style="display:none;margin:16px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:.75rem;font-weight:600;color:var(--text2)" id="dm-progress-label">Leyendo archivo…</span>
          <span style="font-size:.75rem;font-weight:700;color:var(--accent)" id="dm-progress-pct">0%</span>
        </div>
        <div style="width:100%;height:6px;background:var(--border);border-radius:99px;overflow:hidden">
          <div id="dm-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),#6366F1);border-radius:99px;transition:width .25s ease"></div>
        </div>
      </div>

      <!-- Preview -->
      <div id="dm-preview-row"></div>

      <!-- Error box -->
      <div id="dm-error-row"></div>

      <!-- Options -->
      <div id="dm-options-row"></div>
    </div>
  `;

  // Update footer button state
  _updateImportFooter(false);
}

function _updateImportFooter(enabled) {
  const btn = document.getElementById('dm-import-confirm-btn');
  if (btn) btn.disabled = !enabled;
}

// ── Drag & Drop handlers ───────────────────────────────────────
window.dmDragOver = function(e) {
  e.preventDefault();
  document.getElementById('dm-dropzone')?.classList.add('drag-over');
};
window.dmDragLeave = function(e) {
  document.getElementById('dm-dropzone')?.classList.remove('drag-over');
};
window.dmDrop = function(e) {
  e.preventDefault();
  document.getElementById('dm-dropzone')?.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) _processFile(file);
};

window.dmFileSelected = function(input) {
  const file = input.files[0];
  if (file) _processFile(file);
  input.value = '';
};

function _setProgress(pct, label) {
  const bar   = document.getElementById('dm-progress-bar')
  const pctEl = document.getElementById('dm-progress-pct')
  const lblEl = document.getElementById('dm-progress-label')
  if (bar)   bar.style.width = pct + '%'
  if (pctEl) pctEl.textContent = Math.round(pct) + '%'
  if (lblEl && label) lblEl.textContent = label
}

function _processFile(file) {
  // Validate extension
  const name = file.name.toLowerCase()
  if (!name.endsWith('.moneynest') && !name.endsWith('.json')) {
    _showImportError(_dm('dm_tipo_no_soportado', 'Tipo de archivo no soportado. Usa archivos .moneynest o .json'))
    return
  }

  _importState.file = file

  // Show file info
  document.getElementById('dm-import-steps')?.classList.add('visible')
  _renderFileInfo(file)

  // Show progress
  const progressRow = document.getElementById('dm-progress-row')
  if (progressRow) progressRow.style.display = 'block'
  _setProgress(5, 'Preparando archivo…')

  // Clear previous
  _clearRows(['dm-validation-row','dm-preview-row','dm-error-row','dm-options-row'])
  _updateImportFooter(false)

  // Read file
  const reader = new FileReader()
  reader.onprogress = (e) => {
    if (e.loaded && e.total) {
      const pct = 10 + (e.loaded / e.total) * 55
      _setProgress(pct, 'Leyendo archivo…')
    }
  }
  reader.onload = (e) => {
    _setProgress(70, 'Validando datos…')
    setTimeout(() => {
      try {
        const parsed = JSON.parse(e.target.result)
        _setProgress(85, 'Analizando estructura…')
        const result = _validate(parsed)
        _importState.parsed = parsed
        _importState.validation = result

        _setProgress(100, result.ok ? '¡Archivo listo!' : 'Error en el archivo')
        setTimeout(() => {
          if (progressRow) progressRow.style.display = 'none'
          _renderValidation(result)
          if (result.ok) {
            _renderPreview(result)
            _renderOptions()
            _updateImportFooter(true)
          } else {
            _showImportError(result.errors.join(' '))
          }
        }, 500)
      } catch(err) {
        if (progressRow) progressRow.style.display = 'none'
        _showImportError(_dm('dm_error_json_malformed', 'No se pudo leer el archivo. ¿Está el JSON bien formado?'))
      }
    }, 200)
  }
  reader.onerror = () => {
    _showImportError(_dm('dm_error_leer_archivo', 'Error al leer el archivo.'))
    if (progressRow) progressRow.style.display = 'none'
  }
  reader.readAsText(file)
}

function _renderFileInfo(file) {
  const row = document.getElementById('dm-file-info-row');
  if (!row) return;
  const ext = file.name.toLowerCase().endsWith('.moneynest') ? '🪺' : '📦';
  row.innerHTML = `
    <div class="dm-file-info">
      <div class="dm-file-icon">${ext}</div>
      <div class="dm-file-meta">
        <div class="dm-file-name">${file.name}</div>
        <div class="dm-file-size">${_fmtBytes(file.size)}</div>
      </div>
      <button class="dm-file-remove" onclick="dmRemoveFile()" title="Quitar archivo">✕</button>
    </div>
  `;
}

function _renderValidation(result) {
  const row = document.getElementById('dm-validation-row');
  if (!row) return;

  let html = '';
  if (result.ok) {
    html += `<div class="dm-validate-row">
      <div class="dm-validate-icon ok">✓</div>
      <div class="dm-validate-text ok"><strong>Archivo válido</strong> — datos reconocidos correctamente</div>
    </div>`;
  }
  for (const w of result.warnings) {
    html += `<div class="dm-validate-row" style="margin-top:8px">
      <div class="dm-validate-icon warn">⚠</div>
      <div class="dm-validate-text warn"><strong>Aviso:</strong> ${w}</div>
    </div>`;
  }
  row.innerHTML = html;
}

function _renderPreview(result) {
  const row = document.getElementById('dm-preview-row');
  if (!row || !result.data) return;

  const cts = _counts(result.data);
  const created = result.created ? new Date(result.created).toLocaleDateString('es-ES') : '—';
  const version = result.version || '—';

  const statsHtml = cts.map(c => `
    <div class="dm-stat">
      <div class="dm-stat-val">${_fmt(c.val)}</div>
      <div class="dm-stat-key">${c.key}</div>
    </div>
  `).join('');

  row.innerHTML = `
    <div class="dm-preview">
      <div class="dm-preview-header">
        <span class="dm-preview-title">Vista previa del archivo</span>
        <span class="dm-preview-version">v${version} · ${created}</span>
      </div>
      <div class="dm-preview-stats">${statsHtml}</div>
    </div>
  `;
}

function _renderOptions() {
  const row = document.getElementById('dm-options-row');
  if (!row) return;

  const opts = [
    {
      id: 'replace',
      icon: ICONS.swap,
      title: 'Reemplazar datos actuales',
      desc: 'Borra todos tus datos actuales y los sustituye por los del archivo.',
      warn: '⚠️ Esta acción no se puede deshacer.',
    },
    {
      id: 'merge',
      icon: ICONS.merge,
      title: 'Fusionar con datos actuales',
      desc: 'Añade los nuevos registros sin borrar los existentes. Los duplicados se omiten.',
      warn: null,
    },
    {
      id: 'new',
      icon: ICONS.plus,
      title: 'Crear cuenta nueva',
      desc: 'Inicia una nueva sesión limpia con los datos importados. Tu sesión actual se pierde.',
      warn: '⚠️ Cerrará tu sesión actual.',
    },
  ];

  row.innerHTML = `
    <div>
      <div class="dm-section-label" style="margin-bottom:10px">¿Cómo importar?</div>
      <div class="dm-import-options">
        ${opts.map(o => `
          <button class="dm-option ${o.id === _importState.option ? 'selected' : ''}"
                  onclick="dmSelectOption('${o.id}')" id="dm-opt-${o.id}">
            <div class="dm-option-radio"></div>
            <div class="dm-option-body">
              <div class="dm-option-title">${o.title}</div>
              <div class="dm-option-desc">${o.desc}</div>
              ${o.warn ? `<div class="dm-option-warn">${o.warn}</div>` : ''}
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

window.dmSelectOption = function(id) {
  _importState.option = id;
  document.querySelectorAll('.dm-option').forEach(el => {
    el.classList.toggle('selected', el.id === `dm-opt-${id}`);
  });
};

window.dmRemoveFile = function() {
  resetImportState();
  document.getElementById('dm-import-steps')?.classList.remove('visible');
  _clearRows(['dm-file-info-row','dm-validation-row','dm-preview-row','dm-error-row','dm-options-row']);
  _updateImportFooter(false);
};

function _showImportError(msg) {
  const row = document.getElementById('dm-error-row');
  if (!row) return;
  row.innerHTML = `
    <div class="dm-error-box">
      ${ICONS.alert}
      <span>${msg}</span>
    </div>
  `;
}

function _clearRows(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

// ── Confirm import ─────────────────────────────────────────────
window.dmConfirmImport = function() {
  const { validation, option } = _importState;
  if (!validation?.ok || !validation.data) {
    dmToast(_dm('dm_no_datos_validos', 'No hay datos válidos para importar'), 'error');
    return;
  }

  const data = validation.data;

  // Extra confirm for destructive actions
  if (option === 'replace' || option === 'new') {
    const confirmMsg = option === 'replace'
      ? _dm('dm_confirm_replace', '¿Reemplazar todos tus datos actuales? Esta acción no se puede deshacer.')
      : _dm('dm_confirm_new', '¿Crear nueva sesión con los datos importados? Tu sesión actual se perderá.');

    if (!confirm(confirmMsg)) return;
  }

  try {
    if (option === 'replace') {
      // Merge on top of defaultState to keep structure
      const base = (typeof defaultState === 'function') ? defaultState() : {};
      window.S = Object.assign(base, data);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      dmToast(_dm('dm_importado_replace', '✅ Datos importados y reemplazados correctamente'), 'success');

    } else if (option === 'merge') {
      const current = (typeof S !== 'undefined') ? JSON.parse(JSON.stringify(S)) : {};
      window.S = _mergeData(current, data);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      dmToast(_dm('dm_importado_merge', '🔀 Datos fusionados correctamente'), 'success');

    } else if (option === 'new') {
      const base = (typeof defaultState === 'function') ? defaultState() : {};
      window.S = Object.assign(base, data);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      dmToast(_dm('dm_importado_new', '✨ Nueva sesión creada con los datos importados'), 'success');
    }

    closeDmPanel('dm-import-panel');

  } catch(e) {
    dmToast(_dm('dm_error_importar', '❌ Error al importar datos') + ': ' + e.message, 'error');
    console.error('[MoneyNest DM] Import error:', e);
  }
};

// ══════════════════════════════════════════════════════════════
// SAVE (quick local save with feedback)
// ══════════════════════════════════════════════════════════════

window.dmSaveLocal = async function() {
  const btn = document.getElementById('dm-save-btn');
  const icon = document.getElementById('dm-save-icon');
  if (btn) btn.classList.add('saving');
  if (icon) { icon.innerHTML = ICONS.loader; icon.querySelector('svg').classList.add('spin'); }

  try {
    if (typeof save === 'function') save();

    // Also download a JSON backup file so user can re-import it
    try {
      const state = (typeof S !== 'undefined') ? S : {};
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `MoneyNest_backup_${dateStr}.json`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    } catch(_) {}

    // Brief delay for feedback
    await new Promise(r => setTimeout(r, 600));

    if (icon) {
      icon.innerHTML = ICONS.check;
      icon.querySelector('svg').style.color = 'var(--accent)';
    }
    dmToast(_dm('dm_datos_guardados', '💾 Datos guardados y descargados como backup'), 'success');

    setTimeout(() => {
      if (icon) icon.innerHTML = ICONS.save;
      if (btn) btn.classList.remove('saving');
    }, 1500);
  } catch(e) {
    if (icon) icon.innerHTML = ICONS.save;
    if (btn) btn.classList.remove('saving');
    dmToast(_dm('dm_error_guardar', 'Error al guardar'), 'error');
  }
};

// ══════════════════════════════════════════════════════════════
// PANEL OPEN / CLOSE
// ══════════════════════════════════════════════════════════════

window.openDmPanel = function(id) {
  // Import blocked on trial — only Local/Pro can import
  if (id === 'dm-import-panel') {
    const plan = (typeof window.MNAuth !== 'undefined') ? window.MNAuth.getUser().plan : 'trial';
    if (plan === 'trial') {
      dmToast(_dm('dm_importar_requiere_plan', '🔒 Importar datos requiere MoneyNest'), 'warn');
      if (window.MNAuthUI) MNAuthUI.showAuthModal('plan');
      return;
    }
  }
  // Build panel content fresh each time
  if (id === 'dm-export-panel') buildExportPanel();
  if (id === 'dm-import-panel') buildImportPanel();

  const overlay = document.getElementById('dm-overlay');
  const panel   = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
  if (panel)   panel.classList.add('open');
  if (typeof window._pushScrollLock === 'function') window._pushScrollLock(); else document.body.style.overflow = 'hidden';
};

window.closeDmPanel = function(id) {
  const panel = document.getElementById(id);
  if (panel) panel.classList.remove('open');

  // Close overlay only if no other panel is open
  const anyOpen = document.querySelector('.dm-panel.open');
  if (!anyOpen) {
    document.getElementById('dm-overlay')?.classList.remove('open');
    if (typeof window._popScrollLock === 'function') window._popScrollLock(); else document.body.style.overflow = '';
  }
};

window.closeDmOverlay = function() {
  document.querySelectorAll('.dm-panel').forEach(p => p.classList.remove('open'));
  document.getElementById('dm-overlay')?.classList.remove('open');
  if (typeof window._popScrollLock === 'function') window._popScrollLock(); else document.body.style.overflow = '';
};

// ══════════════════════════════════════════════════════════════
// TOPBAR INJECTION
// ══════════════════════════════════════════════════════════════

function injectTopbarButtons() {
  const right = document.querySelector('.topbar-right');
  if (!right) return;

  // Remove old export button and theme button if they exist (we replace them)
  const oldExport = document.getElementById('topExportBtn');
  const oldTheme  = document.getElementById('topThemeBtn');
  if (oldExport) oldExport.remove();
  if (oldTheme)  oldTheme.remove();

  // Build new button group
  const group = document.createElement('div');
  group.className = 'tb-action-group';
  group.id = 'dm-topbar-group';
  group.innerHTML = `
    <button class="tb-btn tb-btn--bank-import" id="dm-bank-import-topbtn" onclick="window.MNBankImport&&MNBankImport.open()" title="Importar extracto bancario" style="background:var(--accent-dim);border-color:rgba(0,212,170,.35);color:var(--accent)">
      🏦
      <span class="tb-btn-label">Importar banco</span>
    </button>
    <button class="tb-btn tb-btn--import" id="dm-import-topbtn" onclick="openDmPanel('dm-import-panel')" title="Importar datos">
      ${ICONS.upload}
      <span class="tb-btn-label">Importar</span>
    </button>
    <button class="tb-btn tb-btn--export" onclick="openDmPanel('dm-export-panel')" title="Exportar datos">
      ${ICONS.download}
      <span class="tb-btn-label">Exportar</span>
    </button>
    <button class="tb-btn tb-btn--save" id="dm-save-btn" onclick="dmSaveLocal()" title="Guardar datos localmente">
      <span id="dm-save-icon">${ICONS.save}</span>
      <span class="tb-btn-label">Guardar</span>
    </button>
    <button class="tb-btn tb-btn--theme" id="topThemeBtn" onclick="toggleTheme()" title="Cambiar tema">
      <span id="dm-theme-icon">🌙</span>
    </button>
  `;

  // Trial pill removed (pro plan removed)

  right.appendChild(group);
}

function _updateTrialPill() { /* pro plan removed */ }

// ── Inject panel HTML ──────────────────────────────────────────
function injectPanelHTML() {
  const html = `
    <!-- DM Overlay -->
    <div class="dm-overlay" id="dm-overlay" onclick="closeDmOverlay()"></div>

    <!-- EXPORT PANEL -->
    <div class="dm-panel" id="dm-export-panel">
      <div class="dm-panel-header">
        <div class="dm-panel-title">
          <div class="dm-panel-icon dm-panel-icon--export">${ICONS.download}</div>
          <div>
            <div class="dm-panel-name">Exportar datos</div>
            <div class="dm-panel-sub">Descarga tus datos en el formato que prefieras</div>
          </div>
        </div>
        <button class="dm-close" onclick="closeDmPanel('dm-export-panel')" title="Cerrar">✕</button>
      </div>
      <div class="dm-panel-body" id="dm-export-body">
        <!-- Built dynamically -->
      </div>
    </div>

    <!-- IMPORT PANEL -->
    <div class="dm-panel" id="dm-import-panel">
      <div class="dm-panel-header">
        <div class="dm-panel-title">
          <div class="dm-panel-icon dm-panel-icon--import">${ICONS.upload}</div>
          <div>
            <div class="dm-panel-name">Importar datos</div>
            <div class="dm-panel-sub">Restaura o fusiona un archivo .moneynest o .json</div>
          </div>
        </div>
        <button class="dm-close" onclick="closeDmPanel('dm-import-panel')" title="Cerrar">✕</button>
      </div>
      <div class="dm-panel-body" id="dm-import-body">
        <!-- Built dynamically -->
      </div>
      <div class="dm-panel-footer">
        <button class="dm-btn-cancel" onclick="closeDmPanel('dm-import-panel')">Cancelar</button>
        <button class="dm-btn-main dm-btn-main--import" id="dm-import-confirm-btn"
                onclick="dmConfirmImport()" disabled>
          Importar ahora
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
}

// ── Keyboard close ─────────────────────────────────────────────
function _handleKeydown(e) {
  if (e.key === 'Escape') {
    const open = document.querySelector('.dm-panel.open');
    if (open) {
      e.stopPropagation();
      closeDmOverlay();
    }
  }
}

// ── Theme icon sync ────────────────────────────────────────────
function _syncThemeIcon() {
  const icon = document.getElementById('dm-theme-icon');
  if (!icon) return;
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  icon.textContent = isDark ? '🌙' : '☀️';
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  injectPanelHTML();
  injectTopbarButtons();
  _syncThemeIcon();

  // Watch for theme changes
  const observer = new MutationObserver(_syncThemeIcon);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  document.addEventListener('keydown', _handleKeydown, true);
}

// ── Run after DOM ──────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // If scripts load after DOM, give app.js a tick to initialize first
  setTimeout(init, 50);
}

// Expose for external use
window.MoneyNestDM = {
  export: window.dmExportMoneynest,
  importPanel: () => openDmPanel('dm-import-panel'),
  exportPanel: () => openDmPanel('dm-export-panel'),
  toast: dmToast,
  updateTrialPill: _updateTrialPill,
};

})();
