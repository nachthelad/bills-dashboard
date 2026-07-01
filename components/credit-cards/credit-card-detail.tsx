"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCreditCardCycle,
  createCreditCardPurchase,
  createCreditCardPurchases,
  createCreditCardRecurringExpense,
  deleteCreditCardCycle,
  deleteCreditCardPurchase,
  finishCreditCardRecurringExpense,
  updateCreditCardCycle,
  updateCreditCardPurchase,
  updateCreditCardRecurringExpense,
} from "@/lib/credit-cards-client";
import {
  formatPeriodMonth,
  groupInstallmentsByPeriod,
  suggestNextCycle,
  type CreditCardCycle,
  type CreditCardPurchase,
  type CreditCardRecurringExpense,
} from "@/lib/credit-card-utils";
import { formatAmount } from "@/lib/format-currency";
import { formatDate } from "@/lib/utils";
import { getLocalTodayIso } from "@/lib/date-picker";
import { useCreditCardData } from "@/hooks/use-credit-card-data";
import {
  CycleFormModal,
  type CycleFormValue,
} from "./cycle-form-modal";
import {
  PurchaseFormModal,
  type PurchaseFormValue,
} from "./purchase-form-modal";

export function CreditCardDetail({ cardId }: { cardId: string }) {
  const {
    cards,
    cycles,
    purchases,
    recurringExpenses,
    rate,
    loading,
    error,
    getToken,
    loadData,
  } = useCreditCardData();
  const { showAmounts } = useAmountVisibility();
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<CreditCardCycle | null>(null);
  const [editingPurchase, setEditingPurchase] =
    useState<CreditCardPurchase | null>(null);
  const [editingRecurringExpense, setEditingRecurringExpense] =
    useState<CreditCardRecurringExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "purchase"; id: string }
    | { type: "recurring"; id: string }
    | { type: "cycle"; id: string }
    | null
  >(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedProjection, setExpandedProjection] = useState<string | null>(
    null
  );
  const [showPastProjections, setShowPastProjections] = useState(false);

  const card = cards.find((candidate) => candidate.id === cardId) ?? null;
  const cardCycles = cycles
    .filter((cycle) => cycle.cardId === cardId)
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));
  const cardPurchases = purchases
    .filter((purchase) => purchase.cardId === cardId)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  const cardRecurringExpenses = recurringExpenses.filter(
    (expense) => expense.cardId === cardId
  );
  const activeRecurringExpenseIds = new Set(
    cardRecurringExpenses
      .filter((expense) => !expense.endDate)
      .map((expense) => expense.id)
  );
  const today = getLocalTodayIso();
  const projections = useMemo(
    () =>
      groupInstallmentsByPeriod(
        cardPurchases,
        cardCycles,
        cardRecurringExpenses,
        today
      ),
    [cardCycles, cardPurchases, cardRecurringExpenses, today]
  );
  const currentPeriod = today.slice(0, 7);
  const isPastProjection = (projection: (typeof projections)[number]) =>
    projection.cycle
      ? projection.cycle.dueDate < today
      : projection.periodMonth < currentPeriod;
  const pastProjectionCount = projections.filter(isPastProjection).length;
  const visibleProjections = showPastProjections
    ? projections
    : projections.filter((projection) => !isPastProjection(projection));
  const latestCycle = cardCycles[0] ?? null;
  const toggleProjection = (projectionKey: string) => {
    setExpandedProjection((current) =>
      current === projectionKey ? null : projectionKey
    );
  };

  const handleSaveCycle = async (value: CycleFormValue) => {
    const token = await getToken();
    if (editingCycle) {
      await updateCreditCardCycle(token, editingCycle.id, {
        closingDate: value.closingDate,
        dueDate: value.dueDate,
      });
    } else {
      await createCreditCardCycle(token, value);
    }
    setEditingCycle(null);
    await loadData();
  };

  const handleSavePurchase = async (value: PurchaseFormValue) => {
    const token = await getToken();
    const purchaseInput = {
      cardId: value.cardId,
      name: value.name,
      purchaseDate: value.purchaseDate,
      totalAmount: value.totalAmount,
      currency: value.currency,
      installments: value.installments,
    };
    if (editingRecurringExpense) {
      await updateCreditCardRecurringExpense(
        token,
        editingRecurringExpense.id,
        {
          name: value.name,
          monthlyAmount: value.totalAmount,
          currency: value.currency,
        }
      );
    } else if (editingPurchase) {
      await updateCreditCardPurchase(token, editingPurchase.id, purchaseInput);
    } else if (value.repeatsMonthly) {
      await createCreditCardRecurringExpense(token, {
        cardId: value.cardId,
        name: value.name,
        startDate: value.purchaseDate,
        monthlyAmount: value.totalAmount,
        currency: value.currency,
      });
    } else {
      await createCreditCardPurchase(token, purchaseInput);
    }
    setEditingPurchase(null);
    setEditingRecurringExpense(null);
    await loadData();
  };

  const handleCreatePurchases = async (values: PurchaseFormValue[]) => {
    const token = await getToken();
    const purchases = values
      .filter((value) => !value.repeatsMonthly)
      .map(({ repeatsMonthly: _repeatsMonthly, ...value }) => value);
    const recurring = values.filter((value) => value.repeatsMonthly);
    await Promise.all([
      purchases.length
        ? createCreditCardPurchases(token, purchases)
        : Promise.resolve([]),
      ...recurring.map((value) =>
        createCreditCardRecurringExpense(token, {
          cardId: value.cardId,
          name: value.name,
          startDate: value.purchaseDate,
          monthlyAmount: value.totalAmount,
          currency: value.currency,
        })
      ),
    ]);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const token = await getToken();
      if (deleteTarget.type === "purchase") {
        await deleteCreditCardPurchase(token, deleteTarget.id);
      } else if (deleteTarget.type === "recurring") {
        await finishCreditCardRecurringExpense(token, deleteTarget.id);
      } else {
        await deleteCreditCardCycle(token, deleteTarget.id);
      }
      setDeleteTarget(null);
      await loadData();
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-20 w-full max-w-lg" />
        <Skeleton className="h-44" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="self-start" asChild>
          <Link href="/credit-cards">
            <ArrowLeft data-icon="inline-start" />
            Volver a tarjetas
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Tarjeta no encontrada</CardTitle>
            <CardDescription>
              No existe o no pertenece a tu cuenta.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Button variant="ghost" className="self-start" asChild>
          <Link href="/credit-cards">
            <ArrowLeft data-icon="inline-start" />
            Volver a tarjetas
          </Link>
        </Button>
      </header>

      <div className="sticky top-0 z-20 -mx-6 flex items-start justify-between gap-3 bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-3xl font-bold">{card.name}</h1>
            <AmountVisibilityToggle />
          </div>
          <Badge
            className="self-start"
            variant={card.status === "active" ? "secondary" : "outline"}
          >
            {card.status === "active" ? "Activa" : "Archivada"}
          </Badge>
        </div>
        {card.status === "active" ? (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              aria-label="Agregar período"
              title="Agregar período"
              onClick={() => {
                setEditingCycle(null);
                setCycleModalOpen(true);
              }}
            >
              <CalendarClock />
              <span className="hidden sm:inline">Agregar período</span>
            </Button>
            <Button
              className="h-9 w-9 border border-primary px-0 sm:w-auto sm:px-3"
              aria-label="Agregar compra"
              title="Agregar compra"
              onClick={() => {
                setEditingPurchase(null);
                setPurchaseModalOpen(true);
              }}
            >
              <Plus />
              <span className="hidden sm:inline">Agregar compra</span>
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Cuotas proyectadas</h2>
            <p className="text-sm text-muted-foreground">
              Incluye cuotas y gastos recurrentes; los meses sin vencimiento
              siguen visibles como proyección.
            </p>
          </div>
          {pastProjectionCount > 0 ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={showPastProjections}
                onCheckedChange={setShowPastProjections}
              />
              Mostrar anteriores ({pastProjectionCount})
            </label>
          ) : null}
        </div>
        {projections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-sm text-muted-foreground">
              Todavía no hay cuotas para mostrar.
            </CardContent>
          </Card>
        ) : visibleProjections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cuotas futuras. Activá “Mostrar anteriores” para revisar el
            historial.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Vencimiento
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">
                    ARS
                  </TableHead>
                  <TableHead className="hidden text-right lg:table-cell">
                    USD
                  </TableHead>
                  <TableHead className="text-right">Total estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProjections.map((projection) => {
                  const projectionKey = `${projection.cardId}_${projection.periodMonth}`;
                  const projectionDetailsId = `projection-details-${projection.cardId}-${projection.periodMonth}`;
                  const expanded = expandedProjection === projectionKey;
                  const estimatedArs =
                    projection.totals.ARS +
                    (rate?.price ? projection.totals.USD * rate.price : 0);

                  return (
                    <Fragment key={projectionKey}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleProjection(projectionKey)}
                      >
                        <TableCell className="whitespace-normal">
                          <div className="flex items-start gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="-ml-2 shrink-0 hover:bg-transparent hover:text-inherit dark:hover:bg-transparent"
                              aria-label={
                                expanded
                                  ? "Ocultar detalle de cuotas"
                                  : "Mostrar detalle de cuotas"
                              }
                              aria-expanded={expanded}
                              aria-controls={projectionDetailsId}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleProjection(projectionKey);
                              }}
                            >
                              <ChevronRight
                                className={
                                  expanded
                                    ? "rotate-90 transition-transform"
                                    : "transition-transform"
                                }
                              />
                            </Button>
                            <div>
                              <p className="font-medium">
                                {formatPeriodMonth(projection.periodMonth)}
                              </p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {projection.cycle
                                  ? `Vence ${formatDate(
                                      projection.cycle.dueDate
                                    )}`
                                  : "Vencimiento por configurar"}
                              </p>
                              <div className="mt-1 sm:hidden">
                                <Badge variant="outline">
                                  {projection.cycle
                                    ? "Confirmado"
                                    : "Proyectado"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground lg:hidden">
                                {formatAmount(
                                  projection.totals.ARS,
                                  "ARS",
                                  showAmounts
                                )}
                                {projection.totals.USD > 0
                                  ? ` + ${formatAmount(
                                      projection.totals.USD,
                                      "USD",
                                      showAmounts
                                    )}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {projection.cycle
                            ? formatDate(projection.cycle.dueDate)
                            : "Por configurar"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline">
                            {projection.cycle ? "Confirmado" : "Proyectado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-right lg:table-cell">
                          {formatAmount(
                            projection.totals.ARS,
                            "ARS",
                            showAmounts
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right lg:table-cell">
                          {formatAmount(
                            projection.totals.USD,
                            "USD",
                            showAmounts
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(estimatedArs, "ARS", showAmounts)}
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow
                          id={projectionDetailsId}
                          className="hover:bg-transparent"
                        >
                          <TableCell
                            colSpan={6}
                            className="bg-muted/20 p-0 whitespace-normal"
                          >
                            <div className="divide-y px-4 py-1">
                              {projection.installments.map((installment) => (
                                <div
                                  key={
                                    installment.kind === "installment"
                                      ? `${installment.purchaseId}_${installment.installmentNumber}`
                                      : `${installment.recurringExpenseId}_${installment.purchaseDate}`
                                  }
                                  className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                                >
                                  <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <span className="shrink-0 text-muted-foreground">
                                      {formatDate(installment.purchaseDate)}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {installment.purchaseName} ·{" "}
                                      {installment.kind === "installment"
                                        ? `cuota ${installment.installmentNumber}/${installment.installmentCount}`
                                        : "Recurrente"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                                    <span className="shrink-0 font-medium">
                                      {formatAmount(
                                        installment.amount,
                                        installment.currency,
                                        showAmounts
                                      )}
                                    </span>
                                    {installment.kind === "installment" ||
                                    activeRecurringExpenseIds.has(
                                      installment.recurringExpenseId
                                    ) ? (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label={`Editar ${
                                            installment.kind === "recurring"
                                              ? "gasto recurrente"
                                              : "compra"
                                          } ${installment.purchaseName}`}
                                          onClick={() => {
                                            if (
                                              installment.kind === "recurring"
                                            ) {
                                              const expense =
                                                cardRecurringExpenses.find(
                                                  (candidate) =>
                                                    candidate.id ===
                                                    installment.recurringExpenseId
                                                );
                                              if (!expense) return;
                                              setEditingRecurringExpense(
                                                expense
                                              );
                                            } else {
                                              const purchase =
                                                cardPurchases.find(
                                                  (candidate) =>
                                                    candidate.id ===
                                                    installment.purchaseId
                                                );
                                              if (!purchase) return;
                                              setEditingPurchase(purchase);
                                            }
                                            setPurchaseModalOpen(true);
                                          }}
                                        >
                                          <Pencil />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label={`${
                                            installment.kind === "recurring"
                                              ? "Finalizar gasto recurrente"
                                              : "Eliminar compra"
                                          } ${installment.purchaseName}`}
                                          onClick={() =>
                                            setDeleteTarget({
                                              type:
                                                installment.kind === "recurring"
                                                  ? "recurring"
                                                  : "purchase",
                                              id:
                                                installment.kind === "recurring"
                                                  ? installment.recurringExpenseId
                                                  : installment.purchaseId,
                                            })
                                          }
                                        >
                                          <Trash2 />
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Períodos confirmados</h2>
          <p className="text-sm text-muted-foreground">
            Cierre y vencimiento informados por la tarjeta para cada mes.
          </p>
        </div>
        {cardCycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no configuraste períodos.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {cardCycles.map((cycle) => (
              <Card key={cycle.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {formatPeriodMonth(cycle.periodMonth)}
                  </CardTitle>
                  <CardDescription>
                    Cierra {formatDate(cycle.closingDate)} · Vence{" "}
                    {formatDate(cycle.dueDate)}
                  </CardDescription>
                  <CardAction>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar período"
                        onClick={() => {
                          setEditingCycle(cycle);
                          setCycleModalOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar período"
                        onClick={() =>
                          setDeleteTarget({ type: "cycle", id: cycle.id })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardAction>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      <CycleFormModal
        open={cycleModalOpen}
        onOpenChange={(open) => {
          setCycleModalOpen(open);
          if (!open) setEditingCycle(null);
        }}
        card={card}
        cycle={editingCycle}
        initialValue={
          !editingCycle && latestCycle ? suggestNextCycle(latestCycle) : undefined
        }
        onSave={handleSaveCycle}
      />
      <PurchaseFormModal
        open={purchaseModalOpen}
        onOpenChange={(open) => {
          setPurchaseModalOpen(open);
          if (!open) {
            setEditingPurchase(null);
            setEditingRecurringExpense(null);
          }
        }}
        cards={[card]}
        purchase={editingPurchase}
        recurringExpense={editingRecurringExpense}
        initialCardId={card.id}
        onSave={handleSavePurchase}
        onSaveMany={handleCreatePurchases}
      />
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "recurring"
                ? "¿Finalizar gasto recurrente?"
                : `¿Eliminar ${
                    deleteTarget?.type === "cycle" ? "período" : "compra"
                  }?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "cycle"
                ? "Las cuotas conservarán su proyección, pero este vencimiento dejará de figurar como confirmado."
                : deleteTarget?.type === "recurring"
                  ? "Los cobros hasta hoy conservarán su historial y los futuros dejarán de proyectarse."
                : "La compra dejará de aparecer en todas sus cuotas proyectadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading
                ? deleteTarget?.type === "recurring"
                  ? "Finalizando..."
                  : "Eliminando..."
                : deleteTarget?.type === "recurring"
                  ? "Finalizar"
                  : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
