import assert from "node:assert/strict";
import test from "node:test";

import { formatDate } from "../lib/utils";

test("formatDate keeps ISO day strings in local calendar time", () => {
  assert.equal(formatDate("2026-07-02"), "02-07-2026");
});
