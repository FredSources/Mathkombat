#!/usr/bin/env node
/**
 * scripts/e2e.mjs — tests E2E navigateur (L4, docs/test-plan.md) : E01→E05.
 *
 * Pilote le jeu dans chromium headless (SwiftShader) via puppeteer-core :
 *  - E01 : lancement → scène de combat atteinte (capture) ;
 *  - E02 : 3 calculs d'attaque résolus au CLAVIER NUMÉRIQUE, dont une erreur
 *          corrigée par ⌫ Effacer avant Valider → énergie = somme attendue,
 *          calcul erroné non remplacé (I4, I8) ;
 *  - E03 : phase de défense (divisions) puis résolution → PV mis à jour selon
 *          I1/I2 (dégâts ou contre-attaque) ;
 *  - E04 : énergie d'attaque forcée à 16 → tier 3 déterministe, impact animé
 *          (étincelles + onde de choc) et dégâts = 16 − défense (capture) ;
 *  - E05 : énergie d'attaque = défense + PV max → K.O., score de manche
 *          incrémenté pour J1 (capture).
 *
 * Usage : node scripts/e2e.mjs   (démarre le dev server si absent)
 * Sortie : code 0 = tout vert ; artefacts : output/screenshots/e2e-*.png,
 *          output/reports/e2e-<horodatage>.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(PROJ, 'game', 'package.json'));
const puppeteer = require('puppeteer-core');

const URL_JEU = 'http://127.0.0.1:5173/';
const SHOTS = path.join(PROJ, 'output', 'screenshots');
const RAPPORTS = path.join(PROJ, 'output', 'reports');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(RAPPORTS, { recursive: true });

const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const resultats = [];
let echecs = 0;

function verifier(id, libelle, ok, detail = '') {
  resultats.push({ id, libelle, ok, detail });
  if (!ok) echecs++;
  console.log(`${ok ? '\x1b[1;32m[PASS]\x1b[0m' : '\x1b[1;31m[FAIL]\x1b[0m'} ${id} — ${libelle}${detail ? ` (${detail})` : ''}`);
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function serveurDisponible() {
  try {
    const r = await fetch(URL_JEU);
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  // dev server (démarre si absent)
  let serveur = null;
  if (!(await serveurDisponible())) {
    console.log('[e2e] démarrage du dev server…');
    serveur = spawn('npm', ['run', 'dev'], { cwd: path.join(PROJ, 'game'), stdio: 'ignore' });
    for (let i = 0; i < 40 && !(await serveurDisponible()); i++) await attendre(500);
  }

  const navigateur = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--headless=new',
      '--use-angle=swiftshader',
      '--window-size=1280,720',
      '--hide-scrollbars',
    ],
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await navigateur.newPage();

  const attendreHook = async () => {
    await page.waitForFunction(() => window.__mathkombat?.ready === true, { timeout: 20000 });
  };
  const etat = () => page.evaluate(() => window.__mathkombat.etat());
  const questions = () => page.evaluate(() => window.__mathkombat.questionsHumain());

  // clic en coordonnées jeu → écran (Scale.FIT)
  async function clicJeu(x, y) {
    const pos = await page.evaluate(({ x, y }) => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { x: r.x + (x / 1280) * r.width, y: r.y + (y / 720) * r.height };
    }, { x, y });
    await page.mouse.click(pos.x, pos.y);
  }

  try {
    // ---------------------------------------------------------- E01
    await page.goto(URL_JEU, { waitUntil: 'networkidle0', timeout: 30000 });
    await attendreHook();
    await page.evaluate(() => window.__mathkombat.setTempsPhase(45)); // confort E2E
    await attendre(800);
    const e01 = await etat();
    await page.screenshot({ path: path.join(SHOTS, 'e2e-01-combat.png') });
    verifier('E01', 'Lancement → scène de combat atteinte', e01.tour >= 1 && e01.pv.j1 === 100 && e01.pv.j2 === 100);

    // ---------------------------------------------------------- E02
    // attendre une phase d'attaque du joueur (tour 1 : J1 attaque)
    await page.waitForFunction(
      () => {
        const e = window.__mathkombat.etat();
        return e.phase === 'attaque' && e.attaquant === 'j1';
      },
      { timeout: 15000 }
    );
    let qs = await questions();
    const parDiff = Object.fromEntries(qs.map((q) => [q.difficulte, q]));

    // E02a — erreur VALIDÉE sur « facile » : gain 0, calcul conservé (I4)
    await clicJeu(126, 178);
    await attendre(150);
    const qF = parDiff.facile;
    let avant = await etat();
    await page.keyboard.type(String(qF.reponse + 1), { delay: 40 });
    await page.keyboard.press('Enter');
    await attendre(300);
    let apres = await etat();
    let qsApres = await questions();
    const saisieApres = await page.evaluate(() => window.__mathkombat.saisie());
    verifier(
      'E02a',
      'Erreur validée → gain 0, calcul conservé et saisie vidée (I4)',
      apres.energieAttaque === avant.energieAttaque &&
        qsApres.find((q) => q.difficulte === 'facile').enonce === qF.enonce &&
        saisieApres.texte === '',
      `énergie ${avant.energieAttaque}→${apres.energieAttaque} saisie="${saisieApres.texte}"`
    );

    // E02b — « moyen » : erreur de frappe corrigée par ⌫ AVANT Valider (+3)
    await clicJeu(310, 178);
    await attendre(150);
    const qM = (await questions()).find((q) => q.difficulte === 'moyen');
    await page.keyboard.type('9', { delay: 40 });
    await page.keyboard.press('Backspace'); // ⌫ Effacer : un chiffre
    await page.keyboard.type(String(qM.reponse), { delay: 40 });
    await page.keyboard.press('Enter');
    await attendre(300);
    apres = await etat();
    qsApres = await questions();
    verifier(
      'E02b',
      'Correction par ⌫ avant Valider → +3 et calcul remplacé (I8, I12)',
      apres.energieAttaque === avant.energieAttaque + 3 &&
        qsApres.find((q) => q.difficulte === 'moyen').enonce !== qM.enonce,
      `énergie ${apres.energieAttaque}`
    );

    // E02c — « difficile » (+7) : bonne réponse directe
    await clicJeu(494, 178);
    await attendre(150);
    const qD = (await questions()).find((q) => q.difficulte === 'difficile');
    await page.keyboard.type(String(qD.reponse), { delay: 40 });
    await page.keyboard.press('Enter');
    await attendre(300);
    let eApresD = (await etat()).energieAttaque;
    verifier(
      'E02c',
      'Calcul difficile résolu → +7',
      eApresD === apres.energieAttaque + 7,
      `énergie ${eApresD}`
    );

    // E02d — « facile » (saisie périmée) : C Tout effacer puis bonne réponse (+1)
    await clicJeu(126, 178);
    await attendre(150);
    await page.keyboard.press('Escape'); // C Tout effacer (saisie périmée)
    await page.keyboard.type(String(qF.reponse), { delay: 40 });
    await page.keyboard.press('Enter');
    await attendre(300);
    const e02 = await etat();
    qsApres = await questions();
    await page.screenshot({ path: path.join(SHOTS, 'e2e-02-energie.png') });
    verifier(
      'E02d',
      'Tout effacer puis bonne réponse → énergie totale +11 (sommée)',
      e02.energieAttaque === 11 &&
        qsApres.find((q) => q.difficulte === 'facile').enonce !== qF.enonce,
      `énergie=${e02.energieAttaque}`
    );

    // ---------------------------------------------------------- E03
    // fin de l'attaque (J1) → défense IA (tour 1) → résolution → tour 2 :
    // attaque IA → DÉFENSE du joueur (divisions) → résolution
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // fin attaque J1
    await attendre(400);
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // fin défense IA
    await attendre(2300); // résolution + tour suivant
    await page.waitForFunction(
      () => window.__mathkombat.etat().tour === 2,
      { timeout: 15000 }
    );
    // tour 2 s'ouvre sur la phase d'attaque de l'IA : on la force
    await attendre(300);
    if ((await etat()).phase === 'attaque') {
      await page.evaluate(() => window.__mathkombat.forceFinDePhase());
      await attendre(300);
    }
    await page.waitForFunction(
      () => {
        const e = window.__mathkombat.etat();
        return e.tour === 2 && e.phase === 'defense';
      },
      { timeout: 15000 }
    );

    const avantResolution = await etat();
    const attaqueIA = avantResolution.energieAttaque;
    const qDefense = await questions();
    let defenseGains = 0;
    for (const q of qDefense) {
      await clicJeu(q.difficulte === 'facile' ? 126 : q.difficulte === 'moyen' ? 310 : 494, 178);
      await attendre(150);
      await page.keyboard.type(String(q.reponse), { delay: 40 });
      await page.keyboard.press('Enter');
      await attendre(250);
      defenseGains += q.gain;
    }
    const solde = attaqueIA - defenseGains;
    const pvAvant = avantResolution.pv;
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // fin défense J1 → résolution
    await attendre(900);
    const apresResolution = await etat();
    await page.screenshot({ path: path.join(SHOTS, 'e2e-03-resolution.png') });

    const degatsAttendus = Math.abs(solde);
    const pvAttendus =
      solde > 0
        ? { j1: Math.max(0, pvAvant.j1 - degatsAttendus), j2: pvAvant.j2 }
        : solde < 0
          ? { j1: pvAvant.j1, j2: Math.max(0, pvAvant.j2 - degatsAttendus) }
          : pvAvant;
    verifier(
      'E03',
      'Défense puis résolution → PV mis à jour selon I1/I2',
      apresResolution.pv.j1 === pvAttendus.j1 && apresResolution.pv.j2 === pvAttendus.j2,
      `solde=${solde} PV=${JSON.stringify(apresResolution.pv)} attendu=${JSON.stringify(pvAttendus)}`
    );

    // ---------------------------------------------------------- E04
    // tour 3 : attaque du J1 → on force l'énergie à 16 (tier 3) puis on
    // résout aussitôt pour capturer l'impact (étincelles + onde de choc).
    await page.waitForFunction(
      () => {
        const e = window.__mathkombat.etat();
        return e.tour === 3 && e.phase === 'attaque' && e.attaquant === 'j1';
      },
      { timeout: 20000 }
    );
    const e04Forcage = await page.evaluate(() => {
      const h = window.__mathkombat;
      const okA = h.forcerEnergieAttaque(16);
      const okD = h.forcerEnergieDefense(6); // défense figée → dégâts déterministes
      const e = h.etat();
      h.forceFinDePhase(); // fin attaque J1 → défense IA
      return { ok: okA && okD, energie: e.energieAttaque, tier: e.tierAttaque };
    });
    verifier(
      'E04a',
      'Énergie forcée à 16 → tier 3 déterministe (§2.8b)',
      e04Forcage.ok && e04Forcage.energie === 16 && e04Forcage.tier === 3,
      `énergie=${e04Forcage.energie} tier=${e04Forcage.tier}`
    );
    const pvAvantE04 = (await etat()).pv;
    await page.waitForFunction(() => window.__mathkombat.etat().phase === 'defense', {
      timeout: 10000,
    });
    const e04Defense = await page.evaluate(() => {
      const h = window.__mathkombat;
      const defense = h.etat().energieDefense;
      h.forceFinDePhase(); // fin défense IA → résolution
      return { defense };
    });
    const degatsE04 = 16 - e04Defense.defense;
    await attendre(180); // flash d'impact + étincelles + onde de choc visibles
    await page.screenshot({ path: path.join(SHOTS, 'e2e-04-frappe.png') });
    const e04Etat = await etat();
    const e04Journal = await page.evaluate(() => window.__mathkombat.journal());
    verifier(
      'E04b',
      'Résolution tier 3 → dégâts appliqués à l’IA et journal mis à jour',
      degatsE04 > 0 &&
        e04Etat.pv.j1 === pvAvantE04.j1 &&
        e04Etat.pv.j2 === pvAvantE04.j2 - degatsE04 &&
        e04Journal.some((l) => l.includes('encaisse')),
      `défense=${e04Defense.defense} PV=${JSON.stringify(e04Etat.pv)} journal=${JSON.stringify(e04Journal.slice(0, 3))}`
    );

    // ---------------------------------------------------------- E05
    // tour 4 (attaque IA + défense J1) résolu à vide → tour 5 : attaque du J1
    // dont l'énergie vaut défense + 100 → K.O. et manche gagnée par J1.
    await page.waitForFunction(
      () => {
        const e = window.__mathkombat.etat();
        return e.tour === 4 && e.phase === 'attaque';
      },
      { timeout: 20000 }
    );
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await page.waitForFunction(() => window.__mathkombat.etat().phase === 'defense', {
      timeout: 10000,
    });
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // résolution tour 4
    await page.waitForFunction(
      () => {
        const e = window.__mathkombat.etat();
        return e.tour === 5 && e.phase === 'attaque' && e.attaquant === 'j1';
      },
      { timeout: 20000 }
    );
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // → défense IA
    await page.waitForFunction(() => window.__mathkombat.etat().phase === 'defense', {
      timeout: 10000,
    });
    const e05Forcage = await page.evaluate(() => {
      const h = window.__mathkombat;
      const defense = h.etat().energieDefense;
      const ok = h.forcerEnergieAttaque(defense + 100); // solde = 100 → K.O.
      h.forceFinDePhase();
      return { ok, defense };
    });
    await attendre(2200); // ralenti + bandeau K.O.
    await page.screenshot({ path: path.join(SHOTS, 'e2e-05-ko.png') });
    const e05Etat = await etat();
    const e05Score = await page.evaluate(() => window.__mathkombat.score());
    const e05Journal = await page.evaluate(() => window.__mathkombat.journal());
    verifier(
      'E05',
      'Solde = défense + 100 → K.O., gagnant J1 et score de manche incrémenté',
      e05Forcage.ok &&
        e05Etat.fini === true &&
        e05Etat.gagnant === 'j1' &&
        e05Etat.pv.j2 === 0 &&
        e05Score.j1 === 1 &&
        e05Journal.some((l) => l.includes('K.O.')),
      `fini=${e05Etat.fini} gagnant=${e05Etat.gagnant} PV=${JSON.stringify(e05Etat.pv)} score=${JSON.stringify(e05Score)}`
    );
  } finally {
    await navigateur.close();
    if (serveur) serveur.kill();
  }

  // rapport
  const lignes = [
    `# Rapport E2E — ${horodatage}`,
    '',
    '| Test | Libellé | Verdict | Détail |',
    '|------|---------|---------|--------|',
    ...resultats.map((r) => `| ${r.id} | ${r.libelle} | ${r.ok ? '✅ PASS' : '❌ FAIL'} | ${r.detail} |`),
    '',
    `**Verdict global** : ${echecs === 0 ? '✅ TOUT VERT' : `❌ ${echecs} échec(s)`}`,
    '',
    'Captures : `output/screenshots/e2e-01-combat.png`, `e2e-02-energie.png`, `e2e-03-resolution.png`, `e2e-04-frappe.png`, `e2e-05-ko.png`',
    '',
  ];
  const rapport = path.join(RAPPORTS, `e2e-${horodatage}.md`);
  fs.writeFileSync(rapport, lignes.join('\n'));
  console.log(`\nRapport : ${path.relative(PROJ, rapport)}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[e2e] erreur fatale :', err);
  process.exit(1);
});
