/**
 * BootScene — chargement des assets (J5) puis ouverture de l'écran de
 * lancement (J6 étape 2 : Menu RUN/CONFIG).
 * Assets servis depuis `game/assets/` (publicDir Vite) : arène, sprites des
 * combattants (style Mortal Kombat), effets et sons.
 */
import Phaser from 'phaser';
import { getLogger } from '../core/logger';

const log = getLogger('Boot');

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('arene', 'decors/arene-1.png');
    this.load.image('flamme1', 'effets/flamme-1.png');
    this.load.image('flamme2', 'effets/flamme-2.png');
    // sons du combat (scripts/assets-sons.py — synthèse WAV déterministe)
    for (const nom of ['reussite', 'erreur', 'frappe', 'blocage', 'ko']) {
      this.load.audio(nom, `sons/${nom}.wav`);
    }
    // fonds d'illustration des écrans rétro (RUN / CONFIG, J6 étape 2)
    for (const nom of ['fond-menu', 'fond-config']) {
      this.load.image(nom, `fonds/${nom}.png`);
    }
    // sprites des combattants animés (style Mortal Kombat, docs/assets.md) :
    // 8 poses par combattant, clés `mk-<id>-<i>`
    const poses = [
      'garde', 'marche-avant', 'marche-arriere', 'saut',
      'poing', 'pied', 'garde-defense', 'touche',
    ];
    for (const id of ['j1', 'j2', 'h2', 'f2', 'z1', 'z2']) {
      poses.forEach((pose, i) => {
        this.load.image(`mk-${id}-${i}`, `sprites-mk/${id}-${i}-${pose}.png`);
      });
    }
    // cycles de marche (8 frames de pas par combattant), clés `mk-m<id>-<i>`
    for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) {
      for (let i = 0; i < 8; i++) {
        this.load.image(`mk-${id}-${i}`, `sprites-mk/${id}-${i}.png`);
      }
    }
  }

  create(): void {
    log.info('session.boot', { largeur: this.scale.width, hauteur: this.scale.height });
    log.info('assets.pret', {
      arene: this.textures.exists('arene'),
      flamme1: this.textures.exists('flamme1'),
      flamme2: this.textures.exists('flamme2'),
      // 6 combattants × 8 poses (sprites style Mortal Kombat)
      spritesMk: ['j1', 'j2', 'h2', 'f2', 'z1', 'z2'].filter((id) =>
        Array.from({ length: 8 }, (_, i) => this.textures.exists(`mk-${id}-${i}`)).every(Boolean)
      ).length,
      sons: ['reussite', 'erreur', 'frappe', 'blocage', 'ko'].filter((n) => this.cache.audio.exists(n)).length,
    });
    this.scene.start('Menu');
  }
}
