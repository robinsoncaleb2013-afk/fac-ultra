/* The browser's side of accounts and cloud saves (WP-9, docs/architecture/07 §3-4).

   The rules, in one paragraph: the game never waits for the network and is fully playable signed out.
   This device's save is the truth while playing. After each save (10 seconds later, and the moment the
   page is hidden) it is sent to the cloud. When you sign in, or pick a profile, the two copies are
   compared with `decideSync` (src/game/cloud.ts). If each has progress the other lacks, you choose.
   The copy you did not keep is stashed for 7 days. Nothing here touches game rules. */

import { useSyncExternalStore } from "react";
import { changeKey, decideSync, hasProgress, isSyncMode, newerOf, summarize, BACKUP_MS, PUSH_DEBOUNCE_MS, SYNC_MODES, type Summary, type SyncMode } from "@/game/cloud";
import { MODE_KEYS, flushSave, onPersisted, reloadActiveSlot, sanitize, useGame } from "@/game/engine";
import { sanitizeSurvival } from "@/game/survival";
import { PLAYER_KEY, playerId } from "@/game/tourney";
import { currentEpoch } from "@/lib/test-phase";

/* ── Types ──────────────────────────────────────────────────────────────── */

export type Profile = { id: string; slot: number; name: string; kid: boolean; playerId: string | null };
export type Providers = { email: boolean; google: boolean; emailDelivery: string };

export type Conflict = { mode: SyncMode; local: Summary; cloud: Summary; localAt: number; cloudAt: number; cloudRev: number; device: string | null };
export type Backup = { mode: SyncMode; at: number; json: string };

export type CloudState = {
  loaded: boolean;
  signedIn: boolean;
  email: string;
  providers: Providers;
  profiles: Profile[];
  max: number;
  profileId: string | null;
  status: "off" | "idle" | "syncing" | "offline" | "error";
  lastSync: number;
  conflicts: Conflict[];
  sheet: boolean;
  /** Where we sent the sign-in link (set after a request). */
  sentTo: string;
  busy: boolean;
  notice: string;
  error: string;
  backups: Backup[];
};

type SlotMeta = { rev: number; key: string };
type Meta = {
  v: 1;
  profileId: string | null;
  /** Whose fish are in this device's save slots: a profile id, or null for "just this device". */
  owner: string | null;
  slots: Record<string, Partial<Record<SyncMode, SlotMeta>>>;
  touch: Partial<Record<SyncMode, { key: string; at: number }>>;
};

/* ── Small storage helpers (every one is allowed to fail) ───────────────── */

const META_KEY = "fac-cloud";
const BACKUP_KEY = "fac-cloud-backups";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode or full */
  }
}

function readMeta(): Meta {
  try {
    const m = JSON.parse(read(META_KEY) || "null") as Partial<Meta> | null;
    if (m && m.v === 1) return { v: 1, profileId: m.profileId ?? null, owner: m.owner ?? null, slots: m.slots ?? {}, touch: m.touch ?? {} };
  } catch {
    /* start over */
  }
  return { v: 1, profileId: null, owner: null, slots: {}, touch: {} };
}
const saveMeta = (m: Meta) => write(META_KEY, JSON.stringify(m));

export function readBackups(now = Date.now()): Backup[] {
  try {
    const all = JSON.parse(read(BACKUP_KEY) || "[]") as Backup[];
    return all.filter((b) => b && isSyncMode(b.mode) && typeof b.json === "string" && now - b.at < BACKUP_MS);
  } catch {
    return [];
  }
}

function stash(mode: SyncMode, json: string | null) {
  if (!json) return;
  const keep = readBackups().filter((b) => b.mode !== mode);
  keep.push({ mode, at: Date.now(), json });
  write(BACKUP_KEY, JSON.stringify(keep));
  patch({ backups: readBackups() });
}

/* ── The store ──────────────────────────────────────────────────────────── */

const listeners = new Set<() => void>();
let state: CloudState = {
  loaded: false,
  signedIn: false,
  email: "",
  providers: { email: true, google: false, emailDelivery: "log" },
  profiles: [],
  max: 4,
  profileId: null,
  status: "off",
  lastSync: 0,
  conflicts: [],
  sheet: false,
  sentTo: "",
  busy: false,
  notice: "",
  error: "",
  backups: [],
};

function patch(p: Partial<CloudState>) {
  state = { ...state, ...p };
  for (const l of listeners) l();
}
export const getCloud = () => state;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useCloud = <T,>(pick: (s: CloudState) => T): T => useSyncExternalStore(subscribe, () => pick(state), () => pick(state));

/** Test phase (docs/TEST-PHASE.md): the saves and sync notes in storage were just wiped, so forget what this
    page remembered about them too. Nothing is pushed or pulled from before the reset. */
export function resetCloudMemory() {
  patch({ backups: [], conflicts: [], lastSync: 0, notice: "", error: "" });
}

export const openSheet = () => patch({ sheet: true, error: "", notice: "" });
export const cancelSent = () => patch({ sentTo: "", error: "" });
export const closeSheet = () => patch({ sheet: false, sentTo: "", error: "", notice: "" });
export const activeProfile = (s: CloudState = state): Profile | null => s.profiles.find((p) => p.id === s.profileId) ?? null;

/* ── Talking to the server ──────────────────────────────────────────────── */

type Reply = { ok: boolean; status: number; body: Record<string, unknown> };

async function api(path: string, body?: unknown, keepalive = false): Promise<Reply> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      keepalive: keepalive || undefined,
    });
    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      /* not JSON */
    }
    return { ok: res.ok, status: res.status, body: json };
  } catch {
    return { ok: false, status: 0, body: {} };
  }
}

function deviceName(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Phone";
  return "Computer";
}

/* ── This device's saves ────────────────────────────────────────────────── */

type Local = { text: string | null; raw: unknown; summary: Summary | null; key: string };

function readLocal(mode: SyncMode): Local {
  const text = read(MODE_KEYS[mode]);
  if (!text) return { text: null, raw: null, summary: null, key: "" };
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    return { text, raw: null, summary: null, key: "" };
  }
  const clean = mode === "survival" ? sanitizeSurvival(raw) : sanitize(raw);
  return { text, raw, summary: summarize(mode, clean), key: changeKey(raw) };
}

const touchAt = (mode: SyncMode, meta: Meta) => meta.touch[mode]?.at ?? 0;

/* ── Pushing ────────────────────────────────────────────────────────────── */

type PushResult = "ok" | "conflict" | "offline" | "error" | "signed-out";

async function pushMode(mode: SyncMode, profileId: string, baseRev: number, opts: { force?: boolean; keepalive?: boolean } = {}): Promise<{ result: PushResult; cloud?: Record<string, unknown> }> {
  const local = readLocal(mode);
  if (local.raw === null) return { result: "ok" };
  const r = await api("/api/save", { profile: profileId, mode, baseRev, epoch: currentEpoch(), data: local.raw, device: deviceName(), force: opts.force === true }, opts.keepalive);
  if (r.status === 0) return { result: "offline" };
  if (r.status === 401) return { result: "signed-out" };
  if (r.status === 409) return { result: "conflict", cloud: (r.body.save as Record<string, unknown> | null) ?? undefined };
  if (!r.ok) return { result: "error" };
  const meta = readMeta();
  meta.slots[profileId] = { ...meta.slots[profileId], [mode]: { rev: Number(r.body.rev), key: local.key } };
  saveMeta(meta);
  return { result: "ok" };
}

let chain: Promise<void> = Promise.resolve();

/** Run jobs one after another, so a push and a comparison never overlap. */
function exclusive(job: () => Promise<void>): Promise<void> {
  const next = chain.then(job, job);
  chain = next.catch(() => undefined);
  return next.catch((err) => {
    console.error("[cloud] sync step failed:", err);
    patch({ status: "error" });
  });
}

function sessionEnded() {
  patch({ signedIn: false, status: "off", profiles: [], email: "" });
}

/** The quiet sync that follows a save: push what changed, nothing else. A clash is left for `reconcile`. */
async function lightSync(keepalive = false) {
  const s = state;
  if (!s.signedIn || !s.profileId || s.conflicts.length) return;
  const profileId = s.profileId;
  let clash = false;
  let offline = false;
  for (const mode of SYNC_MODES) {
    const meta = readMeta();
    if (meta.owner !== profileId) return;
    const local = readLocal(mode);
    if (local.raw === null || !local.summary || !hasProgress(local.summary)) continue;
    const have = meta.slots[profileId]?.[mode];
    if (have && have.key === local.key) continue;
    const { result } = await pushMode(mode, profileId, have?.rev ?? 0, { keepalive });
    if (result === "conflict") clash = true;
    else if (result === "offline") offline = true;
    else if (result === "signed-out") return sessionEnded();
    else if (result === "error") patch({ status: "error" });
  }
  if (clash) {
    void reconcile(); /* queued behind this job */
    return;
  }
  if (offline) return patch({ status: "offline" });
  patch({ status: "idle", lastSync: Date.now() });
}

let timer = 0;
function schedulePush() {
  if (!state.signedIn || !state.profileId) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void exclusive(() => lightSync()), PUSH_DEBOUNCE_MS);
}

/* ── Comparing and settling ─────────────────────────────────────────────── */

type CloudRow = { mode: SyncMode; rev: number; updatedAt: number; device: string | null; summary: Summary };

async function fetchData(profileId: string, mode: SyncMode): Promise<unknown | null> {
  const r = await api(`/api/save?profile=${encodeURIComponent(profileId)}&mode=${mode}`);
  const save = r.body.save as { data?: unknown } | null | undefined;
  return r.ok && save ? (save.data ?? null) : null;
}

/** Put a cloud save on this device. */
function adopt(mode: SyncMode, profileId: string, data: unknown, rev: number) {
  const text = JSON.stringify(data);
  write(MODE_KEYS[mode], text);
  const meta = readMeta();
  meta.slots[profileId] = { ...meta.slots[profileId], [mode]: { rev, key: changeKey(data) } };
  meta.touch[mode] = { key: changeKey(data), at: Date.now() };
  saveMeta(meta);
}

/** Make a device that belonged to someone else belong to this profile: their fish are safe in the cloud. */
async function swapTo(profileId: string, cloud: Map<SyncMode, CloudRow>): Promise<SyncMode[]> {
  const old = readMeta().owner;
  if (old && state.profiles.some((p) => p.id === old)) {
    for (const mode of SYNC_MODES) {
      const have = readMeta().slots[old]?.[mode];
      const local = readLocal(mode);
      if (local.raw !== null && (!have || have.key !== local.key)) await pushMode(mode, old, have?.rev ?? 0);
    }
  }
  const changed: SyncMode[] = [];
  for (const mode of SYNC_MODES) {
    const local = readLocal(mode);
    if (local.summary && local.text) stash(mode, local.text);
    const row = cloud.get(mode);
    if (row) {
      const data = await fetchData(profileId, mode);
      if (data) adopt(mode, profileId, data, row.rev);
    } else {
      write(MODE_KEYS[mode], null);
      write(MODE_KEYS[mode] + "-bak", null);
    }
    changed.push(mode);
  }
  const meta = readMeta();
  meta.owner = profileId;
  saveMeta(meta);
  return changed;
}

/** After the game reloaded a slot it may have written it back slightly differently (it normalises on load). That is not a
    change by the player, so the "last synced" fingerprint follows it. */
function rekey(profileId: string, modes: Iterable<SyncMode>) {
  const meta = readMeta();
  for (const mode of modes) {
    const have = meta.slots[profileId]?.[mode];
    if (!have) continue;
    const key = readLocal(mode).key;
    meta.slots[profileId] = { ...meta.slots[profileId], [mode]: { rev: have.rev, key } };
    meta.touch[mode] = { key, at: meta.touch[mode]?.at ?? Date.now() };
  }
  saveMeta(meta);
}

/** Compare this device with the cloud, mode by mode, and settle everything that does not need a person. */
export async function reconcile() {
  await exclusive(async () => {
    const s = state;
    if (!s.signedIn || !s.profileId) return;
    const profileId = s.profileId;
    patch({ status: "syncing" });
    flushSave();
    const listed = await api(`/api/save?profile=${encodeURIComponent(profileId)}`);
    if (listed.status === 401) return sessionEnded();
    if (!listed.ok) return patch({ status: listed.status === 0 ? "offline" : "error" });
    const cloud = new Map<SyncMode, CloudRow>();
    for (const row of (listed.body.saves as CloudRow[]) ?? []) if (isSyncMode(row.mode)) cloud.set(row.mode, row);

    const reloaded = new Set<SyncMode>();
    let meta = readMeta();
    if (meta.owner && meta.owner !== profileId) {
      for (const m of await swapTo(profileId, cloud)) reloaded.add(m);
    } else {
      const conflicts: Conflict[] = [];
      for (const mode of SYNC_MODES) {
        meta = readMeta();
        const local = readLocal(mode);
        const row = cloud.get(mode) ?? null;
        const have = meta.slots[profileId]?.[mode];
        const action = decideSync({
          local: local.summary,
          cloud: row ? row.summary : null,
          cloudRev: row?.rev ?? 0,
          syncedRev: have?.rev ?? 0,
          localChanged: !have || have.key !== local.key,
        });
        if (action === "none") {
          if (row && local.raw !== null && (!have || have.rev !== row.rev)) {
            meta.slots[profileId] = { ...meta.slots[profileId], [mode]: { rev: row.rev, key: local.key } };
            saveMeta(meta);
          }
        } else if (action === "push") {
          const r = await pushMode(mode, profileId, row?.rev ?? 0);
          if (r.result === "offline") return patch({ status: "offline" });
          if (r.result === "signed-out") return sessionEnded();
          if (r.result === "conflict" && local.summary && row) conflicts.push(conflictOf(mode, local, row, meta));
        } else if (action === "pull" && row) {
          const data = await fetchData(profileId, mode);
          if (data) {
            stash(mode, local.summary ? local.text : null);
            adopt(mode, profileId, data, row.rev);
            reloaded.add(mode);
          }
        } else if (action === "choose" && row && local.summary) {
          conflicts.push(conflictOf(mode, local, row, meta));
        }
      }
      meta = readMeta();
      meta.owner = profileId;
      saveMeta(meta);
      if (conflicts.length) patch({ conflicts, sheet: false });
    }
    if (reloaded.has(useGame.getState().mode as SyncMode)) {
      reloadActiveSlot();
      rekey(profileId, reloaded);
    }
    patch({ status: "idle", lastSync: Date.now(), backups: readBackups() });
  });
}

function conflictOf(mode: SyncMode, local: Local, row: CloudRow, meta: Meta): Conflict {
  return { mode, local: local.summary as Summary, cloud: row.summary, localAt: touchAt(mode, meta), cloudAt: row.updatedAt, cloudRev: row.rev, device: row.device };
}

export type Choice = "device" | "cloud" | "newer";

/** The player's answer for one mode. The copy that loses is kept in Settings for 7 days. */
export async function resolveConflict(mode: SyncMode, choice: Choice) {
  const c = state.conflicts.find((x) => x.mode === mode);
  const profileId = state.profileId;
  if (!c || !profileId) return;
  patch({ busy: true });
  const pick = choice === "newer" ? newerOf(c.localAt, c.cloudAt) : choice;
  let failed = false;
  if (pick === "device") {
    const cloudData = await fetchData(profileId, mode);
    if (cloudData) stash(mode, JSON.stringify(cloudData));
    const r = await pushMode(mode, profileId, c.cloudRev, { force: true });
    failed = r.result !== "ok";
  } else {
    const data = await fetchData(profileId, mode);
    if (!data) failed = true;
    else {
      stash(mode, readLocal(mode).text);
      adopt(mode, profileId, data, c.cloudRev);
    }
  }
  if (failed) return patch({ busy: false, error: "Couldn't reach the cloud. Nothing was changed. Try again in a moment." });
  const rest = state.conflicts.filter((x) => x.mode !== mode);
  patch({ conflicts: rest, busy: false, error: "" });
  if (pick === "cloud" && useGame.getState().mode === mode) {
    reloadActiveSlot();
    rekey(profileId, [mode]);
  }
  if (!rest.length) patch({ status: "idle", lastSync: Date.now(), backups: readBackups() });
}

/** Put a stashed copy back on this device (it will go to the cloud with the next save). */
export function restoreBackup(mode: SyncMode): boolean {
  const b = readBackups().find((x) => x.mode === mode);
  if (!b) return false;
  stash(mode, readLocal(mode).text);
  write(MODE_KEYS[mode], b.json);
  write(BACKUP_KEY, JSON.stringify(readBackups().filter((x) => x.mode !== mode || x.json !== b.json)));
  if (useGame.getState().mode === mode) reloadActiveSlot();
  patch({ backups: readBackups(), notice: "Put back. It will go to the cloud with your next save." });
  schedulePush();
  return true;
}

/** The stashed copy as a save code (the same kind Settings → Save code makes). */
export const backupCode = (b: Backup): string => btoa(unescape(encodeURIComponent(b.json)));

/* ── Signing in and out ─────────────────────────────────────────────────── */

function applyMe(body: Record<string, unknown>) {
  const providers = (body.providers as Providers) ?? state.providers;
  if (body.signedIn !== true) return patch({ loaded: true, signedIn: false, providers, profiles: [], email: "", status: "off" });
  const profiles = (body.profiles as Profile[]) ?? [];
  const meta = readMeta();
  const wanted = profiles.find((p) => p.id === meta.profileId) ?? (profiles.length === 1 ? profiles[0] : null);
  patch({
    loaded: true,
    signedIn: true,
    providers,
    profiles,
    max: Number(body.maxProfiles) || 4,
    email: String((body.account as { email?: string } | undefined)?.email ?? ""),
    profileId: wanted?.id ?? null,
    status: state.status === "off" ? "idle" : state.status,
  });
}

export async function refreshMe(): Promise<void> {
  const r = await api("/api/account");
  if (r.status === 0) return void patch({ loaded: true });
  applyMe(r.body);
}

/** After a fresh sign-in: show the profile picker when there is a choice, otherwise carry on. */
async function afterSignIn() {
  const s = state;
  if (!s.profiles.length || (!s.profileId && s.profiles.length > 1)) return patch({ sheet: true });
  if (s.profileId) await selectProfile(s.profileId, true);
}

export async function requestLink(email: string) {
  patch({ busy: true, error: "", notice: "" });
  const r = await api("/api/account", { op: "request", email });
  if (r.ok) return patch({ busy: false, sentTo: email.trim() });
  const why =
    r.body.error === "bad_email"
      ? "That does not look like an email address."
      : r.body.error === "slow_down"
        ? "That's a lot of tries. Wait a little while and try again."
        : r.status === 0
          ? "Can't reach the game's server. Check your connection."
          : "We couldn't send the email. Try again soon.";
  patch({ busy: false, error: why });
}

export async function consumeLink(token: string) {
  patch({ busy: true, error: "", sheet: true });
  const r = await api("/api/account", { op: "verify", token });
  if (!r.ok) {
    return patch({ busy: false, error: r.body.error === "link_used_or_old" ? "That link was already used or is too old. Ask for a new one." : "That link did not work. Ask for a new one." });
  }
  applyMe(r.body);
  patch({ busy: false, sentTo: "", sheet: true });
  await afterSignIn();
}

export async function signOut() {
  await api("/api/account", { op: "logout" });
  const meta = readMeta();
  saveMeta({ ...meta, profileId: null });
  window.clearTimeout(timer);
  patch({ signedIn: false, profiles: [], profileId: null, email: "", status: "off", conflicts: [], sheet: false, notice: "" });
}

export async function createProfile(name: string, kid: boolean) {
  patch({ busy: true, error: "" });
  const r = await api("/api/profiles", { op: "create", name, kid });
  if (!r.ok) {
    return patch({ busy: false, error: r.body.error === "profiles_full" ? "That's four profiles already. Remove one to add another." : r.body.error === "bad_name" ? "Pick a friendly nickname, at least two letters." : "Couldn't add the profile. Try again." });
  }
  await refreshMe();
  patch({ busy: false });
  /* The first profile starts fishing right away; later ones are added and picked when their turn comes. */
  if (state.profiles.length === 1) await selectProfile((r.body.profile as Profile).id);
}

export async function renameProfile(id: string, name: string) {
  const r = await api("/api/profiles", { op: "rename", profile: id, name });
  if (!r.ok) return patch({ error: "Pick a friendly nickname, at least two letters." });
  await refreshMe();
}

export async function removeProfile(id: string) {
  const r = await api("/api/profiles", { op: "remove", profile: id });
  if (!r.ok) return patch({ error: "Couldn't remove it. Try again." });
  const meta = readMeta();
  if (meta.profileId === id) meta.profileId = null;
  if (meta.owner === id) meta.owner = null;
  delete meta.slots[id];
  saveMeta(meta);
  await refreshMe();
}

function freshId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}

/** Fish as this profile on this device: its saves load here, and its tournament identity and friends follow. */
export async function selectProfile(id: string, quiet = false) {
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return;
  if (!quiet) patch({ busy: true, error: "" });
  const meta = readMeta();
  meta.profileId = id;
  saveMeta(meta);
  /* The device keeps its own anonymous id for the first profile that uses it; any other profile gets its own. */
  const candidate = !meta.owner || meta.owner === id ? playerId() : freshId();
  const linked = await api("/api/profiles", { op: "link", profile: id, playerId: candidate });
  const pid = linked.body.playerId;
  if (typeof pid === "string" && pid !== playerId() && !useGame.getState().tourney) write(PLAYER_KEY, pid);
  /* Picking a kid's profile turns Kid Mode on for this screen, and a grown-up's turns it off (it follows the person at the screen). */
  if (!quiet && useGame.getState().kid !== profile.kid) useGame.getState().setKid(profile.kid);
  patch({ profileId: id, busy: false, sheet: quiet ? state.sheet : false, conflicts: [] });
  await reconcile();
}

export async function exportMyData() {
  const r = await api("/api/account?export=1");
  if (!r.ok) return patch({ error: "Couldn't get your data. Try again." });
  const blob = new Blob([JSON.stringify(r.body, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fac-ultra-my-account.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function deleteMyAccount(confirm: string) {
  const r = await api("/api/account", { op: "delete", confirm });
  if (!r.ok) return patch({ error: "Type DELETE exactly, then try again." });
  saveMeta({ v: 1, profileId: null, owner: null, slots: {}, touch: {} });
  write(BACKUP_KEY, null);
  window.clearTimeout(timer);
  patch({ signedIn: false, profiles: [], profileId: null, email: "", status: "off", conflicts: [], backups: [], sheet: true, notice: "Your account and cloud saves are deleted. The fish on this device are still here." });
}

/* ── Start-up ───────────────────────────────────────────────────────────── */

let started = false;

/** Called once by the game shell after the first load. Safe to call twice. */
export async function startCloud() {
  if (started || typeof window === "undefined") return;
  started = true;
  patch({ backups: readBackups() });
  onPersisted((mode, json) => {
    if (!isSyncMode(mode)) return;
    let key = "";
    try {
      key = changeKey(JSON.parse(json));
    } catch {
      return;
    }
    const meta = readMeta();
    if (meta.touch[mode]?.key !== key) {
      meta.touch[mode] = { key, at: Date.now() };
      saveMeta(meta);
      schedulePush();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.signedIn && state.profileId && !state.conflicts.length) void exclusive(() => lightSync(true));
  });
  window.addEventListener("online", () => void (state.status === "offline" ? reconcile() : undefined));
  window.setInterval(() => {
    if (state.status === "offline" || state.status === "error") void exclusive(() => lightSync());
  }, 60_000);

  /* Coming back from the email link or from Google. */
  const url = new URL(window.location.href);
  const token = url.searchParams.get("signin");
  const cloud = url.searchParams.get("cloud");
  if (token || cloud) {
    url.searchParams.delete("signin");
    url.searchParams.delete("cloud");
    url.searchParams.delete("why");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  }
  if (token) return void (await consumeLink(token));
  await refreshMe();
  if (cloud === "ok") {
    patch({ sheet: true });
    return void (await afterSignIn());
  }
  if (cloud === "error" || cloud === "google-off") patch({ sheet: true, error: "Google sign-in didn't work. Try again, or use the email link." });
  if (state.signedIn && state.profileId) await reconcile();
}
