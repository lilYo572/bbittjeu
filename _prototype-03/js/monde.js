/* =============================================================================
   BRAD BITT, MAIS LE JEU — monde
   Constantes de rendu, chargement des images, donnees du niveau de test.
   ========================================================================== */
'use strict';

const LARGEUR = 640;      // resolution interne, mise a l'echelle en CSS
const HAUTEUR = 360;
const TUILE = 24;

const canvas = document.getElementById('jeu');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

/* --- Images --------------------------------------------------------------
   Aucun fetch() : la page doit rester ouvrable par double-clic (file://),
   ou les requetes XHR sont bloquees. Les metadonnees de planche sont donc
   ecrites en dur ici. assets/brad/brad.json en garde une copie lisible.
------------------------------------------------------------------------- */

const sprites = {};
['Serra', 'Serra-Boost', 'Serra-Lourd', 'Serra-Lanceur', 'Serra-Volant', 'boule-serrano']
  .forEach(nom => {
    const img = new Image();
    img.src = 'assets/ennemis/' + nom + '.png';
    img.onload = () => { sprites[nom] = img; };
  });

const BRAD_PLANCHE = {
  cw: 36, ch: 48,
  piedsDansCellule: 47,
  repos: 0, marche: 1, course: 2,
};

const imgBrad = new Image();
let bradPret = false;
imgBrad.src = 'assets/brad/brad.png';
imgBrad.onload = () => { bradPret = true; };

/* --- Niveau de test ------------------------------------------------------
   Chaque zone existe pour valider un point precis : soit une sensation de
   deplacement, soit un comportement d'ennemi.
------------------------------------------------------------------------- */

const SOLIDES_T = [
  [0, 15, 30, 3],                                        // sol de lancement
  [33, 15, 15, 3],                                       // apres le trou
  [48, 14, 3, 4], [51, 13, 3, 5], [54, 12, 3, 6],        // escalier
  [57, 11, 10, 7],                                       // plateau du Lourd
  [88, 6, 3, 12],                                        // mur a franchir
  [91, 15, 14, 3],                                       // corridor bas
  [94, 10, 9, 1],                                        // plafond bas
  [98, 12, 4, 1],                                        // corniche du Lanceur
  [105, 15, 13, 3],
  [120, 13, 1, 5], [123, 13, 1, 5], [126, 13, 1, 5], [129, 13, 1, 5], // piliers
  [132, 15, 10, 3],                                      // arrivee
  [-2, 0, 2, 18], [142, 0, 2, 18],                       // murs de fin de niveau
];

const TRAVERSANTES_T = [
  [70, 12, 4], [76, 10, 4], [82, 8, 4],
];

const NIVEAU_L = 144 * TUILE;
const NIVEAU_H = 18 * TUILE;

const solides = SOLIDES_T.map(([x, y, w, h]) =>
  ({ x: x * TUILE, y: y * TUILE, w: w * TUILE, h: h * TUILE }));
const traversantes = TRAVERSANTES_T.map(([x, y, w]) =>
  ({ x: x * TUILE, y: y * TUILE, w: w * TUILE, h: 6 }));

const PANNEAUX = [
  { x: 3, y: 13, texte: 'Inertie : lance et relâche' },
  { x: 16, y: 13, texte: 'Écrase-le (saut) ou frappe (X)' },
  { x: 26, y: 13, texte: 'Trou : coyote time' },
  { x: 35, y: 13, texte: 'Le coureur charge vite' },
  { x: 44, y: 13, texte: 'Escalier' },
  { x: 58, y: 9, texte: 'Le Lourd ne s\'écrase pas : 3 coups' },
  { x: 70, y: 10, texte: 'Plateformes traversables' },
  { x: 80, y: 6, texte: 'Le Volant : attaque en l\'air' },
  { x: 92, y: 13, texte: 'Lanceur : renvoie-lui sa boule' },
  { x: 108, y: 13, texte: 'Onde de choc : C quand la jauge est pleine' },
  { x: 118, y: 11, texte: 'Précision : jump buffer' },
  { x: 134, y: 13, texte: 'Arrivée' },
];

/* Position d'apparition des ennemis, en tuiles. `y` est la ligne du SOL sur
   lequel ils se tiennent (pour les volants, la ligne de vol). */
const ENNEMIS_DEPART = [
  { type: 'Serra', x: 18, y: 15 },
  { type: 'Serra', x: 24, y: 15 },
  { type: 'Serra-Boost', x: 40, y: 15 },
  { type: 'Serra', x: 45, y: 15 },
  { type: 'Serra-Lourd', x: 62, y: 11 },
  { type: 'Serra-Volant', x: 79, y: 7 },
  { type: 'Serra-Volant', x: 85, y: 5 },
  { type: 'Serra-Lanceur', x: 100, y: 12 },
  { type: 'Serra', x: 96, y: 15 },
  { type: 'Serra-Boost', x: 110, y: 15 },
  { type: 'Serra', x: 113, y: 15 },
  { type: 'Serra', x: 116, y: 15 },
  { type: 'Serra-Boost', x: 136, y: 15 },
];

const APPARITION = { x: 3 * TUILE, y: 12 * TUILE };

/* --- Utilitaires geometriques -------------------------------------------- */

function chevauche(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solSous(x, ligneY) {
  return solides.concat(traversantes).some(s =>
    x >= s.x && x <= s.x + s.w && Math.abs(s.y - ligneY) < 2);
}
