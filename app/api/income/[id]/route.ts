import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";

type RouteParams = { id: string };

async function resolveParams(
  params: RouteParams | Promise<RouteParams>
): Promise<RouteParams> {
  if (typeof (params as Promise<RouteParams>).then === "function") {
    return await (params as Promise<RouteParams>);
  }
  return params as RouteParams;
}

async function getOwnedIncomeDoc(uid: string, incomeId: string) {
  if (!incomeId) {
    throw new Error("NotFound");
  }
  const docRef = getAdminFirestore().collection("incomeEntries").doc(incomeId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new Error("NotFound");
  }
  const data = snapshot.data();
  if (!data || data.userId !== uid) {
    throw new Error("Forbidden");
  }
  return { docRef, snapshot, data };
}

export async function PATCH(
  request: NextRequest,
  context: { params: RouteParams } | { params: Promise<RouteParams> }
) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "PATCH /api/income/[id]" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const params = await resolveParams(context.params);
    const incomeId = params.id;
    const { docRef } = await getOwnedIncomeDoc(uid, incomeId);

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (body.amount !== undefined) {
      const amount = Number.parseFloat(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "El monto no es válido" }, { status: 400 });
      }
      updates.amount = amount;
    }

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "El nombre es obligatorio" },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (body.source !== undefined) {
      const source = String(body.source ?? "").trim();
      if (!source) {
        return NextResponse.json(
          { error: "La fuente es obligatoria" },
          { status: 400 }
        );
      }
      updates.source = source;
    }

    if (body.date) {
      updates.date = Timestamp.fromDate(new Date(body.date));
    }

    if (body.currency !== undefined) {
      updates.currency = ["ARS", "USD"].includes(body.currency) ? body.currency : "ARS";
    }

    await docRef.update(updates);
    const updatedSnapshot = await docRef.get();
    const updatedData = updatedSnapshot.data();
    return NextResponse.json({
      id: updatedSnapshot.id,
      name: updatedData?.name ?? "Sin nombre",
      amount: updatedData?.amount ?? 0,
      source: updatedData?.source ?? "Sin fuente",
      date: updatedData?.date?.toDate
        ? updatedData.date.toDate().toISOString()
        : new Date().toISOString(),
      currency: updatedData?.currency ?? "ARS",
    });
  } catch (error: any) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    if (error?.message === "Forbidden") {
      return NextResponse.json({ error: "No tenés permiso para realizar esta acción" }, { status: 403 });
    }
    if (error?.message === "NotFound") {
      return NextResponse.json(
        { error: "No se encontró el ingreso" },
        { status: 404 }
      );
    }
    log.error("Income PATCH error", { error });
    return NextResponse.json(
      { error: "No se pudo actualizar el ingreso" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: RouteParams } | { params: Promise<RouteParams> }
) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "DELETE /api/income/[id]" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const params = await resolveParams(context.params);
    const incomeId = params.id;
    const { docRef } = await getOwnedIncomeDoc(uid, incomeId);
    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    if (error?.message === "Forbidden") {
      return NextResponse.json({ error: "No tenés permiso para realizar esta acción" }, { status: 403 });
    }
    if (error?.message === "NotFound") {
      return NextResponse.json(
        { error: "No se encontró el ingreso" },
        { status: 404 }
      );
    }
    log.error("Income DELETE error", { error });
    return NextResponse.json(
      { error: "No se pudo eliminar el ingreso" },
      { status: 500 }
    );
  }
}
