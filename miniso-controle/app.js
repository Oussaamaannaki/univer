/* MINISO · Chemin de contrôle */
(function () {
  'use strict';
  const CFG0 = window.APP_CONFIG, DATA = window.APP_DATA;

  /* ---------------- Utilitaires ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => isoDay(new Date());
  const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  const MONTHS = { fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('mc-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mc-' + k, JSON.stringify(v)); } catch (e) { } }
  };

  /* ---------------- Stockage local (IndexedDB) ---------------- */
  const DB = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('miniso-controle', 1);
      r.onupgradeneeded = () => { const d = r.result; ['reports', 'actions', 'photos', 'kv'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (store, mode, fn) => {
      const d = await open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    };
    return {
      get: (s, k) => tx(s, 'readonly', st => st.get(k)),
      put: (s, k, v) => tx(s, 'readwrite', st => st.put(v, k)),
      del: (s, k) => tx(s, 'readwrite', st => st.delete(k)),
      all: s => tx(s, 'readonly', st => st.getAll())
    };
  })();

  /* ---------------- État ---------------- */
  const A = {
    lang: ls.get('lang', 'fr'),
    cfg: Object.assign(clone(CFG0), ls.get('cfg', {})),
    reports: [], actions: [], messages: [],
    view: 'check', type: 'daily', drafts: {}, openSecs: {},
    menuOpen: false, acc: ls.get('acc', {}), sup: sessionStorage.getItem('mc-sup') === '1',
    modal: null, confirm: null, photoCache: {}, saveState: '',
    rep: { tab: 'open', emp: '', type: '' }, readMsgs: ls.get('readMsgs', []),
    syncing: false, lastSync: ls.get('lastSync', null)
  };
  const t = k => (DATA.strings[A.lang][k] ?? DATA.strings.fr[k] ?? k);
  const L = o => (o && typeof o === 'object' ? (o[A.lang] || o.fr) : o);
  const fmtDate = s => { if (!s) return '—'; const [y, m, d] = s.split('-').map(Number); return A.lang === 'fr' ? `${d} ${MONTHS.fr[m - 1]} ${y}` : `${MONTHS.en[m - 1]} ${d}, ${y}`; };
  const tpl = type => DATA.templates[type];
  const storeLabel = code => { const s = A.cfg.stores.find(x => x.code === code) || A.cfg.stores[0]; return s ? `${s.code} · ${s.name}` : ''; };
  const itemOf = (type, id) => { for (const s of tpl(type)) for (const it of s.items) if (it.id === id) return { ...it, sec: s }; return null; };
  const typeName = type => t(type);
  const syncOn = () => !!A.cfg.syncUrl;

  /* ---------------- Score ---------------- */
  function evalNumber(it, v) {
    if (v === '' || v == null || isNaN(v)) return '';
    if (it.max == null && it.min == null) return 'info';
    if (it.max != null && Number(v) > it.max) return 'nok';
    if (it.min != null && Number(v) < it.min) return 'nok';
    return 'ok';
  }
  function scoreOf(r) {
    let ok = 0, nok = 0, na = 0, done = 0, total = 0;
    for (const s of tpl(r.type)) {
      if (s.optional && !(r.sections || {})[s.id]) continue;
      for (const it of s.items) {
        total++; const x = (r.results || {})[it.id]; if (!x || !x.s) continue; done++;
        if (x.s === 'ok') ok++; else if (x.s === 'nok') nok++; else if (x.s === 'na') na++;
      }
    }
    return { ok, nok, na, done, total, score: ok + nok ? Math.round(ok / (ok + nok) * 100) : null };
  }
  const cls = s => s == null ? 'na' : s >= A.cfg.threshold ? 'ok' : s >= A.cfg.threshold - 15 ? 'warn' : 'bad';

  /* ---------------- Brouillons ---------------- */
  function newDraft(type) {
    const d = { id: uid(), type, store: A.cfg.stores[0]?.code || '', date: today(), time: nowHM(), shift: guessShift(), manager: '', results: {}, sections: {}, notes: '', createdAt: new Date().toISOString() };
    if (type === 'daily' && d.shift === 'fermeture') d.sections.FER = true;
    return d;
  }
  function guessShift() { const h = new Date().getHours(); return h < 12 ? 'ouverture' : h < 17 ? 'jour' : 'fermeture'; }
  let saveTimer;
  function saveDraftSoon() {
    clearTimeout(saveTimer); setSave('…');
    saveTimer = setTimeout(async () => { try { await DB.put('kv', 'draft-' + A.type, A.drafts[A.type]); setSave(t('saved') + ' · ' + nowHM()); } catch (e) { setSave(''); } }, 450);
  }
  function setSave(s) { A.saveState = s; const e = $('#saveState'); if (e) e.textContent = s; }

  /* ---------------- Synchronisation (Google Apps Script) ---------------- */
  async function api(action, payload = {}) {
    const res = await fetch(A.cfg.syncUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, key: A.cfg.teamKey, ...payload }), redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json(); if (!j.ok) throw new Error(j.error || 'error'); return j;
  }
  async function pull() {
    if (!syncOn() || !navigator.onLine) return;
    A.syncing = true; renderSyncChip();
    try {
      const j = await api('pull');
      for (const r of j.reports || []) {
        const loc = A.reports.find(x => x.id === r.id);
        if (loc && loc._pending) continue;
        const merged = { ...r, _pending: false };
        await DB.put('reports', r.id, merged);
      }
      for (const a of j.actions || []) {
        const loc = A.actions.find(x => x.id === a.id);
        if (loc && (loc._pending || (loc.updatedAt || '') > (a.updatedAt || ''))) continue;
        await DB.put('actions', a.id, { ...a, _pending: false });
      }
      A.messages = j.messages || []; ls.set('messages', A.messages);
      if (j.config && j.config.employees) { A.cfg = Object.assign(clone(CFG0), ls.get('cfg', {}), j.config); ls.set('cfg', j.config); }
      A.lastSync = new Date().toISOString(); ls.set('lastSync', A.lastSync);
      await loadAll();
    } catch (e) { /* hors ligne ou script indisponible : on garde les données locales */ }
    A.syncing = false; softRender();
  }
  // Ne pas redessiner le formulaire pendant la saisie
  function softRender() {
    if (A.view !== 'check') { render(); return; }
    renderSyncChip(); renderDrawer();
    $('#menuBadge').hidden = !A.messages.filter(m => !A.readMsgs.includes(m.id)).length;
    if (A.modal) renderModal();
  }
  let flushing = false;
  async function flush() {
    if (!syncOn() || flushing || !navigator.onLine) return;
    flushing = true;
    try {
      for (const r of A.reports.filter(x => x._pending)) {
        const photos = {};
        for (const x of Object.values(r.results || {})) for (const pid of x.photos || []) { const p = await DB.get('photos', pid); if (p) photos[pid] = p; }
        const { _pending, ...body } = r;
        const j = await api('saveReport', { report: body, photos });
        const upd = { ...r, _pending: false, photoUrls: { ...(r.photoUrls || {}), ...(j.photoUrls || {}) } };
        await DB.put('reports', r.id, upd);
      }
      for (const a of A.actions.filter(x => x._pending)) {
        const { _pending, ...body } = a; await api('saveAction', { item: body });
        await DB.put('actions', a.id, { ...a, _pending: false });
      }
      await loadAll();
    } catch (e) { toast(t('sendFail'), 'bad'); }
    flushing = false; softRender();
  }
  async function loadAll() {
    A.reports = (await DB.all('reports')) || [];
    A.actions = (await DB.all('actions')) || [];
  }

  /* ---------------- Photos ---------------- */
  async function compress(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = .75, out = c.toDataURL('image/jpeg', q);
      while (out.length > 350000 && q > .35) { q -= .1; out = c.toDataURL('image/jpeg', q); }
      return out;
    } finally { URL.revokeObjectURL(url); }
  }
  async function photoSrc(pid, report) {
    if (A.photoCache[pid]) return A.photoCache[pid];
    const p = await DB.get('photos', pid).catch(() => null);
    if (p) { A.photoCache[pid] = p; return p; }
    return report && report.photoUrls && report.photoUrls[pid] || '';
  }
  function hydratePhotos(root, report) {
    root.querySelectorAll('img[data-pid]').forEach(async img => { const s = await photoSrc(img.dataset.pid, report); if (s) img.src = s; });
  }
  function dataUrlToFile(d, name) {
    const [h, b] = d.split(','); const mime = (h.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(b); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }

  /* ---------------- Icônes ---------------- */
  const svg = (p, s = 20, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', down: '<path d="m6 9 6 6 6-6"/>',
    cam: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    mega: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" fill="currentColor" stroke="none"/><rect x="12" y="8" width="3" height="10" fill="currentColor" stroke="none"/><rect x="17" y="5" width="3" height="13" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>', print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    sync: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>', back: '<path d="m15 18-6-6 6-6"/>'
  };

  /* ---------------- Rendu principal ---------------- */
  function render() {
    document.documentElement.lang = A.lang === 'fr' ? 'fr-CA' : 'en-CA';
    $('#langBtn').textContent = t('lang');
    $('#subTitle').textContent = `${A.cfg.stores[0]?.code || ''} · ${A.cfg.stores[0]?.name || ''}`;
    $('#drawerStore').textContent = t('subtitle');
    const unread = A.messages.filter(m => !A.readMsgs.includes(m.id)).length;
    $('#menuBadge').hidden = !unread;
    const app = $('#app');
    app.innerHTML = A.view === 'reports' ? viewReports() : A.view === 'settings' ? viewSettings() : viewCheck();
    hydratePhotos(app);
    renderDrawer(); renderModal();
  }
  function renderSyncChip() { const e = $('#syncChip'); if (e) e.innerHTML = syncChipHtml(); }
  function syncChipHtml() {
    if (!syncOn()) return `<span class="pill na">${t('syncOff')}</span>`;
    const pend = A.reports.filter(r => r._pending).length + A.actions.filter(a => a._pending).length;
    if (A.syncing) return `<span class="pill warn">${t('syncing')}</span>`;
    return pend ? `<span class="pill warn">${pend} · ${t('pending')}</span>` : `<span class="pill ok">${svg(IC.check, 13, 3)} ${t('syncOn')}</span>`;
  }

  /* ----- Formulaire de contrôle ----- */
  function viewCheck() {
    const type = A.type;
    const d = A.drafts[type] || (A.drafts[type] = newDraft(type));
    const sc = scoreOf(d);
    const tabs = A.sup ? `<div class="type-tabs" role="group">${['daily', 'monthly', 'surprise'].map(k => `<button data-act="type" data-v="${k}" aria-pressed="${k === type}">${typeName(k)}</button>`).join('')}</div>` : '';
    const emps = A.cfg.employees;
    const secs = tpl(type).map(s => sectionHtml(s, d)).join('');
    const pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
    return `
      <div class="hero"><div><div class="eyebrow">${fmtDate(d.date)} · <span id="syncChip">${syncChipHtml()}</span></div><h1>${typeName(type)}</h1></div>${tabs}</div>
      <section class="card"><div class="card-b grid">
        <div class="field"><label for="f-store">${t('store')}</label><select class="input" id="f-store" data-f="store">${A.cfg.stores.map(s => `<option value="${esc(s.code)}" ${s.code === d.store ? 'selected' : ''}>${esc(s.code)} · ${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="f-date">${t('date')}</label><input class="input" type="date" id="f-date" data-f="date" value="${esc(d.date)}"></div>
        <div class="field"><label for="f-time">${t('time')}</label><input class="input" type="time" id="f-time" data-f="time" value="${esc(d.time)}"></div>
        ${type === 'daily' ? `<div class="field"><label for="f-shift">${t('shift')}</label><select class="input" id="f-shift" data-f="shift">${Object.entries(t('shifts')).map(([k, v]) => `<option value="${k}" ${k === d.shift ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label for="f-manager">${type === 'daily' ? t('manager') : t('supervisorName')}</label><input class="input" id="f-manager" data-f="manager" list="empList" value="${esc(d.manager)}" placeholder="${t('choose')}" autocomplete="off"><datalist id="empList">${emps.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist></div>
      </div></section>
      <div class="scorebar"><div class="scorebar-in">
        <span class="score-n" id="liveScore" style="color:var(--${cls(sc.score) === 'na' ? 'ink-3' : cls(sc.score)})">${sc.score == null ? '—' : sc.score + '%'}</span>
        <div class="prog"><i id="liveProg" style="width:${pct}%"></i></div>
        <div class="counts"><span class="pill ok">${sc.ok}</span><span class="pill bad">${sc.nok} ${t('nc')}</span><span class="pill na num">${sc.done}/${sc.total}</span></div>
        <span class="save-state" id="saveState">${esc(A.saveState)}</span>
      </div></div>
      <div class="tools"><button class="btn sm" data-act="expandAll">${t('expandAll')}</button><button class="btn sm" data-act="collapseAll">${t('collapseAll')}</button><button class="btn sm" data-act="fillOk">${t('fillOk')}</button></div>
      ${secs}
      <div class="field"><label for="f-notes">${t('comments')}</label><textarea class="input" id="f-notes" data-f="notes" placeholder="${t('commentsPh')}">${esc(d.notes)}</textarea></div>
      <section class="card submit-card">
        <div><b>${sc.done < sc.total ? (sc.total - sc.done) + ' ' + t('remaining') : t('allDone')}</b>${sc.nok ? `<div class="muted">${sc.nok} ${t('nc')} → ${sc.nok} ${t('createdActions')}</div>` : ''}</div>
        <button class="btn red block" data-act="submit">${svg(IC.check, 18, 3)} ${t('submit')}</button>
        ${A.confirm === 'reset' ? `<div class="confirm">${t('resetConfirm')} <button class="btn sm danger" data-act="resetYes">${t('yes')}</button><button class="btn sm" data-act="cancelConfirm">${t('cancel')}</button></div>` : `<button class="btn ghost sm" data-act="reset">${t('reset')}</button>`}
      </section>
      <div class="foot">MINISO · ${esc(storeLabel(d.store))} · ${t('footer')}</div>`;
  }
  function sectionHtml(s, d) {
    const on = !s.optional || d.sections[s.id];
    const done = s.items.filter(i => d.results[i.id] && d.results[i.id].s).length;
    const nok = s.items.filter(i => d.results[i.id] && d.results[i.id].s === 'nok').length;
    const open = !!A.openSecs[d.type + s.id];
    const status = !on ? `<span class="pill na">${t('na')}</span>` : nok ? `<span class="pill bad">${nok} ${t('nc')}</span>` : done === s.items.length ? `<span class="pill ok">${svg(IC.check, 13, 3)}</span>` : `<span class="muted num" style="font-size:13px;font-weight:700">${done}/${s.items.length}</span>`;
    return `<section class="sec" data-open="${open ? 1 : 0}">
      <button class="sec-h" data-act="sec" data-id="${s.id}" aria-expanded="${open}"><span class="sec-ico">${s.id}</span><span class="sec-t"><b>${esc(L(s.title))}</b><span>${s.items.length} ${A.lang === 'fr' ? 'points' : 'items'}${s.optional ? ' · ' + (A.lang === 'fr' ? 'facultative' : 'optional') : ''}</span></span>${status}<span class="chev">${svg(IC.down)}</span></button>
      ${open ? `<div class="sec-body">
        ${s.optional ? `<label class="sec-opt"><input type="checkbox" id="opt-${s.id}" data-act="secOn" data-id="${s.id}" ${on ? 'checked' : ''}> ${t('applies')}</label>` : ''}
        ${on ? s.items.map(it => itemHtml(it, d)).join('') : ''}
      </div>` : ''}
    </section>`;
  }
  function itemHtml(it, d) {
    const r = d.results[it.id] || {};
    const lim = it.kind === 'number' && (it.max != null || it.min != null) ? `<span class="lim">(${it.min != null ? '≥ ' + it.min : ''}${it.min != null && it.max != null ? ' · ' : ''}${it.max != null ? '≤ ' + it.max : ''} ${esc(it.unit || '')})</span>` : '';
    const control = it.kind === 'number'
      ? `<div class="numrow"><input class="input num" type="number" inputmode="decimal" step="any" id="v-${it.id}" data-act="num" data-id="${it.id}" value="${r.v ?? ''}" placeholder="${t('value')}"><b>${esc(it.unit || '')}</b>${r.s === 'ok' ? `<span class="pill ok">${t('ok')}</span>` : r.s === 'nok' ? `<span class="pill bad">${t('nc')}</span>` : ''}</div>`
      : `<div class="seg" role="group">
          <button data-act="set" data-id="${it.id}" data-v="ok" aria-pressed="${r.s === 'ok'}">${svg(IC.check, 16, 3)} ${t('conform')}</button>
          <button data-act="set" data-id="${it.id}" data-v="nok" aria-pressed="${r.s === 'nok'}">${svg(IC.x, 16, 3)} ${t('nonconform')}</button>
          <button data-act="set" data-id="${it.id}" data-v="na" aria-pressed="${r.s === 'na'}">${t('na')}</button></div>`;
    const thumbs = (r.photos || []).map(pid => `<div class="thumb"><img data-pid="${pid}" alt=""><button data-act="rmPhoto" data-id="${it.id}" data-pid="${pid}" aria-label="${t('delete')}">×</button></div>`).join('');
    const plan = r.s === 'nok' ? `<div class="plan"><span class="eyebrow">${t('actionPlan')}</span>
        <div class="field"><label for="pt-${it.id}">${t('action')}</label><input class="input" id="pt-${it.id}" data-act="plan" data-k="text" data-id="${it.id}" value="${esc((r.plan || {}).text || '')}"></div>
        <div class="field"><label for="pa-${it.id}">${t('assignee')}</label><select class="input" id="pa-${it.id}" data-act="plan" data-k="assignee" data-id="${it.id}"><option value="">${t('choose')}</option>${A.cfg.employees.map(e => `<option ${(r.plan || {}).assignee === e.name ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="pd-${it.id}">${t('due')}</label><input class="input" type="date" id="pd-${it.id}" data-act="plan" data-k="due" data-id="${it.id}" value="${esc((r.plan || {}).due || today())}"></div></div>` : '';
    return `<div class="item" data-s="${r.s || ''}">
      <div class="item-q"><span class="item-code">${it.id}</span><span class="item-txt">${esc(L(it.text))}${lim}</span></div>
      ${control}
      <div class="extra"><input class="input" id="n-${it.id}" data-act="note" data-id="${it.id}" value="${esc(r.note || '')}" placeholder="${t('note')}">
        <label class="btn sm file-btn">${svg(IC.cam, 16)} ${t('photo')}<input type="file" accept="image/*" data-act="photo" data-id="${it.id}"></label></div>
      ${thumbs ? `<div class="thumbs">${thumbs}</div>` : ''}${plan}</div>`;
  }
  function refreshLive() {
    const d = A.drafts[A.type]; if (!d) return; const sc = scoreOf(d);
    const s = $('#liveScore'); if (s) { s.textContent = sc.score == null ? '—' : sc.score + '%'; s.style.color = `var(--${cls(sc.score) === 'na' ? 'ink-3' : cls(sc.score)})`; }
    const p = $('#liveProg'); if (p) p.style.width = (sc.total ? Math.round(sc.done / sc.total * 100) : 0) + '%';
  }
  function defaultPlan(it, extra) { return { text: `${t('correct')} ${L(it.text)}${extra || ''}`, assignee: '', due: today() }; }

  async function submit() {
    const d = A.drafts[A.type]; const sc = scoreOf(d);
    if (!d.manager.trim()) { toast(t('needManager'), 'bad'); $('#f-manager')?.focus(); return; }
    if (!sc.done) { toast(t('needOne'), 'bad'); return; }
    clearTimeout(saveTimer);
    const now = new Date().toISOString();
    const rep = { ...clone(d), score: sc.score, ok: sc.ok, nok: sc.nok, na: sc.na, status: 'submitted', submittedAt: now, updatedAt: now, _pending: syncOn() };
    const acts = [];
    for (const [id, r] of Object.entries(d.results)) {
      if (r.s !== 'nok') continue; const it = itemOf(d.type, id); if (!it) continue;
      if (it.sec.optional && !d.sections[it.sec.id]) continue;
      const p = r.plan || defaultPlan(it);
      acts.push({ id: uid(), reportId: rep.id, reportType: d.type, store: d.store, itemId: id, itemText: it.text, text: p.text || defaultPlan(it).text, assignee: p.assignee || '', due: p.due || today(), status: 'open', note: r.note || '', createdBy: d.manager, createdAt: now, updatedAt: now, _pending: syncOn() });
    }
    await DB.put('reports', rep.id, rep);
    for (const a of acts) await DB.put('actions', a.id, a);
    await DB.del('kv', 'draft-' + A.type);
    A.drafts[A.type] = newDraft(A.type); A.openSecs = {}; A.saveState = '';
    await loadAll();
    toast(`${t('submitted')} · ${sc.score == null ? '—' : sc.score + '%'}${acts.length ? ' · ' + acts.length + ' ' + t('createdActions') : ''}`);
    A.modal = { kind: 'report', id: rep.id }; render(); window.scrollTo(0, 0);
    flush();
  }

  /* ----- Rapports et suivi ----- */
  function viewReports() {
    const now = today();
    const subs = [...A.reports].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const last30 = subs.filter(r => daysBetween(r.date, now) <= 30);
    const scores = last30.filter(r => r.type === 'daily').map(r => r.score).filter(s => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const open = A.actions.filter(a => a.status !== 'done');
    const late = open.filter(a => a.due && a.due < now);

    const trendVals = subs.filter(r => r.type === 'daily' && r.score != null).slice(0, 20).reverse();
    const freq = {};
    last30.forEach(r => Object.entries(r.results || {}).forEach(([k, x]) => { if (x.s === 'nok') freq[k] = (freq[k] || 0) + 1; }));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6); const mx = top[0]?.[1] || 1;

    const f = A.rep;
    let acts = A.actions.filter(a => f.tab === 'all' ? true : f.tab === 'done' ? a.status === 'done' : f.tab === 'late' ? (a.status !== 'done' && a.due && a.due < now) : a.status !== 'done');
    if (f.emp) acts = acts.filter(a => (a.assignee || '') === (f.emp === '_none' ? '' : f.emp));
    acts.sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    let hist = subs; if (f.type) hist = hist.filter(r => r.type === f.type);

    const people = {};
    A.actions.forEach(a => { const k = a.assignee || t('unassigned'); const p = people[k] || (people[k] = { open: 0, late: 0, done: 0 }); if (a.status === 'done') p.done++; else { p.open++; if (a.due && a.due < now) p.late++; } });

    return `
      <div class="hero"><div><button class="btn ghost sm" data-act="home" style="margin-left:-10px">${svg(IC.back, 18)} ${t('daily')}</button><h1>${t('reportsTitle')}</h1></div>
        <div class="row"><span id="syncChip">${syncChipHtml()}</span>${syncOn() ? `<button class="btn sm" data-act="sync">${svg(IC.sync, 16)} ${t('sync')}</button>` : ''}</div></div>
      <div class="kpis">
        <div class="kpi"><span class="eyebrow">${t('avg30')}</span><span class="v" style="color:var(--${cls(avg) === 'na' ? 'ink' : cls(avg)})">${avg == null ? '—' : avg + '%'}</span><span class="muted" style="font-size:12px">${t('thr')} ${A.cfg.threshold}%</span></div>
        <div class="kpi"><span class="eyebrow">${t('count30')}</span><span class="v">${last30.length}</span><span class="muted" style="font-size:12px">${subs.length} ${t('reportsN')}</span></div>
        <div class="kpi"><span class="eyebrow">${t('openActions')}</span><span class="v">${open.length}</span></div>
        <div class="kpi"><span class="eyebrow">${t('lateActions')}</span><span class="v" style="color:${late.length ? 'var(--bad)' : 'inherit'}">${late.length}</span></div>
      </div>
      <section class="card"><div class="card-h"><h2>${t('trend')} · ${t('daily')}</h2><span class="muted" style="font-size:12px">${trendVals.length}</span></div><div class="card-b">${trendSvg(trendVals)}</div></section>
      <section class="card"><div class="card-h"><h2>${t('actions')}</h2>
        <select class="input" style="width:auto;min-height:36px;padding:4px 10px" id="r-emp" data-rf="emp" aria-label="${t('filterEmp')}"><option value="">${t('filterEmp')} : ${t('all')}</option>${A.cfg.employees.map(e => `<option ${e.name === f.emp ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}<option value="_none" ${f.emp === '_none' ? 'selected' : ''}>${t('unassigned')}</option></select></div>
        <div class="card-b" style="padding-bottom:0"><div class="seg-tabs">${[['open', t('open')], ['late', t('late')], ['done', t('done')], ['all', t('all')]].map(([k, l]) => `<button data-act="rtab" data-v="${k}" aria-pressed="${f.tab === k}">${l}</button>`).join('')}</div></div>
        <div style="padding-top:8px">${acts.length ? acts.map(actCard).join('') : `<div class="empty">${t('noActions')}</div>`}</div></section>
      <section class="card"><div class="card-h"><h2>${t('topNC')}</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">${top.length ? top.map(([k, n]) => { const it = itemOf('daily', k) || itemOf('monthly', k); return `<div class="bar-row"><div class="lbl"><span><b class="muted">${k}</b> ${esc(it ? L(it.text) : k)}</span><b class="num">${n}×</b></div><div class="bar"><i style="width:${n / mx * 100}%"></i></div></div>`; }).join('') : `<div class="empty">—</div>`}</div></section>
      <section class="card"><div class="card-h"><h2>${t('byEmployee')}</h2></div>${Object.keys(people).length ? Object.entries(people).sort((a, b) => b[1].open - a[1].open).map(([n, p]) => `<div class="lrow"><div class="main"><div class="t">${esc(n)}</div><div class="m">${p.done} ${t('done').toLowerCase()}</div></div>${p.late ? `<span class="pill bad">${p.late} ${t('late').toLowerCase()}</span>` : ''}<span class="pill ${p.open ? 'warn' : 'ok'}">${p.open} ${t('open').toLowerCase()}</span></div>`).join('') : `<div class="empty">${t('noActions')}</div>`}</section>
      <section class="card"><div class="card-h"><h2>${t('history')}</h2>
        <select class="input" style="width:auto;min-height:36px;padding:4px 10px" id="r-type" data-rf="type" aria-label="${t('filterType')}"><option value="">${t('filterType')} : ${t('all')}</option>${['daily', 'monthly', 'surprise'].map(k => `<option value="${k}" ${k === f.type ? 'selected' : ''}>${typeName(k)}</option>`).join('')}</select></div>
        ${hist.length ? hist.map(histRow).join('') : `<div class="empty">${t('noReports')}</div>`}</section>
      <div class="foot">MINISO · ${esc(storeLabel(A.cfg.stores[0]?.code))}${A.lastSync ? ' · ' + t('lastSync') + ' ' + fmtDate(A.lastSync.slice(0, 10)) + ' ' + A.lastSync.slice(11, 16) : ''}</div>`;
  }
  function trendSvg(rs) {
    const w = 640, h = 120, px = 30, py = 12;
    if (!rs.length) return `<div class="empty">${t('noReports')}</div>`;
    const x = i => rs.length === 1 ? w / 2 : px + i * (w - px - 10) / (rs.length - 1);
    const lo = 50; const y = v => py + (1 - (Math.max(v, lo) - lo) / (100 - lo)) * (h - 2 * py);
    const pts = rs.map((r, i) => `${x(i).toFixed(1)},${y(r.score).toFixed(1)}`).join(' ');
    const area = `${x(0)},${h - py} ${pts} ${x(rs.length - 1)},${h - py}`;
    const thr = y(A.cfg.threshold);
    const grid = [50, 75, 100].map(v => `<line x1="${px}" x2="${w - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${px - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${v}</text>`).join('');
    const last = rs[rs.length - 1];
    return `<svg class="trend" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${t('trend')}">${grid}
      <line x1="${px}" x2="${w - 10}" y1="${thr}" y2="${thr}" stroke="var(--red)" stroke-dasharray="4 4" opacity=".6"/>
      <polygon points="${area}" fill="var(--red)" opacity=".08"/>
      <polyline points="${pts}" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      ${rs.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.score)}" r="${i === rs.length - 1 ? 5 : 3}" fill="var(--${cls(r.score) === 'na' ? 'na' : cls(r.score)})"/>`).join('')}
      <text x="${Math.min(x(rs.length - 1), w - 40)}" y="${Math.max(y(last.score) - 10, 12)}" font-size="12" font-weight="700" fill="var(--ink)">${last.score}%</text></svg>`;
  }
  function actStatusPill(a) {
    if (a.status === 'done') return `<span class="pill ok">${t('done')}</span>`;
    if (a.due && a.due < today()) return `<span class="pill bad">${t('late')}</span>`;
    return a.status === 'doing' ? `<span class="pill warn">${t('inprogress')}</span>` : `<span class="pill na">${t('open')}</span>`;
  }
  function actCard(a) {
    const late = a.status !== 'done' && a.due && a.due < today();
    const btns = a.status === 'done' ? `<button class="btn sm" data-act="astat" data-id="${a.id}" data-v="open">${t('reopen')}</button>`
      : `${a.status === 'open' ? `<button class="btn sm" data-act="astat" data-id="${a.id}" data-v="doing">${t('start')}</button>` : ''}<button class="btn sm red" data-act="astat" data-id="${a.id}" data-v="done">${svg(IC.check, 14, 3)} ${t('markDone')}</button>`;
    return `<div class="act-card" data-late="${late ? 1 : 0}">
      <div class="row" style="justify-content:space-between"><b class="muted" style="font-size:12px">${esc(a.itemId || '')} · ${typeName(a.reportType || 'daily')}</b>${actStatusPill(a)}</div>
      <div class="t">${esc(a.text)}</div>${a.note ? `<div class="muted" style="font-size:13.5px">« ${esc(a.note)} »</div>` : ''}
      <div class="m"><span>${esc(a.assignee || t('unassigned'))}</span><span style="${late ? 'color:var(--bad);font-weight:700' : ''}">${t('due')} ${fmtDate(a.due)}</span>${a.doneAt ? `<span>✓ ${fmtDate(a.doneAt.slice(0, 10))}</span>` : ''}</div>
      <input class="input" style="min-height:38px;padding:7px 11px;font-size:14px" id="ac-${a.id}" data-act="acomment" data-id="${a.id}" value="${esc(a.comment || '')}" placeholder="${A.lang === 'fr' ? 'Commentaire de suivi…' : 'Follow-up comment…'}">
      <div class="row">${btns}${a.reportId ? `<button class="btn sm ghost" data-act="open" data-id="${a.reportId}">${t('view')}</button>` : ''}</div></div>`;
  }
  function histRow(r) {
    const [, m, d] = r.date.split('-').map(Number);
    return `<button class="lrow" data-act="open" data-id="${r.id}"><div class="datebox"><b>${d}</b><span>${MONTHS[A.lang][m - 1]}</span></div>
      <div class="main"><div class="t">${typeName(r.type)}${r.type === 'daily' && r.shift ? ' · ' + t('shifts')[r.shift] : ''}</div><div class="m">${esc(r.time)} · ${esc(r.manager)} · ${r.nok} ${t('nc')}${r._pending ? ' · ' + t('pending') : ''}</div></div>
      <span class="pill ${cls(r.score)}">${r.score == null ? '—' : r.score + '%'}</span></button>`;
  }

  /* ----- Réglages superviseur ----- */
  function viewSettings() {
    const emps = A.settingsDraft || (A.settingsDraft = clone(A.cfg.employees));
    return `<div class="hero"><div><button class="btn ghost sm" data-act="home" style="margin-left:-10px">${svg(IC.back, 18)} ${t('daily')}</button><h1>${t('settings')}</h1></div></div>
      <section class="card"><div class="card-h"><h2>${t('team')}</h2><span class="muted">${emps.length}</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
        ${emps.map((e, i) => `<div class="row"><input class="input" style="flex:2;min-width:150px" id="se-n-${i}" data-emp="${i}" data-k="name" value="${esc(e.name)}" aria-label="${t('name')}"><input class="input" style="flex:2;min-width:150px" id="se-r-${i}" data-emp="${i}" data-k="role" value="${esc(e.role || '')}" aria-label="${t('role')}"><button class="btn sm ghost" data-act="rmEmp" data-i="${i}" aria-label="${t('delete')}">${svg(IC.trash, 16)}</button></div>`).join('')}
        <div class="row"><input class="input" style="flex:2;min-width:150px" id="se-new" placeholder="${t('name')}"><input class="input" style="flex:2;min-width:150px" id="se-newr" placeholder="${t('role')}"><button class="btn sm" data-act="addEmp">${t('addEmp')}</button></div>
        <button class="btn red" data-act="saveEmps">${t('save')}</button></div></section>
      <section class="card"><div class="card-h"><h2>${t('postMsg')}</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
        <textarea class="input" id="msgText" placeholder="${t('message')}"></textarea><button class="btn red" data-act="postMsg">${svg(IC.send, 16)} ${t('publish')}</button>
        ${A.messages.length ? A.messages.slice().reverse().map(m => `<div class="msg"><div>${esc(m.text)}</div><div class="m">${esc(m.author || '')} · ${fmtDate((m.date || '').slice(0, 10))} <button class="btn sm ghost" data-act="delMsg" data-id="${m.id}">${svg(IC.trash, 14)}</button></div></div>`).join('') : ''}
      </div></section>`;
  }

  /* ----- Menu latéral ----- */
  function renderDrawer() {
    const dr = $('#drawer'); dr.hidden = !A.menuOpen; $('#menuBtn').setAttribute('aria-expanded', A.menuOpen);
    if (!A.menuOpen) return;
    const unread = A.messages.filter(m => !A.readMsgs.includes(m.id)).length;
    const acc = (id, color, icon, title, sub, body) => `<div class="acc" data-open="${A.acc[id] ? 1 : 0}"><button class="acc-h" data-act="acc" data-id="${id}" aria-expanded="${!!A.acc[id]}"><span class="acc-ico" style="background:${color[0]};color:${color[1]}">${svg(icon, 24)}</span><span class="acc-t"><b>${title}</b><span>${sub}</span></span><span class="acc-caret">${svg(IC.down, 22, 2.6)}</span></button>${A.acc[id] ? `<div class="acc-body">${body}</div>` : ''}</div>`;
    const msgs = A.messages.length ? A.messages.slice().reverse().map(m => `<div class="msg"><div>${esc(m.text)}</div><div class="m">${esc(m.author || '')} · ${fmtDate((m.date || '').slice(0, 10))}</div></div>`).join('') : `<div class="muted">${t('commsNone')}</div>`;
    const res = `<div><div class="eyebrow">${t('procedures')}</div>${DATA.procedures.map(p => `<details class="proc"><summary>${esc(L(p.title))} ${svg(IC.down, 18)}</summary><ol>${p.steps.map(s => `<li>${esc(L(s))}</li>`).join('')}</ol></details>`).join('')}</div>
      <div><div class="eyebrow">${t('contacts')}</div>${A.cfg.contacts.map((c, i) => `<div class="contact"><div><div class="muted" style="font-size:12.5px">${esc(c.label)}</div><div class="v">${esc(c.value)}</div></div><button class="btn sm" data-act="copy" data-v="${esc(c.value)}">${svg(IC.copy, 14)} ${t('copy')}</button></div>`).join('')}</div>
      ${A.cfg.links.length ? `<div><div class="eyebrow">${t('links')}</div>${A.cfg.links.map(l => `<a class="contact v" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div>` : ''}`;
    const open = A.actions.filter(a => a.status !== 'done').length;
    const repBody = `<div class="row"><span class="pill warn">${open} ${t('openActions').toLowerCase()}</span><span id="syncChip2">${syncChipHtml()}</span></div><button class="btn red block" data-act="goReports">${svg(IC.chart, 16)} ${t('reportsTitle')}</button>`;
    const supBody = A.sup
      ? `<button class="btn block" data-act="startVisit" data-v="monthly">${t('visitMonthly')}</button><button class="btn block" data-act="startVisit" data-v="surprise">${t('visitSurprise')}</button><button class="btn block" data-act="goSettings">${t('settings')} · ${t('team')} · ${t('comms')}</button><button class="btn ghost block" data-act="lock">${svg(IC.lock, 16)} ${t('lock')}</button>`
      : `<form id="pinForm" class="pin-box"><input class="input" id="pin" type="password" inputmode="numeric" autocomplete="off" aria-label="${t('pin')}" placeholder="••••"><button class="btn red" type="submit">${t('unlock')}</button></form>`;
    $('#drawerBody').innerHTML =
      acc('comms', ['#DDF3F4', '#0F7C84'], IC.mega, t('comms'), unread ? `${unread} ${t('commsN')}` : (A.messages.length ? `${A.messages.length} ${t('commsN')}` : t('commsNone')), msgs) +
      acc('res', ['#E3F3E6', '#2F7D3E'], IC.link, t('resources'), t('resourcesSub'), res) +
      acc('rep', ['#FFF4D6', '#9A6B00'], IC.chart, t('reports'), `${A.reports.length} ${t('reportsN')}`, repBody) +
      acc('sup', ['#FBE3E6', '#B0001A'], IC.lock, t('supervisor'), A.sup ? '✓' : t('protected'), supBody) +
      `<button class="btn block" style="margin-top:6px" data-app-update>Mettre à jour l'application</button>` +
      `<div class="drawer-foot">MINISO · ${esc(storeLabel(A.cfg.stores[0]?.code))} · ${t('footer')}</div>`;
    if (A.acc.comms && unread) { A.readMsgs = [...new Set([...A.readMsgs, ...A.messages.map(m => m.id)])]; ls.set('readMsgs', A.readMsgs); $('#menuBadge').hidden = true; }
  }

  /* ----- Rapport (fenêtre) ----- */
  function renderModal() {
    const root = $('#modal');
    if (!A.modal) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
    const r = A.reports.find(x => x.id === A.modal.id); if (!r) { A.modal = null; root.innerHTML = ''; return; }
    document.body.style.overflow = 'hidden';
    const below = r.score != null && r.score < A.cfg.threshold;
    const R = 38, C = 2 * Math.PI * R, v = r.score || 0;
    const secs = tpl(r.type).map(s => {
      if (s.optional && !(r.sections || {})[s.id]) return '';
      return `<section class="card"><div class="card-h"><h2 style="font-size:14.5px">${s.id} · ${esc(L(s.title))}</h2></div><div class="card-b" style="padding-block:4px">${s.items.map(it => {
        const x = (r.results || {})[it.id] || {};
        const p = x.s === 'ok' ? `<span class="pill ok">${t('ok')}</span>` : x.s === 'nok' ? `<span class="pill bad">${t('nc')}</span>` : x.s === 'info' ? `<span class="pill na">${esc(x.v)} ${esc(it.unit || '')}</span>` : x.s === 'na' ? `<span class="pill na">${t('na')}</span>` : `<span class="pill na">—</span>`;
        return `<div class="rep-line"><b class="muted" style="width:48px;flex:none;font-size:11.5px">${it.id}</b><div style="flex:1;min-width:0">${esc(L(it.text))}${x.v !== undefined && x.v !== '' && x.s !== 'info' ? ` <b class="num">(${esc(x.v)} ${esc(it.unit || '')})</b>` : ''}${x.note ? `<div class="muted" style="font-size:13px">${esc(x.note)}</div>` : ''}${(x.photos || []).length ? `<div class="thumbs" style="margin-top:6px">${x.photos.map(pid => `<div class="thumb" style="width:96px;height:96px"><img data-pid="${pid}" alt=""></div>`).join('')}</div>` : ''}${x.s === 'nok' && x.plan ? `<div style="font-size:13px;color:var(--bad);font-weight:700;margin-top:3px">→ ${esc(x.plan.text)}${x.plan.assignee ? ' · ' + esc(x.plan.assignee) : ''}${x.plan.due ? ' · ' + fmtDate(x.plan.due) : ''}</div>` : ''}</div>${p}</div>`;
      }).join('')}</div></section>`;
    }).join('');
    root.innerHTML = `<div class="modal" data-act="closeModal"><div class="modal-panel" role="dialog" aria-modal="true" data-stop="1">
      <div class="modal-h"><div><div class="eyebrow">MINISO · ${esc(storeLabel(r.store))}</div><h2 style="font-size:20px">${typeName(r.type)} · ${fmtDate(r.date)} ${esc(r.time)}</h2></div><button class="round-x no-print" style="background:var(--sunken);color:var(--ink)" data-act="closeModal" aria-label="${t('close')}">${svg(IC.x, 18, 2.6)}</button></div>
      <div class="modal-b">
        <div class="stamp"><svg class="ring" viewBox="0 0 90 90"><circle cx="45" cy="45" r="${R}" fill="none" stroke="var(--sunken)" stroke-width="9"/><circle cx="45" cy="45" r="${R}" fill="none" stroke="var(--${cls(r.score) === 'na' ? 'na' : cls(r.score)})" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C * v / 100} ${C}" transform="rotate(-90 45 45)"/><text x="45" y="51" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="800" font-size="19" fill="var(--ink)">${r.score == null ? '—' : r.score + '%'}</text></svg>
          <div style="display:flex;flex-direction:column;gap:6px"><b>${esc(r.manager)}${r.type === 'daily' && r.shift ? ' · ' + t('shifts')[r.shift] : ''}</b>
          <div class="counts"><span class="pill ok">${r.ok} ${t('itemsOk')}</span><span class="pill bad">${r.nok} ${t('nc')}</span><span class="pill na">${r.na} ${t('na')}</span></div>
          <span class="pill ${below ? 'bad' : 'ok'}" style="align-self:flex-start">${below ? t('actionRequired') : t('aboveThr')}</span>
          <span class="muted" style="font-size:12.5px">${r._pending ? t('pending') : syncOn() ? t('synced') : t('local')}</span></div></div>
        <div class="row no-print"><button class="btn red" data-act="send" data-id="${r.id}">${svg(IC.send, 16)} ${t('sendReport')}</button><button class="btn" data-act="print">${svg(IC.print, 16)} ${t('print')}</button><button class="btn" data-act="copyRep" data-id="${r.id}">${svg(IC.copy, 16)} ${t('copy')}</button>
          ${A.sup ? (A.confirm === 'del' + r.id ? `<span class="confirm">${t('delete')} ? <button class="btn sm danger" data-act="delRepYes" data-id="${r.id}">${t('yes')}</button><button class="btn sm" data-act="cancelConfirm">${t('cancel')}</button></span>` : `<button class="btn danger" data-act="delRep" data-id="${r.id}">${svg(IC.trash, 16)}</button>`) : ''}</div>
        <div class="muted no-print" style="font-size:12.5px">${t('emailHint')} <b>${esc(A.cfg.reportEmail)}</b></div>
        ${r.notes ? `<section class="card"><div class="card-b"><div class="eyebrow">${t('comments')}</div><p style="margin:6px 0 0">${esc(r.notes)}</p></div></section>` : ''}
        ${secs}</div></div></div>`;
    hydratePhotos(root, r);
  }
  function reportText(r) {
    const L2 = [];
    L2.push(`MINISO — ${storeLabel(r.store)}`);
    L2.push(`${typeName(r.type).toUpperCase()}${r.type === 'daily' && r.shift ? ' · ' + t('shifts')[r.shift] : ''} — ${fmtDate(r.date)} ${r.time}`);
    L2.push(`${r.type === 'daily' ? t('manager') : t('supervisorName')} : ${r.manager}`);
    L2.push(`${t('score')} : ${r.score == null ? '—' : r.score + ' %'} (${t('thr').toLowerCase()} ${A.cfg.threshold} %) — ${r.ok} ${t('itemsOk')}, ${r.nok} ${t('nc')}, ${r.na} ${t('na')}`);
    if (r.score != null && r.score < A.cfg.threshold) L2.push('🔴 ' + t('actionRequired').toUpperCase());
    const nok = Object.entries(r.results || {}).filter(([, x]) => x.s === 'nok');
    if (nok.length) {
      L2.push('', A.lang === 'fr' ? 'NON-CONFORMITÉS ET PLAN D\'ACTION' : 'NON-COMPLIANCES AND ACTION PLAN');
      nok.forEach(([k, x]) => { const it = itemOf(r.type, k); L2.push(`• [${k}] ${it ? L(it.text) : k}${x.v !== undefined && x.v !== '' ? ` (${x.v} ${it?.unit || ''})` : ''}${x.note ? ' — ' + x.note : ''}`); if (x.plan) L2.push(`   → ${x.plan.text}${x.plan.assignee ? ' · ' + x.plan.assignee : ''}${x.plan.due ? ' · ' + fmtDate(x.plan.due) : ''}`); });
    }
    const info = Object.entries(r.results || {}).filter(([, x]) => x.s === 'info');
    if (info.length) { L2.push(''); info.forEach(([k, x]) => { const it = itemOf(r.type, k); L2.push(`• ${it ? L(it.text) : k} : ${x.v} ${it?.unit || ''}`); }); }
    if (r.notes) L2.push('', `${t('comments')} : ${r.notes}`);
    return L2.join('\n');
  }
  async function sendReport(r) {
    const subject = `MINISO ${r.store} — ${typeName(r.type)} ${r.date} — ${r.score == null ? '—' : r.score + '%'}${r.score != null && r.score < A.cfg.threshold ? ' 🔴' : ''}`;
    const body = reportText(r);
    const files = [];
    for (const x of Object.values(r.results || {})) for (const pid of x.photos || []) { const p = await DB.get('photos', pid).catch(() => null); if (p) files.push(dataUrlToFile(p, `${r.store}-${r.date}-${files.length + 1}.jpg`)); }
    try {
      if (navigator.canShare && files.length && navigator.canShare({ files })) { await navigator.share({ title: subject, text: body, files }); return; }
      if (navigator.share && !files.length && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ title: subject, text: body }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    location.href = `mailto:${encodeURIComponent(A.cfg.reportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------------- Événements ---------------- */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    if ((act === 'closeModal') && el.classList.contains('modal') && e.target.closest('[data-stop]')) return;
    const d = A.drafts[A.type];
    switch (act) {
      case 'closeMenu': A.menuOpen = false; renderDrawer(); break;
      case 'acc': A.acc[id] = !A.acc[id]; ls.set('acc', A.acc); renderDrawer(); break;
      case 'goReports': A.menuOpen = false; A.view = 'reports'; render(); window.scrollTo(0, 0); pull(); break;
      case 'goSettings': A.menuOpen = false; A.view = 'settings'; A.settingsDraft = null; render(); window.scrollTo(0, 0); break;
      case 'home': A.view = 'check'; render(); window.scrollTo(0, 0); break;
      case 'startVisit': A.menuOpen = false; A.view = 'check'; await switchType(el.dataset.v); break;
      case 'type': await switchType(el.dataset.v); break;
      case 'lock': A.sup = false; sessionStorage.removeItem('mc-sup'); if (A.type !== 'daily') await switchType('daily'); else render(); break;
      case 'sec': A.openSecs[A.type + id] = !A.openSecs[A.type + id]; render(); break;
      case 'expandAll': tpl(A.type).forEach(s => A.openSecs[A.type + s.id] = true); render(); break;
      case 'collapseAll': A.openSecs = {}; render(); break;
      case 'fillOk': { let n = 0; tpl(A.type).forEach(s => { if (!A.openSecs[A.type + s.id] || (s.optional && !d.sections[s.id])) return; s.items.forEach(it => { if (it.kind === 'number') return; const r = d.results[it.id] || (d.results[it.id] = {}); if (!r.s) { r.s = 'ok'; n++; } }); }); render(); saveDraftSoon(); toast(`${n} ✓`); break; }
      case 'set': { const it = itemOf(A.type, id); const r = d.results[id] || (d.results[id] = {}); r.s = r.s === el.dataset.v ? '' : el.dataset.v; if (r.s === 'nok' && !r.plan) r.plan = defaultPlan(it); render(); saveDraftSoon(); break; }
      case 'rmPhoto': { const r = d.results[id]; r.photos = (r.photos || []).filter(p => p !== el.dataset.pid); DB.del('photos', el.dataset.pid).catch(() => { }); render(); saveDraftSoon(); break; }
      case 'reset': A.confirm = 'reset'; render(); break;
      case 'resetYes': { for (const r of Object.values(d.results)) for (const p of r.photos || []) DB.del('photos', p).catch(() => { }); A.drafts[A.type] = newDraft(A.type); A.confirm = null; A.openSecs = {}; await DB.del('kv', 'draft-' + A.type); render(); break; }
      case 'cancelConfirm': A.confirm = null; render(); break;
      case 'submit': submit(); break;
      case 'open': A.modal = { kind: 'report', id }; A.confirm = null; renderModal(); break;
      case 'closeModal': A.modal = null; A.confirm = null; renderModal(); break;
      case 'send': { const r = A.reports.find(x => x.id === id); if (r) sendReport(r); break; }
      case 'print': window.print(); break;
      case 'copyRep': { const r = A.reports.find(x => x.id === id); if (r) copyText(reportText(r)); break; }
      case 'copy': copyText(el.dataset.v); break;
      case 'delRep': A.confirm = 'del' + id; renderModal(); break;
      case 'delRepYes': { const r = A.reports.find(x => x.id === id); if (r) { for (const x of Object.values(r.results || {})) for (const p of x.photos || []) DB.del('photos', p).catch(() => { }); } await DB.del('reports', id); if (syncOn()) api('deleteReport', { id, pin: A.cfg.supervisorPin }).catch(() => { }); A.modal = null; A.confirm = null; await loadAll(); render(); break; }
      case 'rtab': A.rep.tab = el.dataset.v; render(); break;
      case 'astat': {
        const a = A.actions.find(x => x.id === id); if (!a) break;
        const upd = { ...a, status: el.dataset.v, updatedAt: new Date().toISOString(), _pending: syncOn() };
        if (upd.status === 'done') upd.doneAt = upd.updatedAt; else delete upd.doneAt;
        await DB.put('actions', id, upd); await loadAll(); render(); flush(); break;
      }
      case 'sync': await flush(); await pull(); break;
      case 'addEmp': { const n = $('#se-new').value.trim(); if (n) { A.settingsDraft.push({ name: n, role: $('#se-newr').value.trim() }); render(); } break; }
      case 'rmEmp': A.settingsDraft.splice(+el.dataset.i, 1); render(); break;
      case 'saveEmps': {
        const employees = A.settingsDraft.filter(x => x.name && x.name.trim());
        const over = { ...ls.get('cfg', {}), employees }; ls.set('cfg', over); A.cfg.employees = employees;
        if (syncOn()) { try { await api('saveConfig', { pin: A.cfg.supervisorPin, config: { employees } }); } catch (err) { toast(t('sendFail'), 'bad'); } }
        toast('✓ ' + t('save')); A.settingsDraft = null; render(); break;
      }
      case 'postMsg': {
        const text = $('#msgText').value.trim(); if (!text) break;
        const m = { id: uid(), text, author: A.lang === 'fr' ? 'Direction' : 'Management', date: new Date().toISOString() };
        A.messages = [...A.messages, m]; ls.set('messages', A.messages);
        if (syncOn()) { try { await api('saveMessage', { pin: A.cfg.supervisorPin, item: m }); } catch (err) { toast(t('sendFail'), 'bad'); } }
        toast(t('published')); render(); break;
      }
      case 'delMsg': A.messages = A.messages.filter(m => m.id !== id); ls.set('messages', A.messages); if (syncOn()) api('deleteMessage', { pin: A.cfg.supervisorPin, id }).catch(() => { }); render(); break;
    }
  });
  document.addEventListener('change', async e => {
    const el = e.target; const d = A.drafts[A.type];
    if (el.dataset.f && d) { d[el.dataset.f] = el.value; if (el.dataset.f === 'shift') { if (el.value === 'fermeture') d.sections.FER = true; render(); } saveDraftSoon(); return; }
    if (el.dataset.act === 'secOn') { d.sections[el.dataset.id] = el.checked; render(); saveDraftSoon(); return; }
    if (el.dataset.act === 'plan') { const r = d.results[el.dataset.id]; r.plan = r.plan || {}; r.plan[el.dataset.k] = el.value; saveDraftSoon(); return; }
    if (el.dataset.act === 'num') {
      const it = itemOf(A.type, el.dataset.id); const r = d.results[el.dataset.id] || (d.results[el.dataset.id] = {});
      r.v = el.value === '' ? '' : Number(el.value); const prev = r.s; r.s = evalNumber(it, r.v);
      if (r.s === 'nok' && !r.plan) r.plan = defaultPlan(it, ` (${t('reading')} ${r.v} ${it.unit || ''})`);
      if (prev !== r.s) render(); else refreshLive(); saveDraftSoon(); return;
    }
    if (el.dataset.act === 'photo' && el.files && el.files[0]) {
      try { const data = await compress(el.files[0]); const pid = uid(); await DB.put('photos', pid, data); A.photoCache[pid] = data; const r = d.results[el.dataset.id] || (d.results[el.dataset.id] = {}); (r.photos = r.photos || []).push(pid); render(); saveDraftSoon(); toast(t('photoAdded')); }
      catch (err) { toast(t('photoErr'), 'bad'); }
      return;
    }
    if (el.dataset.rf) { A.rep[el.dataset.rf] = el.value; render(); return; }
    if (el.dataset.act === 'acomment') {
      const a = A.actions.find(x => x.id === el.dataset.id); if (!a || (a.comment || '') === el.value) return;
      await DB.put('actions', a.id, { ...a, comment: el.value, updatedAt: new Date().toISOString(), _pending: syncOn() }); await loadAll(); flush(); toast('✓'); return;
    }
    if (el.dataset.emp != null && A.settingsDraft) { A.settingsDraft[+el.dataset.emp][el.dataset.k] = el.value; }
  });
  document.addEventListener('input', e => {
    const el = e.target; const d = A.drafts[A.type]; if (!d || A.view !== 'check') return;
    if (el.dataset.act === 'note') { const r = d.results[el.dataset.id] || (d.results[el.dataset.id] = {}); r.note = el.value; saveDraftSoon(); }
    else if (el.dataset.f === 'notes' || el.dataset.f === 'manager') { d[el.dataset.f] = el.value; saveDraftSoon(); }
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'pinForm') return; e.preventDefault();
    if ($('#pin').value === String(A.cfg.supervisorPin)) { A.sup = true; sessionStorage.setItem('mc-sup', '1'); toast('✓'); renderDrawer(); render(); }
    else { toast(t('wrongPin'), 'bad'); $('#pin').value = ''; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (A.modal) { A.modal = null; renderModal(); } else if (A.menuOpen) { A.menuOpen = false; renderDrawer(); } } });
  $('#menuBtn').addEventListener('click', () => { A.menuOpen = true; renderDrawer(); });
  $('#langBtn').addEventListener('click', () => { A.lang = A.lang === 'fr' ? 'en' : 'fr'; ls.set('lang', A.lang); render(); });
  window.addEventListener('online', () => { flush(); pull(); });

  async function switchType(type) {
    if (type !== 'daily' && !A.sup) type = 'daily';
    A.type = type; A.confirm = null; A.saveState = '';
    if (!A.drafts[type]) { const saved = await DB.get('kv', 'draft-' + type).catch(() => null); A.drafts[type] = saved || newDraft(type); if (saved) A.saveState = t('resumeDraft'); }
    render(); window.scrollTo(0, 0);
  }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); toast(t('copied')); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(t('copied')); } catch (x) { } ta.remove(); }
  }
  function toast(msg, kind) { const w = $('#toasts'); const el = document.createElement('div'); el.className = 'toast' + (kind === 'bad' ? ' bad' : ''); el.textContent = msg; w.appendChild(el); setTimeout(() => el.remove(), kind === 'bad' ? 4500 : 2600); }

  /* ---------------- Démarrage ---------------- */
  (async function boot() {
    A.messages = ls.get('messages', []);
    render();
    try { await loadAll(); const saved = await DB.get('kv', 'draft-daily'); if (saved) { A.drafts.daily = saved; A.saveState = t('resumeDraft'); } } catch (e) { }
    render();
    if (syncOn()) { await flush(); await pull(); setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 120000); }
  })();
})();
