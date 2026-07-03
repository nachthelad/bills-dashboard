"use client";

import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useState } from "react";
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { AddIncomeModal } from "@/components/income/add-income-modal";
import { IncomeTable } from "@/components/income/income-table";
import { MobileIncomeList } from "@/components/income/mobile-income-list";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";
import { FundingLedger } from "@/components/income/funding-ledger";

export default function IncomePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const { showAmounts } = useAmountVisibility();

  const loadEntries = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const data = await fetchIncomeEntries(token);
      setEntries(data);
    } catch (err) {
      console.error("Income page load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEntries();
    fetch("/api/binance-rate")
      .then((r) => r.json())
      .then((d) => { if (d.price) setUsdRate(d.price); })
      .catch(() => {});
  }, [loadEntries]);

  const totalIncome = entries
    .filter((entry) => entry.currency === "ARS")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyIncome = entries
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .filter((entry) => entry.currency === "ARS")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando ingresos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Ingresos</h1>
          <AmountVisibilityToggle />
        </div>
        <p className="text-muted-foreground">
          Rastreá y gestioná tus fuentes de ingresos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Cobros ARS registrados
            </div>
            <div className="text-3xl font-bold text-emerald-500">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Este mes
            </div>
            <div className="text-3xl font-bold text-emerald-500">
              {formatCurrency(monthlyIncome)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              Dólar Cripto (Binance P2P)
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {usdRate
                ? new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(usdRate)
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <FundingLedger entries={entries} showAmounts={showAmounts} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Entradas de ingresos</h2>
          <AddIncomeModal onSuccess={loadEntries} />
        </div>
        <div className="hidden md:block">
          <IncomeTable entries={entries} showAmounts={showAmounts} onRefresh={loadEntries} />
        </div>
        <div className="md:hidden">
          <MobileIncomeList entries={entries} showAmounts={showAmounts} onRefresh={loadEntries} />
        </div>
      </div>
    </div>
  );
}
