import { DIFFICULTY_LIST, type Difficulty } from "@/game/difficulty";
import { cn } from "@/lib/cn";

/* The difficulty step of making an Expedition (docs/architecture/12 §2). Its own component so the menu work can place
   it anywhere: it only needs a value and a way to change it. Plain English: what each level does, and the catch. */

const FACTS: Record<Difficulty, string[]> = {
  superEasy: ["A little harder than Kid Mode", "Helping Hand is always on", "These fish do not go in your fish book (they go in the Kids book)"],
  easy: ["Slightly slower fish and quicker bites", "Your fish count in the book"],
  normal: ["The game as it was made"],
  hard: ["Stronger fish, slower bites", "A snapped line can take your lure"],
  hardest: ["Fish are worth less money", "You can lose rods, lures, your boat and your wallet", "Fish can jump out of your tank, and visitors can sue you"],
};

export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <fieldset>
      <legend className="text-sm text-muted">How hard should it be? You cannot change this later.</legend>
      <div role="radiogroup" aria-label="Difficulty" className="mt-2 flex flex-col gap-2">
        {DIFFICULTY_LIST.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={value === d.id}
            data-testid={`difficulty-${d.id}`}
            onClick={() => onChange(d.id)}
            className={cn("min-h-12 rounded-2xl border p-3 text-left", value === d.id ? "border-brass bg-surface-2" : "border-line bg-surface")}
          >
            <span className="font-serif text-lg">{d.title}</span>
            <span className="block text-sm text-muted">{d.blurb}</span>
            {value === d.id ? (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {FACTS[d.id].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
