/**
 * core/combat-engine.ts — moteur de combat (AGENTS.md §2.1–§2.4).
 *
 * Pur : pas d'I/O, pas de DOM, pas de logger direct — les événements de trace
 * sortent par un callback (`emettre`), la scène les répercute vers le logger
 * (AGENTS.md §5 : aucune fonction de jeu n'écrit directement).
 *
 * Règles implémentées :
 *  - solde = attaque − défense ; > 0 → dégâts au défenseur ; < 0 → CONTRE-ATTAQUE
 *    de |solde| sur l'attaquant ; = 0 → bloqué (§2.4, I1/I2) ;
 *  - PV bornés à 0 (jamais négatifs), K.O. émis exactement une fois (I5) ;
 *  - alternance des rôles à chaque tour (§2.1) ;
 *  - rythme DIFFÉRÉ : phases attaque puis défense enchaînées (même durée) ;
 *    rythme SIMULTANÉ : un seul chrono partagé (I15) — le rythme appliqué est
 *    celui de la configuration (jamais auto-adapté) ;
 *  - tiers de frappe et paliers d'aura = fonctions déterministes de la puissance
 *    (§2.8, I13).
 */
import type { ConfigJeu, Difficulte, Niveau, Rythme, TypeOperation } from './config.ts';
import { CONFIG } from './config.ts';
import type { Question } from './math-generator.ts';
import { GenerateurMath, evaluerReponse, gainObtenu } from './math-generator.ts';

export type IdJoueur = 'j1' | 'j2';

/** Événement de trace (nomenclature : docs/architecture.md §4). */
export interface TraceEvent {
  event: string;
  data?: Record<string, unknown>;
}

export type Emetteur = (e: TraceEvent) => void;

// ---------------------------------------------------------------- résolution pure

export interface ResolutionCoup {
  attaque: number;
  defense: number;
  solde: number;
  /** Dégâts infligés (= solde si > 0, |solde| en contre-attaque, 0 si bloqué). */
  degats: number;
  /** Contre-attaque (solde < 0). */
  contre: boolean;
  /** Qui subit les dégâts. */
  sur: 'attaquant' | 'defenseur' | 'aucun';
}

/** Résolution pure d'un coup (§2.4) — I1/I2. */
export function resoudreCoup(attaque: number, defense: number): ResolutionCoup {
  const solde = attaque - defense;
  if (solde > 0) {
    return { attaque, defense, solde, degats: solde, contre: false, sur: 'defenseur' };
  }
  if (solde < 0) {
    return { attaque, defense, solde, degats: -solde, contre: true, sur: 'attaquant' };
  }
  return { attaque, defense, solde, degats: 0, contre: false, sur: 'aucun' };
}

// ---------------------------------------------------------------- mise en scène (I13)

/** Tier de frappe déterministe : 0 = whiff, 1..4 (§2.8b). */
export function tierFrappe(energie: number, config: ConfigJeu = CONFIG): number {
  if (energie <= 0) return 0;
  if (energie <= config.tiersFrappe[0]) return 1;
  if (energie <= config.tiersFrappe[1]) return 2;
  if (energie <= config.tiersFrappe[2]) return 3;
  return 4;
}

/** Palier d'aura déterministe : 0..3 (0–25 %, 25–50 %, 50–75 %, 75–100 %+ §2.8a). */
export function palierAura(energie: number, config: ConfigJeu = CONFIG): number {
  const ratio = energie / config.energieVisuelleMax;
  if (ratio < 0.25) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.75) return 2;
  return 3;
}

// ---------------------------------------------------------------- phase de calcul

export interface ResultatSaisie {
  correct: boolean;
  gain: number;
}

const DIFFICULTES: readonly Difficulte[] = ['facile', 'moyen', 'difficile'];

/**
 * Phase de calcul (§2.2/§2.3) : 3 calculs simultanés (un par difficulté).
 * Réussite → gain + remplacement du SEUL calcul résolu ; erreur → le calcul
 * reste (I4, I12). Gain non plafonné (I11).
 */
export class PhaseCalcul {
  readonly operation: TypeOperation;
  readonly niveau: Niveau;
  private readonly generateur: GenerateurMath;
  private readonly emettre: Emetteur | undefined;
  private questionsActives: Map<Difficulte, Question>;
  private gainsObtenus: number[] = [];

  constructor(
    operation: TypeOperation,
    niveau: Niveau,
    generateur: GenerateurMath,
    emettre?: Emetteur
  ) {
    this.operation = operation;
    this.niveau = niveau;
    this.generateur = generateur;
    this.emettre = emettre;
    this.questionsActives = new Map();
    for (const difficulte of DIFFICULTES) {
      this.questionsActives.set(difficulte, this.genererQuestion(difficulte));
    }
  }

  private genererQuestion(difficulte: Difficulte): Question {
    const q = this.generateur.nouvelleQuestion(this.operation, difficulte, this.niveau);
    this.emettre?.({
      event: 'math.genere',
      data: { operation: q.operation, difficulte: q.difficulte, enonce: q.enonce, gain: q.gain },
    });
    return q;
  }

  /** Le calcul actif pour une difficulté. */
  question(difficulte: Difficulte): Question {
    return this.questionsActives.get(difficulte)!;
  }

  /**
   * Tente une réponse (I4, I8, I12) :
   *  - correct → gain acquis et SEUL ce calcul est remplacé ;
   *  - faux ou non évalué → gain 0, le calcul reste inchangé.
   */
  resoudre(difficulte: Difficulte, saisie: number | null | undefined): ResultatSaisie {
    const q = this.question(difficulte);
    const correct = evaluerReponse(q, saisie);
    const gain = gainObtenu(q, correct);
    this.emettre?.({
      event: 'math.reponse',
      data: { enonce: q.enonce, saisie: saisie ?? null, correct, gain },
    });
    if (correct) {
      this.gainsObtenus.push(gain);
      this.questionsActives.set(difficulte, this.genererQuestion(difficulte));
    }
    return { correct, gain };
  }

  /** Énergie (ou points de défense) accumulés (I3). */
  energie(): number {
    return this.gainsObtenus.reduce((somme, g) => somme + g, 0);
  }
}

// ---------------------------------------------------------------- combat

export interface EtatCombat {
  tour: number;
  attaquant: IdJoueur;
  pv: Record<IdJoueur, number>;
  fini: boolean;
  gagnant: IdJoueur | null;
  rythme: Rythme;
}

export interface Tour {
  numero: number;
  attaquant: IdJoueur;
  defenseur: IdJoueur;
  phaseAttaque: PhaseCalcul;
  phaseDefense: PhaseCalcul;
}

export interface ResultatTour extends ResolutionCoup {
  tour: number;
  attaquant: IdJoueur;
  defenseur: IdJoueur;
  /** PV après résolution. */
  pv: Record<IdJoueur, number>;
  ko: boolean;
}

export interface OptionsCombat {
  config?: ConfigJeu;
  aleatoire?: () => number;
  niveaux: Record<IdJoueur, Niveau>;
  emettre?: Emetteur;
}

export class CombatEngine {
  private readonly config: ConfigJeu;
  private readonly generateur: GenerateurMath;
  private readonly emettre: Emetteur | undefined;
  private readonly niveaux: Record<IdJoueur, Niveau>;
  private etatCourant: EtatCombat;

  constructor(options: OptionsCombat) {
    this.config = options.config ?? CONFIG;
    this.emettre = options.emettre;
    this.niveaux = options.niveaux;
    this.generateur = new GenerateurMath(this.config, options.aleatoire);
    this.etatCourant = {
      tour: 0,
      attaquant: 'j1',
      pv: { j1: this.config.pvMax, j2: this.config.pvMax },
      fini: false,
      gagnant: null,
      rythme: this.config.rythme,
    };
  }

  get etat(): EtatCombat {
    return { ...this.etatCourant, pv: { ...this.etatCourant.pv } };
  }

  /**
   * Démarre un tour : phase d'attaque (multiplications de l'attaquant) et phase
   * de défense (divisions du défenseur). Événements `combat.phase` selon le
   * rythme configuré (I15) : DIFFÉRÉ = 2 phases enchaînées (même durée) ;
   * SIMULTANÉ = un seul chrono partagé.
   */
  demarrerTour(): Tour {
    if (this.etatCourant.fini) {
      throw new Error('Combat terminé — impossible de démarrer un tour');
    }
    const attaquant = this.etatCourant.attaquant;
    const defenseur: IdJoueur = attaquant === 'j1' ? 'j2' : 'j1';
    const numero = this.etatCourant.tour + 1;

    const phaseAttaque = new PhaseCalcul(
      'multiplication',
      this.niveaux[attaquant],
      this.generateur,
      this.emettre
    );
    const phaseDefense = new PhaseCalcul(
      'division',
      this.niveaux[defenseur],
      this.generateur,
      this.emettre
    );

    if (this.config.rythme === 'simultane') {
      this.emettre?.({
        event: 'combat.phase',
        data: {
          tour: numero,
          rythme: 'simultane',
          chronoUnique: true,
          duree: this.config.tempsPhase,
          attaquant,
          defenseur,
        },
      });
    } else {
      for (const [ordre, phase, role] of [
        [1, 'attaque', attaquant],
        [2, 'defense', defenseur],
      ] as const) {
        this.emettre?.({
          event: 'combat.phase',
          data: {
            tour: numero,
            rythme: 'differe',
            ordre,
            phase: phase,
            duree: this.config.tempsPhase,
            joueur: role,
          },
        });
      }
    }

    this.etatCourant.tour = numero;
    return { numero, attaquant, defenseur, phaseAttaque, phaseDefense };
  }

  /**
   * Résout le tour : solde = attaque − défense (§2.4), dégâts appliqués aux PV
   * (bornés à 0), K.O. émis une seule fois, puis inversion des rôles.
   * Les énergies passées en paramètre permettent le scriptage (tests) ; par
   * défaut, ce sont celles des phases.
   */
  resoudreTour(
    tour: Tour,
    energieAttaque?: number,
    energieDefense?: number
  ): ResultatTour {
    if (this.etatCourant.fini) {
      throw new Error('Combat terminé — impossible de résoudre un tour');
    }
    const attaque = energieAttaque ?? tour.phaseAttaque.energie();
    const defense = energieDefense ?? tour.phaseDefense.energie();
    const resolution = resoudreCoup(attaque, defense);

    const pv = this.etatCourant.pv;
    if (resolution.sur === 'defenseur') {
      pv[tour.defenseur] = Math.max(0, pv[tour.defenseur] - resolution.degats);
    } else if (resolution.sur === 'attaquant') {
      pv[tour.attaquant] = Math.max(0, pv[tour.attaquant] - resolution.degats);
    }

    const ko = pv[tour.attaquant] === 0 || pv[tour.defenseur] === 0;
    this.emettre?.({
      event: 'combat.coup_resolu',
      data: {
        tour: tour.numero,
        attaque,
        defense,
        solde: resolution.solde,
        degats: resolution.degats,
        contre: resolution.contre ? resolution.degats : 0,
        pvRestants: { ...pv },
      },
    });

    if (ko) {
      this.etatCourant.fini = true;
      this.etatCourant.gagnant = pv[tour.defenseur] === 0 ? tour.attaquant : tour.defenseur;
      this.emettre?.({
        event: 'combat.ko',
        data: { tour: tour.numero, gagnant: this.etatCourant.gagnant },
      });
    } else {
      // inversion des rôles (§2.1)
      this.etatCourant.attaquant = tour.defenseur;
    }

    return {
      ...resolution,
      tour: tour.numero,
      attaquant: tour.attaquant,
      defenseur: tour.defenseur,
      pv: { ...pv },
      ko,
    };
  }
}
