"use client";

/**
 * Dashboard summary:
 * - Expenses: documents collection filtered by userId, statuses parsed/needs_review, using totalAmount + due/issue dates.
 * - Income: incomeEntries collection filtered by userId for the current year to drive cards + right-hand breakdown.
 * - Cards: Total Expenses (year), Total Income (year), Net = income - expenses, This Month (expenses in current month).
 * - Expenses Breakdown: yearly totals grouped by provider category mapping (electricity/water/etc).
 * - Income Breakdown: yearly totals grouped by source; includes quick form to add income (stored in incomeEntries).
 */

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client";
import {
  fetchExpenseEntries,
  type ExpenseEntry,
} from "@/lib/expenses-client";
import { type CategoryValue } from "@/config/billing/categories";
import { normalizeCategory } from "@/lib/category-utils";
import { createApiClient, type DashboardSummary } from "@/lib/api-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import {
  resolveDocDate,
  getCategoryLabel,
  defaultCategoryTotals,
  parseLocalDay,
} from "@/lib/billing-utils";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { DashboardCharts } from "@/components/dashboard/charts";
import {
  RecentActivity,
  type ActivityItem,
} from "@/components/dashboard/recent-activity";
import { MobileRecentActivity } from "@/components/dashboard/mobile-recent-activity";
import { Calendar, Settings } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardDocument = Omit<BillDocument, "uploadedAt"> & {
  uploadedAt: Date;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenseDocs, setExpenseDocs] = useState<DashboardDocument[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<ExpenseEntry[]>([]);
  const [hoaSummaries, setHoaSummaries] = useState<Array<{ periodYear: number; periodMonth: number; totalToPayUnit: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [summaryFallback, setSummaryFallback] =
    useState<DashboardSummary | null>(null);
  const { showAmounts } = useAmountVisibility();

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  useEffect(() => {
    if (!user || !apiClient) return;
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const [docs, incomes, dailyExp, hoaRes] = await Promise.all([
          apiClient.listDocuments(),
          fetchIncomeEntries(token),
          fetchExpenseEntries(token),
          fetch("/api/hoa-summaries", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : { summaries: [] }),
        ]);
        if (!cancelled) {
          setExpenseDocs(docs);
          setIncomeEntries(incomes);
          setDailyExpenses(dailyExp);
          setHoaSummaries(
            (hoaRes.summaries ?? [])
              .filter((s: Record<string, unknown>) => typeof s.periodYear === "number" && typeof s.periodMonth === "number" && typeof s.totalToPayUnit === "number")
              .map((s: Record<string, unknown>) => ({ periodYear: s.periodYear as number, periodMonth: s.periodMonth as number, totalToPayUnit: s.totalToPayUnit as number }))
          );
          setError(null);
        }
      } catch (err) {
        console.error("Dashboard load error", err);
        if (!cancelled) {
          setError("No se pudieron cargar los datos del panel.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient, user]);

  // Auto-refresh for pending documents
  useEffect(() => {
    const hasPendingDocs = expenseDocs.some((doc) => doc.status === "pending");
    if (!hasPendingDocs || !apiClient) return;

    const interval = setInterval(() => {
      apiClient
        .listDocuments()
        .then((docs) => {
          setExpenseDocs(docs);
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [expenseDocs, apiClient]);

  useEffect(() => {
    if (!user || !apiClient) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await apiClient.fetchDashboardSummary();
        if (!cancelled && summary) {
          setSummaryFallback(summary);
        }
      } catch (err) {
        console.warn("Dashboard summary fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient, user]);

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    expenseDocs.forEach((doc) => {
      const date = resolveDocDate(doc);
      if (date) years.add(date.getFullYear());
    });
    incomeEntries.forEach((entry) => {
      years.add(entry.date.getFullYear());
    });
    dailyExpenses.forEach((entry) => {
      years.add(entry.date.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [expenseDocs, incomeEntries, dailyExpenses]);

  const currentYear = selectedYear;

  const expenseMetrics = useMemo(() => {
    const docs = expenseDocs.filter((doc) =>
      ["parsed", "needs_review", "paid"].includes(doc.status)
    );
    const totals = {
      year: 0,
      month: 0,
    };
    const categoryTotals: Record<CategoryValue, number> =
      defaultCategoryTotals();

    docs.forEach((doc) => {
      const amount = doc.amount ?? doc.totalAmount ?? 0;
      if (!amount) return;
      const docDate = resolveDocDate(doc);
      if (!docDate) return;
      if (docDate.getFullYear() === currentYear) {
        totals.year += amount;
        if (docDate.getMonth() === new Date().getMonth()) {
          totals.month += amount;
        }
        const categoryKey = normalizeCategory(
          doc.providerId,
          doc.category,
          doc.provider ?? doc.providerNameDetected ?? null
        );
        categoryTotals[categoryKey] += amount;
      }
    });

    // Add daily expenses (positive amounts only — negatives are refunds)
    const realMonth = new Date().getMonth();
    const realYear = new Date().getFullYear();
    let dailyExpensesTotal = 0;
    dailyExpenses.forEach((entry) => {
      if (entry.date.getFullYear() !== currentYear) return;
      const arsAmount =
        entry.currency === "USD"
          ? entry.arsRate != null
            ? entry.amount * entry.arsRate
            : null
          : entry.amount;
      if (arsAmount == null) return;
      totals.year += arsAmount;
      dailyExpensesTotal += arsAmount;
      if (currentYear === realYear && entry.date.getMonth() === realMonth) {
        totals.month += arsAmount;
      }
    });
    if (dailyExpensesTotal !== 0) {
      (categoryTotals as Record<string, number>)["daily_expenses"] = dailyExpensesTotal;
    }

    // Add HOA payments
    hoaSummaries.forEach((hoa) => {
      if (hoa.periodYear === currentYear) {
        totals.year += hoa.totalToPayUnit;
        if (currentYear === realYear && hoa.periodMonth - 1 === realMonth) {
          totals.month += hoa.totalToPayUnit;
        }
      }
    });

    return { totals, categoryTotals };
  }, [expenseDocs, dailyExpenses, hoaSummaries, currentYear]);

  const incomeMetrics = useMemo(() => {
    const yearEntries = incomeEntries.filter(
      (entry) => entry.date.getFullYear() === currentYear
    );
    const totalIncomeYear = yearEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
    const perSource = yearEntries.reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.source] = (acc[entry.source] ?? 0) + entry.amount;
        return acc;
      },
      {}
    );
    return { totalIncomeYear, perSource };
  }, [incomeEntries, currentYear]);

  const netAmount = incomeMetrics.totalIncomeYear - expenseMetrics.totals.year;

  useEffect(() => {
    if (!user || !apiClient) return;
    if (loading) return;
    const hasLiveData = expenseDocs.length > 0 || incomeEntries.length > 0;
    if (!hasLiveData) return;

    const payload: DashboardSummary = {
      totals: {
        totalExpensesYear: expenseMetrics.totals.year,
        totalIncomeYear: incomeMetrics.totalIncomeYear,
        netAmount,
        monthExpenses: expenseMetrics.totals.month,
      },
      categories: { ...expenseMetrics.categoryTotals },
      incomeSources: { ...incomeMetrics.perSource },
      updatedAt: new Date().toISOString(),
    };

    (async () => {
      try {
        await apiClient.saveDashboardSummary(payload);
      } catch (err) {
        console.warn("Dashboard summary save failed:", err);
      }
    })();
  }, [
    apiClient,
    user,
    loading,
    expenseDocs,
    dailyExpenses,
    incomeEntries,
    expenseMetrics,
    incomeMetrics,
    netAmount,
  ]);

  const fallbackTotals = summaryFallback?.totals ?? {
    totalExpensesYear: 0,
    totalIncomeYear: 0,
    netAmount: 0,
    monthExpenses: 0,
  };
  const fallbackCategories =
    summaryFallback?.categories ?? defaultCategoryTotals();

  const hasLiveExpenses = expenseDocs.length > 0 || dailyExpenses.length > 0 || hoaSummaries.length > 0;
  const hasLiveIncome = incomeEntries.length > 0;

  const displayTotals = {
    totalExpensesYear: hasLiveExpenses
      ? expenseMetrics.totals.year
      : fallbackTotals.totalExpensesYear,
    totalIncomeYear: hasLiveIncome
      ? incomeMetrics.totalIncomeYear
      : fallbackTotals.totalIncomeYear,
    netAmount:
      hasLiveExpenses || hasLiveIncome ? netAmount : fallbackTotals.netAmount,
    monthExpenses: hasLiveExpenses
      ? expenseMetrics.totals.month
      : fallbackTotals.monthExpenses,
  };

  const displayCategoryTotals = hasLiveExpenses
    ? expenseMetrics.categoryTotals
    : fallbackCategories;

  const recentActivity: ActivityItem[] = useMemo(() => {
    const expenses: ActivityItem[] = expenseDocs
      .filter((doc) =>
        ["parsed", "needs_review", "pending", "paid"].includes(doc.status)
      )
      .map((doc) => ({
        id: doc.id,
        type: "expense",
        date: doc.updatedAt || doc.uploadedAt,
        dueDate: parseLocalDay(doc.dueDate),
        amount: doc.amount ?? doc.totalAmount ?? 0,
        description:
          doc.providerNameDetected || doc.providerId || "Boleta sin identificar",
        category: getCategoryLabel(doc.category),
        status: doc.status as any,
      }));

    const incomes: ActivityItem[] = incomeEntries.map((entry) => ({
      id: entry.id,
      type: "income",
      date: entry.date,
      amount: entry.amount,
      description: entry.name,
      category: "Ingreso",
    }));

    return [...expenses, ...incomes]
      .sort((a, b) => {
        // Prioritize pending status to show at the very top
        const isAPending = a.type === "expense" && a.status === "pending";
        const isBPending = b.type === "expense" && b.status === "pending";
        if (isAPending && !isBPending) return -1;
        if (!isAPending && isBPending) return 1;

        // Then sort by activity date (newest first)
        return b.date.getTime() - a.date.getTime();
      })
      .slice(0, 10);
  }, [expenseDocs, incomeEntries]);

  const monthlyMetrics = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentYear, i, 1);
      return {
        name: date.toLocaleString("es-AR", { month: "short" }),
        expenses: 0,
        income: 0,
      };
    });

    expenseDocs.forEach((doc) => {
      if (!["parsed", "needs_review", "paid"].includes(doc.status)) return;
      const amount = doc.amount ?? doc.totalAmount ?? 0;
      if (!amount) return;
      const docDate = resolveDocDate(doc);
      if (!docDate || docDate.getFullYear() !== currentYear) return;
      months[docDate.getMonth()].expenses += amount;
    });

    incomeEntries.forEach((entry) => {
      if (entry.date.getFullYear() !== currentYear) return;
      months[entry.date.getMonth()].income += entry.amount;
    });

    dailyExpenses.forEach((entry) => {
      if (entry.date.getFullYear() !== currentYear) return;
      const arsAmount =
        entry.currency === "USD"
          ? entry.arsRate != null
            ? entry.amount * entry.arsRate
            : null
          : entry.amount;
      if (arsAmount == null) return;
      months[entry.date.getMonth()].expenses += arsAmount;
    });

    hoaSummaries.forEach((hoa) => {
      if (hoa.periodYear !== currentYear) return;
      const monthIndex = hoa.periodMonth - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        months[monthIndex].expenses += hoa.totalToPayUnit;
      }
    });

    return months;
  }, [expenseDocs, incomeEntries, dailyExpenses, hoaSummaries, currentYear]);

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Iniciá sesión para ver tu panel.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div role="status" aria-live="polite" className="text-muted-foreground">Cargando panel…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Panel</h2>
          <AmountVisibilityToggle />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue placeholder="Seleccionar año" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            href="/settings"
            aria-label="Configuración"
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground">
          Vista general de tu estado financiero y actividad reciente.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <KpiCards
        totalExpenses={displayTotals.totalExpensesYear}
        totalIncome={displayTotals.totalIncomeYear}
        netIncome={displayTotals.netAmount}
        monthExpenses={displayTotals.monthExpenses}
        showAmounts={showAmounts}
      />

      <DashboardCharts
        categoryTotals={displayCategoryTotals}
        monthlyData={monthlyMetrics}
        showAmounts={showAmounts}
      />

      <div className="hidden md:block">
        <RecentActivity items={recentActivity} showAmounts={showAmounts} />
      </div>
      <div className="md:hidden">
        <MobileRecentActivity
          items={recentActivity}
          showAmounts={showAmounts}
        />
      </div>
    </div>
  );
}
