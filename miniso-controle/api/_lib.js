/* Fonctions serveur des notifications de l'app Horaires.
 * Elles agissent avec le compte technique « Notifications (système) » (voir _robot.js),
 * un simple compte employé : les règles de sécurité Firestore s'appliquent à lui aussi. */
import webpush from 'web-push';
import { ROBOT } from './_robot.js';

export const TZ = 'America/Toronto';
export const OWNER = 'annakioussama99@gmail.com';
const API_KEY = 'AIzaSyDPppcThkHBh8pdYmkiyv-SFBwoMG3y_OE';
const PROJECT = 'miniso-horaires-cah5';
const SITE = 'https://miniso-cah5-granby.vercel.app';
const EMU_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST, EMU_FS = process.env.FIRESTORE_EMULATOR_HOST;
const PROJ = EMU_FS ? (process.env.GCLOUD_PROJECT || 'demo-horaires') : PROJECT;
const AUTH_URL = EMU_AUTH ? `http://${EMU_AUTH}/identitytoolkit.googleapis.com/v1` : 'https://identitytoolkit.googleapis.com/v1';
const FS_URL = `${EMU_FS ? `http://${EMU_FS}` : 'https://firestore.googleapis.com'}/v1/projects/${PROJ}/databases/(default)/documents`;
export const robot = () => (globalThis.__ROBOT_OVERRIDE || ROBOT);

export function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

/* ---- Authentification ---- */
let tokenCache = { token: '', exp: 0 };
async function robotToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await fetch(`${AUTH_URL}/accounts:signInWithPassword?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: robot().email, password: robot().password, returnSecureToken: true }) });
  const j = await r.json();
  if (!j.idToken) throw new Error('robot_login');
  tokenCache = { token: j.idToken, exp: Date.now() + (Number(j.expiresIn || 3600) - 300) * 1000 };
  return j.idToken;
}
// Vérifie le jeton d'un utilisateur de l'app et renvoie { uid, email, emailVerified }
export async function verifyUser(idToken) {
  if (!idToken) return null;
  const r = await fetch(`${AUTH_URL}/accounts:lookup?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
  const j = await r.json().catch(() => ({}));
  const u = j.users && j.users[0];
  return u ? { uid: u.localId, email: String(u.email || '').toLowerCase(), emailVerified: !!u.emailVerified } : null;
}

/* ---- Firestore (REST) ---- */
const enc = v => v === null || v === undefined ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const dec = v => !v ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue
  : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'timestampValue' in v ? v.timestampValue
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec) : 'mapValue' in v ? decFields(v.mapValue.fields) : null;
const decFields = f => Object.fromEntries(Object.entries(f || {}).map(([k, x]) => [k, dec(x)]));
async function fs(path, opts = {}) {
  const r = await fetch(`${FS_URL}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await robotToken()}` } });
  if (r.status === 404) return null;
  const j = await r.json();
  if (!r.ok) { const e = new Error('firestore ' + r.status + ' ' + (j.error && j.error.status)); e.status = r.status; throw e; }
  return j;
}
export async function getDoc(path) { const j = await fs('/' + path); return j ? decFields(j.fields) : null; }
// Met à jour seulement les champs donnés (chemins « a.b.c ») ; valeur undefined = suppression du champ
export async function patchFields(path, updates) {
  // Segments hors [A-Za-z_][A-Za-z0-9_]* (ex. un identifiant qui commence par un chiffre) : entre accents graves
  const qp = k => k.split('.').map(p => /^[A-Za-z_][A-Za-z0-9_]*$/.test(p) ? p : '`' + p.replace(/[`\\]/g, '\\$&') + '`').join('.');
  const q = Object.keys(updates).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(qp(k))).join('&');
  const fields = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    const parts = k.split('.'); let cur = fields;
    parts.forEach((p, i) => { if (i === parts.length - 1) cur[p] = enc(v); else { cur[p] = cur[p] || { mapValue: { fields: {} } }; cur = cur[p].mapValue.fields; } });
  }
  await fs(`/${path}?${q}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
}
export async function query(collectionId, filters) {
  const f = filters.map(([field, op, value]) => ({ fieldFilter: { field: { fieldPath: field }, op, value: enc(value) } }));
  const where = f.length === 1 ? f[0] : { compositeFilter: { op: 'AND', filters: f } };
  const j = await fs(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], where } }) });
  return (j || []).filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...decFields(x.document.fields) }));
}

/* ---- Données de notification (dans le document technique du robot) ---- */
const robotDoc = () => `availability/${robot().uid}`;
export async function vapidKeys() {
  const d = (await getDoc(robotDoc())) || {};
  if (d.vapid && d.vapid.publicKey) return d.vapid;
  const k = webpush.generateVAPIDKeys();
  await patchFields(robotDoc(), { vapid: { ...k, createdAt: new Date().toISOString() } });
  return k;
}
export async function isManager(u) {
  if (u.email === OWNER && u.emailVerified) return true;
  const d = await getDoc(`users/${u.uid}`);
  return !!d && d.status === 'active' && d.role === 'manager';
}
export async function sendTo(uids, payload) {
  const d = (await getDoc(robotDoc())) || {};
  const k = d.vapid && d.vapid.publicKey ? d.vapid : await vapidKeys();
  webpush.setVapidDetails(SITE, k.publicKey, k.privateKey);
  const subs = d.subs || {};
  let sent = 0; const gone = {};
  for (const uid of new Set(uids)) {
    for (const [id, sub] of Object.entries(subs[uid] || {})) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 4 * 3600, urgency: 'high' });
        sent++;
      } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) gone[`subs.${uid}.${id}`] = undefined; }
    }
  }
  if (Object.keys(gone).length) await patchFields(robotDoc(), gone);
  return sent;
}
export { robotDoc };

/* ---- Heure du Québec ---- */
export function nowLocal(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
export const fmtT = t => { const [h, m] = t.split(':'); return `${Number(h)} h ${m}`; };
