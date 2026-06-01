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
  type CreditCardStatus,
} from "@/lib/credit-card-utils";
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
  const totalAmount = Number(body.totalAmount);
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
