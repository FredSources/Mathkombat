/**
 * ui/numpad.ts — console de saisie par joueur (AGENTS.md §2.7).
 *
 *  - **la valeur saisie est affichée sur le clavier** (ligne d'entrée unique,
 *    qui rappelle l'énoncé du calcul ciblé : « 6 × 7 = 49 ») ;
 *  - chiffres 0–9, **⌫ Effacer** (un chiffre), **C Tout effacer** ;
 *  - **sous le clavier, les 3 boutons VALIDER colorés** (vert/jaune/rouge, un par
 *    calcul) : on sait exactement quel calcul on valide ;
 *  - la touche **Entrée** valide le calcul ciblé ; la saisie n'est évaluée qu'à
 *    une validation ;
 *  - **surbrillance à l'appui** : la touche pressée (clic ou touche physique)
 *    s'éclaircit avec un contour blanc puis revient au repos — la console montre
 *    instantanément que la frappe a été reçue (durée et teinte : `config.ts` `ui`).
 *
 * Chaque joueur a SON clavier (aligné vers l'extérieur : J1 à gauche, J2 à
 * droite). Touches physiques mappées pour la version web de debug, identifiées
 * par `event.code` (position physique, indépendante du clavier) : **les deux
 * consoles peuvent être actives en même temps** (duel, rythme SIMULTANÉ) —
 * J1 = ligne de chiffres principale, J2 = pavé numérique (NumLock activé) —
 * et aucune frappe n'atteint jamais les deux à la fois.
 */
import Phaser from 'phaser';
import type { Difficulte } from '../core/config.ts';
import { CONFIG } from '../core/config.ts';

export type Alignement = 'gauche' | 'droite';

/**
 * Touches physiques d'une console (web debug), en `event.code` DOM :
 * les deux jeux sont disjoints, c'est la garantie d'isolation en duel.
 */
export interface TouchePhysique {
  /** `event.code` des 10 chiffres rangés 0→9 ('Digit0'..'Digit9' / 'Numpad0'..'Numpad9'). */
  chiffres: string[];
  /** `event.code` de la validation ('Enter' / 'NumpadEnter'). */
  valider: string;
  /** `event.code` de ⌫ Effacer — un seul chiffre. */
  effacer: string;
  /** `event.code` de C Tout effacer. */
  toutEffacer: string;
}

/** J1 : ligne de chiffres principale du clavier (§2.7). */
export const TOUCHES_J1: TouchePhysique = {
  chiffres: [
    'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
    'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  ],
  valider: 'Enter',
  effacer: 'Backspace',
  toutEffacer: 'Escape',
};

/**
 * J2 : pavé numérique (NumLock activé) — tout est sous la main droite.
 * ⌫ = touche décimale (sous les chiffres, dégât d'une frappe parasite nul) ;
 * C = Delete (hors grappe, au-dessus du pavé : impossible à viser par erreur).
 */
export const TOUCHES_J2: TouchePhysique = {
  chiffres: [
    'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4',
    'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
  ],
  valider: 'NumpadEnter',
  effacer: 'NumpadDecimal',
  toutEffacer: 'Delete',
};

const COULEURS_BOUTONS: Record<Difficulte, number> = {
  facile: 0x2f7a3d,
  moyen: 0xb98a1e,
  difficile: 0xa83a3a,
};

/**
 * Mélange une teinte vers le blanc : la touche pressée s'éclaircit (lisible sur
 * la teinte foncée du pavé comme sur les couleurs des boutons VALIDER).
 */
function eclaircir(couleur: number, part: number): number {
  const canal = (decalage: number): number => {
    const v = (couleur >> decalage) & 0xff;
    return Math.round(v + (255 - v) * part);
  };
  return (canal(16) << 16) | (canal(8) << 8) | canal(0);
}

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
  private readonly scene: Phaser.Scene;
  private readonly conteneur: Phaser.GameObjects.Container;
  private readonly texteSaisie: Phaser.GameObjects.Text;
  private readonly fondSaisie: Phaser.GameObjects.Rectangle;
  private readonly onValider: (difficulte: Difficulte) => void;
  /** Boutons de la console indexés par touche : chiffres/⌫/C + `valider:<diff>`. */
  private readonly boutons = new Map<string, { fond: Phaser.GameObjects.Rectangle; couleur: number }>();
  private saisie = '';
  private cible: Difficulte = 'facile';
  private actif = true;
  /** Touche actuellement en surbrillance (null : aucune) — debug/E2E. */
  private surbrillance: string | null = null;
  private minuteurSurbrillance: Phaser.Time.TimerEvent | null = null;
  /** Clavier de la scène et handler installés (retirés par `detruire()`). */
  private clavier: Phaser.Input.Keyboard.KeyboardPlugin | null = null;
  private onKeydown: ((event: KeyboardEvent) => void) | null = null;
  /**
   * Dernier événement traité — garde-fou anti-doublon : le plugin clavier peut
   * parfois émettre deux fois le MÊME événement (observé en E2E : une frappe
   * comptée deux fois). Un même `code` avec le même `timeStamp` ne compte qu'une
   * fois ; deux frappes réelles ont des `timeStamp` distincts.
   */
  private dernierEvent: { code: string; timeStamp: number } | null = null;

  constructor(options: OptionsNumpad) {
    this.onValider = options.onValider;
    const scene = options.scene;
    this.scene = scene;
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
          libelle,
          0x2a3b6b,
          22,
          libelle
        );
        bouton.on('pointerdown', () => this.appuyer(libelle));
      }
    }

    // ---- SOUS le clavier : les 3 boutons VALIDER colorés (un par calcul),
    // alignés sur les colonnes du pavé. Côté droit (J2 / IA), l'ordre suit le
    // miroir des fiches de calcul : FACILE à droite, sous la fiche FACILE.
    const yValider = 54 + 4 * (HAUTEUR_BOUTON + ECART) + 8;
    const largeurValider = LARGEUR_BOUTON;
    const cibles: Difficulte[] =
      options.alignement === 'droite'
        ? ['difficile', 'moyen', 'facile']
        : ['facile', 'moyen', 'difficile'];
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
        11,
        `valider:${difficulte}`
      );
      bouton.on('pointerdown', () => this.validerPour(difficulte));
    }

    // ---- touches physiques (debug web) : filtrées par `event.code` — chaque
    // console ne réagit qu'à SES touches, les deux joueurs coexistent (duel).
    // Pas de capture Phaser (`addKey`) : la page n'a aucun champ de saisie HTML
    // dont le navigateur aurait une action par défaut à neutraliser.
    if (options.touches && scene.input.keyboard) {
      const t = options.touches;
      this.clavier = scene.input.keyboard;
      this.onKeydown = (event: KeyboardEvent) => this.recevoirTouche(t, event);
      this.clavier.on('keydown', this.onKeydown);
    }

    this.majSaisie();
  }

  /** Une frappe physique : ignorée s'il n'appartient pas à CE clavier. */
  private recevoirTouche(t: TouchePhysique, event: KeyboardEvent): void {
    if (!this.actif) return;
    const doublon =
      this.dernierEvent?.code === event.code &&
      this.dernierEvent?.timeStamp === event.timeStamp;
    this.dernierEvent = { code: event.code, timeStamp: event.timeStamp };
    if (doublon) return; // même événement reçu deux fois : on ne compte qu'une frappe
    const chiffre = t.chiffres.indexOf(event.code);
    if (chiffre !== -1) this.appuyer(String(chiffre)); // 'Digit3'/'Numpad3' → '3'
    else if (event.code === t.valider) this.validerPour(this.cible);
    else if (event.code === t.effacer) this.appuyer('⌫');
    else if (event.code === t.toutEffacer) this.appuyer('C');
  }

  private creerBouton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
    libelle: string,
    teinte = 0x2a3b6b,
    taille = 22,
    cle = libelle
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
    this.boutons.set(cle, { fond, couleur: teinte });
    return bouton;
  }

  /**
   * Surbrillance d'une touche (clic **et** touche physique) : teinte éclaircie +
   * contour blanc, puis retour au repos après `CONFIG.ui.surbrillanceMs`.
   * Une nouvelle pression sur la même touche relance le minuteur.
   */
  private surligner(cle: string): void {
    const entree = this.boutons.get(cle);
    if (!entree) return;
    this.minuteurSurbrillance?.remove(false);
    entree.fond.setFillStyle(eclaircir(entree.couleur, CONFIG.ui.surbrillanceTeinte));
    entree.fond.setStrokeStyle(3, 0xffffff);
    this.surbrillance = cle;
    this.minuteurSurbrillance = this.scene.time.delayedCall(CONFIG.ui.surbrillanceMs, () => {
      entree.fond.setFillStyle(entree.couleur);
      entree.fond.setStrokeStyle(2, 0x4c63a8);
      if (this.surbrillance === cle) this.surbrillance = null;
      this.minuteurSurbrillance = null;
    });
  }

  // ------------------------------------------------------------- saisie

  private appuyer(libelle: string): void {
    if (!this.actif) return;
    this.surligner(libelle); // retour visuel immédiat, clic comme touche physique
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
    this.surligner(`valider:${difficulte}`); // surbrillance du bouton pressé
    this.cible = difficulte;
    this.onValider(difficulte);
    this.majSaisie();
  }

  /** Valeur courante (null si saisie vide — ignorée, §2.7). */
  get valeur(): number | null {
    return this.saisie === '' ? null : parseInt(this.saisie, 10);
  }

  /** État de saisie (debug/E2E) — `surbrillance` = touche actuellement éclairée. */
  etatSaisie(): { cible: Difficulte; texte: string; valeur: number | null; surbrillance: string | null } {
    return {
      cible: this.cible,
      texte: this.saisie,
      valeur: this.valeur,
      surbrillance: this.surbrillance,
    };
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
    this.minuteurSurbrillance?.remove(false);
    this.minuteurSurbrillance = null;
    this.surbrillance = null;
    if (this.clavier && this.onKeydown) this.clavier.off('keydown', this.onKeydown);
    this.clavier = null;
    this.onKeydown = null;
    this.conteneur.destroy(true);
  }
}
