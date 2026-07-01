"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { parseCreditCardStatement } from "@/lib/credit-card-statement-parser";
import { parseAmountInput } from "@/lib/amount-parser";
import { getLocalTodayIso } from "@/lib/date-picker";
import { formatAmount } from "@/lib/format-currency";
import { formatDate } from "@/lib/utils";
import type {
  CreditCard,
  CreditCardCurrency,
  CreditCardPurchase,
  CreditCardRecurringExpense,
} from "@/lib/credit-card-utils";
import { ResponsiveModal } from "./responsive-modal";

export type PurchaseFormValue = {
  cardId: string;
  name: string;
  purchaseDate: string;
  totalAmount: number;
  currency: CreditCardCurrency;
  installments: number;
  repeatsMonthly: boolean;
};

type PurchaseFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: CreditCard[];
  purchase?: CreditCardPurchase | null;
  recurringExpense?: CreditCardRecurringExpense | null;
  initialCardId?: string;
  onSave: (value: PurchaseFormValue) => Promise<void>;
  onSaveMany: (values: PurchaseFormValue[]) => Promise<void>;
};

export function PurchaseFormModal({
  open,
  onOpenChange,
  cards,
  purchase,
  recurringExpense,
  initialCardId,
  onSave,
  onSaveMany,
}: PurchaseFormModalProps) {
  const [form, setForm] = useState({
    cardId: "",
    name: "",
    purchaseDate: getLocalTodayIso(),
    totalAmount: "",
    currency: "ARS" as CreditCardCurrency,
    installments: "1",
    repeatsMonthly: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const recurringVersion = recurringExpense?.versions.at(-1);
    const cardId =
      purchase?.cardId ??
      recurringExpense?.cardId ??
      initialCardId ??
      cards[0]?.id ??
      "";
    setForm({
      cardId,
      name: purchase?.name ?? recurringVersion?.name ?? "",
      purchaseDate:
        purchase?.purchaseDate ??
        recurringExpense?.startDate ??
        getLocalTodayIso(),
      totalAmount: purchase
        ? String(purchase.totalAmount)
        : recurringVersion
          ? String(recurringVersion.monthlyAmount)
          : "",
      currency: purchase?.currency ?? recurringVersion?.currency ?? "ARS",
      installments: purchase ? String(purchase.installments) : "1",
      repeatsMonthly: Boolean(recurringExpense),
    });
    setError(null);
  }, [cards, initialCardId, open, purchase, recurringExpense]);

  const savePurchase = async (keepOpen: boolean) => {
    const totalAmount = parseAmountInput(form.totalAmount);
    const installments = Number(form.installments);
    if (
      !form.cardId ||
      !form.name.trim() ||
      !form.purchaseDate ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0 ||
      !Number.isInteger(installments) ||
      installments <= 0 ||
      (form.repeatsMonthly && installments !== 1)
    ) {
      setError("Completá los datos de la compra.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave({
        cardId: form.cardId,
        name: form.name.trim(),
        purchaseDate: form.purchaseDate,
        totalAmount,
        currency: form.currency,
        installments,
        repeatsMonthly: form.repeatsMonthly,
      });
      if (keepOpen) {
        setForm((current) => ({
          ...current,
          name: "",
          totalAmount: "",
        }));
        setTimeout(() => nameRef.current?.focus(), 0);
      } else {
        onOpenChange(false);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await savePurchase(false);
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        recurringExpense
          ? "Editar gasto recurrente"
          : purchase
            ? "Editar compra"
            : "Agregar compra"
      }
      description={
        recurringExpense
          ? "El cambio se aplicará desde el próximo cobro."
          : purchase
          ? "Editá el total, la fecha de compra y la cantidad de cuotas."
          : "Registrá una compra o pegá una lista del resumen."
      }
      contentClassName="sm:max-w-[760px]"
    >
      <Tabs
        key={purchase?.id ?? recurringExpense?.id ?? "create"}
        defaultValue={purchase || recurringExpense ? "manual" : "bulk"}
      >
        {!purchase && !recurringExpense ? (
          <TabsList>
            <TabsTrigger value="manual">Carga individual</TabsTrigger>
            <TabsTrigger value="bulk">Pegar lista</TabsTrigger>
          </TabsList>
        ) : null}
        <TabsContent value="manual">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Tarjeta</Label>
            <Select
              value={form.cardId}
              onValueChange={(cardId) =>
                setForm((current) => ({
                  ...current,
                  cardId,
                }))
              }
              disabled={Boolean(purchase || recurringExpense)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar tarjeta" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              {form.repeatsMonthly ? "Primer cobro" : "Fecha de compra"}
            </Label>
            <DatePickerPopover
              value={form.purchaseDate}
              disabled={Boolean(recurringExpense)}
              onChange={(purchaseDate) =>
                setForm((current) => ({ ...current, purchaseDate }))
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="purchase-name">Nombre</Label>
          <Input
            id="purchase-name"
            ref={nameRef}
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Ej. Supermercado, curso online..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Moneda</Label>
            <Select
              value={form.currency}
              onValueChange={(currency: CreditCardCurrency) =>
                setForm((current) => ({ ...current, currency }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchase-amount">
              {form.repeatsMonthly ? "Monto mensual" : "Monto total"}
            </Label>
            <Input
              id="purchase-amount"
              type="text"
              inputMode="decimal"
              value={form.totalAmount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  totalAmount: event.target.value,
                }))
              }
              placeholder="0,00"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <Label htmlFor="purchase-installments">Cuotas</Label>
            <Input
              id="purchase-installments"
              type="number"
              min="1"
              step="1"
              disabled={form.repeatsMonthly}
              value={form.installments}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  installments: event.target.value,
                }))
              }
            />
          </div>
        </div>
        {!purchase ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="purchase-recurring">Repetir todos los meses</Label>
              <p className="text-xs text-muted-foreground">
                Se proyecta durante 12 meses y continúa hasta que la finalices.
              </p>
            </div>
            <Switch
              id="purchase-recurring"
              checked={form.repeatsMonthly}
              disabled={Boolean(recurringExpense)}
              onCheckedChange={(repeatsMonthly) =>
                setForm((current) => ({
                  ...current,
                  repeatsMonthly,
                  installments: repeatsMonthly ? "1" : current.installments,
                }))
              }
            />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {!purchase && !recurringExpense ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading || cards.length === 0}
              onClick={() => savePurchase(true)}
            >
              Guardar y añadir otro
            </Button>
          ) : null}
          <Button type="submit" disabled={loading || cards.length === 0}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </div>
          </form>
        </TabsContent>
        {!purchase && !recurringExpense ? (
          <TabsContent value="bulk">
            <BulkPurchaseForm
              cards={cards}
              initialCardId={initialCardId}
              onOpenChange={onOpenChange}
              onSaveMany={onSaveMany}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </ResponsiveModal>
  );
}

function BulkPurchaseForm({
  cards,
  initialCardId,
  onOpenChange,
  onSaveMany,
}: {
  cards: CreditCard[];
  initialCardId?: string;
  onOpenChange: (open: boolean) => void;
  onSaveMany: (values: PurchaseFormValue[]) => Promise<void>;
}) {
  const [cardId, setCardId] = useState(initialCardId ?? cards[0]?.id ?? "");
  const [text, setText] = useState("");
  const [recurringRows, setRecurringRows] = useState<Set<number>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseCreditCardStatement(text), [text]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cardId || parsed.purchases.length === 0 || parsed.errors.length > 0) {
      setError("Revisá la lista antes de cargar las compras.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSaveMany(
        parsed.purchases.map((purchase, index) => ({
          cardId,
          name: purchase.name,
          purchaseDate: purchase.purchaseDate,
          totalAmount: purchase.totalAmount,
          currency: purchase.currency,
          installments: purchase.installments,
          repeatsMonthly: recurringRows.has(index),
        }))
      );
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron cargar las compras."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Tarjeta</Label>
        <Select value={cardId} onValueChange={setCardId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar tarjeta" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {cards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {card.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="statement-purchases">Lista del resumen</Label>
        <Textarea
          id="statement-purchases"
          className="min-h-40 font-mono text-xs"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setRecurringRows(new Set());
          }}
          placeholder="01-05-26 K GOOGLE *YouTubeP ... USD 4,97 238534 4,97"
        />
        <p className="text-xs text-muted-foreground">
          Pegá una compra por línea. Sin indicador de cuotas se interpreta como
          1/1; las líneas con USD se cargan en dólares. Podés marcar como
          recurrentes los consumos de una sola cuota.
        </p>
      </div>
      {parsed.purchases.length > 0 ? (
        <div className="max-h-[42vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Total calculado</TableHead>
                <TableHead className="text-right">Recurrente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.purchases.map((purchase, index) => (
                <TableRow key={`${purchase.sourceLine}_${index}`}>
                  <TableCell>{formatDate(purchase.purchaseDate)}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {purchase.name}
                  </TableCell>
                  <TableCell>
                    {purchase.currentInstallment}/{purchase.installments}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(purchase.installmentAmount, purchase.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(purchase.totalAmount, purchase.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Switch
                        checked={recurringRows.has(index)}
                        disabled={purchase.installments !== 1}
                        aria-label={`Marcar ${purchase.name} como recurrente`}
                        onCheckedChange={(checked) =>
                          setRecurringRows((current) => {
                            const next = new Set(current);
                            if (checked) {
                              next.add(index);
                            } else {
                              next.delete(index);
                            }
                            return next;
                          })
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {parsed.errors.length > 0 ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive">
            Revisá estas líneas:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-destructive">
            {parsed.errors.map((parseError) => (
              <li key={`${parseError.lineNumber}_${parseError.sourceLine}`}>
                Línea {parseError.lineNumber}: {parseError.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={
            loading ||
            !cardId ||
            parsed.purchases.length === 0 ||
            parsed.errors.length > 0
          }
        >
          {loading
            ? "Cargando..."
            : `Cargar ${parsed.purchases.length} compra${
                parsed.purchases.length === 1 ? "" : "s"
              }`}
        </Button>
      </div>
    </form>
  );
}
