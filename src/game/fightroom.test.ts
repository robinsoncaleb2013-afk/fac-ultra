/* Fish-fight rooms (P6): the queue, the match, the room lifecycle, chat and its
   safety rules, the Kids Mode refusal, and the wire. The fight inside the room
   is fight.ts's own — one test pins that by stepping a standalone fight beside
   a room fight and comparing every number that matters. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { newFight, stepFight, FIGHT_STEP } from "./fight.ts";
import {
  applyInputRun,
  CHAT_GAP_MS,
  CHAT_MAX_LEN,
  CHAT_MAX_MESSAGES,
  chatProblem,
  cleanChatText,
  emptyFightQueue,
  fightFishOf,
  fishFromWire,
  formMatch,
  joinProblem,
  joinQueue,
  KID_PROBLEM,
  leaveQueue,
  leaveRoom,
  markReady,
  matchSeedFor,
  playerOf,
  postChat,
  readFightWire,
  roomNameFor,
  roomOfPlayer,
  roomView,
  stepRoom,
  wireFishOf,
  type QueueEntry,
} from "./fightroom.ts";

const perch = fightFishOf("perch")!.fish;

function entry(id: string, at: number, name = id === "aaa" ? "Sam" : "Jo"): QueueEntry {
  return { id, name, fish: perch, at };
}

/** Two anglers in a room, still in "waiting". */
function matched() {
  const q = emptyFightQueue();
  assert.equal(joinQueue(q, entry("aaa", 1000), false), null, "one angler waits");
  const room = joinQueue(q, entry("bbb", 2000), false);
  assert.ok(room, "the second angler makes a match");
  return { q, room };
}

/** A room in "fighting": both anglers ready. */
function fighting() {
  const { q, room } = matched();
  assert.equal(markReady(room, "aaa"), true);
  assert.equal(room.phase, "waiting", "one ready is not enough");
  assert.equal(markReady(room, "bbb"), true);
  assert.equal(room.phase, "fighting");
  return { q, room };
}

/* ── The queue ───────────────────────────────────────────────────────────── */

test("two joiners are matched, a third waits in line", () => {
  const q = emptyFightQueue();
  assert.equal(joinQueue(q, entry("aaa", 1000), false), null);
  assert.deepEqual(q.waiting.map((e) => e.id), ["aaa"]);
  const room = joinQueue(q, entry("bbb", 2000), false);
  assert.ok(room);
  assert.equal(room.phase, "waiting");
  assert.deepEqual(room.players.map((p) => p.id), ["aaa", "bbb"]);
  assert.equal(q.waiting.length, 0, "matched anglers leave the queue");
  assert.equal(joinQueue(q, entry("ccc", 3000, "Kit"), false), null, "no pair for the third yet");
  assert.deepEqual(q.waiting.map((e) => e.id), ["ccc"]);
  assert.equal(q.rooms.length, 1);
});

test("the queue pairs in join order, not arrival-at-this-device order", () => {
  const q = emptyFightQueue();
  joinQueue(q, entry("bbb", 2000), false);
  /* Sam's join line arrives second here but is stamped earlier (the lobby heartbeat
     can deliver them either way round); the pair must still be Sam first. */
  const room = joinQueue(q, entry("aaa", 1000), false);
  assert.ok(room);
  assert.deepEqual(room.players.map((p) => p.id), ["aaa", "bbb"]);
});

test("leaving before a match frees the place; the next joiner pairs with whoever is next", () => {
  const q = emptyFightQueue();
  joinQueue(q, entry("aaa", 1000), false);
  assert.equal(leaveQueue(q, "aaa"), true);
  assert.equal(leaveQueue(q, "aaa"), false, "already gone");
  assert.equal(joinQueue(q, entry("bbb", 2000), false), null, "nobody to pair with");
  const room = joinQueue(q, entry("ccc", 3000, "Kit"), false);
  assert.ok(room);
  assert.deepEqual(room.players.map((p) => p.id), ["bbb", "ccc"]);
});

test("you cannot join twice, or while already in a fight", () => {
  const { q } = matched();
  assert.match(joinProblem(q, "aaa", false) ?? "", /already in a fish fight/);
  assert.equal(joinQueue(q, entry("aaa", 5000), false), null);
  const q2 = emptyFightQueue();
  joinQueue(q2, entry("aaa", 1000), false);
  assert.match(joinProblem(q2, "aaa", false) ?? "", /already in the queue/);
});

test("Kids Mode refuses the queue outright and changes nothing", () => {
  const q = emptyFightQueue();
  assert.equal(joinProblem(q, "aaa", true), KID_PROBLEM);
  assert.equal(joinQueue(q, entry("aaa", 1000), true), null);
  assert.equal(q.waiting.length, 0);
  assert.equal(q.rooms.length, 0);
});

test("both fights in a match share one seed, worked out the same from either side", () => {
  assert.equal(matchSeedFor("aaa", "bbb"), matchSeedFor("bbb", "aaa"));
  const { room } = matched();
  assert.equal(room.players[0].fight.rs, room.players[1].fight.rs, "same seed, same runs and jumps — fair");
  assert.equal(roomNameFor("aaa", "bbb"), roomNameFor("bbb", "aaa"));
});

/* ── The room lifecycle ──────────────────────────────────────────────────── */

test("room states run waiting → fighting → done, and nothing steps before fighting", () => {
  const { room } = matched();
  assert.equal(stepRoom(room, "aaa", true), false, "no fighting while waiting for Ready");
  const { room: live } = fighting();
  assert.equal(stepRoom(live, "nobody", true), false, "only the two anglers fight");
  assert.equal(stepRoom(live, "aaa", true), true);
  let guard = 0;
  while (live.phase === "fighting" && guard++ < 8000) {
    stepRoom(live, "aaa", true);
    if (live.phase === "fighting") stepRoom(live, "bbb", false);
  }
  assert.equal(live.phase, "done");
  assert.ok(live.end && live.winner, "somebody won");
  assert.equal(live.winner, live.end.winner);
  assert.equal(stepRoom(live, "aaa", true), false, "a finished fight ignores more input");
});

test("the room's fight is fight.ts's fight: same init and inputs, same numbers", () => {
  const { room } = fighting();
  const mine = playerOf(room, "aaa")!;
  const solo = newFight({ ...perch, seed: matchSeedFor("aaa", "bbb") });
  const inputs = Array.from({ length: 120 }, (_, i) => i % 5 < 3);
  for (const held of inputs) {
    if (room.phase !== "fighting") break;
    stepRoom(room, "aaa", held);
    if (!solo.result) stepFight(solo, held, FIGHT_STEP);
  }
  assert.equal(mine.fight.tension, solo.tension);
  assert.equal(mine.fight.dist, solo.dist);
  assert.equal(mine.fight.steps, solo.steps);
  assert.equal(mine.fight.result, solo.result);
});

test("the outcome comes from the fights: a landed fish wins, a lost fish loses", () => {
  const { room } = fighting();
  /* Sam plays; Jo never touches the reel, so Jo's fish takes all the line and slips
     away (fight.ts) — or Sam lands or snaps first. Whichever fight.ts decides, the
     room's story must match it exactly. */
  let guard = 0;
  while (room.phase === "fighting" && guard++ < 8000) {
    stepRoom(room, "aaa", true);
    if (room.phase === "fighting") stepRoom(room, "bbb", false);
  }
  assert.equal(room.phase, "done");
  const end = room.end!;
  const winner = room.players.find((p) => p.id === end.winner)!;
  const loser = room.players.find((p) => p.id === end.loser)!;
  if (end.reason === "landed") {
    assert.equal(winner.fight.result, "landed");
    assert.match(end.text, /landed their fish first/);
  } else {
    assert.equal(end.reason, "escaped");
    assert.ok(loser.fight.result === "snap" || loser.fight.result === "slip", `loser's fish is gone (${loser.fight.result})`);
    assert.match(end.text, /got away/);
  }
  assert.ok(end.text.includes(winner.name), "the screen line names the winner");
});

test("input runs from the wire step a fight, bounded so a bad peer cannot fast-forward", () => {
  const { room } = fighting();
  assert.equal(applyInputRun(room, "bbb", true, 0), false);
  assert.equal(applyInputRun(room, "bbb", true, 201), false);
  assert.equal(applyInputRun(room, "bbb", true, 10), true);
  assert.equal(playerOf(room, "bbb")!.fight.steps, 10);
});

test("leaving a waiting room puts the other angler back at the front of the queue", () => {
  const { q, room } = matched();
  joinQueue(q, entry("ccc", 3000, "Kit"), false);
  assert.equal(leaveRoom(q, room.id, "aaa"), true);
  assert.equal(q.rooms.length, 1, "Jo is re-matched with Kit at once");
  assert.deepEqual(q.rooms[0].players.map((p) => p.id), ["bbb", "ccc"], "Jo kept the earlier place in line");
  assert.equal(roomOfPlayer(q, "aaa"), null);
});

test("leaving mid-fight forfeits: the other angler wins", () => {
  const { q, room } = fighting();
  assert.equal(leaveRoom(q, room.id, "bbb"), true);
  assert.equal(room.phase, "done");
  assert.equal(room.winner, "aaa");
  assert.equal(room.end?.reason, "forfeit");
  assert.match(room.end?.text ?? "", /left the fight/);
  assert.equal(leaveRoom(q, room.id, "nobody"), false);
  assert.ok(formMatch(q) === null, "a finished room makes no new match");
});

/* ── Chat ────────────────────────────────────────────────────────────────── */

test("chat appends newest-last, in the order lines were sent", () => {
  const { room } = matched();
  const a = postChat(room, "aaa", "Good luck!", false, 10_000);
  const b = postChat(room, "bbb", "You too. Nice perch.", false, 10_000 + CHAT_GAP_MS);
  assert.ok(a && b);
  assert.deepEqual(room.chat.map((m) => m.text), ["Good luck!", "You too. Nice perch."]);
  assert.deepEqual(room.chat.map((m) => m.name), ["Sam", "Jo"]);
  assert.ok(b.id > a.id);
});

test("chat is capped: long lines are cut, and the list keeps only the newest lines", () => {
  const { room } = matched();
  const long = postChat(room, "aaa", "x".repeat(400), false, 0);
  assert.equal(long?.text.length, CHAT_MAX_LEN);
  for (let i = 0; i < CHAT_MAX_MESSAGES + 5; i++) {
    const who = i % 2 ? "bbb" : "aaa";
    assert.ok(postChat(room, who, `line ${i}`, false, 1000 + i * CHAT_GAP_MS), `line ${i} posts`);
  }
  assert.equal(room.chat.length, CHAT_MAX_MESSAGES);
  assert.equal(room.chat[room.chat.length - 1].text, `line ${CHAT_MAX_MESSAGES + 4}`, "newest last");
  assert.ok(!room.chat.some((m) => m.text === "line 0"), "the oldest fell off");
});

test("chat text is made plain: markup and odd characters never reach the screen", () => {
  assert.equal(cleanChatText("<b>hi</b>"), "bhib");
  assert.equal(cleanChatText("  too    many   spaces  "), "too many spaces");
  assert.equal(cleanChatText(42), "");
  assert.equal(cleanChatText("Nice fish!"), "Nice fish!");
});

test("chat refuses rude words, contact details and floods — in friendly words", () => {
  const { room } = matched();
  assert.match(chatProblem(room, "aaa", "this is shit", false, 0) ?? "", /Keep it friendly/);
  assert.equal(postChat(room, "aaa", "this is shit", false, 0), null);
  assert.match(chatProblem(room, "aaa", "find me at example.com", false, 0) ?? "", /Keep it friendly/, "no web addresses");
  assert.match(chatProblem(room, "aaa", "call 970 555 1234", false, 0) ?? "", /Keep it friendly/, "no phone numbers");
  assert.equal(room.chat.length, 0, "none of it was stored");
  assert.ok(postChat(room, "aaa", "Good luck!", false, 1000));
  assert.match(chatProblem(room, "aaa", "again already", false, 1000 + CHAT_GAP_MS - 1) ?? "", /one message at a time/);
  assert.equal(postChat(room, "ccc", "I am not in this room", false, 5000), null, "only the two anglers chat");
  assert.match(chatProblem(room, "aaa", "   ", false, 5000) ?? "", /Type a message first/);
});

test("Kids Mode refuses chat too — the whole package is closed", () => {
  const { room } = matched();
  assert.equal(chatProblem(room, "aaa", "hello", true, 0), KID_PROBLEM);
  assert.equal(postChat(room, "aaa", "hello", true, 0), null);
  assert.equal(room.chat.length, 0);
});

/* ── The wire ────────────────────────────────────────────────────────────── */

test("the wire carries a join, a ready, an input run, a chat line and a leave — nothing else", () => {
  const join = readFightWire({ k: "fq-join", name: "Sam", fish: wireFishOf(perch), at: 1234 });
  assert.deepEqual(join, { k: "fq-join", name: "Sam", fish: wireFishOf(perch), at: 1234 });
  assert.deepEqual(fishFromWire(wireFishOf(perch)), perch);
  assert.deepEqual(readFightWire({ k: "fr-ready" }), { k: "fr-ready" });
  assert.deepEqual(readFightWire({ k: "fr-input", held: true, steps: 12 }), { k: "fr-input", held: true, steps: 12 });
  assert.deepEqual(readFightWire({ k: "fr-chat", text: "Nice fish!" }), { k: "fr-chat", text: "Nice fish!" });
  assert.deepEqual(readFightWire({ k: "fr-leave" }), { k: "fr-leave" });
  assert.deepEqual(readFightWire({ k: "fq-leave" }), { k: "fq-leave" });
});

test("the wire drops anything malformed or out of range", () => {
  assert.equal(readFightWire(null), null);
  assert.equal(readFightWire("fr-chat"), null);
  assert.equal(readFightWire({ k: "nope" }), null);
  assert.equal(readFightWire({ k: "fr-input", held: true, steps: 0 }), null);
  assert.equal(readFightWire({ k: "fr-input", held: true, steps: 10_000 }), null, "no fast-forwarding");
  assert.equal(readFightWire({ k: "fr-input", held: "yes", steps: 3 }), null);
  assert.equal(readFightWire({ k: "fr-chat", text: "" }), null);
  assert.equal(readFightWire({ k: "fr-chat", text: 42 }), null);
  const badFish = { ...wireFishOf(perch), rarity: 9 };
  assert.equal(readFightWire({ k: "fq-join", name: "Sam", fish: badFish, at: 1 }), null);
  const badStyle = { ...wireFishOf(perch), style: "rocket" };
  assert.equal(readFightWire({ k: "fq-join", name: "Sam", fish: badStyle, at: 1 }), null);
  const badName = readFightWire({ k: "fq-join", name: "x", fish: wireFishOf(perch), at: 1 });
  assert.ok(badName && badName.k === "fq-join");
  assert.equal((badName as { name: string }).name, "Angler", "a too-short name falls back, like everywhere else");
});

test("roomView is a plain snapshot a component can draw: progress, zone, chat, result", () => {
  const { room } = fighting();
  stepRoom(room, "aaa", true);
  const v = roomView(room);
  assert.equal(v.phase, "fighting");
  assert.equal(v.players.length, 2);
  for (const p of v.players) {
    assert.ok(p.progress >= 0 && p.progress <= 1);
    assert.ok(["slack", "green", "high", "red"].includes(p.zone));
    assert.equal(p.result, null);
  }
  assert.equal(v.endText, "");
  postChat(room, "aaa", "Fish on!", false, 0);
  assert.equal(roomView(room).chat.length, 1);
});
