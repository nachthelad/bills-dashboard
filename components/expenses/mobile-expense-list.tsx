"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  deleteExpenseEntry,
  type ExpenseEntry,
} from "@/lib/expenses-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Calendar, Pencil, Trash2, ShoppingCart } from "lucide-react";
import { formatAmount, formatAmountWithUsd } from "@/lib/format-currency";
import { AddExpenseModal } from "./add-expense-modal";

interface MobileExpenseListProps {
  entries: ExpenseEntry[];
  showAmounts: boolean;
  onRefresh: () => void;
  monthFilter: string;
  onMonthFilterChange: (value: string) => void;
  categories: string[];
  onAddCategory: (category: string) => Promise<void>;
}

const CATEGORY_STYLES: Record<string, string> = {
  Compra: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  Comida: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Servicios: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Tarjeta: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Salud: "bg-green-500/20 text-green-300 border-green-500/30",
  Fútbol: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Transporte: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Otros: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
};

function getAvailableMonths(entries: ExpenseEntry[]) {
  const set = new Set<string>();
  entries.forEach((e) => {
    const d = e.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    set.add(key);
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function MobileExpenseList({
  entries,
  showAmounts,
  onRefresh,
  monthFilter,
  onMonthFilterChange,
  categories,
  onAddCategory,
}: MobileExpenseListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editEntry, setEditEntry] = useState<ExpenseEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const availableMonths = getAvailableMonths(entries);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.description
      .toLowerCase()
      .includes(search.toLowerCase());

    const d = entry.date;
    const entryMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const matchesMonth = monthFilter === "all" || entryMonth === monthFilter;

    const matchesCategory =
      categoryFilter === "all" || entry.category === categoryFilter;

    return matchesSearch && matchesMonth && matchesCategory;
  });


  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const formatMonthOption = (ym: string) => {
    const [year, month] = ym.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    const label = d.toLocaleString("es-AR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const handleDelete = async () => {
    if (!user || !deleteId) return;
    setDeleteLoading(true);
    try {
      const token = await user.getIdToken();
      await deleteExpenseEntry(token, deleteId);
      onRefresh();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gastos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Select value={monthFilter} onValueChange={onMonthFilterChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {availableMonths.map((ym) => (
                  <SelectItem key={ym} value={ym}>
                    {formatMonthOption(ym)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              No se encontraron gastos.
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <Card key={entry.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground shrink-0">
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">
                            {entry.description}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {entry.paymentMethod}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar gasto"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => {
                          setEditEntry(entry);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar gasto"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(entry.date)}</span>
                    </div>
                    <div
                      className={`font-semibold text-lg ${
                        entry.amount < 0
                          ? "text-emerald-500"
                          : "text-foreground"
                      }`}
                    >
                      {entry.currency === "USD" && entry.arsRate == null ? (
                        <span className="flex items-center gap-1.5">
                          {formatAmount(entry.amount, "USD", showAmounts)}
                          <Badge variant="outline" className="text-xs font-normal">
                            Sin convertir
                          </Badge>
                        </span>
                      ) : (
                        formatAmountWithUsd(entry.amount, entry.currency ?? "ARS", entry.arsRate, showAmounts)
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant="outline"
                      className={
                        CATEGORY_STYLES[entry.category] ??
                        "bg-zinc-500/20 text-zinc-300"
                      }
                    >
                      {entry.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {editEntry && (
        <AddExpenseModal
          editEntry={editEntry}
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v);
            if (!v) setEditEntry(null);
          }}
          onSuccess={() => {
            setEditEntry(null);
            onRefresh();
          }}
          categories={categories}
          onAddCategory={onAddCategory}
        />
      )}

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
