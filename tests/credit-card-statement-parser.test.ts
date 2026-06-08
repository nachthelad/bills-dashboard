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

test("parseCreditCardStatement recognizes ARS activity blocks", () => {
  const result = parseCreditCardStatement(`03/05/2026
Visa 0393
FARMACITY
$ 12.345,67`);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(toPurchaseSummary(result.purchases), [
    {
      purchaseDate: "2026-05-03",
      name: "FARMACITY",
      installmentAmount: 12345.67,
      totalAmount: 12345.67,
      currency: "ARS",
      installments: 1,
      currentInstallment: 1,
    },
  ]);
});

test("parseCreditCardStatement recognizes USD activity blocks", () => {
  const result = parseCreditCardStatement(`04/05/2026
Visa 0393
NETFLIX
USD 9,99`);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(toPurchaseSummary(result.purchases), [
    {
      purchaseDate: "2026-05-04",
      name: "NETFLIX",
      installmentAmount: 9.99,
      totalAmount: 9.99,
      currency: "USD",
      installments: 1,
      currentInstallment: 1,
    },
  ]);
});

test("parseCreditCardStatement recognizes recent bank activity paste", () => {
  const result = parseCreditCardStatement(`04/06/2026

Visa 0393

GOOGLE *Google O P1lI4MWo



USD 4,99

04/06/2026

Visa 0393

MERPAGO*CARREFOUR


$ 13.800


03/06/2026

Visa 0393

MERPAGO*CARREFOUR


$ 29.425,30`);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(toPurchaseSummary(result.purchases), [
    {
      purchaseDate: "2026-06-04",
      name: "GOOGLE *Google O P1lI4MWo",
      installmentAmount: 4.99,
      totalAmount: 4.99,
      currency: "USD",
      installments: 1,
      currentInstallment: 1,
    },
    {
      purchaseDate: "2026-06-04",
      name: "MERPAGO*CARREFOUR",
      installmentAmount: 13800,
      totalAmount: 13800,
      currency: "ARS",
      installments: 1,
      currentInstallment: 1,
    },
    {
      purchaseDate: "2026-06-03",
      name: "MERPAGO*CARREFOUR",
      installmentAmount: 29425.3,
      totalAmount: 29425.3,
      currency: "ARS",
      installments: 1,
      currentInstallment: 1,
    },
  ]);
});

test("parseCreditCardStatement joins multiline merchant blocks", () => {
  const result = parseCreditCardStatement(`05/05/2026
Visa 0393
SUPERMERCADO
COTO SUCURSAL 123
ARS 1.234,50`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.purchases[0].name, "SUPERMERCADO COTO SUCURSAL 123");
  assert.equal(result.purchases[0].installmentAmount, 1234.5);
});

test("parseCreditCardStatement recognizes block installments", () => {
  const result = parseCreditCardStatement(`06/05/2026
Visa 0393
MERCADO PAGO
02/03
$ 10.000,00`);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(toPurchaseSummary(result.purchases), [
    {
      purchaseDate: "2026-05-06",
      name: "MERCADO PAGO",
      installmentAmount: 10000,
      totalAmount: 30000,
      currency: "ARS",
      installments: 3,
      currentInstallment: 2,
    },
  ]);
});

test("parseCreditCardStatement accepts mixed legacy lines and activity blocks", () => {
  const result = parseCreditCardStatement(`01-05-26 K GOOGLE *YouTubeP P1kPjZr3 USD 4,97 238534 4,97
07/05/2026
Visa 0393
VERDULERIA BARRIO
$ 2.500,00
02-05-26 K SUBE VIAJES - BUSES 608711 839,86`);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.purchases.map((purchase) => purchase.name),
    [
      "GOOGLE *YouTubeP P1kPjZr3",
      "VERDULERIA BARRIO",
      "SUBE VIAJES - BUSES",
    ]
  );
});

test("parseCreditCardStatement reports one block error for invalid block amounts", () => {
  const result = parseCreditCardStatement(`08/05/2026
Visa 0393
COMERCIO
$ ABC`);

  assert.equal(result.purchases.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].lineNumber, 4);
  assert.equal(result.errors[0].sourceLine, "$ ABC");
  assert.equal(result.errors[0].message, "El importe debe ser mayor a cero.");
});

test("parseCreditCardStatement rejects invalid block dates", () => {
  const result = parseCreditCardStatement(`31/02/2026
Visa 0393
COMERCIO
$ 100,00`);

  assert.equal(result.purchases.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].lineNumber, 1);
  assert.equal(result.errors[0].message, "La fecha no es válida.");
});

function toPurchaseSummary(
  purchases: ReturnType<typeof parseCreditCardStatement>["purchases"]
) {
  return purchases.map((purchase) => ({
    purchaseDate: purchase.purchaseDate,
    name: purchase.name,
    installmentAmount: purchase.installmentAmount,
    totalAmount: purchase.totalAmount,
    currency: purchase.currency,
    installments: purchase.installments,
    currentInstallment: purchase.currentInstallment,
  }));
}
