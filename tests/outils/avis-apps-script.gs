// Tuto Fiable : reçoit tes avis 👍 😐 👎 et les range dans l'onglet « Avis » de ce Google Sheet.
// À coller dans Extensions → Apps Script, puis Déployer → Nouveau déploiement → Application Web
// (Exécuter en tant que : moi ; Qui a accès : tout le monde). L'adresse obtenue (…/exec) va dans ⚙️ de l'appli.
// Garde cette adresse pour toi : qui la connaît peut lire et ajouter des avis.
const FEUILLE = 'Avis';
const COLS = ['id', 'date', 'version', 'recherche', 'precision', 'anglais', 'plateforme', 'titre', 'chaine', 'url', 'rang', 'score',
  'couleur', 'confirme', 'bien_construit', 'gemini', 'avis', 'raisons', 'commentaire'];

function feuille_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(FEUILLE);
  if (!sh) {
    sh = ss.insertSheet(FEUILLE);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Un texte qui commence par = + - @ serait pris pour une formule : on le neutralise
function propre_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = feuille_();
    const ligne = COLS.map(c => propre_(d[c]));
    const n = sh.getLastRow();
    const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = ids.indexOf(String(d.id));
    if (i >= 0) sh.getRange(i + 2, 1, 1, COLS.length).setValues([ligne]);   // même vidéo, même jour : on met à jour
    else sh.appendRow(ligne);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// Pour que le robot de Claude puisse lire les avis
function doGet() {
  const v = feuille_().getDataRange().getValues();
  const tete = v.shift() || [];
  const sortie = v.map(r => Object.fromEntries(tete.map((h, i) => [h, r[i]])));
  return ContentService.createTextOutput(JSON.stringify(sortie)).setMimeType(ContentService.MimeType.JSON);
}
