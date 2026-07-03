"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  calculateForeignBalances,
  type CurrencyConversion,
} from "@/lib/budget";
import type { IncomeEntry } from "@/lib/income-client";
import {
  deleteCurrencyConversion,
  fetchCurrencyConversions,
} from "@/lib/funding-client";
import { formatAmount } from "@/lib/format-currency";
import { ConversionModal } from "@/components/income/conversion-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function FundingLedger({
  entries,
  showAmounts,
}: {
  entries: IncomeEntry[];
  showAmounts: boolean;
}) {
  const { user } = useAuth();
  const [conversions, setConversions] = useState<CurrencyConversion[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void user.getIdToken().then(fetchCurrencyConversions).then((next) => {
      if (!cancelled) setConversions(next);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const balances = useMemo(
    () =>
      calculateForeignBalances(
        entries.map((entry) => ({
          currency:
            entry.currency === "USD" || entry.currency === "USDT"
              ? entry.currency
              : "ARS",
          amount: entry.amount,
        })),
        conversions
      ),
    [conversions, entries]
  );

  function upsert(saved: CurrencyConversion) {
    setConversions((current) =>
      [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) =>
        b.date.localeCompare(a.date)
      )
    );
  }

  async function remove(id: string) {
    if (!user) return;
    const token = await user.getIdToken();
    await deleteCurrencyConversion(token, id);
    setConversions((current) => current.filter((item) => item.id !== id));
  }

  return (
    <Card id="conversions">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-emerald-600" />
            Conversiones a pesos
          </CardTitle>
          <CardDescription className="mt-1">
            Saldo disponible: USD {balances.available.USD.toLocaleString("es-AR")} · USDT{" "}
            {balances.available.USDT.toLocaleString("es-AR")}
          </CardDescription>
        </div>
        <ConversionModal balances={balances.available} onSuccess={upsert} />
      </CardHeader>
      <CardContent className="space-y-3">
        {conversions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Todavía no registraste conversiones.
          </p>
        ) : (
          conversions.map((conversion) => (
            <div
              key={conversion.id}
              className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">
                  {conversion.fromCurrency}{" "}
                  {conversion.fromAmount.toLocaleString("es-AR")}
                  {" → "}
                  {formatAmount(conversion.arsReceived, "ARS", showAmounts)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(conversion.date).toLocaleDateString("es-AR")} · $
                  {conversion.usedRate.toLocaleString("es-AR")} por{" "}
                  {conversion.fromCurrency}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ConversionModal
                  balances={{
                    ...balances.available,
                    [conversion.fromCurrency]:
                      balances.available[conversion.fromCurrency] +
                      conversion.fromAmount,
                  }}
                  conversion={conversion}
                  onSuccess={upsert}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Eliminar conversión"
                  onClick={() => void remove(conversion.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
