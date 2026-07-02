import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getArgentinaDateParts } from "@/lib/budget";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  parseFixedExpenseInput,
  serializeFixedExpense,
  toBudgetErrorResponse,
} from "@/lib/server/budget-data";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const snapshot = await getAdminFirestore()
      .collection("fixedExpenses")
      .where("userId", "==", uid)
      .get();
    return NextResponse.json({
      fixedExpenses: snapshot.docs
        .map(serializeFixedExpense)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    });
  } catch (error) {
    return handleError(error, "No se pudieron cargar los gastos fijos");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const input = parseFixedExpenseInput(
      await request.json(),
      getArgentinaDateParts().periodMonth
    );
    const now = Timestamp.now();
    const ref = await getAdminFirestore()
      .collection("fixedExpenses")
      .add({ userId: uid, ...input, createdAt: now, updatedAt: now });
    return NextResponse.json(serializeFixedExpense(await ref.get()), {
      status: 201,
    });
  } catch (error) {
    return handleError(error, "No se pudo crear el gasto fijo");
  }
}

function handleError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toBudgetErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
