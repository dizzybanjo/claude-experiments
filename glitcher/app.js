/* ═══════════════════════════════════════════════════════════════════
   6 1 1 7 C H 3 R  //  stochastic glitch sequence synthesizer
   stereo. hard-limited. wav export.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── seeded rng ─────────────────────────────────────────────────── */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rrange = (rng, lo, hi) => lo + rng() * (hi - lo);
const rexp = (rng, lo, hi) => lo * Math.pow(hi / lo, rng()); // log-uniform
const rint = (rng, lo, hi) => Math.floor(rrange(rng, lo, hi + 1));
const rpick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function pickWeighted(rng, weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let x = rng() * total;
  for (const k in weights) { x -= weights[k]; if (x <= 0) return k; }
  return Object.keys(weights)[0];
}

/* ── voice palettes (probability weights per voice type) ────────── */
const PALETTES = {
  V01D:  { blip: 30, click: 22, crackle: 12, noise: 10, sub: 10, hiss: 8, modem: 4, stutter: 2, crush: 2 },
  '4C1D': { sub: 18, zap: 15, blip: 12, stutter: 12, fm: 8, click: 8, grind: 7, noise: 6, crush: 6, tape: 5, modem: 2, crackle: 1 },
  M3T4L: { fm: 20, crush: 14, stutter: 14, grind: 11, noise: 10, click: 8, crackle: 6, zap: 6, tape: 5, databend: 4, sub: 4, blip: 3 },
  D4T4:  { databend: 22, modem: 18, tape: 14, crush: 12, crackle: 10, stutter: 10, grind: 8, click: 6, noise: 4, blip: 2, hiss: 2 },
};

/* ── tonal system ───────────────────────────────────────────────── */
const MODES = {
  ionian:     [0, 2, 4, 5, 7, 9, 11],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
  harmminor:  [0, 2, 3, 5, 7, 8, 11],
};

/* frequency of scale degree n (n may exceed the octave or go negative) */
function degFreq(rootMidi, scale, degree) {
  const oct = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  const midi = rootMidi + oct * 12 + scale[idx];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* ── pattern generation ─────────────────────────────────────────
   All parameters are resolved to concrete numbers here, so the
   live scheduler and the offline WAV render produce identical audio. */
function generateEvent(rng, type, chaos, stepDur) {
  const ev = { type, pan: rrange(rng, -0.9, 0.9), jit: chaos * rrange(rng, -0.25, 0.25) };
  switch (type) {
    case 'click':
      ev.hp = rexp(rng, 800, 9000);
      ev.dur = rrange(rng, 0.003, 0.012);
      ev.g = rrange(rng, 0.4, 0.9);
      break;
    case 'blip':
      ev.f = rexp(rng, 900, 13000);
      ev.wave = rng() < 0.8 ? 'sine' : 'square';
      ev.dur = rrange(rng, 0.015, 0.09 + chaos * 0.1);
      ev.g = rrange(rng, 0.25, 0.6);
      ev.slide = rng() < chaos * 0.6 ? rexp(rng, 0.25, 4) : 1;
      break;
    case 'noise':
      ev.f = rexp(rng, 300, 11000);
      ev.q = rexp(rng, 0.7, 14);
      ev.dur = rrange(rng, 0.02, 0.12 + chaos * 0.25);
      ev.g = rrange(rng, 0.3, 0.7);
      break;
    case 'hiss':
      ev.f = rexp(rng, 4000, 14000);
      ev.q = rrange(rng, 0.4, 1.2);
      ev.dur = rrange(rng, 0.2, 0.9);
      ev.g = rrange(rng, 0.06, 0.16);
      break;
    case 'sub':
      ev.f0 = rrange(rng, 90, 200);
      ev.f1 = rrange(rng, 30, 55);
      ev.dur = rrange(rng, 0.1, 0.3);
      ev.g = rrange(rng, 0.6, 0.95);
      ev.pan *= 0.25; // keep lows near center
      break;
    case 'zap':
      ev.f0 = rexp(rng, 1800, 9000);
      ev.f1 = rexp(rng, 50, 400);
      ev.dur = rrange(rng, 0.04, 0.18);
      ev.q = rrange(rng, 4, 14);
      ev.g = rrange(rng, 0.3, 0.6);
      break;
    case 'fm':
      ev.c = rexp(rng, 180, 2400);
      ev.ratio = rpick(rng, [1.401, 1.732, 2.417, 3.142, 4.236, 5.813, 7.31]);
      ev.idx = rexp(rng, 150, 2800);
      ev.dur = rrange(rng, 0.04, 0.25 + chaos * 0.3);
      ev.g = rrange(rng, 0.25, 0.55);
      break;
    case 'stutter': {
      ev.n = rint(rng, 3, 4 + Math.round(chaos * 8));
      ev.iv = Math.max(0.012, (stepDur * rrange(rng, 0.9, 2.2)) / ev.n);
      ev.f = rexp(rng, 400, 8000);
      ev.sdur = Math.min(ev.iv * 0.8, rrange(rng, 0.008, 0.03));
      ev.g = rrange(rng, 0.3, 0.6);
      ev.decay = rrange(rng, 0.6, 1.05);
      ev.noise = rng() < 0.4;
      break;
    }
    case 'crackle': {
      ev.n = rint(rng, 6, 10 + Math.round(chaos * 24));
      ev.dur = rrange(rng, 0.05, 0.4);
      ev.hp = rexp(rng, 2000, 9000);
      ev.offs = []; ev.amps = [];
      for (let i = 0; i < ev.n; i++) {
        ev.offs.push(rng() * ev.dur);
        ev.amps.push(rrange(rng, 0.15, 0.8));
      }
      break;
    }
    case 'crush':
      ev.f = rexp(rng, 150, 3000);
      ev.levels = rint(rng, 2, 6);
      ev.dur = rrange(rng, 0.04, 0.2 + chaos * 0.25);
      ev.g = rrange(rng, 0.25, 0.5);
      ev.bp = rexp(rng, 400, 6000);
      break;
    case 'tape':   // tape-stop pitch plunge
      ev.f = rexp(rng, 250, 2200);
      ev.wave = rng() < 0.6 ? 'sawtooth' : 'square';
      ev.dur = rrange(rng, 0.15, 0.5 + chaos * 0.3);
      ev.g = rrange(rng, 0.2, 0.45);
      ev.drop = rrange(rng, 0.015, 0.06); // final freq ratio
      break;
    case 'databend': { // corrupted buffer: noise with hard playbackRate jumps
      ev.dur = rrange(rng, 0.1, 0.35 + chaos * 0.35);
      const segs = rint(rng, 4, 6 + Math.round(chaos * 8));
      ev.segT = []; ev.rates = []; ev.bfs = [];
      for (let i = 0; i < segs; i++) {
        // jitter inside each slot keeps times strictly increasing
        ev.segT.push(((i + rng() * 0.9) / segs) * ev.dur);
        ev.rates.push(rexp(rng, 0.08, 4));
        ev.bfs.push(rexp(rng, 300, 9000));
      }
      ev.segT[0] = 0;
      ev.q = rrange(rng, 1, 8);
      ev.g = rrange(rng, 0.3, 0.6);
      break;
    }
    case 'modem': { // FSK carrier chatter, dial-up style
      ev.n = rint(rng, 6, 10 + Math.round(chaos * 14));
      ev.iv = rrange(rng, 0.012, 0.04);
      ev.dur = ev.n * ev.iv;
      ev.freqs = []; ev.gates = [];
      const base = rpick(rng, [600, 800, 1200, 1600, 2100]);
      for (let i = 0; i < ev.n; i++) {
        ev.freqs.push(base * rpick(rng, [0.5, 1, 1, 1.5, 2, 3]));
        ev.gates.push(rng() < 0.82);
      }
      ev.g = rrange(rng, 0.2, 0.4);
      break;
    }
    case 'grind':  // overdriven low growl
      ev.f = rexp(rng, 40, 220);
      ev.dur = rrange(rng, 0.08, 0.3 + chaos * 0.2);
      ev.k = rint(rng, 4, 24);           // waveshaper drive
      ev.lp = rexp(rng, 300, 2400);
      ev.g = rrange(rng, 0.3, 0.55);
      ev.det = rrange(rng, 3, 25);       // detune cents-ish (Hz offset)
      break;
    case 'kick':   // pitch-drop sine kick + click transient
      ev.f0 = rrange(rng, 100, 190);
      ev.f1 = rrange(rng, 38, 55);
      ev.dur = rrange(rng, 0.12, 0.28);
      ev.g = rrange(rng, 0.75, 0.95);
      ev.clickG = rrange(rng, 0.15, 0.45);
      ev.pan = 0;
      ev.jit = 0; // kicks stay on the grid
      break;
  }
  return ev;
}

function generatePattern(seed, bpm, bars, density, chaos, palette, repeat, kick = 0, wgts = null, flt = 0, tonal = null) {
  const rng = mulberry32(seed);
  const steps = bars * 16;
  const stepDur = 60 / bpm / 4;

  // palette weights scaled by per-voice WGT sliders; drop zeroed voices
  const base = PALETTES[palette];
  let weights = {};
  for (const k in base) {
    const w = base[k] * (wgts && wgts[k] !== undefined ? wgts[k] : 1);
    if (w > 0) weights[k] = w;
  }
  if (Object.keys(weights).length === 0) weights = Object.assign({}, base);

  const events = []; // { step, frac, ...voice params }
  const baseProb = 0.12 + density * 0.72;

  for (let s = 0; s < steps; s++) {
    let prob = baseProb;
    if (s % 8 === 0) prob = Math.min(1, prob * 1.5);   // downbeat emphasis
    if (s % 16 === 12) prob *= 0.6;                     // breathe before bar turn
    const hits = rng() < prob ? (rng() < chaos * 0.45 ? 2 : 1) : 0;
    for (let h = 0; h < hits; h++) {
      let type = pickWeighted(rng, weights);
      if (s % 16 === 0 && weights.sub > 0 && rng() < 0.4) type = 'sub';
      const ev = generateEvent(rng, type, chaos, stepDur);
      ev.step = s;
      // random fx sends (kicks stay dry — they're added separately below)
      if (rng() < 0.32) ev.rvb = rrange(rng, 0.25, 0.95);
      if (rng() < 0.28) ev.dly = rrange(rng, 0.25, 0.9);
      events.push(ev);
    }
  }
  // guarantee non-empty pattern
  if (events.length === 0) {
    const ev = generateEvent(rng, 'blip', chaos, stepDur);
    ev.step = 0;
    events.push(ev);
  }

  /* ── kick layer: quarter-note grid so the beat stays legible ──── */
  const kickProb = kick * (wgts && wgts.kick !== undefined ? wgts.kick : 1);
  if (kickProb > 0) {
    for (let s = 0; s < steps; s += 2) {
      let p = 0;
      if (s % 4 === 0) p = s % 16 === 0 ? Math.min(1, kickProb * 1.3) : kickProb * 0.8;
      else p = kickProb * chaos * 0.18; // occasional offbeat push
      if (rng() < p) {
        const ev = generateEvent(rng, 'kick', chaos, stepDur);
        ev.step = s;
        events.push(ev);
      }
    }
  }

  /* ── bassline: scale-degree walk in the chosen key/mode ───────── */
  const scale = tonal ? (MODES[tonal.mode] || MODES.aeolian) : null;
  const bassAmt = tonal ? tonal.bass * (wgts && wgts.bass !== undefined ? wgts.bass : 1) : 0;
  if (bassAmt > 0) {
    const rootMidi = 36 + tonal.key; // C2..B2 register
    const degPool = [0, 0, 0, 4, 4, 2, 7, 5, 1, 3]; // root-heavy
    let lastDeg = 0;
    for (let s = 0; s < steps; s++) {
      const onGrid = s % 2 === 0;
      const prob = onGrid ? bassAmt * (s % 8 === 0 ? 1.15 : 0.7)
                          : bassAmt * chaos * 0.25; // syncopated pushes
      if (rng() < prob) {
        const deg = rng() < 0.35 ? lastDeg : rpick(rng, degPool);
        lastDeg = deg;
        const f = degFreq(rootMidi, scale, deg);
        const ev = {
          type: 'bass', step: s, pan: rrange(rng, -0.15, 0.15), jit: 0,
          f, dur: stepDur * rrange(rng, 0.9, 2.4), g: rrange(rng, 0.5, 0.75),
          cutoff: f * rrange(rng, 3, 9), res: rrange(rng, 2, 11),
          wave: rng() < 0.7 ? 'sawtooth' : 'square',
        };
        if (rng() < 0.22 + chaos * 0.2) ev.f2 = degFreq(rootMidi, scale, rpick(rng, degPool)); // slide
        if (rng() < 0.2) ev.dly = rrange(rng, 0.15, 0.4);
        events.push(ev);
      }
    }
  }

  /* ── pads: tertian chord stacks from the mode, one per bar max ── */
  const padAmt = tonal ? tonal.pad * (wgts && wgts.pad !== undefined ? wgts.pad : 1) : 0;
  if (padAmt > 0) {
    const rootMidi = 48 + tonal.key; // C3..B3 register
    for (let b = 0; b < bars; b++) {
      if (rng() < padAmt * 0.85) {
        const baseDeg = rpick(rng, [0, 0, 3, 4, 5, 2]);
        const degs = [baseDeg, baseDeg + 2, baseDeg + 4];
        if (rng() < 0.5) degs.push(baseDeg + 6);  // 7th
        if (rng() < 0.3) degs.push(baseDeg + 8);  // 9th
        events.push({
          type: 'pad', step: b * 16, frac: 0, jit: 0, pan: 0,
          fs: degs.map(d => degFreq(rootMidi, scale, d)),
          dur: stepDur * 16 * rrange(rng, 0.95, 1.9),
          att: rrange(rng, 0.2, 1.1),
          g: rrange(rng, 0.14, 0.26),
          cutoff: rexp(rng, 700, 3200),
          det: rrange(rng, 0.002, 0.008),
          wave: rng() < 0.7 ? 'sawtooth' : 'triangle',
          rvb: rrange(rng, 0.45, 0.9),
        });
      }
    }
  }

  /* ── beat repeat: capture a slice, restamp it forward ──────────
     Three flavours per pass (chosen by rng): plain echo, pitched
     echo (rising or diving), and roll (slice length halves each
     repeat — classic stutter-edit build). Clones can land between
     steps via ev.frac. */
  const passes = Math.round(repeat * (bars + 1) * (0.6 + rng() * 1.1));
  for (let p = 0; p < passes; p++) {
    const len = rpick(rng, [1, 1, 2, 2, 4]);
    const start = rint(rng, 0, Math.max(0, steps - len * 2));
    // kick/bass/pad excluded: pulse stays put, tonal layer stays in key
    const src = events.filter(e => !e.rep && e.type !== 'kick' && e.type !== 'bass' && e.type !== 'pad' &&
                                   e.step >= start && e.step < start + len);
    if (!src.length) continue;
    const reps = rint(rng, 2, 3 + Math.round(chaos * 5));
    const flavour = rng();
    const pitchRatio = flavour < 0.3 ? rrange(rng, 1.05, 1.35)
                     : flavour < 0.6 ? rrange(rng, 0.65, 0.95) : 1;
    const gainDecay = rrange(rng, 0.68, 1.0);
    const roll = rng() < 0.45;
    let pos = start + len;
    let curLen = len;
    for (let r = 1; r <= reps && pos < steps; r++) {
      if (roll && curLen > 0.5) curLen /= 2;
      const scale = curLen / len;
      for (const e of src) {
        const abs = pos + (e.step + (e.frac || 0) - start) * scale;
        if (abs >= steps) continue;
        const c = Object.assign({}, e);
        for (const key of ['offs', 'amps', 'segT', 'rates', 'bfs', 'freqs', 'gates'])
          if (c[key]) c[key] = c[key].slice();
        c.rep = true;
        c.step = Math.floor(abs);
        c.frac = abs - c.step;
        const pr = Math.pow(pitchRatio, r);
        for (const key of ['f', 'f0', 'f1', 'c', 'hp', 'bp'])
          if (c[key]) c[key] = Math.min(16000, c[key] * pr);
        if (c.freqs) c.freqs = c.freqs.map(x => Math.min(16000, x * pr));
        if (c.bfs) c.bfs = c.bfs.map(x => Math.min(16000, x * pr));
        const gd = Math.pow(gainDecay, r);
        if (c.g) c.g *= gd;
        if (c.amps) c.amps = c.amps.map(a => a * gd);
        events.push(c);
      }
      pos += curLen;
    }
  }
  events.sort((a, b) => (a.step + (a.frac || 0)) - (b.step + (b.frac || 0)));

  /* ── chaotic master filter jumps, locked to event positions ───── */
  const fjumps = [];
  if (flt > 0) {
    for (const e of events) {
      if (e.type === 'kick' || e.type === 'pad') continue;
      if (rng() < flt * 0.45) {
        fjumps.push({
          step: e.step, frac: e.frac || 0,
          f: rexp(rng, 120, 9000),
          q: rrange(rng, 3, 16),
          glide: rrange(rng, 0.05, 0.6),
          mode: rng() < 0.6 ? 'snap' : 'sweep',
          ch: rint(rng, 0, 2),           // 0=L 1=R 2=both
        });
      }
    }
  }

  return { seed, bpm, bars, steps, stepDur, density, chaos, palette, repeat, kick, flt, events, fjumps };
}

/* ── shared deterministic noise buffer (per context) ────────────── */
const noiseCache = new WeakMap();
function getNoiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * 2);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const nr = mulberry32(0xC0FFEE);
    for (let i = 0; i < len; i++) d[i] = nr() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

const driveCurveCache = new Map();
function getDriveCurve(k) {
  let c = driveCurveCache.get(k);
  if (!c) {
    c = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      const x = (i / 2047) * 2 - 1;
      c[i] = Math.tanh(x * k) / Math.tanh(k);
    }
    driveCurveCache.set(k, c);
  }
  return c;
}

const crushCurveCache = new Map();
function getCrushCurve(levels) {
  let c = crushCurveCache.get(levels);
  if (!c) {
    c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      c[i] = Math.round(x * levels) / levels;
    }
    crushCurveCache.set(levels, c);
  }
  return c;
}

/* ── master chain ─────────────────────────────────────────────────
   input → drive → chaos LPF (stereo pair) → glue comp → tape sat →
   hi-shelf → safety comp → clip
   FX returns re-enter at the glue comp, skipping drive and the
   jumping filters so tails stay smooth. The last two stages are
   fixed and guarantee output never exceeds full scale. */
function driveGains(drive01) {
  const pre = 1 + drive01 * 11;
  return { pre, post: 1 / Math.pow(pre, 0.55) };
}
function tapeGains(tape01) {
  const pre = 1 + tape01 * 3;
  return { pre, post: 1 / Math.pow(pre, 0.6) };
}
function glueSettings(glue01) {
  return { threshold: -2 - glue01 * 22, makeup: 1 + glue01 * 0.9 };
}
const SHELF_FREQ = 5500;
const tapeLPFreq = (tape01) => 18000 - tape01 * 9000; // head rolloff 18k→9k

function buildMaster(ctx, ms = { drive: 0, shelfCut: 0, tape: 0, glue: 0 }) {
  const input = ctx.createGain();
  input.gain.value = 0.8;

  // DRIVE: variable pre-gain into a fixed tanh stage, level-compensated.
  const dg = driveGains(ms.drive);
  const preDrive = ctx.createGain();
  preDrive.gain.value = dg.pre;
  const driveShaper = ctx.createWaveShaper();
  driveShaper.curve = getDriveCurve(2.5);
  driveShaper.oversample = '2x';
  const postDrive = ctx.createGain();
  postDrive.gain.value = dg.post;

  // CHAOS LPF: independent resonant lowpass per channel; cutoffs rest
  // wide open and get yanked around by pattern-scheduled jumps
  const split = ctx.createChannelSplitter(2);
  const lpfL = ctx.createBiquadFilter();
  const lpfR = ctx.createBiquadFilter();
  for (const f of [lpfL, lpfR]) {
    f.type = 'lowpass';
    f.frequency.value = 16000;
    f.Q.value = 0.8;
  }
  const merge = ctx.createChannelMerger(2);

  // GLUE: musical bus compressor (amount = threshold depth + makeup)
  const gs = glueSettings(ms.glue);
  const busComp = ctx.createDynamicsCompressor();
  busComp.threshold.value = gs.threshold;
  busComp.knee.value = 6;
  busComp.ratio.value = 4;
  busComp.attack.value = 0.01;
  busComp.release.value = 0.15;
  const makeup = ctx.createGain();
  makeup.gain.value = gs.makeup;

  // TAPE: gentle tanh saturation + high rolloff, level-compensated
  const tg = tapeGains(ms.tape);
  const preTape = ctx.createGain();
  preTape.gain.value = tg.pre;
  const tapeShaper = ctx.createWaveShaper();
  tapeShaper.curve = getDriveCurve(1.5);
  tapeShaper.oversample = '2x';
  const postTape = ctx.createGain();
  postTape.gain.value = tg.post;
  const tapeLP = ctx.createBiquadFilter();
  tapeLP.type = 'lowpass';
  tapeLP.frequency.value = tapeLPFreq(ms.tape);
  tapeLP.Q.value = 0.5;

  // HI-SHELF: tames harsh top end, cut only
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = SHELF_FREQ;
  shelf.gain.value = -ms.shelfCut;

  // SAFETY: fixed limiter compressor
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -6;
  comp.knee.value = 2;
  comp.ratio.value = 20;
  comp.attack.value = 0.002;
  comp.release.value = 0.08;

  // hard safety clipper: soft tanh drive into an absolute clamp
  const clip = ctx.createWaveShaper();
  const curve = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    const x = (i / 4095) * 2 - 1;
    let y = Math.tanh(x * 1.4) / Math.tanh(1.4);
    curve[i] = Math.max(-0.97, Math.min(0.97, y));
  }
  clip.curve = curve;
  clip.oversample = '4x';

  const out = ctx.createGain();
  out.gain.value = 0.95;

  input.connect(preDrive).connect(driveShaper).connect(postDrive).connect(split);
  split.connect(lpfL, 0);
  split.connect(lpfR, 1);
  lpfL.connect(merge, 0, 0);
  lpfR.connect(merge, 0, 1);
  merge.connect(busComp).connect(makeup)
       .connect(preTape).connect(tapeShaper).connect(postTape).connect(tapeLP)
       .connect(shelf)
       .connect(comp).connect(clip).connect(out);
  return { input, out, preDrive, postDrive, lpfL, lpfR, fxReturn: busComp,
           busComp, makeup, preTape, postTape, tapeLP, shelf };
}

/* yank a chaos filter at time t; snap = instant cut + glide open,
   sweep = dive to the target then recover */
function scheduleFilterJump(master, j, t) {
  const filters = j.ch === 0 ? [master.lpfL] : j.ch === 1 ? [master.lpfR] : [master.lpfL, master.lpfR];
  for (const flt of filters) {
    const f = flt.frequency, q = flt.Q;
    f.cancelScheduledValues(t);
    q.cancelScheduledValues(t);
    if (j.mode === 'snap') {
      f.setValueAtTime(j.f, t);
    } else {
      f.setValueAtTime(16000, t);
      f.exponentialRampToValueAtTime(j.f, t + j.glide * 0.4);
    }
    f.exponentialRampToValueAtTime(16000, t + j.glide);
    q.setValueAtTime(j.q, t);
    q.linearRampToValueAtTime(0.8, t + j.glide);
  }
}

/* ── fx buses: quadraverb-style reverb + tempo ping-pong delay ──── */
const irCache = new WeakMap();
function getVerbIR(ctx) {
  let ir = irCache.get(ctx);
  if (!ir) {
    const sr = ctx.sampleRate, dur = 2.4, len = Math.floor(sr * dur);
    ir = ctx.createBuffer(2, len, sr);
    const rng = mulberry32(0x51A7E5);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      // sparse bright early reflections, first 90ms
      for (let k = 0; k < 14; k++) {
        const i = Math.floor(rng() * sr * 0.09);
        if (i < len) d[i] += (rng() * 2 - 1) * 0.6;
      }
      // dense decaying tail — kept full-bandwidth for that bright
      // late-80s digital sheen
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const envIn = t < 0.012 ? t / 0.012 : 1;
        d[i] += (rng() * 2 - 1) * Math.exp(-3.2 * t / dur) * envIn * 0.5;
      }
    }
    irCache.set(ctx, ir);
  }
  return ir;
}

function buildFx(ctx, returnNode) {
  // reverb
  const verbIn = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = getVerbIR(ctx);
  const verbHP = ctx.createBiquadFilter();
  verbHP.type = 'highpass'; verbHP.frequency.value = 220;
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.8;
  verbIn.connect(conv).connect(verbHP).connect(verbOut).connect(returnNode);

  // ping-pong delay: L → R → feedback → L, hard-panned taps
  const dlyIn = ctx.createGain();
  const dL = ctx.createDelay(5);
  const dR = ctx.createDelay(5);
  const fb = ctx.createGain();
  fb.gain.value = 0.42;
  const fbTone = ctx.createBiquadFilter();
  fbTone.type = 'lowpass'; fbTone.frequency.value = 3800;
  const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (panL.pan) { panL.pan.value = -0.85; panR.pan.value = 0.85; }
  const dlyOut = ctx.createGain();
  dlyOut.gain.value = 0.85;
  dlyIn.connect(dL);
  dL.connect(panL).connect(dlyOut);
  dL.connect(dR);
  dR.connect(panR).connect(dlyOut);
  dR.connect(fb).connect(fbTone).connect(dL);
  dlyOut.connect(returnNode);

  return { verbIn, dlyIn, dL, dR };
}

function setFxTimes(fx, stepDur) {
  const t = Math.min(4.9, stepDur * 3); // dotted eighth per hop
  fx.dL.delayTime.value = t;
  fx.dR.delayTime.value = t;
}

/* ── voice scheduling (context-agnostic) ────────────────────────── */
function env(param, when, peak, dur, attack = 0.0008) {
  param.setValueAtTime(0.0001, when);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
  param.exponentialRampToValueAtTime(0.0001, when + attack + dur);
}

function panNode(ctx, dest, pan) {
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (p.pan) p.pan.value = pan;
  p.connect(dest);
  return p;
}

function scheduleEvent(ctx, dest, ev, when, fx) {
  const out = panNode(ctx, dest, ev.pan);
  // random per-event fx sends, scaled by the live send sliders
  if (fx) {
    if (ev.rvb && fx.rvbLvl > 0) {
      const s = ctx.createGain();
      s.gain.value = ev.rvb * fx.rvbLvl;
      out.connect(s); s.connect(fx.verbIn);
    }
    if (ev.dly && fx.dlyLvl > 0) {
      const s = ctx.createGain();
      s.gain.value = ev.dly * fx.dlyLvl;
      out.connect(s); s.connect(fx.dlyIn);
    }
  }
  const noiseBuf = getNoiseBuffer(ctx);
  const stopAt = [];

  const mkNoise = () => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.loopStart = 0; s.loopEnd = noiseBuf.duration;
    return s;
  };

  switch (ev.type) {
    case 'click': {
      const src = mkNoise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = ev.hp;
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur, 0.0004);
      src.connect(hp).connect(g).connect(out);
      src.start(when); src.stop(when + ev.dur + 0.02);
      break;
    }
    case 'blip': {
      const o = ctx.createOscillator();
      o.type = ev.wave;
      o.frequency.setValueAtTime(ev.f, when);
      if (ev.slide !== 1)
        o.frequency.exponentialRampToValueAtTime(ev.f * ev.slide, when + ev.dur);
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.02);
      break;
    }
    case 'noise': case 'hiss': {
      const src = mkNoise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = ev.f; bp.Q.value = ev.q;
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur, ev.type === 'hiss' ? 0.03 : 0.001);
      src.connect(bp).connect(g).connect(out);
      src.start(when); src.stop(when + ev.dur + 0.05);
      break;
    }
    case 'sub': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(ev.f0, when);
      o.frequency.exponentialRampToValueAtTime(ev.f1, when + ev.dur * 0.8);
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur, 0.002);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.05);
      break;
    }
    case 'zap': {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(ev.f0, when);
      o.frequency.exponentialRampToValueAtTime(ev.f1, when + ev.dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = ev.q;
      lp.frequency.setValueAtTime(ev.f0 * 1.4, when);
      lp.frequency.exponentialRampToValueAtTime(ev.f1 * 2.5, when + ev.dur);
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur);
      o.connect(lp).connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.02);
      break;
    }
    case 'fm': {
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      car.frequency.value = ev.c;
      mod.frequency.value = ev.c * ev.ratio;
      mg.gain.setValueAtTime(ev.idx, when);
      mg.gain.exponentialRampToValueAtTime(1, when + ev.dur);
      mod.connect(mg).connect(car.frequency);
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur);
      car.connect(g).connect(out);
      car.start(when); mod.start(when);
      car.stop(when + ev.dur + 0.02); mod.stop(when + ev.dur + 0.02);
      break;
    }
    case 'stutter': {
      for (let i = 0; i < ev.n; i++) {
        const t = when + i * ev.iv;
        const amp = ev.g * Math.pow(ev.decay, i);
        if (amp < 0.01) break;
        const g = ctx.createGain();
        env(g.gain, t, amp, ev.sdur, 0.0006);
        if (ev.noise) {
          const src = mkNoise();
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = ev.f; bp.Q.value = 3;
          src.connect(bp).connect(g).connect(out);
          src.start(t); src.stop(t + ev.sdur + 0.02);
        } else {
          const o = ctx.createOscillator();
          o.type = 'square'; o.frequency.value = ev.f;
          o.connect(g).connect(out);
          o.start(t); o.stop(t + ev.sdur + 0.02);
        }
      }
      break;
    }
    case 'crackle': {
      for (let i = 0; i < ev.n; i++) {
        const t = when + ev.offs[i];
        const src = mkNoise();
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = ev.hp;
        const g = ctx.createGain();
        env(g.gain, t, ev.amps[i], 0.004, 0.0003);
        src.connect(hp).connect(g).connect(out);
        src.start(t); src.stop(t + 0.015);
      }
      break;
    }
    case 'crush': {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = ev.f;
      const ws = ctx.createWaveShaper();
      ws.curve = getCrushCurve(ev.levels);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = ev.bp; bp.Q.value = 1.5;
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur);
      o.connect(ws).connect(bp).connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.02);
      break;
    }
    case 'tape': {
      const o = ctx.createOscillator();
      o.type = ev.wave;
      o.frequency.setValueAtTime(ev.f, when);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, ev.f * ev.drop), when + ev.dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 1;
      lp.frequency.setValueAtTime(ev.f * 4, when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(40, ev.f * ev.drop * 4), when + ev.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(ev.g, when + 0.004);
      g.gain.setValueAtTime(ev.g, when + ev.dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, when + ev.dur);
      o.connect(lp).connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.02);
      break;
    }
    case 'databend': {
      const src = mkNoise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = ev.q;
      for (let i = 0; i < ev.segT.length; i++) {
        src.playbackRate.setValueAtTime(ev.rates[i], when + ev.segT[i]);
        bp.frequency.setValueAtTime(ev.bfs[i], when + ev.segT[i]);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(ev.g, when + 0.003);
      g.gain.setValueAtTime(ev.g, when + ev.dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, when + ev.dur);
      src.connect(bp).connect(g).connect(out);
      src.start(when); src.stop(when + ev.dur + 0.03);
      break;
    }
    case 'modem': {
      const o = ctx.createOscillator();
      o.type = 'square';
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      for (let i = 0; i < ev.n; i++) {
        const t = when + i * ev.iv;
        o.frequency.setValueAtTime(ev.freqs[i], t);
        g.gain.setValueAtTime(ev.gates[i] ? ev.g : 0.0001, t);
      }
      g.gain.setValueAtTime(0.0001, when + ev.dur);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.02);
      break;
    }
    case 'grind': {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = ev.f;
      o2.frequency.value = ev.f + ev.det;
      const ws = ctx.createWaveShaper();
      ws.curve = getDriveCurve(ev.k);
      ws.oversample = '2x';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = ev.lp; lp.Q.value = 2;
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur, 0.003);
      o1.connect(ws); o2.connect(ws);
      ws.connect(lp).connect(g).connect(out);
      o1.start(when); o2.start(when);
      o1.stop(when + ev.dur + 0.02); o2.stop(when + ev.dur + 0.02);
      break;
    }
    case 'bass': {
      const o = ctx.createOscillator();
      o.type = ev.wave;
      o.frequency.setValueAtTime(ev.f, when);
      if (ev.f2) o.frequency.exponentialRampToValueAtTime(ev.f2, when + ev.dur * 0.9);
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(ev.f * 0.5, when);
      if (ev.f2) sub.frequency.exponentialRampToValueAtTime(ev.f2 * 0.5, when + ev.dur * 0.9);
      const subG = ctx.createGain();
      subG.gain.value = 0.35;
      // acid filter: opens on the pluck, sweeps shut over the note
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = ev.res;
      lp.frequency.setValueAtTime(Math.min(16000, ev.cutoff * 2.5), when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(60, ev.cutoff * 0.5), when + ev.dur * 0.7);
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur, 0.004);
      o.connect(lp);
      sub.connect(subG).connect(lp);
      lp.connect(g).connect(out);
      o.start(when); sub.start(when);
      o.stop(when + ev.dur + 0.05); sub.stop(when + ev.dur + 0.05);
      break;
    }
    case 'pad': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = ev.cutoff; lp.Q.value = 0.8;
      const g = ctx.createGain();
      const att = Math.min(ev.att, ev.dur * 0.4);
      const rel = Math.min(1.2, ev.dur * 0.3);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(ev.g, when + att);
      g.gain.setValueAtTime(ev.g, when + ev.dur - rel);
      g.gain.linearRampToValueAtTime(0.0001, when + ev.dur);
      lp.connect(g).connect(out);
      const noteG = 0.9 / (ev.fs.length * 2);
      ev.fs.forEach((f, i) => {
        const pn = panNode(ctx, lp, (i % 2 ? 1 : -1) * (0.25 + 0.12 * i));
        for (const sgn of [1, -1]) {
          const o = ctx.createOscillator();
          o.type = ev.wave;
          o.frequency.value = f * (1 + sgn * ev.det);
          const ng = ctx.createGain();
          ng.gain.value = noteG;
          o.connect(ng).connect(pn);
          o.start(when); o.stop(when + ev.dur + 0.1);
        }
      });
      break;
    }
    case 'kick': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(ev.f0, when);
      o.frequency.exponentialRampToValueAtTime(ev.f1, when + ev.dur * 0.45);
      const g = ctx.createGain();
      env(g.gain, when, ev.g, ev.dur, 0.0012);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + ev.dur + 0.05);
      // click transient for attack definition
      const c = mkNoise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2800;
      const cg = ctx.createGain();
      env(cg.gain, when, ev.clickG, 0.006, 0.0004);
      c.connect(hp).connect(cg).connect(out);
      c.start(when); c.stop(when + 0.02);
      break;
    }
  }
  return stopAt;
}

/* ── wav encoding: stereo 16-bit pcm ────────────────────────────── */
function encodeWav(audioBuffer) {
  const nCh = 2, sr = audioBuffer.sampleRate, len = audioBuffer.length;
  const bytesPerSample = 2, blockAlign = nCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };

  wstr(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);            // PCM
  v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true);           // bits
  wstr(36, 'data'); v.setUint32(40, dataSize, true);

  const L = audioBuffer.getChannelData(0);
  const R = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : L;
  let off = 44;
  for (let i = 0; i < len; i++) {
    let l = Math.max(-1, Math.min(1, L[i]));
    let r = Math.max(-1, Math.min(1, R[i]));
    v.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7FFF, true); off += 2;
    v.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7FFF, true); off += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/* ═══════════════════════════════════════════════════════════════════
   APP STATE + UI
   ═══════════════════════════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);

const state = {
  ctx: null,
  master: null,
  analyser: null,
  pattern: null,
  playing: false,
  schedTimer: null,
  nextStep: 0,
  nextTime: 0,
  seed: (Math.random() * 0xFFFFFFFF) >>> 0,
  sampleRate: 48000,
  flashQueue: [],   // { time, type, pan }
  stepMap: null,    // step index -> [events]
  clipHold: 0,
};

const VOICE_TAGS = {
  kick: 'KCK', bass: 'BSS', pad: 'P4D', click: 'CLK', blip: 'BLP', noise: 'NSE',
  hiss: 'HSS', sub: 'SUB', zap: 'ZAP', fm: 'FM_', stutter: 'STT', crackle: 'CRK',
  crush: 'CRH', tape: 'TPS', databend: 'DBN', modem: 'MDM', grind: 'GRD',
};
const VOICE_NAMES = {
  kick: 'kick drum', bass: 'bassline', pad: 'pad chords', click: 'impulse click',
  blip: 'sine blip', noise: 'noise burst', hiss: 'hiss wash', sub: 'sub drop',
  zap: 'filter zap', fm: 'fm metal', stutter: 'stutter ratchet', crackle: 'crackle',
  crush: 'bitcrush tone', tape: 'tape stop', databend: 'databend',
  modem: 'modem fsk', grind: 'grind saw',
};
const VOICE_ORDER = ['kick', 'bass', 'pad', 'sub', 'click', 'blip', 'noise', 'hiss',
                     'zap', 'fm', 'stutter', 'crackle', 'crush', 'tape', 'databend',
                     'modem', 'grind'];

/* per-voice modifiers: lvl gain ×, pit pitch ×, dec time ×, wgt weight × */
const voiceParams = {};
for (const t of VOICE_ORDER) voiceParams[t] = { lvl: 1, pit: 1, dec: 1, wgt: 1 };

const PITCH_KEYS = ['f', 'f0', 'f1', 'f2', 'c', 'hp', 'bp', 'lp', 'cutoff'];
const TIME_KEYS = ['dur', 'iv', 'sdur', 'att'];
const clampF = (v) => Math.min(18000, Math.max(10, v));

/* applied at schedule time (live + export), so LVL/PIT/DEC react instantly
   without regenerating the pattern */
function applyVoiceMods(ev) {
  const m = voiceParams[ev.type];
  if (!m || (m.lvl === 1 && m.pit === 1 && m.dec === 1)) return ev;
  const c = Object.assign({}, ev);
  if (m.pit !== 1) {
    for (const k of PITCH_KEYS) if (c[k] !== undefined) c[k] = clampF(c[k] * m.pit);
    if (c.freqs) c.freqs = c.freqs.map(x => clampF(x * m.pit));
    if (c.bfs) c.bfs = c.bfs.map(x => clampF(x * m.pit));
    if (c.fs) c.fs = c.fs.map(x => clampF(x * m.pit));
  }
  if (m.dec !== 1) {
    for (const k of TIME_KEYS) if (c[k] !== undefined) c[k] *= m.dec;
    if (c.offs) c.offs = c.offs.map(x => x * m.dec);
    if (c.segT) c.segT = c.segT.map(x => x * m.dec);
  }
  if (m.lvl !== 1) {
    if (c.g !== undefined) c.g = Math.min(1.2, c.g * m.lvl);
    if (c.clickG !== undefined) c.clickG = Math.min(1.2, c.clickG * m.lvl);
    if (c.amps) c.amps = c.amps.map(a => Math.min(1.2, a * m.lvl));
  }
  return c;
}

function masterSettings() {
  return {
    drive: parseInt($('drive').value, 10) / 100,
    shelfCut: parseInt($('shelf').value, 10),
    tape: parseInt($('tape').value, 10) / 100,
    glue: parseInt($('glue').value, 10) / 100,
  };
}

/* retune the live master bus in place — no rebuild, no clicks */
function applyMasterLive() {
  const m = state.master;
  if (!m) return;
  const ms = masterSettings();
  const dg = driveGains(ms.drive);
  m.preDrive.gain.value = dg.pre;
  m.postDrive.gain.value = dg.post;
  const gs = glueSettings(ms.glue);
  m.busComp.threshold.value = gs.threshold;
  m.makeup.gain.value = gs.makeup;
  const tg = tapeGains(ms.tape);
  m.preTape.gain.value = tg.pre;
  m.postTape.gain.value = tg.post;
  m.tapeLP.frequency.value = tapeLPFreq(ms.tape);
  m.shelf.gain.value = -ms.shelfCut;
}

function ensureCtx() {
  if (state.ctx && state.ctx.sampleRate === state.sampleRate) return state.ctx;
  if (state.ctx) state.ctx.close();
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: state.sampleRate });
  const master = buildMaster(ctx, masterSettings());
  const fx = buildFx(ctx, master.fxReturn);
  if (state.pattern) setFxTimes(fx, state.pattern.stepDur);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;
  master.out.connect(analyser);
  analyser.connect(ctx.destination);
  state.ctx = ctx; state.master = master; state.fx = fx; state.analyser = analyser;
  return ctx;
}

/* ── generate ───────────────────────────────────────────────────── */
function readParams() {
  return {
    bpm: Math.max(20, Math.min(999, parseInt($('bpm').value, 10) || 120)),
    bars: parseInt($('bars').value, 10),
    density: parseInt($('density').value, 10) / 100,
    chaos: parseInt($('chaos').value, 10) / 100,
    repeat: parseInt($('repeat').value, 10) / 100,
    kick: parseInt($('kick').value, 10) / 100,
    flt: parseInt($('flt').value, 10) / 100,
    palette: $('palette').value,
    wgts: Object.fromEntries(VOICE_ORDER.map(t => [t, voiceParams[t].wgt])),
    tonal: {
      key: parseInt($('key').value, 10),
      mode: $('mode').value,
      bass: parseInt($('bass').value, 10) / 100,
      pad: parseInt($('pad').value, 10) / 100,
    },
  };
}

function doGenerate(newSeed) {
  const seedField = $('seed');
  if (newSeed) {
    state.seed = (Math.random() * 0xFFFFFFFF) >>> 0;
  } else {
    const parsed = parseInt(seedField.value, 16);
    if (!isNaN(parsed)) state.seed = parsed >>> 0;
  }
  seedField.value = state.seed.toString(16).toUpperCase().padStart(8, '0');

  const p = readParams();
  state.pattern = generatePattern(state.seed, p.bpm, p.bars, p.density, p.chaos, p.palette, p.repeat, p.kick, p.wgts, p.flt, p.tonal);

  // step -> events map for the live scheduler
  const map = new Map();
  for (const ev of state.pattern.events) {
    if (!map.has(ev.step)) map.set(ev.step, []);
    map.get(ev.step).push(ev);
  }
  state.stepMap = map;
  const fmap = new Map();
  for (const j of state.pattern.fjumps) {
    if (!fmap.has(j.step)) fmap.set(j.step, []);
    fmap.get(j.step).push(j);
  }
  state.fltMap = fmap;
  if (state.fx) setFxTimes(state.fx, state.pattern.stepDur);
  state.nextStep = 0;

  logLine(`▓ GEN seed=${seedField.value} ${p.palette} ${p.bpm}bpm ${p.bars}bar ` +
          `d${Math.round(p.density * 100)} c${Math.round(p.chaos * 100)} r${Math.round(p.repeat * 100)}` +
          ` → ${state.pattern.events.length} events`, 'gen');
  drawPatternGrid();
  glitchBurst();
}

/* ── live scheduler ─────────────────────────────────────────────── */
const LOOKAHEAD = 0.12, TICK_MS = 25;

function schedulerTick() {
  const ctx = state.ctx;
  if (!ctx || !state.pattern) return;
  const fxSends = {
    verbIn: state.fx.verbIn, dlyIn: state.fx.dlyIn,
    rvbLvl: parseInt($('rvb').value, 10) / 100,
    dlyLvl: parseInt($('dly').value, 10) / 100,
  };
  while (state.nextTime < ctx.currentTime + LOOKAHEAD) {
    const pat = state.pattern; // re-read: evolve may swap it mid-loop
    const evs = state.stepMap.get(state.nextStep);
    if (evs) {
      for (const ev of evs) {
        const mev = applyVoiceMods(ev);
        const when = state.nextTime + ((mev.frac || 0) + mev.jit) * pat.stepDur;
        scheduleEvent(ctx, state.master.input, mev, Math.max(when, ctx.currentTime + 0.001), fxSends);
        state.flashQueue.push({ time: when, type: mev.type, pan: mev.pan });
        logLine(fmtEvent(mev), 'ev');
      }
    }
    const js = state.fltMap.get(state.nextStep);
    if (js) {
      for (const j of js)
        scheduleFilterJump(state.master, j, Math.max(state.nextTime + j.frac * pat.stepDur, ctx.currentTime + 0.001));
    }
    state.flashQueue.push({ time: state.nextTime, type: '_step', step: state.nextStep });
    state.nextTime += pat.stepDur;
    state.nextStep = (state.nextStep + 1) % pat.steps;
    // evolve: reseed + regenerate at every loop boundary
    if (state.nextStep === 0 && $('evolve').checked) {
      doGenerate(true);
      logLine('∞ 3V0LV3 → mutation', 'sys');
    }
  }
}

function fmtEvent(ev) {
  const tag = VOICE_TAGS[ev.type] || '???';
  const panStr = ev.pan < -0.05 ? `L${Math.round(-ev.pan * 99)}` : ev.pan > 0.05 ? `R${Math.round(ev.pan * 99)}` : 'C00';
  const f = ev.f || ev.f0 || ev.c || ev.hp || (ev.freqs && ev.freqs[0]) || (ev.fs && ev.fs[0]) || 0;
  return `[${String(ev.step).padStart(3, '0')}] ${ev.rep ? '↻' : ' '}${tag} ${f ? Math.round(f) + 'Hz' : '----'} ${panStr}`;
}

async function play() {
  if (state.playing) return;
  if (!state.pattern) doGenerate(false);
  const ctx = ensureCtx();
  await ctx.resume();
  state.playing = true;
  state.nextStep = 0;
  state.nextTime = ctx.currentTime + 0.06;
  state.schedTimer = setInterval(schedulerTick, TICK_MS);
  $('play').textContent = '■ STOP';
  $('play').classList.add('active');
  document.body.classList.add('running');
  logLine('▶ TRANSPORT RUN', 'sys');
}

function stop() {
  if (!state.playing) return;
  state.playing = false;
  clearInterval(state.schedTimer);
  if (state.ctx) state.ctx.suspend();
  state.flashQueue.length = 0;
  $('play').textContent = '▶ PLAY';
  $('play').classList.remove('active');
  document.body.classList.remove('running');
  logLine('■ TRANSPORT HALT', 'sys');
}

/* ── wav export ─────────────────────────────────────────────────── */
async function exportWav() {
  if (!state.pattern) doGenerate(false);
  const pat = state.pattern;
  const sr = state.sampleRate;
  const tail = 3.5; // room for reverb + delay tails
  const dur = pat.steps * pat.stepDur + tail;
  const btn = $('export');
  btn.disabled = true;
  btn.textContent = '▒▒ RENDERING ▒▒';
  logLine(`◈ RENDER ${sr}Hz 16bit stereo ${dur.toFixed(2)}s`, 'sys');

  try {
    const octx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
    const master = buildMaster(octx, masterSettings());
    master.out.connect(octx.destination);
    const fx = buildFx(octx, master.fxReturn);
    setFxTimes(fx, pat.stepDur);
    const fxSends = {
      verbIn: fx.verbIn, dlyIn: fx.dlyIn,
      rvbLvl: parseInt($('rvb').value, 10) / 100,
      dlyLvl: parseInt($('dly').value, 10) / 100,
    };
    for (const ev of pat.events) {
      const mev = applyVoiceMods(ev);
      const when = 0.05 + (mev.step + (mev.frac || 0) + mev.jit) * pat.stepDur;
      scheduleEvent(octx, master.input, mev, Math.max(when, 0), fxSends);
    }
    for (const j of pat.fjumps)
      scheduleFilterJump(master, j, Math.max(0.05 + (j.step + j.frac) * pat.stepDur, 0));
    const rendered = await octx.startRendering();
    const blob = encodeWav(rendered);
    const name = `6117ch3r_${state.seed.toString(16).toUpperCase()}_${pat.bpm}bpm_${sr / 1000}k.wav`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    logLine(`◈ WROTE ${name} (${(blob.size / 1024).toFixed(0)}kB)`, 'gen');
  } catch (err) {
    logLine(`✕ RENDER FAIL: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '◈ EXPORT WAV';
  }
}

/* ── terminal log ───────────────────────────────────────────────── */
const LOG_MAX = 64;
function logLine(text, cls) {
  const log = $('log');
  const el = document.createElement('div');
  el.className = 'logline ' + (cls || '');
  el.textContent = text;
  log.prepend(el);
  while (log.childNodes.length > LOG_MAX) log.removeChild(log.lastChild);
}

/* ── pattern grid render ────────────────────────────────────────── */
function drawPatternGrid() {
  const grid = $('grid');
  grid.innerHTML = '';
  const pat = state.pattern;
  if (!pat) return;
  for (let s = 0; s < pat.steps; s++) {
    const cell = document.createElement('span');
    const evs = state.stepMap.get(s);
    cell.className = 'cell';
    cell.id = 'cell' + s;
    if (evs) {
      cell.textContent = evs.length > 1 ? '▓' : '█';
      cell.classList.add('hit');
      cell.title = evs.map(e => VOICE_TAGS[e.type]).join('+');
    } else {
      cell.textContent = '·';
    }
    if (s % 16 === 0) cell.classList.add('barline');
    grid.appendChild(cell);
  }
}

/* ── visualizer ─────────────────────────────────────────────────── */
const viz = $('viz');
const vc = viz.getContext('2d');
const bg = $('bg');
const bc = bg.getContext('2d');
let vw, vh, bw, bh;

function resize() {
  const r = viz.getBoundingClientRect();
  vw = viz.width = Math.floor(r.width * devicePixelRatio);
  vh = viz.height = Math.floor(r.height * devicePixelRatio);
  bw = bg.width = Math.floor(innerWidth / 2);
  bh = bg.height = Math.floor(innerHeight / 2);
}
window.addEventListener('resize', resize);

const timeData = new Float32Array(2048);
const freqData = new Uint8Array(1024);
let glitchTimer = 0;
const CHARSET = '░▒▓█▄▀▌▐·:;+*#@$%&01?!|/\\<>[]{}';
const asciiRng = mulberry32(0xDEADBEEF);

function glitchBurst() { glitchTimer = 14; }

function drawViz() {
  requestAnimationFrame(drawViz);
  const now = state.ctx ? state.ctx.currentTime : 0;

  /* ambient background: sparse ascii noise + block smear */
  bc.fillStyle = 'rgba(3,4,3,0.18)';
  bc.fillRect(0, 0, bw, bh);
  const n = state.playing ? 26 : 6;
  bc.font = '10px monospace';
  for (let i = 0; i < n; i++) {
    const x = asciiRng() * bw, y = asciiRng() * bh;
    const c = CHARSET[Math.floor(asciiRng() * CHARSET.length)];
    bc.fillStyle = asciiRng() < 0.06 ? 'rgba(255,42,60,0.5)'
      : asciiRng() < 0.5 ? 'rgba(70,255,140,0.16)' : 'rgba(200,255,220,0.08)';
    bc.fillText(c, x, y);
  }
  if ((state.playing && asciiRng() < 0.12) || glitchTimer > 0) {
    const sy = asciiRng() * bh, sh = 4 + asciiRng() * 40;
    bc.drawImage(bg, 0, sy, bw, sh, (asciiRng() - 0.5) * 60, sy, bw, sh);
  }

  /* main scope */
  vc.fillStyle = 'rgba(4,6,5,0.32)';
  vc.fillRect(0, 0, vw, vh);

  if (state.analyser && state.playing) {
    state.analyser.getFloatTimeDomainData(timeData);
    state.analyser.getByteFrequencyData(freqData);

    // spectrum: thin columns, bottom half
    const bins = 96;
    const bwd = vw / bins;
    for (let i = 0; i < bins; i++) {
      const v = freqData[Math.floor(Math.pow(i / bins, 1.6) * freqData.length)] / 255;
      const h = v * vh * 0.42;
      vc.fillStyle = v > 0.82 ? '#ff2a3c' : `rgba(70,255,140,${0.25 + v * 0.75})`;
      vc.fillRect(i * bwd + 1, vh - h, Math.max(1, bwd - 2), h);
    }

    // waveform: crisp white line, upper area
    vc.beginPath();
    const mid = vh * 0.30, amp = vh * 0.24;
    for (let i = 0; i < timeData.length; i++) {
      const x = (i / timeData.length) * vw;
      const y = mid + timeData[i] * amp;
      i ? vc.lineTo(x, y) : vc.moveTo(x, y);
    }
    vc.strokeStyle = 'rgba(235,255,245,0.9)';
    vc.lineWidth = Math.max(1, devicePixelRatio);
    vc.stroke();

    // peak meter + clip lamp
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) peak = Math.max(peak, Math.abs(timeData[i]));
    const db = 20 * Math.log10(peak || 0.00001);
    if (peak > 0.955) state.clipHold = 30;
    vc.font = `${11 * devicePixelRatio}px monospace`;
    vc.fillStyle = state.clipHold > 0 ? '#ff2a3c' : 'rgba(70,255,140,0.85)';
    vc.fillText(`PK ${db.toFixed(1).padStart(6)}dB ${state.clipHold > 0 ? '■LIM' : '     '}`, vw - 150 * devicePixelRatio, 16 * devicePixelRatio);
    if (state.clipHold > 0) state.clipHold--;

    // event flashes + playhead
    while (state.flashQueue.length && state.flashQueue[0].time <= now) {
      const f = state.flashQueue.shift();
      if (f.type === '_step') {
        markPlayhead(f.step);
      } else {
        const x = (f.pan * 0.5 + 0.5) * vw;
        vc.fillStyle = 'rgba(255,255,255,0.85)';
        vc.fillRect(x - 2, 0, 4, vh);
        if (asciiRng() < 0.5) glitchTimer = Math.max(glitchTimer, 3);
      }
    }
  }

  // datamosh smear on the scope
  if (glitchTimer > 0) {
    glitchTimer--;
    const sy = asciiRng() * vh, sh = 6 + asciiRng() * (vh * 0.2);
    vc.drawImage(viz, 0, sy, vw, sh, (asciiRng() - 0.5) * vw * 0.15, sy + (asciiRng() - 0.5) * 8, vw, sh);
    // rgb split slice
    vc.globalCompositeOperation = 'lighter';
    vc.fillStyle = 'rgba(255,0,40,0.05)';
    vc.fillRect(asciiRng() * vw * 0.8, 0, vw * 0.2, vh);
    vc.globalCompositeOperation = 'source-over';
  }
}

let lastPlayhead = -1;
function markPlayhead(step) {
  if (lastPlayhead >= 0) {
    const prev = $('cell' + lastPlayhead);
    if (prev) prev.classList.remove('ph');
  }
  const cur = $('cell' + step);
  if (cur) cur.classList.add('ph');
  lastPlayhead = step;
}

/* ── header title glitcher ──────────────────────────────────────── */
const TITLE = '6 1 1 7 C H 3 R';
setInterval(() => {
  const el = $('title');
  if (!el) return;
  if (Math.random() < 0.22) {
    const chars = TITLE.split('');
    const k = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      if (chars[idx] !== ' ') chars[idx] = CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    el.textContent = chars.join('');
    setTimeout(() => { el.textContent = TITLE; }, 90 + Math.random() * 140);
  }
}, 350);

/* ── voice parameter matrix ─────────────────────────────────────── */
const VP_COLS = [
  { key: 'lvl', min: 0, max: 200, regen: false },
  { key: 'pit', min: 25, max: 400, regen: false },
  { key: 'dec', min: 25, max: 400, regen: false },
  { key: 'wgt', min: 0, max: 300, regen: true },
];

function buildVoicePanel() {
  const host = $('voices');
  host.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'vrow vhead';
  head.innerHTML = '<span></span>' +
    VP_COLS.map(c => `<span>${c.key.toUpperCase()}</span>`).join('');
  host.appendChild(head);

  for (const t of VOICE_ORDER) {
    const row = document.createElement('div');
    row.className = 'vrow';
    const tag = document.createElement('span');
    tag.className = 'vtag';
    tag.textContent = VOICE_TAGS[t];
    tag.title = VOICE_NAMES[t];
    row.appendChild(tag);
    for (const col of VP_COLS) {
      const wrap = document.createElement('span');
      wrap.className = 'vcell';
      const s = document.createElement('input');
      s.type = 'range';
      s.min = col.min; s.max = col.max; s.value = 100;
      s.title = `${VOICE_NAMES[t]} ${col.key.toUpperCase()}: 100% (dblclick=reset)`;
      s.addEventListener('input', () => {
        voiceParams[t][col.key] = parseInt(s.value, 10) / 100;
        s.title = `${VOICE_NAMES[t]} ${col.key.toUpperCase()}: ${s.value}% (dblclick=reset)`;
      });
      if (col.regen) s.addEventListener('change', () => regenSameSeed());
      s.addEventListener('dblclick', () => {
        s.value = 100;
        voiceParams[t][col.key] = 1;
        if (col.regen) regenSameSeed();
      });
      wrap.appendChild(s);
      row.appendChild(wrap);
    }
    host.appendChild(row);
  }
}

function resetVoices() {
  for (const t of VOICE_ORDER) voiceParams[t] = { lvl: 1, pit: 1, dec: 1, wgt: 1 };
  buildVoicePanel();
  regenSameSeed();
  logLine('◌ V01C3 params reset', 'sys');
}

/* ── wire up ────────────────────────────────────────────────────── */
function bindUi() {
  // release focus after click so SPACE/G/E shortcuts never double-trigger a button
  document.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => b.blur()));

  $('generate').addEventListener('click', () => {
    doGenerate(true);
    if (state.playing) { state.nextStep = state.nextStep % state.pattern.steps; }
  });
  $('seed').addEventListener('change', () => doGenerate(false));
  $('play').addEventListener('click', () => (state.playing ? stop() : play()));
  $('export').addEventListener('click', exportWav);

  $('bpm').addEventListener('change', () => regenSameSeed());
  $('bars').addEventListener('change', () => regenSameSeed());
  $('palette').addEventListener('change', () => regenSameSeed());
  $('density').addEventListener('input', () => { $('densityVal').textContent = $('density').value; });
  $('chaos').addEventListener('input', () => { $('chaosVal').textContent = $('chaos').value; });
  $('repeat').addEventListener('input', () => { $('repeatVal').textContent = $('repeat').value; });
  $('kick').addEventListener('input', () => { $('kickVal').textContent = $('kick').value; });
  $('flt').addEventListener('input', () => { $('fltVal').textContent = $('flt').value; });
  $('bass').addEventListener('input', () => { $('bassVal').textContent = $('bass').value; });
  $('pad').addEventListener('input', () => { $('padVal').textContent = $('pad').value; });
  // send sliders are read at schedule time — display only, no regen
  $('rvb').addEventListener('input', () => { $('rvbVal').textContent = $('rvb').value; });
  $('dly').addEventListener('input', () => { $('dlyVal').textContent = $('dly').value; });
  $('density').addEventListener('change', () => regenSameSeed());
  $('chaos').addEventListener('change', () => regenSameSeed());
  $('repeat').addEventListener('change', () => regenSameSeed());
  $('kick').addEventListener('change', () => regenSameSeed());
  $('flt').addEventListener('change', () => regenSameSeed());
  $('key').addEventListener('change', () => regenSameSeed());
  $('mode').addEventListener('change', () => regenSameSeed());
  $('bass').addEventListener('change', () => regenSameSeed());
  $('pad').addEventListener('change', () => regenSameSeed());
  $('vreset').addEventListener('click', resetVoices);

  // master-bus controls are live: no regen, just retune the chain
  for (const [id, valId] of [['drive', 'driveVal'], ['shelf', 'shelfVal'],
                             ['tape', 'tapeVal'], ['glue', 'glueVal']]) {
    $(id).addEventListener('input', () => {
      $(valId).textContent = $(id).value;
      applyMasterLive();
    });
  }

  document.querySelectorAll('input[name=sr]').forEach(r =>
    r.addEventListener('change', () => {
      state.sampleRate = parseInt(r.value, 10);
      logLine(`◌ SR → ${state.sampleRate}Hz`, 'sys');
      if (state.playing) { stop(); state.ctx.close(); state.ctx = null; play(); }
      else if (state.ctx) { state.ctx.close(); state.ctx = null; }
    }));

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); state.playing ? stop() : play(); }
    if (e.key === 'g' || e.key === 'G') doGenerate(true);
    if (e.key === 'e' || e.key === 'E') exportWav();
  });
}

function regenSameSeed() {
  const wasPlaying = state.playing;
  if (wasPlaying) { clearInterval(state.schedTimer); }
  doGenerate(false);
  if (wasPlaying) {
    state.nextStep = 0;
    state.nextTime = state.ctx.currentTime + 0.05;
    state.schedTimer = setInterval(schedulerTick, TICK_MS);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  buildVoicePanel();
  bindUi();
  resize();
  $('seed').value = state.seed.toString(16).toUpperCase().padStart(8, '0');
  doGenerate(false);
  drawViz();
  logLine('6117CH3R v1.0 // audio unit ready // SPACE=run G=gen E=export', 'sys');
});
