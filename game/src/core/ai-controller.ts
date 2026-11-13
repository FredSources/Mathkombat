/**
 * core/ai-controller.ts — IA « gentille » (AGENTS.md §2.6).
 *
 * Pur : pas d'I/O, pas de logger direct (événements par callback, comme le
 * moteur de combat). Syntaxe TS érasable uniquement (exécutable par Node).
 *
 * Règles (I16) :
 *  - l'IA joue ses phases **sur la durée configurée** (aucune résolution
 *    instantanée) : son nombre de tentatives est borné par le **rendement max**
 *    (`ia.rendementMax`, fraction de la cadence humaine de référence) ;
 *  - elle est **toujours battable** : son rendement plafonné reste sous la
 *    cadence humaine de référence ;
 *  - **rattrapage doux** : si elle mène de plus de `ia.ecartSuspense` PV, son
 *    rendement est multiplié par `ia.facteurRattrapage` (suspense) ;
 *  - probabilité de réussite et **stratégie de choix de difficulté**
 *    paramétrées (`ia.tauxReussite`, `ia.strategieChoix`).
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
   * Nombre de tentatives de l'IA pour une phase (I16) : plafonné par le
   * rendement max (indépendant de la difficulté — seule la réussite en dépend),
   * réduit par le rattrapage doux si l'IA domine.
   */
  tentativesMax(iaDominanteDe: number): number {
    const rattrapage = iaDominanteDe > this.config.ia.ecartSuspense;
    const rendement =
      this.config.ia.rendementMax * (rattrapage ? this.config.ia.facteurRattrapage : 1);
    return Math.floor(
      (this.config.tempsPhase / this.config.cadenceHumaineReference) * rendement
    );
  }

  /** Choix de difficulté selon la stratégie paramétrée (somme = 1). */
  choisirDifficulte(difficulteIA: Difficulte): Difficulte {
    const strategie = this.config.ia.strategieChoix[difficulteIA];
    const tirage = this.aleatoire();
    let cumul = 0;
    for (const d of DIFFICULTES) {
      cumul += strategie[d];
      if (tirage < cumul) return d;
    }
    return DIFFICULTES[DIFFICULTES.length - 1];
  }

  /**
   * Joue une phase complète dans la durée configurée.
   * @param phase        la phase courante (3 calculs actifs)
   * @param difficulteIA niveau de l'IA (facile/moyen/difficile)
   * @param iaDominanteDe écart de PV en faveur de l'IA (0 si elle ne domine pas)
   */
  jouerPhase(
    phase: PhaseCalcul,
    difficulteIA: Difficulte,
    iaDominanteDe: number
  ): DecisionIA[] {
    const tentatives = this.tentativesMax(iaDominanteDe);
    const decisions: DecisionIA[] = [];

    for (let i = 0; i < tentatives; i++) {
      const difficulteChoisie = this.choisirDifficulte(difficulteIA);
      this.emettre?.({
        event: 'ia.choix_difficulte',
        data: { difficulte: difficulteChoisie, tentative: i + 1 },
      });

      const q = phase.question(difficulteChoisie);
      const correct = this.aleatoire() < this.config.ia.tauxReussite[difficulteIA];
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
