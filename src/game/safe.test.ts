import assert from "node:assert/strict";
import { test } from "node:test";
import { isRude, nameProblem, safeName, squash } from "./safe.ts";

const FALLBACK = "Angler ABCD";

test("friendly fishing names pass untouched", () => {
  for (const n of ["Casey", "Bass Master", "Tilly the Pike", "Ava-Rose", "Mr. O'Neil", "Assist Crew", "Grassy Knoll", "Hello", "Cocoa Bean", "Peacock", "Scoop", "Sam 7"]) {
    assert.equal(safeName(n, FALLBACK), n, n);
    assert.equal(isRude(n), false, n);
  }
});

test("rude words fall back, even disguised with look-alike letters, spaces or stretched letters", () => {
  for (const n of ["fuck", "F U C K", "sh1t", "$h!t", "b1tch", "fuuuuck", "f.u.c.k", "ass", "a55", "Big Ass", "d1ck", "DAMN", "n1gg3r", "s3x", "p0rn"]) {
    assert.equal(safeName(n, FALLBACK), FALLBACK, n);
  }
});

test("contact details are not names", () => {
  for (const n of ["call 5551234567", "me@home.com", "www.fish.com", "bob.net", "https://x.y", "12345 Fisher"]) {
    assert.equal(safeName(n, FALLBACK), FALLBACK, n);
  }
  assert.equal(safeName("Dave 42", FALLBACK), "Dave 42");
});

test("odd characters are stripped, short names fall back, long ones are cut", () => {
  assert.equal(safeName("  <b>Bo</b>\n b  ", FALLBACK), "bBob b");
  assert.equal(safeName("x", FALLBACK), FALLBACK);
  assert.equal(safeName(42, FALLBACK), FALLBACK);
  assert.equal(safeName("A".repeat(60), FALLBACK).length, 20);
  assert.equal(safeName("🎣🎣🎣", FALLBACK), FALLBACK);
});

test("squash undoes the usual tricks", () => {
  assert.equal(squash("F.U-C k"), "fuck");
  assert.equal(squash("sh1t"), "shit");
  assert.equal(squash("heeeello"), "heello");
});

test("nameProblem speaks plainly to the player and stays quiet when all is well", () => {
  assert.equal(nameProblem(""), null);
  assert.equal(nameProblem("Casey"), null);
  assert.match(String(nameProblem("a")), /two letters/);
  assert.match(String(nameProblem("fuck")), /friendly/);
});
