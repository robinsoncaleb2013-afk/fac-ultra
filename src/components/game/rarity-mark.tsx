import { RARITIES } from "@/game/content";
import { SHAPE_PATH, shapeOf } from "@/game/rarity";
import { cn } from "@/lib/cn";

/** A rarity's shape (dot, diamond, star, hexagon, crown) in the rarity colour, so colour is never the only sign (05 §6.6). */
export function RarityMark({ rarity, className }: { rarity: number; className?: string }) {
  const shape = shapeOf(rarity);
  return (
    <svg
      viewBox="0 0 12 12"
      role="img"
      aria-label={`${RARITIES[Math.min(4, Math.max(0, rarity))].name}, shown as a ${shape}`}
      className={cn("inline-block size-3 shrink-0 align-[-1px]", ["text-r0", "text-r1", "text-r2", "text-r3", "text-r4"][Math.min(4, Math.max(0, rarity))], className)}
    >
      <path d={SHAPE_PATH[shape]} fill="currentColor" />
    </svg>
  );
}
