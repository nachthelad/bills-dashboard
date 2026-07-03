import { getAdminFirestore } from "@/lib/firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
  calculateMonthlyBudget,
  calculateCashFunding,
  calculateForeignBalances,
  getLimitSummary,
  getMonthTiming,
  getNextPeriodMonth,
  isFixedExpenseActive,
  resolveFixedExpenseAmount,
  type BudgetAlert,
  type BudgetPreferences,
  type MonthlyBudgetConfig,
  type MonthlyBudgetSummary,
} from "@/lib/budget";
import {
  groupInstallmentsByPeriod,
  type CreditCardCycle,
  type CreditCardPurchase,
  type CreditCardRecurringExpense,
} from "@/lib/credit-card-utils";
import {
  serializeCycle,
  serializePurchase,
  serializeRecurringExpense,
} from "@/lib/server/credit-cards";
import { toDate } from "@/lib/server/document-serializer";
import { serializeConversion } from "@/lib/server/income-funding";
import {
  serializeFixedExpense,
  serializeFixedExpensePeriod,
  serializeMonthlyBudget,
  serializePreferences,
  serializeSpendingLimit,
} from "@/lib/server/budget-data";

const DEFAULT_PREFERENCES: BudgetPreferences = {
  expectedIncome: 0,
  savingsMode: "percentage",
  savingsValue: 20,
  fundingMode: "planned",
  arsBufferAmount: 0,
};

export async function buildMonthlyBudgetSummary(
  uid: string,
  month: string,
  now = new Date()
): Promise<MonthlyBudgetSummary> {
  const db = getAdminFirestore();
  const nextMonth = getNextPeriodMonth(month);
  const [
    preferencesDoc,
    monthlyDoc,
    fixedSnapshot,
    periodsSnapshot,
    limitsSnapshot,
    expensesSnapshot,
    incomeSnapshot,
    cyclesSnapshot,
    purchasesSnapshot,
    recurringSnapshot,
    documentsSnapshot,
    hoaSnapshot,
    conversionsSnapshot,
  ] = await Promise.all([
    db.collection("budgetPreferences").doc(uid).get(),
    db.collection("monthlyBudgets").doc(`${uid}_${month}`).get(),
    db.collection("fixedExpenses").where("userId", "==", uid).get(),
    db.collection("fixedExpensePeriods").where("userId", "==", uid).get(),
    db.collection("spendingLimits").where("userId", "==", uid).get(),
    db.collection("dailyExpenses").where("userId", "==", uid).get(),
    db.collection("incomeEntries").where("userId", "==", uid).get(),
    db.collection("creditCardCycles").where("userId", "==", uid).get(),
    db.collection("creditCardPurchases").where("userId", "==", uid).get(),
    db
      .collection("creditCardRecurringExpenses")
      .where("userId", "==", uid)
      .get(),
    db.collection("documents").where("userId", "==", uid).get(),
    db.collection("hoaSummaries").where("userId", "==", uid).get(),
    db
      .collection("currencyConversions")
      .where("userId", "==", uid)
      .get(),
  ]);

  const preferences =
    serializePreferences(preferencesDoc) ?? DEFAULT_PREFERENCES;
  const savedConfig = serializeMonthlyBudget(monthlyDoc, month);
  const config: MonthlyBudgetConfig = savedConfig ?? {
    ...preferences,
    month,
    configured: false,
    openingArsBalance: null,
  };
  const timing = getMonthTiming(month, now);

  const periods = new Map(
    periodsSnapshot.docs
      .map(serializeFixedExpensePeriod)
      .filter((period) => period.month === month)
      .map((period) => [period.fixedExpenseId, period])
  );
  const fixedExpenses = fixedSnapshot.docs
    .map(serializeFixedExpense)
    .filter((expense) => isFixedExpenseActive(expense, month))
    .map((expense) => {
      const period =
        periods.get(expense.id) ??
        resolveImportedFixedPeriod(
          expense,
          month,
          documentsSnapshot.docs,
          hoaSnapshot.docs
        );
      const budgetedAmount = resolveFixedExpenseAmount(expense, period);
      return {
        ...expense,
        status: period?.status ?? ("pending" as const),
        actualAmount: period?.actualAmount ?? null,
        budgetedAmount,
        overdue:
          (period?.status ?? "pending") === "pending" &&
          expense.dueDay !== null &&
          month <= getArgentinaPeriod(now) &&
          timing.currentDay > expense.dueDay,
      };
    });
  const fixedCommitted = sum(fixedExpenses.map((item) => item.budgetedAmount));

  const linkedExpenseIds = new Set(
    Array.from(periods.values())
      .filter((period) => period.sourceType === "expense" && period.sourceId)
      .map((period) => period.sourceId as string)
  );
  const spentByCategory: Record<string, number> = {};
  let variableSpent = 0;
  let missingVariableUsdRate = false;
  for (const doc of expensesSnapshot.docs) {
    if (linkedExpenseIds.has(doc.id)) continue;
    const raw = doc.data();
    const date = toDate(raw.date);
    if (!date || getArgentinaPeriod(date) !== month) continue;
    const amount =
      raw.currency === "USD"
        ? typeof raw.arsRate === "number"
          ? numberOrZero(raw.amount) * raw.arsRate
          : ((missingVariableUsdRate = true), 0)
        : numberOrZero(raw.amount);
    variableSpent += amount;
    const category =
      typeof raw.category === "string" && raw.category.trim()
        ? raw.category
        : "Otros";
    spentByCategory[category] = (spentByCategory[category] ?? 0) + amount;
  }

  const limits = getLimitSummary(
    limitsSnapshot.docs
      .filter((doc) => doc.data().month === month)
      .map(serializeSpendingLimit),
    spentByCategory
  );
  const hasLimitExceeded = limits.some((limit) => limit.percentageUsed >= 100);
  const hasLimitWarning = limits.some(
    (limit) => limit.percentageUsed >= 80 && limit.percentageUsed < 100
  );

  const directArsIncome = incomeSnapshot.docs.reduce((total, doc) => {
    const raw = doc.data();
    const date = toDate(raw.date);
    if (!date || getArgentinaPeriod(date) !== month || raw.currency === "USD") {
      return total;
    }
    return total + numberOrZero(raw.amount);
  }, 0);
  const conversions = conversionsSnapshot.docs.map(serializeConversion);
  const convertedArs = conversions.reduce((total, conversion) => {
    const date = new Date(conversion.date);
    return getArgentinaPeriod(date) === month
      ? total + conversion.arsReceived
      : total;
  }, 0);
  const foreignBalances = calculateForeignBalances(
    incomeSnapshot.docs.map((doc) => {
      const raw = doc.data();
      return {
        currency:
          raw.currency === "USD" || raw.currency === "USDT"
            ? raw.currency
            : "ARS",
        amount: numberOrZero(raw.amount),
      };
    }),
    conversions
  );

  const cycles: CreditCardCycle[] = cyclesSnapshot.docs.map(serializeCycle);
  const purchases: CreditCardPurchase[] =
    purchasesSnapshot.docs.map(serializePurchase);
  const recurring: CreditCardRecurringExpense[] =
    recurringSnapshot.docs.map(serializeRecurringExpense);
  const projections = groupInstallmentsByPeriod(
    purchases,
    cycles,
    recurring,
    `${month}-01`
  );
  const currentCard = sumCardTotals(projections, month);
  const nextCard = sumCardTotals(projections, nextMonth);
  const usdRequired =
    currentCard.usd > 0 ||
    nextCard.usd > 0 ||
    foreignBalances.available.USD > 0 ||
    foreignBalances.available.USDT > 0;
  const rate = usdRequired ? await fetchUsdRate() : null;
  const missingSources: string[] = [];
  if (missingVariableUsdRate) missingSources.push("Conversión de movimientos USD");
  if (usdRequired && !rate) missingSources.push("Cotización USD");

  const currentCardArs =
    currentCard.ars + (rate ? currentCard.usd * rate.price : 0);
  const nextCardArs = nextCard.ars + (rate ? nextCard.usd * rate.price : 0);
  const legacyCalculation = calculateMonthlyBudget({
    expectedIncome: config.expectedIncome,
    savingsMode: config.savingsMode,
    savingsValue: config.savingsValue,
    fixedExpenses: fixedCommitted,
    committedInstallments: currentCardArs,
    variableSpent,
    daysRemaining: timing.daysRemaining,
    daysInMonth: timing.daysInMonth,
    elapsedDays: timing.elapsedDays,
    hasLimitWarning,
    hasLimitExceeded,
    incomplete: !config.configured || missingSources.length > 0,
  });
  const variableCoverage = limits.reduce(
    (total, limit) => total + Math.max(limit.limitAmount, limit.spentAmount),
    0
  );
  const cashFunding = calculateCashFunding({
    openingArsBalance: config.openingArsBalance ?? 0,
    directArsIncome,
    convertedArs,
    fixedExpenses: fixedCommitted,
    committedInstallments: currentCardArs,
    variableSpent,
    variableCoverage,
    arsBufferAmount: config.arsBufferAmount,
    daysRemaining: timing.daysRemaining,
  });
  const cashStatus = calculateMonthlyBudget({
    expectedIncome: cashFunding.fundedArs,
    savingsMode: "fixed",
    savingsValue: 0,
    fixedExpenses: fixedCommitted,
    committedInstallments: currentCardArs,
    variableSpent,
    daysRemaining: timing.daysRemaining,
    daysInMonth: timing.daysInMonth,
    elapsedDays: timing.elapsedDays,
    hasLimitWarning,
    hasLimitExceeded,
    incomplete:
      !config.configured ||
      config.openingArsBalance === null ||
      missingSources.length > 0,
  });
  const cashMode = config.fundingMode === "cash";
  const calculation = cashMode
    ? {
        ...cashStatus,
        savingsReserved: 0,
        available: cashFunding.available,
        dailyAvailable: cashFunding.dailyAvailable,
      }
    : legacyCalculation;

  const alerts = buildAlerts({
    limits,
    fixedExpenses,
    nextCardArs,
    nextCardUsd: nextCard.usd,
    dailyAvailable: calculation.dailyAvailable,
    initialDailyAvailable: calculation.initialDailyAvailable,
  });

  return {
    month,
    configured: config.configured,
    plan: {
      expectedIncome: config.expectedIncome,
      savingsMode: config.savingsMode,
      savingsValue: config.savingsValue,
      fundingMode: config.fundingMode,
      arsBufferAmount: config.arsBufferAmount,
    },
    status: calculation.status,
    daysRemaining: timing.daysRemaining,
    daysInMonth: timing.daysInMonth,
    amounts: {
      expectedIncome: config.expectedIncome,
      registeredIncome: directArsIncome,
      savingsReserved: calculation.savingsReserved,
      fixedCommitted,
      cardCommitted: currentCardArs,
      cardCommittedUsd: currentCard.usd,
      variableSpent,
      available: calculation.available,
      dailyAvailable: calculation.dailyAvailable,
      initialDailyAvailable: calculation.initialDailyAvailable,
      nextMonthCardCommitted: nextCardArs,
      nextMonthCardCommittedUsd: nextCard.usd,
    },
    funding: {
      mode: config.fundingMode,
      openingArsBalance: config.openingArsBalance,
      directArsIncome,
      convertedArs,
      fundedArs: cashFunding.fundedArs,
      coverageTarget: cashFunding.coverageTarget,
      conversionNeededArs: cashFunding.conversionNeededArs,
      foreignReceived: foreignBalances.received,
      foreignConverted: foreignBalances.converted,
      foreignAvailable: foreignBalances.available,
    },
    fixedExpenses,
    limits,
    alerts,
    dataQuality: {
      complete:
        config.configured &&
        missingSources.length === 0 &&
        (!cashMode || config.openingArsBalance !== null),
      missingSources,
      usdRate: rate?.price ?? null,
      usdRateUpdatedAt: rate?.updatedAt ?? null,
    },
  };
}

function buildAlerts({
  limits,
  fixedExpenses,
  nextCardArs,
  nextCardUsd,
  dailyAvailable,
  initialDailyAvailable,
}: Pick<MonthlyBudgetSummary, "limits" | "fixedExpenses"> & {
  nextCardArs: number;
  nextCardUsd: number;
  dailyAvailable: number;
  initialDailyAvailable: number;
}) {
  const alerts: BudgetAlert[] = [];
  for (const limit of limits) {
    if (limit.percentageUsed < 80) continue;
    const exceeded = limit.percentageUsed >= 100;
    alerts.push({
      id: `limit-${limit.category}`,
      severity: exceeded ? "danger" : "warning",
      title: exceeded
        ? `Superaste el límite de ${limit.category}`
        : `${limit.category} llegó al ${limit.percentageUsed}%`,
      description: `Gastaste $${Math.round(limit.spentAmount).toLocaleString("es-AR")} de $${Math.round(limit.limitAmount).toLocaleString("es-AR")}.`,
    });
  }
  for (const expense of fixedExpenses.filter((item) => item.overdue)) {
    alerts.push({
      id: `fixed-${expense.id}`,
      severity: "warning",
      title: `${expense.name} figura pendiente`,
      description: `Venció el día ${expense.dueDay}. Marcá el pago cuando lo registres.`,
    });
  }
  if (
    initialDailyAvailable > 0 &&
    dailyAvailable < initialDailyAvailable * 0.75
  ) {
    alerts.push({
      id: "daily-drop",
      severity: "warning",
      title: "Bajó tu margen diario",
      description: `Ahora podés gastar $${Math.max(0, Math.round(dailyAvailable)).toLocaleString("es-AR")} por día.`,
    });
  }
  if (nextCardArs > 0 || nextCardUsd > 0) {
    alerts.push({
      id: "next-card",
      severity: "info",
      title: "Cuotas del mes que viene",
      description: `$${Math.round(nextCardArs).toLocaleString("es-AR")}${nextCardUsd > 0 ? ` (incluye USD ${nextCardUsd.toFixed(2)})` : ""} ya están comprometidos.`,
    });
  }
  return alerts.slice(0, 6);
}

function sumCardTotals(
  projections: ReturnType<typeof groupInstallmentsByPeriod>,
  month: string
) {
  return projections.reduce(
    (total, projection) => {
      if (projection.periodMonth === month) {
        total.ars += projection.totals.ARS;
        total.usd += projection.totals.USD;
      }
      return total;
    },
    { ars: 0, usd: 0 }
  );
}

function resolveImportedFixedPeriod(
  expense: ReturnType<typeof serializeFixedExpense>,
  month: string,
  documents: QueryDocumentSnapshot[],
  hoaSummaries: QueryDocumentSnapshot[]
) {
  if (expense.sourceType === "document" && expense.sourceKey) {
    const match = documents.find((document) => {
      const raw = document.data();
      const providerKey =
        typeof raw.providerId === "string"
          ? raw.providerId
          : typeof raw.provider === "string"
            ? raw.provider
            : "";
      const date =
        toDate(raw.periodStart) ??
        toDate(raw.issueDate) ??
        toDate(raw.dueDate) ??
        toDate(raw.uploadedAt);
      return (
        providerKey.toLocaleLowerCase("es") ===
          expense.sourceKey?.toLocaleLowerCase("es") &&
        date !== null &&
        getArgentinaPeriod(date) === month &&
        ["parsed", "needs_review", "paid"].includes(String(raw.status))
      );
    });
    if (match) {
      const raw = match.data();
      const actualAmount = numberOrZero(raw.amount ?? raw.totalAmount);
      if (actualAmount > 0) {
        return {
          fixedExpenseId: expense.id,
          month,
          status: "pending" as const,
          actualAmount,
          sourceType: "document" as const,
          sourceId: match.id,
        };
      }
    }
  }
  if (expense.sourceType === "hoa") {
    const match = hoaSummaries.find((summary) => {
      const raw = summary.data();
      const keyMatches =
        !expense.sourceKey ||
        raw.buildingCode === expense.sourceKey ||
        raw.unitCode === expense.sourceKey;
      return raw.periodKey === month && keyMatches;
    });
    if (match) {
      const actualAmount = numberOrZero(match.data().totalToPayUnit);
      if (actualAmount > 0) {
        return {
          fixedExpenseId: expense.id,
          month,
          status: "pending" as const,
          actualAmount,
          sourceType: "hoa" as const,
          sourceId: match.id,
        };
      }
    }
  }
  return undefined;
}

function getArgentinaPeriod(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

async function fetchUsdRate() {
  try {
    const response = await fetch(
      "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiat: "ARS",
          page: 1,
          rows: 10,
          tradeType: "SELL",
          asset: "USDT",
          countries: [],
          payTypes: [],
        }),
        next: { revalidate: 300 },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const price = Number(data?.data?.[0]?.adv?.price);
    return Number.isFinite(price) && price > 0
      ? { price, updatedAt: new Date().toISOString() }
      : null;
  } catch {
    return null;
  }
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
