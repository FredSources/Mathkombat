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
/** Mode de jeu (§2.6) : 'solo' (J1 vs IA, défaut) ou 'duel' (2 joueurs, même appareil). */
export type ModeJeu = 'solo' | 'duel';
/**
 * Presets de tempo de l'écran CONFIG (§2.9) : `personnalise` = valeur libre
 * bornée 5–60 s (curseur ◀ ▶ de l'écran CONFIG).
 */
export type PresetTempo = 'rapide' | 'normal' | 'long' | 'personnalise';
/** Coup de combat (§2.8b) : sert aux impacts et au choix de l'animation. */
export type Coup = 'poing' | 'pied-bas' | 'pied-haut';
/** v1 : multiplication + division seules ; addition/soustraction prévues (I14). */
export type TypeOperation = 'addition' | 'soustraction' | 'multiplication' | 'division';

export type Fait = readonly [number, number]; // fait sous-jacent (a, b) — non ordonné au sens de la commutativité

// ------------------------------------------------------- bornes et presets (§2.9)

/** Bornes de lecture de la durée de phase (secondes) — §2.9 / I9. */
export const BORNES_TEMPS_PHASE = { min: 5, max: 60 } as const;
/** Bornes de lecture des PV par joueur — §2.9 / I9. */
export const BORNES_PV = { min: 10, max: 999 } as const;
/** PV par joueur par défaut (§2.9) — aussi la valeur de repli d'une lecture invalide. */
export const PV_DEFAUT = 100;
/** Durées des presets de tempo de l'écran CONFIG (secondes, attaque = défense). */
export const PRESETS_TEMPO: Record<Exclude<PresetTempo, 'personnalise'>, number> = {
  rapide: 10,
  normal: 15,
  long: 25,
};
/** Défilement ◀ ▶ des presets sur la ligne TEMPO de l'écran CONFIG. */
export const ORDRE_PRESETS: readonly PresetTempo[] = ['rapide', 'normal', 'long', 'personnalise'];

// ---------------------------------------------------------------- configuration

export interface ConfigJeu {
  /** PV par joueur (plage 10–999). */
  pvMax: number;
  /** Durée de phase en secondes — identique attaque/défense (plage 5–60). */
  tempsPhase: number;
  /** Rythme de calcul : 'simultane' (défaut) ou 'differe' (jamais auto-adapté). */
  rythme: Rythme;
  /** Mode de jeu (§2.6) : 'solo' (défaut, J1 vs IA) ou 'duel' (2 joueurs). */
  mode: ModeJeu;
  /** Niveau de calcul (§2.5) : borne du second facteur (×) et du quotient (÷). */
  niveau: Niveau;
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
  /**
   * Coup articulé par tier (§2.8b, docs/assets.md §3a) :
   * index = tier − 1 → poing aux tiers légers, pied (bas puis haut) aux lourds.
   */
  coupsParTier: readonly Coup[];
  /**
   * Intensités d'animation « juice » (§2.8b/c/d) — déterministes de la
   * puissance, jamais estimées à l'œil dans la scène.
   */
  juice: {
    /** Zoom caméra au tier 3 / tier 4 (multiplicateur de la caméra). */
    zoomTier3: number;
    zoomTier4: number;
    /** Ralenti du tier 4 : durée en ms (temps réel) et facteur de temps. */
    ralentiDureeMs: number;
    ralentiFacteur: number;
    /** Étincelles d'impact : base + N par point de tier. */
    etincellesParTier: number;
    /** Onde de choc du tier 4 (rayon final en px). */
    ondeChocRayon: number;
    /** Amplitude de secousse caméra (Phaser intensity) par point de tier. */
    secousseTier: number;
    /** Durée du flash plein écran du tier 4 (ms). */
    flashTier4Ms: number;
  };
  /**
   * Mise en scène des combattants (§2.8b/c, sprites animés `rig/personnage.ts`) :
   * durées, déplacements et impacts — pilotés d'ici, jamais durcis dans la scène.
   */
  rig: {
    /** Délai entre le coup et l'impact visuel (ms). */
    dureeExtensionMs: number;
    /** Saut du CONTRE : hauteur (px) et durée totale (ms). */
    sautHauteur: number;
    sautDureeMs: number;
    /** Déplacement libre du personnage (§9.2 `vaAGauche`…`vaEnBas`). */
    deplacementPas: number;
    deplacementDureeMs: number;
    /** Profondeur (déplacement haut/bas) : zoom du sprite — + vers le bas,
     *  − vers le haut — pour simuler la perspective de l'arène. */
    zoomProfondeur: number;
    /** Approche de la cible avant un coup (§2.8b) : pénétration et durées.
     *  `penetrationFrappe` : le sprite du poing/pied doit **toucher** l'adversaire. */
    penetrationFrappe: number;
    approcheDureeMs: number;
    retourDureeMs: number;
    /** Hauteur d'impact au-dessus du sol (px) selon le coup. */
    impactY: Record<Coup, number>;
  };
  /** Saisie au clavier numérique (§2.7). */
  saisieMaxChiffres: number;
  /** Cadence humaine de référence : 1 calcul réussi toutes les N secondes. */
  cadenceHumaineReference: number;
  /** Interface (§2.7) — intensités d'animation des retours visuels des boutons. */
  ui: {
    /** Durée (ms) de la surbrillance d'une touche du clavier quand on l'appuie. */
    surbrillanceMs: number;
    /** Mélange vers le blanc (0..1) appliqué à la teinte de la touche pressée. */
    surbrillanceTeinte: number;
    /** Voiles sombres (0..1) posés sur les fonds d'illustration des écrans rétro
     *  pour garde la lisibilité du texte : plus fort en CONFIG (lignes denses). */
    voileMenu: number;
    voileConfig: number;
  };
  /** Score de combat (§2.7) : énergies gagnées + temps restant + bonus K.O. */
  score: {
    /** Points par point d'énergie gagné (calcul réussi). */
    facteurEnergie: number;
    /** Points par seconde restante en fin de phase jouée (récompense la rapidité). */
    facteurTempsRestant: number;
    /** Bonus fixe pour la victoire par K.O. */
    bonusKo: number;
  };
  /** Manœuvres pendant le chrono (§2.8b) : feintes à distance, sans contact. */
  manoeuvres: {
    /** Intervalle entre deux manœuvres (ms). */
    intervalleMs: number;
    /** Temps de réaction du défenseur (ms) : il suit l'attaquant en retard. */
    tempsReactionMs: number;
  };
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
  pvMax: PV_DEFAUT,
  tempsPhase: 15,
  rythme: 'simultane',
  mode: 'solo',
  niveau: 'intermediaire',
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
  // palier 0 : à peine perceptible (petite, près du corps), puis strates visibles
  auraAlphas: [0.12, 0.74, 0.88, 0.98],
  tiersFrappe: [5, 12, 20],
  coupsParTier: ['poing', 'poing', 'pied-bas', 'pied-haut'],
  juice: {
    zoomTier3: 1.06,
    zoomTier4: 1.12,
    ralentiDureeMs: 300,
    ralentiFacteur: 0.3,
    etincellesParTier: 4,
    ondeChocRayon: 240,
    secousseTier: 0.0015,
    flashTier4Ms: 180,
  },
  rig: {
    dureeExtensionMs: 90,
    sautHauteur: 140,
    sautDureeMs: 260,
    deplacementPas: 36,
    deplacementDureeMs: 120,
    zoomProfondeur: 0.04,
    /** Pénétration du coup dans la silhouette adverse (px) : le sprite du
     *  poing/pied doit **toucher** l'adversaire, même en cas de blocage. */
    penetrationFrappe: 90,
    approcheDureeMs: 220,
    retourDureeMs: 280,
    impactY: { poing: 185, 'pied-haut': 100, 'pied-bas': 40 },
  },
  saisieMaxChiffres: 3,
  cadenceHumaineReference: 3,
  ui: {
    surbrillanceMs: 160,
    surbrillanceTeinte: 0.45,
    voileMenu: 0.45,
    voileConfig: 0.6,
  },
  score: {
    facteurEnergie: 1,
    facteurTempsRestant: 1,
    bonusKo: 25,
  },
  manoeuvres: {
    intervalleMs: 2500,
    tempsReactionMs: 220,
  },
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

/**
 * Instantané des valeurs par défaut, figé au chargement du module : sert de
 * source à « RÉINITIALISER » sur l'écran CONFIG, même après des réglages en cours.
 * Copie superficielle + `ia` (seul champ profond lu par l'écran).
 */
const CONFIG_DEFAUT: ConfigJeu = { ...CONFIG, ia: { ...CONFIG.ia } };

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

/**
 * Coup articulé à animer pour un tier d'animation (§2.8b) :
 * index = tier − 1 borné à la table ; tier 0 (whiff) et hors-table → « poing ».
 */
export function coupPourTier(tier: number, config: ConfigJeu = CONFIG): Coup {
  const index = Math.max(0, Math.min(tier, config.coupsParTier.length) - 1);
  return config.coupsParTier[index] ?? 'poing';
}

// ------------------------------------------- réglages de l'écran CONFIG (§2.7/§2.9)

/** Réglages éditables par l'écran CONFIG — copie de travail de l'éditeur. */
export interface ReglagesConfig {
  mode: ModeJeu;
  tempsPhase: number;
  rythme: Rythme;
  pvMax: number;
  niveau: Niveau;
  difficulteIA: Difficulte;
}

/**
 * Durée de phase validée **à la lecture** (§2.9) : jamais de timer nul, négatif
 * ou infini — une valeur hors plage est ramenée à la borne (I9).
 */
export function lireTempsPhase(valeur: number): number {
  const n = Number.isFinite(valeur) ? Math.round(valeur) : PRESETS_TEMPO.normal;
  return Math.min(BORNES_TEMPS_PHASE.max, Math.max(BORNES_TEMPS_PHASE.min, n));
}

/** PV validés à la lecture (§2.9 / I9) : finis, entiers, bornés 10–999. */
export function lirePv(valeur: number): number {
  const n = Number.isFinite(valeur) ? Math.round(valeur) : PV_DEFAUT;
  return Math.min(BORNES_PV.max, Math.max(BORNES_PV.min, n));
}

/** Preset correspondant à une durée : `personnalise` si aucune valeur de table. */
export function presetDeTemps(secondes: number): PresetTempo {
  if (secondes === PRESETS_TEMPO.rapide) return 'rapide';
  if (secondes === PRESETS_TEMPO.normal) return 'normal';
  if (secondes === PRESETS_TEMPO.long) return 'long';
  return 'personnalise';
}

/** Réglages par défaut de l'écran CONFIG (bouton RÉINITIALISER). */
export function reglagesDefaut(): ReglagesConfig {
  return lireReglages(CONFIG_DEFAUT);
}

/** Copie de travail à ouvrir sur l'écran CONFIG (valeurs courantes). */
export function lireReglages(config: ConfigJeu = CONFIG): ReglagesConfig {
  return {
    mode: config.mode,
    tempsPhase: config.tempsPhase,
    rythme: config.rythme,
    pvMax: config.pvMax,
    niveau: config.niveau,
    difficulteIA: config.ia.difficulte,
  };
}

/** Écriture des réglages dans la config, **bornes appliquées à la validation** (I9). */
export function appliquerReglages(config: ConfigJeu, r: ReglagesConfig): void {
  config.mode = r.mode;
  config.tempsPhase = lireTempsPhase(r.tempsPhase);
  config.rythme = r.rythme;
  config.pvMax = lirePv(r.pvMax);
  config.niveau = r.niveau;
  config.ia.difficulte = r.difficulteIA;
}
