/**
 * MoneyNest — js/sync.js
 * Offline-first cloud sync via Supabase (table: cloud_data).
 * Silent — never blocks UI. All errors are console.warn only.
 */
;(function () {
  'use strict';

  const SUPABASE_URL      = 'https://jwddciqqhmfkbqhdrfre.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRjaXFxaG1ma2JxaGRyZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjkyMjcsImV4cCI6MjA5NDM0NTIyN30.Gqz39AWpW1BkWXhfhnR_vOUYUy93bgdSNvBfXYQ3VGk';
  const PENDING_KEY = 'mn_pending_sync';

  // Reuse the Supabase client from supabase-auth.js when available, else create minimal one
  function _getClient() {
    try {
      if (window._mnSyncClient) return window._mnSyncClient;
      window._mnSyncClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window._mnSyncClient;
    } catch(e) {
      console.warn('[MNSync] Supabase client unavailable:', e);
      return null;
    }
  }

  async function _getSession() {
    try {
      if (window.MNSupabaseAuth) return await window.MNSupabaseAuth.getSession();
      const client = _getClient();
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data?.session || null;
    } catch(e) {
      return null;
    }
  }

  // ─── Pending queue ────────────────────────────────────────────────
  function getPendingQueue() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
  }

  function addToPendingQueue(data) {
    try {
      const q = getPendingQueue();
      q.push({ data, ts: Date.now() });
      // Keep last 20 entries max to avoid unbounded growth
      if (q.length > 20) q.splice(0, q.length - 20);
      localStorage.setItem(PENDING_KEY, JSON.stringify(q));
    } catch(e) {
      console.warn('[MNSync] addToPendingQueue error:', e);
    }
  }

  function clearPendingQueue() {
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  }

  // ─── Pro plan guard ───────────────────────────────────────────────
  // Aligned with MNEntitlements.hasCloudAccess() (Fase 4/8) — the
  // single real source of truth, backed by Supabase/Stripe — instead
  // of reading MNAuth/localStorage directly, which is client-editable.
  // Supabase RLS on cloud_data already rejects any write from a
  // non-Pro user regardless of what this check returns (verified in
  // Fase 6), so this was never an exploitable billing gap — but it was
  // a second, weaker, duplicated gate that's now consistent with the
  // one everything else in the app uses. Falls back to the previous
  // local check only if MNEntitlements hasn't loaded for some reason.
  function _isPro() {
    if (window.MNEntitlements) return window.MNEntitlements.hasCloudAccess();
    try {
      if (window.MNAuth && typeof MNAuth.isPro === 'function') return MNAuth.isPro();
      const raw = localStorage.getItem('mn_user') || localStorage.getItem('mn_auth');
      if (!raw) return false;
      const u = JSON.parse(raw);
      return u.plan === 'pro';
    } catch { return false; }
  }

  // ─── Core sync ────────────────────────────────────────────────────
  async function syncToCloud(data) {
    try {
      const session = await _getSession();
      if (!session) { addToPendingQueue(data); return; }

      // Cloud sync is a Pro feature
      if (!_isPro()) return;

      const client = _getClient();
      if (!client) { addToPendingQueue(data); return; }

      showSyncIndicator('syncing');

      const { error } = await client
        .from('cloud_data')
        .upsert(
          { user_id: session.user.id, data: data, synced_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      showSyncIndicator('synced');
      window.dispatchEvent(new Event('mn:synced'));
    } catch(e) {
      console.warn('[MNSync] syncToCloud failed:', e);
      addToPendingQueue(data);
      showSyncIndicator('error');
    }
  }

  async function triggerSync(data) {
    if (!navigator.onLine) { addToPendingQueue(data); showSyncIndicator('offline'); return; }
    const session = await _getSession();
    if (!session) return;  // local-only user — silent, no error
    if (!_isPro()) return; // free/trial user — cloud sync not available
    await syncToCloud(data);
  }

  async function fetchFromCloud() {
    try {
      const session = await _getSession();
      if (!session || !_isPro()) return null;

      const client = _getClient();
      if (!client) return null;

      const { data: row, error } = await client
        .from('cloud_data')
        .select('data, synced_at')
        .eq('user_id', session.user.id)
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !row) return null;

      // Only return cloud data if it's newer than what's stored locally
      const localStr = localStorage.getItem('mn_data');
      if (!localStr) return row.data;

      const localObj = JSON.parse(localStr);
      const localTs  = localObj._updatedAt || 0;
      const cloudTs  = new Date(row.synced_at).getTime();
      return cloudTs > localTs ? row.data : null;
    } catch(e) {
      console.warn('[MNSync] fetchFromCloud failed:', e);
      return null;
    }
  }

  async function processPendingQueue() {
    const queue = getPendingQueue();
    if (!queue.length) return;

    const session = await _getSession();
    if (!session) return;

    // Only send the latest entry — older ones are superseded
    const latest = queue[queue.length - 1];
    try {
      await syncToCloud(latest.data);
      clearPendingQueue();
    } catch {
      // keep queue, retry next time
    }
  }

  // ─── Auto backup every 5 minutes ─────────────────────────────────
  function autoBackup() {
    setInterval(async () => {
      const session = await _getSession();
      if (!session) return;
      const raw = localStorage.getItem('mn_data');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        await triggerSync(data);
      } catch(e) {
        console.warn('[MNSync] autoBackup parse error:', e);
      }
    }, 5 * 60 * 1000);
  }

  // ─── Sync status indicator ────────────────────────────────────────
  function _st(key, fb) { return (typeof window.t === 'function' ? window.t(key) || fb : fb); }

  function showSyncIndicator(state) {
    const el = document.getElementById('mn-sync-status');
    if (!el) return;
    const map = {
      syncing: { text: _st('sync_sincronizando', '⟳ Sincronizando…'), cls: 'syncing' },
      synced:  { text: _st('sync_sincronizado',  '✓ Sincronizado'),   cls: 'synced'  },
      offline: { text: _st('sync_sin_conexion',  '⊘ Sin conexión'),   cls: 'offline' },
      error:   { text: _st('sync_error',         '⚠ Error sync'),     cls: 'error'   },
    };
    const cfg = map[state] || map.synced;
    el.textContent = cfg.text;
    el.className   = `mn-sync-status mn-sync-${cfg.cls}`;
    if (state === 'synced') setTimeout(() => { if (el) el.textContent = ''; }, 3000);
  }

  // ─── Listeners ───────────────────────────────────────────────────
  window.addEventListener('online',  () => processPendingQueue());
  window.addEventListener('mn:data:saved', e => { if (e.detail) triggerSync(e.detail); });

  // ─── Public API ──────────────────────────────────────────────────
  window.MNSync = { triggerSync, fetchFromCloud, processPendingQueue, autoBackup, syncToCloud };

  autoBackup();
})();
