#!/usr/bin/env bash
# scripts/smoke.sh — Smoke tests L0 (docs/test-plan.md) : le socle d'observabilité vit.
#   1. le collecteur démarre et écoute ;
#   2. l'évacuation par socket fonctionne (WebSocket ET TCP brut) ;
#   3. les enregistrements sont bien écrits en JSONL dans output/logs/.
# Usage : bash scripts/smoke.sh [--port 8787]
# Sortie : code 0 = PASS, 1 = FAIL. Artefact : output/logs/smoke-l0.jsonl
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/env.sh"

PORT="${1:-8787}"
[ "${1:-}" = "--port" ] && PORT="${2:-8787}"
SESSION="smoke-l0"
FICHIER="$PROJ/output/logs/$SESSION.jsonl"
JOURNAL="$PROJ/.tmp/collecteur-smoke.log"
ECHECS=0

ok()   { printf '\033[1;32m[PASS]\033[0m %s\n' "$*"; }
ko()   { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*"; ECHECS=$((ECHECS+1)); }

rm -f "$FICHIER"
mkdir -p "$PROJ/.tmp"

# --- 1. démarrage du collecteur ---
node "$PROJ/scripts/log-collector.js" --port "$PORT" --dir "$PROJ/output/logs" >"$JOURNAL" 2>&1 &
COLLECTEUR=$!
for _ in $(seq 1 20); do
  grep -q "en écoute" "$JOURNAL" 2>/dev/null && break
  sleep 0.2
done
if grep -q "en écoute" "$JOURNAL" 2>/dev/null; then
  ok "collecteur démarré et en écoute (port $PORT)"
else
  ko "collecteur non démarré (voir $JOURNAL)"
  kill $COLLECTEUR 2>/dev/null; exit 1
fi

# --- 2. évacuation par socket (WS + TCP brut) ---
if node "$PROJ/scripts/ws-probe.mjs" --port "$PORT" --session "$SESSION"; then
  ok "sonde : handshake WebSocket vérifié, ping/pong OK, 5 enregistrements émis (3 WS + 2 TCP)"
else
  ko "sonde : échec (voir sortie ci-dessus)"
fi

# --- 3. fichier JSONL produit et valide ---
sleep 0.3
NB=$(grep -c '"session":"'"$SESSION"'"' "$FICHIER" 2>/dev/null || echo 0)
if [ "$NB" -ge 5 ]; then
  ok "fichier JSONL : $NB enregistrements dans ${FICHIER#$PROJ/}"
else
  ko "fichier JSONL : $NB/5 enregistrements dans ${FICHIER#$PROJ/}"
fi

if node -e '
  const fs = require("fs");
  const lignes = fs.readFileSync(process.argv[1], "utf8").trim().split("\n");
  let n = 0;
  for (const l of lignes) {
    const r = JSON.parse(l); // lève si invalide
    for (const c of ["ts","seq","session","build","level","scene","event"])
      if (!(c in r)) throw new Error("champ manquant: " + c);
    n++;
  }
  console.log(n + " enregistrements valides (format JSONL conforme)");
' "$FICHIER" 2>/dev/null; then
  ok "format JSONL conforme (champs obligatoires présents)"
else
  ko "format JSONL non conforme"
fi

for ev in smoke.ws_1 smoke.ws_2 smoke.ws_3 smoke.tcp_1 smoke.tcp_2; do
  if grep -q "\"event\":\"$ev\"" "$FICHIER" 2>/dev/null; then
    ok "événement $ev reçu"
  else
    ko "événement $ev absent"
  fi
done

# --- arrêt propre du collecteur (résumé) ---
kill -INT $COLLECTEUR 2>/dev/null
wait $COLLECTEUR 2>/dev/null

echo
if [ "$ECHECS" -eq 0 ]; then
  printf '\033[1;32mSMOKE L0 : PASS\x1b[0m (%s)\n' "$FICHIER"
  exit 0
else
  printf '\033[1;31mSMOKE L0 : FAIL (%d échec(s))\x1b[0m — voir %s\n' "$ECHECS" "$JOURNAL"
  exit 1
fi
