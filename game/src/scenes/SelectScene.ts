/**
 * SelectScene — sélection de combat (wireframes §3).
 *
 * Deux **blocs distincts**, sans mélanger les joueurs :
 *  - **JOUEUR 1** : personnage, niveau, type de calcul (couple attaque/défense) ;
 *  - **ADVERSAIRE** : en solo l'IA (personnage + difficulté remontée de CONFIG),
 *    en duel J2 (personnage + niveau + son propre type de calcul).
 *
 * `[ LANCER LE COMBAT ]` part sur `Fight` avec la sélection (§2.5/§2.6).
 * Événements : `ui.clic`, `session.debut` (émis par `main.ts`).
 */
import Phaser from 'phaser';
import {
  CHOIX_CALCUL,
  CONFIG,
  DIFFICULTES_IA,
  LIBELLES_IA,
  LIBELLES_NIVEAU,
  LIBELLES_OPERATION_COURT,
  NIVEAUX,
} from '../core/config';
import { getLogger } from '../core/logger';
import { declarerEcran } from '../ui/ecran';
import { selection } from '../ui/selection';
import { RETRO, creerBoutonRetro, creerCadreBorne, suivant, texteRetro } from '../ui/retro';
import { SKINS } from '../rig/personnage';

const log = getLogger('Select');

/** Combattants jouables : les skins animés (« Mortal Kombat »), avec leur nom. */
const IDS_SKIN = Object.values(SKINS)
  .filter((s) => s.sprites)
  .map((s) => s.id);

/** Positions des commandes (coordonnées de référence des tests E2E). */
export const PLACE_SELECT = {
  retour: { x: 175, y: 60 },
  lignes: {
    j1Skin: 165,
    j1Niveau: 230,
    j1Operation: 295,
    j2Skin: 365,
    j2Niveau: 430,
    j2Operation: 495,
  },
  separateur: 330,
  flecheGauche: 700,
  flecheDroite: 1100,
  valeur: 900,
  libelle: 110,
  lancer: { x: 640, y: 595, largeur: 700, hauteur: 80 },
} as const;

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
    const duel = CONFIG.mode === 'duel';

    // ------------------------------- BLOC JOUEUR 1 (toutes ses choix ensemble)
    this.dessinerLigne(this.ligneSkin('JOUEUR 1  ........', 'skinJ1'), p.lignes.j1Skin);
    this.dessinerLigne(this.ligneNiveau('niveau J1  ......', 'niveauJ1'), p.lignes.j1Niveau);
    this.dessinerLigne(this.ligneCalcul('calcul J1  ......', 'operationJ1'), p.lignes.j1Operation);

    // Séparateur net entre les deux blocs : jamais de choix interleaved.
    this.add.rectangle(640, p.separateur, 1160, 2, RETRO.cadre);

    // ------------------------------------ BLOC ADVERSAIRE (J2 ou IA, pas mixé)
    if (duel) {
      this.dessinerLigne(this.ligneSkin('JOUEUR 2  ........', 'skinJ2'), p.lignes.j2Skin);
      this.dessinerLigne(this.ligneNiveau('niveau J2  ......', 'niveauJ2'), p.lignes.j2Niveau);
      this.dessinerLigne(this.ligneCalcul('calcul J2  ......', 'operationJ2'), p.lignes.j2Operation);
    } else {
      this.dessinerLigne(this.ligneSkin('I A  ............', 'skinJ2'), p.lignes.j2Skin);
      this.dessinerLigne(
        {
          libelle: 'difficulté IA ....',
          valeur: () => LIBELLES_IA[CONFIG.ia.difficulte],
          moins: () => {
            CONFIG.ia.difficulte = suivant(DIFFICULTES_IA, CONFIG.ia.difficulte, -1);
          },
          plus: () => {
            CONFIG.ia.difficulte = suivant(DIFFICULTES_IA, CONFIG.ia.difficulte, 1);
          },
        },
        p.lignes.j2Niveau
      );
      texteRetro(this, 640, 500, 'diffic. IA = score moyen en attaque et défense', {
        taille: 18,
        couleur: RETRO.texteAccent,
      });
    }

    creerBoutonRetro({
      scene: this,
      x: p.lancer.x,
      y: p.lancer.y,
      largeur: p.lancer.largeur,
      hauteur: p.lancer.hauteur,
      libelle: '[  ▶  L A N C E R   L E   C O M B A T  ]',
      taille: 32,
      couleur: RETRO.boutonLancer,
      onClic: () => this.lancer(),
    });

    // Entrée = lancer, comme la touche START d'une borne.
    this.input.keyboard?.on('keydown-ENTER', () => this.lancer());
  }

  // ------------------------------------------------------------ lignes (J1/J2)

  private ligneSkin(libelle: string, cle: 'skinJ1' | 'skinJ2'): LigneSelect {
    return {
      libelle,
      valeur: () => SKINS[selection[cle]]?.nom ?? selection[cle].toUpperCase(),
      moins: () => {
        selection[cle] = suivant(IDS_SKIN, selection[cle], -1);
      },
      plus: () => {
        selection[cle] = suivant(IDS_SKIN, selection[cle], 1);
      },
    };
  }

  private ligneNiveau(libelle: string, cle: 'niveauJ1' | 'niveauJ2'): LigneSelect {
    return {
      libelle,
      valeur: () => LIBELLES_NIVEAU[selection[cle]],
      moins: () => {
        selection[cle] = suivant(NIVEAUX, selection[cle], -1);
      },
      plus: () => {
        selection[cle] = suivant(NIVEAUX, selection[cle], 1);
      },
    };
  }

  /** Couple attaque/défense : ◀ ▶ entre « ×/÷ » et « +/− ». */
  private ligneCalcul(libelle: string, cle: 'operationJ1' | 'operationJ2'): LigneSelect {
    return {
      libelle,
      valeur: () => LIBELLES_OPERATION_COURT[selection[cle]],
      moins: () => {
        selection[cle] = suivant(CHOIX_CALCUL, selection[cle], -1);
      },
      plus: () => {
        selection[cle] = suivant(CHOIX_CALCUL, selection[cle], 1);
      },
    };
  }

  // ------------------------------------------------------------- rendu & actions

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
