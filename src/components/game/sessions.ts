const SEEN = "fac-ultra-sessions";
const HINT = "fac-ultra-a2hs-dismissed";

export function sessionCount(): number {
  try {
    const n = Number(localStorage.getItem(SEEN) || "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Counts this visit once per page load. */
export function countSession() {
  try {
    localStorage.setItem(SEEN, String(sessionCount() + 1));
  } catch {
    /* private mode */
  }
}

export function hintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT) === "1";
  } catch {
    return false;
  }
}

export function dismissHint() {
  try {
    localStorage.setItem(HINT, "1");
  } catch {
    /* private mode */
  }
}
