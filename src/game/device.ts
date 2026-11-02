/* Device class and graphics tier (docs/architecture/09-mobile.md §1).
   Everything here is pure: the browser reads happen in readDevice(), and every
   decision is a function of plain numbers so tests can inject them. */

export type Form = "phone" | "tablet" | "desktop";
export type Gfx = "full" | "lite" | "mobile";
/** The five quality levels the player sees (docs/architecture/09 §1.4). Each one maps onto an internal Gfx tier. */
export type Level = "ultra" | "high" | "medium" | "low" | "potato";
/** What the player chose in Settings: a pinned level, or "auto" (let us pick). */
export type GfxPref = "auto" | Level;

export const GFX_LIST: readonly Gfx[] = ["full", "lite", "mobile"];
/** Best to lightest. */
export const LEVELS: readonly Level[] = ["ultra", "high", "medium", "low", "potato"];
/** The internal tier each level draws with. Ultra and High share `full`; Low and Potato share `mobile`. */
export const LEVEL_TIER: Record<Level, Gfx> = { ultra: "full", high: "full", medium: "lite", low: "mobile", potato: "mobile" };

export const levelIndex = (l: Level) => LEVELS.indexOf(l);
export const levelDown = (l: Level): Level => LEVELS[Math.min(LEVELS.length - 1, levelIndex(l) + 1)];
export const levelUp = (l: Level): Level => LEVELS[Math.max(0, levelIndex(l) - 1)];

/** Old saves said full / lite / mobile (WP-1). They mean ultra / medium / low. Anything unknown is null. */
export function normPref(v: unknown): GfxPref | null {
  if (v === "auto") return "auto";
  if (typeof v !== "string") return null;
  if ((LEVELS as readonly string[]).includes(v)) return v as Level;
  if (v === "full") return "ultra";
  if (v === "lite") return "medium";
  if (v === "mobile") return "low";
  return null;
}
export const DEVICE_KEY = "fac-ultra-device";

export type DeviceInfo = {
  coarse: boolean;
  width: number;
  height: number;
  /** navigator.deviceMemory in GB (Chrome only); undefined elsewhere. */
  mem?: number;
  cores?: number;
};

/** phone / tablet / desktop from the pointer type and the SHORT side of the screen. */
export function pickForm(coarse: boolean, width: number, height: number): Form {
  if (!coarse) return "desktop";
  return Math.min(width, height) < 600 ? "phone" : "tablet";
}

/** The graphics tier a device starts at when the player has not pinned one. */
export function defaultGfx(form: Form, mem = 4, cores = 4): Gfx {
  if (form === "desktop") return "full";
  if (form === "tablet" && mem >= 4 && cores >= 6) return "lite";
  return "mobile";
}

/** The level a device starts at when nothing is pinned and no speed test has run yet. */
export function defaultLevel(form: Form, mem = 4, cores = 4): Level {
  const tier = defaultGfx(form, mem, cores);
  return tier === "full" ? "ultra" : tier === "lite" ? "medium" : "low";
}

/** The best level Auto may ever pick on this kind of device. Phones stay safe: Auto never goes above Low there. */
export function autoCeiling(form: Form): Level {
  return form === "desktop" ? "ultra" : form === "tablet" ? "medium" : "low";
}

/** The level in force: a pinned level, or Auto (the speed test result if there is one, else the device default). */
export function resolveLevel(pref: GfxPref, form: Form, mem?: number, cores?: number, probed: Level | null = null): Level {
  if (pref !== "auto") return pref;
  const base = defaultLevel(form, mem, cores);
  if (!probed) return base;
  /* The speed test may lower the start anywhere. It may raise it only on a PC. */
  const raised = form === "desktop" ? probed : levelIndex(probed) > levelIndex(base) ? probed : base;
  const capped = levelIndex(raised) < levelIndex(autoCeiling(form)) ? autoCeiling(form) : raised;
  return capped;
}

export function resolveGfx(pref: GfxPref, form: Form, mem?: number, cores?: number, probed: Level | null = null): Gfx {
  return LEVEL_TIER[resolveLevel(pref, form, mem, cores, probed)];
}

export function isGfxPref(v: unknown): v is GfxPref {
  return normPref(v) !== null;
}

export type LayoutPlan = {
  /** "desktop" = the Big Water layout (rail + drawer); "mobile" = the portrait column. */
  kind: "desktop" | "mobile";
  /** Icons-only rail (landscape phones, narrow windows). */
  railCollapsed: boolean;
  /** Drawer width as a CSS length. */
  drawerWidth: string;
  /** Tablet portrait: panels in two columns, water at 48%. */
  twoColumns: boolean;
  /** The ring and its needle are drawn larger for a thumb. */
  bigRing: boolean;
};

export function layoutOf(form: Form, width: number, height: number): LayoutPlan {
  const landscape = width > height;
  if (form === "desktop") {
    const narrow = width < 900;
    return {
      kind: "desktop",
      railCollapsed: narrow,
      drawerWidth: "min(32rem, 100vw - 4.5rem)",
      twoColumns: false,
      bigRing: false,
    };
  }
  if (form === "phone" && landscape) {
    return { kind: "desktop", railCollapsed: true, drawerWidth: "60%", twoColumns: false, bigRing: true };
  }
  /* A big iPad on its side is a small PC. */
  if (form === "tablet" && landscape && width >= 1024) {
    return { kind: "desktop", railCollapsed: false, drawerWidth: "min(32rem, 100vw - 6rem)", twoColumns: false, bigRing: true };
  }
  return {
    kind: "mobile",
    railCollapsed: false,
    drawerWidth: "100%",
    twoColumns: form === "tablet",
    bigRing: true,
  };
}

/** Water height for the mobile column: 52dvh (48 on tablets), min 280, max 480 px. */
export function mobileWaterHeight(viewportH: number, twoColumns: boolean): number {
  const raw = viewportH * (twoColumns ? 0.48 : 0.52);
  return Math.round(Math.min(480, Math.max(280, raw)));
}

/** Collapse the water to a peek strip once the panel is scrolled past 40 %. */
export function peekCollapsed(scrollTop: number, panelHeight: number): boolean {
  return panelHeight > 0 && scrollTop > panelHeight * 0.4;
}

export function readDevice(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let coarse = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    coarse = false;
  }
  return {
    coarse,
    width: window.innerWidth,
    height: window.innerHeight,
    mem: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}

export function formOf(d: DeviceInfo): Form {
  return pickForm(d.coarse, d.width, d.height);
}

/* ── Device settings, shared by every mode (07 §2) ───────────────────────── */

export type DeviceSettings = {
  gfx: GfxPref;
  sound: boolean;
  motion: boolean;
  flash: boolean;
  followClock: boolean;
  /** Kid Mode (WP-4): the person at this screen, so it follows them into every mode. */
  kid: boolean;
  /** WP-6: ambience volume 0 to 100 (default 35) and the colour-blind rarity palette. */
  volume: number;
  cb: boolean;
  /** WP-8: the bobber skin you picked, so it follows you into every mode. */
  bobberSkin?: string;
};

export function deviceSubset(s: DeviceSettings): DeviceSettings {
  return { gfx: s.gfx, sound: s.sound, motion: s.motion, flash: s.flash, followClock: s.followClock, kid: s.kid, volume: s.volume, cb: s.cb, ...(s.bobberSkin ? { bobberSkin: s.bobberSkin } : {}) };
}

/** Read the shared device record; unknown or hostile shapes are ignored field by field. */
export function readDeviceSettings(raw: unknown): Partial<DeviceSettings> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<DeviceSettings> = {};
  const pref = normPref(o.gfx);
  if (pref) out.gfx = pref;
  for (const k of ["sound", "motion", "flash", "followClock", "kid"] as const) {
    if (typeof o[k] === "boolean") out[k] = o[k];
  }
  if (typeof o.cb === "boolean") out.cb = o.cb;
  if (typeof o.bobberSkin === "string" && /^[a-z]{3,12}$/.test(o.bobberSkin)) out.bobberSkin = o.bobberSkin;
  if (typeof o.volume === "number" && Number.isFinite(o.volume)) out.volume = Math.min(100, Math.max(0, Math.round(o.volume)));
  return out;
}

/** The device record wins over the per-mode save for device-level settings. */
export function overlayDevice<T extends DeviceSettings>(save: T, device: Partial<DeviceSettings>): T {
  return { ...save, ...device };
}
