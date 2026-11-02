import { create } from "zustand";
import { BIOMES } from "@/game/content";
import { formOf, readDevice } from "@/game/device";
import { driftOf } from "@/game/multiplayer";
import { safeName } from "@/game/safe";
import { loose } from "@/game/rng";
import {
  canEmote,
  chooseMesh,
  EMOTE_GAP_MS,
  EMOTE_SHOW_MS,
  emoteOf,
  FEED_MAX,
  meshCap,
  readWire,
  roomOf,
  type Emote,
  type Wire,
} from "@/game/social";
import { useGame } from "@/game/engine";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";

/* The friendly layer of an event: a P2P room named for the event (docs/architecture/06 §3.3).

   Everyone fishing the event joins `t-<eventId>` on the same relay co-op uses. Peers appear as boats
   on your water, you see each other's landed fish in a small feed, and you can send eight preset emotes.
   None of it can change a score: scoring is the server's job (api/catch), and what arrives here is only
   ever an id from a short list or a number that has been range-checked (social.ts readWire).

   The mesh is capped (4 on a phone, 8 on a PC): a full mesh costs n squared connections. Anglers beyond the
   cap are still on the board; they just don't get boats and emotes from everyone. */

export type FeedLine = { id: number; text: string; at: number };

type RoomState = {
  status: "off" | "joining" | "on";
  eventId: string;
  cap: number;
  /** Other anglers in the room, connected or not. */
  others: number;
  peers: PeerInfo[];
  feed: FeedLine[];
  /** When you last sent an emote (for the button to grey out), and the one on screen over your own bobber. */
  lastSent: number;
  mine: { emote: Emote; at: number } | null;
  error: string;
};

export const useEventRoom = create<RoomState>(() => ({
  status: "off",
  eventId: "",
  cap: 0,
  others: 0,
  peers: [],
  feed: [],
  lastSent: 0,
  mine: null,
  error: "",
}));

let room: P2PRoom | null = null;
let timer = 0;
let feedSeq = 1;
let bound = false;
const boats = new Map<string, { biome: number; name: string; at: number }>();
const bubbles = new Map<string, { emote: Emote; at: number }>();
const lastFrom = new Map<string, number>();

/** Names from other devices are cleaned again here: nothing rude is ever drawn on your screen. */
const nameOf = (id: string) => safeName(boats.get(id)?.name || useEventRoom.getState().peers.find((p) => p.id === id)?.name, "Another angler");

/* Block (WP-10): anglers you blocked are not drawn and their emotes and catches are not shown. The room only knows
   display names, so the match is by name: if two people share a name and you block one, you will not see either. */
let blockedNames = new Set<string>();
const BLOCKED_KEY = "fac-ultra-blocked-names";
export function setBlockedNames(names: readonly string[]) {
  blockedNames = new Set(names.map((n) => safeName(n, "").toLowerCase()).filter(Boolean));
  try {
    localStorage.setItem(BLOCKED_KEY, JSON.stringify([...blockedNames].slice(0, 100)));
  } catch {
    /* private mode: the list is still used for this visit */
  }
}
/** Load the names blocked on an earlier visit, so a room never shows them before the Players tab has been opened. */
function loadBlockedNames() {
  try {
    const raw = JSON.parse(localStorage.getItem(BLOCKED_KEY) ?? "[]");
    if (Array.isArray(raw)) blockedNames = new Set(raw.filter((n): n is string => typeof n === "string").slice(0, 100));
  } catch {
    /* nothing saved */
  }
}
export const isBlockedName = (name: string | undefined) => !!name && blockedNames.has(safeName(name, "").toLowerCase());

function pushFeed(text: string) {
  useEventRoom.setState((s) => ({ feed: [...s.feed, { id: ++feedSeq, text, at: Date.now() }].slice(-FEED_MAX) }));
}

function onMessage(from: string, data: unknown) {
  const msg: Wire | null = readWire(data);
  if (!msg) return;
  const now = Date.now();
  if (isBlockedName(msg.k === "boat" ? msg.name : nameOf(from))) return;
  if (msg.k === "boat") {
    boats.set(from, { biome: msg.biome, name: safeName(msg.name, boats.get(from)?.name || "Another angler"), at: now });
  } else if (msg.k === "emote") {
    /* A flood is dropped: one a gap per peer, whatever they send. */
    if (now - (lastFrom.get(from) ?? 0) < EMOTE_GAP_MS * 0.8) return;
    lastFrom.set(from, now);
    const e = emoteOf(msg.id);
    if (!e) return;
    bubbles.set(from, { emote: e, at: now });
    pushFeed(`${nameOf(from)}: ${e.glyph} ${e.text}`);
  } else if (msg.k === "catch") {
    const fish = BIOMES[msg.b]?.fish[msg.i];
    if (fish) pushFeed(`${nameOf(from)} landed ${fish} (${msg.w.toFixed(1)} lb).`);
  }
}

/** Join the event's room. Safe to call again for the same event (it keeps the room). */
export async function joinEventRoom(eventId: string, name: string) {
  if (room && useEventRoom.getState().eventId === eventId) return;
  leaveEventRoom();
  loadBlockedNames();
  setRoomName(name);
  const cap = meshCap(formOf(readDevice()));
  useEventRoom.setState({ status: "joining", eventId, cap, others: 0, peers: [], feed: [], error: "" });
  const selfId = loose().toString(36).slice(2, 10) + loose().toString(36).slice(2, 6);
  const r = new P2PRoom({
    room: roomOf(eventId),
    selfId,
    name: myName,
    pickPeers: (roster, connected) => chooseMesh(roster, connected, cap),
    onRoster: (others) => useEventRoom.setState((s) => (s.others === others ? s : { others })),
    onPeersChanged: (peers) => useEventRoom.setState({ peers }),
    onMessage: (from, data) => onMessage(from, data),
    onConnected: () => {
      useEventRoom.setState({ status: "on" });
      announce();
    },
  });
  room = r;
  try {
    await r.join();
  } catch {
    if (room === r) {
      useEventRoom.setState({ status: "off", error: "Couldn't reach the room. The board still works." });
      room = null;
    }
    return;
  }
  window.clearInterval(timer);
  timer = window.setInterval(announce, 4000);
  if (!bound) {
    bound = true;
    window.addEventListener("fac:catch", (e) => {
      if (!room || useEventRoom.getState().status !== "on") return;
      const d = (e as CustomEvent).detail as { b?: number; i?: number; w?: number } | undefined;
      if (typeof d?.b === "number" && typeof d.i === "number" && typeof d.w === "number") room.send({ k: "catch", b: d.b, i: d.i, w: d.w } satisfies Wire);
    });
    window.addEventListener("pagehide", () => leaveEventRoom());
  }
}

function announce() {
  if (!room) return;
  const biome = useGame.getState().biome;
  room.broadcast({ k: "boat", biome, name: myName } satisfies Wire);
}

let myName = "";
export function setRoomName(name: string) {
  myName = safeName(name, "Angler");
}

export function leaveEventRoom() {
  if (room) {
    try {
      room.close();
    } catch {
      /* already closed */
    }
    room = null;
  }
  window.clearInterval(timer);
  boats.clear();
  bubbles.clear();
  lastFrom.clear();
  useEventRoom.setState({ status: "off", eventId: "", others: 0, peers: [], mine: null });
}

/** Send one of the eight emotes. Returns false if it is too soon, you are not in a room, or the id is unknown. */
export function sendEmote(id: string, now = Date.now()): boolean {
  const s = useEventRoom.getState();
  const e = emoteOf(id);
  if (!e || !room || s.status !== "on" || !canEmote(s.lastSent, now)) return false;
  room.send({ k: "emote", id: e.id } satisfies Wire);
  useEventRoom.setState({ lastSent: now, mine: { emote: e, at: now } });
  pushFeed(`You: ${e.glyph} ${e.text}`);
  return true;
}

export type EventBoat = { x: number; y: number; dir: number; name: string; emote?: Emote };

/** Boats of the other anglers on your water, with the emote bubble they have up, if any. Pure reads of the maps. */
export function eventBoats(biome: number, t: number, now = Date.now()): EventBoat[] {
  const out: EventBoat[] = [];
  for (const [id, b] of boats) {
    if (b.biome !== biome || now - b.at > 15_000 || isBlockedName(b.name)) continue;
    const bub = bubbles.get(id);
    out.push({ ...driftOf(id, t), name: b.name, ...(bub && now - bub.at < EMOTE_SHOW_MS ? { emote: bub.emote } : {}) });
  }
  return out;
}

/** The bubble over your own bobber, while it lasts. */
export function myBubble(now = Date.now()): Emote | null {
  const m = useEventRoom.getState().mine;
  return m && now - m.at < EMOTE_SHOW_MS ? m.emote : null;
}
