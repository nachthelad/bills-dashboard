import assert from "node:assert/strict";
import test from "node:test";

import {
  BudgetDataError,
  parseFixedExpenseInput,
  parseFixedExpensePeriodInput,
  parsePeriodMonth,
  parsePreferencesInput,
  parseSpendingLimitsInput,
} from "../lib/server/budget-data";

test("budget preferences accept fixed and percentage goals", () => {
  assert.deepEqual(
    parsePreferencesInput({
      expectedIncome: 1_000_000,
      savingsMode: "percentage",
      savingsValue: 20,
    }),
    {
      expectedIncome: 1_000_000,
      savingsMode: "percentage",
      savingsValue: 20,
    }
  );
});

test("budget preferences reject percentages above 100", () => {
  assert.throws(
    () =>
      parsePreferencesInput({
        expectedIncome: 1_000,
        savingsMode: "percentage",
        savingsValue: 101,
      }),
    BudgetDataError
  );
});

test("period validation rejects malformed months", () => {
  assert.equal(parsePeriodMonth("2026-07"), "2026-07");
  assert.throws(() => parsePeriodMonth("2026-7"), BudgetDataError);
  assert.throws(() => parsePeriodMonth("2026-13"), BudgetDataError);
});

test("fixed expenses validate due day and preserve source configuration", () => {
  assert.deepEqual(
    parseFixedExpenseInput(
      {
        name: "Internet",
        category: "Servicios",
        estimatedAmount: 20_000,
        dueDay: 10,
        sourceType: "document",
        sourceKey: "telecentro",
      },
      "2026-07"
    ),
    {
      name: "Internet",
      category: "Servicios",
      estimatedAmount: 20_000,
      dueDay: 10,
      activeFrom: "2026-07",
      inactiveFrom: null,
      sourceType: "document",
      sourceKey: "telecentro",
    }
  );
  assert.throws(
    () =>
      parseFixedExpenseInput(
        {
          name: "Internet",
          category: "Servicios",
          estimatedAmount: 20_000,
          dueDay: 32,
        },
        "2026-07"
      ),
    BudgetDataError
  );
});

test("paid fixed periods require the real amount", () => {
  assert.throws(
    () => parseFixedExpensePeriodInput({ status: "paid" }),
    BudgetDataError
  );
  assert.deepEqual(
    parseFixedExpensePeriodInput({
      status: "paid",
      actualAmount: 12_500,
      sourceType: "expense",
      sourceId: "expense-1",
    }),
    {
      status: "paid",
      actualAmount: 12_500,
      sourceType: "expense",
      sourceId: "expense-1",
    }
  );
});

test("spending limits reject duplicate categories", () => {
  assert.throws(
    () =>
      parseSpendingLimitsInput({
        limits: [
          { category: "Comida", limitAmount: 100 },
          { category: "comida", limitAmount: 200 },
        ],
      }),
    BudgetDataError
  );
});
