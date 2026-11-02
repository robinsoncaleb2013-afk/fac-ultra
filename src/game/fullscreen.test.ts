import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enterFullscreen,
  exitFullscreen,
  fullscreenSupport,
  isFullscreen,
  isIos,
  toggleFullscreenWith,
  watchFullscreen,
  type FsDoc,
  type FsEnv,
} from "./fullscreen.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

function fakeDoc(over: Partial<FsDoc> & { prefixed?: boolean; allowed?: boolean } = {}) {
  const listeners = new Map<string, Set<() => void>>();
  const log: string[] = [];
  const doc: FsDoc = {
    fullscreenElement: null,
    fullscreenEnabled: over.prefixed ? undefined : (over.allowed ?? true),
    webkitFullscreenEnabled: over.prefixed ? (over.allowed ?? true) : undefined,
    documentElement: over.prefixed
      ? {
          webkitRequestFullscreen: () => {
            log.push("webkit-enter");
            doc.webkitFullscreenElement = {} as Element;
          },
        }
      : {
          requestFullscreen: (o) => {
            log.push(`enter:${o?.navigationUI}`);
            doc.fullscreenElement = {} as Element;
          },
        },
    exitFullscreen: over.prefixed
      ? undefined
      : () => {
          log.push("exit");
          doc.fullscreenElement = null;
        },
    webkitExitFullscreen: over.prefixed
      ? () => {
          log.push("webkit-exit");
          doc.webkitFullscreenElement = null;
        }
      : undefined,
    addEventListener: (t, f) => (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t, f) => listeners.get(t)?.delete(f),
  };
  return { doc, log, listeners };
}

const env = (doc: FsDoc, over: Partial<FsEnv> = {}): FsEnv => ({
  doc,
  userAgent: DESKTOP,
  platform: "Linux x86_64",
  maxTouchPoints: 0,
  standalone: false,
  phone: false,
  orientation: null,
  ...over,
});

test("iOS detection: iPhone, iPod, iPad and an iPad that says it is a Mac", () => {
  assert.equal(isIos(IPHONE, "iPhone", 5), true);
  assert.equal(isIos(DESKTOP, "MacIntel", 5), true);
  assert.equal(isIos(DESKTOP, "MacIntel", 0), false);
  assert.equal(isIos(ANDROID, "Linux armv8l", 5), false);
});

test("support: a normal browser can; iPhone Safari gets the Home Screen hint; an installed copy needs nothing", () => {
  assert.equal(fullscreenSupport(env(fakeDoc().doc)), "yes");
  assert.equal(fullscreenSupport(env(fakeDoc({ prefixed: true }).doc)), "yes");
  assert.equal(fullscreenSupport(env(fakeDoc({ allowed: false }).doc, { userAgent: IPHONE })), "home-screen");
  assert.equal(fullscreenSupport(env(fakeDoc({ allowed: false }).doc, { userAgent: IPHONE, standalone: true })), "installed");
  assert.equal(fullscreenSupport(env(fakeDoc({ allowed: false }).doc)), "no");
});

test("toggle enters, then leaves, and the state follows the document", async () => {
  const { doc, log } = fakeDoc();
  const e = env(doc);
  assert.equal(isFullscreen(doc), false);
  assert.equal(await toggleFullscreenWith(e), "entered");
  assert.equal(isFullscreen(doc), true);
  assert.equal(await toggleFullscreenWith(e), "left");
  assert.equal(isFullscreen(doc), false);
  assert.deepEqual(log, ["enter:hide", "exit"]);
});

test("the webkit-prefixed API works the same", async () => {
  const { doc, log } = fakeDoc({ prefixed: true });
  const e = env(doc);
  assert.equal(await toggleFullscreenWith(e), "entered");
  assert.equal(isFullscreen(doc), true);
  assert.equal(await toggleFullscreenWith(e), "left");
  assert.deepEqual(log, ["webkit-enter", "webkit-exit"]);
});

test("iPhone Safari: toggling answers with the Home Screen hint and does not try", async () => {
  const { doc, log } = fakeDoc({ allowed: false });
  assert.equal(await toggleFullscreenWith(env(doc, { userAgent: IPHONE })), "home-screen");
  assert.deepEqual(log, []);
});

test("a refused request does not throw", async () => {
  const { doc } = fakeDoc();
  doc.documentElement.requestFullscreen = () => Promise.reject(new Error("not allowed"));
  assert.equal(await enterFullscreen(env(doc)), false);
  assert.equal(await toggleFullscreenWith(env(doc)), "unavailable");
  doc.exitFullscreen = () => Promise.reject(new Error("nope"));
  doc.fullscreenElement = {} as Element;
  assert.equal(await exitFullscreen(env(doc)), false);
});

test("landscape lock is tried only on a phone after full screen starts, and failing is silent", async () => {
  const calls: string[] = [];
  const orientation = { lock: async (o: string) => void calls.push(o), unlock: () => void calls.push("unlock") };
  const a = fakeDoc();
  await enterFullscreen(env(a.doc, { phone: true, orientation }));
  assert.deepEqual(calls, ["landscape"]);
  const b = fakeDoc();
  await enterFullscreen(env(b.doc, { phone: false, orientation }));
  assert.deepEqual(calls, ["landscape"], "a PC never locks");
  const refused = { lock: () => Promise.reject(new Error("NotSupportedError")) };
  const c = fakeDoc();
  assert.equal(await enterFullscreen(env(c.doc, { phone: true, orientation: refused })), true, "still in full screen");
  await exitFullscreen(env(a.doc, { orientation }));
  assert.ok(calls.includes("unlock"));
});

test("watchFullscreen listens to both event names and unsubscribes", () => {
  const { doc, listeners } = fakeDoc();
  const off = watchFullscreen(doc, () => undefined);
  assert.equal(listeners.get("fullscreenchange")?.size, 1);
  assert.equal(listeners.get("webkitfullscreenchange")?.size, 1);
  off();
  assert.equal(listeners.get("fullscreenchange")?.size, 0);
  assert.equal(listeners.get("webkitfullscreenchange")?.size, 0);
});
