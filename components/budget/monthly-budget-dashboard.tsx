"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Gauge,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  fetchMonthlyBudget,
  saveMonthlyBudget,
  updateFixedExpensePeriod,
} from "@/lib/budget-client";
import { getArgentinaDateParts, type FixedExpenseSummary, type MonthlyBudgetSummary } from "@/lib/budget";
import { formatAmount } from "@/lib/format-currency";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { BudgetPlanForm } from "@/components/budget/budget-plan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STATUS_COPY = {
  good: {
    label: "Vas bien",
    description: "Tu ritmo de gasto cuida el ahorro que reservaste.",
    className: "bg-emerald-400 text-emerald-950",
  },
  tight: {
    label: "Estás justo",
    description: "Conviene bajar el ritmo para llegar cómodo a fin de mes.",
    className: "bg-amber-300 text-amber-950",
  },
  over: {
    label: "Te estás pasando",
    description: "El gasto actual ya compromete tu objetivo del mes.",
    className: "bg-rose-400 text-rose-950",
  },
  incomplete: {
    label: "Datos incompletos",
    description: "Completá el plan o revisá las fuentes pendientes.",
    className: "bg-slate-300 text-slate-900",
  },
} as const;

export function MonthlyBudgetDashboard() {
  const { user } = useAuth();
  const { showAmounts } = useAmountVisibility();
  const month = useMemo(() => getArgentinaDateParts().periodMonth, []);
  const [summary, setSummary] = useState<MonthlyBudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [payingExpense, setPayingExpense] =
    useState<FixedExpenseSummary | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      setSummary(await fetchMonthlyBudget(token, month));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar tu presupuesto"
      );
    } finally {
      setLoading(false);
    }
  }, [month, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlan(value: {
    expectedIncome: number;
    savingsMode: "fixed" | "percentage";
    savingsValue: number;
  }) {
    if (!user) return;
    const token = await user.getIdToken();
    setSummary(await saveMonthlyBudget(token, month, value));
    setPlanOpen(false);
  }

  async function savePayment() {
    if (!user || !payingExpense) return;
    const actualAmount = Number(paidAmount);
    if (!Number.isFinite(actualAmount) || actualAmount < 0) return;
    setSavingPayment(true);
    try {
      const token = await user.getIdToken();
      setSummary(
        await updateFixedExpensePeriod(token, payingExpense.id, month, {
          status: "paid",
          actualAmount,
          sourceType: "manual",
        })
      );
      setPayingExpense(null);
    } finally {
      setSavingPayment(false);
    }
  }

  if (!user || loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto size-10 animate-pulse rounded-full bg-primary/20" />
          <p className="text-sm text-muted-foreground">Calculando tu mes…</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <CardContent className="space-y-4 text-center">
          <AlertTriangle className="mx-auto size-8 text-destructive" />
          <p>{error ?? "No se pudo calcular el presupuesto"}</p>
          <Button onClick={() => void load()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary.configured) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 py-6">
        <div className="space-y-3">
          <Badge variant="outline" className="gap-2">
            <Sparkles className="size-3" /> Nueva forma de usar Tolva
          </Badge>
          <h1 className="max-w-2xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            Primero reservamos. Después decidimos cuánto gastar.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Configurá este mes para que Tolva pueda mostrarte un número útil
            antes de cada compra.
          </p>
        </div>
        <Card className="border-primary/20 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Plan de {formatMonth(month)}</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetPlanForm
              initialValue={{
                expectedIncome: summary.amounts.expectedIncome,
                savingsMode: "percentage",
                savingsValue: 20,
              }}
              onSave={savePlan}
              submitLabel="Empezar mi mes"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = STATUS_COPY[summary.status];

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {formatMonth(month)}
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-[-0.035em]">Mi mes</h1>
            <AmountVisibilityToggle />
          </div>
        </div>
        <Button variant="outline" onClick={() => setPlanOpen(true)}>
          <Pencil className="size-4" /> Editar plan
        </Button>
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/15 sm:p-8">
        <div className="absolute -right-16 -top-24 size-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Badge className={cn("mb-5 border-0", status.className)}>
              {summary.status === "good" ? (
                <Check className="size-3" />
              ) : (
                <Gauge className="size-3" />
              )}
              {status.label}
            </Badge>
            <p className="text-sm text-slate-400">Disponible real</p>
            <p className="mt-1 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              {formatAmount(summary.amounts.available, "ARS", showAmounts)}
            </p>
            <p className="mt-4 max-w-md text-sm text-slate-300">
              {status.description}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="text-sm text-slate-400">Podés gastar</p>
            <p className="mt-1 text-3xl font-black text-emerald-300">
              {formatAmount(
                Math.max(0, summary.amounts.dailyAvailable),
                "ARS",
                showAmounts
              )}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              por día · quedan {summary.daysRemaining} días
            </p>
          </div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-5">
          <Metric
            label="Ingreso"
            value={summary.amounts.expectedIncome}
            show={showAmounts}
          />
          <Metric
            label="Ahorro reservado"
            value={summary.amounts.savingsReserved}
            show={showAmounts}
          />
          <Metric
            label="Fijos"
            value={summary.amounts.fixedCommitted}
            show={showAmounts}
          />
          <Metric
            label="Cuotas"
            value={summary.amounts.cardCommitted}
            show={showAmounts}
          />
          <Metric
            label="Variables"
            value={summary.amounts.variableSpent}
            show={showAmounts}
          />
        </div>
      </section>

      {summary.dataQuality.missingSources.length > 0 ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
          Falta: {summary.dataQuality.missingSources.join(", ")}. Los totales
          pueden estar incompletos.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Límites variables</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lo que todavía podés ajustar durante el mes.
                </p>
              </div>
              <Link
                href="/settings#limits"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Configurar
              </Link>
            </CardHeader>
            <CardContent className="space-y-5">
              {summary.limits.length === 0 ? (
                <EmptyLine
                  text="Todavía no definiste límites por categoría."
                  href="/settings#limits"
                />
              ) : (
                summary.limits.map((limit) => (
                  <div key={limit.category} className="space-y-2">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="font-semibold">{limit.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatAmount(
                            limit.spentAmount,
                            "ARS",
                            showAmounts
                          )}{" "}
                          de{" "}
                          {formatAmount(
                            limit.limitAmount,
                            "ARS",
                            showAmounts
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-bold",
                          limit.percentageUsed >= 100
                            ? "text-destructive"
                            : limit.percentageUsed >= 80
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        )}
                      >
                        {limit.percentageUsed}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, limit.percentageUsed)}
                      className={cn(
                        limit.percentageUsed >= 100 &&
                          "[&_[data-slot=progress-indicator]]:bg-destructive",
                        limit.percentageUsed >= 80 &&
                          limit.percentageUsed < 100 &&
                          "[&_[data-slot=progress-indicator]]:bg-amber-500"
                      )}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos fijos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.fixedExpenses.length === 0 ? (
                <EmptyLine
                  text="Agregá tus servicios y pagos recurrentes."
                  href="/settings#fixed-expenses"
                />
              ) : (
                summary.fixedExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full",
                          expense.status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : expense.overdue
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {expense.status === "paid" ? (
                          <Check className="size-4" />
                        ) : (
                          <ReceiptText className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{expense.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.status === "paid"
                            ? "Pagado"
                            : expense.dueDay
                              ? `Vence el día ${expense.dueDay}`
                              : "Pendiente"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="font-bold">
                        {formatAmount(
                          expense.budgetedAmount,
                          "ARS",
                          showAmounts
                        )}
                      </span>
                      {expense.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPaidAmount(String(expense.estimatedAmount));
                            setPayingExpense(expense);
                          }}
                        >
                          Marcar pagado
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/[0.035]">
            <CardHeader>
              <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <WalletCards className="size-5" />
              </div>
              <CardTitle>Próximo sueldo comprometido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight">
                {formatAmount(
                  summary.amounts.nextMonthCardCommitted,
                  "ARS",
                  showAmounts
                )}
              </p>
              {summary.amounts.nextMonthCardCommittedUsd > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Incluye USD{" "}
                  {summary.amounts.nextMonthCardCommittedUsd.toFixed(2)}
                </p>
              ) : null}
              <Button asChild variant="link" className="mt-3 h-auto p-0">
                <Link href="/credit-cards">
                  Ver cuotas <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Para tener en cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.alerts.length === 0 ? (
                <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                  <p className="text-sm">
                    No hay alertas accionables por ahora.
                  </p>
                </div>
              ) : (
                summary.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-xl border-l-4 p-4",
                      alert.severity === "danger"
                        ? "border-l-destructive bg-destructive/5"
                        : alert.severity === "warning"
                          ? "border-l-amber-500 bg-amber-500/5"
                          : "border-l-sky-500 bg-sky-500/5"
                    )}
                  >
                    <p className="text-sm font-bold">{alert.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {alert.description}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar plan mensual</DialogTitle>
            <DialogDescription>
              Cambia el presupuesto de {formatMonth(month)} y tus valores base.
            </DialogDescription>
          </DialogHeader>
          <BudgetPlanForm
            initialValue={{
              expectedIncome: summary.plan.expectedIncome,
              savingsMode: summary.plan.savingsMode,
              savingsValue: summary.plan.savingsValue,
            }}
            onSave={savePlan}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(payingExpense)}
        onOpenChange={(open) => !open && setPayingExpense(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              El importe real reemplazará la estimación de{" "}
              {payingExpense?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="paid-amount">Importe pagado</Label>
            <Input
              id="paid-amount"
              inputMode="decimal"
              value={paidAmount}
              onChange={(event) => setPaidAmount(event.target.value)}
            />
          </div>
          <Button onClick={() => void savePayment()} disabled={savingPayment}>
            {savingPayment ? "Guardando…" : "Confirmar pago"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  show,
}: {
  label: string;
  value: number;
  show: boolean;
}) {
  return (
    <div className="bg-slate-950/80 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-100">
        {formatAmount(value, "ARS", show)}
      </p>
    </div>
  );
}

function EmptyLine({ text, href }: { text: string; href: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>Configurar</Link>
      </Button>
    </div>
  );
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
