/**
 * FightScene — boucle de combat jouable (jalons J4).
 *
 * Solo vs IA (J6 ajoutera le 2 joueurs) :
 *  - tours alternés (§2.1), rythmes DIFFÉRÉ / SIMULTANÉ selon la config (I15) ;
 *  - 3 calculs simultanés + clavier numérique dans la zone du joueur actif
 *    (§2.2/§2.3/§2.7) ; seul le calcul résolu est remplacé ; erreur = le calcul
 *    reste (I4, I12) ;
 *  - l'IA joue ses phases sur la durée configurée, énergie progressive (§2.6) ;
 *  - résolution : solde = attaque − défense → dégâts ou CONTRE-ATTAQUE (§2.4),
 *    barres de vie animées, K.O. (I5) ;
 *  - traces par le logger (DEBUG) ; hook de debug `window.__mathkombat` (DEBUG).
 *
 * Présentation provisoire : les sprites cut-out et le juice arrivent en J5.
 */
import Phaser from 'phaser';
import { CONFIG } from '../core/config.ts';
import type { Difficulte } from '../core/config.ts';
import {
  CombatEngine,
  PhaseCalcul,
  palierAura,
  tierFrappe,
} from '../core/combat-engine.ts';
import type { ResultatTour, Tour, TraceEvent } from '../core/combat-engine.ts';
import { AiController } from '../core/ai-controller.ts';
import { getLogger } from '../core/logger';
import { Numpad, TOUCHES_J1 } from '../ui/numpad.ts';
import { QuizOverlay } from '../ui/quiz-overlay.ts';

declare const __BUILD_MODE__: string | undefined;

const log = getLogger('Fight');

const LARGEUR = 1280;
const HAUTEUR = 720;
const SOL = 686;
const DIFFICULTES: Difficulte[] = ['facile', 'moyen', 'difficile'];

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

/** Mélange une teinte vers le blanc : la lueur reste lisible sur décor clair. */
function melangerVersBlanc(couleur: number, ratio: number): number {
  const m = (v: number): number => Math.round(v + (255 - v) * ratio);
  const r = m((couleur >> 16) & 0xff);
  const g = m((couleur >> 8) & 0xff);
  const b = m(couleur & 0xff);
  return (r << 16) | (g << 8) | b;
}

type NaturePhase = 'attaque' | 'defense' | 'simultane';

interface Combattant {
  nom: string;
  corps: Phaser.GameObjects.Container;
  /** Conteneur des flammes (fusion ADD) : alpha = palier, échelle = intensité. */
  aura: Phaser.GameObjects.Container;
  /** Vignette sombre feutrée derrière le personnage (contraste WCAG, normal blend). */
  ombre: Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Image;
  /** Étincelles montantes (particules d'aura). */
  particules: Phaser.GameObjects.Ellipse[];
  teinte: number;
  /** Teinte éclaircie vers le blanc (couleur des flammes). */
  lueur: number;
  palier: number;
  /** Alpha cible du palier courant : l'impulsion doit y revenir en fin de tween. */
  alphaPalier: number;
  /** Tween d'impulsion en cours (une seule à la fois). */
  impulsion: Phaser.Tweens.Tween | null;
}

export class FightScene extends Phaser.Scene {
  private engine!: CombatEngine;
  private ia!: AiController;
  private tourCourant: Tour | null = null;
  private naturePhase: NaturePhase | null = null;
  private tempsPhase = CONFIG.tempsPhase;
  private dureePhaseCourante = CONFIG.tempsPhase;
  private chronoRestant = 0;
  private minuteur: Phaser.Time.TimerEvent | null = null;

  private j1!: Combattant;
  private j2!: Combattant;
  private barre1!: Phaser.GameObjects.Graphics;
  private barre2!: Phaser.GameObjects.Graphics;
  private textePv1!: Phaser.GameObjects.Text;
  private textePv2!: Phaser.GameObjects.Text;
  private texteChrono!: Phaser.GameObjects.Text;
  private textePhase!: Phaser.GameObjects.Text;
  private texteEnergie1!: Phaser.GameObjects.Text;
  private texteEnergie2!: Phaser.GameObjects.Text;
  private bandeauResolution!: Phaser.GameObjects.Text;

  private quizJ1!: QuizOverlay;
  private quizJ2!: QuizOverlay;
  private numpadJ1!: Numpad;

  /** Énergie progressive affichée pour l'IA (accumulation visuelle, §2.6). */
  private progressionIA = 0;
  private gainIAPrevu = 0;
  private iaEnCours = false;

  constructor() {
    super('Fight');
  }

  create(): void {
    this.dessinerArene();
    this.j1 = this.creerCombattant('J1', 360, 0x3f7fe0, 'persoA');
    this.j2 = this.creerCombattant('IA', 920, 0xd4433a, 'persoB');
    this.dessinerHud();

    this.quizJ1 = new QuizOverlay(this, 40, 130, 'gauche', (d) =>
      this.numpadJ1.setCible(d)
    );
    this.quizJ2 = new QuizOverlay(this, LARGEUR - 40, 130, 'droite');
    this.numpadJ1 = new Numpad({
      scene: this,
      x: 40,
      y: 250,
      alignement: 'gauche',
      onValider: (d) => this.onValiderSaisie(d),
      touches: TOUCHES_J1,
    });

    this.quizJ1.setActif(false);
    this.quizJ2.setActif(false);
    this.numpadJ1.setActif(false);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => {
        if (this.engine?.etat.fini) this.lancerCombat();
      });
    }

    this.installerHookDebug();
    this.lancerCombat();
  }

  // ============================================================== décor / HUD

  private dessinerArene(): void {
    if (this.textures.exists('arene')) {
      // décor cut-out généré (docs/assets.md) — plan du fond, plein écran
      this.add.image(0, 0, 'arene').setOrigin(0).setDisplaySize(LARGEUR, HAUTEUR);
      // ligne de sol renforcée par-dessus (repère visuel des pieds)
      const l = this.add.graphics();
      l.fillStyle(0x000000, 0.35);
      l.fillRect(0, SOL - 4, LARGEUR, 8);
      return;
    }
    // repli : dégradé procedural (assets absents — dev hors-ligne)
    const g = this.add.graphics();
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      g.fillStyle(Phaser.Display.Color.GetColor(13 + t * 25, 8 + t * 12, 32 + t * 45), 1);
      g.fillRect(0, t * SOL, LARGEUR, SOL / 12 + 1);
    }
    g.fillStyle(0x241a3d, 1);
    g.fillRect(0, SOL, LARGEUR, HAUTEUR - SOL);
    g.fillStyle(0x3d2f66, 1);
    g.fillRect(0, SOL, LARGEUR, 6);
  }

  /** Crée (une seule fois) une copie teintée d'une texture de flamme, par
   *  multiplication CPU par pixel — le tint WebGL (`setTint`) n'est pas fiable
   *  sous tous les rendus (captures headless, certains WebView). */
  private textureTeintee(source: string, couleur: number, cible: string): string {
    if (this.textures.exists(cible)) return cible;
    const img = this.textures.get(source).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return source;
    ctx.drawImage(img, 0, 0);
    const donnees = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tr = (couleur >> 16) & 0xff;
    const tg = (couleur >> 8) & 0xff;
    const tb = couleur & 0xff;
    for (let i = 0; i < donnees.data.length; i += 4) {
      donnees.data[i] = (donnees.data[i] * tr) / 255;
      donnees.data[i + 1] = (donnees.data[i + 1] * tg) / 255;
      donnees.data[i + 2] = (donnees.data[i + 2] * tb) / 255;
    }
    ctx.putImageData(donnees, 0, 0);
    this.textures.addCanvas(cible, canvas);
    return cible;
  }

  private creerCombattant(
    nom: string,
    x: number,
    teinte: number,
    texture: string
  ): Combattant {
    const conteneur = this.add.container(x, SOL);
    conteneur.setScale(0.62);
    const lueur = melangerVersBlanc(teinte, 0.55); // couche colorée (bleu/rouge franc, contraste WCAG ≥ 3:1)
    const coeur = melangerVersBlanc(teinte, 0.85); // noyau blanc chaud (flamme à 2 couches)
    // teinte CPU : le tint WebGL (`setTint`) n'est pas appliqué par certains
    // rendus (captures headless, certains WebView) → couleurs cuites dans la texture
    const suffixe = teinte.toString(16).padStart(6, '0');
    const texLueur = [1, 2].map((v) => this.textureTeintee(`flamme${v}`, lueur, `flamme${v}-l${suffixe}`));
    const texCoeur = [1, 2].map((v) => this.textureTeintee(`flamme${v}`, coeur, `flamme${v}-c${suffixe}`));

    // vignette sombre feutrée (7 anneaux emboîtés) : arrière-plan assombri qui
    // garantit le contraste ≥ 3:1 des flammes sur le décor clair (WCAG 1.4.11)
    const ombre = this.add.graphics();
    for (let i = 0; i < 7; i++) {
      ombre.fillStyle(0x18102e, 0.07);
      ombre.fillEllipse(0, -180, 330 - i * 30, 560 - i * 50);
    }
    ombre.fillStyle(0x000000, 0.5);
    ombre.fillEllipse(0, -4, 130, 26); // ombre portée au sol

    // enveloppe de flammes (style Dragon Ball) : textures douces en fusion
    // additive, vacillement par tweens — alpha/échelle = palier (§2.8a).
    // Flamme à DEUX couches : langue colorée (enveloppe) + noyau blanc chaud.
    const aura = this.add.container(0, 0).setAlpha(0);
    FLAMMES.forEach((f, i) => {
      const flamme = this.add
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
        const noyau = this.add
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
      const p = this.add
        .ellipse((i % 2 ? -1 : 1) * (24 + ((i * 17) % 50)), -30, 6 + (i % 3) * 3, 6 + (i % 3) * 3, lueur)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      // cycle synchronisé : montée linéaire 1,6 s + alpha en yoyo (0 → 0.85 → 0)
      this.tweens.add({
        targets: p,
        y: -320,
        duration: 1600,
        ease: 'linear',
        repeat: -1,
        delay: i * 267,
      });
      this.tweens.add({
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

    const sprite = this.add.image(0, 0, texture).setOrigin(0.5, 1);
    const etiquette = this.add
      .text(0, 18, nom, {
        fontFamily: 'monospace', fontSize: '17px', color: '#ffffff',
        backgroundColor: '#1b2a52', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0);
    aura.add(particules);
    conteneur.add([ombre, aura, sprite, etiquette]);

    // respiration (idle) — mouvement permanent, non bloquant
    this.tweens.add({
      targets: conteneur,
      y: SOL - 5,
      duration: 1300,
      ease: 'sine.inout',
      yoyo: true,
      repeat: -1,
    });

    return {
      nom,
      corps: conteneur,
      aura,
      ombre,
      sprite,
      particules,
      teinte,
      lueur,
      palier: -1,
      alphaPalier: 0,
      impulsion: null,
    };
  }

  /** Vacillement déterministe d'une langue de flamme (phases décalées par
   *  index) : hauteur, largeur, éclat (autour de l'alpha de base), balancement. */
  private vaciller(flamme: Phaser.GameObjects.Image, alphaBase: number, i: number): void {
    const bx = flamme.scaleX;
    const by = flamme.scaleY;
    this.tweens.add({ targets: flamme, scaleY: by * 1.18, duration: 430 + i * 47, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 80) % 420 });
    this.tweens.add({ targets: flamme, scaleX: bx * 1.08, duration: 560 + i * 39, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 60) % 380 });
    this.tweens.add({ targets: flamme, alpha: Math.min(1, alphaBase * 1.3), duration: 370 + i * 53, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 70) % 400 });
    this.tweens.add({ targets: flamme, angle: i % 2 ? 7 : -7, duration: 690 + i * 41, ease: 'sine.inout', yoyo: true, repeat: -1, delay: (i * 55) % 360 });
  }

  /** Aura (§2.8a) : intensité = palier déterministe (alpha + taille de l'enveloppe). */
  private majAura(combattant: Combattant, energie: number): void {
    const palier = palierAura(energie);
    if (palier === combattant.palier) return;
    combattant.palier = palier;
    combattant.aura.setAlpha(CONFIG.auraAlphas[palier]);
    combattant.aura.setScale(0.7 + palier * 0.18); // flammes qui grandissent avec l'énergie
    combattant.alphaPalier = CONFIG.auraAlphas[palier];
  }

  /** Impulsion d'aura sur un calcul réussi (§2.8a : +1 petite, +7 marquée).
   *  Revient à l'alpha cible du palier COURANT (mis à jour par majAura entre-temps),
   *  jamais à la valeur figée au lancement du tween. */
  private impulsionAura(combattant: Combattant, gain: number): void {
    const saut = gain >= 7 ? 0.3 : gain >= 3 ? 0.18 : 0.1;
    // une seule impulsion à la fois sur l'alpha (le vacillement est sur l'échelle)
    combattant.impulsion?.stop();
    combattant.impulsion = this.tweens.add({
      targets: combattant.aura,
      alpha: Math.min(1, combattant.alphaPalier + saut),
      duration: 90,
      yoyo: true,
      onComplete: () => combattant.aura.setAlpha(combattant.alphaPalier),
    });
  }

  private dessinerHud(): void {
    this.barre1 = this.add.graphics();
    this.barre2 = this.add.graphics();
    this.textePv1 = this.add.text(40, 52, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#8ef0a0',
    });
    this.textePv2 = this.add.text(LARGEUR - 40, 52, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#8ef0a0',
    }).setOrigin(1, 0);
    this.texteChrono = this.add.text(LARGEUR / 2, 16, '', {
      fontFamily: 'monospace', fontSize: '38px', color: '#ffd76b',
    }).setOrigin(0.5, 0);
    this.textePhase = this.add.text(LARGEUR / 2, 62, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#7bd4ff',
    }).setOrigin(0.5, 0);
    // Énergie : sous les boutons VALIDER, en bas de chaque zone
    this.texteEnergie1 = this.add.text(40, 578, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#7bd4ff',
    });
    this.texteEnergie2 = this.add.text(LARGEUR - 40, 578, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#7bd4ff',
    }).setOrigin(1, 0);
    this.bandeauResolution = this.add.text(LARGEUR / 2, SOL - 120, '', {
      fontFamily: 'monospace', fontSize: '30px', color: '#ffd76b',
      backgroundColor: '#1b2a52', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setAlpha(0);
    this.mettreAJourHud();
  }

  private mettreAJourHud(): void {
    const pv = this.engine ? this.engine.etat.pv : { j1: CONFIG.pvMax, j2: CONFIG.pvMax };
    for (const [joueur, barre, texte, gauche] of [
      ['j1', this.barre1, this.textePv1, true],
      ['j2', this.barre2, this.textePv2, false],
    ] as const) {
      const valeur = pv[joueur];
      const largeur = 420;
      const x = gauche ? 40 : LARGEUR - 40 - largeur;
      barre.clear();
      barre.fillStyle(0x1b2a52, 1);
      barre.fillRoundedRect(x, 22, largeur, 22, 8);
      const ratio = Math.max(0, valeur / CONFIG.pvMax);
      barre.fillStyle(ratio > 0.5 ? 0x43c96a : ratio > 0.25 ? 0xe0a63c : 0xd94848, 1);
      barre.fillRoundedRect(x, 22, largeur * ratio, 22, 8);
      texte.setText(`${joueur === 'j1' ? 'J1' : 'IA'} — ${valeur} PV`);
    }
    this.texteChrono.setText(`⏱ ${this.chronoRestant}`);
  }

  // ============================================================== boucle de combat

  private lancerCombat(): void {
    this.engine = new CombatEngine({
      niveaux: { j1: 'intermediaire', j2: 'intermediaire' },
      emettre: (e: TraceEvent) => log.debug(e.event, e.data),
    });
    this.ia = new AiController(CONFIG, undefined, (e: TraceEvent) =>
      log.debug(e.event, e.data)
    );
    this.naturePhase = null;
    this.tourCourant = null;
    this.progressionIA = 0;
    this.gainIAPrevu = 0;
    this.bandeauResolution.setAlpha(0);
    // remise à pied des combattants (rejeu après K.O.)
    this.j1.corps.setPosition(360, SOL).setAngle(0).setScale(0.62);
    this.j2.corps.setPosition(920, SOL).setAngle(0).setScale(0.62);
    this.j1.palier = -1;
    this.j2.palier = -1;
    this.demarrerTour();
  }

  private demarrerTour(): void {
    this.tourCourant = this.engine.demarrerTour();
    this.progressionIA = 0;
    this.gainIAPrevu = 0;
    if (CONFIG.rythme === 'simultane') {
      this.lancerPhaseUnique();
    } else {
      this.lancerPhase('attaque');
    }
  }

  private humainJoue(nature: 'attaque' | 'defense'): boolean {
    const tour = this.tourCourant!;
    return nature === 'attaque' ? tour.attaquant === 'j1' : tour.defenseur === 'j1';
  }

  private phasePour(nature: 'attaque' | 'defense'): PhaseCalcul {
    return nature === 'attaque' ? this.tourCourant!.phaseAttaque : this.tourCourant!.phaseDefense;
  }

  /** Phase unique partagée (rythme SIMULTANÉ, I15) : un seul chrono. */
  private lancerPhaseUnique(): void {
    this.naturePhase = 'simultane';
    const humainAttaque = this.humainJoue('attaque');
    const natureHumain = humainAttaque ? 'attaque' : 'defense';
    const natureIA = humainAttaque ? 'defense' : 'attaque';

    this.preparerHumain(natureHumain);
    this.preparerIA(natureIA);
    this.textePhase.setText('ATTAQUE ×  /  DÉFENSE ÷   (même chrono)');
    this.demarrerMinuteur(this.tempsPhase);
  }

  /** Phases enchaînées (rythme DIFFÉRÉ, I15) ; phase IA = chrono immédiat (§2.6). */
  private lancerPhase(nature: 'attaque' | 'defense'): void {
    this.naturePhase = nature;
    const humain = this.humainJoue(nature);
    if (humain) {
      this.preparerHumain(nature);
    } else {
      this.preparerIA(nature);
    }
    this.textePhase.setText(
      nature === 'attaque' ? 'PHASE ATTAQUE ×' : 'PHASE DÉFENSE ÷'
    );
    // chrono immédiat pour l'IA : score déjà calculé, l'humain n'attend pas
    this.demarrerMinuteur(humain ? this.tempsPhase : CONFIG.ia.dureeChronoIA);
  }

  private preparerHumain(nature: 'attaque' | 'defense'): void {
    const phase = this.phasePour(nature);
    this.quizJ1.setActif(true);
    this.numpadJ1.setActif(true);
    this.quizJ2.setActif(false);
    for (const d of DIFFICULTES) {
      const q = phase.question(d);
      this.quizJ1.mettreAJour({ difficulte: d, enonce: q.enonce, gain: q.gain });
    }
    this.numpadJ1.reset();
    this.numpadJ1.setCible(this.quizJ1.focus);
    this.mettreAJourEnergies();
  }

  private preparerIA(nature: 'attaque' | 'defense'): void {
    const phase = this.phasePour(nature);
    this.quizJ1.setActif(false);
    this.numpadJ1.setActif(false);
    this.quizJ2.setActif(false);
    this.quizJ2.afficherMessage(
      nature === 'attaque' ? "L'IA attaque…" : "L'IA défend…",
      '#9fd0ff'
    );
    const ecart = Math.max(0, this.engine.etat.pv.j2 - this.engine.etat.pv.j1);
    const decisions = this.ia.jouerPhase(phase, CONFIG.ia.difficulte, ecart);
    this.gainIAPrevu = decisions.reduce((s, d) => s + d.gain, 0);
    this.progressionIA = 0;
    this.iaEnCours = true;
  }

  private demarrerMinuteur(duree: number): void {
    this.dureePhaseCourante = duree;
    this.chronoRestant = duree;
    this.mettreAJourHud();
    this.minuteur?.remove();
    this.minuteur = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.ticChrono(),
    });
  }

  private ticChrono(): void {
    this.chronoRestant--;
    if (this.iaEnCours) {
      // progression visuelle du score calculé de l'IA (§2.6)
      this.progressionIA = Math.round(
        this.gainIAPrevu * (1 - Math.max(0, this.chronoRestant) / this.dureePhaseCourante)
      );
    }
    this.mettreAJourHud();
    this.mettreAJourEnergies();
    if (this.chronoRestant <= 0) this.finDePhase();
  }

  private finDePhase(): void {
    this.minuteur?.remove();
    this.minuteur = null;
    this.iaEnCours = false;
    log.info('ui.timer_fin', { phase: this.naturePhase });

    if (this.naturePhase === 'simultane') {
      this.resoudreEtContinuer();
    } else if (this.naturePhase === 'attaque') {
      this.lancerPhase('defense');
    } else {
      this.resoudreEtContinuer();
    }
  }

  private resoudreEtContinuer(): void {
    this.quizJ1.setActif(false);
    this.quizJ2.setActif(false);
    this.numpadJ1.setActif(false);
    this.progressionIA = 0;

    const resultat = this.engine.resoudreTour(this.tourCourant!);
    this.afficherResolution(resultat);
    this.mettreAJourHud();

    if (resultat.ko) {
      this.time.delayedCall(600, () => this.finDeCombat());
    } else {
      this.time.delayedCall(1800, () => this.demarrerTour());
    }
  }

  private afficherResolution(r: ResultatTour): void {
    const libelle = r.contre
      ? `CONTRE-ATTAQUE : ${r.degats} dégâts pour ${r.attaquant.toUpperCase()} !`
      : r.sur === 'aucun'
        ? 'Coup bloqué !'
        : `${r.degats} dégâts pour ${r.defenseur.toUpperCase()}`;
    this.bandeauResolution
      .setText(`attaque ${r.attaque} − défense ${r.defense} = ${r.solde > 0 ? '+' : ''}${r.solde}\n${libelle}`)
      .setAlpha(1);
    this.tweens.add({
      targets: this.bandeauResolution,
      alpha: 0,
      delay: 1500,
      duration: 400,
    });

    // frappe visuelle (tier déterministe, §2.8b — juice J5)
    const attaquant = r.attaquant === 'j1' ? this.j1 : this.j2;
    const cible = r.sur === 'defenseur' ? (r.defenseur === 'j1' ? this.j1 : this.j2) : attaquant;
    const tier = tierFrappe(r.attaque);
    const direction = cible === this.j1 ? -1 : 1;

    if (tier > 0) {
      // élan de frappe de l'attaquant
      this.tweens.add({
        targets: attaquant.corps,
        x: attaquant.corps.x + (attaquant === this.j1 ? 1 : -1) * (16 + tier * 10),
        duration: 90,
        yoyo: true,
      });
      // recul de la cible (encaisse / contre : §2.8c)
      if (cible !== attaquant || r.contre) {
        this.tweens.add({
          targets: cible.corps,
          x: cible.corps.x + direction * (10 + tier * 8),
          duration: 110,
          yoyo: true,
          delay: 80,
        });
      }
      // secousse de caméra progressive (tier 2+)
      if (tier >= 2) this.cameras.main.shake(100 + tier * 40, 0.0015 * tier);
      // flash plein écran (tier 4 = surpuissance)
      if (tier >= 4) this.cameras.main.flash(180, 255, 255, 255);
      // dégâts flottants : taille et couleur selon le tier
      this.afficherDegatsFlottants(
        cible,
        r.degats,
        tier,
        r.contre
      );
    } else if (r.solde === 0 && r.attaque > 0) {
      // blocage parfait : étincelles sur le défenseur (§2.8c)
      this.tweens.add({
        targets: cible.aura,
        alpha: 0.9,
        duration: 60,
        yoyo: true,
        repeat: 2,
      });
    }
  }

  /** Dégâts flottants au-dessus de la cible (valeur = solde, §2.8b). */
  private afficherDegatsFlottants(
    cible: Combattant,
    degats: number,
    tier: number,
    contre: boolean
  ): void {
    const couleur = contre ? '#ff7b7b' : tier >= 3 ? '#ffd76b' : '#ffffff';
    const texte = this.add
      .text(cible.corps.x, SOL - 300, `${contre ? '⟲ ' : '−'}${degats}`, {
        fontFamily: 'monospace',
        fontSize: `${20 + tier * 7}px`,
        color: couleur,
        backgroundColor: '#1b2a52cc',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: texte,
      y: SOL - 380,
      alpha: 0,
      delay: 500,
      duration: 700,
      onComplete: () => texte.destroy(),
    });
  }

  private finDeCombat(): void {
    const gagnant = this.engine.etat.gagnant === 'j1' ? 'JOUEUR 1' : 'IA / JOUEUR 2';
    // K.O. : flash + chute animée du perdant (§2.8d)
    this.cameras.main.flash(240, 255, 255, 255);
    const perdant = this.engine.etat.gagnant === 'j1' ? this.j2 : this.j1;
    this.tweens.add({
      targets: perdant.corps,
      y: SOL + 26,
      angle: perdant === this.j1 ? -80 : 80,
      duration: 550,
      ease: 'quad.in',
    });
    this.bandeauResolution
      .setText(`★  K.O.  ★   ${gagnant} GAGNE !   (R = rejouer)`)
      .setAlpha(1);
  }

  // ============================================================== saisie du joueur

  private onValiderSaisie(difficulte: Difficulte): boolean {
    const valeur = this.numpadJ1.valeur;
    if (valeur === null) return false; // saisie vide = ignorée (§2.7)
    if (!this.tourCourant || !this.naturePhase) return false;

    const nature =
      this.naturePhase === 'simultane'
        ? this.humainJoue('attaque')
          ? 'attaque'
          : 'defense'
        : this.naturePhase;
    const phase = this.phasePour(nature);

    log.info('ui.saisie', { zone: 'J1', difficulte, valeur });
    log.info('ui.validation', { zone: 'J1', difficulte, valeur });
    const resultat = phase.resoudre(difficulte, valeur);

    if (resultat.correct) {
      const q = phase.question(difficulte);
      this.quizJ1.mettreAJour({ difficulte, enonce: q.enonce, gain: q.gain });
      this.numpadJ1.reset();
      this.impulsionAura(this.j1, q.gain); // impulsion d'aura (§2.8a)
    } else {
      this.quizJ1.erreur(difficulte);
      // micro-animation de gêne : l'aura reste à son niveau (§2.8a)
      // (échelle du conteneur = 0.62 : écrasement léger, le yoyo restaure)
      this.tweens.add({
        targets: this.j1.corps,
        scaleX: 0.64,
        scaleY: 0.6,
        duration: 70,
        yoyo: true,
      });
    }
    this.mettreAJourEnergies();
    return resultat.correct;
  }

  private mettreAJourEnergies(): void {
    if (!this.tourCourant) return;
    const tour = this.tourCourant;
    const phaseJ1 = tour.attaquant === 'j1' ? tour.phaseAttaque : tour.phaseDefense;
    const phaseIA = tour.attaquant === 'j1' ? tour.phaseDefense : tour.phaseAttaque;
    this.texteEnergie1.setText(`énergie J1 : +${phaseJ1.energie()}`);
    const afficheIA = this.iaEnCours ? this.progressionIA : phaseIA.energie();
    this.texteEnergie2.setText(`énergie IA : +${afficheIA}`);
    // auras en temps réel (§2.8a) — intensité = palier de l'énergie courante
    this.majAura(this.j1, phaseJ1.energie());
    this.majAura(this.j2, afficheIA);
  }

  // ============================================================== hook debug (DEBUG)

  private installerHookDebug(): void {
    if (typeof __BUILD_MODE__ === 'undefined' || __BUILD_MODE__ !== 'debug') return;
    const scene = this;
    (window as unknown as Record<string, unknown>).__mathkombat = {
      ready: true,
      etat: () => ({
        tour: scene.engine.etat.tour,
        attaquant: scene.engine.etat.attaquant,
        pv: scene.engine.etat.pv,
        fini: scene.engine.etat.fini,
        gagnant: scene.engine.etat.gagnant,
        rythme: scene.engine.etat.rythme,
        phase: scene.naturePhase,
        chrono: scene.chronoRestant,
        energieAttaque: scene.tourCourant?.phaseAttaque.energie() ?? 0,
        energieDefense: scene.tourCourant?.phaseDefense.energie() ?? 0,
        tierAttaque: tierFrappe(scene.tourCourant?.phaseAttaque.energie() ?? 0),
        palierAura: palierAura(scene.tourCourant?.phaseAttaque.energie() ?? 0),
      }),
      questionsHumain: () => {
        const nature =
          scene.naturePhase === 'simultane'
            ? scene.humainJoue('attaque')
              ? 'attaque'
              : 'defense'
            : scene.naturePhase;
        if (!nature || !scene.tourCourant) return [];
        const phase = scene.phasePour(nature);
        return DIFFICULTES.map((d) => ({
          difficulte: d,
          enonce: phase.question(d).enonce,
          reponse: phase.question(d).reponse,
          gain: phase.question(d).gain,
        }));
      },
      setTempsPhase: (secondes: number) => {
        scene.tempsPhase = Math.max(2, Math.min(60, secondes));
      },
      forceFinDePhase: () => scene.finDePhase(),
      saisie: () => scene.numpadJ1.etatSaisie(),
      aura: () => ({
        j1: { alpha: scene.j1.aura.alpha, palier: scene.j1.palier, visible: scene.j1.aura.visible },
        j2: { alpha: scene.j2.aura.alpha, palier: scene.j2.palier, visible: scene.j2.aura.visible },
      }),
      diagnosticAura: () => ({
        rendu: scene.game.renderer.type, // Phaser.CANVAS = 0, WEBGL = 1
        lueur: scene.j1.lueur,
        teinte: scene.j1.teinte,
        enfants: scene.j1.aura.list.slice(0, 14).map((o) => {
          const img = o as Partial<Phaser.GameObjects.Image>;
          return {
            tint: img.tintTopLeft ?? null,
            blend: img.blendMode ?? null,
            alpha: img.alpha ?? null,
            type: o.type,
          };
        }),
      }),
      forcerAlphaAura: (a: number) => {
        scene.j1.aura.setAlpha(a);
        scene.j2.aura.setAlpha(a);
      },
    };
  }
}
