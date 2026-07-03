import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";
import {
  calculateBalancesFromDocuments,
  IncomeFundingError,
  parseMoneyCurrency,
} from "@/lib/server/income-funding";

type RouteParams = { id: string };

async function resolveParams(
  params: RouteParams | Promise<RouteParams>
): Promise<RouteParams> {
  if (typeof (params as Promise<RouteParams>).then === "function") {
    return await (params as Promise<RouteParams>);
  }
  return params as RouteParams;
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
    const body = await request.json();
    const updates: Record<string, any> = {
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
      updates.currency = parseMoneyCurrency(body.currency);
    }
    if (body.incomeSourceId !== undefined) {
      updates.incomeSourceId =
        typeof body.incomeSourceId === "string" && body.incomeSourceId.trim()
          ? body.incomeSourceId.trim()
          : null;
    }

    const db = getAdminFirestore();
    const docRef = db.collection("incomeEntries").doc(incomeId);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef);
      if (!existing.exists) throw new Error("NotFound");
      if (existing.data()?.userId !== uid) throw new Error("Forbidden");
      const incomeQuery = db.collection("incomeEntries").where("userId", "==", uid);
      const conversionQuery = db
        .collection("currencyConversions")
        .where("userId", "==", uid);
      const [incomeSnapshot, conversionSnapshot] = await Promise.all([
        transaction.get(incomeQuery),
        transaction.get(conversionQuery),
      ]);
      const balances = calculateBalancesFromDocuments(
        incomeSnapshot.docs,
        conversionSnapshot.docs,
        { excludeIncomeId: incomeId }
      );
      const current = existing.data() ?? {};
      const nextCurrency: "ARS" | "USD" | "USDT" =
        updates.currency === "ARS" ||
        updates.currency === "USD" ||
        updates.currency === "USDT"
          ? updates.currency
          : current.currency === "USD" || current.currency === "USDT"
            ? current.currency
            : "ARS";
      const nextAmount =
        typeof updates.amount === "number"
          ? updates.amount
          : typeof current.amount === "number"
            ? current.amount
            : 0;
      if (nextCurrency !== "ARS") {
        balances.available[nextCurrency] += nextAmount;
      }
      if (balances.available.USD < 0 || balances.available.USDT < 0) {
        throw new IncomeFundingError(
          400,
          "El cambio dejaría conversiones sin saldo de origen"
        );
      }
      transaction.update(docRef, updates);
    });
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
      incomeSourceId: updatedData?.incomeSourceId ?? null,
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
    const db = getAdminFirestore();
    const docRef = db.collection("incomeEntries").doc(incomeId);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef);
      if (!existing.exists) throw new Error("NotFound");
      if (existing.data()?.userId !== uid) throw new Error("Forbidden");
      const incomeQuery = db.collection("incomeEntries").where("userId", "==", uid);
      const conversionQuery = db
        .collection("currencyConversions")
        .where("userId", "==", uid);
      const [incomeSnapshot, conversionSnapshot] = await Promise.all([
        transaction.get(incomeQuery),
        transaction.get(conversionQuery),
      ]);
      const balances = calculateBalancesFromDocuments(
        incomeSnapshot.docs,
        conversionSnapshot.docs,
        { excludeIncomeId: incomeId }
      );
      if (balances.available.USD < 0 || balances.available.USDT < 0) {
        throw new IncomeFundingError(
          400,
          "No podés eliminar este cobro porque respalda conversiones registradas"
        );
      }
      transaction.delete(docRef);
    });
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
    if (error instanceof IncomeFundingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    log.error("Income DELETE error", { error });
    return NextResponse.json(
      { error: "No se pudo eliminar el ingreso" },
      { status: 500 }
    );
  }
}
