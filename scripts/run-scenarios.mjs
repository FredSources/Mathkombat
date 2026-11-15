#!/usr/bin/env node
/**
 * scripts/run-scenarios.mjs — exécuteur de scénarios headless (L2, docs/test-plan.md).
 *
 * Joue les scénarios de `game/tests/scenarios/*.json` contre le cœur pur du jeu
 * (import TypeScript direct, sans build — Node type-stripping), vérifie les
 * oracles et écrit un rapport dans `output/reports/scenarios-<horodatage>.md`.
 *
 * Usage : node scripts/run-scenarios.mjs [filtre-id]   ex. : node scripts/run-scenarios.mjs S01
 * Sortie : code 0 = tout vert ; 1 = au moins un échec.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GenerateurMath,
  classerFait,
  energiePhase,
  evaluerReponse,
  gainObtenu,
  poolFaits,
} from '../game/src/core/math-generator.ts';
import { CONFIG, cleFait, estResistant } from '../game/src/core/config.ts';
import {
  CombatEngine,
  PhaseCalcul,
  resoudreCoup,
} from '../game/src/core/combat-engine.ts';
import { AiController } from '../game/src/core/ai-controller.ts';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR_SCENARIOS = path.join(PROJ, 'game', 'tests', 'scenarios');
const DIR_RAPPORTS = path.join(PROJ, 'output', 'reports');

// Générateur pseudo-aléatoire déterministe (reproductibilité des scénarios)
function alea(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NIVEAUX = ['debutant', 'intermediaire', 'avance'];
const DIFFICULTES = ['facile', 'moyen', 'difficile'];

// ---------------------------------------------------------------- scénario « generation »

function jouerGeneration(sc) {
  const verdicts = [];
  const gen = new GenerateurMath(CONFIG, alea(sc.graine ?? 1));
  const operation = sc.operation;
  const tirages = sc.tirages ?? 300;
  const details = [];

  for (const niveau of NIVEAUX) {
    for (const difficulte of DIFFICULTES) {
      let precedent = '';
      for (let i = 0; i < tirages; i++) {
        const q = gen.nouvelleQuestion(operation, difficulte, niveau);
        const [table, second] = q.fait;
        const borne = CONFIG.bornesNiveau[niveau];

        if (sc.oracles.includes('I6')) {
          const ok = table >= 1 && table <= borne && second >= 1 && second <= borne;
          if (!ok) details.push(`I6 ✗ ${q.enonce} hors borne ${niveau} (≤ ${borne})`);
          verdicts.push({ oracle: 'I6', ok });
        }
        if (sc.oracles.includes('I7') && operation === 'division') {
          const dividende = table * second;
          const ok = dividende % table === 0 && q.reponse === dividende / table;
          if (!ok) details.push(`I7 ✗ ${q.enonce} inexacte`);
          verdicts.push({ oracle: 'I7', ok });
        }
        if (sc.oracles.includes('I11')) {
          const repliDebutant =
            difficulte === 'difficile' &&
            niveau === 'debutant' &&
            !estResistant(table, second);
          const ok = repliDebutant || classerFait(table, second) === difficulte;
          if (!ok) details.push(`I11 ✗ ${q.enonce} classé ${classerFait(table, second)} ≠ ${difficulte}`);
          verdicts.push({ oracle: 'I11', ok });
        }
        if (sc.oracles.includes('non-repetition')) {
          const cle = cleFait(table, second);
          const ok = poolFaits(difficulte, niveau).length <= 1 || cle !== precedent;
          if (!ok) details.push(`non-répétition ✗ ${q.enonce} = précédent (${niveau}/${difficulte})`);
          verdicts.push({ oracle: 'non-repetition', ok });
          precedent = cle;
        }
      }
    }
  }
  return { verdicts, details };
}

// ---------------------------------------------------------------- scénario « energie »

function jouerEnergie(sc) {
  const verdicts = [];
  const details = [];
  const gen = new GenerateurMath(CONFIG, alea(sc.graine ?? 1));
  const gains = [];

  for (const etape of sc.sequence) {
    const q = gen.nouvelleQuestion(etape.operation, etape.difficulte, etape.niveau);
    const gain = gainObtenu(q, etape.resolu);
    gains.push(gain);
    if (sc.oracles.includes('I4')) {
      const attendu = etape.resolu ? CONFIG.gains[etape.difficulte] : 0;
      const ok = gain === attendu;
      if (!ok) details.push(`I4 ✗ ${q.enonce} (${etape.difficulte}) : gain ${gain} ≠ ${attendu}`);
      verdicts.push({ oracle: 'I4', ok });
    }
    // exercice complet de la chaîne d'évaluation (saisie validée ou non)
    const evalue = evaluerReponse(q, etape.resolu ? q.reponse : q.reponse + 1);
    if (evalue !== etape.resolu) {
      details.push(`évaluation ✗ ${q.enonce}`);
      verdicts.push({ oracle: 'I3', ok: false });
    }
  }

  if (sc.oracles.includes('I3')) {
    const total = energiePhase(gains);
    const ok = total === sc.energieAttendue;
    if (!ok) details.push(`I3 ✗ énergie ${total} ≠ ${sc.energieAttendue}`);
    verdicts.push({ oracle: 'I3', ok });
  }
  return { verdicts, details };
}

// ---------------------------------------------------------------- scénario « resolution »

function jouerResolution(sc) {
  const verdicts = [];
  const details = [];
  for (const cas of sc.cas) {
    const r = resoudreCoup(cas.attaque, cas.defense);
    const attendus = {
      solde: cas.solde,
      degats: cas.degats,
      sur: cas.sur,
      contre: cas.contre,
    };
    for (const [cle, attendu] of Object.entries(attendus)) {
      const ok = r[cle] === attendu;
      if (!ok) details.push(`${sc.oracles[0]} ✗ ${cas.attaque} vs ${cas.defense} : ${cle} = ${r[cle]} ≠ ${attendu}`);
      verdicts.push({ oracle: sc.oracles.includes('I1') ? 'I1' : 'I2', ok });
    }
  }
  return { verdicts, details };
}

// ---------------------------------------------------------------- scénario « phase »

function jouerPhase(sc) {
  const verdicts = [];
  const details = [];
  const gen = new GenerateurMath(CONFIG, alea(sc.graine ?? 1));
  const phase = new PhaseCalcul(sc.operation, sc.niveau, gen);

  for (const etape of sc.etapes) {
    const avant = {
      facile: phase.question('facile'),
      moyen: phase.question('moyen'),
      difficile: phase.question('difficile'),
    };
    const cible = avant[etape.difficulte];
    const saisie = etape.saisie === 'bonne' ? cible.reponse : cible.reponse + 1;
    const res = phase.resoudre(etape.difficulte, saisie);

    if (sc.oracles.includes('I4')) {
      const ok = res.gain === etape.gain && res.correct === (etape.saisie === 'bonne');
      if (!ok) details.push(`I4 ✗ ${etape.difficulte}/${etape.saisie} : gain ${res.gain} ≠ ${etape.gain}`);
      verdicts.push({ oracle: 'I4', ok });
    }
    if (sc.oracles.includes('I12')) {
      for (const d of ['facile', 'moyen', 'difficile']) {
        const remplace = phase.question(d) !== avant[d];
        const attendu = etape.remplace === d;
        const ok = remplace === attendu;
        if (!ok) details.push(`I12 ✗ calcul ${d} ${remplace ? 'remplacé' : 'conservé'} (attendu : ${etape.remplace})`);
        verdicts.push({ oracle: 'I12', ok });
      }
    }
  }

  if (sc.oracles.includes('I3') || sc.energieAttendue !== undefined) {
    const ok = phase.energie() === sc.energieAttendue;
    if (!ok) details.push(`énergie de phase ${phase.energie()} ≠ ${sc.energieAttendue}`);
    verdicts.push({ oracle: 'I3', ok });
  }
  return { verdicts, details };
}

// ---------------------------------------------------------------- scénario « combat »

const DOMAINES = new Set(['math', 'combat', 'ia', 'ui', 'anim', 'session', 'erreur']);

function jouerCombat(sc) {
  const verdicts = [];
  const details = [];
  const trace = [];
  const engine = new CombatEngine({
    niveaux: sc.niveaux,
    aleatoire: alea(sc.graine ?? 1),
    emettre: (e) => trace.push(e),
  });

  let attaquantPrecedent = null;
  for (const script of sc.tours) {
    const tour = engine.demarrerTour();

    if (sc.oracles.includes('alternance')) {
      const ok = attaquantPrecedent === null || tour.attaquant !== attaquantPrecedent;
      if (!ok) details.push(`alternance ✗ tour ${tour.numero} : ${tour.attaquant} attaque deux fois`);
      verdicts.push({ oracle: 'alternance', ok });
      attaquantPrecedent = tour.attaquant;
    }

    const pvAvant = { ...engine.etat.pv };
    const r = engine.resoudreTour(tour, script.attaque, script.defense);

    if (sc.oracles.includes('I5')) {
      const cible = r.sur === 'defenseur' ? tour.defenseur : tour.attaquant;
      const attendu = r.sur === 'aucun' ? pvAvant[cible] : Math.max(0, pvAvant[cible] - r.degats);
      const koAttendu = engine.etat.pv.j1 === 0 || engine.etat.pv.j2 === 0;
      const ok =
        engine.etat.pv[cible] === attendu &&
        engine.etat.pv.j1 >= 0 &&
        engine.etat.pv.j2 >= 0 &&
        r.ko === koAttendu;
      if (!ok) details.push(`I5 ✗ tour ${tour.numero} : PV incohérents ${JSON.stringify(engine.etat.pv)}`);
      verdicts.push({ oracle: 'I5', ok });
    }
  }

  if (sc.oracles.includes('ko-unique')) {
    const kos = trace.filter((e) => e.event === 'combat.ko');
    let apresKo = false;
    try {
      engine.demarrerTour();
    } catch {
      apresKo = true;
    }
    const ok = kos.length === 1 && engine.etat.fini && apresKo && trace[trace.length - 1].event === 'combat.ko';
    if (!ok) details.push(`ko-unique ✗ ${kos.length} événement(s) ko, fini=${engine.etat.fini}`);
    verdicts.push({ oracle: 'ko-unique', ok });
  }

  if (sc.oracles.includes('I15')) {
    const phases = trace.filter((e) => e.event === 'combat.phase');
    const rythme = CONFIG.rythme;
    const ok =
      rythme === 'simultane'
        ? phases.length === sc.tours.length && phases.every((e) => e.data.chronoUnique === true)
        : phases.length === 2 * sc.tours.length &&
          phases.every((e) => e.data.duree === CONFIG.tempsPhase);
    if (!ok) details.push(`I15 ✗ ${phases.length} événement(s) phase pour ${sc.tours.length} tour(s), rythme ${rythme}`);
    verdicts.push({ oracle: 'I15', ok });
  }

  if (sc.oracles.includes('trace')) {
    for (const e of trace) {
      const [domaine] = e.event.split('.');
      const formeOk = /^[a-z]+\.[a-z0-9_]+$/.test(e.event) && DOMAINES.has(domaine);
      if (!formeOk) details.push(`trace ✗ événement hors nomenclature : ${e.event}`);
      verdicts.push({ oracle: 'trace', ok: formeOk });

      if (e.event === 'combat.coup_resolu') {
        const champsOk = ['attaque', 'defense', 'solde', 'contre'].every((c) => c in e.data);
        if (!champsOk) details.push(`trace ✗ coup_resolu sans champs obligatoires`);
        verdicts.push({ oracle: 'trace', ok: champsOk });
      }
    }
  }

  return { verdicts, details };
}

// ---------------------------------------------------------------- scénario « ia »

function jouerIA(sc) {
  const verdicts = [];
  const details = [];
  const tirages = sc.tirages ?? 200;

  for (const difficulte of ['facile', 'moyen', 'difficile']) {
    const ia = new AiController(CONFIG, alea(sc.graine ?? 1));
    const decisions = [];
    let graine = 1;
    while (decisions.length < tirages) {
      const phase = new PhaseCalcul('division', 'avance', new GenerateurMath(CONFIG, alea(graine++)));
      decisions.push(...ia.jouerPhase(phase, difficulte, 0));
    }
    const echantillon = decisions.slice(0, tirages);
    const taux = echantillon.filter((d) => d.correct).length / tirages;
    const cible = CONFIG.ia.tauxReussite[difficulte];
    const ok = Math.abs(taux - cible) <= 0.1;
    if (!ok) details.push(`I16 ✗ IA ${difficulte} : taux ${taux.toFixed(2)} hors ±10 pts de ${cible}`);
    verdicts.push({ oracle: 'I16', ok });

    // plafond de tentatives (I16)
    const plafond = Math.floor(
      (CONFIG.tempsPhase / CONFIG.cadenceHumaineReference) * CONFIG.ia.rendementMax
    );
    for (const d of decisions) void d;
    const okPlafond = ia.tentativesMax(0) <= plafond;
    if (!okPlafond) details.push(`I16 ✗ tentativesMax ${ia.tentativesMax(0)} > plafond ${plafond}`);
    verdicts.push({ oracle: 'I16', ok: okPlafond });
  }
  return { verdicts, details };
}

// ---------------------------------------------------------------- orchestration

const filtre = process.argv[2] ?? null;
const fichiers = fs
  .readdirSync(DIR_SCENARIOS)
  .filter((f) => f.endsWith('.json') && (!filtre || f.startsWith(filtre)))
  .sort();

if (fichiers.length === 0) {
  console.error(`Aucun scénario trouvé dans ${DIR_SCENARIOS} (filtre : ${filtre ?? 'aucun'})`);
  process.exit(1);
}

fs.mkdirSync(DIR_RAPPORTS, { recursive: true });
const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const lignesRapport = [
  `# Rapport de scénarios — ${horodatage}`,
  '',
  `Config : bornes ${JSON.stringify(CONFIG.bornesNiveau)} · gains ${JSON.stringify(CONFIG.gains)}`,
  '',
  '| Scénario | Type | Oracles | Verdict |',
  '|----------|------|---------|---------|',
];

let echecs = 0;

for (const fichier of fichiers) {
  const sc = JSON.parse(fs.readFileSync(path.join(DIR_SCENARIOS, fichier), 'utf8'));
  const debut = Date.now();
  const { verdicts, details } =
    sc.type === 'generation'
      ? jouerGeneration(sc)
      : sc.type === 'energie'
        ? jouerEnergie(sc)
        : sc.type === 'resolution'
          ? jouerResolution(sc)
          : sc.type === 'phase'
            ? jouerPhase(sc)
            : sc.type === 'ia'
              ? jouerIA(sc)
              : sc.type === 'combat'
              ? jouerCombat(sc)
              : (process.stderr.write(`Type inconnu : ${sc.type}\n`), process.exit(1));
  const duree = Date.now() - debut;

  const parOracle = new Map();
  for (const v of verdicts) {
    const e = parOracle.get(v.oracle) ?? { ok: 0, ko: 0 };
    v.ok ? e.ok++ : e.ko++;
    parOracle.set(v.oracle, e);
  }
  const ok = [...parOracle.values()].every((e) => e.ko === 0);
  if (!ok) echecs++;

  const resume = [...parOracle.entries()]
    .map(([o, e]) => `${o}: ${e.ok}/${e.ok + e.ko}`)
    .join(' · ');
  console.log(
    `${ok ? '\x1b[1;32m[PASS]\x1b[0m' : '\x1b[1;31m[FAIL]\x1b[0m'} ${sc.id} — ${sc.titre} (${duree} ms)`
  );
  console.log(`        ${resume}`);
  for (const d of details.slice(0, 10)) console.log(`        ${d}`);

  lignesRapport.push(
    `| ${sc.id} | ${sc.type} | ${sc.oracles.join(', ')} | ${ok ? '✅ PASS' : '❌ FAIL'} — ${resume} |`
  );
}

lignesRapport.push('', `**Verdict global** : ${echecs === 0 ? '✅ TOUT VERT' : `❌ ${echecs} scénario(s) en échec`}`, '');
const rapport = path.join(DIR_RAPPORTS, `scenarios-${horodatage}.md`);
fs.writeFileSync(rapport, lignesRapport.join('\n'));
console.log(`\nRapport : ${path.relative(PROJ, rapport)}`);
process.exit(echecs === 0 ? 0 : 1);
