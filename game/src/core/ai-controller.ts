/**
 * core/ai-controller.ts — IA « gentille » (AGENTS.md §2.6).
 *
 * Pur : pas d'I/O, pas de logger direct (événements par callback, comme le
 * moteur de combat). Syntaxe TS érasable uniquement (exécutable par Node).
 *
 * Modèle (§2.6) : **le niveau d'IA indique le score moyen de ses attaques et de
 * ses défenses** — pas les multiplications à faire. Le choix des calculs est
 * **indépendant du niveau** (proportionnel au gain, comme un joueur qui vise les
 * calculs les plus rémunérateurs) ; c'est la **réussite** qui porte le score.
 *
 * **Temps des calculs** (§2.9) : 1 calcul = `tempsParCalcul` s (saisie + calcul
 * humain). Le temps de phase borne donc le score : moins de temps → moins de
 * calculs → score plus faible.
 *
 * Règles (I16) :
 *  - l'IA joue ses phases **sur la durée configurée** (aucune résolution
 *    instantanée) : `calculsMax()` = tempsPhase / tempsParCalcul tentatives ;
 *  - score visé par phase = `ia.scoreMoyen[niveau]` (ramené au temps de phase) ;
 *  - elle est **toujours battable** : son score moyen plafonné reste sous le
 *    score d'un joueur rapide (gain max × calculs) ;
 *  - **rattrapage doux** : si elle mène de plus de `ia.ecartSuspense` PV, son
 *    score visé est multiplié par `ia.facteurRattrapage` (suspense).
 */
import type { ConfigJeu, Difficulte } from './config.ts';
import { CONFIG } from './config.ts';
import type { Emetteur } from './combat-engine.ts';
import type { PhaseCalcul } from './combat-engine.ts';

export interface DecisionIA {
  difficulteChoisie: Difficulte;
  correct: boolean;
  gain: number;
}

const DIFFICULTES: readonly Difficulte[] = ['facile', 'moyen', 'difficile'];

export class AiController {
  private readonly config: ConfigJeu;
  private readonly aleatoire: () => number;
  private readonly emettre: Emetteur | undefined;

  constructor(config: ConfigJeu = CONFIG, aleatoire: () => number = Math.random, emettre?: Emetteur) {
    this.config = config;
    this.aleatoire = aleatoire;
    this.emettre = emettre;
  }

  /**
   * Calculs jouables dans une phase — le temps des calculs borne le score
   * (1 calcul = `tempsParCalcul` s, humain comme IA).
   */
  calculsMax(): number {
    return Math.max(1, Math.floor(this.config.tempsPhase / this.config.tempsParCalcul));
  }

  /**
   * Gain moyen visé par calcul : le score moyen du niveau, ramené au temps de
   * phase (`ia.dureeScoreMoyen` s de référence), rattrapage doux inclus.
   */
  gainMoyenVise(difficulteIA: Difficulte, iaDominanteDe = 0): number {
    const calculsReference = Math.max(
      1,
      Math.floor(this.config.ia.dureeScoreMoyen / this.config.tempsParCalcul)
    );
    const rattrapage = iaDominanteDe > this.config.ia.ecartSuspense;
    const score = this.config.ia.scoreMoyen[difficulteIA] *
      (rattrapage ? this.config.ia.facteurRattrapage : 1);
    return score / calculsReference;
  }

  /**
   * Score moyen visé pour la phase (attaque OU défense) — **le niveau d'IA
   * indique ce score** (§2.6). Il décroît avec le temps de phase (moins de
   * calculs jouables).
   */
  scoreVise(difficulteIA: Difficulte, iaDominanteDe = 0): number {
    return this.gainMoyenVise(difficulteIA, iaDominanteDe) * this.calculsMax();
  }

  /**
   * Choix du calcul tenté : **proportionnel au gain** (les calculs les plus
   * rémunérateurs sont visés en priorité) — identique à tous les niveaux :
   * le niveau n'indique pas les multiplications à faire (§2.6).
   */
  private choisirDifficulte(): Difficulte {
    const g = this.config.gains;
    const poids = [g.facile, g.moyen, g.difficile];
    const total = poids[0] + poids[1] + poids[2];
    let tirage = this.aleatoire() * total;
    for (let i = 0; i < DIFFICULTES.length; i++) {
      tirage -= poids[i];
      if (tirage < 0) return DIFFICULTES[i];
    }
    return DIFFICULTES[DIFFICULTES.length - 1];
  }

  /**
   * Joue une phase complète dans la durée configurée : `calculsMax()` tentatives,
   * réussite calée pour que l'énergie moyenne atteigne le score visé du niveau.
   * @param phase        la phase courante (3 calculs actifs)
   * @param difficulteIA niveau d'IA (facile/moyen/difficile) — son SCORE moyen
   * @param iaDominanteDe écart de PV en faveur de l'IA (0 si elle ne domine pas)
   */
  jouerPhase(
    phase: PhaseCalcul,
    difficulteIA: Difficulte,
    iaDominanteDe = 0
  ): DecisionIA[] {
    const tentatives = this.calculsMax();
    const gainVise = this.gainMoyenVise(difficulteIA, iaDominanteDe);
    // choix proportionnel au gain : E[gain] = (1² + 3² + 7²) / (1 + 3 + 7)
    const gainMoyenChoix =
      (this.config.gains.facile ** 2 +
        this.config.gains.moyen ** 2 +
        this.config.gains.difficile ** 2) /
      (this.config.gains.facile + this.config.gains.moyen + this.config.gains.difficile);
    const probabilite = Math.min(1, gainVise / gainMoyenChoix);

    const decisions: DecisionIA[] = [];
    for (let i = 0; i < tentatives; i++) {
      const difficulteChoisie = this.choisirDifficulte();
      this.emettre?.({
        event: 'ia.choix_difficulte',
        data: { difficulte: difficulteChoisie, tentative: i + 1 },
      });

      const q = phase.question(difficulteChoisie);
      const correct = this.aleatoire() < probabilite;
      const saisie = correct ? q.reponse : q.reponse + 1;
      const resultat = phase.resoudre(difficulteChoisie, saisie);

      this.emettre?.({
        event: 'ia.reponse',
        data: { enonce: q.enonce, correct: resultat.correct, gain: resultat.gain },
      });
      decisions.push({
        difficulteChoisie,
        correct: resultat.correct,
        gain: resultat.gain,
      });
    }
    return decisions;
  }
}
