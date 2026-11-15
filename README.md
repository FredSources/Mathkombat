# MathKombat — jeu de combat éducatif (Android)

Combat 2D style *Mortal Kombat* / *Street Fighter* — **6 combattants animés**
(KENJI, KIRA, TITAN, NYX, ZANE, BLAZE) en sprites, manœuvres et sauts pendant
le chronomètre, K.O. en bascule arrière — où la puissance des coups se gagne
en résolvant des calculs mentaux :

- **Attaque** → multiplications (Facile **+1**, Moyen **+3**, Difficile **+7** d'énergie) ;
- **Défense** → divisions (même barème) ; la défense se retranche à l'attaque ;
- **Solde négatif** → **contre-attaque** de la valeur absolue du solde.

## Téléchargement (Android)

Les APK signés sont publiés sur les
[releases GitHub](https://github.com/FredSources/Mathkombat/releases) :
`MathKombat-<version>-release.apk` (recommandé) et `-debug.apk`.
La CI (GitHub Actions) construit et publie chaque version sur un tag `vX.Y.Z`.

## Le jeu

- **Solo vs IA** (3 niveaux) ou **2 joueurs** sur le même appareil ; le niveau
  d'IA indique son **score moyen** d'attaque/défense (Facile 21 · Moyen 23 ·
  Difficile 24) — l'IA est « gentille » et toujours battable.
- **Temps des calculs** : 1 calcul = 2 s de saisie + calcul — moins de temps de
  phase = score plus faible (humain comme IA).
- **Rythme de calcul** : Simultané (défaut, un seul chrono) ou Différé ;
  durée de phase configurable 5–60 s.
- **Niveaux de calcul** : Débutant (tables 1–5), Intermédiaire (1–10),
  Avancé (1–12, seul niveau où apparaissent les tables 11 et 12).
- **Équilibrage vérifié (S12)** : un joueur de référence gagne ≈ **80 % / 50 % /
  30 %** contre l'IA Facile / Moyenne / Difficile.
- Score de combat en temps réel, **HIGH SCORE** persistant, pause ☰ MENU,
  sélection de personnage et de niveau, plein écran hors-ligne.

## Démarrage rapide

```bash
source scripts/env.sh          # isolation : tous les chemins dans le projet
bash scripts/setup-sdk.sh      # première fois : installe tools/ (SDK+Gradle+JDK)
node scripts/log-collector.js  # terminal dédié : collecte des logs (mode DEBUG)
bash scripts/smoke.sh          # vérifications rapides du socle
cd game && npm install && npm run dev  # jeu web de développement
bash scripts/build-apk.sh      # APK release → output/MathKombat.apk
```

## Qualité

| Batterie | Résultat |
|----------|----------|
| Vitest (cœur pur : maths, combat, IA, config, score) | 87/87 · couverture 100 % |
| Scénarios headless (S01→S12) | 12/12 |
| E2E navigateur (E01→E16) | 28/28 |
| Certification RELEASE (zéro log, zéro réseau) | 7/7 |

## Documentation

| Document | Contenu |
|----------|---------|
| `AGENTS.md` | **Source de vérité** : objectif, gameplay, stack, conventions, roadmap |
| `docs/architecture.md` | Protocole de log par socket, modes DEBUG/RELEASE |
| `docs/test-plan.md` | Plan de test pilotable (L0→L5, invariants, scénarios) |
| `docs/pitch.md` | Pitch court / long, cible, différenciation |
| `docs/wireframes.md` | Wireframes textuels écran par écran (lancement rétro RUN/CONFIG, combat…) |
| `docs/assets.md` | Méthode de production des images et sprites (génération, découpe, spritesheets) |
| `journal.md` | Journal des choses produites |
| `todo.md` | Tâches et planification |

## État actuel

**Jalons J0→J8 livrés** : socle, jeu complet (calculs, combat, IA, animations,
modes Solo/Duel, APK), CI/CD GitHub (release par tag), équilibrage calibré (S12).
Version courante : **v0.0.14**. Suites possibles : best-of-3, mode Entraînement,
bouton Indice, addition/soustraction (voir `todo.md`).
