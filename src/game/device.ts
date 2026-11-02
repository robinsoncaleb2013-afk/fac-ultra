/* Device class and graphics tier (docs/architecture/09-mobile.md §1).
   Everything here is pure: the browser reads happen in readDevice(), and every
   decision is a function of plain numbers so tests can inject them. */

export type Form = "phone" | "tablet" | "desktop";
export type Gfx = "full" | "lite" | "mobile";
/** What the player chose in Settings: a pinned tier, or "auto" (let us pick). */
export type GfxPref = "auto" | Gfx;

export const GFX_LIST: readonly Gfx[] = ["full", "lite", "mobile"];
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

export function resolveGfx(pref: GfxPref, form: Form, mem?: number, cores?: number): Gfx {
  return pref === "auto" ? defaultGfx(form, mem, cores) : pref;
}

export function isGfxPref(v: unknown): v is GfxPref {
  return v === "auto" || v === "full" || v === "lite" || v === "mobile";
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
};

export function deviceSubset(s: DeviceSettings): DeviceSettings {
  return { gfx: s.gfx, sound: s.sound, motion: s.motion, flash: s.flash, followClock: s.followClock };
}

/** Read the shared device record; unknown or hostile shapes are ignored field by field. */
export function readDeviceSettings(raw: unknown): Partial<DeviceSettings> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<DeviceSettings> = {};
  if (isGfxPref(o.gfx)) out.gfx = o.gfx;
  for (const k of ["sound", "motion", "flash", "followClock"] as const) {
    if (typeof o[k] === "boolean") out[k] = o[k];
  }
  return out;
}

/** The device record wins over the per-mode save for device-level settings. */
export function overlayDevice<T extends DeviceSettings>(save: T, device: Partial<DeviceSettings>): T {
  return { ...save, ...device };
}
