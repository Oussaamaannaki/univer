import crypto from 'node:crypto';
import { send, readBody, verifyUser, patchFields, robotDoc } from './_lib.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await readBody(req);
  const u = await verifyUser(b.idToken);
  if (!u) return send(res, 401, { error: 'auth' });
  const s = b.subscription || {};
  if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return send(res, 400, { error: 'subscription' });
  const id = crypto.createHash('sha256').update(s.endpoint).digest('hex').slice(0, 20);
  try {
    await patchFields(robotDoc(), { [`subs.${u.uid}.${id}`]: b.remove ? undefined : { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, device: String(b.device || '').slice(0, 120), createdAt: new Date().toISOString() } });
    send(res, 200, { ok: true });
  } catch (e) { send(res, 503, { error: 'not_ready', detail: e.message }); }
}
