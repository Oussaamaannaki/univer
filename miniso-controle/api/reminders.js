import { getAdmin, send, sendTo, nowLocal, addDays, toMin, fmtT } from './_lib.js';
// Appelé toutes les 5 minutes : rappel une heure avant chaque quart publié
export default async function handler(req, res) {
  const adm = getAdmin();
  if (!adm) return send(res, 503, { error: 'not_configured' });
  const db = adm.firestore();
  const now = nowLocal();
  const today = now.date, tomorrow = addDays(today, 1);
  const [snap, st] = await Promise.all([db.collection('shifts').where('date', 'in', [today, tomorrow]).get(), db.doc('settings/store').get()]);
  const positions = (st.exists && st.data().positions) || [];
  let sent = 0, due = 0;
  for (const d of snap.docs) {
    const s = d.data();
    if (!s.published || !s.uid || s.reminded) continue;
    const start = (s.date === today ? 0 : 1440) + toMin(s.start);
    const diff = start - now.min;
    if (diff <= 0 || diff > 60) continue;
    due++;
    const pos = positions.find(p => p.id === s.position);
    const n = await sendTo(adm, [s.uid], {
      title: `Rappel : ton quart commence dans ${diff} min`,
      body: `${fmtT(s.start)} – ${fmtT(s.end)}${pos ? ' · ' + pos.name : ''}. Bon quart !`,
      url: '/horaires/', tag: 'rappel-' + d.id
    });
    sent += n;
    await d.ref.update({ reminded: true, remindedAt: new Date().toISOString() });
  }
  send(res, 200, { ok: true, now, due, sent });
}
