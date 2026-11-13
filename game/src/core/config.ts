/**
 * core/config.ts — TOUT l'équilibrage du jeu (AGENTS.md §2.9).
 *
 * Règle (AGENTS.md §2 / §7) : aucune constante magique ailleurs que dans ce fichier.
 * Ce module est **pur** (pas d'I/O, pas de logger) — testable directement.
 */

// ---------------------------------------------------------------- types

export type Difficulte = 'facile' | 'moyen' | 'difficile';
export type Niveau = 'debutant' | 'intermediaire' | 'avance';
export type Rythme = 'differe' | 'simultane';
/** v1 : multiplication + division seules ; addition/soustraction prévues (I14). */
export type TypeOperation = 'addition' | 'soustraction' | 'multiplication' | 'division';

export type Fait = readonly [number, number]; // fait sous-jacent (a, b) — non ordonné au sens de la commutativité

// ---------------------------------------------------------------- configuration

export interface ConfigJeu {
  /** PV par joueur (plage 10–999). */
  pvMax: number;
  /** Durée de phase en secondes — identique attaque/défense (plage 5–60). */
  tempsPhase: number;
  /** Rythme de calcul : 'differe' (défaut) ou 'simultane' (jamais auto-adapté). */
  rythme: Rythme;
  /** Gain d'énergie / de défense par difficulté (§2.2/§2.3). */
  gains: Record<Difficulte, number>;
  /** Borne du second facteur (×) et du quotient (÷) par niveau (§2.5). */
  bornesNiveau: Record<Niveau, number>;
  /**
   * Classement des faits (§2.5) : un fait prend la couleur de sa table la plus
   * facile (commutativité), les faits résistants étant forcés « difficile ».
   */
  familles: {
    /** 🟢 tables faciles : au moins un facteur de cette liste. */
    vert: readonly number[];
    /** 🟡 tables déductibles par astuce. */
    jaune: readonly number[];
    /** 🟠 les 5 faits résistants à mémoriser (forcés « difficile »). */
    resistants: readonly Fait[];
    /** 🟠 repli du niveau Débutant (résistants impossibles à la borne 5). */
    repliDebutant: readonly Fait[];
  };
  /** Plafond VISUEL de l'aura (l'énergie de jeu reste non plafonnée, I11). */
  energieVisuelleMax: number;
  /**
   * Alphas de l'aura par palier 0..3 (§2.8a). Calibrés pour un contraste
   * ≥ 3:1 sur le décor (WCAG 1.4.11 — objets graphiques) : voir journal J5.
   */
  auraAlphas: readonly [number, number, number, number];
  /** Bornes des tiers de frappe (§2.8b) : [tier1 max, tier2 max, tier3 max]. */
  tiersFrappe: readonly number[];
  /** Saisie au clavier numérique (§2.7). */
  saisieMaxChiffres: number;
  /** Cadence humaine de référence : 1 calcul réussi toutes les N secondes. */
  cadenceHumaineReference: number;
  /** IA « gentille » (§2.6) : battable, suspense garanti. */
  ia: {
    /** Difficulté par défaut (CONFIG écran). */
    difficulte: Difficulte;
    /** Plafond de rendement (fraction de la cadence humaine de référence). */
    rendementMax: number;
    /** Facteur appliqué au rendement quand le rattrapage doux se déclenche. */
    facteurRattrapage: number;
    /** Écart de PV déclenchant le rattrapage doux. */
    ecartSuspense: number;
    /** Probabilité de réussite d'un calcul de l'IA par difficulté. */
    tauxReussite: Record<Difficulte, number>;
    /** Taux de victoires humaines visés (calibrage J8, cible S12). */
    tauxVictoiresCible: Record<Difficulte, number>;
    /** Stratégie de choix de difficulté par niveau d'IA (somme = 1). */
    strategieChoix: Record<Difficulte, Record<Difficulte, number>>;
    /**
     * Chrono « immédiat » des phases IA en rythme DIFFÉRÉ Solo : le score est
     * calculé d'avance et totalisé sur cette courte durée (l'humain n'attend
     * jamais la pleine durée d'une phase IA).
     */
    dureeChronoIA: number;
  };
}

export const CONFIG: ConfigJeu = {
  pvMax: 100,
  tempsPhase: 15,
  rythme: 'differe',
  gains: { facile: 1, moyen: 3, difficile: 7 },
  bornesNiveau: { debutant: 5, intermediaire: 10, avance: 12 },
  familles: {
    vert: [1, 2, 5, 10],
    jaune: [3, 4, 6, 8, 9, 11, 12],
    resistants: [
      [6, 7],
      [6, 8],
      [7, 7],
      [7, 8],
      [8, 8],
    ],
    repliDebutant: [
      [3, 3],
      [3, 4],
      [4, 4],
    ],
  },
  energieVisuelleMax: 30,
  auraAlphas: [0.55, 0.74, 0.88, 0.98],
  tiersFrappe: [5, 12, 20],
  saisieMaxChiffres: 3,
  cadenceHumaineReference: 3,
  ia: {
    difficulte: 'moyen',
    rendementMax: 0.7,
    facteurRattrapage: 0.7,
    ecartSuspense: 20,
    tauxReussite: { facile: 0.55, moyen: 0.7, difficile: 0.8 },
    tauxVictoiresCible: { facile: 0.8, moyen: 0.5, difficile: 0.3 },
    strategieChoix: {
      facile: { facile: 0.7, moyen: 0.2, difficile: 0.1 },
      moyen: { facile: 0.25, moyen: 0.5, difficile: 0.25 },
      difficile: { facile: 0.1, moyen: 0.2, difficile: 0.7 },
    },
    dureeChronoIA: 3,
  },
};

// ---------------------------------------------------------------- utilitaires pures

/** Clé d'un fait, insensible à la commutativité (« 6x7 » = « 7x6 »). */
export function cleFait(a: number, b: number): string {
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

/** Un fait est résistant s'il figure dans la liste des 5 (§2.5). */
export function estResistant(a: number, b: number, config: ConfigJeu = CONFIG): boolean {
  const cle = cleFait(a, b);
  return config.familles.resistants.some(([x, y]) => cleFait(x, y) === cle);
}
