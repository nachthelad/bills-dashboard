"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { HoaSummary } from "@/types/hoa";
import { ensureSpanishPeriodLabel } from "@/lib/hoa-period-utils";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { HoaHistoryTable } from "@/components/hoa/hoa-history-table";
import Link from "next/link";

const PRIMARY_UNIT_CODE = "0005";

export default function HoaHistoryPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<HoaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showAmounts } = useAmountVisibility();

  const fetchSummaries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/hoa-summaries", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load HOA summaries");
      }

      const payload = await response.json();
      const normalized: HoaSummary[] = (payload.summaries ?? []).map(
        (summary: any) => ({
          ...summary,
          createdAt: summary.createdAt ? new Date(summary.createdAt) : null,
          updatedAt: summary.updatedAt ? new Date(summary.updatedAt) : null,
          rubros: Array.isArray(summary.rubros) ? summary.rubros : [],
        })
      );

      setSummaries(normalized);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const filteredSummaries = useMemo(() => {
    const unitSummaries = summaries.filter(
      (s) => s.unitCode === PRIMARY_UNIT_CODE
    );

    const map = new Map<string, HoaSummary>();
    unitSummaries.forEach((summary) => {
      const key = summary.periodKey;
      if (!key) return;
      const existing = map.get(key);
      if (
        !existing ||
        (summary.updatedAt && existing.updatedAt && summary.updatedAt > existing.updatedAt) ||
        (summary.updatedAt && !existing.updatedAt)
      ) {
        map.set(key, summary);
      }
    });

    return Array.from(map.values())
      .map((s) => ({
        ...s,
        periodLabel: ensureSpanishPeriodLabel(s.periodLabel ?? s.periodKey) ?? "",
      }))
      .sort((a, b) => (b.periodKey ?? "").localeCompare(a.periodKey ?? ""));
  }, [summaries]);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <Link
          href="/hoa"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          HOA
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Historial por categoría</h1>
          <AmountVisibilityToggle />
        </div>
        <p className="text-muted-foreground mt-1">
          Desglose mensual por categoría en todos los períodos registrados.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Cargando historial...</span>
        </div>
      ) : (
        <HoaHistoryTable summaries={filteredSummaries} showAmounts={showAmounts} />
      )}
    </div>
  );
}
