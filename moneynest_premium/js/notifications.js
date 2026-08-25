/**
 * MoneyNest — js/notifications.js
 * Local push notifications (Web Notifications API — no server needed).
 */
;(function () {
  'use strict';

  function _nt(key, fb) { return (typeof window.t === 'function' ? window.t(key) || fb : fb); }

  const PREFS_KEY = 'mn_notif_prefs';
  const PERM_KEY  = 'mn_notif_permission';

  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{"budget":true,"streak":true,"recurring":true,"trial":true}'); }
    catch { return { budget: true, streak: true, recurring: true, trial: true }; }
  }

  function savePrefs(p) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
  }

  // ─── Permission ───────────────────────────────────────────────────
  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    // Note: intentionally NOT checking localStorage PERM_KEY here so that
    // a user who previously declined can retry from Settings.

    // Show friendly modal first
    await _showPermissionModal();
    return Notification.permission === 'granted';
  }

  function _showPermissionModal() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:9900;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(12px)';
      el.innerHTML = `
        <div style="background:var(--card,#0F172A);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 24px;max-width:360px;width:calc(100vw - 40px);text-align:center;box-shadow:0 40px 100px rgba(0,0,0,.6)">
          <div style="font-size:2.5rem;margin-bottom:12px">🔔</div>
          <div style="font-size:1rem;font-weight:700;color:var(--text,#fff);margin-bottom:8px">${_nt('notif_modal_title','Notificaciones de MoneyNest')}</div>
          <div style="font-size:.82rem;color:rgba(255,255,255,.5);line-height:1.55;margin-bottom:20px">
            ${_nt('notif_modal_desc','MoneyNest puede avisarte cuando superes un presupuesto, tu trial esté por expirar, o una transacción recurrente se haya añadido.')}
          </div>
          <div style="display:flex;gap:10px">
            <button id="mnNotifDecline" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(255,255,255,.4);font-size:.82rem;cursor:pointer;font-family:inherit">${_nt('notif_ahora_no','Ahora no')}</button>
            <button id="mnNotifAccept" style="flex:2;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366F1,#00D4AA);color:#fff;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit">${_nt('notif_activar','Activar notificaciones')}</button>
          </div>
        </div>`;
      document.body.appendChild(el);

      document.getElementById('mnNotifDecline').onclick = () => {
        localStorage.setItem(PERM_KEY, 'denied');
        el.remove();
        resolve(false);
      };

      document.getElementById('mnNotifAccept').onclick = async () => {
        el.remove();
        const perm = await Notification.requestPermission();
        localStorage.setItem(PERM_KEY, perm);
        resolve(perm === 'granted');
        // Re-render settings UI so permission state is reflected immediately
        if (typeof renderConfiguracion === 'function') renderConfiguracion();
        else {
          // Fallback: re-render any open notification settings containers
          ['notifSettingsContainer','mn-notif-settings'].forEach(id => {
            const c = document.getElementById(id);
            if (c) renderSettingsUI(id);
          });
        }
      };
    });
  }

  // ─── Send notification ────────────────────────────────────────────
  function sendNotification(title, body, icon, tag) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: icon || './assets/icon-192.png',
        tag:  tag  || 'moneynest',
        badge: './assets/icon-192.png',
      });
    } catch(e) {
      console.warn('[MNNotifications] sendNotification error:', e);
    }
  }

  // ─── Budget alerts ────────────────────────────────────────────────
  function checkBudgetAlerts() {
    const prefs = getPrefs();
    if (!prefs.budget) return;
    try {
      // La app usa 'mn7_data' como clave de almacenamiento
      const raw  = localStorage.getItem('mn7_data') || localStorage.getItem('mn_data');
      const data = raw ? JSON.parse(raw) : {};
      const pres = data.presupuestos || {};
      const gastos = data.gastos || [];
      const currentMonth = new Date().toISOString().slice(0, 7);

      Object.entries(pres).forEach(([cat, limit]) => {
        const spent = gastos
          .filter(g => (g.fecha||'').startsWith(currentMonth) && (g.categoria||'') === cat)
          .reduce((a, g) => a + (Number(g.importe) || 0), 0);
        if (spent > Number(limit) && Number(limit) > 0) {
          sendNotification(
            _nt('notif_presupuesto_superado', 'Presupuesto superado') + ` — ${cat}`,
            _nt('notif_presupuesto_body', 'Has gastado').replace('{spent}', _eur(spent)).replace('{limit}', _eur(limit)).replace('{cat}', cat) || `Has gastado ${_eur(spent)} de ${_eur(limit)} en ${cat} este mes.`,
            null,
            `budget-${cat}`
          );
        }
      });
    } catch(e) {
      console.warn('[MNNotifications] checkBudgetAlerts error:', e);
    }
  }

  // ─── Trial expiry reminder ────────────────────────────────────────
  function scheduleTrialExpiry() {
    const prefs = getPrefs();
    if (!prefs.trial) return;
    try {
      const raw = localStorage.getItem('mn_user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const exp = user.trialEndsAt;
      if (!exp) return;
      const msLeft = exp - Date.now();
      if (msLeft <= 0 || msLeft > 26 * 3600000) return;
      const delay = Math.max(0, msLeft - 3600000);
      setTimeout(() => {
        sendNotification(
          _nt('notif_trial_title', 'Tu prueba de MoneyNest expira pronto ⏳'),
          _nt('notif_trial_body',  'Elige tu plan para conservar todos tus datos.'),
          null, 'trial-expiry'
        );
      }, delay);
    } catch {}
  }

  // ─── Upcoming bills (recurring expenses about to charge) ──────────
  // Uses the existing MNRecurring system (already tracks nextExecution
  // for anything the user marked as recurring — rent, subscriptions,
  // etc.) rather than building a separate/duplicate schedule.
  const UPCOMING_WINDOW_DAYS = 3;
  const SEEN_BILLS_KEY = 'mn_notif_seen_bills';

  function _getSeenBills() {
    try { return JSON.parse(localStorage.getItem(SEEN_BILLS_KEY) || '{}'); } catch { return {}; }
  }
  function _markBillSeen(tag) {
    const seen = _getSeenBills();
    seen[tag] = Date.now();
    // Keep this small: drop anything older than 30 days so it never grows unbounded.
    const cutoff = Date.now() - 30 * 86400000;
    Object.keys(seen).forEach(k => { if (seen[k] < cutoff) delete seen[k]; });
    try { localStorage.setItem(SEEN_BILLS_KEY, JSON.stringify(seen)); } catch {}
  }

  function checkUpcomingBills() {
    const prefs = getPrefs();
    if (!prefs.recurring) return;
    if (!window.MNRecurring || typeof MNRecurring.getRecurrings !== 'function') return;
    try {
      const items = MNRecurring.getRecurrings();
      const now = Date.now();
      const seen = _getSeenBills();
      items.forEach(item => {
        if (item.activa === false) return;
        if (item.type !== 'gasto') return; // only bills/expenses, not income like salary
        const next = Number(item.proximaEjecucion);
        if (!next) return;
        // Compare calendar dates (not exact millisecond differences) so
        // something due later today is correctly labeled "hoy", not
        // "mañana" — Math.ceil() of any small positive ms fraction of a
        // day always rounds up to 1, which would mislabel same-day bills.
        const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
        const daysLeft = Math.round((startOfDay(next) - startOfDay(now)) / 86400000);
        if (daysLeft < 0 || daysLeft > UPCOMING_WINDOW_DAYS) return;
        // One notification per (item, scheduled date) — never repeat for
        // the same upcoming charge once it's already been shown.
        const tag = `bill-${item.id}-${next}`;
        if (seen[tag]) return;
        const whenLabel = daysLeft === 0
          ? _nt('notif_hoy', 'hoy')
          : daysLeft === 1
            ? _nt('notif_manana', 'mañana')
            : _nt('notif_en_n_dias', 'en {n} días').replace('{n}', daysLeft);
        sendNotification(
          `${item.emoji || '💸'} ${_nt('notif_factura_proxima', 'Factura próxima')} — ${item.nombre || ''}`,
          _nt('notif_factura_body', '{importe} se cobrará {cuando}.').replace('{importe}', _eur(item.importe)).replace('{cuando}', whenLabel),
          null, tag
        );
        _markBillSeen(tag);
      });
    } catch (e) {
      console.warn('[MNNotifications] checkUpcomingBills error:', e);
    }
  }

  // ─── Streak notification ──────────────────────────────────────────
  function checkStreakNotification() {
    const prefs = getPrefs();
    if (!prefs.streak) return;
    try {
      const s = JSON.parse(localStorage.getItem('mn_streak') || '{}');
      if ((s.streak || 0) >= 7) {
        const streakLabel = _nt('notif_streak_title', '¡{n} días de racha! 🔥').replace('{n}', s.streak);
        sendNotification(
          streakLabel,
          _nt('notif_streak_body', '¡Sigue así! La constancia es la clave del éxito financiero.'),
          null,
          'streak'
        );
      }
    } catch {}
  }

  function _eur(v) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
  }

  // ─── Settings UI ─────────────────────────────────────────────────
  function renderSettingsUI(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const prefs = getPrefs();
    const perm  = 'Notification' in window ? Notification.permission : 'unsupported';

    let permBanner = '';
    if (perm === 'unsupported') {
      permBanner = `
        <div style="font-size:.78rem;color:var(--text2,rgba(255,255,255,.4));margin-bottom:10px;padding:8px 12px;background:rgba(255,255,255,0.04);border-radius:8px">
          ℹ️ ${_nt('notif_perm_unsupported','Tu navegador no soporta notificaciones push.')}
        </div>`;
    } else if (perm === 'denied') {
      permBanner = `
        <div style="font-size:.78rem;color:rgba(244,63,94,.8);margin-bottom:10px;padding:8px 12px;background:rgba(244,63,94,0.08);border-radius:8px">
          🚫 ${_nt('notif_perm_denied','Las notificaciones están bloqueadas en este navegador. Para activarlas, ve a la configuración del navegador y permite las notificaciones para este sitio.')}
        </div>`;
    } else if (perm === 'default') {
      permBanner = `
        <div style="font-size:.78rem;color:rgba(245,158,11,.8);margin-bottom:10px;padding:8px 12px;background:rgba(245,158,11,0.08);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px">
          <span>⚠️ ${_nt('notif_perm_default','Los permisos de notificación no están activados.')}</span>
          <button onclick="MNNotifications.requestPermission()" style="flex-shrink:0;font-size:.72rem;color:#F59E0B;background:none;border:1px solid rgba(245,158,11,.4);border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit;white-space:nowrap">${_nt('notif_activar','Activar')}</button>
        </div>`;
    } else {
      permBanner = `
        <div style="font-size:.78rem;color:rgba(16,185,129,.9);margin-bottom:10px;padding:8px 12px;background:rgba(16,185,129,0.08);border-radius:8px">
          ✅ ${_nt('notif_perm_granted','Activas — MoneyNest puede enviarte notificaciones.')}
        </div>`;
    }

    el.innerHTML = `
      <div style="padding:16px 0">
        <div style="font-size:.85rem;font-weight:700;color:var(--text,#fff);margin-bottom:12px">🔔 ${_nt('notif_titulo','Notificaciones')}</div>
        ${permBanner}
        ${_toggle(_nt('notif_pref_budget','Alertas de presupuesto'), 'budget', prefs.budget)}
        ${_toggle(_nt('notif_pref_streak','Recordatorios de racha'), 'streak', prefs.streak)}
        ${_toggle(_nt('notif_pref_recurring','Facturas y suscripciones próximas'), 'recurring', prefs.recurring)}
        ${_toggle(_nt('notif_pref_trial','Aviso expiración trial'), 'trial', prefs.trial)}
        <button onclick="MNNotifications._sendTest()" style="margin-top:12px;padding:8px 16px;border-radius:9px;border:1px solid var(--border2,rgba(255,255,255,.1));background:transparent;color:var(--text2,rgba(255,255,255,.5));font-size:.78rem;cursor:pointer;font-family:inherit">
          ${_nt('notif_test_btn','Enviar notificación de prueba')}
        </button>
      </div>
    `;
  }

  function _toggle(label, key, val) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:.82rem;color:var(--text2)">${label}</span>
        <label style="position:relative;display:inline-block;width:38px;height:22px;cursor:pointer">
          <input type="checkbox" ${val?'checked':''} onchange="MNNotifications._setPref('${key}',this.checked)"
            style="opacity:0;width:0;height:0">
          <span style="position:absolute;inset:0;background:${val?'var(--accent)':'var(--border2)'};border-radius:99px;transition:.2s;cursor:pointer"></span>
          <span style="position:absolute;top:3px;left:${val?'19px':'3px'};width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>
        </label>
      </div>`;
  }

  function _setPref(key, val) {
    const p = getPrefs();
    p[key] = val;
    savePrefs(p);
    // Re-render settings so toggle visual state is consistent
    const containerId = 'mn-notif-settings-container';
    // If enabling any pref, ensure permission is requested
    if (val && 'Notification' in window && Notification.permission !== 'granted') {
      requestPermission().then(() => {
        renderSettingsUI(containerId);
      });
    } else {
      renderSettingsUI(containerId);
    }
  }

  function _sendTest() {
    if (Notification.permission !== 'granted') {
      requestPermission();
      return;
    }
    try {
      new Notification(_nt('notif_test_title','MoneyNest — Prueba ✅'), {
        body: _nt('notif_test_body','¡Las notificaciones funcionan correctamente!'),
        icon: './assets/icon-192.png',
        tag:  'test',
      });
      if (typeof toast === 'function') toast(_nt('notif_test_sent','✅ Notificación de prueba enviada'), 'success');
    } catch(e) {
      if (typeof toast === 'function') toast('❌ Error al enviar notificación: ' + (e?.message || e), 'error');
    }
  }

  // ─── Auto listeners ───────────────────────────────────────────────
  window.addEventListener('mn:data:saved', () => { checkBudgetAlerts(); checkUpcomingBills(); });

  scheduleTrialExpiry();
  checkUpcomingBills(); // also check once on load, not just after a save

  window.MNNotifications = {
    requestPermission,
    sendNotification,
    checkBudgetAlerts,
    checkUpcomingBills,
    scheduleTrialExpiry,
    renderSettingsUI,
    _setPref,
    _sendTest,
  };
})();
