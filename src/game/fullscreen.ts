/* Full-screen play (docs/architecture/09 §6). Pure helpers over small structural types, so tests can hand in fakes.
   The Fullscreen API has a webkit-prefixed form on older Safari. iPhone Safari allows full screen only for video, so there the
   honest answer is "add the game to your Home Screen", and an installed copy already has no browser bars. */

type Listener = () => void;

export type FsDoc = {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  documentElement: FsEl;
  addEventListener: (type: string, fn: Listener) => void;
  removeEventListener: (type: string, fn: Listener) => void;
};

export type FsEl = {
  requestFullscreen?: (opts?: { navigationUI?: "hide" | "show" | "auto" }) => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FsEnv = {
  doc: FsDoc;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** navigator.standalone (iOS) and the display-mode media queries. */
  standalone: boolean;
  /** True on a phone-sized touch device. */
  phone: boolean;
  orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } | null;
};

/** iPhone and iPod (always), and iPad (which reports itself as a Mac with a touch screen). */
export function isIos(ua: string, platform: string, touch: number): boolean {
  if (/iPhone|iPod|iPad/.test(ua)) return true;
  return platform === "MacIntel" && touch > 1;
}

export function isIphone(ua: string): boolean {
  return /iPhone|iPod/.test(ua);
}

export type FsSupport =
  /** The button works. */
  | "yes"
  /** The game was added to the Home Screen: it already fills the screen. */
  | "installed"
  /** iPhone Safari in a normal tab: true full screen is not allowed, so show the Home Screen hint. */
  | "home-screen"
  /** Nothing to offer: hide the button. */
  | "no";

export function fullscreenSupport(env: FsEnv): FsSupport {
  if (env.standalone) return "installed";
  const d = env.doc;
  const can = d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true;
  if (can && (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen)) return "yes";
  if (isIphone(env.userAgent)) return "home-screen";
  return "no";
}

export function isFullscreen(doc: Pick<FsDoc, "fullscreenElement" | "webkitFullscreenElement">): boolean {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** Ask for full screen on the whole page. Returns true if the browser accepted. Never throws. */
export async function enterFullscreen(env: FsEnv): Promise<boolean> {
  const el = env.doc.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  await lockLandscape(env);
  return true;
}

export async function exitFullscreen(env: FsEnv): Promise<boolean> {
  const d = env.doc;
  try {
    env.orientation?.unlock?.();
  } catch {
    /* nothing to unlock */
  }
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

/** Android Chrome lets a full-screen page stay sideways. Only after full screen has started, only on a phone, and silent when refused. */
export async function lockLandscape(env: FsEnv): Promise<boolean> {
  if (!env.phone || !env.orientation?.lock || !landscapeLockWanted()) return false;
  try {
    await env.orientation.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

export type ToggleResult = "entered" | "left" | "home-screen" | "unavailable";

export async function toggleFullscreenWith(env: FsEnv): Promise<ToggleResult> {
  if (isFullscreen(env.doc)) return (await exitFullscreen(env)) ? "left" : "unavailable";
  const support = fullscreenSupport(env);
  if (support === "home-screen") return "home-screen";
  if (support !== "yes") return "unavailable";
  return (await enterFullscreen(env)) ? "entered" : "unavailable";
}

export const HOME_SCREEN_HINT =
  "On iPhone, full screen needs the Home Screen: tap the Share button, then Add to Home Screen. Open the game from there and the browser bars are gone.";

/* ── The one setting: stay sideways in full screen (Android). A device preference, not part of any save. ── */

const LOCK_KEY = "fac-ultra-fs-landscape";

export function landscapeLockWanted(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setLandscapeLockWanted(on: boolean) {
  try {
    localStorage.setItem(LOCK_KEY, on ? "1" : "0");
  } catch {
    /* private mode: it just will not be remembered */
  }
}

/** The real browser, as the structural env. Browser only. */
export function browserFsEnv(): FsEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  let standalone = nav.standalone === true;
  let coarse = false;
  try {
    standalone = standalone || matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches;
    coarse = matchMedia("(pointer: coarse)").matches;
  } catch {
    /* old browser */
  }
  return {
    doc: document as unknown as FsDoc,
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone,
    phone: coarse && Math.min(window.innerWidth, window.innerHeight) < 600,
    orientation: (screen as Screen & { orientation?: FsEnv["orientation"] }).orientation ?? null,
  };
}

/** Listen for the browser entering or leaving full screen (Esc, a swipe, our button). Returns the unsubscribe. */
export function watchFullscreen(doc: FsDoc, fn: Listener): () => void {
  doc.addEventListener("fullscreenchange", fn);
  doc.addEventListener("webkitfullscreenchange", fn);
  return () => {
    doc.removeEventListener("fullscreenchange", fn);
    doc.removeEventListener("webkitfullscreenchange", fn);
  };
}
