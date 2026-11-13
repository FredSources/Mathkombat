# Méthode de production des images et sprites — MathKombat

Document opérationnel : comment sont **créés, déclinés et intégrés** tous les visuels
du jeu (personnages, animations, décors, UI). Objectif : des sprites **cohérents**,
**lisibles sur mobile**, et une production **pilotable par agent**.

## 1. Chaîne de production

```
1. Planche de référence (génération + édition par référence)
2. Déclinaison des états (idle, charge, frappe, garde, parade, contre, touché, ko)
3. Découpe / assemblage (PIL + ImageMagick)
4. Post-traitement (fond, tailles, spritesheet)
5. Intégration Phaser + vérification visuelle + captures
```

**Outils du projet** : génération/édition d'images par IA (références de style),
`python3` + **PIL** (découpe précise, calques), **ImageMagick** (`convert`, `montage`,
`identify` — batch, redimensionnement, spritesheets), `ffmpeg` (aperçus animés GIF),
lecture visuelle des PNG par l'agent (contrôle qualité).

## 2. Direction artistique

- Style **cartoon / BD** : contours nets, couleurs vives, formes simples — lisible
  sur un petit écran et cohérent avec l'ambiance **arcade rétro** des écrans
  d'entrée (§ wireframes).
- Chaque combattant : palette 3–4 couleurs dominantes + couleur d'**aura** propre
  (l'aura doit ressortir sur le fond d'arène).
- Aucun texte dans les sprites (les textes sont rendus par le jeu : dégâts flottants,
  HUD).

### 2a. Cible de rendu — 3/4 de face façon *Mortal Kombat* / *Street Fighter*

**Exigence utilisateur (2026-11-13)** : à terme, les combattants doivent être
représentés **en 3/4 de face**, avec un rendu de jeu de combat 2D de référence
(*Mortal Kombat*, *Street Fighter*).

- **3/4 de face** : corps légèrement tourné (un épaule en avant), tête de trois
  quarts, regard vers l'adversaire — pas de profil pur, pas de face complète.
  Les pièces cut-out sont générées dans cette orientation dès la prochaine
  planche (`perso-a`/`perso-b` v2) : épaule avant/rear distinctes, jambe avant
  décalée en X, silhouette asymétrique.
- **Rendu MK/SF** : proportions héroïques (épaules larges, taille marquée),
  contours sombres nets, ombres portées simples, **ligne d'action lisible** —
  la pose doit se lire en silhouette sur l'arène.
- **Conséquences techniques** (inchangées pour l'instant) : le cut-out animé par
  tweens (§3) reste la méthode ; la symétrie de gauche/droite n'est plus
  utilisée — chaque personnage est retourné par `setFlipX()`, ce qui convient au
  3/4 (la ligne d'action inversée reste crédible).
- **Planification** : refonte des planches → **J6** (avec la sélection de
  personnage), validation visuelle en **J8** (QA/polish). Ne casse rien en J5 :
  les sprites actuels restent en place.

## 3. Méthode 1 — « cut-out animé » (privilégiée)

Principe : un personnage = **pièces détachées** (tête, buste, bras avant/arrière,
jambes) animées par **tweens Phaser** (rotations/translations), plutôt qu'une image
par frame.

- **Avantages** : une seule génération par personnage (cohérence totale entre les
  états), fluide (60 fps par interpolation), léger (peu de fichiers), retouches
  faciles (une pièce à régénérer).
- **Découpe** : sur la planche de référence, les pièces sont découpées au calque
  (PIL) puis exportées en PNG 32 bits **fond transparent** (recadrage par boîte
  englobante non transparente).
- **États produits par combinaison de poses + tweens** :

| État | Recette |
|------|---------|
| `idle` | respiration (léger scaleY sinusoïdal), bras bas |
| `charge` | position de concentration, tremblement + aura (effet de code) |
| `frappe` | extension du bras avant (rotation épaule), appui de jambe — vitesse/extension selon le **tier** (§2.8b) |
| `garde` | bras croisés devant le buste |
| `parade` | décalage latéral + bras bloquant |
| `contre` | parade puis riposte (enchaînement de tweens) |
| `touche` | recul + inclinaison arrière |
| `ko` | chute (rotation complète) au sol |

- Les **effets** (aura, particules, ondes, flashs, secousses, dégâts flottants) sont
  générés **par le code** (Phaser graphics/particles) : zéro asset.

#### 3a. Coups de poing et de pied en sprites (exigence utilisateur, 2026-11-13)

L'élan de frappe actuel déplace tout le conteneur (translation + recul) : c'est
crédible mais ce n'est **pas un coup animé**. Exigence : **coup de poing et coup
de pied animés avec des sprites**.

- **Poing** : le bras avant pivote de l'épaule en 3 temps — *chamber* (poing
  ramené, coude replié) → *extension* (bras tendu, épaule en avant, buste qui
  suit) → *recul* ; la pièce `bras-avant.png` est la seule à animer (+ rotation
  du buste de 5–10°).
- **Pied** : coup de pied circulaire / front kick — la jambe avant se relève
  (`jambe-av.png` pivotée à la hanche), le buste s'incline en arrière pour
  l'équilibre, la jambe arrière reste plantée ; retour en `idle`.
- **Choix du coup** : déterministe à partir du tier (§2.8b) — `tier 1–2` = poing,
  `tier 3–4` = pied (le pied est le coup « lourd »), **le choix vit dans
  `config.ts`** (`coupsParTier`), jamais dans la scène.
- **Livrable** : deux recettes d'animation (`animPoing`, `animPied`) + les pièces
  nécessaires si la planche v2 doit les prévoir (poing fermé visible, pied
  chaussé/net). À produire en **J6** avec la refonte 3/4 (§2a).

## 4. Méthode 2 — spritesheet frame-by-frame (dépannage)

Pour les animations qui se prêtent mal au cut-out (chute élaborée, éclairs d'aura) :

1. Génération d'**une frame de référence** (pose), puis déclinaison des frames
   suivantes **en utilisant la frame précédente comme référence de style** (édition
   par référence — garde la cohérence).
2. Assemblage : `montage -tile 8x1 -geometry +0+0 frame-*.png perso-spritesheet.png`
   (grille documentée dans `game/assets/README.md` : ordre des frames, taille).
3. Contrôle : `identify` (dimensions homogènes), lecture visuelle de la planche.

## 5. Génération et édition par référence — règles de cohérence

- **Toujours** partir d'une **planche de référence** validée (personnage vu de face,
  corps entier, fond uni) ; chaque déclinaison passe la planche en **référence**.
- Un prompt = un visuel ; décrire : sujet, pose, style, palette, cadrage, fond.
- Après chaque génération : **je relis l'image** (contrôle visuel), je retouche le
  prompt ou j'édite jusqu'à cohérence. Toute image retenue est copiée dans
  `game/assets/` (jamais de référence à un fichier temporaire).
- **Limites connues** des générateurs : mains/pieds, symétrie parfaite, texte,
  cohérence frame à frame → d'où la préférence pour le cut-out (méthode 1) et les
  formes simples.

## 6. Inventaire des assets

```
game/assets/
├── personnages/
│   ├── perso-a/   planche.png, tete.png, buste.png, bras-avant.png,
│   │              bras-arriere.png, jambe-av.png, jambe-ar.png
│   └── perso-b/   idem
├── decors/        arena-1.png (1280×720), arena-2.png
├── effets/        flamme-1.png, flamme-2.png (160×320, RGBA blanc teintable)
├── ui/            titre.png, cadre-retro.png, bouton-run.png, bouton-config.png
└── README.md      # grille des spritesheets éventuelles (ordre, tailles)
```

- Formats : **PNG 32 bits** (transparence), personnages ≈ 350 px de haut à
  l'échelle mobile (référence écran **1280×720** paysage).
- Nommage : minuscules, tirets, français (`bras-avant.png`).

### 6a. Textures de flamme (aura §2.8a)

- **Génération** : `scripts/assets-flammes.py` (PIL) — 2 variantes de langue de
  flamme 160×320, RGB blanc + alpha construit (masse arrondie + pointes,
  flou gaussien durci `0.05·L` fondu 62 % avec le noyau net, bas atténué pour
  éviter toute coupe franche). Teintables a posteriori.
- **Teinte en jeu — teinte CPU, jamais `setTint()`** : le rendu WebGL
  n'applique pas le tint vertex dans tous les environnements (constaté en captures
  headless — image tintée rouge rendue **blanche**) → `FightScene.textureTeintee()`
  cuisine la couleur par multiplication par pixel dans un canvas (une copie par
  (variante, couleur)), et `melangerVersBlanc()` reste la source unique des
  teintes (langue colorée + noyau incandescent).
- **Composition à deux couches** : langue colorée en fusion **normale**
  (l'ADD la délavait sur le décor clair) + petit noyau en fusion **ADD** ;
  vacillement par tweens décalés (hauteur, largeur, éclat, balancement).
- **Contraste WCAG 1.4.11** mesuré sur captures réelles : corps des langues
  ≥ 3:1 contre le fond, noyaux ≈ 8–10:1 (paliers 1–2).

### 6b. Sons (§2.8d — fin de J5)

- **Génération** : `scripts/assets-sons.py` (Python stdlib uniquement : `wave`,
  `math`, `struct`) — **100 % déterministe**, aucun binaire importé, aucun
  réseau. Sortie : `game/assets/sons/*.wav`, **22 050 Hz, mono, PCM 16 bits**.
- **Fichiers** : `reussite.wav` (carillon montant), `erreur.wav` (basse
  dissonante), `frappe.wav` (percussion sourde + bruit filtré), `blocage.wav`
  (« ting » métallique), `ko.wav` (chute grave + vibrato).
- **Chaîne** : enveloppe ADSR + oscillateurs (sinus/carré) + bruit pseudo-aléatoire
  déterministe (LCG), mélange borné, normalisation d'amplitude ; chaque son
  tient < 1 s.
- **Intégration** : `BootScene` précharge via `this.load.audio(...)` ; la scène
  joue par `jouerSon(nom)` qui **vérifie `cache.audio.exists(nom)`** — un son
  absent (boot partiel, couverture de tests) est un no-op, jamais une erreur.
  Aucune intensité de son en dur : les durées/amplitudes vivent dans le
  générateur, les déclenchements dans la scène.

## 7. Contrôle qualité (chaque livraison d'asset)

1. `identify` : dimensions et format conformes.
2. **Lecture visuelle** par l'agent (cohérence de style, découpe propre, pas de
   résidu de fond).
3. Intégration Phaser puis **capture d'écran** dans `output/screenshots/` (E05).
4. Entrée dans `journal.md` (assets produits, retouches, anomalies).

## 8. Rappels d'intégration (§ AGENTS 2.8)

- L'intensité de l'aura et les **tiers de frappe** sont pilotés par `config.ts`
  (fonctions déterministes de la puissance) — les sprites ne contiennent aucune
  règle métier.
- Les animations sont **non bloquantes** ; le cut-out par tweens garantit la
  fluidité 60 fps (M06).
