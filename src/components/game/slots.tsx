import { useEffect, useState } from "react";
import { create } from "zustand";
import { money, TOTAL_SPECIES } from "@/game/content";
import { useGame } from "@/game/engine";
import { chapterInfo, CHAPTERS } from "@/game/story";
import { DEFAULT_DIFFICULTY, DIFFICULTY_TABLE, type Difficulty } from "@/game/difficulty";
import { defaultSlotName, slotCards, type SlotCard } from "@/game/slots";
import { nameProblem } from "@/game/safe";
import { MODES, type Mode } from "@/game/modes";
import { Button } from "@/components/ui/button";
import { DifficultyPicker } from "@/components/game/difficulty-picker";
import { cn } from "@/lib/cn";

/* The save-slot picker (docs/architecture/12 §5). Expedition and Story each have up to MAX_SLOTS saves. Opening either
   from the Play menu lands here: pick a game to continue, or make a new one (a name, and for Expedition a difficulty).
   Rename and delete (with a question first) live on each card. There is no "more slots" button, on purpose. */

type SlotUi = { mode: Mode | null; open: (mode: Mode) => void; close: () => void };
export const useSlotUi = create<SlotUi>((set) => ({ mode: null, open: (mode) => set({ mode }), close: () => set({ mode: null }) }));

/** Show the slot picker for Expedition or Story. */
export const openSlotPicker = (mode: Mode) => useSlotUi.getState().open(mode);

function readCards(mode: Mode): SlotCard[] {
  return slotCards(mode, (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  });
}

/** Wait, then do it: "Are you sure?" for the one thing here that cannot be undone. */
function useRefresh() {
  const [n, setN] = useState(0);
  return [n, () => setN((v) => v + 1)] as const;
}

type Step = { kind: "list" } | { kind: "new"; slot: number } | { kind: "rename"; slot: number } | { kind: "delete"; slot: number };

export function SlotPicker() {
  const mode = useSlotUi((s) => s.mode);
  const close = useSlotUi((s) => s.close);
  const create = useGame((s) => s.createSlot);
  const openSlot = useGame((s) => s.openSlot);
  const rename = useGame((s) => s.renameSlot);
  const remove = useGame((s) => s.deleteSlot);
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [name, setName] = useState("");
  const [diff, setDiff] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [tick, refresh] = useRefresh();
  useEffect(() => {
    setStep({ kind: "list" });
  }, [mode]);
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.stopPropagation();
      if (step.kind === "list") close();
      else setStep({ kind: "list" });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode, step.kind, close]);
  if (!mode) return null;
  void tick;
  const rules = MODES[mode];
  const cards = readCards(mode);
  const problem = nameProblem(name);

  const play = (slot: number) => {
    close();
    openSlot(mode, slot);
  };
  const begin = (slot: number) => {
    setName("");
    setDiff(DEFAULT_DIFFICULTY);
    setStep({ kind: "new", slot });
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-bg/80 p-4" onClick={close}>
      <div
        role="dialog"
        aria-label={`${rules.title} save slots`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-brass bg-surface p-5 text-left text-fg"
      >
        {step.kind === "list" ? (
          <>
            <p className="font-serif text-2xl">{rules.title}</p>
            <p className="mt-1 text-sm text-muted">Pick a game to continue, or start a new one. Each game keeps its own fish, money and book.</p>
            <ul className="mt-4 flex flex-col gap-3">
              {cards.map((c, i) => (
                <li key={c.slot}>
                  <SlotCardView
                    card={c}
                    first={i === 0}
                    onPlay={() => play(c.slot)}
                    onNew={() => begin(c.slot)}
                    onRename={() => {
                      setName(c.name);
                      setStep({ kind: "rename", slot: c.slot });
                    }}
                    onDelete={() => setStep({ kind: "delete", slot: c.slot })}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
            </div>
          </>
        ) : null}

        {step.kind === "new" ? (
          <>
            <p className="font-serif text-2xl">New {mode === "story" ? "story" : "adventure"}</p>
            <label className="mt-3 block text-sm text-muted" htmlFor="slot-name">
              What should we call it?
            </label>
            <input
              id="slot-name"
              value={name}
              maxLength={20}
              placeholder={defaultSlotName(mode, step.slot)}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base"
            />
            {problem ? <p className="mt-1 text-sm text-brass">{problem}</p> : null}
            {mode === "expedition" ? (
              <div className="mt-4">
                <DifficultyPicker value={diff} onChange={setDiff} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Story plays at a friendly {DIFFICULTY_TABLE.easy.title} level. You work through {CHAPTERS} chapters, one water at a time.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep({ kind: "list" })}>
                Back
              </Button>
              <Button
                disabled={!!problem}
                onClick={() => {
                  if (create(mode, step.slot, name.trim(), diff)) {
                    close();
                    refresh();
                  }
                }}
              >
                Start
              </Button>
            </div>
          </>
        ) : null}

        {step.kind === "rename" ? (
          <>
            <p className="font-serif text-2xl">Rename</p>
            <input
              aria-label="New name"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              className="mt-3 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base"
            />
            {problem ? <p className="mt-1 text-sm text-brass">{problem}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep({ kind: "list" })}>
                Back
              </Button>
              <Button
                disabled={!!problem || name.trim().length < 2}
                onClick={() => {
                  rename(mode, step.slot, name.trim());
                  setStep({ kind: "list" });
                  refresh();
                }}
              >
                Save name
              </Button>
            </div>
          </>
        ) : null}

        {step.kind === "delete" ? (
          <>
            <p className="font-serif text-2xl">Delete this game?</p>
            <p className="mt-2 text-sm text-muted">
              &quot;{cards[step.slot]?.name}&quot; will be gone for good, here and in your cloud save if you use one. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep({ kind: "list" })}>
                Keep it
              </Button>
              <Button
                data-testid="slot-delete-confirm"
                onClick={() => {
                  remove(mode, step.slot);
                  setStep({ kind: "list" });
                  refresh();
                }}
              >
                Delete it
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SlotCardView({ card, first, onPlay, onNew, onRename, onDelete }: {
  card: SlotCard;
  first?: boolean;
  onPlay: () => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const story = card.mode === "story";
  return (
    <div data-testid={`slot-${card.mode}-${card.slot}`} className={cn("rounded-2xl border p-3", card.empty ? "border-dashed border-line" : "border-line bg-surface-2/40")}>
      {card.empty ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Empty slot {card.slot + 1}</p>
            <p className="text-sm text-muted">Start a new {story ? "story" : "adventure"} here.</p>
          </div>
          <Button autoFocus={first} onClick={onNew}>
            New game
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-serif text-lg">{card.name}</p>
              <p className="text-sm text-muted">
                {story ? `Story · chapter ${Math.min(CHAPTERS, card.chapter + 1)} of ${CHAPTERS}: ${chapterInfo(card.chapter).title}` : `${DIFFICULTY_TABLE[card.difficulty].title} difficulty`}
              </p>
              <p className="text-sm text-muted">
                Level {card.lv} · {card.species} of {TOTAL_SPECIES} fish in the book · {money(card.c)}
              </p>
            </div>
            <Button autoFocus={first} onClick={onPlay}>
              Play
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="quiet" className="min-h-10 px-3 py-1 text-sm" onClick={onRename}>
              Rename
            </Button>
            <Button variant="quiet" className="min-h-10 px-3 py-1 text-sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
