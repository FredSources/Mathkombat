/**
 * core/math-generator.ts — générateur de calculs (AGENTS.md §2.5).
 *
 * Pur : pas d'I/O, pas de DOM, pas de logger — testable directement (AGENTS.md §6).
 *
 * Règles implémentées :
 *  - difficulté = couleur du fait (table la PLUS FACILE des deux facteurs,
 *    commutativité : 2×7 est un fait « × 2 » 🟢) ; les 5 faits résistants sont
 *    forcés 🟠 ; repli Débutant (3×3, 3×4, 4×4) quand les résistants sont
 *    impossibles à la borne du niveau ;
 *  - niveau = borne du second facteur (×) et du quotient (÷) ;
 *  - division toujours exacte (dividende = quotient × diviseur) ;
 *  - énoncé jamais deux fois de suite à la suite (même fait commutatif), sauf
 *    impossibilité (famille épuisée) ;
 *  - réponse unique, saisie libre (aucune proposition à générer).
 */
import type { ConfigJeu, Difficulte, Fait, Niveau, TypeOperation } from './config.ts';
import { CONFIG, cleFait, estResistant } from './config.ts';

export interface Question {
  operation: TypeOperation;
  difficulte: Difficulte;
  niveau: Niveau;
  /** Énoncé affiché, ex. « 6 × 7 » ou « 42 ÷ 6 ». */
  enonce: string;
  /** Réponse attendue (entier, 0–144). */
  reponse: number;
  /** Gain si résolu (CONFIG.gains[difficulte]). */
  gain: number;
  /** Fait sous-jacent (insensible à la commutativité pour la non-répétition). */
  fait: Fait;
}

// ---------------------------------------------------------------- classement des faits

/**
 * Couleur du fait (§2.5) : 🟢 si un facteur est vert, 🟡 sinon si un facteur est
 * jaune, 🟠 si résistant (forcé) — sinon 🟠 (les deux facteurs sont « durs »).
 */
export function classerFait(a: number, b: number, config: ConfigJeu = CONFIG): Difficulte {
  if (estResistant(a, b, config)) return 'difficile';
  if (config.familles.vert.includes(a) || config.familles.vert.includes(b)) return 'facile';
  if (config.familles.jaune.includes(a) || config.familles.jaune.includes(b)) return 'moyen';
  return 'difficile';
}

/**
 * Pool de faits générables pour (difficulté, niveau) — paires ordonnées
 * (table, second facteur) avec second facteur ≤ borne du niveau.
 *
 * Pour « difficile » : les faits résistants dès qu'ils sont possibles, sinon le
 * **repli Débutant** (familles.repliDebutant).
 */
export function poolFaits(
  difficulte: Difficulte,
  niveau: Niveau,
  config: ConfigJeu = CONFIG
): Fait[] {
  const borne = config.bornesNiveau[niveau];
  const pool: Fait[] = [];
  for (let table = 1; table <= 12; table++) {
    for (let second = 1; second <= borne; second++) {
      if (classerFait(table, second, config) === difficulte) pool.push([table, second]);
    }
  }
  if (difficulte === 'difficile' && pool.length === 0) {
    // Repli Débutant : les faits les plus durs disponibles sous la borne
    return config.familles.repliDebutant.filter(([, s]) => s <= borne);
  }
  return pool;
}

// ---------------------------------------------------------------- générateur

export class GenerateurMath {
  /** Dernier fait émis par (opération, difficulté) — pour la non-répétition. */
  private derniersFaits = new Map<string, string>();
  private readonly config: ConfigJeu;
  private readonly aleatoire: () => number;

  constructor(config: ConfigJeu = CONFIG, aleatoire: () => number = Math.random) {
    this.config = config;
    this.aleatoire = aleatoire;
  }

  private tirer<T>(elements: readonly T[]): T {
    return elements[Math.floor(this.aleatoire() * elements.length)];
  }

  /** Nouvelle question ; jamais le même fait deux fois de suite (sauf impossibilité). */
  nouvelleQuestion(
    operation: TypeOperation,
    difficulte: Difficulte,
    niveau: Niveau
  ): Question {
    if (operation !== 'multiplication' && operation !== 'division') {
      throw new Error(`Opération non implémentée en v1 : ${operation} (I14)`);
    }
    const pool = poolFaits(difficulte, niveau, this.config);
    if (pool.length === 0) {
      throw new Error(`Pool vide : ${difficulte} / ${niveau}`);
    }
    const clePrecedente = this.derniersFaits.get(`${operation}:${difficulte}`);
    // Non-répétition : on retire le dernier fait du tirage si le pool le permet
    const candidats =
      pool.length > 1
        ? pool.filter(([t, s]) => cleFait(t, s) !== clePrecedente)
        : pool;
    const [table, second] = this.tirer(candidats.length > 0 ? candidats : pool);
    this.derniersFaits.set(`${operation}:${difficulte}`, cleFait(table, second));

    const produit = table * second;
    const enonce =
      operation === 'multiplication' ? `${table} × ${second}` : `${produit} ÷ ${table}`;
    return {
      operation,
      difficulte,
      niveau,
      enonce,
      reponse: operation === 'multiplication' ? produit : second,
      gain: this.config.gains[difficulte],
      fait: [table, second],
    };
  }
}

// ---------------------------------------------------------------- évaluation

/** Une saisie n'est évaluée qu'à la validation (null/undefined = pas évaluée). */
export function evaluerReponse(q: Question, saisie: number | null | undefined): boolean {
  return typeof saisie === 'number' && Number.isInteger(saisie) && saisie === q.reponse;
}

/** Gain obtenu : le gain du calcul si résolu, 0 sinon (I3, I4). */
export function gainObtenu(q: Question, correct: boolean): number {
  return correct ? q.gain : 0;
}

/** Énergie d'une phase = somme des gains des calculs résolus (I3). */
export function energiePhase(gainsObtenus: readonly number[]): number {
  return gainsObtenus.reduce((somme, g) => somme + g, 0);
}
