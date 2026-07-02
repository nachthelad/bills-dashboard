"use client";

import { useState } from "react";

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
  initialValue: BudgetPreferences;
  onSave: (value: BudgetPreferences) => Promise<void>;
  submitLabel?: string;
};

export function BudgetPlanForm({
  initialValue,
  onSave,
  submitLabel = "Guardar plan",
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
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
        <Label htmlFor="budget-income">Ingreso esperado mensual</Label>
        <Input
          id="budget-income"
          inputMode="decimal"
          value={value.expectedIncome || ""}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              expectedIncome: Number(event.target.value),
            }))
          }
          placeholder="2184000"
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
          <div className="relative">
            <Input
              id="budget-saving"
              inputMode="decimal"
              value={value.savingsValue || ""}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  savingsValue: Number(event.target.value),
                }))
              }
              min={0}
              max={value.savingsMode === "percentage" ? 100 : undefined}
              required
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              {value.savingsMode === "percentage" ? "%" : "ARS"}
            </span>
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
