import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedCard,
  getOwnedPurchase,
  parsePurchaseInput,
  resolveFirstPeriodMonthForCard,
  serializePurchase,
  toErrorResponse,
} from "@/lib/server/credit-cards";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json(await getOwnedPurchase(uid, id));
  } catch (error) {
    return handleRouteError(error, "Failed to load purchase");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    const existing = await getOwnedPurchase(uid, id);
    const body = await request.json();
    const input = parsePurchaseInput({
      ...existing,
      ...body,
      cardId: body.cardId ?? existing.cardId,
    });
    await getOwnedCard(uid, input.cardId);
    input.firstPeriodMonth = await resolveFirstPeriodMonthForCard(
      uid,
      input.cardId,
      input.purchaseDate
    );

    const docRef = getAdminFirestore()
      .collection("creditCardPurchases")
      .doc(id);
    await docRef.update({ ...input, updatedAt: Timestamp.now() });
    return NextResponse.json(serializePurchase(await docRef.get()));
  } catch (error) {
    return handleRouteError(error, "Failed to update purchase");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    await getOwnedPurchase(uid, id);
    await getAdminFirestore().collection("creditCardPurchases").doc(id).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error, "Failed to delete purchase");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
