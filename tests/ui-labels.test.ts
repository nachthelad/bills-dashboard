import assert from "node:assert/strict";
import test from "node:test";

import {
  getDocumentStatusLabel,
  getHoaDifferenceStatusLabel,
  getIncomeSourceLabel,
} from "../lib/ui-labels";
import { getCategoryLabel } from "../src/config/billing/categories";

test("traduce estados de documentos sin modificar valores desconocidos", () => {
  assert.equal(getDocumentStatusLabel("pending"), "Pendiente");
  assert.equal(getDocumentStatusLabel("parsing"), "Procesando");
  assert.equal(getDocumentStatusLabel("needs_review"), "Requiere revisión");
  assert.equal(getDocumentStatusLabel("custom"), "custom");
});

test("traduce categorías predefinidas", () => {
  assert.equal(getCategoryLabel("electricity"), "Electricidad");
  assert.equal(getCategoryLabel("credit_card"), "Tarjeta de crédito");
  assert.equal(getCategoryLabel("daily_expenses"), "Gastos Diarios");
  assert.equal(getCategoryLabel("unknown"), "Otros");
});

test("traduce fuentes de ingresos sin alterar fuentes personalizadas", () => {
  assert.equal(getIncomeSourceLabel("Salary"), "Salario");
  assert.equal(getIncomeSourceLabel("Investments"), "Inversiones");
  assert.equal(getIncomeSourceLabel("Proveedor propio"), "Proveedor propio");
});

test("traduce estados de comparación de expensas", () => {
  assert.equal(getHoaDifferenceStatusLabel("new"), "Nuevo");
  assert.equal(getHoaDifferenceStatusLabel("decreased"), "Disminuido");
  assert.equal(getHoaDifferenceStatusLabel("unknown"), "Sin cambios");
});
