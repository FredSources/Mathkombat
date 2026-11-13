# Plan de test pilotable — MathKombat

Plan de test conçu pour être **piloté par un agent** : chaque test est une **commande**,
produit un **artefact** (rapport, log, capture) et se conclut par un **oracle explicite**
(PASS/FAIL). Aucun test « à l'œil » : tout est reproductible et traçable dans
`journal.md`.

## 1. Stratégie en 6 niveaux

| Niveau | Objet | Outil | Quand | Artefact |
|--------|-------|-------|-------|----------|
| **L0 — Smoke** | Socle vivant (collecteur, socket, scripts) | `bash scripts/smoke.sh` | À chaque session | console + `output/logs/smoke-*.jsonl` |
| **L1 — Unitaire** | Cœur pur : `math-generator`, `combat-engine`, `ai-controller` | Vitest (`npm test`) | À chaque modif. de `core/` | rapport Vitest |
| **L2 — Scénarios** | Combats simulés de bout en bout (headless, sans Phaser) | `node scripts/run-scenarios.mjs` | À chaque modif. de `core/` + jalon | `output/reports/scenarios-*.md` |
| **L3 — Intégration log** | Le jeu émet bien ses logs, le collecteur les reçoit | sonde + grep sur JSONL | Modes DEBUG/RELEASE + jalon | `output/logs/` + greps oracles |
| **L4 — E2E UI** | Parcours jouable dans le navigateur | Puppeteer (chromium headless) | J4+ | `output/screenshots/` + `output/reports/e2e-*.md` |
| **L5 — Manuel APK** | APK installé sur appareil | grille manuelle §7 | J7+ | grille remplie dans `journal.md` |

## 2. Invariants métier (oracles permanents)

Vérifiés par L1/L2 à chaque exécution ; toute violation = **FAIL bloquant**.

| ID | Invariant |
|----|-----------|
| I1 | `solde = attaque − défense` ; si `solde < 0` alors dégâts subis par l'attaquant = `|solde|` (contre-attaque) |
| I2 | Si `solde > 0` : dégâts du défenseur = `solde` ; si `solde = 0` : aucun dégât (bloqué) |
| I3 | L'énergie d'un coup = somme des gains (+1/+3/+7) des calculs réussis de la phase |
| I4 | Un calcul ne rapporte de l'énergie qu'à sa résolution ; une erreur ne rapporte rien **ni ne change le calcul** (il reste affiché et retentable) ; seule la cadence sur la durée de phase compte |
| I5 | PV ≥ 0 à tout instant ; PV ≤ 0 ⇒ K.O. exactement une fois |
| I6 | Les niveaux bornent le **second facteur** (multiplications) et le **quotient** (divisions) : Débutant ≤ 5, Intermédiaire ≤ 10, Avancé ≤ 12 ; le premier facteur suit la famille de table (≤ 12) |
| I7 | Toute division générée est exacte ; tout quotient est unique dans sa question |
| I8 | La réponse est saisie sur le **clavier numérique** (0–9, **⌫ Effacer** un chiffre, **C Tout effacer**) ; **la valeur saisie est affichée sur le clavier** (ligne d'entrée unique, valeur seule — elle ne correspond à un calcul qu'à la **validation avec le bouton de la bonne couleur**) ; validation par les **3 boutons VALIDER colorés** (un par calcul) ou la touche Entrée (calcul ciblé) ; une saisie n'est évaluée qu'à la validation ; saisie bornée à 3 chiffres (réponses 0–144), abandonnée en fin de phase ; réponse attendue unique |
| I9 | La durée de phase est **unique et configurable** (identique attaque/défense, défaut 15 s, bornes 5–60 s, validée à la lecture) ; le **rythme de calcul** (Différé / Simultané) est configurable ; il n'existe **aucun timer par calcul** |
| I10 | En RELEASE, aucun octet de log n'est émis ni aucune connexion socket tentée |
| I11 | La difficulté suit la **couleur du fait** (`AGENTS.md` §2.5 : 🟢 au moins un facteur ∈ {1, 2, 5, 10} ; 🟡 sinon facteur ∈ {3, 4, 6, 8, 9, 11, 12} ; 🟠 les 5 faits résistants, **repli Débutant** `3×3`/`3×4`/`4×4`) ; nombre de calculs résolus par phase **non plafonné** (rendement maximal) |
| I12 | Les 3 difficultés sont proposées **simultanément** ; la résolution d'un calcul ne remplace **que lui** (nouveau calcul de même difficulté), les deux autres sont conservés |
| I13 | L'intensité d'animation (aura, tier de frappe, contre) est une **fonction déterministe** de la puissance, définie dans `config.ts` (bornes de tiers vérifiables) |
| I14 | V1 : seules les opérations **× (attaque)** et **÷ (défense)** sont actives ; le générateur est abstrait par type d'opération (architecture prête pour + et −) |
| I15 | Rythme **SIMULTANÉ** : les deux phases partagent le **même chrono** et se terminent ensemble ; rythme **DIFFÉRÉ** : les phases s'enchaînent avec la **même durée** chacune. Le rythme appliqué est **celui de la configuration choisie** (aucune détection ni adaptation selon l'écran). Exception Solo : une phase jouée par l'IA peut être remplacée par un **chrono immédiat** (score pré-calculé, §2.6) — présentation, la structure des phases reste celle du rythme configuré |
| I16 | L'IA reste **« gentille » et battable** : rendement plafonné (`iaRendementMax`, sous la cadence humaine de référence), rattrapage doux si elle domine (`ecartSuspense`), score **pré-calculé** et affiché sur un chrono immédiat (`dureeChronoIA`) ; taux de victoires humaines visés : Facile ≈ 80 %, Moyen ≈ 50 %, Difficile ≈ 30 % |

## 3. Catalogue de scénarios (L2 — headless)

Fichiers : `game/tests/scenarios/S01-*.json` … Chaque scénario décrit un enchaînement
de phases avec réponses choisies, et attend un état final + une trace d'événements.

| ID | Scénario | Oracle principal |
|----|----------|------------------|
| S01 | Multiplications : génération par niveau et par difficulté (bornes, unicité) | I6, I11 |
| S02 | Divisions : exactitude et bornes | I7 |
| S03 | Énergie : gains +1/+3/+7 cumulés, non résolu = 0 | I3, I4 |
| S04 | Coup simple : attaque 7 vs défense 10 → contre-attaque 3 | I1 |
| S05 | Coup simple : attaque 10 vs défense 4 → dégâts 6 | I2 |
| S06 | Coup bloqué : attaque 8 vs défense 8 → 0 dégât | I2 |
| S07 | Suite de 3 tours alternés, PV cohérents à chaque résolution | I5 |
| S08 | K.O. : derniers PV, un seul événement `combat.ko` | I5 |
| S09 | IA : taux de réussite conforme à sa difficulté (±10 % sur 200 tirages) | config |
| S10 | Bout en bout : combat complet simulé, trace conforme à la nomenclature §4 archi. | trace |
| S11 | 3 calculs simultanés : réussite ne remplace que le calcul résolu ; erreur laisse le calcul en place | I12, I4 |
| S12 | Winnability : 200 combats simulés « joueur de référence » (cadenceHumaineReference, réussite 85 %) vs chaque difficulté d'IA | I16 — taux de victoires humaines dans la fourchette cible (±15 points) |

## 4. Tests d'intégration log (L3)

| ID | Test | Procédure | Oracle |
|----|------|-----------|--------|
| T01 | Collecteur WS | `smoke.sh` : sonde WS envoie 3 enregistrements | fichier JSONL contient 3 lignes valides |
| T02 | Collecteur TCP brut | sonde TCP envoie 2 enregistrements | 2 lignes supplémentaires |
| T03 | Jeu → socket (DEBUG) | lancer le jeu en DEBUG, produire un tour de combat | `grep 'coup_resolu' output/logs/<session>.jsonl` non vide |
| T04 | Zéro log (RELEASE) | lancer le build RELEASE avec collecteur à l'écoute | 0 enregistrement, 0 connexion (`--level` du collecteur) |
| T05 | File tampon | couper le collecteur, jouer, rallumer | enregistrements rejoués, `seq` monotone |

## 5. Tests E2E navigateur (L4, à partir de J4)

Parcours Puppeteer (chromium headless, config `pptr.json` de l'environnement) :

| ID | Parcours | Étapes | Oracle |
|----|----------|--------|--------|
| E01 | Lancement RUN → sélection → combat Solo vs IA | clics + écran de quiz | capture + scène `Fight` atteinte |
| E02 | Répondre à 3 calculs d'attaque | saisies au clavier numérique (dont une erreur corrigée par **Effacer** avant **Valider**) | énergie affichée = somme attendue, calcul erroné non remplacé (I4, I8) |
| E03 | Défense + contre-attaque | laisser l'IA attaquer, répondre aux divisions | PV mis à jour selon I1/I2 |
| E04 | K.O. et écran de fin | forcer des dégâts (scénario seedé) | écran GameOver + événement `combat.ko` |
| E05 | Mise en scène graduée | accumuler une énergie connue puis résoudre le coup | événements `anim.frappe_tier` / `anim.contre` conformes à la puissance (I13) + captures dans `output/screenshots/` |
| E06 | Tempo configurable | choisir un preset (Rapide 10 s) dans l'écran CONFIG puis lancer une phase | la phase respecte la durée configurée, attaque et défense identiques (logs `combat.phase` + HUD timer) |
| E07 | Rythme de calcul | sélectionner SIMULTANÉ dans CONFIG puis jouer un tour | les deux zones actives sur le **même chrono**, résolution commune (I15) |

## 6. Procédure de pilotage agent

Ordre canonique avant de déclarer un jalon fini :

```bash
cd Works/MathKombat && source scripts/env.sh
bash scripts/smoke.sh                          # L0 — doit être vert
npm test                                       # L1 — 0 échec
node scripts/run-scenarios.mjs                 # L2 — rapport écrit
grep -c '"level":"error"' output/logs/*.jsonl  # L3 — 0 erreur inattendue
```

Puis : consigner les résultats dans `journal.md` (identifiants des tests exécutés,
PASS/FAIL, liens des artefacts), mettre à jour `todo.md`.

**Règle de verdict** : un test PASS si l'oracle est satisfait **et** que l'artefact
existe. Un scénario FAIL est analysé via les logs JSONL (`docs/architecture.md` §7)
avant toute correction.

## 7. Grille manuelle APK (L5, J7+)

| # | Vérification | Attendu |
|---|--------------|---------|
| M01 | Installation APK sur appareil | installé sans erreur |
| M02 | Lancement hors-ligne (mode avion) | jeu démarre, menu affiché |
| M03 | Combat Solo vs IA complet | jouable, K.O. fonctionnel |
| M04 | Mode 2 joueurs | alternance J1/J2 correcte |
| M05 | Rotation écran verrouillée paysage | pas de reflow cassé |
| M06 | Fluidité | 60 fps ressentis, pas de saccade sur animations |
| M07 | Build RELEASE | aucun log (logcat Android silencieux côté jeu) |

## 8. Politique de non-régression

- Toute modification de `core/` → L1 + L2 complets obligatoires.
- Tout nouveau bug → un scénario reproduisant le bug est ajouté **avant** la correction
  (test d'abord), il reste dans le catalogue définitivement.
- Le catalogue de scénarios ne fait que croître : aucun scénario n'est supprimé.
