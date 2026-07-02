import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getArgentinaDateParts } from "@/lib/budget";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedFixedExpense,
  parseFixedExpenseInput,
  serializeFixedExpense,
  toBudgetErrorResponse,
} from "@/lib/server/budget-data";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const existing = await getOwnedFixedExpense(uid, id);
    const input = parseFixedExpenseInput(
      { ...existing.data(), ...(await request.json()) },
      getArgentinaDateParts().periodMonth
    );
    await existing.ref.update({ ...input, updatedAt: Timestamp.now() });
    return NextResponse.json(serializeFixedExpense(await existing.ref.get()));
  } catch (error) {
    return handleError(error, "No se pudo actualizar el gasto fijo");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const existing = await getOwnedFixedExpense(uid, id);
    await existing.ref.update({
      inactiveFrom: getArgentinaDateParts().periodMonth,
      updatedAt: Timestamp.now(),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, "No se pudo desactivar el gasto fijo");
  }
}

function handleError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toBudgetErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
