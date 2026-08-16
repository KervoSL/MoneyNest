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
      bankConfidence: 'none',   // 'high' | 'medium' | 'low' | 'none' — ver detectBankWithConfidence()
      suggestedBank: null,      // banco sugerido cuando la confianza no es 'high' (por nombre de archivo/fechas)
      columnMapping: null,      // resultado de detectColumns() para formato 'generic'
      columnMappingAmbiguous: false,
      _mappingMode: null,       // 'amount' | 'split' — se calcula al entrar en la pantalla de mapping
      _returnStepAfterMapping: 2, // a que paso volver tras confirmar el mapping (2 = flujo normal, 5 = atajo desde el preview final)
      accountMode: 'new',       // 'new' | 'existing'
      accountId: '',
      newAccountName: '',
      newAccountTipo: 'banco',  // mismo esquema que el modal real de Cuentas (banco/efectivo/cripto/inversion/ahorro/otro)
      groups: [],               // [{key, sample, count, total, category, isNew}] — GASTOS
      groupsIngreso: [],        // misma estructura que groups, pero para INGRESOS
      categorizeChoice: null,   // 'now' | 'skip'
      categorizeTab: 'gasto',   // 'gasto' | 'ingreso' — pestaña activa en el paso 4
      categorizeView: 'groups', // 'groups' | 'individual'
      _selectedForBulk: {},     // { [rowIndexInSTrows]: true } — seleccion multiple en vista individual
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

  // ── Bank learning: remember a manually-confirmed column fingerprint ──
  // If the user manually picks "Banco X" for a file whose headers don't
  // match any known layout, remember that exact header structure (order
  // doesn't matter — sorted before hashing) so future files with the
  // identical structure are recognized automatically next time, without
  // asking again. Only the column NAMES are stored — never any actual
  // transaction data — keeping this to the minimum structural
  // information needed for recognition.
  const BANK_FINGERPRINT_KEY = 'mn_bank_fingerprint_map';
  function _fingerprintForHeaders(headers) {
    return (headers || []).map(h => (h || '').toLowerCase().trim()).filter(Boolean).sort().join('|');
  }
  function _loadBankFingerprints() {
    try { return JSON.parse(localStorage.getItem(BANK_FINGERPRINT_KEY) || '{}'); } catch { return {}; }
  }
  function _learnBankFingerprint(headers, bankKey) {
    const fp = _fingerprintForHeaders(headers);
    // Never learn a fingerprint for a layout that already matches a
    // known bank by headers, or for 'generic' itself — only genuinely
    // unrecognized structures the user resolved manually are worth
    // remembering.
    if (!fp || bankKey === 'generic') return;
    const map = _loadBankFingerprints();
    map[fp] = bankKey;
    try { localStorage.setItem(BANK_FINGERPRINT_KEY, JSON.stringify(map)); } catch (_) {}
  }

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
    // Learned fingerprint: a structure the user has manually confirmed
    // before for this exact set of column names. Treated exactly like a
    // header-based match (same authoritative signal that drives the
    // parser) since the columns are, by definition, identical.
    const learned = _loadBankFingerprints()[_fingerprintForHeaders(headers)];
    if (learned) return learned;
    return 'generic';
  }

  // ── Confidence-aware detection (for the Step 2 UI only) ──────────
  // detectBankFormat() above is the authoritative, parser-facing signal
  // (column headers) and its return value drives normalizeRow() — it stays
  // untouched here. This wraps it with two extra, weaker signals (filename,
  // and date-format consistency in the sample rows) purely to power the
  // "Banco detectado" / "Banco no identificado" messaging and to offer a
  // helpful suggestion in the manual picker. It never changes ST.format
  // on its own — only an explicit user click (_pickBank) does that.
  const BANK_FILENAME_HINTS = {
    revolut:   ['revolut'],
    n26:       ['n26'],
    bbva:      ['bbva'],
    santander: ['santander'],
    caixabank: ['caixabank', 'caixa', 'lacaixa', 'la-caixa', 'la_caixa'],
    sabadell:  ['sabadell', 'bancsabadell'],
    ing:       ['ing-direct', 'ingdirect', 'ing_direct', 'ing-bank'],
    wise:      ['wise', 'transferwise'],
  };
  // International fintechs tend to export ISO dates; these Spanish retail
  // banks tend to export DD/MM/YYYY — used only to corroborate a filename
  // guess, never as a standalone detector (too weak / too common a format).
  const BANKS_ISO_DATES = new Set(['revolut', 'n26', 'wise', 'ing']);
  const BANKS_EU_DATES  = new Set(['bbva', 'santander', 'caixabank', 'sabadell']);

  function _looksISODate(s) { return /^\d{4}-\d{2}-\d{2}/.test(String(s || '').trim()); }
  function _looksEUDate(s)  { return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(String(s || '').trim()); }

  function _guessBankFromFilename(filename) {
    const name = (filename || '').toLowerCase();
    for (const key of Object.keys(BANK_FILENAME_HINTS)) {
      if (BANK_FILENAME_HINTS[key].some(hint => name.includes(hint))) return key;
    }
    return null;
  }

  function _sampleDateStrings(rawRows, headers) {
    const dateKey = headers.find(h => /fecha|date/i.test(h || '')) || headers[0];
    return rawRows.slice(0, 5).map(r => r[dateKey]).filter(Boolean);
  }

  // Returns { format, confidence, reason }.
  // confidence: 'high' (column headers matched a known layout — same as
  // detectBankFormat), 'medium' (filename guess corroborated by consistent
  // date formatting in the sample rows), 'low' (filename guess only,
  // unconfirmed), or 'none' (no usable signal at all).
  function detectBankWithConfidence(headers, rawRows, filename) {
    const byHeaders = detectBankFormat(headers);
    if (byHeaders !== 'generic') {
      return { format: byHeaders, confidence: 'high', reason: 'headers' };
    }

    const guess = _guessBankFromFilename(filename);
    if (!guess) return { format: 'generic', confidence: 'none', reason: 'none' };

    const samples = _sampleDateStrings(rawRows || [], headers || []);
    if (samples.length) {
      const wantsISO = BANKS_ISO_DATES.has(guess);
      const wantsEU  = BANKS_EU_DATES.has(guess);
      const check = wantsISO ? _looksISODate : (wantsEU ? _looksEUDate : () => true);
      const matches = samples.filter(check).length;
      if (matches / samples.length >= 0.8) {
        return { format: guess, confidence: 'medium', reason: 'filename+dates' };
      }
    }
    return { format: guess, confidence: 'low', reason: 'filename' };
  }

  // ════════════════════════════════════════════════════════════════
  // ── CSV PARSER ─────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  // Counts occurrences of `ch` in `line` that are OUTSIDE quoted spans,
  // so a separator character appearing inside a quoted field (e.g.
  // "Doe, John") never throws off delimiter detection.
  function _countOutsideQuotes(line, ch) {
    let count = 0, inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { i++; continue; } // escaped quote, stays inside
        inQ = !inQ;
        continue;
      }
      if (c === ch && !inQ) count++;
    }
    return count;
  }

  function _detectSeparator(headerLine) {
    const candidates = [';', ',', '\t'];
    let sep = ',', best = 0;
    candidates.forEach(c => {
      const n = _countOutsideQuotes(headerLine, c);
      if (n > best) { best = n; sep = c; }
    });
    return sep;
  }

  function parseCSV(text) {
    // Strip a leading UTF-8 BOM (common in "CSV UTF-8" exports from Excel),
    // which would otherwise silently corrupt the first header's name.
    text = String(text || '').replace(/^\uFEFF/, '');
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const sep = _detectSeparator(lines[0]);

    function splitLine(line) {
      const cells = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; } // escaped "" -> literal "
          inQ = !inQ;
          continue;
        }
        if (c === sep && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
      cells.push(cur.trim());
      return cells;
    }

    const headers = splitLine(lines[0]);
    const rows = lines.slice(1)
      .map(l => {
        const vals = splitLine(l);
        // Skip rows that are entirely blank once split (e.g. a stray ";;;" line)
        if (!vals.some(v => v !== '')) return null;
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      })
      .filter(Boolean);
    return { headers, rows };
  }

  // Robust amount parser: supports negative sign, accounting-style
  // parentheses for negatives, and both European (1.234,56) and US
  // (1,234.56) thousands/decimal separator conventions. The LAST '.'
  // or ',' found is treated as the decimal separator; anything before
  // it is treated as thousands grouping and stripped.
  function _parseAmount(str) {
    if (str === null || str === undefined) return 0;
    let s = String(str).trim();
    if (!s) return 0;

    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(/[^\d.,\-]/g, '');
    if (s.indexOf('-') !== -1) { negative = true; s = s.replace(/-/g, ''); }
    if (!s) return 0;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    const lastSepIdx = Math.max(lastDot, lastComma);

    let normalized;
    if (lastSepIdx === -1) {
      normalized = s;
    } else {
      const intPart = s.slice(0, lastSepIdx).replace(/[.,]/g, '');
      const fracPart = s.slice(lastSepIdx + 1).replace(/[.,]/g, '');
      const totalSeps = (s.match(/[.,]/g) || []).length;
      // A single separator followed by exactly 3 digits is ambiguous
      // ("1.234" / "1,234") — treat as thousands grouping (no decimals),
      // since bank amounts here are always whole or 2-decimal EUR values.
      if (fracPart.length === 3 && totalSeps === 1) {
        normalized = intPart + fracPart;
      } else {
        normalized = intPart + '.' + fracPart;
      }
    }
    const n = parseFloat(normalized);
    if (isNaN(n)) return 0;
    return negative ? -n : n;
  }

  function _parseDate(str) {
    if (!str) return new Date();
    const s = String(str).trim();

    // ISO: YYYY-MM-DD or YYYY/MM/DD
    let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) {
      const d = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
      if (!isNaN(d)) return d;
    }
    // EU: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (dot separator common in DE/AT/CH exports)
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      const d = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      if (!isNaN(d)) return d;
    }
    // EU with 2-digit year: DD/MM/YY, DD.MM.YY
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (m) {
      const yy = parseInt(m[3], 10);
      const year = yy < 70 ? 2000 + yy : 1900 + yy;
      const d = new Date(`${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      if (!isNaN(d)) return d;
    }
    const d = new Date(s);
    return isNaN(d) ? new Date() : d;
  }

  // ════════════════════════════════════════════════════════════════
  // ── COLUMN DETECTION (unknown/generic format files) ────────────
  // ════════════════════════════════════════════════════════════════
  // Synonym lists covering common column-naming variants across banks
  // and export tools. Order doesn't matter for matching (exact match
  // is always tried before substring match, see _matchColumn).
  const COLUMN_SYNONYMS = {
    date:        ['fecha operacion', 'fecha operación', 'fecha valor', 'f.valor', 'fecha', 'date', 'value date', 'transaction date', 'posting date', 'started date'],
    description: ['concepto', 'descripcion', 'descripción', 'description', 'detalle', 'memo', 'beneficiario', 'merchant', 'name'],
    amount:      ['importe', 'amount', 'monto', 'cantidad'],
    debit:       ['debe', 'debit', 'cargo', 'salida', 'gasto', 'expenses'],
    credit:      ['haber', 'credit', 'abono', 'entrada', 'ingreso', 'income'],
    balance:     ['saldo', 'balance', 'disponible'],
    reference:   ['referencia', 'reference', 'ref', 'nº operación', 'n operacion', 'id'],
  };

  function _normHeader(h) {
    return (h || '').toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents for matching
  }

  // 'high' = header matches a synonym exactly (after accent/case normalization).
  // 'medium' = header merely contains the synonym as a substring (weaker —
  // e.g. a column called "Fecha de nacimiento" would match "fecha" this way).
  function _matchColumn(headers, synonyms) {
    const normed = headers.map(_normHeader);
    const normSyns = synonyms.map(_normHeader);
    for (const syn of normSyns) {
      const idx = normed.findIndex(h => h === syn);
      if (idx !== -1) return { key: headers[idx], confidence: 'high' };
    }
    for (const syn of normSyns) {
      const idx = normed.findIndex(h => h.includes(syn));
      if (idx !== -1) return { key: headers[idx], confidence: 'medium' };
    }
    return null;
  }

  // Detects the semantic role of each column in a generic/unrecognized
  // CSV or XLSX. Returns { date, description, amount, debit, credit,
  // balance, reference, ambiguous }, where each field is either
  // { key, confidence } or null, and `ambiguous` is true whenever we
  // can't confidently identify date + description + (amount OR a
  // debit/credit pair) — the minimum needed to build a transaction.
  function detectColumns(headers) {
    headers = headers || [];
    const date        = _matchColumn(headers, COLUMN_SYNONYMS.date);
    const description = _matchColumn(headers, COLUMN_SYNONYMS.description);
    const amount       = _matchColumn(headers, COLUMN_SYNONYMS.amount);
    const debit         = _matchColumn(headers, COLUMN_SYNONYMS.debit);
    const credit         = _matchColumn(headers, COLUMN_SYNONYMS.credit);
    let balance       = _matchColumn(headers, COLUMN_SYNONYMS.balance);
    let reference     = _matchColumn(headers, COLUMN_SYNONYMS.reference);

    // A single column shouldn't be claimed by two different fields
    // (e.g. loose substring matching could match "Concepto" for both
    // description and, mistakenly, reference) — core fields win.
    const claimedKeys = new Set([date, description, amount, debit, credit].filter(Boolean).map(m => m.key));
    if (balance && claimedKeys.has(balance.key)) balance = null;
    if (reference && claimedKeys.has(reference.key)) reference = null;

    const confidentCore = !!(
      date && date.confidence === 'high' &&
      description && description.confidence === 'high' &&
      (
        (amount && amount.confidence === 'high') ||
        (debit && credit && debit.confidence === 'high' && credit.confidence === 'high')
      )
    );

    return { date, description, amount, debit, credit, balance, reference, ambiguous: !confidentCore };
  }

  function normalizeRow(row, format, columnMap) {
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
      case 'ing': {
        date = _parseDate(row['Value Date'] || row['Date'] || '');
        description = row['Description'] || row['Name'] || '';
        // ING sometimes splits into separate Income/Expenses columns
        // instead of one signed Amount column. Expenses must be
        // negated — previously it wasn't, so expenses were silently
        // misclassified as income (isExpense = amount < 0 was false).
        if (row['Amount'] !== undefined && row['Amount'] !== '') {
          amount = _parseAmount(row['Amount']);
        } else {
          const inc = _parseAmount(row['Income'] || '0');
          const exp = _parseAmount(row['Expenses'] || '0');
          amount = inc !== 0 ? inc : -Math.abs(exp);
        }
        break;
      }
      case 'wise':
        date = _parseDate(row['Created on'] || row['Date'] || '');
        description = row['Description'] || row['Merchant'] || '';
        amount = _parseAmount(row['Amount'] || row['Target amount (after fees)'] || '0');
        break;
      default: {
        const map = columnMap || detectColumns(Object.keys(row));
        const dateKey = map.date && map.date.key;
        const descKey = map.description && map.description.key;
        date = _parseDate(dateKey ? row[dateKey] : '');
        description = descKey ? row[descKey] : '';
        if (map.amount && map.amount.key) {
          amount = _parseAmount(row[map.amount.key] || '0');
        } else if ((map.debit && map.debit.key) || (map.credit && map.credit.key)) {
          const debitVal  = map.debit  && map.debit.key  ? _parseAmount(row[map.debit.key]  || '0') : 0;
          const creditVal = map.credit && map.credit.key ? _parseAmount(row[map.credit.key] || '0') : 0;
          amount = creditVal !== 0 ? Math.abs(creditVal) : -Math.abs(debitVal);
        } else {
          amount = 0;
        }
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
  // ════════════════════════════════════════════════════════════════
  // ── AUTOMATIC CATEGORIZATION (merchant-name pattern matching) ──
  // ════════════════════════════════════════════════════════════════
  // Maps common merchant-name patterns to the EXACT category strings from
  // the app's real default gasto model (Vivienda/Alimentación/Transporte/
  // Salud/Ocio/Ropa/Educación/Suscripciones/Restaurantes/Tecnología/
  // Seguros/Otro) — never invents categories outside that set. A guess is
  // only ever applied if that exact category also exists in the user's
  // live category list (_gastoCats()), so a customized/renamed category
  // set is respected instead of silently reintroducing removed ones.
  // ════════════════════════════════════════════════════════════════
  // ── TEXT NORMALIZATION (foundation for all matching below) ─────
  // ════════════════════════════════════════════════════════════════
  // Strips accents/diacritics (café -> CAFE), apostrophes (McDonald's ->
  // MCDONALDS), and collapses all punctuation/separators (commas, hyphens,
  // slashes, parentheses, dots...) to single spaces — so location suffixes,
  // store numbers and branch identifiers stay as separate, droppable
  // tokens instead of corrupting the merchant name itself. Runs once per
  // description (not per pattern), keeping the whole pipeline cheap even
  // for thousands of imported rows.
  function _normalizeText(s) {
    if (!s) return '';
    return s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .toUpperCase()
      .replace(/['’´`]/g, '')                            // McDonald's -> MCDONALDS
      .replace(/[.,\/#!$%\^\*;:{}=\-_`~()"]/g, ' ')       // punctuation -> space (keep & for H&M)
      .replace(/\s+/g, ' ')
      .trim();
  }

  const AUTO_CATEGORY_RULES = [
    { category: 'Alimentación', patterns: [
        'MERCADONA','CARREFOUR','LIDL','DIA SUPERMERCADO','SUPERMERCADOS DIA','ALCAMPO','EROSKI','CONSUM','ALDI','HIPERCOR','SUPERCOR',
        'BONPREU','CAPRABO','CONDIS','SPAR','COVIRAN','MASYMAS','FROIZ','GADIS','SUPERSOL','AHORRAMAS','ECI SUPERMERCADO',
        'SUPERMERCADO','SUPERMERCAT','SUPERMARKET','HIPERMERCADO','ALIMENTACION','ALIMENTACIO','FRUTERIA','FRUITERIA','VERDULERIA',
        'CHARCUTERIA','XARCUTERIA','CARNICERIA','CARNISSERIA','PANADERIA','FLECA','FORN DE PA','PESCADERIA','PEIXATERIA',
      ] },
    { category: 'Restaurantes', patterns: [
        'MCDONALD','MC DONALD','BURGER KING','KFC','SUBWAY','GOIKO','TELEPIZZA','DOMINOS','GLOVO','UBER EATS','UBEREATS','JUST EAT','JUSTEAT','STARBUCKS',
        'RESTAURANTE','RESTAURANT','CAFETERIA','CAFE ','CERVECERIA','CERVESERIA','PIZZERIA','HAMBURGUESERIA','BAR ','TAPAS','MENU DEL DIA','MENU DIARI','DELIVERY',
      ] },
    { category: 'Tabaco', patterns: [
        'ESTANCO','ESTANC ','ESTANC24','TABACS','TABAC ','TABACOS','TABACALERA','EXPENDEDURIA',
      ] },
    { category: 'Transporte', patterns: [
        'UBER','CABIFY','BOLT ','RENFE','RODALIES','METRO DE','BLABLACAR','IBERIA','VUELING','RYANAIR','AUTOPISTA','PEAJE','TAXI','FREE NOW','FREENOW','TMB',
        'REPSOL','CEPSA','GASOLINERA','GASOLINERES','ESTACION DE SERVICIO','SHELL','GALP','BP ','AUTOBUS','AUTOBUS URBANO','PARKING','APARCAMIENTO','APARCAMENT',
      ] },
    { category: 'Suscripciones', patterns: [
        'NETFLIX','SPOTIFY','HBO','HBO MAX','MAX.COM','DISNEY PLUS','DISNEY+','PRIME VIDEO','YOUTUBE PREMIUM','ICLOUD','APPLE.COM/BILL','APPLE SERVICES','PLAYSTATION PLUS','XBOX GAME PASS','AMAZON PRIME',
      ] },
    { category: 'Tecnología', patterns: [
        'APPLE STORE','MEDIAMARKT','PCCOMPONENTES','FNAC','WORTEN','MICROSOFT STORE',
      ] },
    { category: 'Salud', patterns: [
        'FARMACIA','FARMACIA ','CLINICA','HOSPITAL','DENTISTA','FISIOTERAPIA','FISIOTERAPEUTA','OPTICA','OPTICA ',
      ] },
    { category: 'Seguros', patterns: [
        'MAPFRE','MUTUA MADRILE','AXA SEGUROS','ALLIANZ','LINEA DIRECTA','DIRECT SEGUROS',
      ] },
    { category: 'Vivienda', patterns: [
        'IBERDROLA','ENDESA','NATURGY','ELECTRICIDAD','ELECTRICITAT','CANAL DE ISABEL','AGUAS DE','AIGUES DE','COMUNIDAD DE PROPIETARIOS','COMUNITAT DE PROPIETARIS',
      ] },
    { category: 'Ropa', patterns: [
        'ZARA ','H&M','MANGO','PULL AND BEAR','PULL&BEAR','BERSHKA','STRADIVARIUS','NIKE','ADIDAS','DECATHLON','PRIMARK',
      ] },
    { category: 'Educación', patterns: [
        'UNIVERSIDAD','UNIVERSITAT','ACADEMIA','COURSERA','UDEMY','LIBRERIA','LLIBRERIA',
      ] },
  ];

  // Keyword dictionary for INCOME categories — a completely separate list
  // from AUTO_CATEGORY_RULES above, since income and expense categories
  // are different lists with different meanings ("Alquiler" as an
  // expense means rent PAID; as income it means rent RECEIVED). This
  // was the single biggest gap in automatic categorization: without it,
  // every payroll/interest/freelance-invoice transaction — a large
  // share of most real bank statements — was always left uncategorized.
  const AUTO_INCOME_CATEGORY_RULES = [
    { category: 'Salario', patterns: [
        'NOMINA','SALARIO','SUELDO','PAGA MENSUAL','PAYROLL','TRANSFERENCIA NOMINA','ABONO NOMINA','HABERES',
      ] },
    { category: 'Freelance', patterns: [
        'FACTURA EMITIDA','HONORARIOS','FREELANCE','AUTONOMO ','SERVICIOS PROFESIONALES','TRANSFERENCIA FACTURA',
      ] },
    { category: 'Alquiler', patterns: [
        'ALQUILER RECIBIDO','RENTA ALQUILER','INGRESO ALQUILER','PAGO ALQUILER RECIBIDO',
      ] },
    { category: 'Dividendos', patterns: [
        'DIVIDENDO','INTERES ','INTERESES','RENDIMIENTO','CUPON ','LIQUIDACION INTERESES','ABONO INTERESES',
      ] },
    { category: 'Venta', patterns: [
        'VENTA ','WALLAPOP','VINTED','MILANUNCIOS','SEGUNDA MANO','EBAY',
      ] },
    { category: 'Bono', patterns: [
        'BONUS','PAGA EXTRA','INCENTIVO','PRIMA PRODUCTIVIDAD',
      ] },
  ];

  function _escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Compiles a raw dictionary pattern into a fast matcher function.
  // Patterns ending in a trailing space in the SOURCE array (e.g. 'BAR ',
  // 'BP ') mean "must end here as a whole word" — compiled to a
  // word-boundary regex so short, collision-prone tokens like "BAR"
  // never accidentally match inside "BARCELONA" (a real false positive
  // this exact convention is designed to prevent — plain substring
  // matching alone would silently lose the trailing-space intent once
  // the pattern itself gets trimmed during normalization). Patterns
  // without a trailing space keep the more permissive substring
  // behavior, which is needed e.g. for 'MCDONALD' to also match the
  // "MCDONALDS" variant left after apostrophe normalization.
  function _compilePattern(raw) {
    const needsRightBoundary = /\s$/.test(raw);
    const normalized = _normalizeText(raw);
    const re = needsRightBoundary ? new RegExp('\\b' + _escapeRegex(normalized) + '\\b') : null;
    return {
      normalized,
      test: (d) => needsRightBoundary ? re.test(d) : d.includes(normalized),
    };
  }

  // Every pattern is compiled once here (not per-transaction) so the
  // hot path for hundreds/thousands of imported rows only normalizes the
  // transaction description itself, never re-normalizes the dictionary.
  const _AUTO_CATEGORY_RULES_NORM = AUTO_CATEGORY_RULES.map(rule => ({
    category: rule.category,
    patterns: rule.patterns.map(_compilePattern),
  }));
  const _AUTO_INCOME_CATEGORY_RULES_NORM = AUTO_INCOME_CATEGORY_RULES.map(rule => ({
    category: rule.category,
    patterns: rule.patterns.map(_compilePattern),
  }));

  // ════════════════════════════════════════════════════════════════
  // ── SMART MERCHANT GROUPING ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // Known brand/service name patterns collapse ANY matching description
  // to one canonical merchant key, regardless of store numbers, branch
  // cities, card-network suffixes ("UBER *TRIP"), or — for P2P/generic
  // bank services like Bizum — the variable recipient/sender name
  // attached to each transaction. Longer/more specific patterns win over
  // shorter ones (checked by matched-pattern length, not list order), so
  // e.g. "UBER EATS" is never swallowed by the bare "UBER" rule.
  const KNOWN_MERCHANTS = [
    // Groceries / supermarkets
    { canonical: 'MERCADONA', patterns: ['MERCADONA'] },
    { canonical: 'CARREFOUR', patterns: ['CARREFOUR'] },
    { canonical: 'LIDL', patterns: ['LIDL'] },
    { canonical: 'DIA', patterns: ['DIA SUPERMERCADO', 'SUPERMERCADOS DIA'] },
    { canonical: 'ALCAMPO', patterns: ['ALCAMPO'] },
    { canonical: 'EROSKI', patterns: ['EROSKI'] },
    { canonical: 'CONSUM', patterns: ['CONSUM'] },
    { canonical: 'ALDI', patterns: ['ALDI'] },
    { canonical: 'BONPREU', patterns: ['BONPREU', 'SUPERMERCAT BONPREU'] },
    { canonical: 'CAPRABO', patterns: ['CAPRABO'] },
    { canonical: 'EL CORTE INGLES', patterns: ['EL CORTE INGLES', 'CORTE INGLES'] },
    // Ride-hailing / transport (UBER EATS checked before bare UBER)
    { canonical: 'UBER EATS', patterns: ['UBER EATS', 'UBEREATS'] },
    { canonical: 'UBER', patterns: ['UBER'] },
    { canonical: 'CABIFY', patterns: ['CABIFY'] },
    { canonical: 'RENFE', patterns: ['RENFE'] },
    // Food delivery / restaurants
    { canonical: 'GLOVO', patterns: ['GLOVO'] },
    { canonical: 'JUST EAT', patterns: ['JUST EAT', 'JUSTEAT'] },
    { canonical: 'MCDONALDS', patterns: ['MCDONALD', 'MC DONALD'] },
    { canonical: 'STARBUCKS', patterns: ['STARBUCKS'] },
    // Tobacco
    { canonical: 'ESTANCO', patterns: ['ESTANCO', 'ESTANC', 'EXPENDEDURIA'] },
    // Streaming / subscriptions / tech
    { canonical: 'NETFLIX', patterns: ['NETFLIX'] },
    { canonical: 'SPOTIFY', patterns: ['SPOTIFY'] },
    { canonical: 'AMAZON PRIME', patterns: ['AMAZON PRIME'] },
    { canonical: 'AMAZON', patterns: ['AMAZON'] },
    { canonical: 'APPLE', patterns: ['APPLE.COM', 'APPLE STORE'] },
    // Clothing
    { canonical: 'ZARA', patterns: ['ZARA '] },
    { canonical: 'H&M', patterns: ['H&M'] },
    // P2P transfers / generic bank services — the whole point is to
    // collapse away the variable name that follows (a person, a company).
    { canonical: 'BIZUM', patterns: ['BIZUM'] },
    { canonical: 'TRANSFERENCIA', patterns: ['TRANSFERENCIA'] },
    { canonical: 'TRASPASO', patterns: ['TRASPASO'] },
    { canonical: 'RECIBO', patterns: ['RECIBO DOMICILIADO', 'RECIBO'] },
    { canonical: 'NOMINA', patterns: ['NOMINA'] },
  ];

  // Same one-time normalization as the category dictionary above.
  const _KNOWN_MERCHANTS_NORM = KNOWN_MERCHANTS.map(rule => ({
    canonical: rule.canonical,
    patterns: rule.patterns.map(_compilePattern),
  }));

  function _matchKnownMerchant(normalizedDescription) {
    let best = null; // { canonical, len }
    for (const rule of _KNOWN_MERCHANTS_NORM) {
      for (const p of rule.patterns) {
        if (p.test(normalizedDescription) && (!best || p.normalized.length > best.len)) {
          best = { canonical: rule.canonical, len: p.normalized.length };
        }
      }
    }
    return best ? best.canonical : null;
  }

  // ════════════════════════════════════════════════════════════════
  // ── LIGHTWEIGHT FUZZY MATCHING (last resort, high-signal only) ──
  // ════════════════════════════════════════════════════════════════
  // Classic Levenshtein edit distance with an early-exit once the running
  // minimum in the current row already exceeds the allowed budget — cheap
  // enough to run against a short list of ~30 canonical merchant names
  // without noticeably slowing down an import of hundreds of rows. Only
  // ever called on the first couple of significant tokens of an already-
  // normalized, unmatched description (see _fuzzyMatchMerchant), never on
  // full sentences, keeping the string lengths — and therefore the cost —
  // small regardless of how long the original transaction description is.
  function _levenshtein(a, b, maxDist) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > maxDist) return maxDist + 1;
    let prev = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
      const cur = new Array(bl + 1);
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > maxDist) return maxDist + 1; // early exit — no way to recover
      prev = cur;
    }
    return prev[bl];
  }

  // Compares each significant (length > 2) token of a normalized,
  // already-unmatched description against every known canonical merchant
  // name, tolerating small typos/variants ("MCDONALS", "BONPREY") without
  // accepting wildly different words just because they're short. The edit
  // budget scales with word length so short words need a near-exact hit
  // (avoiding false positives like "BAR" fuzzy-matching "CAR"-ish brands)
  // while longer names tolerate a couple of character slips.
  function _fuzzyMatchMerchant(normalizedDescription) {
    const tokens = normalizedDescription.split(' ').filter(w => w.length > 2 && !MERCHANT_STOPWORDS.has(w));
    let best = null; // { canonical, dist, wordLen }
    for (const rule of _KNOWN_MERCHANTS_NORM) {
      // Fuzzy only makes sense against single-word-ish canonical names —
      // multi-word canonicals (e.g. "EL CORTE INGLES") are already well
      // covered by the substring check above and rarely typo'd token-by-token.
      const canonicalWords = rule.canonical.split(' ');
      if (canonicalWords.length > 1) continue;
      const cw = canonicalWords[0];
      const budget = cw.length <= 5 ? 1 : (cw.length <= 9 ? 2 : 3);
      for (const tok of tokens) {
        if (Math.abs(tok.length - cw.length) > budget) continue;
        const dist = _levenshtein(tok, cw, budget);
        if (dist <= budget && (!best || dist < best.dist)) {
          best = { canonical: rule.canonical, dist, wordLen: cw.length };
        }
      }
    }
    if (!best) return null;
    // A distance of 0 would already have been caught by the exact substring
    // match, so anything reaching here is a genuine (small) variation —
    // 'medium' confidence: good enough to suggest, not enough to feel 100%.
    return { merchant: best.canonical, confidence: 'medium' };
  }

  // Legal-entity suffixes and short Spanish/Catalan stopwords that
  // shouldn't lead (or occupy a slot in) the fallback grouping key for
  // unrecognized merchants, nor be treated as fuzzy-matchable tokens.
  const MERCHANT_STOPWORDS = new Set([
    'EL','LA','LOS','LAS','DE','DEL','Y','SL','SA','SLU','SAU','SCP','CB',
    // Catalan articles/prepositions + common location-suffix words that
    // otherwise leak into the fallback key ("MCDONALD S BARCELONA" ->
    // dropping "BARCELONA" so the key stays anchored on the merchant).
    'EL','LA','ELS','LES','DE','DEL','I','BCN','BARCELONA','MADRID','VALENCIA',
  ]);

  function _fallbackMerchantKey(description) {
    let s = _normalizeText(description);
    s = s.replace(/\d{3,}/g, '');           // strip long number sequences (refs, card numbers, store codes)
    s = s.replace(/\b\d{1,2}\s\d{1,2}(\s\d{2,4})?\b/g, ''); // strip dates (already space-normalized by _normalizeText)
    s = s.replace(/[^A-Z&\s]/g, ' ');       // strip anything non-letter (keep & for brands like H&M)
    s = s.replace(/\s+/g, ' ').trim();
    const words = s.split(' ').filter(w => w.length > 1 && !MERCHANT_STOPWORDS.has(w));
    // Up to 3 significant words — long enough to keep multi-word chain
    // names intact (e.g. "CORTE INGLES") without pulling in every trailing
    // branch/location word for shorter ones.
    return (words.slice(0, 3).join(' ') || s || 'DESCONOCIDO').trim();
  }

  // Produces a clean, canonical merchant grouping key from a raw
  // transaction description — WITHOUT touching the original description
  // itself, which callers keep separately (row.description stays intact;
  // only row.merchantKey is derived from it). Known brands/services
  // collapse every variant to one key (exact match, then fuzzy as a
  // last resort for small typos); unrecognized merchants fall back to a
  // normalized-but-heuristic key.
  function merchantKeyFor(description) {
    const d = _normalizeText(description);
    const known = _matchKnownMerchant(d);
    if (known) return known;
    const fuzzy = _fuzzyMatchMerchant(d);
    if (fuzzy) return fuzzy.merchant;
    return _fallbackMerchantKey(description);
  }

  // Known merchant -> implicit category, for cases where the merchant
  // itself was identified (exact or fuzzy) but no literal category
  // keyword appears in the description text. Deliberately conservative:
  // only merchants unambiguously tied to one category are listed here
  // (AMAZON, APPLE, BIZUM, TRANSFERENCIA... are left out on purpose —
  // too generic to safely imply a category).
  const MERCHANT_TO_CATEGORY = {
    'MERCADONA': 'Alimentación', 'CARREFOUR': 'Alimentación', 'LIDL': 'Alimentación', 'DIA': 'Alimentación',
    'ALCAMPO': 'Alimentación', 'EROSKI': 'Alimentación', 'CONSUM': 'Alimentación', 'ALDI': 'Alimentación',
    'BONPREU': 'Alimentación', 'CAPRABO': 'Alimentación', 'EL CORTE INGLES': 'Alimentación',
    'UBER EATS': 'Restaurantes', 'GLOVO': 'Restaurantes', 'JUST EAT': 'Restaurantes', 'MCDONALDS': 'Restaurantes', 'STARBUCKS': 'Restaurantes',
    'ESTANCO': 'Tabaco',
    'UBER': 'Transporte', 'CABIFY': 'Transporte', 'RENFE': 'Transporte', 'BOLT': 'Transporte',
    'NETFLIX': 'Suscripciones', 'SPOTIFY': 'Suscripciones', 'AMAZON PRIME': 'Suscripciones',
    'ZARA': 'Ropa', 'H&M': 'Ropa',
  };

  // Returns { category, confidence } — confidence is 'high' for an exact
  // normalized keyword hit, or null if nothing matched. Keyword matches
  // are inherently reliable (a real word like "supermercado" appearing
  // anywhere in the description is a strong signal), so they're always
  // 'high' here; genuinely uncertain cases (merchant only identified via
  // fuzzy matching) come back as 'medium'. kind ('gasto'|'ingreso')
  // selects which keyword dictionary to use — income and expense
  // categories are different lists with different meanings, so they can
  // never share one set of rules (see AUTO_INCOME_CATEGORY_RULES).
  function _autoDetectCategory(description, merchantKey, kind) {
    const d = _normalizeText(description);
    const isIngreso = kind === 'ingreso';
    const rules = isIngreso ? _AUTO_INCOME_CATEGORY_RULES_NORM : _AUTO_CATEGORY_RULES_NORM;
    for (const rule of rules) {
      if (rule.patterns.some(p => p.test(d))) return { category: rule.category, confidence: 'high' };
    }
    // Merchant->category fallback only applies to expenses today (no
    // brand-name merchant reliably implies one specific income category).
    if (isIngreso) return null;
    // Fall back to a known-merchant -> category mapping — covers cases
    // where the merchant was identified (possibly only via fuzzy
    // matching) but the description has no literal category keyword.
    const key = merchantKey || merchantKeyFor(description);
    if (MERCHANT_TO_CATEGORY[key]) {
      const exactMerchant = _matchKnownMerchant(d);
      return { category: MERCHANT_TO_CATEGORY[key], confidence: exactMerchant === key ? 'high' : 'medium' };
    }
    return null;
  }

  function prettyMerchant(key) {
    return key.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }

  // ════════════════════════════════════════════════════════════════
  // ── PERSISTENT MERCHANT → CATEGORY MAPPING ────────────────────
  // ════════════════════════════════════════════════════════════════
  const MAP_KEY = 'mn_merchant_category_map';
  const MAP_KEY_INGRESO = 'mn_merchant_category_map_ingreso';
  function _mapKeyFor(kind) { return kind === 'ingreso' ? MAP_KEY_INGRESO : MAP_KEY; }
  function _loadMap(kind) {
    try { return JSON.parse(localStorage.getItem(_mapKeyFor(kind)) || '{}'); } catch { return {}; }
  }
  function _saveMap(map, kind) {
    try { localStorage.setItem(_mapKeyFor(kind), JSON.stringify(map)); } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════
  // ── HELPERS INTO THE REAL APP ──────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // IMPORTANT: app.js declares `let S = ...` at script scope (not `window.S`),
  // so in a normal session `window.S` is undefined — it's only ever set by
  // data-manager.js during backup-restore. Using window.S here meant
  // _cuentas() always silently returned [] (via its try/catch) and
  // _runImport()'s "S.cuentas.push(...)" threw against undefined, so
  // imported transactions could never actually be associated with a real
  // account. Classic <script> tags share the same top-level scope, so the
  // bare `S` identifier correctly resolves to app.js's live state object.
  function _S() { return (typeof S !== 'undefined' && S) ? S : window.S; }
  function _gastoCats() {
    try { return (_S().categorias && _S().categorias.gasto) || ['Otros']; } catch { return ['Otros']; }
  }
  function _ingresoCats() {
    try { return (_S().categorias && _S().categorias.ingreso) || ['Otro']; } catch { return ['Otro']; }
  }
  function _cuentas() { try { return _S().cuentas || []; } catch { return []; } }
  function _catEmoji(c) { return (window.catEmoji ? window.catEmoji(c) : '📌'); }
  function _uid() { return window.uid ? window.uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); }

  // ════════════════════════════════════════════════════════════════
  // ── DUPLICATE PREVENTION (fingerprint-based, per-account) ──────
  // ════════════════════════════════════════════════════════════════
  // A stable fingerprint built from data that survives re-parsing the same
  // file (date + amount + type + normalized merchant) — deliberately NOT
  // the raw description, which can vary slightly between re-reads/re-
  // mappings (whitespace, casing) and would make an exact-string duplicate
  // check unreliable.
  function _fingerprintFor(row) {
    const iso = (row.date instanceof Date && !isNaN(row.date)) ? row.date.toISOString().slice(0, 10) : '';
    const amt = (Number(row.amount) || 0).toFixed(2);
    const type = row.isExpense ? 'E' : 'I';
    const merchant = (row.merchantKey || merchantKeyFor(row.description || '') || '').toUpperCase();
    return `${iso}|${amt}|${type}|${merchant}`;
  }

  // Same fingerprint shape, but derived from an already-saved gasto/ingreso
  // record — used as a fallback for records imported before this field
  // existed, so duplicate detection still works against older data.
  function _fingerprintForRecord(rec, isExpense) {
    const amt = (Number(rec.importe) || 0).toFixed(2);
    const type = isExpense ? 'E' : 'I';
    const merchant = (rec.merchant || merchantKeyFor(rec.concepto || '') || '').toUpperCase();
    return `${rec.fecha}|${amt}|${type}|${merchant}`;
  }

  // Splits `rows` into { clean, duplicates } by checking each row's
  // fingerprint against the transactions ALREADY PRESENT IN THE TARGET
  // ACCOUNT ONLY (cuentaId) — never across other accounts, so a
  // coincidentally-identical transaction in a different account is never
  // mistaken for a duplicate.
  function _computeDuplicates(rows, cuentaId) {
    const existingFingerprints = new Set();
    if (cuentaId) {
      const S = _S();
      (S.gastos || []).filter(e => e.cuentaId === cuentaId).forEach(e => {
        existingFingerprints.add(e._importFingerprint || _fingerprintForRecord(e, true));
      });
      (S.ingresos || []).filter(e => e.cuentaId === cuentaId).forEach(e => {
        existingFingerprints.add(e._importFingerprint || _fingerprintForRecord(e, false));
      });
    }
    const duplicates = [];
    const clean = rows.filter(r => {
      if (!existingFingerprints.size) return true;
      if (existingFingerprints.has(_fingerprintFor(r))) { duplicates.push(r); return false; }
      return true;
    });
    return { clean, duplicates };
  }
  function _fmtDate(d) {
    try {
      if (!(d instanceof Date) || isNaN(d)) return _t('bi_fecha_no_valida', 'Fecha no válida');
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return _t('bi_fecha_no_valida', 'Fecha no válida'); }
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
      /* Scoped to THIS wizard's overlay only (by id) — the shared
         .modal-overlay class (z-index:200) used by other modals across
         the app is untouched. Found by testing specifically with an
         iPhone Safari user agent: the "Add to Home Screen" iOS banner
         (js/install-prompt.js, z-index:9500) sat above the wizard and
         intercepted every tap, since 200 << 9500. */
      #mnBankImportOverlay { z-index: 9600; }
      #mnBankImportOverlay .modal { max-width: 620px; width: 94vw; max-height: 88vh; max-height: 88dvh; padding:0; overflow:hidden; }
      .mnbi-wrap { display:flex; flex-direction:column; max-height:88vh; max-height:88dvh; }
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
      .mnbi-file-remove {
        background:none; border:none; color:var(--text3); font-size:1.1rem; cursor:pointer;
        padding:6px 8px; border-radius:8px; flex-shrink:0; line-height:1;
      }
      .mnbi-file-remove:hover { background:rgba(244,63,94,.12); color:var(--red); }

      /* Bank detection */
      .mnbi-bank-card { display:flex; align-items:center; gap:14px; padding:18px 20px; border-radius:16px; background:var(--accent-dim); border:1.5px solid rgba(0,212,170,.3); margin-bottom:20px; }
      .mnbi-bank-emoji { font-size:2rem; }
      .mnbi-bank-name { font-size:1.05rem; font-weight:800; color:var(--text); }
      .mnbi-bank-sub { font-size:.75rem; color:var(--text2); }
      .mnbi-bank-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
      @media(max-width:480px){ .mnbi-bank-grid{grid-template-columns:repeat(2,1fr)} }
      .mnbi-bank-opt { position:relative; padding:14px 10px; border-radius:12px; border:1.5px solid var(--border); background:var(--bg2); text-align:center; cursor:pointer; transition:all .15s; }
      .mnbi-bank-opt:hover { border-color:var(--border2); }
      .mnbi-bank-opt.selected { border-color:var(--accent); background:var(--accent-dim); }
      .mnbi-bank-opt-emoji { font-size:1.5rem; margin-bottom:4px; }
      .mnbi-bank-opt-name { font-size:.76rem; font-weight:700; color:var(--text); }
      .mnbi-bank-suggested-badge {
        position:absolute; top:-8px; right:-6px; background:linear-gradient(90deg,var(--accent),#6366F1);
        color:#04231b; font-size:.58rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em;
        padding:2px 6px; border-radius:99px; box-shadow:0 2px 8px rgba(0,0,0,.35);
      }

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
      .mnbi-table-wrap--scroll { max-height:320px; overflow-y:auto; }
      .mnbi-table { width:100%; border-collapse:collapse; font-size:.8rem; }
      .mnbi-table thead th { padding:9px 12px; font-size:.66rem; color:var(--text3); text-transform:uppercase; letter-spacing:.05em; text-align:left; background:var(--bg2); font-weight:700; position:sticky; top:0; z-index:1; }
      .mnbi-table tbody td { padding:9px 12px; border-top:1px solid var(--border); color:var(--text2); }
      .mnbi-table tbody tr:hover { background:var(--bg2); }
      .mnbi-table .mnbi-desc { max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text); font-weight:600; }
      .mnbi-more-row { text-align:center; padding:10px; font-size:.74rem; color:var(--text3); background:var(--bg2); }
      .mnbi-amount-toggle {
        background:none; border:1px solid transparent; font-weight:700; font-size:.8rem; font-family:inherit;
        padding:4px 8px; border-radius:8px; cursor:pointer; transition:all .15s;
      }
      .mnbi-amount-toggle:hover { border-color:currentColor; background:var(--bg3, rgba(255,255,255,.05)); }

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
      .mnbi-group-section-label { font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; margin:14px 0 8px; padding-left:2px; }
      .mnbi-group-section-label:first-child { margin-top:0; }
      .mnbi-group-section-label--warn { color:var(--gold, #F5A623); }
      .mnbi-group-section-label--ok { color:var(--accent); }
      .mnbi-reco-section { margin-bottom:16px; }
      .mnbi-reco-card { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-radius:12px; background:rgba(245,166,35,.08); border:1px solid rgba(245,166,35,.35); margin-bottom:8px; flex-wrap:wrap; }
      .mnbi-reco-title { font-weight:800; font-size:.88rem; }
      .mnbi-reco-sub { font-size:.72rem; color:var(--text3); margin-top:2px; }
      .mnbi-reco-actions { display:flex; gap:6px; flex-shrink:0; }
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
      .mnbi-cat-tabs { display:flex; gap:6px; margin-bottom:14px; background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:4px; }
      .mnbi-cat-tab { flex:1; background:none; border:none; padding:8px 6px; border-radius:9px; font-size:.76rem; font-weight:700; color:var(--text2); cursor:pointer; font-family:inherit; transition:all .15s; }
      .mnbi-cat-tab.active { background:var(--accent); color:#04231b; }
      .mnbi-type-tabs { display:flex; gap:8px; margin:14px 0; }
      .mnbi-type-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:var(--bg2); border:1.5px solid var(--border); padding:11px 10px; border-radius:12px; font-size:.85rem; font-weight:800; color:var(--text2); cursor:pointer; font-family:inherit; transition:all .15s; }
      .mnbi-type-tab-count { font-size:.7rem; font-weight:700; padding:1px 7px; border-radius:99px; background:var(--bg3,rgba(255,255,255,.08)); color:var(--text3); }
      .mnbi-type-tab--gasto.active { background:rgba(239,68,68,.12); border-color:var(--red); color:var(--red); }
      .mnbi-type-tab--gasto.active .mnbi-type-tab-count { background:var(--red); color:#fff; }
      .mnbi-type-tab--ingreso.active { background:rgba(16,185,129,.12); border-color:var(--green); color:var(--green); }
      .mnbi-type-tab--ingreso.active .mnbi-type-tab-count { background:var(--green); color:#04231b; }
      .mnbi-bulk-bar { display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:12px; background:var(--accent-dim); border:1px solid rgba(0,212,170,.35); margin-bottom:10px; font-size:.78rem; font-weight:700; color:var(--text); }

      /* Summary */
      .mnbi-summary-list { display:flex; flex-direction:column; gap:0; border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:18px; }
      .mnbi-summary-row { display:flex; justify-content:space-between; align-items:center; padding:13px 16px; border-bottom:1px solid var(--border); font-size:.85rem; }
      .mnbi-summary-row:last-child { border-bottom:none; }
      .mnbi-summary-row span:first-child { color:var(--text2); }
      .mnbi-summary-row span:last-child { color:var(--text); font-weight:700; }
      .mnbi-ready-errors-row { display:flex; gap:10px; margin-bottom:14px; }
      .mnbi-status-pill { flex:1; padding:10px 12px; border-radius:12px; font-size:.78rem; font-weight:700; display:flex; align-items:center; gap:8px; }
      .mnbi-status-pill.ready { background:var(--accent-dim); border:1px solid rgba(0,212,170,.35); color:var(--accent); }
      .mnbi-status-pill.errors { background:rgba(244,63,94,.12); border:1px solid rgba(244,63,94,.35); color:var(--red); }
      .mnbi-quick-links { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
      .mnbi-quick-link { background:var(--bg2); border:1px solid var(--border); color:var(--text2); font-size:.72rem; font-weight:700; padding:6px 10px; border-radius:99px; cursor:pointer; font-family:inherit; }
      .mnbi-quick-link:hover { border-color:var(--accent); color:var(--accent); }
      .mnbi-review-list { display:flex; flex-direction:column; gap:8px; max-height:360px; overflow-y:auto; margin-bottom:14px; padding-right:2px; }
      .mnbi-review-card { border:1px solid var(--border); border-radius:12px; padding:12px; background:var(--bg2); }
      .mnbi-review-card.error { border-color:rgba(244,63,94,.5); background:rgba(244,63,94,.06); }
      .mnbi-txrow-card { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; border:1px solid var(--border); border-radius:12px; padding:12px; background:var(--bg2); }
      .mnbi-indiv-card { border:1px solid var(--border); border-radius:12px; padding:12px; background:var(--bg2); }
      .mnbi-indiv-top { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
      .mnbi-indiv-top input[type=checkbox] { width:18px; height:18px; flex-shrink:0; margin-top:2px; cursor:pointer; accent-color:var(--accent); }
      .mnbi-select-all-row { display:flex; align-items:center; gap:8px; padding:4px 2px 10px; font-size:.76rem; color:var(--text2); font-weight:600; }
      .mnbi-select-all-row input { width:16px; height:16px; cursor:pointer; accent-color:var(--accent); }
      .mnbi-select-all-row label { cursor:pointer; }
      .mnbi-mapping-preview-card { border:1px solid var(--border); border-radius:10px; padding:9px 12px; background:var(--bg2); }
      .mnbi-mapping-preview-field { display:flex; justify-content:space-between; gap:10px; font-size:.76rem; padding:3px 0; }
      .mnbi-mapping-preview-field span:first-child { color:var(--text3); flex-shrink:0; }
      .mnbi-mapping-preview-field span:last-child { color:var(--text); font-weight:600; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mnbi-review-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px; }
      .mnbi-review-date { font-size:.7rem; color:var(--text3); font-weight:700; text-transform:uppercase; letter-spacing:.03em; }
      .mnbi-review-desc { font-size:.84rem; font-weight:700; color:var(--text); margin-bottom:2px; word-break:break-word; }
      .mnbi-review-merchant { font-size:.72rem; color:var(--text3); margin-bottom:8px; }
      .mnbi-review-row2 { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .mnbi-review-row2 select { flex:1; min-width:110px; }
      .mnbi-review-error-badge { font-size:.68rem; color:var(--red); font-weight:700; margin-top:6px; }

      /* Footer nav */
      .mnbi-footer { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:18px 26px calc(18px + env(safe-area-inset-bottom, 0px)); border-top:1px solid var(--border); flex-shrink:0; }
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
      .mnbi-success-info { text-align:left; border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:16px; }
      .mnbi-success-info-row { display:flex; justify-content:space-between; align-items:center; padding:11px 14px; border-bottom:1px solid var(--border); font-size:.82rem; }
      .mnbi-success-info-row:last-child { border-bottom:none; }
      .mnbi-success-info-row span:first-child { color:var(--text2); }
      .mnbi-success-info-row span:last-child { color:var(--text); font-weight:700; text-align:right; max-width:60%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mnbi-skip-notice { text-align:left; font-size:.78rem; padding:10px 12px; border-radius:12px; margin-bottom:10px; }
      .mnbi-skip-notice.dup { background:rgba(240,180,40,.1); border:1px solid rgba(240,180,40,.3); color:var(--gold); }
      .mnbi-skip-notice.err { background:rgba(244,63,94,.1); border:1px solid rgba(244,63,94,.3); color:var(--red); }
      .mnbi-skip-details { margin-top:8px; max-height:160px; overflow-y:auto; }
      .mnbi-skip-item { display:flex; justify-content:space-between; gap:8px; padding:6px 0; font-size:.72rem; color:var(--text2); border-top:1px solid rgba(255,255,255,.08); }
      .mnbi-skip-item span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mnbi-skip-item span:last-child { flex-shrink:0; opacity:.8; }
      .mnbi-skip-toggle { background:none; border:none; color:inherit; font-size:.72rem; font-weight:700; text-decoration:underline; cursor:pointer; padding:0; font-family:inherit; }

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
    if (typeof window._pushScrollLock === 'function') window._pushScrollLock(); else document.body.style.overflow = 'hidden';
  }

  function closeWizard() {
    const ov = _overlay();
    if (!ov) return;
    ov.classList.remove('open');
    setTimeout(() => { ov.innerHTML = ''; }, 200);
    if (typeof window._popScrollLock === 'function') window._popScrollLock(); else document.body.style.overflow = '';
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
    if (ST.step === 'mapping')  return _renderColumnMapping();
    if (ST.step === 1) return _renderStep1();
    if (ST.step === 2) return _renderStep2();
    if (ST.step === 3) return _renderStep3();
    if (ST.step === 4) return _renderStep4();
    if (ST.step === 5) return _renderStep5();
  }

  function _goBack() {
    if (ST.step === 'mapping') { ST.step = 1; _renderStep1(); return; }
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
      <div class="mnbi-sub">${_t('bi_s1_sub', 'Exporta el movimiento de tu banco en formato CSV o Excel (XLSX) y arrástralo aquí.')}</div>

      ${hasFile ? '' : `
      <div class="mnbi-dropzone" id="mnbiDropzone" onclick="document.getElementById('mnbiFileInput').click()">
        <div class="mnbi-dropzone-icon">📄</div>
        <div class="mnbi-dropzone-title">${_t('bi_s1_drop', 'Arrastra tu CSV o XLSX aquí')}</div>
        <div class="mnbi-dropzone-sub">${_t('bi_s1_o_click', 'o haz clic para seleccionar un archivo')}</div>
      </div>`}
      <input type="file" id="mnbiFileInput" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" style="display:none">

      ${hasFile ? `
      <div class="mnbi-file-card">
        <div class="mnbi-file-icon">📄</div>
        <div style="flex:1;min-width:0">
          <div class="mnbi-file-name">${ST.fileName}</div>
          <div class="mnbi-file-meta">${_fmtFileSize(ST.fileSize)} · ${ST.rows.length} ${_t('bi_transacciones_encontradas', 'transacciones encontradas')}</div>
        </div>
        <span style="color:var(--accent);font-size:1.3rem">✓</span>
        <button type="button" class="mnbi-file-remove" title="${_t('bi_cambiar_archivo', 'Cambiar archivo')}" onclick="MNBankImport._clearFile()">✕</button>
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
    if (input) input.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) _readFile(f);
      // Reset value so selecting the SAME file again still fires 'change'
      // (needed after an error, or to re-pick the same file on iOS/Android).
      e.target.value = '';
    });
  }

  function _clearFile() {
    ST.fileName = '';
    ST.fileSize = 0;
    ST.csvText  = '';
    ST.headers  = [];
    ST.rawRows  = [];
    ST.rows     = [];
    ST.format   = 'generic';
    ST.bankConfidence = 'none';
    ST.suggestedBank  = null;
    ST.columnMapping  = null;
    ST.columnMappingAmbiguous = false;
    ST._mappingMode = null;
    _renderStep1();
  }

  function _fmtFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _isCSVFile(file) {
    return /\.csv$/i.test(file.name) || file.type === 'text/csv';
  }
  function _isXLSXFile(file) {
    return /\.xlsx?$/i.test(file.name) ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';
  }

  // Convert a SheetJS worksheet into the same {headers, rows} shape parseCSV()
  // produces, so both formats can flow through the exact same downstream code.
  function parseXLSX(arrayBuffer) {
    if (!window.XLSX) throw new Error('XLSX library not loaded');
    const wb = window.XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { headers: [], rows: [] };
    const sheet = wb.Sheets[sheetName];
    const aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    const nonEmpty = aoa.filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));
    if (nonEmpty.length < 2) return { headers: [], rows: [] };
    const headers = nonEmpty[0].map(h => String(h || '').trim());

    // SheetJS will happily "parse" arbitrary binary garbage (it guesses at
    // legacy formats) instead of throwing — guard against that by rejecting
    // headers that contain control characters or are unreasonably long,
    // which is a strong signal the "file" isn't really a spreadsheet.
    const looksCorrupt = headers.some(h => /[\x00-\x08\x0E-\x1F]/.test(h) || h.length > 300);
    if (looksCorrupt) throw new Error('XLSX content looks corrupted or unreadable');

    const rows = nonEmpty.slice(1).map(vals => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] != null ? String(vals[i]).trim() : ''; });
      return obj;
    });
    return { headers, rows };
  }

  // Best-effort text decoding: try strict UTF-8 first (handles the vast
  // majority of modern exports); if the bytes aren't valid UTF-8, fall back
  // to Windows-1252 (superset of ISO-8859-1), which is what many older
  // Spanish/European bank export tools still use. Prevents "Ã±", "Â·" style
  // mojibake from corrupting descriptions/categories on import.
  function _decodeBestEffort(arrayBuffer) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
    } catch (_) {
      try { return new TextDecoder('windows-1252').decode(arrayBuffer); }
      catch (_e2) { return new TextDecoder('utf-8').decode(arrayBuffer); } // last resort, lossy
    }
  }

  function _processParsedFile(file, headers, rawRows) {
    if (!rawRows.length) {
      if (window.toast) toast(_t('bi_err_vacio', 'El archivo está vacío o no tiene filas válidas'), 'error');
      return;
    }
    const format = detectBankFormat(headers);
    const detection = detectBankWithConfidence(headers, rawRows, file.name);
    // Known bank layouts already have a fixed, tested column mapping
    // hardcoded per-format in normalizeRow — column detection only
    // matters for files we couldn't match to a known bank layout.
    const colMap = format === 'generic' ? detectColumns(headers) : null;
    const normalized = rawRows.map(r => {
      try { const n = normalizeRow(r, format, colMap); n.merchantKey = merchantKeyFor(n.description); return n; }
      catch { return null; }
    }).filter(Boolean);

    if (!normalized.length) {
      if (window.toast) toast(_t('bi_err_columnas', 'No se han podido reconocer las columnas del archivo'), 'error');
      return;
    }

    ST.fileName = file.name;
    ST.fileSize = file.size;
    ST.headers  = headers;
    ST.rawRows  = rawRows;
    ST.rows     = normalized;
    ST.format   = format; // unchanged contract: only header-based detection drives parsing
    ST.bankConfidence = detection.confidence;
    ST.suggestedBank  = (detection.confidence === 'low' || detection.confidence === 'medium') ? detection.format : null;
    ST.columnMapping  = colMap;
    ST.columnMappingAmbiguous = !!(colMap && colMap.ambiguous);
    _renderStep1();
  }

  function _readFile(file) {
    if (!file) return;

    if (_isCSVFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        let csvText;
        try { csvText = _decodeBestEffort(e.target.result); }
        catch { if (window.toast) toast(_t('bi_err_lectura', 'No se pudo leer el archivo'), 'error'); return; }
        ST.csvText = csvText;
        let parsed;
        try { parsed = parseCSV(csvText); }
        catch { if (window.toast) toast(_t('bi_err_lectura', 'No se pudo leer el archivo'), 'error'); return; }
        _processParsedFile(file, parsed.headers, parsed.rows);
      };
      reader.onerror = () => {
        if (window.toast) toast(_t('bi_err_lectura', 'No se pudo leer el archivo. Inténtalo de nuevo.'), 'error');
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    if (_isXLSXFile(file)) {
      if (!window.XLSX) {
        if (window.toast) toast(_t('bi_err_xlsx_no_disponible', 'No se pudo cargar el soporte para Excel. Prueba con un CSV.'), 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        let parsed;
        try { parsed = parseXLSX(e.target.result); }
        catch { if (window.toast) toast(_t('bi_err_xlsx_invalido', 'No se pudo leer el archivo Excel. ¿Está dañado?'), 'error'); return; }
        ST.csvText = '';
        _processParsedFile(file, parsed.headers, parsed.rows);
      };
      reader.onerror = () => {
        if (window.toast) toast(_t('bi_err_lectura', 'No se pudo leer el archivo. Inténtalo de nuevo.'), 'error');
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    if (window.toast) toast(_t('bi_err_formato', 'Solo se admiten archivos .csv, .xlsx o .xls'), 'error');
  }

  // ════════════════════════════════════════════════════════════════
  // ── COLUMN MAPPING (shown only when detection is ambiguous) ────
  // ════════════════════════════════════════════════════════════════
  const MAPPING_FIELDS = [
    { key: 'date',        label: 'Fecha',      required: true  },
    { key: 'description', label: 'Concepto',   required: true  },
    { key: 'balance',     label: 'Saldo',      required: false },
    { key: 'reference',   label: 'Referencia', required: false },
  ];

  function _mappingIsValid() {
    const m = ST.columnMapping || {};
    const hasDate = !!(m.date && m.date.key);
    const hasDesc = !!(m.description && m.description.key);
    const hasAmount = ST._mappingMode === 'split'
      ? !!((m.debit && m.debit.key) || (m.credit && m.credit.key))
      : !!(m.amount && m.amount.key);
    return hasDate && hasDesc && hasAmount;
  }

  function _fieldSelect(field, label, required) {
    const m = ST.columnMapping || {};
    const current = m[field] && m[field].key ? m[field].key : '';
    const options = ST.headers.map(h => `<option value="${h}" ${h === current ? 'selected' : ''}>${h}</option>`).join('');
    return `
      <div style="margin-bottom:12px">
        <label style="font-size:.78rem;color:var(--text2);font-weight:600">${label}${required ? '' : ` (${_t('bi_opcional', 'opcional')})`}</label>
        <select class="mnbi-select" onchange="MNBankImport._setMappingField('${field}', this.value)">
          <option value="">${_t('bi_selecciona_columna', '— Selecciona una columna —')}</option>
          ${options}
        </select>
      </div>`;
  }

  function _renderColumnMapping() {
    if (!ST._mappingMode) {
      const m = ST.columnMapping || {};
      ST._mappingMode = (!m.amount && (m.debit || m.credit)) ? 'split' : 'amount';
    }
    const m = ST.columnMapping || {};

    const amountSection = ST._mappingMode === 'split'
      ? _fieldSelect('debit', _t('bi_col_debe', 'Debe / Gasto'), true) + _fieldSelect('credit', _t('bi_col_haber', 'Haber / Ingreso'), true)
      : _fieldSelect('amount', _t('bi_col_importe', 'Importe'), true);

    const previewRows = (ST.rawRows || []).slice(0, 4);
    const previewCols = [
      { field: 'date', label: 'Fecha' },
      { field: 'description', label: 'Concepto' },
      ...(ST._mappingMode === 'split' ? [{ field: 'debit', label: 'Debe' }, { field: 'credit', label: 'Haber' }] : [{ field: 'amount', label: 'Importe' }]),
    ];
    // Compact label:value cards instead of a horizontal table — a 3-4
    // column table never fits reliably inside this modal's width, mobile
    // or desktop.
    const previewHtml = previewRows.length ? `
      <div class="mnbi-sub" style="margin-top:18px;margin-bottom:8px;font-weight:700;color:var(--text)">${_t('bi_preview_archivo', 'Así se ven tus datos')}</div>
      <div class="mnbi-review-list" style="max-height:220px">
        ${previewRows.map(r => `
          <div class="mnbi-mapping-preview-card">
            ${previewCols.map(c => {
              const key = m[c.field] && m[c.field].key;
              const val = key ? (r[key] ?? '') : '—';
              return `<div class="mnbi-mapping-preview-field"><span>${c.label}</span><span>${val || '—'}</span></div>`;
            }).join('')}
          </div>`).join('')}
      </div>` : '';

    const body = `
      <div class="mnbi-h1">${_t('bi_mapping_titulo', 'Columnas del archivo')}</div>
      <div class="mnbi-sub">${_t('bi_mapping_sub', 'No hemos podido identificar todas las columnas con seguridad. Indícanos qué es cada una:')}</div>

      <div class="mnbi-radio-row" style="margin-bottom:16px">
        <div class="mnbi-radio-card ${ST._mappingMode === 'amount' ? 'selected' : ''}" onclick="MNBankImport._setMappingMode('amount')">
          <div class="mnbi-radio-dot"><div class="mnbi-radio-dot-inner"></div></div>
          <div>
            <div class="mnbi-radio-label">${_t('bi_mapping_una_columna', 'Una sola columna de importe')}</div>
            <div class="mnbi-radio-sub">${_t('bi_mapping_una_columna_sub', 'Importe / Amount (positivo = ingreso, negativo = gasto)')}</div>
          </div>
        </div>
        <div class="mnbi-radio-card ${ST._mappingMode === 'split' ? 'selected' : ''}" onclick="MNBankImport._setMappingMode('split')">
          <div class="mnbi-radio-dot"><div class="mnbi-radio-dot-inner"></div></div>
          <div>
            <div class="mnbi-radio-label">${_t('bi_mapping_dos_columnas', 'Columnas separadas')}</div>
            <div class="mnbi-radio-sub">${_t('bi_mapping_dos_columnas_sub', 'Debe/Haber, Cargo/Abono, Gasto/Ingreso...')}</div>
          </div>
        </div>
      </div>

      ${_fieldSelect('date', _t('bi_col_fecha', 'Fecha'), true)}
      ${_fieldSelect('description', _t('bi_col_concepto', 'Concepto / Descripción'), true)}
      ${amountSection}
      ${_fieldSelect('balance', _t('bi_col_saldo', 'Saldo'), false)}
      ${_fieldSelect('reference', _t('bi_col_referencia', 'Referencia'), false)}

      ${previewHtml}
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._back()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" ${_mappingIsValid() ? '' : 'disabled'} onclick="MNBankImport._confirmColumnMapping()">
        ${_t('bi_continuar', 'Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer, { showSteps: false });
  }

  function _setMappingMode(mode) {
    ST._mappingMode = mode;
    _renderColumnMapping();
  }

  function _setMappingField(field, key) {
    if (!ST.columnMapping) ST.columnMapping = {};
    ST.columnMapping[field] = key ? { key, confidence: 'manual' } : null;
    _renderColumnMapping();
  }

  function _confirmColumnMapping() {
    if (!_mappingIsValid()) return;
    // Clear whichever amount fields don't apply to the chosen mode, so
    // normalizeRow's generic branch doesn't accidentally use stale values.
    if (ST._mappingMode === 'amount') {
      ST.columnMapping.debit = null;
      ST.columnMapping.credit = null;
    } else {
      ST.columnMapping.amount = null;
    }
    const map = ST.columnMapping;
    ST.rows = (ST.rawRows || []).map(r => {
      try { const n = normalizeRow(r, 'generic', map); n.merchantKey = merchantKeyFor(n.description); return n; }
      catch { return null; }
    }).filter(Boolean);
    ST.columnMappingAmbiguous = false;
    const target = ST._returnStepAfterMapping || 2;
    ST._returnStepAfterMapping = 2; // reset for next time
    if (target === 5) {
      // ST._cleanRows normally only gets (re)computed by Step 3; since we're
      // skipping straight back to Step 5, refresh it first so it doesn't
      // keep pointing at row objects discarded by the re-mapping above.
      _renderStep3();
      ST.step = 5; _renderStep5();
    } else {
      ST.step = 2; _renderStep2();
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 2 — BANK + ACCOUNT ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _accountSelectionValid() {
    if (ST.accountMode === 'new') return !!(ST.newAccountName || '').trim();
    if (ST.accountMode === 'existing') return !!ST.accountId && _cuentas().some(c => c.id === ST.accountId);
    return false;
  }

  // Kept in sync on every keystroke/change so the Continue button can be
  // enabled/disabled live WITHOUT a full re-render (which would drop input
  // focus/cursor position while the user is still typing the account name).
  function _syncStep2Validity() {
    const btn = document.getElementById('mnbiStep2ContinueBtn');
    if (btn) btn.disabled = !_accountSelectionValid();
  }
  function _onNewAccountNameInput(value) {
    ST.newAccountName = value;
    _syncStep2Validity();
  }
  function _onNewAccountTipoChange(value) {
    ST.newAccountTipo = value;
  }
  function _onExistingAccountChange(value) {
    ST.accountId = value;
    _syncStep2Validity();
  }

  function _renderStep2() {
    const hasChosenBank = ST.format !== 'generic';
    const bank = BANKS[ST.format] || BANKS.generic;
    if (!ST.newAccountName) ST.newAccountName = hasChosenBank ? bank.label : '';
    const autoDetected = hasChosenBank && ST.bankConfidence === 'high';

    const cuentas = _cuentas();
    const suggested = ST.suggestedBank ? BANKS[ST.suggestedBank] : null;
    const bankPicker = !hasChosenBank ? `
      <div class="mnbi-bank-card" style="background:var(--bg2);border-color:var(--border)">
        <div class="mnbi-bank-emoji">❓</div>
        <div>
          <div class="mnbi-bank-name">${_t('bi_banco_no_identificado', 'Banco no identificado')}</div>
          <div class="mnbi-bank-sub">${suggested
            ? _t('bi_s2_elige_banco_sugerido', `No estamos seguros, pero podría ser ${suggested.label}. Confírmalo o elige otro:`)
            : _t('bi_s2_elige_banco', 'No hemos podido detectar el banco automáticamente. Elige uno:')}</div>
        </div>
      </div>
      <div class="mnbi-bank-grid" style="margin-top:14px">
        ${Object.entries(BANKS).filter(([k]) => k !== 'generic').map(([key, b]) => `
          <div class="mnbi-bank-opt ${ST.format === key ? 'selected' : ''}" onclick="MNBankImport._pickBank('${key}')">
            ${ST.suggestedBank === key ? `<div class="mnbi-bank-suggested-badge">${_t('bi_sugerido', 'Sugerido')}</div>` : ''}
            <div class="mnbi-bank-opt-emoji">${b.emoji}</div>
            <div class="mnbi-bank-opt-name">${b.label}</div>
          </div>`).join('')}
      </div>` : `
      <div class="mnbi-bank-card">
        <div class="mnbi-bank-emoji">${bank.emoji}</div>
        <div>
          <div class="mnbi-bank-name">${autoDetected ? _t('bi_banco_detectado', 'Banco detectado') : _t('bi_banco_seleccionado', 'Banco seleccionado')}: ${bank.label}</div>
          <div class="mnbi-bank-sub">${_t('bi_banco_no_es', '¿No es correcto?')} <a href="#" onclick="event.preventDefault();MNBankImport._forceManualBank()" style="color:var(--accent)">${_t('bi_cambiar', 'Cambiar')}</a></div>
        </div>
      </div>`;

    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 2 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s2_titulo', '¿Dónde quieres importar estos movimientos?')}</div>
      ${bankPicker}

      <div class="mnbi-sub" style="margin-top:22px;margin-bottom:10px;font-weight:700;color:var(--text)">
        ${hasChosenBank
          ? _t('bi_pregunta_cuenta_banco', `¿Quieres crear una cuenta para ${bank.label} o utilizar una existente?`)
          : _t('bi_pregunta_cuenta_generica', '¿Quieres crear una cuenta nueva o utilizar una existente?')}
      </div>
      <div class="mnbi-radio-row">
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
        <label style="font-size:.78rem;color:var(--text2);font-weight:600">${_t('bi_nombre_cuenta', 'Nombre de la cuenta')} *</label>
        <input type="text" class="mnbi-input" id="mnbiNewAccountName" value="${ST.newAccountName}"
          placeholder="${_t('bi_nombre_cuenta_placeholder', 'p.ej. BBVA Cuenta Nómina')}"
          oninput="MNBankImport._onNewAccountNameInput(this.value)">

        <div style="display:flex;gap:10px;margin-top:12px">
          <div style="flex:1">
            <label style="font-size:.78rem;color:var(--text2);font-weight:600">${_t('bi_tipo_cuenta', 'Tipo de cuenta')}</label>
            <select class="mnbi-select" id="mnbiNewAccountTipo" onchange="MNBankImport._onNewAccountTipoChange(this.value)">
              <option value="banco" ${ST.newAccountTipo === 'banco' ? 'selected' : ''}>🏦 ${_t('bi_tipo_banco', 'Banco')}</option>
              <option value="ahorro" ${ST.newAccountTipo === 'ahorro' ? 'selected' : ''}>💰 ${_t('bi_tipo_ahorro', 'Ahorro')}</option>
              <option value="efectivo" ${ST.newAccountTipo === 'efectivo' ? 'selected' : ''}>💵 ${_t('bi_tipo_efectivo', 'Efectivo')}</option>
              <option value="cripto" ${ST.newAccountTipo === 'cripto' ? 'selected' : ''}>₿ ${_t('bi_tipo_cripto', 'Cripto')}</option>
              <option value="inversion" ${ST.newAccountTipo === 'inversion' ? 'selected' : ''}>📈 ${_t('bi_tipo_inversion', 'Inversión')}</option>
              <option value="otro" ${ST.newAccountTipo === 'otro' ? 'selected' : ''}>📁 ${_t('bi_tipo_otro', 'Otro')}</option>
            </select>
          </div>
          <div style="flex:1">
            <label style="font-size:.78rem;color:var(--text2);font-weight:600">${_t('bi_moneda', 'Moneda')}</label>
            <input type="text" class="mnbi-input" value="EUR (€)" disabled style="opacity:.6;cursor:not-allowed">
          </div>
        </div>
        <div class="mnbi-sub" style="margin-top:6px;font-size:.72rem">
          ${_t('bi_moneda_nota', 'MoneyNest gestiona todas las cuentas en euros.')}
          ${hasChosenBank ? ` · ${_t('bi_banco_asociado', 'Banco')}: <strong style="color:var(--text)">${bank.label}</strong>` : ''}
        </div>
      ` : `
        <label style="font-size:.78rem;color:var(--text2);font-weight:600">${_t('bi_selecciona_cuenta', 'Selecciona la cuenta')} *</label>
        <select class="mnbi-select" id="mnbiExistingAccount" onchange="MNBankImport._onExistingAccountChange(this.value)">
          ${cuentas.map(c => `<option value="${c.id}" ${ST.accountId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
        </select>
      `}
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._back()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" id="mnbiStep2ContinueBtn" ${_accountSelectionValid() ? '' : 'disabled'} onclick="MNBankImport._toStep3()">
        ${_t('bi_continuar', 'Continuar')}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    _shell(body, footer);
  }

  function _pickBank(key) {
    ST.format = key;
    ST.newAccountName = BANKS[key].label;
    // A manual pick is not the same as an auto-detection; keep 'high'
    // only if the header-based detector already agreed with this bank.
    const alreadyKnownByHeaders = detectBankFormat(ST.headers) === key;
    ST.bankConfidence = alreadyKnownByHeaders ? 'high' : 'manual';
    // Bank learning: only worth remembering when the user is resolving a
    // structure the detector didn't already recognize on its own.
    if (!alreadyKnownByHeaders) _learnBankFingerprint(ST.headers, key);
    _renderStep2();
  }
  function _forceManualBank() {
    ST.format = 'generic'; // NOT '__none__': that sentinel matched no BANKS
                            // key nor the 'generic' check used everywhere
                            // else, so "Cambiar" was showing a bogus
                            // "Banco detectado: Genérico" card instead of
                            // the manual picker.
    ST.bankConfidence = 'none';
    _renderStep2();
  }
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
    // Duplicate detection against existing data in the TARGET account only
    // (a brand-new account is trivially empty, so this only matters when
    // importing into an existing one).
    const targetCuentaId = ST.accountMode === 'existing' ? ST.accountId : null;
    const { clean, duplicates } = _computeDuplicates(ST.rows, targetCuentaId);
    ST.duplicates = duplicates;
    ST._cleanRows = clean;

    const incomeRows = clean.filter(r => !r.isExpense);
    const expenseRows = clean.filter(r => r.isExpense);
    const totalIncome = incomeRows.reduce((a, r) => a + r.amount, 0);
    const totalExpense = expenseRows.reduce((a, r) => a + r.amount, 0);

    // Show every movement (not just a handful) in a scrollable list so the
    // user can find and correct any misclassified transaction, not just
    // the first few — the whole point of allowing manual correction.
    // Uses stacked cards (not a multi-column table) so nothing gets
    // clipped: this modal never exceeds ~620px wide even on desktop, and
    // a fixed 3-column table doesn't fit that reliably at any width.
    const previewRows = clean.map(r => {
      const idx = ST.rows.indexOf(r);
      return `
      <div class="mnbi-txrow-card">
        <div style="min-width:0">
          <div class="mnbi-review-date">${_fmtDate(r.date)}</div>
          <div class="mnbi-review-desc">${r.description}${r._manuallyEdited ? ` <span title="${_t('bi_corregido_manual', 'Corregido manualmente')}" style="color:var(--accent)">✎</span>` : ''}</div>
        </div>
        <button type="button" class="mnbi-amount-toggle" style="color:${r.isExpense ? 'var(--red)' : 'var(--green)'};flex-shrink:0"
          title="${_t('bi_toca_para_corregir', 'Toca para cambiar entre ingreso y gasto')}"
          onclick="MNBankImport._toggleRowType(${idx})">
          ${r.isExpense ? '−' : '+'}${r.amount.toFixed(2)}€
        </button>
      </div>`;
    }).join('');

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

      <div class="mnbi-sub" style="margin-bottom:8px">💡 ${_t('bi_s3_hint_corregir', '¿Algo mal clasificado? Toca el importe del movimiento para cambiar entre ingreso y gasto.')}</div>

      <div class="mnbi-review-list" id="mnbiTxTableWrap">${previewRows}</div>
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

    const prevScroll = document.getElementById('mnbiTxTableWrap')?.scrollTop || 0;
    _shell(body, footer);
    const wrap = document.getElementById('mnbiTxTableWrap');
    if (wrap) wrap.scrollTop = prevScroll;
  }

  // Flips a single transaction between expense and income. `rowIndex`
  // refers to ST.rows (the full normalized set, pre-duplicate-filtering),
  // so the correction survives re-renders and feeds into every later step.
  function _toggleRowType(rowIndex) {
    const r = ST.rows[rowIndex];
    if (!r) return;
    r.isExpense = !r.isExpense;
    r._manuallyEdited = true;
    _renderStep3();
  }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 4 — CATEGORIZE ────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  function _buildGroupsFor(kind) {
    const isGasto = kind !== 'ingreso';
    const map = _loadMap(kind);
    const realCats = isGasto ? _gastoCats() : _ingresoCats();
    const prevGroups = isGasto ? ST.groups : ST.groupsIngreso;
    const prevByKey = {};
    (prevGroups || []).forEach(g => { prevByKey[g.key] = g; });

    const byKey = {};
    (ST._cleanRows || ST.rows).filter(r => isGasto ? r.isExpense : !r.isExpense).forEach(r => {
      const k = r.merchantKey;
      if (!byKey[k]) byKey[k] = { key: k, sample: r.description, count: 0, total: 0 };
      byKey[k].count++;
      byKey[k].total += r.amount;
    });
    return Object.values(byKey)
      .sort((a, b) => b.count - a.count)
      .map(g => {
        // Preserve a choice already made earlier in this same session first.
        if (prevByKey[g.key] && prevByKey[g.key].category) {
          return { ...g, category: prevByKey[g.key].category, isMapped: prevByKey[g.key].isMapped, isAuto: prevByKey[g.key].isAuto };
        }
        // Then a category the user has taught before (remembered mapping,
        // keyed by the already-normalized merchantKey, SEPARATELY per
        // gasto/ingreso — so a merchant that can be either, like
        // "TRANSFERENCIA", never mixes a learned expense category into an
        // income row or vice versa).
        if (map[g.key]) return { ...g, category: map[g.key], isMapped: true, isAuto: false };
        // Then automatic detection (keyword or known-merchant match),
        // using the dictionary that matches this group's type (expense
        // keywords for gasto, income keywords for ingreso — see
        // AUTO_INCOME_CATEGORY_RULES). Only applied if that exact
        // category still exists in the user's real category list, so a
        // customized category set is never contradicted.
        const guess = _autoDetectCategory(g.sample, g.key, kind)
        if (guess && realCats.includes(guess.category)) {
          return { ...g, category: guess.category, isMapped: false, isAuto: true, confidence: guess.confidence };
        }
        // The dictionary found a plausible category but the user doesn't
        // have it yet — don't force it onto their real category list;
        // instead surface it as a "recommended category" suggestion (see
        // _buildRecommendedCategories) so the user can approve it
        // explicitly before it's created.
        if (guess && guess.confidence === 'high') {
          return { ...g, category: '', isMapped: false, isAuto: false, suggestedNewCategory: guess.category };
        }
        return { ...g, category: '', isMapped: false, isAuto: false };
      });
  }

  // ════════════════════════════════════════════════════════════════
  // ── RECOMMENDED CATEGORIES ─────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // Aggregates every group's suggestedNewCategory (set above, when the
  // dictionary is confident about a category the user hasn't created
  // yet) into one recommendation per category name, so e.g. Spotify +
  // Netflix + Disney+ all missing "Suscripciones" become a SINGLE
  // recommendation covering all of them — never auto-created, always
  // requires explicit user approval (see _acceptRecommendedCategory).
  function _buildRecommendedCategories(groups, kind) {
    const byCategory = {};
    groups.forEach(g => {
      if (!g.suggestedNewCategory) return
      const cat = g.suggestedNewCategory
      if (!byCategory[cat]) byCategory[cat] = { category: cat, kind, count: 0, examples: [], keys: [] }
      byCategory[cat].count += g.count
      byCategory[cat].keys.push(g.key)
      if (byCategory[cat].examples.length < 3) byCategory[cat].examples.push(prettyMerchant(g.key))
    })
    return Object.values(byCategory)
  }

  // Creates the recommended category (if the user doesn't already have
  // it — a duplicate could exist if they added it manually mid-review)
  // and immediately applies it to every group that suggested it, exactly
  // as if the user had picked it for each one individually. Also saves
  // the merchant->category mapping so future imports recognize the same
  // merchants without needing the recommendation again.
  function _acceptRecommendedCategory(category, kind) {
    const cats = _S().categorias[kind] || (_S().categorias[kind] = [])
    if (!cats.includes(category)) cats.push(category)
    const groups = kind === 'ingreso' ? ST.groupsIngreso : ST.groups
    const map = _loadMap(kind)
    groups.forEach(g => {
      if (g.suggestedNewCategory === category) {
        g.category = category
        g.isAuto = true
        map[g.key] = category
      }
    })
    _saveMap(map, kind)
    if (typeof window.save === 'function') window.save()
    if (kind === 'ingreso') ST.recommendedIngreso = (ST.recommendedIngreso || []).filter(r => r.category !== category)
    else ST.recommendedGasto = (ST.recommendedGasto || []).filter(r => r.category !== category)
    _renderStep4()
  }

  function _dismissRecommendedCategory(category) {
    ST._dismissedRecommendations = ST._dismissedRecommendations || {}
    ST._dismissedRecommendations[category] = true
    ST.recommendedGasto = (ST.recommendedGasto || []).filter(r => r.category !== category)
    ST.recommendedIngreso = (ST.recommendedIngreso || []).filter(r => r.category !== category)
    _renderStep4()
  }

  function _recommendedCategoriesHtml(recommendations) {
    if (!recommendations || !recommendations.length) return ''
    return `
      <div class="mnbi-reco-section">
        <div class="mnbi-group-section-label" style="color:var(--gold,#F5A623)">✨ ${_t('bi_categorias_recomendadas', 'Categorías recomendadas')}</div>
        ${recommendations.map(r => `
          <div class="mnbi-reco-card">
            <div class="mnbi-reco-main">
              <div class="mnbi-reco-title">${_catEmoji(r.category)} ${r.category}</div>
              <div class="mnbi-reco-sub">${r.count} ${r.count === 1 ? _t('bi_movimiento', 'movimiento') : _t('bi_movimientos', 'movimientos')} · ${r.examples.join(', ')}</div>
            </div>
            <div class="mnbi-reco-actions">
              <button type="button" class="btn btn-ghost btn-sm" onclick="MNBankImport._dismissRecommendedCategory('${r.category.replace(/'/g,"\\'")}')">${_t('bi_ignorar', 'Ignorar')}</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="MNBankImport._acceptRecommendedCategory('${r.category.replace(/'/g,"\\'")}','${r.kind}')">✓ ${_t('bi_crear_categoria', 'Crear categoría')}</button>
            </div>
          </div>`).join('')}
      </div>`
  }

  function _buildGroups() {
    ST.groups = _buildGroupsFor('gasto');
    ST.groupsIngreso = _buildGroupsFor('ingreso');
    const dismissed = ST._dismissedRecommendations || {};
    ST.recommendedGasto = _buildRecommendedCategories(ST.groups, 'gasto').filter(r => !dismissed[r.category]);
    ST.recommendedIngreso = _buildRecommendedCategories(ST.groupsIngreso, 'ingreso').filter(r => !dismissed[r.category]);
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

    // Categorize now — grouped merchant list (default) or individual view
    if (!ST.groups.length && !ST.groupsIngreso.length) _buildGroups();

    const allRows = ST._cleanRows || ST.rows;
    const expenseRowCount = allRows.filter(r => r.isExpense).length;
    const incomeRowCount  = allRows.filter(r => !r.isExpense).length;
    const tab = ST.categorizeTab === 'ingreso' ? 'ingreso' : 'gasto';
    const isGasto = tab === 'gasto';
    const activeGroups = isGasto ? ST.groups : ST.groupsIngreso;
    const activeRecommendations = isGasto ? ST.recommendedGasto : ST.recommendedIngreso;
    const activeRowCount = isGasto ? expenseRowCount : incomeRowCount;

    // ── Nivel superior: GASTOS / INGRESOS — la distincion mas importante,
    // visualmente separada de las pestañas "Por comercio"/"Individual" de
    // abajo, que operan DENTRO del tipo seleccionado aqui.
    const typeTabs = `
      <div class="mnbi-type-tabs">
        <button type="button" class="mnbi-type-tab mnbi-type-tab--gasto ${isGasto ? 'active' : ''}" onclick="MNBankImport._setCategorizeTab('gasto')">
          💳 ${_t('bi_tab_gastos', 'Gastos')} <span class="mnbi-type-tab-count">${expenseRowCount}</span>
        </button>
        <button type="button" class="mnbi-type-tab mnbi-type-tab--ingreso ${!isGasto ? 'active' : ''}" onclick="MNBankImport._setCategorizeTab('ingreso')">
          💰 ${_t('bi_tab_ingresos', 'Ingresos')} <span class="mnbi-type-tab-count">${incomeRowCount}</span>
        </button>
      </div>`;

    if (activeRowCount === 0) {
      const body = `
        <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 4 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
        <div class="mnbi-h1">${_t('bi_s4b_titulo', 'Asigna una categoría a cada comercio')}</div>
        ${typeTabs}
        <div class="mnbi-empty">${isGasto ? _t('bi_sin_gastos_archivo', 'Este archivo no tiene gastos que categorizar.') : _t('bi_sin_ingresos_archivo', 'Este archivo no tiene ingresos que categorizar.')}</div>
        <div class="mnbi-remember-row">
          <input type="checkbox" id="mnbiRememberMappings" ${ST.rememberMappings ? 'checked' : ''} onchange="MNBankImport._setRemember(this.checked)">
          <label for="mnbiRememberMappings">${_t('bi_recordar_mapeos', 'Recordar estas categorías para futuras importaciones')}</label>
        </div>`;
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
      return;
    }

    const view = ST.categorizeView || 'groups';
    const tabs = `
      <div class="mnbi-cat-tabs">
        <button type="button" class="mnbi-cat-tab ${view === 'groups' ? 'active' : ''}" onclick="MNBankImport._setCategorizeView('groups')">🏪 ${_t('bi_vista_comercio', 'Por comercio')}</button>
        <button type="button" class="mnbi-cat-tab ${view === 'individual' ? 'active' : ''}" onclick="MNBankImport._setCategorizeView('individual')">📋 ${_t('bi_vista_individual', 'Movimiento a movimiento')}</button>
      </div>`;

    const body = view === 'individual' ? `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 4 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s4b_titulo', 'Asigna una categoría a cada comercio')}</div>
      <div class="mnbi-sub">${_t('bi_s4_individual_sub', 'Marca varios movimientos y aplica una categoría a todos a la vez, o cambia uno solo.')}</div>
      ${typeTabs}
      ${tabs}
      ${_recommendedCategoriesHtml(activeRecommendations)}
      ${_individualViewHtml(tab)}
      <div class="mnbi-remember-row">
        <input type="checkbox" id="mnbiRememberMappings" ${ST.rememberMappings ? 'checked' : ''} onchange="MNBankImport._setRemember(this.checked)">
        <label for="mnbiRememberMappings">${_t('bi_recordar_mapeos', 'Recordar estas categorías para futuras importaciones')}</label>
      </div>
    ` : `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 4 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s4b_titulo', 'Asigna una categoría a cada comercio')}</div>
      <div class="mnbi-sub">${activeGroups.length} ${_t('bi_comercios_detectados', 'comercios detectados')} · ${_t('bi_s4b_sub', 'se aplicará a todos los movimientos de ese grupo')}</div>
      ${typeTabs}
      ${tabs}
      ${_recommendedCategoriesHtml(activeRecommendations)}
      <input type="text" class="mnbi-input mnbi-group-search" id="mnbiGroupSearch" placeholder="🔍 ${_t('bi_buscar_comercio', 'Buscar comercio...')}" oninput="MNBankImport._filterGroups(this.value)">

      <div class="mnbi-group-list" id="mnbiGroupList">
        ${_groupRowsHtml(activeGroups, tab)}
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
    const prevScroll = document.getElementById('mnbiIndivTableWrap')?.scrollTop || 0;
    _shell(body, footer);
    const wrap = document.getElementById('mnbiIndivTableWrap');
    if (wrap) wrap.scrollTop = prevScroll;
  }

  function _effectiveCategoryFor(r) {
    if (r._categoryOverride) return r._categoryOverride;
    const groups = r.isExpense ? ST.groups : ST.groupsIngreso;
    const g = (groups || []).find(x => x.key === r.merchantKey);
    return (g && g.category) || '';
  }

  function _catOptionsHtml(selected, cats) {
    cats = cats || _gastoCats();
    return `<option value="">${_t('bi_elegir', 'Elegir...')}</option>` +
      cats.map(c => `<option value="${c}" ${selected === c ? 'selected' : ''}>${_catEmoji(c)} ${c}</option>`).join('') +
      `<option value="__new__">➕ ${_t('bi_nueva_categoria', 'Nueva categoría...')}</option>`;
  }

  function _individualViewHtml(kind) {
    kind = kind === 'ingreso' ? 'ingreso' : 'gasto';
    const isGasto = kind === 'gasto';
    const cats = isGasto ? _gastoCats() : _ingresoCats();
    const typeRows = (ST._cleanRows || ST.rows).filter(r => isGasto ? r.isExpense : !r.isExpense);
    const selectedCount = Object.keys(ST._selectedForBulk || {}).length;
    const allSelected = typeRows.length > 0 && typeRows.every(r => ST._selectedForBulk[ST.rows.indexOf(r)]);

    const bulkBar = selectedCount > 0 ? `
      <div class="mnbi-bulk-bar">
        <span>${selectedCount} ${selectedCount === 1 ? _t('bi_seleccionado', 'seleccionado') : _t('bi_seleccionados', 'seleccionados')}</span>
        <select class="mnbi-select" id="mnbiBulkCatSelect" style="flex:1">${_catOptionsHtml('', cats)}</select>
        <button type="button" class="mnbi-btn-primary" style="padding:8px 14px" onclick="MNBankImport._applyBulkCategory()">${_t('bi_aplicar', 'Aplicar')}</button>
      </div>` : '';

    const rows = typeRows.map(r => {
      const idx = ST.rows.indexOf(r);
      const cat = _effectiveCategoryFor(r);
      const checked = !!ST._selectedForBulk[idx];
      return `
        <div class="mnbi-indiv-card">
          <div class="mnbi-indiv-top">
            <input type="checkbox" ${checked ? 'checked' : ''} onchange="MNBankImport._toggleRowSelection(${idx})">
            <div style="min-width:0;flex:1">
              <div class="mnbi-review-desc" title="${r.description}">${r.description}</div>
              <div style="font-size:.7rem;color:var(--text3)">${_fmtEur(r.amount)}</div>
            </div>
          </div>
          <select class="mnbi-group-cat-select ${cat ? 'mapped' : ''}" onchange="MNBankImport._setIndividualRowCategory(${idx}, this.value)">
            ${_catOptionsHtml(cat, cats)}
          </select>
        </div>`;
    }).join('');

    return `
      ${bulkBar}
      <div class="mnbi-select-all-row">
        <input type="checkbox" id="mnbiIndivSelectAll" ${allSelected ? 'checked' : ''} onchange="MNBankImport._toggleSelectAllIndividual(this.checked)">
        <label for="mnbiIndivSelectAll">${_t('bi_seleccionar_todos', 'Seleccionar todos')}</label>
      </div>
      <div class="mnbi-review-list" id="mnbiIndivTableWrap">${rows || `<div class="mnbi-empty">${_t('bi_sin_resultados', 'Sin resultados')}</div>`}</div>`;
  }

  function _setCategorizeTab(tab) {
    ST.categorizeTab = tab === 'ingreso' ? 'ingreso' : 'gasto';
    ST.categorizeView = 'groups';
    ST._selectedForBulk = {};
    _renderStep4();
  }

  function _setCategorizeView(view) {
    ST.categorizeView = view;
    ST._selectedForBulk = {};
    _renderStep4();
  }

  function _toggleRowSelection(idx) {
    if (ST._selectedForBulk[idx]) delete ST._selectedForBulk[idx];
    else ST._selectedForBulk[idx] = true;
    _renderStep4();
  }

  function _toggleSelectAllIndividual(checked) {
    const isGasto = ST.categorizeTab !== 'ingreso';
    const typeRows = (ST._cleanRows || ST.rows).filter(r => isGasto ? r.isExpense : !r.isExpense);
    ST._selectedForBulk = {};
    if (checked) typeRows.forEach(r => { ST._selectedForBulk[ST.rows.indexOf(r)] = true; });
    _renderStep4();
  }

  // Prompts for a new category name and, if provided, adds it to the
  // user's REAL category list (_S().categorias.gasto) — the same
  // mechanism the group view already uses — so "crear categoría" always
  // stays compatible with the app's actual category model.
  function _promptNewCategory(kind) {
    kind = kind === 'ingreso' ? 'ingreso' : 'gasto';
    const name = prompt(_t('bi_nombre_nueva_categoria', 'Nombre de la nueva categoría:'));
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    if (!_S().categorias[kind].includes(trimmed)) {
      _S().categorias[kind].push(trimmed);
      ST.newCategoriesCreated.push(trimmed);
    }
    return trimmed;
  }

  function _setIndividualRowCategory(idx, value) {
    const r = ST.rows[idx];
    if (value === '__new__') {
      const created = _promptNewCategory(r && !r.isExpense ? 'ingreso' : 'gasto');
      if (!created) { _renderStep4(); return; }
      value = created;
    }
    if (r) r._categoryOverride = value;
    _renderStep4();
  }

  function _applyBulkCategory() {
    let value = document.getElementById('mnbiBulkCatSelect')?.value;
    if (!value) return;
    const selectedIdxs = Object.keys(ST._selectedForBulk || {}).map(Number);
    const firstRow = ST.rows[selectedIdxs[0]];
    if (value === '__new__') {
      const created = _promptNewCategory(firstRow && !firstRow.isExpense ? 'ingreso' : 'gasto');
      if (!created) return;
      value = created;
    }
    selectedIdxs.forEach(idx => {
      const r = ST.rows[idx];
      if (r) r._categoryOverride = value;
    });
    ST._selectedForBulk = {};
    _renderStep4();
  }

  function _groupRowsHtml(groups, kind) {
    kind = kind === 'ingreso' ? 'ingreso' : 'gasto';
    const cats = kind === 'ingreso' ? _ingresoCats() : _gastoCats();
    if (!groups.length) return `<div class="mnbi-empty">${_t('bi_sin_resultados', 'Sin resultados')}</div>`;

    const rowHtml = (g) => `
      <div class="mnbi-group-row" data-key="${g.key}">
        <div class="mnbi-group-info">
          <div class="mnbi-group-name" title="${prettyMerchant(g.key)}">${_catEmoji(g.category)} ${prettyMerchant(g.key)}</div>
          <div class="mnbi-group-meta">${g.count} ${g.count === 1 ? _t('bi_movimiento', 'movimiento') : _t('bi_movimientos', 'movimientos')} · ${_fmtEur(g.total)}${g.isMapped ? ` · <span style="color:var(--accent)">✓ ${_t('bi_recordado', 'recordado')}</span>` : (g.isAuto ? ` · <span style="color:var(--gold)">🤖 ${_t('bi_automatico', 'automático')}</span>` : '')}</div>
        </div>
        <select class="mnbi-group-cat-select ${g.category ? 'mapped' : ''}" onchange="MNBankImport._setGroupCategory('${g.key}', this.value, '${kind}')">
          <option value="">${_t('bi_elegir', 'Elegir...')}</option>
          ${cats.map(c => `<option value="${c}" ${g.category === c ? 'selected' : ''}>${_catEmoji(c)} ${c}</option>`).join('')}
          <option value="__new__">➕ ${_t('bi_nueva_categoria', 'Nueva categoría...')}</option>
        </select>
      </div>`;

    // Uncategorized groups need the user's attention — surfaced first,
    // above the ones the engine already handled — so reviewing hundreds
    // of imported transactions is fast: the user only has to look at the
    // (usually short) top section instead of scanning the whole list.
    const uncategorized = groups.filter(g => !g.category);
    const categorized   = groups.filter(g => g.category);

    const uncatSection = uncategorized.length ? `
      <div class="mnbi-group-section-label mnbi-group-section-label--warn">⚠️ ${_t('bi_sin_categorizar', 'Sin categorizar')} (${uncategorized.length})</div>
      ${uncategorized.map(rowHtml).join('')}
    ` : '';
    const catSection = categorized.length ? `
      <div class="mnbi-group-section-label mnbi-group-section-label--ok">✓ ${_t('bi_categorizados', 'Categorizados')} (${categorized.length})</div>
      ${categorized.map(rowHtml).join('')}
    ` : '';

    return uncatSection + catSection;
  }

  function _chooseCategorize(val) {
    ST.categorizeChoice = val;
    if (val) {
      _buildGroups();
      // Land on whichever tab actually has content when the other is empty
      // (e.g. an income-only file), instead of always defaulting to
      // 'gasto' and showing an empty-state message on first view.
      const hasExpense = (ST._cleanRows || ST.rows).some(r => r.isExpense);
      const hasIncome  = (ST._cleanRows || ST.rows).some(r => !r.isExpense);
      if (!hasExpense && hasIncome) ST.categorizeTab = 'ingreso';
      else if (hasExpense) ST.categorizeTab = 'gasto';
    }
    _renderStep4();
  }
  function _backToChoice() { ST.categorizeChoice = null; _renderStep4(); }

  function _filterGroups(q) {
    const kind = ST.categorizeTab === 'ingreso' ? 'ingreso' : 'gasto';
    const groups = kind === 'ingreso' ? ST.groupsIngreso : ST.groups;
    const query = (q || '').toLowerCase();
    const list = document.getElementById('mnbiGroupList');
    if (!list) return;
    const filtered = !query ? groups : groups.filter(g => g.key.toLowerCase().includes(query));
    list.innerHTML = _groupRowsHtml(filtered, kind);
  }

  function _setGroupCategory(key, value, kind) {
    kind = kind === 'ingreso' ? 'ingreso' : 'gasto';
    const groups = kind === 'ingreso' ? ST.groupsIngreso : ST.groups;
    if (value === '__new__') {
      const name = prompt(_t('bi_nombre_nueva_categoria', 'Nombre de la nueva categoría:'));
      if (!name || !name.trim()) { _renderStep4(); return; }
      const trimmed = name.trim();
      if (!_S().categorias[kind].includes(trimmed)) {
        _S().categorias[kind].push(trimmed);
        ST.newCategoriesCreated.push(trimmed);
      }
      value = trimmed;
    }
    const g = groups.find(x => x.key === key);
    if (g) { g.category = value; g.isAuto = false; }
    _filterGroups(document.getElementById('mnbiGroupSearch')?.value || '');
  }

  function _setRemember(val) { ST.rememberMappings = val; }

  // ════════════════════════════════════════════════════════════════
  // ── STEP 5 — SUMMARY ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // A row is considered an error if it has no usable amount or date —
  // these would never have made it into a real transaction anyway, so
  // they're excluded from what actually gets written and reported
  // separately as "con errores" instead of silently disappearing.
  function _isRowError(r) {
    if (!r) return true;
    if (!(r.amount > 0)) return true;
    if (!(r.date instanceof Date) || isNaN(r.date)) return true;
    return false;
  }

  function _renderStep5() {
    ST.step = 5;
    const clean = ST._cleanRows || ST.rows;
    const errorRows = clean.filter(_isRowError);
    const readyRows = clean.filter(r => !_isRowError(r));
    const incomeCount = readyRows.filter(r => !r.isExpense).length;
    const expenseCount = readyRows.filter(r => r.isExpense).length;
    const merchantsCategorized = ST.categorizeChoice ? ST.groups.filter(g => g.category).length : 0;
    const bank = BANKS[ST.format] || BANKS.generic;
    const accountLabel = ST.accountMode === 'new'
      ? (document.getElementById('mnbiNewAccountName')?.value || ST.newAccountName || bank.label)
      : (_cuentas().find(c => c.id === ST.accountId)?.nombre || '—');
    const canImport = readyRows.length > 0;

    const statusRow = `
      <div class="mnbi-ready-errors-row">
        <div class="mnbi-status-pill ready">✅ ${readyRows.length} ${_t('bi_listos_importar', 'movimientos listos para importar')}</div>
        ${errorRows.length ? `<div class="mnbi-status-pill errors">⚠️ ${errorRows.length} ${_t('bi_con_errores', 'con errores')}</div>` : ''}
      </div>`;

    const quickLinks = `
      <div class="mnbi-quick-links">
        ${ST.format === 'generic' ? `<button type="button" class="mnbi-quick-link" onclick="MNBankImport._editColumnsFromReview()">🔧 ${_t('bi_corregir_columnas', 'Corregir columnas')}</button>` : ''}
        <button type="button" class="mnbi-quick-link" onclick="MNBankImport._editAccountFromReview()">🏦 ${_t('bi_cambiar_cuenta', 'Cambiar cuenta')}</button>
      </div>`;

    const reviewCards = clean.map(r => {
      const idx = ST.rows.indexOf(r);
      const err = _isRowError(r);
      const cat = _effectiveCategoryFor(r);
      const catList = r.isExpense ? _gastoCats() : _ingresoCats();
      return `
      <div class="mnbi-review-card ${err ? 'error' : ''}">
        <div class="mnbi-review-top">
          <div style="min-width:0">
            <div class="mnbi-review-date">${_fmtDate(r.date)}</div>
            <div class="mnbi-review-desc">${r.description}</div>
            <div class="mnbi-review-merchant">🏪 ${prettyMerchant(r.merchantKey)}</div>
          </div>
          <button type="button" class="mnbi-amount-toggle" style="color:${r.isExpense ? 'var(--red)' : 'var(--green)'};flex-shrink:0"
            title="${_t('bi_toca_para_corregir', 'Toca para cambiar entre ingreso y gasto')}"
            onclick="MNBankImport._toggleRowTypeStep5(${idx})">
            ${r.isExpense ? '−' : '+'}${r.amount.toFixed(2)}€
          </button>
        </div>
        <div class="mnbi-review-row2">
          <select class="mnbi-group-cat-select ${cat ? 'mapped' : ''}" onchange="MNBankImport._setRowCategoryStep5(${idx}, this.value)">
            ${_catOptionsHtml(cat, catList)}
          </select>
        </div>
        ${err ? `<div class="mnbi-review-error-badge">⚠️ ${_t('bi_error_fila', 'Importe o fecha no válidos — no se importará')}</div>` : ''}
      </div>`;
    }).join('');

    const body = `
      <div class="mnbi-step-label">${_t('bi_paso', 'Paso')} 5 ${_t('bi_de', 'de')} ${TOTAL_STEPS}</div>
      <div class="mnbi-h1">${_t('bi_s5_titulo', 'Revisa antes de importar')}</div>
      <div class="mnbi-sub">${_t('bi_s5_sub', 'Comprueba fecha, comercio, importe, tipo y categoría de cada movimiento.')}</div>

      <div class="mnbi-summary-list">
        <div class="mnbi-summary-row"><span>${_t('bi_ingresos', 'Ingresos')}</span><span style="color:var(--green)">${incomeCount}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_gastos', 'Gastos')}</span><span style="color:var(--red)">${expenseCount}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_comercios_categorizados', 'Comercios categorizados')}</span><span>${merchantsCategorized}${ST.categorizeChoice ? '/' + ST.groups.length : ''}</span></div>
        ${ST.newCategoriesCreated.length ? `<div class="mnbi-summary-row"><span>${_t('bi_categorias_creadas', 'Categorías nuevas creadas')}</span><span>${ST.newCategoriesCreated.length}</span></div>` : ''}
        <div class="mnbi-summary-row"><span>${_t('bi_cuenta', 'Cuenta')}</span><span>${accountLabel}</span></div>
        <div class="mnbi-summary-row"><span>${_t('bi_banco', 'Banco')}</span><span>${bank.emoji} ${bank.label}</span></div>
      </div>

      ${statusRow}
      ${quickLinks}

      <div class="mnbi-sub" style="font-weight:700;color:var(--text);margin-bottom:8px">${_t('bi_revisar_movimientos', 'Revisa cada movimiento')}</div>
      <div class="mnbi-review-list" id="mnbiReviewList">${reviewCards}</div>
    `;

    const footer = `
      <button class="mnbi-btn-back" onclick="MNBankImport._back()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${_t('bi_atras', 'Atrás')}
      </button>
      <button class="mnbi-btn-primary" ${canImport ? '' : 'disabled'} title="${canImport ? '' : _t('bi_nada_que_importar', 'No hay movimientos válidos para importar')}" onclick="MNBankImport._runImport()">
        🚀 ${_t('bi_importar_ahora', 'Importar ahora')}
      </button>`;

    const prevScroll = document.getElementById('mnbiReviewList')?.scrollTop || 0;
    _shell(body, footer);
    const wrap = document.getElementById('mnbiReviewList');
    if (wrap) wrap.scrollTop = prevScroll;
  }

  function _toggleRowTypeStep5(idx) {
    const r = ST.rows[idx];
    if (!r) return;
    r.isExpense = !r.isExpense;
    r._manuallyEdited = true;
    r._categoryOverride = ''; // gasto/ingreso use different category lists — don't carry a stale one over
    _renderStep5();
  }

  function _setRowCategoryStep5(idx, value) {
    const r = ST.rows[idx];
    if (!r) return;
    if (value === '__new__') {
      const created = _promptNewCategory(r.isExpense ? 'gasto' : 'ingreso');
      if (!created) { _renderStep5(); return; }
      value = created;
    }
    r._categoryOverride = value;
    _renderStep5();
  }

  function _editColumnsFromReview() {
    ST._returnStepAfterMapping = 5;
    ST.step = 'mapping';
    _renderColumnMapping();
  }

  function _editAccountFromReview() {
    ST.step = 2;
    _renderStep2();
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
    // Final hard gate: never write transactions without a valid account,
    // regardless of how this got triggered (button, or programmatically).
    const S0 = _S();
    if (ST.accountMode === 'new' && !(ST.newAccountName || '').trim()) {
      if (window.toast) toast(_t('bi_err_sin_nombre_cuenta', 'Ponle un nombre a la cuenta antes de continuar'), 'error');
      ST.step = 2; _renderStep2();
      return;
    }
    if (ST.accountMode === 'existing' && !(ST.accountId && S0.cuentas.some(c => c.id === ST.accountId))) {
      if (window.toast) toast(_t('bi_err_cuenta_invalida', 'Selecciona una cuenta válida antes de continuar'), 'error');
      ST.step = 2; _renderStep2();
      return;
    }
    const readyCount = (ST._cleanRows || ST.rows).filter(r => !_isRowError(r)).length;
    if (!readyCount) {
      if (window.toast) toast(_t('bi_nada_que_importar', 'No hay movimientos válidos para importar'), 'error');
      ST.step = 5; _renderStep5();
      return;
    }

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

    // Rows with an invalid amount/date — captured here (before the final
    // write) so the result screen can report them in human terms.
    const errorRows = (ST.rows || []).filter(_isRowError);

    try {
      // ── ACTUAL WRITE INTO REAL APP STATE ──
      const S = _S();
      let cuentaId = ST.accountId;
      let accountName = '';
      if (ST.accountMode === 'new') {
        const name = document.getElementById('mnbiNewAccountName')?.value || ST.newAccountName || (BANKS[ST.format]||BANKS.generic).label;
        const tipo = ST.newAccountTipo || 'banco';
        accountName = name.trim() || 'Cuenta importada';
        const newAccount = { id: _uid(), nombre: accountName, tipo, saldo: 0, valorTotal: 0, color: '#00D4AA', notas: '' };
        S.cuentas.push(newAccount);
        cuentaId = newAccount.id;
      } else {
        accountName = (S.cuentas || []).find(c => c.id === cuentaId)?.nombre || _t('bi_cuenta_desconocida', 'Cuenta');
      }

      // Save merchant→category mappings if requested — separately per
      // gasto/ingreso, so a shared merchantKey (e.g. "TRANSFERENCIA") never
      // mixes a learned expense category into future income imports or
      // vice versa.
      if (ST.categorizeChoice && ST.rememberMappings) {
        const mapGasto = _loadMap('gasto');
        ST.groups.forEach(g => { if (g.category) mapGasto[g.key] = g.category; });
        _saveMap(mapGasto, 'gasto');

        const mapIngreso = _loadMap('ingreso');
        ST.groupsIngreso.forEach(g => { if (g.category) mapIngreso[g.key] = g.category; });
        _saveMap(mapIngreso, 'ingreso');
      }

      const groupCatByKeyGasto = {};
      const groupCatByKeyIngreso = {};
      if (ST.categorizeChoice) {
        ST.groups.forEach(g => { groupCatByKeyGasto[g.key] = g.category; });
        ST.groupsIngreso.forEach(g => { groupCatByKeyIngreso[g.key] = g.category; });
      }

      // Recompute duplicates fresh, scoped to the FINAL target account — not
      // reused from Step 3's cached ST._cleanRows, which could be stale if
      // the account was changed afterwards (e.g. via the "Cambiar cuenta"
      // shortcut on the final review step). This is what makes re-running an
      // import of the same file into the same account idempotent regardless
      // of how the wizard was navigated.
      const readyRows = (ST.rows || []).filter(r => !_isRowError(r));
      const { clean: dedupedRows, duplicates: skippedDuplicates } = _computeDuplicates(readyRows, cuentaId);

      let importedIncome = 0, importedExpense = 0;
      let incomeTotal = 0, expenseTotal = 0;
      const rows = dedupedRows;
      rows.forEach(r => {
        const fecha = (r.date instanceof Date && !isNaN(r.date)) ? r.date.toISOString().slice(0, 10) : todayISO();
        const fingerprint = _fingerprintFor(r);
        if (r.isExpense) {
          const categoria = r._categoryOverride || groupCatByKeyGasto[r.merchantKey] || 'Otro';
          S.gastos.push({ id: _uid(), concepto: r.description, importe: r.amount, fecha, categoria, cuentaId, merchant: r.merchantKey, _importFingerprint: fingerprint, origen: 'bank-import' });
          importedExpense++; expenseTotal += r.amount;
        } else {
          const categoria = r._categoryOverride || groupCatByKeyIngreso[r.merchantKey] || 'Otro';
          S.ingresos.push({ id: _uid(), concepto: r.description, importe: r.amount, fecha, categoria, cuentaId, merchant: r.merchantKey, _importFingerprint: fingerprint, status: 'cobrado', origen: 'bank-import' });
          importedIncome++; incomeTotal += r.amount;
        }
      });

      // Same balance-update rule the manual "add income/expense" forms use
      // (guardarGasto/guardarIngreso): expenses subtract, income adds. This
      // is what makes an imported transaction affect Net Worth exactly like
      // a manually created one — without it, the movements show up in the
      // lists but the account's saldo (and therefore Dinero Disponible /
      // Patrimonio Neto, which sum cuenta.saldo) never reflects them. The
      // existing balance is preserved: we add/subtract the net delta on top
      // of whatever the account already had, never reset it.
      if (typeof getCuenta === 'function') {
        const cuentaImport = getCuenta(cuentaId);
        if (cuentaImport) {
          cuentaImport.saldo = (Number(cuentaImport.saldo) || 0) + incomeTotal - expenseTotal;
        }
      }

      if (typeof save === 'function') save();
      if (window.MNGamification) { try { MNGamification.checkAchievement('gasto_added'); MNGamification.checkAchievement('data_check'); } catch (_) {} }

      await advance(); // import (final)
      await new Promise(res => setTimeout(res, 300));

      ST._resultStats = {
        total: rows.length,
        income: importedIncome,
        expense: importedExpense,
        incomeTotal, expenseTotal,
        merchants: ST.categorizeChoice ? ST.groups.filter(g => g.category).length : 0,
        duplicates: skippedDuplicates.length,
        duplicatesList: skippedDuplicates,
        errors: errorRows.length,
        errorsList: errorRows,
        accountName,
        fileName: ST.fileName || '',
      };
      ST.step = 'success';
      _renderSuccess();
      if (typeof render === 'function') render();
    } catch (_err) {
      // Whatever went wrong, the person still gets a clear, human message
      // and a way out — never a stuck spinner or a raw error on screen.
      ST.step = 5;
      _renderStep5();
      if (window.toast) toast(_t('bi_err_importacion', 'No se ha podido completar la importación. Inténtalo de nuevo.'), 'error');
    }
  }

  // Renders a short, human-language reason list for skipped rows — never
  // the raw row object, never a stack trace or technical code.
  function _skipDetailsHtml(list, reasonLabel, domId) {
    if (!list || !list.length) return '';
    const items = list.slice(0, 25).map(r => {
      const desc = (r && r.description ? String(r.description) : _t('bi_movimiento_generico', 'Movimiento')).trim();
      const amt = (r && typeof r.amount === 'number' && !isNaN(r.amount)) ? _fmtEur(r.amount) : '';
      return `<div class="mnbi-skip-item"><span>${_fmtDate(r && r.date)} · ${desc}</span><span>${amt}</span></div>`;
    }).join('');
    const more = list.length > 25 ? `<div class="mnbi-skip-item"><span>+ ${list.length - 25} ${_t('bi_mas', 'más')}…</span><span></span></div>` : '';
    return `
      <button type="button" class="mnbi-skip-toggle" onclick="document.getElementById('${domId}').style.display = document.getElementById('${domId}').style.display === 'block' ? 'none' : 'block'">
        ${_t('bi_ver_detalle', 'Ver detalle')}
      </button>
      <div class="mnbi-skip-details" id="${domId}" style="display:none">${items}${more}</div>`;
  }

  function _renderSuccess() {
    const stats = ST._resultStats || { total: 0, income: 0, expense: 0, incomeTotal: 0, expenseTotal: 0, merchants: 0, duplicates: 0, errors: 0, accountName: '', fileName: '' };
    const accountName = stats.accountName || _t('bi_cuenta_desconocida', 'Cuenta');
    const fileName = stats.fileName || _t('bi_archivo_desconocido', 'archivo');

    const duplicatesNotice = stats.duplicates > 0 ? `
      <div class="mnbi-skip-notice dup">
        ⚠️ ${stats.duplicates} ${stats.duplicates === 1 ? _t('bi_omitido_duplicado_1', 'movimiento omitido por estar duplicado') : _t('bi_omitido_duplicado_n', 'movimientos omitidos por estar duplicados')}
        ${_skipDetailsHtml(stats.duplicatesList, '', 'mnbiDupDetails')}
      </div>` : '';

    const errorsNotice = stats.errors > 0 ? `
      <div class="mnbi-skip-notice err">
        ⚠️ ${stats.errors} ${stats.errors === 1 ? _t('bi_con_error_1', 'movimiento con errores no se ha importado') : _t('bi_con_error_n', 'movimientos con errores no se han importado')}
        ${_skipDetailsHtml(stats.errorsList, '', 'mnbiErrDetails')}
      </div>` : '';

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

        <div class="mnbi-success-info">
          <div class="mnbi-success-info-row"><span>${_t('bi_total_ingresos', 'Total ingresos')}</span><span style="color:var(--green)">${_fmtEur(stats.incomeTotal || 0)}</span></div>
          <div class="mnbi-success-info-row"><span>${_t('bi_total_gastos', 'Total gastos')}</span><span style="color:var(--red)">${_fmtEur(stats.expenseTotal || 0)}</span></div>
          <div class="mnbi-success-info-row"><span>${_t('bi_cuenta_utilizada', 'Cuenta utilizada')}</span><span title="${accountName}">${accountName}</span></div>
          <div class="mnbi-success-info-row"><span>${_t('bi_archivo_procesado', 'Archivo procesado')}</span><span title="${fileName}">${fileName}</span></div>
        </div>

        ${duplicatesNotice}
        ${errorsNotice}

        <div class="mnbi-success-actions">
          <button class="mnbi-btn-secondary-full" onclick="MNBankImport._viewTransactions()">${_t('bi_ver_movimientos', 'Ver movimientos')}</button>
          <button class="mnbi-btn-primary" onclick="MNBankImport.close()">${_t('bi_cerrar_importador', 'Cerrar importador')}</button>
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
    _toStep2: () => {
      if (ST.columnMappingAmbiguous) { ST.step = 'mapping'; _renderColumnMapping(); return; }
      ST.step = 2; _renderStep2();
    },
    _toStep3: () => {
      if (ST.accountMode === 'new') {
        ST.newAccountName = document.getElementById('mnbiNewAccountName')?.value || ST.newAccountName;
        ST.newAccountTipo = document.getElementById('mnbiNewAccountTipo')?.value || ST.newAccountTipo;
      }
      if (ST.accountMode === 'existing') ST.accountId = document.getElementById('mnbiExistingAccount')?.value || ST.accountId;
      // Defense in depth: the Continue button is already disabled when this
      // isn't satisfied, but never allow advancing without a valid account.
      if (!_accountSelectionValid()) { _syncStep2Validity(); return; }
      ST.step = 3; _renderStep3();
    },
    _toStep4: () => { ST.step = 4; _renderStep4(); },
    _toStep5: () => { ST.step = 5; _renderStep5(); },
    _toggleRowType: _toggleRowType,
    _clearFile: _clearFile,
    _pickBank: _pickBank,
    _forceManualBank: _forceManualBank,
    _setAccountMode: _setAccountMode,
    _onNewAccountNameInput: _onNewAccountNameInput,
    _onNewAccountTipoChange: _onNewAccountTipoChange,
    _onExistingAccountChange: _onExistingAccountChange,
    _setMappingMode: _setMappingMode,
    _setMappingField: _setMappingField,
    _confirmColumnMapping: _confirmColumnMapping,
    _chooseCategorize: _chooseCategorize,
    _backToChoice: _backToChoice,
    _filterGroups: _filterGroups,
    _setGroupCategory: _setGroupCategory,
    _setCategorizeView: _setCategorizeView,
    _setCategorizeTab: _setCategorizeTab,
    _acceptRecommendedCategory: _acceptRecommendedCategory,
    _dismissRecommendedCategory: _dismissRecommendedCategory,
    _toggleRowSelection: _toggleRowSelection,
    _toggleSelectAllIndividual: _toggleSelectAllIndividual,
    _setIndividualRowCategory: _setIndividualRowCategory,
    _applyBulkCategory: _applyBulkCategory,
    _toggleRowTypeStep5: _toggleRowTypeStep5,
    _setRowCategoryStep5: _setRowCategoryStep5,
    _editColumnsFromReview: _editColumnsFromReview,
    _editAccountFromReview: _editAccountFromReview,
    _setRemember: _setRemember,
    _runImport: _runImport,
    _viewTransactions: _viewTransactions,
    // exposed for tests / backward compat
    detectBankFormat, detectBankWithConfidence, detectColumns, parseCSV, parseXLSX, normalizeRow, merchantKeyFor,
    autoDetectCategory: _autoDetectCategory,
    isRowError: _isRowError,
    fingerprintFor: _fingerprintFor,
    computeDuplicates: _computeDuplicates,
    parseAmount: _parseAmount, parseDate: _parseDate, decodeBestEffort: _decodeBestEffort,
  };
})();
