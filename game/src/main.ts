/**
 * MathKombat — point d'entrée (J1 : squelette).
 * Bootstrap Phaser + logger (AGENTS.md §5 : DEBUG = logs socket, RELEASE = no-op).
 */
import Phaser from 'phaser';
import { initLogger } from './core/logger';
import { BootScene } from './scenes/BootScene';
import { ConfigScene } from './scenes/ConfigScene';
import { FightScene } from './scenes/FightScene';
import { MenuScene } from './scenes/MenuScene';
import { SelectScene } from './scenes/SelectScene';

const log = initLogger({ scene: 'App' });
log.info('session.debut', { version: '0.1.0', build: 'debug' });

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jeu',
  width: 1280,
  height: 720,
  backgroundColor: '#0d0820',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, ConfigScene, SelectScene, FightScene],
});
