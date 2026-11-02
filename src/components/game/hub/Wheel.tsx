import { useEffect, useMemo, useRef, useState } from "react";
import { LURES } from "@/game/content";
import { useGame } from "@/game/engine";
import { sendEmote, useEventRoom } from "@/game/eventroom";
import { rememberWheelPage, useHubUi, type WheelPage } from "@/game/hubstate";
import { wheelSlice } from "@/game/hubnav";
import { EMOTES } from "@/game/social";
import { cn } from "@/lib/cn";

type Slot = { id: string; glyph: string; label: string; on?: boolean; off?: boolean };

/** The quick wheel: hold Tab (or the corner button), point at a slice, let go. Two pages: lures and emotes (Q / E or the little tabs to swap). */
export function Wheel() {
  const wheel = useHubUi((s) => s.wheel);
  const close = useHubUi((s) => s.closeWheel);
  const openWheel = useHubUi((s) => s.openWheel);
  const lure = useGame((s) => s.lure);
  const box = useGame((s) => s.box);
  const mode = useGame((s) => s.mode);
  const status = useEventRoom((s) => s.status);
  const [pointed, setPointed] = useState(-1);
  const centre = useRef<HTMLDivElement>(null);
  const page: WheelPage = wheel?.page ?? "lures";

  const slots: Slot[] = useMemo(() => {
    if (page === "emotes") return EMOTES.map((e) => ({ id: e.id, glyph: e.glyph, label: e.text, off: status !== "on" }));
    const owned = Object.keys(box)
      .map(Number)
      .filter((i) => box[String(i)] > 0 && LURES[i])
      .sort((a, b) => b - a);
    const first = owned.includes(lure) ? [lure, ...owned.filter((i) => i !== lure)] : owned;
    return [
      { id: "-1", glyph: "∅", label: "No lure", on: lure < 0 },
      ...first.slice(0, 7).map((i) => ({ id: String(i), glyph: "🪝", label: `${LURES[i].name} ×${box[String(i)]}`, on: i === lure })),
    ];
  }, [page, box, lure, status]);

  const pick = (i: number) => {
    const slot = slots[i];
    if (!slot) return;
    if (page === "emotes") {
      if (status !== "on") useGame.getState().notify(mode === "tournament" ? "Still connecting to the event room." : "Emotes are for tournaments. Join one to say hello.");
      else sendEmote(slot.id);
    } else {
      useGame.getState().equipLure(Number(slot.id));
      useGame.getState().notify(Number(slot.id) < 0 ? "No lure on the line." : `Lure: ${LURES[Number(slot.id)].name}`);
    }
  };

  const go = (p: WheelPage) => {
    rememberWheelPage(p);
    setPointed(-1);
    openWheel(p, useHubUi.getState().wheel?.held ?? false);
    useHubUi.setState((s) => (s.wheel ? { wheel: { ...s.wheel, page: p } } : s));
  };

  /* While held: the pointer picks a slice, Q/E swap pages, and letting go of the key confirms. */
  useEffect(() => {
    if (!wheel) return;
    const move = (e: PointerEvent) => {
      const r = centre.current?.getBoundingClientRect();
      if (!r) return;
      setPointed(wheelSlice(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), slots.length, 30));
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyQ" || e.code === "KeyE") {
        e.preventDefault();
        go(page === "lures" ? "emotes" : "lures");
      } else if (e.code === "Escape") {
        e.preventDefault();
        close();
      } else if (/^Digit[1-8]$/.test(e.code)) {
        const i = Number(e.code.slice(5)) - 1;
        if (slots[i]) {
          pick(i);
          close();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Tab" && useHubUi.getState().wheel?.held) {
        if (pointed >= 0) pick(pointed);
        close();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheel, slots, pointed, page]);

  if (!wheel) return null;
  const R = 128;
  const label = pointed >= 0 ? slots[pointed]?.label : page === "lures" ? "Pick a lure" : "Say something nice";
  return (
    <div role="dialog" aria-label={page === "lures" ? "Lure wheel" : "Emote wheel"} className="fixed inset-0 z-40 grid place-items-center text-[#f1e5c9]">
      <div className="hub-backdrop" onClick={close} />
      <div ref={centre} className="hub-wheel-in relative" style={{ width: R * 2 + 90, height: R * 2 + 90 }}>
        <div className="absolute inset-[45px] rounded-full border border-[#caa45a]/40 bg-[#1d1710]/85 shadow-[0_0_60px_rgb(0_0_0/0.6)]" />
        <div className="absolute top-1/2 left-1/2 w-40 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-serif text-lg leading-tight" aria-live="polite">{label}</p>
          <div className="mt-2 flex justify-center gap-1">
            {(["lures", "emotes"] as const).map((p) => (
              <button key={p} type="button" onClick={() => go(p)} aria-pressed={page === p} className={cn("min-h-11 rounded-full border px-3 text-[13px]", page === p ? "border-brass bg-brass text-brass-ink" : "border-[#caa45a]/50 text-[#f1e5c9]")}>
                {p === "lures" ? "Lures" : "Emotes"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-[#c9b890]">Q / E swaps page</p>
        </div>
        {slots.map((s, i) => {
          const a = (i / slots.length) * Math.PI * 2;
          const x = Math.sin(a) * R;
          const y = -Math.cos(a) * R;
          return (
            <button
              key={s.id}
              type="button"
              aria-label={s.label}
              title={s.label}
              onClick={() => {
                pick(i);
                close();
              }}
              onPointerEnter={() => setPointed(i)}
              className={cn(
                "absolute grid size-14 place-items-center rounded-full border-2 text-2xl transition-transform",
                pointed === i ? "scale-110 border-brass bg-[#4a3a1c]" : "border-[#caa45a]/50 bg-[#2b2113]",
                s.on && "ring-2 ring-[#fff4d6]/80",
                s.off && "opacity-45",
              )}
              style={{ left: `calc(50% + ${x}px - 28px)`, top: `calc(50% + ${y}px - 28px)` }}
            >
              <span aria-hidden>{s.glyph}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
