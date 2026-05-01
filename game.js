/* =============================================================
   Pixel Preserve — game.js
   Retro idle ecosystem game. 100% client-side, no backend.
   All sprites drawn via canvas fillRect primitives.
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SPRITE IMAGE SWAP
   When you have your own pixel art ready, add URLs here.
   The engine will use ctx.drawImage() instead of fillRect().
   Leave a value as '' to keep the programmatic fallback.

   Example:
     polar_bear: 'https://your-cdn.com/sprites/polar_bear.png',

   Supported formats: PNG, GIF (animated), WebP.
   Recommended sprite size: 16×16 px (or multiples thereof).
───────────────────────────────────────────────────────────── */
const SPRITE_IMAGE_URLS = {
  polar_bear:  '',
  arctic_fox:  '',
  bison:       '',
  zebra:       '',
  lizard:      '',
  desert_fox:  '',
  // Plants (one per habitat, keyed by habitat name)
  plant_tundra:    '',
  plant_grassland: '',
  plant_desert:    '',
};

// Preloaded Image objects — populated automatically on init.
// Do not edit this object; edit SPRITE_IMAGE_URLS above.
const SPRITE_IMAGES = {};

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const CANVAS_W           = 800;   // logical canvas width
const CANVAS_H           = 560;   // logical canvas height
const SPRITE_SCALE       = 2;     // each "pixel" = 2×2 canvas px → 16×16 sprites
const MAX_SPEED          = 60;    // px per second max animal velocity
const WANDER_STRENGTH    = 120;   // random acceleration magnitude
const FRICTION           = 0.85;  // velocity damping per frame
const MAX_ANIMALS        = 20;    // per habitat
const MAX_PLANTS         = 25;    // per habitat
const REPRO_RADIUS       = 14;    // px — reproduction trigger distance
const EAT_RADIUS         = 14;    // px — eating trigger distance
const REPRO_CHANCE       = 0.04;  // probability per second when near same species
const HUNGER_MAX         = 100;
const HUNGER_RESTORE     = 45;    // hunger restored when eating a plant
const PLANT_ENERGY_COST  = 35;    // energy drained from plant when eaten
const SECONDS_PER_YEAR   = 60;    // 1 in-game year = 60 real seconds
const BASE_DISASTER_GAP  = 3;     // minimum years between disasters
const OFFLINE_EFFICIENCY = 0.5;   // 50% biomass rate while offline
const OFFLINE_CAP_S      = 3600;  // cap offline time at 1 hour
const SAVE_INTERVAL_MS   = 30000; // autosave every 30 real seconds
const SAVE_KEY           = 'pixel_preserve_v1';
const LOG_MAX            = 50;

/* ─────────────────────────────────────────────────────────────
   HABITATS
   ═══════════════════════════════════════════════════════════
   ADD A NEW HABITAT: copy one block below, give it a unique
   key, fill in the fields, and add draw functions for any new
   species to SPRITE_RENDERERS further down.
   The MAP tab and all engine code pick it up automatically.
───────────────────────────────────────────────────────────── */
const HABITATS = {

  tundra: {
    key:              'tundra',
    label:            'Tundra',
    biomassMultiplier: 0.6,
    stabilityBase:    90,
    disasterRisk:     0.35,   // lower = rarer disasters
    bgColor:          '#6a8aaa',
    skyGradTop:       '#2a3a5a',
    skyGradBottom:    '#6a8aaa',
    groundColor:      '#c8dce8',
    groundAccent:     '#b0ccd8',
    species:          ['polar_bear', 'arctic_fox'],
    plantKey:         'plant_tundra',
    plantRespawnRate: 10,     // seconds per new plant
    initAnimals:      6,
    initPlants:       10,
    hungerDecayBase:  4,      // hunger points lost per second
  },

  grassland: {
    key:              'grassland',
    label:            'Grassland',
    biomassMultiplier: 1.0,
    stabilityBase:    70,
    disasterRisk:     0.65,
    bgColor:          '#4a7a3a',
    skyGradTop:       '#3a6aaa',
    skyGradBottom:    '#88aacc',
    groundColor:      '#6ab040',
    groundAccent:     '#4a8028',
    species:          ['bison', 'zebra'],
    plantKey:         'plant_grassland',
    plantRespawnRate: 6,
    initAnimals:      8,
    initPlants:       15,
    hungerDecayBase:  5,
  },

  desert: {
    key:              'desert',
    label:            'Desert',
    biomassMultiplier: 0.5,
    stabilityBase:    50,
    disasterRisk:     0.95,
    bgColor:          '#c8a84a',
    skyGradTop:       '#9a5a20',
    skyGradBottom:    '#d4a84a',
    groundColor:      '#e0c870',
    groundAccent:     '#c8a840',
    species:          ['lizard', 'desert_fox'],
    plantKey:         'plant_desert',
    plantRespawnRate: 14,
    initAnimals:      6,
    initPlants:       8,
    hungerDecayBase:  3,     // desert animals evolved to need less food
  },

  /* ADD NEW HABITAT HERE — example skeleton:
  savanna: {
    key:              'savanna',
    label:            'Savanna',
    biomassMultiplier: 0.8,
    stabilityBase:    65,
    disasterRisk:     0.75,
    bgColor:          '#c8a040',
    skyGradTop:       '#5080cc',
    skyGradBottom:    '#88aadd',
    groundColor:      '#b89040',
    groundAccent:     '#907030',
    species:          ['elephant', 'cheetah'],  // add draw fns to SPRITE_RENDERERS
    plantKey:         'plant_savanna',
    plantRespawnRate: 8,
    initAnimals:      6,
    initPlants:       12,
    hungerDecayBase:  5,
  },
  */
};

/* ─────────────────────────────────────────────────────────────
   UPGRADES
   ═══════════════════════════════════════════════════════════
   ADD A NEW UPGRADE: copy a block, give it a unique key,
   fill in the fields. The SKILLS tab renders automatically
   from Object.values(UPGRADES). The apply() function is called
   once when the upgrade is purchased (or each frame for
   active abilities — see genetic_stabilization).
───────────────────────────────────────────────────────────── */
const UPGRADES = {

  nitrogen_fixation: {
    key:         'nitrogen_fixation',
    label:       'Nitrogen Fixation',
    tree:        'Atmosphere',
    description: 'Microbes enrich the soil. +10% passive biomass generation.',
    cost:        200,
    purchased:   false,
    isActive:    false,
    isAbility:   false,
    apply(gs) { gs.biomassMultiplierBonus += 0.10; },
  },

  metabolic_efficiency: {
    key:         'metabolic_efficiency',
    label:       'Metabolic Efficiency',
    tree:        'Evolution',
    description: 'Animals evolved slower metabolism. Hunger decays 40% slower.',
    cost:        350,
    purchased:   false,
    isActive:    false,
    isAbility:   false,
    apply(gs) { gs.hungerDecayModifier *= 0.60; },
  },

  genetic_stabilization: {
    key:            'genetic_stabilization',
    label:          'Genetic Stabilization',
    tree:           'Spirit',
    description:    'Active ability: prevents all animal deaths for 15 seconds.',
    cost:           0,           // always unlocked (shown for free)
    activationCost: 500,         // costs 500 Biomass per activation
    purchased:      true,        // always visible
    isActive:       false,
    isAbility:      true,
    apply() {},                  // no passive effect
  },

  /* ADD NEW UPGRADE HERE — example:
  photosynthesis_boost: {
    key:         'photosynthesis_boost',
    label:       'Photosynthesis Boost',
    tree:        'Atmosphere',
    description: 'Plants regrow 30% faster after being eaten.',
    cost:        275,
    purchased:   false,
    isActive:    false,
    isAbility:   false,
    apply(gs) { gs.plantRespawnModifier *= 0.70; },
  },
  */
};

/* ─────────────────────────────────────────────────────────────
   GAME STATE (singleton)
───────────────────────────────────────────────────────────── */
const GameState = {
  year:                   0,
  biomass:                50,
  biodiversity:           0,
  stability:              70,
  activeHabitat:          'grassland',
  biomassMultiplierBonus: 0,    // cumulative upgrade bonuses
  hungerDecayModifier:    1.0,  // multiplicative
  plantRespawnModifier:   1.0,  // multiplicative
  geneticStabActive:      false,
  geneticStabEndsAt:      0,    // performance.now() timestamp
  nextDisasterYear:       3,
  log:                    [],
};

/* ─────────────────────────────────────────────────────────────
   LIVE STATE ARRAYS — animals + plants across ALL habitats
───────────────────────────────────────────────────────────── */
let ALL_ANIMALS = [];
let ALL_PLANTS  = [];

// Per-habitat plant respawn timers { habitatKey: secondsSinceLastRespawn }
const plantRespawnTimers = {};

// Per-habitat disaster cooldowns
let disasterActive = false;
let disasterEndsAt = 0;   // performance.now()
let disasterType   = '';

let uidCounter = 0;
function uid() { return ++uidCounter; }

/* ─────────────────────────────────────────────────────────────
   SPRITE RENDERERS
   Each function draws one animal centered at (cx, cy).
   S = SPRITE_SCALE (2 by default; each logical px = S×S canvas px).

   ═══════════════════════════════════════════════════════════
   SPRITE SWAP INSTRUCTIONS
   When you have a custom image for a species, add its URL to
   SPRITE_IMAGE_URLS at the top of this file. The preloader
   will populate SPRITE_IMAGES[key] automatically, and each
   draw function will use ctx.drawImage() instead of fillRect.
   You do NOT need to modify the draw functions themselves.
   ═══════════════════════════════════════════════════════════
───────────────────────────────────────────────────────────── */

function drawSpriteOrImage(ctx, key, cx, cy, drawFn, frame) {
  const img = SPRITE_IMAGES[key];
  if (img && img.complete && img.naturalWidth > 0) {
    // ── SPRITE SWAP: using custom image ──────────────────────
    // Sprite is drawn centered at (cx, cy), 16×16 canvas pixels.
    const W = 16, H = 16;
    ctx.drawImage(img, Math.round(cx - W / 2), Math.round(cy - H / 2), W, H);
  } else {
    // ── Programmatic fallback ────────────────────────────────
    drawFn(ctx, cx, cy, SPRITE_SCALE, frame);
  }
}

/* Helper: draw one logical pixel */
function px(ctx, lx, ly, ox, oy, S) {
  ctx.fillRect(Math.round(ox + lx * S), Math.round(oy + ly * S), S, S);
}

/* ── Polar Bear (8×8 design, white/icy blue) ──────────────── */
function drawPolarBear(ctx, cx, cy, S, frame) {
  // SPRITE SWAP: replace body below with ctx.drawImage(SPRITE_IMAGES['polar_bear'], cx-8, cy-8, 16, 16)
  const ox = cx - S * 4, oy = cy - S * 4;
  const W = '#f0f0ff', B = '#112233', N = '#ffaacc', L = '#c8d8ea';

  ctx.fillStyle = W;
  // Head
  [[2,0],[3,0],[4,0],[5,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1]].forEach(([x,y]) => px(ctx,x,y,ox,oy,S));
  // Eyes
  ctx.fillStyle = B;
  px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  // Nose
  ctx.fillStyle = N;
  px(ctx,3,3,ox,oy,S);
  // Body
  ctx.fillStyle = W;
  [[0,2],[1,2],[3,2],[4,2],[6,2],[7,2]].forEach(([x,y]) => px(ctx,x,y,ox,oy,S));
  for (let x=0;x<8;x++) { px(ctx,x,3,ox,oy,S); px(ctx,x,4,ox,oy,S); }
  [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]].forEach(([x,y]) => px(ctx,x,y,ox,oy,S));
  // Legs (2-frame walk)
  ctx.fillStyle = L;
  const legY = frame % 2 === 0 ? 0 : S;
  [[1,6],[2,6],[5,6],[6,6],[1,7],[2,7],[5,7],[6,7]].forEach(([x,y]) => {
    ctx.fillRect(Math.round(ox + x*S), Math.round(oy + y*S + legY), S, S);
  });
}

/* ── Arctic Fox (white + grey, large tail) ────────────────── */
function drawArcticFox(ctx, cx, cy, S, frame) {
  const ox = cx - S * 4, oy = cy - S * 4;
  const F = '#e8eef8', G = '#a0b0c0', B = '#223344', N = '#ffbbcc';

  // Ears
  ctx.fillStyle = F;
  px(ctx,1,0,ox,oy,S); px(ctx,6,0,ox,oy,S);
  // Head
  [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eyes
  ctx.fillStyle = B;
  px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  // Nose
  ctx.fillStyle = N;
  px(ctx,3,3,ox,oy,S);
  // Body
  ctx.fillStyle = F;
  [[1,3],[2,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Tail
  ctx.fillStyle = G;
  [[6,5],[7,5],[6,6],[7,6]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Legs
  ctx.fillStyle = F;
  const legY = frame % 2 === 0 ? 0 : S;
  [[1,6],[2,6],[4,6],[5,6],[1,7],[2,7],[4,7],[5,7]].forEach(([x,y]) => {
    ctx.fillRect(Math.round(ox+x*S), Math.round(oy+y*S+legY), S, S);
  });
}

/* ── Bison (dark brown, prominent hump) ───────────────────── */
function drawBison(ctx, cx, cy, S, frame) {
  const ox = cx - S * 4, oy = cy - S * 4;
  const D = '#3d1f00', B = '#7a4a20', E = '#111111', H = '#5a3010';

  // Horns
  ctx.fillStyle = D;
  px(ctx,1,0,ox,oy,S); px(ctx,6,0,ox,oy,S);
  // Head mass
  ctx.fillStyle = B;
  [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eyes
  ctx.fillStyle = E;
  px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  // Hump (body)
  ctx.fillStyle = H;
  for(let x=0;x<8;x++) { px(ctx,x,4,ox,oy,S); px(ctx,x,5,ox,oy,S); }
  // Legs
  ctx.fillStyle = B;
  const legY = frame % 2 === 0 ? 0 : S;
  [[0,6],[1,6],[3,6],[4,6],[0,7],[1,7],[3,7],[4,7]].forEach(([x,y]) => {
    ctx.fillRect(Math.round(ox+x*S), Math.round(oy+y*S+legY), S, S);
  });
}

/* ── Zebra (black & white stripes) ───────────────────────── */
function drawZebra(ctx, cx, cy, S, frame) {
  const ox = cx - S * 4, oy = cy - S * 4;
  const Z = '#f5f5f5', SK = '#111111', M = '#d0c8b8';

  // Head
  ctx.fillStyle = Z;
  [[2,0],[3,0],[4,0],[5,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Stripe head
  ctx.fillStyle = SK;
  px(ctx,3,0,ox,oy,S); px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  // Eye
  ctx.fillStyle = SK;
  px(ctx,2,1,ox,oy,S);
  // Body stripes
  const bodyRows = [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5]];
  bodyRows.forEach(([x,y]) => {
    ctx.fillStyle = (x + y) % 2 === 0 ? Z : SK;
    px(ctx,x,y,ox,oy,S);
  });
  // Mane
  ctx.fillStyle = SK;
  [[3,1],[4,1]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Legs
  const legY = frame % 2 === 0 ? 0 : S;
  [[0,6],[1,6],[3,6],[4,6],[6,6],[7,6],[0,7],[1,7],[3,7],[4,7],[6,7],[7,7]].forEach(([x,y]) => {
    ctx.fillStyle = (y % 2 === 0) ? SK : Z;
    ctx.fillRect(Math.round(ox+x*S), Math.round(oy+y*S+legY), S, S);
  });
}

/* ── Lizard (olive green, low profile) ────────────────────── */
function drawLizard(ctx, cx, cy, S, frame) {
  const ox = cx - S * 4, oy = cy - S * 4;
  const L = '#7a9a3c', D = '#1a2a0a', T = '#c8a860', Y = '#aacc40';

  // Head
  ctx.fillStyle = L;
  [[3,1],[4,1],[2,2],[3,2],[4,2],[5,2],[6,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eye
  ctx.fillStyle = D;
  px(ctx,3,2,ox,oy,S);
  // Body
  ctx.fillStyle = L;
  [[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Belly
  ctx.fillStyle = T;
  [[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Scale dots
  ctx.fillStyle = Y;
  [[5,3],[6,3],[5,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Tail
  ctx.fillStyle = L;
  [[0,5],[1,5],[2,5],[3,5],[4,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Legs
  const legY = frame % 2 === 0 ? 0 : S;
  [[1,5],[6,5],[0,6],[7,6]].forEach(([x,y]) => {
    ctx.fillStyle = L;
    ctx.fillRect(Math.round(ox+x*S), Math.round(oy+y*S+legY), S, S);
  });
}

/* ── Desert Fox (large ears, tan/orange) ─────────────────── */
function drawDesertFox(ctx, cx, cy, S, frame) {
  const ox = cx - S * 4, oy = cy - S * 4;
  const F = '#c8a060', D = '#2a1a00', N = '#3a2a10', I = '#e8c090';

  // Large ears
  ctx.fillStyle = F;
  px(ctx,0,0,ox,oy,S); px(ctx,7,0,ox,oy,S);
  px(ctx,0,1,ox,oy,S); px(ctx,7,1,ox,oy,S);
  // Head
  [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eyes (big for nocturnal)
  ctx.fillStyle = D;
  px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  // Ear inner
  ctx.fillStyle = I;
  px(ctx,0,0,ox,oy,S); px(ctx,7,0,ox,oy,S);
  // Nose
  ctx.fillStyle = N;
  px(ctx,3,3,ox,oy,S);
  // Body
  ctx.fillStyle = F;
  [[1,3],[2,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Tail tip
  ctx.fillStyle = I;
  px(ctx,6,5,ox,oy,S); px(ctx,7,5,ox,oy,S);
  // Legs
  ctx.fillStyle = F;
  const legY = frame % 2 === 0 ? 0 : S;
  [[1,6],[2,6],[4,6],[5,6],[1,7],[2,7],[4,7],[5,7]].forEach(([x,y]) => {
    ctx.fillRect(Math.round(ox+x*S), Math.round(oy+y*S+legY), S, S);
  });
}

/* ── Plants (per habitat) ─────────────────────────────────── */
function drawPlant(ctx, plant, habitat) {
  const imgKey = habitat.plantKey;
  const img = SPRITE_IMAGES[imgKey];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.globalAlpha = plant.energy > 40 ? 1 : 0.4;
    ctx.drawImage(img, Math.round(plant.x - 6), Math.round(plant.y - 8), 12, 12);
    ctx.globalAlpha = 1;
    return;
  }

  // Programmatic plant sprites per habitat
  ctx.globalAlpha = plant.energy > 40 ? 1 : 0.35;
  const { key } = habitat;
  const { x, y } = plant;
  const S = 2;

  if (key === 'tundra') {
    // Ice crystal cluster
    ctx.fillStyle = '#c8e8f8';
    ctx.fillRect(x - 1, y - 8, S, 8);
    ctx.fillRect(x + 3, y - 6, S, 6);
    ctx.fillStyle = '#a0c8e0';
    ctx.fillRect(x - 3, y - 4, S, 4);
    ctx.fillStyle = '#e8f4ff';
    ctx.fillRect(x - 2, y - 9, S, S);
    ctx.fillRect(x + 2, y - 7, S, S);
  } else if (key === 'grassland') {
    // 3-blade grass tuft
    ctx.fillStyle = '#3a7a1a';
    ctx.fillRect(x - 3, y - 8, 2, 9);
    ctx.fillRect(x,     y - 10, 2, 11);
    ctx.fillRect(x + 3, y - 7, 2, 8);
    ctx.fillStyle = '#5a9a2a';
    ctx.fillRect(x - 3, y - 9, 1, 3);
    ctx.fillRect(x,     y - 11, 1, 3);
    ctx.fillRect(x + 3, y - 8, 1, 3);
  } else if (key === 'desert') {
    // Cactus
    ctx.fillStyle = '#5a8a30';
    ctx.fillRect(x - 2, y - 12, 4, 13);   // trunk
    ctx.fillRect(x - 7, y - 7, 5, 3);      // left arm
    ctx.fillRect(x + 3,  y - 7, 5, 3);     // right arm
    ctx.fillRect(x - 7, y - 10, 3, 3);     // left arm top
    ctx.fillRect(x + 4,  y - 10, 3, 3);    // right arm top
    ctx.fillStyle = '#7aaa50';
    ctx.fillRect(x - 1, y - 12, 2, 2);     // highlight
  }

  ctx.globalAlpha = 1;
}

/* Map of species key → draw function */
const SPRITE_RENDERERS = {
  polar_bear:  drawPolarBear,
  arctic_fox:  drawArcticFox,
  bison:       drawBison,
  zebra:       drawZebra,
  lizard:      drawLizard,
  desert_fox:  drawDesertFox,
  // ADD NEW SPECIES DRAW FUNCTIONS HERE
};

/* ─────────────────────────────────────────────────────────────
   CANVAS SETUP
───────────────────────────────────────────────────────────── */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function initCanvas() {
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx.imageSmoothingEnabled = false;
}

/* ─────────────────────────────────────────────────────────────
   RENDER PIPELINE
───────────────────────────────────────────────────────────── */

function drawBackground(habitat) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.55);
  grad.addColorStop(0, habitat.skyGradTop);
  grad.addColorStop(1, habitat.skyGradBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Ground
  const groundY = Math.floor(CANVAS_H * 0.52);
  ctx.fillStyle = habitat.groundColor;
  ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);

  // Ground accent band (dithered horizon)
  ctx.fillStyle = habitat.groundAccent;
  ctx.fillRect(0, groundY, CANVAS_W, 6);

  // Retro dithered horizon dots
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let x = 0; x < CANVAS_W; x += 4) {
    ctx.fillRect(x, groundY + 6, 2, 2);
  }
}

function drawPlants(habitatKey) {
  const habitat = HABITATS[habitatKey];
  ALL_PLANTS
    .filter(p => p.habitat === habitatKey)
    .forEach(p => drawPlant(ctx, p, habitat));
}

let lastFill = '';
function setFill(color) {
  if (color !== lastFill) { ctx.fillStyle = color; lastFill = color; }
}

function drawAnimals(habitatKey) {
  ALL_ANIMALS
    .filter(a => a.habitat === habitatKey)
    .forEach(a => {
      const fn = SPRITE_RENDERERS[a.species];
      if (fn) {
        drawSpriteOrImage(ctx, a.species, a.x, a.y, fn, a.frame);
      }
    });
}

function drawOverlays() {
  const now = performance.now();

  // Genetic Stabilization: green shimmer over all animals
  if (GameState.geneticStabActive && now < GameState.geneticStabEndsAt) {
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(now / 200);
    ctx.fillStyle = '#80ff80';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }

  // Disaster flash
  if (disasterActive && now < disasterEndsAt) {
    const t = (now - (disasterEndsAt - 3000)) / 3000;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.25 * (1 - t));
    ctx.fillStyle = disasterType === 'heatwave' ? '#ff6020' : '#8020c0';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
}

function renderFrame() {
  lastFill = '';
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const h = HABITATS[GameState.activeHabitat];
  drawBackground(h);
  drawPlants(GameState.activeHabitat);
  drawAnimals(GameState.activeHabitat);
  drawOverlays();
}

/* ─────────────────────────────────────────────────────────────
   ANIMAL FACTORY
───────────────────────────────────────────────────────────── */
function makeAnimal(species, habitatKey, x, y) {
  const h = HABITATS[habitatKey];
  return {
    id:             uid(),
    species,
    habitat:        habitatKey,
    x:              x  ?? (30 + Math.random() * (CANVAS_W - 60)),
    y:              y  ?? (CANVAS_H * 0.55 + Math.random() * (CANVAS_H * 0.38)),
    vx:             (Math.random() - 0.5) * 30,
    vy:             (Math.random() - 0.5) * 10,
    hunger:         60 + Math.random() * 30,
    hungerDecayRate: h.hungerDecayBase,
    age:            0,
    frame:          0,
    frameTimer:     0,
  };
}

function makePlant(habitatKey, x, y) {
  return {
    id:      uid(),
    habitat: habitatKey,
    x:       x ?? (20 + Math.random() * (CANVAS_W - 40)),
    y:       y ?? (CANVAS_H * 0.54 + Math.random() * (CANVAS_H * 0.38)),
    energy:  80 + Math.random() * 20,
    alive:   true,
    respawnTimer: 0,
  };
}

/* ─────────────────────────────────────────────────────────────
   HABITAT INITIALISATION
───────────────────────────────────────────────────────────── */
const habitatInitialised = {};

function initHabitat(key) {
  if (habitatInitialised[key]) return;
  habitatInitialised[key] = true;

  const h = HABITATS[key];
  plantRespawnTimers[key] = 0;

  // Spawn initial animals
  for (let i = 0; i < h.initAnimals; i++) {
    const species = h.species[i % h.species.length];
    ALL_ANIMALS.push(makeAnimal(species, key));
  }

  // Spread initial plants across the ground area
  for (let i = 0; i < h.initPlants; i++) {
    ALL_PLANTS.push(makePlant(key));
  }
}

/* ─────────────────────────────────────────────────────────────
   PHYSICS — Brownian motion + wall bounce
───────────────────────────────────────────────────────────── */
function updatePhysics(dt, habitatKey) {
  const groundY = CANVAS_H * 0.52;

  ALL_ANIMALS.forEach(a => {
    if (a.habitat !== habitatKey) return;

    // Random wander acceleration
    a.vx += (Math.random() - 0.5) * WANDER_STRENGTH * dt;
    a.vy += (Math.random() - 0.5) * WANDER_STRENGTH * 0.4 * dt;  // less vertical wander

    // Friction
    a.vx *= FRICTION;
    a.vy *= FRICTION;

    // Clamp speed (squared distance, no sqrt)
    const spd2 = a.vx * a.vx + a.vy * a.vy;
    if (spd2 > MAX_SPEED * MAX_SPEED) {
      const inv = MAX_SPEED / Math.sqrt(spd2);
      a.vx *= inv; a.vy *= inv;
    }

    // Move
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // Bounce off walls
    const margin = 10;
    if (a.x < margin)          { a.x = margin;          a.vx = Math.abs(a.vx); }
    if (a.x > CANVAS_W-margin) { a.x = CANVAS_W-margin; a.vx = -Math.abs(a.vx); }
    // Vertical: stay in ground band
    if (a.y < groundY + 8)     { a.y = groundY + 8;     a.vy = Math.abs(a.vy); }
    if (a.y > CANVAS_H - 10)   { a.y = CANVAS_H - 10;   a.vy = -Math.abs(a.vy); }

    // Animation frame (every 0.25s)
    a.frameTimer += dt;
    if (a.frameTimer > 0.25) { a.frame++; a.frameTimer = 0; }

    // Age
    a.age += dt;
  });
}

/* ─────────────────────────────────────────────────────────────
   HUNGER, EATING & REPRODUCTION
───────────────────────────────────────────────────────────── */
function checkInteractions(dt, habitatKey) {
  const habitatAnimals = ALL_ANIMALS.filter(a => a.habitat === habitatKey);
  const habitatPlants  = ALL_PLANTS.filter(p => p.habitat === habitatKey && p.alive && p.energy > 0);

  const toKill   = [];
  const toSpawn  = [];
  const aliveCount = habitatAnimals.filter(a => !a._dead).length;

  habitatAnimals.forEach(a => {
    if (a._dead) return;

    // ── Hunger decay ──────────────────────────────────────
    const decay = a.hungerDecayRate * GameState.hungerDecayModifier * dt;
    a.hunger -= decay;

    if (a.hunger <= 0) {
      if (GameState.geneticStabActive && performance.now() < GameState.geneticStabEndsAt) {
        a.hunger = 1; // protected from death
      } else {
        toKill.push(a.id);
        return;
      }
    }

    // ── Eat nearest plant ─────────────────────────────────
    let closestPlant = null, closestDist2 = EAT_RADIUS * EAT_RADIUS;
    habitatPlants.forEach(p => {
      const dx = p.x - a.x, dy = p.y - a.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < closestDist2) { closestDist2 = d2; closestPlant = p; }
    });
    if (closestPlant) {
      closestPlant.energy -= PLANT_ENERGY_COST;
      if (closestPlant.energy <= 0) { closestPlant.alive = false; closestPlant.energy = 0; }
      a.hunger = Math.min(HUNGER_MAX, a.hunger + HUNGER_RESTORE);
    }

    // ── Reproduce with nearby same-species ────────────────
    if (aliveCount < MAX_ANIMALS && Math.random() < REPRO_CHANCE * dt) {
      let mate = null, mateDist2 = REPRO_RADIUS * REPRO_RADIUS;
      habitatAnimals.forEach(b => {
        if (b.id === a.id || b._dead || b.species !== a.species) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < mateDist2) { mateDist2 = d2; mate = b; }
      });
      if (mate) {
        const nx = (a.x + mate.x) / 2 + (Math.random()-0.5)*8;
        const ny = (a.y + mate.y) / 2 + (Math.random()-0.5)*4;
        toSpawn.push(makeAnimal(a.species, habitatKey, nx, ny));
        if (Math.random() < 0.3) {
          pushLog(`[Y${GameState.year.toFixed(1)}] A new ${fmtSpecies(a.species)} was born.`, 'birth');
        }
      }
    }
  });

  // Apply kills
  toKill.forEach(id => {
    const idx = ALL_ANIMALS.findIndex(a => a.id === id);
    if (idx !== -1) {
      pushLog(`[Y${GameState.year.toFixed(1)}] A ${fmtSpecies(ALL_ANIMALS[idx].species)} perished.`, 'disaster');
      ALL_ANIMALS.splice(idx, 1);
      GameState.stability = Math.max(0, GameState.stability - 0.5);
    }
  });

  // Apply births
  toSpawn.forEach(a => ALL_ANIMALS.push(a));
}

/* ─────────────────────────────────────────────────────────────
   ECONOMY — biomass, year, stability, plant respawn
───────────────────────────────────────────────────────────── */
let secondAccumulator = 0;

function tickEconomy(dt, habitatKey) {
  const h       = HABITATS[habitatKey];
  const animals = ALL_ANIMALS.filter(a => a.habitat === habitatKey);
  const count   = animals.length;

  // Biomass income
  GameState.biomass += count
    * h.biomassMultiplier
    * (1 + GameState.biomassMultiplierBonus)
    * dt;

  // Year counter
  GameState.year += dt / SECONDS_PER_YEAR;

  // Stability slow recovery toward habitat base
  const diff = h.stabilityBase - GameState.stability;
  GameState.stability += diff * 0.01 * dt;

  // Biodiversity = distinct species alive
  GameState.biodiversity = new Set(ALL_ANIMALS.map(a => a.species)).size;

  // Plant respawn (coarse: once per accumulated second)
  secondAccumulator += dt;
  if (secondAccumulator >= 1) {
    secondAccumulator -= 1;
    tickPlantRespawn(habitatKey);
    checkDisasters();
  }
}

function tickPlantRespawn(habitatKey) {
  const h     = HABITATS[habitatKey];
  const rate  = h.plantRespawnRate * GameState.plantRespawnModifier;
  plantRespawnTimers[habitatKey] = (plantRespawnTimers[habitatKey] || 0) + 1;

  if (plantRespawnTimers[habitatKey] >= rate) {
    plantRespawnTimers[habitatKey] = 0;

    const dead = ALL_PLANTS.filter(p => p.habitat === habitatKey && !p.alive);
    const all  = ALL_PLANTS.filter(p => p.habitat === habitatKey);

    if (dead.length > 0) {
      // Revive a dead plant
      const p = dead[Math.floor(Math.random() * dead.length)];
      p.alive  = true;
      p.energy = 80 + Math.random() * 20;
    } else if (all.length < MAX_PLANTS) {
      // Spawn a new plant
      ALL_PLANTS.push(makePlant(habitatKey));
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   DISASTERS
   ═══════════════════════════════════════════════════════════
   ADD A NEW DISASTER TYPE:
   1. Add a case to resolveDisaster() below.
   2. Add its string name to the random roll pool in spawnDisaster().
───────────────────────────────────────────────────────────── */
function checkDisasters() {
  if (GameState.year >= GameState.nextDisasterYear) {
    const h = HABITATS[GameState.activeHabitat];
    if (Math.random() < h.disasterRisk) {
      spawnDisaster(GameState.activeHabitat);
    }
    // Schedule next disaster window
    GameState.nextDisasterYear = GameState.year + BASE_DISASTER_GAP + Math.random() * 2;
  }

  // Clear expired disaster
  if (disasterActive && performance.now() >= disasterEndsAt) {
    disasterActive = false;
    // Restore normal hunger decay rates
    ALL_ANIMALS.forEach(a => {
      a.hungerDecayRate = HABITATS[a.habitat].hungerDecayBase;
    });
  }

  // Clear expired Genetic Stabilization
  if (GameState.geneticStabActive && performance.now() >= GameState.geneticStabEndsAt) {
    GameState.geneticStabActive = false;
    pushLog(`[Y${GameState.year.toFixed(1)}] Genetic Stabilization has worn off.`, 'info');
  }
}

function spawnDisaster(habitatKey) {
  const types = ['heatwave', 'plague'];
  const type  = types[Math.floor(Math.random() * types.length)];
  resolveDisaster(type, habitatKey);
}

function resolveDisaster(type, habitatKey) {
  GameState.stability = Math.max(0, GameState.stability - 15);
  disasterActive = true;
  disasterType   = type;
  disasterEndsAt = performance.now() + 3000; // visual flash 3s

  if (type === 'heatwave') {
    // Accelerate hunger drain for all animals in habitat
    ALL_ANIMALS
      .filter(a => a.habitat === habitatKey)
      .forEach(a => { a.hungerDecayRate *= 2.5; });
    // Auto-restore after 20 real seconds via the disasterEndsAt check (above resets rates)
    disasterEndsAt = performance.now() + 20000;
    pushLog(`[Y${GameState.year.toFixed(1)}] Heatwave strikes the ${HABITATS[habitatKey].label}! Animals are starving.`, 'disaster');

  } else if (type === 'plague') {
    // Kill 50% of a random species in the habitat
    const habitatAnimals = ALL_ANIMALS.filter(a => a.habitat === habitatKey);
    if (habitatAnimals.length === 0) return;
    const species = habitatAnimals[Math.floor(Math.random() * habitatAnimals.length)].species;
    const victims = ALL_ANIMALS.filter(a => a.habitat === habitatKey && a.species === species);
    const killCount = Math.ceil(victims.length * 0.5);
    for (let i = 0; i < killCount; i++) {
      const idx = ALL_ANIMALS.indexOf(victims[i]);
      if (idx !== -1) ALL_ANIMALS.splice(idx, 1);
    }
    pushLog(`[Y${GameState.year.toFixed(1)}] Plague decimates the ${fmtSpecies(species)} population! ${killCount} lost.`, 'disaster');

  }
  /* ADD NEW DISASTER TYPE HERE:
  } else if (type === 'drought') {
    // Kill all plants in habitat
    ALL_PLANTS.filter(p => p.habitat === habitatKey).forEach(p => { p.alive = false; p.energy = 0; });
    pushLog(`[Y${GameState.year.toFixed(1)}] Drought! All plants in ${HABITATS[habitatKey].label} withered.`, 'disaster');
  }
  */
}

/* ─────────────────────────────────────────────────────────────
   UI — DOM rendering
───────────────────────────────────────────────────────────── */
let lastUIUpdate = 0;

function updateUI() {
  const now = performance.now();
  if (now - lastUIUpdate < 250) return;
  lastUIUpdate = now;

  const animals = ALL_ANIMALS.filter(a => a.habitat === GameState.activeHabitat);
  const h       = HABITATS[GameState.activeHabitat];

  document.getElementById('ui-year').textContent       = GameState.year.toFixed(1);
  document.getElementById('ui-biomass').textContent    = Math.floor(GameState.biomass);
  document.getElementById('ui-biodiversity').textContent = GameState.biodiversity;
  document.getElementById('ui-stability').textContent  = GameState.stability.toFixed(0) + '%';
  document.getElementById('ui-animals').textContent    = animals.length;

  // Stability color
  const stabEl = document.getElementById('ui-stability');
  stabEl.className = 'stat-value ' + (GameState.stability > 60 ? '' : GameState.stability > 30 ? 'yellow' : 'red');

  // Update active tab
  const activeTab = document.querySelector('.tab-content.visible');
  if (activeTab) {
    if (activeTab.id === 'tab-map')    renderMapTab();
    if (activeTab.id === 'tab-skills') renderSkillsTab();
  }
}

/* ── MAP tab ──────────────────────────────────────────────── */
function renderMapTab() {
  // Habitat buttons
  const list = document.getElementById('habitat-list');
  list.innerHTML = '';
  Object.values(HABITATS).forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'habitat-btn' + (h.key === GameState.activeHabitat ? ' active-habitat' : '');
    btn.innerHTML = `
      <canvas class="habitat-swatch" width="16" height="16"></canvas>
      <div class="habitat-info">
        <div class="habitat-name">${h.label}</div>
        <div class="habitat-species">${h.species.map(fmtSpecies).join(', ')}</div>
      </div>`;
    // Draw swatch
    const sw = btn.querySelector('canvas');
    const sc = sw.getContext('2d');
    sc.fillStyle = h.groundColor; sc.fillRect(0, 8, 16, 8);
    sc.fillStyle = h.skyGradBottom; sc.fillRect(0, 0, 16, 8);

    btn.addEventListener('click', () => switchHabitat(h.key));
    list.appendChild(btn);
  });

  // Live stats panel
  const h       = HABITATS[GameState.activeHabitat];
  const animals = ALL_ANIMALS.filter(a => a.habitat === GameState.activeHabitat);
  const plants  = ALL_PLANTS.filter(p => p.habitat === GameState.activeHabitat && p.alive);
  document.getElementById('habitat-stats-panel').innerHTML = `
    Habitat: <span>${h.label}</span><br>
    Animals: <span>${animals.length} / ${MAX_ANIMALS}</span><br>
    Plants:  <span>${plants.length} / ${MAX_PLANTS}</span><br>
    Biomass Rate: <span>${(animals.length * h.biomassMultiplier * (1 + GameState.biomassMultiplierBonus)).toFixed(2)}/s</span><br>
    Stability: <span>${GameState.stability.toFixed(0)}%</span><br>
    Disaster Risk: <span>${(h.disasterRisk * 100).toFixed(0)}%</span>
  `;
}

/* ── SKILLS tab ───────────────────────────────────────────── */
function renderSkillsTab() {
  const list = document.getElementById('skills-list');
  // Only rebuild if something changed (avoid thrashing DOM)
  const stateKey = Object.values(UPGRADES).map(u => `${u.purchased}${GameState.biomass.toFixed(0)}${GameState.geneticStabActive}`).join('|');
  if (list.dataset.stateKey === stateKey) return;
  list.dataset.stateKey = stateKey;

  list.innerHTML = '';
  Object.values(UPGRADES).forEach(u => {
    const canAfford = u.isAbility
      ? GameState.biomass >= u.activationCost
      : GameState.biomass >= u.cost;

    const card = document.createElement('div');
    card.className = 'upgrade-card';

    let btnText  = 'Buy';
    let btnClass = 'upgrade-btn';
    let btnDisabled = '';

    if (u.isAbility) {
      const active = GameState.geneticStabActive && performance.now() < GameState.geneticStabEndsAt;
      btnText  = active ? 'Active…' : `Activate (${u.activationCost}⚡)`;
      btnClass = 'upgrade-btn active-ability';
      if (!canAfford || active) btnDisabled = 'disabled';
    } else if (u.purchased) {
      btnText  = '✓ Owned';
      btnClass = 'upgrade-btn owned';
      btnDisabled = 'disabled';
    } else if (!canAfford) {
      btnDisabled = 'disabled';
    }

    const costLabel = u.isAbility
      ? `${u.activationCost} Biomass per use`
      : u.purchased ? 'Purchased' : `${u.cost} Biomass`;

    const stabBar = u.isAbility ? `
      <div class="cooldown-bar">
        <div class="cooldown-fill" id="stab-fill" style="width:${stabProgress()}%"></div>
      </div>` : '';

    card.innerHTML = `
      <div class="upgrade-header">
        <span class="upgrade-name">${u.label}</span>
        <span class="tree-badge ${u.tree}">${u.tree}</span>
      </div>
      <div class="upgrade-desc">${u.description}</div>
      <div class="upgrade-footer">
        <span class="upgrade-cost">${costLabel}</span>
        <button class="${btnClass}" ${btnDisabled} data-key="${u.key}">${btnText}</button>
      </div>
      ${stabBar}`;

    list.appendChild(card);
  });

  // Wire up buy/activate buttons
  list.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      handleUpgradeClick(key);
    });
  });
}

function stabProgress() {
  if (!GameState.geneticStabActive) return 0;
  const remaining = GameState.geneticStabEndsAt - performance.now();
  return Math.max(0, (remaining / 15000) * 100);
}

function handleUpgradeClick(key) {
  const u = UPGRADES[key];
  if (!u) return;

  if (u.isAbility) {
    if (GameState.biomass < u.activationCost) return;
    if (GameState.geneticStabActive && performance.now() < GameState.geneticStabEndsAt) return;
    GameState.biomass -= u.activationCost;
    GameState.geneticStabActive = true;
    GameState.geneticStabEndsAt = performance.now() + 15000;
    pushLog(`[Y${GameState.year.toFixed(1)}] Genetic Stabilization activated! Animals are protected for 15 seconds.`, 'info');
  } else {
    if (u.purchased || GameState.biomass < u.cost) return;
    GameState.biomass -= u.cost;
    u.purchased = true;
    u.apply(GameState);
    pushLog(`[Y${GameState.year.toFixed(1)}] Upgrade unlocked: ${u.label}.`, 'info');
  }
}

/* ── LOG tab ──────────────────────────────────────────────── */
function pushLog(msg, type = '') {
  GameState.log.unshift({ msg, type });
  if (GameState.log.length > LOG_MAX) GameState.log.length = LOG_MAX;
  renderLogTab();
}

function renderLogTab() {
  const container = document.getElementById('log-container');
  container.innerHTML = '';
  GameState.log.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry' + (entry.type ? ' log-' + entry.type : '');
    div.textContent = entry.msg;
    container.appendChild(div);
  });
}

/* ── Tab switching ────────────────────────────────────────── */
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('#tab-bar button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('visible');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'log') renderLogTab();
  if (tabName === 'map') renderMapTab();
  if (tabName === 'skills') renderSkillsTab();
}

function switchHabitat(key) {
  if (!HABITATS[key]) return;
  GameState.activeHabitat = key;
  initHabitat(key);
  secondAccumulator = 0;
  pushLog(`[Y${GameState.year.toFixed(1)}] Entered ${HABITATS[key].label}.`, 'info');
}

/* ─────────────────────────────────────────────────────────────
   SAVE / LOAD
───────────────────────────────────────────────────────────── */
function buildSave() {
  return JSON.stringify({
    version:   1,
    savedAt:   Date.now(),
    gameState: {
      year:                   GameState.year,
      biomass:                GameState.biomass,
      stability:              GameState.stability,
      activeHabitat:          GameState.activeHabitat,
      biomassMultiplierBonus: GameState.biomassMultiplierBonus,
      hungerDecayModifier:    GameState.hungerDecayModifier,
      plantRespawnModifier:   GameState.plantRespawnModifier,
      nextDisasterYear:       GameState.nextDisasterYear,
      geneticStabActive:      false,  // reset abilities on reload
    },
    upgrades: Object.fromEntries(
      Object.entries(UPGRADES).map(([k, u]) => [k, { purchased: u.purchased }])
    ),
    animals: ALL_ANIMALS.map(a => ({
      id: a.id, species: a.species, habitat: a.habitat,
      x: a.x, y: a.y, hunger: a.hunger,
      hungerDecayRate: a.hungerDecayRate,
    })),
    plants: ALL_PLANTS.map(p => ({
      id: p.id, habitat: p.habitat, x: p.x, y: p.y, energy: p.energy, alive: p.alive,
    })),
    habitatInitialised: Object.keys(habitatInitialised),
    log: GameState.log.slice(0, 30),
  });
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, buildSave());
  } catch(e) {
    console.warn('Pixel Preserve: save failed', e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw);
    if (!save || save.version !== 1) return false;

    // Restore GameState
    Object.assign(GameState, save.gameState);

    // Restore upgrades (purchased flags only; apply effects)
    Object.entries(save.upgrades || {}).forEach(([k, v]) => {
      if (UPGRADES[k] && v.purchased && !UPGRADES[k].isAbility) {
        UPGRADES[k].purchased = true;
        UPGRADES[k].apply(GameState);
      }
    });

    // Restore animals
    ALL_ANIMALS = (save.animals || []).map(a => ({
      ...makeAnimal(a.species, a.habitat, a.x, a.y),
      id:             a.id,
      hunger:         a.hunger,
      hungerDecayRate: a.hungerDecayRate,
    }));

    // Restore plants
    ALL_PLANTS = (save.plants || []).map(p => ({
      ...makePlant(p.habitat, p.x, p.y),
      id:     p.id,
      energy: p.energy,
      alive:  p.alive,
    }));

    // Mark habitats as initialised
    (save.habitatInitialised || []).forEach(k => { habitatInitialised[k] = true; });

    // Restore log
    GameState.log = save.log || [];

    // Offline progression
    const elapsed = Math.min((Date.now() - save.savedAt) / 1000, OFFLINE_CAP_S);
    if (elapsed > 10) {
      const h           = HABITATS[GameState.activeHabitat];
      const liveCount   = ALL_ANIMALS.filter(a => a.habitat === GameState.activeHabitat).length;
      const offlineBio  = liveCount * h.biomassMultiplier * (1 + GameState.biomassMultiplierBonus) * elapsed * OFFLINE_EFFICIENCY;
      GameState.biomass += offlineBio;

      showOfflineModal(elapsed, offlineBio);
    }

    return true;
  } catch(e) {
    console.warn('Pixel Preserve: load failed', e);
    return false;
  }
}

function showOfflineModal(elapsedSeconds, biomassGained) {
  const hours   = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const timeFmt = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  document.getElementById('offline-msg').textContent =
    `Your ecosystem ran for ${timeFmt} while you were away.`;
  document.getElementById('offline-biomass').textContent =
    `+${Math.floor(biomassGained)} Biomass`;
  document.getElementById('offline-modal').classList.add('visible');
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function fmtSpecies(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function preloadSprites() {
  Object.entries(SPRITE_IMAGE_URLS).forEach(([key, url]) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
    SPRITE_IMAGES[key] = img;
  });
}

/* ─────────────────────────────────────────────────────────────
   GAME LOOP
───────────────────────────────────────────────────────────── */
let lastTimestamp = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap at 100ms
  lastTimestamp = timestamp;

  const key = GameState.activeHabitat;
  updatePhysics(dt, key);
  checkInteractions(dt, key);
  tickEconomy(dt, key);
  renderFrame();
  updateUI();

  requestAnimationFrame(gameLoop);
}

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
function setupEventListeners() {
  // Tab bar
  document.querySelectorAll('#tab-bar button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Offline modal OK button
  document.getElementById('offline-ok').addEventListener('click', () => {
    document.getElementById('offline-modal').classList.remove('visible');
  });

  // Autosave
  setInterval(saveGame, SAVE_INTERVAL_MS);

  // Save on tab close / navigate away
  window.addEventListener('beforeunload', saveGame);
}

function startGame() {
  initCanvas();
  preloadSprites();
  setupEventListeners();

  const loaded = loadGame();

  if (!loaded) {
    // Fresh start
    initHabitat(GameState.activeHabitat);
    pushLog(`[Y0.0] Welcome to Pixel Preserve. Your ecosystem begins.`, 'info');
  } else {
    // Ensure current habitat is initialised (may already be from save)
    initHabitat(GameState.activeHabitat);
    renderLogTab();
  }

  renderMapTab();
  renderSkillsTab();

  requestAnimationFrame(ts => {
    lastTimestamp = ts;
    requestAnimationFrame(gameLoop);
  });
}

// Boot
startGame();
