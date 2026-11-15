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
// Version du produit et mode de build : injectés par vite.config (__MK_VERSION__
// vient de MK_VERSION — source de vérité : le tag git v*, scripts/env.sh).
declare const __MK_VERSION__: string | undefined;
declare const __BUILD_MODE__: string | undefined;
log.info('session.debut', {
  version: typeof __MK_VERSION__ !== 'undefined' ? __MK_VERSION__ : '0.0.0-dev',
  build: typeof __BUILD_MODE__ !== 'undefined' ? __BUILD_MODE__ : 'debug',
});

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
