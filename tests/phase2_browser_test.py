import json
from playwright.sync_api import sync_playwright
ext=[]; local_fail=[]; errs=[]; beacons=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":412,"height":800}); pg=ctx.new_page()
    def route(r):
        u=r.request.url
        if u.startswith("http://localhost:3300"): return r.continue_()
        ext.append(u.split("/")[2]+" "+r.request.method)
        if "track-event" in u or "log-error" in u: beacons.append(u.split("/")[-1])
        r.fulfill(status=200, body="{}", headers={"access-control-allow-origin":"*","content-type":"application/json"})
    ctx.route("**/*", route)
    pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    pg.on("response", lambda r: local_fail.append(r.url) if r.url.startswith("http://localhost:3300") and r.status>=400 else None)
    pg.goto("http://localhost:3300/index.html", wait_until="load"); pg.wait_for_timeout(1500)
    libs=pg.evaluate("()=>({Chart:typeof Chart, jspdf:typeof window.jspdf, XLSX:typeof XLSX, supabase:typeof supabase, createClient: typeof (window.supabase&&window.supabase.createClient)})")
    fonts=pg.evaluate("async()=>{await document.fonts.ready; return {inter: document.fonts.check('16px Inter'), jakarta: document.fonts.check('16px \"Plus Jakarta Sans\"'), loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)}}")
    banner=pg.evaluate("()=>{const b=document.getElementById('mn-consent-banner'); if(!b) return null; const bs=[...b.querySelectorAll('button')].map(x=>{const r=x.getBoundingClientRect();return [x.textContent,Math.round(r.width),Math.round(r.height),getComputedStyle(x).backgroundColor]}); return bs}")
    print("libs",libs); print("fonts",fonts); print("banner",banner)
    before_ls=pg.evaluate("()=>localStorage.getItem('mn_analytics_session_id')")
    pg.evaluate("()=>MNAnalytics.track('plan_selected',{plan:'x'})"); pg.wait_for_timeout(300)
    nb=len(beacons); print("sin decisión → id:",before_ls,"| eventos enviados:",nb)
    pg.screenshot(path="/tmp/mn_consent.png")
    pg.click("#mn-consent-reject"); pg.wait_for_timeout(200)
    pg.evaluate("()=>MNAnalytics.track('plan_selected',{plan:'x'})"); pg.wait_for_timeout(300)
    print("tras RECHAZAR → banner:",pg.query_selector('#mn-consent-banner') is None,"| id:",pg.evaluate("()=>localStorage.getItem('mn_analytics_session_id')"),"| eventos:",len(beacons)-nb,"| consent:",pg.evaluate("()=>localStorage.getItem('mn_consent_v1')"))
    pg.reload(wait_until="load"); pg.wait_for_timeout(800)
    print("recarga → banner presente:",pg.query_selector('#mn-consent-banner') is not None)
    pg.evaluate("()=>MNConsent.open()"); pg.click("#mn-consent-accept"); pg.wait_for_timeout(200)
    pg.evaluate("()=>MNAnalytics.track('plan_selected',{plan:'x'})"); pg.wait_for_timeout(300)
    print("tras ACEPTAR → id:",bool(pg.evaluate("()=>localStorage.getItem('mn_analytics_session_id')")),"| eventos:",len(beacons)-nb)
    pg.evaluate("()=>MNConsent.set(false)")
    print("retirar → id:",pg.evaluate("()=>localStorage.getItem('mn_analytics_session_id')"))
    # error logging: URL sin query/hash
    pg.goto("http://localhost:3300/index.html?code=SECRET123#access_token=ABC", wait_until="load"); pg.wait_for_timeout(500)
    sent=[]
    pg.on("request", lambda r: sent.append(r.post_data) if "log-error" in r.url else None)
    pg.evaluate("()=>MNErrorLogging.report('boom-test', 'stack', {})"); pg.wait_for_timeout(400)
    print("error log URL:", [json.loads(x).get('url') for x in sent if x] , "contiene SECRET:", any('SECRET123' in (x or '') or 'ACCESS' in (x or '').upper() and 'ABC' in (x or '') for x in sent))
    print("dominios externos contactados:", sorted(set(ext)))
    print("404 locales:", local_fail); print("pageerrors:", errs[:5])
    b.close()
