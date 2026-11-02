/* Shared plumbing for the tournament API: the request/response shape the handlers use,
   input cleaning, rate limiting and the time helpers. Server-only (the `.server` suffix keeps
   it out of the browser bundle). Handlers take a `Sql` so tests can hand them an in-memory
   PGLite without going through `@/lib/db`, and routes stay thin. */

import type { Sql } from "@/lib/db";
import { safeName } from "@/game/safe";

/** What a handler needs to know about a request, already read and size-checked by the route. */
export type ApiReq = {
  method: "GET" | "POST";
  url: URL;
  /** Parsed JSON body (POST); undefined when there was none. */
  body?: unknown;
  /** Client address for rate limiting; "local" when no proxy header is present. */
  ip: string;
  /** Server clock, milliseconds. Injected so tests can move time. */
  now: number;
};

export type ApiRes = { status: number; body: Record<string, unknown>; cache?: string };

export const ok = (body: Record<string, unknown>, cache?: string): ApiRes => ({ status: 200, body, cache });
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ApiRes => ({
  status,
  body: { error, ...extra },
});

/** Largest request body any tournament route will read. An envelope is about 1 KB; a survival log is bigger. */
export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_LOG_BYTES = 96 * 1024;

/* ── Limits (06 §1.5) ──────────────────────────────────────────────────── */

/** An accepted envelope at most this often per player. */
export const ENVELOPE_GAP_MS = 2000;
/** Write requests per minute per address, and reads per minute per address. */
export const WRITES_PER_MINUTE = 40;
export const READS_PER_MINUTE = 240;
/** Rate or mismatch strikes in one event before a one-hour ban. */
export const STRIKES_TO_BAN = 3;
export const BAN_MS = 60 * 60_000;
/** An envelope's `at` may be this far outside the event window … */
export const WINDOW_SLACK_MS = 30_000;
/** … and must be recent: not in the future, and no older than a cast can last. */
export const AT_AHEAD_MS = 30_000;
export const AT_BEHIND_MS = 180_000;
/** Clock slack when checking a player's total fishing time against the wall clock. */
export const WALL_SLACK_S = 10;

/* ── Cleaning input ────────────────────────────────────────────────────── */

export function cleanId(v: unknown): string | null {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null;
}

export function cleanEventId(v: unknown): string | null {
  return typeof v === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(v) ? v : null;
}

/** A display name: letters, numbers, spaces and a little punctuation, 2–20 characters, and kid-safe
    (no rude words, web addresses or phone numbers: src/game/safe.ts). Anything else becomes `fallback`. */
export function cleanName(v: unknown, fallback: string): string {
  return safeName(v, fallback);
}

export const defaultName = (playerId: string) => `Angler ${playerId.slice(0, 4).toUpperCase()}`;

export function clampInt(v: unknown, lo: number, hi: number, d: number): number {
  const n = typeof v === "string" && v.trim() ? Number(v) : typeof v === "number" ? v : d;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
}

/* ── SQL helpers (Postgres and PGLite alike) ───────────────────────────── */

/** `to_timestamp` for a millisecond value passed as a parameter. */
export const TS = (n: number) => `to_timestamp(($${n}::double precision) / 1000.0)`;
/** A timestamptz column as epoch milliseconds (a bigint, so both drivers hand back a number). */
export const MS = (col: string) => `(extract(epoch from ${col}) * 1000)::bigint`;

/** Count one hit for `key` this minute and say whether the caller is still within `limit`. */
export async function rateHit(sql: Sql, key: string, limit: number, now: number): Promise<boolean> {
  const bucket = Math.floor(now / 60_000);
  const rows = await sql.query<{ n: number }>(
    `insert into rate_hits (key, bucket, n) values ($1, $2, 1)
     on conflict (key, bucket) do update set n = rate_hits.n + 1
     returning n`,
    [key, bucket],
  );
  /* Tidy old buckets now and then; the table never grows past a few minutes of keys. */
  if (Math.random() < 0.02) await sql.query("delete from rate_hits where bucket < $1", [bucket - 5]);
  return Number(rows[0]?.n ?? 1) <= limit;
}

/** The standard "too many requests" answer. */
export const tooMany = () => fail(429, "slow_down", { verdict: "rate" });

/** Read-limit guard used by the GET handlers. */
export async function readGuard(sql: Sql, req: ApiReq): Promise<ApiRes | null> {
  return (await rateHit(sql, `r:${req.ip}`, READS_PER_MINUTE, req.now)) ? null : tooMany();
}

/** Write-limit guard used by the POST handlers: per address, per minute. */
export async function writeGuard(sql: Sql, req: ApiReq): Promise<ApiRes | null> {
  return (await rateHit(sql, `w:${req.ip}`, WRITES_PER_MINUTE, req.now)) ? null : tooMany();
}

export function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
