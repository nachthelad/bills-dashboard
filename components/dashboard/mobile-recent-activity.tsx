"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowDownLeft, ArrowUpRight, Calendar } from "lucide-react";
import type { ActivityItem } from "./recent-activity";
import { formatDate } from "@/lib/utils";
import { getDocumentStatusLabel } from "@/lib/ui-labels";

interface MobileRecentActivityProps {
  items: ActivityItem[];
  showAmounts: boolean;
}

export function MobileRecentActivity({
  items,
  showAmounts,
}: MobileRecentActivityProps) {
  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 flex flex-col gap-1">
        <h3 className="font-semibold leading-none tracking-tight">
          Actividad reciente
        </h3>
        <p className="text-sm text-muted-foreground">
          Últimas facturas y entradas de ingresos.
        </p>
      </div>
      <div className="p-4 pt-0 space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
            Sin actividad reciente.
          </div>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start gap-2">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback
                      className={
                        item.type === "income"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-blue-500/10 text-blue-500"
                      }
                    >
                      {item.type === "income" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">
                      {item.description}
                    </CardTitle>
                    {item.status && item.status !== "completed" && (
                      <span className="text-xs text-muted-foreground capitalize">
                        {getDocumentStatusLabel(item.status)}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <Badge variant="outline" className="font-normal">
                    {item.category}
                  </Badge>
                  <div
                    className={`text-lg font-semibold ${
                      item.type === "income" ? "text-emerald-500" : ""
                    }`}
                  >
                    {item.type === "income" ? "+" : "-"}
                    {formatCurrency(item.amount)}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(item.date)}</span>
                  </div>
                  {item.dueDate && <span>Vence: {formatDate(item.dueDate)}</span>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
