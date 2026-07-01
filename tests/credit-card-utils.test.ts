import assert from "node:assert/strict";
import test from "node:test";

import {
  addMonthsToPeriodMonth,
  getFirstPeriodMonthFromPurchaseDate,
  groupInstallmentsByPeriod,
  getNextRecurringOccurrenceDate,
  getRecurringOccurrenceDate,
  projectRecurringExpenseCharges,
  projectPurchaseInstallments,
  resolveFirstPeriodMonth,
  splitAmountIntoInstallments,
  suggestNextCycle,
  type CreditCardCycle,
  type CreditCardPurchase,
  type CreditCardRecurringExpense,
} from "../lib/credit-card-utils";

test("splitAmountIntoInstallments keeps cents exact and puts remainder in last installment", () => {
  assert.deepEqual(splitAmountIntoInstallments(100, 3), [33.33, 33.33, 33.34]);
  assert.equal(
    splitAmountIntoInstallments(10.01, 4).reduce(
      (total, installment) => total + installment,
      0
    ),
    10.01
  );
});

test("addMonthsToPeriodMonth crosses the year boundary", () => {
  assert.equal(addMonthsToPeriodMonth("2026-12", 1), "2027-01");
  assert.equal(addMonthsToPeriodMonth("2026-12", 3), "2027-03");
});

test("purchase month projects the first due period into the following month", () => {
  const firstPeriodMonth = getFirstPeriodMonthFromPurchaseDate("2026-06-18");
  const installments = projectPurchaseInstallments(
    makePurchase({ firstPeriodMonth, installments: 6 })
  );

  assert.equal(firstPeriodMonth, "2026-07");
  assert.equal(installments.at(-1)?.periodMonth, "2026-12");
});

test("resolveFirstPeriodMonth moves purchases after closing into the next statement", () => {
  const cycles = [
    makeCycle({
      id: "visa_2026-06",
      periodMonth: "2026-06",
      closingDate: "2026-05-28",
      dueDate: "2026-06-07",
    }),
    makeCycle({
      id: "visa_2026-07",
      periodMonth: "2026-07",
      closingDate: "2026-06-28",
      dueDate: "2026-07-07",
    }),
  ];

  assert.equal(resolveFirstPeriodMonth("2026-05-27", cycles), "2026-06");
  assert.equal(resolveFirstPeriodMonth("2026-05-28", cycles), "2026-07");
  assert.equal(resolveFirstPeriodMonth("2026-05-30", cycles), "2026-07");
});

test("resolveFirstPeriodMonth infers the next statement when the purchase matches the latest closing date", () => {
  const cycles = [
    makeCycle({
      id: "visa_2026-03",
      periodMonth: "2026-03",
      closingDate: "2026-02-26",
      dueDate: "2026-03-07",
    }),
  ];

  assert.equal(resolveFirstPeriodMonth("2026-02-25", cycles), "2026-03");
  assert.equal(resolveFirstPeriodMonth("2026-02-26", cycles), "2026-04");
});

test("projectPurchaseInstallments extends until the final installment", () => {
  const installments = projectPurchaseInstallments(
    makePurchase({
      totalAmount: 600,
      installments: 6,
      firstPeriodMonth: "2026-10",
    })
  );

  assert.deepEqual(
    installments.map((installment) => installment.periodMonth),
    ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]
  );
  assert.ok(
    installments.every(
      (installment) => installment.purchaseDate === "2026-06-01"
    )
  );
  assert.equal(installments.at(-1)?.installmentNumber, 6);
});

test("groupInstallmentsByPeriod keeps ARS and USD subtotals separate", () => {
  const projections = groupInstallmentsByPeriod(
    [
      makePurchase({ id: "ars", totalAmount: 1200, installments: 2 }),
      makePurchase({
        id: "usd",
        totalAmount: 30,
        currency: "USD",
        installments: 3,
      }),
    ],
    []
  );

  assert.deepEqual(projections[0].totals, { ARS: 600, USD: 10 });
  assert.deepEqual(projections[1].totals, { ARS: 600, USD: 10 });
  assert.deepEqual(projections[2].totals, { ARS: 0, USD: 10 });
});

test("groupInstallmentsByPeriod attaches a confirmed cycle identified by due month", () => {
  const cycle = makeCycle({
    periodMonth: "2026-07",
    closingDate: "2026-06-28",
    dueDate: "2026-07-07",
  });
  const projections = groupInstallmentsByPeriod(
    [makePurchase({ firstPeriodMonth: "2026-07" })],
    [cycle]
  );

  assert.equal(projections[0].cycle?.id, cycle.id);
  assert.equal(projections[0].cycle?.periodMonth, "2026-07");
});

test("groupInstallmentsByPeriod lists carried installments first and keeps date order within each block", () => {
  const projections = groupInstallmentsByPeriod(
    [
      makePurchase({
        id: "single",
        purchaseDate: "2026-06-02",
        firstPeriodMonth: "2026-07",
      }),
      makePurchase({
        id: "new-installments",
        purchaseDate: "2026-06-01",
        installments: 3,
        firstPeriodMonth: "2026-07",
      }),
      makePurchase({
        id: "older-carried",
        purchaseDate: "2026-04-10",
        installments: 4,
        firstPeriodMonth: "2026-05",
      }),
      makePurchase({
        id: "newer-carried",
        purchaseDate: "2026-05-12",
        installments: 3,
        firstPeriodMonth: "2026-06",
      }),
    ],
    []
  );

  const julyProjection = projections.find(
    (projection) => projection.periodMonth === "2026-07"
  );

  assert.deepEqual(
    julyProjection?.installments
      .filter((installment) => installment.kind === "installment")
      .map((installment) => installment.purchaseId),
    ["older-carried", "newer-carried", "new-installments", "single"]
  );
});

test("suggestNextCycle clamps dates for shorter months", () => {
  assert.deepEqual(
    suggestNextCycle(
      makeCycle({
        periodMonth: "2026-02",
        closingDate: "2026-01-31",
        dueDate: "2026-02-05",
      })
    ),
    {
      periodMonth: "2026-03",
      closingDate: "2026-02-28",
      dueDate: "2026-03-05",
    }
  );
});

test("recurring occurrence keeps its anchor day after shorter months", () => {
  assert.deepEqual(
    [0, 1, 2].map((offset) =>
      getRecurringOccurrenceDate("2026-01-31", 31, offset)
    ),
    ["2026-01-31", "2026-02-28", "2026-03-31"]
  );
});

test("next recurring occurrence is strictly after today", () => {
  assert.equal(
    getNextRecurringOccurrenceDate(makeRecurringExpense(), "2026-06-30"),
    "2026-07-30"
  );
});

test("recurring projections span the current period and next eleven months", () => {
  const charges = projectRecurringExpenseCharges(
    makeRecurringExpense({
      startDate: "2026-06-15",
      anchorDay: 15,
      versions: [
        {
          effectiveFrom: "2026-06-15",
          name: "Netflix",
          monthlyAmount: 100,
          currency: "ARS",
        },
      ],
    }),
    [],
    "2026-06-01"
  );

  assert.equal(charges.length, 11);
  assert.equal(charges[0].periodMonth, "2026-07");
  assert.equal(charges.at(-1)?.periodMonth, "2027-05");
});

test("recurring versions preserve old amounts and apply changes forward", () => {
  const projections = groupInstallmentsByPeriod(
    [],
    [],
    [
      makeRecurringExpense({
        startDate: "2026-05-10",
        anchorDay: 10,
        versions: [
          {
            effectiveFrom: "2026-05-10",
            name: "Netflix",
            monthlyAmount: 100,
            currency: "ARS",
          },
          {
            effectiveFrom: "2026-07-10",
            name: "Netflix",
            monthlyAmount: 150,
            currency: "ARS",
          },
        ],
      }),
    ],
    "2026-06-01"
  );

  assert.equal(
    projections.find((projection) => projection.periodMonth === "2026-06")
      ?.totals.ARS,
    100
  );
  assert.equal(
    projections.find((projection) => projection.periodMonth === "2026-08")
      ?.totals.ARS,
    150
  );
});

test("ending a recurrence keeps charges through the end date", () => {
  const charges = projectRecurringExpenseCharges(
    makeRecurringExpense({ endDate: "2026-07-30" }),
    [],
    "2026-06-01"
  );

  assert.deepEqual(
    charges.map((charge) => charge.purchaseDate),
    ["2026-06-30", "2026-07-30"]
  );
});

function makePurchase(
  overrides: Partial<CreditCardPurchase> = {}
): CreditCardPurchase {
  return {
    id: "purchase",
    cardId: "visa",
    name: "Compra",
    purchaseDate: "2026-06-01",
    totalAmount: 100,
    currency: "ARS",
    installments: 1,
    firstPeriodMonth: "2026-06",
    ...overrides,
  };
}

function makeCycle(overrides: Partial<CreditCardCycle> = {}): CreditCardCycle {
  return {
    id: "visa_2026-06",
    cardId: "visa",
    periodMonth: "2026-06",
    closingDate: "2026-05-28",
    dueDate: "2026-06-07",
    ...overrides,
  };
}

function makeRecurringExpense(
  overrides: Partial<CreditCardRecurringExpense> = {}
): CreditCardRecurringExpense {
  return {
    id: "recurring",
    cardId: "visa",
    startDate: "2026-06-30",
    anchorDay: 30,
    endDate: null,
    versions: [
      {
        effectiveFrom: "2026-06-30",
        name: "Netflix",
        monthlyAmount: 100,
        currency: "ARS",
      },
    ],
    ...overrides,
  };
}
