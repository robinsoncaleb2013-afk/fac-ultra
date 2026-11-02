import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyResults,
  canEmote,
  chooseMesh,
  cleanFriendCode,
  EMOTE_GAP_MS,
  EMOTES,
  emoteOf,
  formatFriendCode,
  friendCodeFrom,
  gapLine,
  medalFor,
  meshCap,
  newMedals,
  rankTeams,
  readHistory,
  readResults,
  readTitles,
  readTrophies,
  readWire,
  roomOf,
  shortDate,
  skinOf,
  teamById,
  TEAMS,
  titleFor,
  unlockedSkins,
  type Cabinet,
  type ResultRow,
} from "./social.ts";

const result = (over: Partial<ResultRow> = {}): ResultRow => ({
  id: "q-2026110213", title: "Pond Quick", kind: "quick", water: 0, category: "total", team: null, rank: 1, entrants: 6, score: 12.5, best: 4.2, at: Date.UTC(2026, 10, 2, 13, 10), medal: 1, ...over,
});
const empty = (): Cabinet => ({ trophies: [], titles: [], tourneyHistory: [], bobberSkin: "plain" });

test("there are eight emotes, all with a glyph and a short line, and unknown ids are refused", () => {
  assert.equal(EMOTES.length, 8);
  assert.equal(new Set(EMOTES.map((e) => e.id)).size, 8);
  for (const e of EMOTES) assert.ok(e.glyph && e.text.length <= 24);
  assert.equal(emoteOf("nice")?.text, "Nice fish!");
  assert.equal(emoteOf("<script>"), null);
  assert.equal(emoteOf(7), null);
});

test("emotes are rate limited by the gap", () => {
  assert.equal(canEmote(0, EMOTE_GAP_MS - 1), false);
  assert.equal(canEmote(0, EMOTE_GAP_MS), true);
});

test("the mesh cap is 4 on phones and tablets, 8 on desktop", () => {
  assert.equal(meshCap("phone"), 4);
  assert.equal(meshCap("tablet"), 4);
  assert.equal(meshCap("desktop"), 8);
});

test("chooseMesh keeps who you have, fills in id order, never passes the cap, and drops who left", () => {
  const roster = ["e", "b", "d", "a", "c", "f", "g"];
  assert.deepEqual(chooseMesh(roster, [], 4), ["a", "b", "c", "d"]);
  assert.deepEqual(chooseMesh(roster, ["g", "f"], 4), ["g", "f", "a", "b"]);
  assert.deepEqual(chooseMesh(roster, ["zz", "g"], 3), ["g", "a", "b"]);
  assert.equal(chooseMesh(["a"], [], 8).length, 1);
  assert.equal(chooseMesh(Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, "0")}`), [], 8).length, 8);
});

test("peer messages are validated: only known ids and sane numbers get through", () => {
  assert.deepEqual(readWire({ k: "emote", id: "wow" }), { k: "emote", id: "wow" });
  assert.equal(readWire({ k: "emote", id: "free text here" }), null);
  assert.deepEqual(readWire({ k: "boat", biome: 3, name: "Ann<b>" }), { k: "boat", biome: 3, name: "Annb" });
  assert.equal(readWire({ k: "boat", biome: 99, name: "x" }), null);
  assert.deepEqual(readWire({ k: "catch", b: 2, i: 7, w: 3.456 }), { k: "catch", b: 2, i: 7, w: 3.5 });
  assert.equal(readWire({ k: "catch", b: 2, i: 40, w: 3 }), null);
  assert.equal(readWire({ k: "catch", b: 2, i: 1, w: -1 }), null);
  for (const junk of [null, 7, "x", [], {}, { k: "nope" }]) assert.equal(readWire(junk), null);
  assert.equal(roomOf("p-ABCD"), "t-p-ABCD");
});

test("teams: eight presets, looked up by id", () => {
  assert.equal(TEAMS.length, 8);
  assert.equal(teamById("otters")?.name, "Otters");
  assert.equal(teamById("hax"), null);
  assert.equal(teamById(undefined), null);
});

test("rankTeams: competition ranking by weight, then best fish", () => {
  const r = rankTeams([
    { team: "otters", score: 10, best: 3, members: 2, fish: 4 },
    { team: "pike", score: 12, best: 2, members: 3, fish: 5 },
    { team: "crabs", score: 10, best: 4, members: 1, fish: 2 },
    { team: "frogs", score: 10, best: 3, members: 4, fish: 9 },
  ]);
  assert.deepEqual(r.map((t) => [t.team, t.rank]), [["pike", 1], ["crabs", 2], ["frogs", 3], ["otters", 3]]);
  assert.equal(r[0].name, "Pike");
});

test("friend codes: clean, format and make", () => {
  assert.equal(cleanFriendCode("abc-xyz"), "ABCXYZ");
  assert.equal(cleanFriendCode(" ab c2 3k "), "ABC23K");
  for (const bad of ["ABC", "ABCDEFG", "ABC0YZ", "ABCIYZ", "ABC-XY!", 5, null]) assert.equal(cleanFriendCode(bad), null, String(bad));
  assert.equal(formatFriendCode("ABCXYZ"), "ABC-XYZ");
  const c = friendCodeFrom([0, 1, 2, 3, 250, 255]);
  assert.equal(cleanFriendCode(c), c);
});

test("medals need a real board and a score; only the top three get one", () => {
  assert.equal(medalFor(1, 6, 5), 1);
  assert.equal(medalFor(3, 6, 5), 3);
  assert.equal(medalFor(4, 6, 5), 0);
  assert.equal(medalFor(1, 1, 5), 0, "alone on the board is not a win");
  assert.equal(medalFor(1, 6, 0), 0, "catching nothing is not a win");
});

test("titles: only a win earns one, written the way the spec says", () => {
  assert.equal(titleFor({ kind: "quick", water: 0, team: null, at: Date.UTC(2026, 10, 2, 13, 10), medal: 1 }), "Pond Champion · Nov 2");
  assert.equal(titleFor({ kind: "daily", water: 1, team: null, at: Date.UTC(2026, 10, 3), medal: 1 }), "River Daily Champion · Nov 3");
  assert.equal(titleFor({ kind: "private", water: 0, team: "otters", at: Date.UTC(2026, 0, 9), medal: 1 }), "Pond Otters Club Team Champions · Jan 9");
  assert.equal(titleFor({ kind: "quick", water: 0, team: null, at: 0, medal: 2 }), null);
  assert.equal(shortDate(Date.UTC(2026, 11, 31)), "Dec 31");
});

test("bobber skins unlock by medal and fall back to Classic", () => {
  assert.deepEqual(unlockedSkins([]), ["plain"]);
  assert.deepEqual(unlockedSkins([{ medal: 3, team: null }, { medal: 2, team: null }]), ["plain", "bronze", "silver"]);
  assert.deepEqual(unlockedSkins([{ medal: 1, team: "pike" }]), ["plain", "gold", "team"]);
  assert.equal(skinOf("nope").id, "plain");
  assert.equal(skinOf("gold").id, "gold");
});

test("applyResults files history, trophies and titles, and the same results twice change nothing", () => {
  const rs = [result(), result({ id: "d-2026-11-02", kind: "daily", medal: 2, rank: 2, at: Date.UTC(2026, 10, 3) }), result({ id: "q-2026110214", medal: 0, rank: 5, at: Date.UTC(2026, 10, 2, 14, 10) })];
  const once = applyResults(empty(), rs);
  assert.equal(once.tourneyHistory.length, 3);
  assert.deepEqual(once.tourneyHistory.map((h) => h.id), ["d-2026-11-02", "q-2026110214", "q-2026110213"], "newest first");
  assert.equal(once.trophies.length, 2);
  assert.deepEqual(once.titles, ["Pond Champion · Nov 2"]);
  assert.deepEqual(applyResults(once, rs), once);
});

test("applyResults caps the lists and drops a skin that is no longer earned", () => {
  const many = Array.from({ length: 80 }, (_, i) => result({ id: `q-${String(i).padStart(10, "0")}`, at: 1000 + i, medal: 1 }));
  const out = applyResults(empty(), many);
  assert.equal(out.tourneyHistory.length, 50);
  assert.equal(out.trophies.length, 60);
  assert.ok(out.titles.length <= 40);
  assert.equal(applyResults({ ...empty(), bobberSkin: "gold" }, []).bobberSkin, "plain");
  assert.equal(applyResults({ ...empty(), bobberSkin: "gold" }, [result()]).bobberSkin, "gold");
});

test("newMedals lists only medals the cabinet has not seen", () => {
  const a = result();
  const cab = applyResults(empty(), [a]);
  const b = result({ id: "q-2026110215", medal: 3 });
  assert.deepEqual(newMedals(cab, [a, b, result({ id: "q-x-none-1", medal: 0 })]).map((r) => r.id), ["q-2026110215"]);
});

test("saved fields are read defensively", () => {
  assert.deepEqual(readTrophies("nope"), []);
  assert.deepEqual(readTrophies([null, 5, { id: "ab", medal: 1 }, { id: "q-2026110213", medal: 9 }, { id: "q-2026110213", medal: 0 }]).map((t) => [t.id, t.medal]), [["q-2026110213", 3]]);
  assert.deepEqual(readHistory({}), []);
  const h = readHistory([{ id: "q-2026110213", title: "<img src=x>Pond", rank: -4, entrants: "lots", score: Infinity, medal: 7, kind: "weird", category: "x", water: 99, team: "hax" }]);
  assert.equal(h.length, 1);
  assert.equal(h[0].rank, 1);
  assert.equal(h[0].medal, 3);
  assert.equal(h[0].kind, "quick");
  assert.equal(h[0].category, "total");
  assert.equal(h[0].team, null);
  assert.ok(Number.isFinite(h[0].score));
  assert.ok(!h[0].title.includes("<"));
  assert.deepEqual(readTitles(["Pond Champion · Nov 2", "Pond Champion · Nov 2", 5, "<b>x</b>"]), ["Pond Champion · Nov 2", "bxb"]);
  assert.equal(readResults([{ id: "bad id", medal: 1 }, { id: "q-2026110213", medal: 1 }]).length, 1);
  assert.equal(readTitles(new Array(100).fill("T").map((t, i) => t + i)).length, 40);
});

test("gapLine says how far behind the angler above, or how far in front", () => {
  assert.equal(gapLine("total", 4, 10, { rank: 3, score: 12.3 }, null), "2.3 lb behind #3");
  assert.equal(gapLine("sprint", 2, 5, { rank: 1, score: 6 }, null), "1 kind behind #1");
  assert.equal(gapLine("value", 2, 100, { rank: 1, score: 1600 }, null), "1,500 pts behind #1");
  assert.equal(gapLine("big", 1, 9, null, { score: 7.5 }), "1.5 lb in front");
  assert.equal(gapLine("big", 1, 9, null, null), "in the lead");
  assert.equal(gapLine("total", 3, 5, { rank: 2, score: 5 }, null), "level with #2");
});
