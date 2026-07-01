import { NextRequest, NextResponse } from "next/server";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";

import { resolveFirstPeriodMonth } from "@/lib/credit-card-utils";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  CreditCardDataError,
  getOwnedCard,
  parsePurchaseInput,
  serializeCycle,
  serializePurchase,
  toErrorResponse,
} from "@/lib/server/credit-cards";

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const body = (await request.json()) as unknown;
    const rawPurchases =
      typeof body === "object" && body !== null && "purchases" in body
        ? (body as { purchases?: unknown }).purchases
        : null;
    if (!Array.isArray(rawPurchases) || rawPurchases.length === 0) {
      throw new CreditCardDataError(400, "Agregá al menos una compra.");
    }
    if (rawPurchases.length > 200) {
      throw new CreditCardDataError(
        400,
        "Podés importar hasta 200 compras por vez."
      );
    }

    const purchases = rawPurchases.map((purchase: unknown) =>
      parsePurchaseInput((purchase ?? {}) as Record<string, unknown>)
    );
    const cardIds = [...new Set(purchases.map((purchase) => purchase.cardId))];
    await Promise.all(
      cardIds.map((cardId) => getOwnedCard(uid, cardId, { requireActive: true }))
    );

    const firestore = getAdminFirestore();
    const cycleSnapshot = await firestore
      .collection("creditCardCycles")
      .where("userId", "==", uid)
      .get();
    const cycles = cycleSnapshot.docs.map(serializeCycle);
    const now = Timestamp.now();
    const batch = firestore.batch();
    const docRefs: DocumentReference[] = purchases.map((purchase) => {
      const docRef = firestore.collection("creditCardPurchases").doc();
      batch.set(docRef, {
        userId: uid,
        ...purchase,
        firstPeriodMonth: resolveFirstPeriodMonth(
          purchase.purchaseDate,
          cycles.filter((cycle) => cycle.cardId === purchase.cardId)
        ),
        createdAt: now,
        updatedAt: now,
      });
      return docRef;
    });

    await batch.commit();
    const snapshots = await Promise.all(docRefs.map((docRef) => docRef.get()));
    return NextResponse.json(
      { purchases: snapshots.map(serializePurchase) },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, "No se pudieron importar las compras");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
