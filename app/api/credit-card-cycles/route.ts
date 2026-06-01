import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedCard,
  makeCycleId,
  parseCycleInput,
  serializeCycle,
  toErrorResponse,
} from "@/lib/server/credit-cards";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const cardId = request.nextUrl.searchParams.get("cardId");
    if (cardId) await getOwnedCard(uid, cardId);

    const snapshot = await getAdminFirestore()
      .collection("creditCardCycles")
      .where("userId", "==", uid)
      .get();
    const cycles = snapshot.docs
      .map(serializeCycle)
      .filter((cycle) => !cardId || cycle.cardId === cardId)
      .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
    return NextResponse.json({ cycles });
  } catch (error) {
    return handleRouteError(error, "Failed to load cycles");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const input = parseCycleInput(await request.json());
    await getOwnedCard(uid, input.cardId, { requireActive: true });

    const docRef = getAdminFirestore()
      .collection("creditCardCycles")
      .doc(makeCycleId(input.cardId, input.periodMonth));
    if ((await docRef.get()).exists) {
      return NextResponse.json(
        { error: "A cycle already exists for this month" },
        { status: 409 }
      );
    }

    const now = Timestamp.now();
    await docRef.set({
      userId: uid,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json(serializeCycle(await docRef.get()), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error, "Failed to create cycle");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
