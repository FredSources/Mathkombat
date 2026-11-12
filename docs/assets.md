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
├── ui/            titre.png, cadre-retro.png, bouton-run.png, bouton-config.png
└── README.md      # grille des spritesheets éventuelles (ordre, tailles)
```

- Formats : **PNG 32 bits** (transparence), personnages ≈ 350 px de haut à
  l'échelle mobile (référence écran **1280×720** paysage).
- Nommage : minuscules, tirets, français (`bras-avant.png`).

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
