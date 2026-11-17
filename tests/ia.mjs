// Mesure : une petite IA (dans le navigateur) comprend-elle plus de commentaires que les règles de l'appli ?
// Ne touche pas à l'appli. Lit les commentaires de quelques vidéos réelles (1 point de quota par vidéo,
// aucune recherche YouTube), les fait juger par les règles et par deux IA, et range tout dans resultats/ia.json.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OUT = 'resultats';
fs.mkdirSync(OUT, { recursive: true });
const KEY = (process.env.YT_KEY || '').trim();
const redact = s => { s = String(s).replace(/key=[A-Za-z0-9_\-]+/g, 'key=***'); return KEY ? s.split(KEY).join('***') : s; };
const log = (...a) => console.log(redact(a.join(' ')));
const rapport = { date: new Date().toISOString(), videos: [], modeles: {}, commentaires: [], erreurs: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'ia.json'), redact(JSON.stringify(rapport, null, 1)));

// Vidéos réelles déjà vues par le robot (robinet, XMP), en français, anglais et portugais
const VIDEOS = ['-rYGMjfonmg', 'IXEtf2Y9hJA', 'sAHicMlfJMU', 'Cavj8G8ISiA', 'su5iWucMdOY', 'jpzG96XgXrE', '7HA91qt0yPQ', 'YaSlMYoOJ-o',
  'W6AHNbcSKVg', 'L8Agbvo1gmY', '4ligJ7zCwKw', 'TT9fFDjzTrw', 'h-MLhGMtheM', 'tucej_7APqw', '9xjnP1POeuE', '_LTRX0l6T_I'];

// 1. Les règles de l'appli, chargées depuis la page elle-même
function loadRules(){
  const html = fs.readFileSync('tuto-fiable.html', 'utf8');
  const code = /<script>([\s\S]*)<\/script>/.exec(html)[1];
  const mk = () => ({ value:'', hidden:false, innerHTML:'', textContent:'', checked:false, dataset:{}, style:{}, classList:{ add(){}, remove(){}, toggle(){} }, addEventListener(){}, querySelectorAll:() => [] });
  const els = {};
  globalThis.document = { getElementById: id => els[id] || (els[id] = mk()), addEventListener(){}, hidden:false, querySelectorAll: () => [] };
  const LS = {};
  globalThis.localStorage = { getItem: k => k in LS ? LS[k] : null, setItem: (k, v) => { LS[k] = v; } };
  globalThis.location = { protocol:'file:', pathname:'/x' };
  (0, eval)(code + '\nglobalThis.__R = { norm, classify, SPAM, TIP, CATS };');
  return globalThis.__R;
}

async function getJSON(url){
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => null);
  if(!r.ok) throw new Error((j && j.error && j.error.message) || ('erreur ' + r.status));
  return j;
}

async function main(){
  if(!KEY) throw new Error('pas de clé YouTube');
  const R = loadRules();

  // 2. Les commentaires réels
  const vr = await getJSON('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({ part:'snippet', id: VIDEOS.join(','), key: KEY }));
  const chan = {};
  (vr.items || []).forEach(v => { chan[v.id] = v.snippet.channelId; rapport.videos.push({ id: v.id, titre: v.snippet.title }); });
  const seen = new Set();
  for(const id of VIDEOS){
    try {
      const c = await getJSON('https://www.googleapis.com/youtube/v3/commentThreads?' + new URLSearchParams({ part:'snippet', videoId:id, maxResults:'100', order:'relevance', textFormat:'plainText', key: KEY }));
      for(const x of c.items || []){
        const sn = x.snippet.topLevelComment.snippet;
        if(sn.authorChannelId && sn.authorChannelId.value === chan[id]) continue;          // le youtubeur lui-même
        const n = R.norm(sn.textDisplay).replace(/\s+/g, ' ').trim();
        if(!n || seen.has(n)) continue;
        seen.add(n);
        const spam = R.SPAM.test(n);
        let regle = spam ? 'spam' : R.classify(n);
        if(regle && R.CATS[regle] && R.CATS[regle].neg && regle !== 'danger' && R.TIP.test(n) && n.split(' ').length >= 8 && !/\?\s*$/.test(n)) regle = 'astuce';
        rapport.commentaires.push({ v: id, texte: sn.textDisplay.slice(0, 400), likes: sn.likeCount || 0, regle: regle || null });
      }
    } catch(e){ rapport.erreurs.push(id + ' : ' + redact(e.message).slice(0, 150)); }
  }
  log('commentaires lus :', rapport.commentaires.length, '| compris par les règles :', rapport.commentaires.filter(c => c.regle && c.regle !== 'spam').length);
  save();

  const { pipeline, env } = await import('@huggingface/transformers');
  const cacheDir = env.cacheDir;
  const sizeOf = () => { try { return execSync('du -sm "' + cacheDir + '" | cut -f1').toString().trim() + ' Mo'; } catch(e){ return '?'; } };

  // 3. IA n° 1 : humeur du commentaire, de 1 à 5 étoiles (multilingue)
  try {
    let t0 = Date.now();
    const senti = await pipeline('sentiment-analysis', 'Xenova/bert-base-multilingual-uncased-sentiment', { dtype: 'q8' });
    const load = Date.now() - t0;
    rapport.modeles.etoiles = { nom: 'bert-base-multilingual-uncased-sentiment (q8)', chargement_s: load / 1000, cache: sizeOf() };
    t0 = Date.now();
    for(const c of rapport.commentaires){
      if(c.regle === 'spam') continue;
      const [r] = await senti(c.texte.slice(0, 500));
      c.etoiles = parseInt(r.label, 10);
      c.etoilesSur = Math.round(r.score * 100) / 100;
    }
    const n = rapport.commentaires.filter(c => c.etoiles).length;
    rapport.modeles.etoiles.ms_par_commentaire = Math.round((Date.now() - t0) / Math.max(1, n));
    log('IA étoiles :', n, 'commentaires,', rapport.modeles.etoiles.ms_par_commentaire, 'ms chacun, cache', sizeOf());
  } catch(e){ rapport.erreurs.push('IA étoiles : ' + String(e.message).slice(0, 300)); log('ERREUR IA étoiles', e.message); }
  save();

  // 4. IA n° 2 : « de quoi parle ce commentaire ? » (classement libre, multilingue), sur un échantillon
  try {
    let t0 = Date.now();
    const zs = await pipeline('zero-shot-classification', 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7', { dtype: 'q8' });
    const load = Date.now() - t0;
    rapport.modeles.sujet = { nom: 'mDeBERTa-v3-base-xnli-multilingual-nli (q8)', chargement_s: load / 1000, cache: sizeOf() };
    const LABELS = {
      'it worked for the commenter': 'succes',
      'it did not work for the commenter': 'echec',
      'the commenter asks a question': 'question',
      'the commenter thanks or compliments the video': 'merci',
      'the commenter talks about something else': 'autre'
    };
    const sample = rapport.commentaires.filter(c => c.regle !== 'spam' && !c.regle).slice(0, 260)
      .concat(rapport.commentaires.filter(c => c.regle && c.regle !== 'spam').slice(0, 90));
    t0 = Date.now();
    for(const c of sample){
      const r = await zs(c.texte.slice(0, 400), Object.keys(LABELS), { hypothesis_template: 'In this comment, {}.' });
      c.sujet = LABELS[r.labels[0]];
      c.sujetSur = Math.round(r.scores[0] * 100) / 100;
    }
    rapport.modeles.sujet.ms_par_commentaire = Math.round((Date.now() - t0) / Math.max(1, sample.length));
    rapport.modeles.sujet.echantillon = sample.length;
    log('IA sujet :', sample.length, 'commentaires,', rapport.modeles.sujet.ms_par_commentaire, 'ms chacun, cache', sizeOf());
  } catch(e){ rapport.erreurs.push('IA sujet : ' + String(e.message).slice(0, 300)); log('ERREUR IA sujet', e.message); }
  save();
}

try { await main(); } catch(e){ rapport.erreurs.push('général : ' + redact(e.stack || e.message).slice(0, 600)); log('ERREUR', e.message); }
save();
log('mesure IA terminée,', rapport.erreurs.length, 'erreur(s)');
process.exit(0);
