"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreditCard, CreditCardCycle } from "@/lib/credit-card-utils";
import { ResponsiveModal } from "./responsive-modal";

export type CycleFormValue = {
  cardId: string;
  periodMonth: string;
  closingDate: string;
  dueDate: string;
};

type CycleFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard | null;
  cycle?: CreditCardCycle | null;
  initialValue?: Partial<CycleFormValue>;
  onSave: (value: CycleFormValue) => Promise<void>;
};

export function CycleFormModal({
  open,
  onOpenChange,
  card,
  cycle,
  initialValue,
  onSave,
}: CycleFormModalProps) {
  const [form, setForm] = useState<CycleFormValue>({
    cardId: "",
    periodMonth: "",
    closingDate: "",
    dueDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      cardId: card?.id ?? "",
      periodMonth: cycle?.periodMonth ?? initialValue?.periodMonth ?? "",
      closingDate: cycle?.closingDate ?? initialValue?.closingDate ?? "",
      dueDate: cycle?.dueDate ?? initialValue?.dueDate ?? "",
    });
    setError(null);
  }, [card, cycle, initialValue, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.periodMonth || !form.closingDate || !form.dueDate) {
      setError("Completá el período, cierre y vencimiento.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={cycle ? "Editar período" : "Configurar período"}
      description={
        card
          ? `${card.name}: registrá cuándo cierra y cuándo vence el resumen.`
          : "Registrá cuándo cierra y cuándo vence el resumen."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cycle-period">Mes de vencimiento</Label>
          <Input
            id="cycle-period"
            type="month"
            value={form.periodMonth}
            disabled={Boolean(cycle)}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                periodMonth: event.target.value,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            El período se identifica por el mes en el que necesitás pagarlo.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Cierre</Label>
            <DatePickerPopover
              value={form.closingDate}
              onChange={(closingDate) =>
                setForm((current) => ({ ...current, closingDate }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Vencimiento</Label>
            <DatePickerPopover
              value={form.dueDate}
              onChange={(dueDate) =>
                setForm((current) => ({ ...current, dueDate }))
              }
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar período"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
