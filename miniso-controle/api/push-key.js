import { send, vapidKeys } from './_lib.js';
export default async function handler(req, res) {
  try { send(res, 200, { publicKey: (await vapidKeys()).publicKey }); }
  catch (e) { send(res, 503, { error: 'not_ready', detail: e.message }); }
}
