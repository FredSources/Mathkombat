/**
 * Tests Vitest — moteur de combat (jalons J3).
 * Invariants : I1, I2, I3, I4, I5, I12, I13, I15 (docs/test-plan.md).
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config.ts';
import {
  CombatEngine,
  PhaseCalcul,
  palierAura,
  resoudreCoup,
  tierFrappe,
} from '../src/core/combat-engine.ts';
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

describe('resoudreCoup — §2.4 (I1, I2)', () => {
  it('S04 : attaque 7 vs défense 10 → contre-attaque 3 sur l\'attaquant', () => {
    const r = resoudreCoup(7, 10);
    expect(r.solde).toBe(-3);
    expect(r.degats).toBe(3);
    expect(r.contre).toBe(true);
    expect(r.sur).toBe('attaquant');
  });

  it('S05 : attaque 10 vs défense 4 → dégâts 6 sur le défenseur', () => {
    const r = resoudreCoup(10, 4);
    expect(r.solde).toBe(6);
    expect(r.degats).toBe(6);
    expect(r.contre).toBe(false);
    expect(r.sur).toBe('defenseur');
  });

  it('S06 : attaque 8 vs défense 8 → bloqué, aucun dégât', () => {
    const r = resoudreCoup(8, 8);
    expect(r.solde).toBe(0);
    expect(r.degats).toBe(0);
    expect(r.contre).toBe(false);
    expect(r.sur).toBe('aucun');
  });

  it('whiff : attaque 0 vs défense positive → contre-attaque (§2.4 cas particuliers)', () => {
    const r = resoudreCoup(0, 5);
    expect(r.solde).toBe(-5);
    expect(r.contre).toBe(true);
    expect(resoudreCoup(0, 0).sur).toBe('aucun');
  });
});

describe('PhaseCalcul — 3 calculs simultanés (I3, I4, I12)', () => {
  it('réussite : gain acquis et SEUL le calcul résolu est remplacé', () => {
    const phase = new PhaseCalcul('multiplication', 'intermediaire', new GenerateurMath(CONFIG, alea(3)));
    const avant = {
      facile: phase.question('facile'),
      moyen: phase.question('moyen'),
      difficile: phase.question('difficile'),
    };
    const res = phase.resoudre('moyen', phase.question('moyen').reponse);
    expect(res.correct).toBe(true);
    expect(res.gain).toBe(3);
    expect(phase.question('facile')).toBe(avant.facile); // inchangé
    expect(phase.question('difficile')).toBe(avant.difficile); // inchangé
    expect(phase.question('moyen')).not.toBe(avant.moyen); // remplacé
    expect(phase.question('moyen').difficulte).toBe('moyen'); // même difficulté
  });

  it('erreur : gain 0 et le calcul reste (I4, I12)', () => {
    const phase = new PhaseCalcul('division', 'avance', new GenerateurMath(CONFIG, alea(4)));
    const avant = phase.question('difficile');
    const res = phase.resoudre('difficile', avant.reponse + 1);
    expect(res.correct).toBe(false);
    expect(res.gain).toBe(0);
    expect(phase.question('difficile')).toBe(avant);
  });

  it('saisie non évaluée (null ou undefined) : gain 0, calcul conservé', () => {
    const phase = new PhaseCalcul('multiplication', 'debutant', new GenerateurMath(CONFIG, alea(5)));
    const avant = phase.question('facile');
    expect(phase.resoudre('facile', null).gain).toBe(0);
    expect(phase.resoudre('facile', undefined).gain).toBe(0);
    expect(phase.question('facile')).toBe(avant);
  });

  it('énergie de phase = somme des gains, non plafonnée (I3, I11)', () => {
    const phase = new PhaseCalcul('multiplication', 'avance', new GenerateurMath(CONFIG, alea(6)));
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += phase.resoudre('difficile', phase.question('difficile').reponse).gain;
    }
    expect(phase.energie()).toBe(total);
    expect(total).toBe(70);
  });
});

describe('CombatEngine — boucle, PV, K.O. (I1, I2, I5)', () => {
  it('S07 : tours alternés, rôles inversés et PV cohérents', () => {
    const events: string[] = [];
    const engine = new CombatEngine({
      niveaux: { j1: 'intermediaire', j2: 'intermediaire' },
      aleatoire: alea(21),
      emettre: (e) => events.push(e.event),
    });

    // tour 1 : J1 attaque (10) vs défense 4 → J2 perd 6
    const t1 = engine.demarrerTour();
    expect(t1.attaquant).toBe('j1');
    const r1 = engine.resoudreTour(t1, 10, 4);
    expect(r1.degats).toBe(6);
    expect(engine.etat.pv).toEqual({ j1: 100, j2: 94 });

    // tour 2 : rôles inversés — J2 attaque (7) vs défense 12 → contre 5 sur J2
    const t2 = engine.demarrerTour();
    expect(t2.attaquant).toBe('j2');
    const r2 = engine.resoudreTour(t2, 7, 12);
    expect(r2.contre).toBe(true);
    expect(engine.etat.pv).toEqual({ j1: 100, j2: 89 });

    // tour 3 : retour de J1 à l'attaque
    const t3 = engine.demarrerTour();
    expect(t3.attaquant).toBe('j1');
    engine.resoudreTour(t3, 20, 18);
    expect(engine.etat.pv).toEqual({ j1: 100, j2: 87 });
    expect(engine.etat.tour).toBe(3);
    expect(events.filter((e) => e === 'combat.coup_resolu')).toHaveLength(3);
  });

  it('S08 : K.O. — PV bornés à 0, un seul événement combat.ko (I5)', () => {
    const events: { event: string; data?: Record<string, unknown> }[] = [];
    const engine = new CombatEngine({
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(8),
      emettre: (e) => events.push(e),
    });
    const t = engine.demarrerTour();
    const r = engine.resoudreTour(t, 250, 0); // surdose de dégâts
    expect(r.ko).toBe(true);
    expect(engine.etat.pv).toEqual({ j1: 100, j2: 0 }); // borné à 0 (I5)
    expect(engine.etat.fini).toBe(true);
    expect(engine.etat.gagnant).toBe('j1');
    expect(events.filter((e) => e.event === 'combat.ko')).toHaveLength(1);

    // combat terminé : plus de tour ni de résolution (K.O. unique)
    expect(() => engine.demarrerTour()).toThrow(/terminé/);
    expect(() => engine.resoudreTour(t, 5, 5)).toThrow(/terminé/);
    expect(events.filter((e) => e.event === 'combat.ko')).toHaveLength(1);
  });

  it('contre-attaque létale : le K.O. désigne le défenseur comme gagnant', () => {
    const engine = new CombatEngine({
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(9),
    });
    const t = engine.demarrerTour();
    const r = engine.resoudreTour(t, 1, 200); // whiff face à une défense écrasante
    expect(r.contre).toBe(true);
    expect(r.sur).toBe('attaquant');
    expect(engine.etat.pv.j1).toBe(0);
    expect(engine.etat.gagnant).toBe('j2');
  });

  it('énergie par défaut = celle des phases (I3)', () => {
    const engine = new CombatEngine({
      niveaux: { j1: 'intermediaire', j2: 'intermediaire' },
      aleatoire: alea(10),
    });
    const t = engine.demarrerTour();
    // 2 réussites d'attaque (difficile +7) et 1 réussite de défense (facile +1)
    t.phaseAttaque.resoudre('difficile', t.phaseAttaque.question('difficile').reponse);
    t.phaseAttaque.resoudre('difficile', t.phaseAttaque.question('difficile').reponse);
    t.phaseDefense.resoudre('facile', t.phaseDefense.question('facile').reponse);
    const r = engine.resoudreTour(t);
    expect(r.attaque).toBe(14);
    expect(r.defense).toBe(1);
    expect(r.degats).toBe(13);
  });

  it('coup bloqué en tour : aucun PV touché (I2, sur = aucun)', () => {
    const engine = new CombatEngine({
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(11),
    });
    const t = engine.demarrerTour();
    const r = engine.resoudreTour(t, 9, 9);
    expect(r.sur).toBe('aucun');
    expect(engine.etat.pv).toEqual({ j1: 100, j2: 100 });
    expect(r.ko).toBe(false);
  });

  it('trace : math.genere et math.reponse émis par la phase (callback)', () => {
    const events: { event: string; data?: Record<string, unknown> }[] = [];
    const engine = new CombatEngine({
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(12),
      emettre: (e) => events.push(e),
    });
    const t = engine.demarrerTour();
    t.phaseAttaque.resoudre('facile', t.phaseAttaque.question('facile').reponse);
    t.phaseAttaque.resoudre('moyen', null); // saisie non évaluée, tracée telle quelle
    expect(events.filter((e) => e.event === 'math.reponse')).toHaveLength(2);
    expect(events.filter((e) => e.event === 'math.genere').length).toBeGreaterThanOrEqual(7);
  });
});

describe('Rythme de calcul (I15)', () => {
  it('DIFFÉRÉ : deux phases enchaînées avec la même durée', () => {
    const events: { event: string; data?: Record<string, unknown> }[] = [];
    const engine = new CombatEngine({
      config: { ...CONFIG, rythme: 'differe' },
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(31),
      emettre: (e) => events.push(e),
    });
    engine.demarrerTour();
    const phases = events.filter((e) => e.event === 'combat.phase');
    expect(phases).toHaveLength(2);
    expect(phases[0].data?.rythme).toBe('differe');
    expect(phases[0].data?.duree).toBe(phases[1].data?.duree);
  });

  it('SIMULTANÉ : un seul chrono partagé', () => {
    const events: { event: string; data?: Record<string, unknown> }[] = [];
    const engine = new CombatEngine({
      config: { ...CONFIG, rythme: 'simultane' },
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(32),
      emettre: (e) => events.push(e),
    });
    engine.demarrerTour();
    const phases = events.filter((e) => e.event === 'combat.phase');
    expect(phases).toHaveLength(1);
    expect(phases[0].data?.chronoUnique).toBe(true);
    expect(phases[0].data?.duree).toBe(CONFIG.tempsPhase);
  });

  it('le rythme appliqué est celui de la configuration (jamais auto-adapté)', () => {
    const engine = new CombatEngine({
      config: { ...CONFIG, rythme: 'simultane' },
      niveaux: { j1: 'debutant', j2: 'debutant' },
      aleatoire: alea(33),
    });
    expect(engine.etat.rythme).toBe('simultane');
  });
});

describe('Mise en scène déterministe (I13, §2.8)', () => {
  it('tiers de frappe : 0 (whiff) puis 1..4 selon les bornes de config', () => {
    expect(tierFrappe(0)).toBe(0);
    expect(tierFrappe(1)).toBe(1);
    expect(tierFrappe(5)).toBe(1);
    expect(tierFrappe(6)).toBe(2);
    expect(tierFrappe(12)).toBe(2);
    expect(tierFrappe(13)).toBe(3);
    expect(tierFrappe(20)).toBe(3);
    expect(tierFrappe(21)).toBe(4);
    expect(tierFrappe(250)).toBe(4);
  });

  it('paliers d\'aura : 4 paliers sur energieVisuelleMax, saturation au-delà', () => {
    expect(palierAura(0)).toBe(0);
    expect(palierAura(7)).toBe(0); // 7/30 < 25 %
    expect(palierAura(8)).toBe(1); // ≥ 25 %
    expect(palierAura(15)).toBe(2); // ≥ 50 %
    expect(palierAura(22)).toBe(2);
    expect(palierAura(23)).toBe(3); // ≥ 75 %
    expect(palierAura(1000)).toBe(3); // plafond visuel uniquement (I11)
  });
});

describe('Couples d\'opérations par joueur (§2.5 / I14)', () => {
  it('chaque joueur attaque avec SON opération et défend avec son inverse', () => {
    const engine = new CombatEngine({
      niveaux: { j1: 'intermediaire', j2: 'intermediaire' },
      operations: { j1: 'addition', j2: 'multiplication' },
      aleatoire: alea(31),
    });
    // Tour 1 : J1 attaque en +, J2 défend avec l'inverse de SON couple (÷).
    const t1 = engine.demarrerTour();
    expect(t1.phaseAttaque.operation).toBe('addition');
    expect(t1.phaseDefense.operation).toBe('division');
    engine.resoudreTour(t1, 0, 0);

    // Tour 2 : J2 attaque en ×, J1 défend avec l'inverse de SON couple (−).
    const t2 = engine.demarrerTour();
    expect(t2.phaseAttaque.operation).toBe('multiplication');
    expect(t2.phaseDefense.operation).toBe('soustraction');
  });

  it('repli sur CONFIG.operation quand aucun couple n\'est fourni', () => {
    const engine = new CombatEngine({
      niveaux: { j1: 'debutant', j2: 'debutant' },
      config: { ...CONFIG, operation: 'division' },
      aleatoire: alea(32),
    });
    const t = engine.demarrerTour();
    expect(t.phaseAttaque.operation).toBe('division');
    expect(t.phaseDefense.operation).toBe('multiplication');
  });
});
