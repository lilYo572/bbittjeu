/* =============================================================================
   BRAD BITT, MAIS LE JEU — acteurs
   Brad, ennemis, boules de Serrano, ramassages et effets.
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. BRAD
-------------------------------------------------------------------------- */

/* Distance parcourue entre deux images du cycle de pas. Le cycle est indexe sur
   la DISTANCE et non sur le temps : la cadence des jambes suit automatiquement
   l'acceleration, Brad ne patine pas et ne marche jamais a reculons. */
const LONGUEUR_PAS = 22;

const brad = {
  x: APPARITION.x, y: APPARITION.y,
  w: 22, h: 46,
  vx: 0, vy: 0,
  sens: 1,
  auSol: false,
  coyote: 0, tampon: 0,
  sautEnCours: false,
  sautsRestants: 0,
  inactif: 0,
  phaseMarche: 0, phaseRepos: 0,
  etirement: 1,
  hauteurMax: 0, yDepartSaut: 0,
  basAvant: 0, vyAvant: 0,

  // combat
  pv: 10, pvMax: 10,
  invincible: 0,
  attaque: 0,          // temps restant de la fenetre de degats
  recharge: 0,         // delai avant le prochain coup
  toucheParAttaque: null,
  shy: 0,              // jauge de Brad-Shy, 0 a 100
  porte: null,         // boule de Serrano transportee
  pieces: 0,
};

const traces = [];
let mortsHorsEcran = 0;
let mortsConsecutives = 0;

/* Dernier endroit sur : les notes prevoient une reapparition au dernier point
   atteint plutot qu'au debut du niveau. */
const pointSur = { x: APPARITION.x, y: APPARITION.y };
let delaiPointSur = 0;

function majPointSur(dt) {
  delaiPointSur -= dt;
  if (delaiPointSur > 0 || !brad.auSol) return;
  delaiPointSur = 0.25;
  // Le sol doit exister sous les DEUX coins : on refuse un point de
  // reapparition situe au bord d'un vide.
  const ligne = brad.y + brad.h;
  if (solSous(brad.x + 2, ligne) && solSous(brad.x + brad.w - 2, ligne)) {
    pointSur.x = brad.x;
    pointSur.y = brad.y;
  }
}

function reapparaitre(auDebut) {
  const p = auDebut ? APPARITION : pointSur;
  brad.x = p.x; brad.y = p.y;
  brad.vx = 0; brad.vy = 0;
  brad.coyote = 0; brad.tampon = 0;
  brad.invincible = 1.0;
  brad.porte = null;
  traces.length = 0;
  if (auDebut) { pointSur.x = APPARITION.x; pointSur.y = APPARITION.y; }
}

/* --- Collisions ---------------------------------------------------------- */

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
      if (basAvant <= p.y + 1) { brad.y = p.y - brad.h; brad.vy = 0; auSol = true; }
    }
  }
  return auSol;
}

/* --- Simulation ---------------------------------------------------------- */

function majBrad(dt) {
  const dir = (entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0);
  const vitesseCible = (entrees.courir ? R.vitesseCourse : R.vitesseMarche) * dir;

  let accel;
  if (dir === 0) {
    accel = R.freinage * (brad.auSol ? 1 : R.freinageAir);
  } else {
    accel = R.acceleration * (brad.auSol ? 1 : R.controleAir);
    // Demi-tour : accelerer plus fort quand la vitesse s'oppose a la direction
    // demandee rend le changement de sens vif sans supprimer le poids.
    if (brad.vx * dir < 0) accel *= R.demiTour;
  }
  if (brad.vx < vitesseCible) brad.vx = Math.min(vitesseCible, brad.vx + accel * dt);
  else if (brad.vx > vitesseCible) brad.vx = Math.max(vitesseCible, brad.vx - accel * dt);
  if (dir !== 0) brad.sens = dir;

  brad.coyote = brad.auSol ? R.coyote : Math.max(0, brad.coyote - dt);
  brad.tampon = sautPresseCeTick ? R.tampon : Math.max(0, brad.tampon - dt);

  const peutSauter = brad.coyote > 0 || (OPTIONS.doubleSaut && brad.sautsRestants > 0);
  if (brad.tampon > 0 && peutSauter) {
    if (brad.coyote <= 0) brad.sautsRestants--;
    brad.vy = -R.forceSaut;
    brad.auSol = false;
    brad.coyote = 0; brad.tampon = 0;
    brad.sautEnCours = true;
    brad.etirement = 1.28;
    brad.yDepartSaut = brad.y;
    brad.hauteurMax = 0;
  }
  if (brad.sautEnCours && (!entrees.saut || brad.vy >= 0)) brad.sautEnCours = false;

  let g = R.gravite;
  if (brad.vy > 0) g *= R.graviteChute;
  else if (!brad.sautEnCours && brad.vy < 0) g *= R.graviteRelache;
  brad.vy = Math.min(R.chuteMax, brad.vy + g * dt);

  deplacerX(dt);
  const etaitAuSol = brad.auSol;
  // Memorise avant la resolution des collisions : le contact avec un ennemi
  // est teste APRES que Brad a ete recale sur le sol, donc sa vitesse et sa
  // position d'alors ne diraient plus s'il arrivait par le dessus.
  brad.basAvant = brad.y + brad.h;
  brad.vyAvant = brad.vy;
  brad.auSol = deplacerY(dt);

  if (brad.auSol && !etaitAuSol) {
    const force = Math.min(1, Math.abs(brad.vy || R.chuteMax) / R.chuteMax);
    brad.etirement = 1 - 0.3 * Math.max(0.35, force);
    brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;
  }
  if (brad.auSol) brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;
  if (!brad.auSol) brad.hauteurMax = Math.max(brad.hauteurMax, brad.yDepartSaut - brad.y);

  majAttaque(dt);
  majPointSur(dt);
  if (brad.y > NIVEAU_H + 120) { mortsHorsEcran++; tuerBrad('le vide'); }

  brad.invincible = Math.max(0, brad.invincible - dt);
  brad.etirement += (1 - brad.etirement) * Math.min(1, 12 * dt);
  brad.phaseMarche += Math.abs(brad.vx) * dt / LONGUEUR_PAS;
  brad.phaseRepos += dt;

  const actif = dir !== 0 || !brad.auSol || Math.abs(brad.vx) > 4 || brad.attaque > 0;
  brad.inactif = actif ? 0 : brad.inactif + dt;

  if (OPTIONS.traces) {
    traces.push({ x: brad.x + brad.w / 2, y: brad.y + brad.h, sol: brad.auSol });
    if (traces.length > 260) traces.shift();
  }
  sautPresseCeTick = false;
}

/* --- Attaque au corps-a-corps -------------------------------------------
   Gratuite et illimitee : seul le delai de recharge la borne. Le Brad-Shy
   n'est PAS consomme ici, c'est une jauge d'ultime (choix confirme).
------------------------------------------------------------------------ */

function zoneAttaque() {
  const enLAir = !brad.auSol;
  const l = R.porteeAttaque;
  return {
    x: brad.sens > 0 ? brad.x + brad.w - 4 : brad.x - l + 4,
    y: brad.y + (enLAir ? 14 : 8),
    w: l,
    h: brad.h - (enLAir ? 12 : 16),
  };
}

function majAttaque(dt) {
  brad.recharge = Math.max(0, brad.recharge - dt);
  brad.attaque = Math.max(0, brad.attaque - dt);

  if (attaquePresseeCeTick && brad.recharge <= 0) {
    if (brad.porte) {
      lancerBoule();
    } else {
      brad.attaque = R.dureeAttaque;
      brad.recharge = R.recharge;
      brad.toucheParAttaque = new Set();
    }
  }
  attaquePresseeCeTick = false;

  if (ondePresseeCeTick && brad.shy >= 100) declencherOnde();
  ondePresseeCeTick = false;

  if (brad.attaque <= 0) return;
  const zone = zoneAttaque();
  for (const e of ennemis) {
    if (e.etat === 'mort' || brad.toucheParAttaque.has(e.id)) continue;
    if (!chevauche(zone, e)) continue;
    brad.toucheParAttaque.add(e.id);
    blesserEnnemi(e, R.degatsBrad, brad.sens);
  }
}

function declencherOnde() {
  brad.shy = 0;
  const cx = brad.x + brad.w / 2;
  const cy = brad.y + brad.h / 2;
  effets.push({ genre: 'onde', x: cx, y: cy, r: 0, rMax: R.rayonOnde, t: 0, duree: 0.4 });
  for (const e of ennemis) {
    if (e.etat === 'mort') continue;
    const dx = (e.x + e.w / 2) - cx;
    const dy = (e.y + e.h / 2) - cy;
    if (Math.hypot(dx, dy) > R.rayonOnde) continue;
    blesserEnnemi(e, R.degatsOnde, Math.sign(dx) || 1);
  }
  texteFlottant(cx, brad.y - 8, 'BRAD-SHY !', '#e8b62c');
}

/* --- Degats subis -------------------------------------------------------- */

function blesserBrad(degats, sourceX, nomSource) {
  if (brad.invincible > 0) return;
  brad.pv -= degats;
  brad.invincible = R.invincibilite;
  const sens = Math.sign(brad.x + brad.w / 2 - sourceX) || 1;
  brad.vx = sens * R.reculX;
  brad.vy = -R.reculY;
  brad.auSol = false;
  brad.porte = null;
  texteFlottant(brad.x + brad.w / 2, brad.y, '-' + degats, '#ff6b6b');
  secousse(4, 0.18);
  if (brad.pv <= 0) tuerBrad(nomSource);
}

const CONSEILS = {
  'Serra': "Un saut sur la tête suffit. Vraiment, juste un.",
  'Serra-Boost': "Il court plus vite que toi. Laisse-le venir et saute au dernier moment.",
  'Serra-Lourd': "Impossible à écraser. Trois coups de poing, et de la patience.",
  'Serra-Lanceur': "Tes poings ne lui font rien. Renvoie-lui sa boule.",
  'Serra-Volant': "Attaque-le en l'air, c'est fait pour ça.",
  'le vide': "Le vide, Brad. Le vide.",
};

let etatJeu = 'jeu';         // 'jeu' | 'mort'
let tueur = '';

function tuerBrad(nomSource) {
  if (etatJeu === 'mort') return;
  brad.pv = 0;
  etatJeu = 'mort';
  tueur = nomSource;
  mortsConsecutives++;
  secousse(8, 0.4);
}

function relancerApresMort() {
  // Trois morts consecutives : les notes demandent de refaire le niveau entier.
  const auDebut = mortsConsecutives >= 3;
  if (auDebut) mortsConsecutives = 0;
  brad.pv = brad.pvMax;
  brad.shy = 0;
  reapparaitre(auDebut);
  reinitialiserEnnemis();
  etatJeu = 'jeu';
}

/* -----------------------------------------------------------------------------
   2. ENNEMIS
   Un seul comportement generique, parametre par type. Les differences de
   gameplay tiennent dans cette table, pas dans du code separe.
-------------------------------------------------------------------------- */

const TYPES_ENNEMI = {
  'Serra':         { w: 20, h: 32, pv: 1, vitesse: 1.0,  degats: 1, shy: 1.0, ecrasable: true },
  'Serra-Boost':   { w: 20, h: 32, pv: 1, vitesse: 2.0,  degats: 1, shy: 1.0, ecrasable: true, portee: 1.4 },
  'Serra-Lourd':   { w: 32, h: 40, pv: 3, vitesse: 0.55, degats: 2, shy: 2.2, ecrasable: false },
  'Serra-Lanceur': { w: 24, h: 34, pv: 1, vitesse: 0,    degats: 1, shy: 1.8, ecrasable: false,
                     invulnerable: true, lance: true, cadence: 2.0 },
  'Serra-Volant':  { w: 24, h: 28, pv: 1, vitesse: 0.9,  degats: 1, shy: 1.3, ecrasable: true, vole: true },
};

let ennemis = [];
let prochainId = 1;

function creerEnnemi(depart) {
  const t = TYPES_ENNEMI[depart.type];
  return {
    id: prochainId++,
    type: depart.type, t,
    x: depart.x * TUILE, y: depart.y * TUILE - t.h,
    ancreY: depart.y * TUILE - t.h,      // ligne de vol pour les volants
    w: t.w, h: t.h,
    vx: -t.vitesse * R.vitesseEnnemi, vy: 0,
    sens: -1,
    pv: t.pv,
    etat: 'patrouille',                  // patrouille | alerte | charge | mort
    minuteur: 0,
    flash: 0,
    coince: 0,
    phase: depart.x * 0.7,               // dephasage pour que tous ne bougent pas ensemble
    ecrase: 1,
    rechargeTir: 1.0,
  };
}

function reinitialiserEnnemis() {
  prochainId = 1;
  ennemis = ENNEMIS_DEPART.map(creerEnnemi);
  boules.length = 0;
  ramassages.length = 0;
}

function blesserEnnemi(e, degats, sensPoussee, ignoreInvulnerabilite) {
  if (e.etat === 'mort') return;
  if (e.t.invulnerable && !ignoreInvulnerabilite) {
    // Le Lanceur encaisse sans broncher : on le signale au joueur au lieu de
    // le laisser croire que son coup n'a pas porte.
    e.flash = 0.12;
    texteFlottant(e.x + e.w / 2, e.y, 'blindé !', '#9aa0bb');
    return;
  }
  e.pv -= degats;
  e.flash = 0.14;
  e.vx += sensPoussee * 60;
  if (e.pv <= 0) tuerEnnemi(e);
  else {
    e.etat = 'charge';
    e.minuteur = 0;
    particules(e.x + e.w / 2, e.y + e.h / 2, 5, '#ffd6d6');
  }
}

function tuerEnnemi(e) {
  e.etat = 'mort';
  e.minuteur = 0.32;
  particules(e.x + e.w / 2, e.y + e.h / 2, 12, '#f0a0a0');

  const gain = R.gainBradShy * e.t.shy;
  brad.shy = Math.min(100, brad.shy + gain);

  // Pieces : quantite raisonnable, un peu au hasard.
  const nb = 1 + Math.floor(Math.random() * 2) + (e.t.pv > 1 ? 1 : 0);
  for (let i = 0; i < nb; i++) {
    ramassages.push({
      genre: 'piece',
      x: e.x + e.w / 2 - 4, y: e.y + e.h / 2 - 4, w: 8, h: 8,
      vx: (Math.random() - 0.5) * 90, vy: -140 - Math.random() * 60,
      vie: 12, phase: Math.random() * 6,
    });
  }
  // Soin : uniquement si Brad a reellement perdu de la vie, pour qu'il reste
  // sur ses gardes quand sa barre est deja pleine (demande explicite des notes).
  if (brad.pv < brad.pvMax - 1 && Math.random() < 0.28) {
    ramassages.push({
      genre: 'soin',
      x: e.x + e.w / 2 - 5, y: e.y + e.h / 2 - 5, w: 10, h: 10,
      vx: (Math.random() - 0.5) * 50, vy: -120,
      vie: 12, phase: 0,
    });
  }
}

function majEnnemis(dt) {
  const bcx = brad.x + brad.w / 2;
  const bcy = brad.y + brad.h / 2;

  for (const e of ennemis) {
    if (e.etat === 'mort') {
      e.minuteur -= dt;
      e.ecrase = Math.max(0.1, e.ecrase - dt * 3.4);
      continue;
    }

    e.flash = Math.max(0, e.flash - dt);
    e.phase += dt * (2 + Math.abs(e.vx) * 0.04);

    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const dx = bcx - ecx;
    const dy = bcy - ecy;
    const portee = R.porteeDetection * (e.t.portee || 1);
    // Detection dans un disque : l'ennemi repere Brad meme de dos, comme
    // demande, mais la portee laisse la place a une approche preparee.
    const repere = Math.hypot(dx, dy * 1.6) < portee;

    switch (e.etat) {
      case 'patrouille':
        if (repere) { e.etat = 'alerte'; e.minuteur = R.delaiAlerte; e.vx = 0; }
        break;
      case 'alerte':
        e.minuteur -= dt;
        e.vx = 0;
        if (!repere) e.etat = 'patrouille';
        else if (e.minuteur <= 0) e.etat = 'charge';
        break;
      case 'charge':
        // On perd la trace un peu au-dela de la portee de detection, pour
        // eviter un ennemi qui s'allume et s'eteint au moindre pas de Brad.
        if (Math.hypot(dx, dy * 1.6) > portee * 1.5) e.etat = 'patrouille';
        break;
    }

    if (e.t.lance) majLanceur(e, dt, dx, dy);
    else if (e.t.vole) majVolant(e, dt, dx, dy);
    else majTerrestre(e, dt, dx);

    if (e.etat !== 'mort') contactEnnemi(e, dt);
  }

  ennemis = ennemis.filter(e => !(e.etat === 'mort' && e.minuteur <= 0));
}

function majTerrestre(e, dt, dx) {
  const base = e.t.vitesse * R.vitesseEnnemi;

  if (e.etat === 'charge') {
    e.sens = Math.sign(dx) || e.sens;
    e.vx = e.sens * base * R.gainCharge;
  } else if (e.etat === 'patrouille') {
    e.vx = e.sens * base;
  }
  // Poussee de decoincement : voir contactEnnemi().
  if (e.coince > 0) { e.coince -= dt; e.vx = e.sens * -base * 1.6; }

  e.vy = Math.min(R.chuteMax, e.vy + R.gravite * dt);

  // Deplacement horizontal
  e.x += e.vx * dt;
  for (const s of solides) {
    if (!chevauche(e, s)) continue;
    e.x = e.vx > 0 ? s.x - e.w : s.x + s.w;
    e.sens = -e.sens;
    e.vx = 0;
  }

  // Deplacement vertical
  const basAvant = e.y + e.h;
  e.y += e.vy * dt;
  let auSol = false;
  for (const s of solides) {
    if (!chevauche(e, s)) continue;
    if (e.vy > 0) { e.y = s.y - e.h; auSol = true; }
    else e.y = s.y + s.h;
    e.vy = 0;
  }
  for (const p of traversantes) {
    if (e.vy > 0 && chevauche(e, p) && basAvant <= p.y + 1) {
      e.y = p.y - e.h; e.vy = 0; auSol = true;
    }
  }

  // Demi-tour au bord d'une plateforme, uniquement en patrouille : un ennemi
  // qui charge accepte de tomber, sinon il paraitrait bloque au bord.
  if (auSol && e.etat === 'patrouille') {
    const devant = e.sens > 0 ? e.x + e.w + 3 : e.x - 3;
    if (!solSous(devant, e.y + e.h)) { e.sens = -e.sens; e.x += e.sens * 2; }
  }
}

function majVolant(e, dt, dx, dy) {
  const base = e.t.vitesse * R.vitesseEnnemi;
  if (e.etat === 'charge') {
    const d = Math.hypot(dx, dy) || 1;
    e.sens = Math.sign(dx) || e.sens;
    e.x += (dx / d) * base * R.gainCharge * dt;
    e.y += (dy / d) * base * R.gainCharge * dt;
  } else {
    e.x += e.sens * base * dt;
    e.y = e.ancreY + Math.sin(e.phase * 0.9) * 10;
    for (const s of solides) {
      if (chevauche(e, s)) { e.sens = -e.sens; e.x += e.sens * 4; break; }
    }
  }
}

function majLanceur(e, dt, dx, dy) {
  e.sens = Math.sign(dx) || e.sens;
  e.vy = Math.min(R.chuteMax, e.vy + R.gravite * dt);
  e.y += e.vy * dt;
  for (const s of solides) {
    if (!chevauche(e, s)) continue;
    if (e.vy > 0) e.y = s.y - e.h;
    e.vy = 0;
  }

  if (e.etat !== 'charge') return;
  e.rechargeTir -= dt;
  if (e.rechargeTir > 0) return;
  e.rechargeTir = e.t.cadence;

  // Tir en cloche vers la position actuelle de Brad.
  const dist = Math.abs(dx);
  boules.push({
    x: e.x + e.w / 2 - 7, y: e.y + 4, w: 14, h: 14,
    vx: e.sens * Math.min(240, 110 + dist * 0.55),
    vy: -190 - Math.min(120, Math.abs(dy)),
    aBrad: false, vie: 8, phase: 0, posee: 0,
  });
}

/* Contact ennemi / Brad : ecrasement, degats, et garde-fou anti-blocage.

   Les notes signalent explicitement le risque qu'un ennemi reste coince sous
   Brad quand le joueur rate son saut. On le traite en deux temps : tout
   contact avec degats repousse les deux corps, et un chevauchement qui dure
   force l'ennemi a s'ecarter. */
function contactEnnemi(e, dt) {
  if (!chevauche(brad, e)) { e.coince = Math.max(0, e.coince - dt); return; }

  // Brad ecrase l'ennemi s'il TOMBAIT et se trouvait au-dessus de sa moitie
  // haute juste avant la resolution des collisions.
  const dessus = brad.vyAvant > 40 && brad.basAvant <= e.y + e.h * 0.55;

  if (dessus) {
    if (e.t.ecrasable) {
      blesserEnnemi(e, 999, brad.sens, true);
      // Maintenir le bouton de saut donne un rebond plus haut : de quoi
      // enchainer plusieurs ennemis a la suite.
      brad.vy = -R.forceSaut * (entrees.saut ? Math.min(1, R.rebond + 0.28) : R.rebond);
      brad.sautEnCours = entrees.saut;
      brad.etirement = 1.2;
      secousse(3, 0.12);
    } else {
      // Trop gros (ou blinde) pour etre ecrase : Brad rebondit sans degat de
      // part et d'autre. Le court repit qui suit est indispensable : sans lui,
      // Brad retomberait aussitot sur l'ennemi et encaisserait un coup qui
      // ressemblerait a un bug plutot qu'a une sanction.
      brad.vy = -R.forceSaut * 0.5;
      brad.vx = Math.sign(brad.x + brad.w / 2 - (e.x + e.w / 2)) * 120 || 120;
      brad.invincible = Math.max(brad.invincible, 0.4);
      e.flash = 0.1;
      texteFlottant(e.x + e.w / 2, e.y, e.t.invulnerable ? 'blindé !' : 'trop gros', '#9aa0bb');
    }
    return;
  }

  if (brad.invincible <= 0) {
    blesserBrad(e.t.degats, e.x + e.w / 2, e.type);
    e.vx = -Math.sign(brad.x - e.x) * 90;
  } else {
    // Deja invincible et toujours en contact : on decoince l'ennemi.
    e.coince += dt;
    if (e.coince > 0.25) { e.sens = -Math.sign(brad.x + brad.w / 2 - (e.x + e.w / 2)) || 1; }
  }
}

/* -----------------------------------------------------------------------------
   3. BOULES DE SERRANO
   Comportement retenu (Roadmap) : le Lanceur est invulnerable aux attaques de
   Brad. Sa boule, une fois esquivee, reste au sol un temps limite ; Brad peut
   la ramasser et la renvoyer, ce qui elimine le Lanceur en un seul coup.
-------------------------------------------------------------------------- */

const boules = [];

function majBoules(dt) {
  for (const b of boules) {
    b.vie -= dt;
    b.phase += dt * 8;

    if (b.posee > 0) { b.posee -= dt; continue; }

    // Le tir de l'ennemi decrit une cloche ; le renvoi de Brad part droit
    // devant lui. Une trajectoire tendue et previsible fait du renvoi une
    // vraie riposte plutot qu'un pari sur l'angle.
    b.vy = Math.min(R.chuteMax, b.vy + R.gravite * (b.aBrad ? 0 : 0.85) * dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    let pose = false;
    for (const s of solides) {
      if (!chevauche(b, s)) continue;
      if (b.aBrad) { b.vie = 0; particules(b.x + 7, b.y + 7, 8, '#f0a0a0'); break; }
      if (b.vy > 0) { b.y = s.y - b.h; pose = true; }
      else if (b.vy < 0) b.y = s.y + s.h;
      b.vx = 0; b.vy = 0;
    }
    if (b.vie <= 0) continue;
    if (pose) { b.posee = 6; b.vie = Math.min(b.vie, 6); }

    if (b.aBrad) {
      // Boule renvoyee : elle traverse et elimine ce qu'elle touche, Lanceur compris.
      for (const e of ennemis) {
        if (e.etat === 'mort' || !chevauche(b, e)) continue;
        blesserEnnemi(e, 999, Math.sign(b.vx) || 1, true);
        b.vie = 0;
        break;
      }
    } else if (chevauche(b, brad) && brad.invincible <= 0) {
      blesserBrad(1, b.x + b.w / 2, 'Serra-Lanceur');
      b.vie = 0;
    }
  }

  // Ramassage : Brad prend la boule posee sur laquelle il marche.
  if (!brad.porte) {
    for (const b of boules) {
      if (b.posee <= 0 || b.vie <= 0 || !chevauche(b, brad)) continue;
      brad.porte = true;
      b.vie = 0;
      texteFlottant(brad.x + brad.w / 2, brad.y, 'boule ramassée', '#f0a0a0');
      break;
    }
  }

  for (let i = boules.length - 1; i >= 0; i--) if (boules[i].vie <= 0) boules.splice(i, 1);
}

function lancerBoule() {
  brad.porte = null;
  brad.recharge = R.recharge;
  boules.push({
    x: brad.x + brad.w / 2 - 7 + brad.sens * 12, y: brad.y + 14, w: 14, h: 14,
    vx: brad.sens * 340, vy: 0,
    aBrad: true, vie: 1.6, phase: 0, posee: 0,
  });
  texteFlottant(brad.x + brad.w / 2, brad.y - 4, 'renvoyée !', '#f0a0a0');
}

/* -----------------------------------------------------------------------------
   4. RAMASSAGES (pieces et soins)
-------------------------------------------------------------------------- */

const ramassages = [];

function majRamassages(dt) {
  for (const r of ramassages) {
    r.vie -= dt;
    r.phase += dt * 7;
    r.vy = Math.min(500, r.vy + R.gravite * 0.9 * dt);
    r.x += r.vx * dt;
    r.y += r.vy * dt;

    for (const s of solides) {
      if (!chevauche(r, s)) continue;
      if (r.vy > 0) { r.y = s.y - r.h; r.vy = 0; r.vx *= 0.5; }
      else r.vy = 0;
    }

    // Petit aimant : sous 40 px, l'objet vient a Brad. Evite les ramassages
    // rates au pixel pres.
    const dx = (brad.x + brad.w / 2) - (r.x + r.w / 2);
    const dy = (brad.y + brad.h / 2) - (r.y + r.h / 2);
    const d = Math.hypot(dx, dy);
    if (d < 40) { r.x += (dx / d) * 190 * dt; r.y += (dy / d) * 190 * dt; }

    if (chevauche(r, brad)) {
      if (r.genre === 'piece') {
        brad.pieces++;
        texteFlottant(brad.x + brad.w / 2, brad.y - 4, '+1 BC', '#e8b62c');
      } else {
        brad.pv = Math.min(brad.pvMax, brad.pv + 1);
        texteFlottant(brad.x + brad.w / 2, brad.y - 4, '+1 PV', '#7ee08a');
      }
      r.vie = 0;
    }
  }
  for (let i = ramassages.length - 1; i >= 0; i--) if (ramassages[i].vie <= 0) ramassages.splice(i, 1);
}

/* -----------------------------------------------------------------------------
   5. EFFETS
-------------------------------------------------------------------------- */

const effets = [];
const secousseEtat = { force: 0, t: 0 };

function secousse(force, duree) {
  secousseEtat.force = Math.max(secousseEtat.force, force);
  secousseEtat.t = Math.max(secousseEtat.t, duree);
}

function particules(x, y, n, couleur) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 110;
    effets.push({
      genre: 'particule', x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
      t: 0, duree: 0.3 + Math.random() * 0.25, couleur,
    });
  }
}

function texteFlottant(x, y, texte, couleur) {
  effets.push({ genre: 'texte', x, y, texte, couleur, t: 0, duree: 0.8 });
}

function majEffets(dt) {
  for (const f of effets) {
    f.t += dt;
    if (f.genre === 'particule') {
      f.vy += 420 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    } else if (f.genre === 'texte') {
      f.y -= 26 * dt;
    } else if (f.genre === 'onde') {
      f.r = f.rMax * Math.min(1, f.t / f.duree);
    }
  }
  for (let i = effets.length - 1; i >= 0; i--) if (effets[i].t >= effets[i].duree) effets.splice(i, 1);

  if (secousseEtat.t > 0) {
    secousseEtat.t -= dt;
    if (secousseEtat.t <= 0) secousseEtat.force = 0;
  }
}
