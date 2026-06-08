"use client";

import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useForm } from "react-hook-form";
import {
  addExpenseEntry,
  updateExpenseEntry,
  EXPENSE_CATEGORIES,
  type ExpenseEntry,
} from "@/lib/expenses-client";
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
import { Check, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { getLocalTodayIso, isoToDate, toIsoDate } from "@/lib/date-picker";
import { parseAmountInput } from "@/lib/amount-parser";

interface AddExpenseModalProps {
  onSuccess: () => void;
  editEntry?: ExpenseEntry | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  categories?: string[];
  onAddCategory?: (category: string) => Promise<void>;
}

type ExpenseFormValues = {
  date: string;
  description: string;
  amount: string;
  currency: string;
  arsRate: string;
  paymentMethod: ExpenseEntry["paymentMethod"];
  category: string;
};

function createExpenseForm(editEntry?: ExpenseEntry | null): ExpenseFormValues {
  if (editEntry) {
    return {
      date: toIsoDate(editEntry.date),
      description: editEntry.description,
      amount: String(editEntry.amount),
      currency: editEntry.currency ?? "ARS",
      arsRate: editEntry.arsRate != null ? String(editEntry.arsRate) : "",
      paymentMethod: editEntry.paymentMethod,
      category: editEntry.category,
    };
  }

  return {
    date: getLocalTodayIso(),
    description: "",
    amount: "",
    currency: "ARS",
    arsRate: "",
    paymentMethod: "Débito",
    category: "Compra",
  };
}

export function AddExpenseModal({
  onSuccess,
  editEntry,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  categories: categoriesProp,
  onAddCategory,
}: AddExpenseModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [arsRateLoading, setArsRateLoading] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const categories = categoriesProp ?? [...EXPENSE_CATEGORIES];

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    defaultValues: createExpenseForm(editEntry),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const formData = watch();

  // Update form data when editEntry changes
  useEffect(() => {
    reset(createExpenseForm(editEntry));
    setServerError(null);
  }, [editEntry, reset]);

  useEffect(() => {
    register("date", {
      validate: (value) =>
        isoToDate(value) ? true : "La fecha es obligatoria",
    });
    register("currency");
    register("arsRate");
    register("paymentMethod");
    register("category");
  }, [register]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setServerError(null);
      clearErrors();
      if (!editEntry) reset(createExpenseForm());
    }
  };

  const handleCurrencyChange = async (value: string) => {
    setServerError(null);
    setValue("currency", value, { shouldDirty: true });
    if (value === "ARS") {
      setValue("arsRate", "", { shouldDirty: true, shouldValidate: true });
    }
    if (value === "USD") {
      setArsRateLoading(true);
      try {
        const res = await fetch("/api/binance-rate");
        if (res.ok) {
          const data = await res.json();
          if (!watch("arsRate")) {
            setValue("arsRate", String(data.price), {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }
      } catch {
        // leave empty — user enters manually
      } finally {
        setArsRateLoading(false);
      }
    }
  };

  const handleConfirmNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setAddCategoryLoading(true);
    try {
      if (onAddCategory) await onAddCategory(trimmed);
      setValue("category", trimmed, { shouldDirty: true, shouldValidate: true });
      setAddingCategory(false);
      setNewCategoryName("");
    } catch {
      // ignore
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const saveExpense = async (
    values: ExpenseFormValues,
    keepOpen: boolean
  ) => {
    if (!user) return;

    const parsedDate = isoToDate(values.date);
    if (!parsedDate) return;

    setLoading(true);
    setServerError(null);
    try {
      const token = await user.getIdToken();
      const payload = {
        date: parsedDate,
        description: values.description.trim(),
        amount: parseAmountInput(values.amount),
        currency: values.currency,
        arsRate:
          values.currency === "USD" && values.arsRate
            ? Number.parseFloat(values.arsRate)
            : null,
        paymentMethod: values.paymentMethod,
        category: values.category,
      };

      if (editEntry) {
        await updateExpenseEntry(token, editEntry.id, payload);
      } else {
        await addExpenseEntry(token, payload);
      }

      onSuccess();

      if (keepOpen) {
        // Keep date and category — only clear description + amount for next entry
        reset({ ...values, description: "", amount: "" });
        setServerError(null);
        setTimeout(() => descriptionRef.current?.focus(), 0);
      } else {
        setOpen(false);
        if (!editEntry) reset(createExpenseForm());
      }
    } catch (err) {
      console.error("Failed to save expense:", err);
      setServerError("Error al guardar el gasto. Reintenta.");
    } finally {
      setLoading(false);
    }
  };
  const descriptionField = register("description", {
    validate: (value) =>
      value.trim().length > 0 ? true : "La descripción es obligatoria",
  });
  const amountField = register("amount", {
    validate: (value) => {
      if (!value.trim()) return "El monto es obligatorio";
      return parseAmountInput(value) > 0 || "El monto debe ser mayor a 0";
    },
  });
  const errorMessage =
    serverError ??
    errors.date?.message ??
    errors.description?.message ??
    errors.amount?.message;

  const formContent = (
    <form
      onSubmit={handleSubmit((values: ExpenseFormValues) =>
        saveExpense(values, false)
      )}
      noValidate
      className="space-y-4 px-1 pb-4"
    >
      <div className="space-y-2">
        <Label className="text-foreground font-medium">
          Fecha
        </Label>
        <DatePickerPopover
          value={formData.date}
          onChange={(value) => {
            setServerError(null);
            setValue("date", value, { shouldDirty: true, shouldValidate: true });
          }}
          className="w-full"
          inputClassName="h-11 bg-background border-border sm:h-9"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="exp-description" className="text-foreground font-medium">
          Descripción
        </Label>
        <Input
          id="exp-description"
          type="text"
          placeholder="p.ej. Carrefour, Supermercado, etc."
          {...descriptionField}
          ref={(node) => {
            descriptionField.ref(node);
            descriptionRef.current = node;
          }}
          value={formData.description ?? ""}
          onChange={(e) => {
            setServerError(null);
            descriptionField.onChange(e);
          }}
          className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exp-currency" className="text-foreground font-medium">
            Moneda
          </Label>
          <Select
            value={formData.currency}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger id="exp-currency" className="bg-background border-border text-foreground h-11 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="ARS">ARS — Pesos</SelectItem>
              <SelectItem value="USD">USD — Dólar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-amount" className="text-foreground font-medium">
            Monto ({formData.currency})
          </Label>
          <Input
            id="exp-amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            {...amountField}
            value={formData.amount ?? ""}
            onChange={(e) => {
              setServerError(null);
              amountField.onChange(e);
            }}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
          />
        </div>
      </div>
      {formData.currency === "USD" && (
        <div className="space-y-2">
          <Label htmlFor="exp-ars-rate" className="text-foreground font-medium">
            Cotización (ARS/USD)
          </Label>
          {arsRateLoading ? (
            <div className="h-11 sm:h-9 rounded-md border border-border bg-background animate-pulse" />
          ) : (
            <Input
              id="exp-ars-rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Ej: 1450.00"
              value={formData.arsRate ?? ""}
              onChange={(e) => {
                setServerError(null);
                setValue("arsRate", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exp-category" className="text-foreground font-medium">
            Categoría
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => {
              if (value === "__new__") {
                setAddingCategory(true);
              } else {
                setServerError(null);
                setValue("category", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }
            }}
          >
            <SelectTrigger
              id="exp-category"
              className="bg-background border-border text-foreground h-11 sm:h-9"
            >
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value="__new__" className="text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Nueva categoría...
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {addingCategory && (
            <div className="flex gap-2 items-center mt-2">
              <Input
                autoFocus
                placeholder="Nombre de la categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmNewCategory();
                  } else if (e.key === "Escape") {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }
                }}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
                disabled={addCategoryLoading}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Confirm new category"
                className="h-11 sm:h-9 w-11 sm:w-9 text-emerald-400 hover:text-emerald-300 shrink-0"
                onClick={handleConfirmNewCategory}
                disabled={addCategoryLoading || !newCategoryName.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Cancel new category"
                className="h-11 sm:h-9 w-11 sm:w-9 text-muted-foreground shrink-0"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName("");
                }}
                disabled={addCategoryLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {errorMessage ? (
        <p className="text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-1">
          {errorMessage}
        </p>
      ) : null}
      <div className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4",
        editEntry ? "sm:justify-end" : "sm:justify-between"
      )}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="order-3 sm:order-1 h-11 sm:h-9"
        >
          Cancelar
        </Button>
        <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2 w-full sm:w-auto">
          {!editEntry && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleSubmit((values: ExpenseFormValues) =>
                saveExpense(values, true)
              )}
              className="h-11 sm:h-9 whitespace-nowrap"
            >
              Guardar y agregar otro
            </Button>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 text-slate-900 hover:bg-emerald-400 h-11 sm:h-9 font-semibold"
          >
            {loading
              ? editEntry
                ? "Actualizando..."
                : "Guardando..."
              : editEntry
                ? "Actualizar"
                : "Guardar"}
          </Button>
        </div>
      </div>
    </form>
  );

  const title = editEntry ? "Editar gasto" : "Agregar gasto";
  const description = editEntry ? "Actualizá los datos del gasto." : "Registrá un nuevo gasto diario.";

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        bodyClassName="pr-1"
        trigger={
          !isControlled ? (
            <Button
              size="icon"
              className="bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              aria-label="Agregar gasto"
              title="Agregar gasto"
            >
              <Plus className="w-4 h-4" />
            </Button>
          ) : undefined
        }
      >
        {formContent}
      </MobileDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
            <Plus className="w-4 h-4 mr-2" />
            Agregar gasto
          </Button>
        </DialogTrigger>
      )}
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
