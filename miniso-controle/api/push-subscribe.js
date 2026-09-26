import crypto from 'node:crypto';
import { getAdmin, send, readBody, verifyUser } from './_lib.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const adm = getAdmin();
  if (!adm) return send(res, 503, { error: 'not_configured' });
  const b = await readBody(req);
  const tok = await verifyUser(adm, b.idToken);
  if (!tok) return send(res, 401, { error: 'auth' });
  const s = b.subscription || {};
  if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return send(res, 400, { error: 'subscription' });
  const id = crypto.createHash('sha256').update(s.endpoint).digest('hex').slice(0, 20);
  const ref = adm.firestore().doc(`push/${tok.uid}`);
  if (b.remove) await ref.set({ subs: { [id]: adm.FieldValue.delete() } }, { merge: true });
  else await ref.set({ subs: { [id]: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, device: String(b.device || '').slice(0, 120), createdAt: new Date().toISOString() } } }, { merge: true });
  send(res, 200, { ok: true });
}
