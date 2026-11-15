/**
 * ui/retro.ts — primitives d'interface « borne d'arcade » (wireframes §1 et §2).
 *
 * Style rétro assumé : cadre, fonte monospace, commandes ◀ ▶, boutons à contour
 * épais. **Une seule implémentation partagée** par `MenuScene` et `ConfigScene`,
 * réglée par ses options — jamais recopiée écran par écran.
 */
import Phaser from 'phaser';

/** Palette des écrans rétro (écran de lancement + écran CONFIG). */
export const RETRO = {
  /** Fond des écrans rétro (aligné sur l'arrière-plan du jeu). */
  fond: 0x0d0820,
  /** Trait de cadre principal et de séparateurs. */
  cadre: 0x4c63a8,
  /** Trait de cadre secondaire (double filet des écrans de setup). */
  cadreDouble: 0x2c4079,
  /** Fond des boutons standards. */
  bouton: 0x1b2a52,
  /** Fond d'un bouton survolé (retour au repos = teinte d'origine du bouton). */
  boutonSurvol: 0x33497f,
  /** Fond du bouton RUN (lancement). */
  boutonLancer: 0x2f7a3d,
  /** Fond des flèches ◀ ▶. */
  boutonFleche: 0x243468,
  texte: '#e8f0ff',
  texteTitre: '#ffd76b',
  textePale: '#cfe3ff',
  texteAccent: '#7bd4ff',
} as const;

/** Options d'un bouton rétro : position au centre, libellé centré. */
export interface OptionsBoutonRetro {
  scene: Phaser.Scene;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  libelle: string;
  /** Taille de police en px (défaut 24). */
  taille?: number;
  /** Teinte de fond (défaut : fond de bouton standard). */
  couleur?: number;
  onClic: () => void;
}

/**
 * Bouton rétro : fond plein, contour épais, survol = contour blanc + fond
 * éclairci, retour exact au repos. Émet directement `onClic` (pas de re-émotion
 * de conteneur : le rectangle est l'objet interactif).
 */
export function creerBoutonRetro(options: OptionsBoutonRetro): Phaser.GameObjects.Container {
  const teinte = options.couleur ?? RETRO.bouton;
  const fond = options.scene.add
    .rectangle(0, 0, options.largeur, options.hauteur, teinte)
    .setStrokeStyle(3, RETRO.cadre)
    .setInteractive({ useHandCursor: true });
  const texte = options.scene.add
    .text(0, 0, options.libelle, {
      fontFamily: 'monospace',
      fontSize: `${options.taille ?? 24}px`,
      color: RETRO.texte,
      align: 'center',
    })
    .setOrigin(0.5);
  fond.on('pointerover', () => {
    fond.setFillStyle(RETRO.boutonSurvol).setStrokeStyle(3, 0xffffff);
  });
  fond.on('pointerout', () => {
    fond.setFillStyle(teinte).setStrokeStyle(3, RETRO.cadre);
  });
  fond.on('pointerdown', options.onClic);
  return options.scene.add.container(options.x, options.y, [fond, texte]);
}

/** Options d'un texte rétro. */
export interface OptionsTexteRetro {
  /** Taille de police en px (défaut 24). */
  taille?: number;
  /** Couleur CSS (défaut : texte courant). */
  couleur?: string;
  /** Gras (titres). */
  gras?: boolean;
  /** Ancrage : [0.5, 0.5] centré (défaut) ou [0, 0.5] aligné à gauche. */
  origine?: readonly [number, number];
}

/** Un texte de l'écran rétro (monospace, centré par défaut). */
export function texteRetro(
  scene: Phaser.Scene,
  x: number,
  y: number,
  contenu: string,
  options: OptionsTexteRetro = {}
): Phaser.GameObjects.Text {
  const [ox, oy] = options.origine ?? [0.5, 0.5];
  return scene.add
    .text(x, y, contenu, {
      fontFamily: 'monospace',
      fontSize: `${options.taille ?? 24}px`,
      color: options.couleur ?? RETRO.texte,
      fontStyle: options.gras ? 'bold' : 'normal',
    })
    .setOrigin(ox, oy);
}

/** Voisin dans une liste bornée (flèches ◀ ▶ des écrans rétro). */
export function suivant<T>(liste: readonly T[], actuel: T, delta: number): T {
  const index = liste.indexOf(actuel);
  return liste[Math.min(liste.length - 1, Math.max(0, index + delta))];
}

/**
 * Cadre de borne d'arcade : double filet inscrit dans l'écran (§1), repris sur
 * l'écran CONFIG pour que les deux écrans rétro partagent la même ossature.
 */
export function creerCadreBorne(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  scene.add.rectangle(width / 2, height / 2, width - 48, height - 48)
    .setStrokeStyle(6, RETRO.cadre);
  scene.add.rectangle(width / 2, height / 2, width - 66, height - 66)
    .setStrokeStyle(2, RETRO.cadreDouble);
}
