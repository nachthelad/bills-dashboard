import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_EXPENSE_BATCH_SIZE,
  normalizeExpenseBatch,
} from "../lib/server/expense-batch";

test("normalizeExpenseBatch accepts multiple ARS and USD expenses", () => {
  const result = normalizeExpenseBatch({
    date: "2026-07-01T03:00:00.000Z",
    entries: [
      {
        description: " Supermercado ",
        amount: "18.160,06",
        currency: "ARS",
        category: "Compra",
      },
      {
        description: "Hosting",
        amount: "10,50",
        currency: "USD",
        arsRate: "1.450,25",
        category: "Servicios",
      },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entries[0].description, "Supermercado");
  assert.equal(result.entries[0].amount, 18160.06);
  assert.equal(result.entries[0].paymentMethod, "Débito");
  assert.equal(result.entries[1].amount, 10.5);
  assert.equal(result.entries[1].arsRate, 1450.25);
});

test("normalizeExpenseBatch rejects the complete batch when one entry is invalid", () => {
  const result = normalizeExpenseBatch({
    date: "2026-07-01T03:00:00.000Z",
    entries: [
      {
        description: "Compra",
        amount: "1.000",
        currency: "ARS",
        category: "Compra",
      },
      {
        description: "",
        amount: "500",
        currency: "ARS",
        category: "Compra",
      },
    ],
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Completá la descripción del gasto 2",
  });
});

test("normalizeExpenseBatch requires a positive USD rate", () => {
  const result = normalizeExpenseBatch({
    date: "2026-07-01T03:00:00.000Z",
    entries: [
      {
        description: "Hosting",
        amount: "10",
        currency: "USD",
        arsRate: "",
        category: "Servicios",
      },
    ],
  });

  assert.deepEqual(result, {
    ok: false,
    error: "La cotización del gasto 1 no es válida",
  });
});

test("normalizeExpenseBatch enforces its maximum size", () => {
  const entry = {
    description: "Compra",
    amount: "100",
    currency: "ARS",
    category: "Compra",
  };
  const result = normalizeExpenseBatch({
    date: "2026-07-01T03:00:00.000Z",
    entries: Array.from({ length: MAX_EXPENSE_BATCH_SIZE + 1 }, () => entry),
  });

  assert.deepEqual(result, {
    ok: false,
    error: `No se pueden guardar más de ${MAX_EXPENSE_BATCH_SIZE} gastos por vez`,
  });
});
