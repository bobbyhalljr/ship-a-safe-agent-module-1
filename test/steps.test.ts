import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Every step folder runs and prints exactly its expected.txt.
for (const dir of readdirSync("steps").sort()) {
  test(`steps/${dir} matches expected output`, () => {
    const out = execFileSync("npx", ["tsx", join("steps", dir, "run.ts")], { encoding: "utf8" });
    assert.equal(out.trim(), readFileSync(join("steps", dir, "expected.txt"), "utf8").trim());
  });
}
