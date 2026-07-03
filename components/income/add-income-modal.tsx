"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { addIncomeEntry } from "@/lib/income-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { getLocalTodayIso, isoToDate } from "@/lib/date-picker";
import { parseAmountInput } from "@/lib/amount-parser";
import { fetchIncomeSources } from "@/lib/funding-client";
import type { IncomeSource, MoneyCurrency } from "@/lib/budget";

interface AddIncomeModalProps {
  onSuccess?: () => void;
  presetSource?: IncomeSource;
  trigger?: React.ReactNode;
}

type IncomeFormState = {
  name: string;
  source: string;
  amount: string;
  currency: MoneyCurrency;
  incomeSourceId: string | null;
  date: string;
};

function createEmptyForm(presetSource?: IncomeSource): IncomeFormState {
  return {
    name: presetSource?.name ?? "",
    source: "Salary",
    amount: "",
    currency: presetSource?.currency ?? "ARS",
    incomeSourceId: presetSource?.id ?? (null as string | null),
    date: getLocalTodayIso(),
  };
}

export function AddIncomeModal({
  onSuccess = () => {},
  presetSource,
  trigger,
}: AddIncomeModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() =>
    createEmptyForm(presetSource)
  );
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(
    presetSource ? [presetSource] : []
  );
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (presetSource) {
      setIncomeSources([presetSource]);
      return;
    }
    if (!user) return;
    let cancelled = false;
    void user.getIdToken().then(fetchIncomeSources).then((sources) => {
      if (!cancelled) setIncomeSources(sources.filter((source) => source.isActive));
    });
    return () => {
      cancelled = true;
    };
  }, [presetSource, user]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setError(null);
      setFormData(createEmptyForm(presetSource));
    }
  };

  const saveIncome = async () => {
    if (!user) return;

    // Validation
    if (!formData.name.trim()) {
      setError("El nombre es obligatorio");
      nameRef.current?.focus();
      return;
    }
    const amount = parseAmountInput(formData.amount);
    if (!formData.amount || !Number.isFinite(amount) || amount <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    const parsedDate = isoToDate(formData.date);
    if (!parsedDate) {
      setError("La fecha es obligatoria");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      await addIncomeEntry(token, {
        name: formData.name,
        amount,
        source: formData.source,
        currency: formData.currency,
        incomeSourceId: formData.incomeSourceId,
        date: parsedDate,
      });
      setOpen(false);
      setFormData(createEmptyForm(presetSource));
      onSuccess();
    } catch (err) {
      console.error("Failed to add income:", err);
      setError("Error al agregar el ingreso. Reintenta.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveIncome();
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-4">
      <div className="space-y-2">
        <Label htmlFor="inc-name" className="text-foreground font-medium">
          Nombre
        </Label>
        <Input
          id="inc-name"
          ref={nameRef}
          type="text"
          placeholder="p.ej., Salario diciembre, Proyecto freelance"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {presetSource ? null : (
          <div className="space-y-2">
            <Label className="text-foreground font-medium">
              Fuente configurada
            </Label>
            <Select
              value={formData.incomeSourceId ?? "none"}
              onValueChange={(value) => {
                const selected = incomeSources.find(
                  (source) => source.id === value
                );
                setFormData((current) => ({
                  ...current,
                  incomeSourceId: value === "none" ? null : value,
                  name: selected?.name ?? current.name,
                  currency: selected?.currency ?? current.currency,
                }));
              }}
            >
              <SelectTrigger className="h-11 bg-background sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {incomeSources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="inc-source" className="text-foreground font-medium">
            Fuente
          </Label>
          <Select
            value={formData.source}
            onValueChange={(value) =>
              setFormData({ ...formData, source: value })
            }
          >
            <SelectTrigger id="inc-source" className="bg-background border-border text-foreground h-11 sm:h-9">
              <SelectValue placeholder="Seleccionar fuente" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="Salary">Salario</SelectItem>
              <SelectItem value="Freelance">Freelance</SelectItem>
              <SelectItem value="Investments">Inversiones</SelectItem>
              <SelectItem value="Other">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground font-medium">
            Fecha
          </Label>
          <DatePickerPopover
            value={formData.date}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, date: value }))
            }
            className="w-full"
            inputClassName="h-11 bg-background border-border sm:h-9"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="inc-currency" className="text-foreground font-medium">
            Moneda
          </Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => {
              if (value === "ARS" || value === "USD" || value === "USDT") {
                setFormData({ ...formData, currency: value });
              }
            }}
          >
            <SelectTrigger id="inc-currency" className="bg-background border-border text-foreground h-11 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="ARS">ARS — Pesos</SelectItem>
              <SelectItem value="USD">USD — Dólar</SelectItem>
              <SelectItem value="USDT">USDT — Cripto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inc-amount" className="text-foreground font-medium">
            Monto ({formData.currency})
          </Label>
          <Input
            id="inc-amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
            required
          />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-1">{error}</p>}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="order-2 sm:order-1 h-11 sm:h-9"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-emerald-500 text-slate-900 hover:bg-emerald-400 h-11 sm:h-9 font-semibold order-1 sm:order-2"
        >
          {loading ? "Agregando..." : "Agregar entrada"}
        </Button>
      </div>
    </form>
  );

  const title = presetSource
    ? `Registrar cobro de ${presetSource.name}`
    : "Agregar ingreso";
  const description = presetSource
    ? `El cobro quedará vinculado a ${presetSource.name}.`
    : "Registrá una nueva entrada de ingreso.";
  const defaultTrigger = (
    <Button
      size={isMobile ? "icon" : "default"}
      className="bg-emerald-500 text-slate-900 hover:bg-emerald-400"
      aria-label="Agregar ingreso"
      title="Agregar ingreso"
    >
      <Plus className="w-4 h-4" />
      {isMobile ? null : "Agregar ingreso"}
    </Button>
  );

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        bodyClassName="pr-1"
        trigger={trigger ?? defaultTrigger}
      >
        {formContent}
      </MobileDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
