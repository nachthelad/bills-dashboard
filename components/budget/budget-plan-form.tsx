"use client";

import { useState } from "react";

import { parseAmountInput } from "@/lib/amount-parser";
import type { BudgetPreferences } from "@/lib/budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  initialValue: BudgetPreferences & { openingArsBalance?: number | null };
  onSave: (
    value: BudgetPreferences & { openingArsBalance?: number | null }
  ) => Promise<void>;
  submitLabel?: string;
  showOpeningBalance?: boolean;
};

type BudgetPlanDraft = Omit<
  BudgetPreferences,
  "expectedIncome" | "savingsValue" | "arsBufferAmount"
> & {
  expectedIncome: string;
  savingsValue: string;
  arsBufferAmount: string;
  openingArsBalance: string;
};

function createDraft(
  value: BudgetPreferences & { openingArsBalance?: number | null }
): BudgetPlanDraft {
  return {
    ...value,
    expectedIncome: value.expectedIncome ? String(value.expectedIncome) : "",
    savingsValue: String(value.savingsValue),
    arsBufferAmount: value.arsBufferAmount
      ? String(value.arsBufferAmount)
      : "",
    openingArsBalance:
      value.openingArsBalance === null ||
      value.openingArsBalance === undefined
        ? ""
        : String(value.openingArsBalance),
  };
}

function parseRequiredAmount(value: string, message: string) {
  const parsed = parseAmountInput(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(message);
  }
  return parsed;
}

export function BudgetPlanForm({
  initialValue,
  onSave,
  submitLabel = "Guardar plan",
  showOpeningBalance = false,
}: Props) {
  const [value, setValue] = useState(() => createDraft(initialValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let expectedIncome = 0;
      if (value.expectedIncome.trim()) {
        expectedIncome = parseRequiredAmount(
          value.expectedIncome,
          "Ingresá un ingreso esperado válido"
        );
      } else if (value.fundingMode === "planned") {
        throw new Error("Ingresá un ingreso esperado válido");
      }
      const savingsValue = parseRequiredAmount(
        value.savingsValue,
        value.savingsMode === "percentage"
          ? "Ingresá un porcentaje de ahorro válido"
          : "Ingresá un monto de ahorro válido"
      );
      if (value.savingsMode === "percentage" && savingsValue > 100) {
        throw new Error("El porcentaje de ahorro debe estar entre 0 y 100");
      }
      const arsBufferAmount = value.arsBufferAmount.trim()
        ? parseRequiredAmount(
            value.arsBufferAmount,
            "Ingresá un colchón en pesos válido"
          )
        : 0;
      const openingArsBalance = value.openingArsBalance.trim()
        ? parseRequiredAmount(
            value.openingArsBalance,
            "Ingresá un saldo inicial válido"
          )
        : null;

      await onSave({
        ...value,
        expectedIncome,
        savingsValue,
        arsBufferAmount,
        openingArsBalance,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar el plan"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Cómo calcular el disponible</Label>
        <Select
          value={value.fundingMode}
          onValueChange={(fundingMode: BudgetPreferences["fundingMode"]) =>
            setValue((current) => ({ ...current, fundingMode }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planned">Ingreso esperado</SelectItem>
            <SelectItem value="cash">Fondos ARS reales</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.fundingMode === "cash" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {showOpeningBalance ? (
            <div className="space-y-2">
              <Label htmlFor="budget-opening">Saldo inicial del mes</Label>
              <Input
                id="budget-opening"
                type="text"
                inputMode="decimal"
                value={value.openingArsBalance}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    openingArsBalance: event.target.value,
                  }))
                }
                placeholder="0,00"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="budget-buffer">Colchón en pesos</Label>
            <Input
              id="budget-buffer"
              type="text"
              inputMode="decimal"
              value={value.arsBufferAmount}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  arsBufferAmount: event.target.value,
                }))
              }
              placeholder="0,00"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="budget-income">Ingreso esperado mensual</Label>
            <Input
              id="budget-income"
              type="text"
              inputMode="decimal"
              value={value.expectedIncome}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  expectedIncome: event.target.value,
                }))
              }
              placeholder="2.184.000,00"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="space-y-2">
              <Label>Tipo de objetivo</Label>
              <Select
                value={value.savingsMode}
                onValueChange={(mode: BudgetPreferences["savingsMode"]) =>
                  setValue((current) => ({ ...current, savingsMode: mode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentaje</SelectItem>
                  <SelectItem value="fixed">Monto fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-saving">
                {value.savingsMode === "percentage"
                  ? "Porcentaje a reservar"
                  : "Monto a reservar"}
              </Label>
              <Input
                id="budget-saving"
                type="text"
                inputMode="decimal"
                value={value.savingsValue}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    savingsValue: event.target.value,
                  }))
                }
                placeholder={
                  value.savingsMode === "percentage" ? "20" : "0,00"
                }
                required
              />
            </div>
          </div>
        </>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
