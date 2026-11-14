# Architecture — observabilité, modes DEBUG/RELEASE, flux de build

Ce document décrit le socle d'observabilité du projet MathKombat : évacuation des logs
par socket, protocole d'enregistrement, modes de build, et flux de données utilisés par
l'agent pour analyser le jeu en fonctionnement.

## 1. Vue d'ensemble

```
┌─ Jeu (Phaser, navigateur ou WebView) ─┐        ┌─ Collecteur (Node, zéro dépendance) ─┐
│  game/src/core/logger.ts              │  WS    │  scripts/log-collector.js             │
│   ├─ DEBUG : envoie chaque événement ─┼──────► │   ├─ sortie console filtrée           │
│   │          + console locale         │ ou TCP │   └─ output/logs/<session>.jsonl      │
│   └─ RELEASE : no-op compilé (rien)   │  brut  │        (source d'analyse de l'agent)  │
└───────────────────────────────────────┘        └───────────────────────────────────────┘
```

Le collecteur tourne dans un terminal dédié pendant les sessions de debug et de test.
Les fichiers JSONL produits sont la matière première des analyses (débug, rapports de
scénarios, preuves de test) — l'agent les lit avec `grep`/`jq`, jamais le jeu lui-même.

## 2. Protocole d'évacuation par socket

- **Port par défaut** : `8765` (TCP).
- **Deux protocoles acceptés sur le même port** (détection au premier octet) :
  1. **WebSocket** (RFC 6455) — utilisé par le jeu dans le navigateur/la WebView.
     Le collecteur répond à l'upgrade HTTP, gère ping/pong et close.
  2. **TCP brut, flux JSONL** — utilisé par les sondes (`scripts/ws-probe.mjs`) et
     tout client non-navigateur. Une ligne = un enregistrement JSON.
- Le client WebSocket natif est utilisé côté jeu (aucune dépendance npm pour le log).
- **File tampon côté client** : si le socket n'est pas connecté, les enregistrements
  sont mis en mémoire tampon (500 max, puis débordement silencieux des plus anciens)
  et rejoués à la connexion. Aucun log ne bloque jamais le jeu.

## 3. Format d'enregistrement (JSONL)

```json
{
  "ts": "2026-11-12T21:00:00.000Z",   // horodatage ISO 8601 (client)
  "seq": 42,                           // compteur monotone par session
  "session": "fight-20261112-2100",    // identifiant de session/partie
  "build": "debug",                    // "debug" | "release"
  "level": "debug",                    // trace | debug | info | warn | error
  "scene": "Fight",                    // scène Phaser ou module émetteur
  "event": "combat.coup_resolu",       // <domaine>.<action> (nomenclature §4)
  "data": { "attaque": 7, "defense": 10, "solde": -3, "contre": 3 }
}
```

Champs obligatoires : `ts`, `seq`, `session`, `build`, `level`, `scene`, `event`.
`data` est optionnel (objet JSON plat, sérialisable).

## 4. Nomenclature des événements

| Domaine | Exemples | Émetteur |
|---------|----------|----------|
| `math.*` | `math.genere`, `math.reponse` | `core/math-generator` + quiz |
| `combat.*` | `combat.phase`, `combat.coup_resolu`, `combat.ko` | `core/combat-engine` |
| `ia.*` | `ia.choix_difficulte`, `ia.reponse` | `core/ai-controller` |
| `ui.*` | `ui.clic`, `ui.saisie`, `ui.validation`, `ui.effacement`, `ui.timer_fin` | `scenes/`, `ui/` |
| `anim.*` | `anim.impulsion`, `anim.frappe_tier`, `anim.garde`, `anim.contre`, `anim.ko` | `scenes/` (mise en scène §2.8) |
| `session.*` | `session.debut`, `session.fin` | bootstrap |
| `erreur.*` | `erreur.orchestration` | partout (niveau `error`) |

## 5. Modes DEBUG / RELEASE

| Aspect | DEBUG (`npm run dev`, build `--mode debug`) | RELEASE (`npm run build`) |
|--------|--------------------------------------------|---------------------------|
| Logger | actif, niveau `trace` (configurable `?log=info`) | **no-op compilé** (aucune chaîne, aucun appel) |
| Socket | connexion auto `ws://127.0.0.1:8765` (file tampon + reconnexion) | **aucune tentative de connexion** |
| Console | logs console + FPS | silencieux |
| HUD debug | oui (FPS, scène, état combat) | non |
| Assertions | actives | compilées hors build |

Implémentation : constante `__BUILD_MODE__` injectée par Vite (`define`). En RELEASE,
les appels `logger.x()` sont élagués par le bundler (branches mortes) : coût zéro.

## 6. Collecteur — usage

```bash
node scripts/log-collector.js                      # port 8765, écrit output/logs/
node scripts/log-collector.js --port 9000          # autre port
node scripts/log-collector.js --grep coup_resolu   # filtre console par motif
node scripts/log-collector.js --level info         # console >= info (fichier : tout)
```

- **Fichier** : `output/logs/<session>.jsonl` (tout est conservé, source de vérité).
- **Console** : format lisible, filtrée par `--level` / `--grep`.
- **Arrêt** (Ctrl-C) : résumé (nb d'enregistrements, nb de sessions, fichiers écrits).
- Les fichiers de log sont **conservés** : ce sont des artefacts de test et de debug
  (référencés dans `journal.md`). Purge manuelle uniquement.

## 7. Analyse par l'agent

L'agent analyse le comportement du jeu sans le regarder tourner :

```bash
# déroulé d'une partie
grep '"event":"combat\.' output/logs/<session>.jsonl | jq -c '{ts,event,data}'
# erreurs
grep '"level":"error"' output/logs/*.jsonl
# vérifier une règle métier (contre-attaque)
grep 'coup_resolu' output/logs/<session>.jsonl | jq -c 'select(.data.solde < 0)'
```

Ces requêtes sont utilisées telles quelles dans le plan de test (`docs/test-plan.md`)
comme **oracles automatisés**.

## 8. Flux de build (aperçu, complété aux jalons)

```
game/ (TS+Phaser) ── vite build ──► dist/ ── copié dans android/app/src/main/assets/
                                              └─ gradle assembleDebug ──► output/MathKombat.apk
```

- `scripts/env.sh` : ancrage des chemins (SDK, JDK, Gradle, caches) dans le projet.
- `scripts/build.sh` : build web (DEBUG ou RELEASE selon `--mode`).
- `scripts/build-apk.sh` : APK avec **exclusivement** les outils de `tools/`.
- Sur PC : `android/` s'ouvre dans Android Studio (projet Gradle standard).

---

## 9. Modèle de Personnage — interface unique et skins

> **Statut : IMPLÉMENTÉ** (2026-11-14) dans `game/src/rig/personnage.ts` — avec
> l'interface de **déplacements effectifs** (`vaAGauche`/`vaADroite`/`vaEnHaut`/
> `vaEnBas`, bornés à l'arène), exigée complète même avant d'être utilisée par
> le gameplay.

**Objectif** : *changer facilement le skin d'un personnage* et n'avoir **qu'une seule
interface** à appeler pour le faire bouger. Décision d'architecture (session
2026-11-14), applicable dès J6 (sélection de personnage).

### 9.1 État des lieux (ce que cette section remplace)

Aujourd'hui la responsabilité est éclatée :

| Fragment | Où | Problème |
|----------|----|----------|
| `interface Combattant` | `FightScene.ts` | sac de références (corps, aura, rig, membres, teinte, palier…) — pas de comportement |
| `creerCombattant`, `construireRig`, `animerCoup`, `animerMembre`, `sauter`, `animBlocage`, `animContre`, `animWhiff`, `animFrappe`, `impulsionAura`, `majAura`, `vaciller` | méthodes **privées de `FightScene`** | ~12 méthodes de présentation dans la scène, qui doit rester de l'orchestration (§7) |
| direction du coup | **paramètre** `droite: boolean` / `versAttaquantDroite` | ré-cheminé à chaque appel, ressemble à du code dupliqué |
| skin | `texture: string` + `PROFONDEURS_RIG[texture] ?? PROFONDEURS_RIG.persoA` | fallback **codé en dur** : ajouter un skin oblige à toucher au code |

### 9.2 Cible : une classe `Personnage`, une seule interface

Emplacement : `game/src/rig/personnage.ts` (présentation Phaser — **pas** `core/`,
qui reste pur ; les **intensités** restent dans `config.ts` §2.8, `Personnage` les
*lit* sans jamais les contenir).

```ts
export type Orientation = 'gauche' | 'droite';
export type CoupDePoing = 'direct' | 'uppercut' | 'crochet';
export type CoupDePied  = 'haut' | 'bas';

export class Personnage {
  readonly id: string;
  readonly skin: SkinPersonnage;   // le skin est une DONNÉE, pas du code
  orientation: Orientation;        // état de l'instance, pas un paramètre

  // déplacement / garde
  orienter(o: Orientation): void;  // miroir du rig + table de profondeurs
  vaAGauche(): void;
  vaADroite(): void;
  gardeHaute(): void;
  gardeBasse(): void;

  // vocabulaire de coups — interface UNIQUE, quel que soit le skin
  coupDePoing(c: CoupDePoing): void;   // direct / uppercut / crochet
  coupDePied(c: CoupDePied): void;     // haut / bas
  saut(): void;
  parade(coup: Coup): void;
  contre(): void;
  encaisse(tier: number): void;
  ko(): void;

  // énergie (§2.8a) — intensité lue dans config.ts
  charger(energie: number): void;
  impulsion(gain: number): void;
}
```

La scène n'appelle plus que `this.j1.coupDePoing('uppercut')` — **un** point d'accès,
quelle que soit l'orientation et le skin.

### 9.3 Skin = descripteur de données

```ts
export interface SkinPersonnage {
  id: string;                                  // 'persoA' | 'persoB' | …
  pieces: Record<Membre, string>;              // textures des 5 pièces cut-out
  meta: MetaRig;                               // pivots épaule / hanche
  profondeurs: Record<Membre, number>;         // ordre de recouvrement
  teintes: { lueur: number; coeur: number };   // teinte d'aura
}
```

- **changer de skin = changer de descripteur** (une ligne de config / de sélection) ;
- **ajouter un skin = ajouter un fichier de textures + un descripteur**, sans modifier
  `FightScene` ni `Personnage` ;
- le fallback `?? PROFONDEURS_RIG.persoA` codé en dur **disparaît** : un skin non
  déclaré est une erreur explicite, pas un rendu silencieusement faux.

### 9.4 Héritage : où il sert, où il ne sert pas

Règle retenue — **héritage pour le comportement, données pour l'apparence, état pour
l'orientation** :

| Distinction | Nature | Mécanisme retenu | Pourquoi |
|-------------|--------|------------------|----------|
| **gauche / droite** | **état** : sens de l'image + table de profondeurs miroir | champ `orientation` + `orienter()` | ce n'est pas un comportement : dans le code actuel ça se résume à `base * (droite ? -1 : 1)` et à `PROFONDEURS_RIG.persoB` = miroir exact de `persoA` — **deux valeurs, pas deux classes**. Deux sous-classes `PersonnageDroite`/`PersonnageGauche` obligeraient à surcharger toutes les méthodes (duplication) ou à ne changer qu'un champ (revenu à l'état). |
| **skin / sprite** | **apparence** | descripteur `SkinPersonnage` (composition) | si un skin ne change que textures, pivots, profondeurs et teintes → c'est de la donnée ; l'héritage y ajouterait des classes vides. |
| **skin avec comportement propre** (coup exclusif, garde spécifique) | **comportement** | **héritage** : `class PersonnageSpecial extends Personnage { override coupDePoing(...) }` | seul cas où l'héritage est justifié : un *override* réel de méthode. |

Conséquence pratique : l'héritage reste **disponible et prévu** (`Personnage` est la
classe de base non scellée), mais on n'introduit une sous-classe que le jour où un
personnage diffère par un **comportement**, jamais par une couleur ou un fichier PNG.

### 9.5 Gains attendus

- `FightScene` perd ses ~12 méthodes d'animation → orchestration seule (§7 : les
  scènes ne contiennent pas de logique métier ni de logique de présentation fine).
- Les signatures perdent `droite: boolean` / `versAttaquantDroite` — plus aucun
  paramètre de sens à ré-cheminer.
- Ajouter un personnage = **0 modification de scène**, conformément à la règle
  « aucun code dupliqué : une seule classe, instanciée avec ses données ».
