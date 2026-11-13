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

type NaturePhase = 'attaque' | 'defense' | 'simultane';

interface Combattant {
  nom: string;
  corps: Phaser.GameObjects.Container;
  aura: Phaser.GameObjects.Graphics;
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
    this.j1 = this.creerCombattant('J1', 360, 0x2b6bd4);
    this.j2 = this.creerCombattant('J2', 920, 0xd4762b);
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

  private creerCombattant(nom: string, x: number, teinte: number): Combattant {
    const conteneur = this.add.container(x, SOL);
    conteneur.setScale(0.62);
    const aura = this.add.graphics();
    const corps = this.add.graphics();
    corps.fillStyle(teinte, 1);
    corps.fillRoundedRect(-40, -170, 80, 130, 12);
    corps.fillStyle(0xf2c99a, 1);
    corps.fillCircle(0, -205, 38);
    corps.fillStyle(teinte, 1);
    corps.fillRect(-34, -40, 26, 40);
    corps.fillRect(8, -40, 26, 40);
    corps.fillStyle(0x1b2a52, 1);
    corps.fillRoundedRect(-58, -160, 24, 90, 8);
    corps.fillRoundedRect(34, -160, 24, 90, 8);
    const etiquette = this.add
      .text(0, 8, nom, { fontFamily: 'monospace', fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);
    conteneur.add([aura, corps, etiquette]);
    return { nom, corps: conteneur, aura };
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
    // Énergie : à côté du clavier (zone vide, jamais recouverte par les boutons)
    this.texteEnergie1 = this.add.text(252, 255, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#7bd4ff',
    });
    this.texteEnergie2 = this.add.text(LARGEUR - 252, 255, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#7bd4ff',
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
      texte.setText(`${joueur.toUpperCase()} — ${valeur} PV`);
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

    // frappe visuelle (tier déterministe, §2.8 — juice complet en J5)
    const attaquant = r.attaquant === 'j1' ? this.j1 : this.j2;
    const cible = r.sur === 'defenseur' ? (r.defenseur === 'j1' ? this.j1 : this.j2) : attaquant;
    const tier = tierFrappe(r.attaque);
    if (tier > 0) {
      this.tweens.add({
        targets: cible.corps,
        x: cible.corps.x + (cible === this.j1 ? -1 : 1) * (12 + tier * 8),
        duration: 90,
        yoyo: true,
      });
    }
  }

  private finDeCombat(): void {
    const gagnant = this.engine.etat.gagnant === 'j1' ? 'JOUEUR 1' : 'IA / JOUEUR 2';
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
    } else {
      this.quizJ1.erreur(difficulte);
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
    };
  }
}
