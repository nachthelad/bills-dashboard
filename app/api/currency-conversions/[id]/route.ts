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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const body = await request.json();
    const input = parseConversionInput(body);
    const date = parseDate(body.date);
    const db = getAdminFirestore();
    const ref = db.collection("currencyConversions").doc((await params).id);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (!existing.exists) {
        throw new IncomeFundingError(404, "No se encontró la conversión");
      }
      if (existing.data()?.userId !== uid) {
        throw new IncomeFundingError(403, "No tenés permiso para modificarla");
      }
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
        conversionSnapshot.docs,
        { excludeConversionId: existing.id }
      );
      assertForeignBalance(
        balances.available,
        input.fromCurrency,
        input.fromAmount
      );
      transaction.update(ref, {
        ...input,
        date: Timestamp.fromDate(date),
        updatedAt: Timestamp.now(),
      });
    });
    return NextResponse.json(serializeConversion(await ref.get()));
  } catch (error) {
    return handleError(error, "No se pudo actualizar la conversión");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const ref = getAdminFirestore()
      .collection("currencyConversions")
      .doc((await params).id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new IncomeFundingError(404, "No se encontró la conversión");
    }
    if (snapshot.data()?.userId !== uid) {
      throw new IncomeFundingError(403, "No tenés permiso para modificarla");
    }
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, "No se pudo eliminar la conversión");
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
