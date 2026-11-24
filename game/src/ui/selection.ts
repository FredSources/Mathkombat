/**
 * ui/selection.ts — sélection de combat (wireframes §3) : personnages,
 * niveaux et couples d'opérations choisis avant le combat.
 *
 * État de session partagé entre `SelectScene` (écriture) et `FightScene`
 * (lecture à chaque `lancerCombat`). Ce n'est **pas** de l'équilibrage : les
 * valeurs par défaut vivent ici, les réglages de jeu dans `core/config.ts`.
 */
import type { Niveau, TypeOperation } from '../core/config.ts';

/** Id de skin (`rig/personnage.ts` `SKINS`). */
export type IdSkin = string;

export interface SelectionCombat {
  /** Bloc JOUEUR 1 — personnage, niveau, couple d'opérations. */
  skinJ1: IdSkin;
  niveauJ1: Niveau;
  operationJ1: TypeOperation;
  /** Bloc adversaire — J2 en duel, IA en solo. */
  skinJ2: IdSkin;
  niveauJ2: Niveau;
  operationJ2: TypeOperation;
}

/**
 * Sélection courante (valeurs par défaut = wireframe §3).
 * `operationJx` est l'opération d'ATTAQUE du joueur ; sa défense utilise
 * toujours `operationInverse(operationJx)` (§2.5).
 */
export const selection: SelectionCombat = {
  skinJ1: 'karateka',
  niveauJ1: 'intermediaire',
  operationJ1: 'multiplication',
  skinJ2: 'combattante',
  niveauJ2: 'intermediaire',
  operationJ2: 'multiplication',
};
