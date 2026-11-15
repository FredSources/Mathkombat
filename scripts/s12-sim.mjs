#!/usr/bin/env node
/**
 * scripts/s12-sim.mjs — calibration S12 « Winnability » (docs/test-plan.md).
 *
 * Monte Carlo de combats complets **joueur de référence vs IA**, joués sur le
 * cœur réel (`CombatEngine` + `AiController` + `PhaseCalcul`) — aucune logique
 * de jeu n'est dupliquée.
 *
 * Profil « joueur de référence » (AGENTS.md §2.9) :
 *  - **temps des calculs** : `tempsParCalcul` (2 s) → `tempsPhase / 2`
 *    tentatives par phase de 15 s (7) ;
 *  - réussite : **85 %** par tentative ;
 *  - choix de difficulté : **uniforme** entre les 3 calculs affichés (profil
 *    neutre, sans stratégie de gain) ; gain obtenu selon la difficulté.
 *
 * Le niveau d'IA indique son **score moyen** (attaque/défense, §2.6) — la
 * recherche cale `ia.scoreMoyen` pour atteindre les taux cibles 80/50/30 %.
 *
 * Usage :
 *   node scripts/s12-sim.mjs              # mesure avec la config courante
 *   node scripts/s12-sim.mjs --fights 400 # plus de combats par point
 *   node scripts/s12-sim.mjs --search     # recherche des scoreMoyen cibles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CombatEngine } from '../game/src/core/combat-engine.ts';
import { AiController } from '../game/src/core/ai-controller.ts';
import { CONFIG } from '../game/src/core/config.ts';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR_RAPPORTS = path.join(PROJ, 'output', 'reports');

const DIFFICULTES = ['facile', 'moyen', 'difficile'];
/** Cibles S12 (§2.6) : taux de victoires humaines par niveau d'IA. */
const CIBLES = { facile: 0.8, moyen: 0.5, difficile: 0.3 };
/** Tolérance du plan de test : ±15 points. */
const TOLERANCE = 0.15;

// --------------------------------------------------------------- aléatoire

/** mulberry32 — PRNG déterministe (reproductibilité des runs). */
function mulberry(graine) {
  let seed = graine | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------- joueur de référence

/**
 * Joue une phase complète comme le joueur de référence : `tentatives`
 * tentatives (temps des calculs : 1 toutes les `tempsParCalcul` s), réussite
 * `reussite`, choix de difficulté uniforme. Écrit dans la PhaseCalcul réelle.
 */
function jouerPhaseHumaine(phase, config, alea, profil) {
  for (let i = 0; i < profil.tentatives; i++) {
    const difficulte = DIFFICULTES[Math.floor(alea() * 3)];
    const q = phase.question(difficulte);
    const correct = alea() < profil.reussite;
    phase.resoudre(difficulte, correct ? q.reponse : q.reponse + 1);
  }
}

/** Profil de référence : 1 calcul / tempsParCalcul s, 85 % de réussite. */
function profilReference(config) {
  return {
    tentatives: Math.floor(config.tempsPhase / config.tempsParCalcul),
    reussite: 0.85,
  };
}

// --------------------------------------------------------------- simulation de combat

/**
 * Un combat complet (SIMULTANÉ, §2.1) : humain = j1, IA = j2.
 * @returns true si l'humain l'emporte.
 */
function simulerCombat(config, niveauIA, graine) {
  const alea = mulberry(graine);
  const engine = new CombatEngine({
    config,
    aleatoire: alea,
    niveaux: { j1: config.niveau, j2: config.niveau },
  });
  const ia = new AiController(config, alea);
  const profil = profilReference(config);

  let tours = 0;
  while (!engine.etat.fini && tours < 400) {
    const tour = engine.demarrerTour();
    const humainAttaque = tour.attaquant === 'j1';
    const phaseHumain = humainAttaque ? tour.phaseAttaque : tour.phaseDefense;
    const phaseIA = humainAttaque ? tour.phaseDefense : tour.phaseAttaque;

    jouerPhaseHumaine(phaseHumain, config, alea, profil);
    const iaDominanteDe = Math.max(0, engine.etat.pv.j2 - engine.etat.pv.j1);
    ia.jouerPhase(phaseIA, niveauIA, iaDominanteDe);

    engine.resoudreTour(tour);
    tours++;
  }
  return engine.etat.gagnant === 'j1';
}

/**
 * Taux de victoires humaines sur `combats` combats contre une difficulté d'IA.
 */
export function tauxVictoires(config, niveauIA, combats = 200, graine = 20261115) {
  let victoires = 0;
  for (let i = 0; i < combats; i++) {
    if (simulerCombat(config, niveauIA, graine + i * 7919)) victoires++;
  }
  return victoires / combats;
}

// --------------------------------------------------------------- CLI

function argumentsCLI() {
  const argv = process.argv.slice(2);
  const options = { combats: 200, recherche: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fights' || argv[i] === '--combats') options.combats = Number(argv[++i]);
    if (argv[i] === '--search') options.recherche = true;
  }
  return options;
}

/** Copie de config avec `ia.scoreMoyen` surchargé (recherche de calibration). */
function configAvecScore(scoreParNiveau) {
  return {
    ...CONFIG,
    ia: { ...CONFIG.ia, scoreMoyen: { ...CONFIG.ia.scoreMoyen, ...scoreParNiveau } },
  };
}

function mesurer(options) {
  const lignes = [];
  for (const niveau of DIFFICULTES) {
    const taux = tauxVictoires(CONFIG, niveau, options.combats);
    const cible = CIBLES[niveau];
    const ok = Math.abs(taux - cible) <= TOLERANCE;
    lignes.push({ niveau, taux, cible, ok });
  }
  return lignes;
}

/**
 * Recherche : pour chaque niveau d'IA, trouve le `scoreMoyen` qui donne le
 * taux de victoires humaines cible (dichotomie), les autres paramètres de la
 * config courante restant fixes.
 */
function rechercherScore(options) {
  const resultats = {};
  for (const niveau of DIFFICULTES) {
    const cible = CIBLES[niveau];
    // borne haute : score maximal permis par le temps des calculs
    const plafond =
      Math.floor(CONFIG.tempsPhase / CONFIG.tempsParCalcul) * CONFIG.gains.difficile;
    let bas = 0; // IA nulle → humain gagne ~toujours
    let haut = plafond; // IA parfaite → humain perd plus souvent
    let meilleur = null;
    for (let it = 0; it < 12; it++) {
      const milieu = (bas + haut) / 2;
      const cfg = configAvecScore({ [niveau]: milieu });
      const taux = tauxVictoires(cfg, niveau, options.combats);
      meilleur = { param: milieu, taux };
      // si l'humain gagne trop → l'IA doit être plus forte → monter le score
      if (taux > cible) bas = milieu;
      else haut = milieu;
    }
    resultats[niveau] = { ...meilleur, cible, ecart: Math.abs(meilleur.taux - cible) };
  }
  return resultats;
}

function rapport(lignes, options, extra = '') {
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fichier = path.join(DIR_RAPPORTS, `s12-${horodatage}.md`);
  fs.mkdirSync(DIR_RAPPORTS, { recursive: true });
  const profil = profilReference(CONFIG);
  const txt = [
    `# S12 — Winnability (calibrage IA)`,
    ``,
    `- combats par point : **${options.combats}** · profil joueur de référence :`,
    `  ${profil.tentatives} tentatives/phase (1 calcul / ${CONFIG.tempsParCalcul} s),`,
    `  réussite 85 %, choix de difficulté **uniforme**.`,
    `- le niveau d'IA indique son **score moyen** (attaque/défense, §2.6).`,
    `- cibles (§2.6) : Facile 80 % · Moyen 50 % · Difficile 30 % (±${TOLERANCE * 100} pts).`,
    ``,
    `| IA | taux humain | cible | verdict |`,
    `|----|------------|-------|---------|`,
    ...lignes.map((l) => `| ${l.niveau} | ${(l.taux * 100).toFixed(1)} % | ${(l.cible * 100).toFixed(0)} % | ${l.ok ? '✅' : '❌'} |`),
    extra,
  ].join('\n');
  fs.writeFileSync(fichier, txt);
  return fichier;
}

const options = argumentsCLI();
if (options.recherche) {
  const resultats = rechercherScore(options);
  const lignes = Object.entries(resultats).map(([niveau, r]) => ({
    niveau,
    taux: r.taux,
    cible: r.cible,
    ok: r.ecart <= TOLERANCE,
  }));
  const extra = [
    ``,
    `## ScoreMoyen trouvés (dichotomie, autres paramètres fixes)`,
    ``,
    `| IA | scoreMoyen | taux humain obtenu | écart cible |`,
    `|----|------------|--------------------|-------------|`,
    ...Object.entries(resultats).map(
      ([niveau, r]) =>
        `| ${niveau} | ${r.param.toFixed(1)} | ${(r.taux * 100).toFixed(1)} % | ±${(r.ecart * 100).toFixed(1)} pts |`
    ),
    ``,
    `Config IA retenue : \`scoreMoyen: { ${Object.entries(resultats)
      .map(([n, r]) => `${n}: ${Math.round(r.param)}`)
      .join(', ')} }\``,
  ].join('\n');
  const fichier = rapport(lignes, options, extra);
  console.log(extra);
  console.log(`\nRapport : ${fichier}`);
} else {
  const lignes = mesurer(options);
  for (const l of lignes) {
    console.log(
      `IA ${l.niveau.padEnd(11)} → humain ${(l.taux * 100).toFixed(1)} %  (cible ${(l.cible * 100).toFixed(0)} % ${l.ok ? '✅' : '❌'})`
    );
  }
  const fichier = rapport(lignes, options);
  console.log(`\nRapport : ${fichier}`);
}
