import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedCard,
  parsePurchaseInput,
  resolveFirstPeriodMonthForCard,
  serializePurchase,
  toErrorResponse,
} from "@/lib/server/credit-cards";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const cardId = request.nextUrl.searchParams.get("cardId");
    if (cardId) await getOwnedCard(uid, cardId);

    const snapshot = await getAdminFirestore()
      .collection("creditCardPurchases")
      .where("userId", "==", uid)
      .get();
    const purchases = snapshot.docs
      .map(serializePurchase)
      .filter((purchase) => !cardId || purchase.cardId === cardId)
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
    return NextResponse.json({ purchases });
  } catch (error) {
    return handleRouteError(error, "No se pudieron cargar las compras");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const input = parsePurchaseInput(await request.json());
    await getOwnedCard(uid, input.cardId, { requireActive: true });
    input.firstPeriodMonth = await resolveFirstPeriodMonthForCard(
      uid,
      input.cardId,
      input.purchaseDate
    );

    const now = Timestamp.now();
    const docRef = await getAdminFirestore()
      .collection("creditCardPurchases")
      .add({
        userId: uid,
        ...input,
        createdAt: now,
        updatedAt: now,
      });
    return NextResponse.json(serializePurchase(await docRef.get()), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error, "No se pudo crear la compra");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
