/**
 * ════════════════════════════════════════════════════════════════
 *  MoneyNest — js/entitlements.js
 *  SINGLE SOURCE OF TRUTH for plan/entitlement state.
 *
 *  Nothing in this file ever trusts localStorage, cookies, in-memory
 *  state, or query parameters as the basis for a decision — those are
 *  only ever a fast-render cache, continuously overwritten by real
 *  answers from Supabase (which is itself only ever written by the
 *  Stripe webhook, per Fase 1/3's RLS + SECURITY DEFINER lockdown).
 *  Editing localStorage in devtools cannot grant Pro: the next
 *  refresh() (on load, on tab focus, every 60s, and after any billing
 *  action) re-confirms the real value and overwrites whatever was
 *  there.
 *
 *  Every user gets a real, database-backed identity from the first
 *  load — even ones who never explicitly sign up — via Supabase
 *  Anonymous Sign-In, so the 24h trial itself is server-verified, not
 *  just a local timer. If anonymous sign-in isn't enabled on the
 *  project, this fails closed (no server state = no entitlement
 *  granted) rather than trusting anything local.
 * ════════════════════════════════════════════════════════════════
 */
;(function () {
  'use strict';

  // Only ever written by refresh(), from a real Supabase response.
  let _serverState = null; // { plan, trial_ends_at, pro_trial_ends_at, cloud_enabled }
  let _lastRefresh = 0;
  let _refreshPromise = null;

  async function _ensureSession() {
    if (!window.MNSupabaseAuth) return false;
    if (window.MNSupabaseAuth.isLoggedIn()) return true;
    // Anonymous sign-in is disabled at the project level (confirmed via
    // production logs: dozens of "422 Anonymous sign-ins are disabled"
    // errors on every page load/60s tick/tab focus, with zero chance of
    // ever succeeding) — never attempt it. Fails closed exactly as
    // before (no server state = no entitlement granted), just without
    // the noisy, risky, and pointless network call.
    return false;
  }

  async function refresh() {
    if (_refreshPromise) return _refreshPromise; // coalesce concurrent callers
    _refreshPromise = (async () => {
      const hasSession = await _ensureSession();
      if (!hasSession) {
        // No real backend identity available at all — fail CLOSED to
        // "no confirmed entitlement" rather than trusting a local
        // guess. (This only happens if anonymous sign-in is disabled
        // on the project AND the user never logged in explicitly.)
        _lastRefresh = Date.now();
        return _serverState;
      }
      try {
        const sb = window.MNSupabaseAuth._sb;
        const { data, error } = await sb.rpc('get_my_plan');
        _lastRefresh = Date.now();
        if (error || !data || !data[0]) return _serverState;

        _serverState = data[0];

        // Hydrate the existing local cache so all pre-existing UI code
        // (badges, pill, gating) keeps rendering instantly without any
        // rewrite — but from now on it's just a mirror; every access
        // decision goes through the getters below, which read
        // _serverState directly, never this cache.
        if (window.MNAuth) {
          window.MNAuth.patchUser({
            plan: _serverState.plan,
            trialEndsAt: _serverState.trial_ends_at ? new Date(_serverState.trial_ends_at).getTime() : null,
            proTrialEndsAt: _serverState.pro_trial_ends_at ? new Date(_serverState.pro_trial_ends_at).getTime() : null,
            cloudEnabled: !!_serverState.cloud_enabled,
          });
        }
        document.dispatchEvent(new CustomEvent('mn:entitlements:refreshed', { detail: _serverState }));
        return _serverState;
      } catch (err) {
        console.warn('[MNEntitlements] refresh failed:', err);
        _lastRefresh = Date.now();
        return _serverState;
      }
    })();
    try { return await _refreshPromise; } finally { _refreshPromise = null; }
  }

  function _plan() { return _serverState?.plan ?? null; }
  function _trialEndsAtMs() {
    return _serverState?.trial_ends_at ? new Date(_serverState.trial_ends_at).getTime() : null;
  }

  // ── Centralized entitlement getters — the only place these rules
  // should ever be encoded. Nothing else in the app should re-derive
  // isPro/isLocal/etc. independently.
  function isTrial() {
    if (_plan() !== 'trial') return false;
    const end = _trialEndsAtMs();
    return end !== null && Date.now() < end;
  }
  function isTrialExpired() {
    const p = _plan();
    if (p === 'locked_local') return true;
    if (p !== 'trial') return false;
    const end = _trialEndsAtMs();
    return end !== null && Date.now() >= end;
  }
  function isLocal() { return _plan() === 'local'; }
  function isPro()   { return _plan() === 'pro'; }

  // Trial = "acceso completo durante 24 horas" per spec, so import/
  // export/cloud are all available while an active trial lasts, same
  // as Local/Pro. Import and export are explicitly NEVER Pro-gated.
  function hasImportAccess() { return isTrial() || isLocal() || isPro(); }
  function hasExportAccess() { return isTrial() || isLocal() || isPro(); }
  // hasCloudAccess trusts cloud_enabled — the single authoritative flag
  // the backend already computes (via trg_sync_cloud_enabled, which only
  // fires off a webhook-verified plan change) — rather than re-deriving
  // its own opinion from isPro(). This is the exact flag a future Cloud
  // Sync feature would check before syncing, so there's no risk of the
  // entitlement and the real gate ever disagreeing. Trial keeps its
  // "full access" preview on top, since the backend deliberately never
  // marks cloud_enabled for trial (that flag is reserved for Pro).
  function hasCloudAccess()  { return _serverState?.cloud_enabled === true || isTrial(); }

  function getServerState()  { return _serverState; }
  function getLastRefresh()  { return _lastRefresh; }

  window.MNEntitlements = {
    refresh,
    isTrial, isTrialExpired, isLocal, isPro,
    hasImportAccess, hasExportAccess, hasCloudAccess,
    getServerState, getLastRefresh,
  };

  // Restore flow: whenever a real sign-in happens (password, OAuth, or
  // the 'Restaurar acceso' magic link), reconcile Supabase against
  // Stripe server-side FIRST — this is what actually restores access
  // after clearing localStorage / switching device / reinstalling the
  // PWA / logging back in, per Fase 5 — then refresh the local getters.
  if (window.MNSupabaseAuth) {
    window.MNSupabaseAuth.onAuthChange(async (event, session) => {
      if (event !== 'SIGNED_IN' || !session) return;
      try {
        await fetch('https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/restore-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        });
      } catch (err) {
        console.warn('[MNEntitlements] restore-access reconciliation failed:', err);
      }
      refresh();
    });
  }

  // Re-confirm on load, on return-to-tab, periodically, and right
  // after any billing action — the tampering window is never more
  // than one of these cycles wide, and nothing sensitive is ever
  // decided from a value older than the last successful refresh.
  refresh();
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  document.addEventListener('mn:billing:activated', refresh);
  document.addEventListener('mn:billing:change', refresh);
})();
