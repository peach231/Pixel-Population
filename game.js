
/* =============================================================
   Pixel Preserve — game.js
   Idle ecosystem simulation. 100% client-side.
   Sprites drawn via canvas fillRect; swap URLs in SPRITE_IMAGE_URLS.
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SPRITE IMAGE SWAP
   Add an image URL here to replace the fillRect sprite.
   Supported: PNG, WebP, GIF. Recommended size: 16×16 px.
   Example: clownfish: 'https://your-cdn.com/sprites/clownfish.png'
───────────────────────────────────────────────────────────── */
const SPRITE_IMAGE_URLS = {
  polar_bear: '', arctic_fox: '', zebra: '',
  lizard: '', desert_fox: '', clownfish: '', sea_turtle: '',
  rat: '', pigeon: '', jaguar: '', toucan: '',
  plant_tundra: '', plant_grassland: '', plant_desert: '',
  plant_coral: '', plant_urban: '', plant_jungle: '',
};
const SPRITE_IMAGES = {};

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const CANVAS_W          = 800;
const CANVAS_H          = 560;
const SPRITE_SCALE      = 2;
const MAX_SPEED         = 55;
const WANDER_STRENGTH   = 90;
const SEEK_STRENGTH     = 180;    // seek-plant force when hungry
const SEEK_THRESHOLD    = 65;     // begin seeking below this hunger
const FRICTION          = 0.84;
const MAX_ANIMALS       = 28;
const MAX_PLANTS        = 40;
const REPRO_RADIUS      = 22;
const EAT_RADIUS        = 22;
const REPRO_CHANCE      = 0.07;   // per second when near same species
const HUNGER_MAX        = 100;
const HUNGER_RESTORE    = 58;
const PLANT_ENERGY_COST = 28;
const SECONDS_PER_YEAR  = 60;
const BASE_DISASTER_GAP = 3;
const OFFLINE_EFFICIENCY= 0.5;
const OFFLINE_CAP_S     = 3600;
const SAVE_INTERVAL_MS  = 30000;
const SAVE_KEY          = 'pixel_preserve_v2';
const LOG_MAX           = 60;

/* ─────────────────────────────────────────────────────────────
   HABITATS — ADD NEW HABITAT: copy a block, give unique key.
   The selection screen and engine pick it up automatically.
───────────────────────────────────────────────────────────── */
const HABITATS = {

  tundra: {
    key: 'tundra', label: 'Tundra',
    desc: 'A frozen expanse where hardy creatures endure the long winter.',
    biomassMultiplier: 0.65, stabilityBase: 88, disasterRisk: 0.30,
    difficulty: 'medium',
    skyGradTop: '#1e2a40', skyGradBottom: '#4a6a88',
    groundColor: '#9ab8cc', groundAccent: '#7a9aae',
    species: ['polar_bear', 'arctic_fox'],
    plantKey: 'plant_tundra', plantRespawnRate: 9,
    initAnimals: 7, initPlants: 10, hungerDecayBase: 1.0,
    aquatic: false,
  },

  grassland: {
    key: 'grassland', label: 'Grassland',
    desc: 'Rolling meadows teeming with grazers and swift predators.',
    biomassMultiplier: 1.0, stabilityBase: 70, disasterRisk: 0.60,
    difficulty: 'easy',
    skyGradTop: '#2a4a80', skyGradBottom: '#6a90b8',
    groundColor: '#5a9438', groundAccent: '#3a7020',
    species: ['bison', 'zebra'],
    plantKey: 'plant_grassland', plantRespawnRate: 5,
    initAnimals: 8, initPlants: 14, hungerDecayBase: 1.3,
    aquatic: false,
  },

  desert: {
    key: 'desert', label: 'Desert',
    desc: 'A merciless landscape of heat and survival against all odds.',
    biomassMultiplier: 0.55, stabilityBase: 50, disasterRisk: 0.90,
    difficulty: 'hard',
    skyGradTop: '#7a4a18', skyGradBottom: '#b07838',
    groundColor: '#c8a050', groundAccent: '#a88030',
    species: ['lizard', 'desert_fox'],
    plantKey: 'plant_desert', plantRespawnRate: 13,
    initAnimals: 6, initPlants: 7, hungerDecayBase: 0.85,
    aquatic: false,
  },

  coral_reef: {
    key: 'coral_reef', label: 'Coral Reef',
    desc: 'A kaleidoscopic underwater world, as fragile as it is vibrant.',
    biomassMultiplier: 0.85, stabilityBase: 65, disasterRisk: 0.55,
    difficulty: 'medium',
    skyGradTop: '#0a1830', skyGradBottom: '#1a4870',
    groundColor: '#c8a870', groundAccent: '#a88850',
    species: ['clownfish', 'sea_turtle'],
    plantKey: 'plant_coral', plantRespawnRate: 7,
    initAnimals: 8, initPlants: 12, hungerDecayBase: 0.95,
    aquatic: true,
  },

  urban_wasteland: {
    key: 'urban_wasteland', label: 'Urban Wasteland',
    desc: 'Concrete ruins reclaimed by scavengers and opportunists.',
    biomassMultiplier: 0.70, stabilityBase: 42, disasterRisk: 0.85,
    difficulty: 'hard',
    skyGradTop: '#282830', skyGradBottom: '#484850',
    groundColor: '#5a5858', groundAccent: '#484545',
    species: ['rat', 'pigeon'],
    plantKey: 'plant_urban', plantRespawnRate: 8,
    initAnimals: 8, initPlants: 10, hungerDecayBase: 1.8,
    aquatic: false,
  },

  jungle: {
    key: 'jungle', label: 'Jungle',
    desc: 'Ancient canopy hides predators and treasures in equal measure.',
    biomassMultiplier: 1.2, stabilityBase: 75, disasterRisk: 0.65,
    difficulty: 'easy',
    skyGradTop: '#0e2010', skyGradBottom: '#1e4820',
    groundColor: '#284818', groundAccent: '#1a3010',
    species: ['jaguar', 'toucan'],
    plantKey: 'plant_jungle', plantRespawnRate: 4,
    initAnimals: 8, initPlants: 16, hungerDecayBase: 1.2,
    aquatic: false,
  },

  /* ADD NEW HABITAT HERE — copy block above, change key + fields */
};

/* ─────────────────────────────────────────────────────────────
   UPGRADE BRANCHES (skill tree structure)
───────────────────────────────────────────────────────────── */
const UPGRADE_BRANCHES = [
  {
    key: 'biomass', label: 'Biomass Production', color: '#6d9e72',
    upgrades: ['nitrogen_cycle', 'carbon_sequestration', 'trophic_cascade'],
  },
  {
    key: 'survival', label: 'Species Survival', color: '#7ca8c2',
    upgrades: ['immune_response', 'genetic_resilience', 'evolutionary_lock'],
  },
  {
    key: 'ecology', label: 'Ecosystem Balance', color: '#c8a050',
    upgrades: ['mycorrhizal_network', 'keystone_species', 'apex_equilibrium'],
  },
];

/* ─────────────────────────────────────────────────────────────
   UPGRADES — ADD NEW UPGRADE: add key here + entry in branch above.
───────────────────────────────────────────────────────────── */
const UPGRADES = {

  /* ── Biomass Branch ─────────────────────────────────────── */
  nitrogen_cycle: {
    key: 'nitrogen_cycle', label: 'Nitrogen Cycle',
    desc: 'Bacterial fixation enriches soil nutrients.',
    cost: 150, requires: null, purchased: false,
    apply(gs) { gs.biomassMultiplierBonus += 0.08; },
  },
  carbon_sequestration: {
    key: 'carbon_sequestration', label: 'Carbon Sequestration',
    desc: 'Organic matter locks atmospheric carbon into the soil.',
    cost: 320, requires: 'nitrogen_cycle', purchased: false,
    apply(gs) { gs.biomassMultiplierBonus += 0.15; },
  },
  trophic_cascade: {
    key: 'trophic_cascade', label: 'Trophic Cascade',
    desc: 'Apex predators reshape the web, doubling plant regrowth.',
    cost: 650, requires: 'carbon_sequestration', purchased: false,
    apply(gs) { gs.biomassMultiplierBonus += 0.25; gs.plantRespawnModifier *= 0.5; },
  },

  /* ── Survival Branch ────────────────────────────────────── */
  immune_response: {
    key: 'immune_response', label: 'Immune Response',
    desc: 'Adaptive immunity shields against environmental stress. Hunger decays 30% slower.',
    cost: 200, requires: null, purchased: false,
    apply(gs) { gs.hungerDecayModifier *= 0.70; },
  },
  genetic_resilience: {
    key: 'genetic_resilience', label: 'Genetic Resilience',
    desc: 'Diverse genomes resist stressors. Hunger decays a further 35% slower.',
    cost: 420, requires: 'immune_response', purchased: false,
    apply(gs) { gs.hungerDecayModifier *= 0.65; },
  },
  evolutionary_lock: {
    key: 'evolutionary_lock', label: 'Evolutionary Lock',
    desc: 'Convergent evolution stabilises species. Unlocks Genetic Stabilization ability.',
    cost: 880, requires: 'genetic_resilience', purchased: false,
    apply(gs) { gs.hungerDecayModifier *= 0.55; gs.stabilizationUnlocked = true; },
  },

  /* ── Ecology Branch ─────────────────────────────────────── */
  mycorrhizal_network: {
    key: 'mycorrhizal_network', label: 'Mycorrhizal Network',
    desc: 'Fungal webs nourish root systems. Plants respawn 40% faster.',
    cost: 260, requires: null, purchased: false,
    apply(gs) { gs.plantRespawnModifier *= 0.60; },
  },
  keystone_species: {
    key: 'keystone_species', label: 'Keystone Species',
    desc: 'A single species upholds structure. Reproduction chance +70%.',
    cost: 520, requires: 'mycorrhizal_network', purchased: false,
    apply(gs) { gs.reproChanceBonus += 0.70; },
  },
  apex_equilibrium: {
    key: 'apex_equilibrium', label: 'Apex Equilibrium',
    desc: 'Perfect trophic balance. Stability recovers 3× faster, disaster risk halved.',
    cost: 1100, requires: 'keystone_species', purchased: false,
    apply(gs) { gs.stabilityRecoveryMult = (gs.stabilityRecoveryMult || 1) * 3; gs.disasterRiskMult *= 0.5; },
  },

  /* ADD NEW UPGRADE HERE */
};

/* Ability (unlocked by evolutionary_lock) */
const GENETIC_STAB = {
  key: 'genetic_stabilization', label: 'Genetic Stabilization',
  desc: 'Active ability: prevents all animal deaths for 15 seconds. Costs 500 Biomass per use.',
  activationCost: 500,
};

/* ─────────────────────────────────────────────────────────────
   DIVINE HAND OBJECTS — per habitat
───────────────────────────────────────────────────────────── */
const DIVINE_OBJECTS = {
  tundra: [
    { key: 'ice_den',         label: 'Ice Den',          cost: 250, desc: 'Shelter from harsh winds. Hunger decay slows.', effect: 'shelter' },
    { key: 'frozen_spring',   label: 'Frozen Spring',    cost: 320, desc: 'Meltwater opens growth pockets. Plants respawn faster.', effect: 'plantBoost' },
    { key: 'aurora_totem',    label: 'Aurora Totem',     cost: 420, desc: 'Celestial pulse strengthens life flow. Biomass gain rises.', effect: 'biomassBoost' },
    { key: 'lichen_garden',   label: 'Lichen Garden',    cost: 360, desc: 'Hardy lichen pads provide dependable food.', effect: 'eatBoost' },
    { key: 'thermal_vent',    label: 'Thermal Vent',     cost: 500, desc: 'Geothermal warmth helps breeding survive the cold.', effect: 'reproBoost' },
  ],
  grassland: [
    { key: 'watering_hole',    label: 'Watering Hole',    cost: 220, desc: 'Reliable water makes feeding more efficient.', effect: 'eatBoost' },
    { key: 'salt_lick',        label: 'Salt Lick',        cost: 300, desc: 'Minerals improve mating success.', effect: 'reproBoost' },
    { key: 'wildflower_patch', label: 'Wildflower Patch', cost: 340, desc: 'Dense blooms increase plant regrowth.', effect: 'plantBoost' },
    { key: 'windbreak_ridge',  label: 'Windbreak Ridge',  cost: 400, desc: 'Natural cover lowers stress and hunger drain.', effect: 'shelter' },
    { key: 'sun_granary',      label: 'Sun Granary',      cost: 520, desc: 'Solar-rich grassland boosts biomass generation.', effect: 'biomassBoost' },
  ],
  desert: [
    { key: 'oasis',          label: 'Oasis',          cost: 300, desc: 'Water and palms improve feeding returns.', effect: 'eatBoost' },
    { key: 'rock_arch',      label: 'Rock Arch',      cost: 260, desc: 'Shade keeps creatures from burning energy.', effect: 'shelter' },
    { key: 'dew_trap',       label: 'Dew Trap',       cost: 360, desc: 'Night condensation supports new plant shoots.', effect: 'plantBoost' },
    { key: 'dune_nursery',   label: 'Dune Nursery',   cost: 420, desc: 'Protected nests increase successful births.', effect: 'reproBoost' },
    { key: 'mirage_obelisk', label: 'Mirage Obelisk', cost: 560, desc: 'Ancient artifact amplifies biomass flow.', effect: 'biomassBoost' },
  ],
  coral_reef: [
    { key: 'sea_cavern',     label: 'Sea Cavern',      cost: 260, desc: 'A refuge from predators and currents.', effect: 'shelter' },
    { key: 'kelp_forest',    label: 'Kelp Forest',     cost: 320, desc: 'Living canopy accelerates marine flora.', effect: 'plantBoost' },
    { key: 'anemone_garden', label: 'Anemone Garden',  cost: 360, desc: 'Nutrient-rich beds improve feeding.', effect: 'eatBoost' },
    { key: 'reef_arch',      label: 'Reef Arch',       cost: 420, desc: 'Calm eddies create ideal spawning grounds.', effect: 'reproBoost' },
    { key: 'tidal_beacon',   label: 'Tidal Beacon',    cost: 540, desc: 'Guides nutrient currents for extra biomass.', effect: 'biomassBoost' },
  ],
  urban_wasteland: [
    { key: 'dumpster',       label: 'Dumpster',        cost: 180, desc: 'Scrap food boosts hunger recovery.', effect: 'eatBoost' },
    { key: 'drain_pipe',     label: 'Drainage Pipe',   cost: 220, desc: 'Underground shelter lowers hunger drain.', effect: 'shelter' },
    { key: 'roof_garden',    label: 'Rooftop Garden',  cost: 360, desc: 'Hidden green plots restore plant life.', effect: 'plantBoost' },
    { key: 'neon_sanctuary', label: 'Neon Sanctuary',  cost: 420, desc: 'Lit nests encourage breeding in ruins.', effect: 'reproBoost' },
    { key: 'recycling_hub',  label: 'Recycling Hub',   cost: 500, desc: 'Circular resource loop improves biomass output.', effect: 'biomassBoost' },
  ],
  jungle: [
    { key: 'ancient_tree',   label: 'Ancient Tree',   cost: 300, desc: 'Towering shelter protects wildlife.', effect: 'shelter' },
    { key: 'river_stream',   label: 'River Stream',   cost: 280, desc: 'Flowing nutrients speed plant regrowth.', effect: 'plantBoost' },
    { key: 'fruit_grove',    label: 'Fruit Grove',    cost: 340, desc: 'Abundant fruit helps animals recover hunger.', effect: 'eatBoost' },
    { key: 'canopy_bridge',  label: 'Canopy Bridge',  cost: 410, desc: 'Connected branches increase breeding contact.', effect: 'reproBoost' },
    { key: 'spirit_shrine',  label: 'Spirit Shrine',  cost: 560, desc: 'Ancient jungle resonance raises biomass yield.', effect: 'biomassBoost' },
  ],
};

/* ─────────────────────────────────────────────────────────────
   GAME STATE (singleton)
───────────────────────────────────────────────────────────── */
const GameState = {
  year: 0,
  biomass: 50,
  biodiversity: 0,
  stability: 70,
  activeHabitat: null,
  biomassMultiplierBonus: 0,
  hungerDecayModifier: 1.0,
  plantRespawnModifier: 1.0,
  reproChanceBonus: 0,
  stabilityRecoveryMult: 1,
  disasterRiskMult: 1.0,
  stabilizationUnlocked: false,
  geneticStabActive: false,
  geneticStabEndsAt: 0,
  nextDisasterYear: 3,
  log: [],
};

/* ─────────────────────────────────────────────────────────────
   LIVE STATE ARRAYS
───────────────────────────────────────────────────────────── */
let ALL_ANIMALS = [];
let ALL_PLANTS  = [];
let ALL_PLACED  = []; // divine hand objects placed on canvas

const plantRespawnTimers = {};
let disasterActive = false;
let disasterEndsAt = 0;
let disasterType   = '';
let uidCounter     = 0;
function uid() { return ++uidCounter; }

/* ─────────────────────────────────────────────────────────────
   GAME PHASE
───────────────────────────────────────────────────────────── */
let gamePhase = 'select'; // 'select' | 'playing'
let placementMode = null; // { objectDef } | null
let selectedHabitatForStart = null;
let draggingDivineObjectKey = null;

/* ─────────────────────────────────────────────────────────────
   SPRITE HELPERS
───────────────────────────────────────────────────────────── */
function drawSpriteOrImage(ctx, key, cx, cy, drawFn, frame) {
  const img = SPRITE_IMAGES[key];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, Math.round(cx - 8), Math.round(cy - 8), 16, 16);
  } else {
    drawFn(ctx, cx, cy, SPRITE_SCALE, frame);
  }
}

function px(ctx, lx, ly, ox, oy, S) {
  ctx.fillRect(Math.round(ox + lx * S), Math.round(oy + ly * S), S, S);
}

/* ─────────────────────────────────────────────────────────────
   SPRITE DRAW FUNCTIONS — one per species
   SPRITE SWAP: add URL to SPRITE_IMAGE_URLS to replace fillRect.
───────────────────────────────────────────────────────────── */

function drawPolarBear(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle = '#e8eeff';
  [[2,0],[3,0],[4,0],[5,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[3,2],[4,2],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  for(let x=0;x<8;x++){px(ctx,x,3,ox,oy,S);px(ctx,x,4,ox,oy,S);}
  [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#223344'; px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  ctx.fillStyle='#ffaacc'; px(ctx,3,3,ox,oy,S);
  ctx.fillStyle='#b0cce0';
  const ly = frame%2===0?0:S;
  [[1,6],[2,6],[5,6],[6,6],[1,7],[2,7],[5,7],[6,7]].forEach(([x,y])=>{ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

function drawArcticFox(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#e0eaf8';
  px(ctx,1,0,ox,oy,S); px(ctx,6,0,ox,oy,S);
  [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  [[1,3],[2,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#223344'; px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  ctx.fillStyle='#ffbbcc'; px(ctx,3,3,ox,oy,S);
  ctx.fillStyle='#90a8b8'; [[6,5],[7,5],[6,6],[7,6]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#e0eaf8';
  const ly=frame%2===0?0:S;
  [[1,6],[2,6],[4,6],[5,6],[1,7],[2,7],[4,7],[5,7]].forEach(([x,y])=>{ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

function drawBison(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#3a1a00'; px(ctx,1,0,ox,oy,S); px(ctx,6,0,ox,oy,S);
  ctx.fillStyle='#6a3a18';
  [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#111'; px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  ctx.fillStyle='#502808';
  for(let x=0;x<8;x++){px(ctx,x,4,ox,oy,S);px(ctx,x,5,ox,oy,S);}
  ctx.fillStyle='#6a3a18';
  const ly=frame%2===0?0:S;
  [[0,6],[1,6],[3,6],[4,6],[0,7],[1,7],[3,7],[4,7]].forEach(([x,y])=>{ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

function drawZebra(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  const Z='#f0f0f0', B='#101010';
  ctx.fillStyle=Z;
  [[2,0],[3,0],[4,0],[5,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle=B; px(ctx,3,0,ox,oy,S); px(ctx,2,1,ox,oy,S); px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S);
  [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5]].forEach(([x,y])=>{
    ctx.fillStyle=(x+y)%2===0?Z:B; px(ctx,x,y,ox,oy,S);
  });
  const ly=frame%2===0?0:S;
  [[0,6],[1,6],[3,6],[4,6],[6,6],[7,6],[0,7],[1,7],[3,7],[4,7],[6,7],[7,7]].forEach(([x,y])=>{
    ctx.fillStyle=y%2===0?B:Z;
    ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);
  });
}

function drawLizard(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#6a8a30';
  [[3,1],[4,1],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#1a2a08'; px(ctx,3,2,ox,oy,S);
  ctx.fillStyle='#b89848'; [[2,3],[3,3],[4,3],[2,4],[3,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#6a8a30'; [[0,5],[1,5],[2,5],[3,5],[4,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  const ly=frame%2===0?0:S;
  [[1,5],[6,5],[0,6],[7,6]].forEach(([x,y])=>{ctx.fillStyle='#6a8a30';ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

function drawDesertFox(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#b89050';
  px(ctx,0,0,ox,oy,S); px(ctx,7,0,ox,oy,S); px(ctx,0,1,ox,oy,S); px(ctx,7,1,ox,oy,S);
  [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  [[1,3],[2,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#281800'; px(ctx,2,2,ox,oy,S); px(ctx,5,2,ox,oy,S); px(ctx,3,3,ox,oy,S);
  ctx.fillStyle='#d8b880'; px(ctx,0,0,ox,oy,S); px(ctx,7,0,ox,oy,S); px(ctx,6,5,ox,oy,S); px(ctx,7,5,ox,oy,S);
  ctx.fillStyle='#b89050';
  const ly=frame%2===0?0:S;
  [[1,6],[2,6],[4,6],[5,6],[1,7],[2,7],[4,7],[5,7]].forEach(([x,y])=>{ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

/* ── Clownfish (orange/white/black) ─────────────────────── */
function drawClownfish(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#d06020';
  [[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#f0f0f0';
  [[3,2],[3,3],[3,4],[3,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  [[6,2],[6,3],[6,4],[6,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#101010';
  [[2,2],[2,3],[2,4],[2,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  [[5,2],[5,3],[5,4],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#222'; px(ctx,1,3,ox,oy,S);
  // Tail fin (animated)
  ctx.fillStyle='#d06020';
  const wag = frame%2===0?-S:S;
  ctx.fillRect(Math.round(ox+0*S),Math.round(oy+2*S+wag),S,S*4);
  // Eye
  ctx.fillStyle='#000'; px(ctx,6,3,ox,oy,S);
  ctx.fillStyle='#fff'; ctx.fillRect(Math.round(ox+6*S+1),Math.round(oy+3*S+1),2,2);
}

/* ── Sea Turtle (green shell + flippers) ────────────────── */
function drawSeaTurtle(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#3a6a30';
  [[2,1],[3,1],[4,1],[5,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Shell pattern
  ctx.fillStyle='#286020';
  [[2,2],[4,2],[3,3],[5,3],[2,4],[4,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Head
  ctx.fillStyle='#50882a'; [[6,2],[7,2],[7,3],[6,3]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#101'; px(ctx,7,2,ox,oy,S);
  // Flippers
  const fy = frame%2===0?0:S;
  ctx.fillStyle='#3a6a30';
  ctx.fillRect(Math.round(ox),Math.round(oy+2*S+fy),S,S);
  ctx.fillRect(Math.round(ox),Math.round(oy+4*S-fy),S,S);
  ctx.fillRect(Math.round(ox+7*S),Math.round(oy+2*S+fy),S,S);
  ctx.fillRect(Math.round(ox+7*S),Math.round(oy+4*S-fy),S,S);
}

/* ── Rat (grey, pointy snout, long tail) ───────────────── */
function drawRat(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#787878';
  // Ears
  px(ctx,5,0,ox,oy,S); px(ctx,6,0,ox,oy,S);
  ctx.fillStyle='#c0a0a0'; px(ctx,5,0,ox,oy,S);
  ctx.fillStyle='#787878';
  [[4,1],[5,1],[6,1],[3,2],[4,2],[5,2],[6,2],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Snout
  ctx.fillStyle='#a07080'; [[6,3],[7,3],[7,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eye
  ctx.fillStyle='#200010'; px(ctx,5,2,ox,oy,S);
  ctx.fillStyle='#e0d0d0'; ctx.fillRect(Math.round(ox+5*S+1),Math.round(oy+2*S+1),1,1);
  // Legs
  const ly=frame%2===0?0:S;
  [[2,6],[3,6],[4,6],[5,6]].forEach(([x,y])=>{ctx.fillStyle='#686868';ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
  // Tail (squiggly)
  ctx.fillStyle='#c0a0a0';
  ctx.fillRect(Math.round(ox),Math.round(oy+5*S),S*2,Math.round(S*0.6));
  ctx.fillRect(Math.round(ox+S),Math.round(oy+4*S+S/2),Math.round(S*0.6),S);
}

/* ── Pigeon (grey/purple, round body) ──────────────────── */
function drawPigeon(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  // Body
  ctx.fillStyle='#888098';
  [[2,2],[3,2],[4,2],[5,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[2,5],[3,5],[4,5],[5,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Head
  ctx.fillStyle='#606878';
  [[4,1],[5,1],[3,2],[6,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Wing sheen
  ctx.fillStyle='#70a888';
  [[3,3],[3,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#8070a0';
  [[4,3],[4,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Beak
  ctx.fillStyle='#c8b060'; px(ctx,6,2,ox,oy,S);
  // Eye
  ctx.fillStyle='#e08020'; px(ctx,5,2,ox,oy,S);
  ctx.fillStyle='#202020'; ctx.fillRect(Math.round(ox+5*S+1),Math.round(oy+2*S+1),2,2);
  // Feet
  const ly=frame%2===0?0:S;
  [[2,6],[3,6],[4,6],[5,6]].forEach(([x,y])=>{ctx.fillStyle='#c0a040';ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

/* ── Jaguar (yellow + black rosettes) ─────────────────── */
function drawJaguar(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  ctx.fillStyle='#d0a030';
  [[2,0],[3,0],[4,0],[5,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  for(let x=0;x<8;x++){px(ctx,x,3,ox,oy,S);px(ctx,x,4,ox,oy,S);}
  [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Rosettes
  ctx.fillStyle='#301800';
  [[2,1],[5,1],[1,3],[4,3],[7,3],[2,4],[5,4],[1,5],[4,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eyes
  ctx.fillStyle='#60d020'; px(ctx,3,1,ox,oy,S); px(ctx,6,1,ox,oy,S);
  ctx.fillStyle='#100'; px(ctx,3,1,ox,oy,S); px(ctx,6,1,ox,oy,S);
  ctx.fillStyle='#60d020'; ctx.fillRect(Math.round(ox+3*S+1),Math.round(oy+S+1),2,2); ctx.fillRect(Math.round(ox+6*S+1),Math.round(oy+S+1),2,2);
  // Legs
  ctx.fillStyle='#d0a030';
  const ly=frame%2===0?0:S;
  [[1,6],[2,6],[5,6],[6,6],[1,7],[2,7],[5,7],[6,7]].forEach(([x,y])=>{ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
  // Tail
  ctx.fillStyle='#d0a030'; ctx.fillRect(Math.round(ox+7*S),Math.round(oy+4*S),S,S*2);
  ctx.fillStyle='#e8e8e8'; ctx.fillRect(Math.round(ox+7*S),Math.round(oy+5*S),S,S);
}

/* ── Toucan (black body, colourful bill) ───────────────── */
function drawToucan(ctx, cx, cy, S, frame) {
  const ox = cx - S*4, oy = cy - S*4;
  // Body
  ctx.fillStyle='#181818';
  [[2,2],[3,2],[4,2],[2,3],[3,3],[4,3],[5,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // White chest
  ctx.fillStyle='#f0f0e0'; [[3,3],[3,4],[4,4]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Head
  ctx.fillStyle='#181818'; [[3,1],[4,1],[5,1],[3,2],[4,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  // Eye
  ctx.fillStyle='#50e050'; px(ctx,5,2,ox,oy,S);
  ctx.fillStyle='#000'; ctx.fillRect(Math.round(ox+5*S+1),Math.round(oy+2*S+1),2,2);
  // Bill (multicolour)
  ctx.fillStyle='#f0c020'; [[6,1],[7,1],[6,2],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#e06020'; [[7,1],[7,2]].forEach(([x,y])=>px(ctx,x,y,ox,oy,S));
  ctx.fillStyle='#40a820'; px(ctx,6,1,ox,oy,S);
  // Feet
  const ly=frame%2===0?0:S;
  [[2,6],[3,6]].forEach(([x,y])=>{ctx.fillStyle='#a05000';ctx.fillRect(Math.round(ox+x*S),Math.round(oy+y*S+ly),S,S);});
}

/* ── Plants per habitat ─────────────────────────────────── */
function drawPlant(ctx, plant, habitat) {
  ctx.globalAlpha = plant.energy > 35 ? 1 : 0.38;
  const {x, y} = plant, S=2, k=habitat.key;

  if (k === 'tundra') {
    ctx.fillStyle='#b0d8f0';
    ctx.fillRect(x-1,y-8,S,8); ctx.fillRect(x+3,y-6,S,6);
    ctx.fillStyle='#88b8d8'; ctx.fillRect(x-3,y-4,S,4);
    ctx.fillStyle='#e0f0ff'; ctx.fillRect(x-2,y-9,S,S); ctx.fillRect(x+2,y-7,S,S);

  } else if (k === 'grassland') {
    ctx.fillStyle='#2a6a10';
    ctx.fillRect(x-3,y-8,2,9); ctx.fillRect(x,y-10,2,11); ctx.fillRect(x+3,y-7,2,8);
    ctx.fillStyle='#4a8820';
    ctx.fillRect(x-3,y-9,1,3); ctx.fillRect(x,y-11,1,3); ctx.fillRect(x+3,y-8,1,3);

  } else if (k === 'desert') {
    ctx.fillStyle='#4a7828';
    ctx.fillRect(x-2,y-12,4,13);
    ctx.fillRect(x-7,y-7,5,3); ctx.fillRect(x+3,y-7,5,3);
    ctx.fillRect(x-7,y-10,3,3); ctx.fillRect(x+4,y-10,3,3);
    ctx.fillStyle='#68a040'; ctx.fillRect(x-1,y-12,2,2);

  } else if (k === 'coral_reef') {
    // Branching coral / anemone
    ctx.fillStyle='#d06090';
    ctx.fillRect(x-1,y-11,2,12);
    ctx.fillStyle='#e070a0';
    ctx.fillRect(x-4,y-8,3,2); ctx.fillRect(x+2,y-7,3,2);
    ctx.fillRect(x-5,y-10,2,2); ctx.fillRect(x+3,y-9,2,2);
    ctx.fillStyle='#f0a0d0';
    ctx.fillRect(x-5,y-12,3,3); ctx.fillRect(x+3,y-12,3,3);
    ctx.fillRect(x,y-14,3,3);

  } else if (k === 'urban_wasteland') {
    // Trash pile / food scraps
    ctx.fillStyle='#606858';
    ctx.fillRect(x-5,y-2,10,4);
    ctx.fillStyle='#888070'; ctx.fillRect(x-4,y-4,8,3);
    ctx.fillStyle='#c0a060'; ctx.fillRect(x-2,y-6,3,3);
    ctx.fillStyle='#908878'; ctx.fillRect(x+2,y-5,3,2);
    ctx.fillStyle='#a06040'; ctx.fillRect(x-3,y-3,2,2);

  } else if (k === 'jungle') {
    // Tropical fern
    ctx.fillStyle='#186010';
    ctx.fillRect(x-1,y-12,2,13);
    ctx.fillStyle='#208018';
    ctx.fillRect(x-6,y-10,5,3); ctx.fillRect(x+2,y-9,5,3);
    ctx.fillRect(x-7,y-7,4,3); ctx.fillRect(x+3,y-6,4,3);
    ctx.fillRect(x-4,y-4,3,3); ctx.fillRect(x+2,y-3,3,3);
    ctx.fillStyle='#30a028';
    ctx.fillRect(x-6,y-11,2,2); ctx.fillRect(x+2,y-10,2,2);
  }

  ctx.globalAlpha = 1;
}

/* ── Divine Hand object draw functions ──────────────────── */
function drawDivineObject(ctx, obj) {
  const {x, y, key} = obj;
  ctx.save();

  if (key === 'ice_den' || key === 'sea_cavern' || key === 'drain_pipe' || key === 'rock_arch') {
    // Cave/shelter: stone arch
    ctx.fillStyle = key === 'ice_den' ? '#8ab8d8' : key === 'sea_cavern' ? '#4878a8' : key === 'drain_pipe' ? '#808080' : '#907848';
    ctx.fillRect(x-18, y-24, 10, 28);
    ctx.fillRect(x+8, y-24, 10, 28);
    ctx.fillRect(x-18, y-28, 36, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x-8, y-20, 16, 24);
    ctx.fillStyle = key === 'ice_den' ? '#c0e8ff' : key === 'sea_cavern' ? '#6098c8' : '#686868';
    ctx.fillRect(x-18, y-28, 36, 6);

  } else if (key === 'watering_hole' || key === 'oasis' || key === 'frozen_spring') {
    // Water feature
    ctx.fillStyle = key === 'oasis' ? '#2888a8' : '#4878b8';
    ctx.beginPath(); ctx.ellipse(x, y-4, 20, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(180,230,255,0.4)';
    ctx.beginPath(); ctx.ellipse(x-4, y-6, 10, 5, 0, 0, Math.PI*2); ctx.fill();
    if (key === 'oasis') {
      // Palm tree
      ctx.fillStyle = '#806020';
      ctx.fillRect(x+12, y-30, 5, 28);
      ctx.fillStyle = '#286010';
      ctx.fillRect(x+2, y-32, 18, 6);
      ctx.fillRect(x+8, y-36, 12, 5);
    }

  } else if (key === 'salt_lick') {
    // White mineral block
    ctx.fillStyle = '#d8d8c8';
    ctx.fillRect(x-12, y-14, 24, 18);
    ctx.fillStyle = '#e8e8dc';
    ctx.fillRect(x-10, y-12, 10, 4);
    ctx.fillStyle = '#b8b8a8';
    ctx.fillRect(x-12, y-14, 24, 4);

  } else if (key === 'dumpster') {
    // Metal dumpster
    ctx.fillStyle = '#406040';
    ctx.fillRect(x-18, y-24, 36, 28);
    ctx.fillStyle = '#304830';
    ctx.fillRect(x-18, y-24, 36, 6);
    ctx.fillStyle = '#506858';
    ctx.fillRect(x-14, y-18, 10, 4); ctx.fillRect(x+4, y-18, 10, 4);
    // Lid
    ctx.fillStyle = '#305030';
    ctx.fillRect(x-20, y-28, 40, 6);

  } else if (key === 'kelp_forest' || key === 'anemone_garden') {
    // Kelp strands
    ctx.fillStyle = key === 'anemone_garden' ? '#a04090' : '#208040';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(x + i*8 - 2, y - 32 + Math.abs(i)*4, 4, 34 - Math.abs(i)*4);
    }
    ctx.fillStyle = key === 'anemone_garden' ? '#e090c8' : '#30b050';
    ctx.fillRect(x-2, y-34, 4, 6);

  } else if (key === 'ancient_tree' || key === 'fruit_grove') {
    // Massive tree
    ctx.fillStyle = '#4a2810';
    ctx.fillRect(x-10, y-50, 20, 54);
    ctx.fillStyle = '#2a6010';
    ctx.beginPath(); ctx.arc(x, y-52, 28, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a4808';
    ctx.beginPath(); ctx.arc(x-8, y-44, 16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = key === 'fruit_grove' ? '#d06030' : '#389020';
    ctx.beginPath(); ctx.arc(x+6, y-58, 14, 0, Math.PI*2); ctx.fill();

  } else if (key === 'river_stream' || key === 'reef_arch') {
    // Flowing river
    ctx.fillStyle = '#3878a8';
    ctx.fillRect(x-40, y-6, 80, 12);
    ctx.fillStyle = 'rgba(180,220,255,0.35)';
    ctx.fillRect(x-38, y-4, 30, 4);
    ctx.fillRect(x+4, y-2, 25, 4);
  } else if (key === 'aurora_totem' || key === 'sun_granary' || key === 'mirage_obelisk' || key === 'tidal_beacon' || key === 'recycling_hub' || key === 'spirit_shrine') {
    ctx.fillStyle = '#6a5ab0';
    ctx.fillRect(x-6, y-34, 12, 38);
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(x-12, y-40, 24, 8);
    ctx.fillStyle = 'rgba(170,210,255,0.25)';
    ctx.fillRect(x-18, y-46, 36, 4);
  } else if (key === 'lichen_garden' || key === 'wildflower_patch' || key === 'dew_trap' || key === 'roof_garden' || key === 'canopy_bridge') {
    ctx.fillStyle = '#2e7c28';
    ctx.fillRect(x-18, y-10, 36, 14);
    ctx.fillStyle = '#4ea846';
    ctx.fillRect(x-14, y-16, 8, 6);
    ctx.fillRect(x-2, y-18, 8, 8);
    ctx.fillRect(x+8, y-14, 8, 6);
  } else if (key === 'thermal_vent' || key === 'dune_nursery' || key === 'neon_sanctuary' || key === 'salt_lick' || key === 'windbreak_ridge') {
    ctx.fillStyle = '#8a7a64';
    ctx.fillRect(x-20, y-16, 40, 20);
    ctx.fillStyle = '#a89a7e';
    ctx.fillRect(x-16, y-20, 32, 6);
  }

  ctx.restore();
}

/* Map species key → draw function */
const SPRITE_RENDERERS = {
  polar_bear: drawPolarBear, arctic_fox: drawArcticFox,
  bison: drawBison,          zebra: drawZebra,
  lizard: drawLizard,        desert_fox: drawDesertFox,
  clownfish: drawClownfish,  sea_turtle: drawSeaTurtle,
  rat: drawRat,              pigeon: drawPigeon,
  jaguar: drawJaguar,        toucan: drawToucan,
  /* ADD NEW SPECIES DRAW FUNCTION HERE */
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
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.55);
  grad.addColorStop(0, habitat.skyGradTop);
  grad.addColorStop(1, habitat.skyGradBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (habitat.aquatic) {
    // Underwater caustic shimmer
    const now = performance.now() / 1000;
    for (let i = 0; i < 12; i++) {
      const wx = (i * 137 + Math.sin(now * 0.4 + i) * 40) % CANVAS_W;
      const wy = 40 + (i * 71) % (CANVAS_H - 80);
      ctx.fillStyle = 'rgba(120,200,255,0.05)';
      ctx.fillRect(wx, wy, 60 + i * 10, 3);
    }
    // Sandy reef floor
    const groundY = Math.floor(CANVAS_H * 0.82);
    ctx.fillStyle = habitat.groundColor;
    ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);
    ctx.fillStyle = habitat.groundAccent;
    ctx.fillRect(0, groundY, CANVAS_W, 5);
  } else {
    const groundY = Math.floor(CANVAS_H * 0.52);
    ctx.fillStyle = habitat.groundColor;
    ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);
    ctx.fillStyle = habitat.groundAccent;
    ctx.fillRect(0, groundY, CANVAS_W, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < CANVAS_W; x += 4) ctx.fillRect(x, groundY + 5, 2, 2);
  }
  drawAmbientScenery(habitat);
}

function drawAmbientScenery(habitat) {
  const seed = habitat.key.length * 17;
  if (habitat.aquatic) {
    for (let i = 0; i < 16; i++) {
      const x = (i * 53 + seed * 7) % CANVAS_W;
      const y = CANVAS_H * 0.68 + ((i * 29) % 90);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(20,70,90,0.24)' : 'rgba(40,95,115,0.2)';
      ctx.fillRect(x, y, 8, 8);
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const x = (i * 47 + seed * 5) % CANVAS_W;
      const y = CANVAS_H * 0.56 + ((i * 19) % 220);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y, 4, 4);
    }
  }
}

function drawPlants(habitatKey) {
  const habitat = HABITATS[habitatKey];
  ALL_PLANTS.filter(p => p.habitat === habitatKey && p.alive).forEach(p => drawPlant(ctx, p, habitat));
}

function drawAnimals(habitatKey) {
  ALL_ANIMALS.filter(a => a.habitat === habitatKey).forEach(a => {
    const fn = SPRITE_RENDERERS[a.species];
    if (fn) drawSpriteOrImage(ctx, a.species, a.x, a.y, fn, a.frame);
  });
}

function drawDivineObjects(habitatKey) {
  ALL_PLACED.filter(o => o.habitat === habitatKey).forEach(o => drawDivineObject(ctx, o));
}

function drawOverlays() {
  const now = performance.now();
  if (GameState.geneticStabActive && now < GameState.geneticStabEndsAt) {
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(now / 250);
    ctx.fillStyle = '#60a860';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
  if (disasterActive && now < disasterEndsAt) {
    const t = (now - (disasterEndsAt - 3000)) / 3000;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.22 * (1 - t));
    ctx.fillStyle = disasterType === 'heatwave' ? '#c05018' : '#6018a8';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
}

function renderFrame() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const h = HABITATS[GameState.activeHabitat];
  drawBackground(h);
  drawDivineObjects(GameState.activeHabitat);
  drawPlants(GameState.activeHabitat);
  drawAnimals(GameState.activeHabitat);
  drawOverlays();
}

/* ─────────────────────────────────────────────────────────────
   FACTORIES
───────────────────────────────────────────────────────────── */
function groundBand(habitat) {
  if (habitat.aquatic) return { minY: 30, maxY: CANVAS_H - 16 };
  const groundY = CANVAS_H * 0.52;
  return { minY: groundY + 8, maxY: CANVAS_H - 12 };
}

function makeAnimal(species, habitatKey, x, y) {
  const h = HABITATS[habitatKey];
  const {minY, maxY} = groundBand(h);
  return {
    id:              uid(),
    species,
    habitat:         habitatKey,
    x:               x ?? (30 + Math.random() * (CANVAS_W - 60)),
    y:               y ?? (minY + Math.random() * (maxY - minY)),
    vx:              (Math.random() - 0.5) * 20,
    vy:              (Math.random() - 0.5) * 10,
    hunger:          65 + Math.random() * 30,
    hungerDecayRate: h.hungerDecayBase,
    age:             0,
    frame:           0,
    frameTimer:      0,
  };
}

function makePlant(habitatKey, x, y) {
  const h = HABITATS[habitatKey];
  const {minY, maxY} = groundBand(h);
  return {
    id:      uid(),
    habitat: habitatKey,
    x:       x ?? (20 + Math.random() * (CANVAS_W - 40)),
    y:       y ?? (minY + Math.random() * (maxY - minY)),
    energy:  80 + Math.random() * 20,
    alive:   true,
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
  for (let i = 0; i < h.initAnimals; i++) {
    ALL_ANIMALS.push(makeAnimal(h.species[i % h.species.length], key));
  }
  for (let i = 0; i < h.initPlants; i++) {
    ALL_PLANTS.push(makePlant(key));
  }
}

/* ─────────────────────────────────────────────────────────────
   PHYSICS — Brownian motion + seek + bounce
───────────────────────────────────────────────────────────── */
function updatePhysics(dt, habitatKey) {
  const h = HABITATS[habitatKey];
  const {minY, maxY} = groundBand(h);
  const habitatPlants = ALL_PLANTS.filter(p => p.habitat === habitatKey && p.alive && p.energy > 0);

  ALL_ANIMALS.forEach(a => {
    if (a.habitat !== habitatKey) return;

    // Brownian wander
    a.vx += (Math.random() - 0.5) * WANDER_STRENGTH * dt;
    a.vy += (Math.random() - 0.5) * WANDER_STRENGTH * (h.aquatic ? 0.9 : 0.3) * dt;

    // Seek nearest plant when hungry
    if (a.hunger < SEEK_THRESHOLD && habitatPlants.length > 0) {
      const hungerFactor = 1 - (a.hunger / SEEK_THRESHOLD);
      let nearestPlant = null, nearestDist2 = Infinity;
      habitatPlants.forEach(p => {
        const dx = p.x - a.x, dy = p.y - a.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < nearestDist2) { nearestDist2 = d2; nearestPlant = p; }
      });
      if (nearestPlant && nearestDist2 > 4) {
        const dist = Math.sqrt(nearestDist2);
        a.vx += (nearestPlant.x - a.x) / dist * SEEK_STRENGTH * hungerFactor * dt;
        a.vy += (nearestPlant.y - a.y) / dist * SEEK_STRENGTH * hungerFactor * dt;
      }
    }

    // Friction + speed cap
    a.vx *= FRICTION; a.vy *= FRICTION;
    const spd2 = a.vx*a.vx + a.vy*a.vy;
    if (spd2 > MAX_SPEED*MAX_SPEED) {
      const inv = MAX_SPEED / Math.sqrt(spd2);
      a.vx *= inv; a.vy *= inv;
    }

    a.x += a.vx * dt; a.y += a.vy * dt;

    // Wall bounce
    if (a.x < 10)           { a.x = 10;           a.vx = Math.abs(a.vx); }
    if (a.x > CANVAS_W - 10){ a.x = CANVAS_W - 10; a.vx = -Math.abs(a.vx); }
    if (a.y < minY)          { a.y = minY;          a.vy = Math.abs(a.vy); }
    if (a.y > maxY)          { a.y = maxY;          a.vy = -Math.abs(a.vy); }

    a.frameTimer += dt;
    if (a.frameTimer > 0.28) { a.frame++; a.frameTimer = 0; }
    a.age += dt;
  });
}

/* ─────────────────────────────────────────────────────────────
   INTERACTIONS — hunger, eating, reproduction
───────────────────────────────────────────────────────────── */
let eatBoostActive   = false;
let reproBoostActive = false;

function checkInteractions(dt, habitatKey) {
  const habitatAnimals = ALL_ANIMALS.filter(a => a.habitat === habitatKey);
  const habitatPlants  = ALL_PLANTS.filter(p => p.habitat === habitatKey && p.alive && p.energy > 0);
  const aliveCount     = habitatAnimals.filter(a => !a._dead).length;
  const toKill  = [];
  const toSpawn = [];
  const eatRestore = eatBoostActive ? HUNGER_RESTORE * 1.45 : HUNGER_RESTORE;
  const reproChance = REPRO_CHANCE * (1 + GameState.reproChanceBonus) * (reproBoostActive ? 1.5 : 1);

  habitatAnimals.forEach(a => {
    if (a._dead) return;

    // Hunger decay
    const decay = a.hungerDecayRate * GameState.hungerDecayModifier * dt;
    a.hunger -= decay;

    if (a.hunger <= 0) {
      if (GameState.geneticStabActive && performance.now() < GameState.geneticStabEndsAt) {
        a.hunger = 1;
      } else {
        toKill.push(a.id);
        return;
      }
    }

    // Eat nearest plant
    let closest = null, closestD2 = EAT_RADIUS * EAT_RADIUS;
    habitatPlants.forEach(p => {
      const dx = p.x - a.x, dy = p.y - a.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < closestD2) { closestD2 = d2; closest = p; }
    });
    if (closest) {
      closest.energy -= PLANT_ENERGY_COST;
      if (closest.energy <= 0) { closest.alive = false; closest.energy = 0; }
      a.hunger = Math.min(HUNGER_MAX, a.hunger + eatRestore);
    }

    // Reproduce with nearby same species
    if (aliveCount < MAX_ANIMALS && Math.random() < reproChance * dt) {
      let mate = null, mateD2 = REPRO_RADIUS * REPRO_RADIUS;
      habitatAnimals.forEach(b => {
        if (b.id === a.id || b._dead || b.species !== a.species) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < mateD2) { mateD2 = d2; mate = b; }
      });
      if (mate) {
        const nx = (a.x + mate.x) / 2 + (Math.random()-0.5)*10;
        const ny = (a.y + mate.y) / 2 + (Math.random()-0.5)*6;
        toSpawn.push(makeAnimal(a.species, habitatKey, nx, ny));
        if (Math.random() < 0.4)
          pushLog(`[Y${GameState.year.toFixed(1)}] A new ${fmtSpecies(a.species)} was born.`, 'birth');
      }
    }
  });

  toKill.forEach(id => {
    const idx = ALL_ANIMALS.findIndex(a => a.id === id);
    if (idx !== -1) {
      pushLog(`[Y${GameState.year.toFixed(1)}] A ${fmtSpecies(ALL_ANIMALS[idx].species)} perished.`, 'disaster');
      ALL_ANIMALS.splice(idx, 1);
      GameState.stability = Math.max(0, GameState.stability - 0.6);
    }
  });
  toSpawn.forEach(a => ALL_ANIMALS.push(a));
}

/* ─────────────────────────────────────────────────────────────
   ECONOMY
───────────────────────────────────────────────────────────── */
let secondAccumulator = 0;

function tickEconomy(dt, habitatKey) {
  const h     = HABITATS[habitatKey];
  const count = ALL_ANIMALS.filter(a => a.habitat === habitatKey).length;

  GameState.biomass += count * h.biomassMultiplier * (1 + GameState.biomassMultiplierBonus) * dt;
  GameState.year    += dt / SECONDS_PER_YEAR;

  const diff = h.stabilityBase - GameState.stability;
  GameState.stability += diff * 0.010 * (GameState.stabilityRecoveryMult || 1) * dt;

  GameState.biodiversity = new Set(ALL_ANIMALS.map(a => a.species)).size;

  secondAccumulator += dt;
  if (secondAccumulator >= 1) {
    secondAccumulator -= 1;
    tickPlantRespawn(habitatKey);
    checkDisasters();
  }
}

function tickPlantRespawn(habitatKey) {
  const h    = HABITATS[habitatKey];
  const rate = h.plantRespawnRate * GameState.plantRespawnModifier;
  plantRespawnTimers[habitatKey] = (plantRespawnTimers[habitatKey] || 0) + 1;

  if (plantRespawnTimers[habitatKey] >= rate) {
    plantRespawnTimers[habitatKey] = 0;
    const dead = ALL_PLANTS.filter(p => p.habitat === habitatKey && !p.alive);
    const all  = ALL_PLANTS.filter(p => p.habitat === habitatKey);
    if (dead.length > 0) {
      const p = dead[Math.floor(Math.random() * dead.length)];
      p.alive = true; p.energy = 80 + Math.random() * 20;
    } else if (all.length < MAX_PLANTS) {
      ALL_PLANTS.push(makePlant(habitatKey));
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   DISASTERS — ADD NEW TYPE: add case in resolveDisaster + types array
───────────────────────────────────────────────────────────── */
function checkDisasters() {
  if (GameState.year >= GameState.nextDisasterYear) {
    const h = HABITATS[GameState.activeHabitat];
    if (Math.random() < h.disasterRisk * GameState.disasterRiskMult) {
      spawnDisaster(GameState.activeHabitat);
    }
    GameState.nextDisasterYear = GameState.year + BASE_DISASTER_GAP + Math.random() * 2.5;
  }
  if (disasterActive && performance.now() >= disasterEndsAt) {
    disasterActive = false;
    ALL_ANIMALS.forEach(a => { a.hungerDecayRate = HABITATS[a.habitat].hungerDecayBase; });
  }
  if (GameState.geneticStabActive && performance.now() >= GameState.geneticStabEndsAt) {
    GameState.geneticStabActive = false;
    pushLog(`[Y${GameState.year.toFixed(1)}] Genetic Stabilization has worn off.`, 'info');
  }
}

function spawnDisaster(habitatKey) {
  const types = ['heatwave', 'plague'];
  resolveDisaster(types[Math.floor(Math.random() * types.length)], habitatKey);
}

function resolveDisaster(type, habitatKey) {
  GameState.stability = Math.max(0, GameState.stability - 14);
  disasterActive = true; disasterType = type;

  if (type === 'heatwave') {
    ALL_ANIMALS.filter(a => a.habitat === habitatKey).forEach(a => { a.hungerDecayRate *= 2.2; });
    disasterEndsAt = performance.now() + 18000;
    pushLog(`[Y${GameState.year.toFixed(1)}] Heatwave strikes the ${HABITATS[habitatKey].label}!`, 'disaster');
  } else if (type === 'plague') {
    disasterEndsAt = performance.now() + 3000;
    const hab = ALL_ANIMALS.filter(a => a.habitat === habitatKey);
    if (!hab.length) return;
    const species = hab[Math.floor(Math.random() * hab.length)].species;
    const victims = ALL_ANIMALS.filter(a => a.habitat === habitatKey && a.species === species);
    const killCount = Math.ceil(victims.length * 0.5);
    for (let i = 0; i < killCount; i++) {
      const idx = ALL_ANIMALS.indexOf(victims[i]);
      if (idx !== -1) ALL_ANIMALS.splice(idx, 1);
    }
    pushLog(`[Y${GameState.year.toFixed(1)}] Plague decimates the ${fmtSpecies(species)} population! ${killCount} lost.`, 'disaster');
  }
  /* ADD NEW DISASTER TYPE HERE */
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

  document.getElementById('ui-year').textContent        = GameState.year.toFixed(1);
  document.getElementById('ui-biomass').textContent     = Math.floor(GameState.biomass);
  document.getElementById('ui-biodiversity').textContent= GameState.biodiversity;
  document.getElementById('ui-animals').textContent     = animals.length;

  const stab = GameState.stability;
  const stabEl = document.getElementById('ui-stability');
  stabEl.textContent = stab.toFixed(0) + '%';
  stabEl.className = 'stat-value ' + (stab > 65 ? 'green' : stab > 35 ? 'gold' : 'red');

  const yearsLeft = GameState.nextDisasterYear - GameState.year;
  const disEl = document.getElementById('ui-disaster');
  disEl.textContent = yearsLeft > 0 ? `~${yearsLeft.toFixed(1)} yr` : 'Imminent';
  disEl.className = 'stat-value ' + (yearsLeft > 1.5 ? '' : 'warn');

  const activeTab = document.querySelector('.tab-content.visible');
  if (!activeTab) return;
  if (activeTab.id === 'tab-map')    renderMapTab();
  if (activeTab.id === 'tab-skills') renderSkillsTab();
  if (activeTab.id === 'tab-divine') renderDivineTab();
}

/* ── MAP tab ─────────────────────────────────────────────── */
function renderMapTab() {
  const h       = HABITATS[GameState.activeHabitat];
  const animals = ALL_ANIMALS.filter(a => a.habitat === GameState.activeHabitat);
  const plants  = ALL_PLANTS.filter(p => p.habitat === GameState.activeHabitat && p.alive);

  document.getElementById('habitat-info-panel').innerHTML = `
    <div class="info-name">${h.label}</div>
    <div class="info-species">${h.species.map(fmtSpecies).join(' · ')}</div>`;

  const rate = (animals.length * h.biomassMultiplier * (1 + GameState.biomassMultiplierBonus)).toFixed(2);
  const yearsLeft = Math.max(0, GameState.nextDisasterYear - GameState.year);
  document.getElementById('habitat-stats-panel').innerHTML = `
    <div class="stat-row"><span class="stat-row-label">Animals</span><span class="stat-row-val blue">${animals.length} / ${MAX_ANIMALS}</span></div>
    <div class="stat-row"><span class="stat-row-label">Plants</span><span class="stat-row-val green">${plants.length} / ${MAX_PLANTS}</span></div>
    <div class="stat-row"><span class="stat-row-label">Biomass Rate</span><span class="stat-row-val gold">${rate} / s</span></div>
    <div class="stat-row"><span class="stat-row-label">Stability</span><span class="stat-row-val ${GameState.stability>65?'green':GameState.stability>35?'gold':'red'}">${GameState.stability.toFixed(0)}%</span></div>
    <div class="stat-row"><span class="stat-row-label">Disaster Risk</span><span class="stat-row-val">${(h.disasterRisk*100).toFixed(0)}%</span></div>
    <div class="stat-row"><span class="stat-row-label">Next Disaster</span><span class="stat-row-val warn">~${yearsLeft.toFixed(2)} yr</span></div>
    <div class="stat-row"><span class="stat-row-label">Total Year</span><span class="stat-row-val blue">${GameState.year.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-row-label">Total Biomass</span><span class="stat-row-val gold">${Math.floor(GameState.biomass)}</span></div>`;
}

/* ── SKILLS tab ──────────────────────────────────────────── */
function renderSkillsTab() {
  const stateKey = Object.values(UPGRADES).map(u => u.purchased).join('') + Math.floor(GameState.biomass / 10) + GameState.stabilizationUnlocked + GameState.geneticStabActive;
  const container = document.getElementById('skill-tree-container');
  if (container.dataset.sk === stateKey) return;
  container.dataset.sk = stateKey;

  container.innerHTML = '';

  UPGRADE_BRANCHES.forEach(branch => {
    const branchEl = document.createElement('div');
    branchEl.className = 'skill-branch';

    const header = document.createElement('div');
    header.className = 'branch-header';
    header.style.setProperty('--branch-color', branch.color);
    header.style.color = branch.color;
    header.style.borderBottomColor = branch.color;
    header.textContent = branch.label;
    branchEl.appendChild(header);

    branch.upgrades.forEach((uKey, idx) => {
      const u = UPGRADES[uKey];
      if (!u) return;

      const reqMet = !u.requires || UPGRADES[u.requires]?.purchased;
      const canAfford = GameState.biomass >= u.cost;

      const node = document.createElement('div');
      node.className = 'skill-node' + (u.purchased ? ' owned' : !reqMet ? ' locked' : '');

      let btnText = u.purchased ? '✓ Owned' : `Buy`;
      let btnExtra = u.purchased ? 'owned' : (!reqMet || !canAfford) ? '' : '';
      let btnDisabled = u.purchased || !reqMet || !canAfford ? 'disabled' : '';

      node.innerHTML = `
        <div class="skill-node-name">${u.label}</div>
        <div class="skill-node-desc">${u.desc}</div>
        <div class="skill-node-footer">
          <span class="skill-node-cost">${u.purchased ? 'Purchased' : u.cost + ' Biomass'}</span>
          <button class="skill-btn ${btnExtra}" ${btnDisabled} data-ukey="${uKey}">${btnText}</button>
        </div>`;

      branchEl.appendChild(node);

      if (idx < branch.upgrades.length - 1) {
        const conn = document.createElement('div');
        conn.className = 'skill-connector';
        conn.style.background = reqMet && UPGRADES[branch.upgrades[idx]]?.purchased ? branch.color : 'var(--border)';
        branchEl.appendChild(conn);
      }
    });

    container.appendChild(branchEl);
  });

  // Wire buttons
  container.querySelectorAll('.skill-btn').forEach(btn => {
    btn.addEventListener('click', () => handleUpgradeClick(btn.dataset.ukey));
  });

  // Ability section
  const abilEl = document.getElementById('ability-container');
  const active = GameState.geneticStabActive && performance.now() < GameState.geneticStabEndsAt;
  const unlocked = GameState.stabilizationUnlocked;
  const canActivate = unlocked && GameState.biomass >= GENETIC_STAB.activationCost && !active;
  const progress = active ? Math.max(0, (GameState.geneticStabEndsAt - performance.now()) / 15000 * 100) : 0;

  abilEl.innerHTML = `
    <div class="ability-card ${unlocked ? '' : 'locked'}">
      <div class="ability-name">${GENETIC_STAB.label}</div>
      <div class="ability-desc">${GENETIC_STAB.desc}</div>
      <div class="ability-footer">
        <span class="ability-cost">${unlocked ? (active ? 'Active…' : GENETIC_STAB.activationCost + ' Biomass') : 'Locked — requires Evolutionary Lock'}</span>
        <button class="ability-btn" ${canActivate ? '' : 'disabled'} id="stab-btn">${active ? 'Active…' : 'Activate'}</button>
      </div>
      <div class="cooldown-bar"><div class="cooldown-fill" style="width:${progress}%"></div></div>
    </div>`;

  const stabBtn = document.getElementById('stab-btn');
  if (stabBtn) stabBtn.addEventListener('click', activateStabilization);
}

function handleUpgradeClick(key) {
  const u = UPGRADES[key];
  if (!u || u.purchased) return;
  if (u.requires && !UPGRADES[u.requires]?.purchased) return;
  if (GameState.biomass < u.cost) return;
  GameState.biomass -= u.cost;
  u.purchased = true;
  u.apply(GameState);
  pushLog(`[Y${GameState.year.toFixed(1)}] Upgrade unlocked: ${u.label}.`, 'info');
}

function activateStabilization() {
  if (!GameState.stabilizationUnlocked) return;
  if (GameState.biomass < GENETIC_STAB.activationCost) return;
  if (GameState.geneticStabActive && performance.now() < GameState.geneticStabEndsAt) return;
  GameState.biomass -= GENETIC_STAB.activationCost;
  GameState.geneticStabActive = true;
  GameState.geneticStabEndsAt = performance.now() + 15000;
  pushLog(`[Y${GameState.year.toFixed(1)}] Genetic Stabilization activated — 15 seconds of protection.`, 'info');
}

/* ── DIVINE HAND tab ─────────────────────────────────────── */
function renderDivineTab() {
  const habitatObjs = DIVINE_OBJECTS[GameState.activeHabitat] || [];
  const list = document.getElementById('divine-list');
  const stateKey = ALL_PLACED.filter(o => o.habitat === GameState.activeHabitat).map(o => o.key).join('|') + Math.floor(GameState.biomass/10);
  if (list.dataset.sk === stateKey) return;
  list.dataset.sk = stateKey;

  list.innerHTML = '';
  habitatObjs.forEach(obj => {
    const placed = ALL_PLACED.some(o => o.key === obj.key && o.habitat === GameState.activeHabitat);
    const canAfford = GameState.biomass >= obj.cost;

    const card = document.createElement('div');
    card.className = 'divine-card';
    card.draggable = !placed && canAfford;
    card.dataset.dkey = obj.key;
    card.innerHTML = `
      <div class="divine-card-name">${obj.label}</div>
      <div class="divine-card-desc">${obj.desc}</div>
      <div class="divine-card-footer">
        <span class="divine-cost">${placed ? 'Placed' : obj.cost + ' Biomass'}</span>
        <button class="divine-btn ${placed ? 'placed' : ''}" ${placed || !canAfford ? 'disabled' : ''} data-dkey="${obj.key}">
          ${placed ? '✓ Placed' : 'Place'}
        </button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.divine-card[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggingDivineObjectKey = card.dataset.dkey;
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', draggingDivineObjectKey);
        e.dataTransfer.effectAllowed = 'copy';
      }
    });
    card.addEventListener('dragend', () => { draggingDivineObjectKey = null; });
  });

  list.querySelectorAll('.divine-btn:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => enterPlacementMode(btn.dataset.dkey));
  });
}

function enterPlacementMode(objectKey) {
  const habitatObjs = DIVINE_OBJECTS[GameState.activeHabitat] || [];
  const objDef = habitatObjs.find(o => o.key === objectKey);
  if (!objDef) return;
  if (GameState.biomass < objDef.cost) return;

  placementMode = { objDef };
  canvas.classList.add('placing');
  document.getElementById('placing-indicator').style.display = 'flex';
  document.getElementById('placing-label').textContent = `Click canvas to place: ${objDef.label}`;
}

function exitPlacementMode() {
  placementMode = null;
  canvas.classList.remove('placing');
  document.getElementById('placing-indicator').style.display = 'none';
}

function canvasCoord(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
    y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
  };
}

function placeObject(objDef, x, y) {
  GameState.biomass -= objDef.cost;
  ALL_PLACED.push({ key: objDef.key, label: objDef.label, habitat: GameState.activeHabitat, x, y, effect: objDef.effect });
  applyDivineEffect(objDef.effect);
  pushLog(`[Y${GameState.year.toFixed(1)}] Placed ${objDef.label} in the ${HABITATS[GameState.activeHabitat].label}.`, 'info');
}

function applyDivineEffect(effect) {
  if (effect === 'shelter')     GameState.hungerDecayModifier *= 0.75;
  if (effect === 'plantBoost')  GameState.plantRespawnModifier *= 0.62;
  if (effect === 'eatBoost')    eatBoostActive = true;
  if (effect === 'reproBoost')  reproBoostActive = true;
  if (effect === 'biomassBoost') GameState.biomassMultiplierBonus += 0.20;
}

/* ── LOG tab ─────────────────────────────────────────────── */
function pushLog(msg, type = '') {
  GameState.log.unshift({ msg, type });
  if (GameState.log.length > LOG_MAX) GameState.log.length = LOG_MAX;
  if (document.querySelector('#tab-log.visible')) renderLogTab();
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

/* ── Tab switching ──────────────────────────────────────── */
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('#tab-bar button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('visible');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  const main = document.getElementById('main');
  if (tabName === 'skills') {
    main.classList.add('skills-open');
  } else {
    main.classList.remove('skills-open');
  }

  if (tabName === 'log')    renderLogTab();
  if (tabName === 'map')    renderMapTab();
  if (tabName === 'skills') renderSkillsTab();
  if (tabName === 'divine') renderDivineTab();
}

/* ─────────────────────────────────────────────────────────────
   HABITAT SELECTION SCREEN
───────────────────────────────────────────────────────────── */
function showSelectionScreen() {
  document.getElementById('habitat-select-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('selected-habitat-label').textContent = 'Selected Habitat: None';
  document.getElementById('start-game-btn').disabled = true;
  buildSelectionGrid();
}

function buildSelectionGrid() {
  const grid = document.getElementById('habitat-select-grid');
  grid.innerHTML = '';

  Object.values(HABITATS).forEach(h => {
    const card = document.createElement('div');
    card.className = 'habitat-card';

    // Mini canvas preview
    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'habitat-card-preview';
    previewCanvas.width = 200; previewCanvas.height = 60;
    const pc = previewCanvas.getContext('2d');
    const grad = pc.createLinearGradient(0, 0, 0, 36);
    grad.addColorStop(0, h.skyGradTop);
    grad.addColorStop(1, h.skyGradBottom);
    pc.fillStyle = grad; pc.fillRect(0, 0, 200, 60);
    pc.fillStyle = h.groundColor; pc.fillRect(0, 36, 200, 24);
    pc.fillStyle = h.groundAccent; pc.fillRect(0, 36, 200, 4);

    const diffLabel = h.difficulty === 'easy' ? 'Gentle' : h.difficulty === 'medium' ? 'Balanced' : 'Demanding';
    const diffClass = h.difficulty === 'easy' ? 'diff-easy' : h.difficulty === 'medium' ? 'diff-medium' : 'diff-hard';

    card.appendChild(previewCanvas);
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
      <div class="habitat-card-name">${h.label}</div>
      <div class="habitat-card-desc">${h.desc}</div>
      <div class="habitat-card-species">${h.species.map(fmtSpecies).join(' · ')}</div>
      <div class="habitat-card-difficulty"><span class="${diffClass}">${diffLabel}</span></div>`;
    card.appendChild(infoDiv);

    card.addEventListener('click', () => selectHabitat(h.key));
    grid.appendChild(card);
  });
}

function selectHabitat(key) {
  selectedHabitatForStart = key;
  document.getElementById('selected-habitat-label').textContent = `Selected Habitat: ${HABITATS[key].label}`;
  document.getElementById('start-game-btn').disabled = false;

  document.querySelectorAll('.habitat-card').forEach((card, idx) => {
    const habitat = Object.values(HABITATS)[idx];
    card.classList.toggle('selected', habitat.key === key);
  });
}

function launchSelectedHabitat() {
  if (!selectedHabitatForStart) return;
  const key = selectedHabitatForStart;
  GameState.activeHabitat = key;
  gamePhase = 'playing';
  document.getElementById('habitat-select-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initHabitat(key);
  pushLog(`[Y0.0] You have entered the ${HABITATS[key].label}. Your stewardship begins.`, 'info');
  renderMapTab();
  renderSkillsTab();
  renderDivineTab();
  renderFrame();
  requestAnimationFrame(ts => { lastTimestamp = ts; requestAnimationFrame(gameLoop); });
}

/* ─────────────────────────────────────────────────────────────
   SAVE / LOAD
───────────────────────────────────────────────────────────── */
function buildSave() {
  return JSON.stringify({
    version:  2,
    savedAt:  Date.now(),
    gameState: {
      year: GameState.year, biomass: GameState.biomass,
      stability: GameState.stability, activeHabitat: GameState.activeHabitat,
      biomassMultiplierBonus: GameState.biomassMultiplierBonus,
      hungerDecayModifier: GameState.hungerDecayModifier,
      plantRespawnModifier: GameState.plantRespawnModifier,
      reproChanceBonus: GameState.reproChanceBonus,
      stabilityRecoveryMult: GameState.stabilityRecoveryMult,
      disasterRiskMult: GameState.disasterRiskMult,
      stabilizationUnlocked: GameState.stabilizationUnlocked,
      geneticStabActive: false,
      nextDisasterYear: GameState.nextDisasterYear,
      log: GameState.log.slice(0, 30),
    },
    upgrades: Object.fromEntries(Object.entries(UPGRADES).map(([k, u]) => [k, { purchased: u.purchased }])),
    animals:  ALL_ANIMALS.map(a => ({ id:a.id, species:a.species, habitat:a.habitat, x:a.x, y:a.y, hunger:a.hunger, hungerDecayRate:a.hungerDecayRate })),
    plants:   ALL_PLANTS.map(p => ({ id:p.id, habitat:p.habitat, x:p.x, y:p.y, energy:p.energy, alive:p.alive })),
    placed:   ALL_PLACED,
    habitatInitialised: Object.keys(habitatInitialised),
    eatBoostActive, reproBoostActive,
  });
}

function saveGame() {
  if (gamePhase !== 'playing') return;
  try { localStorage.setItem(SAVE_KEY, buildSave()); } catch(e) { /* ignore */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw);
    if (!save || save.version !== 2) return false;

    Object.assign(GameState, save.gameState);
    GameState.log = save.gameState.log || [];

    Object.entries(save.upgrades || {}).forEach(([k, v]) => {
      if (UPGRADES[k] && v.purchased) { UPGRADES[k].purchased = true; UPGRADES[k].apply(GameState); }
    });

    ALL_ANIMALS = (save.animals || []).map(a => ({
      ...makeAnimal(a.species, a.habitat, a.x, a.y),
      id: a.id, hunger: a.hunger, hungerDecayRate: a.hungerDecayRate,
    }));
    ALL_PLANTS = (save.plants || []).map(p => ({
      ...makePlant(p.habitat, p.x, p.y), id: p.id, energy: p.energy, alive: p.alive,
    }));
    ALL_PLACED = save.placed || [];
    eatBoostActive   = save.eatBoostActive   || false;
    reproBoostActive = save.reproBoostActive  || false;

    (save.habitatInitialised || []).forEach(k => { habitatInitialised[k] = true; });

    const elapsed = Math.min((Date.now() - save.savedAt) / 1000, OFFLINE_CAP_S);
    if (elapsed > 10) {
      const h = HABITATS[GameState.activeHabitat];
      const liveCount = ALL_ANIMALS.filter(a => a.habitat === GameState.activeHabitat).length;
      const offlineBio = liveCount * h.biomassMultiplier * (1 + GameState.biomassMultiplierBonus) * elapsed * OFFLINE_EFFICIENCY;
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
  const hours = Math.floor(elapsedSeconds / 3600);
  const mins  = Math.floor((elapsedSeconds % 3600) / 60);
  const timeFmt = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  document.getElementById('offline-msg').textContent = `Your ecosystem flourished for ${timeFmt} while you were away.`;
  document.getElementById('offline-biomass').textContent = `+${Math.floor(biomassGained)} Biomass`;
  document.getElementById('offline-modal').classList.add('visible');
}

/* ─────────────────────────────────────────────────────────────
   RESTART
───────────────────────────────────────────────────────────── */
function restartGame() {
  if (!confirm('Restart? All progress will be lost.')) return;
  localStorage.removeItem(SAVE_KEY);

  // Reset all state
  Object.assign(GameState, {
    year: 0, biomass: 50, biodiversity: 0, stability: 70,
    activeHabitat: null, biomassMultiplierBonus: 0,
    hungerDecayModifier: 1.0, plantRespawnModifier: 1.0,
    reproChanceBonus: 0, stabilityRecoveryMult: 1,
    disasterRiskMult: 1.0, stabilizationUnlocked: false,
    geneticStabActive: false, geneticStabEndsAt: 0,
    nextDisasterYear: 3, log: [],
  });
  Object.values(UPGRADES).forEach(u => { u.purchased = false; });
  ALL_ANIMALS = []; ALL_PLANTS = []; ALL_PLACED = [];
  Object.keys(habitatInitialised).forEach(k => delete habitatInitialised[k]);
  Object.keys(plantRespawnTimers).forEach(k => delete plantRespawnTimers[k]);
  eatBoostActive = false; reproBoostActive = false;
  disasterActive = false; secondAccumulator = 0;
  gamePhase = 'select';
  selectedHabitatForStart = null;
  draggingDivineObjectKey = null;

  showSelectionScreen();
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
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
  lastTimestamp = timestamp;

  if (gamePhase !== 'playing') return;

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
  document.querySelectorAll('#tab-bar button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('offline-ok').addEventListener('click', () => {
    document.getElementById('offline-modal').classList.remove('visible');
  });

  document.getElementById('restart-btn').addEventListener('click', restartGame);
  document.getElementById('start-game-btn').addEventListener('click', launchSelectedHabitat);

  document.getElementById('placing-cancel').addEventListener('click', exitPlacementMode);

  canvas.addEventListener('click', e => {
    if (!placementMode) return;
    const {x, y} = canvasCoord(e);
    placeObject(placementMode.objDef, x, y);
    exitPlacementMode();
  });

  canvas.addEventListener('dragover', e => {
    if (!draggingDivineObjectKey) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', e => {
    if (!draggingDivineObjectKey) return;
    e.preventDefault();
    const habitatObjs = DIVINE_OBJECTS[GameState.activeHabitat] || [];
    const objDef = habitatObjs.find(o => o.key === draggingDivineObjectKey);
    if (!objDef) return;
    const alreadyPlaced = ALL_PLACED.some(o => o.habitat === GameState.activeHabitat && o.key === objDef.key);
    if (alreadyPlaced || GameState.biomass < objDef.cost) return;
    const {x, y} = canvasCoord(e);
    placeObject(objDef, x, y);
    draggingDivineObjectKey = null;
  });

  setInterval(saveGame, SAVE_INTERVAL_MS);
  window.addEventListener('beforeunload', saveGame);
}

function startGame() {
  initCanvas();
  preloadSprites();
  setupEventListeners();

  // Show app hidden initially
  document.getElementById('app').classList.add('hidden');

  const loaded = loadGame();

  if (loaded && GameState.activeHabitat) {
    // Resume existing save
    gamePhase = 'playing';
    selectedHabitatForStart = null;
    initHabitat(GameState.activeHabitat);
    document.getElementById('habitat-select-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderMapTab();
    renderSkillsTab();
    renderDivineTab();
    renderLogTab();
    requestAnimationFrame(ts => { lastTimestamp = ts; requestAnimationFrame(gameLoop); });
  } else {
    // Fresh game — show habitat selection
    gamePhase = 'select';
    selectedHabitatForStart = null;
    showSelectionScreen();
  }
}

// Boot
startGame();





