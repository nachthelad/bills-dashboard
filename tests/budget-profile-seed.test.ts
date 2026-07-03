import assert from "node:assert/strict";
import test from "node:test";

import { buildPersonalBudgetSeed } from "../lib/budget-profile-seed";

test("personal budget seed uses stable ids and complete presets", () => {
  const first = buildPersonalBudgetSeed("uid-1", "2026-07");
  const second = buildPersonalBudgetSeed("uid-1", "2026-07");
  assert.deepEqual(first, second);
  assert.equal(first.fixedExpenses.length, 9);
  assert.equal(first.limits.length, 9);
  assert.equal(first.incomeSources.length, 3);
  assert.equal(new Set(first.fixedExpenses.map((item) => item.id)).size, 9);
});
