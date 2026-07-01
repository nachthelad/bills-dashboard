"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Check, Plus, Trash2, X } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  addExpenseEntries,
  EXPENSE_CATEGORIES,
  type ExpenseCreateInput,
  type ExpenseEntry,
  updateExpenseEntry,
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
import { getLocalTodayIso, isoToDate, toIsoDate } from "@/lib/date-picker";
import { parseAmountInput } from "@/lib/amount-parser";
import { cn } from "@/lib/utils";
import {
  createEmptyExpenseRow,
  createInheritedExpenseRow,
  isExpenseDraftRowBlank,
  type ExpenseDraftRow,
} from "@/lib/expense-form";

interface AddExpenseModalProps {
  onSuccess: () => void;
  editEntry?: ExpenseEntry | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  categories?: string[];
  onAddCategory?: (category: string) => Promise<void>;
}

type ExpenseRowValues = ExpenseDraftRow;

type ExpenseFormValues = {
  date: string;
  rows: ExpenseRowValues[];
};

const MAX_ROWS = 50;
const CREATE_FORM_ID = "add-expenses-form";

function createExpenseForm(
  editEntry?: ExpenseEntry | null
): ExpenseFormValues {
  if (editEntry) {
    return {
      date: toIsoDate(editEntry.date),
      rows: [
        createEmptyExpenseRow({
          description: editEntry.description,
          amount: String(editEntry.amount),
          currency: editEntry.currency ?? "ARS",
          arsRate:
            editEntry.arsRate != null ? String(editEntry.arsRate) : "",
          paymentMethod: editEntry.paymentMethod,
          category: editEntry.category,
        }),
      ],
    };
  }

  return {
    date: getLocalTodayIso(),
    rows: [createEmptyExpenseRow()],
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [addingCategoryRow, setAddingCategoryRow] = useState<number | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [rateLoadingKeys, setRateLoadingKeys] = useState<Set<string>>(
    () => new Set()
  );

  const categories = categoriesProp ?? [...EXPENSE_CATEGORIES];
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    setFocus,
    clearErrors,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    defaultValues: createExpenseForm(editEntry),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "rows",
  });
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const formData = watch();

  useEffect(() => {
    reset(createExpenseForm(editEntry));
    setServerError(null);
    setAddingCategoryRow(null);
  }, [editEntry, reset]);

  useEffect(() => {
    register("date", {
      validate: (value) =>
        isoToDate(value) ? true : "La fecha es obligatoria",
    });
  }, [register]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setServerError(null);
      setAddingCategoryRow(null);
      setNewCategoryName("");
      clearErrors();
      if (!editEntry) reset(createExpenseForm());
    }
  };

  const handleAddRow = () => {
    const rows = getValues("rows");
    if (rows.length >= MAX_ROWS) return;
    const previous = rows.at(-1) ?? createEmptyExpenseRow();
    append(createInheritedExpenseRow(previous));
    setServerError(null);
    setTimeout(() => setFocus(`rows.${rows.length}.description`), 0);
  };

  const handleCurrencyChange = async (
    index: number,
    fieldKey: string,
    value: string
  ) => {
    setServerError(null);
    setValue(`rows.${index}.currency`, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (value === "ARS") {
      setValue(`rows.${index}.arsRate`, "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    if (getValues(`rows.${index}.arsRate`)) return;

    setRateLoadingKeys((current) => new Set(current).add(fieldKey));
    try {
      const response = await fetch("/api/binance-rate");
      if (response.ok) {
        const data = await response.json();
        const currentIndex = fieldsRef.current.findIndex(
          (field) => field.id === fieldKey
        );
        if (
          currentIndex >= 0 &&
          !getValues(`rows.${currentIndex}.arsRate`)
        ) {
          setValue(`rows.${currentIndex}.arsRate`, String(data.price), {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      }
    } catch {
      // La cotización queda editable para carga manual.
    } finally {
      setRateLoadingKeys((current) => {
        const next = new Set(current);
        next.delete(fieldKey);
        return next;
      });
    }
  };

  const handleConfirmNewCategory = async (index: number) => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setAddCategoryLoading(true);
    try {
      if (onAddCategory) await onAddCategory(trimmed);
      setValue(`rows.${index}.category`, trimmed, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setAddingCategoryRow(null);
      setNewCategoryName("");
    } catch {
      setServerError("No se pudo crear la categoría. Reintentá.");
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const saveExpenses = async (
    values: ExpenseFormValues,
    keepOpen: boolean
  ) => {
    if (!user) return;

    const parsedDate = isoToDate(values.date);
    if (!parsedDate) {
      setServerError("La fecha es obligatoria.");
      return;
    }

    const populatedRows = values.rows.filter(
      (row) => !isExpenseDraftRowBlank(row)
    );
    if (populatedRows.length === 0) {
      setServerError("Completá al menos un gasto.");
      setFocus("rows.0.description");
      return;
    }

    setLoading(true);
    setServerError(null);
    try {
      const token = await user.getIdToken();
      const payloads: ExpenseCreateInput[] = populatedRows.map((row) => ({
        description: row.description.trim(),
        amount: parseAmountInput(row.amount),
        currency: row.currency,
        arsRate:
          row.currency === "USD" ? parseAmountInput(row.arsRate) : null,
        paymentMethod: row.paymentMethod,
        category: row.category,
      }));

      if (editEntry) {
        await updateExpenseEntry(token, editEntry.id, {
          date: parsedDate,
          ...payloads[0],
        });
      } else {
        await addExpenseEntries(token, parsedDate, payloads);
      }

      onSuccess();

      if (keepOpen && !editEntry) {
        const previous =
          populatedRows.at(-1) ?? createEmptyExpenseRow();
        reset({
          date: values.date,
          rows: [createInheritedExpenseRow(previous)],
        });
        setTimeout(() => setFocus("rows.0.description"), 0);
      } else {
        setOpen(false);
        if (!editEntry) reset(createExpenseForm());
      }
    } catch (error) {
      console.error("Failed to save expenses:", error);
      setServerError(
        error instanceof Error
          ? error.message
          : "Error al guardar los gastos. Reintentá."
      );
    } finally {
      setLoading(false);
    }
  };

  const rowIsBlank = (index: number) =>
    isExpenseDraftRowBlank(
      formData.rows[index] ?? createEmptyExpenseRow()
    );

  const descriptionRules = (index: number) => ({
    validate: (value: string) =>
      rowIsBlank(index) ||
      value.trim().length > 0 ||
      "La descripción es obligatoria",
  });

  const amountRules = (index: number) => ({
    validate: (value: string) => {
      if (rowIsBlank(index)) return true;
      if (!value.trim()) return "El importe es obligatorio";
      return (
        parseAmountInput(value) > 0 || "El importe debe ser mayor a 0"
      );
    },
  });

  const arsRateRules = (index: number) => ({
    validate: (value: string) => {
      const row = formData.rows[index];
      if (!row || rowIsBlank(index) || row.currency !== "USD") return true;
      return (
        parseAmountInput(value) > 0 || "Ingresá una cotización válida"
      );
    },
  });

  const categorySelect = (index: number) => (
    <Select
      value={formData.rows[index]?.category ?? "Compra"}
      disabled={loading}
      onValueChange={(value) => {
        if (value === "__new__") {
          setAddingCategoryRow(index);
          setNewCategoryName("");
          return;
        }
        setServerError(null);
        setValue(`rows.${index}.category`, value, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }}
    >
      <SelectTrigger
        aria-label={`Categoría del gasto ${index + 1}`}
        className="h-10 min-w-0 bg-background text-foreground sm:h-9"
      >
        <SelectValue placeholder="Categoría" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
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
  );

  const currencySelect = (index: number, fieldKey: string) => (
    <Select
      value={formData.rows[index]?.currency ?? "ARS"}
      disabled={loading || rateLoadingKeys.has(fieldKey)}
      onValueChange={(value) =>
        void handleCurrencyChange(index, fieldKey, value)
      }
    >
      <SelectTrigger
        aria-label={`Moneda del gasto ${index + 1}`}
        className="h-10 min-w-0 bg-background text-foreground sm:h-9"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ARS">ARS</SelectItem>
        <SelectItem value="USD">USD</SelectItem>
      </SelectContent>
    </Select>
  );

  const newCategoryEditor = (index: number) =>
    addingCategoryRow === index ? (
      <div className="mt-2 flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Nombre de la categoría"
          value={newCategoryName}
          onChange={(event) => setNewCategoryName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleConfirmNewCategory(index);
            } else if (event.key === "Escape") {
              setAddingCategoryRow(null);
              setNewCategoryName("");
            }
          }}
          className="h-10 bg-background sm:h-9"
          disabled={addCategoryLoading}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Confirmar nueva categoría"
          className="h-10 w-10 shrink-0 text-emerald-400 sm:h-9 sm:w-9"
          onClick={() => void handleConfirmNewCategory(index)}
          disabled={addCategoryLoading || !newCategoryName.trim()}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Cancelar nueva categoría"
          className="h-10 w-10 shrink-0 text-muted-foreground sm:h-9 sm:w-9"
          onClick={() => {
            setAddingCategoryRow(null);
            setNewCategoryName("");
          }}
          disabled={addCategoryLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    ) : null;

  const rowError = (index: number) => {
    const rowErrors = errors.rows?.[index];
    return (
      rowErrors?.description?.message ??
      rowErrors?.amount?.message ??
      rowErrors?.arsRate?.message
    );
  };

  const mobileRows = (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const row = formData.rows[index] ?? createEmptyExpenseRow();
        const error = rowError(index);
        return (
          <section
            key={field.id}
            className="rounded-xl border border-border bg-background/35 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Gasto {index + 1}
              </span>
              {index > 0 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar gasto ${index + 1}`}
                  className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  disabled={loading || rateLoadingKeys.has(field.id)}
                  onClick={() => {
                    remove(index);
                    setAddingCategoryRow(null);
                    setServerError(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span className="h-8 w-8" aria-hidden="true" />
              )}
            </div>
            <Input
              aria-label={`Descripción del gasto ${index + 1}`}
              placeholder="Descripción"
              disabled={loading}
              {...register(
                `rows.${index}.description`,
                descriptionRules(index)
              )}
              className="h-10 bg-background"
            />
            <div className="mt-2 grid grid-cols-[minmax(0,1.15fr)_minmax(72px,.75fr)_minmax(0,1.2fr)] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                aria-label={`Importe del gasto ${index + 1}`}
                placeholder="0,00"
                disabled={loading}
                {...register(`rows.${index}.amount`, amountRules(index))}
                className="h-10 min-w-0 bg-background"
              />
              {currencySelect(index, field.id)}
              {categorySelect(index)}
            </div>
            {row.currency === "USD" ? (
              <div className="mt-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Cotización del gasto ${index + 1}`}
                  placeholder="Cotización ARS/USD"
                  disabled={loading || rateLoadingKeys.has(field.id)}
                  {...register(
                    `rows.${index}.arsRate`,
                    arsRateRules(index)
                  )}
                  className="h-10 bg-background"
                />
              </div>
            ) : null}
            {newCategoryEditor(index)}
            {error ? (
              <p className="mt-2 text-xs font-medium text-red-400">
                {error}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );

  const desktopRows = (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-[minmax(190px,2fr)_minmax(105px,.85fr)_100px_minmax(125px,1.05fr)_40px] gap-2 bg-muted/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>Descripción</span>
        <span>Importe</span>
        <span>Moneda</span>
        <span>Categoría</span>
        <span className="sr-only">Acciones</span>
      </div>
      {fields.map((field, index) => {
        const row = formData.rows[index] ?? createEmptyExpenseRow();
        const error = rowError(index);
        return (
          <section
            key={field.id}
            className="border-t border-border px-3 py-2.5 first:border-t-0"
          >
            <div className="grid grid-cols-[minmax(190px,2fr)_minmax(105px,.85fr)_100px_minmax(125px,1.05fr)_40px] items-center gap-2">
              <Input
                aria-label={`Descripción del gasto ${index + 1}`}
                placeholder="p. ej. Carrefour"
                disabled={loading}
                {...register(
                  `rows.${index}.description`,
                  descriptionRules(index)
                )}
                className="h-9 bg-background"
              />
              <Input
                type="text"
                inputMode="decimal"
                aria-label={`Importe del gasto ${index + 1}`}
                placeholder="0,00"
                disabled={loading}
                {...register(`rows.${index}.amount`, amountRules(index))}
                className="h-9 min-w-0 bg-background"
              />
              {currencySelect(index, field.id)}
              {categorySelect(index)}
              {index > 0 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar gasto ${index + 1}`}
                  className="h-9 w-9 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  disabled={loading || rateLoadingKeys.has(field.id)}
                  onClick={() => {
                    remove(index);
                    setAddingCategoryRow(null);
                    setServerError(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span className="h-9 w-9" aria-hidden="true" />
              )}
            </div>
            {row.currency === "USD" ? (
              <div className="mt-2 grid grid-cols-[minmax(190px,2fr)_minmax(105px,.85fr)_100px_minmax(125px,1.05fr)_40px] gap-2">
                <span />
                <Input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Cotización del gasto ${index + 1}`}
                  placeholder="Cotización ARS/USD"
                  disabled={loading || rateLoadingKeys.has(field.id)}
                  {...register(
                    `rows.${index}.arsRate`,
                    arsRateRules(index)
                  )}
                  className="col-span-2 h-9 bg-background"
                />
              </div>
            ) : null}
            {newCategoryEditor(index)}
            {error ? (
              <p className="mt-2 text-xs font-medium text-red-400">
                Gasto {index + 1}: {error}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );

  const editFields = (() => {
    const field = fields[0];
    const row = formData.rows[0] ?? createEmptyExpenseRow();
    if (!field) return null;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exp-description">Descripción</Label>
          <Input
            id="exp-description"
            placeholder="p. ej. Carrefour, Supermercado, etc."
            disabled={loading}
            {...register("rows.0.description", descriptionRules(0))}
            className="h-11 bg-background sm:h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Moneda</Label>
            {currencySelect(0, field.id)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-amount">Importe ({row.currency})</Label>
            <Input
              id="exp-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              disabled={loading}
              {...register("rows.0.amount", amountRules(0))}
              className="h-11 bg-background sm:h-9"
            />
          </div>
        </div>
        {row.currency === "USD" ? (
          <div className="space-y-2">
            <Label htmlFor="exp-ars-rate">Cotización (ARS/USD)</Label>
            <Input
              id="exp-ars-rate"
              type="text"
              inputMode="decimal"
              placeholder="1.450,00"
              disabled={loading || rateLoadingKeys.has(field.id)}
              {...register("rows.0.arsRate", arsRateRules(0))}
              className="h-11 bg-background sm:h-9"
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Categoría</Label>
          {categorySelect(0)}
          {newCategoryEditor(0)}
        </div>
        {rowError(0) ? (
          <p className="text-sm font-medium text-red-400">{rowError(0)}</p>
        ) : null}
      </div>
    );
  })();

  const formBody = (
    <form
      id={CREATE_FORM_ID}
      onSubmit={handleSubmit((values) => saveExpenses(values, false))}
      noValidate
      className="space-y-4"
    >
      <div
        className={cn(
          "flex gap-3",
          editEntry
            ? "flex-col"
            : "items-center justify-between"
        )}
      >
        <div className={cn("space-y-2", editEntry ? "w-full" : "min-w-0 flex-1 sm:max-w-[220px]")}>
          {editEntry ? <Label>Fecha</Label> : null}
          <DatePickerPopover
            value={formData.date}
            onChange={(value) => {
              setServerError(null);
              setValue("date", value, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            className="w-full"
            inputClassName="h-11 bg-background sm:h-9"
          />
        </div>
        {!editEntry ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleAddRow}
            disabled={loading || fields.length >= MAX_ROWS}
            className="h-11 shrink-0 border-emerald-500/40 px-3 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 sm:h-9"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Añadir línea</span>
            <span className="sm:hidden">Añadir</span>
          </Button>
        ) : null}
      </div>
      {editEntry ? editFields : isMobile ? mobileRows : desktopRows}
      {errors.date?.message ? (
        <p className="text-sm font-medium text-red-400">
          {errors.date.message}
        </p>
      ) : null}
      {serverError ? (
        <p className="text-sm font-medium text-red-400">{serverError}</p>
      ) : null}
    </form>
  );

  const createActions = (
    <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={handleSubmit((values) => saveExpenses(values, true))}
        className="h-11 sm:h-9"
      >
        {loading ? "Guardando..." : "Guardar"}
      </Button>
      <Button
        type="submit"
        form={CREATE_FORM_ID}
        disabled={loading}
        className="h-11 bg-emerald-500 font-semibold text-slate-900 hover:bg-emerald-400 sm:h-9"
      >
        {loading ? "Guardando..." : "Guardar y cerrar"}
      </Button>
    </div>
  );

  const editActions = (
    <div className="flex w-full justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(false)}
        disabled={loading}
        className="h-11 sm:h-9"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form={CREATE_FORM_ID}
        disabled={loading}
        className="h-11 bg-emerald-500 font-semibold text-slate-900 hover:bg-emerald-400 sm:h-9"
      >
        {loading ? "Actualizando..." : "Actualizar"}
      </Button>
    </div>
  );

  const title = editEntry ? "Editar gasto" : "Agregar gastos";
  const description = editEntry
    ? "Actualizá los datos del gasto."
    : "Cargá uno o varios gastos del mismo día.";
  const actions = editEntry ? editActions : createActions;

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        bodyClassName="mt-4 pr-1"
        footer={actions}
        trigger={
          !isControlled ? (
            <Button
              size="icon"
              className="bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              aria-label="Agregar gastos"
              title="Agregar gastos"
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : undefined
        }
      >
        {formBody}
      </MobileDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled ? (
        <DialogTrigger asChild>
          <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
            <Plus className="mr-2 h-4 w-4" />
            Agregar gastos
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        className={cn(
          "flex max-h-[90vh] flex-col bg-card text-foreground",
          editEntry ? "sm:max-w-[480px]" : "sm:max-w-[900px]"
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {formBody}
        </div>
        <div className="shrink-0 border-t border-border pt-4">
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  );
}
