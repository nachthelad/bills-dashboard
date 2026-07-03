import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  parsePeriodMonth,
  parsePreferencesInput,
  parseOpeningArsBalance,
  toBudgetErrorResponse,
} from "@/lib/server/budget-data";
import { buildMonthlyBudgetSummary } from "@/lib/server/monthly-budget";

type RouteContext = { params: Promise<{ month: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const month = parsePeriodMonth((await params).month);
    return NextResponse.json({
      summary: await buildMonthlyBudgetSummary(uid, month),
    });
  } catch (error) {
    return handleError(error, "No se pudo calcular el presupuesto mensual");
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const month = parsePeriodMonth((await params).month);
    const body = await request.json();
    const input = {
      ...parsePreferencesInput(body),
      fundingMode: "cash" as const,
    };
    const hasOpeningArsBalance = Object.prototype.hasOwnProperty.call(
      body,
      "openingArsBalance"
    );
    const openingArsBalance = hasOpeningArsBalance
      ? parseOpeningArsBalance(body.openingArsBalance)
      : undefined;
    const now = Timestamp.now();
    await Promise.all([
      getAdminFirestore()
        .collection("monthlyBudgets")
        .doc(`${uid}_${month}`)
        .set(
          {
            userId: uid,
            month,
            ...input,
            ...(hasOpeningArsBalance ? { openingArsBalance } : {}),
            updatedAt: now,
            createdAt: now,
          },
          { merge: true }
        ),
      getAdminFirestore()
        .collection("budgetPreferences")
        .doc(uid)
        .set({ userId: uid, ...input, updatedAt: now }, { merge: true }),
    ]);
    return NextResponse.json({
      summary: await buildMonthlyBudgetSummary(uid, month),
    });
  } catch (error) {
    return handleError(error, "No se pudo guardar el presupuesto mensual");
  }
}

function handleError(error: unknown, fallback: string) {
  return (
    handleAuthError(error) ??
    toBudgetErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
