const Sound = (() => {
  let ac = null, sfxGain, musicGain, noiseBuf, timer = null, step = 0, nextTime = 0;
  let musicOn = true, sfxOn = true, musicVolume = AUDIO.musicVolume, sfxVolume = AUDIO.sfxVolume;
  let wantMusic = false, paused = false, musicMode = 'game';
  const last = {};
  const clampVolume = value => Math.max(0, Math.min(1, value));
  try {
    const s = JSON.parse(localStorage.getItem(AUDIO.storageKey));
    if (s) {
      musicOn = s.music !== false;
      sfxOn = s.sfx !== false;
      if (Number.isFinite(s.musicVolume)) musicVolume = clampVolume(s.musicVolume);
      if (Number.isFinite(s.sfxVolume)) sfxVolume = clampVolume(s.sfxVolume);
    }
  } catch (e) { }
  const save = () => {
    try {
      localStorage.setItem(AUDIO.storageKey, JSON.stringify({ music: musicOn, sfx: sfxOn, musicVolume, sfxVolume }));
    } catch (e) { }
  };

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) {
      if (ac.state === 'suspended' && !paused) ac.resume();
      return;
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    sfxGain = ac.createGain();
    sfxGain.connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    if (wantMusic) startTrack(musicMode);
  }

  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, init));

  function applyVolumes() {
    if (!ac) return;
    sfxGain.gain.value = sfxOn ? sfxVolume : 0;
    musicGain.gain.value = musicOn ? musicVolume : 0;
  }

  /* ---------- Synth building blocks ---------- */
  function tone(type, f0, f1, dur, vol, when = ac.currentTime, dest = sfxGain) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  function noise(dur, vol, cutoff, when = ac.currentTime, dest = sfxGain) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(when);
    s.stop(when + dur + 0.02);
  }

  const seq = (type, notes, dur, vol, gap) => notes.forEach((f, i) => tone(type, f, f, dur, vol, ac.currentTime + i * gap));

  /* ---------- Sound effects ---------- */
  // Change the numbers to change a sound.
  const SFX = {
    shoot_basic: () => tone('square', 700, 350, .07, .25),
    shoot_rapid: () => tone('square', 1100, 800, .035, .15),
    shoot_heavy: () => {
      tone('sawtooth', 220, 60, .22, .35);
      noise(.12, .2, 800);
    },
    shoot_frost: () => tone('triangle', 1400, 700, .12, .3),
    shoot_cannon: () => {
      tone('square', 160, 50, .2, .3);
      noise(.15, .3, 600);
    },
    kill: () => tone('square', 500, 900, .08, .2),
    bossDie: () => {
      noise(.7, .6, 1500);
      tone('sawtooth', 300, 40, .7, .4);
    },
    boss: () => seq('sawtooth', [110, 110, 110], .22, .4, .25),
    build: () => seq('square', [440, 660], .08, .25, .06),
    sell: () => seq('square', [660, 440], .08, .25, .06),
    upgrade: () => seq('square', [523, 659, 784, 1047], .09, .22, .06),
    error: () => tone('square', 140, 120, .15, .3),
    click: () => tone('square', 900, 900, .03, .12),
    wave: () => seq('square', [330, 440, 660], .12, .25, .1),
    clear: () => seq('square', [523, 659, 784, 1047], .14, .22, .1),
    lifeLost: () => tone('sawtooth', 300, 100, .3, .4),
    gameOver: () => seq('triangle', [392, 330, 262, 196], .3, .4, .25),
  };

  const THROTTLE = { shoot_basic: .05, shoot_rapid: .06, shoot_heavy: .08, shoot_frost: .08, shoot_cannon: .08, kill: .05, lifeLost: .1 };

  function play(name) {
    if (!sfxOn) return;
    const now = performance.now() / 1000;
    if (last[name] && now - last[name] < (THROTTLE[name] || 0)) return;
    last[name] = now;
    if (ac && ac.state === 'running' && SFX[name]) SFX[name]();
  }

  /* ---------- Music ---------- */
  // Change the note numbers to change the tunes. 0 = silence. The 132 and 84 set the speed.
  const STEP = 60 / 132 / 2;
  const BASS = [45, 41, 48, 43];
  const BASS_PATTERN = [0, 0, 12, 0, 0, 0, 12, 0];
  const LEAD = [[76, 0, 72, 0, 69, 0, 72, 76], [77, 0, 72, 0, 69, 0, 72, 77],
    [79, 0, 76, 0, 72, 0, 76, 79], [79, 0, 74, 0, 71, 0, 74, 79]];
  const MENU_STEP = 60 / 84 / 2;
  const MENU_BASS = [50, 46, 48, 43];
  const MENU_LEAD = [[74, 0, 69, 0, 72, 0, 67, 0], [69, 0, 65, 0, 67, 0, 62, 0],
    [72, 0, 69, 0, 74, 0, 72, 0], [67, 0, 65, 0, 62, 0, 0, 0]];

  function scheduleMusic() {
    while (nextTime < ac.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, i = step % 8, len = STEP * 0.9, bass = hz(BASS[bar] + BASS_PATTERN[i]);
      if (LEAD[bar][i]) tone('square', hz(LEAD[bar][i]), hz(LEAD[bar][i]), len, .09, nextTime, musicGain);
      tone('triangle', bass, bass, len, .22, nextTime, musicGain);
      if (i % 2 === 1) noise(.03, .05, 8000, nextTime, musicGain);
      if (i === 0 || i === 4) tone('sine', 150, 40, .12, .35, nextTime, musicGain);
      if (i === 2 || i === 6) noise(.08, .12, 4000, nextTime, musicGain);
      nextTime += STEP;
      step++;
    }
  }

  function scheduleMenuMusic() {
    while (nextTime < ac.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, i = step % 8, when = nextTime;
      const root = MENU_BASS[bar], note = MENU_LEAD[bar][i];
      if (i === 0 || i === 4) tone('triangle', hz(root), hz(root), MENU_STEP * 1.65, .1, when, musicGain);
      if (note) tone('square', hz(note), hz(note), MENU_STEP * .78, .055, when, musicGain);
      if (i === 2 || i === 6) tone('square', hz(root + 7), hz(root + 7), MENU_STEP * .45, .022, when, musicGain);
      nextTime += MENU_STEP;
      step++;
    }
  }

  function startTrack(mode) {
    wantMusic = true;
    if (musicMode !== mode) {
      musicMode = mode;
      clearInterval(timer);
      timer = null;
    }

    if (!ac) return;
    if (timer) return;
    step = 0;
    nextTime = ac.currentTime + 0.1;
    timer = setInterval(musicMode === 'menu' ? scheduleMenuMusic : scheduleMusic, 50);
  }

  function startMusic() {
    startTrack('game');
  }

  function startMenuMusic() {
    startTrack('menu');
  }

  function stopMusic() {
    wantMusic = false;
    clearInterval(timer);
    timer = null;
  }

  function setPaused(p) {
    paused = p;
    if (ac) {
      if (p) ac.suspend();
      else ac.resume();
    }
  }

  return {
    init, play, startMusic, startMenuMusic, stopMusic, setPaused,
    toggleMusic() {
      musicOn = !musicOn;
      save();
      applyVolumes();
    },
    toggleSfx() {
      sfxOn = !sfxOn;
      save();
      applyVolumes();
    },
    setMusicVolume(value) {
      musicVolume = clampVolume(value);
      save();
      applyVolumes();
    },
    setSfxVolume(value) {
      sfxVolume = clampVolume(value);
      save();
      applyVolumes();
    },
    get musicOn() {
      return musicOn;
    }, get sfxOn() {
      return sfxOn;
    },
    get musicVolume() {
      return musicVolume;
    }, get sfxVolume() {
      return sfxVolume;
    },
  };
})();
