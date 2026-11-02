#!/usr/bin/env node
/**
 * Touch-target check for the phone menus (WP-10): every button, link, field and tab the player can see must be at
 * least 44 x 44 CSS px. Opens the built game in headless Chromium at phone sizes, walks the title screen, every
 * menu tab and a detail view, and lists anything smaller.
 *
 *   node scripts/check-touch-targets.mjs [baseUrl]      (default http://localhost:4173)
 *
 * Needs `playwright` (not a dependency of the game: install it yourself or run it through npx) and a running
 * build. CHROME_PATH picks the browser. Exits 1 when something is too small.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("[touch-targets] playwright is not installed; run `npm i --no-save playwright` first.");
  process.exit(2);
}
const base = process.argv[2] || "http://localhost:4173";
const MIN = 44;
const SIZES = { phone: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const TABS = ["play", "tackle", "lodge", "waters", "players", "settings"];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
const bad = new Map();
const scan = async (page, where) => {
  const found = await page.evaluate((min) => {
    const out = [];
    const sel = "button, a[href], input:not([type=hidden]), select, textarea, [role=tab], [role=option], [role=button]";
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      if (el.closest("[inert], [aria-hidden=true]")) continue;
      if (r.width < min - 0.5 || r.height < min - 0.5) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
        out.push(`${label} (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return out;
  }, MIN);
  for (const f of found) bad.set(`${where}: ${f}`, true);
};
for (const [name, viewport] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "A grown-up", exact: true }).click().catch(() => {});
  await scan(page, `${name} title`);
  await page.getByTestId("title-play").click();
  for (const tab of TABS) {
    await page.locator(`#hub-tab-${tab}`).click();
    await page.waitForTimeout(500);
    await scan(page, `${name} ${tab}`);
    const row = page.locator("#hub-panel [role=option]").first();
    if ((await row.count()) && tab !== "play") {
      await row.click();
      await page.waitForTimeout(500);
      await scan(page, `${name} ${tab} detail`);
      await page.locator("[data-nav=back]").first().click().catch(() => {});
    }
  }
  await page.keyboard.press("Escape");
  await page.locator('[data-item="expedition"]').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await scan(page, `${name} game`);
  await ctx.close();
}
await browser.close();
if (bad.size) {
  console.log(`[touch-targets] ${bad.size} target(s) under ${MIN}px:`);
  for (const k of bad.keys()) console.log("  " + k);
  process.exit(1);
}
console.log(`[touch-targets] every visible target is at least ${MIN}px, on the title screen, all menu tabs and the game.`);
