/* The social layer of tournaments (docs/architecture/06 §3, WP-8): emotes, the P2P mesh caps, teams,
   friend codes, medals, titles, bobber skins and the small reading helpers for the saved trophy fields.

   Everything here is pure, so the server, the client and the tests share one set of rules. Nothing
   in this file can change a score: rewards are cosmetic (06 §3.5: "rewards never add power"). */

import { BIOMES } from "./content.ts";
import { CATEGORIES, type Category } from "./scoring.ts";

/* ── Emotes (06 §3.3): eight presets, no free text ──────────────────────── */

export type Emote = { id: string; glyph: string; text: string };

export const EMOTES: readonly Emote[] = [
  { id: "nice", glyph: "👍", text: "Nice fish!" },
  { id: "big", glyph: "🐋", text: "Big one on!" },
  { id: "rod", glyph: "🎣", text: "Good luck!" },
  { id: "fish", glyph: "🐟", text: "Fish on!" },
  { id: "wow", glyph: "😮", text: "Wow!" },
  { id: "clap", glyph: "👏", text: "Well done!" },
  { id: "rain", glyph: "🌧️", text: "Here comes the rain." },
  { id: "trophy", glyph: "🏆", text: "Going for gold!" },
];

export const EMOTE_IDS: readonly string[] = EMOTES.map((e) => e.id);

/** A bubble stays over the boat this long, and one angler may send one this often. */
export const EMOTE_SHOW_MS = 3000;
export const EMOTE_GAP_MS = 1500;
/** The most bubbles an angler may have on screen from one peer, and a catch feed this long. */
export const FEED_MAX = 12;

export function emoteOf(id: unknown): Emote | null {
  return typeof id === "string" ? (EMOTES.find((e) => e.id === id) ?? null) : null;
}

/** May an emote go out now? Too soon returns false (the button greys out, nothing is sent). */
export function canEmote(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= EMOTE_GAP_MS;
}

/* ── The P2P mesh (06 §3.3, 09 §7) ──────────────────────────────────────── */

/** Most other anglers one device connects to: a phone 4, a PC 8. Beyond that the board is still polled. */
export const MESH_PHONE = 4;
export const MESH_DESKTOP = 8;

export const meshCap = (form: "phone" | "tablet" | "desktop"): number => (form === "desktop" ? MESH_DESKTOP : MESH_PHONE);

/** Who this device should hold a connection with. Peers it already has stay; the rest of the room is
    taken in id order until the cap is reached, so two devices with the same cap pick the same pairs. */
export function chooseMesh(roster: readonly string[], connected: readonly string[], cap: number): string[] {
  const here = new Set(roster);
  const keep = connected.filter((id) => here.has(id)).slice(0, cap);
  const have = new Set(keep);
  for (const id of [...roster].sort()) {
    if (keep.length >= cap) break;
    if (!have.has(id)) {
      keep.push(id);
      have.add(id);
    }
  }
  return keep;
}

/* What peers may say to each other over the data channel. Everything is validated; text is never sent,
   only ids, so a rude peer has nothing to show on your screen. */
export type Wire =
  | { k: "emote"; id: string }
  | { k: "boat"; biome: number; name: string }
  | { k: "catch"; b: number; i: number; w: number };

const FISH_PER_WATER = 25;

export function readWire(data: unknown): Wire | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.k === "emote") return emoteOf(o.id) ? { k: "emote", id: o.id as string } : null;
  if (o.k === "boat") {
    const biome = o.biome;
    if (typeof biome !== "number" || !Number.isInteger(biome) || biome < 0 || biome >= BIOMES.length) return null;
    return { k: "boat", biome, name: typeof o.name === "string" ? o.name.replace(/[^\p{L}\p{N} _.'-]/gu, "").slice(0, 20) : "" };
  }
  if (o.k === "catch") {
    const { b, i, w } = o;
    if (typeof b !== "number" || !Number.isInteger(b) || b < 0 || b >= BIOMES.length) return null;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= FISH_PER_WATER) return null;
    if (typeof w !== "number" || !Number.isFinite(w) || w <= 0 || w > 1e5) return null;
    return { k: "catch", b, i, w: Math.round(w * 10) / 10 };
  }
  return null;
}

/** The event's own room name on the relay. */
export const roomOf = (eventId: string) => `t-${eventId}`.slice(0, 64);

/* ── Teams (06 §3.4) ─────────────────────────────────────────────────────── */

export type Team = { id: string; name: string; emoji: string };

/** Eight friendly team names to pick from: no typing, nothing to moderate. */
export const TEAMS: readonly Team[] = [
  { id: "otters", name: "Otters", emoji: "🦦" },
  { id: "herons", name: "Herons", emoji: "🪽" },
  { id: "pike", name: "Pike", emoji: "🐟" },
  { id: "gulls", name: "Gulls", emoji: "🕊️" },
  { id: "seals", name: "Seals", emoji: "🦭" },
  { id: "crabs", name: "Crabs", emoji: "🦀" },
  { id: "loons", name: "Loons", emoji: "🦆" },
  { id: "frogs", name: "Frogs", emoji: "🐸" },
];

/** Most anglers on one team, and most teams in one event (16 anglers in all). */
export const TEAM_MAX = 4;
export const TEAM_COUNT = 4;

export function teamById(id: unknown): Team | null {
  return typeof id === "string" ? (TEAMS.find((t) => t.id === id) ?? null) : null;
}

export type TeamRow = { team: string; name: string; emoji: string; rank: number; score: number; best: number; members: number; fish: number; you: boolean };

/** Rank teams (competition ranking: equal score and best fish share a place) and name them. */
export function rankTeams(rows: readonly { team: string; score: number; best: number; members: number; fish: number }[]): Omit<TeamRow, "you">[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score || b.best - a.best || a.team.localeCompare(b.team));
  return sorted.map((r) => {
    const ahead = sorted.filter((o) => o.score > r.score || (o.score === r.score && o.best > r.best)).length;
    const t = teamById(r.team);
    return { team: r.team, name: t?.name ?? r.team, emoji: t?.emoji ?? "", rank: ahead + 1, score: Number(r.score), best: Number(r.best), members: Number(r.members), fish: Number(r.fish) };
  });
}

/* ── Friends (06 §3.3; WP-9 links these to accounts) ─────────────────────── */

/** No I, O, 0 or 1, so a code reads the same aloud. */
export const FRIEND_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_LEN = 6;
export const MAX_FRIENDS = 50;
export const MAX_INVITES = 20;
/** A friend counts as "here" if they were seen this recently. */
export const ONLINE_MS = 90_000;
/** An invite is good for this long (or until the event is over). */
export const INVITE_MS = 30 * 60_000;

/** A typed friend code, tidied: upper case, no dashes or spaces. Null if it cannot be one. */
export function cleanFriendCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.toUpperCase().replace(/[\s-]/g, "");
  return c.length === FRIEND_CODE_LEN && [...c].every((ch) => FRIEND_ALPHABET.includes(ch)) ? c : null;
}

/** Pending friend requests one player can have out, or waiting on one player (WP-10). */
export const MAX_PENDING = 50;

/** "RiverRat#4821": the name the server knows plus the short number it handed out. */
export const handleOf = (name: string, tag: number) => `${name}#${tag}`;

/** A typed "Name#1234", tidied. Null if it cannot be one (the name is cleaned the same way names are everywhere else). */
export function cleanHandle(v: unknown): { name: string; tag: number } | null {
  if (typeof v !== "string") return null;
  const m = /^\s*(.{2,20}?)\s*#\s*(\d{4})\s*$/.exec(v);
  if (!m) return null;
  if (/[<>"\\]/.test(m[1])) return null;
  return { name: m[1], tag: Number(m[2]) };
}

/** What the type-ahead looks up: the first letters of a name, lower case. Needs three. */
export function searchPrefix(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const q = v.split("#")[0].trim().toLowerCase();
  return q.length >= 3 && q.length <= 20 && !/[<>"\\%_]/.test(q) ? q : null;
}

/** A typed email address, tidied. Null if it plainly is not one. Kept short on purpose. */
export function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 120 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(e) ? e : null;
}

/** "ABC-XYZ" for reading out loud. */
export const formatFriendCode = (c: string) => `${c.slice(0, 3)}-${c.slice(3)}`;

/** Make a code from random bytes. */
export function friendCodeFrom(bytes: ArrayLike<number>): string {
  let out = "";
  for (let i = 0; i < FRIEND_CODE_LEN; i++) out += FRIEND_ALPHABET[(bytes[i] ?? 0) % FRIEND_ALPHABET.length];
  return out;
}

/* ── Medals, titles and bobber skins (06 §3.5) ──────────────────────────── */

export type Medal = 0 | 1 | 2 | 3;
export const MEDAL_NAMES = ["", "Gold", "Silver", "Bronze"] as const;

/** An event needs at least this many on the board (rivals count) before a medal means anything. */
export const MEDAL_MIN_BOARD = 2;

/** The medal for finishing `rank` among `board` entries with `score`. Nobody medals for catching nothing. */
export function medalFor(rank: number, board: number, score: number): Medal {
  if (board < MEDAL_MIN_BOARD || !(score > 0) || rank < 1 || rank > 3) return 0;
  return rank as Medal;
}

export type ResultRow = {
  id: string;
  title: string;
  kind: "quick" | "daily" | "weekly" | "private" | "survival";
  water: number;
  category: Category;
  /** Team id if the event was a team event. */
  team: string | null;
  rank: number;
  entrants: number;
  score: number;
  best: number;
  /** When the event ended, server ms. */
  at: number;
  medal: Medal;
};

export type Trophy = { id: string; medal: 1 | 2 | 3; kind: ResultRow["kind"]; water: number; category: Category; team: string | null; at: number };

export type History = { id: string; title: string; kind: ResultRow["kind"]; water: number; category: Category; team: string | null; rank: number; entrants: number; score: number; best: number; at: number; medal: Medal };

export const MAX_HISTORY = 50;
export const MAX_TROPHIES = 60;
export const MAX_TITLES = 40;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 2" for a server instant (UTC, the same for everyone). */
export function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const KIND_WORD: Record<ResultRow["kind"], string> = { quick: "", daily: "Daily ", weekly: "Weekly ", private: "Club ", survival: "Survival " };

/** The title a win earns: "Pond Champion · Nov 2". Only first place wins one. Team wins say so. */
export function titleFor(r: Pick<ResultRow, "kind" | "water" | "team" | "at" | "medal">): string | null {
  if (r.medal !== 1) return null;
  const water = BIOMES[r.water]?.name ?? "Open Water";
  const team = teamById(r.team);
  const who = team ? `${team.name} ${KIND_WORD[r.kind]}Team Champions` : `${KIND_WORD[r.kind]}Champion`;
  return `${water} ${who} · ${shortDate(r.at)}`;
}

export type SkinId = "plain" | "bronze" | "silver" | "gold" | "team";

export type Skin = { id: SkinId; name: string; blurb: string; top: string; bottom: string; ring: string };

export const SKINS: readonly Skin[] = [
  { id: "plain", name: "Classic", blurb: "The red-and-white one everybody starts with.", top: "#f4f7f6", bottom: "#e2a23a", ring: "rgba(231,243,241,0.4)" },
  { id: "bronze", name: "Bronze", blurb: "For a bronze medal.", top: "#e9c9a6", bottom: "#a8683a", ring: "rgba(205,127,50,0.55)" },
  { id: "silver", name: "Silver", blurb: "For a silver medal.", top: "#f2f5f8", bottom: "#9aa7b4", ring: "rgba(200,212,224,0.6)" },
  { id: "gold", name: "Gold", blurb: "For winning an event.", top: "#fff1b8", bottom: "#e2a23a", ring: "rgba(255,214,102,0.7)" },
  { id: "team", name: "Team Colours", blurb: "For winning a team event.", top: "#bfeee4", bottom: "#1f8f7a", ring: "rgba(110,224,200,0.65)" },
];

export const SKIN_IDS: readonly string[] = SKINS.map((s) => s.id);

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === "string" && SKIN_IDS.includes(v);
}

export function skinOf(id: unknown): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/** Which skins these trophies have earned. Classic is always yours. */
export function unlockedSkins(trophies: readonly Pick<Trophy, "medal" | "team">[]): SkinId[] {
  const out: SkinId[] = ["plain"];
  if (trophies.some((t) => t.medal === 3)) out.push("bronze");
  if (trophies.some((t) => t.medal === 2)) out.push("silver");
  if (trophies.some((t) => t.medal === 1)) out.push("gold");
  if (trophies.some((t) => t.medal === 1 && t.team)) out.push("team");
  return out;
}

/* ── Reading the saved fields (never trust shape) ───────────────────────── */

const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v: unknown, lo: number, hi: number, d = 0) => Math.round(num(v, lo, hi, d));
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} _.'·,:()&-]/gu, "").slice(0, max) : "");
const KINDS = ["quick", "daily", "weekly", "private", "survival"] as const;
const kindOf = (v: unknown): ResultRow["kind"] => ((KINDS as readonly unknown[]).includes(v) ? (v as ResultRow["kind"]) : "quick");
const categoryOf = (v: unknown): Category => ((CATEGORIES as readonly unknown[]).includes(v) ? (v as Category) : "total");
const idOf = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(v) ? v : null);
const medalOf = (v: unknown): Medal => int(v, 0, 3) as Medal;

export function readTrophies(v: unknown): Trophy[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Trophy[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = idOf(o.id);
    const medal = medalOf(o.medal);
    if (!id || medal < 1 || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      medal: medal as 1 | 2 | 3,
      kind: kindOf(o.kind),
      water: int(o.water, 0, BIOMES.length - 1),
      category: categoryOf(o.category),
      team: teamById(o.team) ? (o.team as string) : null,
      at: int(o.at, 0, 1e15),
    });
    if (out.length >= MAX_TROPHIES) break;
  }
  return out;
}

export function readHistory(v: unknown): History[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: History[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = idOf(o.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: text(o.title, 80),
      kind: kindOf(o.kind),
      water: int(o.water, 0, BIOMES.length - 1),
      category: categoryOf(o.category),
      team: teamById(o.team) ? (o.team as string) : null,
      rank: int(o.rank, 1, 1e6, 1),
      entrants: int(o.entrants, 1, 1e6, 1),
      score: num(o.score, 0, 1e9),
      best: num(o.best, 0, 1e6),
      at: int(o.at, 0, 1e15),
      medal: medalOf(o.medal),
    });
    if (out.length >= MAX_HISTORY) break;
  }
  return out;
}

export function readTitles(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const t = text(x, 80).trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TITLES) break;
  }
  return out;
}

/* ── Filing results from the server ─────────────────────────────────────── */

export type Cabinet = { trophies: Trophy[]; titles: string[]; tourneyHistory: History[]; bobberSkin: SkinId };

/** Read what the server says about the player's finished events (untrusted: it is checked field by field). */
export function readResults(v: unknown): ResultRow[] {
  if (!Array.isArray(v)) return [];
  const out: ResultRow[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = idOf(o.id);
    if (!id) continue;
    out.push({
      id,
      title: text(o.title, 80),
      kind: kindOf(o.kind),
      water: int(o.water, 0, BIOMES.length - 1),
      category: categoryOf(o.category),
      team: teamById(o.team) ? (o.team as string) : null,
      rank: int(o.rank, 1, 1e6, 1),
      entrants: int(o.entrants, 1, 1e6, 1),
      score: num(o.score, 0, 1e9),
      best: num(o.best, 0, 1e6),
      at: int(o.at, 0, 1e15),
      medal: medalOf(o.medal),
    });
    if (out.length >= 200) break;
  }
  return out;
}

/** Merge finished-event results into the cabinet. Idempotent: the same results twice change nothing.
    Newest first; history keeps 50, trophies 60, titles 40. A chosen skin that is no longer earned falls back to Classic. */
export function applyResults(cab: Cabinet, results: readonly ResultRow[]): Cabinet {
  const hist = new Map<string, History>();
  for (const h of cab.tourneyHistory) hist.set(h.id, h);
  const tro = new Map<string, Trophy>();
  for (const t of cab.trophies) tro.set(t.id, t);
  const titles = [...cab.titles];
  for (const r of results) {
    hist.set(r.id, { id: r.id, title: r.title, kind: r.kind, water: r.water, category: r.category, team: r.team, rank: r.rank, entrants: r.entrants, score: r.score, best: r.best, at: r.at, medal: r.medal });
    if (r.medal >= 1) tro.set(r.id, { id: r.id, medal: r.medal as 1 | 2 | 3, kind: r.kind, water: r.water, category: r.category, team: r.team, at: r.at });
    const t = titleFor(r);
    if (t && !titles.includes(t)) titles.unshift(t);
  }
  const byNewest = <T extends { at: number }>(a: T, b: T) => b.at - a.at;
  const trophies = [...tro.values()].sort(byNewest).slice(0, MAX_TROPHIES);
  const skin = unlockedSkins(trophies).includes(cab.bobberSkin) ? cab.bobberSkin : "plain";
  return {
    trophies,
    titles: titles.slice(0, MAX_TITLES),
    tourneyHistory: [...hist.values()].sort(byNewest).slice(0, MAX_HISTORY),
    bobberSkin: skin,
  };
}

/** Results that are new to this cabinet (for the "you won a trophy" toast). */
export function newMedals(cab: Pick<Cabinet, "trophies">, results: readonly ResultRow[]): ResultRow[] {
  const have = new Set(cab.trophies.map((t) => t.id));
  return results.filter((r) => r.medal >= 1 && !have.has(r.id));
}

/* ── Lines for the board ─────────────────────────────────────────────────── */

const unitGap = (category: Category, gap: number): string => {
  switch (category) {
    case "big":
    case "total":
      return `${gap.toFixed(1)} lb`;
    case "sprint":
      return `${Math.round(gap)} ${Math.round(gap) === 1 ? "kind" : "kinds"}`;
    case "value":
      return `${Math.round(gap).toLocaleString("en-US")} pts`;
    default:
      return `${Math.round(gap)} days`;
  }
};

/** The phone ticker's tail: how far behind the angler above, or ahead of the one below. */
export function gapLine(category: Category, rank: number, myScore: number, ahead: { rank: number; score: number } | null, behind: { score: number } | null): string {
  if (rank > 1 && ahead) {
    const gap = Math.max(0, ahead.score - myScore);
    return gap > 0 ? `${unitGap(category, gap)} behind #${ahead.rank}` : `level with #${ahead.rank}`;
  }
  if (rank === 1 && behind) {
    const lead = Math.max(0, myScore - behind.score);
    return lead > 0 ? `${unitGap(category, lead)} in front` : "in the lead";
  }
  return rank === 1 ? "in the lead" : "";
}
