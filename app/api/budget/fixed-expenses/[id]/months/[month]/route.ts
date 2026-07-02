import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedFixedExpense,
  parseFixedExpensePeriodInput,
  parsePeriodMonth,
  toBudgetErrorResponse,
} from "@/lib/server/budget-data";
import { buildMonthlyBudgetSummary } from "@/lib/server/monthly-budget";

type RouteContext = { params: Promise<{ id: string; month: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id, month: rawMonth } = await params;
    const month = parsePeriodMonth(rawMonth);
    await getOwnedFixedExpense(uid, id);
    const input = parseFixedExpensePeriodInput(await request.json());
    await getAdminFirestore()
      .collection("fixedExpensePeriods")
      .doc(`${uid}_${id}_${month}`)
      .set(
        {
          userId: uid,
          fixedExpenseId: id,
          month,
          ...input,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    return NextResponse.json({
      summary: await buildMonthlyBudgetSummary(uid, month),
    });
  } catch (error) {
    return handleError(error, "No se pudo actualizar el pago");
  }
}

function handleError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toBudgetErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
