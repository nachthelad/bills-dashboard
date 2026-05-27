import assert from "node:assert/strict";
import test from "node:test";

import { Timestamp } from "firebase-admin/firestore";

import { sortExpenseEntriesForDisplay } from "../lib/server/expense-sort";

test("sortExpenseEntriesForDisplay puts latest created entry first for the same expense date", () => {
  const sorted = sortExpenseEntriesForDisplay([
    {
      id: "morning",
      date: "2026-05-27T00:00:00.000Z",
      createdAt: "2026-05-27T12:00:00.000Z",
    },
    {
      id: "evening",
      date: "2026-05-27T00:00:00.000Z",
      createdAt: "2026-05-27T22:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["evening", "morning"]
  );
});

test("sortExpenseEntriesForDisplay keeps expense date as the primary sort", () => {
  const sorted = sortExpenseEntriesForDisplay([
    {
      id: "older-expense-created-later",
      date: "2026-05-26T00:00:00.000Z",
      createdAt: "2026-05-28T22:00:00.000Z",
    },
    {
      id: "newer-expense-created-earlier",
      date: "2026-05-27T00:00:00.000Z",
      createdAt: "2026-05-27T09:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["newer-expense-created-earlier", "older-expense-created-later"]
  );
});

test("sortExpenseEntriesForDisplay handles missing createdAt and uses id as stable fallback", () => {
  const sorted = sortExpenseEntriesForDisplay([
    {
      id: "b-legacy",
      date: Timestamp.fromDate(new Date("2026-05-27T00:00:00.000Z")),
    },
    {
      id: "new-entry",
      date: Timestamp.fromDate(new Date("2026-05-27T00:00:00.000Z")),
      createdAt: Timestamp.fromDate(new Date("2026-05-27T22:00:00.000Z")),
    },
    {
      id: "a-legacy",
      date: Timestamp.fromDate(new Date("2026-05-27T00:00:00.000Z")),
    },
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["new-entry", "a-legacy", "b-legacy"]
  );
});
