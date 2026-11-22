/* ---------- SETTINGS ---------- */
// Game rules. Change the numbers. mapSelection is 'random' or one of the map names in MAPS.
// cellSize is pixels per square (keep it a multiple of 8). cols and rows are the map size in squares.
// sellRefund is the fraction of gold you get back. speedOptions are the speed button choices.
const SETTINGS = {
  gameTitle: 'Tower Defense',
  cellSize: 32,
  cols: 24, rows: 18,
  startGold: 200, startLives: 20,
  sellRefund: 0.7,
  waveBonusGold: 25, scorePerWave: 100, scorePerRewardGold: 10,
  maxUpgradeTier: 3,
  otherPathLimit: 1,
  sendEarlyBonus: 15,
  sendEarlyCooldown: 5,
  autoStartDelay: 2,
  speedOptions: [1, 2, 3],
  mapSelection: 'random',
  avoidRepeatMap: true,
  restartKeepsMap: false,
  leaderboardSize: 50, menuLeaderboardSize: 10,
  storageKey: 'td_scores_v2',
};

/* ---------- LANE AI ---------- */
// How enemies choose a branch at forks. Higher dangerWeight = they avoid defended lanes,
// crowdWeight = they spread out, randomness = less predictable.
const LANE_AI = {
  lengthWeight: 1,
  dangerWeight: 0.05,
  crowdWeight: 3,
  randomness: 8,
  crowdDecay: 0.9,
};

/* ---------- PALETTE ---------- */
// Map colors as hex codes. Each list is a base color followed by its variations.
const PALETTE = {
  grass: ['#5a9e4b', '#4f9142', '#6bb05a'],  
  path:  ['#c49a63', '#b08650', '#7d5a33'],   
  water: ['#3d85c6', '#6fa8dc'],
  leaf:  ['#2f6b2f', '#4a9a4a'],
  trunk: '#6b4423',
  flowers: ['#f2d64b', '#e87aa0'],
  entrances: ['#ff6b6b', '#ffd166', '#4cc9f0'], 
};

/* ---------- TOWERS ---------- */
// One line per tower. range is in squares, damage is per hit, fireRate is shots per second, cost is gold.
// Optional: splash (blast radius), slow with slowTime (seconds), hitsAir: false for ground only.
// To add a tower, copy a line, give it a new key, then give it a sprite in SPRITES.
const TOWERS = {
  basic:  { name: 'Basic',  color: '#4aa3ff', range: 3,   damage: 10, fireRate: 2,   cost: 50,  bulletSpeed: 400 },
  rapid:  { name: 'Rapid',  color: '#6ee06e', range: 2.5, damage: 4,  fireRate: 7,   cost: 90,  bulletSpeed: 500 },
  heavy:  { name: 'Heavy',  color: '#ff9a3c', range: 4,   damage: 45, fireRate: 0.7, cost: 140, bulletSpeed: 300 },
  frost:  { name: 'Frost',  color: '#7fe7ff', range: 2.8, damage: 3,  fireRate: 1.5, cost: 80,  bulletSpeed: 350, slow: 0.5, slowTime: 2 },
  cannon: { name: 'Cannon', color: '#ff6b9d', range: 3.2, damage: 22, fireRate: 0.9, cost: 120, bulletSpeed: 280, splash: 1.2, hitsAir: false },
};
const TOWER_DEFAULTS = { splash: 0, slow: 0, slowTime: 0, hitsAir: true };
for (const k in TOWERS) TOWERS[k] = { ...TOWER_DEFAULTS, ...TOWERS[k] };

/* ---------- UPGRADES ---------- */
// Two upgrade paths shared by every tower. costMult is multiplied by the tower's cost for tiers 1 to 3.
// The other numbers are the bonus each tier gives (damageMult, rangeAdd, fireRateMult, slowAdd, splashAdd).
const UPGRADES = [
  { name: 'Power', desc: '+40% damage (stronger slow / bigger blast)', costMult: [0.7, 1.1, 1.8], damageMult: 1.4, slowAdd: -0.08, splashAdd: 0.2 },
  { name: 'Range & Speed', desc: '+0.4 range, +25% fire rate', costMult: [0.6, 1.0, 1.6], rangeAdd: 0.4, fireRateMult: 1.25 },
];

/* ---------- ENEMIES ---------- */
// size is a fraction of a square and is also how big its sprite is drawn. speed is pixels per second.
// reward is gold, damageToBase is lives lost. laneSense: 0 ignores towers when choosing lanes, 1 is normal.
// Optional: flying: true, boss: true (boss warning sound), splitInto: { type, count } (bursts into smaller enemies).
const ENEMIES = {
  grunt: { name: 'Grunt', color: '#e05555', health: 40,  speed: 60,  size: 0.5,  reward: 8,  damageToBase: 1, laneSense: 1 },
  fast:  { name: 'Fast',  color: '#f2d64b', health: 25,  speed: 120, size: 0.5,  reward: 10, damageToBase: 1, laneSense: 0.3 },
  tank:  { name: 'Tank',  color: '#a56bd6', health: 220, speed: 35,  size: 1,    reward: 25, damageToBase: 3, laneSense: 0.6 },
  flyer: { name: 'Flyer', color: '#ffffff', health: 30,  speed: 80,  size: 1,      reward: 12, damageToBase: 2, laneSense: 1, flying: true, shortcutRange: 3 },
  boss:  { name: 'Boss',  color: '#8e1b3a', health: 1500, speed: 30, size: 1.5,  reward: 120, damageToBase: 10, laneSense: 0.2, boss: true, splitInto: { type: 'grunt', count: 6 } },
};

/* ---------- WAVES ---------- */
// Each wave is a list of groups: type, count, and gap (seconds between spawns).
// After the last wave above, endlessWave() builds the waves. Edit it to change scaling or how often bosses appear.
// ENDLESS sets how fast enemy health and rewards grow in those waves.
const WAVES = [
  [ { type: 'grunt', count: 8,  gap: 0.9 } ],
  [ { type: 'grunt', count: 12, gap: 0.7 } ],
  [ { type: 'grunt', count: 8,  gap: 0.7 }, { type: 'fast', count: 8, gap: 0.5 } ],
  [ { type: 'fast',  count: 12, gap: 0.4 }, { type: 'flyer', count: 5, gap: 0.8 }, { type: 'tank', count: 2, gap: 2 } ],
  [ { type: 'tank',  count: 5,  gap: 1.8 }, { type: 'grunt', count: 15, gap: 0.5 }, { type: 'boss', count: 1, gap: 1 } ],
  [ { type: 'tank',  count: 6,  gap: 1.4 }, { type: 'flyer', count: 10, gap: 0.5 }, { type: 'fast', count: 15, gap: 0.3 } ],
];
const ENDLESS = { growth: 1.12, rewardGrowth: 0.05 };
function endlessWave(k) {
  const w = [
    { type: 'grunt', count: 10 + k * 2, gap: 0.45 }, { type: 'fast', count: 6 + k * 2, gap: 0.35 },
    { type: 'tank',  count: 2 + k,      gap: 1.2 },  { type: 'flyer', count: 4 + k * 2, gap: 0.6 },
  ];
  if (k % 3 === 0) w.push({ type: 'boss', count: k / 3, gap: 4 });
  return w;
}
const waveGroups = n => n < WAVES.length ? WAVES[n] : endlessWave(n - WAVES.length + 1);

/* ---------- MAPS ---------- */
// routes are lists of [column, row] corner points. Routes that start at the same point share an entrance (use at most 3).
// Routes that share squares make forks, and every route must end on the same exit square.
// water is a list of [column1, row1, column2, row2] rectangles. seed changes the grass and tree layout.
const ZIGZAG = [
  [[0,2],[8,2],[8,5],[15,5],[15,2],[21,2],[21,9],[23,9]],
  [[0,2],[8,2],[8,5],[15,5],[15,7],[21,7],[21,9],[23,9]],
  [[0,9],[6,9],[6,12],[13,12],[13,9],[23,9]],
  [[0,9],[6,9],[9,9],[9,7],[13,7],[13,9],[23,9]],
  [[0,15],[10,15],[10,17],[18,17],[18,14],[21,14],[21,9],[23,9]],
  [[0,15],[10,15],[16,15],[16,12],[21,12],[21,9],[23,9]],
];
const MAPS = [
  { name: 'Zigzag lanes', seed: 3, water: [[1,4,4,7],[1,12,4,14],[22,3,23,6]], routes: ZIGZAG },
  { name: 'Staircase', seed: 5, water: [[0,3,2,6],[21,2,23,6],[0,11,2,14],[22,12,23,15],[14,13,18,15]], routes: [
    [[0,1],[4,1],[4,3],[8,3],[8,5],[12,5],[12,7],[16,7],[16,9],[23,9]],
    [[0,1],[4,1],[20,1],[20,9],[23,9]],
    [[0,9],[6,9],[6,7],[9,7],[9,9],[23,9]],
    [[0,9],[6,9],[6,7],[16,7],[16,9],[23,9]],
    [[0,16],[4,16],[4,14],[8,14],[8,12],[12,12],[12,11],[17,11],[17,9],[23,9]],
    [[0,16],[20,16],[20,9],[23,9]] ] },
  { name: 'Maze meadow', seed: 9, water: [[1,4,4,7],[1,12,4,14],[22,3,23,6]], routes: ZIGZAG.concat([
    [[0,2],[8,2],[8,5],[8,7],[13,7],[13,9],[23,9]],
    [[0,15],[10,15],[10,12],[13,12],[13,9],[23,9]] ]) },
];

/* ---------- AUDIO ---------- */
// Volumes go from 0 to 1. The music and sounds are made by audio.js.
const AUDIO = {
  musicVolume: 0.25, sfxVolume: 0.5,
  storageKey: 'td_audio_v1',
};

/* ---------- SPRITES ---------- */
// Put images in the sprites/ folder and write the file name here. null keeps the colored square.
// Towers fill one square. Enemies are drawn at their size from ENEMIES. Sprites keep their proportions.
// For an animation, use { file: 'grunt.png', frames: 4, fps: 8 } with a horizontal strip of equal frames.
// other.base is your home base, drawn on the exit square. other.portal1 to portal3 are the enemy entrances (animated).
const SPRITES = {
  folder: 'sprites/',
  towers:  { basic: 'basic.png', rapid: 'rapid.png', heavy: 'heavy.png', frost: 'frost.png', cannon: 'cannon.png' },
  enemies: { grunt: 'grunt.png', fast: 'fast.png', tank: 'tank.png', flyer: 'flyer.png', boss: 'boss.png' },
  other:   { base: 'base.png', portal1: { file: 'portal1.png', frames: 4, fps: 6 }, portal2: { file: 'portal2.png', frames: 4, fps: 6 }, portal3: { file: 'portal3.png', frames: 4, fps: 6 } },
};

const spriteCache = {};
function loadSprites() {
  for (const kind of ['towers', 'enemies', 'other']) for (const name in SPRITES[kind]) {
    let v = SPRITES[kind][name]; if (!v) continue;
    if (typeof v === 'string') v = { file: v };
    const s = { img: new Image(), ok: false, frames: v.frames || 1, fps: v.fps || 8 };
    s.img.onload = () => { s.ok = true; if (typeof spriteLoaded === 'function') spriteLoaded(); };
    s.img.onerror = () => console.warn('Sprite not found: ' + SPRITES.folder + v.file + ' (using placeholder)');
    s.img.src = SPRITES.folder + v.file;
    spriteCache[kind + '/' + name] = s;
  }
}
loadSprites();

function drawSprite(ctx, kind, name, x, y, w, h) {
  const s = spriteCache[kind + '/' + name]; if (!s || !s.ok) return false;
  const fw = s.img.width / s.frames, fh = s.img.height, frame = s.frames > 1 ? Math.floor(performance.now() / 1000 * s.fps) % s.frames : 0;
  const k = Math.min(w / fw, h / fh), dw = fw * k, dh = fh * k;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, frame * fw, 0, fw, fh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

function spriteIcon(kind, name, px) {
  const s = spriteCache[kind + '/' + name]; if (!s || !s.ok) return null;
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = cv.height = px;
  g.imageSmoothingEnabled = false;
  const fw = s.img.width / s.frames, k = Math.min(px / fw, px / s.img.height), dw = fw * k, dh = s.img.height * k;
  g.drawImage(s.img, 0, 0, fw, s.img.height, (px - dw) / 2, (px - dh) / 2, dw, dh);
  return cv;
}
function spriteAspect(kind, name) {
  const s = spriteCache[kind + '/' + name]; return s && s.ok ? s.img.height / (s.img.width / s.frames) : 1;
}

/* ---------- DRAWING ---------- */
function drawTower(ctx, key, def, x, y, s) {
  if (!drawSprite(ctx, 'towers', key, x, y, s, s)) drawTowerPlaceholder(ctx, key, def, x, y, s);
}
function drawEnemy(ctx, type, def, cx, cy, size) {
  if (!drawSprite(ctx, 'enemies', type, cx - size / 2, cy - size / 2, size, size)) drawEnemyPlaceholder(ctx, type, def, cx, cy, size);
}

/* Placeholders */
function drawTowerPlaceholder(ctx, key, def, x, y, s) {
  ctx.fillStyle = def.color;
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
}
function drawEnemyPlaceholder(ctx, type, def, cx, cy, size) {
  ctx.fillStyle = def.color;
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  if (def.flying) { ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(cx - size / 2, cy - size / 2, size, size); ctx.lineWidth = 1; }
}
