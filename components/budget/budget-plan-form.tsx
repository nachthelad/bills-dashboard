"use client";

import { useState } from "react";

import { parseAmountInput } from "@/lib/amount-parser";
import type { BudgetPreferences } from "@/lib/budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialValue: BudgetPreferences & { openingArsBalance?: number | null };
  onSave: (
    value: BudgetPreferences & { openingArsBalance?: number | null }
  ) => Promise<void>;
  submitLabel?: string;
};

type BudgetPlanDraft = Omit<
  BudgetPreferences,
  "arsBufferAmount" | "fundingMode"
> & {
  arsBufferAmount: string;
  fundingMode: "cash";
  openingArsBalance: string;
};

function createDraft(
  value: BudgetPreferences & { openingArsBalance?: number | null }
): BudgetPlanDraft {
  return {
    ...value,
    fundingMode: "cash",
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
}: Props) {
  const [value, setValue] = useState(() => createDraft(initialValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const arsBufferAmount = value.arsBufferAmount.trim()
        ? parseRequiredAmount(
            value.arsBufferAmount,
            "Ingresá una reserva fija válida"
          )
        : 0;
      const openingArsBalance = parseRequiredAmount(
        value.openingArsBalance,
        "Ingresá el saldo inicial del mes, aunque sea 0"
      );

      await onSave({
        ...value,
        fundingMode: "cash",
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="budget-opening">Saldo ARS inicial del mes</Label>
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
            required
          />
          <p className="text-xs text-muted-foreground">
            Los pesos que ya tenías disponibles al comenzar el mes.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget-buffer">Reserva fija no gastable</Label>
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
          <p className="text-xs text-muted-foreground">
            Tolva la descuenta del disponible y del monto diario.
          </p>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
