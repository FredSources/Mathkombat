#!/usr/bin/env bash
# scripts/build.sh — build web DEBUG/RELEASE (J1).
# Usage : bash scripts/build.sh [debug|release]   (défaut : release)
# Sortie : game/dist/ (chemins relatifs, prêt pour l'embarquement APK en J7)
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/env.sh"

MODE="${1:-release}"
if [ "$MODE" != "debug" ] && [ "$MODE" != "release" ]; then
  echo "Usage : bash scripts/build.sh [debug|release]" >&2
  exit 1
fi

cd "$PROJ/game"
[ -d node_modules ] || { log "node_modules absent — npm install …"; npm install; }

log "typecheck (TypeScript strict) …"
npm run --silent typecheck

log "vite build --mode $MODE …"
npm run --silent build -- --mode "$MODE"

log "build web ($MODE) → game/dist/ ($(du -sh dist | cut -f1))"
ls dist
