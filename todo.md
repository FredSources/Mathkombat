# TODO — MathKombat

Légende : `[ ]` à faire · `[~]` en cours · `[x]` produit **et** testé · `[-]` écarté.
Une case ne se coche que si : code produit + tests verts + entrée dans `journal.md`.

## État actuel

**Jalon J4 — quiz jouable : TERMINÉ** (49 tests ✅, couverture 100 % ✅, scénarios
S01→S11 verts ✅, E2E 6/6 ✅, smoke L0 ✅).
Prochaine étape : **J5 — présentation** (assets cut-out, aura Dragon Ball, frappe
graduée, défense/contre animées, HUD, sons).

## Planification (ordre et dépendances)

```
J0 Socle ──► J1 Scaffold web ──► J2 math-generator ──► J3 combat-engine + IA
                                                    └─► J4 Quiz jouable (Solo vs IA)
                                                            │
                                              J5 Animations/HUD/juice
                                                            │
                                              J6 2 joueurs + menus + niveaux
                                                            │
                                              J7 APK (Termux + PC)
                                                            │
                                              J8 Équilibrage, best-of-3, QA
```

Dépendances fortes : J2 et J3 exigent J1 (projet Vite) ; J4 exige J2+J3 ; J7 exige
J6 (contenu complet) ; J8 clôt.

## Tâches

### J0 — Socle (terminé ✅)

- [x] Créer l'arborescence du projet (isolation totale, SDK compris)
- [x] `AGENTS.md` : objectif, consignes, gameplay, stack, conventions, roadmap
- [x] `journal.md` : journal des choses produites
- [x] `todo.md` : tâches + planification
- [x] `docs/test-plan.md` : plan de test pilotable (L0→L5, I1→I15, S01→S11)
- [x] `docs/architecture.md` : évacuation des logs par socket, modes DEBUG/RELEASE
- [x] `scripts/log-collector.js` : collecteur socket (WS + TCP brut → JSONL)
- [x] `scripts/ws-probe.mjs` + `scripts/smoke.sh` : smoke tests L0
- [x] `game/src/core/logger.ts` : logger client DEBUG/RELEASE
- [x] `scripts/env.sh` + `scripts/setup-sdk.sh` : isolation + installation `tools/`
- [x] `tools/` installé (SDK 34 + Gradle + JDK) et vérifié — 949 Mo, javac 21, gradle 8.10.2
- [x] L0 smoke vert (collecteur WS + TCP + fichier JSONL) — PASS, 5/5 événements

### J1 — Scaffold web (terminé ✅)

- [x] `npm init` + Vite + Phaser 3 + TypeScript strict (`game/`) — phaser ^3.80, vite, typescript
- [x] `scripts/build.sh` (build web DEBUG/RELEASE) — typecheck + vite build → `game/dist/`
- [x] Scène de combat squelette (2 combattants, barres de vie animées, HUD : PV/chrono/énergie)
- [x] Logger branché sur les scènes (événements `session.*`, `ui.*`, `combat.*` démo)
- [x] `npm run dev` jouable dans le navigateur — validé par capture (`output/screenshots/j1-fight-skeleton.png`)

### J2 — Moteur mathématique (terminé ✅)

- [x] `core/config.ts` : tout l'équilibrage centralisé (PV, tempo, rythme, gains, familles 🟢🟡🟠, bornes 5/10/12, tiers, IA gentille, cadence de référence)
- [x] `core/math-generator.ts` : multiplications/divisions adaptatives (couleur du fait, repli Débutant, non-répétition, exactitude, abstraction type d'opération pour +/− futurs)
- [x] Tests Vitest (S01→S03, invariants I3, I4, I6, I7, I11) — **22 tests, couverture 100 %** du cœur maths
- [x] `scripts/run-scenarios.mjs` : exécuteur de scénarios headless + rapport `output/reports/scenarios-*.md`

### J3 — Moteur de combat + IA (terminé ✅)

- [x] `core/combat-engine.ts` : phases, énergie, résolution, contre-attaque (I1→I5) — `resoudreCoup`, `PhaseCalcul` (3 calculs, I12), `CombatEngine` (tours alternés, PV bornés, K.O. unique), tiers de frappe/paliers d'aura déterministes (I13), rythmes (I15)
- [x] `core/ai-controller.ts` : 3 difficultés (choix de difficulté + réussite, **IA gentille** : rendement plafonné + rattrapage doux, phases jouées sur la durée configurée) — I16
- [x] Tests Vitest + scénarios S04→S08, S10, S11 — **49 tests, couverture 100 % du cœur** (156/156 statements, 100/100 branches)

### J4 — Quiz jouable (terminé ✅)

- [x] `ui/quiz-overlay.ts` : 3 calculs simultanés (Facile/Moyen/Difficile), ciblage au tap, remplacement du seul calcul résolu, retour « Faux ! » sans changer le calcul
- [x] `ui/numpad.ts` : console de saisie par joueur — **valeur affichée sur le clavier** (case de la largeur du clavier, valeur seule), 0–9, ⌫ un chiffre, C tout effacer, **3 boutons VALIDER colorés sous le clavier** (un par calcul), touches physiques en web debug
- [x] Boucle de combat jouable Solo vs IA de bout en bout (rythmes Différé/Simultané, **chrono immédiat IA** avec score calculé, résolution animée, K.O. + R)
- [x] E2E E01→E03 (Puppeteer) — **6/6 verts** + captures ; scénario S09 (taux de réussite IA)

### J5 — Présentation

- [ ] Assets (méthode `docs/assets.md`) : planches de référence des 2 personnages + pièces cut-out (tête, buste, bras, jambes)
- [ ] Décors d'arène (arena-1, arena-2) + UI rétro (titre, boutons RUN/CONFIG)
- [ ] Sprites/états : `idle`, `charge`, `frappe`, `garde`, `parade`, `contre`, `touche`, `ko` (cut-out animé par tweens)
- [ ] Chargement d'aura « Dragon Ball » sous les calculs (intensité croissante avec l'énergie, §2.8a)
- [ ] Impulsions d'aura à chaque calcul réussi (+1 petite, +7 marquée)
- [ ] Frappe graduée par tier de puissance (1→4 : zoom, secousses, particules, ralenti, §2.8b)
- [ ] Défense simultanée : encaissement / blocage parfait / parade + contre-attaque (§2.8c)
- [ ] Dégâts flottants proportionnels + K.O. animé (§2.8d)
- [ ] HUD complet (barres de vie animées vert→orange→rouge, timer, énergie, journal de combat)
- [ ] Sons + particules + secousses caméra + ralenti
- [ ] Captures dans `output/screenshots/` (E04, E05)

### J6 — Modes et menus

- [ ] Mode 2 joueurs (même écran, tour par tour)
- [ ] Écran de lancement rétro (bouton **RUN** clignotant au-dessus, **CONFIG** au-dessous, style borne d'arcade)
- [ ] Écran CONFIG des règles (commandes ◀ ▶ rétro) : mode, tempo (durée unique attaque = défense : Rapide 10 s, Normal 15 s, Long 25 s + curseur borné 5–60 s), rythme de calcul (Différé/Simultané), PV, niveau, difficulté IA
- [ ] Sélection de personnage + menu principal + choix de niveau
- [ ] Best-of-3 manches (option, voir J8)

### J7 — APK

- [ ] Wrapper WebView Kotlin (`android/`) plein écran, assets embarqués
- [ ] `scripts/build-apk.sh` (SDK local uniquement) → `output/MathKombat.apk`
- [ ] Build PC (Android Studio) documenté et vérifié
- [ ] Grille manuelle L5 (M01→M07)

### J8 — Clôture

- [ ] Équilibrage (durées, énergies, IA) à partir des logs d'analyse — vérifier **suspense et possibilité de gagner** (S12 : taux de victoires humaines ≈ 80/50/30 %)
- [ ] Catalogue de scénarios complet vert + E2E verts
- [ ] Mode RELEASE certifié zéro log (T04, I10)
- [ ] Journal final + README à jour

## Idées / dette

- **Mode Entraînement sans chrono** (principe pédagogique « aucun chronomètre au
  début ») : calculs à volonté, erreur = indice, pas de combat.
- **Record personnel** : chrono contre son propre score (jamais contre l'autre
  joueur) — statistiques de cadence par famille de table.
- **Bouton « Indice »** : afficher l'astuce de déduction de la table concernée
  (boîte à outils `AGENTS.md` §2.5) — pédagogique, à pénaliser doucement ou non.
- **Addition / soustraction** : type de calcul supplémentaire pour adapter le niveau
  (abstraction `type d'opération` prévue dès J2 dans le générateur — v1 = × et ÷ seuls).
- Best-of-3 manches + écran de victoire de manche (J8).
- Sauvegarde des scores / progression (hors périmètre v1).
- Deux personnages jouables minimum pour la sélection (J6).
- Accessibilité : taille de police, contraste, mode daltonien (à évaluer J8).
- Publication Play Store : **hors périmètre** (APK signé debug uniquement).
