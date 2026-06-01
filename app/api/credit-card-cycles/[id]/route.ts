import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedCard,
  getOwnedCycle,
  makeCycleId,
  parseCycleInput,
  serializeCycle,
  toErrorResponse,
} from "@/lib/server/credit-cards";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json(await getOwnedCycle(uid, id));
  } catch (error) {
    return handleRouteError(error, "Failed to load cycle");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const existing = await getOwnedCycle(uid, id);
    const body = await request.json();
    const input = parseCycleInput({
      cardId: existing.cardId,
      periodMonth: existing.periodMonth,
      closingDate: body.closingDate ?? existing.closingDate,
      dueDate: body.dueDate ?? existing.dueDate,
    });
    await getOwnedCard(uid, input.cardId);

    const docRef = getAdminFirestore().collection("creditCardCycles").doc(id);
    await docRef.update({
      closingDate: input.closingDate,
      dueDate: input.dueDate,
      updatedAt: Timestamp.now(),
    });
    return NextResponse.json(serializeCycle(await docRef.get()));
  } catch (error) {
    return handleRouteError(error, "Failed to update cycle");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const cycle = await getOwnedCycle(uid, id);
    await getAdminFirestore()
      .collection("creditCardCycles")
      .doc(makeCycleId(cycle.cardId, cycle.periodMonth))
      .delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error, "Failed to delete cycle");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
