import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedCard,
  parseRecurringExpenseInput,
  serializeRecurringExpense,
  toErrorResponse,
} from "@/lib/server/credit-cards";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const cardId = request.nextUrl.searchParams.get("cardId");
    if (cardId) await getOwnedCard(uid, cardId);

    const snapshot = await getAdminFirestore()
      .collection("creditCardRecurringExpenses")
      .where("userId", "==", uid)
      .get();
    const recurringExpenses = snapshot.docs
      .map(serializeRecurringExpense)
      .filter((expense) => !cardId || expense.cardId === cardId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    return NextResponse.json({ recurringExpenses });
  } catch (error) {
    return handleRouteError(error, "No se pudieron cargar los gastos recurrentes");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const input = parseRecurringExpenseInput(await request.json());
    await getOwnedCard(uid, input.cardId, { requireActive: true });

    const now = Timestamp.now();
    const docRef = await getAdminFirestore()
      .collection("creditCardRecurringExpenses")
      .add({
        userId: uid,
        cardId: input.cardId,
        startDate: input.startDate,
        anchorDay: input.anchorDay,
        endDate: null,
        versions: [input.version],
        createdAt: now,
        updatedAt: now,
      });
    return NextResponse.json(serializeRecurringExpense(await docRef.get()), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error, "No se pudo crear el gasto recurrente");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
