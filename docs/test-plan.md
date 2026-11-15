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
| I6 | Les niveaux bornent **les deux facteurs** (multiplications : table **et** second facteur ; divisions : diviseur **et** quotient) : Débutant ≤ 5, Intermédiaire ≤ 10, Avancé ≤ 12 — **les tables 11 et 12 sont réservées au niveau Avancé** |
| I7 | Toute division générée est exacte ; tout quotient est unique dans sa question |
| I8 | La réponse est saisie sur le **clavier numérique** (0–9, **⌫ Effacer** un chiffre, **C Tout effacer**) ; **la valeur saisie est affichée sur le clavier** (ligne d'entrée unique, valeur seule — elle ne correspond à un calcul qu'à la **validation avec le bouton de la bonne couleur**) ; validation par les **3 boutons VALIDER colorés** (un par calcul) ou la touche Entrée (calcul ciblé) ; une saisie n'est évaluée qu'à la validation ; saisie bornée à 3 chiffres (réponses 0–144), abandonnée en fin de phase ; réponse attendue unique |
| I9 | La durée de phase est **unique et configurable** (identique attaque/défense, défaut 15 s, bornes 5–60 s, validée à la lecture) ; le **rythme de calcul** (Différé / Simultané) est configurable ; il n'existe **aucun timer par calcul** |
| I10 | En RELEASE, aucun octet de log n'est émis ni aucune connexion socket tentée |
| I11 | La difficulté suit la **couleur du fait** (`AGENTS.md` §2.5) : 🟢 au moins un facteur ∈ {1, 2, 5, 10} ; 🟡 sinon facteur ∈ {3, 4, 6, 8, 9, 11, 12} ; 🟠 les **faits difficiles** (`familles.difficile` = les 5 résistants + les durs élargis) et, en **Débutant**, le repli `3×3`/`3×4`/`4×4` ; nombre de calculs résolus par phase **non plafonné** (rendement maximal) |
| I12 | Les 3 difficultés sont proposées **simultanément** ; la résolution d'un calcul ne remplace **que lui** (nouveau calcul de même difficulté), les deux autres sont conservés |
| I13 | L'intensité d'animation (aura, tier de frappe, contre) est une **fonction déterministe** de la puissance, définie dans `config.ts` (bornes de tiers vérifiables) |
| I14 | V1 : seules les opérations **× (attaque)** et **÷ (défense)** sont actives ; le générateur est abstrait par type d'opération (architecture prête pour + et −) |
| I15 | Rythme **SIMULTANÉ** : les deux phases partagent le **même chrono** et se terminent ensemble ; rythme **DIFFÉRÉ** : les phases s'enchaînent avec la **même durée** chacune. Le rythme appliqué est **celui de la configuration choisie** (aucune détection ni adaptation selon l'écran). Exception Solo : une phase jouée par l'IA peut être remplacée par un **chrono immédiat** (score pré-calculé, §2.6) — présentation, la structure des phases reste celle du rythme configuré |
| I16 | L'IA reste **« gentille » et battable** : **le niveau d'IA = son score moyen** (attaque/défense, `ia.scoreMoyen` — pas les calculs tentés) ; score plafonné par le **temps des calculs** (1 calcul = `tempsParCalcul` s — moins de temps = score plus faible) et sous le score d'un joueur rapide ; rattrapage doux si elle domine (`ecartSuspense`) ; score **pré-calculé** et affiché sur un chrono immédiat (`dureeChronoIA`) ; taux de victoires humaines visés : Facile ≈ 80 %, Moyen ≈ 50 %, Difficile ≈ 30 % |

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
| S12 | Winnability : 200 combats simulés « joueur de référence » (temps des calculs 2 s, réussite 85 %) vs chaque difficulté d'IA | I16 — taux de victoires humaines dans la fourchette cible (±15 points) : S12 calibré le 2026-11-15 → **78.7 / 49.3 / 32.3 %** |

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
| E01 | Lancement → écran RUN → combat | ouverture de l'app, clic **RUN** (640, 310) | écran RUN affiché (`__mathkombatEcrans.ecran = 'menu'`), scène `Fight` atteinte, PV 100/100 + capture `e2e-01-combat.png` |
| E02 | Répondre à 3 calculs d'attaque | saisies au clavier numérique (dont une erreur corrigée par **Effacer** avant **Valider**) | énergie affichée = somme attendue, calcul erroné non remplacé (I4, I8), **saisie vidée après validation** (juste ou faux) |
| E03 | Défense + contre-attaque | laisser l'IA attaquer, répondre aux divisions | PV mis à jour selon I1/I2 |
| E04 | Mise en scène graduée (tier 3) | forcer l'énergie d'attaque à 16 et la défense à 6 via les hooks debug, résoudre le tour | tier = 3 déterministe, 10 dégâts sur l'IA, journal mis à jour + capture `e2e-04-frappe.png` (I13) |
| E05 | K.O. et score de manche | forcer l'énergie d'attaque = défense + PV max, résoudre le tour | `fini` = true, gagnant J1, score de manche 1–0, bannière K.O. conservée + capture `e2e-05-ko.png` (I5) |
| E06 | Tempo configurable (écran CONFIG) | CONFIG → **◀ TEMPO** (NORMAL → RAPIDE 10 s) → **VALIDER** → RUN | attaque de J1 sur 10 s **et défense de J1 (tour 2) sur 10 s** (durée unique §2.9) + capture `e2e-06-tempo-rapide.png` — *en solo, la défense du tour 1 est jouée par l'IA (chrono immédiat 3 s, §2.6) : hors sujet* |
| E07 | Rythme + mode (écran CONFIG) | CONFIG → **▶ MODE** (2 JOUEURS) + **▶ RYTHME** (SIMULTANÉ) → **VALIDER** → RUN, frappes `Digit5` + `Numpad7` | phase `simultane` dès le tour 1, les **deux zones actives** sur le même chrono (I15), saisies `J1="5"`, `J2="7"` sans croisement, tour 2 enchaîné (jamais de phase `defense` séquentielle) + capture `e2e-07-simultane.png` |
| E09 | Score de combat (§2.7) | RUN → 1 calcul résolu au clavier → K.O. forcé (énergie 100 vs défense 0) → rechargement | mesures par joueur (**énergie gagnée** + **secondes restantes**), score en temps réel par joueur dans le HUD, score final = sans bonus + **bonus K.O.**, record `localStorage` persistant, **HIGH SCORE réaffiché sur l'écran RUN** + captures `e2e-09-score.png`, `e2e-09-highscore.png` |
| E10 | Menu de pause (§8) | RUN → **☰ MENU** → lecture du chrono → **[ RETOUR AU JEU ]** → **☰ MENU** → **[ QUITTER → MENU ]** | pause réelle (**chrono figé**, zones désactivées), reprise exacte (chrono relancé), retour à l'écran RUN + capture `e2e-10-pause.png` |
| E11 | Fin de combat (§7) | RUN → K.O. forcé → **[ REJOUER ]** → K.O. forcé → **[ MENU ]** | au K.O., bannière sans « R = rejouer » et **boutons [ REJOUER ] / [ MENU ]** au centre de l'arène ; REJOUER relance un combat (tour 1), MENU retourne au RUN + capture `e2e-11-fin.png` |
| E12 | Sélection de combat (§3) | RUN → **◀ niveau J1** (DÉBUTANT) + **◀ skin J2** (PERSO A) → **[ LANCER LE COMBAT ]** | le combat est construit **sur la sélection** (`selection()` = debutant/persoA) + capture `e2e-12-selection.png` — *les cas E01/E06/E07/E09/E10/E11 traversent aussi la sélection (RUN ne lance plus directement)* |
| E13 | Mouvements des combattants (§2.8) | hook `anim()` : marche, saut, poing, pied, garde, touché, K.O. | chaque action joue bien **sa pose** de sprite (`marche-avant`, `saut`, `poing`, `pied`, `garde-defense`, `touche`) |
| E14 | Déplacement sur un coup BLOQUÉ (§2.8b) | attaque = défense (blocage forcé) → suivi des positions pendant la résolution | l'attaquant **s'approche** (déplacement mesuré > 40 px, jusqu'au contact qui touche l'adversaire) puis **revient à sa position d'origine** (± 6 px) |
| E15 | Saut composé (§2.8c) | hook `saut({deplacement, action})` : (place\|avant\|arrière) et/ou (coup\|contre) | les déplacements et actions sont bien **exclusifs par famille** : avant > place, retour arrière, pose `pied` au coup et au contre |
| E16 | Profondeur + manœuvres (§2.8b) | déplacements haut/bas (zoom) + 6 s de chrono (manœuvres) | **zoom subtil** : haut < base < bas ; les **manœuvres** s'exécutent pendant le chrono (compteur qui augmente), sans contact |

> **Répartition des calculs** (mise à jour 2026-11-15) : Facile 54–80 % des faits,
> Moyen 22–27 %, **Difficile 16–20 %** (famille élargie : 5 résistants + les durs
> `6×9 · 7×9 · 8×9 · 9×9 · 7×11 · 8×11 · 9×11 · 11×11 · 11×12 · 12×12`) ;
> en Débutant, le repli `3×3 · 3×4 · 4×4` porte les +7 (20 % des faits) —
> et il n'y a plus de Moyen en Débutant (les jaunes possibles sont le repli).
| E08 | **Mode DUEL (2 joueurs)** — `a`→`h` | bascule de mode ; J1 résout facile+moyen ; frappe du pavé pendant la phase de J1 ; phase de défense ciblée par J2 ; pavé J2 (⌫ décimale, C `Delete`, chiffres + `NumpadEnter`) ; résolution ; bascule SIMULTANÉ puis frappes `Digit5` / `Numpad7` ; **surbrillance des touches** (`Digit6` puis `Numpad4`) | libellés **J2** (PV, énergie, score), énergies 4 puis 3, solde = 1 dégât sur J2, **isolation stricte des deux consoles dans les deux sens**, saisies vidées après validation, **touche pressée allumée sur sa console seule puis retour au repos** + capture `e2e-08-duel.png` |

> **Ordre d'exécution** : `scripts/e2e.mjs` joue E01→E05, puis E08a→E08h (continuité
> du score E05), puis **E06, E07, E09, E10, E11 et E12 en fin de batterie** — ces
> cas rechargent l'application (retour aux réglages par défaut §2.9), ce qui
> casserait la chaîne E05→E08.

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
