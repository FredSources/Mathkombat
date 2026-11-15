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

## Démarrage rapide

```bash
source scripts/env.sh        # isolation : tous les chemins dans le projet
bash scripts/setup-sdk.sh    # première fois : installe tools/ (SDK+Gradle+JDK)
node scripts/log-collector.js  # terminal dédié : collecte des logs (mode DEBUG)
bash scripts/smoke.sh        # vérifications rapipes du socle
```

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

**Jalon J0 — socle** : documentation, collecteur de logs, logger, plan de test,
SDK embarqué. Le jeu lui-même arrive aux jalons J1→J8 (voir `todo.md`).
