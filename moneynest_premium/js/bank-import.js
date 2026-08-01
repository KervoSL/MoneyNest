/**
 * MoneyNest — js/bank-import.js
 * Premium multi-step bank statement (CSV) import wizard.
 * Replaces the old js/csv-import.js with a guided, Copilot/Monarch-style flow.
 *
 * IMPORTANT: writes directly to the app's real state (S.gastos/S.ingresos/S.cuentas)
 * via save()+render(), NOT the disconnected MNData/'mn_data' store the old
 * implementation used (which never actually showed up in the app).
 */
;(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // ── STATE ──────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  const TOTAL_STEPS = 5;
  let ST = _freshState();

  function _freshState() {
    return {
      step: 1,                 // 1..5, or 'progress' / 'success'
      fileName: '',
      fileSize: 0,
      csvText: '',
      headers: [],
      rawRows: [],
      rows: [],                 // normalized {date, description, amount, isExpense, merchantKey}
      duplicates: [],
      format: 'generic',
      accountMode: 'new',       // 'new' | 'existing'
      accountId: '',
      newAccountName: '',
      groups: [],               // [{key, sample, count, total, category, isNew}]
      categorizeChoice: null,   // 'now' | 'skip'
      rememberMappings: true,
      newCategoriesCreated: [],
    };
  }

  // ════════════════════════════════════════════════════════════════
  // ── BANK DETECTION ─────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  const BANKS = {
    revolut:   { label: 'Revolut',   emoji: '🟣' },
    n26:       { label: 'N26',       emoji: '🔵' },
    bbva:      { label: 'BBVA',      emoji: '🔷' },
    santander: { label: 'Santander', emoji: '🔴' },
    caixabank: { label: 'CaixaBank', emoji: '⭐' },
    sabadell:  { label: 'Sabadell',  emoji: '🔶' },
    ing:       { label: 'ING',       emoji: '🦁' },
    wise:      { label: 'Wise',      emoji: '🌍' },
    generic:   { label: 'Genérico',  emoji: '🏦' },
  };

  function detectBankFormat(headers) {
    const h = headers.map(s => (s || '').toLowerCase().trim());
    const has = (s) => h.some(x => x.includes(s));

    if (has('balance') && has('currency') && has('type') && has('started date')) return 'revolut';
    if (has('destinatario') && has('saldo (eur)')) return 'n26';
    if (h.includes('f.valor') && has('disponible')) return 'bbva';
    if (has('concepto') && has('saldo') && !has('disponible') && !h.includes('f.valor') && !has('caixabank')) return 'santander';
    if (has('caixabank') || (has('fecha valor') && has('concepto') && has('importe'))) return 'caixabank';
    if (has('sabadell') || (has('fecha operación') && has('concepto') && has('importe'))) return 'sabadell';
    if (has('value date') && has('description') && (has('income') || has('expenses'))) return 'ing';
    if (h.includes('id') && has('status') && has('target currency')) return 'wise';
    return 'generic';
  }

  // ════════════════════════════════════════════════════════════════
  // ── CSV PARSER ─────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const sep = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';

    function splitLine(line) {
      const cells = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === sep && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
      cells.push(cur.trim());
      return cells;
    }

    const headers = splitLine(lines[0]);
    const rows = lines.slice(1).map(l => {
      const vals = splitLine(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    return { headers, rows };
  }

  function _parseAmount(str) {
    if (!str) return 0;
    return parseFloat(String(str).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
  }

  function _parseDate(str) {
    if (!str) return new Date();
    const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(str.slice(0, 10));
    const eu = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (eu) return new Date(`${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`);
    const d = new Date(str);
    return isNaN(d) ? new Date() : d;
  }

  function normalizeRow(row, format) {
    let date, description, amount;
    switch (format) {
      case 'revolut':
        date = _parseDate(row['Date'] || row['Started Date'] || '');
        description = row['Description'] || '';
        amount = _parseAmount(row['Amount'] || '0');
        break;
      case 'n26':
        date = _parseDate(row['Fecha'] || '');
        description = row['Nombre del destinatario'] || row['Referencia de la cuenta'] || '';
        amount = _parseAmount(row['Importe (EUR)'] || '0');
        break;
      case 'bbva':
        date = _parseDate(row['F.Valor'] || row['Fecha'] || '');
        description = row['Concepto'] || '';
        amount = _parseAmount(row['Importe'] || '0');
        break;
      case 'santander':
      case 'caixabank':
      case 'sabadell':
        date = _parseDate(row['Fecha'] || row['Fecha valor'] || row['Fecha operación'] || '');
        description = row['Concepto'] || '';
        amount = _parseAmount(row['Importe'] || '0');
        break;
      case 'ing':
        date = _parseDate(row['Value Date'] || row['Date'] || '');
        description = row['Description'] || row['Name'] || '';
        amount = _parseAmount(row['Income'] || row['Amount'] || row['Expenses'] || '0');
        break;
      case 'wise':
        date = _parseDate(row['Created on'] || row['Date'] || '');
        description = row['Description'] || row['Merchant'] || '';
        amount = _parseAmount(row['Amount'] || row['Target amount (after fees)'] || '0');
        break;
      default: {
        const keys = Object.keys(row);
        const dateKey = keys.find(k => /fecha|date/i.test(k)) || keys[0];
        const descKey = keys.find(k => /concepto|description|descripcion|detalle|merchant/i.test(k)) || keys[1];
        const amtKey  = keys.find(k => /importe|amount|monto/i.test(k)) || keys[2];
        date = _parseDate(row[dateKey] || '');
        description = row[descKey] || '';
        amount = _parseAmount(row[amtKey] || '0');
      }
    }
    return {
      date,
      description: (description || '').trim() || 'Movimiento sin descripción',
      amount: Math.abs(amount),
      isExpense: amount < 0,
    };
  }

  // Build a "merchant key" by stripping numbers/dates/reference codes so
  // similar transactions ("MERCADONA MADRID 4521", "MERCADONA 8871 BCN") group together.
  function merchantKeyFor(description) {
    let s = (description || '').toUpperCase();
    s = s.replace(/\d{3,}/g, '');           // strip long number sequences (refs, card numbers)
    s = s.replace(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g, ''); // strip dates
    s = s.replace(/[^A-ZÁÉÍÓÚÑ\s]/g, ' ');  // strip punctuation
    s = s.replace(/\s+/g, ' ').trim();
    // Keep first 2-3 significant words as the grouping key
    const words = s.split(' ').filter(w => w.length > 1);
    return (words.slice(0, 2).join(' ') || s || 'DESCONOCIDO').trim();
  }

  function prettyMerchant(key) {
    return key.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }

  // ════════════════════════════════════════════════════════════════
  // ── PERSISTENT MERCHANT → CATEGORY MAPPING ────────────────────
  // ════════════════════════════════════════════════════════════════
  const MAP_KEY = 'mn_merchant_category_map';
  function _loadMap() {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch { return {}; }
  }
  function _saveMap(map) {
    try { localStorage.setItem(MAP_KEY, JSON.stringify(map)); } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════
  // ── HELPERS INTO THE REAL APP ──────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _S() { return window.S; }
  function _gastoCats() {
    try { return (_S().categorias && _S().categorias.gasto) || ['Otros']; } catch { return ['Otros']; }
  }
  function _cuentas() { try { return _S().cuentas || []; } catch { return []; } }
  function _catEmoji(c) { return (window.catEmoji ? window.catEmoji(c) : '📌'); }
  function _uid() { return window.uid ? window.uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); }
  function _fmtDate(d) {
    try { return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  }
  function _fmtEur(n) {
    try { return (window.eur ? window.eur(n) : `${n.toFixed(2)}€`); } catch { return `${(n||0).toFixed(2)}€`; }
  }

  // ════════════════════════════════════════════════════════════════
  // ── MODAL SCAFFOLDING ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _ensureStyles() {
    if (document.getElementById('mn-bi-style')) return;
    const s = document.createElement('style');
    s.id = 'mn-bi-style';
    s.textContent = `
      #mnBankImportOverlay .modal { max-width: 620px; width: 94vw; max-height: 88vh; padding:0; overflow:hidden; }
      .mnbi-wrap { display:flex; flex-direction:column; max-height:88vh; }
      .mnbi-head { padding:22px 26px 0; flex-shrink:0; }
      .mnbi-title-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
      .mnbi-title { font-size:1.15rem; font-weight:800; color:var(--text); display:flex; align-items:center; gap:9px; }
      .mnbi-close { background:none; border:none; color:var(--text3); font-size:1.1rem; cursor:pointer; padding:6px 10px; border-radius:8px; }
      .mnbi-close:hover { background:var(--bg2); color:var(--text); }
      .mnbi-steps { display:flex; align-items:center; gap:6px; margin-bottom:18px; }
      .mnbi-step-dot { flex:1; height:4px; border-radius:99px; background:var(--border); transition:background .3s; }
      .mnbi-step-dot.done { background:var(--accent); }
      .mnbi-step-dot.active { background:linear-gradient(90deg,var(--accent),#6366F1); }
      .mnbi-body { padding:4px 26px 26px; overflow-y:auto; flex:1; }
      .mnbi-step-label { font-size:.7rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px; }
      .mnbi-h1 { font-size:1.3rem; font-weight:900; color:var(--text); margin-bottom:6px; letter-spacing:-.01em; }
      .mnbi-sub { font-size:.85rem; color:var(--text2); margin-bottom:22px; line-height:1.5; }

      /* Dropzone */
      .mnbi-dropzone {
        border:2px dashed var(--border2); border-radius:18px; padding:44px 24px; text-align:center;
        cursor:pointer; transition:all .2s; background:var(--bg2);
      }
      .mnbi-dropzone:hover, .mnbi-dropzone.dragover { border-color:var(--accent); background:var(--accent-dim); }
      .mnbi-dropzone-icon { font-size:2.8rem; margin-bottom:12px; }
      .mnbi-dropzone-title { font-size:.95rem; font-weight:700; color:var(--text); margin-bottom:4px; }
      .mnbi-dropzone-sub { font-size:.78rem; color:var(--text3); }
      .mnbi-file-card {
        display:flex; align-items:center; gap:12px; padding:16px 18px; border-radius:14px;
        background:var(--accent-dim); border:1px solid rgba(0,212,170,.25); margin-top:6px;
      }
      .mnbi-file-icon { width:42px; height:42px; border-radius:10px; background:var(--accent); color:#042b20; display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0; }
      .mnbi-file-name { font-size:.88rem; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mnbi-file-meta { font-size:.75rem; color:var(--text2); margin-top:2px; }

      /* Bank detection */
      .mnbi-bank-card { display:flex; align-items:center; gap:14px; padding:18px 20px; border-radius:16px; background:var(--accent-dim); border:1.5px solid rgba(0,212,170,.3); margin-bottom:20px; }
      .mnbi-bank-emoji { font-size:2rem; }
      .mnbi-bank-name { font-size:1.05rem; font-weight:800; color:var(--text); }
      .mnbi-bank-sub { font-size:.75rem; color:var(--text2); }
      .mnbi-bank-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
      @media(max-width:480px){ .mnbi-bank-grid{grid-template-columns:repeat(2,1fr)} }
      .mnbi-bank-opt { padding:14px 10px; border-radius:12px; border:1.5px solid var(--border); background:var(--bg2); text-align:center; cursor:pointer; transition:all .15s; }
      .mnbi-bank-opt:hover { border-color:var(--border2); }
      .mnbi-bank-opt.selected { border-color:var(--accent); background:var(--accent-dim); }
      .mnbi-bank-opt-emoji { font-size:1.5rem; margin-bottom:4px; }
      .mnbi-bank-opt-name { font-size:.76rem; font-weight:700; color:var(--text); }

      .mnbi-radio-row { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
      .mnbi-radio-card { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px; border:1.5px solid var(--border); background:var(--bg2); cursor:pointer; transition:all .15s; }
      .mnbi-radio-card:hover { border-color:var(--border2); }
      .mnbi-radio-card.selected { border-color:var(--accent); background:var(--accent-dim); }
      .mnbi-radio-dot { width:18px; height:18px; border-radius:50%; border:2px solid var(--border2); flex-shrink:0; display:flex; align-items:center; justify-content:center; }
      .mnbi-radio-card.selected .mnbi-radio-dot { border-color:var(--accent); }
      .mnbi-radio-dot-inner { width:9px; height:9px; border-radius:50%; background:var(--accent); opacity:0; transform:scale(0); transition:all .15s; }
      .mnbi-radio-card.selected .mnbi-radio-dot-inner { opacity:1; transform:scale(1); }
      .mnbi-radio-label { font-size:.88rem; font-weight:700; color:var(--text); }
      .mnbi-radio-sub { font-size:.74rem; color:var(--text2); margin-top:1px; }
      .mnbi-input, .mnbi-select {
        width:100%; padding:12px 14px; border-radius:10px; border:1.5px solid var(--border2);
        background:var(--bg2); color:var(--text); font-size:.88rem; font-family:inherit; margin-top:10px;
      }
      .mnbi-input:focus, .mnbi-select:focus { outline:none; border-color:var(--accent); }

      /* Preview KPIs */
      .mnbi-kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
      @media(max-width:480px){ .mnbi-kpi-grid{grid-template-columns:1fr} }
      .mnbi-kpi { padding:14px; border-radius:12px; background:var(--bg2); border:1px solid var(--border); text-align:center; min-width:0; }
      .mnbi-kpi-label { font-size:.65rem; font-weight:700; color:var(--text2); text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
      .mnbi-kpi-val { font-size:1.05rem; font-weight:800; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      .mnbi-table-wrap { border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:18px; }
      .mnbi-table { width:100%; border-collapse:collapse; font-size:.8rem; }
      .mnbi-table thead th { padding:9px 12px; font-size:.66rem; color:var(--text3); text-transform:uppercase; letter-spacing:.05em; text-align:left; background:var(--bg2); font-weight:700; }
      .mnbi-table tbody td { padding:9px 12px; border-top:1px solid var(--border); color:var(--text2); }
      .mnbi-table tbody tr:hover { background:var(--bg2); }
      .mnbi-table .mnbi-desc { max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text); font-weight:600; }
      .mnbi-more-row { text-align:center; padding:10px; font-size:.74rem; color:var(--text3); background:var(--bg2); }

      /* Categorize choice */
      .mnbi-choice-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px; }
      @media(max-width:480px){ .mnbi-choice-grid{grid-template-columns:1fr} }
      .mnbi-choice-card { padding:22px 18px; border-radius:16px; border:2px solid var(--border); background:var(--bg2); text-align:center; cursor:pointer; transition:all .15s; }
      .mnbi-choice-card:hover { border-color:var(--accent); transform:translateY(-2px); }
      .mnbi-choice-icon { font-size:2rem; margin-bottom:8px; }
      .mnbi-choice-title { font-size:.92rem; font-weight:800; color:var(--text); margin-bottom:4px; }
      .mnbi-choice-sub { font-size:.74rem; color:var(--text2); line-height:1.4; }

      /* Merchant groups */
      .mnbi-group-search { margin-bottom:14px; }
      .mnbi-group-list { display:flex; flex-direction:column; gap:8px; max-height:340px; overflow-y:auto; margin-bottom:14px; padding-right:2px; }
      .mnbi-group-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; background:var(--bg2); border:1px solid var(--border); }
      .mnbi-group-info { flex:1; min-width:0; }
      .mnbi-group-name { font-size:.86rem; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mnbi-group-meta { font-size:.72rem; color:var(--text3); margin-top:1px; }
      .mnbi-group-cat-select {
        flex-shrink:0; width:150px; padding:8px 10px; border-radius:9px; border:1.5px solid var(--border2);
        background:var(--bg); color:var(--text); font-size:.78rem; font-family:inherit; font-weight:600;
      }
      .mnbi-group-cat-select.mapped { border-color:var(--accent); background:var(--accent-dim); color:var(--accent); }
      .mnbi-remember-row { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; background:var(--bg2); border:1px solid var(--border); margin-bottom:6px; }
      .mnbi-remember-row input { width:18px; height:18px; flex-shrink:0; cursor:pointer; accent-color:var(--accent); }
      .mnbi-remember-row label { font-size:.8rem; color:var(--text2); font-weight:600; cursor:pointer; }

      /* Summary */
      .mnbi-summary-list { display:flex; flex-direction:column; gap:0; border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:18px; }
      .mnbi-summary-row { display:flex; justify-content:space-between; align-items:center; padding:13px 16px; border-bottom:1px solid var(--border); font-size:.85rem; }
      .mnbi-summary-row:last-child { border-bottom:none; }
      .mnbi-summary-row span:first-child { color:var(--text2); }
      .mnbi-summary-row span:last-child { color:var(--text); font-weight:700; }

      /* Footer nav */
      .mnbi-footer { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:18px 26px; border-top:1px solid var(--border); flex-shrink:0; }
      .mnbi-btn-back { background:none; border:none; color:var(--text2); font-size:.85rem; font-weight:700; cursor:pointer; padding:10px 6px; display:flex; align-items:center; gap:5px; }
      .mnbi-btn-back:hover { color:var(--text); }
      .mnbi-btn-primary {
        padding:13px 26px; border-radius:12px; border:none; cursor:pointer;
        background:linear-gradient(135deg,var(--accent),#00A882); color:#042b20;
        font-size:.9rem; font-weight:800; font-family:inherit; box-shadow:0 6px 20px rgba(0,212,170,.28);
        display:flex; align-items:center; gap:8px; transition:transform .15s;
      }
      .mnbi-btn-primary:hover { transform:translateY(-1px); }
      .mnbi-btn-primary:disabled { opacity:.4; cursor:default; transform:none; }

      /* Progress screen */
      .mnbi-progress-wrap { padding:50px 30px; text-align:center; }
      .mnbi-progress-ring { width:64px; height:64px; margin:0 auto 26px; }
      .mnbi-progress-list { display:flex; flex-direction:column; gap:12px; text-align:left; max-width:320px; margin:0 auto; }
      .mnbi-progress-item { display:flex; align-items:center; gap:12px; font-size:.85rem; color:var(--text3); transition:color .25s; }
      .mnbi-progress-item.active { color:var(--text); font-weight:700; }
      .mnbi-progress-item.done { color:var(--accent); font-weight:700; }
      .mnbi-progress-icon { width:20px; height:20px; border-radius:50%; border:2px solid var(--border2); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.65rem; transition:all .2s; }
      .mnbi-progress-item.active .mnbi-progress-icon { border-color:var(--accent); }
      .mnbi-progress-item.done .mnbi-progress-icon { border-color:var(--accent); background:var(--accent); color:#042b20; }
      .mnbi-spin { animation:mnbiSpin 1s linear infinite; }
      @keyframes mnbiSpin { to { transform:rotate(360deg); } }

      /* Success screen */
      .mnbi-success-wrap { padding:40px 30px; text-align:center; }
      .mnbi-success-icon { width:76px; height:76px; border-radius:50%; background:var(--accent-dim); border:2px solid var(--accent); display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin:0 auto 20px; animation:mnbiPop .4s cubic-bezier(.22,1.4,.36,1); }
      @keyframes mnbiPop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
      .mnbi-success-title { font-size:1.3rem; font-weight:900; color:var(--text); margin-bottom:6px; }
      .mnbi-success-sub { font-size:.85rem; color:var(--text2); margin-bottom:24px; }
      .mnbi-success-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:26px; }
      @media(max-width:480px){ .mnbi-success-stats{grid-template-columns:1fr} }
      .mnbi-success-stat { padding:14px; border-radius:12px; background:var(--bg2); border:1px solid var(--border); }
      .mnbi-success-stat-val { font-size:1.15rem; font-weight:900; color:var(--text); }
      .mnbi-success-stat-lbl { font-size:.68rem; color:var(--text3); margin-top:3px; text-transform:uppercase; letter-spacing:.05em; }
      .mnbi-success-actions { display:flex; gap:10px; }
      @media(max-width:480px){ .mnbi-success-actions{flex-direction:column} }
      .mnbi-success-actions .mnbi-btn-primary { flex:1; justify-content:center; }
      .mnbi-btn-secondary-full {
        flex:1; padding:13px 20px; border-radius:12px; border:1.5px solid var(--border2);
        background:var(--bg2); color:var(--text); font-size:.86rem; font-weight:700; cursor:pointer; font-family:inherit;
      }

      /* Empty state */
      .mnbi-empty { text-align:center; padding:30px 10px; color:var(--text3); font-size:.85rem; }
    `;
    document.head.appendChild(s);
  }

  function _overlay() { return document.getElementById('mnBankImportOverlay'); }

  function openWizard() {
    _ensureStyles();
    ST = _freshState();
    let ov = _overlay();
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.id = 'mnBankImportOverlay';
      document.body.appendChild(ov);
    }
    _render();
    setTimeout(() => ov.classList.add('open'), 10);
  }

  function closeWizard() {
    const ov = _overlay();
    if (!ov) return;
    ov.classList.remove('open');
    setTimeout(() => { ov.innerHTML = ''; }, 200);
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP DOTS / SHELL ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _stepDots() {
    const numericStep = typeof ST.step === 'number' ? ST.step : TOTAL_STEPS;
    let dots = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const cls = i < numericStep ? 'done' : (i === numericStep ? 'active' : '');
      dots += `<div class="mnbi-step-dot ${cls}"></div>`;
    }
    return dots;
  }

  function _shell(bodyHtml, footerHtml, opts = {}) {
    const ov = _overlay();
    if (!ov) return;
    const showSteps = opts.showSteps !== false;
    ov.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="mnbi-wrap">
          <div class="mnbi-head">
            <div class="mnbi-title-row">
              <div class="mnbi-title">🏦 ${_t('bi_titulo', 'Importar extracto bancario')}</div>
              <button class="mnbi-close" onclick="MNBankImport.close()">✕</button>
            </div>
            ${showSteps ? `<div class="mnbi-steps">${_stepDots()}</div>` : ''}
          </div>
          <div class="mnbi-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="mnbi-footer">${footerHtml}</div>` : ''}
        </div>
      </div>`;
  }

  function _t(key, fallback) {
    return (window.t ? window.t(key, fallback) : fallback);
  }

  // ════════════════════════════════════════════════════════════════
  // ── ROUTER ─────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _render() {
    if (ST.step === 'progress') return _renderProgress();
    if (ST.step === 'success')  return _renderSuccess();
    if (ST.step === 1) return _renderStep1();
    if (ST.step === 2) return _renderStep2();
    if (ST.step === 3) return _renderStep3();
    if (ST.step === 4) return _renderStep4();
    if (ST.step === 5) return _renderStep5();
  }

  function _goBack() {
    if (typeof ST.step !== 'number') return;
    // If returning to step 4 after having skipped categorization, show the choice screen again
    if (ST.step === 5 && ST.categorizeChoice === false) ST.categorizeChoice = null;
    ST.step = Math.max(1, ST.step - 1);
    _render();
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 1 — UPLOAD ────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep1() {
    const hasFile = !!ST.fileName;
    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 1 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s1_titulo', 'Sube tu extracto bancario')}</div>
      <div class="mnbi-sub">${_t('bi_s1_sub', 'Exporta el movimiento de tu banco en formato CSV y arrástralo aquí.')}</div>

      <div class="mnbi-dropzone" id="mnbiDropzone" onclick="document.getElementById('mnbiFileInput').click()">
        <div class="mnbi-dropzone-icon">📄</div>
        <div class="mnbi-dropzone-title">${_t('bi_s1_drop', 'Arrastra tu CSV aquí')}</div>
        <div class="mnbi-dropzone-sub">${_t('bi_s1_o_click', 'o haz clic para seleccionar un archivo')}</div>
      </div>
      <input type="file" id="mnbiFileInput" accept=".csv,text/csv" style="display:none">

      ${hasFile ? `
      <div class="mnbi-file-card">
        <div class="mnbi-file-icon">📄</div>
        <div style="flex:1;min-width:0">
          <div class="mnbi-file-name">${ST.fileName}</div>
          <div class="mnbi-file-meta">${_fmtFileSize(ST.fileSize)} · ${ST.rows.length} ${_t('bi_transacciones_encontradas', 'transacciones encontradas')}</div>
        </div>
        <span style="color:var(--accent);font-size:1.3rem">✓</span>
      </div>` : ''}
    `;
    const footer = `
      <span></span>
      <button class="mnbi-btn-primary" id="mnbiContinueBtn" ${hasFile ? '' : 'disabled'} onclick="MNBankImport._toStep2()">
        ${_t('bi_continuar', 'Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);

    const dz = document.getElementById('mnbiDropzone');
    const input = document.getElementById('mnbiFileInput');
    if (dz) {
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault(); dz.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) _readFile(file);
      });
    }
    if (input) input.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) _readFile(f); });
  }

  function _fmtFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _readFile(file) {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      if (window.toast) toast(_t('bi_err_formato', 'Solo se admiten archivos .csv'), 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const { headers, rows: rawRows } = parseCSV(csvText);
      if (!rawRows.length) {
        if (window.toast) toast(_t('bi_err_vacio', 'El archivo está vacío o no tiene filas válidas'), 'error');
        return;
      }
      const format = detectBankFormat(headers);
      const normalized = rawRows.map(r => {
        try { const n = normalizeRow(r, format); n.merchantKey = merchantKeyFor(n.description); return n; }
        catch { return null; }
      }).filter(Boolean);

      ST.fileName = file.name;
      ST.fileSize = file.size;
      ST.csvText  = csvText;
      ST.headers  = headers;
      ST.rawRows  = rawRows;
      ST.rows     = normalized;
      ST.format   = format;
      _renderStep1();
    };
    reader.readAsText(file, 'UTF-8');
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 2 — BANK + ACCOUNT ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep2() {
    const detected = ST.format !== 'generic';
    const bank = BANKS[ST.format] || BANKS.generic;
    if (!ST.newAccountName) ST.newAccountName = detected ? bank.label : '';

    const cuentas = _cuentas();
    const bankPicker = !detected ? `
      <div class="mnbi-sub" style="margin-bottom:10px">${_t('bi_s2_elige_banco', 'No hemos podido detectar el banco automáticamente. Elige uno:')}</div>
      <div class="mnbi-bank-grid">
        ${Object.entries(BANKS).filter(([k]) => k !== 'generic').map(([key, b]) => `
          <div class="mnbi-bank-opt ${ST.format === key ? 'selected' : ''}" onclick="MNBankImport._pickBank('${key}')">
            <div class="mnbi-bank-opt-emoji">${b.emoji}</div>
            <div class="mnbi-bank-opt-name">${b.label}</div>
          </div>`).join('')}
      </div>` : `
      <div class="mnbi-bank-card">
        <div class="mnbi-bank-emoji">${bank.emoji}</div>
        <div>
          <div class="mnbi-bank-name">${_t('bi_banco_detectado', 'Banco detectado')}: ${bank.label}</div>
          <div class="mnbi-bank-sub">${_t('bi_banco_no_es', '¿No es correcto?')} <a href="#" onclick="event.preventDefault();MNBankImport._forceManualBank()" style="color:var(--accent)">${_t('bi_cambiar', 'Cambiar')}</a></div>
        </div>
      </div>`;

    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 2 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s2_titulo', '¿Dónde quieres importar estos movimientos?')}</div>
      ${bankPicker}

      <div class="mnbi-radio-row" style="margin-top:20px">
        <div class="mnbi-radio-card ${ST.accountMode === 'new' ? 'selected' : ''}" onclick="MNBankImport._setAccountMode('new')">
          <div class="mnbi-radio-dot"><div class="mnbi-radio-dot-inner"></div></div>
          <div>
            <div class="mnbi-radio-label">${_t('bi_crear_cuenta', 'Crear una cuenta nueva')}</div>
            <div class="mnbi-radio-sub">${_t('bi_crear_cuenta_sub', 'Recomendado si es la primera vez que importas de este banco')}</div>
          </div>
        </div>
        <div class="mnbi-radio-card ${ST.accountMode === 'existing' ? 'selected' : ''} ${!cuentas.length ? 'style="opacity:.5;pointer-events:none"' : ''}" onclick="MNBankImport._setAccountMode('existing')">
          <div class="mnbi-radio-dot"><div class="mnbi-radio-dot-inner"></div></div>
          <div>
            <div class="mnbi-radio-label">${_t('bi_cuenta_existente', 'Importar en una cuenta existente')}</div>
            <div class="mnbi-radio-sub">${cuentas.length ? _t('bi_cuenta_existente_sub', 'Añade los movimientos a una cuenta que ya tienes') : _t('bi_sin_cuentas', 'Aún no tienes ninguna cuenta creada')}</div>
          </div>
        </div>
      </div>

      ${ST.accountMode === 'new' ? `
        <label style="font-size:.78rem;color:var(--text2);font-weight:600">${_t('bi_nombre_cuenta', 'Nombre de la cuenta')}</label>
        <input type="text" class="mnbi-input" id="mnbiNewAccountName" value="${ST.newAccountName}" placeholder="${_t('bi_nombre_cuenta_placeholder', 'p.ej. BBVA Cuenta Nómina')}">
      ` : `
        <label style="font-size:.78rem;color:var(--text2);font-weight:600">${_t('bi_selecciona_cuenta', 'Selecciona la cuenta')}</label>
        <select class="mnbi-select" id="mnbiExistingAccount">
          ${cuentas.map(c => `<option value="${c.id}" ${ST.accountId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
        </select>
      `}
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._back()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" onclick="MNBankImport._toStep3()">
        ${_t('bi_continuar', 'Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
  }

  function _pickBank(key) { ST.format = key; ST.newAccountName = BANKS[key].label; _renderStep2(); }
  function _forceManualBank() { ST.format = '__none__'; _renderStep2(); }
  function _setAccountMode(mode) {
    if (mode === 'existing' && !_cuentas().length) return;
    ST.accountMode = mode;
    if (mode === 'existing' && !ST.accountId && _cuentas().length) ST.accountId = _cuentas()[0].id;
    _renderStep2();
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 3 — PREVIEW ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep3() {
    // Duplicate detection against existing data (only makes sense if importing into existing account)
    const existing = ST.accountMode === 'existing' ? [...(_S().gastos||[]), ...(_S().ingresos||[])] : [];
    ST.duplicates = [];
    const clean = ST.rows.filter(r => {
      if (!existing.length) return true;
      const iso = r.date.toISOString().slice(0, 10);
      const dup = existing.find(e => e.fecha === iso && Math.abs((Number(e.importe)||0) - r.amount) < 0.01 && (e.concepto||'').toLowerCase() === r.description.toLowerCase());
      if (dup) { ST.duplicates.push(r); return false; }
      return true;
    });
    ST._cleanRows = clean;

    const incomeRows = clean.filter(r => !r.isExpense);
    const expenseRows = clean.filter(r => r.isExpense);
    const totalIncome = incomeRows.reduce((a, r) => a + r.amount, 0);
    const totalExpense = expenseRows.reduce((a, r) => a + r.amount, 0);

    const previewRows = clean.slice(0, 6).map(r => `
      <tr>
        <td>${_fmtDate(r.date)}</td>
        <td class="mnbi-desc" title="${r.description}">${r.description}</td>
        <td style="font-weight:700;color:${r.isExpense ? 'var(--red)' : 'var(--green)'}">${r.isExpense ? '−' : '+'}${r.amount.toFixed(2)}€</td>
      </tr>`).join('');

    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 3 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s3_titulo', 'Revisa tus movimientos')}</div>
      <div class="mnbi-sub">${_t('bi_s3_sub', 'Así es como hemos interpretado tu extracto.')}</div>

      <div class="mnbi-kpi-grid">
        <div class="mnbi-kpi"><div class="mnbi-kpi-label">📊 ${_t('bi_transacciones', 'Transacciones')}</div><div class="mnbi-kpi-val">${clean.length}</div></div>
        <div class="mnbi-kpi"><div class="mnbi-kpi-label">💰 ${_t('bi_ingresos', 'Ingresos')}</div><div class="mnbi-kpi-val" style="color:var(--green)">${_fmtEur(totalIncome)}</div></div>
        <div class="mnbi-kpi"><div class="mnbi-kpi-label">💸 ${_t('bi_gastos', 'Gastos')}</div><div class="mnbi-kpi-val" style="color:var(--red)">${_fmtEur(totalExpense)}</div></div>
      </div>

      ${ST.duplicates.length ? `<div style="font-size:.76rem;color:var(--gold);margin-bottom:12px">⚠️ ${ST.duplicates.length} ${_t('bi_duplicados_omitidos', 'movimientos duplicados serán omitidos automáticamente')}</div>` : ''}

      <div class="mnbi-table-wrap">
        <table class="mnbi-table">
          <thead><tr><th>${_t('bi_fecha', 'Fecha')}</th><th>${_t('bi_concepto', 'Concepto')}</th><th>${_t('bi_importe', 'Importe')}</th></tr></thead>
          <tbody>${previewRows}</tbody>
        </table>
        ${clean.length > 6 ? `<div class="mnbi-more-row">+ ${clean.length - 6} ${_t('bi_mas', 'más')}…</div>` : ''}
      </div>
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._back()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" onclick="MNBankImport._toStep4()">
        ${_t('bi_continuar', 'Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 4 — CATEGORIZE ────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _buildGroups() {
    const map = _loadMap();
    const byKey = {};
    (ST._cleanRows || ST.rows).filter(r => r.isExpense).forEach(r => {
      const k = r.merchantKey;
      if (!byKey[k]) byKey[k] = { key: k, sample: r.description, count: 0, total: 0 };
      byKey[k].count++;
      byKey[k].total += r.amount;
    });
    ST.groups = Object.values(byKey)
      .sort((a, b) => b.count - a.count)
      .map(g => ({ ...g, category: map[g.key] || '', isMapped: !!map[g.key] }));
  }

  function _renderStep4() {
    if (ST.categorizeChoice === null) {
      const body = `
        <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 4 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
        <div class="mnbi-h1">${_t('bi_s4_titulo', '¿Quieres categorizar tus movimientos?')}</div>
        <div class="mnbi-sub">${_t('bi_s4_sub', 'Agrupamos comercios similares para que solo tengas que elegir la categoría una vez por grupo.')}</div>
        <div class="mnbi-choice-grid">
          <div class="mnbi-choice-card" onclick="MNBankImport._chooseCategorize(true)">
            <div class="mnbi-choice-icon">🏷️</div>
            <div class="mnbi-choice-title">${_t('bi_categorizar_ahora', 'Categorizar ahora')}</div>
            <div class="mnbi-choice-sub">${_t('bi_categorizar_ahora_sub', 'Recomendado — mejores estadísticas')}</div>
          </div>
          <div class="mnbi-choice-card" onclick="MNBankImport._chooseCategorize(false)">
            <div class="mnbi-choice-icon">⏭️</div>
            <div class="mnbi-choice-title">${_t('bi_sin_categorias', 'Importar sin categorías')}</div>
            <div class="mnbi-choice-sub">${_t('bi_sin_categorias_sub', 'Podrás categorizar más tarde')}</div>
          </div>
        </div>
      `;
      const footer = `
        <button class="mnbi-btn-back" onclick="MNBankImport._back()">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${_t('bi_atras', 'Atrás')}
        </button>
        <span></span>`;
      _shell(body, footer);
      return;
    }

    if (ST.categorizeChoice === false) { ST.step = 5; return _renderStep5(); }

    // Categorize now — grouped merchant list
    if (!ST.groups.length) _buildGroups();
    const cats = _gastoCats();

    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 4 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s4b_titulo', 'Asigna una categoría a cada comercio')}</div>
      <div class="mnbi-sub">${ST.groups.length} ${_t('bi_comercios_detectados', 'comercios detectados')} · ${_t('bi_s4b_sub', 'se aplicará a todos los movimientos de ese grupo')}</div>

      <input type="text" class="mnbi-input mnbi-group-search" id="mnbiGroupSearch" placeholder="🔍 ${_t('bi_buscar_comercio', 'Buscar comercio...')}" oninput="MNBankImport._filterGroups(this.value)">

      <div class="mnbi-group-list" id="mnbiGroupList">
        ${_groupRowsHtml(ST.groups)}
      </div>

      <div class="mnbi-remember-row">
        <input type="checkbox" id="mnbiRememberMappings" ${ST.rememberMappings ? 'checked' : ''} onchange="MNBankImport._setRemember(this.checked)">
        <label for="mnbiRememberMappings">${_t('bi_recordar_mapeos', 'Recordar estas categorías para futuras importaciones')}</label>
      </div>
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._backToChoice()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" onclick="MNBankImport._toStep5()">
        ${_t('bi_continuar', 'Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
  }

  function _groupRowsHtml(groups) {
    const cats = _gastoCats();
    if (!groups.length) return `<div class="mnbi-empty">${_t('bi_sin_resultados', 'Sin resultados')}</div>`;
    return groups.map((g, idx) => `
      <div class="mnbi-group-row" data-key="${g.key}">
        <div class="mnbi-group-info">
          <div class="mnbi-group-name" title="${prettyMerchant(g.key)}">${_catEmoji(g.category)} ${prettyMerchant(g.key)}</div>
          <div class="mnbi-group-meta">${g.count} ${g.count === 1 ? _t('bi_movimiento', 'movimiento') : _t('bi_movimientos', 'movimientos')} · ${_fmtEur(g.total)}${g.isMapped ? ` · <span style="color:var(--accent)">✓ ${_t('bi_recordado', 'recordado')}</span>` : ''}</div>
        </div>
        <select class="mnbi-group-cat-select ${g.category ? 'mapped' : ''}" onchange="MNBankImport._setGroupCategory('${g.key}', this.value)">
          <option value="">${_t('bi_elegir', 'Elegir...')}</option>
          ${cats.map(c => `<option value="${c}" ${g.category === c ? 'selected' : ''}>${_catEmoji(c)} ${c}</option>`).join('')}
          <option value="__new__">➕ ${_t('bi_nueva_categoria', 'Nueva categoría...')}</option>
        </select>
      </div>`).join('');
  }

  function _chooseCategorize(val) {
    ST.categorizeChoice = val;
    if (val) _buildGroups();
    _renderStep4();
  }
  function _backToChoice() { ST.categorizeChoice = null; _renderStep4(); }

  function _filterGroups(q) {
    const query = (q || '').toLowerCase();
    const list = document.getElementById('mnbiGroupList');
    if (!list) return;
    const filtered = !query ? ST.groups : ST.groups.filter(g => g.key.toLowerCase().includes(query));
    list.innerHTML = _groupRowsHtml(filtered);
  }

  function _setGroupCategory(key, value) {
    if (value === '__new__') {
      const name = prompt(_t('bi_nombre_nueva_categoria', 'Nombre de la nueva categoría:'));
      if (!name || !name.trim()) { _renderStep4(); return; }
      const trimmed = name.trim();
      if (!_S().categorias.gasto.includes(trimmed)) {
        _S().categorias.gasto.push(trimmed);
        ST.newCategoriesCreated.push(trimmed);
      }
      value = trimmed;
    }
    const g = ST.groups.find(x => x.key === key);
    if (g) g.category = value;
    _filterGroups(document.getElementById('mnbiGroupSearch')?.value || '');
  }

  function _setRemember(val) { ST.rememberMappings = val; }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 5 — SUMMARY ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _renderStep5() {
    ST.step = 5;
    const clean = ST._cleanRows || ST.rows;
    const incomeCount = clean.filter(r => !r.isExpense).length;
    const expenseCount = clean.filter(r => r.isExpense).length;
    const merchantsCategorized = ST.categorizeChoice ? ST.groups.filter(g => g.category).length : 0;
    const bank = BANKS[ST.format] || BANKS.generic;
    const accountLabel = ST.accountMode === 'new'
      ? (document.getElementById('mnbiNewAccountName')?.value || ST.newAccountName || bank.label)
      : (_cuentas().find(c => c.id === ST.accountId)?.nombre || '—');

    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 5 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s5_titulo', 'Todo listo para importar')}</div>
      <div class="mnbi-sub">${_t('bi_s5_sub', 'Revisa el resumen antes de confirmar.')}</div>

      <div class="mnbi-summary-list">
        <div class="mnbi-summary-row"><span>${_t('bi_transacciones', 'Transacciones')}</span><span>${clean.length}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_ingresos', 'Ingresos')}</span><span style="color:var(--green)">${incomeCount}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_gastos', 'Gastos')}</span><span style="color:var(--red)">${expenseCount}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_comercios_categorizados', 'Comercios categorizados')}</span><span>${merchantsCategorized}${ST.categorizeChoice ? '/' + ST.groups.length : ''}</span></div>
        ${ST.newCategoriesCreated.length ? `<div class="mnbi-summary-row"><span>${_t('bi_categorias_creadas', 'Categorías nuevas creadas')}</span><span>${ST.newCategoriesCreated.length}</span></div>` : ''}
        <div class="mnbi-summary-row"><span>${_t('bi_cuenta', 'Cuenta')}</span><span>${accountLabel}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_banco', 'Banco')}</span><span>${bank.emoji} ${bank.label}</span></div>
      </div>
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._back()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" onclick="MNBankImport._runImport()">
        🚀 ${_t('bi_importar_ahora', 'Importar ahora')}
      </button>`;
    _shell(body, footer);
  }

  // ════════════════════════════════════════════════════════════════
  // ── PROGRESS SCREEN + ACTUAL IMPORT ────────────────────────────
  // ════════════════════════════════════════════════════════════════
  const PROGRESS_STEPS = [
    { key: 'read',      label: 'Leyendo CSV...' },
    { key: 'cols',      label: 'Detectando columnas...' },
    { key: 'bank',      label: 'Detectando banco...' },
    { key: 'classify',  label: 'Detectando ingresos y gastos...' },
    { key: 'merchants', label: 'Agrupando comercios...' },
    { key: 'prep',      label: 'Preparando importación...' },
    { key: 'import',    label: 'Importando...' },
  ];

  function _renderProgress(doneIdx = -1) {
    const items = PROGRESS_STEPS.map((s, i) => {
      const cls = i < doneIdx ? 'done' : (i === doneIdx ? 'active' : '');
      const icon = i < doneIdx ? '✓' : (i === doneIdx ? '<span class="mnbi-spin">◐</span>' : '');
      return `<div class="mnbi-progress-item ${cls}"><div class="mnbi-progress-icon">${icon}</div>${s.label}</div>`;
    }).join('');

    const body = `
      <div class="mnbi-progress-wrap">
        <div class="mnbi-progress-list">${items}</div>
      </div>`;
    _shell(body, '', { showSteps: false });
  }

  async function _runImport() {
    ST.step = 'progress';
    let i = 0;
    _renderProgress(0);

    const stepDelay = 260;
    const advance = () => new Promise(res => setTimeout(() => { i++; _renderProgress(i); res(); }, stepDelay));

    await advance(); // read
    await advance(); // cols
    await advance(); // bank
    await advance(); // classify
    await advance(); // merchants
    await advance(); // prep

    // ── ACTUAL WRITE INTO REAL APP STATE ──
    const S = _S();
    let cuentaId = ST.accountId;
    if (ST.accountMode === 'new') {
      const name = document.getElementById('mnbiNewAccountName')?.value || ST.newAccountName || (BANKS[ST.format]||BANKS.generic).label;
      const newAccount = { id: _uid(), nombre: name.trim() || 'Cuenta importada', tipo: 'banco', saldo: 0, valorTotal: 0, color: '#00D4AA', notas: '' };
      S.cuentas.push(newAccount);
      cuentaId = newAccount.id;
    }

    // Save merchant→category mappings if requested
    if (ST.categorizeChoice && ST.rememberMappings) {
      const map = _loadMap();
      ST.groups.forEach(g => { if (g.category) map[g.key] = g.category; });
      _saveMap(map);
    }

    const groupCatByKey = {};
    if (ST.categorizeChoice) ST.groups.forEach(g => { groupCatByKey[g.key] = g.category; });

    let importedIncome = 0, importedExpense = 0;
    const rows = ST._cleanRows || ST.rows;
    rows.forEach(r => {
      const fecha = (r.date instanceof Date && !isNaN(r.date)) ? r.date.toISOString().slice(0, 10) : todayISO();
      if (r.isExpense) {
        const categoria = groupCatByKey[r.merchantKey] || 'Otro';
        S.gastos.push({ id: _uid(), concepto: r.description, importe: r.amount, fecha, categoria, cuentaId, origen: 'bank-import' });
        importedExpense++;
      } else {
        S.ingresos.push({ id: _uid(), concepto: r.description, importe: r.amount, fecha, categoria: 'Otro', cuentaId, status: 'cobrado', origen: 'bank-import' });
        importedIncome++;
      }
    });

    if (typeof save === 'function') save();
    if (window.MNGamification) { try { MNGamification.checkAchievement('gasto_added'); MNGamification.checkAchievement('data_check'); } catch (_) {} }

    await advance(); // import (final)
    await new Promise(res => setTimeout(res, 300));

    ST._resultStats = {
      total: rows.length,
      income: importedIncome,
      expense: importedExpense,
      merchants: ST.categorizeChoice ? ST.groups.filter(g => g.category).length : 0,
    };
    ST.step = 'success';
    _renderSuccess();
    if (typeof render === 'function') render();
  }

  function _renderSuccess() {
    const stats = ST._resultStats || { total: 0, income: 0, expense: 0, merchants: 0 };
    const body = `
      <div class="mnbi-success-wrap">
        <div class="mnbi-success-icon">✓</div>
        <div class="mnbi-success-title">${_t('bi_success_titulo', 'Importación completada')}</div>
        <div class="mnbi-success-sub">${stats.total} ${_t('bi_success_sub', 'transacciones importadas correctamente')}</div>
        <div class="mnbi-success-stats">
          <div class="mnbi-success-stat"><div class="mnbi-success-stat-val" style="color:var(--green)">${stats.income}</div><div class="mnbi-success-stat-lbl">${_t('bi_ingresos', 'Ingresos')}</div></div>
          <div class="mnbi-success-stat"><div class="mnbi-success-stat-val" style="color:var(--red)">${stats.expense}</div><div class="mnbi-success-stat-lbl">${_t('bi_gastos', 'Gastos')}</div></div>
          <div class="mnbi-success-stat"><div class="mnbi-success-stat-val">${stats.merchants}</div><div class="mnbi-success-stat-lbl">${_t('bi_comercios', 'Comercios')}</div></div>
        </div>
        <div class="mnbi-success-actions">
          <button class="mnbi-btn-secondary-full" onclick="MNBankImport._viewTransactions()">${_t('bi_ver_movimientos', 'Ver movimientos')}</button>
          <button class="mnbi-btn-primary" onclick="MNBankImport.close()">${_t('bi_volver_dashboard', 'Volver al dashboard')}</button>
        </div>
      </div>`;
    _shell(body, '', { showSteps: false });
  }

  function _viewTransactions() {
    close();
    if (typeof goTo === 'function') goTo('gastos');
  }

  // ════════════════════════════════════════════════════════════════
  // ── PUBLIC API ─────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  window.MNBankImport = {
    open: openWizard,
    close: closeWizard,
    _back: _goBack,
    _toStep2: () => { ST.step = 2; _renderStep2(); },
    _toStep3: () => {
      if (ST.accountMode === 'new') ST.newAccountName = document.getElementById('mnbiNewAccountName')?.value || ST.newAccountName;
      if (ST.accountMode === 'existing') ST.accountId = document.getElementById('mnbiExistingAccount')?.value || ST.accountId;
      ST.step = 3; _renderStep3();
    },
    _toStep4: () => { ST.step = 4; _renderStep4(); },
    _toStep5: () => { ST.step = 5; _renderStep5(); },
    _pickBank: _pickBank,
    _forceManualBank: _forceManualBank,
    _setAccountMode: _setAccountMode,
    _chooseCategorize: _chooseCategorize,
    _backToChoice: _backToChoice,
    _filterGroups: _filterGroups,
    _setGroupCategory: _setGroupCategory,
    _setRemember: _setRemember,
    _runImport: _runImport,
    _viewTransactions: _viewTransactions,
    // exposed for tests / backward compat
    detectBankFormat, parseCSV, normalizeRow, merchantKeyFor,
  };
})();
