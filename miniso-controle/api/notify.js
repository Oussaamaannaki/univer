import { getAdmin, send, readBody, verifyUser, isManager, sendTo } from './_lib.js';
// Envoi par la direction : horaire publié, congé décidé, échange décidé, compte approuvé, test
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const adm = getAdmin();
  if (!adm) return send(res, 503, { error: 'not_configured' });
  const b = await readBody(req);
  const tok = await verifyUser(adm, b.idToken);
  if (!tok) return send(res, 401, { error: 'auth' });
  const db = adm.firestore();
  let uids = Array.isArray(b.uids) ? b.uids.filter(x => typeof x === 'string').slice(0, 200) : [];
  if (b.test) uids = [tok.uid];
  else if (!(await isManager(db, tok))) return send(res, 403, { error: 'forbidden' });
  if (!uids.length && b.all) uids = (await db.collection('users').where('status', '==', 'active').get()).docs.map(d => d.id);
  const title = String(b.title || 'MINISO · Horaires').slice(0, 80), body = String(b.body || '').slice(0, 240);
  const sent = await sendTo(adm, uids, { title, body, url: '/horaires/', tag: String(b.tag || '').slice(0, 40) });
  send(res, 200, { ok: true, sent });
}
