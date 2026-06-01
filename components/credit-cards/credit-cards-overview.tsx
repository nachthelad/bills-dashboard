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
  updateCreditCard,
} from "@/lib/credit-cards-client";
import {
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
  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );
  const projections = useMemo(
    () => groupInstallmentsByPeriod(purchases, cycles),
    [cycles, purchases]
  );
  const currentPeriod = toLocalPeriodMonth(new Date());
  const today = toLocalIsoDate(new Date());
  const upcoming = projections
    .filter(
      (projection) =>
        projection.cycle && projection.cycle.dueDate >= today
    )
    .sort((a, b) =>
      (a.cycle?.dueDate ?? "").localeCompare(b.cycle?.dueDate ?? "")
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
    await createCreditCardPurchase(token, value);
    await loadData();
  };

  const handleCreatePurchases = async (values: PurchaseFormValue[]) => {
    const token = await getToken();
    await createCreditCardPurchases(token, values);
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Tarjetas</h1>
            <AmountVisibilityToggle />
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Anticipá próximos vencimientos y cuotas futuras sin mezclar estos
            consumos con tus gastos diarios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setManagerOpen(true)}>
            <Settings2 data-icon="inline-start" />
            Administrar
          </Button>
          <Button
            onClick={() => setPurchaseModalOpen(true)}
            disabled={activeCards.length === 0}
          >
            <Plus data-icon="inline-start" />
            Agregar compra
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
                <h2 className="text-xl font-semibold">Próximos vencimientos</h2>
                <p className="text-sm text-muted-foreground">
                  Lo que necesitás cubrir, ordenado por fecha.
                </p>
              </div>
              <RateStatus
                rate={rate}
                loading={rateLoading}
                onRefresh={refreshRate}
              />
            </div>
            {upcoming.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <p>
                    Todavía no hay vencimientos con compras proyectadas.
                    Configurá un período y cargá tu primera compra.
                  </p>
                  <Button
                    variant="outline"
                    className="self-start"
                    onClick={() => setManagerOpen(true)}
                  >
                    Administrar tarjetas
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {upcoming.map((projection) => {
                  const card = cardById.get(projection.cardId);
                  const cycle = projection.cycle;
                  if (!card || !cycle) return null;
                  return (
                    <Card key={`${projection.cardId}_${projection.periodMonth}`}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CreditCardIcon className="size-4" />
                          {card.name}
                        </CardTitle>
                        <CardDescription>
                          Cierra {formatDate(cycle.closingDate)} · Vence{" "}
                          {formatDate(cycle.dueDate)}
                        </CardDescription>
                        <CardAction>
                          <Badge variant="outline">
                            {formatPeriodMonth(projection.periodMonth)}
                          </Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <AmountBlock
                          totals={projection.totals}
                          rate={rate?.price ?? null}
                          showAmounts={showAmounts}
                        />
                        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>
                            {projection.installments.length}{" "}
                            {projection.installments.length === 1
                              ? "cuota"
                              : "cuotas"}
                          </span>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/credit-cards/${card.id}`}>
                              Ver detalle
                              <ArrowRight data-icon="inline-end" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">Línea de compromisos</h2>
              <p className="text-sm text-muted-foreground">
                Se extiende hasta terminar la cuota más larga registrada.
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

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">Tus tarjetas</h2>
              <p className="text-sm text-muted-foreground">
                Abrí una tarjeta para revisar compras y períodos.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <Card key={card.id}>
                  <CardHeader>
                    <CardTitle>{card.name}</CardTitle>
                    <CardDescription>
                      {card.status === "archived"
                        ? "Archivada: conserva historial y cuotas pendientes."
                        : "Activa para nuevas compras."}
                    </CardDescription>
                    <CardAction>
                      <Badge
                        variant={
                          card.status === "active" ? "secondary" : "outline"
                        }
                      >
                        {card.status === "active" ? "Activa" : "Archivada"}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/credit-cards/${card.id}`}>
                        Abrir detalle
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
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
}: {
  totals: CurrencyTotals;
  rate: number | null;
  showAmounts: boolean;
  compact?: boolean;
}) {
  const estimatedArs = calculateEstimatedArs(totals, rate);
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
