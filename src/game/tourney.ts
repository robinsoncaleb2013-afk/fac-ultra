/* The client's side of a tournament (docs/architecture/06 §1.3, §3): who you are, talking to the server,
   the queue of envelopes waiting for a verdict, and the small pure helpers the HUD reads.

   Nothing here touches the store or the browser's DOM, so the queue and the clock arithmetic are unit-tested
   in Node. The engine owns the one live run (`useGame.tourney`); this file never imports it. */

import { loose } from "./rng.ts";
import type { LureFamily } from "./presentation.ts";
import type { Envelope } from "./replay.ts";
import type { Category, Landed } from "./scoring.ts";
import type { ResultRow, TeamRow } from "./social.ts";

/* ── Who you are (anonymous until WP-9 accounts) ─────────────────────────── */

export const PLAYER_KEY = "fac-player-id";
export const NAME_KEY = "fac-player-name";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function makeId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  let id = "";
  while (id.length < 32) id += Math.floor(loose() * 16).toString(16);
  return id;
}

/** This device's anonymous player id, made once and kept. */
export function playerId(): string {
  const ls = storage();
  try {
    const have = ls?.getItem(PLAYER_KEY);
    if (have && /^[A-Za-z0-9_-]{8,64}$/.test(have)) return have;
  } catch {
    /* private mode */
  }
  const id = makeId();
  try {
    ls?.setItem(PLAYER_KEY, id);
  } catch {
    /* private mode: a new id each visit is fine */
  }
  return id;
}

export function playerName(): string {
  try {
    return storage()?.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePlayerName(name: string) {
  try {
    storage()?.setItem(NAME_KEY, name.slice(0, 20));
  } catch {
    /* private mode */
  }
}

/* ── What the server tells us ────────────────────────────────────────────── */

export type EventInfo = {
  id: string;
  kind: "quick" | "daily" | "weekly" | "private" | "survival";
  title: string;
  water: number;
  waterName: string;
  category: Category;
  castBudget: number;
  fishingSeconds: number;
  startsAt: number;
  endsAt: number;
  series: string | null;
  entrants: number;
  state: "upcoming" | "live" | "ended";
  joined?: boolean;
  /* WP-8 */
  team?: boolean;
  maxPlayers?: number | null;
  /** The four-letter code of a private event. */
  code?: string | null;
  /** WP-14: the fight/line rules version the event was made under (none = 1, an event from before line wear). */
  rulesVersion?: number;
};

export type Standing = {
  castsUsed: number;
  castsLeft: number;
  secondsUsed: number;
  secondsLeft: number;
  nextCast: number;
  score: number;
  bestWeight: number;
  species: number;
  fish: number;
  rank: number;
  entrants: number;
  serverNow: number;
};

export type JoinInfo = Standing & {
  event: EventInfo;
  seed: number;
  water: number;
  waterName: string;
  startsAt: number;
  endsAt: number;
  name: string;
  /** WP-8: the preset team picked in a team event. */
  team?: string | null;
};

export type Verdict = "ok" | "mismatch" | "budget" | "stale" | "rate" | "banned";

export type CatchReply = Standing & {
  verdict: Verdict;
  reason?: string;
  again?: boolean;
  result?: { outcome: "missed" | "lost" | "landed"; weight: number; value: number; name: string | null; seconds: number } | null;
  error?: string;
};

export type BoardRow = {
  rank: number;
  name: string;
  score: number;
  bestWeight: number;
  species: number;
  fish: number;
  casts: number;
  you: boolean;
  /* WP-8: a Regular topping up a short Quick board, and the preset team in a team event */
  rival?: boolean;
  portrait?: string;
  team?: string | null;
};

export type BoardReply = {
  eventId: string;
  title: string;
  kind?: EventInfo["kind"];
  category: Category;
  state: "upcoming" | "live" | "ended";
  endsAt: number;
  serverNow: number;
  entrants: number;
  humans?: number;
  final: boolean;
  rows: BoardRow[];
  me: BoardRow | null;
  teams?: TeamRow[];
};

/* ── The run the engine keeps ────────────────────────────────────────────── */

export type TourneyRun = {
  event: Pick<EventInfo, "id" | "kind" | "title" | "category" | "castBudget" | "fishingSeconds" | "startsAt" | "endsAt"> & { rulesVersion?: number };
  seed: number;
  water: number;
  playerId: string;
  /** Server clock minus this device's clock, ms, taken when the join reply arrived. */
  offset: number;
  /** The next cast's index (this device's count; the server's `nextCast` corrects it). */
  castIndex: number;
  /** Casts and seconds the server has counted, plus this device's pending ones. */
  castsUsed: number;
  secondsUsed: number;
  /** The tackle chosen for the event. */
  family: LureFamily;
  /** WP-8: the preset team, in a team event. */
  team: string | null;
  /** Envelopes sent or waiting for a verdict. */
  pending: number;
  /** What this device believes it has landed (the server's replay has the last word). */
  mine: Landed[];
  /** The server's last word on score and rank. */
  score: number;
  rank: number;
  entrants: number;
  /** A line for the HUD: the last verdict in plain words. */
  note: string;
  over: boolean;
};

/** The server's idea of "now" on this device. */
export const serverNow = (run: Pick<TourneyRun, "offset">, clientNow = Date.now()) => clientNow + run.offset;

export const castsLeft = (run: Pick<TourneyRun, "event" | "castsUsed">) => Math.max(0, run.event.castBudget - run.castsUsed);
export const secondsLeft = (run: Pick<TourneyRun, "event" | "secondsUsed">) => Math.max(0, run.event.fishingSeconds - run.secondsUsed);
export const msToClose = (run: Pick<TourneyRun, "event" | "offset">, clientNow = Date.now()) => Math.max(0, run.event.endsAt - serverNow(run, clientNow));

/** Can a new cast be made right now? Returns why not, in plain words, or null. */
export function cantCast(run: TourneyRun, clientNow = Date.now()): string | null {
  if (run.over) return "This event is over.";
  const now = serverNow(run, clientNow);
  if (now < run.event.startsAt) return "It hasn't started yet.";
  if (now >= run.event.endsAt) return "Time's up. The event is over.";
  if (castsLeft(run) <= 0) return "You've used all your casts.";
  if (secondsLeft(run) <= 0.7) return "You've used all your fishing time.";
  return null;
}

/** "7:42" from milliseconds. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** The plain-English line for a verdict (kids read this). */
export function verdictNote(r: Pick<CatchReply, "verdict" | "reason">): string {
  switch (r.verdict) {
    case "ok":
      return "Catch checked. It counts.";
    case "mismatch":
      return "That catch didn't check out, so it doesn't count.";
    case "budget":
      return r.reason === "seconds" ? "You ran out of fishing time before that one landed." : "That was past your last cast.";
    case "stale":
      return r.reason === "event_over" || r.reason === "outside_window" ? "That landed after the closing bell." : "That one was too old to count.";
    case "banned":
      return "You're sitting out for a while. Too many odd casts.";
    default:
      return "Easy there. The server is catching up.";
  }
}

/* ── Talking to the server ───────────────────────────────────────────────── */

export type Fetcher = typeof fetch;

async function json<T>(f: Fetcher, url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await f(url, init);
  let body = {} as T;
  try {
    body = (await res.json()) as T;
  } catch {
    /* an empty or broken body: the status tells the story */
  }
  return { status: res.status, body };
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/* ── Friends (WP-8) ───────────────────────────────────────────────────────── */

export type FriendInfo = { code: string; name: string; handle?: string | null; online: boolean; fishing: { id: string; title: string } | null };
/** A player in a request or block list (WP-10). */
export type PersonInfo = { code: string; name: string; handle: string | null };
export type InviteInfo = {
  id: number;
  from: { code: string; name: string };
  event: { id: string; title: string; waterName: string; startsAt: number; endsAt: number };
};
export type FriendsReply = {
  serverNow: number;
  me: { code: string; name: string; handle?: string };
  friends: FriendInfo[];
  invites: InviteInfo[];
  /** WP-10: people who asked you (accept or not), people you asked, and people you blocked. */
  requests?: { incoming: PersonInfo[]; outgoing: PersonInfo[] };
  blocked?: PersonInfo[];
  error?: string;
};
export type FriendOp =
  | "hello" | "add" | "remove" | "invite" | "dismiss"
  | "request" | "invite_email" | "redeem" | "accept" | "decline" | "cancel" | "block" | "unblock";

export const api = {
  events: (id: string, f: Fetcher = fetch) =>
    json<{ serverNow: number; events: EventInfo[]; privates?: EventInfo[]; error?: string }>(f, `/api/events?scope=open&playerId=${encodeURIComponent(id)}`),
  friends: (id: string, f: Fetcher = fetch) => json<FriendsReply>(f, `/api/friends?playerId=${encodeURIComponent(id)}`),
  friendOp: (op: FriendOp, id: string, extra: Record<string, unknown> = {}, f: Fetcher = fetch) =>
    json<FriendsReply>(f, "/api/friends", post({ op, playerId: id, ...extra })),
  /** Type-ahead for the "add by name" box (grown-up players, three letters at least). */
  friendSearch: (id: string, q: string, f: Fetcher = fetch) =>
    json<{ serverNow: number; matches: { handle: string; name: string }[]; error?: string }>(f, "/api/friends", post({ op: "search", playerId: id, q })),
  trophies: (id: string, f: Fetcher = fetch) => json<{ serverNow: number; results: ResultRow[]; error?: string }>(f, `/api/trophies?playerId=${encodeURIComponent(id)}`),
  byCode: (code: string, f: Fetcher = fetch) =>
    json<{ serverNow: number; event: EventInfo; error?: string }>(f, `/api/events?code=${encodeURIComponent(code)}`),
  create: (b: { playerId: string; name: string; water: number; category: Category; minutes: number; castBudget: number; team?: boolean }, f: Fetcher = fetch) =>
    json<{ code: string; event: EventInfo; error?: string }>(
      f,
      "/api/events",
      post({ op: "create", playerId: b.playerId, name: b.name, water: b.water, minutes: b.minutes, rules: { category: b.category, castBudget: b.castBudget, ...(b.team ? { team: true } : {}) } }),
    ),
  join: (eventId: string, id: string, name: string, f: Fetcher = fetch, team?: string) =>
    json<JoinInfo & { error?: string; startsAt: number }>(f, "/api/entry", post({ op: "join", eventId, playerId: id, name, ...(team ? { team } : {}) })),
  submit: (eventId: string, id: string, envelope: Envelope, f: Fetcher = fetch) =>
    json<CatchReply>(f, "/api/catch", post({ eventId, playerId: id, envelope })),
  board: (eventId: string, id: string, f: Fetcher = fetch, opts: { final?: boolean; top?: number } = {}) =>
    json<BoardReply & { error?: string }>(
      f,
      `/api/board?eventId=${encodeURIComponent(eventId)}&around=${encodeURIComponent(id)}&top=${opts.top ?? 10}${opts.final ? "&final=1" : ""}`,
    ),
};

/* ── The envelope queue ──────────────────────────────────────────────────── */

export type QueueDeps = {
  send: (env: Envelope) => Promise<{ status: number; body: CatchReply }>;
  /** Called with each envelope's verdict once the server has spoken. */
  onReply: (env: Envelope, reply: CatchReply) => void;
  /** Called when an envelope was dropped without a verdict (the server lost track of the index). */
  onDrop?: (env: Envelope, reply: CatchReply | null) => void;
  /** Wait this long (ms) then call the function. Injected so tests run instantly. */
  later?: (fn: () => void, ms: number) => void;
  /** Where to keep envelopes between visits, or null. */
  store?: { get: () => Envelope[]; set: (list: Envelope[]) => void } | null;
};

/** Envelopes go out one at a time, in order, and the player never waits for them. A `rate` answer waits and
    retries (the cast was not spent); a network failure retries with back-off; any other answer is final. */
export class EnvelopeQueue {
  private list: Envelope[] = [];
  private busy = false;
  private tries = 0;
  private dead = false;

  private deps: QueueDeps;

  constructor(deps: QueueDeps) {
    this.deps = deps;
    this.list = deps.store?.get() ?? [];
  }

  get size() {
    return this.list.length;
  }

  push(env: Envelope) {
    this.list.push(env);
    this.deps.store?.set(this.list);
    void this.pump();
  }

  /** Start sending whatever was left from an earlier visit. */
  resume() {
    void this.pump();
  }

  stop() {
    this.dead = true;
  }

  private later(fn: () => void, ms: number) {
    (this.deps.later ?? ((f, m) => void setTimeout(f, m)))(fn, ms);
  }

  private async pump(): Promise<void> {
    if (this.busy || this.dead) return;
    const env = this.list[0];
    if (!env) return;
    this.busy = true;
    let res: { status: number; body: CatchReply } | null = null;
    try {
      res = await this.deps.send(env);
    } catch {
      res = null;
    }
    this.busy = false;
    if (this.dead) return;
    if (!res) {
      this.tries++;
      if (this.tries > 8) {
        this.drop(env, null);
        return;
      }
      this.later(() => void this.pump(), Math.min(15_000, 1000 * 2 ** this.tries));
      return;
    }
    this.tries = 0;
    const { status, body } = res;
    if (body.verdict === "rate" || status === 429 || status >= 500) {
      this.later(() => void this.pump(), 2600);
      return;
    }
    if (!body.verdict) {
      /* 400/403/404 with no verdict: this envelope can never be accepted. */
      this.drop(env, body);
      return;
    }
    this.list.shift();
    this.deps.store?.set(this.list);
    this.deps.onReply(env, body);
    if (body.verdict === "stale" && body.reason === "cast_index") {
      /* The server is somewhere else in the sequence: what's behind this envelope can't line up either. */
      const rest = this.list.splice(0);
      this.deps.store?.set(this.list);
      for (const e of rest) this.deps.onDrop?.(e, body);
      return;
    }
    if (body.verdict === "banned") {
      const rest = this.list.splice(0);
      this.deps.store?.set(this.list);
      for (const e of rest) this.deps.onDrop?.(e, body);
      return;
    }
    void this.pump();
  }

  private drop(env: Envelope, reply: CatchReply | null) {
    this.list.shift();
    this.deps.store?.set(this.list);
    this.deps.onDrop?.(env, reply);
    void this.pump();
  }
}

/** Keep a queue's leftovers in localStorage under one key per event. */
export function queueStore(eventId: string): QueueDeps["store"] {
  const key = `fac-tourney-queue:${eventId}`;
  return {
    get: () => {
      try {
        const raw = storage()?.getItem(key);
        const list = raw ? (JSON.parse(raw) as Envelope[]) : [];
        return Array.isArray(list) ? list.slice(0, 200) : [];
      } catch {
        return [];
      }
    },
    set: (list) => {
      try {
        if (list.length) storage()?.setItem(key, JSON.stringify(list));
        else storage()?.removeItem(key);
      } catch {
        /* private mode */
      }
    },
  };
}
