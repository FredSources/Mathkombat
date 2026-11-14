/**
 * SelectScene — sélection des personnages et des niveaux (wireframes §3).
 *
 * Après RUN : chaque joueur choisit son **personnage** (skins de
 * `rig/personnage.ts`) et son **niveau de calcul** (§2.5) ; puis
 * **[ LANCER LE COMBAT ]** part sur `Fight` avec la sélection.
 *
 *  - **Solo** : J2 = IA — son niveau suit celui de J1 et sa difficulté vient de
 *    CONFIG (§2.6) ; les choix de J2 restent mémorisés pour le mode duel.
 *  - **Événements** : `ui.clic`, `session.debut` (émis par `main.ts`).
 */
import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import type { Niveau } from '../core/config';
import { getLogger } from '../core/logger';
import { declarerEcran } from '../ui/ecran';
import { selection } from '../ui/selection';
import { RETRO, creerBoutonRetro, creerCadreBorne, texteRetro } from '../ui/retro';
import { SKINS } from '../rig/personnage';

const log = getLogger('Select');

const NIVEAUX: readonly Niveau[] = ['debutant', 'intermediaire', 'avance'];
const LIBELLES_NIVEAU: Record<Niveau, string> = {
  debutant: 'DÉBUTANT',
  intermediaire: 'INTERMÉDIAIRE',
  avance: 'AVANCÉ',
};
/** Noms affichés des skins (clé = id de `SKINS`). */
const LIBELLES_SKIN: Record<string, string> = {
  persoA: 'PERSO A',
  persoB: 'PERSO B',
};
const IDS_SKIN = Object.keys(SKINS);

/** Positions des commandes (coordonnées de référence des tests E2E). */
export const PLACE_SELECT = {
  retour: { x: 175, y: 60 },
  lignes: { j1Skin: 180, j1Niveau: 240, j2Skin: 320, j2Niveau: 380 },
  flecheGauche: 700,
  flecheDroite: 1100,
  valeur: 900,
  libelle: 110,
  lancer: { x: 640, y: 520, largeur: 520, hauteur: 64 },
} as const;

/** Voisin dans une liste bornée (les extrémités restent sur place). */
function suivant<T>(liste: readonly T[], actuel: T, delta: number): T {
  const index = liste.indexOf(actuel);
  return liste[Math.min(liste.length - 1, Math.max(0, index + delta))];
}

interface LigneSelect {
  libelle: string;
  valeur: () => string;
  moins: () => void;
  plus: () => void;
  texte?: Phaser.GameObjects.Text;
}

export class SelectScene extends Phaser.Scene {
  private lignes: LigneSelect[] = [];

  constructor() {
    super('Select');
  }

  create(): void {
    declarerEcran('select');
    this.cameras.main.setBackgroundColor(RETRO.fond);
    if (this.textures.exists('fond-config')) {
      this.add.image(640, 360, 'fond-config').setDisplaySize(1280, 720);
      this.add.rectangle(640, 360, 1280, 720, 0x0d0820, CONFIG.ui.voileConfig);
    }
    creerCadreBorne(this);
    this.lignes = [];

    texteRetro(this, 640, 60, 'S  É  L  E  C  T  I  O  N', {
      taille: 30,
      couleur: RETRO.texteTitre,
      gras: true,
    });
    creerBoutonRetro({
      scene: this,
      x: PLACE_SELECT.retour.x,
      y: PLACE_SELECT.retour.y,
      largeur: 210,
      hauteur: 48,
      libelle: '◀  RETOUR',
      taille: 22,
      onClic: () => this.retour(),
    });
    this.add.rectangle(640, 96, 1160, 3, RETRO.cadre);

    const p = PLACE_SELECT;
    // En SOLO, l'adversaire est l'IA (jamais « J2 ») — §2.6 / demande utilisateur
    const libelleJ2 = CONFIG.mode === 'duel' ? 'JOUEUR 2  ........' : 'I A  ............';
    const libelleNiveau2 = CONFIG.mode === 'duel' ? 'niveau J2  ......' : 'niveau IA  ......';
    this.dessinerLigne(
      {
        libelle: 'JOUEUR 1  ........',
        valeur: () => LIBELLES_SKIN[selection.skinJ1] ?? selection.skinJ1.toUpperCase(),
        moins: () => {
          selection.skinJ1 = suivant(IDS_SKIN, selection.skinJ1, -1);
        },
        plus: () => {
          selection.skinJ1 = suivant(IDS_SKIN, selection.skinJ1, 1);
        },
      },
      p.lignes.j1Skin
    );
    this.dessinerLigne(
      {
        libelle: 'niveau J1  ......',
        valeur: () => LIBELLES_NIVEAU[selection.niveauJ1],
        moins: () => {
          selection.niveauJ1 = suivant(NIVEAUX, selection.niveauJ1, -1);
        },
        plus: () => {
          selection.niveauJ1 = suivant(NIVEAUX, selection.niveauJ1, 1);
        },
      },
      p.lignes.j1Niveau
    );
    this.dessinerLigne(
      {
        libelle: libelleJ2,
        valeur: () => LIBELLES_SKIN[selection.skinJ2] ?? selection.skinJ2.toUpperCase(),
        moins: () => {
          selection.skinJ2 = suivant(IDS_SKIN, selection.skinJ2, -1);
        },
        plus: () => {
          selection.skinJ2 = suivant(IDS_SKIN, selection.skinJ2, 1);
        },
      },
      p.lignes.j2Skin
    );
    this.dessinerLigne(
      {
        libelle: libelleNiveau2,
        valeur: () => LIBELLES_NIVEAU[selection.niveauJ2],
        moins: () => {
          selection.niveauJ2 = suivant(NIVEAUX, selection.niveauJ2, -1);
        },
        plus: () => {
          selection.niveauJ2 = suivant(NIVEAUX, selection.niveauJ2, 1);
        },
      },
      p.lignes.j2Niveau
    );

    texteRetro(this, 640, 440, this.noteMode(), { taille: 20, couleur: RETRO.texteAccent });

    creerBoutonRetro({
      scene: this,
      x: p.lancer.x,
      y: p.lancer.y,
      largeur: p.lancer.largeur,
      hauteur: p.lancer.hauteur,
      libelle: '[  ▶  L A N C E R   L E   C O M B A T  ]',
      taille: 26,
      couleur: RETRO.boutonLancer,
      onClic: () => this.lancer(),
    });

    // Entrée = lancer, comme la touche START d'une borne.
    this.input.keyboard?.on('keydown-ENTER', () => this.lancer());
  }

  /** Note de mode sous les lignes (§3 : en SOLO, l'IA suit le niveau de J1). */
  private noteMode(): string {
    return CONFIG.mode === 'duel'
      ? 'MODE 2 JOUEURS : chacun son personnage et son niveau'
      : `MODE SOLO : l'IA suit le niveau de J1 (difficulté ${CONFIG.ia.difficulte.toUpperCase()}, règle CONFIG)`;
  }

  private dessinerLigne(ligne: LigneSelect, y: number): void {
    texteRetro(this, PLACE_SELECT.libelle, y, ligne.libelle, {
      taille: 24,
      couleur: RETRO.textePale,
      origine: [0, 0.5],
    });
    const fleche = (x: number, libelle: string, action: () => void): void => {
      creerBoutonRetro({
        scene: this,
        x,
        y,
        largeur: 56,
        hauteur: 40,
        libelle,
        taille: 26,
        couleur: RETRO.boutonFleche,
        onClic: action,
      });
    };
    fleche(PLACE_SELECT.flecheGauche, '◀', () => this.agir(ligne, ligne.moins));
    fleche(PLACE_SELECT.flecheDroite, '▶', () => this.agir(ligne, ligne.plus));
    ligne.texte = texteRetro(this, PLACE_SELECT.valeur, y, ligne.valeur(), {
      taille: 26,
      couleur: RETRO.texteTitre,
    });
    this.lignes.push(ligne);
  }

  /** Une flèche pressée : applique l'action, redessine les valeurs, trace. */
  private agir(ligne: LigneSelect, action: () => void): void {
    action();
    for (const l of this.lignes) l.texte?.setText(l.valeur());
    log.info('ui.clic', { ecran: 'select', ligne: ligne.libelle, valeur: ligne.valeur() });
  }

  /** RETOUR : revient à l'écran de lancement (sélection conservée). */
  private retour(): void {
    log.info('ui.clic', { ecran: 'select', cible: 'retour' });
    this.scene.start('Menu');
  }

  /** LANCER LE COMBAT : `Fight` construit le combat sur la sélection (§3). */
  private lancer(): void {
    log.info('ui.clic', { ecran: 'select', cible: 'lancer', ...selection });
    this.scene.start('Fight');
  }
}
