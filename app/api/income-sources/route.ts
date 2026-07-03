import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  IncomeFundingError,
  parseIncomeSourceInput,
  serializeIncomeSource,
} from "@/lib/server/income-funding";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const snapshot = await getAdminFirestore()
      .collection("incomeSources")
      .where("userId", "==", uid)
      .get();
    return NextResponse.json({
      sources: snapshot.docs
        .map(serializeIncomeSource)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    });
  } catch (error) {
    return handleError(error, "No se pudieron cargar las fuentes de ingreso");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const input = parseIncomeSourceInput(await request.json());
    const now = Timestamp.now();
    const ref = await getAdminFirestore().collection("incomeSources").add({
      userId: uid,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json(serializeIncomeSource(await ref.get()), {
      status: 201,
    });
  } catch (error) {
    return handleError(error, "No se pudo crear la fuente de ingreso");
  }
}

function handleError(error: unknown, fallback: string) {
  if (error instanceof IncomeFundingError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  return (
    handleAuthError(error) ??
    NextResponse.json({ error: fallback }, { status: 500 })
  );
}
