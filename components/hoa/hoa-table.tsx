"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";
import type { HoaSummary } from "@/types/hoa";
import { getHoaDifferenceStatusLabel } from "@/lib/ui-labels";

interface HoaTableProps {
  currentSummary: HoaSummary | null;
  previousSummary: HoaSummary | null;
  comparison: any;
  showAmounts: boolean;
}

export function HoaTable({
  currentSummary,
  previousSummary,
  comparison,
  showAmounts,
}: HoaTableProps) {
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

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "new":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
      case "removed":
        return "border-border bg-muted text-muted-foreground";
      case "increased":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
      case "decreased":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      default:
        return "border-border bg-muted text-muted-foreground";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            Detalles por {sortBy === "category" ? "categoría" : "diferencia"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Comparación entre{" "}
            {currentSummary?.periodLabel ?? "el último período"} y{" "}
            {previousSummary
              ? previousSummary.periodLabel
              : "sin historial"}
            .
          </p>
        </div>
        {comparison &&
          comparison.rubroDiffs &&
          comparison.rubroDiffs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSort}
              className="ml-4 gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              Ordenar por {sortBy === "category" ? "Diferencia" : "Categoría"}
            </Button>
          )}
      </div>
      {!currentSummary ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No hay datos para esta unidad.
        </div>
      ) : !previousSummary ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sin período anterior para comparar. Categorías del último mes:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(currentSummary.rubros ?? []).map((rubro) => (
              <div
                key={`${rubro.rubroNumber}-${rubro.label}`}
                className="rounded-lg border bg-card px-4 py-3"
              >
                <p className="text-sm text-muted-foreground">
                  {rubro.label ?? `Rubro ${rubro.rubroNumber}`}
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(rubro.total)}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Nota: se necesitan al menos dos períodos para mostrar la comparación.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>{previousSummary.periodLabel}</TableHead>
                  <TableHead>{currentSummary.periodLabel}</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedDiffs(comparison.rubroDiffs).map((diff: any) => (
                  <TableRow key={diff.rubroKey}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {diff.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Categoría {diff.rubroKey.split("::")[0]}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(diff.previousTotal)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(diff.currentTotal)}
                    </TableCell>
                    <TableCell
                      className={
                        diff.diffAmount > 0
                          ? "text-amber-400"
                          : diff.diffAmount < 0
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {diff.diffAmount === 0
                        ? "—"
                        : `${diff.diffAmount > 0 ? "+" : "-"}${formatCurrency(
                            Math.abs(diff.diffAmount)
                          )
                            .replace("ARS", "")
                            .trim()}`}
                    </TableCell>
                    <TableCell
                      className={
                        diff.diffPercent && diff.diffPercent > 20
                          ? "text-amber-400"
                          : diff.diffPercent && diff.diffPercent < -20
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {diff.diffPercent == null
                        ? "—"
                        : `${
                            diff.diffPercent > 0 ? "+" : ""
                          }${diff.diffPercent.toFixed(1)}%`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(diff.status)}
                      >
                        {getHoaDifferenceStatusLabel(diff.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
