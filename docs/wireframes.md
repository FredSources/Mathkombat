# Wireframes — MathKombat (textuels, écran par écran)

Écran de jeu en **paysage** (verrouillé, cf. grille manuelle M05). Chaque wireframe
indique les éléments, leur comportement et les événements de log associés
(nomenclature : `docs/architecture.md` §4). Les écrans 1 et 2 reprennent le **style
rétro des anciens jeux / bornes d'arcade** : fonte pixel, cadre, commandes ◀ ▶.

**Règle d'alignement des claviers** : dans la moitié gauche (J1), le clavier numérique
est **aligné à gauche** ; dans la moitié droite (J2), **aligné à droite** — chaque
clavier est plaqué contre le **bord extérieur** de l'écran, sous la main du joueur.

---

## 1. Écran de lancement (style borne d'arcade)

```
┌──────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓      M  A  T  H  K  O  M  B  A  T               ▓ │
│ ▓      ═══════════════════════════                 ▓ │
│ ▓        « FRAPPEZ AVEC VOTRE TÊTE »              ▓ │
│ ▓                                                  ▓ │
│ ▓           ┌────────────────────┐                 ▓ │
│ ▓           │  ▶  R U N   ◀      │  ◄ clignotant   ▓ │
│ ▓           └────────────────────┘                 ▓ │
│ ▓           ┌────────────────────┐                 ▓ │
│ ▓           │  ⚙  C O N F I G    │                 ▓ │
│ ▓           └────────────────────┘                 ▓ │
│ ▓                                                  ▓ │
│ ▓   © 2026 MATHKOMBAT · INSERT COIN                ▓ │
│ ▓   HIGH SCORE : 12 400                            ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└──────────────────────────────────────────────────────┘
```

- Cadre type borne, fonte pixel, **bouton RUN au-dessus** (clignotant comme
  « PRESS START » des anciens jeux), **bouton CONFIG au-dessous**.
- **RUN** → sélection des personnages (écran 3) → combat avec les règles enregistrées.
- **CONFIG** → configuration des règles (écran 2).
- Événements : `ui.clic`, `session.debut`.

---

## 2. CONFIG — configuration des règles (style écran de setup rétro)

```
┌──────────────────────────────────────────────────────┐
│  ◀ RETOUR                C O N F I G                 │
│  ════════════════════════════════════════════════    │
│  MODE .............  ◀   2 JOUEURS        ▶          │
│  TEMPO (att.=déf.) .  ◀   NORMAL (15 s)   ▶          │
│     durée [— 15 s +]   (curseur borné 5–60 si PERSO) │
│  RYTHME DE CALCUL .  ◀   DIFFÉRÉ          ▶          │
│  PV ...............  ◀   100              ▶          │
│  NIVEAU DE CALCUL .  ◀   INTERMÉDIAIRE    ▶          │
│  DIFFICULTÉ IA ....  ◀   MOYEN            ▶          │
│  ════════════════════════════════════════════════    │
│      [ RÉINITIALISER ]        [ V A L I D E R ]      │
└──────────────────────────────────────────────────────┘
```

- Chaque ligne se règle avec les flèches **◀ ▶** façon écran de setup de borne :
  - **MODE** : SOLO vs IA / 2 JOUEURS ;
  - **TEMPO (attaque = défense)** : RAPIDE (10 s) · NORMAL (15 s) · LONG (25 s) ·
    PERSONNALISÉ (curseur 5–60 s) — **même durée pour l'attaque et la défense** ;
  - **RYTHME DE CALCUL** : **DIFFÉRÉ** (une zone active à la fois) /
    **SIMULTANÉ** (les deux joueurs sur le même chrono) — c'est **la configuration
    choisie qui s'applique** ;
  - **PV** : 10–999 (défaut 100) ;
  - **NIVEAU** : DÉBUTANT / INTermédiaire / AVANCÉ ;
  - **DIFFICULTÉ IA** : FACILE / MOYEN / DIFFICILE.
- **VALIDER** = enregistre (`ui.validation`) et retour au lancement ;
  **RÉINITIALISER** = valeurs par défaut. Bornes appliquées à la validation (I9).

---

## 3. Sélection des personnages (après RUN)

```
┌──────────────────────────────────────────────────────┐
│  ◀ RETOUR           S É L E C T I O N                │
│                                                      │
│   J1 :  [ ◀ perso A ▶ ]   niveau : INTermédiaire     │
│                                                      │
│   J2 :  [ ◀ perso A ▶ ]   niveau : INTermédiaire     │
│          (IA : difficulté MOYEN, règle de CONFIG)    │
│                                                      │
│            [ ▶  L A N C E R   L E   C O M B A T  ]   │
└──────────────────────────────────────────────────────┘
```

- Solo : J2 = IA (niveau calé sur J1, difficulté issue de CONFIG).
- 2 joueurs : chaque joueur choisit son personnage.
- Événements : `ui.clic`, `session.debut`.

---

## 4. Combat — phase d'ATTAQUE (J1 attaque, J2 défend) — rythme DIFFÉRÉ

```
┌──────────────────────────────────────────────────────────────────┐
│ ♥♥♥♥♥♥♥♥♥♥♥♥░░  J1   ⏱ 12s   ATTAQUE ×   J2  ░░░░░░░░♥♥♥♥♥♥♥♥ │  ← HUD
│  ████████ 82 PV   énergie en cours : +5       94 PV █████████   │
│─────────────────────────────────────────┬────────────────────────│
│  ZONE J1 (ACTIVE)  ▶ ATTAQUE            │  ZONE J2 (EN VEILLE)  │
│  ┌────────┬────────┬─────────┐          │  ┌────────────────────┐│
│  │FACILE  │ MOYEN  │DIFFICILE│          │  │  (zone de défense  ││
│  │  +1    │  +3    │   +7    │          │  │   au tour suivant) ││
│  │ 5 × 3 ?│ 4 × 7 ?│ 8 × 8 ?  │          │  └────────────────────┘│
│  └────────┴────────┴─────────┘          │                         │
│  ┌────┬────┬────┐   énergie +1 +3 ⚡     │                         │
│  │ 1  │ 2  │ 3  │                       │                         │
│  │ 4  │ 5  │ 6  │                       │                         │
│  │ 7  │ 8  │ 9  │                       │                         │
│  │ ⌫  │ 0  │ C  │                       │                         │
│  └────┴────┴────┘                       │                         │
│  [     V A L I D E R     ]              │                         │
│─────────────────────────────────────────┴────────────────────────│
│  ⚡aura⚡  [combattant J1]        vs        [combattant J2]  garde │
│      particules, ondes                     prêt, encaisse         │
└──────────────────────────────────────────────────────────────────┘
```

- Les **3 calculs au-dessus de J1** (zone active surlignée) ; zone J2 en veille.
- **Clavier de J1 aligné à gauche** (bord extérieur de l'écran), sous sa main.
- Tap sur un calcul = le sélectionner (glow) ; la saisie au **clavier de J1** le
  résout. **Valider** évalue (`ui.validation`) ; **⌫/C** corrigent sans pénalité.
- Réussite → impulsion d'aura + compteur d'énergie ; **seul le calcul résolu est
  remplacé**. Erreur → « Faux ! », le calcul reste.
- **En Solo** : la zone IA reste en veille mais **son aura monte en temps réel**
  (énergie de l'IA en cours) ; son score n'est révélé qu'à la résolution.
- Événements : `math.genere`, `ui.saisie`, `ui.validation`, `math.reponse`,
  `combat.phase`.

---

## 5. Combat — phase de DÉFENSE (J2 défend, J1 attend) — rythme DIFFÉRÉ

```
┌──────────────────────────────────────────────────────────────────┐
│ ♥♥♥♥♥♥♥♥♥♥░░░░  J1   ⏱ 12s   DÉFENSE ÷   J2  ████████░░ 94 PV  │
│  ████████ 79 PV   défense en cours : +6        94 PV █████████   │
│────────────────────────┬─────────────────────────────────────────│
│  ZONE J1 (EN VEILLE)   │  ZONE J2 (ACTIVE) ▶ DÉFENSE ÷           │
│  ┌────────────────────┐ │          ┌────────┬────────┬─────────┐ │
│  │ (prochaine attaque │ │          │FACILE  │ MOYEN  │DIFFICILE│ │
│  │  au tour suivant)  │ │          │  +1    │  +3    │   +7    │ │
│  └────────────────────┘ │          │ 30 ÷ 5 ?│ 72 ÷ 8 ?│ 56 ÷ 7 ?│ │
│                          │          └────────┴────────┴─────────┘ │
│                          │                  défense +1 +3 ⚡      │
│                          │                  ┌────┬────┬────┐     │
│                          │                  │ 1  │ 2  │ 3  │     │
│                          │                  │ 4  │ 5  │ 6  │     │
│                          │                  │ 7  │ 8  │ 9  │     │
│                          │                  │ ⌫  │ 0  │ C  │     │
│                          │                  └────┴────┴────┘     │
│                          │                  [  V A L I D E R  ]  │
│──────────────────────────┴────────────────────────────────────────│
│  [combattant J1]  garde        vs   ⚡aura⚡ [combattant J2]       │
└──────────────────────────────────────────────────────────────────┘
```

- Miroir de l'écran 4 : les **3 divisions au-dessus de J2** (défenseur) ;
  **clavier de J2 aligné à droite** (bord extérieur).
- L'aura monte du côté du **défenseur** (énergie de défense = potentiel de contre).

---

## 4bis. Mode SIMULTANÉ (les deux zones actives, un seul chrono)

```
┌──────────────────────────────────────────────────────────────────┐
│ ♥♥♥♥♥░░░░  J1  ⏱ 9s (CHRONO UNIQUE)  ATTAQUE×/DÉFENSE÷  J2 ░░♥♥♥│
│──────────────────────────────────────────────────────────────────│
│  ZONE J1 (ACTIVE) ▶ ATTAQUE ×          ZONE J2 (ACTIVE) ▶ DÉFENSE ÷
│  ┌────────┬────────┬─────────┐        ┌────────┬────────┬────────┐
│  │FACILE  │ MOYEN  │DIFFICILE│        │FACILE  │ MOYEN  │DIFFICILE│
│  │ 5 × 3 ?│ 4 × 7 ?│ 8 × 8 ?  │        │ 30 ÷ 5 ?│ 72 ÷ 8 ?│56 ÷ 7 ?│
│  └────────┴────────┴─────────┘        └────────┴────────┴────────┘
│  ┌────┬────┬────┐  én. cum. 4          déf. cum. 6 ┌────┬────┬────┐
│  │ 1  │ 2  │ 3  │                                │ 1  │ 2  │ 3  │
│  │ 4  │ 5  │ 6  │                                │ 4  │ 5  │ 6  │
│  │ 7  │ 8  │ 9  │                                │ 7  │ 8  │ 9  │
│  │ ⌫  │ 0  │ C  │                                │ ⌫  │ 0  │ C  │
│  └────┴────┴────┘                                └────┴────┴────┘
│  [  V A L I D E R  ]                        [  V A L I D E R  ]  │
│──────────────────────────────────────────────────────────────────│
│   ⚡ [combattant J1]           vs            [combattant J2] ⚡    │
└──────────────────────────────────────────────────────────────────┘
```

- Les **deux zones sont actives en même temps**, chacune avec ses 3 calculs et son
  clavier ; **un seul chrono** partagé (la phase se termine pour les deux au même
  instant, puis résolution).
- **Clavier J1 aligné à gauche, clavier J2 aligné à droite** (bords extérieurs).
- Ce mode s'applique parce qu'il est **choisi dans CONFIG** : la **taille de l'écran
  n'est que le *pourquoi*** du réglage (la motivation) ; **la configuration choisie
  est la réponse** — aucune adaptation automatique.

---

## 6. Résolution du coup

```
│──────────────────────────────────────────────────────────────────│
│  ⚔ RÉSOLUTION :  attaque 12  −  défense 15  =  −3  →  CONTRE !  │
│──────────────────────────────────────────────────────────────────│
│        [J1 frappe tier 2]  ⚡💥      [J2 parade → riposte]        │
│              recule : −3 PV        « CONTRE-ATTAQUE »  flottant  │
│                                       ‹‹‹ ‹ ‹−3› ›››             │
│──────────────────────────────────────────────────────────────────│
│  ♥ 79 PV J1            tour suivant ▶ J2 attaque, J1 défend      │
└──────────────────────────────────────────────────────────────────┘
```

- Trois issues visuelles : **encaissement** (solde > 0, dégâts flottants = solde),
  **blocage parfait** (solde = 0, étincelles « ting »), **contre** (solde < 0,
  parade puis riposte animée, dégâts `|solde|` sur l'attaquant).
- Événements : `combat.coup_resolu`, `anim.frappe_tier`, `anim.garde`,
  `anim.contre`, `ui.timer_fin`.

---

## 7. K.O. et écran de fin

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                    ★  K.O.  ★                        │
│            [chute animée + flash + ralenti]           │
│                                                      │
│              🏆  JOUEUR 1  GAGNE  🏆                  │
│                                                      │
│   PV restants : 79      tours joués : 6              │
│   calculs résolus : 23  meilleure série : 7          │
│   contre-attaques : 2   énergie max : 21 (tier 4)    │
│                                                      │
│            [ REJOUER ]     [ MENU ]                  │
└──────────────────────────────────────────────────────┘
```

- Événements : `combat.ko`, `session.fin`. Statistiques tirées des logs de session.

---

## Règles de mise en page transverses

- Tactile d'abord : cibles ≥ 48 px, zones de saisie larges (le clavier occupe la
  largeur de la moitié d'écran du joueur).
- **Claviers alignés vers l'extérieur** : zone gauche (J1) = clavier **aligné à
  gauche** ; zone droite (J2) = clavier **aligné à droite** — chacun plaqué contre
  son bord d'écran, sous la main du joueur concerné.
- La **zone active** est surlignée (bordure/lueur) ; la zone en veille est atténuée.
- L'arène reste visible en permanence sous les zones de calcul (§2.8).
- Aucun élément ne masque les barres de vie ni le timer.
- **Rythme de calcul** : déterminé **uniquement par la configuration choisie**
  (défaut DIFFÉRÉ). La taille de l'écran n'est que la **motivation** du réglage
  (le *pourquoi*) ; **la configuration choisie est la réponse** — aucune adaptation
  automatique selon l'écran.
- Écrans 1–2 en style rétro assumé (fonte pixel, cadre, commandes ◀ ▶, clignotement
  du bouton RUN) ; écrans de jeu en style moderne (animations fluides).
- Version web de debug : même mise en page, **touches physiques mappées par
  `event.code`** (§2.7) — jeux strictement disjoints :
  **J1 = ligne de chiffres principale** (`0`–`9`, `Entrée`, `Retour arrière` = ⌫,
  `Échap` = C) ; **J2 = pavé numérique** (`Numpad0`–`Numpad9`, `NumpadEntrée`,
  **touche décimale** = ⌫, `Suppr` = C). En duel SIMULTANÉ les deux jeux sont actifs
  simultanément : la disjonction des `code` est ce qui empêche une frappe d'atteindre
  la console de l'autre joueur.
