/**
 * MenuScene — écran de lancement rétro, style borne d'arcade (wireframes.md §1).
 *
 *  - **RUN clignotant au-dessus**, **CONFIG au-dessous** ;
 *  - cadre de borne, titre, baseline « FRAPPEZ AVEC VOTRE TÊTE » ;
 *  - mentions d'accueil « © 2026 MATHKOMBAT · INSERT COIN » ;
 *  - RUN part sur le combat avec **les règles enregistrées** (l'écran de sélection
 *    des personnages arrive au jalon suivant).
 *
 * Événements : `ui.clic` (`session.debut` est émis par `main.ts`).
 */
import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import { getLogger } from '../core/logger';
import { declarerEcran } from '../ui/ecran';
import { RETRO, creerBoutonRetro, creerCadreBorne, texteRetro } from '../ui/retro';

const log = getLogger('Menu');

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    declarerEcran('menu');
    this.cameras.main.setBackgroundColor(RETRO.fond);
    // fond d'illustration + voile de lisibilité (§2.7) — texture absente = fond uni
    if (this.textures.exists('fond-menu')) {
      this.add.image(640, 360, 'fond-menu').setDisplaySize(1280, 720);
      this.add.rectangle(640, 360, 1280, 720, 0x0d0820, CONFIG.ui.voileMenu);
    }
    creerCadreBorne(this);

    texteRetro(this, 640, 120, 'M  A  T  H  K  O  M  B  A  T', {
      taille: 54,
      couleur: RETRO.texteTitre,
      gras: true,
    });
    this.add.rectangle(640, 158, 470, 4, RETRO.cadre);
    texteRetro(this, 640, 200, '«  FRAPPEZ AVEC VOTRE TÊTE  »', {
      taille: 22,
      couleur: RETRO.texteAccent,
    });

    const run = creerBoutonRetro({
      scene: this,
      x: 640,
      y: 310,
      largeur: 340,
      hauteur: 72,
      libelle: '▶  R U N   ◀',
      taille: 32,
      couleur: RETRO.boutonLancer,
      onClic: () => this.lancer(),
    });
    creerBoutonRetro({
      scene: this,
      x: 640,
      y: 410,
      largeur: 340,
      hauteur: 72,
      libelle: '⚙   C O N F I G',
      taille: 28,
      onClic: () => this.ouvrirConfig(),
    });

    // Pas de HIGH SCORE pour l'instant (règle de calcul à définir — voir todo.md).
    texteRetro(this, 96, 630, '© 2026 MATHKOMBAT · INSERT COIN', {
      taille: 20,
      couleur: RETRO.textePale,
      origine: [0, 0.5],
    });

    // clignotement type « PRESS START » — intensités dans config.ts (§2.9)
    this.tweens.add({
      targets: run,
      alpha: 0.3,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inout',
    });

    // Entrée = RUN, comme la touche START d'une borne.
    this.input.keyboard?.on('keydown-ENTER', () => this.lancer());
  }

  /** RUN → combat avec les règles enregistrées (écran CONFIG mémorisé). */
  private lancer(): void {
    log.info('ui.clic', { ecran: 'menu', cible: 'run' });
    this.scene.start('Fight');
  }

  /** CONFIG → écran de configuration des règles (§2.7). */
  private ouvrirConfig(): void {
    log.info('ui.clic', { ecran: 'menu', cible: 'config' });
    this.scene.start('Config');
  }
}
