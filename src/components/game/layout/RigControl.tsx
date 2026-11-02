import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Drawer } from "vaul";
import { BAITS, BIOMES, LURES, SIG_LURES } from "@/game/content";
import { useGame } from "@/game/engine";
import { rigHint } from "@/game/match";
import {
  DEFAULT_RIG,
  DEPTH_INFO,
  DEPTHS,
  FAMILY_INFO,
  familyOf,
  RETRIEVE_INFO,
  RETRIEVES,
  rigLabel,
  type Depth,
  type Retrieve,
} from "@/game/presentation";
import { resolveSpot, spotsOf } from "@/game/spots";
import { cn } from "@/lib/cn";

/** What is on the line, in words: the bait, else the signature lure, else the lure, else a bare hook. */
function useOnTheLine() {
  const lure = useGame((s) => s.lure);
  const sig = useGame((s) => s.sig);
  const bait = useGame((s) => s.bait);
  const family = familyOf({ lure, sig, bait });
  const source =
    bait >= 0 && BAITS[bait]
      ? BAITS[bait].name
      : sig >= 0 && SIG_LURES[sig]
        ? SIG_LURES[sig].name
        : lure >= 0 && LURES[lure]
          ? LURES[lure].name
          : "Bare hook";
  return { family, source };
}

function useRig() {
  const biome = useGame((s) => s.biome);
  return useGame((s) => s.rig[biome]) ?? DEFAULT_RIG;
}

function DepthGlyph({ depth }: { depth: Depth }) {
  return (
    <svg viewBox="0 0 32 24" className="h-6 w-8" aria-hidden>
      <path
        d="M2 5 q4-3 7 0 t7 0 t7 0 t7 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <circle cx="16" cy={[8, 13, 19][depth]} r="3" fill="currentColor" />
    </svg>
  );
}

function Tile({
  on,
  disabled,
  onClick,
  title,
  sub,
  icon,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 text-center transition-colors",
        on
          ? "border-brass bg-surface-2 text-brass"
          : "border-line bg-surface text-fg enabled:hover:border-brass",
        disabled && "opacity-50",
      )}
    >
      {icon}
      <span className="text-sm leading-tight font-semibold">{title}</span>
      <span className="text-[11px] leading-tight text-muted">{sub}</span>
    </button>
  );
}

/** The Rig: how deep, and how fast to bring it back. Shared by the desktop popover and the phone sheet. */
export function RigPicker({ onPicked }: { onPicked?: (what: "depth" | "retrieve") => void }) {
  const rig = useRig();
  const setRig = useGame((s) => s.setRig);
  const phase = useGame((s) => s.phase);
  const biome = useGame((s) => s.biome);
  const spotId = useGame((s) => s.lastSpot[s.biome]);
  const dex = useGame((s) => s.dex);
  const { family, source } = useOnTheLine();
  const locked = phase !== "idle";
  const spot = resolveSpot(biome, spotId);
  const hint = rigHint(biome, spot, (i) =>
    dex[`${biome}-${i}`]?.c ? BIOMES[biome].fish[i] : null,
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="text-muted">On the line: </span>
        <span className="font-semibold text-brass">{FAMILY_INFO[family].label}</span>
        <span className="text-muted"> · {source}</span>
      </p>
      <section>
        <h4 className="mb-1.5 font-serif text-base">How deep?</h4>
        <div className="grid grid-cols-3 gap-2">
          {DEPTHS.map((d) => (
            <Tile
              key={d}
              on={rig.depth === d}
              disabled={locked}
              icon={<DepthGlyph depth={d} />}
              title={DEPTH_INFO[d].label}
              sub={DEPTH_INFO[d].blurb}
              onClick={() => {
                setRig({ depth: d });
                onPicked?.("depth");
              }}
            />
          ))}
        </div>
      </section>
      <section>
        <h4 className="mb-1.5 font-serif text-base">How fast?</h4>
        <div className="grid grid-cols-4 gap-2">
          {RETRIEVES.map((r: Retrieve) => (
            <Tile
              key={r}
              on={rig.retrieve === r}
              disabled={locked}
              title={RETRIEVE_INFO[r].label}
              sub={RETRIEVE_INFO[r].blurb}
              onClick={() => {
                setRig({ retrieve: r });
                onPicked?.("retrieve");
              }}
            />
          ))}
        </div>
      </section>
      <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-sm text-muted">
        {locked ? "Locked while a line is out." : hint}
      </p>
    </div>
  );
}

/** The button that shows the current rig. */
function RigButton({
  className,
  compact,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) {
  const rig = useRig();
  const { family } = useOnTheLine();
  return (
    <button
      type="button"
      data-rig
      className={cn(
        "pointer-events-auto flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-line bg-bg/80 px-4 text-sm backdrop-blur-sm hover:border-brass focus-visible:outline-2 focus-visible:outline-brass",
        className,
      )}
      {...props}
    >
      <span className="text-muted">Rig</span>
      <span className="font-semibold">{rigLabel(rig)}</span>
      {compact ? null : <span className="hidden text-muted sm:inline">· {FAMILY_INFO[family].label}</span>}
    </button>
  );
}

/** Desktop: a popover above the button, bottom-left of the water. */
export function RigPopover({ className }: { className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <RigButton className={className} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-[min(24rem,92vw)] rounded-3xl border border-line bg-bg/95 p-4 shadow-2xl backdrop-blur outline-none"
        >
          <h3 className="mb-2 font-serif text-xl">Rig</h3>
          <RigPicker />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Phone: a bottom sheet. Picking a retrieve (the last choice) closes it. */
export function RigSheet({ className, compact }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RigButton className={className} compact={compact} onClick={() => setOpen(true)} />
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Drawer.Content className="safe-bot fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-2 overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 outline-none">
            <Drawer.Title className="font-serif text-xl">Rig</Drawer.Title>
            <Drawer.Description className="sr-only">
              Choose how deep to fish and how fast to bring the lure back.
            </Drawer.Description>
            <RigPicker onPicked={(what) => what === "retrieve" && setOpen(false)} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-1 min-h-12 rounded-full bg-surface-2 px-4 text-fg"
            >
              Done
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

/** The spot-chip row: the accessible way to pick a spot, and the one thumbs use. */
export function SpotChips({ className }: { className?: string }) {
  const biome = useGame((s) => s.biome);
  const spotId = useGame((s) => s.lastSpot[s.biome]);
  const phase = useGame((s) => s.phase);
  const setSpot = useGame((s) => s.setSpot);
  const current = resolveSpot(biome, spotId);
  const locked = phase !== "idle";
  return (
    <div
      role="group"
      aria-label="Where to cast"
      className={cn("flex items-center gap-2", className)}
    >
      {spotsOf(biome).map((spot) => {
        const on = spot.id === current.id;
        return (
          <button
            key={spot.id}
            type="button"
            data-spot-chip
            aria-pressed={on}
            disabled={locked && !on}
            onClick={() => setSpot(spot.id)}
            className={cn(
              "pointer-events-auto min-h-11 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap backdrop-blur-sm",
              on ? "border-brass bg-brass text-brass-ink" : "border-line bg-bg/80 text-fg",
              locked && !on && "opacity-50",
            )}
          >
            {spot.name}
          </button>
        );
      })}
    </div>
  );
}

/** Phones: the rig button and the spot chips in one scrolling row along the bottom of the water. */
export function SpotBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "safe-x z-10 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <RigSheet />
      <SpotChips />
    </div>
  );
}
