/**
 * Tests Vitest — IA « gentille » (jalons J3). Invariant I16 (docs/test-plan.md).
 * Modèle §2.6 : le niveau d'IA = son score moyen (attaque/défense) ; le temps
 * des calculs borne le score (1 calcul = tempsParCalcul s).
 */
import { describe, expect, it } from 'vitest';
import type { Difficulte } from '../src/core/config.ts';
import { CONFIG } from '../src/core/config.ts';
import { AiController } from '../src/core/ai-controller.ts';
import { PhaseCalcul } from '../src/core/combat-engine.ts';
import { GenerateurMath } from '../src/core/math-generator.ts';

/** Générateur déterministe (mulberry32). */
function alea(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('AiController — temps des calculs borne le score (I16)', () => {
  it('calculs par phase = tempsPhase / tempsParCalcul (1 calcul = 2 s)', () => {
    const ia = new AiController(CONFIG, alea(1));
    const attendu = Math.floor(CONFIG.tempsPhase / CONFIG.tempsParCalcul);
    expect(ia.calculsMax()).toBe(attendu);
    // 15 s / 2 s = 7 calculs max par phase
    expect(attendu).toBe(7);
  });

  it('moins de temps de phase = score visé plus faible (§2.6)', () => {
    const court = { ...CONFIG, tempsPhase: 8 };
    const iaCourt = new AiController(court, alea(2));
    const iaNormal = new AiController(CONFIG, alea(2));
    for (const d of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      expect(iaCourt.scoreVise(d)).toBeLessThan(iaNormal.scoreVise(d));
      // proportionnel aux calculs jouables
      expect(iaCourt.scoreVise(d)).toBeCloseTo(
        (iaNormal.scoreVise(d) * iaCourt.calculsMax()) / iaNormal.calculsMax(),
        5
      );
    }
  });

  it('joue sur la durée configurée : nombre de décisions = calculsMax', () => {
    const ia = new AiController(CONFIG, alea(3));
    const phase = new PhaseCalcul('multiplication', 'intermediaire', new GenerateurMath(CONFIG, alea(4)));
    const decisions = ia.jouerPhase(phase, 'moyen', 0);
    expect(decisions).toHaveLength(ia.calculsMax());
  });

  it('rattrapage doux : si l\'IA domine de plus de ecartSuspense PV, son score baisse', () => {
    const ia = new AiController(CONFIG, alea(2));
    const normal = ia.scoreVise('moyen', 0);
    const enRattrapage = ia.scoreVise('moyen', CONFIG.ia.ecartSuspense + 1);
    expect(enRattrapage).toBeLessThan(normal);
    expect(enRattrapage).toBeCloseTo(normal * CONFIG.ia.facteurRattrapage, 5);
    // bordure exacte : à l'écart seuil, pas de rattrapage
    expect(ia.scoreVise('moyen', CONFIG.ia.ecartSuspense)).toBeCloseTo(normal, 10);
  });
});

describe('AiController — le niveau indique le SCORE, pas les calculs (§2.6)', () => {
  it('score moyen visé conforme au niveau sur 200 phases (±12 %)', () => {
    for (const difficulte of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      const ia = new AiController(CONFIG, alea(42));
      let total = 0;
      let graine = 1;
      for (let p = 0; p < 200; p++) {
        const phase = new PhaseCalcul('multiplication', 'avance', new GenerateurMath(CONFIG, alea(graine++)));
        total += ia.jouerPhase(phase, difficulte, 0).reduce((s, d) => s + d.gain, 0);
      }
      const scoreMoyenObtenu = total / 200;
      const cible = CONFIG.ia.scoreMoyen[difficulte];
      expect(Math.abs(scoreMoyenObtenu - cible)).toBeLessThanOrEqual(0.12 * cible);
    }
  });

  it('toujours battable : score moyen < score maximal d\'un joueur rapide', () => {
    const gainMax = CONFIG.gains.difficile;
    const calculs = Math.floor(CONFIG.tempsPhase / CONFIG.tempsParCalcul);
    const scoreJoueurRapide = calculs * gainMax; // tout juste, tout le temps
    for (const difficulte of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      expect(CONFIG.ia.scoreMoyen[difficulte]).toBeLessThan(scoreJoueurRapide);
    }
    // un joueur rapide à la cadence de référence garde une marge
    expect(scoreJoueurRapide).toBeGreaterThan(CONFIG.ia.scoreMoyen.difficile);
  });

  it('choix des calculs indépendant du niveau : proportionnel au gain', () => {
    // à tous les niveaux, la même distribution de difficultés tentées
    for (const difficulte of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      const ia = new AiController(CONFIG, alea(77));
      const comptes = { facile: 0, moyen: 0, difficile: 0 };
      for (let p = 0; p < 100; p++) {
        const phase = new PhaseCalcul('division', 'avance', new GenerateurMath(CONFIG, alea(p + 1)));
        for (const d of ia.jouerPhase(phase, difficulte, 0)) comptes[d.difficulteChoisie]++;
      }
      // poids 1 : 3 : 7 → ≈ 9 % / 27 % / 64 %
      expect(comptes.difficile).toBeGreaterThan(comptes.moyen);
      expect(comptes.moyen).toBeGreaterThan(comptes.facile);
    }
  });

  it('émissions de trace : ia.choix_difficulte et ia.reponse par tentative', () => {
    const events: string[] = [];
    const ia = new AiController(CONFIG, alea(9), (e) => events.push(e.event));
    const phase = new PhaseCalcul('multiplication', 'intermediaire', new GenerateurMath(CONFIG, alea(10)));
    const decisions = ia.jouerPhase(phase, 'moyen', 0);
    expect(events.filter((e) => e === 'ia.choix_difficulte')).toHaveLength(decisions.length);
    expect(events.filter((e) => e === 'ia.reponse')).toHaveLength(decisions.length);
  });
});
