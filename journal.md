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
