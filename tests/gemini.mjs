// Essai : Gemini regarde de vraies vidéos YouTube et juge si ce sont de bons tutos.
// Ne touche pas à l'appli. Résultats dans resultats/gemini.json. La clé vient du secret GitHub GEMINI_KEY.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'resultats';
fs.mkdirSync(OUT, { recursive: true });
const KEY = (process.env.GEMINI_KEY || '').trim();
const redact = s => { s = String(s).replace(/key=[A-Za-z0-9_.\-]+/g, 'key=***'); return KEY ? s.split(KEY).join('***') : s; };
const rapport = { date: new Date().toISOString(), modeles: [], modele: null, videos: [], erreurs: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'gemini.json'), redact(JSON.stringify(rapport, null, 1)));
const BASE = 'https://generativelanguage.googleapis.com/v1beta/';

const RECHERCHE = 'changer une chambre à air de vélo';
const VIDEOS = [
  ['VD7iPD5uWro', 'TUTO VTT: changement de chambre à air ! PTI Truc de NANAS (34 s)'],
  ['tTK381ZJe0c', '[TUTO Débutant] Changer une chambre à air (Les Pédaleuses)'],
  ['uQW_O1NgrU0', 'Decathlon VTT 409 000 vues'],
  ['ABgEB4kbQxw', 'La Cordée, 9 ans'],
  ['Usy3l6-SNu0', 'En 60 s chrono (53 s)'],
  ['vraX6zQwuIs', 'Knot trick (11 s)']
];

const CONSIGNE = `Tu aides quelqu'un qui cherche un tutoriel pour : « ${RECHERCHE} ».
Regarde la vidéo (image ET son) et juge-la honnêtement, comme un mécanicien vélo exigeant.
Réponds UNIQUEMENT en JSON, en français, avec exactement ces champs :
{
 "sujet_ok": true/false,            // la vidéo traite-t-elle vraiment de la recherche ?
 "explique_oralement": true/false,  // quelqu'un explique-t-il à voix haute (pas seulement de la musique) ?
 "texte_a_l_ecran": true/false,     // des explications écrites à l'écran ?
 "etapes_montrees": ["..."],        // les étapes réellement montrées, dans l'ordre, très court
 "etapes_manquantes": ["..."],      // étapes importantes absentes (ex. vérifier le pneu, gonflage)
 "materiel_date": "recent" | "ancien" | "inconnu",
 "erreurs_ou_dangers": ["..."],     // gestes faux ou dangereux vus dans la vidéo, sinon []
 "note": 1 à 5,                     // 5 = excellent tuto qu'un débutant peut suivre seul
 "verdict": "une phrase simple pour l'utilisateur"
}`;

async function call(model, body){
  const r = await fetch(BASE + 'models/' + model + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify(body), signal: AbortSignal.timeout(240000)
  });
  const j = await r.json().catch(() => null);
  if(!r.ok) throw new Error((j && j.error && (j.error.status + ' : ' + j.error.message)) || ('erreur ' + r.status));
  return j;
}

async function main(){
  if(!KEY) throw new Error('pas de clé GEMINI_KEY');
  // Quels modèles la clé peut-elle utiliser ?
  const lm = await fetch(BASE + 'models?pageSize=200', { headers: { 'x-goog-api-key': KEY } }).then(r => r.json());
  if(lm.error) throw new Error('liste des modèles : ' + lm.error.message);
  rapport.modeles = (lm.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
  const prefs = [/^gemini-3\.\d-flash$/, /^gemini-\d(\.\d)?-flash$/, /flash(?!.*(lite|image|tts|audio|live))/, /flash/];
  const cands = [];
  prefs.forEach(re => rapport.modeles.filter(n => re.test(n)).sort().reverse().forEach(n => { if(!cands.includes(n)) cands.push(n); }));
  if(!cands.length) throw new Error('aucun modèle « flash » disponible');

  for(const [id, label] of VIDEOS){
    const v = { id, label, url: 'https://www.youtube.com/watch?v=' + id };
    const body = mode => ({
      contents: [{ parts: [{ file_data: { file_uri: v.url } }, { text: CONSIGNE }] }],
      generationConfig: Object.assign({ responseMimeType: 'application/json', temperature: 0.2 }, mode === 'low' ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {})
    });
    const t0 = Date.now();
    let done = false;
    for(const model of (rapport.modele ? [rapport.modele] : cands.slice(0, 4))){
      for(const mode of ['low', 'normal']){
        try {
          const j = await call(model, body(mode));
          const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
          try { v.avis = JSON.parse(txt.replace(/^```json|```$/g, '').trim()); } catch(e){ v.brut = txt.slice(0, 1500); }
          v.jetons = j.usageMetadata || null;
          v.modele = model; v.mode = mode;
          rapport.modele = model;
          done = true; break;
        } catch(e){ (v.essais = v.essais || []).push(model + '/' + mode + ' → ' + redact(e.message).slice(0, 220)); }
      }
      if(done) break;
    }
    v.secondes = Math.round((Date.now() - t0) / 100) / 10;
    rapport.videos.push(v);
    console.log(redact(id + ' ' + (done ? 'ok ' + v.modele + ' ' + v.secondes + ' s' : 'ÉCHEC ' + (v.essais || []).slice(-1)[0])));
    save();
  }
}

try { await main(); } catch(e){ rapport.erreurs.push(redact(e.message).slice(0, 400)); console.log(redact('ERREUR ' + e.message)); }
save();
process.exit(0);
