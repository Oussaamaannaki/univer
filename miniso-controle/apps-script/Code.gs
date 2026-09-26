/**
 * MINISO · Chemin de contrôle — serveur de synchronisation d'équipe (Google Sheets + Drive).
 * Installation : voir README.md, étape 2.
 */
const TEAM_KEY = 'cah5-granby';   // doit être identique à teamKey dans config.js
const SUPERVISOR_PIN = '2580';    // doit être identique à supervisorPin dans config.js
const PHOTO_FOLDER = 'MINISO Chemin de contrôle — Photos';

const SHEETS = {
  Rapports: ['id', 'Date', 'Heure', 'Magasin', 'Type', 'Quart', 'Responsable', 'Score %', 'Conformes', 'Non conformes', 'S.O.', 'Commentaires', 'Soumis le', 'json'],
  Actions: ['id', 'Statut', 'Action', 'Assigné à', 'Échéance', 'Magasin', 'Point', 'Créée le', 'Réglée le', 'Commentaire', 'json'],
  Messages: ['id', 'Date', 'Auteur', 'Message', 'json'],
  Config: ['id', 'json']
};

function doGet() { return out({ ok: true, app: 'chemin-de-controle' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    if (req.key !== TEAM_KEY) return out({ ok: false, error: 'unauthorized' });
    const needPin = ['saveConfig', 'saveMessage', 'deleteMessage', 'deleteReport'];
    if (needPin.indexOf(req.action) >= 0 && String(req.pin) !== SUPERVISOR_PIN) return out({ ok: false, error: 'pin' });
    switch (req.action) {
      case 'pull': return out(pull());
      case 'saveReport': return out(saveReport(req.report, req.photos || {}));
      case 'saveAction': upsert('Actions', actionRow(req.item)); return out({ ok: true });
      case 'saveMessage': upsert('Messages', [req.item.id, req.item.date, req.item.author, req.item.text, JSON.stringify(req.item)]); return out({ ok: true });
      case 'deleteMessage': remove('Messages', req.id); return out({ ok: true });
      case 'deleteReport': remove('Rapports', req.id); return out({ ok: true });
      case 'saveConfig': upsert('Config', ['main', JSON.stringify(req.config || {})]); return out({ ok: true });
      default: return out({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function saveReport(r, photos) {
  const photoUrls = {};
  const ids = Object.keys(photos);
  if (ids.length) {
    const folder = photoFolder();
    ids.forEach(function (pid) {
      const m = String(photos[pid]).match(/^data:(.*?);base64,(.*)$/);
      if (!m) return;
      const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], r.store + '_' + r.date + '_' + pid + '.jpg');
      const f = folder.createFile(blob);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrls[pid] = 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1000';
    });
  }
  r.photoUrls = Object.assign({}, r.photoUrls || {}, photoUrls);
  upsert('Rapports', [r.id, r.date, r.time, r.store, r.type, r.shift || '', r.manager, r.score, r.ok, r.nok, r.na, r.notes || '', r.submittedAt, JSON.stringify(r)]);
  return { ok: true, photoUrls: photoUrls };
}

function actionRow(a) {
  return [a.id, a.status, a.text, a.assignee || '', a.due || '', a.store || '', a.itemId || '', a.createdAt || '', a.doneAt || '', a.comment || '', JSON.stringify(a)];
}

function pull() {
  const reports = rows('Rapports').slice(-400).map(parseJson).filter(Boolean);
  const actions = rows('Actions').map(parseJson).filter(Boolean);
  const messages = rows('Messages').slice(-50).map(parseJson).filter(Boolean);
  const cfg = rows('Config').filter(function (r) { return r[0] === 'main'; })[0];
  return { ok: true, reports: reports, actions: actions, messages: messages, config: cfg ? JSON.parse(cfg[1]) : null };
}

/* ---------- Outils feuille ---------- */
function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold').setBackground('#D7001D').setFontColor('#FFFFFF');
    sh.hideColumns(SHEETS[name].length);
  }
  return sh;
}
function rows(name) {
  const sh = sheet(name);
  const n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, SHEETS[name].length).getValues();
}
function parseJson(row) { try { return JSON.parse(row[row.length - 1]); } catch (e) { return null; } }
function findRow(name, id) {
  const sh = sheet(name);
  const n = sh.getLastRow(); if (n < 2) return -1;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function upsert(name, values) {
  const sh = sheet(name);
  const r = findRow(name, values[0]);
  if (r > 0) sh.getRange(r, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}
function remove(name, id) { const r = findRow(name, id); if (r > 0) sheet(name).deleteRow(r); }
function photoFolder() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
