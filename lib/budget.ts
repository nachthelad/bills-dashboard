import { PROVIDER_HINTS } from "@/config/billing/providerHints";

export const BUDGET_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const BROAD_PROVIDER_CATEGORIES = new Set(["credit_card", "hoa", "other"]);

export type SavingsMode = "fixed" | "percentage";
export type FundingMode = "planned" | "cash";
export type BudgetStatus =
  | "good"
  | "tight"
  | "over"
  | "unfunded"
  | "incomplete";
export type FixedExpenseStatus = "pending" | "paid";
export type MoneyCurrency = "ARS" | "USD" | "USDT";
export type ForeignCurrency = Exclude<MoneyCurrency, "ARS">;

export type BudgetPreferences = {
  expectedIncome: number;
  savingsMode: SavingsMode;
  savingsValue: number;
  fundingMode: FundingMode;
  arsBufferAmount: number;
};

export type MonthlyBudgetConfig = BudgetPreferences & {
  month: string;
  configured: boolean;
  openingArsBalance: number | null;
};

export type IncomeSource = {
  id: string;
  name: string;
  currency: MoneyCurrency;
  expectedAmount: number;
  isVariable: boolean;
  isActive: boolean;
};

export type CurrencyConversion = {
  id: string;
  date: string;
  fromCurrency: ForeignCurrency;
  fromAmount: number;
  suggestedRateSource: "binance_p2p" | "manual" | "other";
  suggestedRate: number | null;
  usedRate: number;
  arsReceived: number;
  relatedIncomeSourceId: string | null;
  note: string | null;
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

export type SpendingLimitCandidate = SpendingLimit & {
  sourceId?: string;
  updatedAtMs?: number;
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
  funding: {
    mode: FundingMode;
    openingArsBalance: number | null;
    directArsIncome: number;
    convertedArs: number;
    fundedArs: number;
    coverageTarget: number;
    conversionNeededArs: number;
    foreignReceived: Record<ForeignCurrency, number>;
    foreignConverted: Record<ForeignCurrency, number>;
    foreignAvailable: Record<ForeignCurrency, number>;
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

export type ForeignBalanceInput = {
  currency: MoneyCurrency;
  amount: number;
};

export function calculateDirectArsIncome(income: ForeignBalanceInput[]) {
  return income.reduce(
    (total, entry) =>
      entry.currency === "ARS" ? total + entry.amount : total,
    0
  );
}

export function calculateForeignBalances(
  income: ForeignBalanceInput[],
  conversions: Array<Pick<CurrencyConversion, "fromCurrency" | "fromAmount">>
) {
  const received: Record<ForeignCurrency, number> = { USD: 0, USDT: 0 };
  const converted: Record<ForeignCurrency, number> = { USD: 0, USDT: 0 };
  for (const entry of income) {
    if (entry.currency !== "ARS") {
      received[entry.currency] += entry.amount;
    }
  }
  for (const conversion of conversions) {
    converted[conversion.fromCurrency] += conversion.fromAmount;
  }
  return {
    received,
    converted,
    available: {
      USD: fromCents(toCents(received.USD) - toCents(converted.USD)),
      USDT: fromCents(toCents(received.USDT) - toCents(converted.USDT)),
    },
  };
}

export function calculateCashFunding(input: {
  openingArsBalance: number;
  directArsIncome: number;
  convertedArs: number;
  fixedExpenses: number;
  committedInstallments: number;
  variableSpent: number;
  variableCoverage: number;
  arsBufferAmount: number;
  daysRemaining: number;
}) {
  const fundedArsCents =
    toCents(input.openingArsBalance) +
    toCents(input.directArsIncome) +
    toCents(input.convertedArs);
  const availableCents =
    fundedArsCents -
    toCents(input.fixedExpenses) -
    toCents(input.committedInstallments) -
    toCents(input.variableSpent) -
    toCents(input.arsBufferAmount);
  const coverageTargetCents =
    toCents(input.fixedExpenses) +
    toCents(input.committedInstallments) +
    toCents(input.variableCoverage) +
    toCents(input.arsBufferAmount);
  return {
    fundedArs: fromCents(fundedArsCents),
    available: fromCents(availableCents),
    dailyAvailable: fromCents(
      input.daysRemaining > 0
        ? Math.floor(availableCents / input.daysRemaining)
        : availableCents
    ),
    coverageTarget: fromCents(coverageTargetCents),
    conversionNeededArs: fromCents(
      Math.max(0, coverageTargetCents - fundedArsCents)
    ),
  };
}

export function resolveCashBudgetStatus(input: {
  incomplete: boolean;
  hasLimitExceeded: boolean;
  conversionNeededArs: number;
  aheadOfPace: boolean;
  hasLimitWarning: boolean;
}): BudgetStatus {
  if (input.incomplete) return "incomplete";
  if (input.hasLimitExceeded) return "over";
  if (input.conversionNeededArs > 0) return "unfunded";
  if (input.aheadOfPace || input.hasLimitWarning) return "tight";
  return "good";
}

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
  return period?.actualAmount !== null && period?.actualAmount !== undefined
    ? period.actualAmount
    : expense.estimatedAmount;
}

export function fixedExpenseSourceMatches(
  sourceKey: string | null | undefined | Array<string | null | undefined>,
  values: Array<string | null | undefined>
) {
  const normalizedSources = (Array.isArray(sourceKey) ? sourceKey : [sourceKey])
    .map(normalizeFixedExpenseSource)
    .filter((source): source is FixedExpenseSourceMatch => source !== null);
  const normalizedValues = values
    .map(normalizeFixedExpenseSource)
    .filter((value): value is FixedExpenseSourceMatch => value !== null);

  return normalizedSources.some((source) =>
    normalizedValues.some((value) =>
      fixedExpenseSourceValueMatches(source, value)
    )
  );
}

export function getNextPeriodMonth(periodMonth: string) {
  if (!PERIOD_MONTH_RE.test(periodMonth)) {
    throw new Error("El mes no es válido");
  }
  const [year, month] = periodMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

type FixedExpenseSourceMatch = {
  text: string;
  compact: string;
  category: string | null;
};

function fixedExpenseSourceValueMatches(
  source: FixedExpenseSourceMatch,
  value: FixedExpenseSourceMatch
) {
  if (
    source.text === value.text ||
    source.compact === value.compact ||
    value.text.includes(source.text) ||
    source.text.includes(value.text) ||
    value.compact.includes(source.compact) ||
    source.compact.includes(value.compact)
  ) {
    return true;
  }

  return (
    source.category !== null &&
    source.category === value.category &&
    !BROAD_PROVIDER_CATEGORIES.has(source.category)
  );
}

function normalizeFixedExpenseSource(
  value: string | null | undefined
): FixedExpenseSourceMatch | null {
  const text = value
    ?.trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!text) return null;
  return {
    text,
    compact: text.replace(/[^a-z0-9]/g, ""),
    category: inferFixedExpenseProviderCategory(text),
  };
}

function inferFixedExpenseProviderCategory(text: string) {
  const compact = text.replace(/[^a-z0-9]/g, "");
  for (const hint of PROVIDER_HINTS) {
    if (hint.category === text || hint.category === compact) {
      return hint.category;
    }
    const searchable = [
      hint.providerId,
      hint.providerName,
      hint.category,
      ...hint.keywords,
    ].map((value) => {
      const normalized = value
        .trim()
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return {
        text: normalized,
        compact: normalized.replace(/[^a-z0-9]/g, ""),
      };
    });
    if (
      searchable.some(
        (candidate) =>
          candidate.text === text ||
          candidate.compact === compact ||
          candidate.text.includes(text) ||
          text.includes(candidate.text) ||
          candidate.compact.includes(compact) ||
          compact.includes(candidate.compact)
      )
    ) {
      return hint.category;
    }
  }
  return null;
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

export function dedupeSpendingLimits(
  candidates: SpendingLimitCandidate[]
): SpendingLimit[] {
  const unique = new Map<string, SpendingLimitCandidate>();
  for (const candidate of candidates) {
    const key = candidate.category.trim().toLocaleLowerCase("es");
    const current = unique.get(key);
    const candidateTime = candidate.updatedAtMs ?? 0;
    const currentTime = current?.updatedAtMs ?? 0;
    const candidateId = candidate.sourceId ?? "";
    const currentId = current?.sourceId ?? "";
    if (
      !current ||
      candidateTime > currentTime ||
      (candidateTime === currentTime &&
        candidateId.localeCompare(currentId) > 0)
    ) {
      unique.set(key, candidate);
    }
  }
  return Array.from(unique.values()).map(({ category, limitAmount }) => ({
    category,
    limitAmount,
  }));
}
