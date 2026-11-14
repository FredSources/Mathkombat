/**
 * Tests Vitest — score de combat (demande utilisateur, §2.7) :
 * énergies gagnées + secondes restantes + bonus K.O.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config.ts';
import { calculerScore, scoreEnCours } from '../src/core/score.ts';

describe('calculerScore — règle « score de combat »', () => {
  it('score = énergies gagnées + secondes restantes', () => {
    expect(calculerScore({ energieGagnee: 11, secondesRestantes: 24 }, false)).toBe(35);
  });

  it('la victoire ajoute le bonus K.O.', () => {
    expect(calculerScore({ energieGagnee: 11, secondesRestantes: 24 }, true)).toBe(35 + CONFIG.score.bonusKo);
    expect(calculerScore({ energieGagnee: 0, secondesRestantes: 0 }, true)).toBe(CONFIG.score.bonusKo);
  });

  it('score en cours = même formule sans bonus K.O.', () => {
    const mesures = { energieGagnee: 4, secondesRestantes: 12 };
    expect(scoreEnCours(mesures)).toBe(16);
    expect(scoreEnCours(mesures)).toBe(calculerScore(mesures, false));
    expect(scoreEnCours(mesures)).not.toBe(calculerScore(mesures, true));
  });

  it('mesures partielles : entières, jamais négatives', () => {
    expect(calculerScore({ energieGagnee: 2.4, secondesRestantes: 3.6 }, false)).toBe(6);
    expect(calculerScore({ energieGagnee: -5, secondesRestantes: -3 }, false)).toBe(0);
    expect(calculerScore({ energieGagnee: -5, secondesRestantes: -3 }, true)).toBe(CONFIG.score.bonusKo);
  });

  it('facteurs de config appliqués (équilibrage hors code)', () => {
    const dur = { ...CONFIG, score: { facteurEnergie: 2, facteurTempsRestant: 0.5, bonusKo: 10 } };
    expect(calculerScore({ energieGagnee: 5, secondesRestantes: 20 }, false, dur)).toBe(20);
    expect(calculerScore({ energieGagnee: 5, secondesRestantes: 20 }, true, dur)).toBe(30);
    expect(scoreEnCours({ energieGagnee: 5, secondesRestantes: 20 }, dur)).toBe(20);
  });

  it('aucun score négatif quel que soit le résultat', () => {
    for (const gagne of [false, true]) {
      expect(calculerScore({ energieGagnee: 0, secondesRestantes: 0 }, gagne)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('réglages de score (config)', () => {
  it('facteurs positifs, bonus K.O. strictement positif', () => {
    expect(CONFIG.score.facteurEnergie).toBeGreaterThan(0);
    expect(CONFIG.score.facteurTempsRestant).toBeGreaterThan(0);
    expect(CONFIG.score.bonusKo).toBeGreaterThan(0);
  });
});
