import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";
import {
  serializeSnapshot,
  toIsoDateTime,
} from "@/lib/server/document-serializer";
import { sortExpenseEntriesForDisplay } from "@/lib/server/expense-sort";

export async function GET(request: NextRequest) {
  const log = createRequestLogger({
    request,
    context: { route: "GET /api/expenses" },
  });
  try {
    const { uid } = await authenticateRequest(request);

    const snapshot = await getAdminFirestore()
      .collection("dailyExpenses")
      .where("userId", "==", uid)
      .get();

    const entries = sortExpenseEntriesForDisplay(
      snapshot.docs.map(serializeExpenseDoc)
    );

    return NextResponse.json({ entries });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    log.error("Expenses GET error", { error });
    return NextResponse.json(
      { error: "Failed to load expense entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger({
    request,
    context: { route: "POST /api/expenses" },
  });
  try {
    const { uid } = await authenticateRequest(request);

    const body = await request.json();
    const description = (body.description ?? "").toString().trim() || "Sin descripción";
    const amount = Number.parseFloat(body.amount);
    const paymentMethod = (body.paymentMethod ?? "Débito").toString().trim();
    const category = (body.category ?? "Otros").toString().trim();
    const dateString = body.date as string | undefined;
    const currency = ["ARS", "USD"].includes(body.currency) ? body.currency : "ARS";
    const arsRate =
      currency === "USD" &&
      typeof body.arsRate === "number" &&
      Number.isFinite(body.arsRate) &&
      body.arsRate > 0
        ? body.arsRate
        : null;

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const entryRef = await getAdminFirestore()
      .collection("dailyExpenses")
      .add({
        userId: uid,
        description,
        amount,
        paymentMethod,
        category,
        currency,
        arsRate,
        date: dateString
          ? Timestamp.fromDate(new Date(dateString))
          : Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

    const entrySnapshot = await entryRef.get();
    return NextResponse.json(serializeExpenseDoc(entrySnapshot), {
      status: 201,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    log.error("Expenses POST error", { error });
    return NextResponse.json(
      { error: "Failed to add expense entry" },
      { status: 500 }
    );
  }
}

function serializeExpenseDoc(doc: DocumentSnapshot) {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;
  const base = serializeSnapshot(doc);
  const fallbackDate = new Date().toISOString();

  return {
    ...base,
    description:
      typeof raw.description === "string" && raw.description.trim().length > 0
        ? raw.description
        : "Sin descripción",
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    paymentMethod:
      typeof raw.paymentMethod === "string" && raw.paymentMethod.trim().length > 0
        ? raw.paymentMethod
        : "Débito",
    category:
      typeof raw.category === "string" && raw.category.trim().length > 0
        ? raw.category
        : "Otros",
    date: toIsoDateTime(raw.date, fallbackDate) ?? fallbackDate,
    createdAt: toIsoDateTime(raw.createdAt),
    currency:
      typeof raw.currency === "string" && raw.currency.trim().length > 0
        ? raw.currency
        : "ARS",
    arsRate: typeof raw.arsRate === "number" ? raw.arsRate : null,
  };
}
