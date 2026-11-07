import { create } from "zustand";
import { formOf, readDevice } from "@/game/device";
import { useGame } from "@/game/engine";
import {
  applyInputRun,
  CHAT_GAP_MS,
  chatProblem,
  emptyFightQueue,
  fightFishOf,
  fishFromWire,
  joinProblem,
  joinQueue,
  KID_PROBLEM,
  leaveQueue,
  leaveRoom,
  markReady,
  postChat,
  readFightWire,
  roomNameFor,
  roomOfPlayer,
  roomView,
  stepRoom,
  wireFishOf,
  type FightQueue,
  type FightWire,
  type RoomView,
} from "@/game/fightroom";
import { kidActive } from "@/game/kid";
import { MODES } from "@/game/modes";
import { loose } from "@/game/rng";
import { safeName } from "@/game/safe";
import { chooseMesh, meshCap } from "@/game/social";
import { P2PRoom } from "@/lib/multiplayer";

/* The live layer for fish-fight rooms: fightroom.ts's pure queue/room/chat,
   carried on the same WebRTC relay every other room in this game uses
   (src/lib/multiplayer's P2PRoom, signalled through /api/rtc). This file is
   shaped like eventroom.ts on purpose: a zustand store for the screen, a
   module-level room or two, a heartbeat, and every wire message read through
   fightroom.ts's validator before it can touch the state.

   How a match happens with no server to run it: everyone waiting joins ONE
   lobby room on the relay and says fq-join (name + fish + when). Each device
   keeps its own copy of the queue (fightroom.ts's FightQueue) and pairs in
   join order, so two devices that have heard the same joins name the same
   pair. The pair then meet in a second room named for the two of them
   (roomNameFor) and exchange ready taps, input runs and chat there. Each
   device steps BOTH fights locally — its own from its own reel, the other
   angler's from their input runs — and because both fights share a seed, the
   two screens replay the same fight (fight.ts's determinism). Chat is
   re-cleaned and re-checked on the way in, never trusted from the wire.

   Kids Mode: joining is refused here as well as in fightroom.ts — the flag
   is kidActive from kid.ts, worked out from the live game state exactly the
   way components/game/use-kid.ts works it out. */

type LiveState = {
  status: "off" | "joining" | "on";
  /** You are in the queue, waiting for a match. */
  queued: boolean;
  /** Anglers waiting, you included. */
  waiting: number;
  /** Your room, as a plain snapshot for the screen (null when you have none). */
  view: RoomView | null;
  problem: string;
};

export const useFightRoomLive = create<LiveState>(() => ({
  status: "off",
  queued: false,
  waiting: 0,
  view: null,
  problem: "",
}));

let lobby: P2PRoom | null = null;
let fightConn: P2PRoom | null = null;
let fightConnName = "";
let heartbeat = 0;
let bound = false;
let me = "";
let myName = "Angler";
let myFishId = "perch";
const mirror: FightQueue = emptyFightQueue();

/** Is Kids Mode in force right now? (kid.ts's rule, on the live store.) */
function kidOnNow(): boolean {
  const s = useGame.getState();
  return kidActive(s.kid, MODES[s.mode]);
}

function syncStore() {
  /* The lobby mirror can form rooms between other anglers; only mine is kept. */
  mirror.rooms = mirror.rooms.filter((r) => r.players.some((p) => p.id === me));
  const room = roomOfPlayer(mirror, me);
  if (room && !fightConn) openFightConn(room.players[0].id, room.players[1].id);
  useFightRoomLive.setState({
    queued: mirror.waiting.some((e) => e.id === me),
    waiting: mirror.waiting.length,
    view: room ? roomView(room) : null,
  });
}

function announce() {
  if (!lobby || kidOnNow()) return;
  const fish = fightFishOf(myFishId)?.fish;
  if (!fish) return;
  const mine = mirror.waiting.find((e) => e.id === me);
  if (!mine) return;
  lobby.broadcast({ k: "fq-join", name: myName, fish: wireFishOf(fish), at: mine.at } satisfies FightWire);
}

function onLobbyMessage(from: string, data: unknown) {
  const msg = readFightWire(data);
  if (!msg || from === me) return;
  if (msg.k === "fq-join") {
    joinQueue(mirror, { id: from, name: msg.name, fish: fishFromWire(msg.fish), at: msg.at }, false);
  } else if (msg.k === "fq-leave") {
    leaveQueue(mirror, from);
    const room = roomOfPlayer(mirror, me);
    if (room && room.players.some((p) => p.id === from)) leaveRoom(mirror, room.id, from);
  } else {
    return;
  }
  syncStore();
}

function onFightMessage(from: string, data: unknown) {
  const msg = readFightWire(data);
  if (!msg || from === me) return;
  const room = roomOfPlayer(mirror, me);
  if (!room || !room.players.some((p) => p.id === from)) return;
  if (msg.k === "fr-ready") markReady(room, from);
  else if (msg.k === "fr-input") applyInputRun(room, from, msg.held, msg.steps);
  else if (msg.k === "fr-chat") {
    /* Their clock is not mine: never drop a good line just for arriving fast.
       Rude words and contact details are still refused, by postChat itself. */
    const now = Math.max(Date.now(), (room.lastChatAt[from] ?? 0) + CHAT_GAP_MS);
    postChat(room, from, msg.text, false, now);
  } else if (msg.k === "fr-leave") leaveRoom(mirror, room.id, from);
  else return;
  syncStore();
}

function openFightConn(aId: string, bId: string) {
  const name = roomNameFor(aId, bId);
  if (fightConn && fightConnName === name) return;
  closeFightConn();
  fightConnName = name;
  const conn = new P2PRoom({
    room: name,
    selfId: me,
    name: myName,
    onMessage: (from, data) => onFightMessage(from, data),
  });
  fightConn = conn;
  void conn.join().catch(() => {
    /* The room still exists locally; the relay retries on its own loop. */
  });
}

function closeFightConn() {
  if (fightConn) {
    try {
      fightConn.close();
    } catch {
      /* already closed */
    }
    fightConn = null;
    fightConnName = "";
  }
  pending = null;
}

/** Join the fish-fight queue with one of fightroom.ts's ready-made fish.
    Refused — with the words in the store for the screen — in Kids Mode. */
export async function joinFightQueue(name: string, fishId: string) {
  if (kidOnNow()) {
    useFightRoomLive.setState({ problem: KID_PROBLEM });
    return;
  }
  const fish = fightFishOf(fishId);
  if (!fish) {
    useFightRoomLive.setState({ problem: "Pick a fish first." });
    return;
  }
  if (lobby) return; /* already in */
  myName = safeName(name, "Angler");
  myFishId = fishId;
  me = loose().toString(36).slice(2, 10) + loose().toString(36).slice(2, 6);
  const problem = joinProblem(mirror, me, false);
  if (problem) {
    useFightRoomLive.setState({ problem });
    return;
  }
  useFightRoomLive.setState({ status: "joining", problem: "" });
  const cap = meshCap(formOf(readDevice()));
  const conn = new P2PRoom({
    room: "fac-fight-lobby",
    selfId: me,
    name: myName,
    pickPeers: (roster, connected) => chooseMesh(roster, connected, cap),
    onMessage: (from, data) => onLobbyMessage(from, data),
    onConnected: () => {
      useFightRoomLive.setState({ status: "on" });
      joinQueue(mirror, { id: me, name: myName, fish: fish.fish, at: Date.now() }, false);
      announce();
      syncStore();
    },
  });
  lobby = conn;
  try {
    await conn.join();
  } catch {
    if (lobby === conn) {
      lobby = null;
      useFightRoomLive.setState({ status: "off", problem: "Couldn't reach the room. The rest of the game still works." });
    }
    return;
  }
  window.clearInterval(heartbeat);
  heartbeat = window.setInterval(announce, 4000);
  if (!bound) {
    bound = true;
    window.addEventListener("pagehide", () => leaveFightQueue());
  }
}

/** Leave the queue, or forfeit/leave your room, and close both rooms. */
export function leaveFightQueue() {
  const room = roomOfPlayer(mirror, me);
  if (room) {
    fightConn?.send({ k: "fr-leave" } satisfies FightWire);
    leaveRoom(mirror, room.id, me);
  }
  if (lobby) {
    try {
      lobby.broadcast({ k: "fq-leave" } satisfies FightWire);
    } catch {
      /* closing anyway */
    }
  }
  leaveQueue(mirror, me);
  /* Forget my rooms locally (a finished one, or the one just forfeited): the
     queue must be able to take me again, and the screen goes back to the start. */
  mirror.rooms = mirror.rooms.filter((r) => !r.players.some((p) => p.id === me));
  closeFightConn();
  if (lobby) {
    try {
      lobby.close();
    } catch {
      /* already closed */
    }
    lobby = null;
  }
  window.clearInterval(heartbeat);
  useFightRoomLive.setState({ status: "off", queued: false, waiting: 0, view: null, problem: "" });
}

/** Tap Ready in your room. */
export function readyFight() {
  const room = roomOfPlayer(mirror, me);
  if (!room || kidOnNow()) return;
  if (markReady(room, me)) {
    fightConn?.send({ k: "fr-ready" } satisfies FightWire);
    syncStore();
  }
}

/* Your own reel: the component calls tickFight(held) on fight.ts's fixed step
   while the room is fighting. Your inputs step your local copy of your fight
   at once and are sent on as runs (a held flag and a count — the same shape
   fight.ts traces use), so the other screen steps its copy of your fight
   with the very same inputs. */
let pending: { held: boolean; steps: number } | null = null;

function flushInputs() {
  if (pending && fightConn) fightConn.send({ k: "fr-input", held: pending.held, steps: pending.steps } satisfies FightWire);
  pending = null;
}

export function tickFight(held: boolean) {
  const room = roomOfPlayer(mirror, me);
  if (!room || room.phase !== "fighting") return;
  if (pending && pending.held !== held) flushInputs();
  if (!stepRoom(room, me, held)) return;
  pending = pending && pending.held === held ? { held, steps: pending.steps + 1 } : { held, steps: 1 };
  if (pending.steps >= 20 || room.phase !== "fighting") flushInputs();
  syncStore();
}

/** Send a chat line in your room. Returns the plain-words problem, or null when sent.
    The line is stored locally by fightroom.ts's own rules first — if it is
    refused there (rude, too soon, Kids Mode) nothing goes on the wire. */
export function sendFightChat(text: string): string | null {
  const room = roomOfPlayer(mirror, me);
  if (!room) return "You are not in a fish fight room.";
  const problem = chatProblem(room, me, text, kidOnNow(), Date.now());
  if (problem) return problem;
  if (!postChat(room, me, text, false, Date.now())) return "That message was not sent.";
  const stored = room.chat[room.chat.length - 1];
  fightConn?.send({ k: "fr-chat", text: stored.text } satisfies FightWire);
  syncStore();
  return null;
}

/** Your peer id in the current queue/room ("" when you are not in). */
export const myFightId = () => me;
