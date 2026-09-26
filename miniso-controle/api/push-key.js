import { getAdmin, send, vapidKeys } from './_lib.js';
export default async function handler(req, res) {
  const adm = getAdmin();
  if (!adm) return send(res, 503, { error: 'not_configured' });
  const k = await vapidKeys(adm.firestore());
  send(res, 200, { publicKey: k.publicKey });
}
