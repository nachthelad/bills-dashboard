import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyExpenseRow,
  createInheritedExpenseRow,
  isExpenseDraftRowBlank,
} from "../lib/expense-form";

test("an untouched row is blank even when it inherits a USD rate", () => {
  const row = createEmptyExpenseRow({
    currency: "USD",
    arsRate: "1450",
    category: "Servicios",
  });

  assert.equal(isExpenseDraftRowBlank(row), true);
});

test("a row becomes populated when description or amount is entered", () => {
  assert.equal(
    isExpenseDraftRowBlank(
      createEmptyExpenseRow({ description: "Supermercado" })
    ),
    false
  );
  assert.equal(
    isExpenseDraftRowBlank(createEmptyExpenseRow({ amount: "10.000" })),
    false
  );
});

test("a new row inherits currency and category but clears expense data", () => {
  const next = createInheritedExpenseRow(
    createEmptyExpenseRow({
      description: "Hosting",
      amount: "10",
      currency: "USD",
      arsRate: "1450",
      category: "Servicios",
    })
  );

  assert.deepEqual(next, {
    description: "",
    amount: "",
    currency: "USD",
    arsRate: "1450",
    paymentMethod: "Débito",
    category: "Servicios",
  });
});
