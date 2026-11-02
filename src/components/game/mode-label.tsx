import { useGame } from "@/game/engine";
import { bookOf } from "@/game/hubcopy";

/** A small tag saying whose book this is: each mode keeps its own fish book, records and stickers. */
export function ModeLabel({ className }: { className?: string }) {
  const mode = useGame((s) => s.mode);
  const book = bookOf(mode);
  return (
    <p className={className} data-testid="mode-label" data-mode={mode}>
      <span className="mr-2 inline-block rounded-full border border-brass px-2 py-0.5 text-xs font-semibold text-brass">{book.name}</span>
      <span className="text-sm text-muted">{book.line}</span>
    </p>
  );
}
