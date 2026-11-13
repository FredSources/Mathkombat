/**
 * ui/numpad.ts — console de saisie par joueur (AGENTS.md §2.7).
 *
 *  - **la valeur saisie est affichée sur le clavier** (ligne d'entrée unique,
 *    qui rappelle l'énoncé du calcul ciblé : « 6 × 7 = 49 ») ;
 *  - chiffres 0–9, **⌫ Effacer** (un chiffre), **C Tout effacer** ;
 *  - **sous le clavier, les 3 boutons VALIDER colorés** (vert/jaune/rouge, un par
 *    calcul) : on sait exactement quel calcul on valide ;
 *  - la touche **Entrée** valide le calcul ciblé ; la saisie n'est évaluée qu'à
 *    une validation.
 *
 * Chaque joueur a SON clavier (aligné vers l'extérieur : J1 à gauche, J2 à
 * droite). Touches physiques mappées pour la version web de debug.
 */
import Phaser from 'phaser';
import type { Difficulte } from '../core/config.ts';
import { CONFIG } from '../core/config.ts';

export type Alignement = 'gauche' | 'droite';

export interface TouchePhysique {
  chiffres: string[]; // noms de touches Phaser ('ZERO'..'NINE')
  valider: string; // 'ENTER'
  effacer: string; // 'BACKSPACE'
  toutEffacer: string; // 'ESC'
}

export const TOUCHES_J1: TouchePhysique = {
  chiffres: ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'],
  valider: 'ENTER',
  effacer: 'BACKSPACE',
  toutEffacer: 'ESC',
};

const COULEURS_BOUTONS: Record<Difficulte, number> = {
  facile: 0x2f7a3d,
  moyen: 0xb98a1e,
  difficile: 0xa83a3a,
};

export interface OptionsNumpad {
  scene: Phaser.Scene;
  x: number;
  y: number;
  alignement: Alignement;
  /** Un bouton VALIDER coloré est pressé → la saisie est validée pour CE calcul. */
  onValider: (difficulte: Difficulte) => void;
  touches?: TouchePhysique;
}

const LARGEUR_BOUTON = 62;
const HAUTEUR_BOUTON = 44;
const ECART = 6;
// La console (case de saisie + pavé + boutons VALIDER) a la largeur du clavier
const LARGEUR_CONSOLE = 3 * LARGEUR_BOUTON + 2 * ECART; // 198 px

export class Numpad {
  private readonly conteneur: Phaser.GameObjects.Container;
  private readonly texteSaisie: Phaser.GameObjects.Text;
  private readonly fondSaisie: Phaser.GameObjects.Rectangle;
  private readonly onValider: (difficulte: Difficulte) => void;
  private saisie = '';
  private cible: Difficulte = 'facile';
  private actif = true;
  private touchesClavier: Phaser.Input.Keyboard.Key[] = [];

  constructor(options: OptionsNumpad) {
    this.onValider = options.onValider;
    const scene = options.scene;
    this.conteneur = scene.add.container(options.x, options.y);
    const xBase = options.alignement === 'gauche' ? 0 : -LARGEUR_CONSOLE;

    // ---- ligne d'entrée UNIQUE, sur le clavier : la VALEUR saisie uniquement
    // (elle ne correspond à un calcul qu'à la validation par le bouton coloré)
    this.fondSaisie = scene.add
      .rectangle(xBase, 0, LARGEUR_CONSOLE, 46, 0x0d1530)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x4c63a8);
    this.texteSaisie = scene.add
      .text(
        options.alignement === 'gauche' ? xBase + LARGEUR_CONSOLE / 2 : xBase + LARGEUR_CONSOLE / 2,
        23,
        '…',
        { fontFamily: 'monospace', fontSize: '30px', color: '#7bd4ff' }
      )
      .setOrigin(0.5, 0.5);
    this.conteneur.add([this.fondSaisie, this.texteSaisie]);

    // ---- grille : 1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 C
    const grille: string[][] = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['⌫', '0', 'C'],
    ];
    for (let ligne = 0; ligne < grille.length; ligne++) {
      for (let col = 0; col < 3; col++) {
        const libelle = grille[ligne][col];
        const bouton = this.creerBouton(
          scene,
          xBase + col * (LARGEUR_BOUTON + ECART),
          54 + ligne * (HAUTEUR_BOUTON + ECART),
          LARGEUR_BOUTON,
          HAUTEUR_BOUTON,
          libelle
        );
        bouton.on('pointerdown', () => this.appuyer(libelle));
      }
    }

    // ---- SOUS le clavier : les 3 boutons VALIDER colorés (un par calcul),
    // alignés sur les colonnes du pavé
    const yValider = 54 + 4 * (HAUTEUR_BOUTON + ECART) + 8;
    const largeurValider = LARGEUR_BOUTON;
    const cibles: Difficulte[] = ['facile', 'moyen', 'difficile'];
    const libellesBoutons: Record<Difficulte, string> = {
      facile: 'VALIDER\n+1',
      moyen: 'VALIDER\n+3',
      difficile: 'VALIDER\n+7',
    };
    for (let i = 0; i < 3; i++) {
      const difficulte = cibles[i];
      const bouton = this.creerBouton(
        scene,
        xBase + i * (largeurValider + ECART),
        yValider,
        largeurValider,
        48,
        libellesBoutons[difficulte],
        COULEURS_BOUTONS[difficulte],
        11
      );
      bouton.on('pointerdown', () => this.validerPour(difficulte));
    }

    // ---- touches physiques (debug web)
    if (options.touches && scene.input.keyboard) {
      const t = options.touches;
      const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
      for (let i = 0; i <= 9; i++) {
        this.touchesClavier.push(scene.input.keyboard.addKey(codes[t.chiffres[i]]));
      }
      this.touchesClavier.push(
        scene.input.keyboard.addKey(codes[t.valider]),
        scene.input.keyboard.addKey(codes[t.effacer]),
        scene.input.keyboard.addKey(codes[t.toutEffacer])
      );
      scene.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        if (!this.actif) return;
        if (event.key >= '0' && event.key <= '9') this.appuyer(event.key);
        else if (event.key === 'Enter') this.validerPour(this.cible);
        else if (event.key === 'Backspace') this.appuyer('⌫');
        else if (event.key === 'Escape') this.appuyer('C');
      });
    }

    this.majSaisie();
  }

  private creerBouton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
    libelle: string,
    teinte = 0x2a3b6b,
    taille = 22
  ): Phaser.GameObjects.Container {
    const fond = scene.add
      .rectangle(0, 0, largeur, hauteur, teinte)
      .setStrokeStyle(2, 0x4c63a8)
      .setInteractive({ useHandCursor: true });
    const texte = scene.add
      .text(0, 0, libelle, {
        fontFamily: 'monospace', fontSize: `${taille}px`, color: '#ffffff', align: 'center',
      })
      .setOrigin(0.5);
    const bouton = scene.add.container(x + largeur / 2, y + hauteur / 2, [fond, texte]);
    // Phaser ne remonte pas les événements d'un enfant interactif au conteneur :
    // on re-émet explicitement pour que le handler du conteneur s'exécute.
    fond.on('pointerdown', () => bouton.emit('pointerdown'));
    this.conteneur.add(bouton);
    return bouton;
  }

  // ------------------------------------------------------------- saisie

  private appuyer(libelle: string): void {
    if (!this.actif) return;
    if (libelle === '⌫') this.saisie = this.saisie.slice(0, -1); // un chiffre
    else if (libelle === 'C') this.saisie = ''; // tout effacer
    else if (this.saisie.length < CONFIG.saisieMaxChiffres) this.saisie += libelle;
    this.majSaisie();
  }

  /** La ligne d'entrée unique : la VALEUR saisie (pas de calcul — il n'est
   *  associé à un calcul qu'à la validation par le bouton de la bonne couleur). */
  private majSaisie(): void {
    this.texteSaisie.setText(this.saisie === '' ? '…' : this.saisie);
    this.texteSaisie.setAlpha(this.actif ? 1 : 0.45);
    this.fondSaisie.setAlpha(this.actif ? 1 : 0.45);
  }

  // ------------------------------------------------------------- cible & validation

  /** Définit le calcul ciblé (validation par la touche Entrée).
   *  Changer de cible efface la saisie en cours (elle appartient au calcul). */
  setCible(difficulte: Difficulte): void {
    if (difficulte !== this.cible) {
      this.saisie = '';
    }
    this.cible = difficulte;
    this.majSaisie();
  }

  /** Valider la saisie pour un calcul précis (bouton coloré / touche Entrée). */
  validerPour(difficulte: Difficulte): void {
    if (!this.actif) return;
    this.cible = difficulte;
    this.onValider(difficulte);
    this.majSaisie();
  }

  /** Valeur courante (null si saisie vide — ignorée, §2.7). */
  get valeur(): number | null {
    return this.saisie === '' ? null : parseInt(this.saisie, 10);
  }

  /** État de saisie (debug/E2E). */
  etatSaisie(): { cible: Difficulte; texte: string; valeur: number | null } {
    return { cible: this.cible, texte: this.saisie, valeur: this.valeur };
  }

  reset(): void {
    this.saisie = '';
    this.majSaisie();
  }

  setActif(actif: boolean): void {
    this.actif = actif;
    this.conteneur.setAlpha(actif ? 1 : 0.45);
    this.majSaisie();
  }

  detruire(): void {
    for (const touche of this.touchesClavier) touche.destroy();
    this.conteneur.destroy(true);
  }
}
