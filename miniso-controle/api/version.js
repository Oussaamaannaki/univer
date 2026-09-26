// Version en ligne (commit publié) : l'app la compare à la sienne pour proposer la mise à jour
import { send } from './_lib.js';
export default function handler(req, res) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
  send(res, 200, { v: sha.slice(0, 7) });
}
