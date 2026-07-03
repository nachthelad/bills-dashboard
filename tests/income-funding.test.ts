import assert from "node:assert/strict";
import test from "node:test";

import {
  IncomeFundingError,
  assertForeignBalance,
  parseConversionInput,
  parseIncomeSourceInput,
} from "../lib/server/income-funding";

test("conversion input calculates ARS with the effective rate", () => {
  assert.deepEqual(
    parseConversionInput({
      fromCurrency: "USDT",
      fromAmount: 800,
      suggestedRateSource: "binance_p2p",
      suggestedRate: 1485,
      usedRate: 1472,
      note: "Cotización acordada",
    }),
    {
      fromCurrency: "USDT",
      fromAmount: 800,
      suggestedRateSource: "binance_p2p",
      suggestedRate: 1485,
      usedRate: 1472,
      arsReceived: 1_177_600,
      relatedIncomeSourceId: null,
      note: "Cotización acordada",
    }
  );
});

test("conversion rejects amounts above the available currency balance", () => {
  assert.throws(
    () => assertForeignBalance({ USD: 100, USDT: 50 }, "USD", 100.01),
    IncomeFundingError
  );
  assert.doesNotThrow(() =>
    assertForeignBalance({ USD: 100, USDT: 50 }, "USD", 100)
  );
});

test("income sources accept USDT and zero expected amount for variable income", () => {
  assert.deepEqual(
    parseIncomeSourceInput({
      name: "Comisiones",
      currency: "USDT",
      expectedAmount: 0,
      isVariable: true,
      isActive: true,
    }),
    {
      name: "Comisiones",
      currency: "USDT",
      expectedAmount: 0,
      isVariable: true,
      isActive: true,
    }
  );
});

test("income sources accept pasted Argentine expected amounts", () => {
  assert.deepEqual(
    parseIncomeSourceInput({
      name: "Honorarios",
      currency: "ARS",
      expectedAmount: "900.000,2",
      isVariable: false,
      isActive: true,
    }),
    {
      name: "Honorarios",
      currency: "ARS",
      expectedAmount: 900_000.2,
      isVariable: false,
      isActive: true,
    }
  );
});
