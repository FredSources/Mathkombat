/**
 * BootScene — initialisation minimale (J1) : vérifie le contexte puis lance le combat.
 * Les chargements d'assets arriveront en J5.
 */
import Phaser from 'phaser';
import { getLogger } from '../core/logger';

const log = getLogger('Boot');

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    log.info('session.boot', { largeur: this.scale.width, hauteur: this.scale.height });
    this.scene.start('Fight');
  }
}
