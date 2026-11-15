#!/usr/bin/env bash
# scripts/env.sh — ancrage ISOLATION : tout le projet vit sous $PROJ.
# Usage : source scripts/env.sh  (ou `bash scripts/xxx.sh` qui le source).
# Règle : aucun chemin hors projet (hors prérequis système bash + node).
set -eu 2>/dev/null || true

# --- Racine du projet (le script refuse de tourner ailleurs) ---
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f "$PROJ/AGENTS.md" ]; then
  echo "ERREUR: racine projet introuvable ($PROJ) — refus de continuer." >&2
  return 1 2>/dev/null || exit 1
fi
export PROJ

# --- Tout est dans le projet ---
export ANDROID_HOME="$PROJ/tools/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="$PROJ/tools/jdk"
export GRADLE_USER_HOME="$PROJ/.gradle-cache"
export npm_config_cache="$PROJ/.npm-cache"
export TMPDIR="$PROJ/.tmp"
export XDG_CACHE_HOME="$PROJ/.xdg-cache"

mkdir -p "$ANDROID_HOME" "$GRADLE_USER_HOME" "$npm_config_cache" \
         "$TMPDIR" "$XDG_CACHE_HOME" "$PROJ/output/logs" \
         "$PROJ/output/reports" "$PROJ/output/screenshots"

# JDK portable du projet en tête de PATH (javac requis pour le build APK)
if [ -x "$JAVA_HOME/bin/java" ]; then
  export PATH="$JAVA_HOME/bin:$PROJ/tools/gradle/gradle-*/bin:$PATH"
fi

# --- Version du produit — SOURCE DE VÉRITÉ : le tag git v* ---
# Priorité : MK_VERSION (env, ex. CI) > tag exact sur HEAD > describe (dev) >
# repli. Injectée dans le jeu web (__MK_VERSION__, vite.config) et dans l'APK
# (versionName/versionCode, android/app/build.gradle) : jamais durcie ailleurs.
if [ -z "${MK_VERSION:-}" ]; then
  MK_VERSION="$(git -C "$PROJ" describe --tags --exact-match 2>/dev/null | sed 's/^v//')" || true
fi
if [ -z "${MK_VERSION:-}" ]; then
  MK_VERSION="$(git -C "$PROJ" describe --tags 2>/dev/null | sed 's/^v//')" || true
fi
export MK_VERSION="${MK_VERSION:-0.0.0-dev}"

log() { printf '\033[1;34m[env]\033[0m %s\n' "$*"; }
log "PROJ=$PROJ"
log "ANDROID_HOME=$ANDROID_HOME$([ -d "$ANDROID_HOME/platforms" ] && echo ' (OK)' || echo ' (pas encore installé — lancer scripts/setup-sdk.sh)')"
log "JAVA_HOME=$JAVA_HOME$([ -x "$JAVA_HOME/bin/javac" ] && echo ' (OK)' || echo ' (pas encore installé)')"
log "node=$(command -v node || echo 'ABSENT (prérequis système)')"
