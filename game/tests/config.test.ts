/**
 * Tests Vitest — configuration d'équilibrage (§2.8b) : table des coups
 * articulés `coupsParTier`, helper `coupPourTier`, paramètres du rig.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG, coupPourTier } from '../src/core/config.ts';
import type { ModeJeu } from '../src/core/config.ts';

describe('mode de jeu (§2.6)', () => {
  it('mode par défaut : solo (J1 vs IA)', () => {
    expect(CONFIG.mode).toBe('solo');
  });

  it('le mode duel est disponible sans toucher aux autres réglages', () => {
    const duel: ModeJeu = 'duel';
    expect({ ...CONFIG, mode: duel }).toMatchObject({ mode: 'duel', rythme: 'differe' });
  });
});

describe('interface — surbrillance des touches (§2.7)', () => {
  it('durée de surbrillance strictement positive et bornée', () => {
    expect(CONFIG.ui.surbrillanceMs).toBeGreaterThan(0);
    expect(CONFIG.ui.surbrillanceMs).toBeLessThanOrEqual(1000);
  });

  it('teinte de surbrillance dans ]0, 1] : éclaircit sans blanchir totalement', () => {
    expect(CONFIG.ui.surbrillanceTeinte).toBeGreaterThan(0);
    expect(CONFIG.ui.surbrillanceTeinte).toBeLessThanOrEqual(1);
  });
});

describe('coupPourTier — §2.8b (coupsParTier)', () => {
  it('tier 0 (whiff) et tier 1 → poing', () => {
    expect(coupPourTier(0)).toBe('poing');
    expect(coupPourTier(1)).toBe('poing');
  });

  it('tiers intermédiaires et lourds → poing puis pied (bas, haut)', () => {
    expect(coupPourTier(2)).toBe('poing');
    expect(coupPourTier(3)).toBe('pied-bas');
    expect(coupPourTier(4)).toBe('pied-haut');
  });

  it('tier hors table → dernier coup de la table (pas d\'index hors bornes)', () => {
    expect(coupPourTier(99)).toBe('pied-haut');
  });

  it('table vide → repli « poing »', () => {
    expect(coupPourTier(1, { ...CONFIG, coupsParTier: [] })).toBe('poing');
  });

  it('la table compte 4 entrées et chaque coup a sa hauteur d\'impact', () => {
    expect(CONFIG.coupsParTier).toHaveLength(4);
    for (const coup of CONFIG.coupsParTier) {
      expect(CONFIG.rig.impactY[coup]).toBeGreaterThan(0);
    }
  });
});

describe('rig — angles et durées (§2.8b/c)', () => {
  it('garde haute > poing (bras levé au-dessus de la tête)', () => {
    expect(CONFIG.rig.angles.gardeHaute).toBeGreaterThan(CONFIG.rig.angles.poing);
  });

  it('pied bas < pied haut (coup de bas ↔ coup de haut)', () => {
    expect(CONFIG.rig.angles.piedBas).toBeLessThan(CONFIG.rig.angles.piedHaut);
  });

  it('contre : coup de pied de riposte + saut bornés', () => {
    expect(CONFIG.rig.angles.contrePied).toBeGreaterThan(CONFIG.rig.angles.piedHaut);
    expect(CONFIG.rig.sautHauteur).toBeGreaterThan(0);
    expect(CONFIG.rig.sautDureeMs).toBeGreaterThan(0);
  });

  it('extension et retour au repos : durées strictement positives', () => {
    expect(CONFIG.rig.dureeExtensionMs).toBeGreaterThan(0);
    expect(CONFIG.rig.dureeRetourMs).toBeGreaterThan(0);
    expect(CONFIG.rig.flashCoupMs).toBeGreaterThan(0);
  });
});
