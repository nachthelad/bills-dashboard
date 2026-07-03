"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Pencil } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { parseAmountInput } from "@/lib/amount-parser";
import type {
  CurrencyConversion,
  ForeignCurrency,
} from "@/lib/budget";
import {
  createCurrencyConversion,
  updateCurrencyConversion,
} from "@/lib/funding-client";
import { getLocalTodayIso, isoToDate } from "@/lib/date-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
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
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  balances: Record<ForeignCurrency, number>;
  conversion?: CurrencyConversion | null;
  onSuccess: (conversion: CurrencyConversion) => void;
};

export function ConversionModal({ balances, conversion, onSuccess }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<ForeignCurrency>("USDT");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);
  const [date, setDate] = useState(getLocalTodayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (conversion) {
      setCurrency(conversion.fromCurrency);
      setAmount(String(conversion.fromAmount));
      setRate(String(conversion.usedRate));
      setSuggestedRate(conversion.suggestedRate);
      setDate(conversion.date.slice(0, 10));
      setNote(conversion.note ?? "");
      return;
    }
    fetch("/api/binance-rate")
      .then((response) => response.json())
      .then((data) => {
        const price = Number(data.price);
        if (Number.isFinite(price) && price > 0) {
          setSuggestedRate(price);
          setRate(String(price));
        }
      })
      .catch(() => {});
  }, [conversion, open]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const fromAmount = parseAmountInput(amount);
    const usedRate = parseAmountInput(rate);
    const parsedDate = isoToDate(date);
    if (
      !Number.isFinite(fromAmount) ||
      fromAmount <= 0 ||
      !Number.isFinite(usedRate) ||
      usedRate <= 0 ||
      !parsedDate
    ) {
      setError("Revisá el monto, la cotización y la fecha");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const input = {
        date: parsedDate.toISOString(),
        fromCurrency: currency,
        fromAmount,
        suggestedRateSource: suggestedRate
          ? ("binance_p2p" as const)
          : ("manual" as const),
        suggestedRate,
        usedRate,
        relatedIncomeSourceId: null,
        note: note.trim() || null,
      };
      const saved = conversion
        ? await updateCurrencyConversion(token, conversion.id, input)
        : await createCurrencyConversion(token, input);
      onSuccess(saved);
      setOpen(false);
      if (!conversion) {
        setAmount("");
        setNote("");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar la conversión"
      );
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <form onSubmit={save} className="space-y-4 px-1 pb-4">
      <div className="rounded-xl bg-muted/60 p-3 text-sm">
        Saldo disponible: <b>{currency} {balances[currency].toLocaleString("es-AR")}</b>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Moneda de origen</Label>
          <Select
            value={currency}
            onValueChange={(value: ForeignCurrency) => setCurrency(value)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="USDT">USDT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="conversion-amount">Monto</Label>
          <Input
            id="conversion-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="800"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="conversion-rate">Cotización usada</Label>
          <Input
            id="conversion-rate"
            inputMode="decimal"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            placeholder="1485"
          />
          <p className="text-xs text-muted-foreground">
            {suggestedRate
              ? `Referencia Binance P2P: $${suggestedRate.toLocaleString("es-AR")}`
              : "Referencia Binance no disponible. Ingresala manualmente."}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <DatePickerPopover value={date} onChange={setDate} />
        </div>
      </div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <p className="text-xs text-muted-foreground">Pesos recibidos</p>
        <p className="mt-1 text-2xl font-black">
          {new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0,
          }).format(
            Math.max(0, parseAmountInput(amount)) *
              Math.max(0, parseAmountInput(rate))
          )}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="conversion-note">Nota opcional</Label>
        <Textarea
          id="conversion-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ej.: Martín me convirtió a este valor"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Guardando…" : conversion ? "Guardar cambios" : "Guardar conversión"}
      </Button>
    </form>
  );

  const trigger = conversion ? (
    <Button size="icon" variant="ghost" aria-label="Editar conversión">
      <Pencil className="size-4" />
    </Button>
  ) : (
    <Button>
      <ArrowRightLeft className="size-4" /> Registrar conversión
    </Button>
  );
  const title = conversion ? "Editar conversión" : "Registrar conversión";
  const description =
    "Binance P2P es una referencia editable; se guarda la cotización efectiva.";

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        trigger={trigger}
      >
        {form}
      </MobileDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
