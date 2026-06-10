"use client";

import { useMemo, useState } from "react";
import type { HoaSummary } from "@/types/hoa";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { buildRubroKey } from "@/lib/hoaComparison";

interface HoaHistoryTableProps {
  summaries: HoaSummary[];
  showAmounts: boolean;
}

const EPSILON = 0.01;

type HistoryRow = {
  key: string;
  type: "rubro" | "item";
  parentKey: string | null;
  label: string;
  detail: string | null;
  rubroNumber: number | null;
  values: Map<string, number | null>;
  itemCount: number;
};

export function HoaHistoryTable({ summaries, showAmounts }: HoaHistoryTableProps) {
  const [sortBy, setSortBy] = useState<"category" | "difference">("category");

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    if (!showAmounts) return "****";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sort oldest → newest for column order
  const orderedSummaries = useMemo(
    () => [...summaries].sort((a, b) => a.periodKey.localeCompare(b.periodKey)),
    [summaries]
  );

  const { rowOrder, rows } = useMemo(() => {
    const rowOrder: string[] = [];
    const rows = new Map<string, HistoryRow>();

    for (const summary of orderedSummaries) {
      for (const rubro of summary.rubros ?? []) {
        const rubroKey = buildRubroKey(rubro.rubroNumber ?? null, rubro.label ?? "");
        const rubroLabel = rubro.label ?? "Sin etiqueta";
        const itemCount = rubro.items?.length ?? 0;

        if (!rows.has(rubroKey)) {
          rowOrder.push(rubroKey);
          rows.set(rubroKey, {
            key: rubroKey,
            type: "rubro",
            parentKey: null,
            label: rubroLabel,
            detail: null,
            rubroNumber: rubro.rubroNumber ?? null,
            values: new Map(),
            itemCount,
          });
        }

        const rubroRow = rows.get(rubroKey)!;
        if (itemCount > rubroRow.itemCount) {
          rubroRow.itemCount = itemCount;
        }
        rubroRow.values.set(summary.periodKey, rubro.total ?? null);

        for (const item of rubro.items ?? []) {
          const itemKey = buildItemKey(rubroKey, item.label ?? item.detail ?? "");
          if (!rows.has(itemKey)) {
            rowOrder.push(itemKey);
            rows.set(itemKey, {
              key: itemKey,
              type: "item",
              parentKey: rubroKey,
              label: item.label ?? "Detalle sin etiqueta",
              detail: item.detail ?? null,
              rubroNumber: rubro.rubroNumber ?? null,
              values: new Map(),
              itemCount: 0,
            });
          }

          const itemRow = rows.get(itemKey)!;
          if (!itemRow.detail && item.detail) {
            itemRow.detail = item.detail;
          }
          itemRow.values.set(summary.periodKey, item.amount ?? null);
        }
      }
    }

    return { rowOrder, rows };
  }, [orderedSummaries]);

  const sortedRows = useMemo(() => {
    const rubroRows = [...rows.values()].filter((row) => row.type === "rubro");
    if (sortBy === "category") {
      rubroRows.sort((a, b) => {
        const aNum = a.rubroNumber;
        const bNum = b.rubroNumber;
        if (aNum !== null && aNum !== undefined && bNum !== null && bNum !== undefined)
          return aNum - bNum;
        if (aNum !== null && aNum !== undefined) return -1;
        if (bNum !== null && bNum !== undefined) return 1;
        return a.label.localeCompare(b.label);
      });
    } else {
      rubroRows.sort((a, b) => {
        const diffA = Math.abs(overallDiff(a.values, orderedSummaries));
        const diffB = Math.abs(overallDiff(b.values, orderedSummaries));
        return diffB - diffA;
      });
    }

    const ordered: HistoryRow[] = [];
    for (const rubroRow of rubroRows) {
      ordered.push(rubroRow);
      const childRows = rowOrder
        .map((key) => rows.get(key))
        .filter(
          (row): row is HistoryRow =>
            row !== undefined &&
            row.type === "item" &&
            row.parentKey === rubroRow.key
        );
      ordered.push(...childRows);
    }
    return ordered;
  }, [rowOrder, rows, sortBy, orderedSummaries]);

  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
        Sin historial disponible todavía.
      </div>
    );
  }

  const cellColor = (
    current: number | null,
    previous: number | null | undefined
  ): string => {
    if (current === null) return "text-muted-foreground italic";
    if (previous === undefined || previous === null) return "text-emerald-400";
    if (Math.abs(current - previous) <= EPSILON) return "";
    return current > previous ? "text-amber-400" : "text-emerald-400";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Detalles por {sortBy === "category" ? "categoría" : "diferencia"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {orderedSummaries.length} período{orderedSummaries.length !== 1 ? "s" : ""} registrado{orderedSummaries.length !== 1 ? "s" : ""}.
          </p>
        </div>
        {rowOrder.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortBy((prev) => (prev === "category" ? "difference" : "category"))}
            className="gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            Ordenar por {sortBy === "category" ? "Diferencia" : "Categoría"}
          </Button>
        )}
      </div>

      <div className="max-w-full min-w-0 overflow-hidden rounded-md border">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-[280px] bg-card">
                Categoría
              </TableHead>
              {orderedSummaries.map((s) => (
                <TableHead
                  key={s.periodKey}
                  className="text-right whitespace-nowrap min-w-[110px]"
                >
                  {s.periodLabel}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              return (
                <TableRow
                  key={row.key}
                  className={row.type === "item" ? "bg-muted/15 hover:bg-muted/30" : ""}
                >
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <div
                      className={
                        row.type === "item"
                          ? "max-w-[360px] pl-5 text-sm text-foreground"
                          : "max-w-[360px] font-medium text-foreground"
                      }
                    >
                      <span className={row.type === "item" ? "whitespace-normal" : "whitespace-normal"}>
                        {row.label}
                      </span>
                    </div>
                    {row.detail && (
                      <div className="max-w-[360px] pl-5 text-xs text-muted-foreground whitespace-normal">
                        {row.detail}
                      </div>
                    )}
                    {row.type === "rubro" && row.itemCount > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {row.itemCount} detalle{row.itemCount !== 1 ? "s" : ""}
                      </div>
                    )}
                    {row.type === "rubro" &&
                      row.rubroNumber !== null &&
                      row.rubroNumber !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        Categoría {row.rubroNumber}
                      </div>
                    )}
                  </TableCell>
                  {orderedSummaries.map((s, colIdx) => {
                    const val = row.values.get(s.periodKey) ?? null;
                    const prevSummary = colIdx > 0 ? orderedSummaries[colIdx - 1] : null;
                    const prevVal = prevSummary
                      ? (row.values.get(prevSummary.periodKey) ?? null)
                      : undefined;
                    return (
                      <TableCell
                        key={s.periodKey}
                        className={`text-right whitespace-nowrap ${
                          row.type === "item" ? "text-sm" : ""
                        } ${cellColor(val, prevVal)}`}
                      >
                        {formatCurrency(val)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            {/* TOTAL row */}
            <TableRow className="border-t-2 font-bold">
              <TableCell className="sticky left-0 bg-card z-10 whitespace-nowrap uppercase text-xs tracking-wide text-muted-foreground">
                Total
              </TableCell>
              {orderedSummaries.map((s, colIdx) => {
                const val = s.totalToPayUnit ?? null;
                const prevVal =
                  colIdx > 0
                    ? (orderedSummaries[colIdx - 1].totalToPayUnit ?? null)
                    : undefined;
                return (
                  <TableCell
                    key={s.periodKey}
                    className={`text-right whitespace-nowrap ${cellColor(val, prevVal)}`}
                  >
                    {formatCurrency(val)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function buildItemKey(parentKey: string, label: string | null) {
  const normalizedLabel = (label ?? "").trim().toLowerCase();
  return `${parentKey}::item::${normalizedLabel}`;
}

function overallDiff(
  rowMap: Map<string, number | null>,
  orderedSummaries: HoaSummary[]
): number {
  const vals = orderedSummaries
    .map((s) => rowMap.get(s.periodKey) ?? null)
    .filter((v): v is number => v !== null);
  if (vals.length < 2) return 0;
  return vals[vals.length - 1] - vals[0];
}
