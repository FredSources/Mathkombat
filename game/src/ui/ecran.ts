/**
 * ui/ecran.ts — déclaration de l'écran courant (DEBUG uniquement).
 *
 * Petit hook de navigation partagé par **Menu / Config / Fight** : les tests E2E
 * attendent `window.__mathkombatEcrans.ecran` avant de cliquer à des coordonnées
 * connues. **Aucune navigation ne passe par là** — les clics restent réels.
 *
 * Un écran déclaré à la création, l'écran suivant le remplace : la valeur n'est
 * jamais « en retard » sur ce qui s'affiche à l'écran.
 */
declare const __BUILD_MODE__: string | undefined;

export type NomEcran = 'menu' | 'config' | 'fight';

/**
 * Déclare l'écran affiché (no-op en RELEASE, comme le hook `__mathkombat`).
 * `details` complète la déclaration (record affiché, etc.) pour les tests E2E.
 */
export function declarerEcran(ecran: NomEcran, details: Record<string, unknown> = {}): void {
  if (typeof __BUILD_MODE__ === 'undefined' || __BUILD_MODE__ !== 'debug') return;
  (window as unknown as Record<string, unknown>).__mathkombatEcrans = { ecran, ...details };
}
