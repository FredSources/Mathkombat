#!/opt/opencode-venv/bin/python3
"""
assets-icone-apk.py — génère les icônes d'application Android (mipmap).

À partir de l'image source carrée (thème MathKombat), produit les tailles
standard des dossiers `mipmap-*` attendues par `android:icon="@mipmap/ic_launcher"` :

    mdpi 48 · hdpi 72 · xhdpi 96 · xxhdpi 144 · xxxhdpi 192

Usage : python3 scripts/assets-icone-apk.py [source.png]
        (défaut : game/android-icons/icone-source.png)
Sortie : android/app/src/main/res/mipmap-*/ic_launcher.png
"""
import sys
from pathlib import Path

from PIL import Image

PROJ = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else PROJ / "game" / "android-icons" / "icone-source.png"
SORTIE = PROJ / "android" / "app" / "src" / "main" / "res"

TAILLES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Tailles du PREMIER PLAN de l'icône adaptative (108 dp par densité) : le sujet
# doit rester dans la zone sûre du masque rond (≈ 66/108) → image réduite à 82 %.
TAILLES_FOREGROUND = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def main() -> int:
    if not SOURCE.exists():
        print(f"ERREUR: image source absente : {SOURCE}", file=sys.stderr)
        return 1
    image = Image.open(SOURCE).convert("RGBA")
    # carrée : on recadre au centre si besoin
    cote = min(image.size)
    decalage = ((image.width - cote) // 2, (image.height - cote) // 2)
    image = image.crop((decalage[0], decalage[1], decalage[0] + cote, decalage[1] + cote))

    for dossier, taille in TAILLES.items():
        cible = SORTIE / dossier
        cible.mkdir(parents=True, exist_ok=True)
        image.resize((taille, taille), Image.LANCZOS).save(cible / "ic_launcher.png")
        print(f"  {dossier}/ic_launcher.png ({taille}x{taille})")

    # premier plan de l'icône adaptative : sujet centré à 82 % sur fond transparent
    for dossier, taille in TAILLES_FOREGROUND.items():
        cible = SORTIE / dossier
        cible.mkdir(parents=True, exist_ok=True)
        sujet = int(taille * 0.82)
        avant = image.resize((sujet, sujet), Image.LANCZOS)
        plan = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
        plan.paste(avant, ((taille - sujet) // 2, (taille - sujet) // 2))
        plan.save(cible / "ic_launcher_foreground.png")
        print(f"  {dossier}/ic_launcher_foreground.png ({taille}x{taille})")

    print(f"Icônes générées depuis {SOURCE.name} → {SORTIE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
