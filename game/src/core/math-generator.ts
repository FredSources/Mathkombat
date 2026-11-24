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
 *  - niveau = borne des deux facteurs (×, +) ou du fait sous-jacent (÷, −) ;
 *  - division toujours exacte (dividende = quotient × diviseur) ; soustraction
 *    toujours à résultat positif (a = b + c, fait sous-jacent (b, c)) ;
 *  - énoncé jamais deux fois de suite à la suite (même fait commutatif), sauf
 *    impossibilité (famille épuisée) ;
 *  - réponse unique, saisie libre (aucune proposition à générer).
 */
import type { ConfigJeu, Difficulte, Fait, Niveau, TypeOperation } from './config.ts';
import { CONFIG, cleFait } from './config.ts';

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
 * Couleur du fait (§2.5) : 🟠 si le fait est dans la famille **difficile**
 * (les 5 résistants + les durs + la table 12 dure) ou si c'est le **repli
 * Débutant** ; 🟢 si le fait est dans la famille **facile** (table 11, 12×1,
 * 12×2) ou si un facteur est vert ; 🟡 si le fait est dans la famille **moyen**
 * (reste de la table 12, 11×11) ou si un facteur est jaune ; 🟠 par défaut.
 */
export function classerFait(
  a: number,
  b: number,
  config: ConfigJeu = CONFIG,
  niveau?: Niveau
): Difficulte {
  // repli Débutant (§2.5) : sous la borne 5, les faits du repli sont DIFFICILES
  if (niveau === 'debutant' && dansFamille(config.familles.repliDebutant, a, b)) {
    return 'difficile';
  }
  if (dansFamille(config.familles.difficile, a, b)) return 'difficile';
  if (dansFamille(config.familles.facile, a, b)) return 'facile';
  // famille « moyen » AVANT la règle verte : 12×5, 12×10 (table 12) sont moyens
  if (dansFamille(config.familles.moyen, a, b)) return 'moyen';
  if (config.familles.vert.includes(a) || config.familles.vert.includes(b)) return 'facile';
  if (config.familles.jaune.includes(a) || config.familles.jaune.includes(b)) return 'moyen';
  return 'difficile';
}

/** Un fait appartient-il à la liste ? (insensible à l'ordre des facteurs) */
function dansFamille(liste: readonly Fait[], a: number, b: number): boolean {
  return liste.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Pool de faits générables pour (difficulté, niveau) — paires ordonnées
 * (table, second facteur) avec **les deux facteurs** ≤ borne du niveau
 * (§2.5 : Intermédiaire = tables 1–10, Avancé = 1–12, Débutant = 1–5).
 *
 * Pour « difficile » : les faits difficiles dès qu'ils sont possibles, sinon le
 * **repli Débutant** (familles.repliDebutant).
 */
export function poolFaits(
  difficulte: Difficulte,
  niveau: Niveau,
  config: ConfigJeu = CONFIG
): Fait[] {
  const borne = config.bornesNiveau[niveau];
  const pool: Fait[] = [];
  for (let table = 1; table <= borne; table++) {
    for (let second = 1; second <= borne; second++) {
      if (classerFait(table, second, config, niveau) === difficulte) pool.push([table, second]);
    }
  }
  if (pool.length === 0) {
    // Repli (§2.5) : au Débutant, « moyen » et « difficile » tirent dans le même
    // ensemble — le repli (3×3, 3×4, 4×4), seuls faits « sans table verte ».
    return config.familles.repliDebutant.filter(([t, s]) => t <= borne && s <= borne);
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

  /**
   * Tirage d'un fait pour (opération, difficulté, niveau) — pool partagé par
   * les quatre opérations, classé par `classerFait` (§2.5). Non-répétition du
   * fait sous-jacent, y compris sous forme commutative.
   */
  private tirerFait(operation: TypeOperation, difficulte: Difficulte, niveau: Niveau): Fait {
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
    const fait = this.tirer(candidats.length > 0 ? candidats : pool);
    this.derniersFaits.set(`${operation}:${difficulte}`, cleFait(fait[0], fait[1]));
    return fait;
  }

  /** Nouvelle question ; jamais le même fait deux fois de suite (sauf impossibilité). */
  nouvelleQuestion(
    operation: TypeOperation,
    difficulte: Difficulte,
    niveau: Niveau
  ): Question {
    const commun = { operation, difficulte, niveau, gain: this.config.gains[difficulte] };

    switch (operation) {
      case 'multiplication': {
        const [table, second] = this.tirerFait(operation, difficulte, niveau);
        return {
          ...commun,
          enonce: `${table} × ${second}`,
          reponse: table * second,
          fait: [table, second],
        };
      }
      case 'division': {
        // (diviseur, quotient) ≤ borne → dividende exact = diviseur × quotient
        const [diviseur, quotient] = this.tirerFait(operation, difficulte, niveau);
        return {
          ...commun,
          enonce: `${diviseur * quotient} ÷ ${diviseur}`,
          reponse: quotient,
          fait: [diviseur, quotient],
        };
      }
      case 'addition': {
        const [a, b] = this.tirerFait(operation, difficulte, niveau);
        return { ...commun, enonce: `${a} + ${b}`, reponse: a + b, fait: [a, b] };
      }
      case 'soustraction': {
        // fait sous-jacent (b, c) = (soustrait, reste) ≤ borne ;
        // a = b + c → énoncé a − b = c, résultat toujours ≥ 1
        const [soustrait, reste] = this.tirerFait(operation, difficulte, niveau);
        return {
          ...commun,
          enonce: `${soustrait + reste} − ${soustrait}`,
          reponse: reste,
          fait: [soustrait, reste],
        };
      }
      default:
        throw new Error(`Opération ${operation} non supportée`);
    }
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
