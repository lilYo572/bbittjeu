# Brad Bitt, mais le jeu — prototype 01 : sensations

Premier jalon technique. Il ne contient **que le socle de déplacement**, parce
que c'est ce que tes deux documents de gameplay désignent comme prioritaire
(« le personnage doit être agréable à contrôler avant même d'ajouter de
nombreuses mécaniques »).

## Lancer

Double-clique `index.html`. Aucune dépendance, aucun serveur nécessaire.
Le projet est déployable tel quel sur Netlify (dossier racine, pas de build).

## Commandes

| Action | Touches |
|---|---|
| Déplacement | ← → · A D · Q D |
| Saut | Espace · ↑ · W · Z — **maintenir = plus haut** |
| Courir | Maj |
| Retour au début | R |
| Panneau de réglages | F1 ou le bouton ⚙ |

Les claviers AZERTY et QWERTY sont pris en charge sans configuration.
Sur mobile, des boutons tactiles apparaissent automatiquement.

## Ce qui est implémenté

Tiré du document « Gameplay général » :

- accélération et décélération progressives (pas de vitesse binaire)
- gain d'accélération au demi-tour : le changement de sens reste vif sans
  supprimer la sensation de poids
- saut à hauteur variable (la gravité est multipliée dès que le bouton est
  relâché pendant la montée)
- **coyote time** : saut encore possible pendant un court délai après le bord
- **jump buffer** : appui mémorisé juste avant l'atterrissage
- gravité de chute supérieure à la gravité de montée → saut nerveux
- contrôle aérien réduit par rapport au sol
- caméra souple avec anticipation dans le sens du déplacement, et zone morte
  verticale (la caméra ne bouge presque pas en hauteur, comme demandé)
- squash & stretch au décollage et à l'atterrissage
- animation d'inactivité : Brad sort son téléphone après 6 s, s'endort après 14 s
- réapparition au dernier sol stable plutôt qu'au début du niveau
- double saut présent mais **désactivé par défaut** (c'est un déblocage de
  progression d'après tes notes)

## Pas encore là (volontairement)

Ennemis fonctionnels, combat, Brad‑Shy, PV, Brad Coins, boutique, hub,
sauvegarde de partie, sons, menus. Les 5 Serra visibles dans le niveau sont
des **figurants immobiles**, uniquement là pour juger des proportions à l'écran.

## Le panneau de réglages

Chaque paramètre de sensation est exposé en direct (F1). Les valeurs sont
mémorisées dans le navigateur et « Copier le réglage » met le JSON dans le
presse‑papier — c'est le moyen le plus rapide de me transmettre le feel que tu
retiens pour que je le fige dans le code.

Toutes les valeurs sont en **pixels par seconde** et en **secondes**, jamais
« par image » : la physique tourne à pas fixe de 1/120 s, donc les sensations
sont identiques sur un écran 60 Hz et sur un 144 Hz.

## Structure

```
index.html              page unique
style.css               interface (panneau, commandes tactiles)
script.js               moteur : entrées, physique, collisions, caméra, rendu
assets/ennemis/*.png    sprites extraits automatiquement des JPG
tools/extract_sprites.py script d'extraction (détourage + réduction)
```

Cette structure suit celle de tes notes (`index` / `script` / `style`).
Quand on ajoutera les niveaux, ils viendront dans `niveaux/niveau-X.js` sous
forme de données, sans dupliquer le moteur.

### Regénérer les sprites

```bash
python3 tools/extract_sprites.py "chemin/vers/Ennemis/Animé" assets/ennemis 40
```

Le dernier argument est la hauteur de référence en pixels. `40` correspond à
la résolution interne actuelle du jeu (640×360). Le script détoure le fond
blanc, supprime les artefacts JPEG, recadre, réduit et force un alpha binaire
pour un rendu pixel net.

## Limite connue des sprites

Chaque ennemi n'existe qu'en **une seule pose**. Il n'y a donc pas de cycle de
marche, d'attaque ni de mort. Deux voies possibles quand on attaquera les
ennemis : animer la pose unique par le code (déformation, rotation, rebond —
suffisant pour un goomba‑like), ou produire de vraies frames supplémentaires.
