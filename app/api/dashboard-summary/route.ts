import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";
export const revalidate = 0;
import { Timestamp } from "firebase-admin/firestore";

import { dashboardSummarySchema } from "@/lib/api-schemas";

const COLLECTION = "dashboardSummaries";

export async function GET(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/dashboard-summary" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const docRef = getAdminFirestore().collection(COLLECTION).doc(uid);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ summary: null });
    }
    const data = snapshot.data();
    const payload = {
      summary: data
        ? {
            totals: data?.totals ?? {},
            categories: data?.categories ?? {},
            incomeSources: data?.incomeSources ?? {},
            updatedAt: data?.updatedAt?.toDate
              ? data.updatedAt.toDate().toISOString()
              : data?.updatedAt ?? null,
          }
        : null,
    };

    const parsed = dashboardSummarySchema.nullable().safeParse(payload.summary);
    return NextResponse.json({ summary: parsed.success ? parsed.data : null });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Dashboard summary GET error", { error });
    return NextResponse.json(
      { error: "No se pudo cargar el resumen del panel" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "POST /api/dashboard-summary" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const payload = await request.json();
    const parsed = dashboardSummarySchema.safeParse(payload);
    if (!parsed.success) {
      log.warn("Invalid dashboard summary payload", {
        issues: parsed.error.issues,
      });
      return NextResponse.json(
        { error: "El resumen del panel no es válido" },
        { status: 400 }
      );
    }
    const docRef = getAdminFirestore().collection(COLLECTION).doc(uid);
    await docRef.set(
      {
        totals: parsed.data.totals,
        categories: parsed.data.categories,
        incomeSources: parsed.data.incomeSources,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Dashboard summary POST error", { error });
    return NextResponse.json(
      { error: "No se pudo guardar el resumen" },
      { status: 500 }
    );
  }
}
