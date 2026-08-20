/* =============================================================================
   BRAD BITT, MAIS LE JEU — entrees

   On ecoute a la fois event.code (touche physique, claviers QWERTY) et
   event.key (caractere produit, claviers AZERTY). Un joueur francais qui
   utilise Z Q S D est pris en charge sans aucune configuration.
   ========================================================================== */
'use strict';

const entrees = {
  gauche: false, droite: false, saut: false, courir: false,
  attaque: false, onde: false,
};

// Fronts montants, consommes par la simulation puis remis a faux.
let sautPresseCeTick = false;
let attaquePresseeCeTick = false;
let ondePresseeCeTick = false;

const MAP_CODE = {
  ArrowLeft: 'gauche', KeyA: 'gauche',
  ArrowRight: 'droite', KeyD: 'droite',
  ArrowUp: 'saut', Space: 'saut', KeyW: 'saut',
  ShiftLeft: 'courir', ShiftRight: 'courir',
  KeyX: 'attaque', KeyJ: 'attaque',
  KeyC: 'onde', KeyK: 'onde',
};
const MAP_TOUCHE = {
  q: 'gauche', a: 'gauche',
  d: 'droite',
  z: 'saut', w: 'saut',
  x: 'attaque', j: 'attaque',
  c: 'onde', k: 'onde',
};

const FRONTS = { saut: 1, attaque: 1, onde: 1 };

function actionDe(e) {
  return MAP_CODE[e.code] || MAP_TOUCHE[(e.key || '').toLowerCase()] || null;
}

function marquerFront(action) {
  if (action === 'saut') sautPresseCeTick = true;
  else if (action === 'attaque') attaquePresseeCeTick = true;
  else if (action === 'onde') ondePresseeCeTick = true;
}

addEventListener('keydown', e => {
  if (e.code === 'F1') { e.preventDefault(); basculerPanneau(); return; }

  const lettre = (e.key || '').toLowerCase();
  if (lettre === 'r') { relancerNiveau(); return; }

  // Ecran de mort : n'importe quelle touche d'action relance.
  if (etatJeu === 'mort') {
    if (e.code === 'Space' || e.code === 'Enter' || lettre === 'x') {
      e.preventDefault();
      relancerApresMort();
    }
    return;
  }

  const a = actionDe(e);
  if (!a) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();                   // evite le defilement de la page
  }
  if (FRONTS[a] && !entrees[a]) marquerFront(a);
  entrees[a] = true;
});

addEventListener('keyup', e => {
  const a = actionDe(e);
  if (a) entrees[a] = false;
});

addEventListener('blur', () => {
  Object.keys(entrees).forEach(k => { entrees[k] = false; });
});

/* --- Commandes tactiles --------------------------------------------------- */

const zoneTactile = document.getElementById('tactile');
if (matchMedia('(pointer: coarse)').matches) zoneTactile.hidden = false;

zoneTactile.querySelectorAll('.tbtn').forEach(btn => {
  const a = btn.dataset.touche;
  const presser = ev => {
    ev.preventDefault();
    if (etatJeu === 'mort') { relancerApresMort(); return; }
    if (FRONTS[a] && !entrees[a]) marquerFront(a);
    entrees[a] = true;
  };
  const relacher = ev => { ev.preventDefault(); entrees[a] = false; };
  btn.addEventListener('pointerdown', presser);
  btn.addEventListener('pointerup', relacher);
  btn.addEventListener('pointercancel', relacher);
  btn.addEventListener('pointerleave', relacher);
});
