import assert from "node:assert/strict";
import test from "node:test";

import { parseCreditCardStatement } from "../lib/credit-card-statement-parser";

const SAMPLE_STATEMENT = `01-05-26 K GOOGLE *YouTubeP P1kPjZr3 USD 4,97 238534 4,97
01-05-26 GOOGLE *CLOUD 8z P1kQPFt2 USD 1,89 998716 1,89
02-05-26 * MERPAGO*OPTIMED 01/03 784045 86.666,68
02-05-26 K SUBE VIAJES - BUSES 608711 839,86
02-05-26 K PAYU*AR*UBER 000024 10.824,00`;

test("parseCreditCardStatement recognizes statement lines", () => {
  const result = parseCreditCardStatement(SAMPLE_STATEMENT);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.purchases.map((purchase) => ({
      purchaseDate: purchase.purchaseDate,
      name: purchase.name,
      installmentAmount: purchase.installmentAmount,
      totalAmount: purchase.totalAmount,
      currency: purchase.currency,
      installments: purchase.installments,
      currentInstallment: purchase.currentInstallment,
    })),
    [
      {
        purchaseDate: "2026-05-01",
        name: "GOOGLE *YouTubeP P1kPjZr3",
        installmentAmount: 4.97,
        totalAmount: 4.97,
        currency: "USD",
        installments: 1,
        currentInstallment: 1,
      },
      {
        purchaseDate: "2026-05-01",
        name: "GOOGLE *CLOUD 8z P1kQPFt2",
        installmentAmount: 1.89,
        totalAmount: 1.89,
        currency: "USD",
        installments: 1,
        currentInstallment: 1,
      },
      {
        purchaseDate: "2026-05-02",
        name: "MERPAGO*OPTIMED",
        installmentAmount: 86666.68,
        totalAmount: 260000.04,
        currency: "ARS",
        installments: 3,
        currentInstallment: 1,
      },
      {
        purchaseDate: "2026-05-02",
        name: "SUBE VIAJES - BUSES",
        installmentAmount: 839.86,
        totalAmount: 839.86,
        currency: "ARS",
        installments: 1,
        currentInstallment: 1,
      },
      {
        purchaseDate: "2026-05-02",
        name: "PAYU*AR*UBER",
        installmentAmount: 10824,
        totalAmount: 10824,
        currency: "ARS",
        installments: 1,
        currentInstallment: 1,
      },
    ]
  );
});

test("parseCreditCardStatement keeps invalid lines out of the import", () => {
  const result = parseCreditCardStatement("02-05-26 COMPRA SIN IMPORTE");

  assert.equal(result.purchases.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].lineNumber, 1);
});

test("parseCreditCardStatement preserves the installment shown in the statement", () => {
  const result = parseCreditCardStatement(
    "02-05-26 * MERPAGO*OPTIMED 02/03 784045 86.666,68"
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.purchases[0].currentInstallment, 2);
  assert.equal(result.purchases[0].installments, 3);
  assert.equal(result.purchases[0].installmentAmount, 86666.68);
  assert.equal(result.purchases[0].totalAmount, 260000.04);
});
