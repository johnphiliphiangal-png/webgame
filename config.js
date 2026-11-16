/* ---------- SETTINGS ---------- */
const SETTINGS = {
  gameTitle: 'Tower Defense',   // placeholder name, change anytime
  cellSize: 32,                 // pixels per square (keep a multiple of 8 for the pixel art)
  cols: 24, rows: 18,           // map size in squares
  startGold: 200, startLives: 20,
  sellRefund: 0.7,              // fraction of total spent you get back when selling
  waveBonusGold: 25, scorePerWave: 100, scorePerRewardGold: 10,
  maxUpgradeTier: 3,
  otherPathLimit: 1,            // Bloons rule: one path may pass this tier only if the other stays at or below it
  sendEarlyBonus: 15,           // gold for sending the next wave while one is running
  sendEarlyCooldown: 5,         // seconds before you can send early again
  autoStartDelay: 2,            // seconds before auto-start launches the next wave
  speedOptions: [1, 2, 3],
  mapSelection: 'random',       // 'random' or a map name
  avoidRepeatMap: true,         // random never gives the same map twice in a row
  restartKeepsMap: true,        // Restart button: same map (true) or a new random one (false)
  leaderboardSize: 50, menuLeaderboardSize: 10,
  storageKey: 'td_scores_v2',
};

/* ---------- LANE AI (how enemies pick a branch at forks) ----------
   Branch cost = length + dangerWeight x (tower damage covering it) + crowdWeight x (recent traffic).
   Enemies mostly take the cheapest branch; randomness makes them sometimes take others. */
const LANE_AI = {
  lengthWeight: 1,
  dangerWeight: 0.05,   // higher = enemies avoid defended lanes more
  crowdWeight: 3,       // higher = enemies spread out over lanes
  randomness: 8,        // higher = less predictable
  crowdDecay: 0.9,      // traffic memory fades by this factor every second
};

/* ---------- PALETTE (pixel art map colors) ---------- */
const PALETTE = {
  grass: ['#5a9e4b', '#4f9142', '#6bb05a'],  
  path:  ['#c49a63', '#b08650', '#7d5a33'],   
  water: ['#3d85c6', '#6fa8dc'],
  leaf:  ['#2f6b2f', '#4a9a4a'],
  trunk: '#6b4423',
  flowers: ['#f2d64b', '#e87aa0'],
  entrances: ['#ff6b6b', '#ffd166', '#4cc9f0'], 
};

/* ---------- TOWERS ----------
   range: squares | damage: per hit | fireRate: shots/sec | cost: gold
   Optional: splash (blast radius, squares) | slow (speed multiplier) + slowTime (sec) | hitsAir (false = ground only) */
const TOWERS = {
  basic:  { name: 'Basic',  color: '#4aa3ff', range: 3,   damage: 10, fireRate: 2,   cost: 50,  bulletSpeed: 400 },
  rapid:  { name: 'Rapid',  color: '#6ee06e', range: 2.5, damage: 4,  fireRate: 7,   cost: 90,  bulletSpeed: 500 },
  heavy:  { name: 'Heavy',  color: '#ff9a3c', range: 4,   damage: 45, fireRate: 0.7, cost: 140, bulletSpeed: 300 },
  frost:  { name: 'Frost',  color: '#7fe7ff', range: 2.8, damage: 3,  fireRate: 1.5, cost: 80,  bulletSpeed: 350, slow: 0.5, slowTime: 2 },
  cannon: { name: 'Cannon', color: '#ff6b9d', range: 3.2, damage: 22, fireRate: 0.9, cost: 120, bulletSpeed: 280, splash: 1.2, hitsAir: false },
};
const TOWER_DEFAULTS = { splash: 0, slow: 0, slowTime: 0, hitsAir: true };
for (const k in TOWERS) TOWERS[k] = { ...TOWER_DEFAULTS, ...TOWERS[k] };

/* ---------- UPGRADES (two paths per tower, costMult x tower cost per tier) ---------- */
const UPGRADES = [
  { name: 'Power', desc: '+40% damage (stronger slow / bigger blast)', costMult: [0.7, 1.1, 1.8], damageMult: 1.4, slowAdd: -0.08, splashAdd: 0.2 },
  { name: 'Range & Speed', desc: '+0.4 range, +25% fire rate', costMult: [0.6, 1.0, 1.6], rangeAdd: 0.4, fireRateMult: 1.25 },
];

/* ---------- ENEMIES ----------
   size: fraction of a square | speed: pixels/sec | reward: gold
   laneSense: how much it avoids defended lanes (0 = ignores towers, 1 = normal)
   flying + shortcutRange: flyers follow the lanes but may cut across bends within this many squares */
const ENEMIES = {
  grunt: { name: 'Grunt', color: '#e05555', health: 40,  speed: 60,  size: 0.5,  reward: 8,  damageToBase: 1, laneSense: 1 },
  fast:  { name: 'Fast',  color: '#f2d64b', health: 25,  speed: 120, size: 0.38, reward: 10, damageToBase: 1, laneSense: 0.3 },
  tank:  { name: 'Tank',  color: '#a56bd6', health: 220, speed: 35,  size: 0.7,  reward: 25, damageToBase: 3, laneSense: 0.6 },
  flyer: { name: 'Flyer', color: '#ffffff', health: 30,  speed: 80,  size: 0.4,  reward: 12, damageToBase: 2, laneSense: 1, flying: true, shortcutRange: 3 },
};

/* ---------- WAVES ---------- */
const WAVES = [
  [ { type: 'grunt', count: 8,  gap: 0.9 } ],
  [ { type: 'grunt', count: 12, gap: 0.7 } ],
  [ { type: 'grunt', count: 8,  gap: 0.7 }, { type: 'fast', count: 8, gap: 0.5 } ],
  [ { type: 'fast',  count: 12, gap: 0.4 }, { type: 'flyer', count: 5, gap: 0.8 }, { type: 'tank', count: 2, gap: 2 } ],
  [ { type: 'tank',  count: 5,  gap: 1.8 }, { type: 'grunt', count: 15, gap: 0.5 } ],
  [ { type: 'tank',  count: 6,  gap: 1.4 }, { type: 'flyer', count: 10, gap: 0.5 }, { type: 'fast', count: 15, gap: 0.3 } ],
];
const ENDLESS = { growth: 1.12, rewardGrowth: 0.05 };   // per wave after the hand-made ones
function endlessWave(k) {
  return [
    { type: 'grunt', count: 10 + k * 2, gap: 0.45 }, { type: 'fast', count: 6 + k * 2, gap: 0.35 },
    { type: 'tank',  count: 2 + k,      gap: 1.2 },  { type: 'flyer', count: 4 + k * 2, gap: 0.6 },
  ];
}
const waveGroups = n => n < WAVES.length ? WAVES[n] : endlessWave(n - WAVES.length + 1);

/* ---------- MAPS ----------
   routes: lists of [column, row] corner points. Routes that start at the same point share an entrance
   (keep to 3 entrances), and routes that share squares create forks. All routes must end on the same exit.*/
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

/* ---------- PLACEHOLDER DRAWING ----------
   Towers and enemies are squares for now. Replace these two functions to use sprites later */
function drawTowerPlaceholder(ctx, key, def, x, y, s) {
  ctx.fillStyle = def.color;
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
}
function drawEnemyPlaceholder(ctx, type, def, cx, cy, size) {
  ctx.fillStyle = def.color;
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  if (def.flying) { ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(cx - size / 2, cy - size / 2, size, size); ctx.lineWidth = 1; }
}
