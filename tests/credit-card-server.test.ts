import assert from "node:assert/strict";
import test from "node:test";

import {
  CreditCardDataError,
  parseCycleInput,
  parsePurchaseInput,
  parseRecurringExpenseInput,
  parseRecurringExpenseUpdateInput,
} from "../lib/server/credit-cards";

test("parseCycleInput accepts a closing date from the prior month", () => {
  assert.deepEqual(
    parseCycleInput({
      cardId: "visa",
      periodMonth: "2026-07",
      closingDate: "2026-06-28",
      dueDate: "2026-07-07",
    }),
    {
      cardId: "visa",
      periodMonth: "2026-07",
      closingDate: "2026-06-28",
      dueDate: "2026-07-07",
    }
  );
});

test("parseCycleInput requires the period to match the due date month", () => {
  assert.throws(
    () =>
      parseCycleInput({
        cardId: "visa",
        periodMonth: "2026-06",
        closingDate: "2026-06-28",
        dueDate: "2026-07-07",
      }),
    (error) =>
      error instanceof CreditCardDataError &&
      error.message ===
        "El mes del período debe coincidir con el mes del vencimiento"
  );
});

test("parsePurchaseInput requires a positive integer installment count", () => {
  assert.throws(
    () =>
      parsePurchaseInput({
        cardId: "visa",
        name: "Compra",
        purchaseDate: "2026-06-01",
        totalAmount: 100,
        currency: "ARS",
        installments: 1.5,
      }),
    (error) =>
      error instanceof CreditCardDataError &&
      error.message ===
        "La cantidad de cuotas debe ser un número entero mayor que cero"
  );
});

test("parsePurchaseInput derives the first period from a historical purchase month", () => {
  assert.equal(
    parsePurchaseInput({
      cardId: "visa",
      name: "Compra anterior",
      purchaseDate: "2026-01-12",
      totalAmount: 1200,
      currency: "ARS",
      installments: 12,
    }).firstPeriodMonth,
    "2026-02"
  );
});

test("parsePurchaseInput accepts Argentine formatted purchase amounts", () => {
  assert.equal(
    parsePurchaseInput({
      cardId: "visa",
      name: "Compra resumen",
      purchaseDate: "2026-06-01",
      totalAmount: "18.160,06",
      currency: "ARS",
      installments: 1,
    }).totalAmount,
    18160.06
  );
});

test("parseRecurringExpenseInput stores the anchor day and Argentine amount", () => {
  assert.deepEqual(
    parseRecurringExpenseInput({
      cardId: "visa",
      name: "Netflix",
      startDate: "2026-01-31",
      monthlyAmount: "18.160,06",
      currency: "ARS",
    }),
    {
      cardId: "visa",
      startDate: "2026-01-31",
      anchorDay: 31,
      version: {
        effectiveFrom: "2026-01-31",
        name: "Netflix",
        monthlyAmount: 18160.06,
        currency: "ARS",
      },
    }
  );
});

test("parseRecurringExpenseUpdateInput rejects non-positive amounts", () => {
  assert.throws(
    () =>
      parseRecurringExpenseUpdateInput(
        { name: "Netflix", monthlyAmount: 0, currency: "ARS" },
        "2026-07-31"
      ),
    (error) =>
      error instanceof CreditCardDataError &&
      error.message === "El monto debe ser mayor que cero"
  );
});
