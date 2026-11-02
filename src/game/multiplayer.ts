import { create } from "zustand";
import { loose } from "@/game/rng";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { BIOMES } from "@/game/content";
import { useGame } from "@/game/engine";

/* Online co-op over the repo's WebRTC room engine (src/lib/multiplayer).
   The signaling relay lives at /api/rtc; once peers connect, everything
   flows browser-to-browser. v1 shares: presence (who is on which water),
   the weather (the room creator sets it), and a live catch feed. Each
   angler keeps their own save and dex — joint boss credit comes from the
   host's Lair unlock being fished together, catches stay personal. */

export type FeedItem = { id: number; text: string; at: number };
export type CrewStatus = "off" | "joining" | "on";

type CrewState = {
  status: CrewStatus;
  code: string;
  isHost: boolean;
  name: string;
  peers: PeerInfo[];
  feed: FeedItem[];
  error: string;
};

export const useCrew = create<CrewState>(() => ({
  status: "off",
  code: "",
  isHost: false,
  name: "",
  peers: [],
  feed: [],
  error: "",
}));

let room: P2PRoom | null = null;
let presenceTimer = 0;
let weatherTimer = 0;
let lastWeather = -1;
let feedSeq = 1;
let boundCatch = false;

/** peerId → last known biome, for drawing guest boats on your water. */
const presence = new Map<string, { biome: number; name: string; at: number }>();

function pushFeed(text: string) {
  useCrew.setState((s) => ({ feed: [...s.feed, { id: ++feedSeq, text, at: Date.now() }].slice(-30) }));
}

function uid() {
  return loose().toString(36).slice(2, 10);
}

function makeCode() {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 4; i++) out += letters[(loose() * letters.length) | 0];
  return out;
}

type Wire =
  | { k: "presence"; biome: number; name: string }
  | { k: "catch"; name: string; v: number; b: number }
  | { k: "weather"; w: number }
  | { k: "hello"; name: string };

function handleMessage(from: string, data: unknown) {
  const msg = data as Wire | null;
  if (!msg || typeof msg !== "object" || !("k" in msg)) return;
  const crew = useCrew.getState();
  if (msg.k === "presence") {
    presence.set(from, { biome: msg.biome, name: msg.name, at: Date.now() });
  } else if (msg.k === "catch") {
    const who = presence.get(from)?.name || crew.peers.find((p) => p.id === from)?.name || "Partner";
    pushFeed(`${who} landed ${msg.name} (${BIOMES[msg.b]?.name ?? ""}).`);
    if (msg.name) useGame.getState().notify(`${who} landed ${msg.name}.`);
  } else if (msg.k === "weather") {
    if (!crew.isHost) useGame.setState({ weather: msg.w });
  } else if (msg.k === "hello") {
    pushFeed(`${msg.name} joined the water.`);
  }
}

function startLoops() {
  window.clearInterval(presenceTimer);
  window.clearInterval(weatherTimer);
  presenceTimer = window.setInterval(() => {
    if (!room) return;
    const s = useGame.getState();
    room.broadcast({ k: "presence", biome: s.biome, name: useCrew.getState().name } satisfies Wire);
  }, 4000);
  weatherTimer = window.setInterval(() => {
    if (!room) return;
    const s = useGame.getState();
    if (useCrew.getState().isHost && s.weather !== lastWeather) {
      lastWeather = s.weather;
      room.broadcast({ k: "weather", w: s.weather } satisfies Wire);
    }
  }, 1500);
  if (!boundCatch) {
    boundCatch = true;
    window.addEventListener("fac:catch", (e) => {
      if (!room || useCrew.getState().status !== "on") return;
      const d = (e as CustomEvent).detail as { name?: string; v?: number; b?: number };
      if (d?.name) room.send({ k: "catch", name: d.name, v: d.v ?? 0, b: d.b ?? 0 } satisfies Wire);
    });
  }
}

export async function createRoom(name: string) {
  const code = makeCode();
  await joinRoom(code, name, true);
  return code;
}

export async function joinRoom(code: string, name: string, isHost = false) {
  leaveRoom();
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const displayName = name.trim().slice(0, 24) || "Angler";
  if (!clean) {
    useCrew.setState({ error: "Enter a room code first." });
    return;
  }
  useCrew.setState({ status: "joining", code: clean, isHost, name: displayName, error: "", feed: [] });
  const selfId = uid();
  room = new P2PRoom({
    room: `fac-${clean}`,
    selfId,
    name: displayName,
    onPeersChanged: (peers) => useCrew.setState({ peers }),
    onMessage: (from, data) => handleMessage(from, data),
    onConnected: () => {
      useCrew.setState({ status: "on" });
      pushFeed(isHost ? `Room ${clean} created. Share the code.` : `Joined room ${clean}.`);
      room?.send({ k: "hello", name: displayName } satisfies Wire);
      const s = useGame.getState();
      room?.broadcast({ k: "presence", biome: s.biome, name: displayName } satisfies Wire);
      if (isHost) {
        lastWeather = s.weather;
        room?.broadcast({ k: "weather", w: s.weather } satisfies Wire);
      }
    },
  });
  try {
    await room.join();
    startLoops();
  } catch {
    useCrew.setState({ status: "off", error: "Could not reach the room relay. Try again." });
    room = null;
  }
}

export function leaveRoom() {
  if (room) {
    try {
      room.close();
    } catch {
      /* already closed */
    }
    room = null;
  }
  window.clearInterval(presenceTimer);
  window.clearInterval(weatherTimer);
  presence.clear();
  lastWeather = -1;
  useCrew.setState({ status: "off", peers: [], code: "", isHost: false });
}

/** Where a guest boat is at time `t`: slow drift back and forth along the water, a little different for everyone. */
export function driftOf(id: string, t: number): { x: number; y: number; dir: number } {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 997;
  const span = 1.24;
  const raw = (seed / 997 + t * 0.021 * (1 + (seed % 5) * 0.12)) % (span * 2);
  const x = raw < span ? raw - 0.12 : span * 2 - raw - 0.12;
  const dir = raw < span ? 1 : -1;
  return { x, y: 0.66 + (seed % 4) * 0.02, dir };
}

/** Guest boats for the stage: peers currently on the same biome. Positions
    drift slowly so the canvas stays alive without a physics sim. */
export function peerBoats(biome: number, t: number): { x: number; y: number; dir: number; name: string }[] {
  const out: { x: number; y: number; dir: number; name: string }[] = [];
  const now = Date.now();
  for (const [id, p] of presence) {
    if (p.biome !== biome || now - p.at > 15_000) continue;
    out.push({ ...driftOf(id, t), name: p.name });
  }
  return out;
}
