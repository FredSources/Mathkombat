/**
 * core/score.ts — score de combat (demande utilisateur, §2.7).
 *
 * Règle choisie « score de combat » : chaque joueur cumule
 *  - les **points d'énergie gagnés** par ses calculs résolus (+1 / +3 / +7) ;
 *  - les **secondes restantes** en fin de chaque phase jouée (rapidité) ;
 * et le gagnant reçoit le **bonus K.O.** (fixe).
 *
 * Module **pur** (sans I/O, sans Phaser) : la persistance du record vit dans
 * `ui/record.ts` (localStorage), jamais ici.
 */
import type { ConfigJeu } from './config.ts';
import { CONFIG } from './config.ts';

/** Mesures cumulées d'un joueur pendant le combat. */
export interface MesuresScore {
  /** Somme des gains des calculs résolus (énergie gagnée). */
  energieGagnee: number;
  /** Somme des secondes restantes en fin de chaque phase jouée. */
  secondesRestantes: number;
}

/**
 * Score affiché en temps réel (bonus K.O. exclu : il n'est connu qu'à la fin).
 * Toujours entier, jamais négatif — les mesures sont arrondies au calcul.
 */
export function scoreEnCours(mesures: MesuresScore, config: ConfigJeu = CONFIG): number {
  return calculerScore(mesures, false, config);
}

/**
 * Score final d'un joueur : énergies gagnées + temps restant, plus le bonus K.O.
 * si ce joueur a gagné. Entier, borné à 0 (jamais de score négatif).
 */
export function calculerScore(
  mesures: MesuresScore,
  gagne: boolean,
  config: ConfigJeu = CONFIG
): number {
  const energie = Math.max(0, Math.round(mesures.energieGagnee)) * config.score.facteurEnergie;
  const temps = Math.max(0, Math.round(mesures.secondesRestantes)) * config.score.facteurTempsRestant;
  const bonus = gagne ? config.score.bonusKo : 0;
  return Math.max(0, Math.round(energie + temps + bonus));
}
