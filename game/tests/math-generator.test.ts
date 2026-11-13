/**
 * Tests Vitest — moteur mathématique (jalons J2).
 *
 * Couvre les scénarios L2 S01→S03 et les invariants I3, I4, I6, I7, I11
 * (docs/test-plan.md), plus la non-répétition (§2.5) et la commutativité.
 */
import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  Difficulte,
  Niveau,
  cleFait,
  estResistant,
} from '../src/core/config';
import {
  GenerateurMath,
  classerFait,
  energiePhase,
  evaluerReponse,
  gainObtenu,
  poolFaits,
} from '../src/core/math-generator';

const NIVEAUX: Niveau[] = ['debutant', 'intermediaire', 'avance'];
const DIFFICULTES: Difficulte[] = ['facile', 'moyen', 'difficile'];

/** Générateur déterministe (mulberry32) — tests reproductibles. */
function alea(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('classerFait — couleur du fait (§2.5, I11)', () => {
  it('🟢 facile : au moins un facteur ∈ {1, 2, 5, 10}', () => {
    for (const [a, b] of [
      [1, 8],
      [2, 7],
      [5, 6],
      [10, 9],
      [7, 10],
    ] as const) {
      expect(classerFait(a, b)).toBe('facile');
    }
  });

  it('🟡 moyen : pas de facteur vert, au moins un facteur jaune', () => {
    for (const [a, b] of [
      [3, 7],
      [4, 7],
      [9, 7],
      [3, 4],
      [11, 7],
      [12, 9],
    ] as const) {
      expect(classerFait(a, b)).toBe('moyen');
    }
  });

  it('🟠 difficile : les 5 faits résistants (forcés, même avec un facteur jaune)', () => {
    for (const fait of CONFIG.familles.resistants) {
      expect(classerFait(fait[0], fait[1])).toBe('difficile');
      expect(estResistant(fait[0], fait[1])).toBe(true);
    }
  });

  it('commutativité : a×b et b×a ont la même couleur', () => {
    for (let a = 1; a <= 12; a++) {
      for (let b = 1; b <= 12; b++) {
        expect(classerFait(a, b)).toBe(classerFait(b, a));
        expect(cleFait(a, b)).toBe(cleFait(b, a));
      }
    }
  });
});

describe('poolFaits — bornes et remplissage (I6, I11)', () => {
  it('tous les faits du pool ont le second facteur ≤ borne du niveau (I6)', () => {
    for (const niveau of NIVEAUX) {
      const borne = CONFIG.bornesNiveau[niveau];
      for (const diff of DIFFICULTES) {
        for (const [table, second] of poolFaits(diff, niveau)) {
          expect(table).toBeGreaterThanOrEqual(1);
          expect(table).toBeLessThanOrEqual(12);
          expect(second).toBeGreaterThanOrEqual(1);
          expect(second).toBeLessThanOrEqual(borne);
        }
      }
    }
  });

  it('les faits du pool ont bien la couleur demandée (I11)', () => {
    for (const niveau of NIVEAUX) {
      for (const diff of DIFFICULTES) {
        for (const [table, second] of poolFaits(diff, niveau)) {
          // exception assumée : le repli Débutant génère des faits 🟡 en « difficile »
          const repli =
            diff === 'difficile' &&
            niveau === 'debutant' &&
            poolFaits('difficile', 'debutant').length > 0 &&
            !estResistant(table, second);
          if (!repli) expect(classerFait(table, second)).toBe(diff);
        }
      }
    }
  });

  it('repli Débutant : difficile = {3×3, 3×4, 4×4} (résistants impossibles)', () => {
    const pool = poolFaits('difficile', 'debutant');
    const cles = new Set(pool.map(([t, s]) => cleFait(t, s)));
    expect(cles).toEqual(new Set(['3x3', '3x4', '4x4']));
  });

  it('résistants présents dès Intermédiaire (5 faits, I11)', () => {
    for (const niveau of ['intermediaire', 'avance'] as Niveau[]) {
      const cles = new Set(poolFaits('difficile', niveau).map(([t, s]) => cleFait(t, s)));
      for (const [a, b] of CONFIG.familles.resistants) {
        expect(cles.has(cleFait(a, b))).toBe(true);
      }
    }
  });

  it('aucun pool vide à toute combinaison difficulté × niveau', () => {
    for (const niveau of NIVEAUX) {
      for (const diff of DIFFICULTES) {
        expect(poolFaits(diff, niveau).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('GenerateurMath — S01 multiplications (bornes, unicité)', () => {
  it('500 tirages : bornes respectées et jamais deux fois le même fait de suite', () => {
    const gen = new GenerateurMath(CONFIG, alea(42));
    for (const niveau of NIVEAUX) {
      for (const diff of DIFFICULTES) {
        let precedent = '';
        for (let i = 0; i < 500; i++) {
          const q = gen.nouvelleQuestion('multiplication', diff, niveau);
          const [t, s] = q.fait;
          expect(t).toBeLessThanOrEqual(12);
          expect(s).toBeLessThanOrEqual(CONFIG.bornesNiveau[niveau]);
          expect(q.reponse).toBe(t * s);
          expect(q.enonce).toBe(`${t} × ${s}`);
          expect(q.gain).toBe(CONFIG.gains[diff]);
          const cle = cleFait(t, s);
          if (poolFaits(diff, niveau).length > 1) expect(cle).not.toBe(precedent);
          precedent = cle;
        }
      }
    }
  });
});

describe('GenerateurMath — S02 divisions (exactitude, bornes)', () => {
  it('500 tirages : division exacte, quotient ≤ borne, couleur conforme', () => {
    const gen = new GenerateurMath(CONFIG, alea(7));
    for (const niveau of NIVEAUX) {
      for (const diff of DIFFICULTES) {
        for (let i = 0; i < 500; i++) {
          const q = gen.nouvelleQuestion('division', diff, niveau);
          const [t, s] = q.fait;
          const dividende = t * s;
          expect(q.enonce).toBe(`${dividende} ÷ ${t}`);
          expect(dividende % t).toBe(0); // I7 : exacte
          expect(q.reponse).toBe(dividende / t); // I7 : quotient unique
          expect(q.reponse).toBeLessThanOrEqual(CONFIG.bornesNiveau[niveau]); // I6
        }
      }
    }
  });
});

describe('Évaluation et énergie — S03 (I3, I4)', () => {
  const gen = new GenerateurMath(CONFIG, alea(13));

  it('un calcul résolu rapporte son gain, raté ou non évalué rapporte 0 (I3, I4)', () => {
    const q = gen.nouvelleQuestion('multiplication', 'difficile', 'intermediaire');
    expect(gainObtenu(q, evaluerReponse(q, q.reponse))).toBe(7);
    expect(gainObtenu(q, evaluerReponse(q, q.reponse + 1))).toBe(0);
    expect(gainObtenu(q, evaluerReponse(q, null))).toBe(0);
    expect(gainObtenu(q, evaluerReponse(q, undefined))).toBe(0);
  });

  it('énergie de phase = somme des gains des calculs résolus (I3)', () => {
    const gains = [
      gainObtenu(gen.nouvelleQuestion('multiplication', 'facile', 'avance'), true),
      gainObtenu(gen.nouvelleQuestion('multiplication', 'moyen', 'avance'), true),
      gainObtenu(gen.nouvelleQuestion('multiplication', 'difficile', 'avance'), false),
      gainObtenu(gen.nouvelleQuestion('division', 'difficile', 'avance'), true),
    ];
    expect(energiePhase(gains)).toBe(1 + 3 + 0 + 7);
  });

  it('gains par difficulté = +1 / +3 / +7 (§2.2)', () => {
    expect(CONFIG.gains).toEqual({ facile: 1, moyen: 3, difficile: 7 });
    for (const diff of DIFFICULTES) {
      const q = gen.nouvelleQuestion('multiplication', diff, 'intermediaire');
      expect(q.gain).toBe(CONFIG.gains[diff]);
    }
  });

  it('la saisie n\'est évaluée qu\'à la validation : entier exact requis', () => {
    const q = gen.nouvelleQuestion('division', 'facile', 'debutant');
    expect(evaluerReponse(q, q.reponse)).toBe(true);
    expect(evaluerReponse(q, q.reponse + 0.5)).toBe(false);
    expect(evaluerReponse(q, NaN)).toBe(false);
  });
});

describe('Garde-fous (I14, robustesse)', () => {
  it('refuse les opérations non implémentées en v1 (+, −)', () => {
    const gen = new GenerateurMath(CONFIG, alea(1));
    expect(() => gen.nouvelleQuestion('addition', 'facile', 'debutant')).toThrow();
    expect(() => gen.nouvelleQuestion('soustraction', 'facile', 'debutant')).toThrow();
  });

  it('réponses dans l\'intervalle 0–144 (12×12, §2.7)', () => {
    const gen = new GenerateurMath(CONFIG, alea(5));
    for (const niveau of NIVEAUX) {
      for (const diff of DIFFICULTES) {
        for (let i = 0; i < 100; i++) {
          const q = gen.nouvelleQuestion('multiplication', diff, niveau);
          expect(q.reponse).toBeGreaterThanOrEqual(0);
          expect(q.reponse).toBeLessThanOrEqual(144);
        }
      }
    }
  });

  it('générateur par défaut (Math.random) fonctionnel', () => {
    const gen = new GenerateurMath();
    const q = gen.nouvelleQuestion('multiplication', 'facile', 'intermediaire');
    expect(q.reponse).toBe(q.fait[0] * q.fait[1]);
    expect(q.gain).toBe(1);
  });
});

describe('Chemins défensifs (robustesse du cœur)', () => {
  it('classement : deux facteurs « durs » non résistants → difficile (fallback)', () => {
    const sansResistants = { ...CONFIG, familles: { ...CONFIG.familles, resistants: [] } };
    expect(classerFait(7, 7, sansResistants)).toBe('difficile');
  });

  it('pool d\'un seul fait : tirage direct sans filtre de non-répétition', () => {
    const monoFait = {
      ...CONFIG,
      familles: { ...CONFIG.familles, resistants: [], repliDebutant: [[3, 3]] as const },
    };
    const gen = new GenerateurMath(monoFait, alea(9));
    for (let i = 0; i < 5; i++) {
      expect(gen.nouvelleQuestion('multiplication', 'difficile', 'debutant').enonce).toBe('3 × 3');
    }
  });

  it('pool épuisé par la non-répétition → tirage de secours dans le pool entier', () => {
    const doublons = {
      ...CONFIG,
      familles: {
        ...CONFIG.familles,
        resistants: [],
        repliDebutant: [
          [3, 3],
          [3, 3],
        ] as const,
      },
    };
    const gen = new GenerateurMath(doublons, alea(11));
    const q1 = gen.nouvelleQuestion('multiplication', 'difficile', 'debutant');
    const q2 = gen.nouvelleQuestion('multiplication', 'difficile', 'debutant');
    expect(q1.enonce).toBe('3 × 3');
    expect(q2.enonce).toBe('3 × 3'); // « sauf impossibilité » (§2.5)
  });

  it('pool vide → erreur explicite (garde-fou)', () => {
    const vide = {
      ...CONFIG,
      familles: { ...CONFIG.familles, resistants: [], repliDebutant: [] as const },
    };
    const gen = new GenerateurMath(vide, alea(3));
    expect(() => gen.nouvelleQuestion('multiplication', 'difficile', 'debutant')).toThrow(
      /Pool vide/
    );
  });
});
