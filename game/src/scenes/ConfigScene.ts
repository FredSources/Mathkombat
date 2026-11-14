/**
 * ConfigScene — écran de configuration des règles (wireframes.md §2).
 *
 * Style écran de setup rétro : chaque ligne se règle avec les flèches **◀ ▶** ;
 * **RETOUR** abandonne, **RÉINITIALISER** restaure les valeurs par défaut,
 * **VALIDER** enregistre (`ui.validation`) et retourne au lancement.
 *
 * Les valeurs numériques sont **validées à la lecture** par `config.ts` (§2.9,
 * I9) : jamais de durée ni de PV hors plage, quelle que soit la façon d'y arriver.
 */
import Phaser from 'phaser';
import {
  BORNES_TEMPS_PHASE,
  CONFIG,
  ORDRE_PRESETS,
  PRESETS_TEMPO,
  appliquerReglages,
  lirePv,
  lireReglages,
  lireTempsPhase,
  presetDeTemps,
  reglagesDefaut,
} from '../core/config';
import type {
  Difficulte,
  ModeJeu,
  Niveau,
  PresetTempo,
  ReglagesConfig,
  Rythme,
} from '../core/config';
import { getLogger } from '../core/logger';
import { declarerEcran } from '../ui/ecran';
import { RETRO, creerBoutonRetro, creerCadreBorne, texteRetro } from '../ui/retro';

const log = getLogger('Config');

const MODES: readonly ModeJeu[] = ['solo', 'duel'];
const RYTHMES: readonly Rythme[] = ['differe', 'simultane'];
const NIVEAUX: readonly Niveau[] = ['debutant', 'intermediaire', 'avance'];
const DIFFICULTES_IA: readonly Difficulte[] = ['facile', 'moyen', 'difficile'];

const LIBELLES_MODE: Record<ModeJeu, string> = { solo: 'SOLO vs IA', duel: '2 JOUEURS' };
const LIBELLES_RYTHME: Record<Rythme, string> = { differe: 'DIFFÉRÉ', simultane: 'SIMULTANÉ' };
const LIBELLES_NIVEAU: Record<Niveau, string> = {
  debutant: 'DÉBUTANT',
  intermediaire: 'INTERMÉDIAIRE',
  avance: 'AVANCÉ',
};
const LIBELLES_IA: Record<Difficulte, string> = { facile: 'FACILE', moyen: 'MOYEN', difficile: 'DIFFICILE' };
const LIBELLES_PRESET: Record<Exclude<PresetTempo, 'personnalise'>, string> = {
  rapide: 'RAPIDE',
  normal: 'NORMAL',
  long: 'LONG',
};

/** Pas d'incrément des PV sur la ligne (§2.9 : plage 10–999). */
const PAS_PV = 10;

/** Une ligne de l'écran CONFIG : libellé, affichage courant, flèches ◀ ▶. */
interface LigneConfig {
  cle: string;
  libelle: string;
  /** Sous-ligne indentée (durée du preset TEMPO). */
  sous?: boolean;
  valeur: () => string;
  moins: () => void;
  plus: () => void;
  texte?: Phaser.GameObjects.Text;
}

/** Voisin dans une liste bornée (les extrémités restent sur place). */
function suivant<T>(liste: readonly T[], actuel: T, delta: number): T {
  const index = liste.indexOf(actuel);
  return liste[Math.min(liste.length - 1, Math.max(0, index + delta))];
}

export class ConfigScene extends Phaser.Scene {
  /** Copie de travail : rien n'est écrit dans `CONFIG` avant VALIDER. */
  private reglages: ReglagesConfig = lireReglages();
  /** Preset TEMPO affiché — re-dérivé quand la durée est réglée autrement. */
  private preset: PresetTempo = 'normal';
  private lignes: LigneConfig[] = [];

  constructor() {
    super('Config');
  }

  create(): void {
    declarerEcran('config');
    this.cameras.main.setBackgroundColor(RETRO.fond);
    // fond d'illustration + voile renforcé : lignes de réglage lisibles (§2.7)
    if (this.textures.exists('fond-config')) {
      this.add.image(640, 360, 'fond-config').setDisplaySize(1280, 720);
      this.add.rectangle(640, 360, 1280, 720, 0x0d0820, CONFIG.ui.voileConfig);
    }
    creerCadreBorne(this);
    this.reglages = lireReglages();
    this.preset = presetDeTemps(this.reglages.tempsPhase);
    this.lignes = [];

    texteRetro(this, 640, 60, 'C  O  N  F  I  G', {
      taille: 30,
      couleur: RETRO.texteTitre,
      gras: true,
    });
    creerBoutonRetro({
      scene: this,
      x: 175,
      y: 60,
      largeur: 210,
      hauteur: 48,
      libelle: '◀  RETOUR',
      taille: 22,
      onClic: () => this.retour(),
    });
    this.add.rectangle(640, 96, 1160, 3, RETRO.cadre);

    const dispos: readonly { ligne: LigneConfig; y: number }[] = [
      { ligne: this.ligneMode(), y: 145 },
      { ligne: this.ligneTempo(), y: 210 },
      { ligne: this.ligneDuree(), y: 258 },
      { ligne: this.ligneRythme(), y: 320 },
      { ligne: this.lignePv(), y: 380 },
      { ligne: this.ligneNiveau(), y: 440 },
      { ligne: this.ligneIa(), y: 500 },
    ];
    for (const { ligne, y } of dispos) this.dessinerLigne(ligne, y);

    this.add.rectangle(640, 552, 1160, 3, RETRO.cadre);
    creerBoutonRetro({
      scene: this,
      x: 430,
      y: 612,
      largeur: 320,
      hauteur: 56,
      libelle: '[  RÉINITIALISER  ]',
      taille: 22,
      onClic: () => this.reinitialiser(),
    });
    creerBoutonRetro({
      scene: this,
      x: 850,
      y: 612,
      largeur: 320,
      hauteur: 56,
      libelle: '[  V A L I D E R  ]',
      taille: 24,
      couleur: RETRO.boutonLancer,
      onClic: () => this.valider(),
    });

    // Retour arrière = même geste que le bouton RETOUR.
    this.input.keyboard?.on('keydown-ESC', () => this.retour());
  }

  // ------------------------------------------------------------- lignes

  private ligneMode(): LigneConfig {
    return {
      cle: 'mode',
      libelle: 'MODE .............',
      valeur: () => LIBELLES_MODE[this.reglages.mode],
      moins: () => {
        this.reglages.mode = suivant(MODES, this.reglages.mode, -1);
      },
      plus: () => {
        this.reglages.mode = suivant(MODES, this.reglages.mode, 1);
      },
    };
  }

  private ligneTempo(): LigneConfig {
    return {
      cle: 'tempo',
      libelle: 'TEMPO (att.=déf.) .',
      valeur: () =>
        this.preset === 'personnalise'
          ? `PERSONNALISÉ (${this.reglages.tempsPhase} s)`
          : `${LIBELLES_PRESET[this.preset]} (${PRESETS_TEMPO[this.preset]} s)`,
      moins: () => this.appliquerPreset(suivant(ORDRE_PRESETS, this.preset, -1)),
      plus: () => this.appliquerPreset(suivant(ORDRE_PRESETS, this.preset, 1)),
    };
  }

  private ligneDuree(): LigneConfig {
    return {
      cle: 'duree',
      libelle: 'durée',
      sous: true,
      valeur: () => `[— ${this.reglages.tempsPhase} s +]`,
      moins: () => this.reglerDuree(this.reglages.tempsPhase - 1),
      plus: () => this.reglerDuree(this.reglages.tempsPhase + 1),
    };
  }

  private ligneRythme(): LigneConfig {
    return {
      cle: 'rythme',
      libelle: 'RYTHME DE CALCUL .',
      valeur: () => LIBELLES_RYTHME[this.reglages.rythme],
      moins: () => {
        this.reglages.rythme = suivant(RYTHMES, this.reglages.rythme, -1);
      },
      plus: () => {
        this.reglages.rythme = suivant(RYTHMES, this.reglages.rythme, 1);
      },
    };
  }

  private lignePv(): LigneConfig {
    return {
      cle: 'pv',
      libelle: 'PV ...............',
      valeur: () => String(this.reglages.pvMax),
      moins: () => {
        this.reglages.pvMax = lirePv(this.reglages.pvMax - PAS_PV);
      },
      plus: () => {
        this.reglages.pvMax = lirePv(this.reglages.pvMax + PAS_PV);
      },
    };
  }

  private ligneNiveau(): LigneConfig {
    return {
      cle: 'niveau',
      libelle: 'NIVEAU DE CALCUL .',
      valeur: () => LIBELLES_NIVEAU[this.reglages.niveau],
      moins: () => {
        this.reglages.niveau = suivant(NIVEAUX, this.reglages.niveau, -1);
      },
      plus: () => {
        this.reglages.niveau = suivant(NIVEAUX, this.reglages.niveau, 1);
      },
    };
  }

  private ligneIa(): LigneConfig {
    return {
      cle: 'difficulteIa',
      libelle: 'DIFFICULTÉ IA ....',
      valeur: () => LIBELLES_IA[this.reglages.difficulteIA],
      moins: () => {
        this.reglages.difficulteIA = suivant(DIFFICULTES_IA, this.reglages.difficulteIA, -1);
      },
      plus: () => {
        this.reglages.difficulteIA = suivant(DIFFICULTES_IA, this.reglages.difficulteIA, 1);
      },
    };
  }

  // ------------------------------------------------------------- rendu & actions

  private dessinerLigne(ligne: LigneConfig, y: number): void {
    texteRetro(this, 110, y, ligne.libelle, {
      taille: ligne.sous ? 20 : 24,
      couleur: ligne.sous ? RETRO.texteAccent : RETRO.textePale,
      origine: [0, 0.5],
    });
    const fleche = (x: number, libelle: string, action: () => void): void => {
      creerBoutonRetro({
        scene: this,
        x,
        y,
        largeur: 56,
        hauteur: 40,
        libelle,
        taille: 26,
        couleur: RETRO.boutonFleche,
        onClic: action,
      });
    };
    fleche(700, '◀', () => this.agir(ligne, ligne.moins));
    fleche(1100, '▶', () => this.agir(ligne, ligne.plus));
    ligne.texte = texteRetro(this, 900, y, ligne.valeur(), {
      taille: 26,
      couleur: RETRO.texteTitre,
    });
    this.lignes.push(ligne);
  }

  /** Une flèche pressée : applique l'action, redessine TOUTES les valeurs
   *  (TEMPO et durée se déduisent l'une de l'autre) et trace l'événement. */
  private agir(ligne: LigneConfig, action: () => void): void {
    action();
    this.rafraichir();
    log.info('ui.clic', { ecran: 'config', ligne: ligne.cle, valeur: ligne.valeur() });
  }

  private rafraichir(): void {
    for (const ligne of this.lignes) ligne.texte?.setText(ligne.valeur());
  }

  /** Bascule de preset : la durée suit le preset choisi (§2.9). */
  private appliquerPreset(preset: PresetTempo): void {
    this.preset = preset;
    if (preset !== 'personnalise') this.reglages.tempsPhase = PRESETS_TEMPO[preset];
  }

  /** Curseur ◀ ▶ de la durée : libre mais **borné à la lecture** (§2.9). */
  private reglerDuree(secondes: number): void {
    this.reglages.tempsPhase = lireTempsPhase(secondes);
    this.preset = presetDeTemps(this.reglages.tempsPhase);
  }

  /** RETOUR : abandonne les réglages en cours (rien n'a été écrit dans CONFIG). */
  private retour(): void {
    log.info('ui.clic', { ecran: 'config', cible: 'retour' });
    this.scene.start('Menu');
  }

  /** RÉINITIALISER : valeurs par défaut de §2.9 (toujours éditées, jamais appliquées). */
  private reinitialiser(): void {
    this.reglages = reglagesDefaut();
    this.preset = presetDeTemps(this.reglages.tempsPhase);
    this.rafraichir();
    log.info('ui.clic', { ecran: 'config', cible: 'reinitialiser' });
  }

  /** VALIDER : écrit dans `CONFIG` **avec bornes appliquées** (I9) → lancement. */
  private valider(): void {
    appliquerReglages(CONFIG, this.reglages);
    this.reglages = lireReglages();
    this.preset = presetDeTemps(this.reglages.tempsPhase);
    log.info('ui.validation', {
      ecran: 'config',
      ...lireReglages(),
      preset: this.preset,
      bornesTemps: `${BORNES_TEMPS_PHASE.min}-${BORNES_TEMPS_PHASE.max}`,
    });
    this.scene.start('Menu');
  }
}
