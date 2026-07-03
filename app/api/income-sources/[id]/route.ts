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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const ref = getAdminFirestore()
      .collection("incomeSources")
      .doc((await params).id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new IncomeFundingError(404, "No se encontró la fuente de ingreso");
    }
    if (snapshot.data()?.userId !== uid) {
      throw new IncomeFundingError(403, "No tenés permiso para modificarla");
    }
    const input = parseIncomeSourceInput(await request.json());
    await ref.update({ ...input, updatedAt: Timestamp.now() });
    return NextResponse.json(serializeIncomeSource(await ref.get()));
  } catch (error) {
    return handleError(error, "No se pudo actualizar la fuente de ingreso");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { uid } = await authenticateRequest(request);
    const ref = getAdminFirestore()
      .collection("incomeSources")
      .doc((await params).id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new IncomeFundingError(404, "No se encontró la fuente de ingreso");
    }
    if (snapshot.data()?.userId !== uid) {
      throw new IncomeFundingError(403, "No tenés permiso para modificarla");
    }
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, "No se pudo eliminar la fuente de ingreso");
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
