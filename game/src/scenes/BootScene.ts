/**
 * BootScene — chargement des assets (J5) puis ouverture de l'écran de
 * lancement (J6 étape 2 : Menu RUN/CONFIG).
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
    // coups animés en sprites (docs/assets.md §3a) — teintés par personnage en jeu
    this.load.image('coups-poing', 'effets/coups-poing.png');
    this.load.image('coups-pied', 'effets/coups-pied.png');
    // rig cut-out articulé (scripts/assets-rig.py — docs/assets.md §3a) :
    // 5 pièces par personnage + meta (bbox, pivots) ; repli image plate si absent
    for (const dossier of ['rig-a', 'rig-b']) {
      for (const piece of ['buste', 'bras-g', 'bras-d', 'jambe-g', 'jambe-d']) {
        this.load.image(`${dossier}-${piece}`, `personnages/${dossier}/${piece}.png`);
      }
    }
    this.load.json('rigMeta', 'personnages/rig-meta.json');
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
  }

  create(): void {
    log.info('session.boot', { largeur: this.scale.width, hauteur: this.scale.height });
    log.info('assets.pret', {
      arene: this.textures.exists('arene'),
      persoA: this.textures.exists('persoA'),
      persoB: this.textures.exists('persoB'),
      flamme1: this.textures.exists('flamme1'),
      flamme2: this.textures.exists('flamme2'),
      coups: ['poing', 'pied'].filter((n) => this.textures.exists(`coups-${n}`)).length,
      rig: ['rig-a', 'rig-b'].every((d) =>
        ['buste', 'bras-g', 'bras-d', 'jambe-g', 'jambe-d'].every((p) =>
          this.textures.exists(`${d}-${p}`)
        )
      ) && this.cache.json.exists('rigMeta'),
      sons: ['reussite', 'erreur', 'frappe', 'blocage', 'ko'].filter((n) => this.cache.audio.exists(n)).length,
    });
    this.scene.start('Menu');
  }
}
