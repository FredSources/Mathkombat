#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
assets-rig.py — rig cut-out articulé à partir des illustrations existantes.

Découpe `perso-a.png` / `perso-b.png` en 5 pièces articulées (buste, bras avant,
bras arrière, jambe avant, jambe arrière) avec pivots épaule/hanche, SANS
altérer le rendu au repos :

- chaque pixel opaque appartient au moins à une pièce (couverture totale) ;
- les BANDES DE RECOUVREMENT (épaules, hanches) sont portées à la fois par la
  pièce mobile et par le buste : l'assemblage au repos est identique au pixel
  original et l'articulation ne découvre aucun trou.

Angles en jeu (Phaser, horaires positifs) — la planche QA inverse le signe pour
PIL (PIL : antihoraire positif) :

  poing      : bras du côté de la frappe  ~92°
  pied-haut  : jambe du côté de la frappe ~78°
  pied-bas   : jambe du côté de la frappe ~36°
  garde haute: bras du côté de l'attaque  ~150°
  garde basse: jambe du côté de l'attaque ~58°
  contre     : saut (translation rig) + coup de pied haut

Sorties (déterministes, re-runnable) :
  game/assets/personnages/rig-{a,b}/{buste,bras-g,bras-d,jambe-g,jambe-d}.png
  game/assets/personnages/rig-meta.json        (bbox + pivots par pièce)
  tmp/rig-qa-{a,b}.png                         (contrôle visuel repos + poses)

Usage : /opt/opencode-venv/bin/python3 scripts/assets-rig.py
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, "game", "assets", "personnages")
TMP = os.path.join(RACINE, "tmp")
SEUIL = 40  # alpha minimal pour « pixel opaque »

# ---------------------------------------------------------------------------
# Configuration de découpe (mesurée sur les illustrations : runs alpha/ligne)
# ---------------------------------------------------------------------------
# bornes : liste (y, x) — x = frontière verticale ARMÉE|TORSO, interpolation
#          linéaire entre deux points de contrôle, bornée aux extrémités.
# pivots : (x, y) en coordonnées SOURCE (le repère rig = image plate
#          originelle : origine 0.5/1 aux pieds du conteneur).

CONFIG_RIG = {
    "perso-a": {
        "dossier": "rig-a",
        "cle": "persoA",
        "epauleY": 120,       # première ligne où bras/torse sont séparés
        "bandeEpaule": 14,    # bande de recouvrement au-dessus (masque d'épaule)
        "brasG": {"fin": 231, "bornes": [(120, 52), (140, 50), (160, 50), (175, 41),
                                         (190, 35), (210, 38), (231, 33)],
                  "pivot": (37, 115)},
        "brasD": {"fin": 231, "bornes": [(120, 136), (140, 137), (160, 138), (170, 144),
                                         (180, 149), (200, 152), (210, 152), (220, 156),
                                         (231, 159)],
                  "pivot": (151, 115)},
        "hancheY": 228,       # première ligne où les jambes sont séparées
        "bandeHanche": 16,
        "ligneJambes": 94,
        "pivotJG": (86, 232),
        "pivotJD": (102, 232),
        # Extrémité dorée de la basque (hanches) : elle dépasse sous le bras
        # droit au repos — doit rester sur le buste, sinon elle suivrait le poing.
        "exceptionsBuste": [(246, 259, 143, 160)],
    },
    "perso-b": {
        "dossier": "rig-b",
        "cle": "persoB",
        "epauleY": 120,
        "bandeEpaule": 14,
        "brasG": {"fin": 229, "bornes": [(120, 52), (150, 52), (170, 44), (190, 41),
                                         (205, 41), (220, 38), (229, 36)],
                  "pivot": (35, 115)},
        "brasD": {"fin": 229, "bornes": [(120, 148), (140, 150), (160, 151), (170, 157),
                                         (190, 159), (210, 158), (225, 164), (229, 164)],
                  "pivot": (166, 115)},
        "hancheY": 240,
        "bandeHanche": 16,
        "ligneJambes": 100,
        "pivotJG": (92, 244),
        "pivotJD": (108, 244),
    },
}

PIECES = ("buste", "bras-g", "bras-d", "jambe-g", "jambe-d")


def interp(bornes, y):
    """Frontière x à la ligne y (interpolation linéaire nulle part ailleurs)."""
    if y <= bornes[0][0]:
        return bornes[0][1]
    if y >= bornes[-1][0]:
        return bornes[-1][1]
    for (y0, x0), (y1, x1) in zip(bornes, bornes[1:]):
        if y0 <= y <= y1:
            t = 0 if y1 == y0 else (y - y0) / (y1 - y0)
            return x0 + (x1 - x0) * t
    return bornes[-1][1]


def charge(nom):
    return Image.open(os.path.join(SRC, nom)).convert("RGBA")


def decouper(nom_fichier, cfg):
    """Retourne {piece: Image (bbox)} + le meta (bbox/pivots en coords source)."""
    im = charge(nom_fichier)
    w, h = im.size
    px = im.load()
    e, bE = cfg["epauleY"], cfg["bandeEpaule"]
    hY, bH, split = cfg["hancheY"], cfg["bandeHanche"], cfg["ligneJambes"]
    gB, dB = cfg["brasG"], cfg["brasD"]
    gB_top, dB_top = interp(gB["bornes"], e), interp(dB["bornes"], e)
    exceptions = cfg.get("exceptionsBuste", [])

    def exception(x, y):
        return any(y0 <= y < y1 and x0 <= x < x1 for (y0, y1, x0, x1) in exceptions)

    def bras_core(x, y):
        if y < e:
            return False
        if y <= gB["fin"] and x < interp(gB["bornes"], y):
            return True
        return y <= dB["fin"] and x >= interp(dB["bornes"], y)

    def dedans(piece, x, y, opaque):
        if not opaque:
            return False
        if piece == "buste":
            if exception(x, y):
                return True
        elif exception(x, y):
            return False
        if piece == "bras-g":
            if y < e - bE or y > gB["fin"]:
                return False
            return x < (gB_top if y < e else interp(gB["bornes"], y))
        if piece == "bras-d":
            if y < e - bE or y > dB["fin"]:
                return False
            return x >= (dB_top if y < e else interp(dB["bornes"], y))
        if piece in ("jambe-g", "jambe-d"):
            if y < hY - bH:
                return False
            if bras_core(x, y):
                return False  # priorité au bras (poing sur la cuisse)
            return x < split if piece == "jambe-g" else x >= split
        # buste : tout sauf les cœurs de membre (les bandes restent dessus)
        return y < hY and not bras_core(x, y)

    # découpe : bbox = plus petit rectangle contenant les pixels de la pièce
    boxes = {}
    contenu = {}
    for piece in PIECES:
        xs, ys = [], []
        for y in range(h):
            for x in range(w):
                if dedans(piece, x, y, px[x, y][3] > SEUIL):
                    xs.append(x)
                    ys.append(y)
        if not xs:
            raise SystemExit(f"[rig] pièce vide : {nom_fichier}/{piece}")
        boxes[piece] = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        contenu[piece] = set(zip(xs, ys))

    # couverture : chaque pixel opaque appartient à ≥ 1 pièce
    opaques = {(x, y) for y in range(h) for x in range(w) if px[x, y][3] > SEUIL}
    couverture = set().union(*contenu.values())
    if opaques - couverture:
        trous = sorted(opaques - couverture)[:5]
        raise SystemExit(f"[rig] trous dans la découpe {nom_fichier} : {trous}")

    # export des pièces : masque strict = pixels revendiqués par la pièce
    # (une simple boîte englobante embarquerait les pixels des autres pièces)
    dest = os.path.join(SRC, cfg["dossier"])
    os.makedirs(dest, exist_ok=True)
    images = {}
    meta_pieces = {}
    for piece in PIECES:
        # boxes = (x0, y0, x1, y1) ; la pièce exportée fait (x1-x0, y1-y0)
        bx, by, x1, y1 = boxes[piece]
        bw, bh = x1 - bx, y1 - by
        morceau = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        mp = morceau.load()
        for (x, y) in contenu[piece]:
            mp[x - bx, y - by] = px[x, y]
        fichier = f"{piece}.png"
        morceau.save(os.path.join(dest, fichier))
        images[piece] = (morceau, (bx, by, bw, bh))
        entree = {
            "fichier": f"{cfg['dossier']}/{fichier}",
            "x": bx, "y": by, "largeur": bw, "hauteur": bh,
        }
        pivots = {
            "bras-g": cfg["brasG"]["pivot"], "bras-d": cfg["brasD"]["pivot"],
            "jambe-g": cfg["pivotJG"], "jambe-d": cfg["pivotJD"],
        }
        if piece in pivots:
            entree["pivotX"], entree["pivotY"] = pivots[piece]
        meta_pieces[piece] = entree

    # contrôle : assemblage au repos (ordre de profondeur) == original.
    # Les bandes sont empilées (membre dessus/dessous du buste) : sur les
    # pixels de bord anti-aliassés (0 < alpha < 255) l'empilement renforce
    # légèrement l'alpha — RGB doit rester identique, alpha toléré ±70.
    # Tout pixel opaque doit être EXACT : un trou ou une pièce mal placée
    # échoue ici. Les franges alpha ≤ seuil sont invisibles (ignorées).
    ordre = ("bras-g", "jambe-g", "buste", "jambe-d", "bras-d")
    recompose = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for piece in ordre:
        recompose.alpha_composite(images[piece][0], dest=(boxes[piece][0], boxes[piece][1]))
    rp, op = recompose.load(), im.load()
    aa = 0
    for y in range(h):
        for x in range(w):
            rc, oc = rp[x, y], op[x, y]
            if rc == oc:
                continue
            if oc[3] <= SEUIL and rc[3] <= SEUIL:
                continue
            if oc[3] == 0 or rc[3] == 0:
                raise SystemExit(f"[rig] pixel fantôme en ({x},{y}) : {rc} vs {oc}")
            if rc[:3] != oc[:3] or abs(rc[3] - oc[3]) > 70:
                raise SystemExit(f"[rig] repos diffère en ({x},{y}) : {rc} vs {oc}")
            aa += 1
    if aa:
        print(f"[rig]   bordures AA empilées : {aa} px (RGB identiques)")

    meta = {"largeur": w, "hauteur": h, "pieces": meta_pieces}
    return images, meta


# ---------------------------------------------------------------------------
# Planche de contrôle visuel (poses articulées, rendu PIL)
# ---------------------------------------------------------------------------

def planche(images, pivots, dest):
    """Grille de poses de contrôle (fresh file à lire par l'agent)."""
    poses = [
        ("repos", {}, (0, 0)),
        ("poing (bras -92)", {"bras-d": -92}, (0, 0)),
        ("pied haut (-78)", {"jambe-d": -78}, (0, 0)),
        ("pied bas (-36)", {"jambe-d": -36}, (0, 0)),
        ("garde haute (bras +150)", {"bras-g": 150}, (0, 0)),
        ("garde basse (jambe +58)", {"jambe-g": 58}, (0, 0)),
        ("contre : saut + pied (-85)", {"jambe-d": -85}, (0, -120)),
    ]
    cols = 4
    rows = (len(poses) + cols - 1) // cols
    cell = (420, 560)
    feuille = Image.new("RGB", (cell[0] * cols, cell[1] * rows + 4), (12, 12, 18))
    draw = ImageDraw.Draw(feuille)
    for i, (label, angles, decale) in enumerate(poses):
        c = compose_pose(images, pivots, angles, decale)
        cx, cy = (i % cols) * cell[0], (i // cols) * cell[1]
        feuille.paste(c, (cx, cy))
        draw.rectangle([cx + 4, cy + 4, cx + 10 + 7 * len(label), cy + 22],
                       fill=(0, 0, 0))
        draw.text((cx + 8, cy + 8), label, fill=(255, 220, 120))
    feuille.save(dest)
    print(f"[rig] planche QA : {os.path.relpath(dest, RACINE)}")


def compose_pose(images, pivots, angles, decale):
    """Pose complète : rotations Phaser (horaires +) → PIL (antihoraire +).

    Chaque pièce est posée dans un calque PLEIN CADRE puis tournée dans ce
    calque (expand=False, centre = pivot) : on évite le recadrage de
    `rotate(center, expand=True)` qui clippe les membres excentrés. La pièce
    posée est dessinée EN DERNIER — le jeu élève sa profondeur pendant
    l'animation (membre au-dessus du buste). `decale` = translation du rig
    (saut du contre), appliquée à toutes les pièces.
    """
    tole = (80, 80)
    frame = (420, 560)
    canevas = Image.new("RGBA", frame, (24, 22, 34, 255))
    repos = ("bras-g", "jambe-g", "buste", "jambe-d", "bras-d")
    ordre = tuple(p for p in repos if p in angles) + \
        tuple(p for p in repos if p not in angles)
    for piece in ordre:
        morceau, (bx, by, bw, bh) = images[piece]
        del bw, bh
        calque = Image.new("RGBA", frame, (0, 0, 0, 0))
        calque.alpha_composite(
            morceau, dest=(bx + tole[0] + decale[0], by + tole[1] + decale[1]))
        angle = angles.get(piece, 0)
        if angle:
            cx = pivots[piece][0] + tole[0] + decale[0]
            cy = pivots[piece][1] + tole[1] + decale[1]
            calque = calque.rotate(-angle, resample=Image.BICUBIC,
                                   center=(cx, cy))
        canevas.alpha_composite(calque)
    return canevas


def main():
    meta_global = {}
    for nom_fichier, cfg in CONFIG_RIG.items():
        images, meta = decouper(f"{nom_fichier}.png", cfg)
        meta_global[cfg["cle"]] = meta
        pivots = {
            "bras-g": cfg["brasG"]["pivot"], "bras-d": cfg["brasD"]["pivot"],
            "jambe-g": cfg["pivotJG"], "jambe-d": cfg["pivotJD"],
            "buste": (0, 0),
        }
        print(f"[rig] {nom_fichier} : 5 pièces, couverture + repos identiques OK")
        planche(images, pivots,
                os.path.join(TMP, f"rig-qa-{nom_fichier[-1]}.png"))
    chemin_meta = os.path.join(SRC, "rig-meta.json")
    with open(chemin_meta, "w", encoding="utf-8") as f:
        json.dump(meta_global, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[rig] meta : {os.path.relpath(chemin_meta, RACINE)}")


if __name__ == "__main__":
    main()
