import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMonthlyBudget,
  calculateCashFunding,
  calculateDirectArsIncome,
  calculateForeignBalances,
  calculateSavingsAmount,
  dedupeSpendingLimits,
  fixedExpenseSourceMatches,
  getLimitSummary,
  getMonthTiming,
  isFixedExpenseActive,
  resolveFixedExpenseAmount,
  resolveCashBudgetStatus,
  type FixedExpense,
} from "../lib/budget";

test("reserves a percentage and calculates the daily budget in cents", () => {
  const result = calculateMonthlyBudget({
    expectedIncome: 2_184_000,
    savingsMode: "percentage",
    savingsValue: 20,
    fixedExpenses: 484_000,
    committedInstallments: 344_611,
    variableSpent: 0,
    daysRemaining: 22,
    daysInMonth: 31,
    elapsedDays: 9,
  });

  assert.equal(result.savingsReserved, 436_800);
  assert.equal(result.available, 918_589);
  assert.equal(result.dailyAvailable, 41_754.04);
  assert.equal(result.status, "good");
});

test("supports a fixed savings goal", () => {
  assert.equal(calculateSavingsAmount(1_000_000, "fixed", 275_000), 275_000);
});

test("marks the month tight when variable spending is ahead of pace", () => {
  const result = calculateMonthlyBudget({
    expectedIncome: 1_000,
    savingsMode: "fixed",
    savingsValue: 100,
    fixedExpenses: 200,
    committedInstallments: 100,
    variableSpent: 400,
    daysRemaining: 21,
    daysInMonth: 30,
    elapsedDays: 9,
  });
  assert.equal(result.status, "tight");
});

test("over and incomplete states take the intended precedence", () => {
  const base = {
    expectedIncome: 1_000,
    savingsMode: "fixed" as const,
    savingsValue: 100,
    fixedExpenses: 500,
    committedInstallments: 500,
    variableSpent: 1,
    daysRemaining: 10,
    daysInMonth: 30,
    elapsedDays: 20,
  };
  assert.equal(calculateMonthlyBudget(base).status, "over");
  assert.equal(
    calculateMonthlyBudget({ ...base, incomplete: true }).status,
    "incomplete"
  );
});

test("paid fixed expenses replace estimates instead of adding to them", () => {
  assert.equal(
    resolveFixedExpenseAmount(
      { estimatedAmount: 10_000 },
      { status: "paid", actualAmount: 12_500 }
    ),
    12_500
  );
  assert.equal(
    resolveFixedExpenseAmount(
      { estimatedAmount: 10_000 },
      { status: "pending", actualAmount: null }
    ),
    10_000
  );
});

test("a detected invoice amount replaces the estimate without marking it paid", () => {
  assert.equal(
    resolveFixedExpenseAmount(
      { estimatedAmount: 10_000 },
      { status: "pending", actualAmount: 12_500 }
    ),
    12_500
  );
});

test("fixed expense document sources match normalized provider values", () => {
  assert.equal(
    fixedExpenseSourceMatches("Swiss Medical", [
      "swiss_medical",
      "Swiss Medical Group",
    ]),
    true
  );
  assert.equal(
    fixedExpenseSourceMatches("abl", ["abl_agip", "ABL / Inmobiliario"]),
    true
  );
  assert.equal(
    fixedExpenseSourceMatches("telecentro", ["Edesur", "Factura luz"]),
    false
  );
  assert.equal(
    fixedExpenseSourceMatches(["Agua", null, "Servicios"], [
      "aysa",
      "AySA",
      "water",
    ]),
    true
  );
  assert.equal(
    fixedExpenseSourceMatches(["Luz", null, "Servicios"], [
      "edesur",
      "Edesur",
      "electricity",
    ]),
    true
  );
  assert.equal(
    fixedExpenseSourceMatches(["Prepaga", null, "Servicios"], [
      "swiss_medical",
      "Swiss Medical",
      "health",
    ]),
    true
  );
});

test("cash funding separates real availability from monthly coverage", () => {
  const result = calculateCashFunding({
    openingArsBalance: 100_000,
    directArsIncome: 50_000,
    convertedArs: 1_000_000,
    fixedExpenses: 400_000,
    committedInstallments: 200_000,
    variableSpent: 100_000,
    variableCoverage: 300_000,
    arsBufferAmount: 100_000,
    daysRemaining: 10,
  });
  assert.deepEqual(result, {
    fundedArs: 1_150_000,
    available: 350_000,
    dailyAvailable: 35_000,
    coverageTarget: 1_000_000,
    conversionNeededArs: 0,
  });
});

test("foreign balances keep USD and USDT separate", () => {
  assert.deepEqual(
    calculateForeignBalances(
      [
        { currency: "USD", amount: 650 },
        { currency: "USDT", amount: 800 },
        { currency: "ARS", amount: 10_000 },
      ],
      [
        {
          fromCurrency: "USD",
          fromAmount: 200,
        },
        {
          fromCurrency: "USDT",
          fromAmount: 300,
        },
      ]
    ),
    {
      received: { USD: 650, USDT: 800 },
      converted: { USD: 200, USDT: 300 },
      available: { USD: 450, USDT: 500 },
    }
  );
});

test("only ARS income increases direct peso funding", () => {
  assert.equal(
    calculateDirectArsIncome([
      { currency: "ARS", amount: 100_000 },
      { currency: "USD", amount: 650 },
      { currency: "USDT", amount: 800 },
    ]),
    100_000
  );
});

test("duplicate spending limits keep the most recently updated category", () => {
  assert.deepEqual(
    dedupeSpendingLimits([
      {
        category: "Comida comprada",
        limitAmount: 60_000,
        sourceId: "older",
        updatedAtMs: 100,
      },
      {
        category: "comida comprada",
        limitAmount: 75_000,
        sourceId: "newer",
        updatedAtMs: 200,
      },
      {
        category: "Transporte",
        limitAmount: 30_000,
        sourceId: "transport",
        updatedAtMs: 150,
      },
    ]),
    [
      { category: "comida comprada", limitAmount: 75_000 },
      { category: "Transporte", limitAmount: 30_000 },
    ]
  );
});

test("cash status distinguishes missing coverage from overspending", () => {
  const base = {
    incomplete: false,
    hasLimitExceeded: false,
    conversionNeededArs: 0,
    aheadOfPace: false,
    hasLimitWarning: false,
  };
  assert.equal(
    resolveCashBudgetStatus({ ...base, conversionNeededArs: 874_078 }),
    "unfunded"
  );
  assert.equal(
    resolveCashBudgetStatus({
      ...base,
      hasLimitExceeded: true,
      conversionNeededArs: 874_078,
    }),
    "over"
  );
  assert.equal(
    resolveCashBudgetStatus({ ...base, hasLimitWarning: true }),
    "tight"
  );
  assert.equal(
    resolveCashBudgetStatus({ ...base, incomplete: true }),
    "incomplete"
  );
  assert.equal(resolveCashBudgetStatus(base), "good");
});

test("fixed expense activity respects the configured month range", () => {
  const expense: FixedExpense = {
    id: "fixed-1",
    name: "Internet",
    category: "Servicios",
    estimatedAmount: 20_000,
    dueDay: 10,
    activeFrom: "2026-06",
    inactiveFrom: "2026-09",
    sourceType: "manual",
    sourceKey: null,
  };
  assert.equal(isFixedExpenseActive(expense, "2026-05"), false);
  assert.equal(isFixedExpenseActive(expense, "2026-07"), true);
  assert.equal(isFixedExpenseActive(expense, "2026-09"), false);
});

test("calculates category percentages at 80 and 100 percent", () => {
  const result = getLimitSummary(
    [
      { category: "Comida", limitAmount: 100 },
      { category: "Salidas", limitAmount: 200 },
    ],
    { Comida: 80, Salidas: 200 }
  );
  assert.deepEqual(
    result.map((item) => item.percentageUsed),
    [80, 100]
  );
});

test("Argentina month timing includes the current day", () => {
  const result = getMonthTiming(
    "2026-07",
    new Date("2026-07-10T15:00:00.000Z")
  );
  assert.equal(result.daysInMonth, 31);
  assert.equal(result.elapsedDays, 9);
  assert.equal(result.daysRemaining, 22);
});
