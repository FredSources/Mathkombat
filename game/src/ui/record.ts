/**
 * ui/record.ts — record de score persistant (HIGH SCORE de l'écran RUN).
 *
 * Stockage `localStorage` — hors-ligne, déplaçable, **un record par niveau de
 * calcul en mode solo** (clés `mathkombat.record.solo.<niveau>`). Le mode duel
 * n'a pas de record : il oppose deux joueurs, le « propre score » (§2.5) est le
 * score solo. I/O légère assumée ici — le calcul du score est pur (`core/score.ts`).
 *
 * Repli silencieux : environnement sans `localStorage` (ou refusé) → record 0,
 * aucun plantage, le jeu reste jouable.
 */
import type { Niveau } from '../core/config.ts';

const PREFIXE = 'mathkombat.record.solo';

function cle(niveau: Niveau): string {
  return `${PREFIXE}.${niveau}`;
}

function stockage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // stockage refusé (navigation privée, cookies bloqués)
  }
}

/** Record du niveau donné (0 si aucun record). */
export function lireRecord(niveau: Niveau): number {
  const brut = stockage()?.getItem(cle(niveau));
  const valeur = Number(brut);
  return Number.isFinite(valeur) && valeur > 0 ? Math.round(valeur) : 0;
}

/**
 * Enregistre un score s'il bat le record du niveau (mode solo uniquement).
 * Retourne le record après écriture (inchangé si le score était inférieur).
 */
export function enregistrerRecord(niveau: Niveau, score: number): number {
  const entier = Math.max(0, Math.round(score));
  const record = lireRecord(niveau);
  if (entier <= record) return record;
  try {
    stockage()?.setItem(cle(niveau), String(entier));
  } catch {
    return record; // stockage plein ou refusé : le record reste à sa valeur
  }
  return entier;
}

/** Meilleur record tous niveaux confondus — affiché sur l'écran RUN. */
export function meilleurRecord(niveaux: readonly Niveau[] = ['debutant', 'intermediaire', 'avance']): number {
  return niveaux.reduce((max, n) => Math.max(max, lireRecord(n)), 0);
}
