#!/usr/bin/env bash
# scripts/setup-sdk-qemu.sh — wrappers qemu des binaires SDK x86-64 (J7).
#
# Contexte : les build-tools Android officielles sont des binaires **x86-64** ;
# sur un hôte **aarch64** (Termux/PC ARM), ils ne s'exécutent pas nativement.
# Ce script remplace chaque binaire ELF x86-64 de `tools/android-sdk/build-tools/`
# par un wrapper shell qui l'exécute via qemu-user-static (émulation).
#
# Prérequis système (documentés AGENTS.md §3) : `qemu-user-static` +
# `libc6-amd64-cross` + `libgcc-s1-amd64-cross` (apt). Idempotent : les binaires
# déjà wrappés sont ignorés.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/env.sh"

QEMU="$(command -v qemu-x86_64-static || true)"
if [ -z "$QEMU" ]; then
  log "qemu-x86_64-static absent — binaires SDK x86-64 non wrappés (build APK impossible sur aarch64)"
  exit 0
fi
LIBDIR="/usr/x86_64-linux-gnu"

wrappers=0

for dossier in "$PROJ"/tools/android-sdk/build-tools/*/; do
  # noms de base de tous les binaires (suffixed .bin* repliés)
  noms=$(for f in "$dossier"*; do [ -f "$f" ] && basename "${f%%.bin*}"; done | sort -u)
  for nom in $noms; do
    [ -n "$nom" ] || continue
    # --- retrouver le binaire ORIGINAL (ELF) parmi nom, nom.bin, nom.bin.bin… ---
    elf=""
    for suffixe in "" ".bin" ".bin.bin" ".bin.bin.bin"; do
      cand="$dossier$nom$suffixe"
      [ -f "$cand" ] || continue
      if file "$cand" 2>/dev/null | grep -q 'ELF'; then elf="$cand"; break; fi
    done
    [ -n "$elf" ] || continue # script ou jar : rien à faire
    # remettre l'ELF sous son nom d'origine, purger les copies
    if [ "$elf" != "$dossier$nom" ]; then mv -f "$elf" "$dossier$nom"; fi
    rm -f "$dossier$nom.bin" "$dossier$nom.bin.bin" "$dossier$nom.bin.bin.bin"
    # --- wrapper unique si ELF x86-64 sur hôte non x86-64 ---
    if file "$dossier$nom" 2>/dev/null | grep -q 'x86-64'; then
      mv "$dossier$nom" "$dossier$nom.bin"
      cat > "$dossier$nom" <<EOF
#!/bin/sh
# wrapper généré par scripts/setup-sdk-qemu.sh (binaire x86-64 émulé sur aarch64)
exec $QEMU -L $LIBDIR "\$(dirname "\$0")/$nom.bin" "\$@"
EOF
      chmod +x "$dossier$nom"
      wrappers=$((wrappers + 1))
    fi
  done
done

log "wrappers qemu installés : $wrappers binaires SDK (build-tools x86-64 → émulation)"
