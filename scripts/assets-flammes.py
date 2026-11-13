#!/opt/opencode-venv/bin/python3
"""scripts/assets-flammes.py — textures de flamme douces pour l'aura (§2.8a).

Génère deux variantes de langue de flamme en RGBA blanc (teintable par Phaser) :
forme de base arrondie + pointes, flou gaussien pour des bords doux, noyau
incandescent légèrement plus net. Le bas de l'image est atténué (aucune coupe
nette quand la flamme flotte autour du personnage).

Usage : scripts/assets-flammes.py
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

L, H = 160, 320  # taille de texture (redimensionnée en jeu)


def masque_bas(img: Image.Image) -> Image.Image:
    """Atténue les 10 % bas de l'image (pas de bord net sous la flamme)."""
    px = img.load()
    l, h = img.size
    debut = int(h * 0.90)
    for y in range(debut, h):
        facteur = 1.0 - (y - debut) / (h - debut)
        for x in range(l):
            px[x, y] = int(px[x, y] * facteur)
    return img


def flamme(variante: int) -> Image.Image:
    img = Image.new("L", (L, H), 0)
    d = ImageDraw.Draw(img)
    # masse de base arrondie (reste dans le cadre → bords nets nuls après flou)
    d.ellipse((L * 0.12, H * 0.42, L * 0.88, H * 0.94), fill=255)
    if variante == 1:
        # pointe principale + seconde langue latérale
        d.polygon([(L * 0.20, H * 0.74), (L * 0.50, H * 0.03), (L * 0.80, H * 0.74)], fill=255)
        d.polygon([(L * 0.36, H * 0.58), (L * 0.74, H * 0.16), (L * 0.90, H * 0.70)], fill=205)
    else:
        d.polygon([(L * 0.24, H * 0.78), (L * 0.44, H * 0.06), (L * 0.68, H * 0.70)], fill=255)
        d.polygon([(L * 0.50, H * 0.74), (L * 0.80, H * 0.20), (L * 0.93, H * 0.78)], fill=215)

    flou = img.filter(ImageFilter.GaussianBlur(radius=L * 0.05))
    noyau = img.filter(ImageFilter.GaussianBlur(radius=L * 0.022))
    img = Image.blend(flou, noyau, 0.62)  # cœur net, bords doux mais définis
    img = masque_bas(img)

    rgba = Image.new("RGBA", (L, H), (255, 255, 255, 0))
    rgba.putalpha(img)
    return rgba


def main() -> int:
    sortie = Path(__file__).resolve().parent.parent / "game" / "assets" / "effets"
    sortie.mkdir(parents=True, exist_ok=True)
    for variante in (1, 2):
        chemin = sortie / f"flamme-{variante}.png"
        flamme(variante).save(chemin, "PNG")
        print(f"{chemin} : {L}x{H} (flamme douce, teintable)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
