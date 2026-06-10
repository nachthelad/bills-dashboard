import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateHoaTotals,
  normalizeHoaDetails,
} from "../lib/server/hoa"

test("normalizeHoaDetails coerces rubro totals and builds period key", () => {
  const normalized = normalizeHoaDetails({
    buildingCode: "B1",
    unitCode: "2A",
    periodYear: "2024",
    periodMonth: "3",
    periodLabel: "03/2024",
    totalToPayUnit: "2500.55",
    rubros: [
      {
        rubroNumber: "1",
        label: "Gastos",
        total: "1500.10",
        items: [
          {
            label: "Consultora Cattaneo",
            detail: "Abono por ley 19587 - mes anterior",
            amount: "20000.00",
          },
        ],
      },
      { rubroNumber: 2, label: "Reserva", total: "invalid" },
    ],
  })

  assert.ok(normalized)
  assert.equal(normalized?.periodKey, "2024-03")
  assert.equal(normalized?.rubros.length, 2)
  assert.equal(normalized?.rubros[0]?.rubroNumber, 1)
  assert.equal(normalized?.rubros[0]?.total, 1500.1)
  assert.equal(normalized?.rubros[0]?.items.length, 1)
  assert.equal(normalized?.rubros[0]?.items[0]?.amount, 20000)
  assert.equal(normalized?.rubros[1]?.total, null)
  assert.deepEqual(normalized?.rubros[1]?.items, [])
  assert.equal(normalized?.totalToPayUnit, 2500.55)
})

test("normalizeHoaDetails handles missing rubros and invalid totals", () => {
  const normalized = normalizeHoaDetails({
    periodYear: 2025,
    periodMonth: 1,
    totalBuildingExpenses: "not-a-number",
  })

  assert.ok(normalized)
  assert.equal(normalized?.rubros.length, 0)
  assert.equal(normalized?.totalBuildingExpenses, null)
})

test("calculateHoaTotals ignores null values and reports counts", () => {
  const totalsEmpty = calculateHoaTotals(null)
  assert.deepEqual(totalsEmpty, { rubrosTotal: null, rubrosWithTotals: 0 })

  const totals = calculateHoaTotals([
    { rubroNumber: 1, label: "Gastos", total: 1200, items: [] },
    { rubroNumber: 2, label: "Limpieza", total: null, items: [] },
    { rubroNumber: 3, label: "Fondo", total: 300.5, items: [] },
  ])

  assert.equal(totals.rubrosTotal, 1500.5)
  assert.equal(totals.rubrosWithTotals, 2)
})
