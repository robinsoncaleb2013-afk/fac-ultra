import type { NightProgress } from "@/game/night";

/* The Night fishing hub card (Update Three, P3 + P4).

   A display card only: every rule lives in src/game/ (night.ts, prestige.ts).
   The parent works out the view data from the save — the two unlock goals,
   whether night fishing is on, whether Prestige is ready — and hands in the
   three actions. This card reads that data and calls back; it computes
   nothing about the game itself. */

export type NightCardProps = {
  /** The two unlock goals and whether night fishing is open (nightProgress). */
  progress: NightProgress;
  /** Night fishing is switched on right now. */
  nightOn: boolean;
  /** Prestige is ready (prestigeReady: level 100 reached). */
  prestigeReadyNow: boolean;
  onStart: () => void;
  onCollect: () => void;
  onPrestige: () => void;
};

export function NightCard({ progress, nightOn, prestigeReadyNow, onStart, onCollect, onPrestige }: NightCardProps) {
  return (
    <section aria-label="Night fishing" className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-serif text-2xl leading-tight">Night fishing</h2>

      {nightOn ? (
        <>
          <p className="mt-1 text-[15px]">Night fishing is on.</p>
          <button type="button" data-nav="act" onClick={onCollect} className="hub-btn mt-3">
            Collect and stop
          </button>
        </>
      ) : progress.unlocked ? (
        <>
          <p className="mt-1 text-[15px] text-muted">
            While night fishing is on, fish are caught on their own. Come back later to collect them.
          </p>
          <button type="button" data-nav="act" onClick={onStart} className="hub-btn mt-3">
            Start night fishing
          </button>
        </>
      ) : (
        <p className="mt-1 text-[15px] text-muted">
          Beat {progress.bossesNeeded} bosses: {progress.bosses} of {progress.bossesNeeded} · Reach level{" "}
          {progress.levelNeeded}: level {progress.level}
        </p>
      )}

      {prestigeReadyNow ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[15px] text-muted">Reach Prestige 1 to unlock the final water.</p>
          <button type="button" data-nav="act" onClick={onPrestige} className="hub-btn mt-2">
            Prestige
          </button>
        </div>
      ) : null}
    </section>
  );
}
