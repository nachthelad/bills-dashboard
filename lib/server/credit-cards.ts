import type { DocumentSnapshot } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  getFirstPeriodMonthFromPurchaseDate,
  isValidPeriodMonth,
  resolveFirstPeriodMonth,
  type CreditCard,
  type CreditCardCurrency,
  type CreditCardCycle,
  type CreditCardPurchase,
  type CreditCardRecurringExpense,
  type CreditCardRecurringExpenseVersion,
  type CreditCardStatus,
} from "@/lib/credit-card-utils";
import { parseAmountInput } from "@/lib/amount-parser";
import {
  serializeSnapshot,
  toIsoDateTime,
} from "@/lib/server/document-serializer";
import { isoToDate } from "@/lib/date-picker";

export class CreditCardDataError extends Error {
  constructor(
    readonly statusCode: 400 | 403 | 404,
    message: string
  ) {
    super(message);
  }
}

export function parseCardName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new CreditCardDataError(400, "Card name required");
  return name;
}

export function parseCardStatus(value: unknown): CreditCardStatus {
  if (value === "active" || value === "archived") return value;
  throw new CreditCardDataError(400, "Invalid card status");
}

export function parseCurrency(value: unknown): CreditCardCurrency {
  if (value === "ARS" || value === "USD") return value;
  throw new CreditCardDataError(400, "Invalid currency");
}

export function parseCycleInput(body: Record<string, unknown>) {
  const cardId = parseRequiredString(body.cardId, "Card required");
  const periodMonth = parsePeriodMonth(body.periodMonth);
  const closingDate = parseIsoDay(body.closingDate, "Invalid closing date");
  const dueDate = parseIsoDay(body.dueDate, "Invalid due date");

  if (closingDate >= dueDate) {
    throw new CreditCardDataError(
      400,
      "Due date must be after closing date"
    );
  }
  if (dueDate.slice(0, 7) !== periodMonth) {
    throw new CreditCardDataError(
      400,
      "El mes del período debe coincidir con el mes del vencimiento"
    );
  }

  return { cardId, periodMonth, closingDate, dueDate };
}

export function parsePurchaseInput(body: Record<string, unknown>) {
  const cardId = parseRequiredString(body.cardId, "Card required");
  const name = parseRequiredString(body.name, "Purchase name required");
  const purchaseDate = parseIsoDay(body.purchaseDate, "Invalid purchase date");
  const totalAmount = parseAmountInput(body.totalAmount);
  const installments = Number(body.installments);
  const currency = parseCurrency(body.currency);
  const firstPeriodMonth = getFirstPeriodMonthFromPurchaseDate(purchaseDate);

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new CreditCardDataError(400, "Amount must be greater than zero");
  }
  if (!Number.isInteger(installments) || installments <= 0) {
    throw new CreditCardDataError(
      400,
      "Installments must be a positive integer"
    );
  }

  return {
    cardId,
    name,
    purchaseDate,
    totalAmount,
    installments,
    currency,
    firstPeriodMonth,
  };
}

export function parseRecurringExpenseInput(body: Record<string, unknown>) {
  const cardId = parseRequiredString(body.cardId, "Card required");
  const name = parseRequiredString(body.name, "Recurring expense name required");
  const startDate = parseIsoDay(body.startDate, "Invalid start date");
  const monthlyAmount = parseAmountInput(body.monthlyAmount);
  const currency = parseCurrency(body.currency);

  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new CreditCardDataError(400, "Amount must be greater than zero");
  }

  return {
    cardId,
    startDate,
    anchorDay: Number(startDate.slice(8, 10)),
    version: {
      effectiveFrom: startDate,
      name,
      monthlyAmount,
      currency,
    } satisfies CreditCardRecurringExpenseVersion,
  };
}

export function parseRecurringExpenseUpdateInput(
  body: Record<string, unknown>,
  effectiveFrom: string
) {
  const name = parseRequiredString(body.name, "Recurring expense name required");
  const monthlyAmount = parseAmountInput(body.monthlyAmount);
  const currency = parseCurrency(body.currency);
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new CreditCardDataError(400, "Amount must be greater than zero");
  }
  return {
    effectiveFrom,
    name,
    monthlyAmount,
    currency,
  } satisfies CreditCardRecurringExpenseVersion;
}

export async function getOwnedCard(
  uid: string,
  cardId: string,
  options: { requireActive?: boolean } = {}
) {
  const snapshot = await getAdminFirestore()
    .collection("creditCards")
    .doc(cardId)
    .get();

  if (!snapshot.exists) {
    throw new CreditCardDataError(404, "Card not found");
  }
  const card = serializeCard(snapshot);
  const userId = snapshot.data()?.userId;
  if (userId !== uid) {
    throw new CreditCardDataError(403, "Forbidden");
  }
  if (options.requireActive && card.status !== "active") {
    throw new CreditCardDataError(400, "Archived cards cannot accept purchases");
  }
  return card;
}

export async function getOwnedCycle(uid: string, cycleId: string) {
  const snapshot = await getAdminFirestore()
    .collection("creditCardCycles")
    .doc(cycleId)
    .get();
  if (!snapshot.exists) {
    throw new CreditCardDataError(404, "Cycle not found");
  }
  if (snapshot.data()?.userId !== uid) {
    throw new CreditCardDataError(403, "Forbidden");
  }
  return serializeCycle(snapshot);
}

export async function getOwnedPurchase(uid: string, purchaseId: string) {
  const snapshot = await getAdminFirestore()
    .collection("creditCardPurchases")
    .doc(purchaseId)
    .get();
  if (!snapshot.exists) {
    throw new CreditCardDataError(404, "Purchase not found");
  }
  if (snapshot.data()?.userId !== uid) {
    throw new CreditCardDataError(403, "Forbidden");
  }
  return serializePurchase(snapshot);
}

export async function getOwnedRecurringExpense(
  uid: string,
  recurringExpenseId: string
) {
  const snapshot = await getAdminFirestore()
    .collection("creditCardRecurringExpenses")
    .doc(recurringExpenseId)
    .get();
  if (!snapshot.exists) {
    throw new CreditCardDataError(404, "Recurring expense not found");
  }
  if (snapshot.data()?.userId !== uid) {
    throw new CreditCardDataError(403, "Forbidden");
  }
  return serializeRecurringExpense(snapshot);
}

export async function resolveFirstPeriodMonthForCard(
  uid: string,
  cardId: string,
  purchaseDate: string
) {
  const snapshot = await getAdminFirestore()
    .collection("creditCardCycles")
    .where("userId", "==", uid)
    .get();
  const cycles = snapshot.docs
    .map(serializeCycle)
    .filter((cycle) => cycle.cardId === cardId);
  return resolveFirstPeriodMonth(purchaseDate, cycles);
}

export function makeCycleId(cardId: string, periodMonth: string) {
  return `${cardId}_${periodMonth}`;
}

export function serializeCard(doc: DocumentSnapshot): CreditCard {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;
  const base = serializeSnapshot(doc);
  return {
    id: base.id,
    name: typeof raw.name === "string" ? raw.name : "Tarjeta",
    status: raw.status === "archived" ? "archived" : "active",
    createdAt: toIsoDateTime(raw.createdAt),
    updatedAt: toIsoDateTime(raw.updatedAt),
  };
}

export function serializeCycle(doc: DocumentSnapshot): CreditCardCycle {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;
  const base = serializeSnapshot(doc);
  return {
    id: base.id,
    cardId: typeof raw.cardId === "string" ? raw.cardId : "",
    periodMonth: typeof raw.periodMonth === "string" ? raw.periodMonth : "",
    closingDate: typeof raw.closingDate === "string" ? raw.closingDate : "",
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : "",
    createdAt: toIsoDateTime(raw.createdAt),
    updatedAt: toIsoDateTime(raw.updatedAt),
  };
}

export function serializePurchase(doc: DocumentSnapshot): CreditCardPurchase {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;
  const base = serializeSnapshot(doc);
  const purchaseDate = typeof raw.purchaseDate === "string" ? raw.purchaseDate : "";
  return {
    id: base.id,
    cardId: typeof raw.cardId === "string" ? raw.cardId : "",
    name: typeof raw.name === "string" ? raw.name : "Compra",
    purchaseDate,
    totalAmount: typeof raw.totalAmount === "number" ? raw.totalAmount : 0,
    currency: raw.currency === "USD" ? "USD" : "ARS",
    installments:
      typeof raw.installments === "number" ? raw.installments : 1,
    firstPeriodMonth:
      typeof raw.firstPeriodMonth === "string"
        ? raw.firstPeriodMonth
        : isoToDate(purchaseDate)
          ? getFirstPeriodMonthFromPurchaseDate(purchaseDate)
          : "",
    createdAt: toIsoDateTime(raw.createdAt),
    updatedAt: toIsoDateTime(raw.updatedAt),
  };
}

export function serializeRecurringExpense(
  doc: DocumentSnapshot
): CreditCardRecurringExpense {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;
  const base = serializeSnapshot(doc);
  const startDate = typeof raw.startDate === "string" ? raw.startDate : "";
  const versions = Array.isArray(raw.versions)
    ? raw.versions.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const version = candidate as Record<string, unknown>;
        if (
          typeof version.effectiveFrom !== "string" ||
          typeof version.name !== "string" ||
          typeof version.monthlyAmount !== "number"
        ) {
          return [];
        }
        return [
          {
            effectiveFrom: version.effectiveFrom,
            name: version.name,
            monthlyAmount: version.monthlyAmount,
            currency:
              version.currency === "USD" ? ("USD" as const) : ("ARS" as const),
          },
        ];
      })
    : [];
  return {
    id: base.id,
    cardId: typeof raw.cardId === "string" ? raw.cardId : "",
    startDate,
    anchorDay:
      typeof raw.anchorDay === "number"
        ? raw.anchorDay
        : Number(startDate.slice(8, 10)),
    endDate: typeof raw.endDate === "string" ? raw.endDate : null,
    versions,
    createdAt: toIsoDateTime(raw.createdAt),
    updatedAt: toIsoDateTime(raw.updatedAt),
  };
}

export function getArgentinaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof CreditCardDataError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  return null;
}

function parseRequiredString(value: unknown, message: string) {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) throw new CreditCardDataError(400, message);
  return parsed;
}

function parsePeriodMonth(value: unknown) {
  const parsed = parseRequiredString(value, "Period month required");
  if (!isValidPeriodMonth(parsed)) {
    throw new CreditCardDataError(400, "Invalid period month");
  }
  return parsed;
}

function parseIsoDay(value: unknown, message: string) {
  const parsed = parseRequiredString(value, message);
  if (!isoToDate(parsed)) throw new CreditCardDataError(400, message);
  return parsed;
}
