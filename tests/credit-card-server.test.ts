import assert from "node:assert/strict";
import test from "node:test";

import {
  CreditCardDataError,
  parseCycleInput,
  parsePurchaseInput,
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
      error.message === "Installments must be a positive integer"
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
