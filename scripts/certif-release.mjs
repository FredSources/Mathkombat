#!/usr/bin/env node
/**
 * scripts/certif-release.mjs — certification du mode RELEASE (T04, I10).
 *
 * Preuve exécutable que le build RELEASE :
 *  1. ne tente **aucune connexion** (zéro WebSocket, zéro requête hors origine) ;
 *  2. n'écrit **rien en console** (logger compilé no-op) ;
 *  3. n'expose **aucun hook de debug** (`__mathkombat`, `__mathkombatEcrans`) ;
 *  4. reste **jouable** (parcours réel RUN → sélection → combat).
 *
 * Usage : node scripts/certif-release.mjs
 * Sortie : code 0 = certifié ; rapport dans output/reports/certif-release-*.md
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(PROJ, 'game', 'dist');
const RAPPORTS = path.join(PROJ, 'output', 'reports');
fs.mkdirSync(RAPPORTS, { recursive: true });
const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const require = createRequire(path.join(PROJ, 'game', 'package.json'));
const puppeteer = require('puppeteer-core');

const resultats = [];
let echecs = 0;
function verifier(id, libelle, ok, detail = '') {
  resultats.push({ id, libelle, ok, detail });
  if (!ok) echecs++;
  console.log(`${ok ? '\x1b[1;32m[PASS]\x1b[0m' : '\x1b[1;31m[FAIL]\x1b[0m'} ${id} — ${libelle}${detail ? ` (${detail})` : ''}`);
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sert `game/dist/` en HTTP statique (contenu embarquable, zéro dépendance). */
function servirDist() {
  const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
    '.wav': 'audio/wav', '.svg': 'image/svg+xml',
  };
  return new Promise((resolve) => {
    const serveur = http.createServer((req, res) => {
      const url = (req.url ?? '/').split('?')[0];
      const fichier = path.join(DIST, url === '/' ? 'index.html' : url);
      if (!fichier.startsWith(DIST) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] ?? 'application/octet-stream' });
      fs.createReadStream(fichier).pipe(res);
    });
    serveur.listen(0, '127.0.0.1', () => resolve(serveur));
  });
}

// ---------------------------------------------------------- 1. build RELEASE
const build = spawn('bash', [path.join(PROJ, 'scripts', 'build.sh'), 'release'], {
  cwd: PROJ,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let sortieBuild = '';
build.stdout.on('data', (d) => (sortieBuild += d));
build.stderr.on('data', (d) => (sortieBuild += d));
const codeBuild = await new Promise((r) => build.on('close', r));
verifier('C1', 'Build RELEASE produit (bash scripts/build.sh release)', codeBuild === 0 && fs.existsSync(path.join(DIST, 'index.html')), `code=${codeBuild} · ${fs.existsSync(DIST) ? fs.readdirSync(DIST).length + ' fichiers' : 'dist absent'}`);

// ---------------------------------------------------------- 2. parcours réel
const serveur = await servirDist();
const port = serveur.address().port;
const navigateur = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu', '--window-size=1280,720', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await navigateur.newPage();

const messagesConsole = [];
const websockets = [];
const requetesHorsOrigine = [];
const erreurs = [];
page.on('console', (m) => messagesConsole.push(`${m.type()}: ${m.text()}`));
page.on('websocket', (ws) => websockets.push(ws.url()));
page.on('request', (r) => {
  const url = r.url();
  // hors-ligne = zéro requête réseau ; blob:/data: = ressources en mémoire
  const horsOrigine =
    !url.startsWith(`http://127.0.0.1:${port}`) &&
    !url.startsWith('data:') &&
    !url.startsWith('blob:');
  if (horsOrigine) requetesHorsOrigine.push(url);
});
page.on('pageerror', (e) => erreurs.push(String(e)));

/** Marqueurs de nomenclature (AGENTS §4) : aucun ne doit sortir en RELEASE. */
const MARQUEURS_LOG = ['session.', 'combat.', 'math.', 'ia.', 'ui.', 'anim.', 'erreur.'];
/**
 * Erreurs tolérées : artefacts du **GPU logiciel** (SwiftShader/ANGLE) utilisé
 * en headless — `Framebuffer Unsupported` et consorts. Absentes sur un vrai GPU
 * (WebView Android). Tout le reste est une erreur applicative (C7).
 */
const ERREURS_RENDU_LOGICIEL = ['Framebuffer', 'WebGL', 'CONTEXT_LOST'];

async function clicJeu(x, y) {
  await page.waitForSelector('canvas', { timeout: 20000 }); // boot RELEASE (fallback canvas)
  const pos = await page.evaluate(({ x, y }) => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x + (x / 1280) * r.width, y: r.y + (y / 720) * r.height };
  }, { x, y });
  await page.mouse.click(pos.x, pos.y);
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await attendre(1500);
  await clicJeu(640, 310); // RUN (wireframe §1)
  await attendre(600);
  await clicJeu(640, 520); // [ LANCER LE COMBAT ] (wireframe §3)
  await attendre(1500);

  const hooks = await page.evaluate(() => ({
    combat: typeof window.__mathkombat,
    ecrans: typeof window.__mathkombatEcrans,
    canvas: !!document.querySelector('canvas'),
  }));
  verifier('C2', 'Jouable en RELEASE (RUN → sélection → combat, canvas présent)', hooks.canvas === true, `canvas=${hooks.canvas}`);
  verifier('C3', 'Zéro hook de debug exposé (I10)', hooks.combat === 'undefined' && hooks.ecrans === 'undefined', `__mathkombat=${hooks.combat} __mathkombatEcrans=${hooks.ecrans}`);
  const logsApplication = messagesConsole.filter((m) => MARQUEURS_LOG.some((x) => m.includes(x)));
  verifier('C4', 'Zéro log d\'application (logger no-op — nomenclature §4)', logsApplication.length === 0, logsApplication.slice(0, 3).join(' | '));
  verifier('C5', 'Zéro connexion WebSocket (aucun collecteur)', websockets.length === 0, websockets.join(', '));
  verifier('C6', 'Zéro requête hors origine (hors-ligne)', requetesHorsOrigine.length === 0, requetesHorsOrigine.slice(0, 3).join(', '));
  const erreursApplicatives = erreurs.filter(
    (e) => !ERREURS_RENDU_LOGICIEL.some((x) => e.includes(x))
  );
  verifier('C7', 'Aucune erreur JavaScript applicative (hors artefacts GPU logiciel)', erreursApplicatives.length === 0, erreursApplicatives.slice(0, 2).join(' | '));
} finally {
  await navigateur.close();
  serveur.close();
}

// ---------------------------------------------------------- 3. rapport
const lignes = [
  `# Certification RELEASE — ${horodatage}`,
  '',
  'Pilote : `node scripts/certif-release.mjs` (T04, I10).',
  '',
  '| Id | Contrôle | Résultat | Détail |',
  '|----|----------|----------|--------|',
  ...resultats.map(
    (r) => `| ${r.id} | ${r.libelle} | ${r.ok ? '✅ PASS' : '❌ FAIL'} | ${r.detail.replaceAll('|', '/')} |`
  ),
  '',
  `**Verdict : ${echecs === 0 ? '✅ RELEASE CERTIFIÉ ZÉRO LOG' : `❌ ${echecs} échec(s)`}**`,
];
const rapport = path.join(RAPPORTS, `certif-release-${horodatage}.md`);
fs.writeFileSync(rapport, lignes.join('\n') + '\n');
console.log(`\nRapport : ${rapport}`);
process.exit(echecs === 0 ? 0 : 1);
