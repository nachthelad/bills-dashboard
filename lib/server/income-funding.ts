import type { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";

import { parseAmountInput } from "@/lib/amount-parser";
import {
  calculateForeignBalances,
  type CurrencyConversion,
  type ForeignCurrency,
  type IncomeSource,
  type MoneyCurrency,
} from "@/lib/budget";
import { toIsoDateTime } from "@/lib/server/document-serializer";

export class IncomeFundingError extends Error {
  constructor(
    readonly statusCode: 400 | 403 | 404,
    message: string
  ) {
    super(message);
  }
}

export function parseMoneyCurrency(value: unknown): MoneyCurrency {
  if (value === "ARS" || value === "USD" || value === "USDT") return value;
  throw new IncomeFundingError(400, "La moneda no es válida");
}

export function parseForeignCurrency(value: unknown): ForeignCurrency {
  if (value === "USD" || value === "USDT") return value;
  throw new IncomeFundingError(400, "La moneda de origen no es válida");
}

export function parsePositiveAmount(value: unknown, message: string) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new IncomeFundingError(400, message);
  }
  return Math.round(parsed * 100) / 100;
}

export function parseNonNegativeAmount(value: unknown, message: string) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = parseAmountInput(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new IncomeFundingError(400, message);
  }
  return Math.round(parsed * 100) / 100;
}

export function parseIncomeSourceInput(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new IncomeFundingError(400, "El nombre es obligatorio");
  return {
    name,
    currency: parseMoneyCurrency(body.currency),
    expectedAmount: parseNonNegativeAmount(
      body.expectedAmount,
      "El monto esperado no es válido"
    ),
    isVariable: body.isVariable === true,
    isActive: body.isActive !== false,
  } satisfies Omit<IncomeSource, "id">;
}

export function parseConversionInput(body: Record<string, unknown>) {
  const fromAmount = parsePositiveAmount(
    body.fromAmount,
    "El monto a convertir no es válido"
  );
  const usedRate = parsePositiveAmount(
    body.usedRate,
    "La cotización usada no es válida"
  );
  const suggestedRate =
    body.suggestedRate === null ||
    body.suggestedRate === undefined ||
    body.suggestedRate === ""
      ? null
      : parsePositiveAmount(
          body.suggestedRate,
          "La cotización sugerida no es válida"
        );
  const source =
    body.suggestedRateSource === "binance_p2p" ||
    body.suggestedRateSource === "other"
      ? body.suggestedRateSource
      : "manual";
  return {
    fromCurrency: parseForeignCurrency(body.fromCurrency),
    fromAmount,
    suggestedRateSource: source,
    suggestedRate,
    usedRate,
    arsReceived: Math.round(fromAmount * usedRate * 100) / 100,
    relatedIncomeSourceId:
      typeof body.relatedIncomeSourceId === "string" &&
      body.relatedIncomeSourceId.trim()
        ? body.relatedIncomeSourceId.trim()
        : null,
    note:
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim()
        : null,
  } satisfies Omit<CurrencyConversion, "id" | "date">;
}

export function serializeIncomeSource(doc: DocumentSnapshot): IncomeSource {
  const raw = doc.data() ?? {};
  return {
    id: doc.id,
    name: typeof raw.name === "string" ? raw.name : "Ingreso",
    currency:
      raw.currency === "USD" || raw.currency === "USDT" ? raw.currency : "ARS",
    expectedAmount:
      typeof raw.expectedAmount === "number" ? raw.expectedAmount : 0,
    isVariable: raw.isVariable === true,
    isActive: raw.isActive !== false,
  };
}

export function serializeConversion(
  doc: DocumentSnapshot
): CurrencyConversion {
  const raw = doc.data() ?? {};
  const fromAmount = typeof raw.fromAmount === "number" ? raw.fromAmount : 0;
  const usedRate = typeof raw.usedRate === "number" ? raw.usedRate : 0;
  return {
    id: doc.id,
    date: toIsoDateTime(raw.date, new Date(0).toISOString()) ?? new Date(0).toISOString(),
    fromCurrency: raw.fromCurrency === "USD" ? "USD" : "USDT",
    fromAmount,
    suggestedRateSource:
      raw.suggestedRateSource === "binance_p2p" ||
      raw.suggestedRateSource === "other"
        ? raw.suggestedRateSource
        : "manual",
    suggestedRate:
      typeof raw.suggestedRate === "number" ? raw.suggestedRate : null,
    usedRate,
    arsReceived:
      typeof raw.arsReceived === "number"
        ? raw.arsReceived
        : Math.round(fromAmount * usedRate * 100) / 100,
    relatedIncomeSourceId:
      typeof raw.relatedIncomeSourceId === "string"
        ? raw.relatedIncomeSourceId
        : null,
    note: typeof raw.note === "string" ? raw.note : null,
  };
}

export function calculateBalancesFromDocuments(
  incomeDocs: Array<QueryDocumentSnapshot | DocumentSnapshot>,
  conversionDocs: Array<QueryDocumentSnapshot | DocumentSnapshot>,
  options: { excludeIncomeId?: string; excludeConversionId?: string } = {}
) {
  return calculateForeignBalances(
    incomeDocs
      .filter((doc) => doc.id !== options.excludeIncomeId)
      .map((doc) => {
        const raw = doc.data() ?? {};
        return {
          currency:
            raw.currency === "USD" || raw.currency === "USDT"
              ? raw.currency
              : "ARS",
          amount: typeof raw.amount === "number" ? raw.amount : 0,
        };
      }),
    conversionDocs
      .filter((doc) => doc.id !== options.excludeConversionId)
      .map((doc) => serializeConversion(doc))
  );
}

export function assertForeignBalance(
  available: Record<ForeignCurrency, number>,
  currency: ForeignCurrency,
  amount: number
) {
  if (Math.round(amount * 100) > Math.round(available[currency] * 100)) {
    throw new IncomeFundingError(
      400,
      `No tenés saldo ${currency} suficiente para esta conversión`
    );
  }
}
