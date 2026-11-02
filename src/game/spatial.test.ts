import assert from "node:assert/strict";
import { test } from "node:test";
import { pickNeighbor, type Rect } from "./spatial.ts";

const box = (left: number, top: number, w = 100, h = 40): Rect => ({ left, top, right: left + w, bottom: top + h });

test("a column of rows: down goes to the next row, up to the one above", () => {
  const rows = [box(0, 0), box(0, 50), box(0, 100)];
  assert.equal(pickNeighbor(rows[0], [rows[1], rows[2]], "down"), 0);
  assert.equal(pickNeighbor(rows[1], [rows[0], rows[2]], "down"), 1);
  assert.equal(pickNeighbor(rows[1], [rows[0], rows[2]], "up"), 0);
  assert.equal(pickNeighbor(rows[0], [rows[1], rows[2]], "up"), -1, "nothing above the first");
});

test("a grid: right and down stay on their line", () => {
  const g = [box(0, 0), box(110, 0), box(220, 0), box(0, 50), box(110, 50), box(220, 50)];
  const from = g[1];
  const others = g.filter((_, i) => i !== 1);
  assert.equal(others[pickNeighbor(from, others, "right")], g[2]);
  assert.equal(others[pickNeighbor(from, others, "left")], g[0]);
  assert.equal(others[pickNeighbor(from, others, "down")], g[4]);
});

test("from the list into the detail panel on its right, and back", () => {
  const list = [box(0, 0, 240), box(0, 50, 240)];
  const panel = [box(300, 20, 400, 300), box(300, 340, 120)];
  assert.equal(pickNeighbor(list[1], panel, "right"), 0);
  assert.equal(pickNeighbor(panel[0], list, "left"), 0, "back to the row level with it");
  assert.equal(pickNeighbor(list[0], panel, "left"), -1, "nothing left of the list: the caller switches tab");
});

test("it prefers the one lined up over a nearer one off to the side", () => {
  const from = box(0, 0);
  const lined = box(0, 120);
  const near = box(300, 45);
  assert.equal(pickNeighbor(from, [near, lined], "down"), 1);
});
