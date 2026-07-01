import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getNextRecurringOccurrenceDate } from "@/lib/credit-card-utils";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  CreditCardDataError,
  getArgentinaToday,
  getOwnedRecurringExpense,
  parseRecurringExpenseUpdateInput,
  serializeRecurringExpense,
  toErrorResponse,
} from "@/lib/server/credit-cards";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json(await getOwnedRecurringExpense(uid, id));
  } catch (error) {
    return handleRouteError(error, "Failed to load recurring expense");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const existing = await getOwnedRecurringExpense(uid, id);
    const effectiveFrom = getNextRecurringOccurrenceDate(
      existing,
      getArgentinaToday()
    );
    if (!effectiveFrom) {
      throw new CreditCardDataError(400, "Recurring expense already ended");
    }
    const version = parseRecurringExpenseUpdateInput(
      await request.json(),
      effectiveFrom
    );
    const versions = [
      ...existing.versions.filter(
        (candidate) => candidate.effectiveFrom < effectiveFrom
      ),
      version,
    ];
    const docRef = getAdminFirestore()
      .collection("creditCardRecurringExpenses")
      .doc(id);
    await docRef.update({ versions, updatedAt: Timestamp.now() });
    return NextResponse.json(serializeRecurringExpense(await docRef.get()));
  } catch (error) {
    return handleRouteError(error, "Failed to update recurring expense");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const existing = await getOwnedRecurringExpense(uid, id);
    if (existing.endDate) {
      throw new CreditCardDataError(400, "Recurring expense already ended");
    }
    const docRef = getAdminFirestore()
      .collection("creditCardRecurringExpenses")
      .doc(id);
    await docRef.update({
      endDate: getArgentinaToday(),
      updatedAt: Timestamp.now(),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error, "Failed to finish recurring expense");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
