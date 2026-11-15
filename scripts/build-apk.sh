#!/usr/bin/env bash
# scripts/build-apk.sh — build de l'APK RELEASE MathKombat (J7).
#
# Usage : bash scripts/build-apk.sh
# Sortie : output/MathKombat.apk (signé, jouable hors-ligne).
#
# Règle d'isolation (AGENTS.md §4) : SDK, Gradle, JDK et keystore vivent dans
# tools/ et .gradle-cache/ — aucun chemin hors projet, aucun outil système
# hors bash et node. Le jeu web est la SEULE source du contenu (game/dist/).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/env.sh"

# ---------------------------------------------------------- 1. jeu web RELEASE
bash "$PROJ/scripts/build.sh" release

# ---------------------------------------------------------- 2. assets embarqués
# game/dist/ → android/app/src/main/assets/ (copie complète à chaque build)
ASSETS="$PROJ/android/app/src/main/assets"
rm -rf "$ASSETS"
mkdir -p "$ASSETS"
cp -r "$PROJ/game/dist/." "$ASSETS/"
log "assets embarqués : $(find "$ASSETS" -type f | wc -l) fichiers"

# ---------------------------------------------------------- 3. keystore
# Signature : clés fournies par l'environnement (CI — secrets GitHub) ou
# keystore local (tools/mathkombat.keystore + tools/keystore.env, non versionnés).
# tools/keystore.env (KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD) est sourcé
# s'il existe — sinon les défauts du build.gradle s'appliquent (repli dev).
if [ -f "$PROJ/tools/keystore.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJ/tools/keystore.env"
  set +a
  log "keystore.env chargé (mot de passe du keystore fourni)"
fi
if [ -n "${KEYSTORE_FILE:-}" ]; then
  KEYSTORE="$KEYSTORE_FILE"
  log "keystore de release fourni par l'environnement : $KEYSTORE"
else
  KEYSTORE="$PROJ/tools/mathkombat.keystore"
  if [ ! -f "$KEYSTORE" ]; then
    log "génération du keystore de signature (tools/mathkombat.keystore) …"
    "$JAVA_HOME/bin/keytool" -genkeypair -v \
      -keystore "$KEYSTORE" -alias mathkombat \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass mathkombat -keypass mathkombat \
      -dname "CN=MathKombat, OU=Jeu educatif, O=MathKombat, C=FR" >/dev/null 2>&1
  fi
fi

# ---------------------------------------------------------- 3bis. icône + outils
# Icône d'application (mipmap) : régénérée si un Python avec PIL est trouvé
# (portabilité : venv, système, CI) — sinon les mipmaps versionnées sont gardées.
PYTHON_ICONE=""
for candidat in "${PYTHON_ICONE_CANDIDAT:-}" /opt/opencode-venv/bin/python3 python3 python; do
  [ -n "$candidat" ] || continue
  if command -v "$candidat" >/dev/null 2>&1 && "$candidat" -c 'import PIL' 2>/dev/null; then
    PYTHON_ICONE="$candidat"
    break
  fi
done
if [ -n "$PYTHON_ICONE" ]; then
  "$PYTHON_ICONE" "$PROJ/scripts/assets-icone-apk.py"
else
  log "Python+PIL indisponible : icônes conservées (mipmaps déjà présentes)"
fi
# Sur hôte aarch64 : les binaires x86-64 du SDK sont émulés par wrappers qemu.
bash "$PROJ/scripts/setup-sdk-qemu.sh"

# ---------------------------------------------------------- 4. build Gradle
GRADLE="$PROJ"/tools/gradle/gradle-*/bin/gradle
[ -x $GRADLE ] || { echo "ERREUR: Gradle embarqué absent — lancer scripts/setup-sdk.sh" >&2; exit 1; }

# local.properties (généré, non versionné) : SDK local + aapt2 du SDK (wrappé
# qemu le cas échéant) plutôt que le binaire Maven x86-64.
cat > "$PROJ/android/local.properties" <<EOF
sdk.dir=$PROJ/tools/android-sdk
android.aapt2FromMavenOverride=$PROJ/tools/android-sdk/build-tools/34.0.0/aapt2
EOF

cd "$PROJ/android"
log "gradle assembleRelease (SDK local, cache isolé) …"
# -Pandroid.aapt2FromMavenOverride : aapt2 du SDK (wrapper qemu si hôte aarch64)
# plutôt que le binaire Maven x86-64 qui ne s'exécute pas ici.
$GRADLE --no-daemon \
  -Pandroid.aapt2FromMavenOverride="$PROJ/tools/android-sdk/build-tools/34.0.0/aapt2" \
  assembleRelease

# ---------------------------------------------------------- 5. sortie + contrôle
APK_SRC="$PROJ/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK_SRC" ] || { echo "ERREUR: APK non produit ($APK_SRC)" >&2; exit 1; }
mkdir -p "$PROJ/output"
cp "$APK_SRC" "$PROJ/output/MathKombat.apk"

AAPT="$PROJ/tools/android-sdk/build-tools/34.0.0/aapt"
if [ -x "$AAPT" ]; then
  log "vérification de l'APK (aapt) :"
  "$AAPT" dump badging "$PROJ/output/MathKombat.apk" | grep -E "^package:|^application-label:|^sdkVersion:|^targetSdkVersion:|^uses-feature:|launchable-activity" || true
fi

log "APK → output/MathKombat.apk ($(du -h "$PROJ/output/MathKombat.apk" | cut -f1))"
