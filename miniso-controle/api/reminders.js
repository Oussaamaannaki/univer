import { send, sendTo, query, getDoc, patchFields, robotDoc, nowLocal, addDays, toMin, fmtT } from './_lib.js';
// Appelé automatiquement toutes les 30 minutes : rappel environ 1 h avant chaque quart publié
const WINDOW = 75;
export default async function handler(req, res) {
  try {
    const now = nowLocal(), today = now.date, tomorrow = addDays(today, 1);
    const [shifts, st, rd] = await Promise.all([
      query('shifts', [['date', 'IN', [today, tomorrow]], ['published', 'EQUAL', true]]),
      getDoc('settings/store'), getDoc(robotDoc())
    ]);
    const positions = (st && st.positions) || [], sentMap = (rd && rd.sent) || {};
    const updates = {}; let due = 0, sent = 0;
    for (const s of shifts) {
      if (!s.uid) continue;
      const key = `${s.date} ${s.start} ${s.uid}`;
      if (sentMap[s.id] === key) continue;
      const diff = (s.date === today ? 0 : 1440) + toMin(s.start) - now.min;
      if (diff <= 0 || diff > WINDOW) continue;
      due++;
      const pos = positions.find(p => p.id === s.position);
      sent += await sendTo([s.uid], {
        title: diff >= 50 ? 'Rappel : ton quart commence dans 1 h' : `Rappel : ton quart commence dans ${diff} min`,
        body: `${fmtT(s.start)} – ${fmtT(s.end)}${pos ? ' · ' + pos.name : ''}. Bon quart !`, url: '/horaires/', tag: 'rappel-' + s.id
      });
      updates[`sent.${s.id}`] = key;
    }
    // Ménage : oublier les rappels de plus de 2 jours
    for (const [id, key] of Object.entries(sentMap)) if (String(key).slice(0, 10) < addDays(today, -2)) updates[`sent.${id}`] = undefined;
    if (Object.keys(updates).length) await patchFields(robotDoc(), updates);
    send(res, 200, { ok: true, now, due, sent });
  } catch (e) { send(res, 503, { error: 'not_ready', detail: e.message }); }
}
