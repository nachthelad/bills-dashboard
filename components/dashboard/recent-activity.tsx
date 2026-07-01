"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getDocumentStatusLabel } from "@/lib/ui-labels";

export interface ActivityItem {
  id: string;
  type: "expense" | "income";
  date: Date;
  dueDate?: Date | null;
  amount: number;
  description: string;
  category: string;
  status?: "parsed" | "pending" | "error" | "completed" | "paid";
}

interface RecentActivityProps {
  items: ActivityItem[];
  showAmounts: boolean;
}

export function RecentActivity({ items, showAmounts }: RecentActivityProps) {
  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Actividad reciente</h3>
        <p className="text-sm text-muted-foreground">
          Últimas facturas y entradas de ingresos.
        </p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fecha de carga</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground h-24"
                >
                  Sin actividad reciente.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
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
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{item.description}</span>
                      {item.status && item.status !== "completed" && (
                        <span
                          className={`text-xs capitalize ${
                            item.status === "paid"
                              ? "text-emerald-600 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {getDocumentStatusLabel(item.status)}
                          {item.status === "paid" && " ✓"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.dueDate ? formatDate(item.dueDate) : "-"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      item.type === "income" ? "text-emerald-500" : ""
                    }`}
                  >
                    {item.type === "income" ? "+" : "-"}
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
