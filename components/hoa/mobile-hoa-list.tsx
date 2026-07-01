"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import type { HoaSummary } from "@/types/hoa";
import { getHoaDifferenceStatusLabel } from "@/lib/ui-labels";

interface MobileHoaListProps {
  currentSummary: HoaSummary | null;
  previousSummary: HoaSummary | null;
  comparison: any;
  showAmounts: boolean;
}

export function MobileHoaList({
  currentSummary,
  previousSummary,
  comparison,
  showAmounts,
}: MobileHoaListProps) {
  const [sortBy, setSortBy] = useState<"category" | "difference">("difference");

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    if (!showAmounts) return "****";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const statusChipClass = (status: string) => {
    switch (status) {
      case "new":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "removed":
        return "bg-muted text-muted-foreground border-border";
      case "increased":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "decreased":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const toggleSort = () => {
    setSortBy((prev) => (prev === "category" ? "difference" : "category"));
  };

  const getSortedDiffs = (diffs: any[]) => {
    if (!diffs) return [];
    const sorted = [...diffs];
    if (sortBy === "category") {
      return sorted.sort((a, b) => {
        const aNum = parseInt(a.rubroKey.split("::")[0]);
        const bNum = parseInt(b.rubroKey.split("::")[0]);
        return aNum - bNum;
      });
    } else {
      return sorted.sort(
        (a, b) => Math.abs(b.diffAmount || 0) - Math.abs(a.diffAmount || 0)
      );
    }
  };

  if (!currentSummary) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
        No hay datos para esta unidad.
      </div>
    );
  }

  if (!previousSummary) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No hay otro período para comparar. Categorías del último mes:
        </p>
        <div className="grid gap-3">
          {(currentSummary.rubros ?? []).map((rubro) => (
            <Card key={`${rubro.rubroNumber}-${rubro.label}`}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">
                    {rubro.label ?? `Rubro ${rubro.rubroNumber}`}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(rubro.total)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const sortedDiffs = getSortedDiffs(comparison.rubroDiffs);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm text-muted-foreground">
          Detalles por {sortBy === "category" ? "categoría" : "diferencia"}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSort}
          className="h-8 gap-2"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortBy === "category" ? "Diferencia" : "Categoría"}
        </Button>
      </div>

      <div className="space-y-3">
        {sortedDiffs.map((diff: any) => (
          <Card key={diff.rubroKey} className="overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div className="space-y-2">
                <CardTitle className="text-base">{diff.label}</CardTitle>
                <div className="flex items-center gap-2">
                  <CardDescription className="text-xs">
                    Categoría {diff.rubroKey.split("::")[0]}
                  </CardDescription>
                  <Badge
                    variant="outline"
                    className={`${statusChipClass(diff.status)}`}
                  >
                    {getHoaDifferenceStatusLabel(diff.status)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">
                    {previousSummary.periodLabel}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    {formatCurrency(diff.previousTotal)}
                  </span>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-xs text-muted-foreground block">
                    {currentSummary.periodLabel}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(diff.currentTotal)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Diferencia
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium ${
                      diff.diffAmount > 0
                        ? "text-amber-500"
                        : diff.diffAmount < 0
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {diff.diffAmount === 0
                      ? "—"
                      : `${diff.diffAmount > 0 ? "+" : "-"}${formatCurrency(
                          Math.abs(diff.diffAmount)
                        )
                          .replace("ARS", "")
                          .trim()}`}
                  </span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      diff.diffPercent && diff.diffPercent > 20
                        ? "bg-amber-500/10 text-amber-500"
                        : diff.diffPercent && diff.diffPercent < -20
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {diff.diffPercent == null
                      ? "—"
                      : `${
                          diff.diffPercent > 0 ? "+" : ""
                        }${diff.diffPercent.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
