# AGENTS.md — MathKombat (jeu de combat éducatif Android)

> Ce fichier est la **source de vérité** du projet. Tout agent ou intervenant travaille
> à partir de ce document. En cas de divergence entre ce fichier et le code, ce fichier
> fait foi pour l'intention, le code corrige ensuite ce fichier via `journal.md`.

## 1. Objectif

Produire un **jeu de combat 2D** style *Mortal Kombat* / *Street Fighter* où la puissance
des coups dépend de la réussite à des **calculs mentaux** :

- **attaquer** = résoudre des **multiplications** dans un temps limité ;
- **défendre** = résoudre des **divisions** dans un temps limité ;
- chaque calcul réussi rapporte de l'**énergie** selon la difficulté choisie
  (**Facile +1**, **Moyen +3**, **Difficile +7**) ;
- l'énergie accumulée = **puissance du coup** ; les points de défense sont retranchés à
  cette puissance ; si le solde est négatif, le défenseur déclenche une **contre-attaque**
  de puissance égale à la valeur absolue du solde.

Livrables :

1. **APK Android** jouable hors-ligne (téléphone / tablette) ;
2. **version web** de développement et de debug (navigateur) ;
3. **socle de test et d'observabilité** pilotable par agent (tests automatisés, logs par
   socket, modes debug/release).

Vise un public scolaire (fin primaire / collège) : les calculs sont adaptatifs.

## 2. Gameplay — spécification de référence

Toutes les valeurs chiffrées ci-dessous sont des **paramètres d'équilibrage** : elles
vivent dans `game/src/core/config.ts` et nulle part ailleurs.

### 2.1 Boucle de combat

- 2 combattants (Joueur 1 / Joueur 2 ou IA), **100 PV** chacun, barres de vie.
- Un **tour** = phase(s) de calcul puis résolution, puis **inversion des rôles** :
  l'attaquant **devient défenseur** au tour suivant, **puis attaquant à nouveau**, et
  ainsi de suite jusqu'au K.O. En rythme DIFFÉRÉ, **une seule zone est active à la
  fois** (celle du joueur dont c'est la phase) ; en SIMULTANÉ, **les deux zones sont
  actives** (l'attaquant résout ses multiplications, le défenseur ses divisions).
- **Rythme de calcul configurable** (§2.9), au choix :
  - **DIFFÉRÉ** *(défaut)* : la phase d'attaque puis la phase de défense
    s'enchaînent, chacune avec **la même durée** ; une seule zone de calcul active à
    la fois ;
  - **SIMULTANÉ** : les deux joueurs calculent **en même temps**, sur le **même
    chrono** (l'attaquant ses multiplications, le défenseur ses divisions).
  - Le rythme appliqué est **toujours celui de la configuration choisie** (écran
    CONFIG ou `config.ts`) : **aucun comportement automatique**. La **taille de
    l'écran n'est que le *pourquoi*** de ce réglage (deux joueurs côte à côte
    demandent de la place) ; **c'est la configuration choisie qui est la réponse**.
- **Zone de calcul par joueur** : les 3 calculs s'affichent **au-dessus du joueur
  concerné** — au-dessus de l'attaquant pour les multiplications, au-dessus du
  défenseur pour les divisions (les deux zones en SIMULTANÉ, disposition : §2.7).
- **K.O.** : PV ≤ 0 → fin du combat. (V1 : une manche. Best-of-3 manches = jalon J8.)

### 2.2 Phase d'attaque — multiplications

- Durée globale : **identique à celle de la défense** (défaut **15 s**, paramètre
  **configurable**, §2.9). **Aucun timer par calcul** : la seule limite est
  le temps de phase — être lent est naturellement pénalisé puisqu'on résout moins de
  calculs, donc un coup moins puissant.
- **3 calculs proposés simultanément au-dessus de l'attaquant**, un par difficulté,
  gain affiché sur chacun :
  - **Facile → +1 énergie** ;
  - **Moyen → +3 énergie** ;
  - **Difficile → +7 énergie**.
- Le joueur est **libre de choisir quel calcul résoudre**, et dans quel ordre.
- **Saisie au clavier numérique du joueur** (chiffres 0–9, touches **Effacer** et
  **Valider**, voir §2.7) : le joueur tape sa réponse, **Effacer** corrige une erreur
  de saisie sans pénalité, et la réponse n'est évaluée qu'à **Valider**.
- **Réussite** → +énergie de la difficulté du calcul, et **seul ce calcul est remplacé**
  par un nouveau calcul de même difficulté (les deux autres restent affichés).
- **Erreur** → retour visuel (« Faux ! »), mais **le calcul reste affiché** tel quel et
  peut être retenté : aucune pénalité hormis le temps perdu.
- Fin du **temps de phase** (durée configurable, §2.9) → le coup est porté avec
  l'énergie totale accumulée (0 énergie = coup manqué, « whiff » → tier 0, §2.8b).

### 2.3 Phase de défense — divisions

- Même structure, **même durée que l'attaque** (configurable, §2.9), **aucun timer
  par calcul**. En rythme **SIMULTANÉ**, cette phase court sur le **même chrono** que
  l'attaque (les deux joueurs calculent ensemble).
- **3 calculs de division simultanés au-dessus du défenseur**, un par difficulté :
  **Facile +1**, **Moyen +3**, **Difficile +7** points de défense. Divisions exactes
  (ex. `56 ÷ 7`), réponse saisie au **clavier numérique** (Effacer / Valider).
- Même règle de rendement : réussite = remplacement du **seul** calcul résolu ;
  erreur = le calcul **reste** (retour « Faux ! »), temps perdu comme seule pénalité.
- Objectif : cadence maximale → défense élevée → potentiel de **contre-attaque** élevé
  (défense > attaque → contre de la valeur du solde).

### 2.4 Résolution du coup

```
solde = énergie_attaque − points_défense
solde >  0  →  dégâts = solde retranchés à la barre de vie du défenseur
solde <  0  →  CONTRE-ATTAQUE : |solde| dégâts retranchés à la barre de vie de l'attaquant
solde =  0  →  coup bloqué (aucun dégât)
```

**Barre de vie** : chaque joueur possède une barre de vie (100 PV, paramètre) affichée
en HUD. *Tous* les points de dégât (dégâts du solde positif **et** contre-attaque)
sont **retranchés à la barre de vie** du joueur concerné — aucune autre métrique n'est
affectée. La décroissance est animée (tween) et le code couleur évolue
vert → orange → rouge selon le pourcentage restant. PV ≤ 0 → K.O. (§2.1).

Cas particuliers : **whiff** (attaque = 0) → animation de coup manqué (tier 0),
la résolution suit la règle normale (un whiff face à une défense positive déclenche
donc une contre-attaque) ; attaque = 0 et défense = 0 → « bloqué » sans animation
d'impact.

### 2.5 Niveaux de calcul (adaptatifs)

Calibrage pédagogique **intégré au projet** (source : plan d'apprentissage des tables
CM2 « Tables de multiplication », 2026-11-12 — contenu consolidé ci-dessous, le
document source n'est pas requis) : la difficulté suit les **familles de tables**
telles qu'un élève les vit — pas seulement la taille des nombres.

**Difficulté = couleur du fait** : par commutativité, `a×b` est le même fait que `b×a`
et prend la couleur de la table **la plus facile** de ses deux facteurs (ex. `2×7`
est un fait « × 2 » 🟢). Le gain reste +1 / +3 / +7 :

| Difficulté | Gain | Règle de classement du fait | Exemples |
|------------|------|------------------------------|----------|
| Facile | +1 | 🟢 **Vert** : au moins un facteur ∈ {1, 2, 5, 10} | `2 × 4`, `5 × 6` |
| Moyen | +3 | 🟡 **Jaune** (déductible par astuce) : sinon, au moins un facteur ∈ {3, 4, 6, 8, 9, 11, 12} | `4 × 7`, `9 × 6` |
| Difficile | +7 | 🟠 **Orange** : les **5 faits résistants** (repli Débutant : `3×3`, `3×4`, `4×4`) | `7 × 8`, `6 × 8`, `8 × 8` |

Les **5 faits résistants** (à mémoriser, d'après le document) : `6×7`, `6×8`, `7×7`,
`7×8`, `8×8`. Ils apparaissent en Difficile dès que la **borne du niveau** le permet
(second facteur ≥ 6 pour les produire) ; sinon (niveau **Débutant**, résistants
impossibles), Difficile tire dans les faits **sans table verte** : `3×3`, `3×4`, `4×4`.

**Niveau = borne du second facteur** (multiplications) et du **quotient** (divisions),
choisi en début de combat par chaque joueur ; l'IA utilise le niveau du joueur humain :

| Niveau | Borne |
|--------|-------|
| Débutant | 1–5 |
| Intermédiaire | 1–10 |
| Avancé | 1–12 |

**Divisions** : un calcul prend la couleur du **fait sous-jacent** (diviseur ×
quotient) selon la même règle — ex. `30 ÷ 5` 🟢 (fait `{5, 6}`), `72 ÷ 8` 🟡 (fait
`{8, 9}`), `56 ÷ 7` 🟠 (fait résistant). Le dividende est généré comme
`quotient × diviseur` (quotient borné par le niveau) → **division toujours exacte**.

Règles de génération : opérandes entiers ; **énoncé jamais affiché deux fois de suite
sauf impossibilité** (famille épuisée) ; `a×b` et `b×a` comptent pour le **même fait**
(commutativité : jamais deux formes d'un même fait à la suite) ; **réponse unique**
(saisie libre au clavier numérique — aucune proposition à générer).

**Boîte à outils de déduction** (astuces par table — matière première d'un futur
bouton « Indice » et du calibrage de l'IA) :

| Table | Astuce | Exemple |
|-------|--------|---------|
| × 1 | le nombre ne change pas | `1 × 8 = 8` |
| × 10 | on ajoute un 0 | `10 × 7 = 70` |
| × 2 | le double | `2 × 7 = 14` |
| × 5 | la moitié de × 10 | `5 × 8 = 80 ÷ 2 = 40` |
| × 4 | le double du double | `4 × 7 : 7 → 14 → 28` |
| × 3 | × 2 puis on ajoute le nombre | `3 × 7 = 14 + 7 = 21` |
| × 9 | × 10 moins le nombre | `9 × 7 = 70 − 7 = 63` |
| × 6 | × 5 puis on ajoute le nombre | `6 × 7 = 35 + 7 = 42` |
| × 8 | le double du double du double | `8 × 7 : 7 → 14 → 28 → 56` |
| × 7 | × 5 + × 2, ou commutativité | `7 × 6 = 6 × 7 = 42` |

Moyen mnémotechnique des faits résistants : `56 = 7 × 8` (les chiffres 5, 6, 7, 8
se suivent).

**Ancrage pédagogique** (principes du plan source, conséquences produit) :

- *« L'erreur est un indice, pas une faute »* → déjà appliqué : erreur = « Faux ! »,
  le calcul **reste**, aucune pénalité (§2.2).
- *« Le chrono contre son propre score, jamais contre un autre »* → chaque joueur
  joue sa propre cadence ; idée de **record personnel** (voir `todo.md`).
- *« Aucun chronomètre au début »* → idée de **Mode Entraînement sans chrono**
  (voir `todo.md`), hors périmètre v1.

**Types de calculs (v1 et extensions)** : la phase d'attaque utilise les
**multiplications**, la phase de défense les **divisions**. Le générateur est abstrait
par **type d'opération** — `addition`, `soustraction`, `multiplication`, `division` —
pour permettre ultérieurement d'**adapter le niveau en variant les opérations**.
En v1, seules **×** et **÷** sont actives ; **+** et **−** sont prévues dans
l'architecture mais non implémentées (voir `todo.md`, « Idées / dette »).

### 2.6 Modes de jeu

- **Solo vs IA** (3 difficultés d'IA : Facile / Moyen / Difficile — probabilité de
  réussite et stratégie de choix de difficulté paramétrées dans `config.ts`).
  - **Déroulé des phases de l'IA** : l'IA **joue ses phases sur la même durée** que
    les joueurs humains (aucune résolution instantanée) ; son énergie s'accumule
    progressivement et est **visible via son aura** ; sa zone de calcul reste en
    veille (aucune interaction). Son score n'est révélé qu'à la résolution.
  - **IA « gentille » — suspense ET possibilité de gagner** : l'IA **ne maximise
    jamais sa cadence** et **reste toujours battable**. Son rendement est plafonné
    (`iaRendementMax`, défaut **70 %** de la cadence humaine de référence,
    `config.ts`) : **en dessous de ce qu'un joueur rapide peut atteindre** — un bon
    joueur l'emporte à **toutes les difficultés**. **Rattrapage doux** : si elle
    mène de plus de `ecartSuspense` PV, son rendement baisse d'un cran. Bilan :
    **l'issue reste incertaine jusqu'au K.O.** et le joueur a toujours une
    possibilité réelle de gagner. **Taux de victoires humaines visés** (calibrage
    J8) : Facile ≈ 80 %, Moyen ≈ 50 %, Difficile ≈ 30 %.
- **2 joueurs**, même appareil : les rôles **alternent à chaque tour** (zones J1/J2) ;
  en rythme SIMULTANÉ, les deux joueurs jouent **dans le même tour**, sur le même
  chrono (§2.1).

### 2.7 Entrées / interface

- **Écran de lancement rétro** (style borne d'arcade : cadre, fonte pixel,
  « INSERT COIN ») : bouton **RUN** clignotant **au-dessus**, bouton **CONFIG**
  **au-dessous**. RUN lance le combat avec les règles enregistrées (→ sélection des
  personnages) ; CONFIG ouvre l'écran de configuration des règles.
- **Écran CONFIG** (style écran de setup rétro, commandes **◀ ▶**) : mode
  (Solo vs IA / 2 joueurs), tempo (durée unique attaque = défense, §2.9), **rythme de
  calcul (Différé / Simultané)**, PV, niveau de calcul, difficulté IA — touches
  **VALIDER** / **RÉINITIALISER**.
- **Clavier numérique par joueur** : chiffres **0–9**, deux touches d'effacement
  **distinctes** — **⌫ Effacer** (supprime le **dernier chiffre** saisi, répété =
  remonte chiffre par chiffre) et **C Tout effacer** (vide la saisie entière
  d'un coup) — et la touche **Valider** (évalue la réponse). Chaque joueur a **son
  propre clavier** dans sa zone ; en mode Solo, un seul clavier est actif.
  - Une saisie n'est **évaluée qu'à Valider** ; tant que Valider n'est pas appuyé,
    **⌫ Effacer** et **C Tout effacer** corrigent sans aucune pénalité.
  - Saisie vide + Valider = ignoré (aucun effet). Saisie **bornée à 3 chiffres**
    (les réponses vont de 0 à 144 : produits ≤ 12×12, quotients ≤ 12). La saisie en
    cours à la fin de la phase est **abandonnée** (seuls les calculs résolus comptent).
  - Version web de debug : touches physiques 0–9, `Entrée` = Valider,
    `Retour arrière` = ⌫ Effacer, `Échap` = C Tout effacer.
- **Alignement des claviers** : le clavier de la zone gauche (J1) est **aligné à
  gauche**, celui de la zone droite (J2) **aligné à droite** — chacun plaqué contre
  son bord d'écran, sous la main du joueur (voir `docs/wireframes.md`).
- Tactile d'abord (grands boutons), souris/clavier pour la version web de debug.
- HUD : **barres de vie des deux joueurs** (100 PV, décroissance animée, code couleur
  vert/orange/rouge, valeur numérique), timer, énergie en cours, score de manche,
  journal de combat (5 derniers événements).
- **Zone de spectacle** : sous les 3 calculs, l'arène et les deux combattants sont
  visibles en permanence (voir §2.8).

### 2.8 Mise en scène — animations

La scène de combat combine en permanence deux plans : les **calculs** (haut) et
l'**arène animée** (bas). Toutes les intensités d'animation sont des **fonctions
déterministes de la puissance**, définies dans `core/config.ts` (testables, jamais
estimées « à l'œil » dans le code d'animation).

#### a) Chargement d'énergie (phase de calcul) — style « Ki » façon Dragon Ball

Sous les calculs, l'attaquant est en **concentration** : une **aura d'énergie** dont
l'intensité croît avec l'énergie accumulée en temps réel. Les paliers sont des
**pourcentages de l'énergie visuelle de référence** (`energieVisuelleMax`, défaut
**30**, `config.ts`) : l'aura est saturée au-delà — c'est un **plafond visuel
uniquement**, l'énergie de jeu reste non plafonnée (I11).

| Énergie en cours (vs référence) | Intensité de l'aura |
|---------------------------------|---------------------|
| 0–25 % | lueur légère, quelques particules qui montent |
| 25–50 % | flamme/aura colorée stable, ondes, effets de vent |
| 50–75 % | aura forte, éclairs/ondes régulières, léger tremblement du sol |
| 75–100 % (et au-delà, saturée) | surpuissance : flashs, particules d'énergie, screen shake léger |

- **Chaque calcul réussi** : impulsion d'aura (+1 petite, +7 marquée : pop de
  particules + compteur d'énergie qui grimpe + mini-flash).
- **Erreur** : retour « Faux ! », micro-animation de gêne du personnage, l'aura
  **reste à son niveau** (le calcul reste affiché, cf. §2.2).

#### b) Frappe — intensité graduée par la puissance du coup

À la résolution, l'attaquant frappe ; l'animation suit un **tier déterministe**
(paramétré dans `config.ts`) :

| Tier | Énergie | Mise en scène |
|------|---------|---------------|
| 0 — whiff | 0 | coup manqué : le combattant frappe dans le vide (aucun impact) |
| 1 — léger | 1–5 | coup rapide, pas de zoom |
| 2 — moyen | 6–12 | flash d'impact, petite secousse |
| 3 — lourd | 13–20 | zoom rapide, forte secousse, particules d'énergie |
| 4 — surpuissant | 21+ | ralenti 0,3 s, flash plein écran, onde de choc, grande secousse |

Dégâts flottants = valeur du solde, taille et couleur proportionnelles.

#### c) Défense simultanée, avec ou sans contre

Le défenseur joue sa **garde en même temps** que la frappe arrive (animations
synchronisées, jamais séquentielles) :

- **solde > 0** : le défenseur **encaisse** (recul, animation de touché, dégâts = solde) ;
- **solde = 0** : **blocage parfait** (étincelles, son « ting », aucun dégât) ;
- **solde < 0** : **parade puis CONTRE-ATTAQUE** — le défenseur pare/esquive et
  riposte immédiatement avec une animation dédiée ; dégâts flottants `|solde|` sur
  l'attaquant qui recule.

#### d) Chocs et fin de combat

- **K.O.** : chute animée + flash + ralenti + écran K.O.
- Les animations sont **non bloquantes** : le tour suivant démarre dès la résolution,
  les tweens se terminent en arrière-plan (timers en temps de jeu).

Assets : spritesheets par personnage (`idle`, `charge`, `frappe`, `garde`, `parade`,
`contre`, `touche`, `ko`) + effets (particules d'aura, impacts, ondes de choc,
secousses, flashs, ralenti, dégâts flottants). **Méthode de production des images
et sprites : `docs/assets.md`** (cut-out animé par tweens privilégié, génération
par référence, post-traitement PIL/ImageMagick).

### 2.9 Paramètres configurables — dont le temps de tour

Toutes les valeurs d'équilibrage sont centralisées dans `core/config.ts` et
**modifiables sans toucher au code de jeu**. L'unité configurable est la **durée de
phase** (identique attaque/défense) ; la **durée d'un tour en découle** :
**DIFFÉRÉ = 2 × durée de phase** (attaque puis défense), **SIMULTANÉ = 1 × durée de
phase** (les deux phases partagent le même chrono).

| Paramètre | Défaut | Plage | Réglage |
|-----------|--------|-------|---------|
| **Temps de phase** (identique attaque/défense) | 15 s | 5–60 s | `config.ts` + écran **CONFIG** |
| **Rythme de calcul** | Différé | Différé / Simultané | `config.ts` + écran **CONFIG** |
| PV par joueur | 100 | 10–999 | `config.ts` |
| Énergie visuelle de référence (aura) | 30 | 10–99 | `config.ts` |
| Bornes des tiers d'animation | §2.8b | — | `config.ts` |
| Difficulté de l'IA | Moyen | Facile/Moyen/Difficile | `config.ts` + écran **CONFIG** |
| Rendement max de l'IA (« gentillesse ») | 70 % de la cadence humaine | 30–100 % | `config.ts` |
| Cadence humaine de référence (`cadenceHumaineReference`) | 1 calcul réussi / 3 s | — | `config.ts` |
| Seuil de rattrapage doux (`ecartSuspense`) | 20 PV | 5–50 | `config.ts` |
| Taux de victoires humaines visés (par difficulté IA) | 80 / 50 / 30 % | — | cible de calibrage J8 |

**Définitions** : la **cadence humaine de référence** est de **1 calcul réussi toutes
les 3 s** (≈ 5 réussites par phase de 15 s). Le **« joueur de référence »** des tests
(S12) est un profil simulé jouant à cette cadence avec **85 % de réussite**.

- **Écran CONFIG** (jalon J6) : presets de tempo **Rapide (10 s)**,
  **Normal (15 s)**, **Long (25 s)** — **même durée pour l'attaque et la défense** —
  ou valeur personnalisée (curseur borné 5–60 s) ; choix du **rythme de calcul**
  (Différé / Simultané). Le réglage s'applique au prochain tour.
- Les durées sont **validées à la lecture** de la config : jamais de timer nul, négatif
  ou infini ; toute valeur hors plage est ramenée à la borne (et journalisée en DEBUG).
- Le comportement du jeu découle **uniquement de la configuration choisie** : la taille
  de l'écran n'est que la **motivation** du réglage de rythme (le *pourquoi*), jamais
  un facteur d'adaptation automatique.

## 3. Stack technique

| Élément | Choix | Justification |
|---------|-------|---------------|
| Jeu | **HTML5 — Phaser 3 + TypeScript + Vite** | Debug navigateur (DevTools, hot reload), animations (tweens, spritesheets), fluidité 60 fps |
| Tests | **Vitest** (moteurs) + scénarios headless + **Puppeteer** (E2E UI) | Pilotables par agent, rapports automatisés |
| APK | **WebView Kotlin plein écran** + Gradle | Build dans le projet (Termux) et sur PC (Android Studio) |
| Logs | **Évacuation par socket** (WebSocket + TCP brut) vers `scripts/log-collector.js` | Analyse agent en temps réel, fichiers JSONL |
| Modes | **DEBUG** (logs, HUD debug) / **RELEASE** (aucun log, zéro socket) | Exigence produit |

Node.js (`node`/`npm`) et un shell bash sont les **seuls prérequis système**. Tout le
reste (SDK Android, Gradle, JDK portable, node_modules) est **embarqué dans le projet**
(voir §4).

## 4. Arborescence et règle d'isolation

```
MathKombat/
├── AGENTS.md                  # ce fichier
├── README.md                  # présentation courte
├── journal.md                 # journal des choses produites (obligatoire à chaque session)
├── todo.md                    # à faire + planification (obligatoire à chaque session)
├── docs/
│   ├── architecture.md        # protocole de log, modes debug/release, flux
│   ├── test-plan.md           # plan de test pilotable (L0→L5, invariants, scénarios)
│   ├── pitch.md               # pitch court/long, cible, différenciation
│   ├── wireframes.md          # wireframes textuels écran par écran
│   └── assets.md              # méthode de production des images et sprites
├── game/                      # projet web Phaser 3 + TS + Vite
│   ├── src/core/              # logger.ts, config, math-generator, combat-engine, ai-controller
│   ├── src/scenes/            # Boot, Menu, Select, Fight, GameOver…
│   ├── src/ui/                # overlay quiz, HUD
│   ├── assets/                # sprites, spritesheets, sons
│   ├── tests/                 # tests Vitest + scénarios JSON
│   └── node_modules/          # local au projet
├── android/                   # wrapper WebView Kotlin (projet Gradle standard)
├── tools/                     # SDK/Gradle/JDK — NON versionnés (git), reconstitués
│   ├── android-sdk/           #   par scripts/setup-sdk.sh : SDK Android 34
│   ├── gradle/                #   + distribution Gradle 8.x
│   └── jdk/                   #   + JDK portable (javac)
├── scripts/
│   ├── env.sh                 # ancrage isolation (source de vérité des chemins)
│   ├── setup-sdk.sh           # installe SDK+Gradle+JDK dans tools/ (copie locale)
│   ├── log-collector.js       # serveur socket de collecte des logs (zéro dépendance)
│   ├── ws-probe.mjs           # sonde WebSocket/TCP pour smoke tests
│   ├── smoke.sh               # vérifications rapides pilotables
│   └── build.sh / build-apk.sh# builds (jalons J1 et J7)
├── .gradle-cache/ .npm-cache/ .tmp/   # caches isolés dans le projet
└── output/                    # logs/, reports/, screenshots/, APK, builds web
```

**Règle d'isolation (intangible) :**

- **Tout** doit être contenu dans ce répertoire, **SDK Android compris**. Aucun chemin
  absolu hors projet dans le code ni dans les scripts (seule exception : les prérequis
  système `bash` et `node`, et la source de copie locale de `scripts/setup-sdk.sh`,
  uniquement au moment de l'installation).
- `scripts/env.sh` ancre tous les chemins dans le projet :
  `ANDROID_HOME=$PROJ/tools/android-sdk`, `JAVA_HOME=$PROJ/tools/jdk`,
  `GRADLE_USER_HOME=$PROJ/.gradle-cache`, `npm_config_cache=$PROJ/.npm-cache`,
  `TMPDIR=$PROJ/.tmp`. Tout script de build le source en premier.
- Le projet est **déplaçable tel quel** (Termux ou PC) et buildable **hors-ligne** une
  fois `tools/` installé.
- **Git** : `tools/` n'est **pas versionné** (binaires) — le dépôt reste léger et
  restaurable grâce à `scripts/setup-sdk.sh` (**copie locale** d'abord,
  **téléchargement officiel** en repli : JDK Temurin 21, Gradle 8.10.2, cmdline-tools
  + `sdkmanager` pour platform-34 / build-tools 34.0.0).
- Espace disque attendu : ~1 Go (SDK 457 Mo + Gradle + JDK + node_modules).

## 5. Modes DEBUG / RELEASE et évacuation des logs par socket

Détail complet du protocole : `docs/architecture.md`. Résumé :

- **DEBUG** (`npm run dev`, `npm run build -- --mode debug`) :
  - logger actif (trace→error) ;
  - chaque enregistrement part **par socket** vers `scripts/log-collector.js`
    (WebSocket `ws://127.0.0.1:8765`) + console ; côté jeu, le repli est la **file
    tampon + reconnexion** (le TCP brut du collecteur sert aux sondes et clients
    non-navigateur) ;
  - HUD debug (FPS, scène, état du combat) ;
  - assertions et temps de calcul affichés.
- **RELEASE** (`npm run build`) :
  - logger **compilé en no-op** (aucun appel réseau, aucune chaîne de log) ;
  - pas de socket, pas de HUD debug, pas d'assertion.
- Le collecteur écrit les logs en **JSONL** dans `output/logs/<session>.jsonl` — c'est
  la matière première de l'agent pour analyser ce qui se passe (débug, audits de
  scénarios, preuves de test).
- **Format d'enregistrement** (JSONL, une ligne = un événement) :

```json
{"ts":"2026-11-12T21:00:00.000Z","seq":42,"session":"fight-20261112-2100",
 "build":"debug","level":"debug","scene":"Fight","event":"combat.coup_resolu",
 "data":{"attaque":7,"defense":10,"solde":-3,"contre":3}}
```

- Convention de nommage des événements : `<domaine>.<action>` (`math.genere`,
  `combat.phase`, `combat.coup_resolu`, `ia.choix`, `ui.clic`, `erreur.*`).
- **Règle** : aucune fonction de jeu n'écrit directement en console ou en socket ;
  tout passe par `game/src/core/logger.ts`. En RELEASE, ce module est un no-op.

## 6. Tests — discipline

Référence complète : `docs/test-plan.md` (niveaux L0→L5, invariants I1→I16,
catalogue de scénarios S01→S12, procédure de pilotage agent).

- Le **cœur de jeu** (`math-generator`, `combat-engine`, `ai-controller`) est **pur**
  (sans Phaser, sans DOM, sans I/O) et **100 % couvert par des tests Vitest**.
- **Avant toute livraison de jalon** : `bash scripts/smoke.sh` + `npm test` +
  exécution des scénarios headless ; le rapport est écrit dans `output/reports/`
  et référencé dans `journal.md`.
- Toute modification de `core/` exécute le catalogue de scénarios complet (S01→S12)
  : c'est le garde-fou de non-régression.
- Le plan de test est **pilotable par agent** : chaque test est une commande, produit
  un artefact (rapport JSON/MD, capture, log socket) et a un oracle explicite (PASS/FAIL).

## 7. Conventions de code

- TypeScript **strict**, pas de `any` dans `core/`, noms de fonctions et commentaires
  en **français**, identifiants code en anglais.
- `core/` = logique pure testée ; `scenes/` + `ui/` = présentation Phaser, jamais de
  logique métier dedans (elle appelle `core/`).
- Tout l'équilibrage (durées, énergies, PV, IA) dans `core/config.ts` — jamais de
  constante magique en dur ailleurs.
- Interfaces utilisateur en **français**.
- Logs : voir §5 ; niveaux `trace|debug|info|warn|error`, jamais de donnée sensible.
- Un commit = une intention ; message en français, impératif (« Ajoute le générateur »).

## 8. Commandes

```bash
source scripts/env.sh                  # ancrage isolation (obligatoire)
node scripts/log-collector.js          # collecteur de logs (terminal dédié, mode DEBUG)
bash scripts/smoke.sh                  # vérifications rapides (L0)
bash scripts/setup-sdk.sh              # (re)construit tools/ (copie locale ou téléchargement)
cd game && npm install && npm run dev  # J1 : dev server web (http://127.0.0.1:5173)
bash scripts/build.sh [debug|release]  # J1 : build web → game/dist/

# jalons suivants (documentés ici au fur et à mesure) :
# npm test                             # J2+ : tests Vitest
# node scripts/run-scenarios.mjs       # J3+ : scénarios headless
# bash scripts/build-apk.sh            # J7 : APK (SDK local uniquement)
```

## 9. Journal et TODO — discipline de session

- **`journal.md`** : à **chaque session de travail**, ajouter une entrée datée listant
  ce qui a été **produit** (fichiers, artefacts), les **décisions**, les **résultats**
  de tests, les **anomalies** et la **prochaine étape**. C'est le journal des choses
  produites, exigible à tout moment.
- **`todo.md`** : mettre à jour l'état des tâches (case cochée = produit ET testé),
  maintenir la **planification** (ordre, dépendances, jalons) et y reporter toute
  nouvelle idée en section « Idées / dette ».
- L'agent ne déclare jamais un jalon « terminé » sans : code produit + tests verts +
  entrée de journal + mise à jour du todo.

## 10. Roadmap (jalons et définition de fini)

| Jalon | Contenu | Définition de fini (DoD) |
|-------|---------|--------------------------|
| **J0** | Socle : AGENTS.md, README, journal, todo, docs (archi + tests), collecteur de logs, logger, smoke, SDK embarqué | `smoke.sh` vert ; collector testé (WS + TCP) ; `tools/` installé ; docs cohérentes |
| **J1** | Scaffold Vite+Phaser, scène de combat squelette, build web | `npm run dev` jouable (2 sprites qui s'affichent), build OK |
| **J2** | `math-generator` adaptatif + tests | 100 % couverture core maths ; S01-S03 verts |
| **J3** | `combat-engine` (énergie, défense, contre-attaque) + `ai-controller` + tests | Invariants I1→I16 applicables vérifiés ; S04→S08, S10-S11 verts |
| **J4** | Quiz jouable intégré — combat Solo vs IA complet | Partie complète jouable au clavier ; S09-S10 verts |
| **J5** | Animations, HUD, juice (sons, particules, impacts) | Captures dans `output/screenshots/` ; fluidité 60 fps |
| **J6** | Mode 2 joueurs + sélection de personnage + menus + niveaux | Les 2 modes jouables de bout en bout |
| **J7** | APK (wrapper WebView) — builds Termux et PC | APK installable et jouable hors-ligne ; `build-apk.sh` vert |
| **J8** | Équilibrage, best-of-3, QA, polish | Catalogue de scénarios vert + manuel de test exécuté |

Chaque jalon se termine par : tests exécutés (rapport dans `output/reports/`),
entrée de `journal.md`, `todo.md` à jour.
