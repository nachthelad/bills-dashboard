import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";
import {
  serializeSnapshot,
  toIsoDateTime,
} from "@/lib/server/document-serializer";
import { parseAmountInput } from "@/lib/amount-parser";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger({
    request,
    context: { route: "PATCH /api/expenses/[id]" },
  });
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;

    const docRef = getAdminFirestore().collection("dailyExpenses").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json({ error: "No se encontró el gasto" }, { status: 404 });
    }

    const data = existing.data() as Record<string, unknown>;
    if (data.userId !== uid) {
      return NextResponse.json(
        { error: "No tenés permiso para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const description = (body.description ?? "").toString().trim() || "Sin descripción";
    const amount = parseAmountInput(body.amount);
    const paymentMethod = (body.paymentMethod ?? "Débito").toString().trim();
    const category = (body.category ?? "Otros").toString().trim();
    const dateString = body.date as string | undefined;
    const currency = ["ARS", "USD"].includes(body.currency) ? body.currency : "ARS";
    const arsRate =
      currency === "USD" &&
      typeof body.arsRate === "number" &&
      Number.isFinite(body.arsRate) &&
      body.arsRate > 0
        ? body.arsRate
        : null;

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "El monto no es válido" }, { status: 400 });
    }

    await docRef.update({
      description,
      amount,
      paymentMethod,
      category,
      currency,
      arsRate,
      date: dateString
        ? Timestamp.fromDate(new Date(dateString))
        : data.date,
      updatedAt: Timestamp.now(),
    });

    const updated = await docRef.get();
    const raw = (updated.data() ?? {}) as Record<string, unknown>;
    const base = serializeSnapshot(updated);
    const fallbackDate = new Date().toISOString();

    return NextResponse.json({
      ...base,
      description:
        typeof raw.description === "string" ? raw.description : "Sin descripción",
      amount: typeof raw.amount === "number" ? raw.amount : 0,
      paymentMethod:
        typeof raw.paymentMethod === "string" ? raw.paymentMethod : "Débito",
      category: typeof raw.category === "string" ? raw.category : "Otros",
      currency:
        typeof raw.currency === "string" && raw.currency.trim().length > 0
          ? raw.currency
          : "ARS",
      arsRate: typeof raw.arsRate === "number" ? raw.arsRate : null,
      date: toIsoDateTime(raw.date, fallbackDate) ?? fallbackDate,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    log.error("Expenses PATCH error", { error });
    return NextResponse.json(
      { error: "No se pudo actualizar el gasto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger({
    request,
    context: { route: "DELETE /api/expenses/[id]" },
  });
  try {
    const { uid } = await authenticateRequest(request);
    const { id } = await params;

    const docRef = getAdminFirestore().collection("dailyExpenses").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json({ error: "No se encontró el gasto" }, { status: 404 });
    }

    const data = existing.data() as Record<string, unknown>;
    if (data.userId !== uid) {
      return NextResponse.json(
        { error: "No tenés permiso para realizar esta acción" },
        { status: 403 }
      );
    }

    await docRef.delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    log.error("Expenses DELETE error", { error });
    return NextResponse.json(
      { error: "No se pudo eliminar el gasto" },
      { status: 500 }
    );
  }
}
