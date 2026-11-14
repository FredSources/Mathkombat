/**
 * ui/selection.ts — sélection de combat (wireframes §3) : personnages et
 * niveaux choisis avant le combat.
 *
 * État de session partagé entre `SelectScene` (écriture) et `FightScene`
 * (lecture à chaque `lancerCombat`). Ce n'est **pas** de l'équilibrage : les
 * valeurs par défaut vivent ici, les réglages de jeu dans `core/config.ts`.
 */
import type { Niveau } from '../core/config.ts';

/** Id de skin (`rig/personnage.ts` `SKINS`). */
export type IdSkin = string;

export interface SelectionCombat {
  skinJ1: IdSkin;
  skinJ2: IdSkin;
  niveauJ1: Niveau;
  niveauJ2: Niveau;
}

/** Sélection courante (valeurs par défaut = wireframe §3). */
export const selection: SelectionCombat = {
  skinJ1: 'persoA',
  skinJ2: 'persoB',
  niveauJ1: 'intermediaire',
  niveauJ2: 'intermediaire',
};
