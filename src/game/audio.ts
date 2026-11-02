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
    if (c.state === "suspended") void c.resume();
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
