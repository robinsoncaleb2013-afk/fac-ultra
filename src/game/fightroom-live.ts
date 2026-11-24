import { create } from "zustand";
import { useGame } from "@/game/engine";
import {
  applyInputRun,
  CHAT_GAP_MS,
  chatProblem,
  emptyFightQueue,
  fightFishOf,
  fishFromWire,
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
  type FightQueue,
  type FightWire,
  type RoomView,
  type WireFish,
} from "@/game/fightroom";
import { kidActive } from "@/game/kid";
import { MODES } from "@/game/modes";
import { loose } from "@/game/rng";
import { safeName } from "@/game/safe";
import { P2PRoom } from "@/lib/multiplayer";

/* The live layer for fish-fight rooms: fightroom.ts's pure room/chat rules,
   wired for real opponents. The QUEUE is the server's now (POST /api/fight-queue,
   src/lib/tournaments/fightqueue.server.ts): one queue every device agrees on,
   pairing in join order, Kids Mode refused by the server itself. This file polls
   that queue until the server hands back a match — both anglers' ids, names, fish
   and join times, from which fightroom.ts's own formMatch builds the very room the
   old lobby mirror built, shared seed and all. The fight then runs exactly as it
   always did: the pair meet in a peer room named by roomNameFor (WebRTC, signalled
   through /api/rtc), ready taps, input runs and chat ride it, each device steps
   BOTH fights locally, and chat is re-cleaned and re-checked on the way in, never
   trusted from the wire.

   Kids Mode: joining is refused here as well as in fightroom.ts and by the server —
   the flag is kidActive from kid.ts, worked out from the live game state exactly
   the way components/game/use-kid.ts works it out, and it rides along with the
   join so the server can refuse on its own side too. */

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

type QueueSide = { id: string; name: string; fish: WireFish; at: number };
type QueueMatch = { room: string; seed: number; you: QueueSide; opponent: QueueSide };
type QueueReply = {
  state?: string;
  waiting?: number;
  match?: QueueMatch;
  error?: string;
  problem?: string;
};

let fightConn: P2PRoom | null = null;
let fightConnName = "";
let poll = 0;
let bound = false;
let active = false;
/** You mean to be in the server's queue (a poll that hears "off" while this is set
    is a lost race or a blip — the poll joins again rather than giving up). */
let wantQueue = false;
/** The join time to reclaim when rejoining after a partner left a waiting room. */
let requeueAt = 0;
let me = "";
let myName = "Angler";
let myFishId = "perch";
const mirror: FightQueue = emptyFightQueue();

/** Is Kids Mode in force right now? (kid.ts's rule, on the live store.) */
function kidOnNow(): boolean {
  const s = useGame.getState();
  return kidActive(s.kid, MODES[s.mode]);
}

async function queuePost(body: Record<string, unknown>, keepalive = false): Promise<QueueReply | null> {
  try {
    const res = await fetch("/api/fight-queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
    });
    return (await res.json()) as QueueReply;
  } catch {
    return null;
  }
}

function syncStore() {
  /* The server holds the queue now; the mirror only ever holds my own room. */
  mirror.rooms = mirror.rooms.filter((r) => r.players.some((p) => p.id === me));
  const room = roomOfPlayer(mirror, me);
  if (room && !fightConn) openFightConn(room.players[0].id, room.players[1].id);
  useFightRoomLive.setState({
    queued: false,
    waiting: 0,
    view: room ? roomView(room) : null,
  });
}

/** Take a match the server made and build the local room from it, in true join
    order, through fightroom.ts's own pairing — same seed, same room, both devices. */
function adoptMatch(match: QueueMatch) {
  mirror.waiting = [];
  mirror.rooms = [];
  const first = match.you.at <= match.opponent.at ? match.you : match.opponent;
  const second = first === match.you ? match.opponent : match.you;
  joinQueue(mirror, { id: first.id, name: first.name, fish: fishFromWire(first.fish), at: first.at }, false);
  joinQueue(mirror, { id: second.id, name: second.name, fish: fishFromWire(second.fish), at: second.at }, false);
  syncStore();
}

/** Read a standing answer from the server (from the join, or from a poll). */
function applyStanding(reply: QueueReply | null) {
  if (!reply) return;
  if (reply.state === "matched" && reply.match) {
    wantQueue = false;
    requeueAt = 0;
    stopPoll();
    adoptMatch(reply.match);
    return;
  }
  if (reply.state === "waiting") {
    useFightRoomLive.setState({ status: "on", queued: true, waiting: reply.waiting ?? 1, view: null });
  }
}

function startPoll() {
  stopPoll();
  poll = window.setInterval(() => {
    void (async () => {
      if (!me || !wantQueue) return;
      let reply = await queuePost({ op: "status", playerId: me });
      if (reply?.state === "off" && wantQueue) {
        /* The server has no place for me (a dissolved match, a pruned row, a lost
           join): join again, reclaiming my original join time if I had one. */
        reply = await queuePost({
          op: "join",
          playerId: me,
          name: myName,
          fishId: myFishId,
          kid: kidOnNow(),
          ...(requeueAt ? { at: requeueAt } : {}),
        });
        if (reply?.error) {
          wantQueue = false;
          active = false;
          useFightRoomLive.setState({
            status: "off",
            queued: false,
            waiting: 0,
            problem: reply.problem ?? "Couldn't join the queue. The rest of the game still works.",
          });
          return;
        }
      }
      if (!me || !wantQueue) return;
      applyStanding(reply);
    })();
  }, 2000);
}

function stopPoll() {
  if (poll) window.clearInterval(poll);
  poll = 0;
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
  } else if (msg.k === "fr-leave") {
    const wasWaiting = room.phase === "waiting";
    const createdAt = room.createdAt;
    leaveRoom(mirror, room.id, from);
    if (wasWaiting) {
      /* The room dissolved before it started: fightroom.ts put me back in line
         locally; the server's queue is the real one, so rejoin it with the time
         the match was made (my place in line) and let the poll take it from there. */
      closeFightConn();
      leaveQueue(mirror, me);
      requeueAt = createdAt;
      wantQueue = true;
      void queuePost({ op: "join", playerId: me, name: myName, fishId: myFishId, kid: kidOnNow(), at: createdAt }).then(
        (reply) => {
          if (!me || !wantQueue) return;
          if (reply?.error) {
            wantQueue = false;
            active = false;
            useFightRoomLive.setState({
              status: "off",
              queued: false,
              waiting: 0,
              view: null,
              problem: reply.problem ?? "Couldn't join the queue. The rest of the game still works.",
            });
            return;
          }
          applyStanding(reply);
          if (reply?.state === "waiting") startPoll();
        },
      );
    }
  } else return;
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
  if (active) return; /* already in */
  active = true;
  myName = safeName(name, "Angler");
  myFishId = fishId;
  me = loose().toString(36).slice(2, 10) + loose().toString(36).slice(2, 6);
  requeueAt = 0;
  wantQueue = true;
  useFightRoomLive.setState({ status: "joining", problem: "" });
  const reply = await queuePost({ op: "join", playerId: me, name: myName, fishId, kid: kidOnNow() });
  if (!active) return; /* left again while the join was out */
  if (!reply || reply.error) {
    active = false;
    wantQueue = false;
    me = "";
    useFightRoomLive.setState({
      status: "off",
      problem: reply?.problem ?? "Couldn't reach the room. The rest of the game still works.",
    });
    return;
  }
  useFightRoomLive.setState({ status: "on" });
  applyStanding(reply);
  if (reply.state === "waiting") startPoll();
  if (!bound) {
    bound = true;
    window.addEventListener("pagehide", () => leaveFightQueue());
  }
}

/** Leave the queue, or forfeit/leave your room, and close the fight room. */
export function leaveFightQueue() {
  wantQueue = false;
  requeueAt = 0;
  stopPoll();
  const room = roomOfPlayer(mirror, me);
  if (room) {
    fightConn?.send({ k: "fr-leave" } satisfies FightWire);
    leaveRoom(mirror, room.id, me);
  }
  /* Tell the server too: out of the queue, and any unclaimed match dissolved
     (the other angler goes back in line there, keeping their place). */
  if (me) void queuePost({ op: "leave", playerId: me }, true);
  leaveQueue(mirror, me);
  /* Forget my rooms locally (a finished one, or the one just forfeited): the
     queue must be able to take me again, and the screen goes back to the start. */
  mirror.rooms = mirror.rooms.filter((r) => !r.players.some((p) => p.id === me));
  closeFightConn();
  active = false;
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
