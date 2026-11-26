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

---

## 2026-11-14 — Retour utilisateur — Surbrillance des touches du clavier

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/core/config.ts` | Nouvelle section **`ui`** : `surbrillanceMs` (160 ms) et `surbrillanceTeinte` (0,45 — mélange vers le blanc) — intensité d'animation hors code, conforme §2.9 |
| `game/src/ui/numpad.ts` | **Surbrillance à l'appui** : helper `eclaircir(couleur, part)`, registre `boutons` (`Map<clé, { fond, couleur }>` — clés = libellés de grille `'0'..'9'`, `'⌫'`, `'C'` et `` `valider:<difficulté>` ``), `surligner(cle)` (teinte éclaircie + contour blanc 3 px, retour au repos par `time.delayedCall`), appel unique dans **`appuyer()`** et **`validerPour()`** (clic **et** touche physique), `surbrillance` exposé par `etatSaisie()`, minuteur annulé par `detruire()` |
| `game/tests/config.test.ts` | +2 tests : durée strictement positive et ≤ 1000 ms, teinte dans `]0, 1]` |
| `scripts/e2e.mjs` | Sous-cas **E08h** : `Digit6` → `surbrillance = '6'` sur J1 seul (J2 = `null`), retour au repos à 400 ms, puis `Numpad4` → `'4'` sur J2 seul |
| `AGENTS.md` §2.7 | Bullet « surbrillance à l'appui » (clic ou touche physique, console pressée seule, réglages `config.ts` section `ui`) |
| `docs/wireframes.md` | Règle « Touches du clavier en surbrillance » dans les règles de l'écran de combat |
| `docs/test-plan.md` | Ligne **E08** étendue `a`→`h` |
| `journal.md`, `todo.md` | Cette entrée + état |

### Décisions

- **Deux points d'appel uniques** : `appuyer(libelle)` (clic de grille, chiffres,
  ⌫, C **et** leurs touches physiques) et `validerPour(difficulte)` (bouton coloré
  **et** `Entrée`/`NumpadEntrée`). Aucun autre appel — la surbrillance suit
  exactement la logique de saisie, jamais l'inverse.
- **Registre des boutons** : `creerBouton()` reçoit une `cle` (par défaut le
  libellé) et dépose `{ fond, couleur }` dans une `Map` — la couleur d'origine est
  conservée pour un retour au repos exact (pas de recalcul, pas de dérive).
- **Intensité dans `config.ts`** : durée et teinte de surbrillance ajoutées à la
  section `ui` plutôt qu'en dur dans `numpad.ts` (règle §2/§7 : aucune constante
  magique hors `config.ts`).
- **Retour au repos = contour d'origine** : `setStrokeStyle(3, 0xffffff)` pendant
  l'appui, `setStrokeStyle(2, 0x4c63a8)` au retour — le contour des VALIDER est
  identique à celui des chiffres, donc un seul code de restauration.
- **Annulation à la destruction** : `detruire()` retire le minuteur ; et à l'arrêt
  de scène, `Clock.shutdown` (vérifié dans `phaser.js`) détruit les `TimerEvent`
  restants → aucun callback sur objet détruit.

### Tests

- **Batterie complète verte** : typecheck strict ✅ 0 erreur ; Vitest ✅
  **62/62** (60 + 2 tests `ui`) ; couverture **100 %**
  (158/158 statements, 103/103 branches, 32/32 fonctions, 139/139 lines) ;
  scénarios ✅ **12/12** (`output/reports/scenarios-2026-11-14T11-20-28.md`, 0 ❌) ;
  smoke L0 ✅ PASS ; **E2E ✅ 18/18** (`output/reports/e2e-2026-11-14T11-18-07.md`).
- **E08h (nouveau, PASS)** : `Digit6` → `J1.surbrillance = '6'`, `J2 = null`,
  saisie `'56'` ; 400 ms plus tard `J1 = null` ; `Numpad4` → `J2 = '4'`,
  `J1 = null`, saisie `'74'` ; retour au repos des deux consoles.
- **Non-régression** : E01→E05 et E08a→E08g toujours verts.

### Anomalies

- **Faute de syntaxe injectée puis corrigée** : `difficile: 0xa83a3a;` au lieu d'une
  virgule dans `COULEURS_BOUTONS` → `PARSE_ERROR` oxc affiché en overlay par Vite.
  Corrigé en `,` ; vérifié en rechargeant le transform (`/src/ui/numpad.ts` servie
  sans erreur) et par typecheck. Signalée par l'utilisateur (« tu as dû faire une
  erreur de syntaxe, regarde l'écran »).

### Prochaine étape

- **Bouton ☰ MENU en cours de jeu** → overlay pause avec « RETOUR AU JEU » et
  « QUITTER → MENU » (demande utilisateur). Point de vigilance : `Échap` est déjà
  « C Tout effacer » de J1 → raccourci clavier distinct (piste `M`).
- Puis **J6 étape 2** : écrans RUN/CONFIG (E06 tempo, E07 rythme).

---

## 2026-11-14 — Jalon J6 étape 2 — Écrans RUN / CONFIG (+ fonds d'illustration)

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/ui/retro.ts` | Primitives d'interface « borne d'arcade » partagées : palette `RETRO`, `creerBoutonRetro` (survol = contour blanc, retour exact au repos), `texteRetro`, `creerCadreBorne` (double filet) |
| `game/src/ui/ecran.ts` | Hook DEBUG `declarerEcran()` → `window.__mathkombatEcrans.ecran` (`menu`/`config`/`fight`) — les E2E cliquent à des coordonnées réelles d'écrans identifiés |
| `game/src/scenes/MenuScene.ts` | Écran de lancement rétro (wireframe §1) : RUN clignotant (y=310), CONFIG (y=410), cadence « PRESS START », Entrée = RUN, fond `fond-menu.png` + voile `CONFIG.ui.voileMenu` |
| `game/src/scenes/ConfigScene.ts` | Écran de setup rétro (wireframe §2) : 7 lignes ◀ ▶ (mode, TEMPO + durée, rythme, PV, niveau, difficulté IA), RETOUR (abandon, `Échap`) / RÉINITIALISER / VALIDER, fond `fond-config.png` + voile `CONFIG.ui.voileConfig` |
| `game/src/core/config.ts` | `PresetTempo`, `BORNES_TEMPS_PHASE` (5–60), `BORNES_PV` (10–999), `PV_DEFAUT`, `PRESETS_TEMPO` (10/15/25 s), `ORDRE_PRESETS`, champ `niveau`, section `ui` (voiles de fond), fonctions pures `lireTempsPhase` / `lirePv` / `presetDeTemps` / `reglagesDefaut` / `lireReglages` / `appliquerReglages` + `CONFIG_DEFAUT` |
| `game/assets/fonds/` | Illustrations d'ambiance des écrans rétro (`fond-menu.png`, `fond-config.png`) — deux combattants en action, centre dégagé pour le texte |
| `game/src/scenes/BootScene.ts` | Charge les deux fonds ; ouvre **Menu** (plus Fight directement) |
| `game/src/scenes/FightScene.ts` | `declarerEcran('fight')`, `lancerCombat()` re-synchronise `tempsPhase` et `niveau` depuis CONFIG, hook `setTempsPhase` écrit dans CONFIG (survit aux relances) |
| `game/index.html` | `#jeu` : repli `height: 100dvh` — le bas du cadre sortait de l'écran sur navigateur mobile (100vh inclut la zone derrière la barre d'adresse) |
| `game/tests/config.test.ts` | +16 tests (lecture validée, presets, réglages) → 76/76, couverture 100 % |
| `scripts/e2e.mjs` | E01 passe par l'écran RUN ; nouveaux **E06** (tempo) et **E07** (mode + rythme) ; helper `attendreEcran` / `relancer` |

### Décisions

- **Primitives rétro partagées** (`ui/retro.ts`) : une seule implémentation de
  bouton/texte/cadre pour les deux écrans — jamais de recopie écran par écran.
- **Écriture bornée à la validation** (I9) : l'écran CONFIG édite une copie de
  travail (`ReglagesConfig`) ; `appliquerReglages` applique les bornes 5–60 s et
  10–999 PV à VALIDER seulement — RETOUR abandonne sans rien écrire.
- **Durée de phase unique** : la ligne TEMPO (presets Rapide 10 s / Normal 15 s /
  Long 25 s / PERSONNALISÉ) pilote une seule durée, attaque = défense (§2.9) ;
  la ligne « durée » la règle finement (curseur borné).
- **HIGH SCORE retiré de l'écran RUN** (demande utilisateur) : la règle de calcul
  n'est pas tranchée — quatre propositions dans `todo.md` § Idées / dette.
- **Fonds d'illustration** : images générées (thème MathKombat, deux combattants
  en action, aucun contrôle), voiles de lisibilité `voileMenu` (0,45) et
  `voileConfig` (0,6) dans `config.ts` — texture absente = repli fond uni.
- **E06/E07 en fin de batterie** : ils rechargent l'application (défauts §2.9
  restaurés) — exécutés après E08 pour ne pas casser la continuité E05→E08.

### Tests

- **Batterie complète verte** : typecheck ✅ 0 erreur ; Vitest ✅ **76/76** ;
  couverture **100 %** (183/183 statements, 114/114 branches, 38/38 fonctions,
  161/161 lines) ; scénarios ✅ **12/12** (0 ❌) ; smoke L0 ✅ PASS ;
  **E2E ✅ 20/20** (`output/reports/e2e-2026-11-14T12-43-38.md`).
- **E01** : écran RUN (`ecran=menu`) → clic RUN → combat (tour 1, PV 100/100).
- **E06 (nouveau, PASS)** : CONFIG → ◀ TEMPO → RAPIDE → VALIDER → RUN :
  attaque J1 = 10 s et défense J1 (tour 2) = 10 s. *En solo, la défense du tour 1
  est jouée par l'IA (chrono immédiat 3 s, §2.6) : hors sujet du test.*
- **E07 (nouveau, PASS)** : CONFIG → ▶ MODE (2 JOUEURS) + ▶ RYTHME (SIMULTANÉ) →
  VALIDER → RUN : phase `simultane` dès le tour 1, saisies `J1="5"` / `J2="7"`
  sans croisement, tour 2 enchaîné sur `simultane`.
- **Non-régression** : E02→E05, E08a→E08h toujours verts.

### Anomalies

- **Cadre inférieur coupé à l'affichage** (rapport utilisateur) : `#jeu` en
  `100vh` inclut, sur navigateur mobile, la zone derrière la barre d'adresse →
  le bas du canvas sort de la zone visible (`overflow: hidden`). Corrigé par un
  repli `height: 100dvh` dans `game/index.html`. Le rendu lui-même était complet
  (vérifié sur capture 1280×720).
- **E06/E07 rouges au premier jet** : oracle erroné (E06 vérifiait la défense IA
  en chrono immédiat) et doublon de frappe J2 non reproductible (transition de
  scène non stabilisée) — corrigés par l'oracle « défense de J1 du tour 2 » et un
  délai de stabilisation avant frappe (comme E08g).

### Prochaine étape

- **Bouton ☰ MENU en cours de jeu** → overlay pause « RETOUR AU JEU » /
  « QUITTER → MENU » (→ `MenuScene`) ; raccourci ≠ Échap (piste `M`).
- Puis sélection de personnage (J6) — dette `Personnage` (`docs/architecture.md` §9).

---

## 2026-11-14 — Score de combat, score temps réel par joueur et HIGH SCORE

### Décision utilisateur

Règle du HIGH SCORE tranchée parmi 4 propositions : **« score de combat »** —
énergies gagnées + bonus de temps restant + bonus K.O. — et **score affiché en
temps réel pour chaque joueur**.

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/core/score.ts` | Module **pur** : `MesuresScore` (énergie gagnée + secondes restantes), `calculerScore(mesures, gagne)` et `scoreEnCours()` — entier, jamais négatif |
| `game/src/core/config.ts` | Section **`score`** : `facteurEnergie` (1), `facteurTempsRestant` (1), `bonusKo` (25) — règle hors code |
| `game/src/ui/record.ts` | Persistance `localStorage` : `lireRecord` / `enregistrerRecord` (meilleur score gagne) / `meilleurRecord` — **un record par niveau en mode solo** (le duel n'a pas de record : le « propre score » est le score solo, §2.5), repli silencieux si stockage indisponible |
| `game/src/scenes/FightScene.ts` | Compteurs `scores` par joueur (gains aux validations justes + secondes restantes en fin de phase jouée, énergie prévue pour l'IA), **deux lignes SCORE dans le HUD** (y=606, temps réel), `cloturerScore()` (bonus K.O. + record si J1 gagne en solo), hooks debug `scores()` / `scoreFinal()` |
| `game/src/scenes/MenuScene.ts` | **HIGH SCORE calculé** (meilleur record) affiché clignotant quand > 0 — absent tant qu'aucune partie n'a été inscrite |
| `game/src/ui/ecran.ts` | `declarerEcran(ecran, details)` — expose le record affiché aux tests |
| `game/tests/score.test.ts` | 7 tests (formule, bonus K.O., arrondis, mesures négatives, facteurs de config) |
| `game/tests/config.test.ts` | Test des réglages `score` (facteurs > 0, bonus > 0) |
| `scripts/e2e.mjs` | **E09** : 1 calcul résolu → mesures → K.O. forcé → score final + record → rechargement → HIGH SCORE sur l'écran RUN |

### Règle (§2.7)

```
score = énergies gagnées (somme des gains +1/+3/+7)
      + secondes restantes en fin de chaque phase jouée (rapidité)
      + bonus K.O. (fixe) si gagnant
```

- **Temps réel** : deux lignes « SCORE J1 » / « SCORE IA ou J2 » dans le HUD,
  mises à jour à chaque validation juste et chaque fin de phase.
- **IA (solo)** : crédite son énergie prévue (pas de rapidité — elle consomme son
  court chrono, §2.6) ; le record ne concerne que J1 en mode solo.
- **Bonus K.O.** : connu qu'à la fin — le score en cours l'exclut, le score
  final l'ajoute.

### Tests

- **Batterie complète verte** : typecheck ✅ ; Vitest ✅ **83/83** ; couverture
  **100 %** (188/188 statements, 118/118 branches, 40/40 fonctions, 166/166 lines —
  `core/score.ts` ajouté au périmètre de couverture) ; scénarios ✅ **12/12** ;
  smoke L0 ✅ ; **E2E ✅ 21/21** (`output/reports/e2e-2026-11-14T13-00-33.md`).
- **E09 (nouveau, PASS)** : 1 calcul facile résolu → énergie créditée (1) ;
  K.O. forcé → secondes restantes créditées (14) ; score sans bonus = 15,
  avec bonus = 40 ; affiché « SCORE J1 : 40 » ; record `localStorage` respecté
  (236 conservé, meilleur) ; HIGH SCORE : 236 affiché après rechargement.
- Captures : `output/screenshots/e2e-09-score.png` (HUD temps réel + K.O.),
  `e2e-09-highscore.png` (HIGH SCORE sur l'écran RUN).

### Prochaine étape

- **Bouton ☰ MENU en cours de jeu** → overlay pause « RETOUR AU JEU » /
  « QUITTER → MENU » (→ `MenuScene`) ; raccourci ≠ Échap (piste `M`).
- Puis sélection de personnage (J6) — dette `Personnage` (`docs/architecture.md` §9).

---

## 2026-11-14 — Menu de pause (☰ MENU) et boutons de fin de combat

### Demandes utilisateur

1. **Bouton de retour pendant le jeu** : « continuer la partie » et « quitter et
   retourner au menu » → menu de pause.
2. **Pas de superposition** entre les calculs et le menu : calculs plus petits,
   **☰ MENU placé entre les deux blocs de calculs**.
3. **Fin de combat** : remplacer le message « (R = rejouer) » par des **boutons
   [ REJOUER ] / [ MENU ]**.

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/ui/pause-overlay.ts` | Overlay plein écran (voile interactif qui bloque le jeu) : **[ RETOUR AU JEU ]** / **[ QUITTER → MENU ]** + `PLACE_PAUSE` (coordonnées partagées avec les tests) |
| `game/src/scenes/FightScene.ts` | Bouton **☰ MENU** dans le **couloir central entre les blocs de calculs** (640, 174) + raccourci **`M`** ; pause réelle (`time.timeScale = 0`, `tweens.timeScale = 0` — Clock gelé, `delayedCall` stoppés) ; `reactiverZones()` à la reprise ; `quitterVersMenu()` restaure les `timeScale` AVANT `scene.start('Menu')` (le TweenManager est partagé entre scènes) ; **boutons de fin [ REJOUER ] / [ MENU ]** au centre de l'arène (545/735, 330), bannière K.O. sans « (R = rejouer) » ; `R` ignoré pendant la pause ; hooks `pause()` / `basculerPause()` / `fin()` |
| `game/src/ui/quiz-overlay.ts` | **Calculs plus petits** (demande) : cartes 172×100 → **150×88**, écart 12 → 10, polices 24/15/18 → 20/13/16 — couloir central élargi (120 → 260 px) pour le ☰ MENU |
| `game/src/ui/numpad.ts` | **Garde-fou anti-doublon clavier** : un même événement (`code` + `timeStamp`) ne compte qu'une frappe |
| `scripts/e2e.mjs` | **E10** (pause : chrono figé → reprise → QUITTER) et **E11** (fin de combat : REJOUER relance, MENU retourne au RUN) |

### Décisions

- **☰ MENU entre les deux blocs de calculs** (et non plus dans le HUD haut) :
  aucune superposition avec « Manche » ni avec les opérations — les cartes ont été
  réduites pour dégager un couloir central de 260 px (proposition utilisateur).
- **Pause = gel complet** : `timeScale = 0` sur le Clock (le chrono ne bouge plus,
  vérifié en E2E : chrono=15 → 15 après 1,3 s) et sur les tweens ; les zones de
  calcul sont désactivées puis réactivées selon la phase en cours.
- **Coordonnées inchangées pour les clics de cartes** : avec les cartes réduites,
  les coordonnées E2E existantes (126/310/494, 178) visent excentré mais restent
  dans la bonne carte — aucun remaniement du plan de test.
- **Fin de combat** : deux boutons au centre de l'arène (visibles, tactile) plutôt
  qu'un raccourci clavier invisible ; le raccourci `R` reste actif en debug.

### Anomalie corrigée

- **Frappe comptée deux fois (« 77 » au lieu de « 7 »)** — intermittent (2/6 en
  boucle), alors que **l'événement DOM n'arrive qu'une fois** : le même événement
  était traité deux fois côté jeu (double émission du plugin clavier). Diagnostiqué
  par `tmp/e07-loop.mjs` (compteur DOM vs saisie) puis neutralisé par la
  **déduplication (`code`, `timeStamp`)** dans `Numpad.recevoirTouche` — deux
  frappes réelles ont des `timeStamp` distincts. Boucle de contrôle : 6/6 corrects.

### Tests

- **Batterie complète verte** : typecheck ✅ 0 erreur ; Vitest ✅ **83/83** ;
  couverture **100 %** (188/188 statements, 118/118 branches, 40/40 fonctions,
  166/166 lines) ; scénarios ✅ **12/12** ; smoke L0 ✅ PASS ;
  **E2E ✅ 23/23** (`output/reports/e2e-2026-11-14T13-39-59.md`).
- **E10 (nouveau, PASS)** : ☰ MENU → pause ouverte, **chrono figé** (15 → 15) ;
  [ RETOUR AU JEU ] → chrono relancé (15 → 13) ; ☰ MENU → [ QUITTER → MENU ] →
  écran RUN. Capture `e2e-10-pause.png`.
- **E11 (nouveau, PASS)** : K.O. → boutons affichés ; [ REJOUER ] relance
  (tour 1, `fini=false`) ; second K.O. → [ MENU ] → écran RUN.
  Capture `e2e-11-fin.png`.
- **Non-régression** : E01→E05, E08a→E08h, E06, E07, E09 toujours verts.

### Prochaine étape

- Sélection de personnage (J6) — dette architecturale `Personnage`
  (`docs/architecture.md` §9) ; puis best-of-3 manches (J8).

---

## 2026-11-14 — Classe `Personnage` (dette §9) + arène recentrée

### Demandes utilisateur

1. **Interface de personnage complète** : déplacements **effectifs** en haut,
   en bas, à droite, à gauche + les coups définis — « tout ne sera pas utilisé
   mais je veux l'interface ».
2. **Arène recentrée** : personnages **plus petits (aux 2/3)**, plus au centre,
   entre les claviers et sous les fiches de calcul.
3. **Fiches de calcul remontées** avec le bouton ☰ MENU, **bas du bouton aligné
   sur le bas des fiches**.

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/rig/personnage.ts` | **Classe `Personnage`** (docs/architecture.md §9) : skins en données (`SKINS`, `skinDe` — erreur explicite si inconnu), orientation **état** (miroir des profondeurs), interface complète — **déplacements effectifs bornés** (`vaAGauche`/`vaADroite`/`vaEnHaut`/`vaEnBas`, tween court), `orienter`, `gardeHaute`/`gardeBasse`, `coupDePoing` (direct/uppercut/crochet), `coupDePied` (haut/bas), `saut`, `frapper`, `encaisse`, `parade`, `contre`, `whiff`, `ko`, `charger`, `impulsion`, `reinitialiser`, `etatRig` — plus la création complète du rig (cut-out, aura 2 couches, particules, respiration) |
| `game/src/core/config.ts` | `rig.echelle` (0,42 = 2/3 de 0,62), `rig.koChuteY`, `rig.deplacementPas`/`deplacementDureeMs`, `angles.uppercut`/`crochet` |
| `game/src/scenes/FightScene.ts` | **Allégée de ~450 lignes** : `Combattant` et les 12 méthodes de présentation supprimées → `Personnage` ; orchestration seule (résolution, impacts visuels, juice) ; **personnages recentrés** (X_J1=470, X_J2=810) avec **limites de déplacement** (380–900, sous les fiches) ; fiches de calcul remontées (y=96) et **☰ MENU aligné bas sur bas** (y=164) |

### Décisions

- **Déplacements réellement animés** : chaque `vaAGauche`…`vaEnBas` déplace le
  corps d'un pas (`rig.deplacementPas`), tween court, **borné** à la zone
  centrale — l'interface est complète et fonctionnelle même si le gameplay ne
  l'utilise pas encore.
- **Orientation = état** (§9.4) : la direction des coups vient de
  `orientation` ; le miroir de la table de profondeurs ne s'applique que si
  l'orientation diffère du sens de dessin du skin (aucune texture miroirée
  inutilement).
- **Effets d'impact injectés** (`EffetsPersonnage`) : `Personnage` déclenche
  étincelles/ondes de choc mais la scène les dessine (juice = présentation
  inter-personnages).
- **Positions de mise en page** en constantes de scène (X_J1/X_J2/LIMITES) —
  intensités d'animation et tailles dans `config.ts`.

### Tests

- **Batterie complète verte** : typecheck ✅ 0 erreur ; Vitest ✅ **83/83** ;
  couverture **100 %** (188/188 statements, 118/118 branches, 40/40 fonctions,
  166/166 lines) ; scénarios ✅ **12/12** ; smoke L0 ✅ PASS ; **E2E ✅ 23/23**
  (`output/reports/e2e-2026-11-14T14-08-31.md`).
- **Non-régression visuelle** : captures vérifiées — personnages aux 2/3,
  recentrés entre les claviers, fiches remontées, ☰ MENU aligné bas sur bas,
  pause et fin de combat inchangées.
- Coordonnées E2E : ☰ MENU → (640, 164) ; clics de cartes inchangés (les
  nouvelles cartes les couvrent).

### Prochaine étape

- **Sélection de personnage + de niveau** (wireframes §3) — fin J6.
- Puis **certification RELEASE zéro log** (T04, I10) et **APK release**
  (wrapper WebView + `scripts/build-apk.sh`).

---

## 2026-11-14 — Sélection de personnage et de niveau (fin J6)

### Produits

| Fichier | Rôle |
|---------|------|
| `game/src/ui/selection.ts` | État de session de la sélection (§3) : skins J1/J2 + niveaux J1/J2 — écrit par `SelectScene`, lu par `FightScene` |
| `game/src/scenes/SelectScene.ts` | **Écran de sélection** (wireframes §3) : 4 lignes réglables ◀ ▶ (personnages depuis `SKINS`, niveaux §2.5), note de mode (SOLO : l'IA suit le niveau de J1, difficulté CONFIG), **[ ▶ LANCER LE COMBAT ]**, RETOUR, Entrée = lancer ; fond `fond-config` + voile |
| `game/src/scenes/MenuScene.ts` | RUN → `Select` (plus `Fight` directement) |
| `game/src/scenes/FightScene.ts` | Skins et niveaux **lus dans la sélection** à chaque `lancerCombat` (en SOLO, l'IA suit le niveau de J1) ; hook debug `selection()` |
| `game/src/main.ts` | `SelectScene` enchaînée entre Config et Fight |
| `scripts/e2e.mjs` | Helper `lancerCombat()` (RUN → sélection → LANCER, clics réels) appliqué à E01/E06/E07/E09/E10/E11 ; nouveau cas **E12** |

### Décisions

- **La sélection est un état de session** (`ui/selection.ts`), pas de
  l'équilibrage : les skins et niveaux choisis persistent entre les combats mais
  restent hors `config.ts` (qui garde les valeurs de jeu).
- **Skins dynamiques** : les lignes de personnage sont construites depuis
  `SKINS` — ajouter un skin l'ajoute automatiquement à la sélection.
- **E2E en clics réels** : le helper `lancerCombat()` traverse vraiment RUN →
  sélection → LANCER (aucun hook de navigation).

### Tests

- **Batterie complète verte** : typecheck ✅ 0 erreur ; Vitest ✅ **83/83** ;
  couverture **100 %** ; scénarios ✅ **12/12** ; smoke L0 ✅ PASS ;
  **E2E ✅ 24/24** (`output/reports/e2e-2026-11-14T14-15-39.md`).
- **E12 (nouveau, PASS)** : ◀ niveau J1 → DÉBUTANT, ◀ skin J2 → PERSO A, puis
  LANCER → combat créé avec la sélection (`selection()` = debutant/persoA) +
  capture `e2e-12-selection.png`.
- **Non-régression** : E01→E11 verts, tous rebranchés sur le passage par la
  sélection (RUN ne lance plus directement le combat).

### Prochaine étape

- **Certification RELEASE zéro log** (T04, I10) puis **APK release**
  (wrapper WebView Kotlin + `scripts/build-apk.sh`).

---

## 2026-11-14 — Certification RELEASE zéro log (T04, I10)

### Produits

| Fichier | Rôle |
|---------|------|
| `scripts/certif-release.mjs` | **Certification exécutable** du build RELEASE : C1 build produit, C2 jouable (RUN → sélection → combat), C3 zéro hook debug, C4 zéro log d'application (nomenclature §4), C5 zéro WebSocket, C6 zéro requête hors origine (hors-ligne), C7 zéro erreur applicative → rapport `output/reports/certif-release-*.md`, code retour 0/1 |
| `scripts/e2e.mjs` | Flags chromium stabilisés (`--disable-gpu`, `--enable-unsafe-swiftshader`) |

### Décisions

- **Certification par exécution réelle** : le parcours RUN → sélection → combat est
  joué sur le bundle RELEASE servi par un serveur statique minimal (zéro
  dépendance, comme le futur APK) — pas une simple inspection de fichiers.
- **Périmètre de C4** : les logs **d'application** (marqueurs de nomenclature
  `session.`/`combat.`/… ) — la bannière produit de Phaser et les warnings du
  navigateur sont hors périmètre (pas nos données).
- **C7 tolère les artefacts du GPU logiciel** (SwiftShader `Framebuffer
  Unsupported`, `CONTEXT_LOST`) : erreurs de rendu headless, absentes sur un vrai
  GPU (WebView Android) — liste documentée dans le script.

### Anomalies corrigées

- **Boot WebGL instable en headless** : `getContext('webgl')` perdu par SwiftShader
  → « WebGL unsupported » et pas de canvas (5/5 échecs). Cause : rasterisation
  GPU logicielle instable sous pression mémoire (swap saturé). **Correction** :
  flags chromium `--disable-gpu` + `--enable-unsafe-swiftshader` → WebGL logiciel
  stable (vérifié : renderer « WebGL | Web Audio »). Appliqué à `certif-release`
  et `e2e`.

### Tests

- **Certification RELEASE : ✅ 7/7** (`output/reports/certif-release-2026-11-14T14-39-11.md`).
- **Non-régression** : typecheck ✅ · Vitest **83/83** ✅ · couverture **100 %** ✅ ·
  scénarios **12/12** ✅ · smoke ✅ · E2E **24/24** ✅.

### Prochaine étape

- **APK release** : wrapper WebView Kotlin (`android/`) + `scripts/build-apk.sh`
  (SDK local `tools/`) → `output/MathKombat.apk`.

---

## 2026-11-14 — APK RELEASE (J7) — output/MathKombat.apk

### Produits

| Fichier | Rôle |
|---------|------|
| `android/` | **Wrapper WebView Kotlin** : `settings.gradle`, `build.gradle` (AGP 8.5.2 + Kotlin 1.9.24), `app/build.gradle` (minSdk 24 / targetSdk 34, signature release locale), `AndroidManifest.xml` (paysage, plein écran, **zéro permission**), `MainActivity.kt` (WebView immersive, JS + DOM storage pour le record, sons sans geste, `file:///android_asset/index.html`) |
| `scripts/build-apk.sh` | **Build APK release** : jeu web RELEASE → assets embarqués (`game/dist/` = unique source), keystore généré dans `tools/`, Gradle embarqué (`assembleRelease`, cache isolé `.gradle-cache`), sortie `output/MathKombat.apk` + contrôle `aapt dump badging` |
| `scripts/setup-sdk-qemu.sh` | **Wrappers qemu des binaires SDK x86-64** (aapt2, zipalign, aidl…) : sur hôte aarch64, les outils officiels du SDK sont émulés (`qemu-x86_64-static -L /usr/x86_64-linux-gnu`) — script **idempotent** (restaure et re-wrappe proprement) |

### Décisions

- **Zéro dépendance Android** : `Activity` native (pas d'AndroidX) → le build reste
  léger et le moins réseau-dépendant possible (AGP/Kotlin plugins Maven en
  cache isolé `tools/` + `.gradle-cache`).
- **Assets = `game/dist/`** : le contenu de l'APK est **certifié** par
  `scripts/certif-release.mjs` (zéro log, zéro socket, jouable) — une seule source
  de vérité, copiée à chaque build.
- **Signature release locale** : keystore `tools/mathkombat.keystore` (généré une
  fois, 10 000 jours) — aucun secret hors projet ; APK installable tel quel.
- **Émulation qemu** (aarch64 → x86-64) : nécessitée par les build-tools Android
  officielles ; prérequis système documentés (apt) : `qemu-user-static`,
  `libc6-amd64-cross`, `libgcc-s1-amd64-cross`.

### Anomalies corrigées

- **AAPT2 daemon startup failed** : binaires SDK x86-64 inéxécutables sur aarch64
  (« Exec format error », `ld-linux-x86-64.so.2` absent) → wrappers qemu
  (`setup-sdk-qemu.sh`) + `android.aapt2FromMavenOverride` pointant sur l'aapt2
  du SDK (wrappé). Double wrapping raté au premier jet (`.bin.bin`) → logique
  de restauration idempotente réécrite (un ELF d'origine, un seul wrapper).

### Tests

- **BUILD SUCCESSFUL** (Gradle 8.10.2, SDK 34, JDK 21 embarqués) — 46 tâches.
- **APK vérifié** : `output/MathKombat.apk` (7,2 Mo) — `package=fr.mathkombat`,
  `versionName=0.1.0`, `sdkVersion 24 → 34`, `launchable-activity` MainActivity ;
  **signature valide** (`apksigner verify`) ; contenu = jeu complet
  (`assets/index.html`, `classes.dex`, arène, effets, fonds, sons).
- **Reste manuel** : grille L5 (M01→M07) sur appareil réel — lancer, tactile,
  audio, pause, record, rotation.

### Prochaine étape

- Exécution de la **grille manuelle L5** sur appareil (ou émulateur) puis J8
  (équilibrage, best-of-3, README/journal final).

---

## 2026-11-15 — Sprites animés, manœuvres, CI/CD et équilibrage (v0.0.10 → v0.0.13)

### Produits (sessions successives)

| Sujet | Contenu |
|-------|---------|
| **Refonte 3/4 de face** | 6 combattants en **sprites animés style Mortal Kombat / Street Fighter** (`game/assets/sprites-mk/`) : 8 poses (garde, marche, saut, poing, pied, garde défensive, touché) + **cycles de marche de 8 frames** ; `rig/personnage.ts` (l'ancien rig cut-out est retiré) ; méthode de production `docs/assets.md` §3bis |
| **Gabarits et sol** | Tailles relatives (`RATIOS` : TITAN 1,12 · BLAZE 1,08 · KENJI/KIRA 1,00 · ZANE 0,98 · NYX 0,92), **pieds garantis sur le pixel du bas** (coupe des ombres et résidus des planches), ombre portée **au sol, droite**, sous le personnage (même au K.O.) |
| **Manœuvres (chrono)** | Pendant le chrono : déplacements de **couple** (l'attaquant bouge, le défenseur le suit avec un **temps de réaction**), **déplacements verticaux** (profondeur), sauts et coups en l'air **indépendants**, feintes de contre — **distance constante vérifiée** (recalage en marchant), biais vers le centre, **contact visible au pixel** lors des coups et blocages (portée calculée sur les largeurs de sprites) |
| **Marche partout** | Tous les déplacements x/y sont **animés en marche** (8 frames), l'approche d'un coup est une **marche accélérée** |
| **K.O.** | Bascule **en arrière autour des pieds, sans déplacement vertical** ; respiration arrêtée |
| **CI/CD GitHub Actions** | `.github/workflows/build-apk.yml` : tag `v*` → build debug + release → **Release GitHub** avec `MathKombat-<version>-release/debug.apk` ; signature via les secrets `KEYSTORE_*` (mêmes clés que openwebui-android) ; `setup-sdk.sh` rendu **portable** (JDK selon l'arch, `unzip -d`, Python/PIL optionnel) |
| **Équilibrage (A+B)** | **Repli Débutant en +7** (3×3, 3×4, 4×4 — option A) et **famille difficile élargie** (5 résistants + `6×9 · 7×9 · 8×9 · 9×9 · 7×11 · 8×11 · 9×11 · 11×11 · 11×12 · 12×12` — option B) : Difficile = **16–20 %** des faits (contre ~6–9 %) ; en Débutant, 20 % de +7 et **plus de Moyen** (les jaunes possibles sont le repli) |

### Versions publiées sur GitHub

`v0.0.10` (jeu complet + CI) → `v0.0.11` (manœuvres, marches, contact) → `v0.0.12`
(état complet) → `v0.0.13` (équilibrage A+B) — chaque release embarque
`MathKombat-<version>-release.apk` et `-debug.apk`.

### Tests

- Vitest ✅ **84/84** (nouveaux tests de classement : difficile élargi + repli
  Débutant) ; couverture **100 %** ; scénarios ✅ **12/12** ; E2E ✅ **30/30**
  (E01→E16) ; smoke ✅ ; certification RELEASE ✅ 7/7 (`certif-release.mjs`).
- Contrôle de production des sprites : pieds sur le pixel du bas pour les
  **96 sprites** (6 combattants × [8 poses + 8 frames de marche]).

### Documentation mise à jour

`AGENTS.md` §2.5 (classement des faits), `docs/test-plan.md` (I11, E13→E16,
note de répartition), `docs/assets.md` §3bis (méthode sprites), `todo.md`.

### Prochaine étape

- Grille manuelle **L5** sur appareil (v0.0.13) + build **Android Studio** (PC) ;
- **Équilibrage S12** (taux de victoires humaines 80/50/30 %) — la répartition
  des faits est posée, reste le réglage de l'IA et de la cadence ;
- Journal final + README (clôture J8).

### S12 — modèle IA « score moyen » et temps des calculs (suite)

| Sujet | Contenu |
|-------|---------|
| **Modèle IA** (demande utilisateur) | Le niveau d'IA (Facile/Moyen/Difficile) **indique le score moyen des attaques et des défenses** (`ia.scoreMoyen`) — **pas les multiplications à faire** : `tauxReussite`, `strategieChoix`, `rendementMax` supprimés. Le choix des calculs est indépendant du niveau (proportionnel au gain). |
| **Temps des calculs** | 1 calcul = **2 s** de saisie + calcul humain (`tempsParCalcul`) : le temps de phase borne le nombre de calculs — **moins de temps = score plus faible** (humain comme IA). |
| **Calibration S12** | `scripts/s12-sim.mjs` (Monte Carlo sur le cœur réel, dichotomie sur `scoreMoyen`) → **scoreMoyen { facile: 21, moyen: 23, difficile: 24 }** ; validation 300 combats : **78.7 / 49.3 / 32.3 %** de victoires humaines (cibles 80/50/30 ± 15) ✅ |
| **Tests** | Vitest 87/87 (nouveaux tests : temps des calculs borne le score, score moyen conforme, choix indépendant du niveau, toujours battable) ; scénarios S01→S12 verts (S09 = score moyen ±12 %). |
| **Doc** | AGENTS.md §2.6/§2.9, test-plan I16/S09/S12 mis à jour. |

Prochaine étape : grille manuelle L5 + build Android Studio, puis best-of-3 / idées optionnelles.

### Correctifs après reprise du menu pause (2026-11-15)

| Sujet | Contenu |
|-------|---------|
| **Clavier IA au retour du menu** (bug utilisateur) | `reactiverZones()` réactivait les zones de tout joueur en phase, **y compris l'IA** (j2 en Solo). Corrigé : seuls les joueurs **humains** (`estHumain`) sont réactivés — le clavier de l'IA reste désactivé **en tout temps** (§2.6). Hooks `zones()` + `estActif()` ajoutés, **E10 durci** (vérifie `zones.j2` inactives après reprise) ✅ |
| **Libellé SIMULTANÉ** | Message de phase « ATTAQUE × / DÉFENSE ÷ (même chrono) » → « ATTAQUE × / DÉFENSE ÷ » (demande utilisateur). |
| **E2E pilotage d'énergie** | Le score IA croissant avec le temps de phase (§2.6 nouveau modèle) faisait K.O. le joueur de test avant le tour 3 (E01 met `tempsPhase=45`). E03 et le tour 4 d'E05 pilotent désormais les énergies IA (`forcerEnergie*`, comme E04/E05) : la batterie vérifie la **maths de résolution**, pas l'équilibrage (couvert par S12). |
| **Batterie** | Vitest 87/87 · scénarios S01→S12 ✅ · **E2E 28/28 ✅** (rapport `e2e-2026-11-15T17-30-34.md`). |

### Clôture J8 — journal final + README (2026-11-15)

| Sujet | Contenu |
|-------|---------|
| **Grille manuelle L5** | **Validée par l'utilisateur** sur la v0.0.14 (lancement, tactile, audio, pause/reprise avec clavier IA désactivé, record, rotation, longue session) ✅ |
| **README.md** | Réécrit : présentation du jeu (modèle IA score moyen, temps des calculs 2 s, niveaux, tables 11/12), section Qualité (87/87 · 12/12 · 28/28 · 7/7), section Téléchargement, état actuel J0→J8 (l'ancien « État J0 » était périmé). |
| **todo.md** | L5 cochée ; S12 marqué calibré ; reste : build Android Studio (PC) et idées optionnelles (best-of-3, Entraînement, Indice, +/−, records détaillés). |

**État final du projet** : jalons J0→J8 livrés — jeu complet publié en releases
`v0.0.10 → v0.0.14` (CI/CD GitHub par tag), équilibrage calibré (S12 : 78.7 /
49.3 / 32.3 % de victoires humaines vs cibles 80/50/30), batterie complète
verte (Vitest 87/87 · scénarios 12/12 · E2E 28/28 · certif RELEASE 7/7).

**Reste ouvert** : build Android Studio sur PC (vérification documentaire),
best-of-3, mode Entraînement, bouton Indice, addition/soustraction,
records détaillés par famille de table (voir `todo.md`, « Idées / dette »).

### Chorégraphie du coup réécrite (2026-11-15)

| Sujet | Contenu |
|-------|---------|
| **Déplacement du coup** | **Marche accélérée** réelle (`marcherVers` : cadence + vitesse accélérées ensemble, `approcheVitesse: 4`) à **distance fixe** (écart de combat − portée de contact, ancré sur la position de repos), à la **fin des mouvements de suivi** (verrou `quandImmobile` sur les déplacements de couple `deplacer`/`corrigerVers`) — jamais en parallèle d'un déplacement, y compris en cas d'égalité de scores (0 = 0). |
| **Séquençage du coup** | Coup porté → **choc/flash/étincelles visibles en même temps** (délai `dureeExtensionMs` supprimé) → **réaction du défenseur** (mouvement de choc `encaisse` ou mouvement de contre `contre`) **après le coup et avant le retour de l'attaquant** → retour en marche accélérée. |
| **Égalité de points** | Le défenseur fait un **mouvement de contre** (esquive + riposte) **au lieu du mouvement de choc** (demande utilisateur) — journal « riposte (égalité) ». |
| **Nettoyage** | `whiff()`, `parade()`, `apresImpact()`, `dureeExtensionMs`, `approcheDureeMs`, `retourDureeMs` supprimés (durée du déplacement dérivée de la distance et de la vitesse de marche). |
| **E2E** | E14 : fenêtre 2200 ms (chorégraphie complète), journal « IA riposte (égalité) » ; **E15 fiabilisé** : hook `figerManoeuvres` (les manœuvres aléatoires du chrono jouaient une marche dans la fenêtre de capture → échec flaky). |
| **Batterie** | typecheck ✅ · Vitest 87/87 · scénarios S01→S11 ✅ · S12 calibration 80.0 / 50.5 / 29.0 % ✅ · E2E 28/28 ✅ (`e2e-2026-11-15T21-21-12.md`). |

### Clé de signature des releases GitHub (2026-11-15)

| Sujet | Contenu |
|-------|---------|
| **Keystore de release** | Nouveau `tools/mathkombat.keystore` (alias `mathkombat`, RSA 4096, validité ~30 ans, SHA-256 `CC:64:…`) avec **mots de passe forts** aléatoires — l'ancien keystore (mots de passe « mathkombat ») est archivé en `tools/mathkombat.keystore.vieux`. |
| **Fichiers locaux** | `tools/keystore.env` (mots de passe, chmod 600) et `tools/secrets-github.txt` (les 4 secrets prêts à coller dans l'UI GitHub) — **`tools/` n'est PAS versionné** (valeurs jamais commitées). |
| **Build** | `scripts/build-apk.sh` source `tools/keystore.env` si présent (mots de passe fournis) ; sinon repli dev (défauts `build.gradle`). Le workflow CI lira les 4 secrets : `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. |
| **Secrets GitHub** | `gh secret set` refuse (HTTP 403 — PAT sans permission « Actions secrets: write »). **Action utilisateur** : ajouter les 4 secrets via l'UI (Settings → Secrets and variables → Actions), valeurs dans `tools/secrets-github.txt`. En attendant, les releases restent signées avec la clé debug. |

### Release v0.0.15 (2026-11-15)

| Sujet | Contenu |
|-------|---------|
| **Contenu** | Chorégraphie du coup réécrite (marche accélérée 4× à distance fixe, effets au coup porté, réactions séquencées, contre sur égalité) + source `tools/keystore.env` pour la signature. |
| **Validation pré-tag** | Batterie complète sur l'état final : typecheck ✅ · Vitest 87/87 · scénarios S01→S11 ✅ · S12 calibration 80.0 / 50.5 / 29.0 % ✅ · **E2E 28/28 ✅** (`e2e-2026-11-15T22-09-11.md`, E15 stabilisé par `figerManoeuvres`). |
| **Publication** | Tag `v0.0.15` → CI (2m32s) → release GitHub avec `MathKombat-0.0.15-release.apk` + `-debug.apk` (signés clé debug — secrets `KEYSTORE_*` encore à poser). |

### Cohérence version produit ↔ tag (2026-11-15)

| Sujet | Contenu |
|-------|---------|
| **Constat** | L'APK portait `versionName '0.1.0'` / `versionCode 1` **figés** dans `build.gradle` alors que la release était `v0.0.15` (seul le nom de fichier suivait le tag) ; le log `session.debut` du jeu durcissait aussi `version: '0.1.0', build: 'debug'`. |
| **Règle** | **La source de vérité est le tag git `v*`** : `scripts/env.sh` résout `MK_VERSION` (tag exact → `git describe` → repli `0.0.0-dev`) et l'injecte partout — `versionName` de l'APK (`versionCode` dérivé du semver `x*10000+y*100+z` : 0.0.15 → 15), log du jeu (`__MK_VERSION__` via vite.config), nom des APK (CI). |
| **CI** | Étape « Version du produit » (tag → `MK_VERSION` en `$GITHUB_ENV`) ; l'étape Vérifications **refuse le build** si `aapt dump badging` ne montre pas `versionName='<version du tag>'` sur les deux APK ; re-publication d'un tag = remplacement des assets homonymes (boucle `delete-asset` élargie). |
| **Correctif signature** | PKCS12 : `keyPassword` **doit** valoir `storePassword` (« Given final block not properly padded » au build) — `tools/keystore.env` et `tools/secrets-github.txt` réalignés (KEY_PASSWORD = KEYSTORE_PASSWORD). |
| **Validation** | `MK_VERSION=0.0.15 bash scripts/build-apk.sh` → `aapt` : `versionName='0.0.15' versionCode='15'` ✅ · bundle : `session.debut {version:'0.0.15', build:'release'}` ✅ · typecheck ✅ · Vitest 87/87 · scénarios TOUT VERT · certif RELEASE 7/7 · E2E 28/28 (`e2e-2026-11-15T23-21-34.md`). |
| **Re-publication v0.0.15** | Tag `v0.0.15` déplacé `c8734f1 → 9a39ff9` (choix utilisateur : re-publier plutôt qu'une v0.0.16) → CI (2m33s) → assets de la release **remplacés**. Contrôle sur l'artefact téléchargé depuis GitHub : `versionName='0.0.15' versionCode='15'` ✅. |
### Session 2026-11-22

### Session 2026-11-24 — SÉLECTION §3 / CONFIG / quatre opérations

| Sujet | Contenu |
|-------|---------|
| **Demande utilisateur** | L'implémentation précédente a été rejetée (« c'est n'importe quoi », « corrige ») : en solo, le sélectionneur doit proposer le niveau et le type de calcul pour J1 **et** le personnage de l'IA ; le niveau de calcul ne sert à rien dans CONFIG, seule la difficulté IA est utile et doit être remontée sur l'écran de lancement ; le bouton LANCER doit être descendu et le menu aéré. |
| **Opérations** | `+` et `−` réellement implémentées dans `math-generator.ts` (soustraction à résultat positif, bornes de niveau par fait sous-jacent). L'attaque utilise l'opération choisie par le joueur, la défense `operationInverse()` de son propre couple. Le sélecteur propose **deux couples** — `MULT × / DIV ÷` ou `ADD + / SOUS −` — et non quatre opérations indépendantes. |
| **Écran SÉLECTION (§3)** | Deux **blocs regroupés par joueur**, séparés par un filet, sans superposition ni mélange : **J1** = personnage + niveau + son couple ; **adversaire** = IA (personnage + difficulté remontée de CONFIG, pas de ligne de niveau) ou J2 (personnage + niveau + son couple). Lignes espacées de 65 px, bouton `[ ▶ LANCER LE COMBAT ]` descendu à `y=595`. Libellés longs abrégés (`LIBELLES_OPERATION_COURT`) pour ne pas chevaucher les flèches. |
| **CONFIG (§2)** | Les lignes NIVEAU et DIFFICULTÉ IA ont été retirées ; une note renvoie vers SÉLECTION. Les couples `operations` sont transmis au `CombatEngine` depuis `selection` (`FightScene`), avec repli sur `CONFIG.operation`. |
| **Moteur / HUD** | `CombatEngine` accepte `operations: Record<IdJoueur, TypeOperation>` ; les libellés `ATTAQUE … / DÉFENSE …` et le hook `etat().operations` suivent la phase courante. |
| **Docs & tests** | `AGENTS.md`, `todo.md`, `docs/test-plan.md` (I6/I14) et `docs/wireframes.md` (§2/§3, géométrie) alignés ; `config.test.ts`, `math-generator.test.ts`, `combat-engine.test.ts` (couples par joueur) et `scripts/e2e.mjs` (E12) mis à jour. |
| **Batterie** | `npm run typecheck` ✅ · Vitest **94/94** ✅ (`21:32`) · scénarios **S01→S11** ✅ (`output/reports/scenarios-2026-11-24T21-36-03.md`) · **E2E 28/28** ✅ (`output/reports/e2e-2026-11-24T21-32-45.md`, E12 : `niveauJ1=debutant skinIA=karateka difficulteIA=facile calculJ1=addition`). |
| **Livraison** | Choix utilisateur : commit + tag `v0.0.18`. Commit `5f11e36` sur `main`, tag local `v0.0.18` posé après batterie verte. `bash scripts/build-apk.sh` → `output/MathKombat.apk` (36 M) : `aapt` `versionCode='18' versionName='0.0.18'`, bundle `__MK_VERSION__ = 0.0.18` ✅. **Certification RELEASE 7/7** (`output/reports/certif-release-2026-11-24T21-38-47.md`). **Push** (accord utilisateur) : `main` + tag `v0.0.18` poussés sur `origin` → CI `45493854976` verte en 2m29s → release GitHub publiée avec `MathKombat-0.0.18-release.apk` et `-debug.apk` ; APK release téléchargée et vérifiée (`aapt` : `versionCode='18' versionName='0.0.18'`) ✅. |

### Session 2026-11-25 — signature des APK : cause du refus de mise à jour

| Sujet | Contenu |
|-------|---------|
| **Symptôme** | L'utilisateur signale que la mise à jour ne s'installe pas, « comme si la signature n'était pas valide ». |
| **Diagnostic** | `apksigner verify --print-certs` sur les APK release publiées : empreintes SHA-256 **toutes différentes** — v0.0.14 `bca4…3a46`, v0.0.15 `0b45…2bf8`, v0.0.16 `017f…6011`, v0.0.17 `907f…69c` , v0.0.18 `8277…71a1`. Le log de la CI `45493854976` confirme : `KEYSTORE_BASE64` vide → « Aucun keystore » → `build-apk.sh` **génère un keystore aléatoire à chaque run** (`tools/` n'est pas versionné). Android refuse donc toute mise à jour (certificat changé). Le keystore local `tools/mathkombat.keystore` (`cc64…9808`) ne correspond à aucune release publiée ; le debug était lui aussi régénéré à chaque CI. |
| **Décision utilisateur** | Stabiliser via les **secrets GitHub** (le PAT courant a un HTTP 403 sur `gh secret list` : ajout manuel nécessaire) et publier une **nouvelle v0.0.19** (ne pas réécrire le tag v0.0.18). |
| **Clé retenue** | Sur demande utilisateur, clé de `/data/data/com.termux/files/home/.openwebui-release/release.keystore` (alias `openwebui-release`, PKCS12, mot de passe = `.password` = `CREDENTIALS.txt`, empreinte **`7fa25845d80017c8cd81669e2955de6d21b2d7ac4a5a0d5f0fa981866dc34e4`**). Anciens fichiers locaux sauvegardés dans `tools/backup-signature-2026-11-25/` ; `tools/keystore.env` et `tools/secrets-github.txt` régénérés (non versionnés, valeurs jamais commitées). |
| **Correctif CI** | `.github/workflows/build-apk.yml` : les 4 secrets sont désormais **obligatoires** (échec immédiat si absent, plus de repli aléatoire) ; étape « Vérifications » **épingle** l'empreinte `7fa2…4e4` via `apksigner` sur les deux APK. `build.gradle` : l'APK debug est signée avec la même clé de release injectée par les secrets. **Aucun keystore ni secret n'est versionné** (`git ls-files` vérifié) : `tools/` reste ignoré et les valeurs ne sont jamais affichées. `AGENTS.md` §8 documente la règle. |
| **Conséquence utilisateur** | Les versions déjà installées (v0.0.14→v0.0.18, clés éphémères perdues) **doivent être désinstallées une fois** ; à partir de v0.0.19 les mises à jour se feront normalement avec la clé stable. |
| **Historique git** | Scan complet (`git grep -F` sur tous les commits, motifs = mots de passe + base64 des deux keystores) : **aucune occurrence** dans MathKombat ; même résultat dans `openwebui-android`. Aucune réécriture d'historique nécessaire, aucun force-push. Fichiers temporaires de motifs supprimés. |
| **Validation** | `MK_VERSION=0.0.19 bash scripts/build-apk.sh` ✅ (`versionCode='19' versionName='0.0.19'`) · APK debug Gradle ✅ (même version) — les deux certificats SHA-256 valent `7fa25845…dc34e4` ✅ · Vitest **94/94** ✅ · YAML CI valide ✅ · `git ls-files` : aucune clé suivie ✅. |
| **Complément CI (26-11)** | L'étape « Build APK debug » ne transmettait pas `KEYSTORE_PASSWORD`/`KEY_ALIAS`/`KEY_PASSWORD` : avec `build.gradle` signant le debug avec la clé release, Gradle aurait utilisé les valeurs par défaut et échoué à ouvrir le keystore PKCS12. Secrets ajoutés à cette étape + commentaire d'en-tête du workflow mis à jour. Simulation du chemin CI exact (keystore décodé depuis le base64 des secrets + env injectés au seul build debug) → APK debug `7fa2…4e4` ✅, YAML valide ✅. |
| **Alias (26-11, demande utilisateur)** | L'alias du keystore passe de `openwebui-release` à **`mathkombat`** (`keytool -changealias` sur une copie locale : clé privée et certificat inchangés, empreinte toujours `7fa2…4e4`). `tools/keystore.env` et `tools/secrets-github.txt` régénérés avec le nouveau base64 et `KEY_ALIAS=mathkombat` (non versionnés). Rebuild release + debug locaux `0.0.19` ✅ : les deux certificats valent `7fa25845…dc34e4`. **Action utilisateur** : mettre à jour les secrets GitHub `KEY_ALIAS` (`mathkombat`) et `KEYSTORE_BASE64` (nouvelle valeur) ; `KEYSTORE_PASSWORD` / `KEY_PASSWORD` inchangés. |
| **Échec CI (26-11, runs `45726554089` puis `45726948931`)** | 1er run : `No key with alias '…' found` — `KEY_ALIAS` et `KEYSTORE_BASE64` pas cohérents côté GitHub. **Correctif 1** : la CI lit l'alias **dans le keystore décodé** (`keytool -list`), avec avertissement si le secret diverge, et l'injecte via `GITHUB_ENV` aux deux builds. 2e run : les deux builds ✅ mais `Vérifications` échoue. **Correctif 2** : diagnostic ajouté (empreintes affichées). 3e run : empreinte release = empreinte debug = **64 caractères**, mais la constante épinglée n'en avait que **63** (`c` manquant après `cd81669e`) — erreur de frappe dans la valeur que j'avais saisie ; les APK étaient correctement signées. **Correctif 3** : constante corrigée en `7fa25845d80017c8cd81669ec2955de6d21b2d7ac4a5a0d5f0fa981866dc34e4`. |
| **Livraison v0.0.19 ✅ (26-11)** | Commit final `155e2f0`, tag `v0.0.19` redéplacé. CI `45727887290` **verte en 3m23s** (toutes les étapes, dont Keystore, Vérifications, Nommage et Publication). Release publiée : https://github.com/FredSources/Mathkombat/releases/tag/v0.0.19 avec `MathKombat-0.0.19-release.apk` et `-debug.apk`. **Vérification des APK téléchargées** : `aapt` → `versionCode='19' versionName='0.0.19'` pour les deux ; `apksigner` → certificat `7fa25845d80017c8cd81669ec2955de6d21b2d7ac4a5a0d5f0fa981866dc34e4` **identique** sur release et debug ✅. À partir de cette version, les mises à jour Android se font sans désinstallation ; les versions v0.0.14→v0.0.18 restent à désinstaller une fois (clés éphémères perdues). |
