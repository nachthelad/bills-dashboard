import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  parsePeriodMonth,
  parseSpendingLimitsInput,
  serializeSpendingLimit,
  toBudgetErrorResponse,
} from "@/lib/server/budget-data";

type RouteContext = { params: Promise<{ month: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const month = parsePeriodMonth((await params).month);
    const snapshot = await getAdminFirestore()
      .collection("spendingLimits")
      .where("userId", "==", uid)
      .get();
    return NextResponse.json({
      limits: snapshot.docs
        .filter((doc) => doc.data().month === month)
        .map(serializeSpendingLimit),
    });
  } catch (error) {
    return handleError(error, "No se pudieron cargar los límites");
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const month = parsePeriodMonth((await params).month);
    const limits = parseSpendingLimitsInput(await request.json());
    const db = getAdminFirestore();
    const previous = await db
      .collection("spendingLimits")
      .where("userId", "==", uid)
      .get();
    const batch = db.batch();
    previous.docs
      .filter((doc) => doc.data().month === month)
      .forEach((doc) => batch.delete(doc.ref));
    for (const limit of limits) {
      const ref = db.collection("spendingLimits").doc();
      batch.set(ref, {
        userId: uid,
        month,
        ...limit,
        updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();
    return NextResponse.json({ limits });
  } catch (error) {
    return handleError(error, "No se pudieron guardar los límites");
  }
}

function handleError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toBudgetErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
