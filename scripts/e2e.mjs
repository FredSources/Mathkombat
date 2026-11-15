#!/usr/bin/env node
/**
 * scripts/e2e.mjs — tests E2E navigateur (L4, docs/test-plan.md) : E01→E08.
 *
 * Pilote le jeu dans chromium headless (SwiftShader) via puppeteer-core :
 *  - E01 : lancement → écran RUN → RUN → scène de combat atteinte (capture) ;
 *  - E02 : 3 calculs d'attaque résolus au CLAVIER NUMÉRIQUE, dont une erreur
 *          corrigée par ⌫ Effacer avant Valider → énergie = somme attendue,
 *          calcul erroné non remplacé (I4, I8) ;
 *  - E03 : phase de défense (divisions) puis résolution → PV mis à jour selon
 *          I1/I2 (dégâts ou contre-attaque) ;
 *  - E04 : énergie d'attaque forcée à 16 → tier 3 déterministe, impact animé
 *          (étincelles + onde de choc) et dégâts = 16 − défense (capture) ;
 *  - E05 : énergie d'attaque = défense + PV max → K.O., score de manche
 *          incrémenté pour J1 (capture) ;
 *  - E06 : écran CONFIG → tempo RAPIDE → attaque et défense à 10 s (capture) ;
 *  - E07 : écran CONFIG → 2 JOUEURS + SIMULTANÉ → deux zones actives, tour 2
 *          (capture) ;
 *  - E08 : mode DUEL — bascule du mode, J2 saisit sur le PAVÉ NUMÉRIQUE,
 *          isolation des deux consoles (fichiers distincts), libellés J2,
 *          puis rythme SIMULTANÉ : deux zones actives sans conflit de frappe.
 *  - E09 : score de combat — mesures par joueur, score final avec bonus K.O.,
 *          record persistant et HIGH SCORE sur l'écran RUN (captures).
 *  - E10 : menu de pause — ☰ MENU → chrono figé → RETOUR AU JEU (reprise) →
 *          ☰ MENU → QUITTER → MENU (capture).
 *  - E11 : fin de combat — boutons [ REJOUER ] / [ MENU ] au K.O. (§7) :
 *          REJOUER relance un combat, MENU revient à l'écran RUN (capture).
 *  - E12 : sélection de combat (§3) — niveau et personnage choisis, puis
 *          LANCER LE COMBAT applique bien la sélection (capture).
 *
 * E06/E07/E09/E10/E11/E12 sont exécutés **en fin de batterie** : ils rechargent
 * l'application (retour aux réglages par défaut §2.9), ce qui casserait la
 * continuité E05→E08.
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
      '--enable-unsafe-swiftshader',
      '--disable-gpu',
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
  const questionsDe = (joueur) =>
    page.evaluate((j) => window.__mathkombat.questionsHumain(j), joueur);

  // clic en coordonnées jeu → écran (Scale.FIT)
  async function clicJeu(x, y) {
    const pos = await page.evaluate(({ x, y }) => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { x: r.x + (x / 1280) * r.width, y: r.y + (y / 720) * r.height };
    }, { x, y });
    await page.mouse.click(pos.x, pos.y);
  }

  // attend l'écran courant déclaré par `declarerEcran()` (DEBUG) : le clic
  // suivant vise des coordonnées connues d'un écran donné (§ wireframes).
  const attendreEcran = (ecran, timeout = 15000) =>
    page.waitForFunction((e) => window.__mathkombatEcrans?.ecran === e, { timeout }, ecran);

  // charge l'application avec reprise : le GPU logiciel (SwiftShader) perd
  // parfois son contexte au boot et le jeu ne démarre pas — on recharge.
  async function chargerApplication() {
    for (let essai = 1; essai <= 3; essai++) {
      await page.goto(URL_JEU, { waitUntil: 'networkidle0', timeout: 30000 });
      try {
        await page.waitForFunction(() => window.__mathkombatEcrans?.ecran === 'menu', {
          timeout: 10000,
        });
        return;
      } catch {
        console.log(`[e2e] boot instable (essai ${essai}) — rechargement…`);
      }
    }
    throw new Error('impossible de démarrer le jeu (WebGL instable)');
  }

  // recharge l'application : on repart de l'écran de lancement (les réglages
  // de l'écran CONFIG sont réinitialisés à leurs défauts §2.9).
  async function relancer() {
    await chargerApplication();
    await attendre(400);
  }

  // RUN → écran de sélection (§3) → [ LANCER LE COMBAT ] → scène de combat.
  // Les clics sont réels (coordonnées des wireframes §1 et §3).
  async function lancerCombat() {
    await clicJeu(640, 310); // bouton RUN (wireframe §1)
    await attendreEcran('select');
    await attendre(250);
    await clicJeu(640, 520); // [ ▶ LANCER LE COMBAT ] (wireframe §3)
    await attendreHook();
    await attendre(400);
  }

  try {
    // ---------------------------------------------------------- E01
    await chargerApplication();
    await attendre(400);
    const e01Menu = await page.evaluate(() => window.__mathkombatEcrans.ecran);
    await lancerCombat(); // RUN → sélection (§3) → combat
    await page.evaluate(() => window.__mathkombat.setTempsPhase(45)); // confort E2E
    await attendre(800);
    const e01 = await etat();
    await page.screenshot({ path: path.join(SHOTS, 'e2e-01-combat.png') });
    verifier('E01', 'Lancement → écran RUN, puis RUN → scène de combat atteinte', e01Menu === 'menu' && e01.tour >= 1 && e01.pv.j1 === 100 && e01.pv.j2 === 100, `ecran=${e01Menu} tour=${e01.tour}`);

    // ---------------------------------------------------------- E02
    // attendre une phase d'attaque du joueur (tour 1 : J1 attaque).
    // Rythme DIFFÉRÉ explicite : le défaut est SIMULTANÉ (§2.1) et E02→E05
    // testent la séquence attaque → défense → résolution.
    await page.evaluate(() => window.__mathkombat.setRythme('differe'));
    await attendre(400);
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
    await attendre(90); // sprite de coup visible + flash d'impact
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

    // ---------------------------------------------------------- E08
    // Mode DUEL 2 joueurs (§2.6) : bascule de mode, une console par joueur
    // (J1 = ligne de chiffres, J2 = pavé numérique), isolation stricte des
    // frappes, libellés « J2 », puis rythme SIMULTANÉ avec deux zones actives.

    // E08a — bascule en duel : combat relancé, tour 1, attaque de J1, libellés J2
    await page.evaluate(() => window.__mathkombat.setMode('duel'));
    await attendre(500);
    const e08a = await etat();
    const e08aLib = await page.evaluate(() => window.__mathkombat.libelles());
    verifier(
      'E08a',
      'Bascule en mode duel → tour 1, phase d’attaque de J1, libellés « J2 »',
      e08a.mode === 'duel' &&
        e08a.tour === 1 &&
        e08a.phase === 'attaque' &&
        e08a.attaquant === 'j1' &&
        e08aLib.pv2.includes('J2') &&
        e08aLib.score.includes('J2'),
      `mode=${e08a.mode} tour=${e08a.tour} phase=${e08a.phase} attaquant=${e08a.attaquant} pv2="${e08aLib.pv2}" score="${e08aLib.score}"`
    );

    // E08b — J1 attaque : facile (+1) puis moyen (+3) au clavier de J1
    const e08Q1 = await questions();
    await clicJeu(126, 178); // carte FACILE de J1
    await attendre(150);
    await page.keyboard.type(String(e08Q1.find((q) => q.difficulte === 'facile').reponse), {
      delay: 40,
    });
    await page.keyboard.press('Enter');
    await attendre(250);
    await clicJeu(310, 178); // carte MOYEN de J1
    await attendre(150);
    await page.keyboard.type(String(e08Q1.find((q) => q.difficulte === 'moyen').reponse), {
      delay: 40,
    });
    await page.keyboard.press('Enter');
    await attendre(300);
    const e08b = await etat();
    verifier(
      'E08b',
      'J1 résout Facile + Moyen → énergie d’attaque = 4',
      e08b.energieAttaque === 4,
      `énergie=${e08b.energieAttaque}`
    );

    // E08c — pendant la phase de J1, une frappe du PAVÉ (touche de J2) ne doit
    // atteindre AUCUNE console : les deux saisies restent vides.
    await page.keyboard.press('Numpad3');
    await attendre(200);
    const e08c = await page.evaluate(() => ({
      j1: window.__mathkombat.saisie('j1').texte,
      j2: window.__mathkombat.saisie('j2').texte,
    }));
    verifier(
      'E08c',
      'Isolation : une touche du pavé numérique n’atteint ni J1 ni J2 (phase de J1)',
      e08c.j1 === '' && e08c.j2 === '',
      `J1="${e08c.j1}" J2="${e08c.j2}"`
    );

    // E08d — fin de la phase d’attaque → phase de défense jouée par J2
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await page.waitForFunction(() => window.__mathkombat.etat().phase === 'defense', {
      timeout: 10000,
    });
    await clicJeu(970, 178); // carte MOYEN de J2 (zone en miroir)
    await attendre(250);
    const e08d = await page.evaluate(() => ({
      cible: window.__mathkombat.saisie('j2').cible,
      j1: window.__mathkombat.saisie('j1').texte,
    }));
    verifier(
      'E08d',
      'Phase de défense → J2 cible son calcul MOYEN, saisie de J1 intacte',
      e08d.cible === 'moyen' && e08d.j1 === '',
      `cible J2=${e08d.cible} saisie J1="${e08d.j1}"`
    );

    // E08e — pavé de J2 : ⌫ (touche décimale) et C (Delete) distincts, puis
    // réponse chiffre par chiffre + NumpadEnter → +3, saisie vidée, J1 inchangé.
    await page.keyboard.press('Numpad9');
    await page.keyboard.press('NumpadDecimal'); // ⌫ Effacer (un chiffre)
    const e08Erase = await page.evaluate(() => window.__mathkombat.saisie('j2').texte);
    await page.keyboard.press('Numpad8');
    const e08Digit = await page.evaluate(() => window.__mathkombat.saisie('j2').texte);
    await page.keyboard.press('Delete'); // C Tout effacer
    const e08Clear = await page.evaluate(() => window.__mathkombat.saisie('j2').texte);
    verifier(
      'E08e1',
      'Pavé J2 : ⌫ efface le dernier chiffre, C vide la saisie entière',
      e08Erase === '' && e08Digit === '8' && e08Clear === '',
      `après ⌫="${e08Erase}" après 8="${e08Digit}" après C="${e08Clear}"`
    );

    const e08Q2 = await questionsDe('j2');
    const e08Rep = String(e08Q2.find((q) => q.difficulte === 'moyen').reponse);
    for (const chiffre of e08Rep) {
      await page.keyboard.press(`Numpad${chiffre}`);
      await attendre(60);
    }
    await page.keyboard.press('NumpadEnter');
    await attendre(350);
    const e08e = await page.evaluate(() => ({
      energie: window.__mathkombat.etat().energieDefense,
      j2: window.__mathkombat.saisie('j2').texte,
      j1: window.__mathkombat.saisie('j1').texte,
    }));
    verifier(
      'E08e2',
      'Réponse J2 saisie au pavé → +3 de défense, saisie de J2 vidée, J1 inchangé',
      e08e.energie === 3 && e08e.j2 === '' && e08e.j1 === '',
      `défense=${e08e.energie} J2="${e08e.j2}" J1="${e08e.j1}"`
    );

    // E08f — résolution : solde = 4 − 3 = +1 → 1 dégât sur J2, libellés « J2 »
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await attendre(900);
    const e08f = await etat();
    const e08fLib = await page.evaluate(() => window.__mathkombat.libelles());
    await page.screenshot({ path: path.join(SHOTS, 'e2e-08-duel.png') });
    verifier(
      'E08f',
      'Résolution duel : attaque 4 − défense 3 = 1 dégât sur J2, libellés « J2 »',
      e08f.pv.j1 === 100 &&
        e08f.pv.j2 === 99 &&
        e08fLib.pv2.includes('J2') &&
        e08fLib.energie2.includes('énergie J2'),
      `PV=${JSON.stringify(e08f.pv)} pv2="${e08fLib.pv2}" energie2="${e08fLib.energie2}"`
    );

    // E08g — SIMULTANÉ en duel : les deux zones actives, aucune frappe ne doit
    // franchir d'une console à l'autre (dans les DEUX sens). On laisse d'abord
    // le delayedCall(1800) du tour suivant se déclencher, sinon double démarrage.
    await page.waitForFunction(() => window.__mathkombat.etat().tour === 2, {
      timeout: 15000,
    });
    await page.evaluate(() => window.__mathkombat.setRythme('simultane'));
    await attendre(500);
    await page.keyboard.type('5', { delay: 40 }); // touche de J1 (Digit5)
    await attendre(200);
    const e08ApresJ1 = await page.evaluate(() => ({
      j1: window.__mathkombat.saisie('j1').texte,
      j2: window.__mathkombat.saisie('j2').texte,
    }));
    await page.keyboard.press('Numpad7'); // touche de J2
    await attendre(200);
    const e08g = await page.evaluate(() => ({
      j1: window.__mathkombat.saisie('j1').texte,
      j2: window.__mathkombat.saisie('j2').texte,
      phase: window.__mathkombat.etat().phase,
      rythme: window.__mathkombat.etat().rythme,
    }));
    verifier(
      'E08g',
      'SIMULTANÉ en duel : J1 tape « 5 », J2 tape « 7 », isolation bidirectionnelle',
      e08g.phase === 'simultane' &&
        e08g.rythme === 'simultane' &&
        e08ApresJ1.j1 === '5' &&
        e08ApresJ1.j2 === '' &&
        e08g.j1 === '5' &&
        e08g.j2 === '7',
      `phase=${e08g.phase} rythme=${e08g.rythme} · après J1: J1="${e08ApresJ1.j1}" J2="${e08ApresJ1.j2}" · final: J1="${e08g.j1}" J2="${e08g.j2}"`
    );

    // E08h — surbrillance des touches (§2.7) : la touche pressée s'allume sur
    // SA console uniquement, puis revient au repos après CONFIG.ui.surbrillanceMs.
    // Lecture immédiate (fenêtre de 160 ms) puis contrôle du retour au repos.
    await page.keyboard.press('Digit6');
    const e08hJ1 = await page.evaluate(() => ({
      feu: window.__mathkombat.saisie('j1').surbrillance,
      texte: window.__mathkombat.saisie('j1').texte,
      voisin: window.__mathkombat.saisie('j2').surbrillance,
    }));
    await attendre(400);
    const e08hJ1Repos = await page.evaluate(() => window.__mathkombat.saisie('j1').surbrillance);
    await page.keyboard.press('Numpad4');
    const e08hJ2 = await page.evaluate(() => ({
      feu: window.__mathkombat.saisie('j2').surbrillance,
      texte: window.__mathkombat.saisie('j2').texte,
      voisin: window.__mathkombat.saisie('j1').surbrillance,
    }));
    await attendre(400);
    const e08hRepos = await page.evaluate(() => ({
      j1: window.__mathkombat.saisie('j1').surbrillance,
      j2: window.__mathkombat.saisie('j2').surbrillance,
    }));
    verifier(
      'E08h',
      'Surbrillance : touche pressée allumée sur SA console seule, puis retour au repos',
      e08hJ1.feu === '6' &&
        e08hJ1.texte === '56' &&
        e08hJ1.voisin === null &&
        e08hJ1Repos === null &&
        e08hJ2.feu === '4' &&
        e08hJ2.texte === '74' &&
        e08hJ2.voisin === null &&
        e08hRepos.j1 === null &&
        e08hRepos.j2 === null,
      `J1: feu=${e08hJ1.feu} texte="${e08hJ1.texte}" voisin=${e08hJ1.voisin} repos=${e08hJ1Repos} · J2: feu=${e08hJ2.feu} texte="${e08hJ2.texte}" voisin=${e08hJ2.voisin} · final j1=${e08hRepos.j1} j2=${e08hRepos.j2}`
    );

    // ---------------------------------------------------------- E06
    // Écran CONFIG → preset TEMPO RAPIDE (10 s) → VALIDER → RUN : le combat
    // démarre sur 10 s **et la phase de défense du joueur a la même durée**
    // (§2.9). En solo, la défense du tour 1 est jouée par l'IA (chrono immédiat
    // `ia.dureeChronoIA` = 3 s, §2.6) : on va donc jusqu'à la DÉFENSE DE J1 du
    // tour 2, seule phase humaine comparable — attaque = défense = 10 s.
    // Réalisé après E08 car il recharge l'application (défauts §2.9 restaurés).
    await relancer();
    await clicJeu(640, 410); // bouton CONFIG (wireframe §1)
    await attendreEcran('config');
    await clicJeu(700, 210); // ◀ de la ligne TEMPO : NORMAL → RAPIDE
    await attendre(250);
    await clicJeu(850, 612); // [ VALIDER ] (wireframe §2)
    await attendreEcran('menu');
    await lancerCombat();
    // séquence attaque → défense séparée : rythme DIFFÉRÉ explicite
    await page.evaluate(() => window.__mathkombat.setRythme('differe'));
    await attendre(300);
    const e06Attaque = await etat();
    await page.screenshot({ path: path.join(SHOTS, 'e2e-06-tempo-rapide.png') });
    // tour 1 : attaque J1 (10 s) → défense IA (3 s, hors sujet) → résolution
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await attendre(400);
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await attendre(2300); // résolution + tour suivant
    await page.waitForFunction(() => window.__mathkombat.etat().tour === 2, {
      timeout: 15000,
    });
    // tour 2 : attaque IA (chrono immédiat) → DÉFENSE DE J1 (10 s attendus)
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
    const e06Defense = await etat();
    verifier(
      'E06',
      'CONFIG tempo RAPIDE (10 s) → attaque et défense de J1 sur 10 s (durée unique §2.9)',
      e06Attaque.phase === 'attaque' &&
        e06Attaque.chrono <= 10 &&
        e06Attaque.chrono > 5 &&
        e06Defense.phase === 'defense' &&
        e06Defense.chrono <= 10 &&
        e06Defense.chrono > 5,
      `attaque J1: phase=${e06Attaque.phase} chrono=${e06Attaque.chrono} · défense J1 (tour 2): phase=${e06Defense.phase} chrono=${e06Defense.chrono}`
    );

    // ---------------------------------------------------------- E07
    // Écran CONFIG → MODE 2 JOUEURS + RYTHME SIMULTANÉ → VALIDER → RUN :
    // le combat part en SIMULTANÉ, les DEUX zones sont actives, puis le tour
    // suivant s'enchaîne (aucune phase « défense » séquentielle).
    await relancer();
    await clicJeu(640, 410); // CONFIG
    await attendreEcran('config');
    await clicJeu(1100, 145); // ▶ MODE : SOLO vs IA → 2 JOUEURS
    await clicJeu(700, 320); // ◀ RYTHME : SIMULTANÉ (défaut) → DIFFÉRÉ
    await clicJeu(1100, 320); // ▶ RYTHME : DIFFÉRÉ → SIMULTANÉ (bascule complète)
    await attendre(250);
    await clicJeu(850, 612); // [ VALIDER ]
    await attendreEcran('menu');
    await lancerCombat();
    await attendre(400); // transition stabilisée avant frappe (cf. E08g)
    await page.keyboard.type('5', { delay: 40 }); // touche de J1 (Digit5)
    await page.keyboard.press('Numpad7'); // touche de J2
    await attendre(250);
    const e07 = await page.evaluate(() => ({
      ...window.__mathkombat.etat(),
      j1: window.__mathkombat.saisie('j1').texte,
      j2: window.__mathkombat.saisie('j2').texte,
    }));
    await page.screenshot({ path: path.join(SHOTS, 'e2e-07-simultane.png') });
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await page.waitForFunction(() => window.__mathkombat.etat().tour === 2, {
      timeout: 15000,
    });
    const e07Tour2 = await etat();
    verifier(
      'E07',
      'CONFIG mode 2 JOUEURS + rythme SIMULTANÉ → les deux zones actives puis tour 2',
      e07.mode === 'duel' &&
        e07.rythme === 'simultane' &&
        e07.phase === 'simultane' &&
        e07.j1 === '5' &&
        e07.j2 === '7' &&
        e07Tour2.tour === 2 &&
        e07Tour2.phase === 'simultane',
      `mode=${e07.mode} rythme=${e07.rythme} phase=${e07.phase} saisies J1="${e07.j1}" J2="${e07.j2}" · tour2: tour=${e07Tour2.tour} phase=${e07Tour2.phase}`
    );

    // ---------------------------------------------------------- E09
    // Score de combat (§2.7) : mesures par joueur en temps réel, score final
    // avec bonus K.O., record persistant et HIGH SCORE réaffiché sur l'écran RUN.
    await relancer();
    await lancerCombat(); // solo, défauts §2.9
    // séquence attaque → défense séparée : rythme DIFFÉRÉ explicite
    await page.evaluate(() => window.__mathkombat.setRythme('differe'));
    await attendre(300);
    // 1 calcul résolu au clavier → énergie gagnée créditée au score de J1
    const q09 = (await questions()).find((q) => q.difficulte === 'facile');
    await clicJeu(126, 178); // cible la carte FACILE
    await attendre(150);
    await page.keyboard.type(String(q09.reponse), { delay: 40 });
    await page.keyboard.press('Enter');
    await attendre(250);
    const e09ApresValidation = await page.evaluate(() => window.__mathkombat.scores());
    // K.O. : énergie d'attaque massive, défense forcée à 0 (cf. E05)
    await page.evaluate(() => {
      window.__mathkombat.forcerEnergieAttaque(100);
      window.__mathkombat.forcerEnergieDefense(0);
    });
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // attaque → défense IA
    await attendre(400);
    await page.evaluate(() => window.__mathkombat.forcerEnergieDefense(0));
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // défense → résolution → K.O.
    await attendre(1200);
    const e09Final = await page.evaluate(() => ({
      fini: window.__mathkombat.etat().fini,
      gagnant: window.__mathkombat.etat().gagnant,
      scores: window.__mathkombat.scores(),
      affiche: window.__mathkombat.libelles().scoreJ1,
      avecBonus: window.__mathkombat.scoreFinal('j1', true),
      sansBonus: window.__mathkombat.scoreFinal('j1', false),
      record: Number(localStorage.getItem('mathkombat.record.solo.intermediaire') || 0),
    }));
    await page.screenshot({ path: path.join(SHOTS, 'e2e-09-score.png') });
    // rechargement : le HIGH SCORE réaffiché sur l'écran RUN
    await relancer();
    const e09Menu = await page.evaluate(() => window.__mathkombatEcrans.record);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-09-highscore.png') });
    verifier(
      'E09',
      'Score temps réel par joueur → K.O. → record persistant → HIGH SCORE sur l’écran RUN',
      e09ApresValidation.j1.energieGagnee === q09.gain &&
        e09Final.fini === true &&
        e09Final.gagnant === 'j1' &&
        e09Final.scores.j1.secondesRestantes > 0 &&
        e09Final.sansBonus ===
          e09Final.scores.j1.energieGagnee + e09Final.scores.j1.secondesRestantes &&
        e09Final.avecBonus > e09Final.sansBonus &&
        e09Final.affiche === `SCORE J1 : ${e09Final.avecBonus}` &&
        e09Final.record >= e09Final.avecBonus &&
        e09Menu >= e09Final.avecBonus,
      `énergie=${e09ApresValidation.j1.energieGagnee} (${q09.gain} attendu) · secondes=${e09Final.scores.j1.secondesRestantes} · score sans bonus=${e09Final.sansBonus} avec bonus=${e09Final.avecBonus} · affiché="${e09Final.affiche}" · record=${e09Final.record} · menu=${e09Menu}`
    );

    // ---------------------------------------------------------- E10
    // Menu de pause (§8 wireframes) : ☰ MENU → chrono et animations figés →
    // [ RETOUR AU JEU ] = reprise exacte → ☰ MENU → [ QUITTER → MENU ].
    await relancer();
    await lancerCombat();
    await clicJeu(640, 164); // ☰ MENU
    await attendre(300);
    const e10Pause = await page.evaluate(() => ({
      ouverte: window.__mathkombat.pause().ouverte,
      chrono: window.__mathkombat.etat().chrono,
    }));
    await attendre(1300); // sans reprise, le chrono ne doit PAS avancer
    const e10Gele = await page.evaluate(() => window.__mathkombat.etat().chrono);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-10-pause.png') });
    await clicJeu(640, 355); // [ RETOUR AU JEU ]
    await attendre(300);
    const e10Reprise = await page.evaluate(() => ({
      ouverte: window.__mathkombat.pause().ouverte,
      chrono: window.__mathkombat.etat().chrono,
    }));
    await attendre(1300); // le chrono doit avoir REPARTI
    const e10Reparti = await page.evaluate(() => window.__mathkombat.etat().chrono);
    await clicJeu(640, 164); // ☰ MENU
    await attendre(250);
    await clicJeu(640, 445); // [ QUITTER → MENU ]
    await attendreEcran('menu');
    const e10Menu = await page.evaluate(() => window.__mathkombatEcrans.ecran);
    verifier(
      'E10',
      '☰ MENU en jeu : pause (chrono figé) → RETOUR AU JEU (reprise) → QUITTER → MENU',
      e10Pause.ouverte === true &&
        e10Gele === e10Pause.chrono &&
        e10Reprise.ouverte === false &&
        e10Reparti < e10Reprise.chrono &&
        e10Menu === 'menu',
      `pause=${e10Pause.ouverte} chrono=${e10Pause.chrono} gelé=${e10Gele} · reprise: ouverte=${e10Reprise.ouverte} chrono=${e10Reprise.chrono} puis ${e10Reparti} · écran=${e10Menu}`
    );

    // ---------------------------------------------------------- E11
    // Fin de combat (§7 wireframes) : au K.O., les boutons [ REJOUER ] et
    // [ MENU ] remplacent le message « R = rejouer ».
    await relancer();
    await lancerCombat();
    // séquence attaque → défense séparée : rythme DIFFÉRÉ explicite
    await page.evaluate(() => window.__mathkombat.setRythme('differe'));
    await attendre(300);
    await page.evaluate(() => {
      window.__mathkombat.forcerEnergieAttaque(100);
      window.__mathkombat.forcerEnergieDefense(0);
    });
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // attaque → défense IA
    await attendre(400);
    await page.evaluate(() => window.__mathkombat.forcerEnergieDefense(0));
    await page.evaluate(() => window.__mathkombat.forceFinDePhase()); // défense → résolution → K.O.
    await attendre(1200);
    const e11Fin = await page.evaluate(() => window.__mathkombat.fin());
    await page.screenshot({ path: path.join(SHOTS, 'e2e-11-fin.png') });
    await clicJeu(545, 330); // [ REJOUER ]
    await attendre(800);
    const e11Rejoue = await etat();
    // second K.O. puis [ MENU ]
    await page.evaluate(() => {
      window.__mathkombat.forcerEnergieAttaque(100);
      window.__mathkombat.forcerEnergieDefense(0);
    });
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await attendre(400);
    await page.evaluate(() => window.__mathkombat.forcerEnergieDefense(0));
    await page.evaluate(() => window.__mathkombat.forceFinDePhase());
    await attendre(1200);
    await clicJeu(735, 330); // [ MENU ]
    await attendreEcran('menu');
    const e11Menu = await page.evaluate(() => window.__mathkombatEcrans.ecran);
    verifier(
      'E11',
      'Fin de combat : boutons [ REJOUER ] / [ MENU ] — REJOUER relance, MENU retourne au RUN',
      e11Fin.affichee === true &&
        e11Fin.boutons === true &&
        e11Rejoue.tour === 1 &&
        e11Rejoue.fini === false &&
        e11Menu === 'menu',
      `k.o.: affichee=${e11Fin.affichee} boutons=${e11Fin.boutons} · après REJOUER: tour=${e11Rejoue.tour} fini=${e11Rejoue.fini} · après MENU: écran=${e11Menu}`
    );

    // ---------------------------------------------------------- E12
    // Sélection de combat (§3) : niveau J1 et personnage choisis, puis
    // LANCER LE COMBAT → la sélection est bien celle du combat lancé.
    await relancer();
    await clicJeu(640, 310); // RUN
    await attendreEcran('select');
    await attendre(250);
    await clicJeu(700, 240); // ◀ niveau J1 : INTERMÉDIAIRE → DÉBUTANT
    await clicJeu(700, 320); // ◀ skin J2 : PERSO B → PERSO A
    await attendre(200);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-12-selection.png') });
    await clicJeu(640, 520); // [ ▶ LANCER LE COMBAT ]
    await attendreHook();
    const e12 = await page.evaluate(() => ({
      ...window.__mathkombat.selection(),
      ecran: window.__mathkombatEcrans.ecran,
      tour: window.__mathkombat.etat().tour,
    }));
    verifier(
      'E12',
      'Sélection (§3) : niveau J1 et personnage choisis → combat construit dessus',
      e12.ecran === 'fight' &&
        e12.tour >= 1 &&
        e12.niveauJ1 === 'debutant' &&
        e12.skinJ2 !== 'combattante', // ◀ fait changer le combattant de J2
      `ecran=${e12.ecran} tour=${e12.tour} · sélection: niveauJ1=${e12.niveauJ1} skinJ2=${e12.skinJ2}`
    );

    // ---------------------------------------------------------- E13
    // Validation des mouvements (sprites MK) : chaque action joue bien sa pose.
    await relancer();
    await lancerCombat();
    const e13 = await page.evaluate(() => {
      const h = window.__mathkombat;
      return {
        marche: h.anim('marche'),
        saut: h.anim('saut'),
        poing: h.anim('poing'),
        pied: h.anim('pied'),
        garde: h.anim('garde'),
        touche: h.anim('touche'),
        ko: h.anim('ko'),
      };
    });
    verifier(
      'E13',
      'Mouvements des combattants : marche, saut, poing, pied, garde, touché, K.O.',
      e13.marche.ok &&
        e13.marche.pose === 'marche-avant' &&
        e13.saut.pose === 'saut' &&
        e13.poing.pose === 'poing' &&
        e13.pied.pose === 'pied' &&
        e13.garde.pose === 'garde-defense' &&
        e13.touche.pose === 'touche' &&
        e13.ko.pose === 'touche',
      `marche=${e13.marche.pose} saut=${e13.saut.pose} poing=${e13.poing.pose} pied=${e13.pied.pose} garde=${e13.garde.pose} touche=${e13.touche.pose} ko=${e13.ko.pose}`
    );

    // ---------------------------------------------------------- E14
    // Déplacement de l'attaquant sur un coup BLOQUÉ (solde = 0) : il s'approche
    // de l'adversaire, donne son coup, puis **revient à sa position d'origine**.
    await relancer();
    await lancerCombat();
    // séquence attaque → défense séparée : rythme DIFFÉRÉ explicite
    await page.evaluate(() => window.__mathkombat.setRythme('differe'));
    await attendre(300);
    // attaque = défense exactement → blocage (§2.4)
    await page.evaluate(() => {
      window.__mathkombat.forcerEnergieAttaque(6);
      window.__mathkombat.forcerEnergieDefense(6);
    });
    const e14Depart = await page.evaluate(() => window.__mathkombat.positions());
    // on suit les positions pendant la résolution (aller-retour de l'attaquant)
    await page.evaluate(() => {
      window.__suivi = [];
      window.__h = setInterval(() => window.__suivi.push(window.__mathkombat.positions()), 60);
      window.__mathkombat.forceFinDePhase(); // fin attaque → défense IA
    });
    await attendre(400);
    await page.evaluate(() => {
      window.__mathkombat.forcerEnergieDefense(6);
      window.__mathkombat.forceFinDePhase(); // fin défense → résolution (blocage)
    });
    await attendre(1600);
    const e14 = await page.evaluate(() => {
      clearInterval(window.__h);
      const s = window.__suivi;
      return {
        depart: window.__mathkombat.positions(),
        min: Math.min(...s.map((p) => p.j1)),
        max: Math.max(...s.map((p) => p.j1)),
        journal: window.__mathkombat.journal().slice(0, 3),
      };
    });
    verifier(
      'E14',
      "Coup bloqué : l'attaquant s'approche (déplacement) puis revient à sa position",
      e14.max > e14Depart.j1 + 40 && Math.abs(e14.depart.j1 - e14Depart.j1) < 6,
      `départ=${e14Depart.j1} min=${e14.min} max=${e14.max} retour=${e14.depart.j1} journal=${JSON.stringify(e14.journal)}`
    );

    // ---------------------------------------------------------- E15
    // Saut composé (§2.8c) : (rester | avancer | reculer) ET/OU
    // (donner un coup | faire un contre) — exclusif dans chaque famille.
    await relancer();
    await lancerCombat();
    const e15 = await page.evaluate(async () => {
      const h = window.__mathkombat;
      const p0 = h.positions().j1;
      h.saut({ deplacement: 'avant' }); // déplacement seul
      await new Promise((r) => setTimeout(r, 450));
      const pAvant = h.positions().j1;
      h.saut({ deplacement: 'arriere' });
      await new Promise((r) => setTimeout(r, 700));
      const pArriere = h.positions().j1;
      h.saut({ action: 'coup' }); // action seule (coup sauté au sommet)
      await new Promise((r) => setTimeout(r, 300));
      const poseCoup = h.coups().poses.j1;
      h.saut({ deplacement: 'avant', action: 'contre' }); // combinaison
      await new Promise((r) => setTimeout(r, 450));
      const poseContre = h.coups().poses.j1;
      return { p0, pAvant, pArriere, poseCoup, poseContre };
    });
    verifier(
      'E15',
      'Saut composé : (place|avant|arrière) et/ou (coup|contre)',
      e15.pAvant > e15.p0 &&
        e15.pArriere < e15.pAvant &&
        e15.poseCoup === 'pied' &&
        e15.poseContre === 'pied',
      `déplacements ${e15.p0} → ${e15.pAvant} → ${e15.pArriere} · pose coup=${e15.poseCoup} contre=${e15.poseContre}`
    );

    // ---------------------------------------------------------- E16
    // Profondeur (zoom) : déplacement vers le bas = zoom +, vers le haut = zoom − ;
    // et manœuvres à distance pendant le chrono (feintes, sans contact).
    await relancer();
    await lancerCombat();
    const e16 = await page.evaluate(async () => {
      const h = window.__mathkombat;
      const e0 = h.profondeurs().j1;
      h.anim('monter'); // vers le haut → zoom −
      await new Promise((r) => setTimeout(r, 250));
      const eHaut = h.profondeurs().j1;
      h.anim('descendre'); // vers le bas → zoom +
      await new Promise((r) => setTimeout(r, 250));
      const eBas = h.profondeurs().j1;
      const m0 = h.manoeuvres();
      await new Promise((r) => setTimeout(r, 6000)); // le chrono tourne
      return { e0, eHaut, eBas, m0, m1: h.manoeuvres() };
    });
    verifier(
      'E16',
      'Profondeur (zoom haut/bas) et manœuvres à distance pendant le chrono',
      e16.eHaut < e16.e0 && e16.eBas > e16.eHaut && e16.m1 > e16.m0,
      `zoom: haut=${e16.eHaut} base=${e16.e0} bas=${e16.eBas} · manœuvres ${e16.m0} → ${e16.m1}`
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
    'Captures : `output/screenshots/e2e-01-combat.png`, `e2e-02-energie.png`, `e2e-03-resolution.png`, `e2e-04-frappe.png`, `e2e-05-ko.png`, `e2e-08-duel.png`',
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
