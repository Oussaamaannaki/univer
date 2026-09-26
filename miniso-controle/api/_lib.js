/* Outils communs des fonctions serveur (notifications de l'app Horaires). */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';

export const TZ = 'America/Toronto';
export const OWNER = 'annakioussama99@gmail.com';
const SITE = 'https://miniso-cah5-granby.vercel.app';

// Petit objet d'accès : { firestore(), auth(), FieldValue }
export function getAdmin() {
  if (!getApps().length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-horaires' });
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    else return null;
  }
  return { firestore: () => getFirestore(), auth: () => getAuth(), FieldValue };
}

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

// Clés VAPID : créées une seule fois et gardées dans Firestore (collection fermée aux applications)
export async function vapidKeys(db) {
  const ref = db.doc('private/vapid');
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  const k = webpush.generateVAPIDKeys();
  try { await ref.create({ ...k, createdAt: new Date().toISOString() }); return k; }
  catch (e) { return (await ref.get()).data(); }
}

export async function verifyUser(adm, idToken) {
  if (!idToken) return null;
  try { return await adm.auth().verifyIdToken(idToken); } catch (e) { return null; }
}

export async function isManager(db, tok) {
  if (String(tok.email || '').toLowerCase() === OWNER && tok.email_verified) return true;
  const u = await db.doc(`users/${tok.uid}`).get();
  return u.exists && u.data().status === 'active' && u.data().role === 'manager';
}

export async function sendTo(adm, uids, payload) {
  const db = adm.firestore();
  const k = await vapidKeys(db);
  webpush.setVapidDetails(SITE, k.publicKey, k.privateKey);
  let sent = 0;
  for (const uid of new Set(uids)) {
    if (!uid) continue;
    const ref = db.doc(`push/${uid}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const subs = snap.data().subs || {};
    for (const [id, sub] of Object.entries(subs)) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 4 * 3600, urgency: 'high' });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await ref.update({ [`subs.${id}`]: adm.FieldValue.delete() });
      }
    }
  }
  return sent;
}

// Date et minute actuelles à l'heure du Québec
export function nowLocal(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
export const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
export const fmtT = t => { const [h, m] = t.split(':'); return `${Number(h)} h ${m}`; };
