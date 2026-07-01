import { NextRequest, NextResponse } from "next/server";

import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer";
import { toDate } from "@/lib/server/document-serializer";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveParams(params: RouteContext["params"]) {
  return typeof (params as any).then === "function"
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string });
}

async function getAuthorizedDocument(
  request: NextRequest,
  params: RouteContext["params"]
) {
  const { uid } = await authenticateRequest(request);
  const resolvedParams = await resolveParams(params);
  const docRef = getAdminFirestore()
    .collection("documents")
    .doc(resolvedParams.id);
  const docSnapshot = await docRef.get();

  if (!docSnapshot.exists) {
    return {
      errorResponse: NextResponse.json(
        { error: "No se encontró la boleta" },
        { status: 404 }
      ),
    };
  }

  const documentData = docSnapshot.data();
  if (documentData?.userId && documentData.userId !== uid) {
    return {
      errorResponse: NextResponse.json(
        { error: "No tenés permiso para realizar esta acción" },
        { status: 403 }
      ),
    };
  }

  return { docRef, docSnapshot, uid };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/documents/[id]" },
  });
  let log = baseLogger;
  try {
    const authResult = await getAuthorizedDocument(request, context.params);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    log = log.withContext({ userId: authResult.uid });

    return NextResponse.json(serializeDocumentSnapshot(authResult.docSnapshot));
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Document GET error", { error });
    return NextResponse.json(
      { error: "No se pudo cargar la boleta" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "PATCH /api/documents/[id]" },
  });
  let log = baseLogger;
  try {
    const authResult = await getAuthorizedDocument(request, context.params);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    log = log.withContext({ userId: authResult.uid });

    const { docRef, docSnapshot, uid } = authResult;
    const currentData = docSnapshot.data();
    const body = await request.json();
    const {
      provider,
      amount,
      dueDate,
      status,
      category,
      issueDate,
      periodStart,
      periodEnd,
      hoaDetails,
    } = body;

    const updates: Record<string, any> = {};

    if (provider !== undefined) updates.provider = provider || null;
    if (amount !== undefined) {
      updates.amount = amount ?? null;
      // Ensure Dashboard reflected changes (Dashboard usually uses totalAmount)
      updates.totalAmount = amount ?? null;
    }
    if (status) updates.status = status;
    const finalCategory =
      category !== undefined ? category || null : currentData?.category || null;
    if (category !== undefined) updates.category = finalCategory;

    // Handle HOA specific synchronization
    if (finalCategory === "hoa") {
      const currentHoaDetails = currentData?.hoaDetails || {};
      // Merge requested hoaDetails with current ones
      const newHoaDetails = {
        ...currentHoaDetails,
        ...(hoaDetails || {}),
      };
      let hoaDetailsChanged = Boolean(hoaDetails);

      // 1. Sync hoaDetails.totalToPayUnit -> top-level amount
      if (
        newHoaDetails.totalToPayUnit !== undefined &&
        newHoaDetails.totalToPayUnit !== updates.amount
      ) {
        // If amount was wasn't explicitly provided but hoaDetails.totalToPayUnit was,
        // or if they are just out of sync, prioritize the specialized HOA field
        if (amount === undefined) {
          updates.amount = newHoaDetails.totalToPayUnit ?? null;
          updates.totalAmount = newHoaDetails.totalToPayUnit ?? null;
        }
      }

      // 2. Sync top-level amount -> hoaDetails.totalToPayUnit (bidirectional)
      if (amount !== undefined) {
        newHoaDetails.totalToPayUnit = amount ?? null;
        hoaDetailsChanged = true;
      }

      // Sync period from periodStart if available
      const finalPeriodStart =
        periodStart !== undefined ? periodStart : currentData?.periodStart;
      if (finalPeriodStart) {
        try {
          const date = toDate(finalPeriodStart);
          if (date && !isNaN(date.getTime())) {
            newHoaDetails.periodYear = date.getFullYear();
            newHoaDetails.periodMonth = date.getMonth() + 1;
            // Force re-derivation of standard label/key (MM/YYYY)
            delete newHoaDetails.periodKey;
            delete newHoaDetails.periodLabel;
            hoaDetailsChanged = true;
          }
        } catch (e) {
          console.warn("Failed to parse periodStart for HOA sync", e);
        }
      }

      if (hoaDetailsChanged) {
        updates.hoaDetails = newHoaDetails;
      }
    }

    const assignDate = (field: string, value: any) => {
      if (value === undefined) return;
      updates[field] = value
        ? Timestamp.fromDate(new Date(`${value}T12:00:00Z`))
        : null;
    };

    assignDate("dueDate", dueDate);
    assignDate("issueDate", issueDate);
    assignDate("periodStart", periodStart);
    assignDate("periodEnd", periodEnd);

    updates.updatedAt = new Date();

    await docRef.update(updates);
    const updatedSnapshot = await docRef.get();
    const updatedData = updatedSnapshot.data();

    // If it's an HOA document, ensure the separate hoaSummaries collection is also updated
    // We trigger this if the category is HOA and either hoaDetails were updated OR amount/category changed
    if (finalCategory === "hoa") {
      const { upsertHoaSummary } = await import("@/lib/server/hoa-service");
      await upsertHoaSummary(
        uid,
        updatedData?.hoaDetails || {
          totalToPayUnit: updatedData?.amount || updatedData?.totalAmount,
          // Fallback to EDIFICIO/0005 if not present
          buildingCode: updatedData?.hoaDetails?.buildingCode || "EDIFICIO",
          unitCode: updatedData?.hoaDetails?.unitCode || "0005",
        }
      );
    }

    return NextResponse.json(serializeDocumentSnapshot(updatedSnapshot));
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Document PATCH error", { error });
    return NextResponse.json(
      { error: "No se pudo actualizar la boleta" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "DELETE /api/documents/[id]" },
  });
  let log = baseLogger;
  try {
    const authResult = await getAuthorizedDocument(request, context.params);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    log = log.withContext({ userId: authResult.uid });

    const { docRef } = authResult;
    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Document DELETE error", { error });
    return NextResponse.json(
      { error: "No se pudo eliminar la boleta" },
      { status: 500 }
    );
  }
}
