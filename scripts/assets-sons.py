#!/opt/opencode-venv/bin/python3
"""scripts/assets-sons.py — sons du combat générés (J5, §2.8 « juice »).

Synthèse WAV mono 16 bits, 22 050 Hz, sans dépendance externe (stdlib `wave` +
`math` + générateur pseudo-aléatoire fixé → 100 % déterministe, reproductible).

Sons produits (game/assets/sons/) :
  - reussite   blip montant à deux tons (calcul validé)
  - erreur     buzz grave court (« Faux ! »)
  - frappe     impact : balayage grave + souffle (coup porté)
  - blocage    « ting » métallique (blocage parfait)
  - ko         plongée sourde + queue de souffle (K.O.)

Usage : scripts/assets-sons.py
"""
import math
import random
import struct
import sys
import wave
from pathlib import Path

FREQUENCE = 22050  # Hz


def enveloppe(t: float, duree: float, attaque: float = 0.005, queue: float = 0.6) -> float:
    """Enveloppe : montée rapide puis décroissance exponentielle."""
    if t < attaque:
        return t / attaque
    reste = (t - attaque) / max(1e-6, duree - attaque)
    return math.exp(-5.0 * queue * reste)


def echantillons_reussite() -> list[float]:
    duree = 0.16
    n = int(FREQUENCE * duree)
    sortie = []
    for i in range(n):
        t = i / FREQUENCE
        # blip montant : 880 → 1320 Hz (deux pas de gamme)
        pas = 0.07
        f = 880.0 if t < pas else 1318.5
        porte = math.sin(2 * math.pi * f * t)
        signal = 0.6 * porte + 0.25 * math.sin(2 * math.pi * f * 2 * t)
        sortie.append(signal * enveloppe(t, duree, queue=0.9))
    return sortie


def echantillons_erreur() -> list[float]:
    duree = 0.24
    n = int(FREQUENCE * duree)
    sortie = []
    for i in range(n):
        t = i / FREQUENCE
        f = 146.0 - 18.0 * (t / duree)  # légèrement descendante
        # saw approximée (buzz) : quelques harmoniques
        signal = sum(
            math.sin(2 * math.pi * f * k * t) / k for k in (1, 3, 5, 7)
        )
        sortie.append(0.5 * signal * enveloppe(t, duree, queue=0.55))
    return sortie


def echantillons_frappe() -> list[float]:
    duree = 0.22
    n = int(FREQUENCE * duree)
    rng = random.Random(7)
    sortie = []
    for i in range(n):
        t = i / FREQUENCE
        # balayage grave 190 → 52 Hz (impact lourd)
        f = 190.0 - 138.0 * min(1.0, t / 0.12)
        corps = math.sin(2 * math.pi * f * t)
        # souffle d'impact : bruit filtré (moyenne mobile courte) dans les 50 ms
        souffle = 0.0
        if t < 0.05:
            bruit = sum(rng.uniform(-1, 1) for _ in range(3)) / 3.0
            souffle = bruit * (1.0 - t / 0.05) * 0.9
        sortie.append((0.85 * corps + souffle) * enveloppe(t, duree, queue=0.75))
    return sortie


def echantillons_blocage() -> list[float]:
    duree = 0.32
    n = int(FREQUENCE * duree)
    sortie = []
    # « ting » métallique : partiels inharmoniques (2,1,3 → cloche)
    for i in range(n):
        t = i / FREQUENCE
        signal = (
            0.5 * math.sin(2 * math.pi * 2093.0 * t)
            + 0.3 * math.sin(2 * math.pi * 3140.0 * t)
            + 0.2 * math.sin(2 * math.pi * 4700.0 * t)
        )
        sortie.append(signal * enveloppe(t, duree, queue=1.1))
    return sortie


def echantillons_ko() -> list[float]:
    duree = 0.75
    n = int(FREQUENCE * duree)
    rng = random.Random(11)
    sortie = []
    for i in range(n):
        t = i / FREQUENCE
        # plongée 95 → 32 Hz + souffle en queue
        f = 95.0 - 63.0 * min(1.0, t / 0.45)
        corps = math.sin(2 * math.pi * f * t)
        souffle = 0.0
        if 0.05 < t < 0.4:
            souffle = sum(rng.uniform(-1, 1) for _ in range(3)) / 3.0 * 0.35
        sortie.append((0.8 * corps + souffle) * enveloppe(t, duree, queue=0.7))
    return sortie


SONS = {
    "reussite": echantillons_reussite,
    "erreur": echantillons_erreur,
    "frappe": echantillons_frappe,
    "blocage": echantillons_blocage,
    "ko": echantillons_ko,
}


def ecrire(nom: str, samples: list[float], dossier: Path) -> Path:
    """Écrit en 16 bits signés mono, normalisé à ±90 % pour éviter la saturation."""
    pic = max(1e-9, max(abs(s) for s in samples))
    echelle = 0.9 / pic
    donnees = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, s * echelle)) * 32767)) for s in samples
    )
    chemin = dossier / f"{nom}.wav"
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(FREQUENCE)
        w.writeframes(donnees)
    return chemin


def main() -> int:
    dossier = Path(__file__).resolve().parent.parent / "game" / "assets" / "sons"
    dossier.mkdir(parents=True, exist_ok=True)
    for nom, fabrique in SONS.items():
        chemin = ecrire(nom, fabrique(), dossier)
        print(f"{chemin} : {informations(chemin)}")
    return 0


def informations(chemin: Path) -> str:
    with wave.open(str(chemin), "rb") as w:
        duree = w.getnframes() / w.getframerate()
    return f"{chemin.stat().st_size} octets, {duree:.2f} s"


if __name__ == "__main__":
    sys.exit(main())
