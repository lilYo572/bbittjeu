/* =============================================================================
   BRAD BITT, MAIS LE JEU — camera, rendu, interface et boucle principale
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. CAMERA
   Suivi horizontal souple avec anticipation ; suivi vertical seulement
   au-dela d'une zone morte, les notes demandant une camera peu mobile.
-------------------------------------------------------------------------- */

const cam = { x: 0, y: 0, anticipation: 0 };

function majCamera(dt) {
  const ratio = Math.max(-1, Math.min(1, brad.vx / Math.max(R.vitesseCourse, 1)));
  cam.anticipation += (ratio * R.camAnticipation - cam.anticipation) * Math.min(1, 3 * dt);

  const cibleX = brad.x + brad.w / 2 + cam.anticipation - LARGEUR / 2;
  cam.x += (cibleX - cam.x) * Math.min(1, R.camSouplesse * dt);

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
   2. SILHOUETTES BLANCHES
   Utilisees pour le flash de degat. Construites une seule fois par image, sans
   lecture de pixels : la page reste utilisable en file:// (un canvas nourri
   par une image locale est "teinte" et refuse getImageData).
-------------------------------------------------------------------------- */

const cacheSilhouettes = new Map();

function silhouette(img) {
  if (cacheSilhouettes.has(img)) return cacheSilhouettes.get(img);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  cacheSilhouettes.set(img, c);
  return c;
}

/* -----------------------------------------------------------------------------
   3. RENDU DU DECOR
-------------------------------------------------------------------------- */

const COULEURS = {
  cielHaut: '#1b2138', cielBas: '#39304a',
  colline: '#232a44', collineLoin: '#1d2338',
  solFace: '#3d3350', solHaut: '#584a6e', solLigne: '#6b5a85',
  traversante: '#8a6f4a',
  costume: '#191b26',
  accent: '#e8b62c',
};

function fond() {
  const grad = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  grad.addColorStop(0, COULEURS.cielHaut);
  grad.addColorStop(1, COULEURS.cielBas);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
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
    ctx.fillStyle = COULEURS.solFace; ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = COULEURS.solHaut; ctx.fillRect(x, y, s.w, 6);
    ctx.fillStyle = COULEURS.solLigne; ctx.fillRect(x, y, s.w, 2);
  }
  for (const p of traversantes) {
    const x = Math.round(p.x - cam.x);
    const y = Math.round(p.y - cam.y);
    if (x > LARGEUR || x + p.w < 0) continue;
    ctx.fillStyle = COULEURS.traversante; ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, p.w, 1);
  }
}

function dessinerPanneaux() {
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const p of PANNEAUX) {
    const x = Math.round(p.x * TUILE - cam.x);
    const y = Math.round(p.y * TUILE - cam.y);
    if (x > LARGEUR + 260 || x < -300) continue;
    const l = ctx.measureText(p.texte).width + 10;
    ctx.fillStyle = 'rgba(10,12,20,.55)'; ctx.fillRect(x, y - 12, l, 15);
    ctx.fillStyle = 'rgba(232,182,44,.85)'; ctx.fillText(p.texte, x + 5, y - 1);
  }
}

/* -----------------------------------------------------------------------------
   4. RENDU DES ENNEMIS
   Les images sources ne contiennent qu'une seule pose. Toute l'animation est
   donc produite par le code : balancement de marche, etirement d'alerte,
   inclinaison de charge, ecrasement a la mort.
-------------------------------------------------------------------------- */

function dessinerEnnemis() {
  for (const e of ennemis) {
    const img = sprites[e.type];
    const cx = Math.round(e.x + e.w / 2 - cam.x);
    const bas = Math.round(e.y + e.h - cam.y);
    if (cx < -80 || cx > LARGEUR + 80) continue;

    if (!e.t.vole && e.etat !== 'mort') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(cx, bas, e.w * 0.45, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!img) {
      ctx.fillStyle = '#c9564f';
      ctx.fillRect(cx - e.w / 2, bas - e.h, e.w, e.h);
      continue;
    }

    // Deformations : chacune correspond a un etat lisible pour le joueur.
    let sx = 1, sy = 1, inclinaison = 0, dy = 0;

    if (e.etat === 'mort') {
      sy = e.ecrase; sx = 1 + (1 - e.ecrase) * 0.7;
    } else if (e.etat === 'alerte') {
      const p = Math.sin(e.phase * 14);
      sy = 1 + 0.1 + p * 0.05; sx = 1 / sy;
      dy = -2;
    } else {
      const marche = Math.sin(e.phase * 2.2);
      sy = 1 + marche * 0.05;
      sx = 1 / sy;
      dy = -Math.abs(marche) * 2;
      if (e.etat === 'charge') inclinaison = e.sens * 0.14;
      if (e.t.vole) dy = 0;
    }

    ctx.save();
    ctx.translate(cx, bas + dy);
    ctx.rotate(inclinaison);
    ctx.scale(e.sens * sx, sy);
    const source = e.flash > 0 ? silhouette(img) : img;
    ctx.globalAlpha = e.etat === 'mort' ? Math.max(0, e.minuteur / 0.32) : 1;
    ctx.drawImage(source, -img.width / 2, -img.height);
    ctx.globalAlpha = 1;
    ctx.restore();

    if (e.etat === 'alerte' || (e.etat === 'charge' && Math.sin(e.phase * 6) > 0)) {
      dessinerExclamation(cx, bas - e.h - 12);
    }
    if (e.t.pv > 1 && e.pv < e.t.pv && e.etat !== 'mort') {
      barreDeVieEnnemi(cx, bas - e.h - 8, e);
    }
    if (OPTIONS.hitbox) {
      ctx.strokeStyle = 'rgba(255,120,120,.8)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(e.x - cam.x) + .5, Math.round(e.y - cam.y) + .5, e.w - 1, e.h - 1);
    }
  }
}

/* Le point d'exclamation rouge demande dans les notes : c'est le seul signal
   qui previent le joueur qu'il a ete repere. */
function dessinerExclamation(x, y) {
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(x - 2, y - 10, 4, 7);
  ctx.fillRect(x - 2, y - 1, 4, 3);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(x - 2, y - 10, 1, 7);
}

function barreDeVieEnnemi(x, y, e) {
  const l = 22;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - l / 2 - 1, y - 1, l + 2, 4);
  ctx.fillStyle = '#e8b62c'; ctx.fillRect(x - l / 2, y, l * (e.pv / e.t.pv), 2);
}

/* -----------------------------------------------------------------------------
   5. RENDU DE BRAD
-------------------------------------------------------------------------- */

/* La planche ne contient ni saut ni chute. On reutilise deux poses de course
   dont la silhouette se lit bien en l'air : jambes ecartees en montee, jambes
   ramenees en descente. A remplacer des que de vraies images existeront. */
const IMAGE_SAUT = { ligne: BRAD_PLANCHE.course, colonne: 1 };
const IMAGE_CHUTE = { ligne: BRAD_PLANCHE.course, colonne: 3 };

function imageDeBrad() {
  if (!brad.auSol) return brad.vy < 0 ? IMAGE_SAUT : IMAGE_CHUTE;
  const vitesse = Math.abs(brad.vx);
  if (vitesse < 8) {
    const cadence = brad.inactif > 14 ? 0.9 : 0.24;
    return { ligne: BRAD_PLANCHE.repos, colonne: Math.floor(brad.phaseRepos / cadence) % 4 };
  }
  const ligne = vitesse > R.vitesseMarche * 1.08 ? BRAD_PLANCHE.course : BRAD_PLANCHE.marche;
  return { ligne, colonne: Math.floor(brad.phaseMarche) % 4 };
}

function dessinerBrad() {
  const cx = Math.round(brad.x + brad.w / 2 - cam.x);
  const bas = Math.round(brad.y + brad.h - cam.y);

  ctx.fillStyle = brad.auSol ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.16)';
  ctx.beginPath();
  ctx.ellipse(cx, bas, brad.w * (brad.auSol ? 0.5 : 0.34), 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Clignotement d'invincibilite : Brad disparait une image sur deux.
  const clignote = brad.invincible > 0 && Math.floor(brad.invincible * 14) % 2 === 0;

  if (bradPret && !clignote) {
    const { ligne, colonne } = imageDeBrad();
    const { cw, ch, piedsDansCellule } = BRAD_PLANCHE;
    ctx.save();
    ctx.translate(cx, bas);
    ctx.scale(brad.sens / brad.etirement, brad.etirement);
    ctx.drawImage(imgBrad, colonne * cw, ligne * ch, cw, ch, -cw / 2, -piedsDansCellule, cw, ch);
    ctx.restore();
  } else if (!bradPret) {
    ctx.fillStyle = COULEURS.costume;
    ctx.fillRect(cx - brad.w / 2, bas - brad.h, brad.w, brad.h);
  }

  if (brad.porte) dessinerBoule(cx - 7, bas - brad.h - 12, performance.now() / 90);
  dessinerCoup();
  dessinerInactivite(cx, bas);

  if (OPTIONS.hitbox) {
    ctx.strokeStyle = 'rgba(120,255,180,.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(brad.x - cam.x) + .5, Math.round(brad.y - cam.y) + .5,
                   brad.w - 1, brad.h - 1);
  }
}

/* Trace d'attaque : un arc qui s'efface. Sans image d'attaque dans la planche,
   c'est ce trait qui rend le coup lisible. */
function dessinerCoup() {
  if (brad.attaque <= 0) return;
  const z = zoneAttaque();
  const p = 1 - brad.attaque / R.dureeAttaque;
  const cx = z.x + (brad.sens > 0 ? 0 : z.w) - cam.x;
  const cy = z.y + z.h / 2 - cam.y;

  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - p);
  ctx.strokeStyle = '#fff2c0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, z.w * (0.4 + p * 0.7), -0.9, 0.9);
  ctx.stroke();
  ctx.restore();

  if (OPTIONS.hitbox) {
    ctx.strokeStyle = 'rgba(255,240,180,.9)'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(z.x - cam.x) + .5, Math.round(z.y - cam.y) + .5, z.w, z.h);
  }
}

/* Animations d'inactivite decrites dans les notes. La planche n'a pas de pose
   dediee : le telephone et les Z sont dessines par-dessus les images de repos.
   Deux ou trois images suffiraient a remplacer proprement cette astuce. */
function dessinerInactivite(cx, bas) {
  if (brad.inactif <= 6) return;
  const t = performance.now() / 1000;

  if (brad.inactif <= 14) {
    const mx = cx + brad.sens * 12;
    const my = bas - 23 + Math.round(Math.sin(t * 2) * 0.5);
    ctx.fillStyle = '#0d0e16'; ctx.fillRect(mx - 2, my, 5, 9);
    ctx.fillStyle = 'rgba(150,210,255,.85)'; ctx.fillRect(mx - 1, my + 1, 3, 7);
    return;
  }
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 2; i++) {
    const p = (t * 0.5 + i * 0.5) % 1;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - p)).toFixed(2) + ')';
    ctx.fillText(i ? 'Z' : 'z', cx + 8 + p * 6, bas - 50 - p * 12);
  }
}

/* -----------------------------------------------------------------------------
   6. BOULES, RAMASSAGES, EFFETS
-------------------------------------------------------------------------- */

function dessinerBoule(x, y, phase) {
  const img = sprites['boule-serrano'];
  if (!img) {
    ctx.fillStyle = '#e07070';
    ctx.fillRect(x, y, 14, 14);
    return;
  }
  // Rotation par pas de 90 degres : plus lisible en pixel art qu'une
  // rotation continue, qui produirait des bords baveux.
  ctx.save();
  ctx.translate(x + 7, y + 7);
  ctx.rotate(Math.floor(phase % 4) * Math.PI / 2);
  ctx.drawImage(img, -7, -7);
  ctx.restore();
}

function dessinerBoules() {
  for (const b of boules) {
    // Clignotement quand la boule posee va disparaitre.
    if (b.posee > 0 && b.posee < 2 && Math.floor(b.posee * 8) % 2 === 0) continue;
    dessinerBoule(Math.round(b.x - cam.x), Math.round(b.y - cam.y), b.phase);
    if (b.posee > 0) {
      ctx.fillStyle = 'rgba(232,182,44,.5)';
      ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y + 15), 14, 1);
    }
  }
}

function dessinerRamassages() {
  for (const r of ramassages) {
    const x = Math.round(r.x - cam.x);
    const y = Math.round(r.y - cam.y);
    if (r.genre === 'piece') {
      // Piece qui tourne sur elle-meme : la largeur suit un cosinus.
      const l = Math.abs(Math.cos(r.phase)) * 8;
      ctx.fillStyle = '#8a6a12';
      ctx.fillRect(x + 4 - l / 2, y, Math.max(1, l), 8);
      ctx.fillStyle = COULEURS.accent;
      ctx.fillRect(x + 4 - l / 2, y, Math.max(1, l - 2), 7);
    } else {
      ctx.fillStyle = '#7ee08a';
      ctx.fillRect(x + 3, y, 4, 10);
      ctx.fillRect(x, y + 3, 10, 4);
    }
  }
}

function dessinerEffets() {
  for (const f of effets) {
    const p = f.t / f.duree;
    if (f.genre === 'particule') {
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = f.couleur;
      ctx.fillRect(Math.round(f.x - cam.x), Math.round(f.y - cam.y), 2, 2);
      ctx.globalAlpha = 1;
    } else if (f.genre === 'texte') {
      ctx.globalAlpha = 1 - p * p;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.couleur;
      ctx.fillText(f.texte, Math.round(f.x - cam.x), Math.round(f.y - cam.y));
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    } else if (f.genre === 'onde') {
      ctx.globalAlpha = 0.75 * (1 - p);
      ctx.strokeStyle = COULEURS.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(Math.round(f.x - cam.x), Math.round(f.y - cam.y), f.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function dessinerTraces() {
  if (!OPTIONS.traces) return;
  for (const p of traces) {
    ctx.fillStyle = p.sol ? 'rgba(120,255,180,.25)' : 'rgba(232,182,44,.45)';
    ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
  }
}

/* -----------------------------------------------------------------------------
   7. INTERFACE EN JEU
-------------------------------------------------------------------------- */

let fps = 60;

function hud() {
  // Barre de vie : une case par point, pour que le joueur lise sa vie d'un
  // coup d'oeil sans avoir a estimer une longueur.
  const x0 = 10, y0 = 8;
  for (let i = 0; i < brad.pvMax; i++) {
    const plein = i < brad.pv;
    ctx.fillStyle = plein ? '#d0453f' : 'rgba(255,255,255,.13)';
    ctx.fillRect(x0 + i * 9, y0, 7, 9);
    if (plein) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x0 + i * 9, y0, 7, 2); }
  }

  // Jauge de Brad-Shy
  const jx = x0, jy = y0 + 13, jl = 96;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(jx - 1, jy - 1, jl + 2, 7);
  ctx.fillStyle = brad.shy >= 100 ? '#fff0b0' : '#6f7bd0';
  ctx.fillRect(jx, jy, jl * (brad.shy / 100), 5);
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = brad.shy >= 100 ? COULEURS.accent : 'rgba(255,255,255,.45)';
  ctx.fillText(brad.shy >= 100 ? 'BRAD-SHY PRÊT — C' : 'Brad-Shy', jx + jl + 6, jy + 5);

  // Compteur de pieces
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = COULEURS.accent;
  ctx.fillText(brad.pieces + ' BC', LARGEUR - 10, 18);
  ctx.textAlign = 'left';

  if (brad.porte) {
    ctx.textAlign = 'right';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('boule prête — X pour lancer', LARGEUR - 10, 32);
    ctx.textAlign = 'left';
  }
}

function bandeau() {
  ctx.fillStyle = 'rgba(10,12,20,.72)';
  ctx.fillRect(0, HAUTEUR - 18, LARGEUR, 18);
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8d93ab';
  const h = (R.forceSaut * R.forceSaut) / (2 * R.gravite);
  const infos = [
    'vx ' + Math.abs(brad.vx).toFixed(0).padStart(3),
    'saut ' + h.toFixed(0) + 'px/' + (h / TUILE).toFixed(1) + 't',
    brad.auSol ? 'sol' : (brad.coyote > 0 ? 'coyote' : 'air'),
    'ennemis ' + ennemis.filter(e => e.etat !== 'mort').length,
    'morts ' + mortsConsecutives + '/3',
    fps.toFixed(0) + 'fps',
  ];
  ctx.fillText(infos.join('  ·  '), 8, HAUTEUR - 5);
}

function ecranDeMort() {
  ctx.fillStyle = 'rgba(120,16,16,.86)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ctx.textAlign = 'center';

  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9e9';
  ctx.fillText('BRAD BITT EST MORT', LARGEUR / 2, HAUTEUR / 2 - 34);

  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,220,220,.9)';
  ctx.fillText('Terrassé par : ' + tueur, LARGEUR / 2, HAUTEUR / 2 - 8);

  ctx.font = 'italic 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,210,210,.72)';
  ctx.fillText(CONSEILS[tueur] || 'Ça arrive aux meilleurs.', LARGEUR / 2, HAUTEUR / 2 + 16);

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  const suite = mortsConsecutives >= 3
    ? 'Trois morts d\'affilée : retour au début du niveau. Espace pour repartir.'
    : 'Espace pour repartir au dernier point sûr.  (' + mortsConsecutives + '/3)';
  ctx.fillText(suite, LARGEUR / 2, HAUTEUR / 2 + 48);
  ctx.textAlign = 'left';
}

/* -----------------------------------------------------------------------------
   8. RENDU COMPLET
-------------------------------------------------------------------------- */

function rendu() {
  ctx.save();
  if (secousseEtat.t > 0) {
    const f = secousseEtat.force * (secousseEtat.t / 0.4);
    ctx.translate(Math.round((Math.random() - 0.5) * f), Math.round((Math.random() - 0.5) * f));
  }
  fond();
  dessinerNiveau();
  dessinerTraces();
  dessinerPanneaux();
  dessinerRamassages();
  dessinerEnnemis();
  dessinerBoules();
  dessinerBrad();
  dessinerEffets();
  ctx.restore();

  hud();
  bandeau();
  if (etatJeu === 'mort') ecranDeMort();
}

/* -----------------------------------------------------------------------------
   9. BOUCLE PRINCIPALE
   Pas de temps fixe : la physique avance par tranches de 1/120 s quelle que
   soit la frequence d'affichage. Les sensations sont donc identiques sur un
   ecran 60 Hz et sur un 144 Hz.
-------------------------------------------------------------------------- */

const PAS = 1 / 120;
let accumulateur = 0;
let dernier = performance.now();

function relancerNiveau() {
  brad.pv = brad.pvMax;
  brad.shy = 0;
  brad.pieces = 0;
  mortsConsecutives = 0;
  reapparaitre(true);
  reinitialiserEnnemis();
  effets.length = 0;
  etatJeu = 'jeu';
}

function boucle(maintenant) {
  let delta = (maintenant - dernier) / 1000;
  dernier = maintenant;
  if (delta > 0.25) delta = 0.25;
  fps += (1 / Math.max(delta, 1e-4) - fps) * 0.1;

  accumulateur += delta;
  let garde = 0;
  while (accumulateur >= PAS && garde++ < 8) {
    if (etatJeu === 'jeu') {
      majBrad(PAS);
      majEnnemis(PAS);
      majBoules(PAS);
      majRamassages(PAS);
      majCamera(PAS);
    }
    majEffets(PAS);
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
const champs = {};

function basculerPanneau() { panneau.hidden = !panneau.hidden; }

document.getElementById('ouvrir-reglages').onclick = basculerPanneau;
document.getElementById('fermer-reglages').onclick = basculerPanneau;

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
    '<input type="range">' + (e.note ? '<span class="note"></span>' : '');
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

document.getElementById('relancer').onclick = relancerNiveau;

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
   11. MISE A L'ECHELLE ET DEMARRAGE
   Le canvas garde sa resolution interne de 640x360 et n'est agrandi que par
   des entiers, pour que chaque pixel reste un carre net a l'ecran.
-------------------------------------------------------------------------- */

function redimensionner() {
  const facteur = Math.max(1, Math.min(
    Math.floor(innerWidth / LARGEUR),
    Math.floor(innerHeight / HAUTEUR)
  ));
  canvas.style.width = LARGEUR * facteur + 'px';
  canvas.style.height = HAUTEUR * facteur + 'px';
}

addEventListener('resize', redimensionner);
redimensionner();
reinitialiserEnnemis();
requestAnimationFrame(boucle);
