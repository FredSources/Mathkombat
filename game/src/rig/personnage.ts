/**
 * rig/personnage.ts — modèle de `Personnage` (docs/architecture.md §9).
 *
 * **Une seule interface** pour faire bouger un combattant, quel que soit son
 * skin : déplacements (`vaAGauche`…`vaEnBas`), garde, vocabulaire de coups
 * (`coupDePoing`, `coupDePied`, `saut`, `parade`, `contre`, `encaisse`, `ko`),
 * énergie (`charger`, `impulsion`).
 *
 * Règles d'architecture (§9.4) :
 *  - **orientation = état** (`gauche`/`droite`) : le sens des coups et le miroir
 *    de la table de profondeurs en découlent, jamais un paramètre re-passé ;
 *  - **skin = donnée** (`SkinPersonnage`) : textures, pivots, profondeurs,
 *    teintes — ajouter un skin = ajouter un descripteur, aucun code ;
 *  - **intensités lues dans `config.ts`** (§2.8) : cette classe n'en contient
 *    aucune.
 */
import Phaser from 'phaser';
import { CONFIG, coupPourTier } from '../core/config.ts';
import type { Coup } from '../core/config.ts';

// ---------------------------------------------------------------- types

/** Pièces du rig cut-out articulé (scripts/assets-rig.py, docs/assets.md §3a). */
export type Membre = 'buste' | 'bras-g' | 'bras-d' | 'jambe-g' | 'jambe-d';
export const PIECES_RIG: readonly Membre[] = ['buste', 'bras-g', 'bras-d', 'jambe-g', 'jambe-d'];

/** Sens du personnage : côté vers lequel il fait face et frappe (§9.4, état). */
export type Orientation = 'gauche' | 'droite';
/** Vocabulaire de coups de poing (§9.2). */
export type CoupDePoing = 'direct' | 'uppercut' | 'crochet';
/** Vocabulaire de coups de pied (§9.2). */
export type CoupDePied = 'haut' | 'bas';

/** Meta d'une pièce telle que produite par scripts/assets-rig.py (rig-meta.json). */
export interface MetaPiece {
  fichier: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  pivotX?: number;
  pivotY?: number;
}

export interface MetaRig {
  largeur: number;
  hauteur: number;
  pieces: Record<Membre, MetaPiece>;
}

/** Skin = descripteur de DONNÉES (§9.3) : changer de skin = changer de skin. */
export interface SkinPersonnage {
  id: string;
  /** Texture de l'image plate (repli si le rig cut-out est absent). */
  sprite: string;
  /** Clé du rig dans `rig-meta.json`. */
  metaCle: string;
  /** Textures des 5 pièces cut-out. */
  pieces: Record<Membre, string>;
  /** Sens dans lequel les textures sont dessinées (pas de miroir inutile). */
  orientation: Orientation;
  /** Profondeurs pour l'orientation du skin ; miroirées si on l'oriente autrement. */
  profondeurs: Record<Membre, number>;
  teintes: { base: number; lueur: number; coeur: number };
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

/** Profondeur du membre en cours d'animation (passe devant, §3a). */
const PROFONDEUR_ANIME = 16;

/**
 * Skins disponibles (§9.3) — données pures : ajouter un personnage = ajouter
 * une entrée ici (+ ses textures), aucune modification de `Personnage` ni des
 * scènes. Un skin inconnu est une **erreur explicite** (pas de repli silencieux).
 */
export const SKINS: Record<string, SkinPersonnage> = {
  persoA: {
    id: 'persoA',
    sprite: 'persoA',
    metaCle: 'rig-a',
    pieces: {
      buste: 'rig-a-buste',
      'bras-g': 'rig-a-bras-g',
      'bras-d': 'rig-a-bras-d',
      'jambe-g': 'rig-a-jambe-g',
      'jambe-d': 'rig-a-jambe-d',
    },
    orientation: 'droite',
    profondeurs: { 'bras-g': 5, 'jambe-g': 8, buste: 10, 'jambe-d': 12, 'bras-d': 15 },
    teintes: teintesDe(0x3f7fe0),
  },
  persoB: {
    id: 'persoB',
    sprite: 'persoB',
    metaCle: 'rig-b',
    pieces: {
      buste: 'rig-b-buste',
      'bras-g': 'rig-b-bras-g',
      'bras-d': 'rig-b-bras-d',
      'jambe-g': 'rig-b-jambe-g',
      'jambe-d': 'rig-b-jambe-d',
    },
    orientation: 'gauche',
    profondeurs: { 'bras-g': 15, 'jambe-g': 12, buste: 10, 'jambe-d': 8, 'bras-d': 5 },
    teintes: teintesDe(0xd4433a),
  },
};

/** Miroir gauche↔droite des pièces du rig (§9.4). */
const MIROIR_MEMBRE: Record<Membre, Membre> = {
  buste: 'buste',
  'bras-g': 'bras-d',
  'bras-d': 'bras-g',
  'jambe-g': 'jambe-d',
  'jambe-d': 'jambe-g',
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
  /** Conteneur du rig cut-out : pièces articulées, ou l'image plate en repli. */
  readonly rig: Phaser.GameObjects.Container;
  /** Pièces articulées (pivots épaule/hanche) — null = repli image plate. */
  readonly membres: Record<Membre, Phaser.GameObjects.Image> | null;
  /** Étiquette de nom sous le personnage (libellé J1 / IA / J2). */
  readonly etiquette: Phaser.GameObjects.Text;
  readonly teinte: number;
  /** Teinte éclaircie vers le blanc (couleur des flammes). */
  readonly lueur: number;
  /** Palier d'aura courant (§2.8a) — debug/E2E. */
  palier = -1;
  /** Membres en cours d'animation, clés `id:membre` (debug/E2E). */
  readonly membresActifs = new Set<string>();

  private readonly scene: Phaser.Scene;
  private readonly options: OptionsPersonnage;
  /** Alpha cible du palier courant : l'impulsion doit y revenir en fin de tween. */
  private alphaPalier = 0;
  /** Tween d'impulsion en cours (une seule à la fois). */
  private impulsionEnCours: Phaser.Tweens.Tween | null = null;
  private nomInterne: string;

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
    conteneur.setScale(CONFIG.rig.echelle);
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

    // vignette sombre feutrée (7 anneaux emboîtés) : arrière-plan assombri qui
    // garantit le contraste ≥ 3:1 des flammes sur le décor clair (WCAG 1.4.11)
    const ombre = scene.add.graphics();
    for (let i = 0; i < 7; i++) {
      ombre.fillStyle(0x18102e, 0.07);
      ombre.fillEllipse(0, -180, 330 - i * 30, 560 - i * 50);
    }
    ombre.fillStyle(0x000000, 0.5);
    ombre.fillEllipse(0, -4, 130, 26); // ombre portée au sol

    // enveloppe de flammes (style Dragon Ball) : textures douces en fusion
    // additive, vacillement par tweens — alpha/échelle = palier (§2.8a).
    // Flamme à DEUX couches : langue colorée (enveloppe) + noyau blanc chaud.
    const aura = scene.add.container(0, 0).setAlpha(0);
    FLAMMES.forEach((f, i) => {
      const flamme = scene.add
        .image(f.x, f.y, texLueur[i % 2])
        .setOrigin(0.5, 1)
        // fusion NORMALE : la langue garde sa couleur sur le décor clair
        // (l'ADD la délavait en blanc) — le noyau, lui, reste en ADD.
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setDisplaySize(f.l, f.h)
        .setAlpha(f.d * 0.9);
      aura.add(flamme);
      this.vaciller(flamme, f.d * 0.9, i);
      // noyau incandescent sur les langues épaisses (pieds, jambes, torses, tête, couronne)
      if (f.d >= 0.8) {
        const noyau = scene.add
          .image(f.x * 0.68, f.y, texCoeur[i % 2])
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(f.l * 0.45, f.h * 0.55)
          .setAlpha(f.d * 0.6);
        noyau.setOrigin(0.5, 1);
        aura.add(noyau);
        this.vaciller(noyau, f.d * 0.6, i + 4);
      }
    });

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

    const sprite = scene.add.image(0, 0, options.skin.sprite).setOrigin(0.5, 1);
    // rig cut-out articulé : 5 pièces posées par bbox source et pivotées autour
    // de leurs articulations ; si les textures sont absentes, l'image plate
    // reste visible (repli sans dégradation du rendu)
    const rig = scene.add.container(0, 0);
    const membres = this.construireRig(rig);
    if (membres) sprite.setVisible(false);
    rig.add(sprite);
    const etiquette = scene.add
      .text(0, 18, options.nom, {
        fontFamily: 'monospace', fontSize: '17px', color: '#ffffff',
        backgroundColor: '#1b2a52', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0);
    aura.add(particules);
    conteneur.add([ombre, aura, rig, etiquette]);

    // respiration (idle) — mouvement permanent, non bloquant
    scene.tweens.add({
      targets: conteneur,
      y: options.y - 5,
      duration: 1300,
      ease: 'sine.inout',
      yoyo: true,
      repeat: -1,
    });

    this.corps = conteneur;
    this.aura = aura;
    this.rig = rig;
    this.membres = membres;
    this.etiquette = etiquette;
  }

  /** Nom affiché (étiquette sous le personnage) — libellé J1 / IA / J2. */
  get nom(): string {
    return this.nomInterne;
  }

  set nom(valeur: string) {
    this.nomInterne = valeur;
    this.etiquette.setText(valeur);
  }

  // ------------------------------------------------------- déplacements (effectifs)

  /**
   * Déplacement effectif du personnage dans l'arène (§9.2) : tween court,
   * borné aux limites — le corps bouge vraiment, y compris pour les déplacements
   * que le gameplay n'utilise pas encore.
   */
  private deplacer(dx: number, dy: number): void {
    const l = this.options.limites;
    const x = Math.min(l.xMax, Math.max(l.xMin, this.corps.x + dx));
    const y = Math.min(l.yMax, Math.max(l.yMin, this.corps.y + dy));
    this.scene.tweens.add({
      targets: this.corps,
      x,
      y,
      duration: CONFIG.rig.deplacementDureeMs,
      ease: 'quad.out',
    });
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

  /** Oriente le personnage : sens des coups + miroir des profondeurs (§9.4). */
  orienter(orientation: Orientation): void {
    if (orientation === this.orientation) return;
    this.orientation = orientation;
    // le sens de l'image ne change que si on s'écarte du sens de dessin du skin
    this.rig.setScale(orientation === this.skin.orientation ? 1 : -1, 1);
    if (this.membres) this.appliquerProfondeurs();
  }

  /** Garde haute (bras levé, §2.8c). */
  gardeHaute(): void {
    this.animerMembre(
      this.orientation === 'droite' ? 'bras-d' : 'bras-g',
      CONFIG.rig.angles.gardeHaute * (this.orientation === 'droite' ? -1 : 1)
    );
  }

  /** Garde basse (jambe levée, §2.8c). */
  gardeBasse(): void {
    this.animerMembre(
      this.orientation === 'droite' ? 'jambe-d' : 'jambe-g',
      CONFIG.rig.angles.gardeBasse * (this.orientation === 'droite' ? -1 : 1)
    );
  }

  // ------------------------------------------------------- coups (interface unique)

  /** Coup de poing nommé (§9.2) : direct / uppercut / crochet. */
  coupDePoing(coup: CoupDePoing): void {
    const angle =
      coup === 'uppercut'
        ? CONFIG.rig.angles.uppercut
        : coup === 'crochet'
          ? CONFIG.rig.angles.crochet
          : CONFIG.rig.angles.poing;
    this.animerCoup('poing', angle);
  }

  /** Coup de pied nommé (§9.2) : haut / bas. */
  coupDePied(coup: CoupDePied): void {
    this.animerCoup(coup === 'haut' ? 'pied-haut' : 'pied-bas');
  }

  /** Saut (§9.2) : rig + aura montent (l'ombre reste au sol). */
  saut(): void {
    const rig = CONFIG.rig;
    this.scene.tweens.add({
      targets: [this.rig, this.aura],
      y: -rig.sautHauteur,
      duration: rig.sautDureeMs / 2,
      ease: 'quad.out',
      yoyo: true,
    });
  }

  /**
   * Frappe graduée (§2.8b) : élan vers la cible, coup du tier, recul de la
   * cible. L'impact visuel est programmé par la scène à partir du résultat.
   */
  frapper(cible: Personnage, tier: number): CoupLance {
    const droite = cible.corps.x > this.corps.x;
    const avance = droite ? 1 : -1;
    const direction = droite ? 1 : -1; // recul de la cible, à l'opposé de l'attaque
    this.scene.tweens.add({
      targets: this.corps,
      x: this.corps.x + avance * (16 + tier * 10),
      duration: 90,
      yoyo: true,
    });
    const coup = coupPourTier(tier);
    this.animerCoup(coup);
    cible.encaisse(tier, direction);
    return { coup, droite };
  }

  /** Recul de la cible touchée (§2.8b). */
  encaisse(tier: number, direction = 1): void {
    this.scene.tweens.add({
      targets: this.corps,
      x: this.corps.x + direction * (10 + tier * 8),
      duration: 110,
      yoyo: true,
      delay: 70,
    });
  }

  /**
   * Parade (§2.8c) : garde côté attaquant — bras levé contre un coup haut,
   * jambe levée contre un coup bas ; étincelles à la hauteur du coup.
   */
  parade(coup: Coup, tier: number, versAttaquantDroite: boolean): void {
    const haut = coup !== 'pied-bas';
    const membre: Membre = haut
      ? versAttaquantDroite
        ? 'bras-d'
        : 'bras-g'
      : versAttaquantDroite
        ? 'jambe-d'
        : 'jambe-g';
    const base = haut ? CONFIG.rig.angles.gardeHaute : CONFIG.rig.angles.gardeBasse;
    this.animerMembre(membre, base * (versAttaquantDroite ? -1 : 1));
    this.scene.tweens.add({
      targets: this.corps,
      scaleX: this.corps.scaleX * 1.06,
      scaleY: this.corps.scaleY * 0.96,
      duration: 60,
      yoyo: true,
      repeat: 1,
    });
    this.scene.tweens.add({
      targets: this.aura,
      alpha: 0.95,
      duration: 60,
      yoyo: true,
      repeat: 2,
    });
    const y = this.options.y - CONFIG.rig.impactY[coup];
    this.options.effets?.etincelles(this.corps.x, y, Math.max(3, tier * 2), '#9fd8ff');
    if (tier >= 2) this.options.effets?.ondeDeChoc(this.corps.x, y, tier);
  }

  /**
   * CONTRE (§2.8c) : l'attaquant frappe dans le vide, ce personnage saute et
   * riposte d'un coup de pied. `apresRiposte` est appelé quand la riposte part
   * (la scène y programme son impact visuel).
   */
  contre(
    attaquant: Personnage,
    tier: number,
    apresRiposte?: (droite: boolean) => void
  ): void {
    // l'attaquant avance VERS ce personnage (il rate : esquive)
    const versAvant = attaquant.corps.x < this.corps.x ? 1 : -1;
    attaquant.animerCoup('poing');
    this.scene.tweens.add({
      targets: attaquant.corps,
      x: attaquant.corps.x + versAvant * 34,
      duration: 120,
      ease: 'quad.out',
    });
    // ce personnage se décale, saute et frappe dans la foulée
    this.scene.tweens.add({
      targets: this.corps,
      x: this.corps.x + versAvant * -22,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        // la riposte part vers l'attaquant
        const droite = attaquant.corps.x > this.corps.x;
        this.saut();
        this.animerCoup('pied-haut', CONFIG.rig.angles.contrePied);
        this.scene.tweens.add({
          targets: attaquant.corps,
          x: attaquant.corps.x - versAvant * (14 + tier * 9),
          duration: 110,
          yoyo: true,
        });
        apresRiposte?.(droite);
      },
    });
  }

  /** Coup raté (§2.8b, tier 0) : le poing sort dans le vide, on s'arrête net. */
  whiff(): void {
    const versAvant = this.orientation === 'droite' ? 1 : -1;
    this.animerCoup('poing');
    this.scene.tweens.add({
      targets: this.corps,
      x: this.corps.x + versAvant * 20,
      duration: 140,
      ease: 'sine.out',
      yoyo: true,
      onComplete: () =>
        this.options.effets?.etincelles(this.corps.x, this.options.y - 150, 3, '#8fa8d8'),
    });
  }

  /** K.O. (§2.8d) : chute animée du combattant. */
  ko(): void {
    this.scene.tweens.add({
      targets: this.corps,
      y: this.options.y + CONFIG.rig.koChuteY,
      angle: this.orientation === 'droite' ? -80 : 80,
      duration: 550,
      ease: 'quad.in',
    });
  }

  // ------------------------------------------------------- énergie (§2.8a)

  /** Aura (§2.8a) : intensité = palier déterministe (alpha + taille). */
  charger(energie: number): void {
    const palier = palierDe(energie);
    if (palier === this.palier) return;
    this.palier = palier;
    this.aura.setAlpha(CONFIG.auraAlphas[palier]);
    this.aura.setScale(0.7 + palier * 0.18); // flammes qui grandissent avec l'énergie
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
   * Remise à pied (rejeu après K.O.) : rig, membres et aura au repos, corps à
   * sa position de départ.
   */
  reinitialiser(): void {
    this.scene.tweens.killTweensOf([this.rig, this.aura, this.corps]);
    this.corps.setPosition(this.options.x, this.options.y).setAngle(0).setScale(CONFIG.rig.echelle);
    this.rig.setPosition(0, 0);
    this.aura.setPosition(0, 0);
    if (this.membres) {
      for (const piece of Object.values(this.membres)) {
        this.scene.tweens.killTweensOf(piece);
        piece.setAngle(0);
      }
      this.appliquerProfondeurs();
    }
    this.palier = -1;
    this.alphaPalier = 0;
  }

  /** État du rig (debug/E2E) : angles arrondis + saut, null en repli image plate. */
  etatRig(): { saut: number; angles: Record<string, number> } | null {
    if (!this.membres) return null;
    const angles: Record<string, number> = {};
    for (const p of PIECES_RIG) angles[p] = Math.round(this.membres[p].angle * 10) / 10;
    return { saut: Math.round(this.rig.y), angles };
  }

  // ------------------------------------------------------- intérieur

  /** Montage du rig cut-out (docs/assets.md §3a) — null = repli image plate. */
  private construireRig(rig: Phaser.GameObjects.Container): Record<Membre, Phaser.GameObjects.Image> | null {
    const metaGlobal = this.scene.cache.json.get('rigMeta') as
      | Record<string, MetaRig>
      | undefined;
    const meta = metaGlobal?.[this.skin.metaCle];
    if (!meta) return null;
    // vérification d'abord : on ne monte que si les 5 pièces sont présentes
    const clesTex = new Map<Membre, string>();
    for (const cle of PIECES_RIG) {
      const p = meta.pieces[cle];
      if (!p) return null;
      const cleTex = p.fichier.replace('/', '-').replace(/\.png$/, '');
      if (!this.scene.textures.exists(cleTex)) return null;
      clesTex.set(cle, cleTex);
    }
    const membres = {} as Record<Membre, Phaser.GameObjects.Image>;
    const demiLargeur = meta.largeur / 2;
    for (const cle of PIECES_RIG) {
      const p = meta.pieces[cle];
      const cleTex = clesTex.get(cle)!;
      const img =
        p.pivotX !== undefined && p.pivotY !== undefined
          ? this.scene.add
              .image(p.pivotX - demiLargeur, p.pivotY - meta.hauteur, cleTex)
              .setOrigin((p.pivotX - p.x) / p.largeur, (p.pivotY - p.y) / p.hauteur)
          : this.scene.add.image(p.x - demiLargeur, p.y - meta.hauteur, cleTex).setOrigin(0, 0);
      rig.add(img);
      membres[cle] = img;
    }
    this.appliquerProfondeurs();
    return membres;
  }

  /** Profondeurs du skin, miroirées si l'orientation diffère du dessin (§9.4). */
  private appliquerProfondeurs(): void {
    if (!this.membres) return;
    const table = this.skin.profondeurs;
    const miroir = this.orientation !== this.skin.orientation;
    for (const cle of PIECES_RIG) {
      const cleTable = miroir ? MIROIR_MEMBRE[cle] : cle;
      this.membres[cle].setDepth(table[cleTable]);
    }
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

  /**
   * Extension d'un membre vers la cible (docs/assets.md §3a) : angle négatif
   * vers la droite, positif vers la gauche (Phaser : horaire positif). No-op en
   * repli image plate.
   */
  private animerCoup(coup: Coup, angleForce?: number): void {
    const droite = this.orientation === 'droite';
    const membre: Membre =
      coup === 'poing' ? (droite ? 'bras-d' : 'bras-g') : droite ? 'jambe-d' : 'jambe-g';
    const angles = CONFIG.rig.angles;
    const base =
      angleForce ??
      (coup === 'poing' ? angles.poing : coup === 'pied-haut' ? angles.piedHaut : angles.piedBas);
    this.animerMembre(membre, base * (droite ? -1 : 1));
  }

  /** Rotation d'une pièce autour de son pivot : extension puis retour au repos. */
  private animerMembre(cle: Membre, angle: number): void {
    const piece = this.membres?.[cle];
    if (!piece) return; // repli image plate : l'élan du corps suffit
    const rig = CONFIG.rig;
    const suivi = `${this.id}:${cle}`;
    this.membresActifs.add(suivi);
    this.scene.tweens.killTweensOf(piece);
    piece.setDepth(PROFONDEUR_ANIME); // le membre animé passe devant (§3a)
    this.scene.tweens.add({
      targets: piece,
      angle,
      duration: rig.dureeExtensionMs,
      ease: 'quad.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: piece,
          angle: 0,
          duration: rig.dureeRetourMs,
          ease: 'sine.inout',
          onComplete: () => {
            this.membresActifs.delete(suivi);
            this.appliquerProfondeurs();
          },
        });
      },
    });
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
 * Dragon Ball : l'enveloppe suit la silhouette). Coords locales du conteneur
 * (pieds = 0, tête ≈ −420, demi-largeur ≈ 95) ; `l`×`h` = taille affichée,
 * `d` = densité d'éclat (0..1). Le vacillement est animé par tweens.
 */
const FLAMMES: readonly { x: number; y: number; l: number; h: number; d: number }[] = [
  { x: -52, y: 6, l: 86, h: 180, d: 1.0 }, // pied gauche
  { x: 52, y: 6, l: 86, h: 180, d: 1.0 }, // pied droit
  { x: -86, y: -30, l: 74, h: 195, d: 0.95 }, // jambe gauche
  { x: 86, y: -30, l: 74, h: 195, d: 0.95 }, // jambe droite
  { x: -100, y: -170, l: 66, h: 185, d: 0.85 }, // torse gauche
  { x: 100, y: -170, l: 66, h: 185, d: 0.85 }, // torse droit
  { x: -78, y: -300, l: 62, h: 170, d: 0.75 }, // épaule gauche
  { x: 78, y: -300, l: 62, h: 170, d: 0.75 }, // épaule droite
  { x: -34, y: -400, l: 66, h: 175, d: 0.8 }, // tête gauche
  { x: 34, y: -400, l: 66, h: 175, d: 0.8 }, // tête droite
  { x: 0, y: -435, l: 78, h: 185, d: 0.85 }, // couronne
];
