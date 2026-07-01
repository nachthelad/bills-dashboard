import { isoToDate, toIsoDate } from "@/lib/date-picker";

export type CreditCardStatus = "active" | "archived";
export type CreditCardCurrency = "ARS" | "USD";

export type CreditCard = {
  id: string;
  name: string;
  status: CreditCardStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreditCardCycle = {
  id: string;
  cardId: string;
  periodMonth: string;
  closingDate: string;
  dueDate: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreditCardPurchase = {
  id: string;
  cardId: string;
  name: string;
  purchaseDate: string;
  totalAmount: number;
  currency: CreditCardCurrency;
  installments: number;
  firstPeriodMonth: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreditCardRecurringExpenseVersion = {
  effectiveFrom: string;
  name: string;
  monthlyAmount: number;
  currency: CreditCardCurrency;
};

export type CreditCardRecurringExpense = {
  id: string;
  cardId: string;
  startDate: string;
  anchorDay: number;
  endDate: string | null;
  versions: CreditCardRecurringExpenseVersion[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreditCardInstallment = {
  kind: "installment";
  purchaseId: string;
  purchaseName: string;
  purchaseDate: string;
  cardId: string;
  periodMonth: string;
  installmentNumber: number;
  installmentCount: number;
  amount: number;
  currency: CreditCardCurrency;
};

export type CreditCardRecurringCharge = {
  kind: "recurring";
  recurringExpenseId: string;
  purchaseName: string;
  purchaseDate: string;
  cardId: string;
  periodMonth: string;
  amount: number;
  currency: CreditCardCurrency;
};

export type CreditCardProjectionItem =
  | CreditCardInstallment
  | CreditCardRecurringCharge;

export type CurrencyTotals = {
  ARS: number;
  USD: number;
};

export type CreditCardPeriodProjection = {
  cardId: string;
  periodMonth: string;
  cycle: CreditCardCycle | null;
  installments: CreditCardProjectionItem[];
  totals: CurrencyTotals;
};

const PERIOD_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidPeriodMonth(value: string) {
  return PERIOD_MONTH_RE.test(value);
}

export function addMonthsToPeriodMonth(value: string, monthCount: number) {
  const match = PERIOD_MONTH_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid period month: ${value}`);
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1 + monthCount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getFirstPeriodMonthFromPurchaseDate(purchaseDate: string) {
  const date = isoToDate(purchaseDate);
  if (!date) {
    throw new Error(`Invalid ISO date: ${purchaseDate}`);
  }
  return addMonthsToPeriodMonth(toIsoDate(date).slice(0, 7), 1);
}

export function resolveFirstPeriodMonth(
  purchaseDate: string,
  cycles: CreditCardCycle[],
  fallbackPeriodMonth?: string
) {
  const purchase = isoToDate(purchaseDate);
  if (!purchase) {
    throw new Error(`Invalid ISO date: ${purchaseDate}`);
  }

  const nextCycle = cycles
    .filter((cycle) => {
      const closingDate = isoToDate(cycle.closingDate);
      if (!closingDate || closingDate <= purchase) return false;
      const differenceInDays =
        (closingDate.getTime() - purchase.getTime()) / (24 * 60 * 60 * 1000);
      return differenceInDays <= 45;
    })
    .sort((a, b) => a.closingDate.localeCompare(b.closingDate))[0];

  if (nextCycle) return nextCycle.periodMonth;
  const previousCycle = cycles
    .filter((cycle) => {
      const closingDate = isoToDate(cycle.closingDate);
      if (!closingDate || closingDate > purchase) return false;
      const differenceInDays =
        (purchase.getTime() - closingDate.getTime()) / (24 * 60 * 60 * 1000);
      return differenceInDays <= 45;
    })
    .sort((a, b) => b.closingDate.localeCompare(a.closingDate))[0];

  if (previousCycle) {
    return addMonthsToPeriodMonth(previousCycle.periodMonth, 1);
  }
  if (fallbackPeriodMonth && isValidPeriodMonth(fallbackPeriodMonth)) {
    return fallbackPeriodMonth;
  }
  return getFirstPeriodMonthFromPurchaseDate(purchaseDate);
}

export function splitAmountIntoInstallments(
  totalAmount: number,
  installmentCount: number
) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Total amount must be greater than zero");
  }
  if (!Number.isInteger(installmentCount) || installmentCount <= 0) {
    throw new Error("Installment count must be a positive integer");
  }

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  const amounts = Array.from(
    { length: installmentCount },
    () => baseCents / 100
  );
  amounts[installmentCount - 1] =
    (baseCents + totalCents - baseCents * installmentCount) / 100;
  return amounts;
}

export function projectPurchaseInstallments(
  purchase: CreditCardPurchase
): CreditCardInstallment[] {
  return splitAmountIntoInstallments(
    purchase.totalAmount,
    purchase.installments
  ).map((amount, index) => ({
    kind: "installment" as const,
    purchaseId: purchase.id,
    purchaseName: purchase.name,
    purchaseDate: purchase.purchaseDate,
    cardId: purchase.cardId,
    periodMonth: addMonthsToPeriodMonth(purchase.firstPeriodMonth, index),
    installmentNumber: index + 1,
    installmentCount: purchase.installments,
    amount,
    currency: purchase.currency,
  }));
}

export function getRecurringOccurrenceDate(
  startDate: string,
  anchorDay: number,
  monthOffset: number
) {
  const start = isoToDate(startDate);
  if (!start || !Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    throw new Error("Invalid recurring expense schedule");
  }
  const targetMonth = new Date(
    start.getFullYear(),
    start.getMonth() + monthOffset,
    1
  );
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();
  return toIsoDate(
    new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth(),
      Math.min(anchorDay, lastDay)
    )
  );
}

export function getNextRecurringOccurrenceDate(
  expense: Pick<
    CreditCardRecurringExpense,
    "startDate" | "anchorDay" | "endDate"
  >,
  afterDate: string
) {
  for (let monthOffset = 0; monthOffset < 1200; monthOffset += 1) {
    const occurrenceDate = getRecurringOccurrenceDate(
      expense.startDate,
      expense.anchorDay,
      monthOffset
    );
    if (expense.endDate && occurrenceDate > expense.endDate) return null;
    if (occurrenceDate > afterDate) return occurrenceDate;
  }
  return null;
}

export function projectRecurringExpenseCharges(
  expense: CreditCardRecurringExpense,
  cycles: CreditCardCycle[],
  today: string,
  futureMonthCount = 12
): CreditCardRecurringCharge[] {
  const horizonPeriod = addMonthsToPeriodMonth(
    today.slice(0, 7),
    futureMonthCount - 1
  );
  const versions = [...expense.versions].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );
  const charges: CreditCardRecurringCharge[] = [];

  for (let monthOffset = 0; monthOffset < 1200; monthOffset += 1) {
    const purchaseDate = getRecurringOccurrenceDate(
      expense.startDate,
      expense.anchorDay,
      monthOffset
    );
    if (expense.endDate && purchaseDate > expense.endDate) break;

    const periodMonth = resolveFirstPeriodMonth(purchaseDate, cycles);
    if (periodMonth > horizonPeriod) break;

    const version = versions
      .filter((candidate) => candidate.effectiveFrom <= purchaseDate)
      .at(-1);
    if (!version) continue;
    charges.push({
      kind: "recurring",
      recurringExpenseId: expense.id,
      purchaseName: version.name,
      purchaseDate,
      cardId: expense.cardId,
      periodMonth,
      amount: version.monthlyAmount,
      currency: version.currency,
    });
  }

  return charges;
}

export function calculateCurrencyTotals(
  installments: CreditCardInstallment[]
): CurrencyTotals {
  return installments.reduce<CurrencyTotals>(
    (totals, installment) => {
      totals[installment.currency] += installment.amount;
      return totals;
    },
    { ARS: 0, USD: 0 }
  );
}

export function groupInstallmentsByPeriod(
  purchases: CreditCardPurchase[],
  cycles: CreditCardCycle[],
  recurringExpenses: CreditCardRecurringExpense[] = [],
  today = toIsoDate(new Date())
): CreditCardPeriodProjection[] {
  const cycleByKey = new Map(
    cycles.map((cycle) => [`${cycle.cardId}_${cycle.periodMonth}`, cycle])
  );
  const projections = new Map<string, CreditCardPeriodProjection>();

  for (const purchase of purchases) {
    const firstPeriodMonth = resolveFirstPeriodMonth(
      purchase.purchaseDate,
      cycles.filter((cycle) => cycle.cardId === purchase.cardId),
      purchase.firstPeriodMonth
    );
    for (const installment of projectPurchaseInstallments({
      ...purchase,
      firstPeriodMonth,
    })) {
      const key = `${installment.cardId}_${installment.periodMonth}`;
      const projection = projections.get(key) ?? {
        cardId: installment.cardId,
        periodMonth: installment.periodMonth,
        cycle: cycleByKey.get(key) ?? null,
        installments: [],
        totals: { ARS: 0, USD: 0 },
      };

      projection.installments.push(installment);
      projection.totals[installment.currency] += installment.amount;
      projections.set(key, projection);
    }
  }

  for (const expense of recurringExpenses) {
    const cardCycles = cycles.filter((cycle) => cycle.cardId === expense.cardId);
    for (const charge of projectRecurringExpenseCharges(
      expense,
      cardCycles,
      today
    )) {
      const key = `${charge.cardId}_${charge.periodMonth}`;
      const projection = projections.get(key) ?? {
        cardId: charge.cardId,
        periodMonth: charge.periodMonth,
        cycle: cycleByKey.get(key) ?? null,
        installments: [],
        totals: { ARS: 0, USD: 0 },
      };
      projection.installments.push(charge);
      projection.totals[charge.currency] += charge.amount;
      projections.set(key, projection);
    }
  }

  for (const projection of projections.values()) {
    projection.installments.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "installment" ? -1 : 1;
      }
      if (a.kind === "recurring" || b.kind === "recurring") {
        return a.purchaseDate.localeCompare(b.purchaseDate);
      }
      const carriedInstallmentDiff =
        Number(b.installmentNumber > 1) - Number(a.installmentNumber > 1);
      if (carriedInstallmentDiff !== 0) return carriedInstallmentDiff;
      return a.purchaseDate.localeCompare(b.purchaseDate);
    });
  }

  return Array.from(projections.values()).sort((a, b) => {
    const periodDiff = a.periodMonth.localeCompare(b.periodMonth);
    if (periodDiff !== 0) return periodDiff;
    return a.cardId.localeCompare(b.cardId);
  });
}

export function suggestNextCycle(cycle: CreditCardCycle) {
  return {
    periodMonth: addMonthsToPeriodMonth(cycle.periodMonth, 1),
    closingDate: addMonthsToIsoDate(cycle.closingDate, 1),
    dueDate: addMonthsToIsoDate(cycle.dueDate, 1),
  };
}

export function formatPeriodMonth(value: string) {
  const match = PERIOD_MONTH_RE.exec(value);
  if (!match) return value;

  const label = new Date(Number(match[1]), Number(match[2]) - 1, 1)
    .toLocaleString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function addMonthsToIsoDate(value: string, monthCount: number) {
  const date = isoToDate(value);
  if (!date) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const year = date.getFullYear();
  const month = date.getMonth() + monthCount;
  const day = date.getDate();
  const maxDay = new Date(year, month + 1, 0).getDate();
  return toIsoDate(new Date(year, month, Math.min(day, maxDay)));
}
