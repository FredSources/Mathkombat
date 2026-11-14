#!/opt/opencode-venv/bin/python3
"""scripts/assets-coups.py — sprites de coup : poing et pied (docs/assets.md §3a).

Deux sprites « bras avant + poing » et « jambe avant + chaussure », dessinés en
palette neutre (blanc/gris + contour noir) : la teinte par personnage est
appliquée en jeu par `FightScene.textureTeintee()` (multiplication par pixel —
le `setTint()` WebGL n'est pas fiable, cf. §6a).

- dessin en sur-échantillonnage ×4 puis réduction LANTILOS (contours nets) ;
- contour noir obtenu par dilatation de la silhouette (MaxFilter) ;
- détails intérieurs (noyaux, lacets, semelle) tracés après composition ;
- fond transparent, PNG 32 bits, aucun asset importé, 100 % déterministe.

Usage : scripts/assets-coups.py [dossier_sortie=game/assets/effets]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

SUR = 4  # sur-échantillonnage
LARGEUR, HAUTEUR = 240, 120  # taille finale (px)

# palette neutre (teintée en jeu)
CLAIR = (245, 247, 250, 255)
OMBRAGE = (204, 212, 224, 255)
BANDE = (170, 181, 198, 255)
CONTOUR = (17, 17, 17, 255)
DETAIL = (60, 66, 78, 255)

DILATATION = 3 * SUR  # épaisseur du contour noir (final = 3 px)


def _poing(dm: ImageDraw.ImageDraw, dc: ImageDraw.ImageDraw) -> None:
    """Bras avant tendu vers la droite, poing fermé, pouce au-dessus."""
    s = SUR

    # avant-bras (découpé à gauche : il sort de l'épaule)
    bras = [(6 * s, 44 * s), (150 * s, 38 * s), (150 * s, 96 * s), (6 * s, 104 * s)]
    dm.polygon(bras, fill=255)
    dc.polygon(bras, fill=CLAIR)
    # ombre portée sous l'avant-bras
    ombre = [(6 * s, 84 * s), (150 * s, 78 * s), (150 * s, 96 * s), (6 * s, 104 * s)]
    dc.polygon(ombre, fill=OMBRAGE)

    # poignet / bande
    poignet = [(146 * s, 34 * s), (176 * s, 100 * s)]
    dm.rounded_rectangle(poignet, radius=10 * s, fill=255)
    dc.rounded_rectangle(poignet, radius=10 * s, fill=BANDE)

    # poing : bloc arrondi
    poing = [(170 * s, 24 * s), (236 * s, 110 * s)]
    dm.rounded_rectangle(poing, radius=26 * s, fill=255)
    dc.rounded_rectangle(poing, radius=26 * s, fill=CLAIR)

    # pouce replié sur le dessus du poing
    pouce = [(178 * s, 30 * s), (228 * s, 60 * s)]
    dm.rounded_rectangle(pouce, radius=14 * s, fill=255)
    dc.rounded_rectangle(pouce, radius=14 * s, fill=OMBRAGE)

    # séparations des doigts repliés (détails intérieurs, après composition)
    for y in (52, 74, 94):
        dc.line([(206 * s, y * s), (232 * s, y * s)], fill=DETAIL, width=2 * s)


def _pied(dm: ImageDraw.ImageDraw, dc: ImageDraw.ImageDraw) -> None:
    """Jambe avant décollée, chaussure de combat pointant vers la droite."""
    s = SUR

    # tibia
    tibia = [(6 * s, 30 * s), (120 * s, 44 * s), (120 * s, 92 * s), (6 * s, 86 * s)]
    dm.polygon(tibia, fill=255)
    dc.polygon(tibia, fill=CLAIR)
    ombre = [(6 * s, 70 * s), (120 * s, 76 * s), (120 * s, 92 * s), (6 * s, 86 * s)]
    dc.polygon(ombre, fill=OMBRAGE)

    # cheville
    cheville = [(108 * s, 50 * s), (156 * s, 106 * s)]
    dm.rounded_rectangle(cheville, radius=12 * s, fill=255)
    dc.rounded_rectangle(cheville, radius=12 * s, fill=BANDE)

    # chaussure : corps + pointe arrondie
    chaussure = [(142 * s, 54 * s), (234 * s, 100 * s)]
    pointe = [(202 * s, 56 * s), (240 * s, 102 * s)]
    for d in (dm, dc):
        d.rounded_rectangle(chaussure, radius=16 * s, fill=255 if d is dm else CLAIR)
        d.ellipse(pointe, fill=255 if d is dm else CLAIR)

    # semelle
    semelle = [(142 * s, 92 * s), (236 * s, 112 * s)]
    dm.rounded_rectangle(semelle, radius=8 * s, fill=255)
    dc.rounded_rectangle(semelle, radius=8 * s, fill=OMBRAGE)

    # lacets (détails intérieurs)
    for x in (158, 176, 194):
        dc.line([(x * s, 62 * s), ((x + 12) * s, 86 * s)], fill=DETAIL, width=2 * s)


def dessiner(quel: str) -> Image.Image:
    largeur, hauteur = LARGEUR * SUR, HAUTEUR * SUR
    masque = Image.new("L", (largeur, hauteur), 0)
    couleurs = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
    dm = ImageDraw.Draw(masque)
    dc = ImageDraw.Draw(couleurs)

    if quel == "poing":
        _poing(dm, dc)
    else:
        _pied(dm, dc)

    # contour : silhouette dilatée, en noir, dessous des couleurs
    contour = masque.filter(ImageFilter.MaxFilter(2 * DILATATION + 1))
    canevas = Image.new("RGBA", (largeur, hauteur), (*CONTOUR[:3], 0))
    canevas.putalpha(contour)
    canevas = Image.alpha_composite(canevas, couleurs)
    return canevas.resize((LARGEUR, HAUTEUR), Image.LANCZOS)


def main() -> int:
    sortie = sys.argv[1] if len(sys.argv) > 1 else "game/assets/effets"
    os.makedirs(sortie, exist_ok=True)
    for nom in ("poing", "pied"):
        chemin = os.path.join(sortie, f"coups-{nom}.png")
        image = dessiner(nom)
        image.save(chemin, "PNG")
        boite = image.getbbox()
        print(f"{chemin} : {image.width}x{image.height} (boîte {boite})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
