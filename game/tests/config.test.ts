/**
 * Tests Vitest — configuration d'équilibrage (§2.8b) : table des coups
 * articulés `coupsParTier`, helper `coupPourTier`, paramètres du rig.
 */
import { describe, expect, it } from 'vitest';
import {
  BORNES_PV,
  BORNES_TEMPS_PHASE,
  CONFIG,
  ORDRE_PRESETS,
  PRESETS_TEMPO,
  PV_DEFAUT,
  appliquerReglages,
  coupPourTier,
  lirePv,
  lireReglages,
  lireTempsPhase,
  presetDeTemps,
  reglagesDefaut,
} from '../src/core/config.ts';
import type { ModeJeu } from '../src/core/config.ts';

describe('mode de jeu (§2.6)', () => {
  it('mode par défaut : solo (J1 vs IA)', () => {
    expect(CONFIG.mode).toBe('solo');
  });

  it('le mode duel est disponible sans toucher aux autres réglages', () => {
    const duel: ModeJeu = 'duel';
    expect({ ...CONFIG, mode: duel }).toMatchObject({ mode: 'duel', rythme: 'simultane' });
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

  it('voiles des fonds d\'illustration : opacités valides, plus fortes en CONFIG', () => {
    expect(CONFIG.ui.voileMenu).toBeGreaterThan(0);
    expect(CONFIG.ui.voileMenu).toBeLessThanOrEqual(1);
    expect(CONFIG.ui.voileConfig).toBeGreaterThan(0);
    expect(CONFIG.ui.voileConfig).toBeLessThanOrEqual(1);
    expect(CONFIG.ui.voileConfig).toBeGreaterThanOrEqual(CONFIG.ui.voileMenu);
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

describe('rig — mise en scène des sprites (§2.8b/c)', () => {
  it('saut du contre : hauteur et durée strictement positives', () => {
    expect(CONFIG.rig.sautHauteur).toBeGreaterThan(0);
    expect(CONFIG.rig.sautDureeMs).toBeGreaterThan(0);
  });

  it('déplacements : pas et durée strictement positifs', () => {
    expect(CONFIG.rig.deplacementPas).toBeGreaterThan(0);
    expect(CONFIG.rig.deplacementDureeMs).toBeGreaterThan(0);
  });

  it('coup : pénétration bornée (le sprite touche l\'adversaire) et durées', () => {
    expect(CONFIG.rig.penetrationFrappe).toBeGreaterThan(0);
    expect(CONFIG.rig.penetrationFrappe).toBeLessThan(200);
    expect(CONFIG.rig.approcheDureeMs).toBeGreaterThan(0);
    expect(CONFIG.rig.retourDureeMs).toBeGreaterThan(0);
    expect(CONFIG.rig.dureeExtensionMs).toBeGreaterThan(0);
  });

  it('impacts : hauteurs par coup et chute du K.O. bornées', () => {
    for (const coup of ['poing', 'pied-bas', 'pied-haut'] as const) {
      expect(CONFIG.rig.impactY[coup]).toBeGreaterThan(0);
    }
    expect(CONFIG.rig.koChuteY).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ écran CONFIG

/** Copie indépendante : les tests ne mutent jamais le CONFIG partagé. */
const copieConfig = () => ({ ...CONFIG, ia: { ...CONFIG.ia } });

describe('lecture validée de la config (§2.9 / I9)', () => {
  it('durée de phase : valeur dans la plage conservée, arrondie', () => {
    expect(lireTempsPhase(45)).toBe(45);
    expect(lireTempsPhase(14.6)).toBe(15);
  });

  it('durée de phase : hors plage ramenée à la borne', () => {
    expect(lireTempsPhase(0)).toBe(BORNES_TEMPS_PHASE.min);
    expect(lireTempsPhase(-3)).toBe(BORNES_TEMPS_PHASE.min);
    expect(lireTempsPhase(61)).toBe(BORNES_TEMPS_PHASE.max);
  });

  it('durée de phase : valeur non finie (NaN, infini) → défaut 15 s', () => {
    expect(lireTempsPhase(Number.NaN)).toBe(PRESETS_TEMPO.normal);
    expect(lireTempsPhase(Number.POSITIVE_INFINITY)).toBe(PRESETS_TEMPO.normal);
  });

  it('PV : valeur dans la plage conservée, hors plage ramenée à la borne', () => {
    expect(lirePv(100)).toBe(100);
    expect(lirePv(5)).toBe(BORNES_PV.min);
    expect(lirePv(5000)).toBe(BORNES_PV.max);
  });

  it('PV : valeur non finie → défaut (PV_DEFAUT)', () => {
    expect(lirePv(Number.NaN)).toBe(PV_DEFAUT);
    expect(lirePv(Number.NEGATIVE_INFINITY)).toBe(PV_DEFAUT);
  });

  it('bornes cohérentes : min < max et défauts à l\'intérieur', () => {
    expect(BORNES_TEMPS_PHASE.min).toBeLessThan(BORNES_TEMPS_PHASE.max);
    expect(BORNES_PV.min).toBeLessThan(BORNES_PV.max);
    expect(lirePv(PV_DEFAUT)).toBe(PV_DEFAUT);
    expect(lireTempsPhase(PRESETS_TEMPO.normal)).toBe(PRESETS_TEMPO.normal);
  });
});

describe('presets de tempo (§2.9)', () => {
  it('la durée exacte d\'un preset est reconnue', () => {
    expect(presetDeTemps(PRESETS_TEMPO.rapide)).toBe('rapide');
    expect(presetDeTemps(PRESETS_TEMPO.normal)).toBe('normal');
    expect(presetDeTemps(PRESETS_TEMPO.long)).toBe('long');
  });

  it('toute autre durée est « personnalisée »', () => {
    expect(presetDeTemps(45)).toBe('personnalise');
    expect(presetDeTemps(7)).toBe('personnalise');
  });

  it('presets strictement croissants et défilement ◀ ▶ complet', () => {
    expect(PRESETS_TEMPO.rapide).toBeLessThan(PRESETS_TEMPO.normal);
    expect(PRESETS_TEMPO.normal).toBeLessThan(PRESETS_TEMPO.long);
    expect(ORDRE_PRESETS).toEqual(['rapide', 'normal', 'long', 'personnalise']);
  });
});

describe('réglages de l\'écran CONFIG (§2.7)', () => {
  it('valeurs par défaut conformes à §2.9', () => {
    expect(reglagesDefaut()).toEqual({
      mode: 'solo',
      tempsPhase: PRESETS_TEMPO.normal,
      rythme: 'simultane',
      pvMax: PV_DEFAUT,
      niveau: 'intermediaire',
      difficulteIA: 'moyen',
    });
  });

  it('lecture d\'une config personnalisée (sans argument = CONFIG courant)', () => {
    const cible = copieConfig();
    appliquerReglages(cible, {
      mode: 'duel',
      tempsPhase: 10,
      rythme: 'simultane',
      pvMax: 250,
      niveau: 'avance',
      difficulteIA: 'difficile',
    });
    expect(lireReglages(cible)).toEqual({
      mode: 'duel',
      tempsPhase: 10,
      rythme: 'simultane',
      pvMax: 250,
      niveau: 'avance',
      difficulteIA: 'difficile',
    });
    expect(lireReglages()).toEqual(lireReglages(CONFIG));
  });

  it('validation : bornes appliquées, autres réglages inchangés', () => {
    const cible = copieConfig();
    const avant = { gains: { ...cible.gains }, ia: { ...cible.ia } };
    appliquerReglages(cible, {
      mode: 'duel',
      tempsPhase: 999,
      rythme: 'simultane',
      pvMax: 0,
      niveau: 'debutant',
      difficulteIA: 'facile',
    });
    expect(cible.tempsPhase).toBe(BORNES_TEMPS_PHASE.max);
    expect(cible.pvMax).toBe(BORNES_PV.min);
    expect(cible.mode).toBe('duel');
    expect(cible.rythme).toBe('simultane');
    expect(cible.niveau).toBe('debutant');
    expect(cible.ia.difficulte).toBe('facile');
    // rien d'autre n'a bougé : gains d'énergie et réglages de l'IA
    expect(cible.gains).toEqual(avant.gains);
    expect(cible.ia.rendementMax).toBe(avant.ia.rendementMax);
    expect(cible.ia.tauxReussite).toEqual(avant.ia.tauxReussite);
    expect(cible.ia.dureeChronoIA).toBe(avant.ia.dureeChronoIA);
  });

  it('niveau par défaut : intermédiaire (bornes 5 / 10 / 12)', () => {
    expect(CONFIG.niveau).toBe('intermediaire');
    expect(CONFIG.bornesNiveau[CONFIG.niveau]).toBe(10);
  });
});
