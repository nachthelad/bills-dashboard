import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  parsePreferencesInput,
  serializePreferences,
  toBudgetErrorResponse,
} from "@/lib/server/budget-data";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const snapshot = await getAdminFirestore()
      .collection("budgetPreferences")
      .doc(uid)
      .get();
    return NextResponse.json({
      preferences: serializePreferences(snapshot) ?? {
        expectedIncome: 0,
        savingsMode: "percentage",
        savingsValue: 20,
        fundingMode: "cash",
        arsBufferAmount: 0,
      },
    });
  } catch (error) {
    return handleError(error, "No se pudieron cargar las preferencias");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const input = {
      ...parsePreferencesInput(await request.json()),
      fundingMode: "cash" as const,
    };
    const ref = getAdminFirestore().collection("budgetPreferences").doc(uid);
    await ref.set(
      { userId: uid, ...input, updatedAt: Timestamp.now() },
      { merge: true }
    );
    return NextResponse.json({ preferences: input });
  } catch (error) {
    return handleError(error, "No se pudieron guardar las preferencias");
  }
}

function handleError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toBudgetErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
