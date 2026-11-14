/**
 * ui/quiz-overlay.ts — les 3 calculs simultanés d'une zone (AGENTS.md §2.2/§2.3).
 *
 * 3 cartes (🟢 Facile +1, 🟡 Moyen +3, 🟠 Difficile +7) ; tap = **ciblage** du
 * calcul (bordure renforcée) — la saisie et les boutons VALIDER colorés vivent
 * sur le clavier du joueur (ui/numpad.ts).
 *
 * **Seul le calcul résolu est remplacé** ; erreur = « Faux ! » mais le calcul
 * reste (I4, I12).
 */
import Phaser from 'phaser';
import type { Difficulte } from '../core/config.ts';
import { CONFIG } from '../core/config.ts';

export interface InfoQuestion {
  difficulte: Difficulte;
  enonce: string;
  gain: number;
}

export type Alignement = 'gauche' | 'droite';

const LIBELLES: Record<Difficulte, { nom: string; couleur: number; gain: string }> = {
  facile: { nom: 'FACILE', couleur: 0x2f7a3d, gain: '+1' },
  moyen: { nom: 'MOYEN', couleur: 0xb98a1e, gain: '+3' },
  difficile: { nom: 'DIFFICILE', couleur: 0xa83a3a, gain: '+7' },
};

/** Cartes de calcul réduites (demande utilisateur) : le couloir central entre
 *  les deux blocs reste libre pour le bouton ☰ MENU (§8 wireframes). */
const LARGEUR_CARTE = 150;
const HAUTEUR_CARTE = 88;
const ECART_CARTE = 10;

export class QuizOverlay {
  private readonly scene: Phaser.Scene;
  private readonly conteneur: Phaser.GameObjects.Container;
  private cadres = new Map<Difficulte, Phaser.GameObjects.Rectangle>();
  private enonces = new Map<Difficulte, Phaser.GameObjects.Text>();
  private messages!: Phaser.GameObjects.Text;
  private focusCourant: Difficulte = 'facile';
  private actif = false;
  private readonly onCible: ((d: Difficulte) => void) | undefined;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    alignement: Alignement,
    onCible?: (d: Difficulte) => void
  ) {
    this.scene = scene;
    this.onCible = onCible;
    this.conteneur = this.scene.add.container(x, y);

    const ordre: Difficulte[] = ['facile', 'moyen', 'difficile'];
    for (let i = 0; i < ordre.length; i++) {
      const difficulte = ordre[i];
      const info = LIBELLES[difficulte];
      const offsetX =
        alignement === 'gauche'
          ? i * (LARGEUR_CARTE + ECART_CARTE)
          : -LARGEUR_CARTE - i * (LARGEUR_CARTE + ECART_CARTE);
      const centre = offsetX + LARGEUR_CARTE / 2;

      const cadre = this.scene.add
        .rectangle(offsetX, 0, LARGEUR_CARTE, HAUTEUR_CARTE, 0x1b2a52)
        .setOrigin(0, 0)
        .setStrokeStyle(3, info.couleur)
        .setInteractive({ useHandCursor: true });
      const bandeau = this.scene.add
        .rectangle(offsetX, 0, LARGEUR_CARTE, 22, info.couleur)
        .setOrigin(0, 0);
      const titre = this.scene.add
        .text(centre, 11, `${info.nom}  ${info.gain}`, {
          fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const enonce = this.scene.add
        .text(centre, 55, '…', {
          fontFamily: 'monospace', fontSize: '20px', color: '#ffffff',
        })
        .setOrigin(0.5);

      cadre.on('pointerdown', () => this.focusuer(difficulte));
      this.conteneur.add([cadre, bandeau, titre, enonce]);
      this.cadres.set(difficulte, cadre);
      this.enonces.set(difficulte, enonce);
    }

    this.messages = this.scene.add
      .text(
        alignement === 'gauche' ? 0 : -(LARGEUR_CARTE * 3 + ECART_CARTE * 2),
        HAUTEUR_CARTE + 8,
        '',
        { fontFamily: 'monospace', fontSize: '16px', color: '#ffd76b' }
      )
      .setOrigin(0, 0);
    this.conteneur.add(this.messages);
    this.appliquerFocus();
  }

  /** Tap sur une carte = ce calcul est ciblé (clavier + VALIDER le concernant). */
  focusuer(difficulte: Difficulte): void {
    if (!this.actif) return;
    this.focusCourant = difficulte;
    this.appliquerFocus();
    this.onCible?.(difficulte);
  }

  get focus(): Difficulte {
    return this.focusCourant;
  }

  /** Remplace le SEUL calcul d'une difficulté (I12). */
  mettreAJour(infos: InfoQuestion): void {
    const enonce = this.enonces.get(infos.difficulte);
    enonce?.setText(infos.enonce);
    if (enonce) {
      this.scene.tweens.add({ targets: enonce, alpha: 0.2, duration: 80, yoyo: true });
    }
  }

  /** Retour « Faux ! » — le calcul reste affiché (I4). */
  erreur(difficulte: Difficulte): void {
    this.messages.setText('FAUX !');
    this.messages.setColor('#ff7b7b');
    this.scene.time.delayedCall(900, () => {
      if (this.messages.text.startsWith('FAUX')) this.messages.setText('');
    });
    const cadre = this.cadres.get(difficulte);
    if (cadre) {
      this.scene.tweens.add({ targets: cadre, alpha: 0.5, duration: 70, yoyo: true, repeat: 1 });
    }
  }

  /** Message contextuel (ex. « l'IA joue… »). */
  afficherMessage(texte: string, couleur = '#ffd76b'): void {
    this.messages.setText(texte);
    this.messages.setColor(couleur);
  }

  setActif(actif: boolean): void {
    this.actif = actif;
    this.conteneur.setAlpha(actif ? 1 : 0.4);
    this.appliquerFocus();
    if (!actif) this.messages.setText('');
  }

  private appliquerFocus(): void {
    for (const [difficulte, cadre] of this.cadres) {
      const vise = difficulte === this.focusCourant && this.actif;
      cadre.setStrokeStyle(vise ? 5 : 3, LIBELLES[difficulte].couleur);
    }
  }

  detruire(): void {
    this.conteneur.destroy(true);
  }
}

/** Gain pour une difficulté (I3). */
export function gainPourDifficulte(difficulte: Difficulte): number {
  return CONFIG.gains[difficulte];
}
