/**
 * ui/pause-overlay.ts — menu de pause en cours de jeu (demande utilisateur).
 *
 * Bouton **☰ MENU** dans le HUD du combat → overlay plein écran avec :
 *  - **[ RETOUR AU JEU ]** : reprendre exactement où l'on en était ;
 *  - **[ QUITTER → MENU ]** : abandonner et revenir à l'écran de lancement.
 *
 * L'overlay est un bloc unique masquable (`setVisible`) : son voile interactif
 * bloque tous les clics du jeu en dessous tant qu'il est ouvert.
 */
import Phaser from 'phaser';
import { RETRO, creerBoutonRetro, texteRetro } from './retro';

/** Position de l'overlay (scène 1280×720) et de ses deux commandes. */
export const PLACE_PAUSE = {
  titre: { x: 640, y: 268 },
  cadre: { x: 640, y: 360, largeur: 560, hauteur: 300 },
  reprendre: { x: 640, y: 355 },
  quitter: { x: 640, y: 445 },
  largeurBouton: 420,
  hauteurBouton: 64,
} as const;

export interface OptionsPause {
  scene: Phaser.Scene;
  onReprendre: () => void;
  onQuitter: () => void;
}

export class PauseOverlay {
  private readonly conteneur: Phaser.GameObjects.Container;

  constructor(options: OptionsPause) {
    const scene = options.scene;
    const p = PLACE_PAUSE;
    this.conteneur = scene.add.container(0, 0).setDepth(1000);
    // voile interactif : bloque les clics du jeu (claviers, calculs) en dessous
    const voile = scene.add
      .rectangle(640, 360, 1280, 720, 0x0d0820, 0.75)
      .setInteractive();
    const cadre = scene.add
      .rectangle(p.cadre.x, p.cadre.y, p.cadre.largeur, p.cadre.hauteur)
      .setStrokeStyle(4, RETRO.cadre);
    const titre = texteRetro(scene, p.titre.x, p.titre.y, 'P A U S E', {
      taille: 36,
      couleur: RETRO.texteTitre,
      gras: true,
    });
    const reprendre = creerBoutonRetro({
      scene,
      x: p.reprendre.x,
      y: p.reprendre.y,
      largeur: p.largeurBouton,
      hauteur: p.hauteurBouton,
      libelle: '[  RETOUR AU JEU  ]',
      taille: 26,
      couleur: RETRO.boutonLancer,
      onClic: options.onReprendre,
    });
    const quitter = creerBoutonRetro({
      scene,
      x: p.quitter.x,
      y: p.quitter.y,
      largeur: p.largeurBouton,
      hauteur: p.hauteurBouton,
      libelle: '[  QUITTER → MENU  ]',
      taille: 26,
      onClic: options.onQuitter,
    });
    this.conteneur.add([voile, cadre, titre, reprendre, quitter]);
    this.conteneur.setVisible(false);
  }

  ouvrir(): void {
    this.conteneur.setVisible(true);
  }

  fermer(): void {
    this.conteneur.setVisible(false);
  }

  get ouvert(): boolean {
    return this.conteneur.visible;
  }
}
