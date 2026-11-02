import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDataDir } from "./db-config.ts";

test("nothing set keeps the in-memory default; blank counts as unset", () => {
  assert.equal(pgliteDataDir({}), undefined);
  assert.equal(pgliteDataDir({ FAC_DATA_DIR: "   " }), undefined);
});

test("FAC_DATA_DIR selects a persistent folder", () => {
  assert.equal(pgliteDataDir({ FAC_DATA_DIR: " /data/fac " }), "/data/fac");
});

test("PGLite persisted to the folder survives a restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fac-data-"));
  try {
    const a = new PGlite(pgliteDataDir({ FAC_DATA_DIR: dir }));
    await a.exec("create table t (n int); insert into t values (42)");
    await a.close();
    const b = new PGlite(dir);
    const rows = await b.query<{ n: number }>("select n from t");
    assert.equal(rows.rows[0].n, 42);
    await b.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
