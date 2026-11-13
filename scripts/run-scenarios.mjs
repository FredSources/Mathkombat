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
          const ok = table >= 1 && table <= 12 && second >= 1 && second <= borne;
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
    sc.type === 'generation' ? jouerGeneration(sc) : sc.type === 'energie' ? jouerEnergie(sc) : (process.stderr.write(`Type inconnu : ${sc.type}\n`), process.exit(1));
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
