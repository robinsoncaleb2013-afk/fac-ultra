import { BIOMES } from "@/game/content";
import { useGame } from "@/game/engine";
import { chapterInfo, chapterReward, chapterView, CHAPTERS, storyDone } from "@/game/story";
import { cn } from "@/lib/cn";

/* Story mode screens (docs/architecture/12 §4): the little objective tracker on the water, and the Lodge room with every chapter. */

/** The chapter you are on and its goals, as a small card on the water. Nothing outside Story mode. */
export function StoryChip({ className }: { className?: string }) {
  const mode = useGame((s) => s.mode);
  const story = useGame((s) => s.story);
  const dex = useGame((s) => s.dex);
  if (mode !== "story" || storyDone(story)) return null;
  const view = chapterView(story.chapter, dex);
  const info = chapterInfo(story.chapter);
  return (
    <div data-testid="story-tracker" className={cn("pointer-events-none max-w-[17rem] rounded-2xl border border-line bg-bg/75 px-3 py-2 text-xs backdrop-blur-sm", className)}>
      <p className="font-serif text-sm text-brass">
        Chapter {story.chapter + 1}: {info.title}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {view.objectives.map((o) => (
          <li key={o.id} className={cn("flex gap-1.5", o.done && "text-muted line-through")}>
            <span aria-hidden>{o.done ? "✓" : "○"}</span>
            <span>
              {o.text} {o.done ? "" : `(${o.prog}/${o.goal})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StoryRoom() {
  const story = useGame((s) => s.story);
  const dex = useGame((s) => s.dex);
  const mode = useGame((s) => s.mode);
  if (mode !== "story") return <p className="text-muted">The Story is a separate game. Start one from the Play menu.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {storyDone(story) ? "You finished the whole Story. Well fished." : `Chapter ${story.chapter + 1} of ${CHAPTERS}. Each water has goals and a boss at the end.`}
      </p>
      <ol className="flex flex-col gap-2">
        {Array.from({ length: CHAPTERS }, (_, i) => {
          const done = story.rewarded.includes(i);
          const now = i === story.chapter;
          const info = chapterInfo(i);
          const view = chapterView(i, dex);
          return (
            <li key={i} className={cn("rounded-2xl border p-3", now ? "border-brass bg-surface-2" : "border-line", i > story.chapter && "opacity-60")}>
              <p className="font-serif text-lg leading-tight">
                {i + 1}. {info.title} <span className="text-sm text-muted">· {BIOMES[i].name}</span> {done ? <span className="text-lagoon">Done</span> : null}
              </p>
              {i <= story.chapter ? (
                <>
                  <p className="mt-1 text-sm text-muted">{done ? info.outro : info.intro}</p>
                  <ul className="mt-1 text-sm">
                    {view.objectives.map((o) => (
                      <li key={o.id} className={cn(o.done && "text-muted")}>
                        {o.done ? "✓" : "○"} {o.text} {o.done ? "" : `(${o.prog}/${o.goal})`}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted">Reward: {chapterReward(i).lines.join(", ")}.</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">Finish the chapter before to read this one.</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
