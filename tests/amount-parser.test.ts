import assert from "node:assert/strict";
import test from "node:test";

import { parseAmountInput } from "../lib/amount-parser";

test("parseAmountInput recognizes Argentine thousands and decimal separators", () => {
  assert.equal(parseAmountInput("18.160,06"), 18160.06);
  assert.equal(parseAmountInput("18160,06"), 18160.06);
  assert.equal(parseAmountInput("$ 18.160,06"), 18160.06);
  assert.equal(parseAmountInput("ARS 18.160,06"), 18160.06);
});

test("parseAmountInput keeps existing dot-decimal input working", () => {
  assert.equal(parseAmountInput("18160.06"), 18160.06);
  assert.equal(parseAmountInput(18160.06), 18160.06);
});
