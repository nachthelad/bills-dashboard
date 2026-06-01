import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  getOwnedCard,
  parseCardName,
  parseCardStatus,
  serializeCard,
  toErrorResponse,
} from "@/lib/server/credit-cards";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json(await getOwnedCard(uid, id));
  } catch (error) {
    return handleRouteError(error, "Failed to load card");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    await getOwnedCard(uid, id);
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };

    if (body.name !== undefined) updates.name = parseCardName(body.name);
    if (body.status !== undefined) updates.status = parseCardStatus(body.status);

    const docRef = getAdminFirestore().collection("creditCards").doc(id);
    await docRef.update(updates);
    return NextResponse.json(serializeCard(await docRef.get()));
  } catch (error) {
    return handleRouteError(error, "Failed to update card");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;
    await getOwnedCard(uid, id);
    const docRef = getAdminFirestore().collection("creditCards").doc(id);
    await docRef.update({ status: "archived", updatedAt: Timestamp.now() });
    return NextResponse.json(serializeCard(await docRef.get()));
  } catch (error) {
    return handleRouteError(error, "Failed to archive card");
  }
}

function handleRouteError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
