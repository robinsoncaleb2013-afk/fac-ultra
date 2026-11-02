import { lazy, Suspense } from "react";
import { BagPanel } from "@/components/game/panels/BagPanel";
import { EmoteBar } from "@/components/game/event-social";
import { TournamentPanel } from "@/components/game/tournament";
import { DarkPanel } from "@/components/game/hub/panel-shell";

/* The single-panel tabs of the in-game menu (WP-12): Survival's Camp and Larder, and a tournament's Event. */

const CampPanel = lazy(() => import("@/components/game/panels/CampPanel").then((m) => ({ default: m.CampPanel })));

/** Survival: eat, smoke, make things and rest. */
export function CampTab(_: { split: boolean }) {
  return (
    <DarkPanel label="Camp" className="h-full">
      <Suspense fallback={<p className="text-muted">Opening…</p>}>
        <CampPanel />
      </Suspense>
    </DarkPanel>
  );
}

/** Survival: the fish you are keeping. Nothing is sold in Survival. */
export function LarderTab(_: { split: boolean }) {
  return (
    <DarkPanel label="Larder" className="h-full">
      <h2 className="mb-3 font-serif text-2xl">Your larder</h2>
      <BagPanel sell={false} />
    </DarkPanel>
  );
}

/** A tournament: the clock, your standing, the live board and the room. The same event panel as before, and nothing that changes the tackle. */
export function EventTab(_: { split: boolean }) {
  return (
    <DarkPanel label="Event" className="h-full">
      <section className="mb-3 rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Emotes</h3>
        <p className="text-sm text-muted">Send a small friendly picture to the others in the event. There is no typing.</p>
        <EmoteBar className="mt-2 mb-0 self-start" />
      </section>
      <TournamentPanel />
    </DarkPanel>
  );
}
