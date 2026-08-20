# Brad Bitt, mais le jeu — prototype 03 : le Serra fonctionnel

Deuxième jalon. Le socle de déplacement du prototype 01 est intact ; s'y ajoute
la **boucle de combat complète** autour des cinq Serra.

## Lancer

Double-clique `index.html`. Aucune dépendance, aucun serveur, aucun `fetch()` —
la page fonctionne en `file://` comme sur Netlify (dossier racine, pas de build).

## Commandes

| Action | Touches |
|---|---|
| Déplacement | ← → · A D · Q D |
| Saut | Espace · ↑ · W · Z — **maintenir = plus haut** |
| Courir | Maj |
| Frapper / lancer la boule | X · J |
| Onde de choc (Brad-Shy) | C · K |
| Relancer le niveau | R |
| Panneau de réglages | F1 ou le bouton ⚙ |

AZERTY et QWERTY sans configuration. Boutons tactiles automatiques sur mobile.

## Les cinq Serra

| Ennemi | Rôle | Comment le battre |
|---|---|---|
| **Serra** | le goomba du jeu | saut sur la tête, ou un coup |
| **Serra-Boost** | le coureur : rapide, fragile, détecte de plus loin | pareil, mais il arrive vite |
| **Serra-Lourd** | lent, 3 PV, 2 de dégâts, donne plus de Brad-Shy | **ne s'écrase pas** — trois coups |
| **Serra-Lanceur** | posté, envoie des boules de Serrano en cloche | **immunisé à tes coups** — ramasse sa boule et renvoie-la, il tombe en un coup |
| **Serra-Volant** | vole, ignore les plateformes | écrasement ou attaque aérienne |

Tous suivent le même comportement : patrouille, demi-tour au mur **et au bord
d'une plateforme**, détection de Brad dans un rayon (même de dos) →
**point d'exclamation rouge** → délai de réaction → charge. Ils perdent la
trace de Brad un peu au-delà de leur portée, pour éviter de s'allumer et de
s'éteindre au moindre pas.

Le garde-fou anti-blocage signalé dans tes notes est en place : tout contact
avec dégâts repousse les deux corps, et un chevauchement qui dure force
l'ennemi à s'écarter. Un Serra ne peut pas rester coincé sous Brad.

## La boucle de combat

- **Corps-à-corps gratuit et illimité**, borné seulement par un délai de
  recharge. Zone de dégâts devant Brad, plus basse et plus large en l'air.
- **Écrasement** : Brad rebondit. Maintenir le saut au moment de l'impact donne
  un rebond plus haut — de quoi enchaîner plusieurs ennemis.
- **Brad-Shy = jauge d'ultime** (la version retenue). Elle se remplit en
  éliminant, un ennemi coriace en donne davantage. À 100 %, `C` déclenche une
  onde de choc qui balaie les alentours et remet la jauge à zéro.
- **Dégâts subis** : recul, invincibilité temporaire, clignotement. Brad lâche
  la boule qu'il porte.
- **Récompenses** : Brad Coins qui rebondissent au sol et sont aimantés à 40 px.
  Les soins ne tombent **que si Brad a réellement perdu de la vie** — quand sa
  barre est pleine il reste sur ses gardes, exactement comme demandé.
- **Mort** : écran rouge, nom de l'ennemi, conseil dans le ton. Réapparition au
  dernier sol stable ; **trois morts d'affilée** renvoient au début du niveau.

## Le panneau de réglages

Toutes les valeurs de sensation *et de combat* sont exposées en direct (F1) :
portée et durée du coup, rebond, gain de Brad-Shy, rayon de l'onde, vitesse et
portée de détection des ennemis, délai avant la charge, recul et invincibilité.

Les réglages sont mémorisés dans le navigateur, et « Copier le réglage » met le
JSON dans le presse-papier — le moyen le plus rapide de me transmettre
l'équilibrage que tu retiens.

Toutes les valeurs sont en **pixels par seconde** et en **secondes**, jamais
« par image » : la physique tourne à pas fixe de 1/120 s, donc les sensations
sont identiques sur un écran 60 Hz et sur un 144 Hz.

## Structure

```
index.html                page unique
style.css                 interface (panneau, commandes tactiles)
js/reglages.js            toutes les valeurs ajustables + persistance
js/monde.js               constantes, images, données du niveau de test
js/acteurs.js             Brad, ennemis, boules, ramassages, effets
js/entrees.js             clavier (AZERTY + QWERTY) et tactile
js/jeu.js                 caméra, rendu, interface, boucle
assets/brad/brad.png      planche de Brad, 4×3 cellules de 36×48
assets/ennemis/*.png      sprites extraits automatiquement des JPG
tools/extract_brad.py     découpe de la planche de Brad
tools/extract_sprites.py  extraction des ennemis
```

Scripts classiques chargés dans l'ordre, **pas de modules ES** : c'est ce qui
permet d'ouvrir la page par double-clic. Les modules exigeraient un serveur.

Quand on attaquera les niveaux, ils viendront dans `niveaux/niveau-X.js` sous
forme de données, sans dupliquer le moteur.

### Regénérer les sprites

```bash
python3 tools/extract_sprites.py "chemin/vers/Ennemis/Animé" assets/ennemis 34
python3 tools/extract_brad.py "chemin/vers/version corrigé sprite.png" assets/brad 46
```

Le dernier argument est la hauteur de référence : `34` pour un Serra de base,
`46` pour Brad, toutes deux calées sur la résolution interne de 640×360.

`extract_brad.py` aligne les images sur le **centre de la tête** plutôt que sur
la boîte englobante : les bras qui se balancent élargissent la boîte d'une image
à l'autre, et un centrage naïf ferait vibrer Brad latéralement à chaque pas.

## Ce qui est animé par le code

Aucune image d'animation n'a été produite. Tout vient des poses existantes :

- **ennemis** — balancement de marche, étirement au moment du « ! », inclinaison
  vers l'avant en charge, flash blanc quand ils encaissent, écrasement à la mort ;
- **Brad** — le cycle de pas utilise tes 12 images, mais il n'y a ni pose de saut
  ni pose de chute : le jeu réutilise deux images de course dont la silhouette se
  lit bien en l'air. Même astuce pour le téléphone et le sommeil, dessinés
  par-dessus les images de repos ;
- **le coup de poing** — un arc lumineux, faute d'image d'attaque.

Trois ou quatre images supplémentaires (saut, chute, coup) suffiraient à
remplacer ces astuces sans rien recoder : il n'y a qu'un index de ligne et de
colonne à changer.

## Pas encore là

Architecture de niveau et zones de décor, musique, hub, boutique, BRADDY3000,
dialogues, sauvegarde de partie, sons. Les Brad Coins comptés ici ne sont pas
encore écrits en localStorage — ça viendra avec le système de sauvegarde.
