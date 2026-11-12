/**
 * FightScene — squelette du jalon J1.
 *
 * Ce que contient ce squelette :
 *  - arène (décor graphique provisoire, décors peints en J5) ;
 *  - 2 combattants placeholder (formes graphiques — sprites cut-out en J5) ;
 *  - barres de vie animées (AGENTS.md §2.4) ;
 *  - HUD minimal (PV, chrono de phase, énergie en cours) ;
 *  - démo d'interaction : ESPACE = coup de démo (J1 → J2), R = réinitialiser.
 *
 * La logique métier (moteurs mathématiques et de combat) arrivera en J2/J3 dans
 * `core/` — ici, uniquement de la présentation (AGENTS.md §7).
 */
import Phaser from 'phaser';
import { getLogger } from '../core/logger';

const log = getLogger('Fight');

const LARGEUR = 1280;
const HAUTEUR = 720;
const SOL = 580;
const PV_MAX = 100;

interface Combattant {
  nom: string;
  pv: number;
  energie: number;
  corps: Phaser.GameObjects.Container;
  teinte: number;
}

export class FightScene extends Phaser.Scene {
  private j1!: Combattant;
  private j2!: Combattant;
  private barre1!: Phaser.GameObjects.Graphics;
  private barre2!: Phaser.GameObjects.Graphics;
  private textePv1!: Phaser.GameObjects.Text;
  private textePv2!: Phaser.GameObjects.Text;
  private texteChrono!: Phaser.GameObjects.Text;
  private texteEnergie!: Phaser.GameObjects.Text;
  private restant = 15;

  constructor() {
    super('Fight');
  }

  create(): void {
    this.dessinerArene();
    this.j1 = this.creerCombattant('J1', 380, 0x2b6bd4);
    this.j2 = this.creerCombattant('J2', 900, 0xd4762b);
    this.dessinerHud();
    this.brancherEntrees();
    log.info('combat.phase', { phase: 'squelette', rythme: 'differe', duree: 15 });

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.ticChrono(),
    });
  }

  // ---------------------------------------------------------------- décor

  private dessinerArene(): void {
    const g = this.add.graphics();
    // ciel dégradé en bandes
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const r = Math.round(13 + t * 25);
      const v = Math.round(8 + t * 12);
      const b = Math.round(32 + t * 45);
      g.fillStyle(Phaser.Display.Color.GetColor(r, v, b), 1);
      g.fillRect(0, t * SOL, LARGEUR, SOL / 12 + 1);
    }
    // sol
    g.fillStyle(0x241a3d, 1);
    g.fillRect(0, SOL, LARGEUR, HAUTEUR - SOL);
    g.fillStyle(0x3d2f66, 1);
    g.fillRect(0, SOL, LARGEUR, 6);
    this.add
      .text(LARGEUR / 2, SOL + 60, 'A R È N E   ( d é c o r   p r o v i s o i r e — J 5 )', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#6b5a9e',
      })
      .setOrigin(0.5);
  }

  private creerCombattant(nom: string, x: number, teinte: number): Combattant {
    const conteneur = this.add.container(x, SOL);
    const corps = this.add.graphics();
    corps.fillStyle(teinte, 1);
    corps.fillRoundedRect(-40, -170, 80, 130, 12); // buste
    corps.fillStyle(0xf2c99a, 1);
    corps.fillCircle(0, -205, 38); // tête
    corps.fillStyle(teinte, 1);
    corps.fillRect(-34, -40, 26, 40); // jambe g.
    corps.fillRect(8, -40, 26, 40); // jambe d.
    corps.fillStyle(0x1b2a52, 1);
    corps.fillRoundedRect(-58, -160, 24, 90, 8); // bras g.
    corps.fillRoundedRect(34, -160, 24, 90, 8); // bras d.
    conteneur.add(corps);
    const etiquette = this.add
      .text(0, 24, nom, { fontFamily: 'monospace', fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);
    conteneur.add(etiquette);
    return { nom, pv: PV_MAX, energie: 0, corps: conteneur, teinte };
  }

  // ---------------------------------------------------------------- HUD

  private dessinerHud(): void {
    this.barre1 = this.add.graphics();
    this.barre2 = this.add.graphics();
    this.textePv1 = this.add.text(40, 56, '', { fontFamily: 'monospace', fontSize: '24px', color: '#8ef0a0' });
    this.textePv2 = this.add
      .text(LARGEUR - 40, 56, '', { fontFamily: 'monospace', fontSize: '24px', color: '#8ef0a0' })
      .setOrigin(1, 0);
    this.texteChrono = this.add
      .text(LARGEUR / 2, 30, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffd76b' })
      .setOrigin(0.5, 0);
    this.texteEnergie = this.add
      .text(LARGEUR / 2, 84, '', { fontFamily: 'monospace', fontSize: '22px', color: '#7bd4ff' })
      .setOrigin(0.5, 0);
    this.add
      .text(LARGEUR / 2, HAUTEUR - 36, 'ESPACE = coup de démo    R = réinitialiser', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#9a8cc9',
      })
      .setOrigin(0.5);
    this.mettreAJourHud();
  }

  private mettreAJourHud(): void {
    for (const [c, barre, texte, gauche] of [
      [this.j1, this.barre1, this.textePv1, true],
      [this.j2, this.barre2, this.textePv2, false],
    ] as const) {
      const largeur = 420;
      const x = gauche ? 40 : LARGEUR - 40 - largeur;
      barre.clear();
      barre.fillStyle(0x1b2a52, 1);
      barre.fillRoundedRect(x, 28, largeur, 22, 8);
      const ratio = Math.max(0, c.pv / PV_MAX);
      barre.fillStyle(ratio > 0.5 ? 0x43c96a : ratio > 0.25 ? 0xe0a63c : 0xd94848, 1);
      barre.fillRoundedRect(x, 28, largeur * ratio, 22, 8);
      texte.setText(`${c.nom} — ${Math.max(0, c.pv)} PV`);
    }
    this.texteChrono.setText(`⏱ ${this.restant}`);
    this.texteEnergie.setText(`énergie du coup : +${this.j1.energie}`);
  }

  // ---------------------------------------------------------------- interactions (démo)

  private brancherEntrees(): void {
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.coupDemo());
      this.input.keyboard.on('keydown-R', () => this.reinitialiser());
    }
  }

  private coupDemo(): void {
    // Démo visuelle J1 → J2 (la vraie logique arrive en J3 : core/combat-engine)
    const degats = Phaser.Math.Between(3, 18);
    this.j1.energie = degats;
    this.j2.pv = Math.max(0, this.j2.pv - degats);
    log.info('ui.saisie', { touche: 'espace', demo: true });
    log.info('combat.coup_resolu', {
      attaque: degats,
      defense: 0,
      solde: degats,
      contre: 0,
      demo: true,
    });
    this.tweens.add({
      targets: this.j2.corps,
      x: this.j2.corps.x + 24,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.mettreAJourHud();
    if (this.j2.pv <= 0) {
      log.info('combat.ko', { gagnant: 'J1', demo: true });
      this.texteChrono.setText('K.O.  ( R = rejouer )');
    }
  }

  private reinitialiser(): void {
    this.j1.pv = PV_MAX;
    this.j2.pv = PV_MAX;
    this.j1.energie = 0;
    this.restant = 15;
    log.info('ui.saisie', { touche: 'r', demo: true });
    this.mettreAJourHud();
  }

  private ticChrono(): void {
    if (this.j2.pv <= 0) return;
    this.restant = this.restant > 0 ? this.restant - 1 : 15;
    this.mettreAJourHud();
  }
}
