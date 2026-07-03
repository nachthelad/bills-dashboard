import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  assertForeignBalance,
  calculateBalancesFromDocuments,
  IncomeFundingError,
  parseConversionInput,
  serializeConversion,
} from "@/lib/server/income-funding";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const snapshot = await getAdminFirestore()
      .collection("currencyConversions")
      .where("userId", "==", uid)
      .get();
    return NextResponse.json({
      conversions: snapshot.docs
        .map(serializeConversion)
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  } catch (error) {
    return handleError(error, "No se pudieron cargar las conversiones");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const body = await request.json();
    const input = parseConversionInput(body);
    const date = parseDate(body.date);
    const db = getAdminFirestore();
    const ref = db.collection("currencyConversions").doc();
    await db.runTransaction(async (transaction) => {
      const incomeQuery = db.collection("incomeEntries").where("userId", "==", uid);
      const conversionQuery = db
        .collection("currencyConversions")
        .where("userId", "==", uid);
      const [incomeSnapshot, conversionSnapshot] = await Promise.all([
        transaction.get(incomeQuery),
        transaction.get(conversionQuery),
      ]);
      const balances = calculateBalancesFromDocuments(
        incomeSnapshot.docs,
        conversionSnapshot.docs
      );
      assertForeignBalance(
        balances.available,
        input.fromCurrency,
        input.fromAmount
      );
      const now = Timestamp.now();
      transaction.set(ref, {
        userId: uid,
        ...input,
        date: Timestamp.fromDate(date),
        createdAt: now,
        updatedAt: now,
      });
    });
    return NextResponse.json(serializeConversion(await ref.get()), {
      status: 201,
    });
  } catch (error) {
    return handleError(error, "No se pudo registrar la conversión");
  }
}

function parseDate(value: unknown) {
  const date = typeof value === "string" ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new IncomeFundingError(400, "La fecha no es válida");
  }
  return date;
}

function handleError(error: unknown, fallback: string) {
  if (error instanceof IncomeFundingError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  return (
    handleAuthError(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
