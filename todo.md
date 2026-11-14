# TODO — MathKombat

Légende : `[ ]` à faire · `[~]` en cours · `[x]` produit **et** testé · `[-]` écarté.
Une case ne se coche que si : code produit + tests verts + entrée dans `journal.md`.

## État actuel

**Jalon J6 — étape 2 « écrans RUN / CONFIG » : LIVRÉE ✅** — `MenuScene` (RUN
clignotant, CONFIG, cadre de borne, Entrée = RUN) et `ConfigScene` (7 lignes ◀ ▶ :
mode, tempo + durée, rythme, PV, niveau, difficulté IA ; RETOUR / RÉINITIALISER /
VALIDER avec écriture bornée à la validation), primitives partagées `ui/retro.ts`,
hook d'écran `ui/ecran.ts`, **fonds d'illustration** (`game/assets/fonds/`,
voiles de lisibilité dans `config.ts` section `ui`), réglages de config étendus
(presets tempo, bornes 5–60 s / 10–999, `niveau`, fonctions pures `lireTempsPhase` /
`lirePv` / `presetDeTemps` / `appliquerReglages`).
Vérifications : typecheck ✅ · Vitest **76/76** ✅ · couverture **100 %** (183/183,
114/114 branches) ✅ · scénarios **12/12** ✅ · smoke L0 ✅ · E2E **20/20** ✅
(E01→E08, dont **E06** tempo et **E07** mode+rythme via l'écran CONFIG).
**HIGH SCORE retiré de l'écran RUN** (demande utilisateur) : règle de calcul à
trancher — propositions dans § Idées / dette.

**Retour utilisateur « surbrillance des touches » : LIVRÉ ✅** — la touche pressée
(clic **ou** frappe physique) s'éclaircit avec un contour blanc puis revient au
repos après `CONFIG.ui.surbrillanceMs` (160 ms), **uniquement sur la console
pressée** ; réglages dans `config.ts` section `ui`, registre `boutons` dans
`Numpad`, points d'appel uniques `appuyer()` / `validerPour()`.
Vérifications : typecheck ✅ · Vitest **62/62** ✅ · couverture **100 %** (158/158,
103/103 branches) ✅ · scénarios **12/12** ✅ · smoke L0 ✅ · E2E **18/18** ✅
(nouveau sous-cas **E08h**).

**Jalon J6 — étape 1 « le duel (mode 2 joueurs) » : LIVRÉE ✅** —
`CONFIG.mode: 'solo' | 'duel'`, **une seule classe `Numpad`/`QuizOverlay` instanciée
deux fois** (J1 = ligne de chiffres, J2 = pavé numérique, `event.code` strictement
disjoints), helpers `joueurDe` / `naturePourJoueur` / `estHumain` / `zoneDe`,
chrono = `tempsPhase` pour **les deux** joueurs en duel, libellés mode-aware
(`'IA'` → `'J2'`), hooks debug `mode` / `setMode` / `setRythme` / `libelles` /
`questionsHumain(joueur)` / `saisie(joueur)`.

**En cours** : bouton ☰ MENU en cours de jeu (overlay pause « RETOUR AU JEU » /
« QUITTER → MENU »), puis J6 : sélection de personnage (et dette architecturale
`Personnage`, `docs/architecture.md` §9).

**Rappel J5 (présentation)** : arène + sprites cut-out, aura « Dragon Ball » à
2 couches (4 paliers, contraste WCAG ≥ 3:1), frappe graduée, K.O. animé —
J5 reste ouvert sur : sons, particules, ralenti tier 4, parade + contre dédiées,
journal de combat, captures E04/E05 (E04/E05 sont désormais verts en E2E).

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

- [x] Assets (méthode `docs/assets.md`) : planches générées des 2 personnages + découpe cut-out automatisée (`scripts/assets-cutout.py` → `game/assets/personnages/perso-a.png`, `perso-b.png`)
- [x] Décor d'arène cut-out (`game/assets/decors/arene-1.png`, intégré via `publicDir` Vite : servi en dev **et** copié dans dist pour l'APK) ; arena-2 + UI rétro → J6
- [x] Sprites/états animés par tweens : `idle` (respiration), `frappe` (élan), `touche` (recul), `ko` (chute + flash) + **`garde`, `parade`, `contre` dédiées** (esquive puis riposte)
- [x] Chargement d'aura « Dragon Ball » sous les calculs : **flamme à 2 couches**
  (langue colorée fusion normale + noyau incandescent fusion ADD) sur textures
  générées `scripts/assets-flammes.py` (2 variantes, flou durci) — 11 positions
  suivant la silhouette, vacillement par tweens, **teinte CPU** (`textureTeintee()`,
  le `setTint()` WebGL n'est pas appliqué dans l'environnement de test), teintes
  via `melangerVersBlanc(0.55 / 0.85)`, 4 paliers (`auraAlphas` 0.55/0.74/0.88/0.98,
  échelle 0.7→1.24), **contraste WCAG 1.4.11 mesuré ≥ 3:1** (corps 3,17:1,
  noyaux 9,6:1)
- [x] Impulsions d'aura à chaque calcul réussi (+1 petite, +7 marquée) — revient à l'alpha du palier courant (`alphaPalier`, bug d'écrasement corrigé)
- [x] Frappe graduée par tier (§2.8b) : élan, recul de la cible, secousse caméra, flash plein écran, dégâts flottants dimensionnés, **zoom caméra tier 3/4**, **ralenti (hitstop) tier 4** — toutes les intensités dans `config.ts` (`juice`)
- [x] Défense (§2.8c) : encaissement (recul), **blocage parfait** (étincelles + onde de choc), **parade dédiée** (garde + lueur d'aura) et **CONTRE-ATTAQUE dédiée** (esquive de l'attaquant puis riposte) — priorité visuelle contre > blocage > frappe > whiff
- [x] Impacts : flash radial fusion ADD + **étincelles** or (12 à 100 px, ADD) + **onde de choc** annulaire (tier ≥ 2), tailles/durées pilotées par `config.ts`
- [x] K.O. animé (chute + flash) + **bannière K.O. conservée** (`killTweensOf` : le fade du bandeau l'effaçait)
- [x] HUD complet : barres animées vert→orange→rouge, timer, énergie, **journal de combat** (5 derniers événements, bas centre) + **score de manche** persistant entre rejeux R (haut centre)
- [x] **Sons** WAV synthétisés (`scripts/assets-sons.py`) : `reussite`, `erreur`, `frappe`, `blocage`, `ko` — préchargés par `BootScene`, joués silencieusement si absents
- [x] Saisie **vidée après validation, juste ou faux** ; message d'erreur réduit à « FAUX ! » (le calcul, lui, reste affiché I4)
- [x] Captures E04 (`e2e-04-frappe.png`, tier 3 forcé) et E05 (`e2e-05-ko.png`, K.O. + score) — **E2E 9/9**

### J6 — Modes et menus

- [ ] **Refonte des planches en 3/4 de face, rendu type Mortal Kombat / Street Fighter** — demande utilisateur, direction `docs/assets.md` §2a
- [x] **Coups de poing et de pied animés** — demande utilisateur : **rig cut-out articulé** livré (`scripts/assets-rig.py` → 5 pièces par perso, pivots épaule/hanche, bandes de recouvrement) : poing, pied haut/bas, garde haute/basse, **contre avec saut + coup de pied**, flash d'impact à la hauteur du coup — angles/durées dans `config.ts` (`rig`), recettes `docs/assets.md` §3a ; validé par sonde rAF (`tmp/anim-probe.mjs` : 92/36/85/−140/150°) + E2E 9/9
- [x] **Mode 2 joueurs (même écran, tour par tour)** — **livré et testé** :
      `CONFIG.mode`, une console par joueur (touches physiques disjointes), rôles
      alternés, rythme SIMULTANÉ deux zones actives ; **choisissable depuis
      l'écran CONFIG** (E2E E07/E08).
- [x] **Surbrillance des touches du clavier à l'appui** — demande utilisateur :
      touche pressée (clic **ou** frappe physique) éclaircie + contour blanc, retour
      au repos après `CONFIG.ui.surbrillanceMs` (160 ms), **console pressée seule** ;
      durée/teinte dans `config.ts` section `ui` ; E2E **E08h** vert
- [ ] **Bouton ☰ MENU en cours de jeu** — demande utilisateur : bouton en HUD →
      overlay pause avec **[ RETOUR AU JEU ]** et **[ QUITTER → MENU ]**.
      Vigilance : `Échap` est déjà « C Tout effacer » de J1 → raccourci distinct
      (piste `M`) ; à vérifier avant : `this.time.timeScale = 0` gèle-t-il bien
      les `delayedCall` (`Clock` de Phaser)
- [x] **Écran de lancement rétro** (bouton **RUN** clignotant au-dessus, **CONFIG**
      au-dessous, style borne d'arcade) — `MenuScene` + `ui/retro.ts` (primitives
      partagées) + **fond d'illustration** (`game/assets/fonds/fond-menu.png`,
      voile de lisibilité `CONFIG.ui.voileMenu`) ; Entrée = RUN ; HIGH SCORE
      volontairement absent (règle à définir, § Idées/dette)
- [x] **Écran CONFIG des règles** (commandes ◀ ▶ rétro) : mode, tempo (durée unique
      attaque = défense : Rapide 10 s, Normal 15 s, Long 25 s + curseur borné
      5–60 s), rythme de calcul (Différé/Simultané), PV, niveau, difficulté IA —
      `ConfigScene` + fond d'illustration (`fond-config.png`, voile
      `CONFIG.ui.voileConfig`) ; boutons RETOUR (abandon, `Échap`) /
      RÉINITIALISER / VALIDER ; écriture bornée à la validation (I9) ;
      E2E **E06** (tempo) et **E07** (mode + rythme) verts
- [ ] Sélection de personnage + menu principal + choix de niveau
- [ ] **Classe `Personnage` — interface unique + skins** (détail `docs/architecture.md` §9) :
      une seule classe pour J1/J2, orientation en **état** (`gauche`/`droite`), coups
      nommés (`coupDePoing('direct'|'uppercut'|'crochet')`, `coupDePied('haut'|'bas')`,
      `saut`, `garde…`), skin = **descripteur de données** (pièces + pivots +
      profondeurs + teintes) → changer d'habillage = changer de descripteur, aucun
      code dupliqué ; héritage réservé à un skin à **comportement** propre.
      Prérequis de la sélection de personnage ; déplace ~12 méthodes hors `FightScene`.
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
  - **HIGH SCORE retiré de l'écran RUN (2026-11-14, demande utilisateur)** : la
    ligne « HIGH SCORE » du wireframe §1 est volontairement absente tant que la
    règle de calcul n'est pas choisie. Pistes proposées :
    1. **Score de combat** (le plus classique) : points = somme des énergies
       gagnées (× gain de la difficulté) + **bonus de temps restant** à la fin ;
       K.O. rapide = gros bonus → récompense à la fois calcul *et* rapidité ;
    2. **Score de cadence** (fidèle à §2.5 « son propre score ») : nombre de
       calculs réussis par partie, affiché avec le taux de réussite
       (`réussis / tentés`), record séparé par niveau de calcul ;
    3. **Score par manche façon arcade** : points par round gagné + bonus K.O. +
       multiplicateur de série (calculs enchaînés sans erreur) — le plus « borne » ;
    4. **Record local persistant** : quel que soit le barème, stockage
       `localStorage` (hors-ligne, déplaçable), un record par
       `mode × niveau de calcul`, affiché sur l'écran RUN.
  - À trancher avant d'afficher quoi que ce soit (sinon un nombre inventé ment).
- **Bouton « Indice »** : afficher l'astuce de déduction de la table concernée
  (boîte à outils `AGENTS.md` §2.5) — pédagogique, à pénaliser doucement ou non.
- **Addition / soustraction** : type de calcul supplémentaire pour adapter le niveau
  (abstraction `type d'opération` prévue dès J2 dans le générateur — v1 = × et ÷ seuls).
- Best-of-3 manches + écran de victoire de manche (J8).
- Sauvegarde des scores / progression (hors périmètre v1).
- Deux personnages jouables minimum pour la sélection (J6).
- Accessibilité : taille de police, contraste, mode daltonien (à évaluer J8).
- Publication Play Store : **hors périmètre** (APK signé debug uniquement).
