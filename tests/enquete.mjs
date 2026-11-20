// Robot en mode « enquête » : collecte les données pour une enquête de Claude, sans captures ni contrôles de l'appli.
// 1) fait chaque recherche dans l'appli (ordre, filtrage, analyse des commentaires) ;
// 2) pour les vidéos retenues, va chercher plus de détails chez YouTube : description entière, chapitres,
//    infos sur la chaîne, et les commentaires les plus pertinents avec les réponses ;
// 3) lit le texte de quelques pages web demandées.
// Coût YouTube : les recherches de l'appli (2 à 3 par recherche) ; le reste se paie en points (1 par appel), pas en recherches.
// Lancement : fichier tests/enquete.json, par exemple
// { "recherches": ["FC 26 tactique saisons"], "videosParRecherche": 15, "commentaires": 40, "pages": ["https://…"] }
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'resultats';
fs.mkdirSync(OUT, { recursive: true });
const KEY = (process.env.YT_KEY || '').trim();
const redact = s => { s = String(s).replace(/key=[A-Za-z0-9_.\-]+/g, 'key=***'); if(KEY) s = s.split(KEY).join('***'); return s; };
const conf = JSON.parse(fs.readFileSync('tests/enquete.json', 'utf8'));
const N_VID = conf.videosParRecherche || 15, N_COM = Math.min(conf.commentaires || 40, 100);
const out = { date: new Date().toISOString(), recherches: [], videos: {}, chaines: {}, pages: [], erreurs: [] };
const YT = 'https://www.googleapis.com/youtube/v3/';

const root = process.cwd();
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(8080);

const yt = async (ep, params) => {
  const res = await fetch(YT + ep + '?' + new URLSearchParams(Object.assign({ key: KEY }, params)), { signal: AbortSignal.timeout(20000) });
  const j = await res.json();
  if(!res.ok) throw new Error(ep + ' : ' + ((j.error && j.error.message) || res.status));
  return j;
};
const idOf = url => ((/[?&]v=([\w-]{11})/.exec(url) || /youtu\.be\/([\w-]{11})/.exec(url) || [])[1]);
const chapitres = desc => String(desc || '').split('\n').filter(l => /^\s*\(?\d{1,2}:\d{2}(:\d{2})?\)?\s/.test(l)).map(l => l.trim().slice(0, 100)).slice(0, 25);

async function main(){
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'fr-FR', isMobile: true });
  // 1. Les recherches dans l'appli
  for(const q of conf.recherches || []){
    const r = { q };
    const page = await ctx.newPage();
    try {
      await page.goto('http://localhost:8080/tuto-fiable.html', { waitUntil: 'load' });
      await page.evaluate(k => localStorage.setItem('ytKey', JSON.stringify(k)), KEY);
      await page.reload({ waitUntil: 'load' });
      await page.evaluate(() => { document.getElementById('settings').hidden = true; document.getElementById('sYT').checked = true; document.getElementById('sPT').checked = true; document.getElementById('sTX').checked = true; });
      await page.fill('#q', q);
      const t0 = Date.now();
      await page.click('#f button[type=submit]');
      await page.waitForFunction(() => /affichée\(s\)|Coche au moins/.test(document.getElementById('status').innerHTML), null, { timeout: 150000 }).catch(() => { r.delaiDepasse = true; });
      r.secondes = Math.round((Date.now() - t0) / 1000);
      Object.assign(r, await page.evaluate(() => ({
        version: APP_VERSION, statut: document.getElementById('status').innerText.replace(/\s+/g, ' ').slice(0, 300),
        resultats: lastResults.filter(it => shown.includes(it)).map(it => ({
          rang: shown.indexOf(it) + 1, source: it.label || it.platform, titre: it.title, url: it.url, chaine: it.channel,
          score: it.score, confirme: it.confirmed, langue: it.lang, duree: it.duration, publie: it.published, vues: it.views,
          ordreYouTube: it.ytPos || null, pourquoi: it.why.map(w => (w[0] === 'i' ? '' : w[0] + ' ') + w[1]),
          avis: it.com ? { lus: it.com.total, utiles: it.com.useful, cases: it.com.counts } : null
        })).sort((a, b) => a.rang - b.rang),
        masques: lastResults.filter(it => !shown.includes(it)).length
      })));
    } catch(e){ r.erreur = redact(e.message).slice(0, 300); }
    await page.close();
    out.recherches.push(r);
    console.log(redact('recherche ' + JSON.stringify(q) + ' -> ' + (r.erreur || r.statut)));
  }
  await browser.close();

  // 2. Détails YouTube pour les vidéos retenues (les N premières de chaque recherche, sans doublon)
  const ids = [...new Set([].concat(...out.recherches.map(r => (r.resultats || []).filter(x => idOf(x.url)).slice(0, N_VID).map(x => idOf(x.url)))))];
  for(let k = 0; k < ids.length; k += 50){
    try {
      const j = await yt('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(k, k + 50).join(',') });
      for(const v of j.items || []){
        const s = v.snippet, st = v.statistics || {};
        out.videos[v.id] = { titre: s.title, url: 'https://www.youtube.com/watch?v=' + v.id, chaine: s.channelTitle, chaineId: s.channelId,
          publie: s.publishedAt, duree: (v.contentDetails || {}).duration, vues: +st.viewCount || 0, likes: +st.likeCount || 0, nbCommentaires: +st.commentCount || 0,
          description: String(s.description || '').slice(0, 3000), chapitres: chapitres(s.description), tags: (s.tags || []).slice(0, 15) };
      }
    } catch(e){ out.erreurs.push(redact(e.message).slice(0, 200)); }
  }
  // Chaînes : abonnés, ancienneté, nombre de vidéos, présentation
  const chaines = [...new Set(Object.values(out.videos).map(v => v.chaineId))];
  for(let k = 0; k < chaines.length; k += 50){
    try {
      const j = await yt('channels', { part: 'snippet,statistics', id: chaines.slice(k, k + 50).join(',') });
      for(const c of j.items || []) out.chaines[c.id] = { nom: c.snippet.title, creee: c.snippet.publishedAt, pays: c.snippet.country || '',
        abonnes: +(c.statistics || {}).subscriberCount || 0, videos: +(c.statistics || {}).videoCount || 0, presentation: String(c.snippet.description || '').slice(0, 400) };
    } catch(e){ out.erreurs.push(redact(e.message).slice(0, 200)); }
  }
  // Commentaires les plus pertinents, avec les réponses (celles du youtubeur sont marquées)
  for(const id of Object.keys(out.videos)){
    const v = out.videos[id];
    try {
      const j = await yt('commentThreads', { part: 'snippet,replies', videoId: id, maxResults: String(N_COM), order: 'relevance', textFormat: 'plainText' });
      v.commentaires = (j.items || []).map(x => {
        const sn = x.snippet.topLevelComment.snippet;
        return { texte: String(sn.textDisplay).slice(0, 400), likes: sn.likeCount || 0, date: String(sn.publishedAt).slice(0, 10),
          reponses: ((x.replies && x.replies.comments) || []).slice(0, 4).map(rp => ((rp.snippet.authorChannelId || {}).value === v.chaineId ? '[youtubeur] ' : '') + String(rp.snippet.textDisplay).slice(0, 250)) };
      });
    } catch(e){ v.commentaires = []; v.etatCommentaires = /disabled/i.test(e.message) ? 'fermés' : redact(e.message).slice(0, 120); }
  }

  // 3. Pages web demandées : texte brut
  for(const u of conf.pages || []){
    try {
      const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' } });
      const html = await res.text();
      const texte = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
      out.pages.push({ url: u, code: res.status, arrivee: res.url, texte: texte.slice(0, 20000) });
    } catch(e){ out.pages.push({ url: u, erreur: String(e.message).slice(0, 150) }); }
  }
}

if(!KEY) out.erreurs.push('clé YouTube absente');
else { try { await main(); } catch(e){ out.erreurs.push('général : ' + redact(e.stack || e.message).slice(0, 500)); } }
fs.writeFileSync(path.join(OUT, 'enquete.json'), redact(JSON.stringify(out, null, 1)));
server.close();
console.log('terminé :', out.recherches.length, 'recherche(s),', Object.keys(out.videos).length, 'vidéo(s),', out.pages.length, 'page(s),', out.erreurs.length, 'erreur(s)');
process.exit(0);
