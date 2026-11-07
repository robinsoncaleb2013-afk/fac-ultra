/* Fish-fight rooms (Update Three, P6 — stretch): two real anglers, one tank.

   Why a new file, when eventroom.ts and pbroom.ts already exist?
   - pbroom.ts is not a room you join at all: it is the Trophy Room — your
     personal-best plaques, read off your own records. Nothing in it queues,
     matches or talks to a network, so there was nothing there to extend.
   - eventroom.ts is the friendly layer of a tournament event: a zustand
     store wired straight into a P2PRoom, with boats, emotes and a catch
     feed. It is all side effects and no pure state machine, and its wire
     (social.ts) can only ever carry an emote id or a catch — by design it
     cannot carry free text or a fight.
   So the pure rules live here, in the same shape as fight.ts / social.ts /
   pbroom.ts (plain data, plain functions, nothing saved, no window, no
   store), and fightroom-live.ts does the eventroom-style wiring on top.

   The fight itself is NOT re-implemented here. A room holds two real
   fight.ts fights — one per angler, same seed, so both screens can replay
   the same fight from the same inputs (that is fight.ts's own promise) —
   and this file only steps them with stepFight and reads F.result. First
   fish landed wins; if your fish snaps or slips away, the other angler
   wins. Nothing here can change a tournament score.

   Kids Mode (the hard rule for this package): when Kid Mode is in force
   (kid.ts's kidActive, worked out by the caller the same way use-kid.ts
   does) joining the queue, being matched and chatting are ALL refused.
   Every entry point takes that flag and checks it first. */

import { BIOMES } from "./content.ts";
import { FIGHT_STEP, newFight, progressOf, stepFight, zoneOf, type Fight, type FightInit, type FightResult } from "./fight.ts";
import type { FightStyle } from "./habits.ts";
import { seedFrom } from "./rng.ts";
import { isRude, safeName } from "./safe.ts";

/* ── Tunables ────────────────────────────────────────────────────────────── */

/** Chat lines are short: this many letters at most. */
export const CHAT_MAX_LEN = 120;
/** A room keeps this many chat lines; older ones fall off the top. */
export const CHAT_MAX_MESSAGES = 50;
/** One angler may chat this often (ms). A flood is refused, not queued. */
export const CHAT_GAP_MS = 800;
/** The biggest input run one wire message may carry (a run is at most ~4 s of play). */
export const MAX_INPUT_RUN = 200;
/** Most anglers waiting in the queue this device will track. */
export const QUEUE_MAX = 32;

export const KID_PROBLEM = "Fish fight rooms are not part of Kids Mode.";

/* ── The fish you bring ──────────────────────────────────────────────────── */

/** A fish to fight with: fight.ts's init without the seed (the match picks the seed, fairly). */
export type FightFish = Omit<FightInit, "seed">;

/** Three ready-made fish, so picking one takes one tap. Plain words, no jargon. */
export const FIGHT_FISH: readonly { id: string; name: string; blurb: string; fish: FightFish }[] = [
  {
    id: "perch",
    name: "Pond Perch",
    blurb: "Small and quick. A gentle first fight.",
    fish: { rarity: 0, style: "runner", stamina: 0.7, boss: false, biome: 0, hold: 3, reelSpeed: 0, drag: 1 },
  },
  {
    id: "trout",
    name: "River Trout",
    blurb: "Steady and strong. Pulls the whole way.",
    fish: { rarity: 1, style: "diver", stamina: 0.9, boss: false, biome: 2, hold: 3, reelSpeed: 2, drag: 1 },
  },
  {
    id: "catfish",
    name: "Deep Catfish",
    blurb: "Big and stubborn. Holds on at the end.",
    fish: { rarity: 2, style: "bulldog", stamina: 1.1, boss: false, biome: 3, hold: 4.5, reelSpeed: 4, drag: 1 },
  },
];

export const fightFishOf = (id: unknown) => FIGHT_FISH.find((f) => f.id === id) ?? null;

/* ── Queue ───────────────────────────────────────────────────────────────── */

export type QueueEntry = {
  /** The angler's peer id (the multiplayer layer's id, not a name). */
  id: string;
  /** Display name, already cleaned with safeName by the caller — and cleaned again on the way in. */
  name: string;
  fish: FightFish;
  /** When they joined (ms). The queue is kept in join order, ties broken by id, so every
      device that has seen the same joins works out the same pairs. */
  at: number;
};

export type FightQueue = {
  waiting: QueueEntry[];
  rooms: FightRoom[];
  /** Rooms ever made by this queue (ids stay unique even after rooms close). */
  made: number;
};

export function emptyFightQueue(): FightQueue {
  return { waiting: [], rooms: [], made: 0 };
}

const byJoinOrder = (a: QueueEntry, b: QueueEntry) => a.at - b.at || a.id.localeCompare(b.id);

/** Why this angler cannot join the queue right now, in plain words — or null when they can.
    Mirrors safe.ts's nameProblem: the box can show the words before anything is sent. */
export function joinProblem(q: FightQueue, playerId: string, kidOn: boolean): string | null {
  if (kidOn) return KID_PROBLEM;
  if (!playerId) return "You need a player id to join the queue.";
  if (q.waiting.some((e) => e.id === playerId)) return "You are already in the queue.";
  if (q.rooms.some((r) => r.phase !== "done" && r.players.some((p) => p.id === playerId))) return "You are already in a fish fight.";
  if (q.waiting.length >= QUEUE_MAX) return "The queue is full right now. Try again in a bit.";
  return null;
}

/** Join the queue. If that makes two waiting anglers, they are matched into a room at once
    (the room starts in "waiting": the fight begins when both tap Ready). Returns the room
    this join formed, or null. Refusals change nothing and return null — ask joinProblem
    first if you need the words. */
export function joinQueue(q: FightQueue, entry: QueueEntry, kidOn: boolean): FightRoom | null {
  if (joinProblem(q, entry.id, kidOn)) return null;
  q.waiting.push({ ...entry, name: safeName(entry.name, "Angler"), fish: { ...entry.fish } });
  q.waiting.sort(byJoinOrder);
  return formMatch(q);
}

/** Leave the queue before a match. True if you were waiting. Rooms are left with leaveRoom. */
export function leaveQueue(q: FightQueue, playerId: string): boolean {
  const i = q.waiting.findIndex((e) => e.id === playerId);
  if (i < 0) return false;
  q.waiting.splice(i, 1);
  return true;
}

/** The seed both fights in a match share: same seed, same runs and jumps, so the fight is
    fair and either screen can replay the other's fight from its inputs alone. */
export function matchSeedFor(aId: string, bId: string): number {
  const [a, b] = [aId, bId].sort();
  return seedFrom("fightroom-match", a, b);
}

/** Pair the first two waiting anglers into a room. Called by joinQueue; exported so the
    live layer can re-run it after a room dissolves and puts someone back in line. */
export function formMatch(q: FightQueue): FightRoom | null {
  if (q.waiting.length < 2) return null;
  const [a, b] = q.waiting.splice(0, 2);
  const seed = matchSeedFor(a.id, b.id);
  const room: FightRoom = {
    id: `fr-${++q.made}-${a.id}-${b.id}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64),
    phase: "waiting",
    players: [
      { id: a.id, name: a.name, fish: a.fish, ready: false, fight: newFight({ ...a.fish, seed }) },
      { id: b.id, name: b.name, fish: b.fish, ready: false, fight: newFight({ ...b.fish, seed }) },
    ],
    winner: null,
    end: null,
    chat: [],
    chatSeq: 0,
    lastChatAt: {},
    createdAt: Math.max(a.at, b.at),
  };
  q.rooms.push(room);
  return room;
}

/* ── The room ────────────────────────────────────────────────────────────── */

export type RoomPhase = "waiting" | "fighting" | "done";

export type RoomPlayer = {
  id: string;
  name: string;
  fish: FightFish;
  ready: boolean;
  /** This angler's own fight.ts fight. Stepped only by stepRoom / applyInputRun. */
  fight: Fight;
};

export type EndInfo = {
  /** The winning angler's id, or null for a draw (both fish gone on the same reckoning). */
  winner: string | null;
  loser: string | null;
  reason: "landed" | "escaped" | "forfeit";
  /** One plain line for the screen: who won and why. */
  text: string;
};

export type FightRoom = {
  id: string;
  phase: RoomPhase;
  players: [RoomPlayer, RoomPlayer];
  winner: string | null;
  end: EndInfo | null;
  chat: ChatMessage[];
  chatSeq: number;
  lastChatAt: Record<string, number>;
  createdAt: number;
};

export const playerOf = (room: FightRoom, playerId: string): RoomPlayer | null => room.players.find((p) => p.id === playerId) ?? null;
export const otherOf = (room: FightRoom, playerId: string): RoomPlayer | null => room.players.find((p) => p.id !== playerId) ?? null;

/** Say you are ready. When both anglers are ready the room moves waiting → fighting. */
export function markReady(room: FightRoom, playerId: string): boolean {
  if (room.phase !== "waiting") return false;
  const p = playerOf(room, playerId);
  if (!p || p.ready) return false;
  p.ready = true;
  if (room.players.every((x) => x.ready)) room.phase = "fighting";
  return true;
}

function finish(room: FightRoom, end: EndInfo) {
  room.phase = "done";
  room.winner = end.winner;
  room.end = end;
}

/** Read both fights after a step: a landed fish wins at once; a snapped or slipped fish
    loses at once. This only READS fight.ts results — the fight itself is stepFight's. */
function settle(room: FightRoom) {
  if (room.phase !== "fighting") return;
  const [a, b] = room.players;
  const ra = a.fight.result;
  const rb = b.fight.result;
  if (ra && rb) {
    finish(room, { winner: null, loser: null, reason: "escaped", text: "Both fish got away. It's a draw!" });
  } else if (ra === "landed") {
    finish(room, { winner: a.id, loser: b.id, reason: "landed", text: `${a.name} landed their fish first. ${a.name} wins!` });
  } else if (rb === "landed") {
    finish(room, { winner: b.id, loser: a.id, reason: "landed", text: `${b.name} landed their fish first. ${b.name} wins!` });
  } else if (ra) {
    finish(room, { winner: b.id, loser: a.id, reason: "escaped", text: `${a.name}'s fish got away. ${b.name} wins!` });
  } else if (rb) {
    finish(room, { winner: a.id, loser: b.id, reason: "escaped", text: `${b.name}'s fish got away. ${a.name} wins!` });
  }
}

/** One fixed step of one angler's fight, exactly as the single-player game steps it.
    True if the step happened (right room phase, real player, fight still running). */
export function stepRoom(room: FightRoom, playerId: string, held: boolean, dt: number = FIGHT_STEP): boolean {
  if (room.phase !== "fighting") return false;
  const p = playerOf(room, playerId);
  if (!p || p.fight.result) return false;
  stepFight(p.fight, held, dt);
  settle(room);
  return true;
}

/** A run of identical inputs from the wire (fight.ts traces travel the same way: a held
    flag and a count). Bounded by MAX_INPUT_RUN so a bad peer cannot fast-forward a fight. */
export function applyInputRun(room: FightRoom, playerId: string, held: boolean, steps: number): boolean {
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_INPUT_RUN) return false;
  let stepped = false;
  for (let i = 0; i < steps; i++) {
    if (!stepRoom(room, playerId, held)) break;
    stepped = true;
  }
  return stepped;
}

/** Leave a room. Waiting room: it closes and the other angler goes back to the FRONT of
    the queue (they were here first). Fighting: leaving forfeits — the other angler wins.
    Finished room: it is simply tidied away. True if you were in it. */
export function leaveRoom(q: FightQueue, roomId: string, playerId: string): boolean {
  const i = q.rooms.findIndex((r) => r.id === roomId);
  if (i < 0) return false;
  const room = q.rooms[i];
  const me = playerOf(room, playerId);
  if (!me) return false;
  const other = otherOf(room, playerId);
  if (room.phase === "waiting") {
    q.rooms.splice(i, 1);
    if (other) {
      q.waiting.unshift({ id: other.id, name: other.name, fish: other.fish, at: room.createdAt });
      formMatch(q);
    }
    return true;
  }
  if (room.phase === "fighting" && other) {
    finish(room, { winner: other.id, loser: me.id, reason: "forfeit", text: `${me.name} left the fight. ${other.name} wins!` });
    return true;
  }
  q.rooms.splice(i, 1);
  return true;
}

/** The room a player is in (waiting, fighting or just finished), or null. */
export function roomOfPlayer(q: FightQueue, playerId: string): FightRoom | null {
  return q.rooms.find((r) => r.players.some((p) => p.id === playerId)) ?? null;
}

/* ── Chat ────────────────────────────────────────────────────────────────── */

export type ChatMessage = {
  id: number;
  /** The sender's peer id. */
  from: string;
  /** The sender's display name at the time (already cleaned). */
  name: string;
  text: string;
  at: number;
};

/** Chat text made safe to show: plain letters, numbers and friendly punctuation only,
    runs of spaces folded, capped at CHAT_MAX_LEN. Control characters and anything that
    could dress up as markup are stripped, in the same spirit as safe.ts's name cleaning. */
export function cleanChatText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _.'!,?-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MAX_LEN)
    .trim();
}

/** Why this chat line cannot be sent, in plain words — or null when it can. Checked before
    anything is shown or sent, and again on the receiving side for lines from the wire. */
export function chatProblem(room: FightRoom, playerId: string, text: string, kidOn: boolean, now: number): string | null {
  if (kidOn) return KID_PROBLEM;
  const p = playerOf(room, playerId);
  if (!p) return "Only the two anglers in this room can chat here.";
  const clean = cleanChatText(text);
  if (!clean) return "Type a message first.";
  /* safe.ts decides what is rude or private (words, web addresses, phone numbers) — the
     same check names go through, run on the cleaned text AND the raw text, so spacing a
     word out cannot sneak it past. */
  if (isRude(clean) || isRude(text)) return "Keep it friendly. Messages with rude words or contact details are not sent.";
  if (now - (room.lastChatAt[playerId] ?? -Infinity) < CHAT_GAP_MS) return "Easy there — one message at a time.";
  return null;
}

/** Post a line to the room's chat. Appends newest-last and keeps at most
    CHAT_MAX_MESSAGES lines. Returns the stored line, or null when refused. */
export function postChat(room: FightRoom, playerId: string, text: string, kidOn: boolean, now: number): ChatMessage | null {
  if (chatProblem(room, playerId, text, kidOn, now)) return null;
  const p = playerOf(room, playerId)!;
  const msg: ChatMessage = { id: ++room.chatSeq, from: playerId, name: p.name, text: cleanChatText(text), at: now };
  room.chat = [...room.chat, msg].slice(-CHAT_MAX_MESSAGES);
  room.lastChatAt[playerId] = now;
  return msg;
}

/* ── Reading a room for the screen ───────────────────────────────────────── */

export type RoomPlayerView = {
  id: string;
  name: string;
  ready: boolean;
  /** 0–1 of the way to landed (fight.ts's own reading). */
  progress: number;
  /** 0–1 line load, for the needle bar. */
  tension: number;
  zone: "slack" | "green" | "high" | "red";
  result: FightResult;
};

export type RoomView = {
  id: string;
  phase: RoomPhase;
  players: RoomPlayerView[];
  winner: string | null;
  endText: string;
  chat: ChatMessage[];
};

/** A plain snapshot for a component: no Fight objects leak into the UI layer. */
export function roomView(room: FightRoom): RoomView {
  return {
    id: room.id,
    phase: room.phase,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      progress: progressOf(p.fight),
      tension: p.fight.tension,
      zone: zoneOf(p.fight),
      result: p.fight.result,
    })),
    winner: room.winner,
    endText: room.end?.text ?? "",
    chat: [...room.chat],
  };
}

/* ── The wire ──────────────────────────────────────────────────────────────
   What anglers may say to each other, in social.ts / multiplayer.ts's envelope
   style: a short `k` kind, ids and range-checked numbers, and — the one new
   thing this package needs — a chat text, which is never trusted: it is
   re-cleaned and re-checked with chatProblem on the receiving side before it
   can reach a screen. Queue lines ride the lobby room; room lines ride the
   room named by roomNameFor. */

export type WireFish = { rarity: number; style: FightStyle; stamina: number; boss: boolean; biome: number; hold: number; reelSpeed: number; drag: 0 | 1 | 2 };

export type FightWire =
  | { k: "fq-join"; name: string; fish: WireFish; at: number }
  | { k: "fq-leave" }
  | { k: "fr-ready" }
  | { k: "fr-input"; held: boolean; steps: number }
  | { k: "fr-chat"; text: string }
  | { k: "fr-leave" };

const STYLES: readonly FightStyle[] = ["runner", "diver", "jumper", "bulldog", "thrasher"];

export function wireFishOf(fish: FightFish): WireFish {
  return {
    rarity: fish.rarity,
    style: fish.style,
    stamina: fish.stamina,
    boss: fish.boss,
    biome: fish.biome,
    hold: fish.hold,
    reelSpeed: fish.reelSpeed,
    drag: fish.drag,
  };
}

/** Back from the wire to a fish you can queue with (the seed is the match's, never the wire's). */
export function fishFromWire(w: WireFish): FightFish {
  return { rarity: w.rarity, style: w.style, stamina: w.stamina, boss: w.boss, biome: w.biome, hold: w.hold, reelSpeed: w.reelSpeed, drag: w.drag };
}

/** The fight room's name on the relay: both anglers work it out from the pair, so
    nobody has to be told it. Sorted, so both sides spell it the same way. */
export function roomNameFor(aId: string, bId: string): string {
  const [a, b] = [aId, bId].sort();
  return `fr-${a}-${b}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
}

const numIn = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const intIn = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

function readWireFish(v: unknown): WireFish | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!intIn(o.rarity, 0, 4)) return null;
  if (typeof o.style !== "string" || !(STYLES as readonly string[]).includes(o.style)) return null;
  if (!numIn(o.stamina, 0.3, 2)) return null;
  if (typeof o.boss !== "boolean") return null;
  if (!intIn(o.biome, 0, BIOMES.length - 1)) return null;
  if (!numIn(o.hold, 0.5, 30)) return null;
  if (!numIn(o.reelSpeed, 0, 30)) return null;
  if (!intIn(o.drag, 0, 2)) return null;
  return { rarity: o.rarity, style: o.style as FightStyle, stamina: o.stamina, boss: o.boss, biome: o.biome, hold: o.hold, reelSpeed: o.reelSpeed, drag: o.drag as 0 | 1 | 2 };
}

/** Read one message off the wire. Anything malformed, out of range or of an unknown
    kind is null and must be dropped — the same discipline as social.ts's readWire. */
export function readFightWire(data: unknown): FightWire | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  switch (o.k) {
    case "fq-join": {
      const fish = readWireFish(o.fish);
      if (!fish || !numIn(o.at, 0, 1e15)) return null;
      return { k: "fq-join", name: safeName(o.name, "Angler"), fish, at: Math.round(o.at) };
    }
    case "fq-leave":
      return { k: "fq-leave" };
    case "fr-ready":
      return { k: "fr-ready" };
    case "fr-input":
      return typeof o.held === "boolean" && intIn(o.steps, 1, MAX_INPUT_RUN) ? { k: "fr-input", held: o.held, steps: o.steps } : null;
    case "fr-chat":
      return typeof o.text === "string" && o.text.length > 0 && o.text.length <= CHAT_MAX_LEN * 2 ? { k: "fr-chat", text: o.text } : null;
    case "fr-leave":
      return { k: "fr-leave" };
    default:
      return null;
  }
}
