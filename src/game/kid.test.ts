import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assistOn,
  coachAlways,
  hintAfter,
  HINT_AFTER_KID,
  isLongMessage,
  KID_HELP_FLOOR,
  KID_TEXT_STEP,
  kidActive,
  LONG_MESSAGE,
  moneyWords,
  needsSure,
  numberWords,
  SPEECH_RATE,
  SURE_RARITY,
} from "./kid.ts";
import { fightHelp, HELP_SHOWN, isHelping } from "./assist.ts";
import { HINT_AFTER } from "./match.ts";
import { MODES } from "./modes.ts";

const allows = { assistAllowed: true };
const forbids = { assistAllowed: false };

test("Kid Mode is a lens: on only where the mode allows Helping Hand", () => {
  assert.equal(kidActive(true, allows), true);
  assert.equal(kidActive(false, allows), false);
  assert.equal(kidActive(true, forbids), false, "tournaments ignore Kid Mode");
  for (const m of Object.values(MODES)) assert.equal(kidActive(true, m), m.assistAllowed, m.id);
});

test("Kid Mode turns Helping Hand on; a mode that forbids it turns it off whatever you chose", () => {
  assert.equal(assistOn(false, true, allows), true);
  assert.equal(assistOn(true, false, allows), true);
  assert.equal(assistOn(false, false, allows), false);
  assert.equal(assistOn(true, true, forbids), false);
});

test("text goes up exactly one step", () => {
  assert.equal(KID_TEXT_STEP, 1);
});

test("hints come sooner for kids, never later", () => {
  assert.equal(hintAfter(false, HINT_AFTER), HINT_AFTER);
  assert.equal(hintAfter(true, HINT_AFTER), HINT_AFTER_KID);
  assert.ok(HINT_AFTER_KID < HINT_AFTER);
  assert.equal(hintAfter(true, 1), 1, "a hint that was already quicker stays quick");
  /* The spec says 8 s → 5 s; the game's 3 s is scaled by the same ratio. */
  assert.ok(Math.abs(HINT_AFTER_KID - (HINT_AFTER * 5) / 8) < 0.05);
});

test("coaching lines never stop in Kid Mode", () => {
  assert.equal(coachAlways(false, 0, 3), true);
  assert.equal(coachAlways(false, 3, 3), false);
  assert.equal(coachAlways(true, 99, 3), true);
});

test("rare and better ask 'Are you sure?' for kids; rebirth always does; grown-ups are not nagged", () => {
  assert.equal(SURE_RARITY, 2);
  assert.equal(needsSure(true, { kind: "sell", rarity: 1 }), false);
  assert.equal(needsSure(true, { kind: "sell", rarity: 2 }), true);
  assert.equal(needsSure(true, { kind: "sell", rarity: 4 }), true);
  assert.equal(needsSure(true, { kind: "sellMany", topRarity: 1 }), false);
  assert.equal(needsSure(true, { kind: "sellMany", topRarity: 3 }), true);
  assert.equal(needsSure(true, { kind: "rebirth" }), true);
  assert.equal(needsSure(false, { kind: "sell", rarity: 4 }), false);
  assert.equal(needsSure(false, { kind: "rebirth" }), false);
});

test("long messages get the speaker button; short ones do not", () => {
  assert.equal(isLongMessage("Bite. Hook it."), false);
  assert.equal(isLongMessage("x".repeat(LONG_MESSAGE)), true);
  assert.equal(isLongMessage("   " + "x".repeat(LONG_MESSAGE - 1) + "   "), false, "spaces do not count");
  assert.equal(isLongMessage("The boss snapped your line. Too long in the red. Let go when the needle turns red."), true);
  assert.equal(SPEECH_RATE, 0.95);
});

test("numbers have a word form for tooltips", () => {
  assert.equal(numberWords(0), "zero");
  assert.equal(numberWords(7), "seven");
  assert.equal(numberWords(13), "thirteen");
  assert.equal(numberWords(40), "forty");
  assert.equal(numberWords(99), "ninety-nine");
  assert.equal(numberWords(100), "one hundred");
  assert.equal(numberWords(1200), "one thousand two hundred");
  assert.equal(numberWords(1_500_000), "one million five hundred thousand");
  assert.equal(numberWords(2_000_000_003), "two billion three");
  assert.equal(numberWords(Number.POSITIVE_INFINITY), "too many to say");
  assert.equal(moneyWords(1), "one dollar");
  assert.equal(moneyWords(1200), "one thousand two hundred dollars");
  assert.equal(moneyWords(0), "zero dollars");
  assert.equal(moneyWords(50.9), "fifty dollars", "whole dollars");
  assert.equal(moneyWords(1e19), "a gigantic pile of dollars");
});

test("Helping Hand in Kid Mode never fades below a visible amount and always glows", () => {
  const calm = { assist: true, misses: 0, failedFights: 0, wins: 10 };
  const grown = fightHelp(calm);
  const kid = fightHelp({ ...calm, kid: true });
  assert.ok(grown && kid);
  assert.ok(kid.strength >= KID_HELP_FLOOR);
  assert.ok(kid.strength >= grown.strength);
  assert.ok(KID_HELP_FLOOR >= HELP_SHOWN);
  /* A grown-up with a long winning streak sees the help fade away entirely. */
  const faint = fightHelp({ ...calm, wins: 40 });
  assert.equal(isHelping(faint), faint ? faint.strength >= HELP_SHOWN : false);
  assert.equal(isHelping(faint, true), true, "kid: the glow always shows while help is on");
  assert.equal(isHelping(null, true), false, "no help, no glow");
  assert.equal(fightHelp({ ...calm, assist: false, kid: true }), null);
});
