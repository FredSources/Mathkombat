/**
 * BootScene — chargement des assets (J5) puis lancement du combat.
 * Assets servis depuis `game/assets/` (publicDir Vite) : arène + personnages cut-out.
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
    this.load.image('persoA', 'personnages/perso-a.png');
    this.load.image('persoB', 'personnages/perso-b.png');
    this.load.image('flamme1', 'effets/flamme-1.png');
    this.load.image('flamme2', 'effets/flamme-2.png');
    // sons du combat (scripts/assets-sons.py — synthèse WAV déterministe)
    for (const nom of ['reussite', 'erreur', 'frappe', 'blocage', 'ko']) {
      this.load.audio(nom, `sons/${nom}.wav`);
    }
  }

  create(): void {
    log.info('session.boot', { largeur: this.scale.width, hauteur: this.scale.height });
    log.info('assets.pret', {
      arene: this.textures.exists('arene'),
      persoA: this.textures.exists('persoA'),
      persoB: this.textures.exists('persoB'),
      flamme1: this.textures.exists('flamme1'),
      flamme2: this.textures.exists('flamme2'),
      sons: ['reussite', 'erreur', 'frappe', 'blocage', 'ko'].filter((n) => this.cache.audio.exists(n)).length,
    });
    this.scene.start('Fight');
  }
}
