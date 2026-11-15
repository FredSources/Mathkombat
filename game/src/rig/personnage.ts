/**
 * rig/personnage.ts — modèle de `Personnage` (docs/architecture.md §9).
 *
 * **Une seule interface** pour faire bouger un combattant, quel que soit son
 * skin : déplacements (`vaAGauche`…`vaEnBas`), garde, vocabulaire de coups
 * (`coupDePoing`, `coupDePied`, `saut`, `parade`, `contre`, `encaisse`, `ko`),
 * énergie (`charger`, `impulsion`).
 *
 * Rendu : **sprites animés style Mortal Kombat / Street Fighter** (8 poses par
 * combattant, `game/assets/sprites-mk/`) — l'ancien rig cut-out a été retiré.
 *
 * Règles d'architecture (§9.4) :
 *  - **orientation = état** (`gauche`/`droite`) : le sens des coups et la
 *    symétrie du sprite (miroir) en découlent ; les deux combattants se
 *    retournent d'eux-mêmes (`orienterVers`) pour toujours se faire face ;
 *  - **skin = donnée** (`SkinPersonnage`) : sprites, teintes, prénom — ajouter
 *    un combattant = ajouter un descripteur, aucun code ;
 *  - **intensités lues dans `config.ts`** (§2.8) et dans le skin (durée de
 *    frame) : cette classe n'en contient aucune.
 */
import Phaser from 'phaser';
import { CONFIG, coupPourTier } from '../core/config.ts';
import type { Coup } from '../core/config.ts';

// ---------------------------------------------------------------- types

/** Sens du personnage : côté vers lequel il fait face et frappe (§9.4, état). */
export type Orientation = 'gauche' | 'droite';
/** Vocabulaire de coups de poing (§9.2). */
export type CoupDePoing = 'direct' | 'uppercut' | 'crochet';
/** Vocabulaire de coups de pied (§9.2). */
export type CoupDePied = 'haut' | 'bas';

/**
 * Poses d'un combattant (style Mortal Kombat / Street Fighter) : le déplacement
 * joue `marche-*`, les coups jouent `poing`/`pied`, les chocs `touche`, etc.
 */
export type PoseSprite =
  | 'garde'
  | 'marche-avant'
  | 'marche-arriere'
  | 'saut'
  | 'poing'
  | 'pied'
  | 'garde-defense'
  | 'touche';

/** Déplacement pendant un saut (exclusif) : rester sur place, avancer, reculer. */
export type DeplacementSaut = 'place' | 'avant' | 'arriere';

/** Action pendant un saut (exclusif, optionnelle) : un coup ou un contre. */
export type ActionSaut = 'coup' | 'contre';

/** Composition d'un saut (§2.8c) : déplacement **et/ou** action. */
export interface OptionsSaut {
  deplacement?: DeplacementSaut;
  action?: ActionSaut;
}

/** Rendu par sprites animés : les poses sont des clés de textures. */
export interface SpritesSkin {
  /** Une ou plusieurs images par pose (la marche alterne deux frames). */
  poses: Record<PoseSprite, string[]>;
  /** Largeur d'affichage du sprite (hauteur proportionnelle). */
  largeur: number;
  /** Durée d'une frame de marche (ms) — « un peu moins rapide » que la v1. */
  dureeFrameMs: number;
  /** Durée d'une pose d'action avant le retour à la garde (ms). */
  dureePoseMs: number;
}

/** Skin = descripteur de DONNÉES (§9.3) : changer de skin = changer de skin. */
export interface SkinPersonnage {
  id: string;
  /** Libellé affiché (sélection, écrans) — le prénom du combattant. */
  nom: string;
  /** Sens dans lequel les sprites sont dessinés (le jeu miroir au besoin). */
  orientation: Orientation;
  teintes: { base: number; lueur: number; coeur: number };
  /** Rendu par sprites animés (style Mortal Kombat / Street Fighter). */
  sprites: SpritesSkin;
}

/** Mélange une teinte vers le blanc : la lueur reste lisible sur décor clair. */
function melangerVersBlanc(couleur: number, ratio: number): number {
  const m = (v: number): number => Math.round(v + (255 - v) * ratio);
  const r = m((couleur >> 16) & 0xff);
  const g = m((couleur >> 8) & 0xff);
  const b = m(couleur & 0xff);
  return (r << 16) | (g << 8) | b;
}

/** Teintes d'un skin à partir de sa couleur de base (déterministe). */
function teintesDe(base: number): SkinPersonnage['teintes'] {
  return { base, lueur: melangerVersBlanc(base, 0.55), coeur: melangerVersBlanc(base, 0.85) };
}

/**
 * Échelle FIXE de l'enveloppe de flammes : les flammes gardent la taille et la
 * densité du début — l'aura grandit par **ajout de couches** (paliers), jamais
 * par étirement (demande utilisateur, §2.8a). La table FLAMMES est calée sur la
 * silhouette des sprites (260 px de large, 236 px de haut).
 */
const ECHELLE_AURA = 1;

/**
 * Écartement des couches de flammes (§2.8a) : la couche 0 est **petite, proche
 * du corps** (à peine perceptible à 0 énergie), chaque palier suivant **ajoute**
 * une strate de flammes nettement plus large — l'aura **grandit** avec l'énergie,
 * taille et densité des flammes inchangées.
 */
const ECARTEMENTS_COUCHES: readonly number[] = [0.9, 1.18, 1.45];

/**
 * Poses d'un combattant : clés de textures `mk-<id>-<i>` (chargées par
 * `BootScene` depuis `game/assets/sprites-mk/`). La marche joue le **cycle de
 * pas** (`marche` = 8 frames générées) — l'avant et l'arrière partagent le
 * cycle (l'arrière le joue à l'envers).
 */
function posesMk(id: string, marche: string): Record<PoseSprite, string[]> {
  const pas = Array.from({ length: 8 }, (_, i) => `mk-${marche}-${i}`);
  return {
    garde: [`mk-${id}-0`],
    'marche-avant': pas,
    'marche-arriere': [...pas].reverse(),
    saut: [`mk-${id}-3`],
    poing: [`mk-${id}-4`],
    pied: [`mk-${id}-5`],
    'garde-defense': [`mk-${id}-6`],
    touche: [`mk-${id}-7`],
  };
}

/** Les 6 combattants (prénoms) — ajouter un combattant = ajouter une entrée ici. */
export const SKINS: Record<string, SkinPersonnage> = {
  karateka: {
    id: 'karateka',
    nom: 'KENJI',
    orientation: 'droite',
    teintes: teintesDe(0x3f7fe0),
    sprites: { poses: posesMk('j1', 'm1'), largeur: 260, dureeFrameMs: 130, dureePoseMs: 500 },
  },
  combattante: {
    id: 'combattante',
    nom: 'KIRA',
    orientation: 'gauche',
    teintes: teintesDe(0xd4433a),
    sprites: { poses: posesMk('j2', 'm2'), largeur: 260, dureeFrameMs: 130, dureePoseMs: 500 },
  },
  boxeur: {
    id: 'boxeur',
    nom: 'TITAN',
    orientation: 'droite',
    teintes: teintesDe(0xd4a13a),
    sprites: { poses: posesMk('h2', 'm3'), largeur: 291, dureeFrameMs: 130, dureePoseMs: 500 },
  },
  ninja: {
    id: 'ninja',
    nom: 'NYX',
    orientation: 'droite',
    teintes: teintesDe(0x7a5fd4),
    sprites: { poses: posesMk('f2', 'm4'), largeur: 239, dureeFrameMs: 130, dureePoseMs: 500 },
  },
  guerrier: {
    id: 'guerrier',
    nom: 'ZANE',
    orientation: 'droite',
    teintes: teintesDe(0x3f7fe0),
    sprites: { poses: posesMk('z1', 'm5'), largeur: 255, dureeFrameMs: 130, dureePoseMs: 500 },
  },
  guerriere: {
    id: 'guerriere',
    nom: 'BLAZE',
    orientation: 'droite',
    teintes: teintesDe(0xd4433a),
    sprites: { poses: posesMk('z2', 'm6'), largeur: 281, dureeFrameMs: 130, dureePoseMs: 500 },
  },
};

/** Skin par id — erreur explicite si inconnu (§9.3 : pas de fallback en dur). */
export function skinDe(id: string): SkinPersonnage {
  const skin = SKINS[id];
  if (!skin) throw new Error(`skin de personnage inconnu : ${id}`);
  return skin;
}

// ---------------------------------------------------------------- effets injectés

/**
 * Effets d'impact fournis par la scène (§2.8b/c) : `Personnage` déclenche les
 * étincelles et ondes de choc mais ne les dessine pas (juice = présentation
 * inter-personnages, reste dans `FightScene`).
 */
export interface EffetsPersonnage {
  etincelles(x: number, y: number, nombre: number, couleur: string): void;
  ondeDeChoc(x: number, y: number, tier: number): void;
}

export interface OptionsPersonnage {
  scene: Phaser.Scene;
  id: string;
  skin: SkinPersonnage;
  /** Position de départ (pieds). */
  x: number;
  y: number;
  nom: string;
  orientation: Orientation;
  /** Bornes de déplacement dans l'arène (px). */
  limites: { xMin: number; xMax: number; yMin: number; yMax: number };
  effets?: EffetsPersonnage;
  /** Appelé à la fin de chaque déplacement (mise à jour des orientations). */
  onDeplace?: () => void;
}

/** Résultat d'un coup lancé : ce que la scène a besoin de savoir pour l'impact. */
export interface CoupLance {
  coup: Coup;
  droite: boolean;
}

// ---------------------------------------------------------------- classe

export class Personnage {
  readonly id: string;
  readonly skin: SkinPersonnage;
  orientation: Orientation;
  /** Conteneur du personnage (position dans l'arène, échelle, respiration). */
  readonly corps: Phaser.GameObjects.Container;
  /** Conteneur des flammes (fusion ADD) : alpha = palier, échelle = intensité. */
  readonly aura: Phaser.GameObjects.Container;
  /** Conteneur du sprite (bouge lors du saut, avec l'aura). */
  readonly rig: Phaser.GameObjects.Container;
  /** Étiquette de nom sous le personnage (libellé J1 / IA / J2). */
  readonly etiquette: Phaser.GameObjects.Text;
  readonly teinte: number;
  /** Teinte éclaircie vers le blanc (couleur des flammes). */
  readonly lueur: number;
  /** Palier d'aura courant (§2.8a) — debug/E2E. */
  palier = -1;

  private readonly scene: Phaser.Scene;
  private readonly options: OptionsPersonnage;
  /** Alpha cible du palier courant : l'impulsion doit y revenir en fin de tween. */
  private alphaPalier = 0;
  /** Tween d'impulsion en cours (une seule à la fois). */
  private impulsionEnCours: Phaser.Tweens.Tween | null = null;
  private nomInterne: string;
  /** Sprite animé (style Mortal Kombat). */
  private spriteAnime: Phaser.GameObjects.Image;
  /** Échelle d'affichage de base du sprite (le zoom de profondeur s'y applique). */
  private echelleAffichage = 1;
  /** Pose affichée (debug/E2E). */
  private poseCourante: PoseSprite = 'garde';
  /** Minuteur d'animation courant (marche alternée / retour à la garde). */
  private minuteurAnim: Phaser.Time.TimerEvent | null = null;
  /** Mouvement de suivi en cours (marche) — les coups partent à sa fin. */
  private tweenDeplacement: Phaser.Tweens.Tween | null = null;
  private apresMouvements: (() => void)[] = [];
  /** Couches de flammes (§2.8a) : la 0 = base, les suivantes élargissent l'aura. */
  private readonly couchesAura: Phaser.GameObjects.Container[] = [];

  constructor(options: OptionsPersonnage) {
    this.options = options;
    this.scene = options.scene;
    this.id = options.id;
    this.skin = options.skin;
    this.orientation = options.orientation;
    this.nomInterne = options.nom;
    this.teinte = options.skin.teintes.base;
    this.lueur = options.skin.teintes.lueur;

    const scene = this.scene;
    const conteneur = scene.add.container(options.x, options.y);
    const lueur = options.skin.teintes.lueur;
    const coeur = options.skin.teintes.coeur;
    // teinte CPU : le tint WebGL (`setTint`) n'est pas appliqué par certains
    // rendus (captures headless, certains WebView) → couleurs cuites dans la texture
    const suffixe = this.teinte.toString(16).padStart(6, '0');
    const texLueur = [1, 2].map((v) =>
      this.textureTeintee(`flamme${v}`, lueur, `flamme${v}-l${suffixe}`)
    );
    const texCoeur = [1, 2].map((v) =>
      this.textureTeintee(`flamme${v}`, coeur, `flamme${v}-c${suffixe}`)
    );

    // ombre portée au sol : **proportionnelle au gabarit et collée aux pieds**
    // (elle suit le sol quand le personnage saute — le saut ne bouge que le
    // sprite et l'aura, jamais l'ombre)
    const ombre = scene.add.graphics();
    ombre.fillStyle(0x000000, 0.5);
    ombre.fillEllipse(0, -2, options.skin.sprites.largeur * 0.55, 22);

    // enveloppe de flammes (§2.8a) : la **couche 0** = les flammes très proches
    // du corps (« niveau 1 ») ; chaque palier AJOUTE une strate « un peu moins
    // proche » — **densité constante, taille des flammes inchangée** : l'aura
    // grandit par ajout, jamais par étirement (demande utilisateur).
    const aura = scene.add.container(0, 0).setAlpha(0).setScale(ECHELLE_AURA);
    for (let couche = 0; couche < ECARTEMENTS_COUCHES.length; couche++) {
      const facteur = ECARTEMENTS_COUCHES[couche]; // écartement, pas de taille
      const assise = scene.add.container(0, 0).setAlpha(couche === 0 ? 1 : 0);
      FLAMMES.forEach((f, i) => {
        const flamme = scene.add
          .image(f.x * facteur, f.y * facteur, texLueur[i % 2])
          .setOrigin(0.5, 1)
          // fusion NORMALE : la langue garde sa couleur sur le décor clair
          // (l'ADD la délavait en blanc) — le noyau, lui, reste en ADD.
          .setBlendMode(Phaser.BlendModes.NORMAL)
          .setDisplaySize(f.l, f.h) // TAILLE FIXE : la densité reste celle du début
          .setAlpha(f.d * 0.9);
        assise.add(flamme);
        this.vaciller(flamme, f.d * 0.9, i);
        // noyau incandescent sur les langues épaisses (pieds, jambes, torses, tête, couronne)
        if (f.d >= 0.8) {
          const noyau = scene.add
            .image(f.x * 0.68 * facteur, f.y * facteur, texCoeur[i % 2])
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(f.l * 0.45, f.h * 0.55)
            .setAlpha(f.d * 0.6);
          noyau.setOrigin(0.5, 1);
          assise.add(noyau);
          this.vaciller(noyau, f.d * 0.6, i + 4);
        }
      });
      aura.add(assise);
      this.couchesAura.push(assise);
    }

    // étincelles montantes (§2.8a : « quelques particules qui montent »)
    const particules: Phaser.GameObjects.Ellipse[] = [];
    for (let i = 0; i < 6; i++) {
      const p = scene.add
        .ellipse(
          (i % 2 ? -1 : 1) * (24 + ((i * 17) % 50)),
          -30,
          6 + (i % 3) * 3,
          6 + (i % 3) * 3,
          lueur
        )
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      // cycle synchronisé : montée linéaire 1,6 s + alpha en yoyo (0 → 0.85 → 0)
      scene.tweens.add({
        targets: p,
        y: -320,
        duration: 1600,
        ease: 'linear',
        repeat: -1,
        delay: i * 267,
      });
      scene.tweens.add({
        targets: p,
        alpha: 0.85,
        duration: 800,
        ease: 'sine.inout',
        yoyo: true,
        repeat: -1,
        delay: i * 267,
      });
      particules.push(p);
    }

    // sprite animé (style Mortal Kombat), posé par les pieds
    const sprite = scene.add
      .image(0, 0, options.skin.sprites.poses.garde[0])
      .setOrigin(0.5, 1);
    this.echelleAffichage = options.skin.sprites.largeur / Math.max(1, sprite.width);
    sprite.setScale(this.echelleAffichage);
    this.spriteAnime = sprite;
    this.appliquerMiroir(); // sens initial (symétrie droite/gauche)

    const rig = scene.add.container(0, 0);
    rig.add(sprite);
    const etiquette = scene.add
      .text(0, 18, options.nom, {
        fontFamily: 'monospace', fontSize: '17px', color: '#ffffff',
        backgroundColor: '#1b2a52', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0);
    aura.add(particules);
    conteneur.add([ombre, aura, rig, etiquette]);

    // respiration (idle) — mouvement permanent, non bloquant. Seul le SPRITE
    // respire : l'ombre portée reste **collée au sol** (demande : le halo ne
    // quitte les pieds qu'en cas de saut).
    this.corps = conteneur;
    this.aura = aura;
    this.rig = rig;
    this.etiquette = etiquette;
    this.respirer();
  }

  /** Respiration (idle) : seul le sprite bouge, l'ombre reste au sol. */
  private respirer(): void {
    this.scene.tweens.add({
      targets: this.rig,
      y: -5,
      duration: 1300,
      ease: 'sine.inout',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Nom affiché (étiquette sous le personnage) — libellé J1 / IA / J2. */
  get nom(): string {
    return this.nomInterne;
  }

  set nom(valeur: string) {
    this.nomInterne = valeur;
    this.etiquette.setText(valeur);
  }

  /** Pose actuellement affichée (debug/E2E). */
  get pose(): PoseSprite {
    return this.poseCourante;
  }

  /** Échelle du sprite (profondeur : zoom + vers le bas, − vers le haut). */
  get echelleSprite(): number {
    return this.spriteAnime.scale;
  }

  // ------------------------------------------------------- déplacements (effectifs)

  /**
   * Déplacement effectif du personnage dans l'arène (§9.2) : tween court,
   * borné aux limites — le corps bouge vraiment, y compris pour les déplacements
   * que le gameplay n'utilise pas encore. La marche est animée (2 frames).
   */
  private deplacer(dx: number, dy: number): void {
    const l = this.options.limites;
    const x = Math.min(l.xMax, Math.max(l.xMin, this.corps.x + dx));
    const y = Math.min(l.yMax, Math.max(l.yMin, this.corps.y + dy));
    const avant = dx === 0 ? dy < 0 : dx > 0;
    const versAvant = (this.orientation === 'droite') === avant;
    this.jouerMarche(versAvant ? 'marche-avant' : 'marche-arriere');
    // profondeur : le bas de l'arène est plus près (zoom +), le haut plus loin
    // (zoom −) — le sprite change d'échelle en même temps que le déplacement
    if (dy !== 0) {
      const facteur = 1 + (dy > 0 ? CONFIG.rig.zoomProfondeur : -CONFIG.rig.zoomProfondeur);
      this.scene.tweens.add({
        targets: this.spriteAnime,
        scale: this.echelleAffichage * facteur,
        duration: CONFIG.rig.deplacementDureeMs,
        ease: 'quad.out',
      });
    }
    this.tweenDeplacement = this.scene.tweens.add({
      targets: this.corps,
      x,
      y,
      duration: CONFIG.rig.deplacementDureeMs,
      ease: 'quad.out',
      onComplete: () => {
        this.jouerPose('garde');
        this.options.onDeplace?.(); // orientations des deux face à face
        this.terminerMouvement();
      },
    });
  }

  /**
   * Exécute `action` à la **fin des mouvements de suivi** (§2.8b) : jamais en
   * parallèle d'un déplacement — le déplacement pour un coup arrive quand les
   * deux combattants sont immobiles.
   */
  quandImmobile(action: () => void): void {
    if (!this.tweenDeplacement) {
      action();
      return;
    }
    // le mouvement en cours doit finir d'abord (un autre peut s'enchaîner)
    this.apresMouvements.push(() => this.quandImmobile(action));
  }

  /** Mouvement de suivi terminé : les actions en attente repartent. */
  private terminerMouvement(): void {
    this.tweenDeplacement = null;
    const attentes = this.apresMouvements;
    this.apresMouvements = [];
    for (const action of attentes) action();
  }

  /** Se décale vers la gauche (borné à l'arène). */
  vaAGauche(): void {
    this.deplacer(-CONFIG.rig.deplacementPas, 0);
  }

  /** Se décale vers la droite (borné à l'arène). */
  vaADroite(): void {
    this.deplacer(CONFIG.rig.deplacementPas, 0);
  }

  /** Se décale vers le haut (borné à l'arène). */
  vaEnHaut(): void {
    this.deplacer(0, -CONFIG.rig.deplacementPas);
  }

  /** Se décale vers le bas (borné à l'arène). */
  vaEnBas(): void {
    this.deplacer(0, CONFIG.rig.deplacementPas);
  }

  /**
   * Correction de position **en marchant** (check de distance des manœuvres) :
   * le personnage fait un pas vers la position cible — jamais un saut de
   * coordonnées.
   */
  corrigerVers(x: number, y: number): void {
    this.jouerMarche(x > this.corps.x ? 'marche-avant' : 'marche-arriere');
    this.tweenDeplacement = this.scene.tweens.add({
      targets: this.corps,
      x,
      y,
      duration: CONFIG.rig.deplacementDureeMs,
      ease: 'quad.out',
      onComplete: () => {
        this.jouerPose('garde');
        this.terminerMouvement();
      },
    });
  }

  /** Oriente le personnage : sens des coups + symétrie du sprite (§9.4). */
  orienter(orientation: Orientation): void {
    if (orientation === this.orientation) return;
    this.orientation = orientation;
    this.appliquerMiroir();
  }

  /**
   * Face à l'adversaire : s'oriente vers lui — un personnage dépassé se
   * retourne de lui-même (symétrie des sprites).
   */
  orienterVers(autre: Personnage): void {
    this.orienter(this.corps.x <= autre.corps.x ? 'droite' : 'gauche');
  }

  /** Garde haute (§2.8c). */
  gardeHaute(): void {
    this.jouerPose('garde-defense', this.skin.sprites.dureePoseMs);
  }

  /** Garde basse (§2.8c). */
  gardeBasse(): void {
    this.jouerPose('garde-defense', this.skin.sprites.dureePoseMs);
  }

  // ------------------------------------------------------- coups (interface unique)

  /** Coup de poing nommé (§9.2) : direct / uppercut / crochet. */
  coupDePoing(_coup: CoupDePoing): void {
    this.jouerPose('poing', this.skin.sprites.dureePoseMs);
  }

  /** Coup de pied nommé (§9.2) : haut / bas. */
  coupDePied(_coup: CoupDePied): void {
    this.jouerPose('pied', this.skin.sprites.dureePoseMs);
  }

  /**
   * Saut (§2.8c) — composé, exclusif dans chaque famille :
   *  - **déplacement** : `rester sur place` | `avancer` | `reculer` ;
   *  - **action** (optionnelle) : `donner un coup` (coup de pied sauté) ou
   *    `faire un contre` (garde puis riposte).
   * Le sprite et l'aura montent (l'ombre reste au sol) ; le déplacement
   * horizontal se fait **pendant** le saut.
   */
  saut(options: OptionsSaut = {}): void {
    const rig = CONFIG.rig;
    const { deplacement = 'place', action } = options;
    this.jouerPose('saut', rig.sautDureeMs);
    this.scene.tweens.add({
      targets: [this.rig, this.aura],
      y: -rig.sautHauteur,
      duration: rig.sautDureeMs / 2,
      ease: 'quad.out',
      yoyo: true,
    });
    // déplacement horizontal pendant le saut (« avant » = le sens du regard)
    if (deplacement !== 'place') {
      const sens = (this.orientation === 'droite' ? 1 : -1) * (deplacement === 'avant' ? 1 : -1);
      this.scene.tweens.add({
        targets: this.corps,
        x: Phaser.Math.Clamp(
          this.corps.x + sens * CONFIG.rig.deplacementPas * 2,
          this.options.limites.xMin,
          this.options.limites.xMax
        ),
        duration: rig.sautDureeMs,
        ease: 'sine.inOut',
      });
    }
    // action au sommet du saut : un coup sauté, ou un contre (garde → riposte)
    if (action === 'coup') {
      this.scene.time.delayedCall(rig.sautDureeMs / 2, () =>
        this.jouerPose('pied', this.skin.sprites.dureePoseMs)
      );
    } else if (action === 'contre') {
      this.scene.time.delayedCall(rig.sautDureeMs / 2, () => {
        this.jouerPose('garde-defense');
        this.scene.time.delayedCall(250, () =>
          this.jouerPose('pied', this.skin.sprites.dureePoseMs)
        );
      });
    }
  }

  /**
   * Frappe graduée (§2.8b) : l'attaquant **s'approche** de la cible, donne le
   * coup, puis **revient à sa position d'origine**. La réaction de la cible
   * (encaisse / parade / contre) part **au contact**, via `auContact` — le
   * mouvement de choc du défenseur a lieu APRÈS le coup (§2.8c).
   */
  frapper(cible: Personnage, tier: number, auContact?: (info: CoupLance) => void): CoupLance {
    const info: CoupLance = { coup: coupPourTier(tier), droite: cible.corps.x > this.corps.x };
    this.approcher(cible, () => {
      this.jouerPose(info.coup === 'poing' ? 'poing' : 'pied', this.skin.sprites.dureePoseMs);
      auContact?.(info);
    });
    return info;
  }

  /**
   * Marche animée vers `x` (§2.8b) — `vitesse` > 1 = marche accélérée : la
   * cadence du pas ET la vitesse de déplacement accélèrent ensemble, le
   * mouvement reste une **marche** (jamais une glissade).
   */
  private marcherVers(x: number, vitesse: number, arrivee: () => void): void {
    const versDroite = x > this.corps.x;
    const distance = Math.abs(x - this.corps.x);
    this.jouerMarche(versDroite ? 'marche-avant' : 'marche-arriere', vitesse);
    this.tweenDeplacement = this.scene.tweens.add({
      targets: this.corps,
      x,
      // durée = distance / vitesse de marche accélérée (pas de marche × vitesse)
      duration: (distance * CONFIG.rig.deplacementDureeMs) / (CONFIG.rig.deplacementPas * vitesse),
      ease: 'quad.out',
      onComplete: () => {
        arrivee();
        this.terminerMouvement();
      },
    });
  }

  /**
   * Approche de la cible pour donner un coup, puis **retour à la position
   * d'origine** (chorégraphie §2.8b) : `action` est jouée au contact.
   *
   * Le déplacement du coup se fait **à la fin des mouvements de suivi** (jamais
   * en parallèle d'un déplacement de couple), en **marche accélérée**, et avance
   * d'une **distance fixe** : le couple gardant une distance constante (corrigée
   * avant), le contact est identique à chaque coup — le poing/pied touche et
   * pénètre légèrement la silhouette adverse (`penetrationFrappe`).
   */
  private approcher(cible: Personnage, action: () => void): void {
    // à la fin des mouvements de suivi des deux combattants
    this.quandImmobile(() =>
      cible.quandImmobile(() => {
        const xDepart = this.corps.x;
        const versDroite = cible.corps.x > this.corps.x;
        // distance fixe du coup : écart de combat − portée de contact
        const portee =
          (this.skin.sprites.largeur + cible.skin.sprites.largeur) / 2 -
          CONFIG.rig.penetrationFrappe;
        const ecartCombat = Math.abs(cible.options.x - this.options.x);
        const xContact = xDepart + (versDroite ? 1 : -1) * (ecartCombat - portee);
        // aller en MARCHE ACCÉLÉRÉE (geste d'attaque) — le coup au contact
        this.marcherVers(xContact, CONFIG.rig.approcheVitesse, () => {
          action(); // le coup est donné — effets + réaction du défenseur au contact
          // retour APRÈS la réaction du défenseur (choc / contre, §2.8c) :
          // le mouvement de choc du défenseur et le contre arrivent AVANT
          this.scene.time.delayedCall(this.skin.sprites.dureePoseMs, () =>
            cible.quandImmobile(() =>
              this.marcherVers(xDepart, CONFIG.rig.approcheVitesse, () =>
                this.jouerPose('garde')
              )
            )
          );
        });
      })
    );
  }

  /**
   * Recul de la cible touchée (§2.8b) — pose « touché ». Le recul est le
   * **mouvement de choc du défenseur** : il a lieu APRÈS le coup de l'attaquant
   * et AVANT son retour arrière (suivi pour l'ordonnancement, §2.8c).
   */
  encaisse(tier: number, direction = 1): void {
    this.jouerPose('touche', this.skin.sprites.dureePoseMs);
    this.tweenDeplacement = this.scene.tweens.add({
      targets: this.corps,
      x: this.corps.x + direction * (10 + tier * 8),
      duration: 110,
      yoyo: true,
      delay: 70,
      onComplete: () => this.terminerMouvement(),
    });
  }

  /**
   * CONTRE (§2.8c) : l'attaquant **s'approche et frappe dans le vide** (esquive),
   * ce personnage se décale puis riposte — **le contre arrive avant le retour de
   * l'attaquant** (l'esquive part au coup, le retour attend la riposte).
   * Joué sur CONTRE-ATTAQUE **et sur égalité de points** (au lieu du mouvement
   * de choc, demande utilisateur).
   */
  contre(
    attaquant: Personnage,
    tier: number,
    apresRiposte?: (droite: boolean) => void
  ): void {
    // 1. l'attaquant s'approche et frappe… dans le vide
    attaquant.approcher(this, () => {
      attaquant.jouerPose('poing', this.skin.sprites.dureePoseMs);
      // 2. AU COUP : ce personnage se décale (esquive), puis riposte au pied
      const versAvant = attaquant.corps.x < this.corps.x ? 1 : -1;
      this.tweenDeplacement = this.scene.tweens.add({
        targets: this.corps,
        x: this.corps.x + versAvant * -22,
        duration: 120,
        yoyo: true,
        onComplete: () => {
          this.terminerMouvement();
          // la riposte part vers l'attaquant
          const droite = attaquant.corps.x > this.corps.x;
          this.saut();
          this.jouerPose('pied', this.skin.sprites.dureePoseMs);
          // 3. l'attaquant REÇOIT le contre (« coup reçu ») — le recul est porté
          // par le SPRITE (rig), pas par le corps : le retour de l'approche
          // pilote `corps.x` et un tween concurrent l'annulerait
          attaquant.jouerPose('touche', this.skin.sprites.dureePoseMs);
          this.scene.tweens.add({
            targets: attaquant.rig,
            x: attaquant.rig.x - versAvant * (14 + tier * 9),
            duration: 110,
            yoyo: true,
          });
          apresRiposte?.(droite);
        },
      });
    });
  }

  /** K.O. (§2.8d) : bascule en arrière autour des pieds — la respiration s'arrête. */
  ko(): void {
    this.jouerPose('touche');
    // la respiration s'arrête au K.O. (demande utilisateur)
    this.scene.tweens.killTweensOf(this.rig);
    // bascule EN ARRIÈRE autour des pieds, **sans déplacement en hauteur**
    // (demande utilisateur) — l'ombre reste au sol, droite, sous le personnage
    this.scene.tweens.add({
      targets: this.rig,
      angle: this.orientation === 'droite' ? -80 : 80,
      duration: 550,
      ease: 'quad.in',
    });
  }

  // ------------------------------------------------------- énergie (§2.8a)

  /** Aura (§2.8a) : strates de flammes — 0 = très proche (voire invisible). */
  charger(energie: number): void {
    const palier = palierDe(energie);
    if (palier === this.palier) return;
    this.palier = palier;
    this.aura.setAlpha(CONFIG.auraAlphas[palier]);
    // palier 0 = à peine visible (couche proche seule) ; puis une strate de plus
    const actives = palier === 0 ? 1 : palier;
    this.couchesAura.forEach((couche, i) => couche.setAlpha(i < actives ? 1 : 0));
    this.alphaPalier = CONFIG.auraAlphas[palier];
  }

  /**
   * Impulsion d'aura sur un calcul réussi (§2.8a : +1 petite, +7 marquée).
   * Revient à l'alpha cible du palier COURANT, jamais à la valeur figée au
   * lancement du tween.
   */
  impulsion(gain: number): void {
    const saut = gain >= 7 ? 0.3 : gain >= 3 ? 0.18 : 0.1;
    // une seule impulsion à la fois sur l'alpha (le vacillement est sur l'échelle)
    this.impulsionEnCours?.stop();
    this.impulsionEnCours = this.scene.tweens.add({
      targets: this.aura,
      alpha: Math.min(1, this.alphaPalier + saut),
      duration: 90,
      yoyo: true,
      onComplete: () => this.aura.setAlpha(this.alphaPalier),
    });
  }

  // ------------------------------------------------------- vie de combat

  /**
   * Remise à pied (rejeu après K.O.) : sprite, aura et corps à leur position de
   * départ, pose de garde.
   */
  reinitialiser(): void {
    this.scene.tweens.killTweensOf([this.rig, this.aura, this.corps]);
    // un tween tué ne passe pas par onComplete : le verrou d'immobilité est
    // remis à zéro (sinon les coups suivants resteraient en attente)
    this.tweenDeplacement = null;
    this.apresMouvements = [];
    this.corps.setPosition(this.options.x, this.options.y).setAngle(0);
    this.rig.setPosition(0, 0).setAngle(0); // le K.O. pivote le sprite : remis droit
    this.aura.setPosition(0, 0);
    this.jouerPose('garde');
    this.couchesAura.forEach((couche, i) => couche.setAlpha(i === 0 ? 1 : 0));
    this.respirer(); // la respiration repart après le nettoyage des tweens
    this.palier = -1;
    this.alphaPalier = 0;
  }

  // ------------------------------------------------------- intérieur

  /** Pose courante : annule les animations en cours. */
  private jouerPose(pose: PoseSprite, retourApresMs = 0): void {
    this.minuteurAnim?.remove(false);
    this.poseCourante = pose;
    this.spriteAnime.setTexture(this.skin.sprites.poses[pose][0]);
    this.appliquerMiroir();
    this.minuteurAnim =
      retourApresMs > 0
        ? this.scene.time.delayedCall(retourApresMs, () => this.jouerPose('garde'))
        : null;
  }

  /** Marche animée : alterne le pas et la garde pendant le déplacement.
   *  `vitesse` > 1 accélère le cycle (marche rapide de l'attaque). */
  private jouerMarche(pose: 'marche-avant' | 'marche-arriere', vitesse = 1): void {
    const frames = this.skin.sprites.poses[pose];
    this.minuteurAnim?.remove(false);
    this.poseCourante = pose;
    let i = 0;
    this.minuteurAnim = this.scene.time.addEvent({
      delay: this.skin.sprites.dureeFrameMs / Math.max(1, vitesse),
      loop: true,
      callback: () => {
        i = (i + 1) % frames.length;
        this.spriteAnime.setTexture(frames[i]);
        this.appliquerMiroir();
      },
    });
  }

  /** Symétrie du sprite : miroir selon l'orientation et le sens de dessin. */
  private appliquerMiroir(): void {
    this.spriteAnime.setFlipX(this.orientation !== this.skin.orientation);
  }

  /** Vacillement déterministe d'une langue de flamme (phases décalées par index). */
  private vaciller(flamme: Phaser.GameObjects.Image, alphaBase: number, i: number): void {
    const bx = flamme.scaleX;
    const by = flamme.scaleY;
    this.scene.tweens.add({ targets: flamme, scaleY: by * 1.18, duration: 430 + i * 47, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 80) % 420 });
    this.scene.tweens.add({ targets: flamme, scaleX: bx * 1.08, duration: 560 + i * 39, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 60) % 380 });
    this.scene.tweens.add({ targets: flamme, alpha: Math.min(1, alphaBase * 1.3), duration: 370 + i * 53, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 70) % 400 });
    this.scene.tweens.add({ targets: flamme, angle: i % 2 ? 7 : -7, duration: 690 + i * 41, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 55) % 360 });
  }

  /** Texture recolorée CPU (le tint WebGL n'est pas fiable partout). */
  private textureTeintee(source: string, couleur: number, cible: string): string {
    if (this.scene.textures.exists(cible)) return cible;
    const base = this.scene.textures.get(source).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `#${couleur.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.scene.textures.addCanvas(cible, canvas);
    return cible;
  }
}

// ---------------------------------------------------------------- aura

/**
 * Palier d'aura déterministe (§2.8a) : 0 = lueur, 1 = flamme, 2 = forte,
 * 3 = saturée. L'énergie de jeu n'est PAS plafonnée (I11) — palier visuel seul.
 */
export function palierDe(energie: number): number {
  const e = Math.max(0, energie);
  const max = CONFIG.energieVisuelleMax;
  if (e <= max * 0.25) return 0;
  if (e <= max * 0.5) return 1;
  if (e <= max * 0.75) return 2;
  return 3;
}

// ---------------------------------------------------------------- flamme

/**
 * Emplacement des langues de flamme autour du personnage (§2.8a, style
 * Dragon Ball : l'enveloppe **épouse la silhouette**, sans s'en éloigner).
 * Coords locales du conteneur (pieds = 0, tête ≈ −217) calées sur les sprites
 * (260 px de large, 236 px de haut) ; `l`×`h` = taille affichée,
 * `d` = densité d'éclat. Le vacillement est animé par tweens.
 */
const FLAMMES: readonly { x: number; y: number; l: number; h: number; d: number }[] = [
  { x: -45, y: 3, l: 98, h: 98, d: 1.0 }, // pied gauche
  { x: 45, y: 3, l: 98, h: 98, d: 1.0 }, // pied droit
  { x: -74, y: -16, l: 85, h: 106, d: 0.95 }, // jambe gauche
  { x: 74, y: -16, l: 85, h: 106, d: 0.95 }, // jambe droite
  { x: -86, y: -92, l: 76, h: 100, d: 0.85 }, // torse gauche
  { x: 86, y: -92, l: 76, h: 100, d: 0.85 }, // torse droit
  { x: -67, y: -163, l: 71, h: 92, d: 0.75 }, // épaule gauche
  { x: 67, y: -163, l: 71, h: 92, d: 0.75 }, // épaule droite
  { x: -29, y: -217, l: 76, h: 95, d: 0.8 }, // tête gauche
  { x: 29, y: -217, l: 76, h: 95, d: 0.8 }, // tête droite
  { x: 0, y: -236, l: 89, h: 100, d: 0.85 }, // couronne
];
