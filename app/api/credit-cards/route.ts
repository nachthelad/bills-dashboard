import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  parseCardName,
  serializeCard,
  toErrorResponse,
} from "@/lib/server/credit-cards";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const snapshot = await getAdminFirestore()
      .collection("creditCards")
      .where("userId", "==", uid)
      .get();

    const cards = snapshot.docs
      .map(serializeCard)
      .sort((a, b) => {
        const statusDiff = a.status.localeCompare(b.status);
        return statusDiff !== 0
          ? statusDiff
          : a.name.localeCompare(b.name, "es");
      });
    return NextResponse.json({ cards });
  } catch (error) {
    return (
      handleAuthError(error) ??
      toErrorResponse(error) ??
      NextResponse.json({ error: "No se pudieron cargar las tarjetas" }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const body = await request.json();
    const name = parseCardName(body.name);
    const now = Timestamp.now();

    const docRef = await getAdminFirestore().collection("creditCards").add({
      userId: uid,
      name,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json(serializeCard(await docRef.get()), {
      status: 201,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      toErrorResponse(error) ??
      NextResponse.json({ error: "No se pudo crear la tarjeta" }, { status: 500 })
    );
  }
}
