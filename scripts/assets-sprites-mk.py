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
# hauteur de référence du combattant « moyen » (px)
HAUTEUR_CIBLE = 300

# tailles relatives des combattants (proportions entre personnages) :
# TITAN est massif, NYX menue — le reste est le gabarit de base
RATIOS = {
    "j1": 1.0,   # KENJI
    "j2": 1.0,   # KIRA
    "h2": 1.12,  # TITAN
    "f2": 0.92,  # NYX
    "z1": 0.98,  # ZANE
    "z2": 1.08,  # BLAZE
}


def detourer(case: Image.Image) -> Image.Image:
    """Fond magenta chroma → transparent (distance à la couleur franche +
    magenta sombre des dégradés de bord).

    La « dominance magenta » mangeait les teintes violettes (NYX) : on mesure
    ici la **distance au magenta de référence** (251, 4, 250) — seul le fond en
    est proche, les violets du personnage restent. Les **magenta sombres**
    (dégradés de bord) sont reconnus par leur vert quasi nul.
    """
    rgba = case.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    r0, g0, b0 = 251, 4, 250
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            distance = abs(r - r0) + abs(g - g0) + abs(b - b0)
            # magenta : franc (distance), sombre (vert quasi nul) ou rosé
            # (min(r,b) très supérieur au vert) — les violets du personnage (NYX)
            # ont un vert proportionnel et sont conservés
            magenta = (
                distance < 120
                or (g < 18 and min(r, b) > 25)
                or (min(r, b) > 2 * g + 100 and max(r, b) > 120)
            )
            if magenta:
                px[x, y] = (r, g, b, 0)
            elif distance < 150:  # fin liseré anti-aliasing (très étroit)
                px[x, y] = (r, g, b, max(0, a - int(255 * ((150 - distance) / 30))))
            elif a < 30:  # voile résiduel (halo) : coupé net
                px[x, y] = (r, g, b, 0)
    return rgba


def couper_residus(sprite: Image.Image) -> Image.Image:
    """Efface les **ombres noires** de la bande basse puis coupe les **4 bords**
    sous la dernière ligne/colonne significative (≥ 5 pixels opaques) :
    résidus de bord, traits de séparation des cases et ombres des planches
    formaient un **contour rectangulaire** autour du sprite et faisaient
    « voler » les personnages — les chaussures se retrouvent sur le **pixel du
    bas**, et la silhouette est nette sur tous les côtés."""
    px = sprite.load()
    w, h = sprite.size
    # 1) ombres noires sous la dernière rangée « colorée » du personnage
    bas_col = -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 200 and (max(r, g, b) >= 60 or max(r, g, b) - min(r, g, b) >= 30):
                bas_col = y
    for y in range(min(h, bas_col + 13), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and max(r, g, b) < 25 and max(r, g, b) - min(r, g, b) < 12:
                px[x, y] = (r, g, b, 0)
    # 2) coupe des 4 bords sous les lignes/colonnes significatives (≥ 5 px)
    def significatif_ligne(y):
        return sum(1 for x in range(w) if px[x, y][3] > 200) >= 5

    def significatif_colonne(x):
        return sum(1 for y in range(h) if px[x, y][3] > 200) >= 5

    haut = next((y for y in range(h) if significatif_ligne(y)), 0)
    bas = next((y for y in range(h - 1, -1, -1) if significatif_ligne(y)), h - 1)
    gauche = next((x for x in range(w) if significatif_colonne(x)), 0)
    droite = next((x for x in range(w - 1, -1, -1) if significatif_colonne(x)), w - 1)
    return sprite.crop((gauche, haut, droite + 1, bas + 1))


def bbox_personnage(sprite: Image.Image):
    """Boîte du PERSONNAGE (opaque et coloré/lumineux) : les ombres intégrées
    des planches — même opaques — sont grisâtres et sombres ; elles fayaient
    « voler » les personnages en gonflant le bas du recadrage (KIRA : 38 px)."""
    px = sprite.load()
    w, h = sprite.size
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 200:
                continue
            sat = max(r, g, b) - min(r, g, b)
            val = max(r, g, b)
            if sat < 25 and val < 110:
                continue  # ombre (gris sombre désaturé)
            x0, y0 = min(x0, x), min(y0, y)
            x1, y1 = max(x1, x), max(y1, y)
    return (x0, y0, x1 + 1, y1 + 1) if x1 >= x0 else None


def recadrer(sprite: Image.Image, echelle: float, ratio: float) -> Image.Image:
    """Recadre sur le contenu opaque (chaussures sur le pixel du bas), à
    l'échelle du gabarit (`RATIOS`), pieds collés au bas du canevas."""
    net = sprite.getchannel("A").point(lambda v: 255 if v > 200 else 0)
    bbox = net.getbbox()
    if not bbox:
        return sprite
    contenu = sprite.crop(bbox)
    contenu = contenu.resize(
        (max(1, int(contenu.width * echelle)), max(1, int(contenu.height * echelle))),
        Image.LANCZOS,
    )
    # 2e coupe des résidus : le redimensionnement en recrée sous les pieds
    contenu = couper_residus(contenu)
    hauteur_canevas = int(HAUTEUR_CIBLE * ratio)
    largeur = int(hauteur_canevas * 1.1)
    canevas = Image.new("RGBA", (largeur, hauteur_canevas), (0, 0, 0, 0))
    canevas.paste(contenu, ((largeur - contenu.width) // 2, hauteur_canevas - contenu.height))
    return canevas


def echelle_planche(image: Image.Image, identifiant: str) -> float:
    """Échelle de la planche, calculée sur la pose de référence (garde)
    **traitée comme les autres** (détourage + coupe des résidus) : le personnage
    garde son gabarit (`RATIOS`) et toutes les poses la même taille."""
    case_w = image.width // COLONNES
    case_h = image.height // LIGNES
    garde = couper_residus(detourer(image.crop((0, 0, case_w, case_h))))
    net = garde.getchannel("A").point(lambda v: 255 if v > 200 else 0)
    bbox = net.getbbox() or (0, 0, case_w, case_h)
    hauteur = bbox[3] - bbox[1]
    return (HAUTEUR_CIBLE * RATIOS.get(identifiant, 1.0)) / max(1, hauteur)


def main() -> int:
    planches = sorted(SOURCE.glob("sprites-*.png"))
    planches = [p for p in planches if "-v" not in p.name]  # hors versions de travail
    if not planches:
        print(f"ERREUR: aucune planche dans {SOURCE}", file=sys.stderr)
        return 1

    for planche in planches:
        identifiant = planche.stem.replace("sprites-", "")
        marche = identifiant.startswith("m")  # planche de cycle de marche (8 frames)
        cle = identifiant[1:] if marche else identifiant
        image = Image.open(planche).convert("RGBA")
        case_w = image.width // COLONNES
        case_h = image.height // LIGNES
        ratio = RATIOS.get(cle, 1.0)
        echelle = echelle_planche(image, cle)  # gabarit + poses homogènes
        print(f"{planche.name} : {image.width}x{image.height} → cases {case_w}x{case_h} (ratio {ratio}, échelle {echelle:.2f})")
        for i in range(COLONNES * LIGNES):
            col, ligne = i % COLONNES, i // COLONNES
            case = image.crop((col * case_w, ligne * case_h, (col + 1) * case_w, (ligne + 1) * case_h))
            # détourage + coupe des résidus de bord (les chaussures finissent sur
            # le pixel du bas du sprite)
            sprite = recadrer(couper_residus(detourer(case)), echelle, ratio)
            nom = f"{identifiant}-{i}.png" if marche else f"{identifiant}-{i}-{POSES[i]}.png"
            cible = SORTIE / nom
            sprite.save(cible)
            print(f"  {cible.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
