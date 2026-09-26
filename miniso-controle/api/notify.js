import { send, readBody, verifyUser, isManager, sendTo, query } from './_lib.js';
// Envoi par la direction : horaire publié, congé ou échange décidé, compte approuvé ; ou test personnel
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await readBody(req);
  const u = await verifyUser(b.idToken);
  if (!u) return send(res, 401, { error: 'auth' });
  try {
    let uids = Array.isArray(b.uids) ? b.uids.filter(x => typeof x === 'string').slice(0, 200) : [];
    if (b.test) uids = [u.uid];
    else if (!(await isManager(u))) return send(res, 403, { error: 'forbidden' });
    if (!uids.length && b.all) uids = (await query('users', [['status', 'EQUAL', 'active']])).map(d => d.id);
    const sent = await sendTo(uids, { title: String(b.title || 'MINISO · Horaires').slice(0, 80), body: String(b.body || '').slice(0, 240), url: '/horaires/', tag: String(b.tag || '').slice(0, 40) });
    send(res, 200, { ok: true, sent });
  } catch (e) { send(res, 503, { error: 'not_ready', detail: e.message }); }
}
