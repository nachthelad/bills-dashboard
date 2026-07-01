"use client";

import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchExpenseEntries,
  fetchExpenseCategories,
  addExpenseCategory,
  EXPENSE_CATEGORIES,
  type ExpenseEntry,
} from "@/lib/expenses-client";
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { MobileExpenseList } from "@/components/expenses/mobile-expense-list";
import { ExpenseCategoryChart } from "@/components/expenses/expense-category-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingDown, CalendarDays, Lightbulb } from "lucide-react";
import { InsightsSheet } from "@/components/expenses/insights-sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ExpensesPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([...EXPENSE_CATEGORIES]);
  const [loading, setLoading] = useState(true);
  const { showAmounts } = useAmountVisibility();

  const currentDate = new Date();
  const defaultMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const [monthFilter, setMonthFilter] = useState<string>(defaultMonth);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const [data, cats, income] = await Promise.all([
        fetchExpenseEntries(token),
        fetchExpenseCategories(token),
        fetchIncomeEntries(token),
      ]);
      setEntries(data);
      setCategories(cats);
      setIncomeEntries(income);
    } catch (err) {
      console.error("Expenses page load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleAddCategory = useCallback(
    async (category: string) => {
      if (!user) return;
      const token = await user.getIdToken();
      await addExpenseCategory(token, category);
      setCategories((prev) =>
        prev.includes(category) ? prev : [...prev, category]
      );
    },
    [user]
  );

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const filterYear = monthFilter === "all" ? currentYear : parseInt(monthFilter.split("-")[0]);
  const filterMonth = monthFilter === "all" ? currentMonth : parseInt(monthFilter.split("-")[1]) - 1;

  const toArs = (e: ExpenseEntry): number | null => {
    if (e.currency === "USD") {
      return e.arsRate != null ? e.amount * e.arsRate : null;
    }
    return e.amount;
  };

  const ytdTotal = useMemo(
    () =>
      entries
        .filter((e) => e.date.getFullYear() === filterYear && e.amount > 0)
        .reduce((sum, e) => {
          const ars = toArs(e);
          return ars != null ? sum + ars : sum;
        }, 0),
    [entries, filterYear]
  );

  const monthEntries = useMemo(
    () =>
      entries.filter((e) => {
        const d = e.date;
        return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
      }),
    [entries, filterYear, filterMonth]
  );

  const monthTotal = useMemo(
    () =>
      monthEntries
        .filter((e) => e.amount > 0)
        .reduce((sum, e) => {
          const ars = toArs(e);
          return ars != null ? sum + ars : sum;
        }, 0),
    [monthEntries]
  );

  const daysInMonth = new Date(filterYear, filterMonth + 1, 0).getDate();
  const dailyAverage = daysInMonth > 0 ? monthTotal / daysInMonth : 0;

  const monthLabel = monthFilter === "all" || (filterYear === currentYear && filterMonth === currentMonth)
    ? "Este mes"
    : new Date(filterYear, filterMonth, 1).toLocaleString("es-AR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase());
  const analysisMonthFilter = monthFilter === "all" ? defaultMonth : monthFilter;
  const analysisMonthLabel = new Date(
    Number(analysisMonthFilter.split("-")[0]),
    Number(analysisMonthFilter.split("-")[1]) - 1,
    1
  )
    .toLocaleString("es-AR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());


  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando gastos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Gastos</h1>
          <AmountVisibilityToggle />
        </div>
        <p className="text-muted-foreground">
          Rastreá y gestioná tus gastos diarios.
        </p>
      </div>

      <Card className="bg-muted">
        <CardContent className="py-4 px-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex flex-row md:flex-col justify-between md:justify-start gap-3 md:gap-4 shrink-0 md:w-44">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <ShoppingCart className="w-3 h-3 text-rose-500" />
                  {monthLabel}
                </div>
                <div className="text-lg font-bold text-rose-500 leading-tight">
                  {formatCurrency(monthTotal)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <TrendingDown className="w-3 h-3 text-rose-400" />
                  Total del año
                </div>
                <div className="text-lg font-bold text-rose-400 leading-tight">
                  {formatCurrency(ytdTotal)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <CalendarDays className="w-3 h-3 text-muted-foreground" />
                  Promedio diario
                </div>
                <div className="text-lg font-bold leading-tight">
                  {formatCurrency(dailyAverage)}
                </div>
              </div>
            </div>
            <div className="hidden md:block w-px self-stretch bg-border" />
            <div className="flex-1 min-w-0">
              <ExpenseCategoryChart
                entries={entries}
                monthFilter={monthFilter}
                showAmounts={showAmounts}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Entradas de gastos</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size={isMobile ? "icon" : "sm"}
              onClick={() => setInsightsOpen(true)}
              className={isMobile ? undefined : "gap-1.5"}
              aria-label="Abrir consejos"
              title="Consejos"
            >
              <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
              {!isMobile ? "Consejos" : null}
            </Button>
            <AddExpenseModal
              onSuccess={loadEntries}
              categories={categories}
              onAddCategory={handleAddCategory}
            />
          </div>
        </div>
        <div className="hidden md:block">
          <ExpenseTable
            entries={entries}
            showAmounts={showAmounts}
            onRefresh={loadEntries}
            monthFilter={monthFilter}
            onMonthFilterChange={setMonthFilter}
            categories={categories}
            onAddCategory={handleAddCategory}
          />
        </div>
        <div className="md:hidden">
          <MobileExpenseList
            entries={entries}
            showAmounts={showAmounts}
            onRefresh={loadEntries}
            monthFilter={monthFilter}
            onMonthFilterChange={setMonthFilter}
            categories={categories}
            onAddCategory={handleAddCategory}
          />
        </div>
      </div>
      <InsightsSheet
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        entries={monthEntries}
        monthLabel={monthLabel}
        monthFilter={monthFilter}
        analysisMonthFilter={analysisMonthFilter}
        analysisMonthLabel={analysisMonthLabel}
        usesCurrentMonthFallback={monthFilter === "all"}
        incomeEntries={incomeEntries.filter((e) => {
          const d = e.date;
          return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
        })}
      />
    </div>
  );
}
