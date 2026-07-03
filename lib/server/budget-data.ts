import type { DocumentSnapshot } from "firebase-admin/firestore";

import { parseAmountInput } from "@/lib/amount-parser";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  PERIOD_MONTH_RE,
  type BudgetPreferences,
  type FixedExpense,
  type FixedExpensePeriod,
  type MonthlyBudgetConfig,
  type FundingMode,
  type SavingsMode,
  type SpendingLimit,
} from "@/lib/budget";

export class BudgetDataError extends Error {
  constructor(
    readonly statusCode: 400 | 403 | 404,
    message: string
  ) {
    super(message);
  }
}

export function parsePeriodMonth(value: unknown) {
  const month = typeof value === "string" ? value.trim() : "";
  if (!PERIOD_MONTH_RE.test(month)) {
    throw new BudgetDataError(400, "El mes no es válido");
  }
  return month;
}

export function parsePreferencesInput(body: Record<string, unknown>) {
  const expectedIncome = parseNonNegativeAmount(
    body.expectedIncome,
    "El ingreso esperado no es válido"
  );
  const savingsMode = parseSavingsMode(body.savingsMode);
  const savingsValue = parseNonNegativeAmount(
    body.savingsValue,
    "El objetivo de ahorro no es válido"
  );
  if (savingsMode === "percentage" && savingsValue > 100) {
    throw new BudgetDataError(400, "El porcentaje de ahorro debe estar entre 0 y 100");
  }
  const fundingMode: FundingMode =
    body.fundingMode === "cash" ? "cash" : "planned";
  const arsBufferAmount = parseNonNegativeAmount(
    body.arsBufferAmount ?? 0,
    "El colchón en pesos no es válido"
  );
  return {
    expectedIncome,
    savingsMode,
    savingsValue,
    fundingMode,
    arsBufferAmount,
  };
}

export function parseOpeningArsBalance(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return parseNonNegativeAmount(value, "El saldo inicial no es válido");
}

export function parseFixedExpenseInput(
  body: Record<string, unknown>,
  fallbackMonth: string
) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  if (!name) throw new BudgetDataError(400, "El nombre es obligatorio");
  if (!category) throw new BudgetDataError(400, "La categoría es obligatoria");
  const estimatedAmount = parseNonNegativeAmount(
    body.estimatedAmount,
    "El importe estimado no es válido"
  );
  const dueDay =
    body.dueDay === null || body.dueDay === undefined || body.dueDay === ""
      ? null
      : Number(body.dueDay);
  if (
    dueDay !== null &&
    (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
  ) {
    throw new BudgetDataError(400, "El día de vencimiento debe estar entre 1 y 31");
  }
  const sourceType =
    body.sourceType === "document" || body.sourceType === "hoa"
      ? body.sourceType
      : "manual";
  return {
    name,
    category,
    estimatedAmount,
    dueDay,
    activeFrom: parsePeriodMonth(body.activeFrom ?? fallbackMonth),
    inactiveFrom:
      body.inactiveFrom === null || body.inactiveFrom === undefined
        ? null
        : parsePeriodMonth(body.inactiveFrom),
    sourceType,
    sourceKey:
      typeof body.sourceKey === "string" && body.sourceKey.trim()
        ? body.sourceKey.trim()
        : null,
  } satisfies Omit<FixedExpense, "id">;
}

export function parseFixedExpensePeriodInput(body: Record<string, unknown>) {
  const status = body.status === "paid" ? "paid" : "pending";
  const actualAmount =
    body.actualAmount === null ||
    body.actualAmount === undefined ||
    body.actualAmount === ""
      ? null
      : parseNonNegativeAmount(
          body.actualAmount,
          "El importe real no es válido"
        );
  if (status === "paid" && actualAmount === null) {
    throw new BudgetDataError(400, "Ingresá el importe pagado");
  }
  const sourceType = ["manual", "document", "expense", "hoa"].includes(
    String(body.sourceType)
  )
    ? (body.sourceType as FixedExpensePeriod["sourceType"])
    : "manual";
  return {
    status,
    actualAmount,
    sourceType,
    sourceId:
      typeof body.sourceId === "string" && body.sourceId.trim()
        ? body.sourceId.trim()
        : null,
  };
}

export function parseSpendingLimitsInput(body: Record<string, unknown>) {
  if (!Array.isArray(body.limits)) {
    throw new BudgetDataError(400, "La lista de límites no es válida");
  }
  const seen = new Set<string>();
  return body.limits.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      throw new BudgetDataError(400, "Uno de los límites no es válido");
    }
    const item = candidate as Record<string, unknown>;
    const category =
      typeof item.category === "string" ? item.category.trim() : "";
    if (!category || seen.has(category.toLocaleLowerCase("es"))) {
      throw new BudgetDataError(400, "Las categorías de los límites deben ser únicas");
    }
    seen.add(category.toLocaleLowerCase("es"));
    return {
      category,
      limitAmount: parseNonNegativeAmount(
        item.limitAmount,
        "El importe del límite no es válido"
      ),
    } satisfies SpendingLimit;
  });
}

export function serializePreferences(
  doc: DocumentSnapshot
): BudgetPreferences | null {
  if (!doc.exists) return null;
  const raw = doc.data() ?? {};
  return {
    expectedIncome: numberOrZero(raw.expectedIncome),
    savingsMode: normalizeSavingsMode(raw.savingsMode),
    savingsValue:
      typeof raw.savingsValue === "number" ? raw.savingsValue : 20,
    fundingMode: raw.fundingMode === "cash" ? "cash" : "planned",
    arsBufferAmount: numberOrZero(raw.arsBufferAmount),
  };
}

export function serializeMonthlyBudget(
  doc: DocumentSnapshot,
  month: string
): MonthlyBudgetConfig | null {
  const preferences = serializePreferences(doc);
  return preferences
    ? {
        ...preferences,
        month,
        configured: true,
        openingArsBalance:
          typeof doc.data()?.openingArsBalance === "number"
            ? doc.data()?.openingArsBalance
            : null,
      }
    : null;
}

export function serializeFixedExpense(doc: DocumentSnapshot): FixedExpense {
  const raw = doc.data() ?? {};
  return {
    id: doc.id,
    name: typeof raw.name === "string" ? raw.name : "Gasto fijo",
    category: typeof raw.category === "string" ? raw.category : "Otros",
    estimatedAmount: numberOrZero(raw.estimatedAmount),
    dueDay: typeof raw.dueDay === "number" ? raw.dueDay : null,
    activeFrom:
      typeof raw.activeFrom === "string" ? raw.activeFrom : "1970-01",
    inactiveFrom:
      typeof raw.inactiveFrom === "string" ? raw.inactiveFrom : null,
    sourceType:
      raw.sourceType === "document" || raw.sourceType === "hoa"
        ? raw.sourceType
        : "manual",
    sourceKey: typeof raw.sourceKey === "string" ? raw.sourceKey : null,
  };
}

export function serializeFixedExpensePeriod(
  doc: DocumentSnapshot
): FixedExpensePeriod {
  const raw = doc.data() ?? {};
  return {
    fixedExpenseId:
      typeof raw.fixedExpenseId === "string" ? raw.fixedExpenseId : "",
    month: typeof raw.month === "string" ? raw.month : "",
    status: raw.status === "paid" ? "paid" : "pending",
    actualAmount:
      typeof raw.actualAmount === "number" ? raw.actualAmount : null,
    sourceType: ["manual", "document", "expense", "hoa"].includes(
      String(raw.sourceType)
    )
      ? (raw.sourceType as FixedExpensePeriod["sourceType"])
      : null,
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : null,
  };
}

export function serializeSpendingLimit(doc: DocumentSnapshot): SpendingLimit {
  const raw = doc.data() ?? {};
  return {
    category: typeof raw.category === "string" ? raw.category : "Otros",
    limitAmount: numberOrZero(raw.limitAmount),
  };
}

export function toBudgetErrorResponse(error: unknown) {
  if (error instanceof BudgetDataError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  return null;
}

export async function getOwnedFixedExpense(uid: string, id: string) {
  const snapshot = await getAdminFirestore()
    .collection("fixedExpenses")
    .doc(id)
    .get();
  if (!snapshot.exists) {
    throw new BudgetDataError(404, "No se encontró el gasto fijo");
  }
  if (snapshot.data()?.userId !== uid) {
    throw new BudgetDataError(403, "No tenés permiso para modificar este gasto");
  }
  return snapshot;
}

function parseSavingsMode(value: unknown): SavingsMode {
  if (value === "fixed" || value === "percentage") return value;
  throw new BudgetDataError(400, "El modo de ahorro no es válido");
}

function normalizeSavingsMode(value: unknown): SavingsMode {
  return value === "fixed" ? "fixed" : "percentage";
}

function parseNonNegativeAmount(value: unknown, message: string) {
  const parsed = parseAmountInput(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BudgetDataError(400, message);
  }
  return Math.round(parsed * 100) / 100;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
