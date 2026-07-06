"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CalendarClock,
  CreditCard as CreditCardIcon,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
} from "lucide-react";

import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  archiveCreditCard,
  createCreditCard,
  createCreditCardCycle,
  createCreditCardPurchase,
  createCreditCardPurchases,
  createCreditCardRecurringExpense,
  updateCreditCard,
} from "@/lib/credit-cards-client";
import {
  buildCreditCardSummaries,
  formatPeriodMonth,
  groupInstallmentsByPeriod,
  suggestNextCycle,
  type CreditCard,
  type CreditCardCycle,
  type CurrencyTotals,
} from "@/lib/credit-card-utils";
import { formatAmount } from "@/lib/format-currency";
import { formatDate } from "@/lib/utils";
import { useCreditCardData } from "@/hooks/use-credit-card-data";
import { CardFormModal } from "./card-form-modal";
import {
  CycleFormModal,
  type CycleFormValue,
} from "./cycle-form-modal";
import {
  PurchaseFormModal,
  type PurchaseFormValue,
} from "./purchase-form-modal";
import { ResponsiveModal } from "./responsive-modal";

export function CreditCardsOverview() {
  const {
    cards,
    cycles,
    purchases,
    recurringExpenses,
    rate,
    rateLoading,
    loading,
    error,
    getToken,
    loadData,
    refreshRate,
  } = useCreditCardData();
  const { showAmounts } = useAmountVisibility();
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cycleCard, setCycleCard] = useState<CreditCard | null>(null);

  const activeCards = cards.filter((card) => card.status === "active");
  const currentPeriod = toLocalPeriodMonth(new Date());
  const today = toLocalIsoDate(new Date());
  const projections = useMemo(
    () => groupInstallmentsByPeriod(purchases, cycles, recurringExpenses, today),
    [cycles, purchases, recurringExpenses, today]
  );
  const cardSummaries = useMemo(
    () =>
      buildCreditCardSummaries(
        cards,
        cycles,
        projections,
        today,
        rate?.price ?? null
      ),
    [cards, cycles, projections, rate?.price, today]
  );
  const timeline = useMemo(
    () => aggregateTimeline(projections, currentPeriod),
    [currentPeriod, projections]
  );

  const handleSaveCard = async (name: string) => {
    const token = await getToken();
    if (editingCard) {
      await updateCreditCard(token, editingCard.id, { name });
    } else {
      await createCreditCard(token, name);
    }
    setEditingCard(null);
    await loadData();
  };

  const handleToggleCardStatus = async (card: CreditCard) => {
    const token = await getToken();
    if (card.status === "active") {
      await archiveCreditCard(token, card.id);
    } else {
      await updateCreditCard(token, card.id, { status: "active" });
    }
    await loadData();
  };

  const handleCreateCycle = async (value: CycleFormValue) => {
    const token = await getToken();
    const cycle = await createCreditCardCycle(token, value);
    await loadData();
    return cycle;
  };

  const handleCreatePurchase = async (value: PurchaseFormValue) => {
    const token = await getToken();
    if (value.repeatsMonthly) {
      await createCreditCardRecurringExpense(token, {
        cardId: value.cardId,
        name: value.name,
        startDate: value.purchaseDate,
        monthlyAmount: value.totalAmount,
        currency: value.currency,
      });
    } else {
      await createCreditCardPurchase(token, {
        cardId: value.cardId,
        name: value.name,
        purchaseDate: value.purchaseDate,
        totalAmount: value.totalAmount,
        currency: value.currency,
        installments: value.installments,
      });
    }
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

  const openCycleModal = (card: CreditCard) => {
    setCycleCard(card);
    setCycleModalOpen(true);
  };

  const latestCycle = cycleCard
    ? cycles
        .filter((cycle) => cycle.cardId === cycleCard.id)
        .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))[0]
    : null;

  if (loading) {
    return <CreditCardsLoading />;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-3xl font-bold">Tarjetas</h1>
          <AmountVisibilityToggle />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            aria-label="Administrar tarjetas"
            title="Administrar tarjetas"
            onClick={() => setManagerOpen(true)}
          >
            <Settings2 />
            <span className="hidden sm:inline">Administrar</span>
          </Button>
          <Button
            className="h-9 w-9 border border-primary px-0 sm:w-auto sm:px-3"
            aria-label="Agregar compra"
            title="Agregar compra"
            onClick={() => setPurchaseModalOpen(true)}
            disabled={activeCards.length === 0}
          >
            <Plus />
            <span className="hidden sm:inline">Agregar compra</span>
          </Button>
        </div>
      </header>

      {error ? (
        <Card>
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Creá tu primera tarjeta</CardTitle>
            <CardDescription>
              Empezá por el nombre que reconocés en el resumen. Después
              configurás su próximo vencimiento y cargás consumos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCardModalOpen(true)}>
              <Plus data-icon="inline-start" />
              Agregar tarjeta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Tus tarjetas</h2>
                <p className="text-sm text-muted-foreground">
                  Abrí una tarjeta para revisar sus meses, cargos y períodos.
                </p>
              </div>
              <RateStatus
                rate={rate}
                loading={rateLoading}
                onRefresh={refreshRate}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cardSummaries.map((summary) => (
                <Card key={summary.card.id}>
                  <CardHeader>
                    <CardTitle className="flex min-w-0 items-center gap-2">
                      <CreditCardIcon className="size-4 shrink-0" />
                      <span className="truncate">{summary.card.name}</span>
                    </CardTitle>
                    <CardDescription>
                      {summary.nextConfirmedCycle
                        ? `Próximo vencimiento: ${formatDate(
                            summary.nextConfirmedCycle.dueDate
                          )}`
                        : summary.confirmedPeriodCount > 0
                          ? "Sin próximos vencimientos confirmados"
                          : "Sin períodos confirmados"}
                    </CardDescription>
                    <CardAction>
                      <Badge
                        variant={
                          summary.card.status === "active"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {summary.card.status === "active"
                          ? "Activa"
                          : "Archivada"}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {summary.nextProjection ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatPeriodMonth(
                            summary.nextProjection.periodMonth
                          )}{" "}
                          estimado
                        </p>
                        <AmountBlock
                          totals={summary.nextProjection.totals}
                          rate={rate?.price ?? null}
                          showAmounts={showAmounts}
                          compact
                          estimatedArs={summary.estimatedNextPeriodArs}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin cargos futuros
                      </p>
                    )}
                    {summary.confirmedPeriodCount > 0 ||
                    summary.futureChargeCount > 0 ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {summary.confirmedPeriodCount > 0 ? (
                          <span>
                            {summary.confirmedPeriodCount}{" "}
                            {summary.confirmedPeriodCount === 1
                              ? "período confirmado"
                              : "períodos confirmados"}
                          </span>
                        ) : null}
                        {summary.futureChargeCount > 0 ? (
                          <span>
                            {summary.futureChargeCount}{" "}
                            {summary.futureChargeCount === 1
                              ? "cargo futuro"
                              : "cargos futuros"}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      asChild
                    >
                      <Link href={`/credit-cards/${summary.card.id}`}>
                        Abrir tarjeta
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">Línea de compromisos</h2>
              <p className="text-sm text-muted-foreground">
                Incluye cuotas y gastos recurrentes proyectados por 12 meses.
              </p>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                La proyección aparecerá cuando cargues compras.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Estado
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        ARS
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        USD
                      </TableHead>
                      <TableHead className="text-right">
                        Total estimado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeline.map((period) => (
                      <TableRow key={period.periodMonth}>
                        <TableCell className="whitespace-normal">
                          <p className="font-medium">
                            {formatPeriodMonth(period.periodMonth)}
                          </p>
                          <div className="mt-1 sm:hidden">
                            <CommitmentStatus
                              confirmedCount={period.confirmedCount}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground md:hidden">
                            {formatAmount(
                              period.totals.ARS,
                              "ARS",
                              showAmounts
                            )}
                            {period.totals.USD > 0
                              ? ` + ${formatAmount(
                                  period.totals.USD,
                                  "USD",
                                  showAmounts
                                )}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <CommitmentStatus
                            confirmedCount={period.confirmedCount}
                          />
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {formatAmount(
                            period.totals.ARS,
                            "ARS",
                            showAmounts
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {formatAmount(
                            period.totals.USD,
                            "USD",
                            showAmounts
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(
                            calculateEstimatedArs(
                              period.totals,
                              rate?.price ?? null
                            ),
                            "ARS",
                            showAmounts
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

        </>
      )}

      <ResponsiveModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        title="Administrar tarjetas"
        description="Creá tarjetas, configurá períodos o archivá las que ya no usás."
        contentClassName="sm:max-w-[680px]"
      >
        <div className="flex flex-col gap-4 pt-2">
          <Button
            className="self-start"
            onClick={() => {
              setEditingCard(null);
              setCardModalOpen(true);
            }}
          >
            <Plus data-icon="inline-start" />
            Agregar tarjeta
          </Button>
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{card.name}</p>
                <p className="text-xs text-muted-foreground">
                  {card.status === "active" ? "Activa" : "Archivada"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {card.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCycleModal(card)}
                  >
                    <CalendarClock data-icon="inline-start" />
                    Período
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingCard(card);
                    setCardModalOpen(true);
                  }}
                >
                  <Pencil data-icon="inline-start" />
                  Renombrar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleCardStatus(card)}
                >
                  {card.status === "active" ? (
                    <Archive data-icon="inline-start" />
                  ) : (
                    <RotateCcw data-icon="inline-start" />
                  )}
                  {card.status === "active" ? "Archivar" : "Reactivar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ResponsiveModal>

      <CardFormModal
        open={cardModalOpen}
        onOpenChange={(open) => {
          setCardModalOpen(open);
          if (!open) setEditingCard(null);
        }}
        card={editingCard}
        onSave={handleSaveCard}
      />
      <CycleFormModal
        open={cycleModalOpen}
        onOpenChange={(open) => {
          setCycleModalOpen(open);
          if (!open) setCycleCard(null);
        }}
        card={cycleCard}
        initialValue={latestCycle ? suggestNextCycle(latestCycle) : undefined}
        onSave={async (value) => {
          await handleCreateCycle(value);
        }}
      />
      <PurchaseFormModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        cards={activeCards}
        onSave={handleCreatePurchase}
        onSaveMany={handleCreatePurchases}
      />
    </div>
  );
}

function CreditCardsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-20 w-full max-w-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

function RateStatus({
  rate,
  loading,
  onRefresh,
}: {
  rate: { price: number; updatedAt: string } | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        {rate
          ? `USD estimado con Binance P2P: ${formatAmount(rate.price)} · ${new Date(
              rate.updatedAt
            ).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Cotización Binance P2P no disponible"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Actualizar cotización"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={loading ? "animate-spin" : undefined} />
      </Button>
    </div>
  );
}

function AmountBlock({
  totals,
  rate,
  showAmounts,
  compact = false,
  estimatedArs: estimatedArsOverride,
}: {
  totals: CurrencyTotals;
  rate: number | null;
  showAmounts: boolean;
  compact?: boolean;
  estimatedArs?: number | null;
}) {
  const estimatedArs =
    estimatedArsOverride ?? calculateEstimatedArs(totals, rate);
  return (
    <div className="flex flex-col gap-1">
      <p className={compact ? "text-lg font-semibold" : "text-2xl font-bold"}>
        {formatAmount(estimatedArs, "ARS", showAmounts)}
      </p>
      <p className="text-xs text-muted-foreground">
        {totals.ARS > 0
          ? `${formatAmount(totals.ARS, "ARS", showAmounts)} en pesos`
          : "Sin consumos en pesos"}
      </p>
      {totals.USD > 0 ? (
        <p className="text-xs text-amber-500">
          + {formatAmount(totals.USD, "USD", showAmounts)}
          {rate ? " estimados con P2P" : " sin estimación P2P"}
        </p>
      ) : null}
    </div>
  );
}

function CommitmentStatus({ confirmedCount }: { confirmedCount: number }) {
  return confirmedCount > 0 ? (
    <Badge variant="outline">{confirmedCount} confirm.</Badge>
  ) : (
    <Badge variant="outline">Proyectado</Badge>
  );
}

function calculateEstimatedArs(totals: CurrencyTotals, rate: number | null) {
  return totals.ARS + (rate ? totals.USD * rate : 0);
}

function aggregateTimeline(
  projections: ReturnType<typeof groupInstallmentsByPeriod>,
  currentPeriod: string
) {
  const monthTotals = new Map<
    string,
    { periodMonth: string; totals: CurrencyTotals; confirmedCount: number }
  >();
  for (const projection of projections) {
    if (projection.periodMonth < currentPeriod) continue;
    const month = monthTotals.get(projection.periodMonth) ?? {
      periodMonth: projection.periodMonth,
      totals: { ARS: 0, USD: 0 },
      confirmedCount: 0,
    };
    month.totals.ARS += projection.totals.ARS;
    month.totals.USD += projection.totals.USD;
    if (projection.cycle) month.confirmedCount += 1;
    monthTotals.set(projection.periodMonth, month);
  }
  return Array.from(monthTotals.values()).sort((a, b) =>
    a.periodMonth.localeCompare(b.periodMonth)
  );
}

function toLocalPeriodMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toLocalIsoDate(date: Date) {
  return `${toLocalPeriodMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}
