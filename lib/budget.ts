export const BUDGET_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type SavingsMode = "fixed" | "percentage";
export type BudgetStatus = "good" | "tight" | "over" | "incomplete";
export type FixedExpenseStatus = "pending" | "paid";

export type BudgetPreferences = {
  expectedIncome: number;
  savingsMode: SavingsMode;
  savingsValue: number;
};

export type MonthlyBudgetConfig = BudgetPreferences & {
  month: string;
  configured: boolean;
};

export type FixedExpense = {
  id: string;
  name: string;
  category: string;
  estimatedAmount: number;
  dueDay: number | null;
  activeFrom: string;
  inactiveFrom: string | null;
  sourceType: "manual" | "document" | "hoa";
  sourceKey: string | null;
};

export type FixedExpensePeriod = {
  fixedExpenseId: string;
  month: string;
  status: FixedExpenseStatus;
  actualAmount: number | null;
  sourceType: "manual" | "document" | "expense" | "hoa" | null;
  sourceId: string | null;
};

export type SpendingLimit = {
  category: string;
  limitAmount: number;
};

export type BudgetAlert = {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  description: string;
};

export type FixedExpenseSummary = FixedExpense & {
  status: FixedExpenseStatus;
  actualAmount: number | null;
  budgetedAmount: number;
  overdue: boolean;
};

export type SpendingLimitSummary = SpendingLimit & {
  spentAmount: number;
  percentageUsed: number;
};

export type MonthlyBudgetSummary = {
  month: string;
  configured: boolean;
  plan: BudgetPreferences;
  status: BudgetStatus;
  daysRemaining: number;
  daysInMonth: number;
  amounts: {
    expectedIncome: number;
    registeredIncome: number;
    savingsReserved: number;
    fixedCommitted: number;
    cardCommitted: number;
    cardCommittedUsd: number;
    variableSpent: number;
    available: number;
    dailyAvailable: number;
    initialDailyAvailable: number;
    nextMonthCardCommitted: number;
    nextMonthCardCommittedUsd: number;
  };
  fixedExpenses: FixedExpenseSummary[];
  limits: SpendingLimitSummary[];
  alerts: BudgetAlert[];
  dataQuality: {
    complete: boolean;
    missingSources: string[];
    usdRate: number | null;
    usdRateUpdatedAt: string | null;
  };
};

type MonthlyBudgetCalculationInput = {
  expectedIncome: number;
  savingsMode: SavingsMode;
  savingsValue: number;
  fixedExpenses: number;
  committedInstallments: number;
  variableSpent: number;
  daysRemaining: number;
  daysInMonth: number;
  elapsedDays: number;
  hasLimitWarning?: boolean;
  hasLimitExceeded?: boolean;
  incomplete?: boolean;
};

export function toCents(value: number) {
  return Math.round(value * 100);
}

export function fromCents(value: number) {
  return value / 100;
}

export function calculateSavingsAmount(
  expectedIncome: number,
  mode: SavingsMode,
  value: number
) {
  const incomeCents = toCents(expectedIncome);
  if (mode === "fixed") return fromCents(Math.max(0, toCents(value)));
  return fromCents(Math.round(incomeCents * (Math.max(0, value) / 100)));
}

export function calculateMonthlyBudget(input: MonthlyBudgetCalculationInput) {
  const savingsReserved = calculateSavingsAmount(
    input.expectedIncome,
    input.savingsMode,
    input.savingsValue
  );
  const initialAvailableCents =
    toCents(input.expectedIncome) -
    toCents(savingsReserved) -
    toCents(input.fixedExpenses) -
    toCents(input.committedInstallments);
  const availableCents = initialAvailableCents - toCents(input.variableSpent);
  const dailyAvailableCents =
    input.daysRemaining > 0
      ? Math.floor(availableCents / input.daysRemaining)
      : availableCents;
  const initialDailyAvailableCents =
    input.daysInMonth > 0
      ? Math.floor(initialAvailableCents / input.daysInMonth)
      : initialAvailableCents;
  const expectedSpentToDateCents =
    input.daysInMonth > 0
      ? Math.round(
          initialAvailableCents * (input.elapsedDays / input.daysInMonth)
        )
      : initialAvailableCents;
  const aheadOfPace =
    toCents(input.variableSpent) > Math.max(0, expectedSpentToDateCents);

  let status: BudgetStatus = "good";
  if (input.incomplete) status = "incomplete";
  else if (availableCents < 0 || input.hasLimitExceeded) status = "over";
  else if (aheadOfPace || input.hasLimitWarning) status = "tight";

  return {
    savingsReserved,
    available: fromCents(availableCents),
    dailyAvailable: fromCents(dailyAvailableCents),
    initialDailyAvailable: fromCents(initialDailyAvailableCents),
    aheadOfPace,
    status,
  };
}

export function getArgentinaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUDGET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  return {
    year,
    month,
    day,
    periodMonth: `${year}-${String(month).padStart(2, "0")}`,
  };
}

export function getMonthTiming(periodMonth: string, now = new Date()) {
  if (!PERIOD_MONTH_RE.test(periodMonth)) {
    throw new Error("El mes no es válido");
  }
  const [year, month] = periodMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const argentina = getArgentinaDateParts(now);
  if (periodMonth !== argentina.periodMonth) {
    return {
      daysInMonth,
      elapsedDays: periodMonth < argentina.periodMonth ? daysInMonth : 0,
      daysRemaining: periodMonth < argentina.periodMonth ? 0 : daysInMonth,
      currentDay: periodMonth < argentina.periodMonth ? daysInMonth : 0,
    };
  }
  return {
    daysInMonth,
    elapsedDays: Math.max(0, argentina.day - 1),
    daysRemaining: daysInMonth - argentina.day + 1,
    currentDay: argentina.day,
  };
}

export function isFixedExpenseActive(expense: FixedExpense, month: string) {
  return (
    expense.activeFrom <= month &&
    (expense.inactiveFrom === null || expense.inactiveFrom > month)
  );
}

export function resolveFixedExpenseAmount(
  expense: Pick<FixedExpense, "estimatedAmount">,
  period?: Pick<FixedExpensePeriod, "status" | "actualAmount"> | null
) {
  return period?.status === "paid" && period.actualAmount !== null
    ? period.actualAmount
    : expense.estimatedAmount;
}

export function getNextPeriodMonth(periodMonth: string) {
  if (!PERIOD_MONTH_RE.test(periodMonth)) {
    throw new Error("El mes no es válido");
  }
  const [year, month] = periodMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getLimitSummary(
  limits: SpendingLimit[],
  spentByCategory: Record<string, number>
): SpendingLimitSummary[] {
  return limits.map((limit) => {
    const spentAmount = spentByCategory[limit.category] ?? 0;
    return {
      ...limit,
      spentAmount,
      percentageUsed:
        limit.limitAmount > 0
          ? Math.round((spentAmount / limit.limitAmount) * 100)
          : 0,
    };
  });
}
