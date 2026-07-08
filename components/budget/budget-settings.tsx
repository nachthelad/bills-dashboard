"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { parseAmountInput } from "@/lib/amount-parser";
import {
  createFixedExpense,
  deactivateFixedExpense,
  fetchFixedExpenses,
  fetchMonthlyBudget,
  fetchSpendingLimits,
  saveMonthlyBudget,
  saveSpendingLimits,
  updateFixedExpense,
} from "@/lib/budget-client";
import { fetchExpenseCategories } from "@/lib/expenses-client";
import { VARIABLE_BUDGET_CATEGORIES } from "@/lib/expenses-client";
import {
  getArgentinaDateParts,
  type BudgetPreferences,
  type FixedExpense,
  type SpendingLimit,
} from "@/lib/budget";
import { PROVIDER_HINTS } from "@/config/billing/providerHints";
import { formatAmount } from "@/lib/format-currency";
import { BudgetPlanForm } from "@/components/budget/budget-plan-form";
import { IncomeSourcesSettings } from "@/components/income/income-sources-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

type FixedExpenseFormState = Omit<
  Pick<
    FixedExpense,
    | "name"
    | "category"
    | "estimatedAmount"
    | "dueDay"
    | "sourceType"
    | "sourceKey"
  >,
  "estimatedAmount" | "dueDay"
> & {
  estimatedAmount: string;
  dueDay: string;
};

const EMPTY_FIXED: FixedExpenseFormState = {
  name: "",
  category: "Servicios",
  estimatedAmount: "",
  dueDay: "",
  sourceType: "manual" as const,
  sourceKey: null,
};
const AUTO_PROVIDER_VALUE = "__auto__";
const DOCUMENT_PROVIDER_OPTIONS = PROVIDER_HINTS.filter(
  (provider) =>
    !provider.providerId.startsWith("generic_") &&
    provider.category !== "credit_card" &&
    provider.category !== "hoa"
).sort((a, b) => a.providerName.localeCompare(b.providerName, "es"));

export function BudgetSettings() {
  const { user } = useAuth();
  const month = useMemo(() => getArgentinaDateParts().periodMonth, []);
  const [preferences, setPreferences] = useState<
    (BudgetPreferences & { openingArsBalance?: number | null }) | null
  >(null);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixedDialogOpen, setFixedDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [fixedForm, setFixedForm] =
    useState<FixedExpenseFormState>(EMPTY_FIXED);
  const [savingFixed, setSavingFixed] = useState(false);
  const [fixedError, setFixedError] = useState<string | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const [nextPreferences, nextFixed, nextCategories, nextLimits] =
          await Promise.all([
            fetchMonthlyBudget(token, month),
            fetchFixedExpenses(token),
            fetchExpenseCategories(token),
            fetchSpendingLimits(token, month),
          ]);
        if (cancelled) return;
        setPreferences({
          ...nextPreferences.plan,
          openingArsBalance: nextPreferences.funding.openingArsBalance,
        });
        setFixedExpenses(nextFixed);
        setCategories(nextCategories);
        setLimits(
          Object.fromEntries(
            nextLimits.map((limit) => [
              limit.category,
              String(limit.limitAmount),
            ])
          )
        );
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar la configuración"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, user]);

  async function savePreferences(
    value: BudgetPreferences & { openingArsBalance?: number | null }
  ) {
    if (!user) return;
    const token = await user.getIdToken();
    const summary = await saveMonthlyBudget(token, month, value);
    setPreferences({
      ...summary.plan,
      openingArsBalance: summary.funding.openingArsBalance,
    });
  }

  function openFixedDialog(expense?: FixedExpense) {
    setEditing(expense ?? null);
    setFixedForm(
      expense
        ? {
            name: expense.name,
            category: expense.category,
            estimatedAmount: String(expense.estimatedAmount),
            dueDay: expense.dueDay === null ? "" : String(expense.dueDay),
            sourceType: expense.sourceType,
            sourceKey: expense.sourceKey,
          }
        : EMPTY_FIXED
    );
    setFixedError(null);
    setFixedDialogOpen(true);
  }

  async function saveFixed(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const estimatedAmount = parseAmountInput(fixedForm.estimatedAmount);
    if (
      !fixedForm.estimatedAmount.trim() ||
      !Number.isFinite(estimatedAmount) ||
      estimatedAmount < 0
    ) {
      setFixedError("Ingresá un importe estimado válido");
      return;
    }
    const dueDay = fixedForm.dueDay.trim()
      ? Number(fixedForm.dueDay)
      : null;
    if (
      dueDay !== null &&
      (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
    ) {
      setFixedError("El día de vencimiento debe estar entre 1 y 31");
      return;
    }
    setSavingFixed(true);
    setFixedError(null);
    try {
      const token = await user.getIdToken();
      const input = {
        ...fixedForm,
        estimatedAmount,
        dueDay,
        activeFrom: editing?.activeFrom ?? month,
        inactiveFrom: editing?.inactiveFrom ?? null,
      };
      const saved = editing
        ? await updateFixedExpense(token, editing.id, input)
        : await createFixedExpense(token, input);
      setFixedExpenses((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((a, b) =>
              a.name.localeCompare(b.name, "es")
            )
      );
      setFixedDialogOpen(false);
    } catch (cause) {
      setFixedError(
        cause instanceof Error ? cause.message : "No se pudo guardar el gasto"
      );
    } finally {
      setSavingFixed(false);
    }
  }

  async function removeFixed(id: string) {
    if (!user) return;
    const token = await user.getIdToken();
    await deactivateFixedExpense(token, id);
    setFixedExpenses((current) => current.filter((item) => item.id !== id));
  }

  async function persistLimits() {
    if (!user) return;
    setSavingLimits(true);
    setLimitsSaved(false);
    setLimitsError(null);
    try {
      const payload: SpendingLimit[] = [];
      for (const [category, rawAmount] of Object.entries(limits)) {
        if (!rawAmount.trim()) continue;
        const limitAmount = parseAmountInput(rawAmount);
        if (!Number.isFinite(limitAmount) || limitAmount < 0) {
          throw new Error(`Ingresá un límite válido para ${category}`);
        }
        if (limitAmount > 0) {
          payload.push({ category, limitAmount });
        }
      }
      const token = await user.getIdToken();
      const saved = await saveSpendingLimits(token, month, payload);
      setLimits(
        Object.fromEntries(
          saved.map((item) => [item.category, String(item.limitAmount)])
        )
      );
      setLimitsSaved(true);
    } catch (cause) {
      setLimitsError(
        cause instanceof Error ? cause.message : "No se pudieron guardar los límites"
      );
    } finally {
      setSavingLimits(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando presupuesto…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card id="monthly-plan">
        <CardHeader>
          <CardTitle>Fondos reales del mes</CardTitle>
          <CardDescription>
            Definí los pesos con los que comenzaste y la reserva que no querés
            gastar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preferences ? (
            <BudgetPlanForm
              initialValue={preferences}
              onSave={savePreferences}
              submitLabel="Guardar valores base"
            />
          ) : null}
        </CardContent>
      </Card>

      <IncomeSourcesSettings />

      <Card id="fixed-expenses">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Gastos fijos</CardTitle>
              <CardDescription className="mt-1">
                Tolva reserva estos importes antes de calcular tu disponible.
              </CardDescription>
            </div>
            <Button onClick={() => openFixedDialog()}>
              <Plus className="size-4" /> Agregar fijo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fixedExpenses.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Todavía no configuraste gastos fijos.
            </p>
          ) : (
            fixedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{expense.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.category}
                    {expense.dueDay ? ` · vence el día ${expense.dueDay}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mr-auto font-bold sm:mr-2">
                    {formatAmount(expense.estimatedAmount)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${expense.name}`}
                    onClick={() => openFixedDialog(expense)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Desactivar ${expense.name}`}
                    onClick={() => void removeFixed(expense.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card id="limits">
        <CardHeader>
          <CardTitle>Límites variables</CardTitle>
          <CardDescription>
            Definí cuánto querés gastar en cada categoría durante{" "}
            {formatMonth(month)}. Dejá vacío para no limitarla.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {VARIABLE_BUDGET_CATEGORIES.map((category) => (
              <div key={category} className="space-y-2">
                <Label htmlFor={`limit-${category}`}>{category}</Label>
                <Input
                  id={`limit-${category}`}
                  type="text"
                  inputMode="decimal"
                  value={limits[category] ?? ""}
                  onChange={(event) => {
                    setLimitsSaved(false);
                    setLimitsError(null);
                    setLimits((current) => ({
                      ...current,
                      [category]: event.target.value,
                    }));
                  }}
                  placeholder="Sin límite"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => void persistLimits()} disabled={savingLimits}>
              {savingLimits ? "Guardando…" : "Guardar límites"}
            </Button>
            {limitsSaved ? (
              <span className="text-sm text-emerald-600">Guardados</span>
            ) : null}
          </div>
          {limitsError ? (
            <p className="text-sm text-destructive">{limitsError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos que alimentan tu presupuesto</CardTitle>
          <CardDescription>
            Estas pantallas siguen disponibles como fuentes del cálculo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <SourceLink href="/income" icon={Wallet} label="Ingresos registrados" />
          <SourceLink href="/hoa" icon={Building2} label="Expensas" />
          <SourceLink href="/documents" icon={Receipt} label="Importaciones" />
        </CardContent>
      </Card>

      <Dialog open={fixedDialogOpen} onOpenChange={setFixedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar gasto fijo" : "Agregar gasto fijo"}
            </DialogTitle>
            <DialogDescription>
              La estimación queda reservada hasta que registres el importe real.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveFixed} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fixed-name">Nombre</Label>
              <Input
                id="fixed-name"
                value={fixedForm.name}
                onChange={(event) =>
                  setFixedForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Internet"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={fixedForm.category}
                  onValueChange={(category) =>
                    setFixedForm((current) => ({ ...current, category }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fixed-due">Día de vencimiento</Label>
                <Input
                  id="fixed-due"
                  type="text"
                  inputMode="numeric"
                  value={fixedForm.dueDay}
                  onChange={(event) =>
                    setFixedForm((current) => ({
                      ...current,
                      dueDay: event.target.value,
                    }))
                  }
                  placeholder="1–31"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fixed-amount">Importe estimado</Label>
              <Input
                id="fixed-amount"
                type="text"
                inputMode="decimal"
                value={fixedForm.estimatedAmount}
                onChange={(event) =>
                  setFixedForm((current) => ({
                    ...current,
                    estimatedAmount: event.target.value,
                  }))
                }
                placeholder="0,00"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Actualización automática</Label>
                <Select
                  value={fixedForm.sourceType}
                  onValueChange={(sourceType: FixedExpense["sourceType"]) =>
                    setFixedForm((current) => ({
                      ...current,
                      sourceType,
                      sourceKey:
                        sourceType === "manual"
                          ? null
                          : sourceType === "document" &&
                              current.sourceType !== "document"
                            ? null
                            : current.sourceKey,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="document">Boleta importada</SelectItem>
                    <SelectItem value="hoa">Expensas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {fixedForm.sourceType === "document" ? (
                <div className="space-y-2">
                  <Label>Proveedor de la boleta</Label>
                  <Select
                    value={fixedForm.sourceKey ?? AUTO_PROVIDER_VALUE}
                    onValueChange={(sourceKey) =>
                      setFixedForm((current) => ({
                        ...current,
                        sourceKey:
                          sourceKey === AUTO_PROVIDER_VALUE
                            ? null
                            : sourceKey,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO_PROVIDER_VALUE}>
                        Detectar automáticamente
                      </SelectItem>
                      {fixedForm.sourceKey &&
                      !DOCUMENT_PROVIDER_OPTIONS.some(
                        (provider) => provider.providerId === fixedForm.sourceKey
                      ) ? (
                        <SelectItem value={fixedForm.sourceKey}>
                          {fixedForm.sourceKey}
                        </SelectItem>
                      ) : null}
                      {DOCUMENT_PROVIDER_OPTIONS.map((provider) => (
                        <SelectItem
                          key={provider.providerId}
                          value={provider.providerId}
                        >
                          {provider.providerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    En automático usa el nombre y la categoría del gasto fijo
                    para vincular la boleta.
                  </p>
                </div>
              ) : fixedForm.sourceType === "hoa" ? (
                <div className="space-y-2">
                  <Label htmlFor="fixed-source-key">
                    Edificio o unidad (opcional)
                  </Label>
                  <Input
                    id="fixed-source-key"
                    value={fixedForm.sourceKey ?? ""}
                    onChange={(event) =>
                      setFixedForm((current) => ({
                        ...current,
                        sourceKey: event.target.value || null,
                      }))
                    }
                    placeholder="EDIFICIO"
                  />
                </div>
              ) : null}
            </div>
            {fixedError ? (
              <p className="text-sm text-destructive">{fixedError}</p>
            ) : null}
            <Button type="submit" disabled={savingFixed} className="w-full">
              {savingFixed ? "Guardando…" : "Guardar gasto fijo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Wallet;
  label: string;
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start py-4">
      <Link href={href}>
        <Icon className="size-4" /> {label}
      </Link>
    </Button>
  );
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}
