import assert from "node:assert/strict";
import test from "node:test";

import {
  BudgetDataError,
  parseFixedExpenseInput,
  parseFixedExpensePeriodInput,
  parseOpeningArsBalance,
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
      fundingMode: "planned",
      arsBufferAmount: 0,
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

test("budget inputs accept pasted Argentine amounts", () => {
  assert.deepEqual(
    parsePreferencesInput({
      expectedIncome: "900.000,2",
      savingsMode: "fixed",
      savingsValue: "100.000,5",
      arsBufferAmount: "20.000,25",
    }),
    {
      expectedIncome: 900_000.2,
      savingsMode: "fixed",
      savingsValue: 100_000.5,
      fundingMode: "planned",
      arsBufferAmount: 20_000.25,
    }
  );

  assert.deepEqual(
    parseSpendingLimitsInput({
      limits: [{ category: "Comida", limitAmount: "150.000,2" }],
    }),
    [{ category: "Comida", limitAmount: 150_000.2 }]
  );
  assert.equal(parseOpeningArsBalance("900.000,2"), 900_000.2);
  assert.equal(parseOpeningArsBalance(""), null);
  assert.equal(parseOpeningArsBalance(0), 0);
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

test("fixed expenses accept Argentine amounts and validate due-day boundaries", () => {
  const base = {
    name: "Internet",
    category: "Servicios",
    estimatedAmount: "90.000,2",
  };

  assert.equal(
    parseFixedExpenseInput({ ...base, dueDay: "" }, "2026-07").dueDay,
    null
  );
  assert.equal(
    parseFixedExpenseInput({ ...base, dueDay: "1" }, "2026-07").dueDay,
    1
  );
  assert.equal(
    parseFixedExpenseInput({ ...base, dueDay: "31" }, "2026-07").dueDay,
    31
  );
  assert.equal(
    parseFixedExpenseInput(base, "2026-07").estimatedAmount,
    90_000.2
  );

  for (const dueDay of ["0", "32", "1.5", "texto"]) {
    assert.throws(
      () => parseFixedExpenseInput({ ...base, dueDay }, "2026-07"),
      BudgetDataError
    );
  }
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
