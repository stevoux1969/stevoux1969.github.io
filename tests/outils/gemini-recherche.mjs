// Essai : Gemini peut-il faire une recherche Google (onglet Vidéos et tutos) avec la clé gratuite ?
// Pour le lancer : copier ce fichier en tests/gemini-recherche.mjs. Résultat dans resultats/gemini-recherche.json.
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'resultats';
fs.mkdirSync(OUT, { recursive: true });
const KEY = (process.env.GEMINI_KEY || '').trim();
const red = s => KEY ? String(s).split(KEY).join('***') : String(s);
const rapport = { date: new Date().toISOString(), essais: [] };
const BASE = 'https://generativelanguage.googleapis.com/v1beta/';
const Q = process.env.RECHERCHE || 'changer une chambre à air de vélo';
const PROMPT = 'Cherche sur Google les meilleures vidéos tutoriels pour : « ' + Q + ' » (YouTube et autres sites). ' +
  'Donne une liste de 10 vidéos maximum, avec pour chacune : titre, site, adresse exacte (URL). Réponds en JSON : [{"titre":"","site":"","url":""}]';

const lm = await fetch(BASE + 'models?pageSize=200', { headers: { 'x-goog-api-key': KEY } }).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
const names = (lm.models || []).map(m => m.name.replace('models/', '')).filter(n => /flash/.test(n) && !/image|tts|audio|live/.test(n)).sort().reverse();
rapport.modeles = names;
for(const model of names.slice(0, 3)){
  const e = { model };
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + 'models/' + model + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }] }], tools: [{ google_search: {} }] }),
      signal: AbortSignal.timeout(120000)
    });
    const j = await r.json().catch(() => ({}));
    e.code = r.status;
    if(!r.ok) e.erreur = red((j.error && j.error.message) || '').slice(0, 300);
    else {
      const c = (j.candidates || [])[0] || {};
      e.texte = (c.content && c.content.parts || []).map(p => p.text || '').join('').slice(0, 3000);
      const gm = c.groundingMetadata || {};
      e.requetes = gm.webSearchQueries || [];
      e.sources = (gm.groundingChunks || []).map(g => g.web ? { titre: g.web.title, uri: g.web.uri } : g).slice(0, 20);
      e.jetons = j.usageMetadata || null;
    }
  } catch(err){ e.erreur = red(err.message).slice(0, 200); }
  e.secondes = Math.round((Date.now() - t0) / 1000);
  rapport.essais.push(e);
  console.log(model, e.code, e.erreur || ('ok, ' + (e.sources || []).length + ' sources'));
  if(e.code === 200) break;
}
fs.writeFileSync(path.join(OUT, 'gemini-recherche.json'), red(JSON.stringify(rapport, null, 1)));
