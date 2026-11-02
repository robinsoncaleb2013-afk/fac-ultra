import { AMBIENCE_GROUPS, CROSSFADE_S, DUCK, SILENT, type AmbienceTarget } from "./ambience.ts";
import { loose } from "./rng.ts";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let enabled = true;

function ac() {
  if (!ctx) ctx = new AudioContext({ latencyHint: "interactive" });
  if (!master || !sfx) {
    master = ctx.createGain();
    sfx = ctx.createGain();
    master.gain.value = 0.9;
    sfx.gain.value = enabled ? 0.85 : 0;
    sfx.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export const audio = {
  unlock() {
    const c = ac();
    unlocked = true;
    if (c.state === "suspended") void c.resume().then(applyAmbience, () => {});
    else applyAmbience();
  },
  /** Ask for this ambience (WP-6). Nothing is fetched or played until the first interaction has unlocked audio. */
  ambient(t: AmbienceTarget) {
    want = t;
    applyAmbience();
  },
  /** Kid Mode is reading a message aloud: the ambience steps back so the voice is clear. */
  duck(on: boolean) {
    ducked = on;
    if (ambOut && ctx) ambOut.gain.setTargetAtTime(on ? DUCK : 1, ctx.currentTime, 0.2);
  },
  /** Which loop is playing and how loud, for tests and the Settings page. */
  ambientInfo() {
    return { group: voice?.group ?? null, loaded: [...buffers.keys()], gain: want.gain, unlocked };
  },
  setEnabled(v: boolean) {
    enabled = v;
    if (sfx && ctx) sfx.gain.setTargetAtTime(v ? 0.85 : 0, ctx.currentTime, 0.03);
  },
  bind() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && ctx?.state === "suspended") void ctx.resume();
    });
  },
  cast() {
    noise(0.12, 0.08, 420);
    tone(210, 0.09, "sine", 0.05);
  },
  bite() {
    tone(820, 0.07, "square", 0.04);
    tone(1240, 0.09, "square", 0.035);
  },
  hook() {
    tone(540, 0.06, "triangle", 0.05);
  },
  perfect() {
    tone(660, 0.07, "triangle", 0.05);
    tone(990, 0.12, "sine", 0.04);
  },
  tick() {
    tone(480 + loose() * 80, 0.04, "square", 0.03);
  },
  miss() {
    tone(180, 0.08, "sawtooth", 0.03);
  },
  fail(kind: "slip" | "snap") {
    noise(kind === "snap" ? 0.22 : 0.1, 0.09, kind === "snap" ? 220 : 300);
    tone(kind === "snap" ? 90 : 140, 0.16, "sine", 0.06);
  },
  land(rarity: number) {
    const base = 392 * 2 ** (rarity / 7);
    tone(base, 0.1, "triangle", 0.05);
    tone(base * 1.25, 0.14, "sine", 0.04);
    tone(base * 1.5, 0.18, "sine", 0.035);
  },
  coin() {
    tone(880, 0.06, "sine", 0.04);
    tone(1320, 0.1, "sine", 0.03);
  },
  /** A short brass arpeggio for epic catches and new species. */
  fanfare() {
    tone(523, 0.14, "sawtooth", 0.035);
    setTimeout(() => tone(659, 0.14, "sawtooth", 0.035), 120);
    setTimeout(() => tone(784, 0.3, "sawtooth", 0.04), 240);
  },
  /** A warning: the fish is about to run or leap. Two quick rising pips. */
  warn() {
    tone(660, 0.05, "square", 0.035);
    setTimeout(() => tone(880, 0.07, "square", 0.035), 70);
  },
  /** A soft splash and a falling note for a fish let go. */
  release() {
    noise(0.12, 0.05, 500);
    tone(520, 0.12, "sine", 0.04);
    setTimeout(() => tone(390, 0.18, "sine", 0.035), 90);
  },
  /** An event begins: a rising shimmer that climbs higher and longer the rarer the event (0 Common ... 5 Mythic). */
  event(rarity: number) {
    const base = 440 + rarity * 60;
    const notes = Math.min(6, 3 + rarity);
    for (let i = 0; i < notes; i++) setTimeout(() => tone(base * 1.2 ** i, 0.22, "triangle", 0.035), i * 110);
  },
  /** A mutated fish lands: a short glassy chime. */
  mutant() {
    tone(988, 0.12, "sine", 0.04);
    setTimeout(() => tone(1319, 0.2, "sine", 0.035), 90);
  },
  frenzy() {
    tone(520, 0.08, "triangle", 0.04);
    tone(780, 0.14, "sine", 0.04);
  },
};

function bus() {
  if (!enabled) return null;
  const c = ctx;
  if (!c || !sfx || c.state !== "running") return null;
  return c;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number) {
  const c = bus();
  if (!c || !sfx) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t0 = c.currentTime;
  o.frequency.setValueAtTime(freq * (0.96 + loose() * 0.08), t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(sfx);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

function noise(dur: number, peak: number, freq: number) {
  const c = bus();
  if (!c || !sfx) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, n, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = loose() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfx);
  src.start(t0);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    g.disconnect();
  };
}

/* ── Ambience (WP-6): one lazy loop per group of waters, plus synthesized rain and wind ───────── */

let unlocked = false;
let ducked = false;
let want: AmbienceTarget = SILENT;
let ambOut: GainNode | null = null;
let voice: { group: number; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const buffers = new Map<number, AudioBuffer>();
const loading = new Map<number, Promise<AudioBuffer | null>>();
const failed = new Map<number, number>();
let rainGain: GainNode | null = null;
let windGain: GainNode | null = null;

function loadLoop(group: number): Promise<AudioBuffer | null> {
  const have = buffers.get(group);
  if (have) return Promise.resolve(have);
  const busy = loading.get(group);
  if (busy) return busy;
  const lastFail = failed.get(group);
  if (lastFail && Date.now() - lastFail < 30_000) return Promise.resolve(null);
  const c = ctx;
  if (!c) return Promise.resolve(null);
  const p = fetch(AMBIENCE_GROUPS[group].file)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((bytes) => c.decodeAudioData(bytes))
    .then((buf) => {
      buffers.set(group, buf);
      return buf;
    })
    .catch(() => {
      failed.set(group, Date.now());
      return null;
    })
    .finally(() => loading.delete(group));
  loading.set(group, p);
  return p;
}

/** A 3-second loop of white noise for the synthesized weather layers. */
function noiseSource(c: AudioContext, freq: number, q: number, type: BiquadFilterType): GainNode {
  const n = Math.floor(c.sampleRate * 3);
  const buffer = c.createBuffer(1, n, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = loose() * 2 - 1;
  /* Fade the ends into each other so the loop has no click. */
  const f = Math.floor(c.sampleRate * 0.05);
  for (let i = 0; i < f; i++) {
    const k = i / f;
    data[i] = data[i] * k + data[n - f + i] * (1 - k);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(filter);
  filter.connect(g);
  src.start();
  return g;
}

function applyAmbience() {
  const c = ctx;
  if (!c || !unlocked || c.state !== "running") return;
  const t = want;
  const now = c.currentTime;
  if (!ambOut) {
    ambOut = c.createGain();
    ambOut.gain.value = ducked ? DUCK : 1;
    ambOut.connect(c.destination);
  }
  /* Weather from the synth: made the first time it is wanted, then only its level moves. */
  if ((t.rain > 0 || t.wind > 0) && !rainGain) {
    rainGain = noiseSource(c, 3200, 0.6, "bandpass");
    windGain = noiseSource(c, 380, 0.9, "lowpass");
    rainGain.connect(ambOut);
    windGain.connect(ambOut);
  }
  rainGain?.gain.setTargetAtTime(t.rain * 0.5, now, 0.6);
  windGain?.gain.setTargetAtTime(t.wind * 0.9, now, 0.8);
  if (t.group === null || t.gain <= 0) {
    if (voice) fadeOutVoice(c, 0.6);
    return;
  }
  const group = t.group;
  if (voice && voice.group === group) {
    voice.gain.gain.setTargetAtTime(t.gain, now, 0.15);
    return;
  }
  /* A new loop: fetch it (first time only), then crossfade from the old one. */
  void loadLoop(group).then((buf) => {
    const cc = ctx;
    if (!buf || !cc || !ambOut || cc.state !== "running") return;
    /* The player may have moved on while it loaded. */
    if (want.group !== group || want.gain <= 0) return;
    if (voice && voice.group === group) return;
    const at = cc.currentTime;
    const src = cc.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = cc.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(want.gain, at + CROSSFADE_S);
    src.connect(gain);
    gain.connect(ambOut);
    src.start();
    if (voice) fadeOutVoice(cc, CROSSFADE_S);
    voice = { group, src, gain };
  });
}

function fadeOutVoice(c: AudioContext, secs: number) {
  const old = voice;
  if (!old) return;
  voice = null;
  const at = c.currentTime;
  old.gain.gain.cancelScheduledValues(at);
  old.gain.gain.setValueAtTime(old.gain.gain.value, at);
  old.gain.gain.linearRampToValueAtTime(0.0001, at + secs);
  old.src.stop(at + secs + 0.05);
  old.src.onended = () => {
    old.src.disconnect();
    old.gain.disconnect();
  };
}
