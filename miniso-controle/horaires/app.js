/* MINISO · Horaires — comptes employés, horaire, disponibilités, congés, échanges, budget */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, linkWithCredential, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  collection, query, where, limit, onSnapshot, writeBatch, documentId, arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const C = window.HORAIRES_CONFIG || {};
C.store = C.store || { code: '', name: '' };
const WEEK0 = Number(C.weekStartsOn) || 0;
const OWNER = String(C.ownerEmail || '').toLowerCase();

/* ---------------- Utilitaires ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const weekOf = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() - WEEK0 + 7) % 7)); return iso(d); };
const weekDays = w => Array.from({ length: 7 }, (_, i) => addDays(w, i));
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const nowISO = () => new Date().toISOString();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDay = s => { const d = parse(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtLong = s => { const d = parse(s); return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtStamp = t => { if (!t) return ''; const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]} à ${d.getHours()} h ${pad(d.getMinutes())}`; };
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
const fmtT = t => { const [h, m] = t.split(':'); return `${Number(h)} h ${m}`; };
const hm = t => { const [h, m] = t.split(':'); return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`; };
const fmtDur = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h} h ${pad(m)}` : `${h} h`; };
const shiftMin = s => { let d = toMin(s.end) - toMin(s.start); if (d <= 0) d += 1440; return d; };
const endMin = s => toMin(s.start) + shiftMin(s);
const paidMin = s => Math.max(0, shiftMin(s) - (Number(s.breakMin) || 0));
const money = n => Number(n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
const uidRand = () => Math.random().toString(36).slice(2, 8);
const feedId = () => String(9999999999999 - Date.now()).padStart(13, '0') + uidRand();
const byDT = (a, b) => (a.date + a.start).localeCompare(b.date + b.start);
const docsOf = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const mergeById = arr => Object.values(Object.fromEntries(arr.map(x => [x.id, x])));
const ls = {
  get(k, d) { try { const v = localStorage.getItem('mh-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mh-' + k, JSON.stringify(v)); } catch (e) { } }
};

/* ---------------- Icônes ---------------- */
const svg = (p, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
};

/* ---------------- Firebase ---------------- */
const configured = !!(C.firebase && C.firebase.apiKey && C.firebase.projectId);
let auth = null, db = null;
// App installée (écran d'accueil iPhone) : la connexion Google passe par l'adresse de l'app elle-même
const standaloneMode = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
// Google dans l'app installée : activé automatiquement dès que Google accepte l'adresse de l'app
let googleInstalled = !!C.googleInstalledApp;
if (configured && standaloneMode && !googleInstalled && C.googleSignIn !== false && !C.emulator && C.authProxyHost && location.host === C.authProxyHost) {
  try { googleInstalled = localStorage.getItem('googleInstalledReady') === '1'; } catch { }
  if (!googleInstalled) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch('/api/google-ready', { signal: ctl.signal }); clearTimeout(t);
      googleInstalled = !!(r.ok && (await r.json()).ready);
      if (googleInstalled) try { localStorage.setItem('googleInstalledReady', '1'); } catch { }
    } catch { }
  }
}
if (configured) {
  const fbConf = { ...C.firebase };
  if (standaloneMode && googleInstalled && C.authProxyHost && location.host === C.authProxyHost) fbConf.authDomain = C.authProxyHost;
  const app = initializeApp(fbConf);
  // Session conservée sur l'appareil jusqu'à « Se déconnecter » (aucune expiration automatique)
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  auth.languageCode = 'fr';
  db = getFirestore(app);
  if (C.emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

/* ---------------- État ---------------- */
const DEFAULT_SETTINGS = {
  positions: [
    { id: 'caisse', name: 'Caisse', color: '#D7001D' },
    { id: 'plancher', name: 'Plancher', color: '#1F6FEB' },
    { id: 'reserve', name: 'Réserve et réception', color: '#8250DF' },
    { id: 'visuel', name: 'Visuel', color: '#BF8700' },
    { id: 'resp', name: 'Responsable de quart', color: '#1A7F37' }
  ],
  presets: [
    { label: 'Ouverture', start: '09:00', end: '17:00', breakMin: 30 },
    { label: 'Jour', start: '10:00', end: '18:00', breakMin: 30 },
    { label: 'Soir', start: '13:00', end: '21:00', breakMin: 30 },
    { label: 'Court', start: '17:00', end: '21:00', breakMin: 0 }
  ]
};
const COLORS = ['#D7001D', '#1F6FEB', '#8250DF', '#1A7F37', '#BF8700', '#0A7EA4', '#D1245F', '#6E40C9', '#9A6700', '#2D6A4F'];
const TO_TYPES = [['vacances', 'Vacances'], ['maladie', 'Maladie'], ['personnel', 'Raison personnelle'], ['etudes', 'Études / examens'], ['famille', 'Obligations familiales'], ['autre', 'Autre']];
const NAV_MGR = [['schedule', 'Horaire', 'cal'], ['requests', 'Demandes', 'inbox'], ['staff', 'Équipe', 'team'], ['budget', 'Budget', 'chart'], ['profile', 'Compte', 'me']];
const NAV_EMP = [['mine', 'Mon horaire', 'cal'], ['team', 'Équipe', 'team'], ['swaps', 'Échanges', 'swap'], ['requests', 'Demandes', 'inbox'], ['profile', 'Compte', 'me']];

const S = {
  authReady: false, user: null, profile: undefined, contact: null, signingUp: false,
  view: ls.get('view', null), authView: location.hash === '#inscription' ? 'signup' : 'email', msg: null,
  week: weekOf(today()), subKey: '', draft: {}, confirm: null, modal: null, pendingRender: false,
  readFeed: ls.get('readFeed', []), issuesOpen: false, reqTab: 'conges'
};
function resetData() {
  Object.assign(S, {
    profile: undefined, contact: null, users: [], shifts: [], weekDoc: null, budget: null, myShifts: [], myWeeks: {},
    avail: {}, myAvail: null, availDraft: null, availDirty: false, timeoff: [], swaps: [], swapsFrom: [], swapsTaken: [],
    feedA: [], feedB: [], wages: {}, contacts: {}, settings: DEFAULT_SETTINGS, setDraft: null,
    modal: null, confirm: null, subKey: '', toConf: {}, swapConf: {}
  });
}
resetData();

const subs = {};
function sub(key, make) { unsub(key); try { subs[key] = make(); } catch (e) { console.warn(key, e); } }
function unsub(key) { if (subs[key]) { try { subs[key](); } catch (e) { } delete subs[key]; } }
function unsubAll() { Object.keys(subs).forEach(unsub); }
function stopAppSubs() { Object.keys(subs).forEach(k => { if (k !== 'me' && k !== 'myContact') unsub(k); }); }
const onErr = key => e => { console.warn('Firestore', key, e && e.code); if (e && e.code !== 'permission-denied') toast('Connexion perdue. Vérifiez Internet.', 'bad'); };

/* ---------------- Rôles ---------------- */
const isOwnerEmail = u => !!u && String(u.email || '').toLowerCase() === OWNER;
const isOwner = () => isOwnerEmail(S.user) && !!S.user.emailVerified;
const isActive = () => isOwner() || (S.profile && S.profile.status === 'active');
const isManager = () => isOwner() || (S.profile && S.profile.status === 'active' && S.profile.role === 'manager');

/* ---------------- Données dérivées ---------------- */
const userById = id => S.users.find(u => u.id === id);
const fullName = u => u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
const shortName = u => u ? `${u.firstName || ''}${u.lastName ? ' ' + u.lastName.charAt(0) + '.' : ''}` : '';
const nameOf = id => { if (S.user && id === S.user.uid) return 'vous'; const u = userById(id); return u ? shortName(u) : 'un collègue'; };
const initials = u => ((u?.firstName || '?').charAt(0) + (u?.lastName || '').charAt(0)).toUpperCase();
const isRobot = u => !!u && (u.id === C.robotUid || u.position === '__system');
const realUsers = () => S.users.filter(u => !isRobot(u));
const activeUsers = () => realUsers().filter(u => u.status === 'active').sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
const posOf = id => S.settings.positions.find(p => p.id === id) || { id: '', name: 'Sans poste', color: '#8A817E' };
const offsFor = uid => S.timeoff.filter(o => o.uid === uid && (o.status === 'approved' || o.status === 'pending'));
const defaultAvail = () => ({ days: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, { type: 'all', from: '09:00', to: '17:00' }])), maxHours: '', note: '' });
const normAvail = a => { const d = defaultAvail(); if (a && a.days) for (let i = 0; i < 7; i++) if (a.days[i]) d.days[i] = { ...d.days[i], ...a.days[i] }; d.maxHours = a?.maxHours ?? ''; d.note = a?.note ?? ''; return d; };
function feedItems() {
  const me = S.user?.uid;
  return mergeById([...S.feedA, ...S.feedB]).filter(f => f.audience === 'all' || f.audience === me).sort((a, b) => a.id.localeCompare(b.id));
}
const unreadCount = () => feedItems().filter(f => !S.readFeed.includes(f.id)).length;
const signupLink = () => location.origin + location.pathname + '#inscription';
const dv = (id, def) => Object.prototype.hasOwnProperty.call(S.draft, id) ? S.draft[id] : def;
const clearDraft = prefix => Object.keys(S.draft).forEach(k => { if (k.startsWith(prefix)) delete S.draft[k]; });
const val = id => ($('#' + id)?.value || '').trim();

/* ---------------- Rappels des normes du travail (Québec) ---------------- */
function overlaps(a, b) { return toMin(a.start) < endMin(b) && toMin(b.start) < endMin(a); }
function shiftIssues(s, weekShifts, avail, offs) {
  const out = [], dur = shiftMin(s);
  if (dur < 180) out.push({ lvl: 'warn', t: 'Quart de moins de 3 h : indemnité de présence de 3 h (LNT, art. 58)' });
  if (dur > 300 && (Number(s.breakMin) || 0) < 30) out.push({ lvl: 'warn', t: 'Plus de 5 h sans pause repas de 30 min (LNT, art. 79)' });
  if (weekShifts.some(x => x.id !== s.id && x.date === s.date && overlaps(x, s))) out.push({ lvl: 'err', t: 'Chevauche un autre quart' });
  const a = avail && avail.days && avail.days[parse(s.date).getDay()];
  if (a && a.type === 'none') out.push({ lvl: 'warn', t: 'Indisponible ce jour-là' });
  else if (a && a.type === 'range' && (toMin(s.start) < toMin(a.from) || endMin(s) > toMin(a.to))) out.push({ lvl: 'warn', t: `Hors disponibilités (${fmtT(a.from)} – ${fmtT(a.to)})` });
  for (const o of offs || []) {
    if (s.date < o.from || s.date > o.to) continue;
    if (!o.allDay && o.start && o.end && !(toMin(s.start) < toMin(o.end) && toMin(o.start) < endMin(s))) continue;
    out.push(o.status === 'approved' ? { lvl: 'err', t: 'Employé en congé approuvé' } : { lvl: 'info', t: 'Demande de congé en attente pour ce jour' });
  }
  return out;
}
function weekIssues(uid, list, avail) {
  const paid = list.reduce((a, s) => a + paidMin(s), 0), out = [];
  if (paid > 2400) out.push({ lvl: 'warn', t: `${fmtDur(paid)} planifiées : heures supplémentaires à taux et demi au-delà de 40 h (LNT, art. 55)` });
  if (avail && avail.maxHours && paid > Number(avail.maxHours) * 60) out.push({ lvl: 'info', t: `Au-delà du maximum souhaité de ${avail.maxHours} h` });
  if (list.length) {
    const w = weekOf(list[0].date);
    const iv = list.map(s => { const st = daysBetween(w, s.date) * 1440 + toMin(s.start); return [st, st + shiftMin(s)]; }).sort((a, b) => a[0] - b[0]);
    let gap = iv[0][0], end = iv[0][1];
    for (const [a, b] of iv.slice(1)) { gap = Math.max(gap, a - end); end = Math.max(end, b); }
    gap = Math.max(gap, 7 * 1440 - end);
    if (gap < 32 * 60) out.push({ lvl: 'warn', t: 'Moins de 32 h de repos consécutif dans la semaine (LNT, art. 78)' });
  }
  return { paid, issues: out };
}
const worst = list => list.some(i => i.lvl === 'err') ? 'err' : list.some(i => i.lvl === 'warn') ? 'warn' : '';
const issueHtml = i => `<div class="iss ${i.lvl}">${svg(i.lvl === 'info' ? IC.clock : IC.alert, 15)}<span>${esc(i.t)}</span></div>`;

/* ---------------- Session ---------------- */
function startSession(user) {
  unsubAll(); resetData();
  S.user = user; S.authReady = true; S.notifSynced = false;
  if (user) refreshNotifState();
  if (!user) { render(true); return; }
  sub('me', () => onSnapshot(doc(db, 'users', user.uid), snap => { S.profile = snap.exists() ? snap.data() : null; onProfile(); }, () => { S.profile = null; onProfile(); }));
  sub('myContact', () => onSnapshot(doc(db, 'contacts', user.uid), snap => { S.contact = snap.exists() ? snap.data() : null; syncVerified(); }, () => { }));
  render(true);
}
async function onProfile() {
  if (isOwner() && S.profile && (S.profile.status !== 'active' || S.profile.role !== 'manager') && !S.bootstrapping) {
    S.bootstrapping = true;
    try { await updateDoc(doc(db, 'users', S.user.uid), { status: 'active', role: 'manager', updatedAt: nowISO() }); }
    catch (e) { console.warn('bootstrap', e); }
    S.bootstrapping = false;
  }
  const key = isActive() ? (isManager() ? 'mgr' : 'emp') : 'none';
  if (key !== S.subKey) { stopAppSubs(); S.subKey = key; if (key !== 'none') startAppSubs(); }
  render();
}
function startAppSubs() {
  const me = S.user.uid, mgr = isManager();
  sub('users', () => onSnapshot(mgr ? collection(db, 'users') : query(collection(db, 'users'), where('status', '==', 'active')), snap => {
    S.users = docsOf(snap);
    // Compte technique des notifications : activé automatiquement par la direction
    const bot = mgr && C.robotUid && S.users.find(u => u.id === C.robotUid && u.status === 'pending');
    if (bot && !S.botApproving) { S.botApproving = true; updateDoc(doc(db, 'users', bot.id), { status: 'active', updatedAt: nowISO() }).catch(e => console.warn('robot', e.code)).finally(() => { S.botApproving = false; }); }
    render();
  }, onErr('users')));
  sub('settings', () => onSnapshot(doc(db, 'settings', 'store'), snap => { S.settings = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) }; render(); }, onErr('settings')));
  sub('swaps', () => onSnapshot(query(collection(db, 'swaps'), where('status', 'in', ['open', 'taken'])), snap => { S.swaps = docsOf(snap); S.swapConf = {}; render(); }, onErr('swaps')));
  sub('swapsFrom', () => onSnapshot(query(collection(db, 'swaps'), where('fromUid', '==', me)), snap => { S.swapsFrom = docsOf(snap); render(); }, onErr('swapsFrom')));
  sub('swapsTaken', () => onSnapshot(query(collection(db, 'swaps'), where('takenBy', '==', me)), snap => { S.swapsTaken = docsOf(snap); render(); }, onErr('swapsTaken')));
  if (mgr) {
    sub('feedA', () => onSnapshot(query(collection(db, 'feed'), limit(100)), snap => { S.feedA = docsOf(snap); render(); }, onErr('feed')));
    sub('timeoff', () => onSnapshot(query(collection(db, 'timeoff'), where('to', '>=', addDays(today(), -120))), snap => { S.timeoff = docsOf(snap); S.toConf = {}; render(); }, onErr('timeoff')));
    sub('avail', () => onSnapshot(collection(db, 'availability'), snap => { S.avail = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); S.myAvail = S.avail[me] || null; if (!S.availDirty) S.availDraft = null; render(); }, onErr('avail')));
    sub('wages', () => onSnapshot(collection(db, 'wages'), snap => { S.wages = Object.fromEntries(snap.docs.map(d => [d.id, d.data().hourly])); render(); }, onErr('wages')));
    sub('contacts', () => onSnapshot(collection(db, 'contacts'), snap => { S.contacts = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); render(); }, onErr('contacts')));
  } else {
    sub('feedA', () => onSnapshot(query(collection(db, 'feed'), where('audience', '==', 'all'), limit(50)), snap => { S.feedA = docsOf(snap); render(); }, onErr('feed')));
    sub('feedB', () => onSnapshot(query(collection(db, 'feed'), where('audience', '==', me), limit(50)), snap => { S.feedB = docsOf(snap); render(); }, onErr('feedMe')));
    sub('timeoff', () => onSnapshot(query(collection(db, 'timeoff'), where('uid', '==', me)), snap => { S.timeoff = docsOf(snap); render(); }, onErr('timeoff')));
    sub('avail', () => onSnapshot(doc(db, 'availability', me), snap => { S.myAvail = snap.exists() ? snap.data() : null; S.avail = { [me]: S.myAvail }; if (!S.availDirty) S.availDraft = null; render(); }, onErr('avail')));
  }
  subWeek(); subMine();
}
function subWeek() {
  if (!isActive()) return;
  const w = S.week, mgr = isManager();
  S.shifts = []; S.weekDoc = null; S.budget = null;
  const q = mgr ? query(collection(db, 'shifts'), where('weekId', '==', w)) : query(collection(db, 'shifts'), where('weekId', '==', w), where('published', '==', true));
  sub('shifts', () => onSnapshot(q, snap => { S.shifts = docsOf(snap); render(); }, onErr('shifts')));
  sub('week', () => onSnapshot(doc(db, 'weeks', w), snap => { S.weekDoc = snap.exists() ? snap.data() : null; render(); }, onErr('week')));
  if (mgr) sub('budget', () => onSnapshot(doc(db, 'budgets', w), snap => { S.budget = snap.exists() ? snap.data() : null; render(); }, onErr('budget')));
}
function subMine() {
  const w0 = weekOf(today()), ws = [w0, addDays(w0, 7), addDays(w0, 14)];
  sub('mine', () => onSnapshot(query(collection(db, 'shifts'), where('uid', '==', S.user.uid), where('weekId', 'in', ws), where('published', '==', true)), snap => { S.myShifts = docsOf(snap); render(); }, onErr('mine')));
  sub('myWeeks', () => onSnapshot(query(collection(db, 'weeks'), where(documentId(), 'in', ws)), snap => { S.myWeeks = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); render(); }, onErr('myWeeks')));
}
async function syncVerified() {
  if (S.user && S.user.emailVerified && S.contact && S.contact.emailVerified !== true) {
    try { await updateDoc(doc(db, 'contacts', S.user.uid), { emailVerified: true, updatedAt: nowISO() }); } catch (e) { }
  }
}
if (configured) {
  getRedirectResult(auth).catch(e => { if (e && e.code && e.code !== 'auth/no-auth-event') showMsg('err', authErr(e)); });
  onAuthStateChanged(auth, async user => {
    if (user && isOwnerEmail(user) && user.emailVerified) { try { await user.getIdToken(true); } catch (e) { } }
    startSession(user);
  });
}

/* ---------------- Notifications (push) ---------------- */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let swReg = null;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(r => { swReg = r; refreshNotifState(); }).catch(() => { });
function b64ToBytes(b64) { const p = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
async function refreshNotifState() {
  let st;
  if (!pushSupported()) st = isIOS() && !standaloneMode ? 'install' : 'unsupported';
  else if (Notification.permission === 'denied') st = 'denied';
  else {
    const reg = swReg || await navigator.serviceWorker.getRegistration().catch(() => null);
    const subn = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
    st = subn && Notification.permission === 'granted' ? 'on' : 'off';
    if (subn && S.user && !S.notifSynced) { S.notifSynced = true; saveSubscription(subn).catch(() => { }); }
  }
  if (st !== S.notif) { S.notif = st; render(); }
}
async function api(path, body) {
  const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.code = 'api/' + (j.error || r.status); throw e; }
  return j;
}
async function saveSubscription(subn) {
  await api('push-subscribe', { idToken: await S.user.getIdToken(), subscription: subn.toJSON(), device: navigator.userAgent });
}
async function enableNotifications() {
  if (!pushSupported()) return toast(isIOS() ? "Ajoutez d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez-la depuis l'icône." : "Ce navigateur ne permet pas les notifications.", 'bad');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { await refreshNotifState(); return toast('Notifications refusées. Vous pouvez les autoriser dans les réglages du téléphone.', 'bad'); }
  const reg = swReg || await navigator.serviceWorker.ready;
  const { publicKey } = await api('push-key');
  let subn = await reg.pushManager.getSubscription();
  if (!subn) subn = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  await saveSubscription(subn); S.notifSynced = true;
  await refreshNotifState(); toast('Notifications activées');
}
async function testNotification() {
  await api('notify', { idToken: await S.user.getIdToken(), test: true, title: 'MINISO · Horaires', body: 'Les notifications fonctionnent sur cet appareil.' });
  toast('Notification test envoyée');
}
// Envoi silencieux (n'empêche jamais l'action principale)
function pushTo(uids, title, body, extra = {}) {
  if (!S.user) return;
  S.user.getIdToken().then(t => api('notify', { idToken: t, uids, title, body, ...extra })).catch(e => console.warn('notify', e.code));
}
function notifCard(compact) {
  const st = S.notif;
  if (!st || st === 'on' && compact) return '';
  const msg = {
    on: ['ok', 'Notifications activées sur cet appareil : rappel 1 h avant chaque quart et avis quand l\'horaire est publié.'],
    off: ['info', 'Recevez un rappel 1 h avant chaque quart et un avis quand votre horaire est publié.'],
    install: ['info', 'Pour recevoir les notifications sur iPhone : Partager → Sur l\'écran d\'accueil, puis ouvrez l\'app depuis l\'icône.'],
    denied: ['warn', 'Notifications bloquées. Autorisez-les dans Réglages → Notifications → Horaires CAH5.'],
    unsupported: ['info', 'Ce navigateur ne permet pas les notifications.']
  }[st];
  return `<div class="alert ${msg[0]}">${svg(IC.bell, 16)}<span>${msg[1]}</span></div>${st === 'off' ? `<button class="btn red" data-act="notifOn">${svg(IC.bell, 16)} Activer les notifications</button>` : st === 'on' ? `<button class="btn sm" data-act="notifTest">Envoyer une notification test</button>` : ''}`;
}

/* ---------------- Rendu ---------------- */
function isTyping() {
  const a = document.activeElement;
  return !!a && a.closest && !!a.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
}
function render(force) {
  if (!force && isTyping()) { S.pendingRender = true; return; }
  S.pendingRender = false;
  const root = $('#app');
  const gw = $('.grid-wrap'); const sl = gw ? gw.scrollLeft : 0;
  let html;
  if (!configured) html = viewSetup();
  else if (!S.authReady || S.signingUp) html = splash();
  else if (!S.user) html = viewAuth();
  else if (S.profile === undefined) html = splash();
  else if (S.profile === null) html = viewCompleteProfile();
  else if (!isActive()) html = viewPending();
  else {
    const nav = isManager() ? NAV_MGR : NAV_EMP;
    if (!nav.some(n => n[0] === S.view)) S.view = nav[0][0];
    const V = { schedule: viewScheduleMgr, requests: isManager() ? viewRequestsMgr : viewRequestsEmp, staff: viewStaff, budget: viewBudget, profile: viewProfile, mine: viewMine, team: viewTeam, swaps: viewSwaps };
    html = shell(V[S.view](), true);
  }
  root.innerHTML = html;
  const gw2 = $('.grid-wrap'); if (gw2 && sl) gw2.scrollLeft = sl;
  if (isManager() && S.view === 'requests') loadConflicts();
}
const splash = () => `<div class="splash"><span class="wm">MINISO</span><span class="wm-sub">Horaires</span></div>`;

function shell(content, withNav) {
  const nav = isManager() ? NAV_MGR : NAV_EMP;
  const badges = withNav ? navBadges() : {};
  const unread = withNav ? unreadCount() : 0;
  const u = S.profile || {};
  const navBtn = ([id, label, ic], small) => `<button data-act="nav" data-v="${id}" ${S.view === id ? 'aria-current="page"' : ''}>${svg(IC[ic], small ? 22 : 18)}<span>${label}</span>${badges[id] ? `<span class="badge">${badges[id]}</span>` : ''}</button>`;
  return `<header class="top"><div class="top-in">
      <div class="brand"><span class="wm">MINISO</span><span class="wm-sub">Horaires · ${esc(C.store.code)} ${esc(C.store.name)}</span></div>
      ${withNav ? `<button class="icon-btn" data-act="feed" aria-label="Nouvelles">${svg(IC.bell)}${unread ? `<span class="badge">${unread}</span>` : ''}</button>
      <button class="avatar-btn" data-act="nav" data-v="profile" aria-label="Mon compte" style="--c:${esc(u.color || '#555')}">${esc(initials(u))}</button>` : ''}
    </div>${withNav ? `<nav class="tabs" aria-label="Sections">${nav.map(n => navBtn(n, false)).join('')}</nav>` : ''}</header>
    <main class="wrap">${content}</main>
    ${withNav ? `<nav class="bottom" aria-label="Sections">${nav.map(n => navBtn(n, true)).join('')}</nav>` : ''}`;
}
function navBadges() {
  const me = S.user.uid;
  if (isManager()) return {
    requests: S.timeoff.filter(o => o.status === 'pending').length + S.swaps.filter(x => x.status === 'taken').length,
    staff: realUsers().filter(u => u.status === 'pending').length
  };
  return { swaps: S.swaps.filter(x => x.status === 'open' && x.fromUid !== me && (!x.toUid || x.toUid === me) && x.date >= today()).length };
}

/* ----- Écrans de connexion ----- */
const GOOGLE_G = '<svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
const googleOn = () => C.googleSignIn !== false && (!standaloneMode || googleInstalled);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function authLayout(inner) {
  return `<div class="auth">
    <svg class="auth-mark" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round" transform="rotate(-14 200 200)"><rect x="66" y="92" width="268" height="244" rx="36"/><path d="M66 164h268M142 52v72M258 52v72"/><rect x="118" y="214" width="56" height="44" rx="10"/><rect x="226" y="214" width="56" height="44" rx="10"/></g></svg>
    <div class="auth-top"><span class="wm">MINISO</span><span class="wm-sub">Horaires · ${esc(C.store.code)} ${esc(C.store.name)}</span></div>
    <div class="auth-main">${inner}</div>
    <p class="auth-legal">${svg(IC.lock, 13)} Accès réservé à l'équipe du magasin ${esc(C.store.code)}.</p>
  </div>`;
}
const msgHtml = () => S.msg ? `<div class="alert ${S.msg.kind}">${svg(S.msg.kind === 'ok' ? IC.check : IC.alert, 16)}<span>${esc(S.msg.text)}</span></div>` : '';
const googleBtn = label => googleOn() ? `<button type="button" class="btn-google" data-act="google">${GOOGLE_G}<span>${label}</span></button>` : '';
function lineField(id, label, type, ac, value) {
  const extra = type === 'email' ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : type === 'tel' ? ' inputmode="tel"' : '';
  return `<div class="line-field"><label class="sr" for="${id}">${esc(label)}</label><input class="line" id="${id}" type="${type}" placeholder="${esc(label)}" autocomplete="${ac}"${extra} value="${esc(value)}"></div>`;
}
const consentBox = id => `<label class="check"><input type="checkbox" id="${id}" ${dv(id, false) ? 'checked' : ''}><span>J'accepte que mes coordonnées et mes disponibilités soient utilisées par la direction du magasin pour la gestion des horaires.</span></label>`;
function viewSetup() {
  return authLayout(`<h1 class="auth-title">Bientôt prêt</h1><p class="auth-lead">L'application n'est pas encore reliée à sa base de données. Revenez un peu plus tard.</p>`);
}
function viewAuth() {
  const v = S.authView, email = String(dv('li-email', '')).trim();
  if (v === 'signup') return authLayout(`
    <h1 class="auth-title">Créer un compte</h1>
    <p class="auth-lead">La direction du magasin approuve chaque compte avant l'accès à l'horaire.</p>
    ${googleOn() ? `${googleBtn("S'inscrire avec Google")}<div class="or">ou avec votre courriel</div>` : ''}
    <form data-form="signup" class="auth-form" novalidate>
      <div class="line-2">${lineField('su-first', 'Prénom', 'text', 'given-name', dv('su-first', ''))}${lineField('su-last', 'Nom', 'text', 'family-name', dv('su-last', ''))}</div>
      ${lineField('su-email', 'Adresse courriel', 'email', 'email', dv('su-email', ''))}
      ${lineField('su-phone', 'Téléphone (facultatif)', 'tel', 'tel', dv('su-phone', ''))}
      ${lineField('su-pw', 'Mot de passe (8 caractères minimum)', 'password', 'new-password', '')}
      ${lineField('su-pw2', 'Confirmer le mot de passe', 'password', 'new-password', '')}
      ${consentBox('su-consent')}
      ${msgHtml()}
      <button class="btn red btn-xl block" type="submit">Créer mon compte</button>
    </form>
    <div class="auth-alt"><span>Déjà un compte ?</span><button type="button" class="link-alt" data-act="authView" data-v="email">Se connecter</button></div>`);
  if (v === 'reset') return authLayout(`
    <button type="button" class="back-link" data-act="authView" data-v="${email ? 'password' : 'email'}">${svg(IC.left, 18)} Retour</button>
    <h1 class="auth-title">Mot de passe oublié</h1>
    <p class="auth-lead">Entrez votre courriel : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <form data-form="reset" class="auth-form" novalidate>
      ${lineField('rs-email', 'Adresse courriel', 'email', 'email', dv('rs-email', email))}
      ${msgHtml()}
      <button class="btn red btn-xl block" type="submit">Envoyer le lien</button>
    </form>`);
  if (v === 'password' && email) return authLayout(`
    <h1 class="auth-title">Connexion</h1>
    <div class="who-chip"><span>${esc(email)}</span><button type="button" class="link-alt" data-act="authView" data-v="email">Modifier</button></div>
    <form data-form="login" class="auth-form" novalidate>
      <input class="sr" type="email" autocomplete="username" value="${esc(email)}" tabindex="-1" aria-hidden="true" readonly>
      ${lineField('li-pw', 'Mot de passe', 'password', 'current-password', '')}
      ${msgHtml()}
      <button class="btn red btn-xl block" type="submit">Se connecter</button>
    </form>
    <button type="button" class="link-alt center" data-act="authView" data-v="reset">Mot de passe oublié ?</button>
    ${standaloneMode && !googleOn() ? `<p class="auth-lead" style="margin:0;font-size:14px">Inscrit avec Google ? Ouvrez le lien dans Safari, connectez-vous avec Google, puis Compte → « Créer mon mot de passe ». Utilisez ensuite ce mot de passe ici.</p>` : ''}
    ${googleOn() ? `<div class="or">ou</div>${googleBtn('Continuer avec Google')}` : ''}`);
  return authLayout(`
    <h1 class="auth-title">Connexion</h1>
    <form data-form="email" class="auth-form" novalidate>
      ${lineField('li-email', 'Adresse courriel', 'email', 'username', email)}
      ${msgHtml()}
      <button class="btn red btn-xl block" type="submit">Continuer</button>
    </form>
    ${googleOn() ? `<div class="or">ou continuer avec</div>${googleBtn('Continuer avec Google')}` : standaloneMode && C.googleSignIn !== false ? `<p class="auth-lead" style="font-size:14px">Inscrit avec Google ? Ouvrez d'abord le lien dans Safari, connectez-vous avec Google, puis Compte → « Créer mon mot de passe ».</p>` : ''}
    <div class="auth-alt"><button type="button" class="link-alt muted-link" data-act="authView" data-v="signup">Créer un nouveau compte</button></div>`);
}
function viewCompleteProfile() {
  const dn = String(S.user.displayName || '').trim().split(/\s+/).filter(Boolean);
  const f0 = dn[0] || '', l0 = dn.slice(1).join(' ');
  const first = dv('cp-first', f0);
  return authLayout(`
    <h1 class="auth-title">Bienvenue${first ? ', ' + esc(first) : ''}</h1>
    <p class="auth-lead">Complétez votre profil pour demander l'accès à l'horaire du magasin.</p>
    <div class="who-chip"><span>${esc(S.user.email || '')}</span></div>
    <form data-form="complete" class="auth-form" novalidate>
      <div class="line-2">${lineField('cp-first', 'Prénom', 'text', 'given-name', first)}${lineField('cp-last', 'Nom', 'text', 'family-name', dv('cp-last', l0))}</div>
      ${lineField('cp-phone', 'Téléphone (facultatif)', 'tel', 'tel', dv('cp-phone', ''))}
      ${consentBox('cp-consent')}
      <button class="btn red btn-xl block" type="submit">Demander l'accès</button>
    </form>
    <div class="auth-alt"><button type="button" class="link-alt muted-link" data-act="logout">Utiliser un autre compte</button></div>`);
}
function viewPending() {
  const p = S.profile || {}, blocked = p.status === 'refused' || p.status === 'inactive', owner = isOwnerEmail(S.user);
  return authLayout(`
    <div class="big-ico">${svg(blocked ? IC.lock : IC.clock, 30)}</div>
    <h1 class="auth-title">${blocked ? 'Accès désactivé' : `Merci, ${esc(p.firstName || '')} !`}</h1>
    <p class="auth-lead">${blocked ? "Votre compte n'a pas accès à l'horaire. Communiquez avec la direction du magasin."
      : owner ? "Compte propriétaire : confirmez votre adresse courriel pour activer l'accès gérant."
        : "Votre compte est créé. La direction du magasin doit l'approuver avant que vous puissiez voir l'horaire. Cette page se mettra à jour toute seule."}</p>
    ${blocked ? '' : verifBlock()}
    <div class="auth-alt"><button type="button" class="link-alt muted-link" data-act="logout">Se déconnecter</button></div>`);
}
function verifBlock() {
  if (S.user.emailVerified) return `<div class="alert ok">${svg(IC.check, 16)}<span>Courriel confirmé : ${esc(S.user.email)}</span></div>`;
  return `<div class="alert warn">${svg(IC.alert, 16)}<span>Un courriel de confirmation a été envoyé à <b>${esc(S.user.email)}</b>. Ouvrez-le et touchez le lien (vérifiez aussi les courriels indésirables).</span></div>
    <div class="row"><button class="btn red" data-act="checkVerif">J'ai confirmé mon courriel</button><button class="btn" data-act="resendVerif">Renvoyer le courriel</button></div>`;
}

/* ----- Semaine ----- */
function weekBar() {
  const days = weekDays(S.week);
  return `<div class="week-bar">
    <button class="icon-btn2" data-act="wk" data-v="-1" aria-label="Semaine précédente">${svg(IC.left)}</button>
    <div class="wk-label"><span class="eyebrow">Semaine</span><b>${fmtDay(days[0])} – ${fmtDay(days[6])}</b></div>
    <button class="icon-btn2" data-act="wk" data-v="1" aria-label="Semaine suivante">${svg(IC.right)}</button>
    ${S.week !== weekOf(today()) ? `<button class="btn sm ghost" data-act="wk" data-v="0">Cette semaine</button>` : ''}
  </div>`;
}
function gridHtml(mgr) {
  const days = weekDays(S.week), people = activeUsers(), byU = {}, issues = [], dayTot = days.map(() => 0);
  S.shifts.forEach(s => (byU[s.uid] = byU[s.uid] || []).push(s));
  const pub = !!(S.weekDoc && S.weekDoc.published);
  const rows = people.map(u => {
    const us = byU[u.id] || [], offs = mgr ? offsFor(u.id) : [], iss = {};
    if (mgr) us.forEach(s => { iss[s.id] = shiftIssues(s, us, S.avail[u.id], offs); iss[s.id].forEach(i => issues.push({ who: u, when: s, ...i })); });
    const wk = mgr ? weekIssues(u.id, us, S.avail[u.id]) : { paid: us.reduce((a, s) => a + paidMin(s), 0), issues: [] };
    wk.issues.forEach(i => issues.push({ who: u, ...i }));
    us.forEach(s => { const i = days.indexOf(s.date); if (i >= 0) dayTot[i] += paidMin(s); });
    if (!mgr && !us.length) return '';
    const cells = days.map(d => {
      const a = mgr && S.avail[u.id] && S.avail[u.id].days ? S.avail[u.id].days[parse(d).getDay()] : null;
      const off = offs.find(o => d >= o.from && d <= o.to);
      const list = us.filter(s => s.date === d).sort(byDT);
      return `<td class="${a && a.type === 'none' ? 'unav' : ''} ${d === today() ? 'is-today' : ''}">
        ${off ? `<span class="off-tag ${off.status}">${off.status === 'approved' ? 'Congé' : 'Congé demandé'}</span>` : ''}
        ${a && a.type === 'range' ? `<span class="av-tag">Dispo ${hm(a.from)}–${hm(a.to)}</span>` : ''}
        ${list.map(s => { const p = posOf(s.position), lvl = mgr ? worst(iss[s.id] || []) : '', tag = mgr ? 'button' : 'div';
          return `<${tag} class="chip ${lvl}" style="--pc:${esc(p.color)}" ${mgr ? `data-act="editShift" data-id="${s.id}" type="button"` : ''}><b>${hm(s.start)} – ${hm(s.end)}</b><span>${esc(p.name)}</span>${mgr && pub && (s.modifiedAfterPublish || !s.published) ? '<i class="mod">Modifié</i>' : ''}</${tag}>`; }).join('')}
        ${mgr ? `<button class="add" type="button" data-act="newShift" data-uid="${u.id}" data-date="${d}" aria-label="Ajouter un quart : ${esc(u.firstName)}, ${fmtDay(d)}">+</button>` : ''}
      </td>`;
    }).join('');
    return `<tr class="${u.id === S.user.uid ? 'me-row' : ''}"><th class="who" scope="row"><span class="dot" style="background:${esc(u.color || '#888')}"></span><span class="nm">${esc(shortName(u))}</span><small class="${wk.paid > 2400 ? 'ot' : ''}">${fmtDur(wk.paid)}</small></th>${cells}</tr>`;
  }).join('');
  const head = days.map(d => { const dt = parse(d); return `<th class="${d === today() ? 'is-today' : ''}"><span>${DAYS[dt.getDay()]}</span><b>${dt.getDate()}</b></th>`; }).join('');
  const table = `<div class="grid-wrap"><table class="sched"><thead><tr><th class="who">Équipe</th>${head}</tr></thead>
    <tbody>${rows || `<tr><td colspan="8" class="empty">${mgr ? 'Aucun employé actif. Approuvez les comptes dans « Équipe ».' : 'Aucun quart cette semaine.'}</td></tr>`}</tbody>
    <tfoot><tr><th class="who">Total</th>${dayTot.map(m => `<td>${m ? fmtDur(m) : '—'}</td>`).join('')}</tr></tfoot></table></div>`;
  return { table, issues, total: dayTot.reduce((a, b) => a + b, 0) };
}

/* ----- Gérant : bâtir l'horaire ----- */
function weekChanges() {
  const wk = S.weekDoc || {};
  return !!wk.published && ((wk.changedUids || []).length > 0 || S.shifts.some(s => s.modifiedAfterPublish || !s.published));
}
function viewScheduleMgr() {
  const { table, issues, total } = gridHtml(true);
  const wk = S.weekDoc || {}, pub = !!wk.published, changes = weekChanges();
  const errs = issues.filter(i => i.lvl === 'err').length;
  const status = pub ? (changes ? '<span class="pill warn">Modifications non annoncées</span>' : `<span class="pill ok">${svg(IC.check, 13, 3)} Publié le ${esc(fmtStamp(wk.publishedAt))}</span>`) : (S.shifts.length ? '<span class="pill na">Brouillon (non visible par l\'équipe)</span>' : '<span class="pill na">Vide</span>');
  const copy = S.confirm === 'copy'
    ? `<span class="confirm">Ajouter les quarts de la semaine précédente ? <button class="btn sm red" data-act="copyPrev">Copier</button><button class="btn sm" data-act="cancelConfirm">Annuler</button></span>`
    : `<button class="btn" data-act="${S.shifts.length ? 'copyAsk' : 'copyPrev'}">${svg(IC.copy, 16)} Copier la semaine précédente</button>`;
  const pubBtn = pub ? (changes ? `<button class="btn red" data-act="publishAsk">${svg(IC.send, 16)} Annoncer les modifications</button>` : '')
    : `<button class="btn red" data-act="publishAsk" ${S.shifts.length ? '' : 'disabled'}>${svg(IC.send, 16)} Publier l'horaire</button>`;
  const unpub = pub ? (S.confirm === 'unpub' ? `<span class="confirm">Retirer l'horaire de la vue des employés ? <button class="btn sm danger" data-act="unpublish">Retirer</button><button class="btn sm" data-act="cancelConfirm">Annuler</button></span>`
    : `<button class="btn sm ghost" data-act="unpubAsk">Retirer la publication</button>`) : '';
  const iss = issues.length ? `<details class="issues" ${S.issuesOpen ? 'open' : ''}><summary>${svg(IC.alert, 16)} ${issues.length} rappel${issues.length > 1 ? 's' : ''} à vérifier ${errs ? `<span class="pill bad">${errs} conflit${errs > 1 ? 's' : ''}</span>` : ''}</summary>
      <ul>${issues.map(i => `<li class="${i.lvl}"><b>${esc(shortName(i.who))}</b>${i.when ? ` · ${fmtDay(i.when.date)} ${hm(i.when.start)}–${hm(i.when.end)}` : ''} — ${esc(i.t)}</li>`).join('')}</ul>
      <p class="fine">Rappels basés sur la Loi sur les normes du travail du Québec (LNT). En cas de doute, consultez la CNESST.</p></details>` : '';
  return `<div class="page-head"><div><span class="eyebrow">Horaire</span><h1>Bâtir l'horaire</h1></div>${status}</div>
    ${weekBar()}
    <div class="toolbar">${copy}${pubBtn}${unpub}<span class="muted tot">${fmtDur(total)} planifiées</span></div>
    ${iss}${table}
    <p class="hint">Touchez « + » pour ajouter un quart, ou un quart pour le modifier. Les cases hachurées indiquent une indisponibilité de l'employé.</p>`;
}

/* ----- Employé : mon horaire / équipe ----- */
function viewMine() {
  const t = today(), w0 = weekOf(t), me = S.user.uid;
  const mine = S.myShifts.filter(s => s.uid === me).sort(byDT);
  const next = mine.find(s => s.date > t || (s.date === t && endMin(s) > toMin(new Date().toTimeString().slice(0, 5))));
  const bySh = {};
  [...S.swaps, ...S.swapsFrom].forEach(x => { if (x.fromUid === me && (x.status === 'open' || x.status === 'taken')) bySh[x.shiftId] = x; });
  const pend = S.timeoff.filter(o => o.status === 'pending').length;
  const weeks = [[w0, 'Cette semaine'], [addDays(w0, 7), 'Semaine prochaine'], [addDays(w0, 14), 'Dans deux semaines']];
  return `<div class="page-head"><div><span class="eyebrow">${esc(cap(fmtLong(t)))}</span><h1>Bonjour ${esc(S.profile.firstName)}</h1></div></div>
    ${S.notif && S.notif !== 'on' && S.notif !== 'unsupported' ? `<section class="card"><div class="card-b">${notifCard(true)}</div></section>` : ''}
    ${next ? nextCard(next) : `<div class="card empty-card">${svg(IC.cal, 28)}<p>Aucun quart à venir dans l'horaire publié.</p></div>`}
    ${pend ? `<div class="alert warn">${svg(IC.clock, 16)}<span>${pend} demande${pend > 1 ? 's' : ''} de congé en attente d'approbation.</span></div>` : ''}
    ${weeks.map(([w, label]) => {
      const list = mine.filter(s => s.weekId === w), pub = S.myWeeks[w] && S.myWeeks[w].published, tot = list.reduce((a, s) => a + paidMin(s), 0);
      return `<section class="card"><div class="card-h"><h2>${label} <small class="muted">${fmtDay(w)} – ${fmtDay(addDays(w, 6))}</small></h2><span class="pill ${pub ? 'ok' : 'na'}">${pub ? fmtDur(tot) : 'Pas encore publié'}</span></div>
        ${!pub ? `<div class="empty">La direction n'a pas encore publié cet horaire.</div>` : list.length ? list.map(s => shiftRow(s, bySh[s.id])).join('') : `<div class="empty">Aucun quart cette semaine.</div>`}</section>`;
    }).join('')}`;
}
function nextCard(s) {
  const p = posOf(s.position), d = daysBetween(today(), s.date);
  const when = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : `Dans ${d} jours`;
  return `<section class="next-card" style="--pc:${esc(p.color)}"><span class="eyebrow">Prochain quart · ${when}</span><h2>${esc(cap(fmtLong(s.date)))}</h2>
    <div class="next-time">${fmtT(s.start)} – ${fmtT(s.end)}</div>
    <div class="row"><span class="pos-tag"><i class="pdot" style="background:${esc(p.color)}"></i>${esc(p.name)}</span><span class="muted">${fmtDur(paidMin(s))} payées${s.breakMin ? ` · pause de ${s.breakMin} min` : ''}</span></div>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}</section>`;
}
function shiftRow(s, sw) {
  const p = posOf(s.position), past = s.date < today(), dt = parse(s.date);
  const act = sw ? `<span class="pill warn">${sw.status === 'open' ? 'Offert' : `Pris par ${esc(nameOf(sw.takenBy))} · en attente`}</span>`
    : past ? '' : `<button class="btn sm" data-act="offerAsk" data-id="${s.id}">${svg(IC.swap, 14)} Offrir</button>`;
  return `<div class="srow ${past ? 'past' : ''}"><div class="datebox"><span>${DAYS[dt.getDay()]}</span><b>${dt.getDate()}</b></div>
    <div class="main"><b>${fmtT(s.start)} – ${fmtT(s.end)}</b><span class="m"><i class="pdot" style="background:${esc(p.color)}"></i>${esc(p.name)} · ${fmtDur(paidMin(s))}${s.note ? ' · ' + esc(s.note) : ''}</span></div>${act}</div>`;
}
function viewTeam() {
  const pub = !!(S.weekDoc && S.weekDoc.published);
  return `<div class="page-head"><div><span class="eyebrow">Équipe</span><h1>Horaire de l'équipe</h1></div></div>${weekBar()}
    ${pub ? gridHtml(false).table : `<div class="card empty-card">${svg(IC.cal, 28)}<p>L'horaire de cette semaine n'est pas encore publié.</p></div>`}`;
}

/* ----- Employé : échanges ----- */
const SWAP_ST = { open: ['warn', 'En attente d\'un preneur'], taken: ['warn', 'En attente de la direction'], approved: ['ok', 'Approuvé'], refused: ['bad', 'Refusé'], cancelled: ['na', 'Annulé'] };
function viewSwaps() {
  const me = S.user.uid, t = today();
  const avail = S.swaps.filter(x => x.status === 'open' && x.fromUid !== me && (!x.toUid || x.toUid === me) && x.date >= t).sort(byDT);
  const hist = mergeById([...S.swapsFrom, ...S.swapsTaken]).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
  return `<div class="page-head"><div><span class="eyebrow">Échanges de quarts</span><h1>Quarts offerts</h1></div></div>
    <section class="card">${avail.length ? avail.map(x => swapRow(x, true)).join('') : `<div class="empty">Aucun quart offert pour le moment.</div>`}</section>
    <p class="hint">Pour offrir un de vos quarts, allez dans « Mon horaire » et touchez « Offrir ». La direction approuve chaque échange.</p>
    <section class="card"><div class="card-h"><h2>Mes échanges</h2></div>${hist.length ? hist.map(x => swapRow(x, false)).join('') : `<div class="empty">Aucun échange pour l'instant.</div>`}</section>`;
}
function swapRow(x, takeMode) {
  const me = S.user.uid, p = posOf(x.position), dt = parse(x.date), st = SWAP_ST[x.status] || ['na', x.status];
  const who = takeMode ? `Offert par ${nameOf(x.fromUid)}${x.toUid ? ' (à vous)' : ''}`
    : x.fromUid === me ? (x.takenBy ? `Vous → ${nameOf(x.takenBy)}` : x.toUid ? `Offert à ${nameOf(x.toUid)}` : "Offert à toute l'équipe")
      : `${nameOf(x.fromUid)} → vous`;
  let btn = '';
  if (takeMode) btn = `<button class="btn sm red" data-act="takeAsk" data-id="${x.id}">Je le prends</button>`;
  else if (x.fromUid === me && (x.status === 'open' || x.status === 'taken')) btn = S.confirm === 'cx' + x.id
    ? `<span class="confirm">Annuler ? <button class="btn sm danger" data-act="cancelSwap" data-id="${x.id}">Oui</button><button class="btn sm" data-act="cancelConfirm">Non</button></span>`
    : `<button class="btn sm ghost" data-act="cancelSwapAsk" data-id="${x.id}">Annuler</button>`;
  return `<div class="srow"><div class="datebox"><span>${DAYS[dt.getDay()]}</span><b>${dt.getDate()}</b></div>
    <div class="main"><b>${fmtT(x.start)} – ${fmtT(x.end)} <small class="muted">${MONTHS[dt.getMonth()]}</small></b>
      <span class="m"><i class="pdot" style="background:${esc(p.color)}"></i>${esc(p.name)} · ${esc(who)}</span>${x.message ? `<span class="m">« ${esc(x.message)} »</span>` : ''}</div>
    ${takeMode ? '' : `<span class="pill ${st[0]}">${st[1]}</span>`}${btn}</div>`;
}

/* ----- Employé : disponibilités et congés ----- */
function toStatusPill(o) {
  const m = { pending: ['warn', 'En attente'], approved: ['ok', 'Approuvé'], refused: ['bad', 'Refusé'], cancelled: ['na', 'Annulé'] }[o.status] || ['na', o.status];
  return `<span class="pill ${m[0]}">${m[1]}</span>`;
}
const toRange = o => `${o.from === o.to ? cap(fmtLong(o.from)) : `Du ${fmtLong(o.from)} au ${fmtLong(o.to)}`}${o.allDay ? '' : ` · ${fmtT(o.start)} – ${fmtT(o.end)}`}`;
const toType = k => (TO_TYPES.find(t => t[0] === k) || [k, k])[1];
function availEditor() {
  const av = S.availDraft || (S.availDraft = normAvail(S.myAvail));
  const order = Array.from({ length: 7 }, (_, i) => (WEEK0 + i) % 7);
  return `<section class="card"><div class="card-h"><h2>Mes disponibilités</h2>${S.myAvail && S.myAvail.updatedAt ? `<span class="fine">Mises à jour le ${esc(fmtStamp(S.myAvail.updatedAt))}</span>` : `<span class="pill warn">À remplir</span>`}</div>
    <div class="card-b av">
      ${order.map(d => { const x = av.days[d]; return `<div class="av-row"><span class="av-day">${cap(DAYS_LONG[d])}</span>
        <div class="seg3" role="group" aria-label="${DAYS_LONG[d]}">${[['all', 'Disponible'], ['range', 'Plage'], ['none', 'Indisponible']].map(([k, l]) => `<button type="button" data-act="avType" data-d="${d}" data-v="${k}" aria-pressed="${x.type === k}">${l}</button>`).join('')}</div>
        ${x.type === 'range' ? `<div class="av-range"><input class="input" type="time" step="900" id="av-from-${d}" data-av="from" data-d="${d}" value="${esc(x.from)}" aria-label="Début"><span>à</span><input class="input" type="time" step="900" id="av-to-${d}" data-av="to" data-d="${d}" value="${esc(x.to)}" aria-label="Fin"></div>` : ''}</div>`; }).join('')}
      <div class="grid2">
        <div class="field"><label for="av-max">Heures maximum par semaine (facultatif)</label><input class="input" id="av-max" type="number" min="0" max="60" inputmode="numeric" data-av="max" value="${esc(av.maxHours)}"></div>
        <div class="field"><label for="av-note">Précisions (facultatif)</label><input class="input" id="av-note" data-av="note" value="${esc(av.note)}" placeholder="Ex. : cours le mardi soir"></div>
      </div>
      <div class="row"><button class="btn red" data-act="saveAvail">${svg(IC.check, 16)} Enregistrer mes disponibilités</button>${S.availDirty ? '<span class="fine">Modifications non enregistrées</span>' : ''}</div>
    </div></section>`;
}
function viewRequestsEmp() {
  const mine = [...S.timeoff].sort((a, b) => b.from.localeCompare(a.from)).slice(0, 20);
  const allDay = dv('to-allday', true);
  return `<div class="page-head"><div><span class="eyebrow">Demandes</span><h1>Disponibilités et congés</h1></div></div>
    ${availEditor()}
    <section class="card"><div class="card-h"><h2>Demander un congé</h2></div>
      <form class="card-b form-grid" data-form="timeoff" novalidate>
        <div class="field span2"><label for="to-type">Motif</label><select class="input" id="to-type">${TO_TYPES.map(([k, l]) => `<option value="${k}" ${dv('to-type', 'vacances') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="to-from">Du</label><input class="input" type="date" id="to-from" value="${esc(dv('to-from', today()))}"></div>
        <div class="field"><label for="to-to">Au</label><input class="input" type="date" id="to-to" value="${esc(dv('to-to', today()))}"></div>
        <label class="check span2"><input type="checkbox" id="to-allday" ${allDay ? 'checked' : ''}><span>Journée complète</span></label>
        ${allDay ? '' : `<div class="field"><label for="to-start">De</label><input class="input" type="time" step="900" id="to-start" value="${esc(dv('to-start', '09:00'))}"></div>
          <div class="field"><label for="to-end">À</label><input class="input" type="time" step="900" id="to-end" value="${esc(dv('to-end', '13:00'))}"></div>`}
        <div class="field span2"><label for="to-note">Commentaire (facultatif)</label><input class="input" id="to-note" value="${esc(dv('to-note', ''))}"></div>
        <button class="btn red span2" type="submit">${svg(IC.send, 16)} Envoyer la demande</button>
      </form></section>
    <section class="card"><div class="card-h"><h2>Mes demandes de congé</h2></div>
      ${mine.length ? mine.map(o => `<div class="req"><div class="req-h"><div class="main"><b>${esc(toRange(o))}</b><small>${esc(toType(o.type))}${o.note ? ' · « ' + esc(o.note) + ' »' : ''}</small></div>${toStatusPill(o)}</div>
        ${o.managerNote ? `<p class="note">Direction : ${esc(o.managerNote)}</p>` : ''}
        ${o.status === 'pending' ? (S.confirm === 'co' + o.id ? `<div class="req-f"><span class="confirm">Annuler cette demande ? <button class="btn sm danger" data-act="cancelOff" data-id="${o.id}">Oui</button><button class="btn sm" data-act="cancelConfirm">Non</button></span></div>` : `<div class="req-f"><button class="btn sm ghost" data-act="cancelOffAsk" data-id="${o.id}">Annuler la demande</button></div>`) : ''}</div>`).join('')
      : `<div class="empty">Aucune demande.</div>`}</section>`;
}

/* ----- Gérant : demandes ----- */
async function loadConflicts() {
  for (const o of S.timeoff.filter(x => x.status === 'pending')) {
    if (S.toConf[o.id]) continue;
    S.toConf[o.id] = 'loading';
    const weeks = []; for (let w = weekOf(o.from); w <= o.to && weeks.length < 12; w = addDays(w, 7)) weeks.push(w);
    try {
      const snap = await getDocs(query(collection(db, 'shifts'), where('uid', '==', o.uid), where('weekId', 'in', weeks)));
      S.toConf[o.id] = docsOf(snap).filter(s => s.date >= o.from && s.date <= o.to && (o.allDay || !o.start || (toMin(s.start) < toMin(o.end) && toMin(o.start) < endMin(s)))).sort(byDT);
    } catch (e) { S.toConf[o.id] = []; }
    render();
  }
  for (const x of S.swaps.filter(s => s.status === 'taken')) {
    if (S.swapConf[x.id]) continue;
    S.swapConf[x.id] = 'loading';
    try {
      const snap = await getDocs(query(collection(db, 'shifts'), where('uid', '==', x.takenBy), where('weekId', '==', x.weekId)));
      const theirs = docsOf(snap), shift = { ...x, id: x.shiftId };
      const list = theirs.concat([shift]);
      S.swapConf[x.id] = [...shiftIssues(shift, list, S.avail[x.takenBy], offsFor(x.takenBy)), ...weekIssues(x.takenBy, list, S.avail[x.takenBy]).issues];
    } catch (e) { S.swapConf[x.id] = []; }
    render();
  }
}
function viewRequestsMgr() {
  const pend = S.timeoff.filter(o => o.status === 'pending').sort((a, b) => a.from.localeCompare(b.from));
  const done = S.timeoff.filter(o => o.status === 'approved' || o.status === 'refused').sort((a, b) => b.from.localeCompare(a.from)).slice(0, 15);
  const taken = S.swaps.filter(x => x.status === 'taken').sort(byDT), open = S.swaps.filter(x => x.status === 'open').sort(byDT);
  const tab = S.reqTab;
  const user = id => userById(id) || {};
  const head = o => { const u = user(o.uid); return `<div class="req-h"><span class="avatar" style="--c:${esc(u.color || '#777')}">${esc(initials(u))}</span><div class="main"><b>${esc(fullName(u) || 'Employé')}</b><small>${esc(toType(o.type))} · demandé le ${esc(fmtStamp(o.createdAt))}</small></div>${toStatusPill(o)}</div>`; };
  const conf = o => { const c = S.toConf[o.id]; if (!c || c === 'loading') return ''; return c.length ? `<div class="iss warn">${svg(IC.alert, 15)}<span>${c.length} quart${c.length > 1 ? 's' : ''} déjà prévu${c.length > 1 ? 's' : ''} : ${c.map(s => `${fmtDay(s.date)} ${hm(s.start)}–${hm(s.end)}`).join(', ')}. Pensez à les réassigner.</span></div>` : `<div class="iss info">${svg(IC.check, 15)}<span>Aucun quart prévu pendant ce congé.</span></div>`; };
  const offs = `<section class="card"><div class="card-h"><h2>À approuver</h2><span class="pill ${pend.length ? 'warn' : 'na'}">${pend.length}</span></div>
      ${pend.length ? pend.map(o => `<article class="req">${head(o)}<b>${esc(toRange(o))}</b>${o.note ? `<p class="note">« ${esc(o.note)} »</p>` : ''}${conf(o)}
        <div class="req-f"><input class="input" id="mn-${o.id}" placeholder="Commentaire pour l'employé (facultatif)"><button class="btn sm red" data-act="decideOff" data-id="${o.id}" data-v="approved">${svg(IC.check, 14)} Approuver</button><button class="btn sm" data-act="decideOff" data-id="${o.id}" data-v="refused">Refuser</button></div></article>`).join('')
      : `<div class="empty">Aucune demande en attente.</div>`}</section>
    <section class="card"><div class="card-h"><h2>Décisions récentes</h2></div>${done.length ? done.map(o => `<article class="req">${head(o)}<b>${esc(toRange(o))}</b></article>`).join('') : `<div class="empty">—</div>`}</section>`;
  const swapCard = (x, withBtns) => {
    const p = posOf(x.position), c = S.swapConf[x.id];
    return `<article class="req"><div class="req-h"><div class="main"><b>${esc(shortName(user(x.fromUid)))} → ${x.takenBy ? esc(shortName(user(x.takenBy))) : x.toUid ? esc(shortName(user(x.toUid))) + ' (proposé)' : "toute l'équipe"}</b>
        <small>${esc(cap(fmtLong(x.date)))} · ${fmtT(x.start)} – ${fmtT(x.end)} · ${esc(p.name)}</small></div><span class="pill ${(SWAP_ST[x.status] || ['na'])[0]}">${(SWAP_ST[x.status] || ['', x.status])[1]}</span></div>
      ${x.message ? `<p class="note">« ${esc(x.message)} »</p>` : ''}
      ${withBtns && Array.isArray(c) ? (c.length ? c.map(issueHtml).join('') : `<div class="iss info">${svg(IC.check, 15)}<span>Aucun conflit pour ${esc(shortName(user(x.takenBy)))}.</span></div>`) : ''}
      <div class="req-f">${withBtns ? `<button class="btn sm red" data-act="decideSwap" data-id="${x.id}" data-v="approved">${svg(IC.check, 14)} Approuver l'échange</button><button class="btn sm" data-act="decideSwap" data-id="${x.id}" data-v="refused">Refuser</button>`
        : `<button class="btn sm ghost" data-act="decideSwap" data-id="${x.id}" data-v="cancelled">Annuler l'offre</button>`}</div></article>`;
  };
  const swaps = `<section class="card"><div class="card-h"><h2>Échanges à approuver</h2><span class="pill ${taken.length ? 'warn' : 'na'}">${taken.length}</span></div>${taken.length ? taken.map(x => swapCard(x, true)).join('') : `<div class="empty">Aucun échange en attente.</div>`}</section>
    <section class="card"><div class="card-h"><h2>Quarts offerts, sans preneur</h2></div>${open.length ? open.map(x => swapCard(x, false)).join('') : `<div class="empty">—</div>`}</section>`;
  return `<div class="page-head"><div><span class="eyebrow">Demandes</span><h1>Congés et échanges</h1></div></div>
    <div class="seg-tabs" role="group"><button data-act="reqTab" data-v="conges" aria-pressed="${tab === 'conges'}">Congés ${pend.length ? `<span class="badge">${pend.length}</span>` : ''}</button><button data-act="reqTab" data-v="echanges" aria-pressed="${tab === 'echanges'}">Échanges ${taken.length ? `<span class="badge">${taken.length}</span>` : ''}</button></div>
    ${tab === 'conges' ? offs : swaps}`;
}

/* ----- Gérant : équipe ----- */
function viewStaff() {
  const pending = realUsers().filter(u => u.status === 'pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const active = activeUsers(), others = realUsers().filter(u => u.status === 'inactive' || u.status === 'refused');
  const link = signupLink();
  const hrs = uid => S.shifts.filter(s => s.uid === uid).reduce((a, s) => a + paidMin(s), 0);
  const ct = uid => S.contacts[uid] || {};
  return `<div class="page-head"><div><span class="eyebrow">Équipe</span><h1>Employés</h1></div><span class="pill na">${active.length} actif${active.length > 1 ? 's' : ''}</span></div>
    <section class="card"><div class="card-b"><b>Lien d'inscription</b><p class="muted">Envoyez ce lien à vos employés. Chacun crée son compte avec son courriel et son mot de passe, puis vous l'approuvez ici.</p>
      <div class="copy-row"><input class="input" id="inv-link" readonly value="${esc(link)}" aria-label="Lien d'inscription"><button class="btn" data-act="copy" data-v="${esc(link)}">${svg(IC.copy, 16)} Copier</button></div></div></section>
    ${pending.length ? `<section class="card"><div class="card-h"><h2>Comptes à approuver</h2><span class="pill warn">${pending.length}</span></div>
      ${pending.map(u => { const c = ct(u.id); return `<div class="prow"><span class="avatar" style="--c:${esc(u.color || '#777')}">${esc(initials(u))}</span>
        <div class="main"><b>${esc(fullName(u))}</b><span class="m">${esc(c.email || '')}${c.phone ? ' · ' + esc(c.phone) : ''}</span>
        <span class="m">${c.emailVerified ? '<span class="ok-t">Courriel confirmé</span>' : '<span class="warn-t">Courriel non confirmé</span>'} · inscrit le ${esc(fmtStamp(u.createdAt))}</span></div>
        <div class="acts"><button class="btn sm red" data-act="approveAsk" data-id="${u.id}">Approuver</button>${S.confirm === 'ref' + u.id ? `<button class="btn sm danger" data-act="refuseUser" data-id="${u.id}">Confirmer le refus</button><button class="btn sm" data-act="cancelConfirm">Annuler</button>` : `<button class="btn sm" data-act="refuseAsk" data-id="${u.id}">Refuser</button>`}</div></div>`; }).join('')}</section>` : ''}
    <section class="card"><div class="card-h"><h2>Équipe active</h2><span class="fine">Semaine du ${fmtDay(S.week)}</span></div>
      ${active.map(u => { const c = ct(u.id), w = S.wages[u.id]; return `<button class="prow" data-act="editUserAsk" data-id="${u.id}"><span class="avatar" style="--c:${esc(u.color || '#777')}">${esc(initials(u))}</span>
        <div class="main"><b>${esc(fullName(u))} ${u.role === 'manager' ? '<span class="pill red">Gérant</span>' : ''}</b>
        <span class="m">${esc(u.position ? posOf(u.position).name : 'Poste à définir')} · ${fmtDur(hrs(u.id))} cette semaine${w != null ? ' · ' + money(w) + '/h' : ''}</span>
        <span class="m">${esc(c.email || '')}${c.phone ? ' · ' + esc(c.phone) : ''}</span></div>${svg(IC.right, 18)}</button>`; }).join('') || `<div class="empty">Aucun employé actif.</div>`}</section>
    ${others.length ? `<details class="card" id="old-staff" ${S.oldOpen ? 'open' : ''}><summary class="card-h"><h2>Anciens employés et comptes refusés (${others.length})</h2>${svg(IC.right, 18)}</summary>
      ${others.map(u => `<div class="prow"><span class="avatar" style="--c:#999">${esc(initials(u))}</span><div class="main"><b>${esc(fullName(u))}</b><span class="m">${u.status === 'refused' ? 'Refusé' : 'Inactif'} · ${esc(ct(u.id).email || '')}</span></div><div class="acts"><button class="btn sm" data-act="reactivate" data-id="${u.id}">Réactiver</button>${isOwner() ? (S.confirm === 'purge' + u.id ? `<button class="btn sm danger" data-act="purgeUser" data-id="${u.id}">Supprimer pour de bon</button><button class="btn sm" data-act="cancelConfirm">Annuler</button>` : `<button class="btn sm ghost" data-act="purgeAsk" data-id="${u.id}" aria-label="Supprimer définitivement">${svg(IC.trash, 16)}</button>`) : ''}</div></div>`).join('')}</details>` : ''}`;
}

/* ----- Gérant : budget ----- */
function viewBudget() {
  const b = S.budget || {}, days = weekDays(S.week);
  const rows = activeUsers().map(u => {
    const paid = S.shifts.filter(s => s.uid === u.id).reduce((a, s) => a + paidMin(s), 0);
    const reg = Math.min(paid, 2400), ot = Math.max(0, paid - 2400), w = Number(S.wages[u.id]) || 0;
    return { u, paid, ot, w, cost: w * reg / 60 + w * 1.5 * ot / 60 };
  }).filter(r => r.paid > 0);
  const paid = rows.reduce((a, r) => a + r.paid, 0), ot = rows.reduce((a, r) => a + r.ot, 0), cost = rows.reduce((a, r) => a + r.cost, 0);
  const bh = Number(b.hours) || 0, sales = Number(b.sales) || 0, hrs = paid / 60;
  const pct = bh ? hrs / bh : null, labor = sales ? cost / sales * 100 : null;
  const noWage = rows.filter(r => !r.w).length;
  const perDay = days.map(d => S.shifts.filter(s => s.date === d).reduce((a, s) => a + paidMin(s), 0)), mx = Math.max(60, ...perDay);
  return `<div class="page-head"><div><span class="eyebrow">Heures et budget</span><h1>Budget de la semaine</h1></div></div>
    ${weekBar()}
    <section class="card"><div class="card-b form-grid">
      <div class="field"><label for="bd-hours">Budget d'heures de la semaine</label><input class="input" id="bd-hours" type="number" min="0" step="0.5" inputmode="decimal" data-bd="hours" value="${esc(b.hours ?? '')}" placeholder="Ex. : 180"></div>
      <div class="field"><label for="bd-sales">Ventes prévues ($, facultatif)</label><input class="input" id="bd-sales" type="number" min="0" step="1" inputmode="decimal" data-bd="sales" value="${esc(b.sales ?? '')}" placeholder="Ex. : 22000"></div>
    </div></section>
    <div class="kpis">
      <div class="kpi"><span class="eyebrow">Heures planifiées</span><span class="v">${fmtDur(paid)}</span><span class="s">${bh ? `sur ${bh} h budgétées` : 'Aucun budget saisi'}</span>${bh ? `<div class="meter"><i class="${pct > 1 ? 'over' : ''}" style="width:${Math.min(100, pct * 100)}%"></i></div>` : ''}</div>
      <div class="kpi"><span class="eyebrow">Écart au budget</span><span class="v" style="color:${bh ? (hrs > bh ? 'var(--bad)' : 'var(--ok)') : 'inherit'}">${bh ? `${hrs > bh ? '+' : '−'}${fmtDur(Math.abs(Math.round((hrs - bh) * 60)))}` : '—'}</span><span class="s">${bh ? (hrs > bh ? 'Au-dessus du budget' : 'Sous le budget') : ''}</span></div>
      <div class="kpi"><span class="eyebrow">Coût salarial estimé</span><span class="v">${money(cost)}</span><span class="s">${ot ? `dont ${fmtDur(ot)} en heures supp.` : 'Aucune heure supp.'}</span></div>
      <div class="kpi"><span class="eyebrow">Main-d'œuvre / ventes</span><span class="v">${labor == null ? '—' : labor.toFixed(1).replace('.', ',') + ' %'}</span><span class="s">${sales ? 'sur ' + money(sales) + ' prévus' : 'Saisissez les ventes prévues'}</span></div>
    </div>
    ${noWage ? `<div class="alert warn">${svg(IC.alert, 16)}<span>${noWage} employé${noWage > 1 ? 's' : ''} sans taux horaire : le coût est incomplet. Ajoutez les taux dans « Équipe ».</span></div>` : ''}
    <section class="card"><div class="card-h"><h2>Heures par jour</h2></div><div class="card-b"><div class="bars" role="img" aria-label="Heures planifiées par jour">
      ${days.map((d, i) => `<div class="bar-col"><b>${perDay[i] ? fmtDur(perDay[i]) : ''}</b><i style="height:${perDay[i] / mx * 100}%"></i><span>${DAYS[parse(d).getDay()]}</span></div>`).join('')}</div></div></section>
    <section class="card"><div class="card-h"><h2>Par employé</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Employé</th><th>Heures</th><th>Heures supp.</th><th>Taux</th><th>Coût</th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr><td>${esc(fullName(r.u))}</td><td>${fmtDur(r.paid)}</td><td class="${r.ot ? 'ot' : ''}">${r.ot ? fmtDur(r.ot) : '—'}</td><td>${r.w ? money(r.w) : '—'}</td><td>${r.w ? money(r.cost) : '—'}</td></tr>`).join('') : `<tr><td colspan="5" class="empty">Aucun quart cette semaine.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td><td>${fmtDur(paid)}</td><td>${ot ? fmtDur(ot) : '—'}</td><td></td><td>${money(cost)}</td></tr></tfoot></table></div></section>
    <p class="hint">Coût de base : heures payées × taux, avec taux et demi au-delà de 40 h par semaine. N'inclut pas l'indemnité de vacances (4 % ou 6 %) ni les charges de l'employeur.</p>`;
}

/* ----- Compte ----- */
function viewProfile() {
  const p = S.profile || {}, c = S.contact || {}, mgr = isManager();
  const sd = mgr ? (S.setDraft || (S.setDraft = JSON.parse(JSON.stringify({ positions: S.settings.positions, presets: S.settings.presets })))) : null;
  const w0 = weekOf(today());
  const hrs = w => S.myShifts.filter(s => s.weekId === w).reduce((a, s) => a + paidMin(s), 0);
  return `<div class="page-head"><div><span class="eyebrow">Mon compte</span><h1>${esc(fullName(p))}</h1></div>${mgr ? `<span class="pill red">${isOwner() ? 'Propriétaire' : 'Gérant'}</span>` : `<span class="pill na">${esc(p.position ? posOf(p.position).name : 'Employé')}</span>`}</div>
    <section class="card"><div class="card-b">${verifBlock()}
      <div class="row"><span class="pill na">${svg(IC.clock, 13)} Cette semaine : ${fmtDur(hrs(w0))}</span><span class="pill na">Semaine prochaine : ${fmtDur(hrs(addDays(w0, 7)))}</span></div></div></section>
    <section class="card"><div class="card-h"><h2>Notifications</h2></div><div class="card-b">${notifCard(false)}</div></section>
    <section class="card"><div class="card-h"><h2>Mes informations</h2></div>
      <form class="card-b form-grid" data-form="profile" novalidate>
        <div class="field"><label for="pf-first">Prénom</label><input class="input" id="pf-first" value="${esc(dv('pf-first', p.firstName || ''))}"></div>
        <div class="field"><label for="pf-last">Nom</label><input class="input" id="pf-last" value="${esc(dv('pf-last', p.lastName || ''))}"></div>
        <div class="field"><label for="pf-email">Courriel</label><input class="input" id="pf-email" value="${esc(S.user.email)}" readonly></div>
        <div class="field"><label for="pf-phone">Téléphone</label><input class="input" id="pf-phone" type="tel" value="${esc(dv('pf-phone', c.phone || ''))}"></div>
        <button class="btn red span2" type="submit">Enregistrer</button>
      </form></section>
    ${!(S.user.providerData || []).some(x => x.providerId === 'password') ? `<section class="card"><div class="card-h"><h2>Créer un mot de passe</h2></div>
      <form class="card-b form-grid" data-form="linkpw" novalidate>
        <div class="row span2">${GOOGLE_G}<span>Vous êtes connecté avec Google. Créez un mot de passe pour vous connecter dans l'app installée sur l'écran d'accueil, avec votre courriel <b>${esc(S.user.email)}</b>.</span></div>
        <div class="field"><label for="lp-new">Nouveau mot de passe</label><input class="input" id="lp-new" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="lp-new2">Confirmer</label><input class="input" id="lp-new2" type="password" autocomplete="new-password"></div>
        <button class="btn red span2" type="submit">${svg(IC.lock, 16)} Créer mon mot de passe</button>
      </form></section>` : `<section class="card"><div class="card-h"><h2>Changer mon mot de passe</h2></div>
      <form class="card-b form-grid" data-form="password" novalidate>
        <div class="field span2"><label for="pw-cur">Mot de passe actuel</label><input class="input" id="pw-cur" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="pw-new">Nouveau mot de passe</label><input class="input" id="pw-new" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="pw-new2">Confirmer</label><input class="input" id="pw-new2" type="password" autocomplete="new-password"></div>
        <button class="btn span2" type="submit">${svg(IC.lock, 16)} Changer le mot de passe</button>
      </form></section>`}
    ${mgr ? `<section class="card"><div class="card-h"><h2>Réglages du magasin</h2></div><div class="card-b">
      <b>Postes</b>
      ${sd.positions.map((x, i) => `<div class="set-row"><input type="color" value="${esc(x.color)}" data-set="positions.${i}.color" aria-label="Couleur"><input class="input" value="${esc(x.name)}" data-set="positions.${i}.name" aria-label="Nom du poste"><button class="btn sm ghost" data-act="rmSet" data-v="positions.${i}" aria-label="Retirer">${svg(IC.trash, 16)}</button></div>`).join('')}
      <button class="btn sm" data-act="addPos">${svg(IC.plus, 14)} Ajouter un poste</button>
      <b style="margin-top:8px">Quarts types</b>
      ${sd.presets.map((x, i) => `<div class="set-row" style="flex-wrap:wrap"><input class="input" style="flex:1;min-width:110px" value="${esc(x.label)}" data-set="presets.${i}.label" aria-label="Nom"><input class="input" type="time" step="900" value="${esc(x.start)}" data-set="presets.${i}.start" aria-label="Début"><input class="input" type="time" step="900" value="${esc(x.end)}" data-set="presets.${i}.end" aria-label="Fin"><select class="input" style="width:auto" data-set="presets.${i}.breakMin" aria-label="Pause">${[0, 15, 30, 45, 60].map(n => `<option value="${n}" ${Number(x.breakMin) === n ? 'selected' : ''}>${n ? n + ' min' : 'Sans pause'}</option>`).join('')}</select><button class="btn sm ghost" data-act="rmSet" data-v="presets.${i}" aria-label="Retirer">${svg(IC.trash, 16)}</button></div>`).join('')}
      <button class="btn sm" data-act="addPreset">${svg(IC.plus, 14)} Ajouter un quart type</button>
      <div class="row"><button class="btn red" data-act="saveSettings">Enregistrer les réglages</button></div>
    </div></section>` : ''}
    <button class="btn block" data-act="logout">${svg(IC.out, 16)} Se déconnecter</button>
    <p class="fine" style="text-align:center">MINISO · ${esc(C.store.code)} ${esc(C.store.name)} · Horaires</p>`;
}

/* ---------------- Fenêtres ---------------- */
function openModal(m) { S.modal = m; S.confirm = null; S.breakTouched = !!(m.kind === 'shift' && m.id); renderModal(); }
function closeModal() { S.modal = null; S.confirm = null; renderModal(); render(true); }
function renderModal() {
  const m = S.modal, root = $('#modal');
  if (!m) { root.innerHTML = ''; document.body.classList.remove('noscroll'); return; }
  document.body.classList.add('noscroll');
  let title = '', body = '';
  if (m.kind === 'shift') { title = m.id ? 'Modifier le quart' : 'Nouveau quart'; body = shiftForm(m); }
  else if (m.kind === 'publish') { const r = publishBody(); title = r.title; body = r.body; }
  else if (m.kind === 'offer') { title = 'Offrir mon quart'; body = offerForm(m); }
  else if (m.kind === 'take') { title = 'Prendre ce quart'; body = takeBody(m); }
  else if (m.kind === 'approve' || m.kind === 'edit') { title = m.kind === 'approve' ? 'Approuver le compte' : 'Modifier l\'employé'; body = userForm(m); }
  else if (m.kind === 'feed') { title = 'Nouvelles'; body = feedBody(); }
  root.innerHTML = `<div class="modal" data-act="closeModal"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-h"><h2>${esc(title)}</h2><button class="icon-btn2" data-act="closeModal" aria-label="Fermer">${svg(IC.x)}</button></div>
    <div class="sheet-b">${body}</div></div></div>`;
}
function shiftForm(m) {
  const s = m.id ? S.shifts.find(x => x.id === m.id) : null;
  const u0 = userById(m.uid);
  const f = s || { uid: m.uid, date: m.date, start: S.settings.presets[0]?.start || '09:00', end: S.settings.presets[0]?.end || '17:00', breakMin: S.settings.presets[0]?.breakMin ?? 30, position: (u0 && u0.position) || '', note: '' };
  return `<form data-form="shift" id="shiftForm" class="form-grid" novalidate>
    <div class="field span2"><label for="sh-uid">Employé</label><select class="input" id="sh-uid">${activeUsers().map(u => `<option value="${u.id}" ${u.id === f.uid ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></div>
    <div class="field span2"><label for="sh-date">Jour</label><select class="input" id="sh-date">${weekDays(S.week).map(d => `<option value="${d}" ${d === f.date ? 'selected' : ''}>${esc(cap(fmtLong(d)))}</option>`).join('')}</select></div>
    <div class="span2 presets">${S.settings.presets.map((p, i) => `<button type="button" class="chip-btn" data-act="preset" data-i="${i}">${esc(p.label)} <small>${hm(p.start)}–${hm(p.end)}</small></button>`).join('')}</div>
    <div class="field"><label for="sh-start">Début</label><input class="input" type="time" step="900" id="sh-start" value="${esc(f.start)}"></div>
    <div class="field"><label for="sh-end">Fin</label><input class="input" type="time" step="900" id="sh-end" value="${esc(f.end)}"></div>
    <div class="field"><label for="sh-break">Pause repas (non payée)</label><select class="input" id="sh-break">${[0, 15, 30, 45, 60].map(n => `<option value="${n}" ${Number(f.breakMin) === n ? 'selected' : ''}>${n ? n + ' min' : 'Aucune'}</option>`).join('')}</select></div>
    <div class="field"><label for="sh-pos">Poste</label><select class="input" id="sh-pos"><option value="">—</option>${S.settings.positions.map(p => `<option value="${esc(p.id)}" ${p.id === f.position ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field span2"><label for="sh-note">Note pour l'employé (facultatif)</label><input class="input" id="sh-note" value="${esc(f.note || '')}" placeholder="Ex. : réception de marchandise"></div>
    <div class="span2" id="shiftSum">${shiftSummary(f, m.id)}</div>
    <div class="span2 row between">${m.id ? (S.confirm === 'delShift' ? `<span class="confirm">Supprimer ce quart ? <button type="button" class="btn sm danger" data-act="delShift">Supprimer</button><button type="button" class="btn sm" data-act="cancelConfirmModal">Non</button></span>` : `<button type="button" class="btn danger" data-act="delShiftAsk">${svg(IC.trash, 16)} Supprimer</button>`) : '<span></span>'}
      <button class="btn red" type="submit">${svg(IC.check, 16)} Enregistrer</button></div>
  </form>`;
}
function readShiftForm() { return { uid: $('#sh-uid').value, date: $('#sh-date').value, start: $('#sh-start').value, end: $('#sh-end').value, breakMin: Number($('#sh-break').value), position: $('#sh-pos').value, note: $('#sh-note').value.trim() }; }
function shiftSummary(f, id) {
  if (!f.start || !f.end || !f.uid) return '';
  const me = { ...f, id: id || '_new' }, dur = shiftMin(me);
  const list = S.shifts.filter(s => s.uid === f.uid && s.id !== me.id).concat([me]);
  const iss = [...shiftIssues(me, list, S.avail[f.uid], offsFor(f.uid)), ...weekIssues(f.uid, list, S.avail[f.uid]).issues];
  return `<div class="sum"><b>${fmtDur(dur)}</b> sur place · <b>${fmtDur(paidMin(me))}</b> payées · semaine : <b>${fmtDur(list.reduce((a, s) => a + paidMin(s), 0))}</b></div>${iss.map(issueHtml).join('')}`;
}
function updShiftSum() { const el = $('#shiftSum'); if (el && S.modal) el.innerHTML = shiftSummary(readShiftForm(), S.modal.id); }
function publishBody() {
  const wk = S.weekDoc || {}, again = !!wk.published;
  const { issues, total } = gridHtml(true);
  const lead = daysBetween(today(), S.week);
  const errs = issues.filter(i => i.lvl === 'err').length;
  return {
    title: again ? 'Annoncer les modifications' : "Publier l'horaire",
    body: `<p><b>Semaine du ${esc(fmtLong(S.week))}</b> · ${S.shifts.length} quart${S.shifts.length > 1 ? 's' : ''} · ${fmtDur(total)}</p>
      ${lead < 5 ? `<div class="alert warn">${svg(IC.alert, 16)}<span>${lead < 0 ? 'Cette semaine est déjà commencée.' : `La semaine commence dans ${lead} jour${lead > 1 ? 's' : ''}.`} Sans 5 jours d'avis, un employé peut refuser de travailler (LNT, art. 59.0.1).</span></div>` : ''}
      ${issues.length ? `<div class="alert ${errs ? 'bad' : 'warn'}">${svg(IC.alert, 16)}<span>${issues.length} rappel${issues.length > 1 ? 's' : ''} à vérifier${errs ? `, dont ${errs} conflit${errs > 1 ? 's' : ''}` : ''}. Vous pouvez publier quand même.</span></div>` : `<div class="alert ok">${svg(IC.check, 16)}<span>Aucun conflit détecté.</span></div>`}
      <p class="muted">${again ? 'Les employés touchés recevront une notification dans l\'application.' : 'Toute l\'équipe verra l\'horaire tout de suite et recevra une notification dans l\'application.'}</p>
      <div class="row end"><button class="btn" data-act="closeModal">Annuler</button><button class="btn red" data-act="publish">${svg(IC.send, 16)} ${again ? 'Annoncer' : 'Publier'}</button></div>`
  };
}
function offerForm(m) {
  const s = S.myShifts.find(x => x.id === m.id); if (!s) return '<p>Quart introuvable.</p>';
  const others = activeUsers().filter(u => u.id !== S.user.uid);
  return `<div class="sum"><b>${esc(cap(fmtLong(s.date)))}</b> · ${fmtT(s.start)} – ${fmtT(s.end)} · ${esc(posOf(s.position).name)}</div>
    <form data-form="offer" class="form-grid" novalidate>
      <div class="field span2"><label for="of-to">Offrir à</label><select class="input" id="of-to"><option value="">Toute l'équipe</option>${others.map(u => `<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}</select></div>
      <div class="field span2"><label for="of-msg">Message (facultatif)</label><input class="input" id="of-msg" placeholder="Ex. : rendez-vous médical"></div>
      <p class="fine span2">Vous restez responsable du quart jusqu'à ce que la direction approuve l'échange.</p>
      <div class="span2 row end"><button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn red" type="submit">${svg(IC.swap, 16)} Offrir le quart</button></div>
    </form>`;
}
function takeBody(m) {
  const x = S.swaps.find(s => s.id === m.id); if (!x) return '<p>Cette offre n\'est plus disponible.</p>';
  const me = S.user.uid, shift = { ...x, id: '_swap' };
  const mine = S.myShifts.filter(s => s.weekId === x.weekId);
  const known = !!S.myWeeks[x.weekId];
  const iss = [...shiftIssues(shift, mine.concat([shift]), S.myAvail, offsFor(me)), ...(known ? weekIssues(me, mine.concat([shift]), S.myAvail).issues : [])];
  return `<div class="sum"><b>${esc(cap(fmtLong(x.date)))}</b> · ${fmtT(x.start)} – ${fmtT(x.end)} · ${esc(posOf(x.position).name)}<br><span class="muted">Offert par ${esc(nameOf(x.fromUid))}${x.message ? ' · « ' + esc(x.message) + ' »' : ''}</span></div>
    ${iss.map(issueHtml).join('')}
    <p class="muted">La direction doit approuver l'échange. Le quart apparaîtra dans votre horaire une fois approuvé.</p>
    <div class="row end"><button class="btn" data-act="closeModal">Annuler</button><button class="btn red" data-act="take" data-id="${x.id}">${svg(IC.check, 16)} Je prends ce quart</button></div>`;
}
function userForm(m) {
  const u = userById(m.id); if (!u) return '<p>Employé introuvable.</p>';
  const c = S.contacts[u.id] || {}, w = S.wages[u.id], self = u.id === S.user.uid, approve = m.kind === 'approve';
  return `<div class="row"><span class="avatar" style="--c:${esc(u.color || '#777')}">${esc(initials(u))}</span><div><b>${esc(fullName(u))}</b><div class="fine">${esc(c.email || '')}${c.phone ? ' · ' + esc(c.phone) : ''}</div></div></div>
    <form data-form="${approve ? 'approve' : 'edituser'}" data-id="${u.id}" class="form-grid" novalidate>
      <div class="field"><label for="u-pos">Poste principal</label><select class="input" id="u-pos"><option value="">À définir</option>${S.settings.positions.map(p => `<option value="${esc(p.id)}" ${p.id === u.position ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="u-wage">Taux horaire ($, visible par la direction)</label><input class="input" id="u-wage" type="number" min="0" step="0.01" inputmode="decimal" value="${w != null ? esc(w) : ''}"></div>
      ${approve ? '' : `<div class="field"><label for="u-role">Rôle</label><select class="input" id="u-role" ${isOwner() && !self ? '' : 'disabled'}><option value="employee" ${u.role !== 'manager' ? 'selected' : ''}>Employé</option><option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Gérant (bâtit l'horaire, approuve)</option></select></div>
      <div class="field"><label for="u-status">Accès</label><select class="input" id="u-status" ${self ? 'disabled' : ''}><option value="active">Actif</option><option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>Désactivé (ne voit plus l'horaire)</option></select></div>`}
      <div class="field span2"><label>Couleur</label><div class="swatches">${COLORS.map(col => `<button type="button" class="swatch" style="--c:${col}" data-act="swatch" data-v="${col}" aria-label="Couleur ${col}" aria-pressed="${(u.color || '') === col}"></button>`).join('')}</div><input type="hidden" id="u-color" value="${esc(u.color || COLORS[0])}"></div>
      ${!approve && !isOwner() ? '<p class="fine span2">Seul le propriétaire peut nommer un gérant.</p>' : ''}
      <div class="span2 row end"><button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn red" type="submit">${svg(IC.check, 16)} ${approve ? 'Approuver' : 'Enregistrer'}</button></div>
    </form>
    ${approve || self ? '' : `<div class="leave-box">${S.confirm === 'rmUser'
      ? `<p><b>Retirer ${esc(fullName(u))} de l'équipe ?</b><br><span class="fine">Son accès à l'app est coupé et ses quarts à venir (${futureShiftsCount(u.id)}) sont supprimés. Ses anciens quarts restent dans l'historique. Vous pourrez le réactiver plus tard.</span></p>
        <div class="row end"><button type="button" class="btn sm" data-act="cancelConfirmModal">Annuler</button><button type="button" class="btn sm danger" data-act="removeUser" data-id="${u.id}">${svg(IC.trash, 15)} Oui, retirer</button></div>`
      : `<button type="button" class="btn danger" style="width:100%" data-act="removeUserAsk">${svg(IC.trash, 16)} Retirer de l'équipe (ne travaille plus ici)</button>`}</div>`}`;
}
function feedBody() {
  const items = feedItems().slice(0, 50);
  return items.length ? items.map(f => `<div class="feed-item ${S.readFeed.includes(f.id) ? '' : 'unread'}"><span class="dot"></span><div><p>${esc(f.text)}</p><small>${esc(fmtStamp(f.createdAt))}</small></div></div>`).join('') : `<div class="empty">Aucune nouvelle pour l'instant.</div>`;
}

/* ---------------- Actions ---------------- */
const AUTH_ERR = {
  'auth/email-already-in-use': 'Un compte existe déjà avec ce courriel. Connectez-vous (ou utilisez « Continuer avec Google »).',
  'auth/invalid-email': 'Adresse courriel invalide.',
  'auth/weak-password': 'Mot de passe trop faible : 8 caractères minimum.',
  'auth/invalid-credential': 'Courriel ou mot de passe incorrect.',
  'auth/invalid-login-credentials': 'Courriel ou mot de passe incorrect.',
  'auth/wrong-password': 'Courriel ou mot de passe incorrect.',
  'auth/user-not-found': 'Courriel ou mot de passe incorrect.',
  'auth/missing-password': 'Entrez votre mot de passe.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion Internet.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
  'auth/requires-recent-login': 'Par sécurité, déconnectez-vous puis reconnectez-vous avant de réessayer.',
  'auth/operation-not-allowed': 'Ce mode de connexion n\'est pas encore activé pour ce magasin.',
  'auth/account-exists-with-different-credential': 'Ce courriel est déjà utilisé avec un mot de passe. Connectez-vous avec votre courriel et votre mot de passe.',
  'auth/unauthorized-domain': 'La connexion Google n\'est pas encore autorisée pour cette adresse.',
  'auth/popup-blocked': 'La fenêtre Google a été bloquée. Réessayez.',
  'auth/web-storage-unsupported': 'Activez les cookies de ce site pour vous connecter.'
};
const authErr = e => AUTH_ERR[e && e.code] || 'Une erreur est survenue. Réessayez.';
function showMsg(kind, text) { S.msg = { kind, text }; render(true); }
async function withContinue(fn) {
  try { await fn({ url: location.origin + location.pathname }); }
  catch (e) { if (/continue-uri|unauthorized-domain/.test(String(e.code))) await fn(undefined); else throw e; }
}
const sendVerif = user => withContinue(s => sendEmailVerification(user, s));

function doEmailStep() {
  const email = val('li-email');
  if (!EMAIL_RE.test(email)) return showMsg('err', 'Entrez une adresse courriel valide.');
  S.draft['li-email'] = email; S.msg = null; S.authView = 'password'; render(true);
  setTimeout(() => { const pw = $('#li-pw'); if (pw) pw.focus(); }, 60);
}
async function doLogin() {
  const email = String(dv('li-email', '')).trim(), pw = $('#li-pw').value;
  if (!email) { S.authView = 'email'; return render(true); }
  if (!pw) return showMsg('err', 'Entrez votre mot de passe.');
  try { S.msg = null; await signInWithEmailAndPassword(auth, email, pw); clearDraft('li-'); }
  catch (e) {
    const bad = ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found'].includes(e.code);
    showMsg('err', authErr(e) + (bad && googleOn() ? ' Inscrit avec Google ? Utilisez « Continuer avec Google ».' : ''));
  }
}
const isStandalone = () => standaloneMode;
async function doGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  S.msg = null;
  try {
    // Application installée sur l'écran d'accueil : redirection (les fenêtres surgissantes y sont peu fiables)
    if (isStandalone()) await signInWithRedirect(auth, provider);
    else await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    showMsg('err', authErr(e));
  }
}
async function doReset() {
  const email = val('rs-email');
  if (!email) return showMsg('err', 'Entrez votre courriel.');
  try { await withContinue(s => sendPasswordResetEmail(auth, email, s)); showMsg('ok', `Si un compte existe pour ${email}, un courriel de réinitialisation vient d'être envoyé.`); }
  catch (e) { showMsg('err', authErr(e)); }
}
async function createProfile(user, first, last, phone) {
  const owner = isOwnerEmail(user) && user.emailVerified, now = nowISO(), batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), { firstName: first, lastName: last, status: owner ? 'active' : 'pending', role: owner ? 'manager' : 'employee', position: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: now, updatedAt: now });
  batch.set(doc(db, 'contacts', user.uid), { email: user.email, phone: phone || '', emailVerified: !!user.emailVerified, updatedAt: now });
  await batch.commit();
}
async function doSignup() {
  const first = val('su-first'), last = val('su-last'), email = val('su-email'), phone = val('su-phone'), pw = $('#su-pw').value, pw2 = $('#su-pw2').value;
  if (!first || !last) return showMsg('err', 'Entrez votre prénom et votre nom.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showMsg('err', 'Adresse courriel invalide.');
  if (pw.length < 8) return showMsg('err', 'Le mot de passe doit contenir au moins 8 caractères.');
  if (pw !== pw2) return showMsg('err', 'Les deux mots de passe ne correspondent pas.');
  if (!$('#su-consent').checked) return showMsg('err', 'Cochez la case de consentement pour continuer.');
  S.msg = null; S.signingUp = true; render(true);
  let cred;
  try { cred = await createUserWithEmailAndPassword(auth, email, pw); }
  catch (e) { S.signingUp = false; return showMsg('err', authErr(e)); }
  try { await createProfile(cred.user, first, last, phone); } catch (e) { console.warn(e); }
  try { await sendVerif(cred.user); } catch (e) { console.warn(e); }
  clearDraft('su-'); S.signingUp = false; render(true);
  if (location.hash) history.replaceState(null, '', location.pathname);
}
async function doComplete() {
  const first = val('cp-first'), last = val('cp-last'), phone = val('cp-phone');
  if (!first || !last) return toast('Entrez votre prénom et votre nom.', 'bad');
  if (!$('#cp-consent').checked) return toast('Cochez la case de consentement pour continuer.', 'bad');
  await createProfile(S.user, first, last, phone); clearDraft('cp-');
}
async function checkVerif() {
  await S.user.reload();
  if (!auth.currentUser.emailVerified) return toast('Le courriel n\'est pas encore confirmé. Ouvrez le lien reçu, puis réessayez.', 'bad');
  await auth.currentUser.getIdToken(true);
  startSession(auth.currentUser); toast('Courriel confirmé');
}

async function saveShift() {
  const f = readShiftForm(), id = S.modal.id;
  if (!f.uid || !f.date || !f.start || !f.end || f.start === f.end) return toast('Vérifiez l\'employé et les heures.', 'bad');
  const pub = !!(S.weekDoc && S.weekDoc.published), now = nowISO(), batch = writeBatch(db);
  const data = { ...f, weekId: weekOf(f.date), published: pub, reminded: false, updatedAt: now, updatedBy: S.user.uid };
  if (pub) data.modifiedAfterPublish = true;
  const old = id ? S.shifts.find(s => s.id === id) : null;
  if (id) batch.update(doc(db, 'shifts', id), data);
  else batch.set(doc(collection(db, 'shifts')), { ...data, modifiedAfterPublish: pub, createdAt: now });
  if (pub) batch.set(doc(db, 'weeks', S.week), { changedUids: arrayUnion(...new Set([f.uid, old ? old.uid : f.uid])), updatedAt: now }, { merge: true });
  if (old && old.uid !== f.uid) S.swaps.filter(x => x.shiftId === id).forEach(x => batch.update(doc(db, 'swaps', x.id), { status: 'cancelled', updatedAt: now }));
  await batch.commit(); closeModal(); toast(id ? 'Quart modifié' : 'Quart ajouté');
}
async function deleteShift(id) {
  const s = S.shifts.find(x => x.id === id); if (!s) return closeModal();
  const pub = !!(S.weekDoc && S.weekDoc.published), now = nowISO(), batch = writeBatch(db);
  batch.delete(doc(db, 'shifts', id));
  if (pub) batch.set(doc(db, 'weeks', S.week), { changedUids: arrayUnion(s.uid), updatedAt: now }, { merge: true });
  S.swaps.filter(x => x.shiftId === id).forEach(x => batch.update(doc(db, 'swaps', x.id), { status: 'cancelled', updatedAt: now }));
  await batch.commit(); closeModal(); toast('Quart supprimé');
}
async function copyPrevWeek() {
  const snap = await getDocs(query(collection(db, 'shifts'), where('weekId', '==', addDays(S.week, -7))));
  const ids = new Set(activeUsers().map(u => u.id)), pub = !!(S.weekDoc && S.weekDoc.published), now = nowISO();
  const batch = writeBatch(db); let n = 0;
  snap.forEach(d => {
    const s = d.data(); if (!ids.has(s.uid)) return;
    batch.set(doc(collection(db, 'shifts')), { uid: s.uid, date: addDays(s.date, 7), weekId: S.week, start: s.start, end: s.end, breakMin: s.breakMin || 0, position: s.position || '', note: s.note || '', published: pub, modifiedAfterPublish: pub, createdAt: now, updatedAt: now, updatedBy: S.user.uid });
    n++;
  });
  if (!n) return toast('La semaine précédente est vide.', 'bad');
  if (pub) batch.set(doc(db, 'weeks', S.week), { changedUids: arrayUnion(...new Set(snap.docs.map(d => d.data().uid).filter(u => ids.has(u)))), updatedAt: now }, { merge: true });
  await batch.commit(); toast(`${n} quart${n > 1 ? 's' : ''} copié${n > 1 ? 's' : ''}`);
}
async function publishWeek() {
  const wk = S.weekDoc || {}, again = !!wk.published, now = nowISO(), batch = writeBatch(db);
  batch.set(doc(db, 'weeks', S.week), { published: true, publishedAt: now, publishedBy: S.user.uid, changedUids: [], updatedAt: now }, { merge: true });
  S.shifts.forEach(s => { if (!s.published || s.modifiedAfterPublish) batch.update(doc(db, 'shifts', s.id), { published: true, modifiedAfterPublish: false }); });
  if (!again) batch.set(doc(db, 'feed', feedId()), { audience: 'all', type: 'publish', week: S.week, text: `L'horaire de la semaine du ${fmtLong(S.week)} est publié.`, createdAt: now });
  else new Set([...(wk.changedUids || []), ...S.shifts.filter(s => s.modifiedAfterPublish).map(s => s.uid)]).forEach(u => batch.set(doc(db, 'feed', feedId()), { audience: u, type: 'change', week: S.week, text: `Votre horaire de la semaine du ${fmtLong(S.week)} a changé. Vérifiez vos quarts.`, createdAt: now }));
  await batch.commit(); closeModal(); toast(again ? 'Modifications annoncées' : 'Horaire publié');
  const wk2 = fmtLong(S.week);
  if (!again) pushTo([...new Set(S.shifts.map(s => s.uid))], 'Votre horaire est disponible', `L'horaire de la semaine du ${wk2} est publié. Touchez pour voir vos quarts.`, { tag: 'publie-' + S.week });
  else pushTo([...new Set([...(wk.changedUids || []), ...S.shifts.filter(s => s.modifiedAfterPublish).map(s => s.uid)])], 'Votre horaire a changé', `Des quarts ont été modifiés pour la semaine du ${wk2}. Touchez pour vérifier.`, { tag: 'change-' + S.week });
}
async function unpublishWeek() {
  const now = nowISO(), batch = writeBatch(db);
  batch.set(doc(db, 'weeks', S.week), { published: false, changedUids: [], updatedAt: now }, { merge: true });
  S.shifts.forEach(s => batch.update(doc(db, 'shifts', s.id), { published: false, modifiedAfterPublish: false }));
  await batch.commit(); toast('Publication retirée');
}
async function offerSwap(form) {
  const s = S.myShifts.find(x => x.id === S.modal.id); if (!s) return;
  const now = nowISO();
  await addDoc(collection(db, 'swaps'), { shiftId: s.id, weekId: s.weekId, date: s.date, start: s.start, end: s.end, breakMin: s.breakMin || 0, position: s.position || '', fromUid: S.user.uid, toUid: $('#of-to').value, message: val('of-msg'), status: 'open', takenBy: '', createdAt: now, updatedAt: now });
  closeModal(); toast('Quart offert à l\'équipe');
}
async function takeSwap(id) {
  const now = nowISO();
  await updateDoc(doc(db, 'swaps', id), { status: 'taken', takenBy: S.user.uid, takenAt: now, updatedAt: now });
  closeModal(); toast('Demande envoyée à la direction');
}
async function decideSwap(id, v) {
  const x = S.swaps.find(s => s.id === id); if (!x) return;
  const now = nowISO(), batch = writeBatch(db), when = `${fmtLong(x.date)} (${hm(x.start)}–${hm(x.end)})`;
  if (v === 'approved') {
    const snap = await getDoc(doc(db, 'shifts', x.shiftId));
    if (!snap.exists() || snap.data().uid !== x.fromUid) { await updateDoc(doc(db, 'swaps', id), { status: 'cancelled', updatedAt: now }); return toast('Ce quart a changé depuis l\'offre : échange annulé.', 'bad'); }
    batch.update(doc(db, 'shifts', x.shiftId), { uid: x.takenBy, updatedAt: now, updatedBy: S.user.uid });
  }
  batch.update(doc(db, 'swaps', id), { status: v, decidedBy: S.user.uid, decidedAt: now, updatedAt: now });
  const fromName = shortName(userById(x.fromUid)), takerName = shortName(userById(x.takenBy));
  if (v === 'approved') {
    batch.set(doc(db, 'feed', feedId()), { audience: x.fromUid, type: 'swap', text: `Échange approuvé : ${takerName} prend votre quart du ${when}.`, createdAt: now });
    batch.set(doc(db, 'feed', feedId()), { audience: x.takenBy, type: 'swap', text: `Échange approuvé : vous travaillez le ${when}.`, createdAt: now });
  } else if (v === 'refused') {
    batch.set(doc(db, 'feed', feedId()), { audience: x.fromUid, type: 'swap', text: `Échange refusé : vous gardez votre quart du ${when}.`, createdAt: now });
    if (x.takenBy) batch.set(doc(db, 'feed', feedId()), { audience: x.takenBy, type: 'swap', text: `Échange refusé : le quart du ${when} reste à ${fromName}.`, createdAt: now });
  }
  await batch.commit(); toast(v === 'approved' ? 'Échange approuvé' : v === 'refused' ? 'Échange refusé' : 'Offre annulée');
  if (v === 'approved') pushTo([x.fromUid, x.takenBy], 'Échange approuvé', `Quart du ${when} : ${takerName} le remplace.`);
  else if (v === 'refused') pushTo([x.fromUid, x.takenBy], 'Échange refusé', `Le quart du ${when} reste à ${fromName}.`);
}
async function saveAvail() {
  const a = S.availDraft;
  for (let d = 0; d < 7; d++) { const x = a.days[d]; if (x.type === 'range' && (!x.from || !x.to || toMin(x.to) <= toMin(x.from))) return toast(`Plage invalide le ${DAYS_LONG[d]}.`, 'bad'); }
  await setDoc(doc(db, 'availability', S.user.uid), { days: a.days, maxHours: a.maxHours === '' ? '' : Number(a.maxHours), note: String(a.note || '').trim(), updatedAt: nowISO() });
  S.availDirty = false; toast('Disponibilités enregistrées'); render(true);
}
async function submitTimeoff() {
  const allDay = $('#to-allday').checked, from = $('#to-from').value, to = $('#to-to').value;
  const start = allDay ? '' : $('#to-start').value, end = allDay ? '' : $('#to-end').value;
  if (!from || !to || to < from) return toast('Vérifiez les dates : la fin doit suivre le début.', 'bad');
  if (!allDay && (!start || !end || toMin(end) <= toMin(start))) return toast('Vérifiez les heures.', 'bad');
  const now = nowISO();
  await addDoc(collection(db, 'timeoff'), { uid: S.user.uid, type: $('#to-type').value, from, to, allDay, start, end, note: val('to-note'), status: 'pending', createdAt: now, updatedAt: now });
  clearDraft('to-'); toast('Demande envoyée à la direction'); render(true);
}
async function decideOff(id, v) {
  const o = S.timeoff.find(x => x.id === id); if (!o) return;
  const note = val('mn-' + id), now = nowISO(), batch = writeBatch(db);
  batch.update(doc(db, 'timeoff', id), { status: v, decidedBy: S.user.uid, decidedAt: now, managerNote: note, updatedAt: now });
  batch.set(doc(db, 'feed', feedId()), { audience: o.uid, type: 'timeoff', text: `Votre demande de congé (${toRange(o).toLowerCase()}) a été ${v === 'approved' ? 'approuvée' : 'refusée'}.${note ? ' Note : ' + note : ''}`, createdAt: now });
  await batch.commit(); toast(v === 'approved' ? 'Congé approuvé' : 'Congé refusé');
  pushTo([o.uid], v === 'approved' ? 'Congé approuvé' : 'Congé refusé', `Votre demande de congé (${toRange(o).toLowerCase()}) a été ${v === 'approved' ? 'approuvée' : 'refusée'}.`);
}
async function saveUser(form, approve) {
  const id = form.dataset.id, now = nowISO(), batch = writeBatch(db);
  const upd = { position: $('#u-pos').value, color: $('#u-color').value, updatedAt: now };
  if (approve) upd.status = 'active';
  const role = $('#u-role'); if (role && !role.disabled) upd.role = role.value;
  const st = $('#u-status'); if (st && !st.disabled) upd.status = st.value;
  batch.update(doc(db, 'users', id), upd);
  const w = $('#u-wage').value;
  if (w !== '') batch.set(doc(db, 'wages', id), { hourly: Number(w), updatedAt: now });
  if (approve) batch.set(doc(db, 'feed', feedId()), { audience: id, type: 'welcome', text: `Bienvenue dans l'équipe ${C.store.code} ! Votre compte est activé. Remplissez vos disponibilités dans « Demandes ».`, createdAt: now });
  await batch.commit(); closeModal(); toast(approve ? 'Compte approuvé' : 'Enregistré');
  if (approve) pushTo([id], 'Compte activé', `Bienvenue dans l'équipe ${C.store.code} ! Vous avez maintenant accès à l'horaire.`);
}
const futureShifts = async uid => (await getDocs(query(collection(db, 'shifts'), where('uid', '==', uid)))).docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.date >= today());
const futureShiftsCount = uid => S.shifts.filter(x => x.uid === uid && x.date >= today()).length || 'le cas échéant';
// Employé qui a quitté : accès coupé, quarts à venir retirés, historique conservé
document.addEventListener('toggle', e => { if (e.target.id === 'old-staff') S.oldOpen = e.target.open; }, true);
async function removeUser(id) {
  const u = userById(id); if (!u) return closeModal();
  const now = nowISO(), shifts = await futureShifts(id), batch = writeBatch(db);
  batch.update(doc(db, 'users', id), { status: 'inactive', updatedAt: now });
  const weeks = new Set();
  shifts.forEach(x => { batch.delete(doc(db, 'shifts', x.id)); if (x.published) weeks.add(x.weekId); });
  weeks.forEach(w => batch.set(doc(db, 'weeks', w), { changedUids: arrayUnion(id), updatedAt: now }, { merge: true }));
  S.swaps.filter(x => x.fromUid === id || x.takenBy === id).forEach(x => batch.update(doc(db, 'swaps', x.id), { status: 'cancelled', updatedAt: now }));
  await batch.commit(); closeModal();
  toast(`${fullName(u)} retiré de l'équipe` + (shifts.length ? ` · ${shifts.length} quart${shifts.length > 1 ? 's' : ''} à venir supprimé${shifts.length > 1 ? 's' : ''}` : ''));
}
// Propriétaire : efface le profil, les coordonnées, le taux et les disponibilités
async function purgeUser(id) {
  const u = userById(id); if (!u || u.status === 'active') return;
  const batch = writeBatch(db);
  ['users', 'contacts', 'wages', 'availability'].forEach(c => batch.delete(doc(db, c, id)));
  await batch.commit(); toast(`${fullName(u)} supprimé définitivement`);
}
async function saveProfile() {
  const first = val('pf-first'), last = val('pf-last'), phone = val('pf-phone');
  if (!first || !last) return toast('Prénom et nom requis.', 'bad');
  const now = nowISO(), batch = writeBatch(db);
  batch.update(doc(db, 'users', S.user.uid), { firstName: first, lastName: last, updatedAt: now });
  batch.set(doc(db, 'contacts', S.user.uid), { email: S.user.email, phone, updatedAt: now }, { merge: true });
  await batch.commit(); clearDraft('pf-'); toast('Profil enregistré');
}
async function changePw() {
  const cur = $('#pw-cur').value, n1 = $('#pw-new').value, n2 = $('#pw-new2').value;
  if (n1.length < 8) return toast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'bad');
  if (n1 !== n2) return toast('Les deux mots de passe ne correspondent pas.', 'bad');
  try { await reauthenticateWithCredential(S.user, EmailAuthProvider.credential(S.user.email, cur)); await updatePassword(S.user, n1); }
  catch (e) { return toast(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'Mot de passe actuel incorrect.' : authErr(e), 'bad'); }
  ['pw-cur', 'pw-new', 'pw-new2'].forEach(i => { $('#' + i).value = ''; });
  toast('Mot de passe modifié');
}
async function linkPassword() {
  const n1 = $('#lp-new').value, n2 = $('#lp-new2').value;
  if (n1.length < 8) return toast('Le mot de passe doit contenir au moins 8 caractères.', 'bad');
  if (n1 !== n2) return toast('Les deux mots de passe ne correspondent pas.', 'bad');
  try {
    try { await linkWithCredential(S.user, EmailAuthProvider.credential(S.user.email, n1)); }
    catch (e) { if (e.code === 'auth/email-already-in-use' || e.code === 'auth/credential-already-in-use') await updatePassword(S.user, n1); else throw e; }
  }
  catch (e) { return toast(e.code === 'auth/requires-recent-login' ? 'Par sécurité, déconnectez-vous, reconnectez-vous avec Google, puis réessayez.' : e.code === 'auth/provider-already-linked' ? 'Un mot de passe existe déjà pour ce compte.' : authErr(e), 'bad'); }
  await S.user.reload(); toast('Mot de passe créé. Utilisez-le dans l\'app installée.'); render(true);
}
async function saveSettings() {
  const sd = S.setDraft;
  sd.positions = sd.positions.filter(p => String(p.name).trim()).map(p => ({ ...p, name: String(p.name).trim(), id: p.id || String(p.name).trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-') + '-' + uidRand() }));
  sd.presets = sd.presets.filter(p => String(p.label).trim() && p.start && p.end).map(p => ({ ...p, label: String(p.label).trim(), breakMin: Number(p.breakMin) || 0 }));
  await setDoc(doc(db, 'settings', 'store'), { positions: sd.positions, presets: sd.presets, updatedAt: nowISO() });
  S.setDraft = null; toast('Réglages enregistrés'); render(true);
}
async function saveBudget() {
  const h = $('#bd-hours').value, s = $('#bd-sales').value;
  await setDoc(doc(db, 'budgets', S.week), { hours: h === '' ? '' : Number(h), sales: s === '' ? '' : Number(s), updatedAt: nowISO() }, { merge: true });
  toast('Budget enregistré');
}
function markFeedRead() { S.readFeed = [...new Set([...feedItems().map(f => f.id), ...S.readFeed])].slice(0, 300); ls.set('readFeed', S.readFeed); }
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); toast('Lien copié'); }
  catch (e) { const el = $('#inv-link'); if (el) { el.select(); try { document.execCommand('copy'); toast('Lien copié'); } catch (x) { } } }
}
function toast(msg, kind) {
  const w = $('#toasts'), el = document.createElement('div');
  el.className = 'toast' + (kind === 'bad' ? ' bad' : ''); el.textContent = msg; w.appendChild(el);
  while (w.children.length > 2) w.firstElementChild.remove();
  setTimeout(() => el.remove(), kind === 'bad' ? 5000 : 2600);
}
function handleErr(e) {
  console.error(e);
  const c = e && e.code;
  toast(c === 'permission-denied' ? 'Action non autorisée pour votre compte.' : c === 'unavailable' ? 'Pas de connexion. Réessayez.' : String(c || '').startsWith('auth/') ? authErr(e) : 'Une erreur est survenue. Réessayez.', 'bad');
}

/* ---------------- Événements ---------------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'closeModal' && el.classList.contains('modal') && e.target.closest('.sheet')) return;
  try {
    switch (act) {
      case 'nav': S.view = el.dataset.v; ls.set('view', S.view); S.confirm = null; S.setDraft = null; render(true); window.scrollTo(0, 0); break;
      case 'authView': S.authView = el.dataset.v; S.msg = null; render(true); break;
      case 'google': await doGoogle(); break;
      case 'logout': S.view = null; await signOut(auth); break;
      case 'checkVerif': await checkVerif(); break;
      case 'resendVerif': await sendVerif(S.user); toast('Courriel de confirmation renvoyé'); break;
      case 'wk': { const v = Number(el.dataset.v); S.week = v === 0 ? weekOf(today()) : addDays(S.week, 7 * v); S.confirm = null; subWeek(); render(true); break; }
      case 'newShift': openModal({ kind: 'shift', id: null, uid: el.dataset.uid, date: el.dataset.date }); break;
      case 'editShift': openModal({ kind: 'shift', id }); break;
      case 'preset': { const p = S.settings.presets[Number(el.dataset.i)]; $('#sh-start').value = p.start; $('#sh-end').value = p.end; $('#sh-break').value = String(Number(p.breakMin) || 0); S.breakTouched = true; updShiftSum(); break; }
      case 'delShiftAsk': S.confirm = 'delShift'; renderModal(); break;
      case 'cancelConfirmModal': S.confirm = null; renderModal(); break;
      case 'delShift': await deleteShift(S.modal.id); break;
      case 'copyAsk': S.confirm = 'copy'; render(true); break;
      case 'copyPrev': S.confirm = null; render(true); await copyPrevWeek(); break;
      case 'publishAsk': openModal({ kind: 'publish' }); break;
      case 'publish': await publishWeek(); break;
      case 'unpubAsk': S.confirm = 'unpub'; render(true); break;
      case 'unpublish': S.confirm = null; await unpublishWeek(); break;
      case 'cancelConfirm': S.confirm = null; render(true); break;
      case 'offerAsk': openModal({ kind: 'offer', id }); break;
      case 'takeAsk': openModal({ kind: 'take', id }); break;
      case 'take': await takeSwap(id); break;
      case 'cancelSwapAsk': S.confirm = 'cx' + id; render(true); break;
      case 'cancelSwap': S.confirm = null; await updateDoc(doc(db, 'swaps', id), { status: 'cancelled', updatedAt: nowISO() }); toast('Offre annulée'); break;
      case 'decideSwap': await decideSwap(id, el.dataset.v); break;
      case 'avType': { S.availDraft.days[el.dataset.d].type = el.dataset.v; S.availDirty = true; render(true); break; }
      case 'saveAvail': await saveAvail(); break;
      case 'cancelOffAsk': S.confirm = 'co' + id; render(true); break;
      case 'cancelOff': S.confirm = null; await updateDoc(doc(db, 'timeoff', id), { status: 'cancelled', updatedAt: nowISO() }); toast('Demande annulée'); break;
      case 'decideOff': await decideOff(id, el.dataset.v); break;
      case 'reqTab': S.reqTab = el.dataset.v; render(true); break;
      case 'approveAsk': openModal({ kind: 'approve', id }); break;
      case 'refuseAsk': S.confirm = 'ref' + id; render(true); break;
      case 'refuseUser': S.confirm = null; await updateDoc(doc(db, 'users', id), { status: 'refused', updatedAt: nowISO() }); toast('Compte refusé'); break;
      case 'reactivate': await updateDoc(doc(db, 'users', id), { status: 'active', updatedAt: nowISO() }); toast('Compte activé'); break;
      case 'editUserAsk': openModal({ kind: 'edit', id }); break;
      case 'removeUserAsk': S.confirm = 'rmUser'; renderModal(); break;
      case 'removeUser': await removeUser(id); break;
      case 'purgeAsk': S.confirm = 'purge' + id; render(true); break;
      case 'purgeUser': S.confirm = null; await purgeUser(id); break;
      case 'swatch': document.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b === el))); $('#u-color').value = el.dataset.v; break;
      case 'copy': await copyText(el.dataset.v); break;
      case 'feed': openModal({ kind: 'feed' }); markFeedRead(); render(true); break;
      case 'closeModal': closeModal(); break;
      case 'addPos': S.setDraft.positions.push({ id: '', name: 'Nouveau poste', color: COLORS[S.setDraft.positions.length % COLORS.length] }); render(true); break;
      case 'addPreset': S.setDraft.presets.push({ label: 'Nouveau quart', start: '12:00', end: '20:00', breakMin: 30 }); render(true); break;
      case 'rmSet': { const [k, i] = el.dataset.v.split('.'); S.setDraft[k].splice(Number(i), 1); render(true); break; }
      case 'saveSettings': await saveSettings(); break;
      case 'notifOn': await enableNotifications(); break;
      case 'notifTest': await testNotification(); break;
    }
  } catch (err) { handleErr(err); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('[type="submit"]'); if (btn) btn.disabled = true;
  try {
    switch (f.dataset.form) {
      case 'email': doEmailStep(); break;
      case 'login': await doLogin(); break;
      case 'signup': await doSignup(); break;
      case 'reset': await doReset(); break;
      case 'complete': await doComplete(); break;
      case 'shift': await saveShift(); break;
      case 'offer': await offerSwap(f); break;
      case 'approve': await saveUser(f, true); break;
      case 'edituser': await saveUser(f, false); break;
      case 'timeoff': await submitTimeoff(); break;
      case 'profile': await saveProfile(); break;
      case 'password': await changePw(); break;
      case 'linkpw': await linkPassword(); break;
    }
  } catch (err) { handleErr(err); }
  if (btn && btn.isConnected) btn.disabled = false;
});
function onField(e) {
  const el = e.target;
  if (el.closest('#shiftForm')) {
    if (el.id === 'sh-break') S.breakTouched = true;
    if ((el.id === 'sh-start' || el.id === 'sh-end') && $('#sh-start').value && $('#sh-end').value) {
      const dur = shiftMin({ start: $('#sh-start').value, end: $('#sh-end').value });
      // Pause repas proposée automatiquement : 30 min au-delà de 5 h, aucune sinon (sauf choix manuel)
      if (dur > 300 && Number($('#sh-break').value) < 30) $('#sh-break').value = '30';
      else if (dur <= 300 && !S.breakTouched) $('#sh-break').value = '0';
    }
    updShiftSum(); return;
  }
  if (el.dataset.av !== undefined && S.availDraft) {
    const k = el.dataset.av;
    if (k === 'from' || k === 'to') S.availDraft.days[el.dataset.d][k] = el.value;
    else if (k === 'max') S.availDraft.maxHours = el.value;
    else if (k === 'note') S.availDraft.note = el.value;
    S.availDirty = true; return;
  }
  if (el.dataset.set !== undefined && S.setDraft) { const [k, i, f] = el.dataset.set.split('.'); S.setDraft[k][Number(i)][f] = el.value; return; }
  if (el.id && el.closest('#app') && el.type !== 'password') S.draft[el.id] = el.type === 'checkbox' ? el.checked : el.value;
}
document.addEventListener('input', onField);
document.addEventListener('change', e => {
  onField(e);
  const el = e.target;
  if (el.id === 'to-allday') render(true);
  if (el.id === 'to-from' && dv('to-to', today()) < el.value) { S.draft['to-to'] = el.value; const t = $('#to-to'); if (t) t.value = el.value; }
  if (el.dataset.bd !== undefined) saveBudget().catch(handleErr);
});
document.addEventListener('focusout', () => setTimeout(() => { if (S.pendingRender && !isTyping()) render(); }, 120));
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('issues')) S.issuesOpen = e.target.open; }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.modal) closeModal(); });
window.addEventListener('hashchange', () => { if (!S.user && location.hash === '#inscription') { S.authView = 'signup'; render(true); } });

render(true);
