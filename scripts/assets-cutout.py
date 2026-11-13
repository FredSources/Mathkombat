#!/opt/opencode-venv/bin/python3
"""scripts/assets-cutout.py — découpe cut-out des personnages (docs/assets.md).

- supprime le fond uni (flood-fill depuis les bords, tolérance configurable) ;
- recadre automatiquement sur la silhouette (boîte englobante non transparente) ;
- redimensionne à une hauteur cible en conservant les proportions ;
- exporte en PNG 32 bits (transparence).

Usage : scripts/assets-cutout.py ENTREE.png SORTIE.png [hauteur_cible=420] [tolerance=40]
"""
import sys
from collections import deque

from PIL import Image


def couper_fond(image: Image.Image, tolerance: int) -> Image.Image:
    """Rend transparent les pixels connectés au bord proches de la couleur de fond."""
    image = image.convert("RGBA")
    largeur, hauteur = image.size
    px = image.load()

    def couleur_fond() -> tuple[int, int, int]:
        coins = [px[0, 0], px[largeur - 1, 0], px[0, hauteur - 1], px[largeur - 1, hauteur - 1]]
        # médiane des coins (robuste aux coins légèrement différents)
        r = sorted(c[0] for c in coins)[1]
        v = sorted(c[1] for c in coins)[1]
        b = sorted(c[2] for c in coins)[1]
        return (r, v, b)

    fond = couleur_fond()
    vus = bytearray(largeur * hauteur)
    file: deque[tuple[int, int]] = deque()

    def proche(c: tuple[int, ...]) -> bool:
        return abs(c[0] - fond[0]) <= tolerance and abs(c[1] - fond[1]) <= tolerance and abs(c[2] - fond[2]) <= tolerance

    for x in range(largeur):
        for y in (0, hauteur - 1):
            if proche(px[x, y]):
                file.append((x, y))
                vus[y * largeur + x] = 1
    for y in range(hauteur):
        for x in (0, largeur - 1):
            if proche(px[x, y]) and not vus[y * largeur + x]:
                file.append((x, y))
                vus[y * largeur + x] = 1

    while file:
        x, y = file.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < largeur and 0 <= ny < hauteur and not vus[ny * largeur + nx]:
                vus[ny * largeur + nx] = 1
                if proche(px[nx, ny]):
                    file.append((nx, ny))
    return image


def recadrer(image: Image.Image) -> Image.Image:
    boite = image.getbbox()  # boîte englobante des pixels non transparents
    return image.crop(boite) if boite else image


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    entree, sortie = sys.argv[1], sys.argv[2]
    hauteur_cible = int(sys.argv[3]) if len(sys.argv) > 3 else 420
    tolerance = int(sys.argv[4]) if len(sys.argv) > 4 else 40

    image = Image.open(entree)
    image = couper_fond(image, tolerance)
    image = recadrer(image)
    ratio = hauteur_cible / image.height
    image = image.resize((max(1, round(image.width * ratio)), hauteur_cible), Image.LANCZOS)
    image.save(sortie, "PNG")
    print(f"{sortie} : {image.width}x{image.height} (fond supprimé, tolérance {tolerance})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
