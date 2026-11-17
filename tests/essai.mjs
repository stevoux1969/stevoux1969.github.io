// Robot testeur : ouvre l'appli comme un téléphone, lance des recherches, note ce qu'il voit.
// La clé YouTube (si elle existe) vient du coffre-fort GitHub et n'est jamais écrite dans les résultats.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'resultats';
fs.mkdirSync(OUT, { recursive: true });
const KEY = (process.env.YT_KEY || '').trim();
const redact = s => { s = String(s).replace(/key=[A-Za-z0-9_\-]+/g, 'key=***'); return KEY ? s.split(KEY).join('***') : s; };
const log = (...a) => console.log(redact(a.join(' ')));
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name), redact(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)));
const conf = JSON.parse(fs.readFileSync('tests/essais.json', 'utf8'));
const rapport = { date: new Date().toISOString(), cleYouTube: KEY ? 'présente' : 'absente', recherches: [], banc: null, apis: {}, liens: [], erreurs: [] };

// Petit serveur local pour servir la page telle qu'elle est dans le dépôt
const root = process.cwd();
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(8080);
const BASE = 'http://localhost:8080/';

async function shots(page, prefix){
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const TILE = 1300, n = Math.min(3, Math.ceil(h / TILE));
  for(let i = 0; i < n; i++){
    await page.screenshot({ path: path.join(OUT, prefix + '-' + (i + 1) + '.jpg'), type: 'jpeg', quality: 60, fullPage: true,
      clip: { x: 0, y: i * TILE, width: 412, height: Math.min(TILE, h - i * TILE) } });
  }
  return n;
}

async function main(){
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1.5, locale: 'fr-FR', isMobile: true, hasTouch: true });

  // 1. Les recherches dans l'appli
  let i = 0;
  for(const t of conf.recherches || []){
    i++;
    const page = await ctx.newPage();
    const consoleErr = [];
    page.on('console', m => { if(m.type() === 'error') consoleErr.push(redact(m.text()).slice(0, 300)); });
    page.on('pageerror', e => consoleErr.push('ERREUR PAGE : ' + redact(e.message).slice(0, 300)));
    const r = { q: t.q, erreursConsole: consoleErr };
    try {
      await page.goto(BASE + 'tuto-fiable.html', { waitUntil: 'load' });
      if(KEY){ await page.evaluate(k => localStorage.setItem('ytKey', JSON.stringify(k)), KEY); await page.reload({ waitUntil: 'load' }); }
      await page.evaluate(yt => {
        document.getElementById('settings').hidden = true;
        document.getElementById('sYT').checked = yt;
        document.getElementById('sPT').checked = true;
        document.getElementById('sTX').checked = true;
      }, !!KEY && t.youtube !== false);
      await page.fill('#q', t.q);
      const t0 = Date.now();
      await page.click('#f button[type=submit]');
      await page.waitForFunction(() => /affichée\(s\)|Coche au moins/.test(document.getElementById('status').innerHTML), null, { timeout: 70000 })
        .catch(() => { r.delaiDepasse = true; });
      r.secondes = Math.round((Date.now() - t0) / 100) / 10;
      Object.assign(r, await page.evaluate(() => ({
        version: APP_VERSION,
        quota: (typeof quotaGet === 'function') ? quotaGet() : null, infoYT: (typeof ytInfo !== 'undefined') ? ytInfo : null, langue: document.getElementById('langMode').value,
        statut: document.getElementById('status').innerText,
        anglais: lastEn, suggestion: lastSuggest, voisins: lastNeighbors,
        suspects: lastCtx ? [...lastCtx.suspect] : [],
        bandeaux: [...document.querySelectorAll('#results .tip')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 260)),
        resultats: lastResults.map(it => ({
          affiche: shown.includes(it), rang: shown.indexOf(it) + 1,
          source: it.label || it.platform, image: it.thumb || '', titre: it.title, url: it.url, score: it.score, brut: it.raw, confirme: it.confirmed,
          horsSujet: it.offTopic, langue: it.lang, duree: it.duration, chaine: it.channel,
          resume: it.summary, pourquoi: it.why.map(w => (w[0] === 'i' ? '' : w[0] + ' ') + w[1]),
          astuces: (it.tips || []).map(x => String(x.text).slice(0, 160)), passages: (it.moments || []).map(m => m.t + ' ' + String(m.label).slice(0, 50)),
          avis: it.com ? { lus: it.com.total, utiles: it.com.useful, cases: it.com.counts, bloquent: it.com.nBlocks, typeBlocage: it.com.blockKind, exBlocage: (it.com.blocks || []).slice(0, 2).map(b => String(b.text).slice(0, 120)), exemples: it.com.ev.slice(0, 4).map(e => e.cat + ' : ' + String(e.text).slice(0, 140)) } : null,
          etatCommentaires: it.comState || null
        })).sort((a, b) => (a.rang || 999) - (b.rang || 999)),
        liens: [...document.querySelectorAll('a.exit')].map(a => [a.innerText, a.href])
      })));
      // Laisse le temps aux images de se charger, puis compte celles qui sont cassées
      await page.evaluate(() => document.querySelectorAll('.thumb img').forEach(i => i.loading = 'eager'));
      await page.waitForTimeout(2500);
      r.images = await page.evaluate(() => { const im = [...document.querySelectorAll('.thumb img')]; return { total: im.length, chargees: im.filter(i => i.complete && i.naturalWidth > 0).length, cassees: im.filter(i => !(i.complete && i.naturalWidth > 0)).slice(0, 4).map(i => i.getAttribute('src')) }; });
      r.captures = await shots(page, 'recherche' + i);
      if(i === 1) rapport.liensAVerifier = r.liens;
      delete r.liens;
    } catch(e){ r.erreur = redact(e.message).slice(0, 400); }
    rapport.recherches.push(r);
    log('recherche', i, JSON.stringify(t.q), '->', r.erreur || r.statut && r.statut.replace(/\n/g, ' | '));
    await page.close();
  }

  // 2. Le banc d'essai des sources, vu depuis un navigateur
  try {
    const page = await ctx.newPage();
    await page.goto(BASE + 'tuto-test-sources.html', { waitUntil: 'load' });
    await page.click('#go');
    await page.waitForFunction(() => !document.getElementById('sum').hidden, null, { timeout: 40000 }).catch(() => {});
    rapport.banc = await page.evaluate(() => ({ bilan: document.getElementById('sum').innerText, lignes: [...document.querySelectorAll('#out .row')].map(e => e.innerText.replace(/\s+/g, ' ')) }));
    await shots(page, 'banc');
    await page.close();
  } catch(e){ rapport.erreurs.push('banc : ' + redact(e.message).slice(0, 300)); }
  await browser.close();

  // 3. Réponses brutes des sites (pour vérifier le nom des champs)
  const apis = {
    ifixit: 'https://www.ifixit.com/api/2.0/search/' + encodeURIComponent('bicycle puncture repair') + '?filter=guide&limit=3',
    stackexchange: 'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=' + encodeURIComponent('bicycle puncture repair') + '&site=bicycles&pagesize=2',
    peertube: 'https://sepiasearch.org/api/v1/search/videos?search=' + encodeURIComponent('réparation vélo') + '&start=0&count=2&sort=-match',
    traduction: 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent('changer plaquettes de frein vélo') + '&langpair=fr|en',
    bluesky: 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=' + encodeURIComponent('réparation vélo') + '&limit=2',
    dailymotion: 'https://api.dailymotion.com/videos?search=' + encodeURIComponent('réparation crevaison vélo') + '&fields=id,title,url,duration,created_time,views_total,language&limit=3'
  };
  for(const [name, url] of Object.entries(apis)){
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const txt = await res.text();
      let j = null; try { j = JSON.parse(txt); } catch(e){}
      const list = j && (j.results || j.items || j.data || j.posts || j.list);
      rapport.apis[name] = { code: res.status, cles: j ? Object.keys(j) : null, nombre: Array.isArray(list) ? list.length : null,
        premier: Array.isArray(list) && list[0] ? JSON.parse(JSON.stringify(list[0], (k, v) => typeof v === 'string' && v.length > 220 ? v.slice(0, 220) + '…' : v)) : (j && !list ? JSON.stringify(j).slice(0, 400) : txt.slice(0, 200)) };
    } catch(e){ rapport.apis[name] = { erreur: String(e.message).slice(0, 200) }; }
  }

  // 4. Les boutons « Chercher ailleurs » : est-ce que l'adresse répond ?
  for(const [nom, url] of rapport.liensAVerifier || []){
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
      rapport.liens.push({ nom, code: res.status, arrivee: res.url.slice(0, 120) });
    } catch(e){ rapport.liens.push({ nom, erreur: String(e.message).slice(0, 120) }); }
  }
  delete rapport.liensAVerifier;
}

try { await main(); } catch(e){ rapport.erreurs.push('général : ' + redact(e.stack || e.message).slice(0, 600)); log('ERREUR', e.message); }
save('rapport.json', rapport);
server.close();
log('terminé :', rapport.recherches.length, 'recherche(s),', rapport.erreurs.length, 'erreur(s)');
process.exit(0);
