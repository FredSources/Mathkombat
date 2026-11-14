# Journal — MathKombat

Journal des choses produites. **Une entrée par session de travail**, ajoutée jamais
remplacée. Format imposé : en-tête daté + Produits / Décisions / Tests / Anomalies /
Prochaine étape.

---

## 2026-11-12 — Jalon J0 — Initialisation du projet

### Produits

| Fichier | Rôle |
|---------|------|
| `AGENTS.md` | Source de vérité : objectif, gameplay, stack, isolation, conventions, roadmap J0→J8 |
| `README.md` | Présentation courte + démarrage rapide |
| `docs/architecture.md` | Protocole de log par socket (WS + TCP brut), format JSONL, modes DEBUG/RELEASE |
| `docs/test-plan.md` | Plan de test pilotable : niveaux L0→L5, invariants I1→I10, scénarios S01→S10, tests T01→T05, E2E E01→E04, grille APK M01→M07 |
| `journal.md` | Ce journal |
| `todo.md` | Tâches et planification |
| `scripts/env.sh` | Ancrage isolation : tous les chemins/caches ancrés dans le projet |
| `scripts/setup-sdk.sh` | Installation de `tools/` (SDK Android + Gradle + JDK portable, copie locale) |
| `scripts/log-collector.js` | Serveur socket de collecte des logs (zéro dépendance, WS + TCP brut, sortie JSONL) |
| `scripts/ws-probe.mjs` | Sonde WS/TCP pour smoke tests |
| `scripts/smoke.sh` | Vérifications L0 pilotables |
| `game/src/core/logger.ts` | Logger client (socket + console, file tampon), no-op compilé en RELEASE |
| `tools/` | SDK Android (platform 34, build-tools 34.0.0), Gradle 8.10.2, JDK javac 21 — 949 Mo embarqués |

### Décisions

- Stack : Phaser 3 + TypeScript + Vite (debug navigateur, animations, fluidité), APK
  via wrapper WebView Kotlin, build local (Termux) et PC (Android Studio).
- Isolation totale : SDK Android, Gradle et JDK **embarqués** dans `tools/` ; seul
  prérequis système : `bash` + `node`.
- Gameplay figé dans `AGENTS.md` §2 : attaque = multiplications (+1/+3/+7), défense =
  divisions, contre-attaque sur solde négatif, niveaux adaptatifs 1-5 / 1-10 / 1-15.
- Observabilité : évacuation des logs par socket (WS navigateur + TCP brut) vers un
  collecteur écrivant `output/logs/<session>.jsonl` ; mode RELEASE = zéro log, zéro socket.

### Tests

- **L0 smoke : PASS** (`bash scripts/smoke.sh`, artefact `output/logs/smoke-l0.jsonl`) :
  collecteur démarré et en écoute ; handshake WebSocket vérifié (Sec-WebSocket-Accept) ;
  ping → pong OK ; 5/5 enregistrements reçus (3 via WebSocket, 2 via TCP brut) ;
  fichier JSONL conforme (champs obligatoires présents) ; les 5 événements de sonde
  (`smoke.ws_1..3`, `smoke.tcp_1..2`) présents.
- **Installation `tools/` : OK** (`bash scripts/setup-sdk.sh`) : SDK Android 457 Mo
  (platform android-34 + build-tools 34.0.0), Gradle 8.10.2 (146 Mo), JDK portable
  javac 21.0.13 (347 Mo) — vérifications binaires vertes. Total : 949 Mo.
- L1/L2 : non applicables (moteurs de jeu non encore écrits — jalons J2/J3).

### Anomalies

Trouvées par le smoke test L0 puis corrigées (le smoke test en est le test de non-régression) :

1. `log-collector.js` : `parserTrames()` ne retournait pas la liste des trames
   (TypeError → crash du collecteur au premier message WebSocket). Corrigé.
2. `ws-probe.mjs` : séquence de close rejouée sur la trame de fermeture du serveur
   (« write after end »). Garde par drapeau `fini`. Corrigé.
3. `smoke.sh` : `$1` non borné sous `set -u` sans argument. Corrigé.
4. `setup-sdk.sh` : répertoire vide pré-créé par `env.sh` interprété comme « déjà
   installé » ; chemin source du Gradle erroné (`tools/gradle-8.10.2` au lieu de
   `tools/gradle/gradle-8.10.2`). Corrigés.

### Prochaine étape

- Jalon **J1** : scaffold Vite + Phaser, scène de combat squelette, `npm run dev`
  jouable, build web (`scripts/build.sh`). Voir `todo.md`.

---

## 2026-11-12 — Révision gameplay — Rendement maximal + divisions à 3 niveaux

### Produits

- `AGENTS.md` §2.2/§2.3/§2.5 révisés (spécification de référence).
- `docs/test-plan.md` : invariant **I11** ajouté (matrice difficulté × niveau,
  nombre de calculs non plafonné), S01 enrichi.
- `todo.md` : tâche J2 précisée.

### Décisions

- **Philosophie « rendement maximal »** : suppression du plafond de calculs par phase
  (ex-5 attaque / 4 défense). Le but est d'enchaîner un **maximum de multiplications
  (attaque) ou de divisions (défense) réussies dans un minimum de temps** — rythme
  libre, 15 s attaque / 10 s défense, 5 s par calcul (raté = 0, enchaînement immédiat).
  Plus la cadence est élevée, plus la puissance du coup (ou le potentiel de
  contre-attaque) est grande.
- **Divisions à 3 niveaux de difficulté** comme les multiplications :
  Facile +1, Moyen +3, Difficile +7 points de défense.
- **Matrice difficulté × niveau** figée dans `AGENTS.md` §2.5 (sous-plages
  d'opérandes par niveau : Débutant ≤ 5, Intermédiaire ≤ 10, Avancé ≤ 15) pour
  rendre la génération non ambiguë en J2.

### Tests

- Documentation seule (aucun code impacté — moteurs non encore écrits) ;
  smoke L0 toujours vert. Impact test : I11 ajouté, appliqué en J2 (S01).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 2 — 3 calculs simultanés, cadence libre, aucun timer par calcul

### Produits

- `AGENTS.md` §2.2/§2.3 réécrits (mécanique des 3 calculs simultanés).
- `docs/test-plan.md` : I4 et I9 reformulés, **I12** ajouté (remplacement du seul
  calcul résolu), scénario **S11** ajouté.
- `todo.md` : tâche J4 (quiz overlay) reformulée.

### Décisions

- **Aucun timer par calcul** : seule la durée de phase compte (15 s attaque / 10 s
  défense). Un joueur lent est pénalisé naturellement (moins de calculs résolus =
  coup moins puissant / contre plus faible).
- **3 calculs proposés simultanément** (un par difficulté, gains **+1 / +3 / +7**
  affichés) : le joueur choisit librement quel calcul résoudre et dans quel ordre.
- **Le calcul ne change qu'à la résolution** : réussite → gain + remplacement du seul
  calcul résolu par un nouveau de même difficulté ; **erreur → retour « Faux ! » mais
  le calcul reste** tel quel et retentable, aucune pénalité hormis le temps perdu.
- S'applique symétriquement aux divisions (défense) et multiplications (attaque).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I4/I9 reformulés,
  I12 + S11 ajoutés (appliqués en J2/J4).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 3 — Mise en scène : aura Dragon Ball, frappe graduée, contre animé

### Produits

- `AGENTS.md` : nouvelle **§2.8 « Mise en scène — animations »** (chargement d'aura
  façon Ki/DBZ, tiers de frappe, défense simultanée avec/sans contre, K.O.) ;
  §2.7 ajusté (zone de spectacle sous les calculs).
- `docs/architecture.md` : événements **`anim.*`** ajoutés à la nomenclature.
- `docs/test-plan.md` : invariant **I13** (intensité d'animation = fonction
  déterministe de la puissance, dans `config.ts`) ; E2E **E05** ajouté.
- `todo.md` : J5 enrichi (8 tâches d'animation détaillées).

### Décisions

- **Aura de chargement** sous les calculs : intensité croissante avec l'énergie en
  temps réel (4 paliers 0-25/25-50/50-75/75-100 %), impulsion par calcul réussi,
  micro-gêne sur erreur sans baisser l'aura.
- **Frappe graduée en 4 tiers** (énergie 1–5 / 6–12 / 13–20 / 21+) : léger →
  surpuissant (ralenti, flash plein écran, onde de choc).
- **Défense simultanée** (jamais séquentielle) : encaissement (solde > 0),
  blocage parfait (solde = 0), **parade → contre-attaque animée** (solde < 0,
  dégâts |solde| sur l'attaquant).
- Toute intensité d'animation est **déterministe et paramétrée** dans `config.ts`
  (I13) : testable, jamais décidée dans le code d'animation.
- Animations non bloquantes (temps de jeu, tweens en arrière-plan).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I13 + E05 ajoutés
  (appliqués en J5).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 4 — Barre de vie explicite

### Produits

- `AGENTS.md` §2.4 : règle de la barre de vie formalisée (100 PV, **tout dégât
  retranché à la barre de vie** du joueur concerné — solde positif comme
  contre-attaque ; décroissance animée, code couleur vert → orange → rouge) ;
  §2.7 : détail HUD de la barre de vie.
- `todo.md` : tâche J5/HUD précisée.

### Décisions

- Les dégâts n'affectent **que** la barre de vie (PV) : ni l'énergie, ni les scores
  de calcul. PV ≤ 0 → K.O. (règle inchangée, §2.1).

### Tests

- Documentation seule ; impact test : I5 (PV ≥ 0, K.O. unique) et E03 (PV mis à jour)
  couvrent déjà la règle — aucun ajout nécessaire.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 5 — Zone de calcul par joueur, alternance des rôles, opérations extensibles

### Produits

- `AGENTS.md` §2.1 : alternance stricte des rôles formalisée (attaquant → défenseur →
  attaquant…) et **zone de calcul par joueur** (les 3 calculs au-dessus du joueur
  concerné) ; §2.2/§2.3 : positionnement précisé (au-dessus de l'attaquant / du
  défenseur) ; §2.5 : **types de calculs** — v1 = × (attaque) et ÷ (défense),
  architecture abstraite par type d'opération pour **+ et −** (adaptation du niveau).
- `docs/test-plan.md` : invariant **I14** ajouté (périmètre v1 des opérations).
- `todo.md` : J2 enrichi (abstraction type d'opération) ; « Idées / dette » : + et −.

### Décisions

- Les 3 calculs s'affichent **au-dessus de chaque joueur** (zone dédiée, pas de
  panneau partagé) : au-dessus de l'attaquant pendant l'attaque (multiplications),
  au-dessus du défenseur pendant la défense (divisions).
- Alternance des rôles à chaque tour : l'attaquant devient défenseur puis redevient
  attaquant, jusqu'au K.O.
- **Extensibilité des opérations** : le générateur sera abstrait par type d'opération
  (addition, soustraction, multiplication, division) dès J2 ; seules × et ÷ sont
  actives en v1, + et − viendront adapter le niveau plus tard.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I14 ajouté (appliqué
  en J2) ; le catalogue S01-S11 couvre × et ÷.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 6 — Clavier numérique par joueur (Valider / Effacer)

### Produits

- `AGENTS.md` §2.2/§2.3 : saisie par **clavier numérique** (remplace les 4 réponses
  proposées) ; §2.5 : règle des leurres supprimée (saisie libre, réponse unique) ;
  §2.7 : spécification du **clavier par joueur** (0–9, Effacer simple/long/C, Valider,
  évaluation à la validation, touches physiques en web debug).
- `docs/test-plan.md` : **I8** réécrit (règles de saisie), S01 ajusté, E02 enrichi
  (erreur de saisie corrigée par Effacer).
- `docs/architecture.md` : événements `ui.saisie`, `ui.validation`, `ui.effacement`.
- `todo.md` : tâche `ui/numpad.ts` ajoutée (J4) ; quiz overlay ajusté.

### Décisions

- **Clavier numérique dédié par joueur** (zone J1 / zone J2 ; un seul actif en Solo) :
  chiffres 0–9 + **Effacer** (appui simple = un chiffre, appui long ou « C » = tout)
  + **Valider**.
- La saisie n'est **évaluée qu'à Valider** ; **Effacer** corrige une erreur de saisie
  **sans pénalité** ; Valider sur saisie vide = ignoré.
- Conséquence : plus de génération de leurres (les 4 propositions disparaissent) —
  la réponse est saisie librement, unique par énoncé.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I8 réécrit (appliqué
  en J4) ; E02 couvre désormais la correction de saisie.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 7 — Deux touches d'effacement distinctes

### Produits

- `AGENTS.md` §2.7 : le clavier numérique comporte **deux touches d'effacement
  distinctes** — **⌫ Effacer** (supprime le dernier chiffre, répétable) et
  **C Tout effacer** (vide la saisie entière) — plus **Valider**.
- `docs/test-plan.md` : I8 ajusté ; `todo.md` : tâche `ui/numpad.ts` ajustée.

### Décisions

- Remplace la gestion « appui long » précédente : deux boutons explicites, plus
  clairs au tactile et testables. Règles inchangées : évaluation à la validation,
  effacement sans pénalité, saisie vide + Valider = ignoré.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I8 (J4), E02.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 8 — Tempo de tour configurable + pitch + wireframes

### Produits

- `AGENTS.md` : nouvelle **§2.9 « Paramètres configurables »** (temps d'attaque 15 s
  et de défense 10 s par défaut, bornes 5–60 s, presets de tempo, validation à la
  lecture) ; §2.2/§2.3 adaptés.
- `docs/test-plan.md` : **I9** reformulé (durations configurables), E2E **E06**
  ajouté (tempo respecté), M05 corrigé (paysage et non portrait).
- `docs/pitch.md` : pitch court (30 s), pitch long (concept, expérience, tension,
  cible, différenciation), résumé exécutif.
- `docs/wireframes.md` : wireframes textuels écran par écran (7 écrans + règles de
  mise en page).
- `README.md` : table de documentation complétée ; `todo.md` : tâche Options (J6).

### Décisions

- **Le temps d'un tour est configurable** (= phase d'attaque + phase de défense) :
  presets **Rapide (10/8)**, **Normal (15/10)**, **Long (25/15)** ou personnalisé
  (5–60 s), réglables dans `config.ts` et en jeu ; bornes validées à la lecture.
- L'écran de jeu est en **paysage** (M05 ajusté en conséquence).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I9 (J2/J6), E06 (J6).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 9 — Écran de lancement rétro RUN/CONFIG

### Produits

- `docs/wireframes.md` : écrans 1–3 refondus — **écran de lancement style borne
  d'arcade** (bouton **RUN clignotant au-dessus**, bouton **CONFIG au-dessous**,
  « INSERT COIN »), **écran CONFIG des règles** (commandes ◀ ▶ façon setup rétro :
  mode, tempo, PV, niveau, difficulté IA — VALIDER / RÉINITIALISER), sélection des
  personnages après RUN.
- `AGENTS.md` §2.7 : écrans de lancement et CONFIG ajoutés.
- `docs/test-plan.md` : E01/E06 ajustés ; `todo.md` : 2 tâches J6 ; `README.md` : table.

### Décisions

- Ambiance « anciens jeux » assumée sur les écrans d'entrée (fonte pixel, cadre,
  clignotement du RUN) ; écrans de jeu en style moderne.
- RUN = lancer avec les règles déjà enregistrées ; CONFIG = régler les règles
  (dont le tempo de tour, cf. §2.9) avant de jouer.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : E01/E06 (J6).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Révision gameplay 10 — Durée unique attaque = défense, rythme de calcul configurable

### Produits

- `AGENTS.md` §2.1 : **rythme de calcul configurable** — **DIFFÉRÉ** (défaut :
  phases attaque puis défense enchaînées, une zone active à la fois, adapté aux
  petits écrans) / **SIMULTANÉ** (les deux joueurs calculent ensemble sur le **même
  chrono**, grands écrans) ; §2.2/§2.3 : **même durée pour l'attaque et la défense** ;
  §2.7/§2.9 : ligne « Rythme de calcul » + tempo à valeur unique.
- `docs/wireframes.md` : écran CONFIG mis à jour (tempo unique + rythme) ; nouvelle
  **variante « 4bis » mode SIMULTANÉ** (deux zones actives, un chrono) ; règle de
  mise en page liée à la **taille d'écran**.
- `docs/test-plan.md` : I9 réécrit (durée unique + rythme), **I15** ajouté (même
  chrono en simultané / mêmes durées en différé), E06 ajusté, **E07** ajouté.
- `todo.md` : tâche écran CONFIG ajustée.

### Décisions

- **Un seul temps de phase** (défaut 15 s, bornes 5–60 s) s'applique **aussi bien à
  l'attaque qu'à la défense** (fin des durées 15/10 distinctes) — presets Rapide 10 s,
  Normal 15 s, Long 25 s.
- **Le rythme est configurable** à cause de la taille de l'écran disponible :
  **DIFFÉRÉ par défaut** (petits écrans : une zone de calcul à la fois, plus lisible),
  **SIMULTANÉ** pour les grands écrans (les deux joueurs sur le même chrono).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I9/I15 (J2/J4/J6),
  E06/E07 (J6).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Clarification 11 — Le rythme vient de la configuration, pas de l'écran

### Produits

- `AGENTS.md` §2.1/§2.9, `docs/wireframes.md` (4bis + règles transverses + CONFIG),
  `docs/test-plan.md` (I15) : formulations corrigées.

### Décisions

- **La taille de l'écran n'est que le *pourquoi*** du réglage de rythme (la
  motivation : deux joueurs côte à côte demandent de la place) ;
  **la configuration choisie est la *réponse*** : le jeu applique **toujours** le
  rythme sélectionné (CONFIG ou `config.ts`), **sans aucune adaptation automatique**
  selon l'écran.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). I15 précisé.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Clarification 12 — Alignement des claviers vers l'extérieur

### Produits

- `docs/wireframes.md` : écrans 4, 5 et 4bis redessinés avec **clavier de la zone
  gauche (J1) aligné à gauche** et **clavier de la zone droite (J2) aligné à droite**,
  chacun plaqué contre son bord d'écran ; règle ajoutée aux règles transverses.
- `AGENTS.md` §2.7 : règle d'alignement ajoutée.

### Décisions

- Alignement ergonomique : chaque clavier est sous la **main extérieure** du joueur
  concerné (bord gauche pour J1, bord droit pour J2), dans les deux rythmes
  (DIFFÉRÉ et SIMULTANÉ).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : E05 (captures).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Check de cohérence — audit critique/ingénieur + arbitrages

### Produits

- Audit de cohérence complet des documents (AGENTS, test-plan, architecture,
  wireframes, pitch, README, journal, todo) sous deux profils : critique puis
  ingénieur correcteur.
- **17 incohérences relevées (C1→C17)**, **15 corrigées directement**, **2 arbitrées
  par l'utilisateur**, + 1 principe ajouté (« IA gentille »).

### Corrections (profil ingénieur)

- C1/C2 : l'unité configurable est la **durée de phase** ; durée du tour dérivée
  (DIFFÉRÉ = 2 × phase, SIMULTANÉ = 1 × phase) ; « Fin des 15 s » → « fin du temps
  de phase ».
- C3 : §2.1 reformulé pour les deux rythmes (zones actives, rôles).
- C4 : références remises à jour partout (invariants I1→I16, scénarios S01→S12).
- C6 : plafond visuel de l'aura défini (`energieVisuelleMax`, défaut 30 — visuel
  seul, l'énergie de jeu reste non plafonnée).
- C7 : **tier 0** ajouté (whiff : coup manqué, aucun impact) ; C17 : cas whiff vs
  défense 0 précisé.
- C9 : « repli TCP » corrigé → file tampon + reconnexion côté jeu (TCP brut =
  sondes/clients non-navigateur).
- C10 : `pitch.md` → « paysage verrouillé » (cohérent avec M05).
- C11 : journal renuméroté (« Clarification 12 »).
- C12 : S01 ne dépend plus de I7 ; C13 : arborescence complétée (pitch, wireframes) ;
  C14 : difficulté IA = `config.ts` + CONFIG ; C15 : saisie bornée à 3 chiffres
  (0–225), abandonnée en fin de phase ; C16 : §2.6 reformulé.

### Arbitrages utilisateur

- **C5 (matrice Débutant/Difficile)** : retenu « **élargir + assouplir la règle** » —
  Difficile/Débutant = 5 × 1–5 (5 questions possibles) et non-répétition « sauf
  impossibilité ».
- **C8 (phases de l'IA)** : retenu « **IA sur le chrono, aura visible** » — l'IA
  joue sur la même durée de phase, son énergie s'accumule progressivement et est
  visible via son aura, zone en veille, score révélé à la résolution.

### Décision complémentaire — « IA gentille : suspense + possibilité de gagner »

- L'IA **ne maximise jamais sa cadence** et **reste battable à toute difficulté** :
  rendement plafonné (`iaRendementMax`, défaut 70 % de la cadence humaine de
  référence) + **rattrapage doux** (écart > `ecartSuspense` PV → rendement en baisse).
- Taux de victoires humaines visés (calibrage J8) : **Facile ≈ 80 %, Moyen ≈ 50 %,
  Difficile ≈ 30 %**. Invariant **I16** + scénario **S12** (winnability, 200 combats
  simulés par difficulté).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I16, S12 ajoutés
  (appliqués en J3/J8) ; S09 inchangé.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Calibrage pédagogique — méthode CM2 sur les tables intégrée

### Produits

- `AGENTS.md` §2.5 réécrit : **difficulté = familles de tables** 🟢 × 1/2/5/10 (vert) ·
  🟡 × 3/4/6/8/9 (jaune, déductibles) · 🟠 × 7 + **5 faits résistants** (6×7, 6×8,
  7×7, 7×8, 8×8) ; **niveaux = borne du second facteur / du quotient** : Débutant 1–5,
  Intermédiaire 1–10, **Avancé 1–12** (fin du « ≤ 15 » arbitraire) ; divisions par
  mêmes familles de diviseurs ; règle de commutativité (`a×b` = `b×a`, jamais deux
  formes d'un même fait à la suite).
- **Boîte à outils de déduction** intégrée (10 astuces par table + mnémotechnie
  `56 = 7 × 8`) — matière première du futur bouton « Indice ».
- **Ancrage pédagogique** intégré : erreur = indice (déjà appliqué), chrono contre
  son propre score, pas de chrono en entraînement.
- `docs/test-plan.md` : I6 (bornes 5/10/12), I8 (réponses 0–144), I11 (familles)
  mis à jour. `docs/wireframes.md` : exemples de calculs corrigés selon les familles
  (`5 × 3`, `4 × 7`, `8 × 8`, `30 ÷ 5`, `72 ÷ 8`, `56 ÷ 7`).
- `todo.md` : nouvelles idées — **Mode Entraînement sans chrono**, **record
  personnel**, **bouton « Indice »** ; tâche J2 reformulée.

### Décisions

- Le document source (plan de méthode CM2 sur les tables de multiplication) est
  **consolidé dans la documentation** puis supprimé : le projet n'en dépend plus
  (aucune référence hors journal).
- Le calibrage des difficultés suit désormais le **vécu de l'élève** (familles du
  tableau de Pythagore coloré) plutôt que la taille des nombres.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I6/I8/I11 (J2),
  S01-S03 inchangés (oracles mis à jour).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Check de cohérence 2 — modèles de difficulté et définitions

### Produits

- Second audit critique/ingénieur (4 findings K1→K4) post-recalibrage.
- **K2 corrigé** : définitions concrètes ajoutées — `cadenceHumaineReference` =
  1 calcul réussi / 3 s ; « joueur de référence » (S12) = profil simulé à cette
  cadence avec 85 % de réussite (`AGENTS.md` §2.9, S12).
- **K3 corrigé** : formulation des faits résistants (« dès que la borne du niveau
  le permet »). **K4 corrigé** : wireframes 4bis « én. cum. 4 / déf. cum. 6 ».
- **K1 arbitrée par l'utilisateur** : retenue l'option « **table la plus facile +
  repli Débutant** ».

### Décisions

- **Classement d'un fait par la couleur de sa table la plus facile** (commutativité :
  `2×7` = fait « × 2 » 🟢) — cohérent avec le document source et avec la règle
  `a×b = b×a`.
- 🟢 Facile : au moins un facteur ∈ {1, 2, 5, 10} · 🟡 Moyen : sinon facteur
  ∈ {3, 4, 6, 8, 9, 11, 12} · 🟠 Difficile : les **5 faits résistants**, avec
  **repli Débutant** (`3×3`, `3×4`, `4×4` — résistants impossibles à la borne 5).
- Les **divisions** prennent la couleur du fait sous-jacent (diviseur × quotient) :
  `30 ÷ 5` 🟢, `72 ÷ 8` 🟡, `56 ÷ 7` 🟠.

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : I11 réécrit (J2),
  S01-S03 inchangés ; pools de faits non vides à toute difficulté × niveau.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Méthode de production des images et sprites

### Produits

- `docs/assets.md` : chaîne de production complète des visuels — planche de
  référence (génération + édition par référence), déclinaison des 8 états,
  **méthode 1 « cut-out animé par tweens »** (privilégiée : pièces détachées
  animées par code, cohérence totale, fluide, léger), méthode 2 spritesheet
  frame-by-frame (dépannage, `montage` ImageMagick), règles de cohérence de
  génération, inventaire des assets (`game/assets/`), contrôle qualité.
- `AGENTS.md` §2.8 + arborescence : référence à `docs/assets.md` ;
  `README.md` : table complétée ; `todo.md` : tâches J5 reformulées.

### Décisions

- **Cut-out + tweens Phaser** plutôt que spritesheets frame-by-frame : une seule
  génération par personnage (la cohérence frame à frame est la faiblesse des
  générateurs), animation fluide 60 fps, retouches par pièce.
- Effets (aura, particules, flashs, dégâts flottants) **générés par le code** :
  zéro asset.
- Chaîne outillée et vérifiable : génération/édition par référence → PIL/ImageMagick
  (découpe, fond, tailles, `montage`) → lecture visuelle par l'agent → captures
  `output/screenshots/` (E05).

### Tests

- Documentation seule ; smoke L0 inchangé (vert). Impact test : contrôle qualité
  asset par asset (§7 de `docs/assets.md`), captures E05 en J5.

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Test de génération d'image (validation de la chaîne assets)

### Produits

- `tmp/test-personnage.png` (1024×1536, PNG 8-bit sRGB, 1,5 Mo) : planche de
  personnage de test — combattant cartoon/BD bleu & or, corps entier, pose neutre,
  fond uni gris (découpable).

### Décisions

- La chaîne de `docs/assets.md` est **validée en conditions réelles** : génération,
  contrôle qualité visuel, métadonnées (identify). L'image est apte à servir de
  planche de référence cut-out en J5.
- Limite notée : style légèrement plus détaillé que « formes simples » — acceptable
  pour un jeu de combat, à surveiller pour la lisibilité mobile.

### Tests

- Contrôle qualité §7 appliqué : cadrage ✅, fond uni ✅, découpage des membres ✅,
  mains cohérentes ✅, sans texte ✅. Smoke L0 inchangé (vert).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Dépôt git — versionnement sans tools/

### Produits

- Dépôt git initialisé (`main`) — commit : sources, scripts, docs, `logger.ts`,
  journal, todo, `.gitignore`.
- `.gitignore` : `tools/` **non versionné**, plus caches (`.gradle-cache/`,
  `.npm-cache/`, `.tmp/`, `.xdg-cache/`) et artefacts (`tmp/`,
  `output/logs|reports|screenshots/`, sorties de build, `*.apk`).
- `scripts/setup-sdk.sh` **renforcé** : reconstitution de `tools/` par **copie
  locale** (rapide, hors-ligne) ou, en repli, **téléchargement officiel**
  (JDK Temurin 21, Gradle 8.10.2, cmdline-tools + `sdkmanager` → platform-34 /
  build-tools 34.0.0).
- `AGENTS.md` §4 : politique git documentée (dépôt léger, restaurable par le script).

### Décisions

- Premier commit initialisé **avec** `tools/` (autonomie totale) puis **repris sans**
  à la demande : `tools/` (949 Mo de binaires) n'est pas versionné — c'est
  `scripts/setup-sdk.sh` qui garantit la restitution. Le dépôt reste léger et le
  projet autonome.

### Tests

- Smoke L0 inchangé (vert) après réécriture de `setup-sdk.sh` (le chemin copie
  locale reste celui exécuté sur cette machine).

### Anomalies

- Néant.

### Prochaine étape

- Inchangée : jalon **J1** (scaffold web).

---

## 2026-11-12 — Jalon J1 — Scaffold web (Vite + Phaser + scène de combat squelette)

### Produits

- `game/package.json` + `tsconfig.json` (TypeScript **strict**) + `vite.config.ts`
  (base relative pour l'APK futur, `__BUILD_MODE__` injecté debug/release).
- `game/index.html` + `game/src/main.ts` (bootstrap Phaser 1280×720, Scale.FIT).
- `game/src/scenes/BootScene.ts` + `game/src/scenes/FightScene.ts` — **scène de
  combat squelette** : arène provisoire (dégradé + sol), 2 combattants placeholder
  (J1 bleu, J2 orange), barres de vie animées (vert/orange/rouge, §2.4), HUD minimal
  (PV, chrono de phase, énergie), démo ESPACE = coup / R = réinitialiser.
- `scripts/build.sh` : typecheck + build web DEBUG/RELEASE → `game/dist/`.
- Dépendances installées **dans le projet** : phaser ^3.80, vite, typescript.

### Décisions

- Présentation uniquement dans `scenes/` (la logique métier viendra en J2/J3 dans
  `core/`), conforme à AGENTS §7.
- Les combattants sont des **placeholders graphiques** : les sprites cut-out
  (méthode `docs/assets.md`) remplaceront en J5.
- Logger branché dès maintenant (`session.debut`, `session.boot`, `combat.phase`,
  `ui.saisie`, `combat.coup_resolu` démo) — événements conformes à la nomenclature.

### Tests

- **Typecheck TypeScript strict** : ✅ 0 erreur.
- **`bash scripts/build.sh release`** : ✅ `game/dist/` (1,2 Mo).
- **`bash scripts/build.sh debug`** : ✅ (11 Mo, sourcemaps).
- **Dev server** : ✅ HTTP 200 sur `http://127.0.0.1:5173`.
- **Capture de validation** : ✅ `output/screenshots/j1-fight-skeleton.png` —
  2 combattants affichés, barres de vie, chrono, HUD lisibles (rendu headless
  chromium + SwiftShader).
- Smoke L0 : inchangé (vert).

### Anomalies

- Rendu headless : Chromium nécessite `--headless=new --use-angle=swiftshader`
  pour le WebGL (le mode `--headless` classique laissait un écran blanc) — à
  garder en tête pour l'E2E (J4) et les captures. Les captures headless génèrent
  des avertissements Phaser « Framebuffer Unsupported / WebGL Context lost »
  (SwiftShader), sans impact : le contexte est restauré et le rendu correct.
- Premier rendu : libellés PV chevauchant les barres → corrigé (libellés sous
  les barres) et revalidé par capture.

### Prochaine étape

- Jalon **J2** : moteur mathématique (`core/config.ts`, `core/math-generator.ts`,
  tests Vitest, `scripts/run-scenarios.mjs`).

---

## 2026-11-13 — Jalon J2 — Moteur mathématique

### Produits

- `game/src/core/config.ts` : **tout l'équilibrage centralisé** (PV 100, tempo 15 s,
  rythme différé, gains +1/+3/+7, bornes 5/10/12, familles 🟢{1,2,5,10} / 🟡{3,4,6,8,9,11,12} /
  🟠 5 résistants + repli Débutant, tiers de frappe, saisie 3 chiffres, cadence
  humaine de référence 3 s, IA gentille). Pur, testé.
- `game/src/core/math-generator.ts` : générateur adaptatif — **couleur du fait**
  (table la plus facile, commutativité), **repli Débutant** (3×3, 3×4, 4×4),
  **non-répétition** (même fait commutatif, sauf impossibilité), divisions
  exactes (dividende = quotient × diviseur, quotient borné), évaluation à la
  validation, gain 0 si non résolu, énergie de phase. Abstraction
  `TypeOperation` (addition/soustraction refusées en v1, I14).
- `game/tests/math-generator.test.ts` : **22 tests Vitest** (classement, pools,
  S01/S02/S03, garde-fous, chemins défensifs).
- `game/tests/scenarios/S01…S03.json` + `scripts/run-scenarios.mjs` : exécuteur
  de scénarios headless (Node type-stripping, zéro dépendance) → rapports
  `output/reports/scenarios-*.md`.
- `game/vitest.config.ts` + dépendances `vitest`, `@vitest/coverage-v8`.

### Décisions

- Cœur **pur** sans logger (les scènes logueront aux frontières, AGENTS §6) ;
  imports `import type` + extensions `.ts` explicites → le cœur est exécutable
  **directement par Node** pour les scénarios, sans build intermédiaire.
- Couverture ciblée sur le cœur maths (`config.ts`, `math-generator.ts`) —
  s'étendra à `combat-engine` / `ai-controller` en J3.

### Tests

- **Typecheck strict** : ✅ 0 erreur.
- **Vitest** : ✅ **22/22** — couverture **100 %** (45/45 statements, 42/42 branches,
  14/14 fonctions).
- **Scénarios headless** : ✅ S01 (2 700 vérif. I6/I11/non-répétition), S02
  (2 700 vérif. I7/I6/I11), S03 (I3/I4) — rapports `output/reports/`.
- **Smoke L0** : ✅ inchangé.

### Anomalies

- Node type-stripping refuse les *parameter properties* du constructeur et les
  imports de types en valeur — corrigés (champs classiques + `import type`) ;
  consigné dans les conventions d'écriture du cœur (syntaxe érasable uniquement).

### Prochaine étape

- Jalon **J3** : `core/combat-engine.ts` (phases, énergie, résolution,
  contre-attaque) + `core/ai-controller.ts` (IA gentille) + scénarios
  S04→S08, S10, S11.

---

## 2026-11-13 — Jalon J3 — Moteur de combat + IA « gentille »

### Produits

- `game/src/core/combat-engine.ts` :
  - `resoudreCoup()` — résolution pure (§2.4) : solde, dégâts, contre-attaque,
    bloqué (I1/I2) ;
  - `PhaseCalcul` — 3 calculs simultanés, remplacement du seul calcul résolu,
    erreur = calcul conservé (I4, I12), énergie non plafonnée (I3, I11) ;
  - `CombatEngine` — tours alternés (§2.1), PV bornés à 0, K.O. émis une seule
    fois puis combat verrouillé (I5), rythmes DIFFÉRÉ/SIMULTANÉ tracés (I15) ;
  - `tierFrappe()` / `palierAura()` — mise en scène déterministe (I13, §2.8).
- `game/src/core/ai-controller.ts` — **IA « gentille »** (§2.6, I16) : tentatives
  bornées par `rendementMax` (3 max vs 5 au joueur de référence → toujours
  battable), **rattrapage doux** au-delà de `ecartSuspense`, stratégie de choix de
  difficulté et taux de réussite paramétrés, événements `ia.choix_difficulte` /
  `ia.reponse`.
- `core/config.ts` : `ia.facteurRattrapage` + `ia.strategieChoix` ajoutés.
- Tests Vitest : `combat-engine.test.ts` + `ai-controller.test.ts` (**49 tests
  au total** avec J2) — couverture **100 %** du cœur (156/156 statements,
  100/100 branches).
- Scénarios `S04→S08`, `S10`, `S11` + types `resolution` / `phase` / `combat`
  dans `scripts/run-scenarios.mjs` (contrôle de nomenclature de trace compris).

### Décisions

- Le cœur reste **pur** : les traces sortent par un callback `emettre` que les
  scènes répercuteront vers le logger (règle AGENTS §5).
- Modèle IA : le **nombre de tentatives** dépend du rendement plafonné
  (indépendant de la difficulté), la **réussite** et le **choix des difficultés**
  en dépendent. Rendement IA max 21 d'énergie/phase vs 35 pour un joueur rapide :
  battable à toute difficulté.
- Syntaxe TS strictement **érasable** dans le cœur (compatible Node
  type-stripping) — incidents J2 évités.

### Tests

- **Typecheck strict** : ✅ 0 erreur.
- **Vitest** : ✅ **49/49** — couverture **100 %** cœur (config, math-generator,
  combat-engine, ai-controller).
- **Scénarios headless** : ✅ **S01→S08, S10, S11 verts** — dont S07 (alternance
  + PV cohérents), S08 (K.O. unique), S10 (bout en bout, trace conforme à la
  nomenclature §4 : 91/91), S11 (remplacement du seul calcul résolu : 15/15).
- **Smoke L0** : ✅ inchangé.

### Anomalies

- Deux écarts de tests corrigés en cours de route : comparaison d'énergie IA
  inéquitable (borne reformulée : plafond `tentativesMax × gain max` vs joueur
  rapide) et couverture du callback de trace de `PhaseCalcul.resoudre` (test
  ajouté). Aucune anomalie de produit.

### Prochaine étape

- Jalon **J4** : quiz jouable (`ui/quiz-overlay.ts`, `ui/numpad.ts`), boucle
  Solo vs IA de bout en bout, scénario S09, E2E E01→E03.

---

## 2026-11-13 — Jalon J4 — Quiz jouable (Solo vs IA de bout en bout)

### Produits

- `game/src/ui/quiz-overlay.ts` : 3 calculs simultanés (ciblage au tap, remplacement
  du seul calcul résolu, « Faux ! » sans changer le calcul — I4, I12).
- `game/src/ui/numpad.ts` : **console de saisie par joueur** — case d'affichage de
  la **valeur seule** (largeur = celle du clavier), chiffres 0–9, ⌫ un chiffre,
  C tout effacer, **3 boutons VALIDER colorés sous le clavier** (alignés sur les
  colonnes, un par calcul : « VALIDER +1 / +3 / +7 »), touches physiques web debug.
- `game/src/scenes/FightScene.ts` : **boucle complète Solo vs IA** — tours alternés,
  rythmes Différé/Simultané, quiz + clavier pour l'humain, **chrono immédiat IA**
  (score calculé d'avance, totalisé sur `ia.dureeChronoIA` = 3 s), résolution
  animée (bandeau, tier de frappe, barres de vie), K.O. + R, hook debug
  `window.__mathkombat` (état, questions, saisie, setTempsPhase, forceFinDePhase).
- `core/config.ts` : `ia.dureeChronoIA` ajouté.
- `scripts/e2e.mjs` : **E2E Puppeteer** (E01→E03) — saisies clavier réelles,
  captures `output/screenshots/e2e-*.png`, rapports `output/reports/e2e-*.md`.
- Scénario **S09** (taux de réussite IA ±10 pts / 200 tirages) + type `ia` du
  lanceur. Spécifications mises à jour (AGENTS §2.1/§2.6/§2.7, I8, I15, I16).

### Décisions (itérations de jouabilité validées en cours de route)

- **Un seul endroit d'affichage de la saisie** : la case du clavier montre la
  **valeur seule** (« 49 ») — elle ne correspond à un calcul qu'à la **validation
  avec le bouton de la bonne couleur** (pas d'énoncé dans la case).
- **3 boutons VALIDER colorés sous le clavier**, alignés sur ses colonnes, de la
  largeur des touches — on sait quel calcul on valide.
- **Changer de calcul ciblé efface la saisie en cours** (la saisie appartient au
  calcul) — règle qui a aussi éliminé une contamination de saisie entre calculs.
- **Chrono immédiat IA** : en Solo, les phases jouées par l'IA ne font pas attendre
  l'humain — score pré-calculé, totalisé sur un court chrono (I15/I16 amendés).
- Affichages d'énergie placés **à côté des claviers** (jamais recouvrables).

### Tests

- **Typecheck strict** : ✅ 0 erreur. **Vitest** : ✅ **49/49**, couverture
  **100 %** du cœur (156/156 statements, 100/100 branches).
- **Scénarios** : ✅ **S01→S11 tous verts** (11/11).
- **E2E** : ✅ **6/6** — E01 (scène atteinte), E02a (erreur validée = gain 0,
  calcul conservé), E02b (correction ⌫ avant validation, +3), E02c (+7),
  E02d (C tout effacer, énergie totale +11), E03 (défense + résolution, PV
  conformes I1/I2).
- **Smoke L0** : ✅ inchangé.

### Anomalies

- E2E : frappes Puppeteer à cadence 0 avalées par le navigateur → saisies à
  `{ delay: 40 }` (fiabilisé) ; contamination de la saisie partagée entre calculs
  après une erreur validée → règle « changer de cible efface la saisie ».
- Chevauchements d'affichage successifs (libellés PV, énergie, boutons) corrigés
  et vérifiés par capture à chaque itération.

### Prochaine étape

- Jalon **J5** : assets cut-out (`docs/assets.md`), aura Dragon Ball, frappe
  graduée, défense/contre animées, HUD complet, sons.

---

## 2026-11-13 — Jalon J5 (1ʳᵉ moitié) — Présentation : arène, sprites, aura, juice

### Produits

- **Génération d'assets** : arène 16:9 + 2 personnages (style cartoon BD) générés
  (`tmp/test-*.png`), **découpe cut-out automatisée** par `scripts/assets-cutout.py`
  (flood-fill depuis les bords, recadrage auto, redimensionnement 420 px, PNG 32
  bits) → `game/assets/personnages/perso-a.png` (188×420), `perso-b.png`
  (202×420), `game/assets/decors/arene-1.png` (1280×720).
- **`game/vite.config.ts`** : `publicDir: 'assets'` — le dossier d'assets unique
  est servi à la racine en dev **et** copié dans `dist/` à la build (chemin
  relatif, compatible APK, AGENTS §4).
- **`scenes/BootScene.ts`** : `preload()` des 3 images + trace `assets.pret`.
- **`scenes/FightScene.ts`** :
  - **arène réelle** en fond (repli dégradé si assets absents) + ligne de sol ;
  - **sprites cut-out** des combattants (origin pieds sur le sol), étiquettes
    « J1 » / « IA », **respiration idle** permanente (tween sine) ;
  - **aura §2.8a** : halo redessiné par palier déterministe (`palierAura`),
    alphas 0.15 / 0.32 / 0.5 / 0.7, éclats aux paliers ≥ 2, ombre portée ;
    **impulsion** à chaque calcul réussi (+1/+3/+7) qui revient à l'alpha du
    palier courant ;
  - **micro-gêne** sur erreur (écrasement léger, échelle préservée) ;
  - **frappe graduée §2.8b** : élan de l'attaquant, recul de la cible (encaisse /
    contre), secousse caméra au tier ≥ 2, flash plein écran au tier 4,
    **dégâts flottants** dimensionnés/colorés par tier (`⟲` pour la contre) ;
  - **blocage parfait** : étincelles (flash d'aura) ;
  - **K.O. §2.8d** : flash caméra + chute animée du perdant ;
  - **rejeu (R)** : remise à pied des combattants (position, angle, échelle,
    paliers d'aura) ;
  - HUD : libellé de droite « IA » (cohérent avec l'étiquette du personnage) ;
  - hook debug : `aura()` (alpha/palier/visible des deux combattants).
- **`ui/numpad.ts`** : **bug corrigé** — Phaser ne remonte pas les événements
  d'un enfant interactif au conteneur : les clics souris sur le pavé et les
  boutons VALIDER ne fonctionnaient jamais (seul le clavier physique était
  testé) → re-émission explicite `fond.on('pointerdown') → bouton.emit(...)`.
- Captures : `output/screenshots/j5-arene-sprites.png`, `j5-aura.png` ;
  sondes : `tmp/sonde-aura.mjs`, `tmp/sonde-aura-2.mjs`.

### Décisions

- **Sprites entiers animés par tweens** (méthode `docs/assets.md` : cut-out
  animé privilégié) plutôt que spritesheets d'états découpés — les états
  `garde`/`parade`/`contre` resteront à produire dans la 2ᵉ moitié de J5.
- **`publicDir` = dossier d'assets** : une seule source d'images pour dev et
  build, conformément à l'arborescence AGENTS §4 (`game/assets/`).
- **Séparation alpha du palier / impulsion** : l'impulsion mémorise l'alpha cible
  (`alphaPalier`) et y revient en fin de tween — sinon elle écrasait la valeur du
  palier (anomalie ci-dessous).

### Tests

- **Typecheck strict** : ✅ 0 erreur. **Vitest** : ✅ **49/49**, couverture
  **100 %** (156/156 statements, 100/100 branches).
- **E2E** : ✅ **6/6** (E01→E03). **Scénarios** : ✅ **11/11** (S01→S11).
- **Smoke L0** : ✅.
- **Sonde aura** : alpha 0.15 (palier 0) → **0.32 (palier 1)** après +11
  d'énergie, stable en fin de mesure ; validations au clic opérationnelles
  (énergie 0 → 11 via les 3 boutons colorés).

### Anomalies

- **Clics VALIDER/pavé inertes** : non détecté en J4 (E2E = clavier physique
  uniquement) — corrigé par re-émission d'événement, validé par la sonde aura.
- **Alpha d'aura écrasé** : `impulsionAura` portait un tableau d'alphas
  désynchronisé de `majAura` et son `onComplete` réappliquait l'ancienne valeur
  (mesure : 0.15 au lieu de 0.32) — corrigé via `alphaPalier`, mesuré au hook.
- Première capture d'intégration : libellé HUD « J2 » vs étiquette « IA » —
  unifié en « IA ».

### Prochaine étape

- **Fin de J5** : sons, particules (aura/impacts), ralenti tier 4, parade +
  contre dédiées, journal de combat (5 derniers événements) + score de manche,
  captures E04 (résolution animée) et E05 (K.O.).

## 2026-11-13 — Jalon J5 (suite) — Refonte de l'aura en flammes « Dragon Ball »

### Contexte

- Retour utilisateur sur la 1ʳᵉ version (langues en polygones durs dessinés dans
  `update`) : « un peu bizarre tes flammes » ; demande explicite : **l'aura doit
  être une flamme autour du personnage, style Dragon Ball**, **visible pour un
  humain** (rappel des règles de contraste / variations de couleur).

### Produit

- **`scripts/assets-flammes.py`** : textures de flamme générées (PIL) —
  `game/assets/effets/flamme-1.png`, `flamme-2.png`, 160×320 RGBA blanc
  teintable ; 2 variantes à pointes, flou gaussien durci (`0.05·L`, fondu 62 %
  avec le noyau net), bas atténué (aucune coupe franche).
- **`scenes/FightScene.ts` — refonte de l'aura** :
  - 11 langues `FLAMMES` plaquées sur la silhouette (pieds → couronne),
    **flamme à 2 couches** : langue colorée en fusion **normale** + petit noyau
    incandescent en fusion **ADD** ;
  - `vaciller()` : tweens décalés par langue (hauteur, largeur, éclat autour de
    l'alpha de base, balancement) — l'ancien redessin polygonal par frame est
    supprimé ;
  - `textureTeintee()` : **teinte CPU** (multiplication par pixel dans un canvas,
    une copie par variante et par couleur) ;
  - `majAura` : alpha du palier + échelle `0.7 + palier × 0.18` (les flammes
    grandissent avec l'énergie) ; impulsions inchangées (`alphaPalier`).
- **`scenes/BootScene.ts`** : préchargement `flamme1` / `flamme2`.
- **`core/config.ts`** : `auraAlphas` → `[0.55, 0.74, 0.88, 0.98]`.
- **`docs/assets.md` §6a** : production et teinte des textures de flamme.
- Hook debug enrichi : `diagnosticAura()` (rendu, tint réel, blend, alpha des
  enfants) et `forcerAlphaAura(a)` (captures à intensité imposée).

### Décisions

- **Textures générées plutôt que polygones** : formes douces mais pointues,
  2 variantes alternées pour éviter la répétition — le vacillement vient des
  tweens, pas du dessin par frame.
- **Langue colorée en fusion normale, noyau en ADD** : en fusion additive
  exclusive, la couleur se délavait en blanc/lavande sur le décor clair (le
  noyau seul percent toujours) — la couleur franche + cœur incandescent donne
  le rendu « ki Dragon Ball ».
- **Teinte CPU (`melangerVersBlanc` reste la source unique)** : `lueur =
  melangerVersBlanc(teinte, 0.55)` (langue), `coeur = …(0.85)` (noyau).
- **Teintes et alphas relevés pour le contraste** : `auraAlphas` +0,05 à +0,08
  et lueur 0,45 → 0,55 après mesure (cf. Tests).

### Tests

- **Batterie complète** : typecheck strict ✅ 0 erreur ; Vitest ✅ **49/49**,
  couverture **100 %** (156/156 statements, 100/100 branches, 31/31 fonctions) ;
  E2E ✅ **6/6** (rapport `output/reports/e2e-2026-11-13T21-05-28.md`) ;
  scénarios ✅ **11/11** S01→S11 (rapport `output/reports/scenarios-2026-11-13T21-06-00.md`) ;
  smoke L0 ✅ PASS.
- **Mesures WCAG 1.4.11 sur captures réelles** (échantillonnage pixels) :
  J1 palier 1 — corps des langues **3,17:1**, noyaux **9,6:1** ; IA palier 2 —
  noyaux **8,19:1** (seuil exigé : ≥ 3:1).
- **Validation visuelle** par captures : palier 0 = lueur légère ; palier 1
  (J1, bleu) et palier 2 (IA, rouge) = flamme enveloppante à langues pointues —
  capture de référence `output/screenshots/j5-aura.png`.

### Anomalies

- **`setTint()` WebGL totalement ignoré** (découverte en cours d'itération) :
  une image jetable tintée `0xff0000` est rendue **blanche** (rendu = WebGL type
  1, `tintTopLeft` correctement posé sur l'objet) — d'où l'aspect « colonne
  blanche » de toutes les versions précédentes d'aura → contourné par la teinte
  CPU, valable quel que soit l'environnement (captures, WebView APK, device).
- **Diagnostic en couches** : capture avec noyaux seuls / couches seules /
  alpha forcé à 1, mesures de pixels par échantillon — la mesure brute a dû
  être reprise en excluant tout le sprite (le costume bleu de J1 contaminait
  l'échantillon « langue bleue »).
- Sondes ajoutées (non versionnées, `tmp/`) : `diag-aura`, `diag-tint`,
  `diag-pipeline`, `sonde-aura-ia` (progression de l'aura IA sur son chrono).

### Prochaine étape

- **Fin de J5** : sons, particules d'impact, ralenti tier 4, parade +
  contre-attaque dédiées, journal de combat (5 événements) + score de manche,
  captures E04/E05.

---

## 2026-11-13 — Jalon J5 (fin) — Sons, juice de frappe, parade/contre, journal + score, E04/E05

### Produits

| Fichier | Rôle |
|---------|------|
| `scripts/assets-sons.py` | Générateur de sons **déterministe** (stdlib `wave`/`math`/`struct`, 22 050 Hz mono PCM 16 bits) |
| `game/assets/sons/{reussite,erreur,frappe,blocage,ko}.wav` | 5 effets sonores synthétisés (aucun asset importé) |
| `game/src/core/config.ts` | Bloc **`juice`** (8 paramètres) : zoom tier 3/4, ralenti (durée + facteur), étincelles/tier, rayon d'onde de choc, secousse/tier, durée du flash tier 4 |
| `game/src/scenes/BootScene.ts` | Préchargement des 5 sons + trace `assets.pret.sons` |
| `game/src/scenes/FightScene.ts` | Sons, journal de combat, score de manche, animations de résolution refondues, hooks debug |
| `game/src/ui/quiz-overlay.ts` | Message d'erreur réduit à **« FAUX ! »** |
| `scripts/e2e.mjs` | **E04** (tier 3 forcé, capture) et **E05** (K.O. + score, capture) ajoutés — 9 verdicts |
| `docs/test-plan.md`, `AGENTS.md` | Lignes E04/E05 et commande E2E alignées sur l'implémentation |
| `docs/assets.md` | **§2a** direction artistique 3/4 face MK/SF, **§3a** coups de poing/pied en sprites, **§6b** chaîne de production des sons |
| `output/screenshots/e2e-04-frappe.png`, `e2e-05-ko.png` | Captures de fin de J5 |

### Décisions

- **Priorité visuelle de résolution** : `CONTRE > blocage > frappe > whiff`
  (`afficherResolution` ne déclenche qu'une seule recette) — la contre-attaque
  dispose de sa propre chorégraphie : l'attaquant avance, esquive manquée, le
  défenseur se décale puis frappe dans la foulée (`animContre`).
- **Aucune intensité en dur** : tout le « juice » (zoom, ralenti, secousse,
  flash, étincelles, onde de choc) sort de `CONFIG.juice` — testable et
  rééquilibrable sans toucher à la scène.
- **Ralenti « hitstop »** : `tweens.timeScale` **et** `time.timeScale` posés à
  `ralentiFacteur`, restaurés par un `delayedCall` dont le délai est **multiplié
  par le facteur** (l'horloge Phaser est elle-même scale) → durée réelle
  respectée. Remise à 1 dans `lancerCombat()` (rejeu R).
- **Étincelles en or** (`#ffd76b`) plutôt que blanc : sur le sol clair de
  l'arène, le blanc ADD se délavait ; le flash central reste blanc.
- **Bannière K.O.** : `killTweensOf(bandeauResolution)` avant l'affichage — le
  tween de fade lancé à la résolution effaçait le K.O. (anomalie levée).
- **Hooks de debug** `journal()`, `score()`, `forcerEnergieAttaque(v)`,
  `forcerEnergieDefense(v)` : E04/E05 pilotent le moteur sans modifier le code
  de jeu (défense de l'IA forcée à 6 → dégâts déterministes, indépendants du
  rendement IA).
- **Saisie vidée après validation, juste ou faux** (demande utilisateur) : le
  calcul, lui, reste affiché (I4) — seule la ligne de saisie repart à vide.
- **Deux demandes artistiques consignées pour la suite** (non implémentées en
  J5) : personnages en **3/4 de face** style *Mortal Kombat* / *Street Fighter*
  (`docs/assets.md` §2a, planifié J6) et **coups de poing / de pied animés en
  vrais sprites** (`docs/assets.md` §3a, planifié J6).

### Tests

- **Batterie complète verte** : typecheck strict ✅ 0 erreur ; Vitest ✅
  **49/49**, couverture **100 %** (156/156 statements, 100/100 branches, 31/31
  fonctions) ; scénarios ✅ **11/11** S01→S11
  (`output/reports/scenarios-2026-11-13T22-17-46.md`) ; smoke L0 ✅ PASS ;
  E2E ✅ **9/9** (`output/reports/e2e-2026-11-13T22-18-14.md`).
- **E04** : énergie d'attaque forcée à 16 → `tierAttaque` = 3, défense forcée à
  6 → 10 dégâts, PV de l'IA conformes, journal contient « encaisse ».
- **E05** : solde = défense + 100 → `fini` = true, `gagnant` = j1,
  `score().j1` = 1, journal contient « K.O. », bannière visible en capture.
- **E02a** étendu : après une validation erronée, `saisie().texte` == `''`.

### Anomalies

- **Défense IA variable** : la première version d'E04 lisait la défense de l'IA
  pour en déduire les dégâts — le rendement IA a été relevé jusqu'à 21 en un
  tour, ce qui inversait le solde (contre au lieu de dégâts). Corrigé par le hook
  `forcerEnergieDefense` : le scénario ne dépend plus du hasard IA.
- **Capture d'impact prise trop tard** (700 ms) : flash et étincelles déjà
  détruits — capture déplacée à 180 ms après la résolution (le ralenti étire
  quand même les tweens, d'où la fenêtre choisie).

### Prochaine étape

- **J6** : refonte des planches en **3/4 de face** (MK/SF), **sprites de coup de
  poing et de coup de pied** animés (recettes `animPoing` / `animPied`, coup choisi
  par `config.ts`), puis mode 2 joueurs, écrans RUN/CONFIG et sélection de
  personnage.

---

## 2026-11-14 — Rig cut-out articulé : coups de poing/pied, gardes, contre sautant

### Produits

| Fichier | Rôle |
|---------|------|
| `scripts/assets-rig.py` | Générateur du rig (PIL, déterministe) : découpe de `perso-a/b.png` en 5 pièces (`buste`, `bras-g/d`, `jambe-g/d`) avec pivots épaule/hanche, **bandes de recouvrement** (épaules 14 px, hanches 16 px — repos identique au pixel près, aucun trou à l'articulation), exception de masque pour la basque dorée de `perso-a` (`exceptionsBuste`), meta bbox + pivots, planches QA |
| `game/assets/personnages/rig-{a,b}/*.png` + `rig-meta.json` | 10 pièces articulées + meta (dimensions = tailles `x1−x0`, bug `x1/y1` corrigé) — sorties du générateur |
| `game/src/core/config.ts` | Type `Coup` = `poing \| pied-bas \| pied-haut`, table `coupsParTier`, helper `coupPourTier(tier)`, section **`rig`** : `dureeExtensionMs` 90 (remplace `juice.delaiImpactMs`, supprimé), `dureeRetourMs` 150, `flashCoupMs` 150, angles `{poing 92, piedHaut 78, piedBas 36, gardeHaute 150, gardeBasse 58, contrePied 85}`, `sautHauteur` 140, `sautDureeMs` 260, `impactY {poing 185, pied-haut 100, pied-bas 40}` |
| `game/src/scenes/BootScene.ts` | Chargement des 10 pièces (`rig-<dossier>-<piece>`) + `rigMeta`, tracé `rig` dans `assets.pret` |
| `game/src/scenes/FightScene.ts` | `construireRig()` (montage par bbox, origin sur pivot, profondeurs `PROFONDEURS_RIG` + `PROFONDEUR_ANIME`, repli image plate si meta/textures absentes) ; `animerCoup` / `animerMembre` (extension `quad.out` puis retour `sine.inout`, suivi `membresActifs`) ; `sauter()` (rig + aura) ; `animBlocage` (bras si coup ≠ pied-bas, jambe sinon) ; `animContre` (esquive + saut + pied-haut forcé `contrePied`) ; `impactVisuel` enrichi : **flash sprite `coups-poing`/`coups-pied` en ADD 150 ms** à la hauteur `impactY[coup]` (flipX selon direction) ; hook `coups()` avec `etatRig()` (angles arrondis + saut) ; remise à pied rig dans `lancerCombat` |
| `game/tests/config.test.ts` | 9 tests `coupPourTier` (tiers, hors table, table vide) + invariants `rig` (garde haute > poing, pied bas < pied haut, contre/saut bornés, durées > 0) |
| `tmp/anim-probe.mjs` | Sonde visuelle : 4 résolutions pilotées (frappe t2, frappe t3 ralentie, CONTRE, blocage) avec **enregistreur rAF des angles dans la page** + captures `tmp/visu/probe-<run>-*.png` |
| `docs/assets.md` | **§3a réécrit** : rig cut-out livré (générateur, montage, recettes d'animation, flash d'impact, validation) ; **§6 inventaire** mis à jour (rig-a/rig-b, rig-meta, coups-*.png, sons/) |

### Décisions

- **Conserver l'illustration existante** (demande utilisateur : « garde ton style ») :
  pas de régénération de personnage — `perso-a/b.png` est **découpé** en pièces
  articulées ; au repos le rig est identique au pixel près à l'image plate.
- **Bandes de recouvrement portées par les deux côtés** (pièce mobile + buste) :
  la rotation ne crée jamais de trou à l'épaule/à la hanche, sans déformer la pièce.
- **Basque dorée rattachée au buste** (`exceptionsBuste`) : elle déborde sous le bras
  droit au repos ; sans exception elle suivrait le poing (artefact validé puis corrigé
  par comparaison repos/poing).
- **Profondeur dynamique** : le membre animé passe à `PROFONDEUR_ANIME` (16) le temps
  du coup — le côté qui frappe est toujours devant, pas de restauration nécessaire
  (bandes identiques au repos).
- **Angles/durées uniquement dans `config.ts`** (section `rig`) : aucune intensité
  en dur dans la scène ; `juice.delaiImpactMs` supprimé au profit de
  `rig.dureeExtensionMs` (le délai d'impact est la durée d'extension du membre).
- **Flash d'impact = réutilisation des sprites `coups-poing`/`coups-pied`** en fusion
  ADD à la hauteur du coup, plutôt qu'un simple cercle : cohérent avec le coup animé.

### Tests

- **Batterie complète verte** : typecheck strict ✅ 0 erreur ; Vitest ✅
  **58/58** (4 fichiers), couverture **100 %** (158/158 statements, 103/103
  branches, 32/32 fonctions, 139/139 lines) ; scénarios ✅ **11/11**
  (`output/reports/scenarios-2026-11-14T00-37-18.md`) ; smoke L0 ✅ PASS ;
  E2E ✅ **9/9** (`output/reports/e2e-2026-11-14T00-38-08.md`).
- **Sonde rig `tmp/anim-probe.mjs`** (enregistreur rAF, angles max observés) :
  frappe t2 → `bras-d` **92°** (= `angles.poing`) ; frappe t3 → `jambe-d`
  **36°** (= `piedBas`) ; CONTRE → `jambe-g` **85°** (= `contrePied`) +
  saut **−140** (= `sautHauteur`) ; blocage → `bras-g` **150°** (= `gardeHaute`).
  Captures `tmp/visu/probe-821195-*.png` : membres tendus, flash à la bonne
  hauteur, saut et garde visibles.

### Anomalies

- **Meta `largeur`/`hauteur` = coordonnées de fin** (`x1`, `y1`) au lieu des tailles :
  PNG exportés avec marge vide et meta fausse → corrigé (`bw = x1−bx`) puis régénéré
  (planches QA inchangées).
- **Première sonde : angles tous à zéro** — l'échantillonnage démarrait **après** le
  retour au repos (capture screenshot + délai). Corrigé par un enregistreur rAF
  dans la page déclenché **avant** la résolution : angles conformes.
- **Artefact basque** (triangle doré qui suivait le poing) : corrigé par
  `exceptionsBuste` + raccourcissement de `bras-d` à la limite d'épaule.

### Prochaine étape

- **J6** : refonte des planches en **3/4 de face** (MK/SF), puis mode 2 joueurs,
  écrans RUN/CONFIG et sélection de personnage. (Les coups de poing/pied animés,
  gardes et contre sont **livrés** en ce 2026-11-14.)

---

## 2026-11-14 — Jalon J6 (étape 1) — Le duel : mode 2 joueurs + clavier par joueur

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/core/config.ts` | Type `ModeJeu = 'solo' \| 'duel'`, champ **`mode`** dans `ConfigJeu`, défaut `'solo'` |
| `game/src/ui/numpad.ts` | **`TOUCHES_J1` / `TOUCHES_J2` en `event.code`** (position physique) ; champs `clavier` / `onKeydown` ; `recevoirTouche()` (indexOf des chiffres → digit) ; `detruire()` détache le listener. **Suppression de `addKey`/capture Phaser** — plus aucune référence `touchesClavier` |
| `game/src/scenes/FightScene.ts` | Mode duel : `numpadJ2` (x = `LARGEUR-40`, aligné à droite, `onValiderSaisie('j2')`), `quizJ2.onCible` ; helpers `joueurDe` / `phasePour` / `estHumain` / `naturePourJoueur` / `eteindreZones` / **`zoneDe`** ; `lancerPhaseUnique` / `lancerPhase` réécrits en boucle **attaquant + défenseur** (chrono selon `estHumain`) ; `preparerJoueur(joueur, nature)` remplace `preparerHumain` ; `resoudreEtContinuer` → `eteindreZones()` ; `finDeCombat` libellé `'JOUEUR 2'` en duel ; `onValiderSaisie(joueur, difficulte)` (quiz/numpad/combattant/journal/log `zone` par joueur) ; `nomJoueur` statique mode-aware (`'IA'` → `'J2'`) ; étiquette du combattant ajoutée au type `Combattant` et rafraîchie dans `lancerCombat` ; hooks `mode` / `setMode` / `setRythme` / `libelles` / `questionsHumain(joueur)` / `saisie(joueur)` |
| `game/tests/config.test.ts` | +2 tests mode (défaut `'solo'`, `duel` sans casser les autres réglages) |
| `scripts/e2e.mjs` | En-tête E01→E05 **+ E08** ; helper `questionsDe(joueur)` ; **corps E08a→E08g** ; `e2e-08-duel.png` ajouté aux captures du rapport |
| `docs/test-plan.md` | Ligne **E08** (E06/E07 restent réservés à l'écran CONFIG — pas de renumérotation) |
| `docs/wireframes.md` | Bullet « touches physiques mappées » : J1 = ligne de chiffres, J2 = pavé numérique, disjointes par `event.code` |
| `AGENTS.md` | §2.7 touches J2 détaillées (pavé, décimale = ⌫, `Suppr` = C) ; §8 `E01→E05, E08` |
| `docs/architecture.md` | **§9 « Modèle de Personnage — interface unique et skins »** (voir Décisions) |
| `todo.md` | État actuel J6 étape 1 ; case « Mode 2 joueurs » → `[~]` ; tâche classe `Personnage` |

### Décisions

- **ID de test E08, pas E06** : `docs/test-plan.md` réserve déjà E06 (tempo) et
  E07 (rythme) à l'écran CONFIG — **aucune renumérotation**, E08 = sous-cas E08a→E08g.
- **Touches J2 sur le pavé numérique**, discriminées par **`event.code`** :
  chiffres `Numpad0`–`Numpad9`, valider `NumpadEnter`, ⌫ = `NumpadDecimal`,
  C = `Delete` (choisi pour éviter les frappes accidentelles : `Delete` est hors
  grappe). J1 : `Digit0`–`Digit9`, `Enter`, `Backspace`, `Escape`.
  **Jeux strictement disjoints = isolation garantie**, y compris en SIMULTANÉ où les
  deux consoles sont actives en même temps.
- **Suppression de `addKey` (capture Phaser)** — vérifié dans la source de Phaser :
  `KeyboardManager.onKeyDown` fait `queue.push(event)` **inconditionnel** (seule
  garde : `enabled`), l'événement en file est l'**événement natif** (`.code`
  lisible) ; `KeyboardPlugin` émet `ANY_KEY_DOWN` (= `'keydown'`) **même sans
  `addKey`** (condition `(!key || !repeat)`) ; `preventDefault` serait de toute
  façon trop tardif une fois en file, et la page n'a **aucun champ HTML** dont le
  navigateur aurait une action par défaut à neutraliser.
- **Chrono en duel** : `tempsPhase` pour les **2** joueurs (aucun `dureeChronoIA`,
  via `estHumain(joueur)`) — le chrono immédiat reste l'apanage de l'IA en solo.
- **Rationalisation du clavier (note d'architecture)** : `Numpad` et `QuizOverlay`
  sont **une seule classe instanciée deux fois** (réglages `touches` / `alignement`
  seulement) — aucun code dupliqué par joueur. L'accès est centralisé par le helper
  **`zoneDe(joueur)`** (quiz + clavier + combattant), qui remplace les ternaires
  `joueur === 'j1' ? … : …` répétés en 3 endroits.
- **Héritage `droite`/`gauche` écarté, consigné pour `Personnage`** :
  l'orientation est un **état** (miroir d'image + table de profondeurs), pas un
  comportement — dans le code actuel cela se résume à `base * (droite ? -1 : 1)` et
  à `PROFONDEURS_RIG.persoB` = miroir exact de `persoA` (deux valeurs, pas deux
  classes). Règle retenue et documentée `docs/architecture.md` §9.4 :
  **héritage pour le comportement, données pour l'apparence (`SkinPersonnage`),
  état pour l'orientation** ; l'héritage reste réservé à un skin à comportement
  propre (`override coupDePoing(...)`).
- **Race connue gérée dans E08** : le `delayedCall(1800, demarrerTour)` suivant la
  résolution est **attendu explicitement** (`waitForFunction(tour === 2)`) avant
  `setRythme()` — sinon double démarrage de tour.

### Tests

- **Batterie complète verte** : typecheck strict ✅ 0 erreur ; Vitest ✅
  **60/60** (+2 tests mode) ; couverture **100 %**
  (158/158 statements, 103/103 branches, 32/32 fonctions, 139/139 lines) ;
  scénarios ✅ **12/12** (`output/reports/scenarios-2026-11-14T10-43-44.md`, 0 FAIL) ;
  smoke L0 ✅ PASS ; **E2E ✅ 17/17** (`output/reports/e2e-2026-11-14T10-37-48.md`).
- **E08a→E08g (nouveau cas, tous PASS)** :
  - **E08a** bascule `setMode('duel')` → `mode=duel`, tour 1, phase `attaque`,
    attaquant `j1`, `pv2 = "J2 — 100 PV"`, `score = "Manche 2 · J1 1 – 0 J2"` ;
  - **E08b** J1 résout Facile + Moyen → `énergie = 4` ;
  - **E08c** `Numpad3` pendant la phase de J1 → `J1=""` **et** `J2=""` (isolation) ;
  - **E08d** phase `defense`, clic carte MOYEN de J2 à (970, 178) → `cible=moyen`,
    saisie J1 intacte ;
  - **E08e1** pavé J2 : `Numpad9` → `NumpadDecimal` → `""` ; `Numpad8` → `"8"` ;
    `Delete` → `""` ;
  - **E08e2** réponse MOYEN chiffre par chiffre + `NumpadEnter` → `défense=3`,
    `J2=""`, `J1=""` ;
  - **E08f** résolution → `PV={j1:100, j2:99}` (solde 4−3 = 1), `pv2="J2 — 99 PV"`,
    `energie2="énergie J2 : +3"` + capture `e2e-08-duel.png` ;
  - **E08g** SIMULTANÉ : `type('5')` → `J1="5"`, `J2=""` ; `Numpad7` → `J2="7"`,
    `J1="5"` (**isolation bidirectionnelle**), `phase=rythme=simultane`.
- **Non-régression** : E01→E05 toujours verts (solo vs IA inchangé).

### Anomalies

- `phasePour` avait été **supprimée par erreur** lors du remplacement de
  `lancerPhaseUnique`/`lancerPhase` (le helper était réécrit sans elle) → réinséré
  immédiatement, typecheck vert.
- Appel `this.nomJoueur(...)` sur une méthode **statique** → corrigé en
  `FightScene.nomJoueur(...)`.
- Commentaire « l'IA à gauche » devenu faux en duel → neutralisé (« l'adversaire »).

### Prochaine étape

- **J6 étape 2** : **accès à l'écran CONFIG** pour choisir le mode (et le rythme)
  depuis le menu — le cœur du duel est jouable et testé, mais n'est encore
  basculable que par hook debug. Puis écrans RUN/CONFIG et sélection de personnage.
- **Dette d'architecture planifiée** : classe **`Personnage`** (interface unique +
  skins en données, `docs/architecture.md` §9) — prérequis de la sélection de
  personnage ; à faire en commit à part (une intention = un commit).
