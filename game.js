const $ = id => document.getElementById(id);
const S = SETTINGS.cellSize, P = S / 8, COLS = SETTINGS.cols, ROWS = SETTINGS.rows;
document.documentElement.style.setProperty('--game-width', COLS * S + 'px');
document.documentElement.style.setProperty('--game-height', ROWS * S + 'px');
const canvas = $('canvas'), ctx = canvas.getContext('2d');
canvas.width = COLS * S; canvas.height = ROWS * S;
document.title = SETTINGS.gameTitle; $('title').textContent = SETTINGS.gameTitle;

const key = (c, r) => c + ',' + r;
const parse = k => k.split(',').map(Number);
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const setMessage = t => setText($('message'), t);
const hash = (c, r, k, sd) => { const x = Math.sin(c * 127.1 + r * 311.7 + k * 74.7 + sd * 13.3) * 43758.5453; return x - Math.floor(x); };
const center = k => { const [c, r] = parse(k); return [c * S + S / 2, r * S + S / 2]; };

let map, state, plans = {}, danger = new Map(), load = new Map(), laneDirty = true;
let inGame = false, autoOn = false, lastMapName = null, memScores = [];

/* ---------- Leaderboard (saved in this browser with localStorage) ---------- */
const loadScores = () => { try { return JSON.parse(localStorage.getItem(SETTINGS.storageKey)) || []; } catch (e) { return memScores; } };
function addScore(name, score, wave, mapName) {
  const list = loadScores(); list.push({ name, score, wave, map: mapName });
  list.sort((a, b) => b.score - a.score);
  memScores = list.slice(0, SETTINGS.leaderboardSize);
  try { localStorage.setItem(SETTINGS.storageKey, JSON.stringify(memScores)); } catch (e) {}
  renderBoards();
}
function fillBoard(id, limit) {
  const body = $(id); body.innerHTML = '';
  const list = loadScores().slice(0, limit);
  if (!list.length) { const td = body.insertRow().insertCell(); td.colSpan = 5; td.textContent = 'No scores yet.'; }
  list.forEach((s, i) => { const tr = body.insertRow(); [i + 1, s.name, s.wave, s.score, s.map || '-'].forEach(v => { tr.insertCell().textContent = v; }); });
}
const renderBoards = () => { fillBoard('menuBody', SETTINGS.menuLeaderboardSize); fillBoard('boardBody', SETTINGS.leaderboardSize); };

/* ---------- Map: route network, blocked squares and pixel art ---------- */
function buildMap(def) {
  const cells = new Set(), out = new Map(), entries = []; let exit;
  for (const rt of def.routes) {
    const seq = [];
    for (let i = 0; i < rt.length - 1; i++) {
      let [c, r] = rt[i]; const [c2, r2] = rt[i + 1], dc = Math.sign(c2 - c), dr = Math.sign(r2 - r);
      if (i === 0) seq.push(key(c, r));
      while (c !== c2 || r !== r2) { c += dc; r += dr; seq.push(key(c, r)); }
    }
    seq.forEach(k => cells.add(k));
    if (!entries.includes(seq[0])) entries.push(seq[0]);
    for (let i = 0; i < seq.length - 1; i++) { if (!out.has(seq[i])) out.set(seq[i], new Set()); out.get(seq[i]).add(seq[i + 1]); }
    exit = seq[seq.length - 1];
  }
  for (const [k, v] of out) out.set(k, [...v]);
  const rev = new Map();
  for (const [k, ns] of out) ns.forEach(n => { if (!rev.has(n)) rev.set(n, []); rev.get(n).push(k); });
  const hops = new Map([[exit, 0]]), queue = [exit];
  while (queue.length) { const k = queue.shift(); (rev.get(k) || []).forEach(p => { if (!hops.has(p)) { hops.set(p, hops.get(k) + 1); queue.push(p); } }); }
  entries.sort((a, b) => parse(a)[1] - parse(b)[1]);
  const m = { def, cells, out, entries, exit, hops, blocked: new Set(cells) };
  m.bg = bakeMap(m);
  return m;
}
function bakeMap(m) {
  const bg = document.createElement('canvas'); bg.width = COLS * S; bg.height = ROWS * S;
  const g = bg.getContext('2d'), def = m.def, C = PALETTE;
  const isW = (c, r) => def.water.some(a => c >= a[0] && c <= a[2] && r >= a[1] && r <= a[3]);
  const isP = (c, r) => m.cells.has(key(c, r));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const h = k => hash(c, r, k, def.seed);
    const p = (x, y, col, w = 1, hh = 1) => { g.fillStyle = col; g.fillRect(c * S + x * P, r * S + y * P, w * P, hh * P); };
    const spk = (col, n) => { for (let k = 0; k < n; k++) p(Math.floor(h(k + 5) * 8), Math.floor(h(k + 9) * 8), col); };
    const grass = () => { p(0, 0, C.grass[0], 8, 8); spk(C.grass[1], 5); spk(C.grass[2], 3); };
    if (isP(c, r)) {
      p(0, 0, C.path[0], 8, 8); spk(C.path[1], 6);
      if (!isP(c, r - 1)) p(0, 0, C.path[2], 8, 1); if (!isP(c, r + 1)) p(0, 7, C.path[2], 8, 1);
      if (!isP(c - 1, r)) p(0, 0, C.path[2], 1, 8); if (!isP(c + 1, r)) p(7, 0, C.path[2], 1, 8);
    } else if (isW(c, r)) {
      m.blocked.add(key(c, r)); p(0, 0, C.water[0], 8, 8);
      for (let k = 0; k < 3; k++) p(Math.floor(h(k + 20) * 6), Math.floor(h(k + 30) * 8), C.water[1], 2, 1);
    } else {
      grass(); const v = h(1);
      if (v < .08) { m.blocked.add(key(c, r)); p(3, 5, C.trunk, 2, 3); p(2, 1, C.leaf[0], 4, 1); p(1, 2, C.leaf[0], 6, 3); p(2, 5, C.leaf[0], 4, 1); p(2, 2, C.leaf[1], 2, 1); p(5, 3, C.leaf[1]); }
      else if (v < .18) { p(Math.floor(h(2) * 6) + 1, Math.floor(h(3) * 6) + 1, C.flowers[0]); p(Math.floor(h(4) * 6) + 1, Math.floor(h(6) * 6) + 1, C.flowers[1]); }
    }
  }
  m.entries.forEach((k, i) => {   // entrance and exit markers
    const [x, y] = center(k); g.fillStyle = C.entrances[i % 3]; g.strokeStyle = '#222'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#222'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, x, y + 1);
  });
  const [ex, ey] = center(m.exit);
  g.fillStyle = '#fff'; g.strokeStyle = '#222'; g.fillRect(ex - 12, ey - 12, 24, 24); g.strokeRect(ex - 12, ey - 12, 24, 24);
  g.fillStyle = '#222'; g.font = 'bold 10px sans-serif'; g.fillText('EXIT', ex, ey + 1);
  return bg;
}
function pickMap() {
  if (SETTINGS.mapSelection !== 'random') { const f = MAPS.find(m => m.name === SETTINGS.mapSelection); if (f) return f; }
  const pool = SETTINGS.avoidRepeatMap && MAPS.length > 1 ? MAPS.filter(m => m.name !== lastMapName) : MAPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------- Lane AI: enemies choose a branch at each fork ---------- */
const laneCost = (k, type) => LANE_AI.lengthWeight + LANE_AI.dangerWeight * (ENEMIES[type].laneSense ?? 1) * (danger.get(k) || 0);
function recomputeLanes() {
  danger = new Map();
  const tw = state.towers.map(t => ({ x: t.c * S + S / 2, y: t.r * S + S / 2, s: stats(t) }));
  for (const k of map.cells) {
    const [x, y] = center(k); let d = 0;
    for (const t of tw) if (Math.hypot(x - t.x, y - t.y) <= t.s.range * S) d += t.s.damage * t.s.fireRate;
    danger.set(k, d);
  }
  for (const type in ENEMIES) {
    const rem = new Map();
    const visit = (k, seen) => {
      if (rem.has(k)) return rem.get(k);
      const ns = map.out.get(k) || []; let best = Infinity;
      for (const n of ns) { if (seen.has(n)) continue; seen.add(n); best = Math.min(best, laneCost(n, type) + visit(n, seen)); seen.delete(n); }
      rem.set(k, best === Infinity ? 0 : best); return rem.get(k);
    };
    for (const k of map.cells) visit(k, new Set([k]));
    plans[type] = rem;
  }
  laneDirty = false;
}
function chooseNext(k, type, count = true) {
  const ns = map.out.get(k); if (!ns || !ns.length) return null;
  if (ns.length === 1) return ns[0];
  const costs = ns.map(n => laneCost(n, type) + plans[type].get(n) + LANE_AI.crowdWeight * (load.get(k + '>' + n) || 0));
  const best = Math.min(...costs), w = costs.map(c => Math.exp(-(c - best) / LANE_AI.randomness));
  let x = Math.random() * w.reduce((a, b) => a + b), i = 0;
  for (; i < w.length - 1; i++) { x -= w[i]; if (x <= 0) break; }
  if (count) load.set(k + '>' + ns[i], (load.get(k + '>' + ns[i]) || 0) + 1);
  return ns[i];
}

/* ---------- Tower stats with upgrades ---------- */
function stats(t) {
  const s = { ...TOWERS[t.key] };
  t.tiers.forEach((n, i) => { const u = UPGRADES[i];
    for (let k = 0; k < n; k++) {
      s.damage *= u.damageMult || 1; s.range += u.rangeAdd || 0; s.fireRate *= u.fireRateMult || 1;
      if (s.slow) s.slow = Math.max(0.15, s.slow + (u.slowAdd || 0));
      if (s.splash) s.splash += u.splashAdd || 0;
    } });
  return s;
}
const upgradeCost = (t, p) => Math.round(TOWERS[t.key].cost * UPGRADES[p].costMult[t.tiers[p]]);
function canUpgrade(t, p) {
  if (t.tiers[p] >= SETTINGS.maxUpgradeTier) return false;
  const after = [...t.tiers]; after[p]++;
  return Math.min(...after) <= SETTINGS.otherPathLimit;
}
const sellValue = t => Math.floor(t.spent * SETTINGS.sellRefund);

/* ---------- Game flow ---------- */
function newGame(def) {
  map = buildMap(def); lastMapName = def.name;
  state = { gold: SETTINGS.startGold, lives: SETTINGS.startLives, wave: 0, score: 0, time: 0, speed: 1, paused: false,
    towers: [], enemies: [], bullets: [], effects: [], spawns: [], waveActive: false, waveBatch: 0, autoAt: 0, sendCd: 0,
    buildType: null, selectedTower: null, mouse: null, over: false };
  load = new Map(); recomputeLanes();
  $('modal').hidden = true; $('paused').hidden = true;
  Sound.setPaused(false); Sound.init(); Sound.startMusic();
  setText($('mapName'), 'Map: ' + def.name);
  setMessage('Pick a tower, then click a grass square to build it.');
  renderPreview(); updateUI();
}
function startGame(def) { inGame = true; $('menu').hidden = true; $('gameView').hidden = false; newGame(def); }
function showMenu() { inGame = false; $('menu').hidden = false; $('gameView').hidden = true; Sound.setPaused(false); Sound.stopMusic(); renderBoards(); }

function startWave(early) {
  if (state.over) return;
  const n = state.wave, k = Math.max(0, n - WAVES.length + 1);
  const hp = Math.pow(ENDLESS.growth, k), rw = 1 + k * ENDLESS.rewardGrowth;
  let t = 0;
  for (const g of waveGroups(n)) { for (let i = 0; i < g.count; i++) { state.spawns.push({ type: g.type, when: state.time + t, hp, rw }); t += g.gap; } t += 1; }
  state.wave++; state.waveBatch++; state.waveActive = true; state.autoAt = 0;
  if (early) { state.gold += SETTINGS.sendEarlyBonus; state.sendCd = SETTINGS.sendEarlyCooldown; }
  setMessage('Wave ' + state.wave + (early ? ' sent early! +' + SETTINGS.sendEarlyBonus + ' gold.' : ' incoming!'));
  Sound.play(waveGroups(n).some(g => ENEMIES[g.type].boss) ? 'boss' : 'wave');
  renderPreview(); updateUI();
}
const waveAction = () => { if (!state.waveActive) startWave(false); else if (state.sendCd <= 0) startWave(true); };

function makeEnemy(type, hp, rw, cell, x, y, nxt) {   // hp and rw are the wave's health and reward multipliers
  const d = ENEMIES[type];
  const en = { type, flying: !!d.flying, x, y, cell, nxt: null, hp, rw, health: d.health * hp, maxHealth: d.health * hp,
    reward: Math.round(d.reward * rw), slowFactor: 1, slowUntil: 0 };
  if (d.flying) { en.plan = [cell]; en.pi = 0; for (let k = cell, n; (n = chooseNext(k, type, false)); k = n) en.plan.push(n); }
  else en.nxt = nxt || chooseNext(cell, type);
  return en;
}
function spawnEnemy(q) {
  const entry = map.entries[Math.floor(Math.random() * map.entries.length)], [x, y] = center(entry);
  state.enemies.push(makeEnemy(q.type, q.hp, q.rw, entry, x, y));
}
function moveGround(en, move) {
  while (move > 0 && en.nxt) {
    const [tx, ty] = center(en.nxt), dx = tx - en.x, dy = ty - en.y, d = Math.hypot(dx, dy);
    if (d <= move) { en.x = tx; en.y = ty; move -= d; en.cell = en.nxt; en.nxt = chooseNext(en.cell, en.type); }
    else { en.x += dx / d * move; en.y += dy / d * move; move = 0; }
  }
  if (!en.nxt) en.escaped = true;
}
function moveFlyer(en, d, move) {   // follows its lane but may cut across bends within shortcutRange
  const R = (d.shortcutRange || 0) * S + 1;
  while (move > 0 && en.pi < en.plan.length - 1) {
    let j = en.pi + 1;
    for (let q = en.pi + 2; q < en.plan.length && q < en.pi + 80; q++) { const [cx, cy] = center(en.plan[q]); if (Math.hypot(cx - en.x, cy - en.y) <= R) j = q; }
    const [tx, ty] = center(en.plan[j]), dx = tx - en.x, dy = ty - en.y, dist = Math.hypot(dx, dy);
    if (dist <= move) { en.x = tx; en.y = ty; move -= dist; en.pi = j; en.cell = en.plan[j]; }
    else { en.x += dx / dist * move; en.y += dy / dist * move; move = 0; }
  }
  if (en.pi >= en.plan.length - 1) en.escaped = true;
}
function progress(en) {
  const nk = en.flying ? en.plan[en.pi + 1] : en.nxt; let f = 0;
  if (nk) { const [x, y] = center(nk); f = 1 - Math.min(1, Math.hypot(x - en.x, y - en.y) / S); }
  return -(map.hops.get(en.cell) || 0) + f;
}
function applyHit(o, b) { o.health -= b.damage; if (b.slow) { o.slowFactor = b.slow; o.slowUntil = state.time + b.slowTime; } }

function update(dt) {
  state.time += dt; state.sendCd = Math.max(0, state.sendCd - dt);
  if (laneDirty) recomputeLanes();
  for (const [k, v] of load) { const nv = v * Math.pow(LANE_AI.crowdDecay, dt); if (nv < .05) load.delete(k); else load.set(k, nv); }
  if (!state.waveActive && state.autoAt && state.time >= state.autoAt) startWave(false);

  if (state.spawns.length) {
    const due = [], rest = [];
    for (const q of state.spawns) (q.when <= state.time ? due : rest).push(q);
    if (due.length) { state.spawns = rest; due.forEach(spawnEnemy); }
  }
  for (const en of state.enemies) {
    const d = ENEMIES[en.type], move = d.speed * dt * (state.time < en.slowUntil ? en.slowFactor : 1);
    if (en.flying) moveFlyer(en, d, move); else moveGround(en, move);
    if (en.escaped) { state.lives -= d.damageToBase; Sound.play('lifeLost'); }
  }
  state.enemies = state.enemies.filter(e => !e.escaped);

  for (const t of state.towers) {
    t.cooldown -= dt; if (t.cooldown > 0) continue;
    const s = stats(t), tx = t.c * S + S / 2, ty = t.r * S + S / 2; let best = null, bp = -Infinity;
    for (const en of state.enemies) {
      if (en.flying && !s.hitsAir) continue;
      if (Math.hypot(en.x - tx, en.y - ty) > s.range * S) continue;
      const pr = progress(en); if (pr > bp) { best = en; bp = pr; }
    }
    if (best) { state.bullets.push({ x: tx, y: ty, target: best, damage: s.damage, speed: s.bulletSpeed, color: s.color, splash: s.splash, slow: s.slow, slowTime: s.slowTime }); t.cooldown = 1 / s.fireRate; Sound.play('shoot_' + t.key); }
  }
  for (const b of state.bullets) {
    if (b.target.health <= 0 || b.target.escaped) { b.dead = true; continue; }
    const dx = b.target.x - b.x, dy = b.target.y - b.y, dist = Math.hypot(dx, dy), step = b.speed * dt;
    if (dist > step) { b.x += dx / dist * step; b.y += dy / dist * step; continue; }
    b.dead = true;
    if (b.splash) {
      const R = b.splash * S;
      for (const o of state.enemies) if (!o.flying && Math.hypot(o.x - b.target.x, o.y - b.target.y) <= R) applyHit(o, b);
      state.effects.push({ x: b.target.x, y: b.target.y, r: R, life: 0.15 });
    } else applyHit(b.target, b);
  }
  state.bullets = state.bullets.filter(b => !b.dead);
  for (const f of state.effects) f.life -= dt;
  state.effects = state.effects.filter(f => f.life > 0);
  const born = [];   // enemies released by bursting bosses
  state.enemies = state.enemies.filter(en => {
    if (en.health > 0) return true;
    state.gold += en.reward; state.score += en.reward * SETTINGS.scorePerRewardGold;
    const sp = ENEMIES[en.type].splitInto;
    if (sp) {
      for (let i = 0; i < sp.count; i++) born.push(makeEnemy(sp.type, en.hp, en.rw, en.cell, en.x + (Math.random() - .5) * S, en.y + (Math.random() - .5) * S, en.nxt));
      state.effects.push({ x: en.x, y: en.y, r: S * 2, life: .35, max: .35, color: '#ffd166' });
      Sound.play('bossDie');
    } else Sound.play('kill');
    return false;
  });
  state.enemies.push(...born);

  if (state.waveActive && !state.spawns.length && !state.enemies.length) {
    state.waveActive = false; Sound.play('clear');
    const n = state.waveBatch; state.waveBatch = 0;
    state.gold += SETTINGS.waveBonusGold * n; state.score += SETTINGS.scorePerWave * n;
    if (autoOn) state.autoAt = state.time + SETTINGS.autoStartDelay;
    setMessage(`Wave ${state.wave} cleared! +${SETTINGS.waveBonusGold * n} gold.` + (autoOn ? '' : ' Upgrade or build, then start the next one.'));
  }
  if (state.lives <= 0) { state.lives = 0; gameOver(); }
  updateUI();
}

function gameOver() {
  state.over = true; Sound.stopMusic(); Sound.play('gameOver');
  setText($('modalText'), `You reached wave ${state.wave} on ${map.def.name} with a score of ${state.score}.`);
  $('modal').hidden = false; $('nameInput').focus(); updateUI();
}
function finish(save) {
  if (save) addScore($('nameInput').value.trim() || 'Anonymous', state.score, state.wave, map.def.name);
  $('nameInput').value = ''; newGame(pickMap());
}

/* ---------- UI ---------- */
const towerButtons = $('towerButtons'), towerKeys = Object.keys(TOWERS);
for (const k of towerKeys) {
  const t = TOWERS[k], b = document.createElement('button');
  b.dataset.key = k; b.style.setProperty('--c', t.color);
  b.title = `Damage ${t.damage}, range ${t.range}, ${t.fireRate} shots/s` + (t.splash ? `, blast ${t.splash}` : '') + (t.slow ? ', slows enemies' : '') + (t.hitsAir ? '' : ', ground only');
  b.innerHTML = `<span class="swatch"></span>${t.name}<br><span class="small">${t.cost} gold${t.hitsAir ? '' : ' · ground'}</span>`;
  b.onclick = () => selectBuild(k);
  towerButtons.appendChild(b);
}
function selectBuild(k) { if (state.over) return; Sound.play('click'); state.buildType = state.buildType === k ? null : k; state.selectedTower = null; updateUI(); }
function spriteLoaded() { if (inGame && state) renderPreview(); }   // called by config.js when a sprite image finishes loading
function renderPreview() {
  const box = $('preview'); box.innerHTML = '';
  const n = state.wave, k = Math.max(0, n - WAVES.length + 1), head = document.createElement('div');
  head.className = 'small'; head.textContent = 'Next: wave ' + (n + 1) + (k ? '  (health x' + Math.pow(ENDLESS.growth, k).toFixed(2) + ')' : '');
  box.appendChild(head);
  const tally = {}; for (const g of waveGroups(n)) tally[g.type] = (tally[g.type] || 0) + g.count;
  for (const t in tally) { const d = ENEMIES[t], chip = document.createElement('span'); chip.className = 'chip'; chip.style.setProperty('--c', d.color);
    const icon = spriteIcon('enemies', t, 14); if (icon) { chip.classList.add('has-sprite'); chip.appendChild(icon); }
    chip.appendChild(document.createTextNode(tally[t] + '× ' + d.name + (d.flying ? ' (air)' : ''))); box.appendChild(chip); }
}
function buyUpgrade(p) {
  const t = state.selectedTower; if (!t || state.over || !canUpgrade(t, p)) return;
  const cost = upgradeCost(t, p); if (state.gold < cost) { Sound.play('error'); return setMessage('Not enough gold.'); }
  state.gold -= cost; t.spent += cost; t.tiers[p]++; laneDirty = true; Sound.play('upgrade'); updateUI();
}
function sellTower(t) {
  if (!t || state.over) return;
  Sound.play('sell'); state.gold += sellValue(t); state.towers.splice(state.towers.indexOf(t), 1);
  if (state.selectedTower === t) state.selectedTower = null;
  laneDirty = true; updateUI();
}
function updateUI() {
  setText($('gold'), state.gold); setText($('lives'), state.lives); setText($('wave'), state.wave);
  setText($('enemies'), state.enemies.length + state.spawns.length); setText($('score'), state.score);
  setText($('best'), loadScores()[0] ? loadScores()[0].score : 0);
  for (const b of towerButtons.children) { b.classList.toggle('selected', b.dataset.key === state.buildType); b.disabled = state.over; }
  setText($('pauseBtn'), state.paused ? 'Resume' : 'Pause');
  setText($('speedBtn'), 'Speed ' + state.speed + 'x');
  $('autoChk').checked = autoOn;
  setText($('musicBtn'), 'Music: ' + (Sound.musicOn ? 'on' : 'off')); setText($('sfxBtn'), 'Sound: ' + (Sound.sfxOn ? 'on' : 'off'));
  setText($('startBtn'), state.waveActive ? 'Wave in progress...' : 'Start wave ' + (state.wave + 1));
  $('startBtn').disabled = state.waveActive || state.over;
  setText($('sendBtn'), state.sendCd > 0 ? 'Send early (' + Math.ceil(state.sendCd) + 's)' : 'Send next wave early (+' + SETTINGS.sendEarlyBonus + 'g)');
  $('sendBtn').disabled = !state.waveActive || state.sendCd > 0 || state.over;
  const t = state.selectedTower;
  [['upA', 0], ['upB', 1]].forEach(([id, p]) => {
    const el = $(id); el.hidden = !t; if (!t) return;
    const u = UPGRADES[p], tier = t.tiers[p], max = SETTINGS.maxUpgradeTier;
    setText(el, tier >= max ? `${u.name}: maxed (${tier}/${max})` : !canUpgrade(t, p) ? `${u.name}: locked (${tier}/${max})` : `${u.name} ${tier}/${max} - ${upgradeCost(t, p)} gold`);
    el.title = u.desc; el.disabled = state.over || !canUpgrade(t, p) || state.gold < upgradeCost(t, p);
  });
  $('sellBtn').hidden = !t; $('upTitle').hidden = !!t;
  if (t) setText($('sellBtn'), `Sell ${TOWERS[t.key].name} - ${sellValue(t)} gold`);
}

/* ---------- Events ---------- */
const cellFromEvent = e => { const r = canvas.getBoundingClientRect(); return { c: Math.floor((e.clientX - r.left) / S), r: Math.floor((e.clientY - r.top) / S) }; };
const towerAt = (c, r) => state.towers.find(t => t.c === c && t.r === r);
canvas.addEventListener('mousemove', e => { if (state) state.mouse = cellFromEvent(e); });
canvas.addEventListener('mouseleave', () => { if (state) state.mouse = null; });
canvas.addEventListener('click', e => {
  if (state.over || state.paused) return;
  const { c, r } = cellFromEvent(e); if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
  const existing = towerAt(c, r);
  if (existing) { state.selectedTower = existing; state.buildType = null; Sound.play('click'); updateUI(); return; }
  if (!state.buildType) { state.selectedTower = null; updateUI(); return; }
  if (map.blocked.has(key(c, r))) { state.buildType = null; Sound.play('error'); updateUI(); return setMessage("Can't build there. Tower deselected."); }
  const def = TOWERS[state.buildType]; if (state.gold < def.cost) { Sound.play('error'); return setMessage('Not enough gold.'); }
  state.gold -= def.cost; state.towers.push({ key: state.buildType, c, r, cooldown: 0, tiers: [0, 0], spent: def.cost });
  state.selectedTower = null; laneDirty = true; Sound.play('build'); setMessage(''); updateUI();
});
canvas.addEventListener('contextmenu', e => {   // right-click: sell the tower under the cursor, or cancel what you're holding
  e.preventDefault(); const { c, r } = cellFromEvent(e), t = towerAt(c, r);
  if (t) sellTower(t); else if (state.buildType || state.selectedTower) { state.buildType = null; state.selectedTower = null; updateUI(); }
});

const togglePause = () => { if (state.over) return; state.paused = !state.paused; $('paused').hidden = !state.paused; Sound.setPaused(state.paused); updateUI(); };
const cycleSpeed = () => { const o = SETTINGS.speedOptions; state.speed = o[(o.indexOf(state.speed) + 1) % o.length]; updateUI(); };
const toggleAuto = () => { autoOn = !autoOn; if (autoOn && !state.waveActive && !state.over) state.autoAt = state.time + SETTINGS.autoStartDelay; if (!autoOn) state.autoAt = 0; updateUI(); };
$('playBtn').onclick = () => startGame(pickMap());
$('menuBtn').onclick = showMenu;
$('restartBtn').onclick = () => newGame(SETTINGS.restartKeepsMap ? map.def : pickMap());   // restarts never touch the leaderboard
$('pauseBtn').onclick = togglePause; $('speedBtn').onclick = cycleSpeed; $('autoChk').onchange = () => { toggleAuto(); $('autoChk').blur(); };
$('musicBtn').onclick = () => { Sound.toggleMusic(); updateUI(); }; $('sfxBtn').onclick = () => { Sound.toggleSfx(); Sound.play('click'); updateUI(); };
$('startBtn').onclick = () => startWave(false); $('sendBtn').onclick = () => startWave(true);
$('upA').onclick = () => buyUpgrade(0); $('upB').onclick = () => buyUpgrade(1);
$('sellBtn').onclick = () => sellTower(state.selectedTower);
$('saveBtn').onclick = () => finish(true); $('skipBtn').onclick = () => finish(false);
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') finish(true); });
document.addEventListener('keydown', e => {
  if (!inGame || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur(); if (!state.over) waveAction(); }
  else if (k === 'p') togglePause(); else if (k === 'f') cycleSpeed(); else if (k === 'a') toggleAuto();
  else if (k === 'escape') { state.buildType = null; state.selectedTower = null; updateUI(); }
  else if (k === 'q') buyUpgrade(0); else if (k === 'w') buyUpgrade(1); else if (k === 'x') sellTower(state.selectedTower);
  else if (/^[1-9]$/.test(k) && towerKeys[+k - 1]) selectBuild(towerKeys[+k - 1]);
});

/* ---------- Drawing ---------- */
function drawRange(x, y, r, col = 'rgba(255,255,255,0.12)') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function draw() {
  ctx.drawImage(map.bg, 0, 0);
  if (state.mouse && state.buildType && !state.over) {
    const { c, r } = state.mouse, def = TOWERS[state.buildType];
    if (c >= 0 && r >= 0 && c < COLS && r < ROWS) {
      const bad = map.blocked.has(key(c, r)) || towerAt(c, r);
      ctx.fillStyle = bad ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.25)'; ctx.fillRect(c * S, r * S, S, S);
      drawRange(c * S + S / 2, r * S + S / 2, def.range * S);
      ctx.globalAlpha = .6; drawTower(ctx, state.buildType, def, c * S, r * S, S); ctx.globalAlpha = 1;
    }
  }
  for (const t of state.towers) {
    const x = t.c * S, y = t.r * S, sel = t === state.selectedTower;
    if (sel) drawRange(x + S / 2, y + S / 2, stats(t).range * S);
    drawTower(ctx, t.key, TOWERS[t.key], x, y, S);
    if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, S - 8, S - 8); ctx.lineWidth = 1; }
    t.tiers.forEach((n, i) => { ctx.fillStyle = i === 0 ? '#fff' : '#222'; for (let k = 0; k < n; k++) ctx.fillRect(x + 8 + k * 7, i === 0 ? y + 7 : y + S - 12, 5, 5); });
  }
  for (const en of state.enemies) {
    const d = ENEMIES[en.type], size = d.size * S, hgt = size * Math.min(1, spriteAspect('enemies', en.type));
    drawEnemy(ctx, en.type, d, en.x, en.y, size);
    if (state.time < en.slowUntil) { ctx.strokeStyle = '#7fe7ff'; ctx.strokeRect(en.x - size / 2 - 2, en.y - hgt / 2 - 2, size + 4, hgt + 4); }
    ctx.fillStyle = '#400'; ctx.fillRect(en.x - size / 2, en.y - hgt / 2 - 6, size, 3);
    ctx.fillStyle = '#3ddc84'; ctx.fillRect(en.x - size / 2, en.y - hgt / 2 - 6, size * Math.max(0, en.health / en.maxHealth), 3);
  }
  for (const f of state.effects) { ctx.globalAlpha = Math.max(0, f.life / (f.max || 0.15)) * 0.6; drawRange(f.x, f.y, f.r, f.color || '#ff6b9d'); ctx.globalAlpha = 1; }
  for (const b of state.bullets) { ctx.fillStyle = b.color; ctx.fillRect(b.x - 3, b.y - 3, 6, 6); }
}

/* ---------- Main loop ---------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (inGame) { if (!state.paused && !state.over) for (let i = 0; i < state.speed; i++) update(dt); draw(); }
  requestAnimationFrame(loop);
}
showMenu();
requestAnimationFrame(loop);
