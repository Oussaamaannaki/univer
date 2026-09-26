// Indique si Google accepte la connexion depuis l'app installée (adresse de redirection
// https://<app>/__/auth/handler inscrite dans Google Cloud). L'app active alors Google toute seule.
import { send } from './_lib.js';
const CLIENT_ID = '31960070364-jv8f06dq7f7o82hi557mpm6eanrdk0fq.apps.googleusercontent.com';
const HOST = 'miniso-cah5-granby.vercel.app';
export default async function handler(req, res) {
  try {
    const u = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=openid%20email'
      + '&client_id=' + encodeURIComponent(CLIENT_ID)
      + '&redirect_uri=' + encodeURIComponent(`https://${HOST}/__/auth/handler`);
    const r = await fetch(u, { redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    const ready = r.status >= 300 && r.status < 400 && !!loc && !/oauth\/error|redirect_uri_mismatch/.test(loc);
    send(res, 200, { ready });
  } catch (e) { send(res, 200, { ready: false, detail: e.message }); }
}
