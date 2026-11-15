#!/usr/bin/env bash
# scripts/setup-sdk.sh — (re)construit tools/ DANS le projet.
#
# tools/ n'est PAS versionné (git) : ce script le reconstitue, de deux façons,
# dans l'ordre de priorité :
#   1. copie locale — source déjà présente sur la machine (rapide, hors-ligne) ;
#   2. téléchargement officiel — réseau requis (une seule fois).
# Résultat :
#   tools/android-sdk/  SDK Android (platform 34, build-tools 34.0.0)
#   tools/gradle/       Gradle 8.10.2
#   tools/jdk/          JDK portable (javac) — Temurin 21
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/env.sh"

GRADLE_VER="gradle-8.10.2"
# Source locale (installation d'origine, utilisée UNIQUEMENT à l'installation)
SRC_BASE="/data/data/com.termux/files/home/openwebui-android"
# Sources officielles (repli réseau)
URL_GRADLE="https://services.gradle.org/distributions/${GRADLE_VER}-bin.zip"
URL_JDK="https://api.adoptium.net/v3/binary/latest/21/ga/linux/aarch64/jdk/hotspot/normal/eclipse"
URL_CMDLINE="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

TMP="$PROJ/.tmp/setup-sdk"
mkdir -p "$TMP"

telecharger() { # $1=url $2=fichier cible
  log "téléchargement : $1"
  curl -fSL --retry 3 -o "$2" "$1"
}

installe() { # $1=chemin-test $2=libellé — 0 si déjà prêt
  if [ -e "$1" ]; then log "$2 : déjà installé"; return 0; fi
  return 1
}

# ---------------------------------------------------------------- JDK (1er : sdkmanager en a besoin)
if ! installe "$PROJ/tools/jdk/bin/javac" "JDK portable"; then
  if [ -d "$SRC_BASE/tools/jdk" ]; then
    log "JDK portable : copie locale depuis $SRC_BASE/tools/jdk …"
    mkdir -p "$PROJ/tools" && cp -a "$SRC_BASE/tools/jdk" "$PROJ/tools/jdk"
  else
    log "JDK portable : téléchargement (Temurin 21) …"
    telecharger "$URL_JDK" "$TMP/jdk.tar.gz"
    mkdir -p "$TMP/jdk" && tar -xzf "$TMP/jdk.tar.gz" -C "$TMP/jdk" --strip-components=1
    mv "$TMP/jdk" "$PROJ/tools/jdk"
  fi
  log "JDK portable : OK ($("$PROJ/tools/jdk/bin/javac" -version 2>&1))"
fi

# ---------------------------------------------------------------- Gradle
if ! installe "$PROJ/tools/gradle/$GRADLE_VER/bin/gradle" "Gradle"; then
  if [ -d "$SRC_BASE/tools/gradle/$GRADLE_VER" ]; then
    log "Gradle : copie locale depuis $SRC_BASE/tools/gradle/$GRADLE_VER …"
    mkdir -p "$PROJ/tools/gradle" && cp -a "$SRC_BASE/tools/gradle/$GRADLE_VER" "$PROJ/tools/gradle/$GRADLE_VER"
  else
    log "Gradle : téléchargement ($GRADLE_VER) …"
    telecharger "$URL_GRADLE" "$TMP/gradle.zip"
    mkdir -p "$PROJ/tools/gradle" && unzip -q "$TMP/gradle.zip" -d "$PROJ/tools/gradle"
  fi
  log "Gradle : OK ($("$PROJ/tools/gradle/$GRADLE_VER/bin/gradle" --version 2>/dev/null | grep '^Gradle' || echo version inconnue))"
fi

# ---------------------------------------------------------------- SDK Android
if installe "$PROJ/tools/android-sdk/platforms/android-34" "SDK Android"; then
  :
elif [ -d "$SRC_BASE/android-sdk" ]; then
  log "SDK Android : copie locale depuis $SRC_BASE/android-sdk …"
  mkdir -p "$PROJ/tools" && cp -a "$SRC_BASE/android-sdk" "$PROJ/tools/android-sdk"
  log "SDK Android : OK ($(du -sh "$PROJ/tools/android-sdk" | cut -f1))"
else
  log "SDK Android : téléchargement (cmdline-tools + sdkmanager) …"
  export JAVA_HOME="$PROJ/tools/jdk"
  export PATH="$JAVA_HOME/bin:$PATH"
  telecharger "$URL_CMDLINE" "$TMP/cmdline.zip"
  mkdir -p "$TMP/cmdline" "$ANDROID_HOME/cmdline-tools"
  unzip -q "$TMP/cmdline.zip" -d "$TMP/cmdline"
  mv "$TMP/cmdline/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  SDKMGR="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  yes | "$SDKMGR" --sdk_root="$ANDROID_HOME" --licenses >/dev/null 2>&1 || true
  "$SDKMGR" --sdk_root="$ANDROID_HOME" "platforms;android-34" "build-tools;34.0.0" "platform-tools"
  log "SDK Android : OK ($(du -sh "$ANDROID_HOME" | cut -f1))"
fi

rm -rf "$TMP"

# ---------------------------------------------------------------- Vérifications
echo
log "Vérification de l'installation :"
[ -d "$PROJ/tools/android-sdk/platforms/android-34" ] && log "  platform android-34 : OK" || log "  platform android-34 : MANQUANT"
[ -d "$PROJ/tools/android-sdk/build-tools/34.0.0" ]  && log "  build-tools 34.0.0 : OK" || log "  build-tools 34.0.0 : MANQUANT"
[ -x "$PROJ/tools/jdk/bin/javac" ]                   && log "  javac : OK ($("$PROJ/tools/jdk/bin/javac" -version 2>&1))" || log "  javac : MANQUANT"
[ -x "$PROJ/tools/gradle/$GRADLE_VER/bin/gradle" ]   && log "  gradle : OK" || log "  gradle : MANQUANT"
log "Espace utilisé par tools/ : $(du -sh "$PROJ/tools" 2>/dev/null | cut -f1)"
