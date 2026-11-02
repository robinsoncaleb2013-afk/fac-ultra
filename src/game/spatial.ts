/* Arrow-key focus movement by position on screen: the next thing up, down, left or right of the one you are on.
   Pure (rectangles in, an index out) so the Hub's menus need no per-screen key tables and a test can check it. */

export type Rect = { left: number; top: number; right: number; bottom: number };
export type Dir = "up" | "down" | "left" | "right";

const cx = (r: Rect) => (r.left + r.right) / 2;
const cy = (r: Rect) => (r.top + r.bottom) / 2;

/** How far the two rectangles are from lining up across the direction of travel (0 when they overlap). */
function offAxis(a: Rect, b: Rect, vertical: boolean): number {
  const [a0, a1, b0, b1] = vertical ? [a.left, a.right, b.left, b.right] : [a.top, a.bottom, b.top, b.bottom];
  if (a1 > b0 && b1 > a0) return 0;
  return Math.min(Math.abs(a0 - b1), Math.abs(b0 - a1));
}

/** The index of the best neighbour of `from` in `dir`, or -1 if nothing lies that way. */
export function pickNeighbor(from: Rect, others: readonly Rect[], dir: Dir): number {
  const vertical = dir === "up" || dir === "down";
  let best = -1;
  let bestScore = Infinity;
  others.forEach((r, i) => {
    const along = vertical ? cy(r) - cy(from) : cx(r) - cx(from);
    const signed = dir === "down" || dir === "right" ? along : -along;
    if (signed <= 2) return;
    const across = offAxis(from, r, vertical);
    const score = signed + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
