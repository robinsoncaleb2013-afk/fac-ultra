import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES } from "./content.ts";
import {
  advance,
  currentStep,
  isTutorialDone,
  shouldForceFirstCatch,
  skipTutorial,
  speak,
  startTutorial,
  TUTORIAL_FIRST_CATCH,
  TUTORIAL_FIRST_CATCH_NAME,
  TUTORIAL_STEPS,
  type TutorialAction,
  type TutorialState,
} from "./tutorial.ts";

/** Drive the machine with a list of events, from the start. */
function run(events: readonly ("next" | TutorialAction)[]): TutorialState {
  let s = startTutorial();
  for (const e of events) s = advance(s, e);
  return s;
}

/** The shortest honest path through the whole tutorial. */
const HAPPY_PATH = ["next", "next", "next", "reel", "pack", "tank", "next"] as const;

test("the steps teach in order: welcome, cast, bite, then reel, pack and tank, then done", () => {
  assert.deepEqual(
    TUTORIAL_STEPS.map((s) => s.id),
    ["welcome", "cast", "bite", "reel", "pack", "tank", "done"],
  );
  assert.deepEqual(
    TUTORIAL_STEPS.map((s) => s.action ?? null),
    [null, null, null, "reel", "pack", "tank", null],
    "only reel, pack and tank are steps the player must perform",
  );
});

test("every step has plain, short, kid-readable text", () => {
  for (const s of TUTORIAL_STEPS) {
    assert.ok(s.text.trim().length > 0, `${s.id} says something`);
    assert.ok(s.text.length <= 140, `${s.id} stays short (${s.text.length} chars)`);
    const sentences = s.text.split(/[.!?]+/).filter((x) => x.trim().length > 0);
    assert.ok(sentences.length >= 1 && sentences.length <= 2, `${s.id} is one or two sentences`);
  }
});

test("a new tutorial starts on the first step and is not done", () => {
  const s = startTutorial();
  assert.equal(isTutorialDone(s), false);
  assert.equal(currentStep(s), TUTORIAL_STEPS[0]);
  assert.equal(currentStep(s)?.id, "welcome");
});

test("narration steps advance on next, and only on next", () => {
  for (const id of ["welcome", "cast", "bite", "done"]) {
    const at = TUTORIAL_STEPS.findIndex((s) => s.id === id);
    const state: TutorialState = { index: at, done: false };
    for (const action of ["reel", "pack", "tank"] as const) {
      assert.deepEqual(advance(state, action), state, `${id} ignores a "${action}" event`);
    }
    const moved = advance(state, "next");
    if (id === "done") {
      assert.equal(isTutorialDone(moved), true, "next on the last step finishes the tutorial");
      assert.equal(currentStep(moved), null);
    } else {
      assert.equal(currentStep(moved)?.id, TUTORIAL_STEPS[at + 1].id, `${id} moves on next`);
    }
  }
});

test("each interactive step refuses next and advances only on its own action", () => {
  const actions: readonly TutorialAction[] = ["reel", "pack", "tank"];
  for (const action of actions) {
    const at = TUTORIAL_STEPS.findIndex((s) => s.action === action);
    assert.ok(at > 0, `there is a ${action} step`);
    const state: TutorialState = { index: at, done: false };
    assert.deepEqual(advance(state, "next"), state, `${action} step does not advance on next`);
    for (const other of actions) {
      if (other === action) continue;
      assert.deepEqual(advance(state, other), state, `${action} step ignores a "${other}" event`);
    }
    const moved = advance(state, action);
    assert.equal(moved.index, at + 1, `${action} step advances on its own action`);
    assert.equal(isTutorialDone(moved), false);
  }
});

test("the happy path walks every step in order and completes after the final step", () => {
  let s = startTutorial();
  const seen: string[] = [];
  for (const e of HAPPY_PATH) {
    const step = currentStep(s);
    assert.ok(step, "there is a step showing before each event");
    seen.push(step.id);
    s = advance(s, e);
  }
  assert.deepEqual(seen, ["welcome", "cast", "bite", "reel", "pack", "tank", "done"]);
  assert.equal(isTutorialDone(s), true);
  assert.equal(currentStep(s), null, "nothing left to show once finished");
});

test("mashing next cannot finish the tutorial: it stops at the first doing", () => {
  const s = run(["next", "next", "next", "next", "next", "next", "next", "next"]);
  assert.equal(currentStep(s)?.id, "reel");
  assert.equal(isTutorialDone(s), false);
});

test("a finished tutorial never moves again, and advance never changes its input", () => {
  const done = run(HAPPY_PATH);
  assert.deepEqual(advance(done, "next"), done);
  assert.deepEqual(advance(done, "reel"), done);
  const mid: TutorialState = { index: 3, done: false };
  const before = { ...mid };
  advance(mid, "reel");
  advance(mid, "next");
  assert.deepEqual(mid, before, "advance is pure");
});

test("skipping finishes the tutorial from any step", () => {
  for (const state of [startTutorial(), { index: 3, done: false }, { index: 6, done: false }]) {
    const skipped = skipTutorial(state);
    assert.equal(isTutorialDone(skipped), true);
    assert.equal(currentStep(skipped), null);
  }
});

test("the tutorial's first catch really is the Bluegill, first fish of the Pond", () => {
  assert.equal(TUTORIAL_FIRST_CATCH.biome, 0);
  assert.equal(TUTORIAL_FIRST_CATCH.species, 0);
  assert.equal(BIOMES[TUTORIAL_FIRST_CATCH.biome].name, "Pond");
  assert.equal(BIOMES[TUTORIAL_FIRST_CATCH.biome].fish[TUTORIAL_FIRST_CATCH.species], "Bluegill");
  assert.equal(TUTORIAL_FIRST_CATCH_NAME, "Bluegill");
});

test("shouldForceFirstCatch truth table: only an active, unfinished, catch-less tutorial forces it", () => {
  assert.equal(shouldForceFirstCatch({ tutored: false, caught: 0, tutorialActive: true }), true);
  assert.equal(shouldForceFirstCatch({ tutored: true, caught: 0, tutorialActive: true }), false, "already tutored");
  assert.equal(shouldForceFirstCatch({ tutored: false, caught: 1, tutorialActive: true }), false, "already caught one");
  assert.equal(shouldForceFirstCatch({ tutored: false, caught: 25, tutorialActive: true }), false);
  assert.equal(shouldForceFirstCatch({ tutored: false, caught: 0, tutorialActive: false }), false, "tutorial not running");
  assert.equal(shouldForceFirstCatch({ tutored: true, caught: 0, tutorialActive: false }), false);
  assert.equal(shouldForceFirstCatch({ tutored: true, caught: 3, tutorialActive: false }), false);
});

test("speak is a safe no-op with no window, with sound off, or with nothing to say", () => {
  /* Node has no window/speechSynthesis: every call must simply do nothing. */
  speak("Welcome to Fish and Collect!");
  speak("Welcome to Fish and Collect!", { soundOn: true });
  speak("Welcome to Fish and Collect!", { soundOn: false });
  speak("Welcome to Fish and Collect!", { muted: true });
  speak("");
  speak("   ");
});
