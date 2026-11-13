/**
 * Tests Vitest — IA « gentille » (jalons J3). Invariant I16 (docs/test-plan.md).
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

describe('AiController — rendement plafonné (I16)', () => {
  it('tentatives bornées par rendementMax × (tempsPhase / cadenceHumaineReference)', () => {
    const ia = new AiController(CONFIG, alea(1));
    const plafondTheorique = Math.floor(
      (CONFIG.tempsPhase / CONFIG.cadenceHumaineReference) * CONFIG.ia.rendementMax
    );
    expect(ia.tentativesMax(0)).toBe(plafondTheorique);
    // 15 s / 3 s × 0.7 = 3,5 → 3 tentatives max : sous la cadence humaine (5)
    expect(plafondTheorique).toBe(3);
  });

  it('rattrapage doux : si l\'IA domine de plus de ecartSuspense PV, son rendement baisse', () => {
    const ia = new AiController(CONFIG, alea(2));
    const normal = ia.tentativesMax(0);
    const enRattrapage = ia.tentativesMax(CONFIG.ia.ecartSuspense + 1);
    expect(enRattrapage).toBeLessThan(normal);
    // bordure exacte : à l'écart seuil, pas de rattrapage
    expect(ia.tentativesMax(CONFIG.ia.ecartSuspense)).toBe(normal);
  });

  it('joue sur la durée configurée : nombre de décisions = tentativesMax', () => {
    const ia = new AiController(CONFIG, alea(3));
    const phase = new PhaseCalcul('multiplication', 'intermediaire', new GenerateurMath(CONFIG, alea(4)));
    const decisions = ia.jouerPhase(phase, 'moyen', 0);
    expect(decisions).toHaveLength(ia.tentativesMax(0));
    expect(decisions.length).toBeLessThanOrEqual(3); // I16 : jamais au-dessus du plafond
  });

  it('toujours battable : plafond d\'énergie garanti, sous le joueur rapide', () => {
    const plafondTentatives = Math.floor(
      (CONFIG.tempsPhase / CONFIG.cadenceHumaineReference) * CONFIG.ia.rendementMax
    );
    const plafondEnergie = plafondTentatives * CONFIG.gains.difficile;
    for (const difficulte of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      for (let essai = 0; essai < 50; essai++) {
        const ia = new AiController(CONFIG, alea(essai * 31 + 7));
        const phase = new PhaseCalcul('multiplication', 'avance', new GenerateurMath(CONFIG, alea(essai)));
        const decisions = ia.jouerPhase(phase, difficulte, 0);
        const energie = decisions.reduce((s, d) => s + d.gain, 0);
        expect(energie).toBeLessThanOrEqual(plafondEnergie); // 3 × 7 = 21 max
      }
    }
    // un joueur rapide (cadence de référence, 5 réussites) en gains max = 35 > 21
    const humainRapide =
      (CONFIG.tempsPhase / CONFIG.cadenceHumaineReference) * CONFIG.gains.difficile;
    expect(plafondEnergie).toBeLessThan(humainRapide);
  });
});

describe('AiController — taux de réussite et stratégie (S09, I16)', () => {
  it('taux de réussite conforme à la difficulté ±10 points sur 200 tirages', () => {
    for (const difficulte of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      const ia = new AiController(CONFIG, alea(42));
      const phase = new PhaseCalcul('division', 'avance', new GenerateurMath(CONFIG, alea(43)));
      const decisions = ia.jouerPhase(phase, difficulte, 0);
      // on enchaîne des phases pour atteindre 200 décisions
      while (decisions.length < 200) {
        decisions.push(
          ...ia.jouerPhase(
            new PhaseCalcul('division', 'avance', new GenerateurMath(CONFIG, alea(decisions.length))),
            difficulte,
            0
          )
        );
      }
      const echantillon = decisions.slice(0, 200);
      const taux = echantillon.filter((d) => d.correct).length / 200;
      const cible = CONFIG.ia.tauxReussite[difficulte];
      expect(Math.abs(taux - cible)).toBeLessThanOrEqual(0.1);
    }
  });

  it('stratégie de choix : distribution conforme (somme = 1 par niveau d\'IA)', () => {
    for (const difficulte of ['facile', 'moyen', 'difficile'] as Difficulte[]) {
      const somme = Object.values(CONFIG.ia.strategieChoix[difficulte]).reduce(
        (s, p) => s + p,
        0
      );
      expect(somme).toBeCloseTo(1);
    }
    // l'IA facile choisit majoritairement « facile », l'IA difficile « difficile »
    const ia = new AiController(CONFIG, alea(77));
    let facileChoisis = 0;
    for (let i = 0; i < 200; i++) {
      if (ia.choisirDifficulte('facile') === 'facile') facileChoisis++;
    }
    expect(facileChoisis).toBeGreaterThan(110); // ≈ 70 %
    let difficileChoisis = 0;
    for (let i = 0; i < 200; i++) {
      if (ia.choisirDifficulte('difficile') === 'difficile') difficileChoisis++;
    }
    expect(difficileChoisis).toBeGreaterThan(110); // ≈ 70 %
  });

  it('émissions de trace : ia.choix_difficulte et ia.reponse par tentative', () => {
    const events: string[] = [];
    const ia = new AiController(CONFIG, alea(9), (e) => events.push(e.event));
    const phase = new PhaseCalcul('multiplication', 'intermediaire', new GenerateurMath(CONFIG, alea(10)));
    const decisions = ia.jouerPhase(phase, 'moyen', 0);
    expect(events.filter((e) => e === 'ia.choix_difficulte')).toHaveLength(decisions.length);
    expect(events.filter((e) => e === 'ia.reponse')).toHaveLength(decisions.length);
  });

  it('stratégie incomplète : repli sur la dernière difficulté (garde-fou)', () => {
    const strategieTronquee = {
      ...CONFIG,
      ia: {
        ...CONFIG.ia,
        strategieChoix: {
          facile: { facile: 0.5, moyen: 0, difficile: 0 },
          moyen: { facile: 0, moyen: 1, difficile: 0 },
          difficile: { facile: 0, moyen: 0, difficile: 1 },
        },
      },
    };
    const ia = new AiController(strategieTronquee, alea(12));
    // tirage ≥ 0.5 → aucune branche atteinte → repli « difficile »
    let replisVu = false;
    for (let i = 0; i < 50 && !replisVu; i++) {
      replisVu = ia.choisirDifficulte('facile') === 'difficile';
    }
    expect(replisVu).toBe(true);
  });
});
