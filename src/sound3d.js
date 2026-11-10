/* sound3d.js — synthesized ambience + foley. No audio files: every
   sound is built from oscillators and shaped noise through WebAudio.
   The context starts on the first user gesture (autoplay rules).  */
window.HP = window.HP || {};
(function () {
const S = HP.sound3d = {};
let ctx = null, master = null, enabled = true, started = false;
let amb = {};                 // {wind, crickets, birds, water, fire, fanN}
let noiseBuf = null;
try { enabled = localStorage.getItem('hp_3d_sound') !== 'off'; } catch (_) {}

S.enabled = () => enabled;
S.setEnabled = on => {
  enabled = !!on;
  try { localStorage.setItem('hp_3d_sound', on ? 'on' : 'off'); } catch (_) {}
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.42 : 0, ctx.currentTime, 0.05);
};

function makeNoise() {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
/* looping noise source through a filter, with a gain we can drive    */
function loopNoise(type, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  return g;
}

/* called once the player has interacted — safe under autoplay rules */
S.start = function () {
  if (started || !enabled) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    master = master || (() => { const g = ctx.createGain(); g.gain.value = 0.42; g.connect(ctx.destination); return g; })();
    noiseBuf = noiseBuf || makeNoise();
    if (!amb.wind) {
      amb.wind = loopNoise('lowpass', 280, 0.5);
      amb.crickets = ctx.createGain(); amb.crickets.gain.value = 1; amb.crickets.connect(master);
      amb.birds = ctx.createGain(); amb.birds.gain.value = 0; amb.birds.connect(master);
      amb.water = loopNoise('bandpass', 650, 0.7);
      amb.fire = loopNoise('bandpass', 950, 1.8);
      amb.fanN = loopNoise('lowpass', 190, 0.6);       // soft air only (no harsh buzz)
    }
    started = true;
  } catch (_) {}
};

/* ---------- one-shots ---------- */
function env(node, t0, a, peak, dec) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
}
/* footstep character per surface — soft low-frequency thuds, never harsh clicks */
const STEPS = {
  wood:    { f: 190,  q: 1.1, dec: 0.08, vol: 0.16, type: 'lowpass' },
  tile:    { f: 340,  q: 1.2, dec: 0.06, vol: 0.14, type: 'bandpass' },
  carpet:  { f: 150,  q: 0.6, dec: 0.09, vol: 0.10, type: 'lowpass' },
  grass:   { f: 650,  q: 0.7, dec: 0.10, vol: 0.13, type: 'bandpass' },
  gravel:  { f: 480,  q: 0.8, dec: 0.11, vol: 0.16, type: 'bandpass' },
  stone:   { f: 280,  q: 1.1, dec: 0.07, vol: 0.15, type: 'bandpass' },
  water:   { f: 520,  q: 0.7, dec: 0.15, vol: 0.24, type: 'bandpass' },
};
S.step = function (matId, run) {
  if (!started || !enabled) return;
  const m = /water/i.test(matId) ? STEPS.water
    : /carpet|rug|mat/i.test(matId) ? STEPS.carpet
    : /tile|marble|terrazzo|travertine|mosaic/i.test(matId) ? STEPS.tile
    : /grass|lawn|moss/i.test(matId) ? STEPS.grass
    : /gravel|pebble/i.test(matId) ? STEPS.gravel
    : /concrete|stone|flagstone|brick|deck|patio/i.test(matId) ? STEPS.stone
    : STEPS.wood;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const f = ctx.createBiquadFilter(); f.type = m.type; f.frequency.value = m.f * (0.92 + Math.random() * 0.16); f.Q.value = m.q;
  const g = ctx.createGain();
  env(g, t0, 0.006, m.vol * (run ? 1.2 : 1), m.dec);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + 0.2);
  /* soft droplet tail on water only */
  if (m === STEPS.water) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(520 + Math.random() * 180, t0 + 0.05);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.18);
    const g2 = ctx.createGain(); env(g2, t0 + 0.05, 0.01, 0.09, 0.12);
    o.connect(g2); g2.connect(master); o.start(t0 + 0.05); o.stop(t0 + 0.2);
  }
};
/* soft wooden latch/thud on doors (no sawtooth buzz) */
S.door = function (open, gate) {
  if (!started || !enabled) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = open ? 240 : 140;
  const g = ctx.createGain(); env(g, t0, 0.006, open ? 0.12 : 0.22, 0.11);
  src.connect(lf); lf.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + 0.16);
  const o = ctx.createOscillator(); o.type = 'sine';
  const base = gate ? 130 : 95;
  o.frequency.setValueAtTime(open ? base : base * 1.1, t0);
  o.frequency.exponentialRampToValueAtTime(base * 0.55, t0 + 0.1);
  const g2 = ctx.createGain(); env(g2, t0, 0.004, 0.1, 0.1);
  o.connect(g2); g2.connect(master); o.start(t0); o.stop(t0 + 0.13);
};
/* splash — stepping into or out of the pool: a whoosh of noise plus
   a low body-thump and a couple of droplet blips                    */
S.splash = function (entering) {
  if (!started || !enabled) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.2;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(entering ? 1400 : 900, t0);
  f.frequency.exponentialRampToValueAtTime(500, t0 + 0.3);
  const g = ctx.createGain(); env(g, t0, 0.015, 0.35, 0.3);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + 0.45);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(150, t0);
  o.frequency.exponentialRampToValueAtTime(60, t0 + 0.22);
  const g2 = ctx.createGain(); env(g2, t0, 0.005, 0.22, 0.2);
  o.connect(g2); g2.connect(master); o.start(t0); o.stop(t0 + 0.3);
  for (let i = 0; i < 2; i++) {
    const d = ctx.createOscillator(); d.type = 'sine';
    const t1 = t0 + 0.14 + i * 0.09 + Math.random() * 0.04;
    d.frequency.setValueAtTime(700 + Math.random() * 350, t1);
    d.frequency.exponentialRampToValueAtTime(280, t1 + 0.12);
    const g3 = ctx.createGain(); env(g3, t1, 0.008, 0.1, 0.12);
    d.connect(g3); g3.connect(master); d.start(t1); d.stop(t1 + 0.16);
  }
};
S.windowOpen = function () {
  if (!started || !enabled) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 1.2;
  const g = ctx.createGain(); env(g, t0, 0.008, 0.08, 0.09);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + 0.13);
};
/* cricket chirp — soft distant pulses */
function chirp(t0, g) {
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 3600 + Math.random() * 200;
    const gg = ctx.createGain(); env(gg, t0 + i * 0.09, 0.01, 0.012, 0.05);
    o.connect(gg); gg.connect(g); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.08);
  }
}
/* bird song — gentle distant notes */
function birdSong(t0, g) {
  const n = 2;
  let f0 = 1650 + Math.random() * 550;
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(); o.type = 'sine';
    const t1 = t0 + i * (0.14 + Math.random() * 0.05);
    o.frequency.setValueAtTime(f0, t1);
    o.frequency.exponentialRampToValueAtTime(f0 * (0.78 + Math.random() * 0.14), t1 + 0.11);
    const gg = ctx.createGain(); env(gg, t1, 0.015, 0.02, 0.09);
    o.connect(gg); gg.connect(g); o.start(t1); o.stop(t1 + 0.14);
    f0 *= 0.9 + Math.random() * 0.15;
  }
}

/* ---------- continuous ambience ----------
   env: {night, day, outdoors:0..1, nearWater, nearFire, nearFan}     */
let birdT = 4, cricketT = 3;
S.tick = function (dt, t, env) {
  if (!started || !enabled) return;
  const out = env.outdoors, night = env.night || 0, day = env.day || 0;
  amb.wind.gain.setTargetAtTime(0.012 * out, ctx.currentTime, 0.4);
  amb.water.gain.setTargetAtTime(Math.min(0.04, env.nearWater * 0.0006) * out, ctx.currentTime, 0.3);
  amb.fire.gain.setTargetAtTime(Math.min(0.06, env.nearFire * 0.0012), ctx.currentTime, 0.2);
  const fanOn = Math.min(0.015, env.nearFan * 0.0003);
  amb.fanN.gain.setTargetAtTime(fanOn, ctx.currentTime, 0.4);
  /* crickets & birds: sparse and subtle, outdoors only */
  cricketT -= dt;
  if (night > 0.4 && out > 0.3 && cricketT <= 0) {
    cricketT = 6 + Math.random() * 10;
    chirp(ctx.currentTime, amb.crickets);
  }
  birdT -= dt;
  if (day > 0.4 && out > 0.3 && birdT <= 0) {
    birdT = 8 + Math.random() * 14;
    birdSong(ctx.currentTime, amb.birds);
  }
  amb.birds.gain.setTargetAtTime(day > 0.4 ? 0.35 * out : 0, ctx.currentTime, 0.5);
};
S.stop = function () { if (ctx && ctx.suspend) ctx.suspend(); started = false; };
S.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); if (ctx) started = true; };
})();
