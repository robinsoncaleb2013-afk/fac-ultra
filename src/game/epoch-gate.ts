/* TEST PHASE (browser): when the build changes, forget this device's progress BEFORE the game loads any save,
   so an old save is never sanitised or migrated into the new build. See docs/TEST-PHASE.md.
   The storage is passed in, so tests need no browser. Keeps device settings, the sign-in cookie (a cookie, not
   storage) and the anonymous player id. */

import { BUILD_EPOCH } from "@/lib/build-epoch.generated";
import { currentEpoch, decideEpoch, EPOCH_KEY, keysToWipe, NOTICE_KEY, resetSwitchOn, type EpochVerdict } from "@/lib/test-phase";

export type KeyStore = {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

export type GateResult = { verdict: EpochVerdict; removed: string[]; notice: boolean };

const allKeys = (s: KeyStore): string[] => {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k) out.push(k);
  }
  return out;
};

/** Compare the stored epoch with this build's and act. Never throws (storage may be blocked). */
export function runEpochGate(store: KeyStore, current: string, on: boolean): GateResult {
  try {
    const stored = store.getItem(EPOCH_KEY);
    const verdict = decideEpoch(stored, current, on);
    if (verdict === "first") {
      store.setItem(EPOCH_KEY, current);
      return { verdict, removed: [], notice: false };
    }
    if (verdict !== "reset") return { verdict, removed: [], notice: false };
    const removed = keysToWipe(allKeys(store));
    for (const k of removed) store.removeItem(k);
    store.setItem(EPOCH_KEY, current);
    store.setItem(NOTICE_KEY, "1");
    return { verdict, removed, notice: true };
  } catch {
    return { verdict: "off", removed: [], notice: false };
  }
}

/* ── The browser's start-up sequence ───────────────────────────────────────────────────────────── */

export type ServerEpoch = { epoch: string; reset: boolean } | null;

/** Ask the server which build it is and whether the switch is on. Null when it cannot be reached in time. */
export async function fetchServerEpoch(timeoutMs = 2000): Promise<ServerEpoch> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch("/api/epoch", { cache: "no-store", signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = (await res.json()) as { epoch?: unknown; reset?: unknown };
    return typeof j.epoch === "string" && typeof j.reset === "boolean" ? { epoch: j.epoch, reset: j.reset } : null;
  } catch {
    return null;
  }
}

/** What the page shows about the switch. Starts from this build's own value; the server's answer replaces it. */
let testing = resetSwitchOn();
const listeners = new Set<() => void>();
export const testingOn = () => testing;
export const subscribeTesting = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function setTesting(v: boolean) {
  if (v === testing) return;
  testing = v;
  for (const l of listeners) l();
}

/** The "progress was reset" notice, until it is dismissed. */
export const noticePending = (): boolean => {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
};
export function dismissNotice() {
  try {
    localStorage.removeItem(NOTICE_KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

const RELOADED = "fac-epoch-reloaded";

/** Run before the game store loads saves. Returns when it is safe to call hydrate(). */
export async function startEpochGate(onWiped: () => void): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const current = currentEpoch();
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(EPOCH_KEY);
  } catch {
    return;
  }
  /* Only a different build needs the server's word on the switch; the usual case (same build) does not wait. */
  if (stored && stored !== current) {
    const srv = await fetchServerEpoch();
    const on = srv ? srv.reset : resetSwitchOn();
    setTesting(on);
    /* The server is on a newer build than this (cached) page: reload once to get the new page first. */
    if (srv && srv.epoch !== current && BUILD_EPOCH !== "dev" && on && reloadOnce()) return await new Promise<void>(() => {});
    if (runEpochGate(localStorage, current, on).verdict === "reset") {
      onWiped();
      for (const l of listeners) l();
    }
    return;
  }
  runEpochGate(localStorage, current, resetSwitchOn());
  /* Same build: check in the background whether the server has moved on (an old tab left open). */
  void fetchServerEpoch().then((srv) => {
    if (!srv) return;
    setTesting(srv.reset);
    if (srv.reset && srv.epoch !== current && BUILD_EPOCH !== "dev") reloadOnce();
  });
}

/** Reload the page once per server build, so a stubborn cache can never cause a loop. */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED)) return false;
    sessionStorage.setItem(RELOADED, "1");
    location.reload();
    return true;
  } catch {
    return false;
  }
}
