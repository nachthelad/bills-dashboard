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
import { parseAmountInput } from "@/lib/amount-parser";

export async function GET(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/income" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });

    const snapshot = await getAdminFirestore()
      .collection("incomeEntries")
      .where("userId", "==", uid)
      .get();

    const entries = snapshot.docs
      .map(serializeIncomeDoc)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json({ entries });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Income GET error", { error });
    return NextResponse.json(
      { error: "Failed to load income entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "POST /api/income" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });

    const body = await request.json();
    const name = (body.name ?? "").toString().trim() || "Unnamed";
    const amount = parseAmountInput(body.amount);
    const source = (body.source ?? "").toString().trim() || "Other";
    const dateString = body.date as string | undefined;
    const currency = ["ARS", "USD"].includes(body.currency) ? body.currency : "ARS";

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const entryRef = await getAdminFirestore()
      .collection("incomeEntries")
      .add({
        userId: uid,
        name,
        amount,
        source,
        currency,
        date: dateString
          ? Timestamp.fromDate(new Date(dateString))
          : Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

    const entrySnapshot = await entryRef.get();
    return NextResponse.json(serializeIncomeDoc(entrySnapshot), {
      status: 201,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Income POST error", { error });
    return NextResponse.json(
      { error: "Failed to add income entry" },
      { status: 500 }
    );
  }
}

function serializeIncomeDoc(doc: DocumentSnapshot) {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;
  const base = serializeSnapshot(doc);
  const fallbackDate = new Date().toISOString();

  return {
    ...base,
    name:
      typeof raw.name === "string" && raw.name.trim().length > 0
        ? raw.name
        : "Unnamed",
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    source:
      typeof raw.source === "string" && raw.source.trim().length > 0
        ? raw.source
        : "Unknown",
    date: toIsoDateTime(raw.date, fallbackDate) ?? fallbackDate,
    currency:
      typeof raw.currency === "string" && raw.currency.trim().length > 0
        ? raw.currency
        : "ARS",
  };
}
