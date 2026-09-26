/* MINISO — mise à jour de l'application (bannière automatique + bouton « Mettre à jour ») */
(function () {
  var cur = null, shown = false;
  try { if (/[?&]maj=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash); } catch (e) { }
  function latest() { return fetch('/api/version', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { return j.v; }); }
  function reload() {
    var go = function () { location.replace(location.pathname + '?maj=' + Date.now() + location.hash); };
    var jobs = [];
    try { if (window.caches) jobs.push(caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); })); } catch (e) { }
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update(); })); })); } catch (e) { }
    Promise.all(jobs).then(go, go); setTimeout(go, 2500);
  }
  function banner() {
    if (shown) return; shown = true;
    var b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top));z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:12px;width:min(calc(100% - 24px),460px);box-sizing:border-box;padding:10px 10px 10px 16px;border-radius:14px;background:#1f1a19;color:#fff;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28)';
    b.innerHTML = '<span>Nouvelle version disponible</span><button type="button" style="border:0;border-radius:10px;padding:9px 14px;background:#D7001D;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer">Mettre \u00e0 jour</button>';
    b.querySelector('button').onclick = reload;
    b.animate && b.animate([{ opacity: 0, transform: 'translate(-50%,-16px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 250, easing: 'ease-out' });
    document.body.appendChild(b);
  }
  function check() { return latest().then(function (v) { if (!cur) cur = v; else if (v !== cur) banner(); return v; }).catch(function () { }); }
  // Bouton manuel : recharge toujours la dernière version publiée
  window.appUpdate = function (btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Mise \u00e0 jour\u2026'; }
    reload();
  };
  window.appVersion = function () { return cur; };
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-app-update]'); if (t) { e.preventDefault(); e.stopPropagation(); window.appUpdate(t); } }, true);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 10 * 60 * 1000);
  check();
})();
