#!/opt/opencode-venv/bin/python3
"""
assets-sprites-mk.py — découpe et détourage des planches de sprites « combat ».

Chaque planche produite (docs/assets.md) est une grille **4 colonnes × 2 lignes**
de 8 poses : garde, marche avant, marche arrière, saut, coup de poing,
coup de pied, garde défensive, touché — sur fond **vert chroma**.

Traitements :
  1. découpe en 8 cases égales ;
  2. **détourage chroma** (vert → transparent, bords lissés) ;
  3. recadrage sur le contenu + **alignement par les pieds** (bas commun) et
     centrage horizontal, pour que l'animation ne tremble pas ;
  4. sortie : `game/assets/sprites-mk/<id>-<pose>.png` (RGBA).

Usage : python3 scripts/assets-sprites-mk.py
"""
import sys
from pathlib import Path

from PIL import Image

PROJ = Path(__file__).resolve().parent.parent
SOURCE = PROJ / "game" / "assets" / "sprites-mk"
SORTIE = SOURCE

COLONNES, LIGNES = 4, 2
# ordre des poses (grille ligne par ligne)
POSES = [
    "garde", "marche-avant", "marche-arriere", "saut",
    "poing", "pied", "garde-defense", "touche",
]
# hauteur commune imposée (alignement des pieds) — recadrage final
HAUTEUR_CIBLE = 300


def detourer(case: Image.Image) -> Image.Image:
    """Fond magenta chroma → transparent, bords lissés (anti-aliasing conservé)."""
    rgba = case.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dominant = min(r, b) - g  # dominance magenta (rouge ET bleu)
            if dominant > 40:  # magenta franc : fond
                px[x, y] = (r, g, b, 0)
            elif dominant > 0:  # bord : alpha proportionnel (lissage)
                px[x, y] = (r, g, b, max(0, a - int(255 * (dominant / 40))))
    return rgba


def recadrer(sprite: Image.Image) -> Image.Image:
    """Recadre sur le contenu, aligne par les pieds (bas) et centre horizontalement."""
    bbox = sprite.getbbox()
    if not bbox:
        return sprite
    contenu = sprite.crop(bbox)
    # mise à l'échelle sur la hauteur cible (proportions gardées)
    echelle = HAUTEUR_CIBLE / contenu.height
    nouvelle = (
        max(1, int(contenu.width * echelle)),
        HAUTEUR_CIBLE,
    )
    contenu = contenu.resize(nouvelle, Image.LANCZOS)
    # canevas de largeur constante, pieds collés au bas
    largeur = int(HAUTEUR_CIBLE * 1.1)
    canevas = Image.new("RGBA", (largeur, HAUTEUR_CIBLE), (0, 0, 0, 0))
    canevas.paste(contenu, ((largeur - contenu.width) // 2, HAUTEUR_CIBLE - contenu.height))
    return canevas


def main() -> int:
    planches = sorted(SOURCE.glob("sprites-*.png"))
    planches = [p for p in planches if "-v" not in p.name]  # hors versions de travail
    if not planches:
        print(f"ERREUR: aucune planche dans {SOURCE}", file=sys.stderr)
        return 1

    for planche in planches:
        identifiant = planche.stem.replace("sprites-", "")
        image = Image.open(planche).convert("RGBA")
        case_w = image.width // COLONNES
        case_h = image.height // LIGNES
        print(f"{planche.name} : {image.width}x{image.height} → cases {case_w}x{case_h}")
        for i, pose in enumerate(POSES):
            col, ligne = i % COLONNES, i // COLONNES
            case = image.crop((col * case_w, ligne * case_h, (col + 1) * case_w, (ligne + 1) * case_h))
            sprite = recadrer(detourer(case))
            cible = SORTIE / f"{identifiant}-{i}-{pose}.png"
            sprite.save(cible)
            print(f"  {cible.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
