import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";
import {
  serializeSnapshot,
  toIsoDateTime,
  toDate,
} from "@/lib/server/document-serializer";
import { upsertHoaSummary } from "@/lib/server/hoa-service";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/hoa-summaries" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const { searchParams } = request.nextUrl;
    const buildingCode = searchParams.get("buildingCode");
    const unitCode = searchParams.get("unitCode");

    let queryRef = getAdminFirestore()
      .collection("hoaSummaries")
      .where("userId", "==", uid);

    if (buildingCode) {
      queryRef = queryRef.where("buildingCode", "==", buildingCode);
    }
    if (unitCode) {
      queryRef = queryRef.where("unitCode", "==", unitCode);
    }

    const snapshot = await queryRef.get();

    type HoaSummaryResponse = Record<string, unknown> & {
      id: string;
      periodKey: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    };

    const summaries: HoaSummaryResponse[] = snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const base = serializeSnapshot(doc);
        const periodKey =
          typeof data.periodKey === "string" ? data.periodKey : null;

        return {
          ...base,
          periodKey,
          createdAt: toIsoDateTime(data.createdAt),
          updatedAt: toIsoDateTime(data.updatedAt),
        };
      })
      .sort((a, b) => {
        const aKey = typeof a.periodKey === "string" ? a.periodKey : null;
        const bKey = typeof b.periodKey === "string" ? b.periodKey : null;
        if (!aKey || !bKey) return 0;
        return bKey.localeCompare(aKey);
      });

    // Fire-and-forget: sync HOA documents that are missing a hoaSummaries entry
    const existingPeriodKeys = new Set(
      summaries.map((s) => s.periodKey).filter(Boolean)
    );
    (async () => {
      try {
        const docsSnap = await getAdminFirestore()
          .collection("documents")
          .where("userId", "==", uid)
          .where("category", "==", "hoa")
          .get();

        for (const doc of docsSnap.docs) {
          const data = doc.data() as Record<string, unknown>;
          const hoaDetails = (data.hoaDetails ?? {}) as Record<string, unknown>;

          let periodYear =
            typeof hoaDetails.periodYear === "number"
              ? hoaDetails.periodYear
              : null;
          let periodMonth =
            typeof hoaDetails.periodMonth === "number"
              ? hoaDetails.periodMonth
              : null;

          // Derive period from document dates if hoaDetails is missing it
          if (!periodYear || !periodMonth) {
            const dateVal =
              data.periodStart ?? data.issueDate ?? data.dueDate ?? null;
            const d = toDate(dateVal);
            if (d) {
              periodYear = d.getFullYear();
              periodMonth = d.getMonth() + 1;
            }
          }

          if (!periodYear || !periodMonth) continue;

          const periodKey = `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
          if (existingPeriodKeys.has(periodKey)) continue;

          await upsertHoaSummary(uid, {
            ...hoaDetails,
            periodYear,
            periodMonth,
            totalToPayUnit:
              typeof hoaDetails.totalToPayUnit === "number"
                ? hoaDetails.totalToPayUnit
                : (data.amount ?? data.totalAmount ?? null),
          });
        }
      } catch (syncErr) {
        // Non-fatal: sync errors are silently ignored
      }
    })();

    return NextResponse.json({ summaries });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("hoaSummaries GET error", { error });
    return NextResponse.json(
      { error: "No se pudieron cargar las expensas" },
      { status: 500 }
    );
  }
}
