import { NextRequest, NextResponse } from "next/server";

import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer";
import { createDocumentRequestSchema } from "@/lib/api-schemas";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";
export const revalidate = 0;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "POST /api/documents" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const payload = await request.json();
    const parsed = createDocumentRequestSchema.safeParse(payload);

    if (!parsed.success) {
      log.warn("Invalid document payload", { issues: parsed.error.issues });
      return NextResponse.json(
        { error: "Los datos de la boleta no son válidos" },
        { status: 400 }
      );
    }

    const {
      fileName,
      storageUrl,
      provider,
      providerId,
      category,
      amount,
      totalAmount,
      currency,
      dueDate,
      issueDate,
      periodStart,
      periodEnd,
      manualEntry,
      textExtract,
    } = parsed.data;

    const toTimestamp = (value?: string | null) => {
      if (!value) return null;
      return Timestamp.fromDate(new Date(`${value}T12:00:00Z`));
    };

    const docData: Record<string, unknown> = {
      userId: uid,
      fileName,
      storageUrl: storageUrl ?? null,
      pdfUrl: storageUrl ?? null,
      status: storageUrl ? "pending" : "needs_review",
      uploadedAt: new Date(),
      manualEntry: Boolean(manualEntry),
    };

    if (provider !== undefined) docData.provider = provider || null;
    if (providerId !== undefined) docData.providerId = providerId || null;
    if (category !== undefined) docData.category = category || null;
    if (amount !== undefined) docData.amount = amount ?? null;
    if (totalAmount !== undefined) docData.totalAmount = totalAmount ?? null;
    if (currency !== undefined) docData.currency = currency || null;
    if (textExtract !== undefined) docData.textExtract = textExtract ?? null;

    docData.dueDate = toTimestamp(dueDate);
    docData.issueDate = toTimestamp(issueDate);
    docData.periodStart = toTimestamp(periodStart);
    docData.periodEnd = toTimestamp(periodEnd);

    const docRef = await getAdminFirestore()
      .collection("documents")
      .add(docData);

    return NextResponse.json({ documentId: docRef.id });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Server create document error", { error });
    return NextResponse.json(
      { error: "No se pudo crear la boleta" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/documents" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });

    const snapshot = await getAdminFirestore()
      .collection("documents")
      .where("userId", "==", uid)
      .get();

    const documents = snapshot.docs
      .map((doc) => serializeDocumentSnapshot(doc))
      .sort((a, b) => {
        const aDate = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const bDate = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return bDate - aDate;
      });

    return NextResponse.json({ documents });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Server list documents error", { error });
    return NextResponse.json(
      { error: "No se pudieron cargar las boletas" },
      { status: 500 }
    );
  }
}
