/* =============================================================================
   BRAD BITT, MAIS LE JEU — prototype de sensations (game feel)
   IMAGINe Studio / HwR Engine

   Ce fichier ne contient volontairement QUE le socle de deplacement :
   acceleration, inertie, saut a hauteur variable, coyote time, jump buffer,
   collisions et camera. Les ennemis presents a l'ecran sont des figurants
   immobiles, la uniquement pour juger des proportions a l'ecran.

   Aucune dependance, aucun module ES : le fichier fonctionne aussi bien en
   double-cliquant index.html qu'une fois deploye sur Netlify.
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. REGLAGES
   Chaque entree decrit une valeur ajustable en direct depuis le panneau.
   Les valeurs sont en pixels et en secondes (jamais en "par frame"), ce qui
   rend le jeu identique en 60 Hz et en 120 Hz.
-------------------------------------------------------------------------- */

const SCHEMA = [
  { groupe: 'Course au sol' },
  { cle: 'vitesseMarche', nom: 'Vitesse de marche', min: 60, max: 260, pas: 5, defaut: 150, unite: 'px/s',
    note: "Vitesse maximale sans maintenir Maj." },
  { cle: 'vitesseCourse', nom: 'Vitesse de course', min: 100, max: 420, pas: 5, defaut: 250, unite: 'px/s',
    note: "Vitesse maximale avec Maj maintenu." },
  { cle: 'acceleration', nom: 'Accélération', min: 200, max: 4000, pas: 50, defaut: 1300, unite: 'px/s²',
    note: "Plus la valeur est basse, plus Brad met de temps à lancer. Trop bas = impression de patinage." },
  { cle: 'freinage', nom: 'Freinage', min: 200, max: 5000, pas: 50, defaut: 1900, unite: 'px/s²',
    note: "Décélération quand tu relâches la direction." },
  { cle: 'demiTour', nom: 'Gain de demi-tour', min: 1, max: 4, pas: 0.1, defaut: 2.2, unite: '×',
    note: "Multiplie l'accélération quand Brad change de sens. C'est ce qui rend le changement de direction réactif sans supprimer le poids." },

  { groupe: 'Saut' },
  { cle: 'forceSaut', nom: 'Impulsion de saut', min: 200, max: 700, pas: 5, defaut: 470, unite: 'px/s',
    note: "Vitesse verticale initiale. Hauteur maximale affichée en haut de l'écran." },
  { cle: 'gravite', nom: 'Gravité (montée)', min: 400, max: 3500, pas: 25, defaut: 1500, unite: 'px/s²' },
  { cle: 'graviteChute', nom: 'Gravité (chute)', min: 1, max: 3, pas: 0.05, defaut: 1.55, unite: '×',
    note: "Multiplie la gravité une fois le sommet passé. Au-dessus de 1, la chute est plus rapide que la montée : c'est ce qui donne un saut nerveux plutôt que flottant." },
  { cle: 'graviteRelache', nom: 'Gravité (bouton relâché)', min: 1, max: 5, pas: 0.1, defaut: 2.6, unite: '×',
    note: "Appliquée si tu relâches le bouton pendant la montée. C'est le mécanisme du saut à hauteur variable." },
  { cle: 'chuteMax', nom: 'Vitesse de chute max', min: 200, max: 1400, pas: 10, defaut: 720, unite: 'px/s' },

  { groupe: 'Permissivité' },
  { cle: 'coyote', nom: 'Coyote time', min: 0, max: 0.25, pas: 0.005, defaut: 0.10, unite: 's',
    note: "Délai pendant lequel Brad peut encore sauter après avoir quitté le bord. Au-delà de ~0,15 s le joueur commence à sentir la triche." },
  { cle: 'tampon', nom: 'Jump buffer', min: 0, max: 0.3, pas: 0.005, defaut: 0.12, unite: 's',
    note: "Un appui juste avant l'atterrissage est mémorisé et déclenché dès le contact." },

  { groupe: 'Contrôle en l\'air' },
  { cle: 'controleAir', nom: 'Contrôle aérien', min: 0, max: 1, pas: 0.05, defaut: 0.55, unite: '×',
    note: "Fraction de l'accélération au sol utilisable en l'air. Les notes demandent une inertie « bien moindre » qu'au sol." },
  { cle: 'freinageAir', nom: 'Freinage aérien', min: 0, max: 1, pas: 0.05, defaut: 0.25, unite: '×' },

  { groupe: 'Caméra' },
  { cle: 'camAnticipation', nom: 'Anticipation', min: 0, max: 160, pas: 5, defaut: 70, unite: 'px',
    note: "Décalage de la caméra dans le sens du déplacement, proportionnel à la vitesse." },
  { cle: 'camSouplesse', nom: 'Souplesse', min: 1, max: 14, pas: 0.5, defaut: 5, unite: '/s',
    note: "Vitesse de rattrapage. Bas = caméra molle, haut = caméra collée." },
  { cle: 'camZoneY', nom: 'Zone morte verticale', min: 0, max: 140, pas: 5, defaut: 72, unite: 'px',
    note: "La caméra ignore les déplacements verticaux tant que Brad reste dans cette bande." },
];

const DEFAUTS = {};
SCHEMA.forEach(e => { if (e.cle) DEFAUTS[e.cle] = e.defaut; });

const CLE_STOCKAGE = 'bradbitt.feel.v1';
const R = Object.assign({}, DEFAUTS);          // reglages actifs
const OPTIONS = { doubleSaut: false, hitbox: false, traces: false };

try {
  const sauve = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
  if (sauve) {
    Object.keys(DEFAUTS).forEach(k => { if (typeof sauve[k] === 'number') R[k] = sauve[k]; });
    if (sauve._options) Object.assign(OPTIONS, sauve._options);
  }
} catch (e) { /* localStorage indisponible (navigation privee) : on garde les defauts */ }

function sauvegarderReglages() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(Object.assign({}, R, { _options: OPTIONS })));
  } catch (e) { /* ignore */ }
}

/* -----------------------------------------------------------------------------
   2. CONSTANTES DE RENDU
-------------------------------------------------------------------------- */

const LARGEUR = 640;      // resolution interne, mise a l'echelle en CSS
const HAUTEUR = 360;
const TUILE = 24;         // taille d'une tuile de niveau

const canvas = document.getElementById('jeu');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

/* -----------------------------------------------------------------------------
   3. NIVEAU DE TEST
   Chaque zone existe pour valider un point precis des notes de gameplay.
-------------------------------------------------------------------------- */

// Rectangles pleins, en TUILES : [x, y, largeur, hauteur]
const SOLIDES_T = [
  [0, 15, 30, 3],                                        // sol de lancement
  [33, 15, 15, 3],                                       // apres le trou
  [48, 14, 3, 4], [51, 13, 3, 5], [54, 12, 3, 6],        // escalier
  [57, 11, 10, 7],                                       // plateau haut
  [88, 6, 3, 12],                                        // mur a franchir
  [91, 15, 14, 3],                                       // corridor bas
  [94, 10, 9, 1],                                        // plafond bas
  [105, 15, 13, 3],
  [120, 13, 1, 5], [123, 13, 1, 5], [126, 13, 1, 5], [129, 13, 1, 5], // piliers
  [132, 15, 10, 3],                                      // arrivee
  [-2, 0, 2, 18], [142, 0, 2, 18],                       // murs de fin de niveau
];

// Plateformes traversables par le bas : [x, y, largeur]
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
  { x: 26, y: 13, texte: 'Trou : coyote time' },
  { x: 44, y: 13, texte: 'Escalier' },
  { x: 58, y: 9, texte: 'Saut à hauteur variable' },
  { x: 70, y: 10, texte: 'Plateformes traversables' },
  { x: 84, y: 4, texte: 'Mur : saut maximal' },
  { x: 95, y: 13, texte: 'Plafond bas : petit saut' },
  { x: 118, y: 11, texte: 'Précision : jump buffer' },
  { x: 134, y: 13, texte: 'Arrivée' },
];

// Figurants : ennemis immobiles, uniquement pour juger l'echelle a l'ecran.
const FIGURANTS = [
  { nom: 'Serra',         x: 20,  y: 15 },
  { nom: 'Serra-Boost',   x: 40,  y: 15 },
  { nom: 'Serra-Lourd',   x: 62,  y: 11 },
  { nom: 'Serra-Lanceur', x: 100, y: 15 },
  { nom: 'Serra-Volant',  x: 112, y: 12, vole: true },
];

const APPARITION = { x: 3 * TUILE, y: 12 * TUILE };

/* -----------------------------------------------------------------------------
   4. CHARGEMENT DES SPRITES D'ENNEMIS
   Le prototype reste jouable meme si les images manquent : on dessine alors
   un rectangle de remplacement.
-------------------------------------------------------------------------- */

const sprites = {};
['Serra', 'Serra-Boost', 'Serra-Lourd', 'Serra-Lanceur', 'Serra-Volant'].forEach(nom => {
  const img = new Image();
  img.src = 'assets/ennemis/' + nom + '.png';
  img.onload = () => { sprites[nom] = img; };
});

/* -----------------------------------------------------------------------------
   5. ENTREES
   On ecoute a la fois event.code (touche physique, pour les claviers QWERTY)
   et event.key (caractere produit, pour les claviers AZERTY). Un joueur
   francais utilisant Z Q S D est donc pris en charge sans configuration.
-------------------------------------------------------------------------- */

const entrees = { gauche: false, droite: false, saut: false, courir: false };
let sautPresseCeTick = false;   // front montant du bouton de saut

const MAP_CODE = {
  ArrowLeft: 'gauche', KeyA: 'gauche',
  ArrowRight: 'droite', KeyD: 'droite',
  ArrowUp: 'saut', Space: 'saut', KeyW: 'saut',
  ShiftLeft: 'courir', ShiftRight: 'courir',
};
const MAP_TOUCHE = {
  q: 'gauche', a: 'gauche',
  d: 'droite',
  z: 'saut', w: 'saut',
};

function actionDe(e) {
  return MAP_CODE[e.code] || MAP_TOUCHE[(e.key || '').toLowerCase()] || null;
}

addEventListener('keydown', e => {
  if (e.code === 'F1') { e.preventDefault(); basculerPanneau(); return; }
  if ((e.key || '').toLowerCase() === 'r') { reapparaitre(true); return; }
  const a = actionDe(e);
  if (!a) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault();                       // evite le defilement de la page
  }
  if (a === 'saut' && !entrees.saut) sautPresseCeTick = true;
  entrees[a] = true;
});

addEventListener('keyup', e => {
  const a = actionDe(e);
  if (a) entrees[a] = false;
});

addEventListener('blur', () => {
  Object.keys(entrees).forEach(k => { entrees[k] = false; });
});

// Commandes tactiles
const zoneTactile = document.getElementById('tactile');
if (matchMedia('(pointer: coarse)').matches) zoneTactile.hidden = false;

zoneTactile.querySelectorAll('.tbtn').forEach(btn => {
  const a = btn.dataset.touche;
  const presser = ev => {
    ev.preventDefault();
    if (a === 'saut' && !entrees.saut) sautPresseCeTick = true;
    entrees[a] = true;
  };
  const relacher = ev => { ev.preventDefault(); entrees[a] = false; };
  btn.addEventListener('pointerdown', presser);
  btn.addEventListener('pointerup', relacher);
  btn.addEventListener('pointercancel', relacher);
  btn.addEventListener('pointerleave', relacher);
});

/* -----------------------------------------------------------------------------
   6. BRAD
-------------------------------------------------------------------------- */

const brad = {
  x: APPARITION.x, y: APPARITION.y,
  w: 22, h: 44,               // boite de collision
  vx: 0, vy: 0,
  sens: 1,                    // 1 = droite, -1 = gauche
  auSol: false,
  coyote: 0,                  // temps restant pour sauter apres avoir quitte le sol
  tampon: 0,                  // temps restant du saut memorise
  sautEnCours: false,         // vrai tant que Brad monte suite a un appui
  sautsRestants: 0,
  inactif: 0,                 // secondes sans entree
  phaseMarche: 0,             // avancement du cycle de jambes
  etirement: 1,               // squash & stretch (1 = neutre)
  atterrissage: 0,            // compteur d'impact a l'atterrissage
  hauteurMax: 0,              // mesure de la hauteur du dernier saut
  yDepartSaut: 0,
};

const traces = [];
let mortsHorsEcran = 0;

/* Dernier endroit sur ou Brad se tenait. Les notes prevoient une
   reapparition au dernier point atteint plutot qu'au debut du niveau : on
   memorise donc en continu la derniere position stable au sol. */
const pointSur = { x: APPARITION.x, y: APPARITION.y };
let delaiPointSur = 0;

function majPointSur(dt) {
  delaiPointSur -= dt;
  if (delaiPointSur > 0 || !brad.auSol) return;
  delaiPointSur = 0.25;
  // On refuse un point situe trop pres d'un bord : le sol doit exister sous
  // les deux coins de la boite de collision.
  const solSous = (x) => solides.concat(traversantes).some(s =>
    x >= s.x && x <= s.x + s.w &&
    Math.abs(s.y - (brad.y + brad.h)) < 2);
  if (solSous(brad.x + 2) && solSous(brad.x + brad.w - 2)) {
    pointSur.x = brad.x;
    pointSur.y = brad.y;
  }
}

function reapparaitre(auDebut) {
  const p = auDebut ? APPARITION : pointSur;
  brad.x = p.x; brad.y = p.y;
  brad.vx = 0; brad.vy = 0;
  brad.coyote = 0; brad.tampon = 0;
  traces.length = 0;
}

/* --- Collisions ---------------------------------------------------------- */

function chevauche(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function deplacerX(dt) {
  brad.x += brad.vx * dt;
  for (const s of solides) {
    if (!chevauche(brad, s)) continue;
    if (brad.vx > 0) brad.x = s.x - brad.w;
    else if (brad.vx < 0) brad.x = s.x + s.w;
    brad.vx = 0;
  }
}

function deplacerY(dt) {
  const basAvant = brad.y + brad.h;
  brad.y += brad.vy * dt;
  let auSol = false;

  for (const s of solides) {
    if (!chevauche(brad, s)) continue;
    if (brad.vy > 0) { brad.y = s.y - brad.h; auSol = true; }
    else if (brad.vy < 0) { brad.y = s.y + s.h; }
    brad.vy = 0;
  }

  // Plateformes traversables : uniquement en descente, et seulement si Brad
  // etait entierement au-dessus a l'image precedente.
  if (brad.vy > 0) {
    for (const p of traversantes) {
      if (!chevauche(brad, p)) continue;
      if (basAvant <= p.y + 1) {
        brad.y = p.y - brad.h;
        brad.vy = 0;
        auSol = true;
      }
    }
  }

  return auSol;
}

/* --- Simulation ---------------------------------------------------------- */

function majBrad(dt) {
  const dir = (entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0);
  const vitesseCible = (entrees.courir ? R.vitesseCourse : R.vitesseMarche) * dir;

  // -- Acceleration horizontale
  let accel;
  if (dir === 0) {
    accel = R.freinage * (brad.auSol ? 1 : R.freinageAir);
  } else {
    accel = R.acceleration * (brad.auSol ? 1 : R.controleAir);
    // Demi-tour : si la vitesse actuelle s'oppose a la direction demandee,
    // on accelere plus fort. C'est ce qui rend le changement de sens vif
    // tout en conservant une sensation de poids.
    if (brad.vx * dir < 0) accel *= R.demiTour;
  }

  if (brad.vx < vitesseCible) brad.vx = Math.min(vitesseCible, brad.vx + accel * dt);
  else if (brad.vx > vitesseCible) brad.vx = Math.max(vitesseCible, brad.vx - accel * dt);

  if (dir !== 0) brad.sens = dir;

  // -- Coyote time et jump buffer
  brad.coyote = brad.auSol ? R.coyote : Math.max(0, brad.coyote - dt);
  if (sautPresseCeTick) brad.tampon = R.tampon;
  else brad.tampon = Math.max(0, brad.tampon - dt);

  // -- Declenchement du saut
  const peutSauter = brad.coyote > 0 || (OPTIONS.doubleSaut && brad.sautsRestants > 0);
  if (brad.tampon > 0 && peutSauter) {
    if (brad.coyote <= 0) brad.sautsRestants--;
    brad.vy = -R.forceSaut;
    brad.auSol = false;
    brad.coyote = 0;
    brad.tampon = 0;
    brad.sautEnCours = true;
    brad.etirement = 1.28;                 // etirement vertical au decollage
    brad.yDepartSaut = brad.y;
    brad.hauteurMax = 0;
  }

  // Relacher le bouton coupe la montee : saut a hauteur variable.
  if (brad.sautEnCours && (!entrees.saut || brad.vy >= 0)) brad.sautEnCours = false;

  // -- Gravite
  let g = R.gravite;
  if (brad.vy > 0) g *= R.graviteChute;
  else if (!brad.sautEnCours && brad.vy < 0) g *= R.graviteRelache;
  brad.vy = Math.min(R.chuteMax, brad.vy + g * dt);

  // -- Deplacement et collisions
  deplacerX(dt);
  const etaitAuSol = brad.auSol;
  brad.auSol = deplacerY(dt);

  if (brad.auSol && !etaitAuSol) {
    // Impact : ecrasement proportionnel a la vitesse de chute.
    const force = Math.min(1, Math.abs(brad.vy || R.chuteMax) / R.chuteMax);
    brad.etirement = 1 - 0.3 * Math.max(0.35, force);
    brad.atterrissage = 0.18;
    brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;
  }
  if (brad.auSol) brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;

  // Mesure de la hauteur atteinte, affichee dans le bandeau de debug.
  if (!brad.auSol) brad.hauteurMax = Math.max(brad.hauteurMax, brad.yDepartSaut - brad.y);

  // -- Filet de securite : Brad tombe hors du niveau
  majPointSur(dt);
  if (brad.y > NIVEAU_H + 120) { mortsHorsEcran++; reapparaitre(false); }

  // -- Animation
  brad.etirement += (1 - brad.etirement) * Math.min(1, 12 * dt);
  brad.atterrissage = Math.max(0, brad.atterrissage - dt);
  brad.phaseMarche += Math.abs(brad.vx) * dt * 0.06;

  const actif = dir !== 0 || !brad.auSol || Math.abs(brad.vx) > 4;
  brad.inactif = actif ? 0 : brad.inactif + dt;

  if (OPTIONS.traces) {
    traces.push({ x: brad.x + brad.w / 2, y: brad.y + brad.h, sol: brad.auSol });
    if (traces.length > 260) traces.shift();
  }

  sautPresseCeTick = false;
}

/* -----------------------------------------------------------------------------
   7. CAMERA
   Suivi horizontal souple avec anticipation, suivi vertical uniquement
   au-dela d'une zone morte (les notes demandent une camera peu mobile).
-------------------------------------------------------------------------- */

const cam = { x: 0, y: 0, anticipation: 0 };

function majCamera(dt) {
  const vitesseMax = Math.max(R.vitesseCourse, 1);
  const ratio = Math.max(-1, Math.min(1, brad.vx / vitesseMax));
  cam.anticipation += (ratio * R.camAnticipation - cam.anticipation) * Math.min(1, 3 * dt);

  const cibleX = brad.x + brad.w / 2 + cam.anticipation - LARGEUR / 2;
  const k = Math.min(1, R.camSouplesse * dt);
  cam.x += (cibleX - cam.x) * k;

  const centreY = brad.y + brad.h / 2;
  const hautZone = cam.y + HAUTEUR / 2 - R.camZoneY;
  const basZone = cam.y + HAUTEUR / 2 + R.camZoneY;
  let cibleY = cam.y;
  if (centreY < hautZone) cibleY = cam.y - (hautZone - centreY);
  else if (centreY > basZone) cibleY = cam.y + (centreY - basZone);
  cam.y += (cibleY - cam.y) * Math.min(1, R.camSouplesse * 0.7 * dt);

  cam.x = Math.max(0, Math.min(NIVEAU_L - LARGEUR, cam.x));
  cam.y = Math.max(0, Math.min(NIVEAU_H - HAUTEUR, cam.y));
}

/* -----------------------------------------------------------------------------
   8. RENDU
-------------------------------------------------------------------------- */

const COULEURS = {
  cielHaut: '#1b2138',
  cielBas: '#39304a',
  colline: '#232a44',
  collineLoin: '#1d2338',
  solFace: '#3d3350',
  solHaut: '#584a6e',
  solLigne: '#6b5a85',
  traversante: '#8a6f4a',
  costume: '#191b26',
  costumeClair: '#292d3e',
  chemise: '#eceef6',
  cravate: '#d0453f',
  peau: '#e8b98f',
  cheveux: '#43301f',
  chaussure: '#0c0d14',
};

function fond() {
  const grad = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  grad.addColorStop(0, COULEURS.cielHaut);
  grad.addColorStop(1, COULEURS.cielBas);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Deux couches de collines en parallaxe.
  dessinerCollines(0.25, 250, 70, COULEURS.collineLoin);
  dessinerCollines(0.45, 285, 55, COULEURS.colline);
}

function dessinerCollines(facteur, baseY, hauteur, couleur) {
  const decalage = -cam.x * facteur;
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(0, HAUTEUR);
  for (let i = -1; i < 14; i++) {
    const x = decalage % 120 + i * 120;
    ctx.lineTo(x, baseY);
    ctx.lineTo(x + 60, baseY - hauteur);
    ctx.lineTo(x + 120, baseY);
  }
  ctx.lineTo(LARGEUR, HAUTEUR);
  ctx.closePath();
  ctx.fill();
}

function dessinerNiveau() {
  for (const s of solides) {
    const x = Math.round(s.x - cam.x);
    const y = Math.round(s.y - cam.y);
    if (x > LARGEUR || x + s.w < 0) continue;
    ctx.fillStyle = COULEURS.solFace;
    ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = COULEURS.solHaut;
    ctx.fillRect(x, y, s.w, 6);
    ctx.fillStyle = COULEURS.solLigne;
    ctx.fillRect(x, y, s.w, 2);
  }
  for (const p of traversantes) {
    const x = Math.round(p.x - cam.x);
    const y = Math.round(p.y - cam.y);
    if (x > LARGEUR || x + p.w < 0) continue;
    ctx.fillStyle = COULEURS.traversante;
    ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x, y, p.w, 1);
  }
}

function dessinerPanneaux() {
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const p of PANNEAUX) {
    const x = Math.round(p.x * TUILE - cam.x);
    const y = Math.round(p.y * TUILE - cam.y);
    if (x > LARGEUR + 200 || x < -260) continue;
    const l = ctx.measureText(p.texte).width + 10;
    ctx.fillStyle = 'rgba(10,12,20,.55)';
    ctx.fillRect(x, y - 12, l, 15);
    ctx.fillStyle = 'rgba(232,182,44,.85)';
    ctx.fillText(p.texte, x + 5, y - 1);
  }
}

function dessinerFigurants() {
  for (const f of FIGURANTS) {
    const img = sprites[f.nom];
    const bas = f.y * TUILE;
    const cx = f.x * TUILE;
    if (!img) continue;
    const x = Math.round(cx - img.width / 2 - cam.x);
    const y = Math.round(bas - img.height - cam.y);
    if (x > LARGEUR || x + img.width < 0) continue;
    if (!f.vole) {
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath();
      ctx.ellipse(x + img.width / 2, Math.round(bas - cam.y), img.width * 0.38, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(img, x, y);
    } else {
      // Leger flottement vertical, pour que l'ennemi aerien ne paraisse pas fige.
      const flotte = Math.round(Math.sin(performance.now() / 500) * 3);
      ctx.drawImage(img, x, y + flotte);
    }
  }
}

/* --- Brad, dessine en primitives (placeholder du sprite definitif) -------- */

function dessinerBrad() {
  const cx = brad.x + brad.w / 2 - cam.x;
  const bas = brad.y + brad.h - cam.y;

  const etire = brad.etirement;
  const ecrase = 1 / etire;             // conservation approximative du volume
  const h = brad.h * etire;
  const w = brad.w * ecrase;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(bas));
  ctx.scale(brad.sens, 1);

  // Ombre portee
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const dort = brad.inactif > 14;
  const telephone = brad.inactif > 6 && !dort;

  if (dort) { dessinerBradEndormi(w, h); ctx.restore(); return; }

  // Jambes : balancement lie a la distance parcourue
  const vitesse = Math.abs(brad.vx);
  const balancement = brad.auSol && vitesse > 8 ? Math.sin(brad.phaseMarche) : 0;
  const enLAir = !brad.auSol;
  const ecartJambes = enLAir ? 3 : balancement * 6;

  ctx.fillStyle = COULEURS.costume;
  ctx.fillRect(-w * 0.34 + ecartJambes, -h * 0.34, w * 0.28, h * 0.34);
  ctx.fillRect(w * 0.06 - ecartJambes, -h * 0.34, w * 0.28, h * 0.34);
  ctx.fillStyle = COULEURS.chaussure;
  ctx.fillRect(-w * 0.4 + ecartJambes, -3, w * 0.36, 3);
  ctx.fillRect(w * 0.04 - ecartJambes, -3, w * 0.36, 3);

  // Torse
  ctx.fillStyle = COULEURS.costume;
  ctx.fillRect(-w * 0.42, -h * 0.72, w * 0.84, h * 0.4);
  ctx.fillStyle = COULEURS.costumeClair;
  ctx.fillRect(-w * 0.42, -h * 0.72, w * 0.12, h * 0.4);

  // Chemise et cravate
  ctx.fillStyle = COULEURS.chemise;
  ctx.fillRect(-w * 0.13, -h * 0.72, w * 0.26, h * 0.34);
  ctx.fillStyle = COULEURS.cravate;
  ctx.fillRect(-w * 0.06, -h * 0.70, w * 0.12, h * 0.26);

  // Bras : meme balancement, oppose aux jambes (identiques gauche/droite,
  // comme demande dans les notes)
  const bras = enLAir ? -0.35 : -balancement * 0.5;
  ctx.fillStyle = COULEURS.costume;
  ctx.save();
  ctx.translate(w * 0.4, -h * 0.68);
  ctx.rotate(bras);
  ctx.fillRect(-w * 0.11, 0, w * 0.22, h * 0.3);
  ctx.fillStyle = COULEURS.peau;
  ctx.fillRect(-w * 0.1, h * 0.3, w * 0.2, h * 0.07);
  ctx.restore();

  // Tete
  const th = h * 0.26;
  ctx.fillStyle = COULEURS.peau;
  ctx.fillRect(-w * 0.3, -h * 0.72 - th, w * 0.6, th);
  ctx.fillStyle = COULEURS.cheveux;
  ctx.fillRect(-w * 0.32, -h * 0.72 - th, w * 0.64, th * 0.34);
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(w * 0.04, -h * 0.72 - th * 0.55, 2.5, 2.5);
  ctx.fillRect(w * 0.2, -h * 0.72 - th * 0.55, 2.5, 2.5);

  if (telephone) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(w * 0.28, -h * 0.66, 6, 10);
    ctx.fillStyle = 'rgba(150,210,255,.9)';
    ctx.fillRect(w * 0.28 + 1, -h * 0.66 + 1, 4, 8);
  }

  ctx.restore();

  if (OPTIONS.hitbox) {
    ctx.strokeStyle = 'rgba(120,255,180,.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(brad.x - cam.x) + .5, Math.round(brad.y - cam.y) + .5, brad.w - 1, brad.h - 1);
  }
}

function dessinerBradEndormi(w, h) {
  ctx.fillStyle = COULEURS.costume;
  ctx.fillRect(-h * 0.34, -w * 0.7, h * 0.68, w * 0.7);
  ctx.fillStyle = COULEURS.peau;
  ctx.fillRect(h * 0.2, -w * 0.62, h * 0.2, w * 0.55);
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.font = '9px system-ui, sans-serif';
  const t = performance.now() / 400;
  ctx.fillText('z', h * 0.42, -w * 0.8 - (t % 3) * 4);
  ctx.fillText('Z', h * 0.5, -w * 1.2 - ((t + 1) % 3) * 4);
}

function dessinerTraces() {
  if (!OPTIONS.traces) return;
  for (let i = 0; i < traces.length; i++) {
    const p = traces[i];
    ctx.fillStyle = p.sol ? 'rgba(120,255,180,.25)' : 'rgba(232,182,44,.45)';
    ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
  }
}

/* --- Bandeau de mesure --------------------------------------------------- */

let fps = 60;

function bandeau() {
  ctx.fillStyle = 'rgba(10,12,20,.72)';
  ctx.fillRect(0, 0, LARGEUR, 20);
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8d93ab';

  const hauteurTheorique = (R.forceSaut * R.forceSaut) / (2 * R.gravite);
  const infos = [
    'vx ' + Math.abs(brad.vx).toFixed(0).padStart(3),
    'saut ' + hauteurTheorique.toFixed(0) + 'px/' + (hauteurTheorique / TUILE).toFixed(1) + 't',
    'dernier ' + brad.hauteurMax.toFixed(0),
    brad.auSol ? 'sol' : (brad.coyote > 0 ? 'coyote' : 'air'),
    'chutes ' + mortsHorsEcran,
    fps.toFixed(0) + 'fps',
  ];
  ctx.fillText(infos.join('  ·  '), 8, 14);
}

function rendu() {
  fond();
  dessinerNiveau();
  dessinerTraces();
  dessinerPanneaux();
  dessinerFigurants();
  dessinerBrad();
  bandeau();
}

/* -----------------------------------------------------------------------------
   9. BOUCLE PRINCIPALE
   Pas de temps fixe : la physique avance par tranches de 1/120 s quelle que
   soit la frequence d'affichage, ce qui garantit des sensations identiques
   sur un ecran 60 Hz et sur un 144 Hz.
-------------------------------------------------------------------------- */

const PAS = 1 / 120;
let accumulateur = 0;
let dernier = performance.now();

function boucle(maintenant) {
  let delta = (maintenant - dernier) / 1000;
  dernier = maintenant;
  if (delta > 0.25) delta = 0.25;            // onglet revenu au premier plan
  fps += (1 / Math.max(delta, 1e-4) - fps) * 0.1;

  accumulateur += delta;
  let garde = 0;
  while (accumulateur >= PAS && garde++ < 8) {
    majBrad(PAS);
    majCamera(PAS);
    accumulateur -= PAS;
  }

  rendu();
  requestAnimationFrame(boucle);
}

/* -----------------------------------------------------------------------------
   10. PANNEAU DE REGLAGES
-------------------------------------------------------------------------- */

const panneau = document.getElementById('reglages');
const conteneurCurseurs = document.getElementById('curseurs');

function basculerPanneau() { panneau.hidden = !panneau.hidden; }

document.getElementById('ouvrir-reglages').onclick = basculerPanneau;
document.getElementById('fermer-reglages').onclick = basculerPanneau;

const champs = {};

SCHEMA.forEach(e => {
  if (e.groupe) {
    const t = document.createElement('div');
    t.className = 'groupe-titre';
    t.textContent = e.groupe;
    conteneurCurseurs.appendChild(t);
    return;
  }
  const bloc = document.createElement('div');
  bloc.className = 'curseur';

  const decimales = e.pas < 1 ? (e.pas < 0.05 ? 3 : 2) : 0;
  const afficher = v => v.toFixed(decimales) + ' ' + e.unite;

  bloc.innerHTML =
    '<div class="ligne"><span class="nom"></span><span class="valeur"></span></div>' +
    '<input type="range">' +
    (e.note ? '<span class="note"></span>' : '');

  bloc.querySelector('.nom').textContent = e.nom;
  if (e.note) bloc.querySelector('.note').textContent = e.note;

  const val = bloc.querySelector('.valeur');
  const range = bloc.querySelector('input');
  range.min = e.min; range.max = e.max; range.step = e.pas; range.value = R[e.cle];
  val.textContent = afficher(R[e.cle]);

  range.addEventListener('input', () => {
    R[e.cle] = parseFloat(range.value);
    val.textContent = afficher(R[e.cle]);
    sauvegarderReglages();
  });

  champs[e.cle] = { range, val, afficher };
  conteneurCurseurs.appendChild(bloc);
});

document.getElementById('reinit').onclick = () => {
  Object.assign(R, DEFAUTS);
  Object.keys(champs).forEach(k => {
    champs[k].range.value = R[k];
    champs[k].val.textContent = champs[k].afficher(R[k]);
  });
  sauvegarderReglages();
};

document.getElementById('exporter').onclick = async ev => {
  const texte = JSON.stringify(R, null, 2);
  try {
    await navigator.clipboard.writeText(texte);
    ev.target.textContent = 'Copié ✓';
  } catch (e) {
    ev.target.textContent = 'Voir la console';
    console.log(texte);
  }
  setTimeout(() => { ev.target.textContent = 'Copier le réglage'; }, 1600);
};

[['opt-double-saut', 'doubleSaut'], ['opt-hitbox', 'hitbox'], ['opt-traces', 'traces']]
  .forEach(([id, cle]) => {
    const el = document.getElementById(id);
    el.checked = OPTIONS[cle];
    el.addEventListener('change', () => {
      OPTIONS[cle] = el.checked;
      if (cle === 'traces' && !el.checked) traces.length = 0;
      sauvegarderReglages();
    });
  });

/* -----------------------------------------------------------------------------
   11. MISE A L'ECHELLE DU CANVAS
   Le canvas garde sa resolution interne de 640x360 et n'est agrandi que par
   des entiers, pour que chaque pixel du jeu reste un carre net a l'ecran.
-------------------------------------------------------------------------- */

function redimensionner() {
  const marge = 0;
  const facteur = Math.max(1, Math.min(
    Math.floor((innerWidth - marge) / LARGEUR),
    Math.floor((innerHeight - marge) / HAUTEUR)
  ));
  canvas.style.width = LARGEUR * facteur + 'px';
  canvas.style.height = HAUTEUR * facteur + 'px';
}

addEventListener('resize', redimensionner);
redimensionner();
requestAnimationFrame(boucle);
