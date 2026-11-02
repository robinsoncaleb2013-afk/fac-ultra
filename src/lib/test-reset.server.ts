/* TEST PHASE (server): when a new build starts, wipe progress once. See docs/TEST-PHASE.md.

   One SQL statement does everything, so it is all-or-nothing on both PGLite and Postgres and needs no
   transaction support from the `Sql` wrapper. The statement first tries to move the stored epoch to the new
   one; only the request that actually moves it (the row's value differs) sees a row in `claim`, and every
   delete is guarded by `exists (select 1 from claim)`. Two requests at boot race on the same row: the
   second waits for the first, re-checks, finds the epoch already current, and wipes nothing. */

import type { Sql } from "@/lib/db";
import { currentEpoch, decideEpoch, resetSwitchOn, WIPE_TABLES } from "./test-phase.ts";

export type ResetOutcome = { verdict: "first" | "same" | "reset" | "off"; epoch: string; previous: string | null };

const EPOCH_KEY = "build_epoch";

/** The statement text. Table names come from the constant list above, never from a request. */
export function wipeStatement(): string {
  for (const t of WIPE_TABLES) if (!/^[a-z_]+$/.test(t)) throw new Error(`bad table name in WIPE_TABLES: ${t}`);
  const deletes = WIPE_TABLES.map((t, i) => `w${i} as (delete from ${t} where exists (select 1 from claim) returning 1)`);
  return `with prev as (select value from app_state where key = '${EPOCH_KEY}'),
claim as (
  insert into app_state (key, value) values ('${EPOCH_KEY}', $1)
  on conflict (key) do update set value = excluded.value, updated_at = now() where app_state.value <> excluded.value
  returning 1
),
${deletes.join(",\n")},
cleared as (update players set banned_until = null, last_seen = null, at_event = null where exists (select 1 from claim) returning 1)
select exists (select 1 from claim) as fired, (select value from prev) as previous`;
}

/** Run the check for this build. Safe to call on every boot and from many requests at once. Never throws
    into the caller's request path (see applyTestPhaseReset); this one throws so tests can see errors. */
export async function runTestReset(
  sql: Sql,
  opts: { epoch?: string; on?: boolean; log?: (line: string) => void } = {},
): Promise<ResetOutcome> {
  const epoch = opts.epoch ?? currentEpoch(process.env);
  const on = opts.on ?? resetSwitchOn(process.env);
  const log = opts.log ?? ((l: string) => console.log(l));
  if (!on) return { verdict: "off", epoch, previous: null };
  const rows = await sql.query<{ fired: boolean; previous: string | null }>(wipeStatement(), [epoch]);
  const fired = rows[0]?.fired === true;
  const previous = rows[0]?.previous ?? null;
  if (!fired) return { verdict: "same", epoch, previous };
  const verdict = decideEpoch(previous, epoch, on) === "first" ? "first" : "reset";
  log(
    `[test-phase] New build ${epoch}${previous ? ` (was ${previous})` : ""}: progress, saves and tournament data wiped. ` +
      `Accounts, family profiles and friends kept. Turn off with FAC_TEST_RESET=0.`,
  );
  return { verdict, epoch, previous };
}

/** Called by getSql() once per process after migrations. A failure here must never stop the game starting. */
export async function applyTestPhaseReset(sql: Sql): Promise<void> {
  try {
    await runTestReset(sql);
  } catch (err) {
    console.error("[test-phase] reset check failed (the game keeps running):", err);
  }
}
