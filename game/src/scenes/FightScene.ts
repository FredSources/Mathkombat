/**
 * FightScene — boucle de combat jouable (jalons J4/J6).
 *
 * Solo vs IA ou DUEL 2 joueurs (§2.6) :
 *  - tours alternés (§2.1), rythmes DIFFÉRÉ / SIMULTANÉ selon la config (I15) ;
 *  - 3 calculs simultanés + clavier numérique dans la zone du joueur actif
 *    (§2.2/§2.3/§2.7) ; seul le calcul résolu est remplacé ; erreur = le calcul
 *    reste (I4, I12) ;
 *  - duel : chaque joueur a sa zone et son clavier (J1 = ligne de chiffres,
 *    J2 = pavé numérique) ; aucune phase n'appartient à l'IA, le chrono est
 *    toujours la durée de phase configurée (§2.6) ;
 *  - l'IA joue ses phases sur la durée configurée, énergie progressive (§2.6) ;
 *  - résolution : solde = attaque − défense → dégâts ou CONTRE-ATTAQUE (§2.4),
 *    barres de vie animées, K.O. (I5) ;
 *  - mise en scène : rig cut-out articulé — poing, pied haut/bas, gardes et
 *    contre sautant (§2.8, docs/assets.md §3a) + juice d'impact ;
 *  - traces par le logger (DEBUG) ; hook de debug `window.__mathkombat` (DEBUG).
 */
import Phaser from 'phaser';
import { CONFIG, lireTempsPhase } from '../core/config.ts';
import type { ConfigJeu, Coup, Difficulte, ModeJeu, Rythme } from '../core/config.ts';
import {
  CombatEngine,
  PhaseCalcul,
  palierAura,
  tierFrappe,
} from '../core/combat-engine.ts';
import type { ResultatTour, Tour, TraceEvent } from '../core/combat-engine.ts';
import { AiController } from '../core/ai-controller.ts';
import { calculerScore } from '../core/score.ts';
import type { MesuresScore } from '../core/score.ts';
import { getLogger } from '../core/logger';
import { Numpad, TOUCHES_J1, TOUCHES_J2 } from '../ui/numpad.ts';
import { QuizOverlay } from '../ui/quiz-overlay.ts';
import { declarerEcran } from '../ui/ecran.ts';
import { enregistrerRecord } from '../ui/record.ts';
import { PauseOverlay } from '../ui/pause-overlay.ts';
import { RETRO, creerBoutonRetro } from '../ui/retro.ts';
import { Personnage, skinDe } from '../rig/personnage.ts';
import type { EffetsPersonnage } from '../rig/personnage.ts';
import { selection } from '../ui/selection.ts';

declare const __BUILD_MODE__: string | undefined;

const log = getLogger('Fight');

const LARGEUR = 1280;
const HAUTEUR = 720;
/**
 * Ligne de sol des combattants : **pieds posés sur le cercle doré** de l'arène
 * (bord bas du disque mesuré dans `decors/arene-1.png` : y=416→530).
 */
const SOL = 530;
const DIFFICULTES: Difficulte[] = ['facile', 'moyen', 'difficile'];
/** Combattants recentrés dans la zone centrale de l'arène (demande utilisateur). */
const X_J1 = 470;
const X_J2 = 810;
/** Déplacements bornés entre les claviers et sous les fiches de calcul. */
const LIMITES_PERSONNAGE = {
  xMin: 380,
  xMax: 900,
  yMin: SOL - 60,
  yMax: SOL,
} as const;

type NaturePhase = 'attaque' | 'defense' | 'simultane';

// Les modèles de combattant (rig cut-out, skins, aura) vivent dans
// `rig/personnage.ts` (docs/architecture.md §9) : `FightScene` n'en contient
// plus la présentation fine.

export class FightScene extends Phaser.Scene {
  private engine!: CombatEngine;
  private ia!: AiController;
  private tourCourant: Tour | null = null;
  private naturePhase: NaturePhase | null = null;
  private tempsPhase = CONFIG.tempsPhase;
  private dureePhaseCourante = CONFIG.tempsPhase;
  private chronoRestant = 0;
  private minuteur: Phaser.Time.TimerEvent | null = null;

  private j1!: Personnage;
  private j2!: Personnage;
  private barre1!: Phaser.GameObjects.Graphics;
  private barre2!: Phaser.GameObjects.Graphics;
  private textePv1!: Phaser.GameObjects.Text;
  private textePv2!: Phaser.GameObjects.Text;
  private texteChrono!: Phaser.GameObjects.Text;
  private textePhase!: Phaser.GameObjects.Text;
  private texteEnergie1!: Phaser.GameObjects.Text;
  private texteEnergie2!: Phaser.GameObjects.Text;
  private bandeauResolution!: Phaser.GameObjects.Text;
  /** Journal de combat (5 derniers événements, §2.7 HUD) — bas centre. */
  private journalText!: Phaser.GameObjects.Text;
  /** Score de manches gagnées sur la session (J1 vs IA/J2). */
  private texteScore!: Phaser.GameObjects.Text;
  private journalEvenements: string[] = [];
  /** Ralenti « hitstop » en cours (restauré par ralentir()). */
  private ralentiActif = false;
  private manches = { j1: 0, j2: 0 };
  /** Mesures de score par joueur (§2.7) : énergies gagnées + secondes restantes. */
  private scores: Record<'j1' | 'j2', MesuresScore> = {
    j1: { energieGagnee: 0, secondesRestantes: 0 },
    j2: { energieGagnee: 0, secondesRestantes: 0 },
  };
  private texteScoreJ1!: Phaser.GameObjects.Text;
  private texteScoreJ2!: Phaser.GameObjects.Text;
  /** Menu de pause (☰ MENU) — overlay plein écran, §8 wireframes. */
  private overlayPause!: PauseOverlay;
  private enPause = false;
  /** Boutons de fin de combat (§7 wireframes) : [ REJOUER ] et [ MENU ]. */
  private boutonRejouer!: Phaser.GameObjects.Container;
  private boutonMenuFin!: Phaser.GameObjects.Container;

  private quizJ1!: QuizOverlay;
  private quizJ2!: QuizOverlay;
  private numpadJ1!: Numpad;
  private numpadJ2!: Numpad;

  /** Énergie progressive affichée pour l'IA (accumulation visuelle, §2.6). */
  private progressionIA = 0;
  private gainIAPrevu = 0;
  private iaEnCours = false;

  constructor() {
    super('Fight');
  }

  create(): void {
    declarerEcran('fight');
    this.dessinerArene();
    // à chaque déplacement, les deux se retournent face à face (symétrie sprites)
    const onDeplace = () => {
      this.j1.orienterVers(this.j2);
      this.j2.orienterVers(this.j1);
    };
    this.j1 = new Personnage({
      scene: this,
      id: 'j1',
      skin: skinDe(selection.skinJ1),
      x: X_J1,
      y: SOL,
      nom: FightScene.nomJoueur('j1'),
      orientation: 'droite',
      limites: LIMITES_PERSONNAGE,
      effets: this.effetsPersonnage(),
      onDeplace,
    });
    this.j2 = new Personnage({
      scene: this,
      id: 'j2',
      skin: skinDe(selection.skinJ2),
      x: X_J2,
      y: SOL,
      nom: FightScene.nomJoueur('j2'),
      orientation: 'gauche',
      limites: LIMITES_PERSONNAGE,
      effets: this.effetsPersonnage(),
      onDeplace,
    });
    this.dessinerHud();

    this.quizJ1 = new QuizOverlay(this, 40, 96, 'gauche', (d) =>
      this.numpadJ1.setCible(d)
    );
    this.quizJ2 = new QuizOverlay(this, LARGEUR - 40, 96, 'droite', (d) =>
      this.numpadJ2.setCible(d)
    );
    this.numpadJ1 = new Numpad({
      scene: this,
      x: 40,
      y: 560, // bas de la console (ancrage par le bas) : le bloc grandit vers le haut
      alignement: 'gauche',
      onValider: (d) => this.onValiderSaisie('j1', d),
      touches: TOUCHES_J1,
    });
    this.numpadJ2 = new Numpad({
      scene: this,
      x: LARGEUR - 40,
      y: 560, // bas de la console (ancrage par le bas)
      alignement: 'droite',
      onValider: (d) => this.onValiderSaisie('j2', d),
      touches: TOUCHES_J2,
    });

    this.quizJ1.setActif(false);
    this.quizJ2.setActif(false);
    this.numpadJ1.setActif(false);
    this.numpadJ2.setActif(false);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => {
        if (this.enPause) return; // pendant la pause, R ne rejoue pas
        if (this.engine?.etat.fini) this.lancerCombat();
      });
      // ☰ MENU : raccourci M (Échap reste « C Tout effacer » de J1, §2.7)
      this.input.keyboard.on('keydown-M', () => this.basculerPause());
    }

    this.overlayPause = new PauseOverlay({
      scene: this,
      onReprendre: () => this.fermerPause(),
      onQuitter: () => this.quitterVersMenu(),
    });

    // Boutons de fin de combat (§7) : au centre de l'arène, affichés au K.O.
    this.boutonRejouer = creerBoutonRetro({
      scene: this,
      x: 545,
      y: 330,
      largeur: 170,
      hauteur: 56,
      libelle: '[  REJOUER  ]',
      taille: 22,
      couleur: RETRO.boutonLancer,
      onClic: () => this.lancerCombat(),
    }).setVisible(false);
    this.boutonMenuFin = creerBoutonRetro({
      scene: this,
      x: 735,
      y: 330,
      largeur: 170,
      hauteur: 56,
      libelle: '[  MENU  ]',
      taille: 22,
      onClic: () => this.quitterVersMenu(),
    }).setVisible(false);

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


  /** Joue un effet s'il est préchargé ; silencieux sinon (boot partiel, couverture). */
  private jouerSon(nom: string): void {
    if (this.cache.audio.exists(nom)) this.sound.play(nom);
  }

  /** Journalise la manche (K.O.) et incrémente le score de l'équipe gagnante. */
  private cloturerManche(gagnant: 'j1' | 'j2'): void {
    this.noterJournal(`K.O. — ${FightScene.nomJoueur(gagnant)} l'emporte`);
    this.manches[gagnant]++;
    this.mettreAJourScore();
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
    // Énergie : sous les boutons VALIDER, bas de chaque zone (place d'origine)
    this.texteEnergie1 = this.add.text(40, 578, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#7bd4ff',
    });
    this.texteEnergie2 = this.add.text(LARGEUR - 40, 578, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#7bd4ff',
    }).setOrigin(1, 0);
    // Score de combat en temps réel (§2.7) : énergies gagnées + secondes restantes
    this.texteScoreJ1 = this.add.text(40, 606, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffd76b',
    });
    this.texteScoreJ2 = this.add.text(LARGEUR - 40, 606, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffd76b',
    }).setOrigin(1, 0);
    // ☰ MENU (§8 wireframes) : dans le couloir central ENTRE les deux blocs de
    // calculs — son bas est aligné sur le bas des fiches de calcul (demande).
    creerBoutonRetro({
      scene: this,
      x: 640,
      y: 164,
      largeur: 170,
      hauteur: 40,
      libelle: '☰  MENU',
      taille: 20,
      onClic: () => this.basculerPause(),
    });
    // Résolution du coup : centrée, sous le menu (demande : résultat du fight
    // aligné centre et plus en haut)
    this.bandeauResolution = this.add.text(LARGEUR / 2, 240, '', {
      fontFamily: 'monospace', fontSize: '30px', color: '#ffd76b',
      backgroundColor: '#1b2a52', padding: { x: 18, y: 8 },
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);
    // score de manche (haut centre) + journal de combat (5 derniers, bas centre)
    this.texteScore = this.add.text(LARGEUR / 2, 92, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd76b',
    }).setOrigin(0.5, 0);
    this.journalText = this.add.text(LARGEUR / 2, 600, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfe3ff',
      backgroundColor: '#0d0820cc', padding: { x: 8, y: 5 },
      align: 'center', lineSpacing: 3,
    }).setOrigin(0.5, 0);
    this.mettreAJourScore();
    this.mettreAJourHud();
  }

  /** Libellé court d'un joueur (HUD et journal) : 'IA' en solo, 'J2' en duel. */
  private static nomJoueur(id: 'j1' | 'j2'): string {
    return id === 'j1' ? 'J1' : CONFIG.mode === 'duel' ? 'J2' : 'IA';
  }

  /** Ajoute un événement en tête du journal (5 derniers maximum, §2.7). */
  private noterJournal(texte: string): void {
    this.journalEvenements = [texte, ...this.journalEvenements].slice(0, 5);
    this.journalText.setText(this.journalEvenements.join('\n'));
  }

  /** Score de manches gagnées (persiste d'un rejeu R à l'autre). */
  private mettreAJourScore(): void {
    const numero = this.manches.j1 + this.manches.j2 + 1;
    this.texteScore.setText(
      `Manche ${numero}  ·  J1 ${this.manches.j1} – ${this.manches.j2} ${FightScene.nomJoueur('j2')}`
    );
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
      texte.setText(`${FightScene.nomJoueur(joueur)} — ${valeur} PV`);
    }
    this.texteChrono.setText(`⏱ ${this.chronoRestant}`);
    this.mettreAJourScores();
  }

  /** Scores de combat en temps réel (§2.7) : énergies + secondes restantes. */
  private mettreAJourScores(): void {
    this.texteScoreJ1.setText(`SCORE J1 : ${calculerScore(this.scores.j1, false)}`);
    this.texteScoreJ2.setText(
      `SCORE ${FightScene.nomJoueur('j2')} : ${calculerScore(this.scores.j2, false)}`
    );
  }

  // ============================================================== menu de pause (§8)

  /** ☰ MENU / raccourci M : bascule du menu de pause. */
  private basculerPause(): void {
    if (this.enPause) this.fermerPause();
    else this.ouvrirPause();
  }

  /**
   * Pause réelle (§8) : chrono et animations figés (`timeScale = 0` — le Clock
   * de Phaser n'avance plus, ses `delayedCall` sont gelés), zones de calcul
   * désactivées. On reprend exactement là où l'on en était.
   */
  private ouvrirPause(): void {
    if (this.enPause) return;
    this.enPause = true;
    this.eteindreZones();
    this.time.timeScale = 0;
    this.tweens.timeScale = 0;
    this.overlayPause.ouvrir();
    log.info('ui.clic', { ecran: 'fight', cible: 'menu_pause' });
  }

  /** [ RETOUR AU JEU ] : reprendre le combat, zones remises en jeu. */
  private fermerPause(): void {
    if (!this.enPause) return;
    this.enPause = false;
    this.overlayPause.fermer();
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.reactiverZones();
    log.info('ui.clic', { ecran: 'fight', cible: 'reprendre' });
  }

  /**
   * [ QUITTER → MENU ] : abandonne la partie et revient à l'écran de lancement.
   * Les `timeScale` sont restaurés AVANT le changement de scène : le TweenManager
   * est partagé entre les scènes (le clignotement du menu doit repartir).
   */
  private quitterVersMenu(): void {
    log.info('ui.clic', { ecran: 'fight', cible: 'quitter_menu' });
    this.enPause = false;
    this.overlayPause.fermer();
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.scene.start('Menu');
  }

  /** Réactive quiz + clavier des seuls joueurs en jeu pendant cette phase. */
  private reactiverZones(): void {
    for (const joueur of ['j1', 'j2'] as const) {
      if (!this.naturePourJoueur(joueur)) continue;
      const { quiz, numpad } = this.zoneDe(joueur);
      quiz.setActif(true);
      numpad.setActif(true);
    }
  }

  // ============================================================== boucle de combat

  private lancerCombat(): void {
    // ralenti éventuel en cours : on repart à vitesse normale
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    this.ralentiActif = false;
    // réglages de l'écran CONFIG (J6) : combat toujours construit dessus
    this.tempsPhase = CONFIG.tempsPhase;
    this.engine = new CombatEngine({
      // niveaux de la sélection (§3) : en SOLO, l'IA suit le niveau de J1
      niveaux: {
        j1: selection.niveauJ1,
        j2: CONFIG.mode === 'duel' ? selection.niveauJ2 : selection.niveauJ1,
      },
      emettre: (e: TraceEvent) => log.debug(e.event, e.data),
    });
    this.ia = new AiController(CONFIG, undefined, (e: TraceEvent) =>
      log.debug(e.event, e.data)
    );
    this.naturePhase = null;
    this.tourCourant = null;
    this.progressionIA = 0;
    this.gainIAPrevu = 0;
    this.journalEvenements = [];
    this.boutonRejouer.setVisible(false);
    this.boutonMenuFin.setVisible(false);
    this.scores = {
      j1: { energieGagnee: 0, secondesRestantes: 0 },
      j2: { energieGagnee: 0, secondesRestantes: 0 },
    };
    this.mettreAJourScores();
    this.journalText.setText('');
    this.bandeauResolution.setAlpha(0);
    // remise à pied des combattants (rejeu après K.O.) — rig et membres au repos
    this.j1.reinitialiser();
    this.j2.reinitialiser();
    // libellés du mode courant (solo = IA, duel = J2) : étiquette et score
    this.j2.nom = FightScene.nomJoueur('j2');
    this.mettreAJourScore();
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

  /** Joueur qui possède cette nature de phase (attaquant = ×, défenseur = ÷). */
  private joueurDe(nature: 'attaque' | 'defense'): 'j1' | 'j2' {
    const tour = this.tourCourant!;
    return nature === 'attaque' ? tour.attaquant : tour.defenseur;
  }

  private phasePour(nature: 'attaque' | 'defense'): PhaseCalcul {
    return nature === 'attaque' ? this.tourCourant!.phaseAttaque : this.tourCourant!.phaseDefense;
  }

  /** Un joueur est humain : toujours en duel, J1 seul en solo (§2.6). */
  private estHumain(joueur: 'j1' | 'j2'): boolean {
    return CONFIG.mode === 'duel' || joueur === 'j1';
  }

  /** Nature jouée par CE joueur, ou null s'il n'est pas en jeu pendant cette phase. */
  private naturePourJoueur(joueur: 'j1' | 'j2'): 'attaque' | 'defense' | null {
    if (!this.naturePhase || !this.tourCourant) return null;
    if (this.naturePhase === 'simultane') {
      return this.joueurDe('attaque') === joueur ? 'attaque' : 'defense';
    }
    return this.joueurDe(this.naturePhase) === joueur ? this.naturePhase : null;
  }

  /** Éteint les deux zones (quiz + clavier) — avant d'activer les joueurs en jeu. */
  private eteindreZones(): void {
    this.quizJ1.setActif(false);
    this.quizJ2.setActif(false);
    this.numpadJ1.setActif(false);
    this.numpadJ2.setActif(false);
  }

  /** Phase unique partagée (rythme SIMULTANÉ, I15) : un seul chrono. */
  private lancerPhaseUnique(): void {
    this.naturePhase = 'simultane';
    this.eteindreZones();
    for (const nature of ['attaque', 'defense'] as const) {
      const joueur = this.joueurDe(nature);
      if (this.estHumain(joueur)) this.preparerJoueur(joueur, nature);
      else this.preparerIA(nature);
    }
    this.textePhase.setText('ATTAQUE ×  /  DÉFENSE ÷   (même chrono)');
    this.demarrerMinuteur(this.tempsPhase);
  }

  /** Phases enchaînées (rythme DIFFÉRÉ, I15) ; phase IA = chrono immédiat (§2.6). */
  private lancerPhase(nature: 'attaque' | 'defense'): void {
    this.naturePhase = nature;
    this.eteindreZones();
    const joueur = this.joueurDe(nature);
    if (this.estHumain(joueur)) {
      this.preparerJoueur(joueur, nature);
    } else {
      this.preparerIA(nature);
    }
    this.textePhase.setText(
      nature === 'attaque' ? 'PHASE ATTAQUE ×' : 'PHASE DÉFENSE ÷'
    );
    // chrono immédiat pour l'IA (solo) : score déjà calculé, l'humain n'attend
    // pas — en duel, les deux joueurs sont humains : toujours tempsPhase
    this.demarrerMinuteur(this.estHumain(joueur) ? this.tempsPhase : CONFIG.ia.dureeChronoIA);
  }

  /**
   * Les 3 objets de la **zone** d'un joueur (quiz + clavier + combattant) —
   * **un seul point d'accès par joueur**. `Numpad` et `QuizOverlay` sont une
   * seule classe instanciée deux fois (J1 / J2) : la logique n'est jamais
   * dupliquée par joueur, seul le réglage (`touches`, `alignement`) change.
   */
  private zoneDe(joueur: 'j1' | 'j2'): {
    quiz: QuizOverlay;
    numpad: Numpad;
    combattant: Personnage;
  } {
    return joueur === 'j1'
      ? { quiz: this.quizJ1, numpad: this.numpadJ1, combattant: this.j1 }
      : { quiz: this.quizJ2, numpad: this.numpadJ2, combattant: this.j2 };
  }

  /** Active la zone d'un joueur humain et remplit ses 3 calculs (§2.2/§2.3). */
  private preparerJoueur(joueur: 'j1' | 'j2', nature: 'attaque' | 'defense'): void {
    const phase = this.phasePour(nature);
    const { quiz, numpad } = this.zoneDe(joueur);
    quiz.setActif(true);
    numpad.setActif(true);
    for (const d of DIFFICULTES) {
      const q = phase.question(d);
      quiz.mettreAJour({ difficulte: d, enonce: q.enonce, gain: q.gain });
    }
    numpad.reset();
    numpad.setCible(quiz.focus);
    this.mettreAJourEnergies();
  }

  private preparerIA(nature: 'attaque' | 'defense'): void {
    const phase = this.phasePour(nature);
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
    this.crediterFinDePhase(); // score : secondes restantes + énergie IA (§2.7)

    if (this.naturePhase === 'simultane') {
      this.resoudreEtContinuer();
    } else if (this.naturePhase === 'attaque') {
      this.lancerPhase('defense');
    } else {
      this.resoudreEtContinuer();
    }
  }

  /**
   * Score (§2.7) en fin de phase : chaque joueur humain crédite les secondes
   * restantes (rapidité) ; l'IA crédite son énergie prévue (pas de rapidité :
   * elle consomme son court chrono, §2.6).
   */
  private crediterFinDePhase(): void {
    if (!this.naturePhase) return;
    const restant = Math.max(0, this.chronoRestant);
    const natures: readonly ('attaque' | 'defense')[] =
      this.naturePhase === 'simultane' ? ['attaque', 'defense'] : [this.naturePhase];
    for (const nature of natures) {
      const joueur = this.joueurDe(nature);
      if (this.estHumain(joueur)) this.scores[joueur].secondesRestantes += restant;
      else this.scores[joueur].energieGagnee += this.gainIAPrevu;
    }
    this.mettreAJourScores();
  }

  private resoudreEtContinuer(): void {
    this.eteindreZones();
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

  /**
   * Résolution d'un tour : journal, sons et animations.
   * Priorité visuelle : CONTRE > blocage > frappe > coup raté.
   */
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

    const attaquant = r.attaquant === 'j1' ? this.j1 : this.j2;
    const defenseur = r.defenseur === 'j1' ? this.j1 : this.j2;
    const juice = CONFIG.juice;

    if (r.contre && r.degats > 0) {
      // riposte dédiée : l'attaquant est esquivé puis frappé (§2.8c)
      const tier = tierFrappe(r.defense);
      this.noterJournal(`CONTRE de ${FightScene.nomJoueur(r.defenseur)} (+${r.degats})`);
      this.jouerSon('frappe');
      defenseur.contre(attaquant, tier, (droite) =>
        this.apresImpact(() => this.impactVisuel(attaquant, tier, true, 'pied-haut', droite))
      );
      this.juiceTier(tier, juice);
      this.afficherDegatsFlottants(attaquant, r.degats, tier, true);
    } else if (r.solde === 0 && r.attaque > 0) {
      // parade : l'énergie défense annule exactement l'attaque (§2.8c)
      this.noterJournal(`${FightScene.nomJoueur(r.defenseur)} parade`);
      this.jouerSon('blocage');
      const tierBlocage = tierFrappe(r.attaque);
      // l'attaquant s'approche et frappe… le défenseur bloque (garde)
      const { coup } = attaquant.frapper(defenseur, tierBlocage);
      defenseur.parade(coup, tierBlocage, attaquant.corps.x > defenseur.corps.x);
    } else if (r.degats > 0) {
      this.noterJournal(`${FightScene.nomJoueur(r.defenseur)} encaisse ${r.degats}`);
      this.jouerSon('frappe');
      const tierFrappeCourant = tierFrappe(r.attaque);
      // l'attaquant s'approche et frappe… le défenseur encaisse (coup porté)
      const { coup, droite } = attaquant.frapper(defenseur, tierFrappeCourant);
      defenseur.encaisse(tierFrappeCourant, droite ? 1 : -1);
      this.apresImpact(() =>
        this.impactVisuel(defenseur, tierFrappeCourant, false, coup, droite)
      );
      this.juiceTier(tierFrappeCourant, juice);
      this.afficherDegatsFlottants(defenseur, r.degats, tierFrappeCourant, false);
    } else {
      // coup raté (attaque nulle) : l'attaquant échoue à se projeter
      this.noterJournal(`${FightScene.nomJoueur(r.attaquant)} rate son coup`);
      this.jouerSon('blocage');
      attaquant.whiff();
    }
  }

  /** Juice commun aux impacts : secousse, flash (tier 4), zoom et ralenti (tier 3+). */
  private juiceTier(tier: number, juice: ConfigJeu['juice']): void {
    if (tier >= 2) this.cameras.main.shake(100 + tier * 40, juice.secousseTier * tier);
    if (tier >= 4) this.cameras.main.flash(juice.flashTier4Ms, 255, 255, 255);
    if (tier >= 3) {
      const zoom = tier >= 4 ? juice.zoomTier4 : juice.zoomTier3;
      this.tweens.add({
        targets: this.cameras.main,
        zoom,
        duration: 110,
        yoyo: true,
        ease: 'quad.out',
      });
      this.ralentir();
    }
  }

  /** Ralenti « hitstop » : tweens et horloge au ralenti, restaurés ensuite. */
  private ralentir(): void {
    const juice = CONFIG.juice;
    if (juice.ralentiFacteur >= 1 || this.ralentiActif) return;
    this.ralentiActif = true;
    this.tweens.timeScale = juice.ralentiFacteur;
    this.time.timeScale = juice.ralentiFacteur;
    // delayedCall est lui-même scale : delay × facteur = durée réelle voulue
    this.time.delayedCall(juice.ralentiDureeMs * juice.ralentiFacteur, () => {
      this.tweens.timeScale = 1;
      this.time.timeScale = 1;
      this.ralentiActif = false;
    });
  }

  /** Déclenche l'impact une fois le membre du rig pleinement sorti (§2.8b). */
  private apresImpact(action: () => void): void {
    this.time.delayedCall(CONFIG.rig.dureeExtensionMs, action);
  }

  /**
   * Effets d'impact injectés dans les `Personnage` (§2.8b/c) : étincelles et
   * ondes de choc restent dessinés par la scène (juice inter-personnages).
   */
  private effetsPersonnage(): EffetsPersonnage {
    return {
      etincelles: (x, y, nombre, couleur) => this.etincelles(x, y, nombre, couleur),
      ondeDeChoc: (x, y, tier) => this.ondeDeChoc(x, y, tier),
    };
  }

  /**
   * Flash d'impact : sprite de coup en fusion ADD (150 ms) à la hauteur du
   * coup, + cercle, étincelles radiales et onde de choc aux tiers élevés.
   */
  private impactVisuel(
    cible: Personnage,
    tier: number,
    contre: boolean,
    coup: Coup,
    _droite: boolean
  ): void {
    const x = cible.corps.x;
    const y = SOL - CONFIG.rig.impactY[coup];
    const couleur = contre ? '#ff9d6b' : '#ffffff';
    const teinteEtoiles = contre ? '#ff9d6b' : '#ffd76b'; // or : lisible sur le sol clair
    // flash d'impact : cercle net, court — pas de sprite de coup (artefacts
    // hérités de l'ancienne animation, retirés sur demande)
    const flash = this.add.circle(x, y, 20 + tier * 6, Phaser.Display.Color.HexStringToColor(couleur).color);
    flash.setBlendMode(Phaser.BlendModes.ADD).setDepth(10);
    this.tweens.add({
      targets: flash,
      scale: 1.9,
      alpha: 0,
      duration: 130,
      onComplete: () => flash.destroy(),
    });
    this.etincelles(x, y, CONFIG.juice.etincellesParTier * tier, teinteEtoiles);
    if (tier >= 2) this.ondeDeChoc(x, y, tier);
  }

  /** Étoiles d'impact projetées en radial, fusion ADD (visibles sur fond sombre). */
  private etincelles(x: number, y: number, nombre: number, couleur: string): void {
    const rgb = Phaser.Display.Color.HexStringToColor(couleur);
    for (let i = 0; i < nombre; i++) {
      const angle = (Math.PI * 2 * i) / nombre + Math.random() * 0.4;
      const distance = 45 + Math.random() * 60;
      const goutte = this.add.circle(x, y, 4 + Math.random() * 4, rgb.color);
      goutte.setBlendMode(Phaser.BlendModes.ADD).setDepth(11);
      this.tweens.add({
        targets: goutte,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 320 + Math.random() * 160,
        ease: 'quad.out',
        onComplete: () => goutte.destroy(),
      });
    }
  }

  /** Onde de choc circulaire qui s'étend à l'impact (tier 2+). */
  private ondeDeChoc(x: number, y: number, tier: number): void {
    const anneau = this.add.circle(x, y, 20).setStrokeStyle(3, 0xffffff, 0.85);
    anneau.setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    this.tweens.add({
      targets: anneau,
      radius: CONFIG.juice.ondeChocRayon * (0.6 + tier * 0.15),
      alpha: 0,
      duration: 300,
      ease: 'quad.out',
      onComplete: () => anneau.destroy(),
    });
  }

  /** Dégâts flottants au-dessus de la cible (valeur = solde, §2.8b). */
  private afficherDegatsFlottants(
    cible: Personnage,
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
    const gagnant = this.engine.etat.gagnant;
    if (!gagnant) return; // un K.O. est toujours assorti d'un gagnant
    const libelle =
      gagnant === 'j1' ? 'JOUEUR 1' : CONFIG.mode === 'duel' ? 'JOUEUR 2' : 'IA / JOUEUR 2';
    // K.O. : flash + chute animée du perdant (§2.8d)
    this.cameras.main.flash(240, 255, 255, 255);
    const perdant = gagnant === 'j1' ? this.j2 : this.j1;
    perdant.ko();
    // on retire le fade du bandeau : la bannière K.O. doit rester lisible
    this.tweens.killTweensOf(this.bandeauResolution);
    this.bandeauResolution
      .setText(`★  K.O.  ★   ${libelle} GAGNE !`)
      .setAlpha(1);
    // boutons de fin (§7 wireframes) : REJOUER ou retour au MENU
    this.boutonRejouer.setVisible(true);
    this.boutonMenuFin.setVisible(true);
    this.jouerSon('ko');
    this.cloturerManche(gagnant);
    this.cloturerScore(gagnant);
  }

  /**
   * Score final (§2.7) : bonus K.O. pour le gagnant, record persistant en mode
   * solo quand J1 l'emporte (le « propre score » du joueur, §2.5).
   */
  private cloturerScore(gagnant: 'j1' | 'j2'): void {
    const finalJ1 = calculerScore(this.scores.j1, gagnant === 'j1');
    const finalJ2 = calculerScore(this.scores.j2, gagnant === 'j2');
    this.texteScoreJ1.setText(`SCORE J1 : ${finalJ1}`);
    this.texteScoreJ2.setText(`SCORE ${FightScene.nomJoueur('j2')} : ${finalJ2}`);
    if (CONFIG.mode === 'solo' && gagnant === 'j1') {
      enregistrerRecord(CONFIG.niveau, finalJ1);
    }
    log.info('session.fin', {
      gagnant,
      scoreJ1: finalJ1,
      scoreJ2: finalJ2,
      record: CONFIG.mode === 'solo' ? CONFIG.niveau : null,
    });
  }

  // ============================================================== saisie du joueur

  private onValiderSaisie(joueur: 'j1' | 'j2', difficulte: Difficulte): boolean {
    const { quiz, numpad, combattant } = this.zoneDe(joueur);
    const valeur = numpad.valeur;
    if (valeur === null) return false; // saisie vide = ignorée (§2.7)
    const nature = this.naturePourJoueur(joueur);
    if (!nature) return false; // ce joueur n'est pas en jeu pendant cette phase

    const phase = this.phasePour(nature);
    const zone = joueur.toUpperCase(); // 'J1' | 'J2'

    log.info('ui.saisie', { zone, difficulte, valeur });
    log.info('ui.validation', { zone, difficulte, valeur });
    const resultat = phase.resoudre(difficulte, valeur);

    if (resultat.correct) {
      const q = phase.question(difficulte);
      quiz.mettreAJour({ difficulte, enonce: q.enonce, gain: q.gain });
      numpad.reset();
      this.scores[joueur].energieGagnee += q.gain; // score de combat (§2.7)
      combattant.impulsion(q.gain); // impulsion d'aura (§2.8a)
      this.noterJournal(`${FightScene.nomJoueur(joueur)} : juste (+${q.gain})`);
      this.jouerSon('reussite');
    } else {
      quiz.erreur(difficulte);
      numpad.reset(); // la saisie est vidée après validation, juste ou non
      this.noterJournal(`${FightScene.nomJoueur(joueur)} : erreur`);
      this.jouerSon('erreur');
      // micro-animation de gêne : l'aura reste à son niveau (§2.8a)
      // (échelle du conteneur = 0.62 : écrasement léger, le yoyo restaure)
      this.tweens.add({
        targets: combattant.corps,
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
    const phaseJ2 = tour.attaquant === 'j1' ? tour.phaseDefense : tour.phaseAttaque;
    this.texteEnergie1.setText(`énergie J1 : +${phaseJ1.energie()}`);
    // en solo, l'IA révèle son score progressivement (§2.6) ; en duel, J2 joue réellement
    const afficheJ2 = this.iaEnCours ? this.progressionIA : phaseJ2.energie();
    this.texteEnergie2.setText(`énergie ${FightScene.nomJoueur('j2')} : +${afficheJ2}`);
    // auras en temps réel (§2.8a) — intensité = palier de l'énergie courante
    this.j1.charger(phaseJ1.energie());
    this.j2.charger(afficheJ2);
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
        mode: CONFIG.mode,
        phase: scene.naturePhase,
        chrono: scene.chronoRestant,
        energieAttaque: scene.tourCourant?.phaseAttaque.energie() ?? 0,
        energieDefense: scene.tourCourant?.phaseDefense.energie() ?? 0,
        tierAttaque: tierFrappe(scene.tourCourant?.phaseAttaque.energie() ?? 0),
        palierAura: palierAura(scene.tourCourant?.phaseAttaque.energie() ?? 0),
      }),
      // questions du joueur demandé (défaut J1) — phase où il est en jeu
      questionsHumain: (joueur: 'j1' | 'j2' = 'j1') => {
        const nature = scene.naturePourJoueur(joueur);
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
        // écrit aussi dans CONFIG : un réglage debug survit aux relances (§2.9)
        CONFIG.tempsPhase = lireTempsPhase(secondes);
        scene.tempsPhase = CONFIG.tempsPhase;
      },
      forceFinDePhase: () => scene.finDePhase(),
      // menu de pause (§8) : état + bascule (le clic réel reste testé en E2E)
      pause: () => ({ ouverte: scene.enPause }),
      basculerPause: () => scene.basculerPause(),
      // fin de combat (§7) : bannière K.O. + boutons [ REJOUER ] / [ MENU ]
      fin: () => ({
        affichee: scene.engine.etat.fini,
        boutons: scene.boutonRejouer.visible && scene.boutonMenuFin.visible,
      }),
      // sélection de combat (§3) : skins et niveaux appliqués à ce combat
      selection: () => ({ ...selection }),
      // validation des animations (E13) : déclenche un mouvement et renvoie la
      // pose affichée juste après (même frame)
      anim: (action: string) => {
        const j = scene.j1;
        if (action === 'marche') j.vaADroite();
        else if (action === 'saut') j.saut();
        else if (action === 'poing') j.coupDePoing('direct');
        else if (action === 'pied') j.coupDePied('haut');
        else if (action === 'garde') j.gardeHaute();
        else if (action === 'touche') j.encaisse(2);
        else if (action === 'ko') j.ko();
        else return { pose: j.pose, ok: false };
        return { pose: j.pose, ok: true };
      },
      // score de combat (§2.7) : mesures cumulées + scores affichés
      scores: () => ({
        j1: { ...scene.scores.j1 },
        j2: { ...scene.scores.j2 },
        affiche: { j1: scene.texteScoreJ1.text, j2: scene.texteScoreJ2.text },
      }),
      scoreFinal: (joueur: 'j1' | 'j2' = 'j1', gagne = true) =>
        calculerScore(scene.scores[joueur], gagne),
      // saisie de la console demandée (défaut J1)
      saisie: (joueur: 'j1' | 'j2' = 'j1') => scene.zoneDe(joueur).numpad.etatSaisie(),
      // mode de jeu (§2.6) : lecture + bascule relançant le combat (E08)
      mode: () => CONFIG.mode,
      setMode: (mode: ModeJeu) => {
        CONFIG.mode = mode === 'duel' ? 'duel' : 'solo';
        scene.lancerCombat();
      },
      setRythme: (rythme: Rythme) => {
        CONFIG.rythme = rythme === 'simultane' ? 'simultane' : 'differe';
        scene.lancerCombat();
      },
      // libellés affichés (PV, énergie, score) — vérifie les libellés J1/J2/IA
      libelles: () => ({
        pv1: scene.textePv1.text,
        pv2: scene.textePv2.text,
        energie1: scene.texteEnergie1.text,
        energie2: scene.texteEnergie2.text,
        score: scene.texteScore.text,
        scoreJ1: scene.texteScoreJ1.text,
        scoreJ2: scene.texteScoreJ2.text,
      }),
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
      // journal de combat (5 derniers événements, récent en tête)
      journal: () => [...scene.journalEvenements],
      // score de manche persistant entre rejeux
      score: () => ({ ...scene.manches }),
      // force l'énergie d'attaque du tour en cours (captures E04/E05)
      forcerEnergieAttaque: (v: number) => {
        const phase = scene.tourCourant?.phaseAttaque;
        if (!phase) return false;
        Object.defineProperty(phase, 'energie', {
          value: () => v,
          configurable: true,
          writable: true,
        });
        scene.mettreAJourEnergies();
        return true;
      },
      // diagnostics des mouvements (sprites MK) : poses courantes, temps
      coups: () => ({
        timeScale: scene.tweens.timeScale,
        poses: { j1: scene.j1.pose, j2: scene.j2.pose },
      }),
      // force l'énergie de défense du tour en cours (captures E04)
      forcerEnergieDefense: (v: number) => {
        const phase = scene.tourCourant?.phaseDefense;
        if (!phase) return false;
        Object.defineProperty(phase, 'energie', {
          value: () => v,
          configurable: true,
          writable: true,
        });
        scene.mettreAJourEnergies();
        return true;
      },
    };
  }
}
