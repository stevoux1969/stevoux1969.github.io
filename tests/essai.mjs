// Robot testeur : ouvre l'appli comme un téléphone, lance des recherches, note ce qu'il voit.
// La clé YouTube (si elle existe) vient du coffre-fort GitHub et n'est jamais écrite dans les résultats.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'resultats';
fs.mkdirSync(OUT, { recursive: true });
const KEY = (process.env.YT_KEY || '').trim();
const GKEY = (process.env.GEMINI_KEY || '').trim();
const redact = s => { s = String(s).replace(/key=[A-Za-z0-9_.\-]+/g, 'key=***'); if(KEY) s = s.split(KEY).join('***'); if(GKEY) s = s.split(GKEY).join('***'); return s; };
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
    const ratees = [];
    page.on('response', resp => { if(resp.status() >= 400 && ratees.length < 15) ratees.push(resp.status() + ' ' + redact(resp.url()).slice(0, 140)); });
    const r = { q: t.q, erreursConsole: consoleErr, ressourcesRatees: ratees };
    try {
      await page.goto(BASE + 'tuto-fiable.html', { waitUntil: 'load' });
      if(KEY || GKEY){ await page.evaluate(([k, g]) => { if(k) localStorage.setItem('ytKey', JSON.stringify(k)); if(g) localStorage.setItem('gemKey', JSON.stringify(g)); }, [KEY, GKEY]); await page.reload({ waitUntil: 'load' }); }
      await page.evaluate(yt => {
        document.getElementById('settings').hidden = true;
        document.getElementById('sYT').checked = yt;
        document.getElementById('sPT').checked = true;
        document.getElementById('sTX').checked = true;
      }, !!KEY && t.youtube !== false);
      await page.fill('#q', t.q);
      if(t.precise) await page.fill('#precise', t.precise);
      const avisRecus = [];
      if(t.avis){
        await page.evaluate(() => { avisUrl = 'https://script.google.com/macros/s/TEST-ROBOT/exec'; });
        await page.route('https://script.google.com/**', async route => { avisRecus.push(route.request().postData()); await route.fulfill({ status: 200, body: 'ok' }); });
      }
      const t0 = Date.now();
      await page.click('#f button[type=submit]');
      await page.waitForFunction(() => /affichée\(s\)|Coche au moins/.test(document.getElementById('status').innerHTML), null, { timeout: 150000 })
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
          horsSujet: it.offTopic, precision: it.fit || null, bienConstruit: it.built || null, via420: it.via === '420', vues: it.views, publie: it.published, langue: it.lang, duree: it.duration, chaine: it.channel,
          resume: it.summary, pourquoi: it.why.map(w => (w[0] === 'i' ? '' : w[0] + ' ') + w[1]),
          astuces: (it.tips || []).map(x => String(x.text).slice(0, 160)), passages: (it.moments || []).map(m => m.t + ' ' + String(m.label).slice(0, 50)),
          avis: it.com ? { lus: it.com.total, utiles: it.com.useful, cases: it.com.counts, bloquent: it.com.nBlocks, typeBlocage: it.com.blockKind, exBlocage: (it.com.blocks || []).slice(0, 2).map(b => String(b.text).slice(0, 120)), exemples: it.com.ev.slice(0, 4).map(e => e.cat + ' : ' + String(e.text).slice(0, 140)) } : null,
          etatCommentaires: it.comState || null
        })).sort((a, b) => (a.rang || 999) - (b.rang || 999)),
        liens: [...document.querySelectorAll('a.exit')].map(a => [a.innerText, a.href])
      })));
      // Laisse le temps aux images de se charger, puis compte celles qui sont cassées
      await page.evaluate(() => document.querySelectorAll('.media img, .thumb img').forEach(i => i.loading = 'eager'));
      await page.waitForTimeout(4000);
      r.images = await page.evaluate(() => { const im = [...document.querySelectorAll('.media img, .thumb img')]; return { total: im.length, chargees: im.filter(i => i.complete && i.naturalWidth > 0).length, cassees: im.filter(i => !(i.complete && i.naturalWidth > 0)).slice(0, 4).map(i => i.getAttribute('src')) }; });
      r.captures = await shots(page, 'recherche' + i);
      // La première fiche incertaine (orange, bleue ou grise), pour voir le bouton Gemini
      try {
        const h2 = await page.evaluateHandle(() => { const s = document.querySelector('article.card .stamp.s-mid, article.card .stamp.s-built, article.card .stamp.s-none'); return s ? s.closest('article') : null; });
        const el2 = h2.asElement();
        if(el2){ await el2.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await el2.screenshot({ path: path.join(OUT, 'incertain-' + i + '.jpg'), type: 'jpeg', quality: 70 }); }
      } catch(e){}
      // Une fiche d'une source écrite (Wikibooks en priorité), pour voir à quoi elle ressemble
      try {
        const h = await page.evaluateHandle(() => { const p = document.querySelector('article.card .p-Wikibooks') || document.querySelector('article.card .p-iFixit'); return p ? p.closest('article') : null; });
        const el = h.asElement();
        if(el){ await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await el.screenshot({ path: path.join(OUT, 'ecrit-' + i + '.jpg'), type: 'jpeg', quality: 70 }); }
      } catch(e){}
      // Avis : le robot appuie sur 👎, coche deux raisons, écrit un mot, et on regarde ce qui part vers le tableau
      if(t.avis){
        try {
          await page.click('article.card [data-act="ko"]');
          await page.click('article.card [data-act="reason"][data-r="mode"]');
          await page.click('article.card [data-act="reason"][data-r="promesse"]');
          await page.fill('article.card input[data-note]', 'test du robot');
          await page.click('article.card [data-act="note"]');
          await page.waitForTimeout(4500);
          r.avisEnvoyes = avisRecus.map(x => { try { return JSON.parse(x); } catch(e){ return x; } });
          const c = await page.$('article.card');
          await c.screenshot({ path: path.join(OUT, 'avis-' + i + '.jpg'), type: 'jpeg', quality: 70 });
        } catch(e){ r.avisErreur = redact(e.message).slice(0, 300); }
      }
      // Gemini : on fait regarder les vidéos demandées (ou la 1re), puis on photographie la fiche
      if(GKEY && t.gemini){
        r.gemini = [];
        const targets = Array.isArray(t.gemini) ? t.gemini : [null];
        for(const [gi, vid] of targets.entries()){
          if(gi > 0) await page.waitForTimeout((t.geminiPause || 90) * 1000);   // la formule gratuite limite le nombre de vidéos par minute
          const g = { video: vid };
          try {
            const done = r.gemini.map(x => x.video).filter(Boolean);
            const btn = vid ? await page.$('[data-card="' + vid + '"] .gembtn')
              : await page.evaluateHandle(d => [...document.querySelectorAll('article.card')].filter(c => !d.includes(c.dataset.card)).map(c => c.querySelector('.gembtn')).find(Boolean) || null, done).then(h => h.asElement());
            if(!btn){ g.erreur = 'bouton introuvable'; r.gemini.push(g); continue; }
            const card = await btn.evaluateHandle(b => b.closest('article'));
            const id = await card.evaluate(c => c.dataset.card);
            g.video = id;
            const t1 = Date.now();
            await btn.click();
            await page.waitForFunction(id => { const c = document.querySelector('[data-card="' + id + '"]'); return c && !c.querySelector('.gem.loading') && (c.querySelector('.gem') || c.querySelector('.gwarn')); }, id, { timeout: 330000, polling: 2000 });
            g.secondes = Math.round((Date.now() - t1) / 1000);
            const c2 = await page.$('[data-card="' + id + '"]');
            g.texte = (await c2.evaluate(c => (c.querySelector('.gem') || {}).innerText || '')).slice(0, 900);
            g.tampon = await c2.evaluate(c => (c.querySelector('.stamp') || {}).innerText || '');
            g.rang = await page.evaluate(id => [...document.querySelectorAll('article.card')].findIndex(c => c.dataset.card === id) + 1, id);
            await c2.scrollIntoViewIfNeeded();
            await c2.screenshot({ path: path.join(OUT, 'gemini-' + i + '-' + id + '.jpg'), type: 'jpeg', quality: 70 });
          } catch(e){ g.erreur = redact(e.message).slice(0, 300); }
          r.gemini.push(g);
        }
      }
      if(i === 1) rapport.liensAVerifier = r.liens;
      delete r.liens;
    } catch(e){ r.erreur = redact(e.message).slice(0, 400); }
    rapport.recherches.push(r);
    log('recherche', i, JSON.stringify(t.q), '->', r.erreur || r.statut && r.statut.replace(/\n/g, ' | '));
    await page.close();
  }

  // 1 bis. Une source répond-elle à une page web (téléphone) ? On essaie depuis le navigateur, sans vraie clé
  if(conf.cors && conf.cors.length){
    const page = await ctx.newPage();
    await page.goto(BASE + 'tuto-fiable.html', { waitUntil: 'load' });
    rapport.cors = await page.evaluate(async list => {
      const out = [];
      for(const c of list){
        try {
          const r = await fetch(c.url, { method: c.method || 'GET', headers: c.headers || {}, body: c.body ? JSON.stringify(c.body) : undefined });
          const t = await r.text();
          out.push({ nom: c.nom, code: r.status, lisible: true, debut: t.slice(0, 200) });
        } catch(e){ out.push({ nom: c.nom, lisible: false, erreur: String(e.message).slice(0, 150) }); }
      }
      return out;
    }, conf.cors);
    await page.close();
  }

  // 1 ter. YouTube : que rapporte une 2e formulation de la recherche ? (mesure faite par le robot, hors appli)
  if(KEY && conf.ytVariantes){
    try { save('variantes.json', await mesureVariantes(conf.ytVariantes)); }
    catch(e){ rapport.erreurs.push('variantes : ' + redact(e.message).slice(0, 300)); }
  }

  // 1 quater. Version réellement en ligne (GitHub Pages)
  try {
    const live = await (await fetch('https://stevoux1969.github.io/tuto-fiable.html?robot=' + Date.now(), { signal: AbortSignal.timeout(20000) })).text();
    rapport.versionEnLigne = (live.match(/APP_VERSION = '([0-9.]+)'/) || [])[1] || 'introuvable';
  } catch(e){ rapport.versionEnLigne = 'erreur : ' + String(e.message).slice(0, 100); }

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

// Pour chaque recherche : 50 vidéos par formulation, combien sont nouvelles par rapport à la recherche de base,
// et à quel point elles parlent du sujet (part des mots de la recherche présents dans le titre et la description).
async function mesureVariantes(v){
  const YTB = 'https://www.googleapis.com/youtube/v3/';
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set('a au aux de des du la le les un une et en pour sur avec sans comment tuto the of to for and in on with how'.split(' '));
  const out = [];
  for(const q of v.requetes){
    const mots = [...new Set(nrm(q).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)))];
    const r = { q, mots, variantes: {} }, ids = {};
    for(const va of v.variantes){
      if(va.seulement && !va.seulement.includes(q)) continue;
      const qq = (va.avant || '') + q + (va.apres || '');
      const p = new URLSearchParams(Object.assign({ part: 'snippet', type: 'video', maxResults: '50', q: qq, relevanceLanguage: 'fr', safeSearch: 'moderate', key: KEY }, va.params || {}));
      try {
        const res = await fetch(YTB + 'search?' + p, { signal: AbortSignal.timeout(20000) });
        const j = await res.json();
        if(!res.ok){ r.variantes[va.nom] = { requete: qq, erreur: String((j.error && j.error.message) || res.status) }; continue; }
        ids[va.nom] = (j.items || []).map(x => x.id && x.id.videoId).filter(Boolean);
        r.variantes[va.nom] = { requete: qq, params: va.params || null, nombre: ids[va.nom].length };
      } catch(e){ r.variantes[va.nom] = { requete: qq, erreur: String(e.message).slice(0, 150) }; }
    }
    const all = [...new Set([].concat(...Object.values(ids)))], info = {};
    for(let k = 0; k < all.length; k += 50){
      try {
        const res = await fetch(YTB + 'videos?' + new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: all.slice(k, k + 50).join(','), key: KEY }), { signal: AbortSignal.timeout(20000) });
        const j = await res.json();
        (j.items || []).forEach(x => { info[x.id] = { titre: x.snippet.title, chaine: x.snippet.channelTitle, vues: +((x.statistics || {}).viewCount || 0), duree: (x.contentDetails || {}).duration || '', desc: String(x.snippet.description || '').slice(0, 400) }; });
      } catch(e){}
    }
    const base = new Set(ids.base || []);
    const sujet = id => { const t = nrm(((info[id] || {}).titre || '') + ' ' + ((info[id] || {}).desc || '')); return mots.length ? mots.filter(m => t.includes(m)).length / mots.length : 0; };
    const moy = list => list.length ? Math.round(100 * list.reduce((a, id) => a + sujet(id), 0) / list.length) : null;
    for(const [nom, list] of Object.entries(ids)){
      const nouv = nom === 'base' ? [] : list.filter(id => !base.has(id));
      Object.assign(r.variantes[nom], {
        communesAvecBase: nom === 'base' ? null : list.length - nouv.length, nouvelles: nom === 'base' ? null : nouv.length,
        surSujet: moy(list), surSujet1a25: moy(list.slice(0, 25)), surSujet26a50: moy(list.slice(25)), nouvellesSurSujet: nom === 'base' ? null : moy(nouv),
        titres: list.map((id, k) => (k + 1) + '. ' + (nom !== 'base' && !base.has(id) ? '🆕 ' : '') + ((info[id] || {}).titre || id) + ' — ' + ((info[id] || {}).chaine || '') + ' — ' + ((info[id] || {}).vues || 0) + ' vues — ' + ((info[id] || {}).duree || '') + ' — sujet ' + Math.round(100 * sujet(id)) + ' %')
      });
    }
    r.totalUniques = all.length;
    out.push(r);
  }
  return out;
}

async function lireAvis(){
  const u = (process.env.AVIS_URL || '').trim();
  if(!u) return;
  try {
    const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    const txt = await r.text();
    fs.writeFileSync(path.join(OUT, 'avis.json'), txt);
    rapport.avisTableau = { code: r.status, taille: txt.length };
  } catch(e){ rapport.avisTableau = { erreur: String(e.message).slice(0, 200) }; }
}
try { await lireAvis(); } catch(e){}
try { await main(); } catch(e){ rapport.erreurs.push('général : ' + redact(e.stack || e.message).slice(0, 600)); log('ERREUR', e.message); }
save('rapport.json', rapport);
server.close();
log('terminé :', rapport.recherches.length, 'recherche(s),', rapport.erreurs.length, 'erreur(s)');
process.exit(0);
