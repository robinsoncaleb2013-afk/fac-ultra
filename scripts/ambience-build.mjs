#!/usr/bin/env node
/* Builds the five ambient loops in public/audio/ (docs/architecture/05 §6.5).

   Usage: node scripts/ambience-build.mjs        (needs ffmpeg with libvorbis on PATH)

   Each loop is 30 seconds of mono 22.05 kHz sound made from filtered noise, slow swells and a few
   tones, all from a fixed seed, so the files are reproducible. The end is crossfaded into the start,
   so the loop has no click. The files total well under the 1.25 MB budget (see the WP-6 PR). */
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const SECS = 30;
const N = SR * SECS;
const TAIL = SR * 2; // seconds that are crossfaded back into the start

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White noise through a one-pole low-pass (cut in Hz); calling it twice makes it steeper. */
function lowpass(x, cut) {
  const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) y[i] = s += a * (x[i] - s);
  return y;
}
function highpass(x, cut) {
  const l = lowpass(x, cut);
  return x.map((v, i) => v - l[i]);
}
const noise = (r, len) => Float32Array.from({ length: len }, () => r() * 2 - 1);
const norm = (x, peak = 1) => {
  let m = 1e-9;
  for (const v of x) m = Math.max(m, Math.abs(v));
  return x.map((v) => (v / m) * peak);
};
/** A slow wobble between lo and hi, `hz` times a second, from a phase (loops cleanly when hz * SECS is whole). */
const lfo = (i, hz, ph, lo, hi) => lo + ((hi - lo) * (1 + Math.sin(2 * Math.PI * hz * (i / SR) + ph))) / 2;

function mix(layers) {
  const out = new Float32Array(N + TAIL);
  for (const l of layers) for (let i = 0; i < out.length && i < l.length; i++) out[i] += l[i];
  return out;
}
function addTone(buf, at, secs, f0, f1, gain, shape = "sine") {
  const n = Math.floor(secs * SR);
  let ph = 0;
  for (let k = 0; k < n && at + k < buf.length; k++) {
    const t = k / n;
    const f = f0 + (f1 - f0) * t;
    ph += (2 * Math.PI * f) / SR;
    const env = Math.sin(Math.PI * t) ** 2;
    const v = shape === "square" ? Math.sign(Math.sin(ph)) * 0.5 : Math.sin(ph);
    buf[at + k] += v * env * gain;
  }
}

/** Make it loop: fade the extra tail into the head, drop the tail. */
function loopable(x) {
  const out = x.slice(0, N);
  for (let i = 0; i < TAIL; i++) {
    const k = i / TAIL;
    out[i] = out[i] * Math.sqrt(k) + x[N + i] * Math.sqrt(1 - k);
  }
  return out;
}

const loops = {
  /* Pond and River: running water, crickets, a frog now and then. */
  "amb-pond-river": (r) => {
    const water = lowpass(lowpass(noise(r, N + TAIL), 900), 1400).map((v, i) => v * lfo(i, 0.2, 0, 0.55, 1));
    const ripple = highpass(lowpass(noise(r, N + TAIL), 2800), 700).map((v, i) => v * lfo(i, 0.37, 2, 0.05, 0.3));
    const bugs = new Float32Array(N + TAIL);
    for (let i = 0; i < bugs.length; i++) {
      const gate = Math.max(0, Math.sin(2 * Math.PI * 7 * (i / SR))) ** 3 * lfo(i, 0.1, 1, 0.2, 1);
      bugs[i] = Math.sin(2 * Math.PI * 4400 * (i / SR)) * gate * 0.018;
    }
    const frogs = new Float32Array(N + TAIL);
    for (let t = 2; t < SECS - 1; t += 3 + r() * 5) {
      const at = Math.floor(t * SR);
      addTone(frogs, at, 0.09, 380, 520, 0.06, "square");
      addTone(frogs, at + Math.floor(0.13 * SR), 0.09, 360, 480, 0.05, "square");
    }
    return mix([norm(water, 0.55), norm(ripple, 0.12), bugs, lowpass(frogs, 1600)]);
  },
  /* Lake, Swamp and Mangrove: slow lapping, low night bugs, a deep ribbit. */
  "amb-lake-swamp": (r) => {
    const lap = lowpass(lowpass(noise(r, N + TAIL), 380), 520).map((v, i) => v * lfo(i, 0.13, 0.5, 0.3, 1));
    const hum = new Float32Array(N + TAIL);
    for (let i = 0; i < hum.length; i++) hum[i] = Math.sin(2 * Math.PI * 3000 * (i / SR)) * lfo(i, 0.2, 2, 0, 1) ** 2 * Math.max(0, Math.sin(2 * Math.PI * 11 * (i / SR))) * 0.012;
    const ribbit = new Float32Array(N + TAIL);
    for (let t = 3; t < SECS - 2; t += 5 + r() * 6) {
      const at = Math.floor(t * SR);
      addTone(ribbit, at, 0.18, 130, 95, 0.1, "square");
      addTone(ribbit, at + Math.floor(0.22 * SR), 0.16, 125, 90, 0.08, "square");
    }
    return mix([norm(lap, 0.6), hum, lowpass(ribbit, 700)]);
  },
  /* Coast, Reef and Kelp: waves that swell and fall back, with soft bubbles. */
  "amb-coast-reef": (r) => {
    const wash = highpass(lowpass(noise(r, N + TAIL), 1700), 160);
    const waves = wash.map((v, i) => v * lfo(i, 0.1 * 1.5, 0, 0.12, 1) ** 2);
    const hiss = highpass(lowpass(noise(r, N + TAIL), 6000), 2500).map((v, i) => v * lfo(i, 0.15, 1.2, 0.02, 0.2));
    const bubbles = new Float32Array(N + TAIL);
    for (let t = 1; t < SECS - 1; t += 0.8 + r() * 2.2) {
      const f = 500 + r() * 900;
      addTone(bubbles, Math.floor(t * SR), 0.07, f, f * 1.5, 0.035);
    }
    return mix([norm(waves, 0.6), norm(hiss, 0.1), bubbles]);
  },
  /* Arctic, Deep and Sunken City: cold wind, a deep drone, a far-off sonar ping. */
  "amb-cold-deep": (r) => {
    const base = noise(r, N + TAIL);
    const wind = lowpass(lowpass(base, 420), 520).map((v, i) => v * lfo(i, 0.1, 0, 0.3, 1));
    const drone = new Float32Array(N + TAIL);
    for (let i = 0; i < drone.length; i++) drone[i] = (Math.sin(2 * Math.PI * 55 * (i / SR)) + 0.5 * Math.sin(2 * Math.PI * 82.5 * (i / SR))) * lfo(i, 0.1, 1, 0.5, 1) * 0.06;
    const pings = new Float32Array(N + TAIL);
    for (const t of [6, 19.5]) {
      addTone(pings, Math.floor(t * SR), 1.6, 1200, 1180, 0.03);
      addTone(pings, Math.floor((t + 0.35) * SR), 1.2, 1200, 1180, 0.012);
    }
    return mix([norm(wind, 0.5), drone, pings]);
  },
  /* Canyon, Volcano, Sky and Astral: a warm crackle under a slow airy pad. */
  "amb-fire-sky": (r) => {
    const crackle = new Float32Array(N + TAIL);
    for (let i = 0; i < crackle.length; i++) if (r() < 0.0009) crackle[i] = (r() * 2 - 1) * (0.2 + r() * 0.5);
    const pops = lowpass(highpass(crackle, 300), 3500);
    const rumble = lowpass(lowpass(noise(r, N + TAIL), 140), 200).map((v, i) => v * lfo(i, 0.1, 0, 0.5, 1));
    const pad = new Float32Array(N + TAIL);
    for (let i = 0; i < pad.length; i++) {
      const t = i / SR;
      pad[i] = (Math.sin(2 * Math.PI * 220 * t) * lfo(i, 0.1, 0, 0.2, 1) + Math.sin(2 * Math.PI * 330.5 * t) * lfo(i, 0.2, 2, 0.1, 0.7) + Math.sin(2 * Math.PI * 440.7 * t) * lfo(i, 0.1 * 1.5, 4, 0, 0.5)) * 0.018;
    }
    return mix([norm(rumble, 0.4), pops.map((v) => v * 1.4), pad]);
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "audio");
mkdirSync(out, { recursive: true });
let total = 0;
let seed = 11;
for (const [name, make] of Object.entries(loops)) {
  const raw = loopable(make(prng(seed++)));
  const peak = norm(raw, 0.8);
  const pcm = Buffer.alloc(peak.length * 2);
  peak.forEach((v, i) => pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2));
  const file = join(out, `${name}.ogg`);
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", "pipe:0", "-c:a", "libvorbis", "-q:a", "-0.5", file], { input: pcm });
  if (r.status !== 0) {
    console.error(String(r.stderr || r.error));
    process.exit(1);
  }
  const size = statSync(file).size;
  total += size;
  console.log(`${name}.ogg ${Math.round(size / 1024)} KB`);
}
console.log(`total ${Math.round(total / 1024)} KB (budget 1250 KB)`);
if (total > 1250 * 1024) process.exit(1);
