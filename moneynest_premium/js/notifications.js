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
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{"budget":true,"streak":true,"recurring":true,"trial":true,"reminders":true,"tips":true}'); }
    catch { return { budget: true, streak: true, recurring: true, trial: true, reminders: true, tips: true }; }
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
        if (perm === 'granted') subscribePush();
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
    addToInbox({ title, body, tag: tag || 'moneynest' });
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

  function scheduleTrialExpiry() {
    // No-op: trial is movement-based (100 movements), not time-based.
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
        ${_toggle(_nt('notif_pref_reminders','Recordatorios si dejas de entrar'), 'reminders', prefs.reminders !== false)}
        ${_toggle(_nt('notif_pref_tips','Consejos y resumen semanal'), 'tips', prefs.tips !== false)}
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

  async function _sendTest() {
    if (Notification.permission !== 'granted') {
      requestPermission();
      return;
    }
    // Prefer a REAL push through the server (proves closed-app delivery works)
    await subscribePush();
    const r = await sendPushTest();
    if (r && r.sent > 0) {
      if (typeof toast === 'function') toast('✅ Push enviado: debería llegarte en unos segundos', 'success');
      addToInbox({ title: 'Prueba enviada ✅', body: 'Notificación push enviada a tus dispositivos.', tag: 'test-' + Date.now() });
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


  // ─── Inbox (notification center) ──────────────────────────────────
  const INBOX_KEY = 'mn_notif_inbox';
  const FIRED_KEY = 'mn_notif_fired';
  const LAST_OPEN_KEY = 'mn_last_open';
  const VAPID_PUBLIC = 'BNRtUPwIF2L3DncNvx0yZOuQQxXPPCeMd0ZkdZRUKSwTo2PbsFyIaJ1I9ZyE5VMRB8bq3SwYjvoswOmIbEOE1xo';

  function _jget(k, fb) { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch { return fb; } }
  function _jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function _esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function getInbox() { return _jget(INBOX_KEY, []); }

  function addToInbox(n) {
    if (!n || !n.title) return;
    const list = getInbox();
    const key = n.tag || n.title;
    // Same tag already in inbox → don't duplicate
    if (list.some(x => x.tag === key)) return;
    list.unshift({ id: Date.now() + Math.random().toString(36).slice(2, 6), tag: key, title: n.title, body: n.body || '', ts: Date.now(), read: false, go: n.go || null });
    _jset(INBOX_KEY, list.slice(0, 40));
    _updateBadge();
    if (document.getElementById('mnNotifPanel')) _renderPanel();
  }

  function unreadCount() { return getInbox().filter(x => !x.read).length; }

  function markAllRead() {
    _jset(INBOX_KEY, getInbox().map(x => ({ ...x, read: true })));
    _updateBadge();
  }
  function clearInbox() { _jset(INBOX_KEY, []); _updateBadge(); _renderPanel(); }

  function _ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  // ─── Smart (generated) notifications ──────────────────────────────
  function _userData() {
    try { return JSON.parse(localStorage.getItem('mn7_data') || localStorage.getItem('mn_data') || '{}') || {}; } catch { return {}; }
  }
  function _firstName() {
    try {
      const u = window.MNAuth?.getUser?.() || {};
      const n = (u.name || u.nombre || (u.email || '').split('@')[0] || '').trim();
      return n ? n.split(/\s+/)[0].replace(/^./, c => c.toUpperCase()) : '';
    } catch { return ''; }
  }
  function _dayKey(d) { return (d || new Date()).toISOString().slice(0, 10); }
  function _weekKey() {
    const d = new Date(); const j = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + '-W' + Math.ceil(((d - j) / 86400000 + j.getDay() + 1) / 7);
  }

  const TIPS = [
    ['💡 Truco rápido', 'Revisa tus suscripciones: cancelar una que no usas son euros que vuelven a ti cada mes.'],
    ['🎯 Pequeñas metas', 'Una meta de ahorro con fecha tiene el doble de probabilidades de cumplirse. ¿Creamos una?'],
    ['📊 Mira tu mes', 'Dedicar 2 minutos a la semana a revisar tus gastos te ahorra sorpresas a final de mes.'],
    ['🧾 Importa tu banco', 'Puedes importar el CSV de tu banco y MoneyNest categoriza tus movimientos solo.'],
    ['🏦 Orden de deudas', 'Con el asistente de deudas puedes ver si te conviene bola de nieve o avalancha.'],
    ['🔔 Facturas', 'Marca tus gastos fijos como recurrentes y te avisamos antes de que se cobren.'],
  ];

  function generateSmartNotifications() {
    const prefs = getPrefs();
    const fired = _jget(FIRED_KEY, {});
    const now = Date.now();
    const push = (key, title, body, go, silent) => {
      if (fired[key]) return;
      fired[key] = now;
      addToInbox({ title, body, tag: key, go });
      if (!silent) sendNotification(title, body, null, key);
    };
    const prevOpen = Number(localStorage.getItem(LAST_OPEN_KEY)) || 0;
    const name = _firstName();
    const hi = name ? `${name}, ` : '';
    try {
      const data = _userData();
      const ing = Array.isArray(data.ingresos) ? data.ingresos : [];
      const gas = Array.isArray(data.gastos) ? data.gastos : [];
      const all = ing.concat(gas);
      const today = _dayKey();

      // Welcome back after being away
      if (prefs.reminders !== false && prevOpen) {
        const away = Math.floor((now - prevOpen) / 86400000);
        if (away >= 3) {
          const msg = away >= 14
            ? [`¡Cuánto tiempo! 👋`, `${hi}hace ${away} días que no entras. Tus números te esperan: dedica 2 minutos a ponerlos al día.`]
            : away >= 7
              ? [`Te echábamos de menos`, `${hi}hace ${away} días que no pasas por MoneyNest. ¿Registramos lo de esta semana?`]
              : [`Hace ${away} días que no entras`, `${hi}un repaso rápido a tus gastos y listo. Mantén tu racha viva 🔥`];
          push('away-' + today, msg[0], msg[1], 'dashboard');
        }
      }

      // Days without registering movements
      if (prefs.reminders !== false && all.length) {
        const last = all.map(x => x.fecha || '').filter(Boolean).sort().pop();
        if (last) {
          const days = Math.floor((now - new Date(last + 'T12:00:00').getTime()) / 86400000);
          if (days >= 4 && days < 60) push('nomove-' + _weekKey(), `Llevas ${days} días sin apuntar nada`, `${hi}¿has gastado algo que no hayas registrado? Añadirlo lleva 10 segundos.`, 'gastos');
        }
      } else if (prefs.reminders !== false && !all.length) {
        push('first-move', 'Registra tu primer movimiento 🚀', `${hi}empieza por un gasto de hoy: el café, el menú, lo que sea. Verás cómo cobra vida tu panel.`, 'gastos');
      }

      // Trial usage
      if (prefs.trial && typeof window._countTrialMovements === 'function') {
        const used = window._countTrialMovements();
        const left = 100 - used;
        if (used >= 80 && left > 0) push('trial-' + (left <= 5 ? 'last' : 'low'), `Te quedan ${left} movimientos gratis`, 'Pásate a un plan cuando quieras para seguir sin límites y con sincronización.', 'billing');
      }

      // Streak
      if (prefs.streak) {
        const st = _jget('mn_streak', {});
        const n = Number(st.streak) || 0;
        if (n >= 3 && [3, 7, 14, 30, 60, 100].includes(n)) push('streak-' + n, `¡${n} días de racha! 🔥`, 'La constancia es lo que cambia tus finanzas. Sigue así.', 'dashboard');
      }

      // Weekly summary (Mondays) — expenses of the last 7 days
      if (prefs.tips !== false && new Date().getDay() === 1 && gas.length) {
        const since = _dayKey(new Date(now - 7 * 86400000));
        const tot = gas.filter(g => (g.fecha || '') >= since).reduce((a, g) => a + (Number(g.importe) || 0), 0);
        if (tot > 0) push('weekly-' + _weekKey(), 'Tu resumen semanal 📊', `${hi}la semana pasada gastaste ${_eur(tot)}. Entra a ver en qué categorías se fue.`, 'gastos');
      }

      // Rotating tip (max one per 3 days)
      if (prefs.tips !== false) {
        const slot = Math.floor(now / (3 * 86400000));
        const tip = TIPS[slot % TIPS.length];
        push('tip-' + slot, tip[0], tip[1], null, true); // inbox only, not a system popup
      }
    } catch (e) { console.warn('[MNNotifications] smart error:', e); }
    // prune old keys
    Object.keys(fired).forEach(k => { if (now - fired[k] > 60 * 86400000) delete fired[k]; });
    _jset(FIRED_KEY, fired);
    try { localStorage.setItem(LAST_OPEN_KEY, String(now)); } catch {}
  }

  // ─── Bell + panel ─────────────────────────────────────────────────
  function _updateBadge() {
    const b = document.getElementById('mnBellBadge');
    if (!b) return;
    const n = unreadCount();
    b.textContent = n > 9 ? '9+' : String(n);
    b.style.display = n ? 'flex' : 'none';
  }

  function _ensureBell() {
    if (document.getElementById('mnBell')) return;
    const right = document.querySelector('.topbar-right');
    if (!right) return false;
    const btn = document.createElement('button');
    btn.id = 'mnBell';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Notificaciones');
    btn.style.cssText = 'position:relative;flex-shrink:0;width:36px;height:36px;border-radius:10px;border:1px solid var(--border2,rgba(255,255,255,.1));background:var(--card,transparent);color:var(--text2,#aaa);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span id="mnBellBadge" style="display:none;position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:#F43F5E;color:#fff;font-size:.6rem;font-weight:700;align-items:center;justify-content:center;box-sizing:border-box"></span>';
    btn.onclick = togglePanel;
    right.insertBefore(btn, right.firstChild);
    _updateBadge();
    return true;
  }

  function togglePanel() {
    const ex = document.getElementById('mnNotifPanelWrap');
    if (ex) { ex.remove(); return; }
    const wrap = document.createElement('div');
    wrap.id = 'mnNotifPanelWrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9800';
    wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
    wrap.innerHTML = '<div id="mnNotifPanel" style="position:absolute;top:60px;right:12px;width:min(380px,calc(100vw - 24px));max-height:min(540px,calc(100dvh - 80px));display:flex;flex-direction:column;background:var(--card,#0F172A);border:1px solid var(--border2,rgba(255,255,255,.1));border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.5);overflow:hidden"></div>';
    document.body.appendChild(wrap);
    _renderPanel();
    markAllRead();
  }

  function _renderPanel() {
    const el = document.getElementById('mnNotifPanel');
    if (!el) return;
    const list = getInbox();
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const enable = (perm === 'default')
      ? `<button onclick="MNNotifications.enablePush()" style="margin:10px 14px 0;padding:9px 12px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366F1,#00D4AA);color:#fff;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit">🔔 Activar avisos en este dispositivo</button>` : '';
    const rows = list.length ? list.map(n => `
      <div ${n.go ? `onclick="document.getElementById('mnNotifPanelWrap')?.remove();goTo('${_esc(n.go)}')"` : ''} style="padding:12px 16px;border-bottom:1px solid var(--border,rgba(255,255,255,.06));${n.go ? 'cursor:pointer' : ''}">
        <div style="display:flex;justify-content:space-between;gap:10px"><span style="font-size:.84rem;font-weight:700;color:var(--text,#fff)">${_esc(n.title)}</span><span style="font-size:.68rem;color:var(--text3,rgba(255,255,255,.35));white-space:nowrap">${_ago(n.ts)}</span></div>
        <div style="font-size:.78rem;color:var(--text2,rgba(255,255,255,.55));line-height:1.45;margin-top:3px">${_esc(n.body)}</div>
      </div>`).join('') : `<div style="padding:34px 20px;text-align:center;color:var(--text3,rgba(255,255,255,.4));font-size:.82rem">Todo al día ✨<br>Aquí aparecerán tus avisos.</div>`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border,rgba(255,255,255,.06))">
        <span style="font-size:.92rem;font-weight:700;color:var(--text,#fff)">Notificaciones</span>
        <span style="display:flex;gap:12px">
          ${list.length ? `<button onclick="MNNotifications.clearInbox()" style="background:none;border:none;color:var(--text3,#888);font-size:.74rem;cursor:pointer;font-family:inherit">Vaciar</button>` : ''}
          <button onclick="document.getElementById('mnNotifPanelWrap')?.remove();goTo('configuracion')" style="background:none;border:none;color:var(--accent,#6366F1);font-size:.74rem;cursor:pointer;font-family:inherit">Ajustes</button>
        </span>
      </div>
      ${enable}
      <div style="overflow-y:auto;overscroll-behavior:contain;margin-top:${enable ? '10px' : '0'}">${rows}</div>`;
  }

  // ─── Web Push (closed-app notifications) ──────────────────────────
  function _b64ToU8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function subscribePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      if (Notification.permission !== 'granted') return false;
      const sb = window.MNSupabaseAuth?._sb;
      const user = window.MNAuth?.getUser?.();
      if (!sb || !user || user.demoMode || !user.email) return false; // needs a cloud account
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: _b64ToU8(VAPID_PUBLIC) });
      const j = sub.toJSON();
      const { data: ses } = await sb.auth.getSession();
      const uid = ses?.session?.user?.id;
      if (!uid) return false;
      await sb.from('push_subscriptions').upsert({
        user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
        user_agent: (navigator.userAgent || '').slice(0, 200),
      }, { onConflict: 'endpoint' });
      return true;
    } catch (e) { console.warn('[MNNotifications] subscribePush', e); return false; }
  }

  async function touchLastSeen() {
    try {
      const sb = window.MNSupabaseAuth?._sb;
      if (!sb || !window.MNAuth?.getUser?.()?.email) return;
      const st = _jget('mn_streak', {});
      const okDate = /^\d{4}-\d{2}-\d{2}$/.test(st.lastOpenDate || '');
      await sb.rpc('touch_presence', { p_streak: Number(st.streak) || 0, p_streak_date: okDate ? st.lastOpenDate : null });
    } catch {}
  }

  // Real server-side push to this user's registered devices (works with the app closed)
  async function sendPushTest() {
    try {
      const sb = window.MNSupabaseAuth?._sb;
      const { data: ses } = await sb.auth.getSession();
      const tok = ses?.session?.access_token;
      if (!tok) return null;
      const r = await fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ test: true }),
      });
      return await r.json().catch(() => ({}));
    } catch { return null; }
  }

  async function enablePush() {
    const ok = await requestPermission();
    if (ok) { await subscribePush(); if (typeof toast === 'function') toast('🔔 Notificaciones activadas', 'success'); }
    _renderPanel();
  }

  // ─── Auto listeners ───────────────────────────────────────────────
  window.addEventListener('mn:data:saved', () => { checkBudgetAlerts(); checkUpcomingBills(); });

  scheduleTrialExpiry();
  checkUpcomingBills(); // also check once on load, not just after a save

  function _boot() {
    if (!_ensureBell()) { setTimeout(_boot, 800); return; }
    generateSmartNotifications();
    _updateBadge();
    subscribePush();
    touchLastSeen();
  }
  try { window.MNSupabaseAuth?.onAuthChange?.(() => { subscribePush(); touchLastSeen(); }); } catch {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { generateSmartNotifications(); touchLastSeen(); } });
  if (document.readyState === 'complete') setTimeout(_boot, 1500);
  else window.addEventListener('load', () => setTimeout(_boot, 1500));

  window.MNNotifications = {
    requestPermission,
    sendNotification,
    checkBudgetAlerts,
    checkUpcomingBills,
    scheduleTrialExpiry,
    renderSettingsUI,
    _setPref,
    _sendTest, sendPushTest,
    togglePanel, getInbox, clearInbox, enablePush, subscribePush, generateSmartNotifications,
  };
})();
