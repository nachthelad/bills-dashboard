import { parseAmountInput } from "@/lib/amount-parser";

export const MAX_EXPENSE_BATCH_SIZE = 50;

export type NormalizedExpenseBatchEntry = {
  description: string;
  amount: number;
  paymentMethod: string;
  category: string;
  currency: "ARS" | "USD";
  arsRate: number | null;
};

export type NormalizedExpenseBatch =
  | {
      ok: true;
      date: Date;
      entries: NormalizedExpenseBatchEntry[];
    }
  | {
      ok: false;
      error: string;
    };

export function normalizeExpenseBatch(body: unknown): NormalizedExpenseBatch {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "El lote de gastos no es válido" };
  }

  const input = body as Record<string, unknown>;
  const date = parseDate(input.date);
  if (!date) {
    return { ok: false, error: "La fecha no es válida" };
  }

  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    return { ok: false, error: "Agregá al menos un gasto" };
  }

  if (input.entries.length > MAX_EXPENSE_BATCH_SIZE) {
    return {
      ok: false,
      error: `No se pueden guardar más de ${MAX_EXPENSE_BATCH_SIZE} gastos por vez`,
    };
  }

  const entries: NormalizedExpenseBatchEntry[] = [];

  for (let index = 0; index < input.entries.length; index += 1) {
    const normalized = normalizeBatchEntry(input.entries[index], index);
    if (!normalized.ok) return normalized;
    entries.push(normalized.entry);
  }

  return { ok: true, date, entries };
}

function normalizeBatchEntry(
  value: unknown,
  index: number
):
  | { ok: true; entry: NormalizedExpenseBatchEntry }
  | { ok: false; error: string } {
  const row = index + 1;
  if (!value || typeof value !== "object") {
    return { ok: false, error: `El gasto ${row} no es válido` };
  }

  const input = value as Record<string, unknown>;
  const description = String(input.description ?? "").trim();
  if (!description) {
    return { ok: false, error: `Completá la descripción del gasto ${row}` };
  }

  const amount = parseAmountInput(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: `El importe del gasto ${row} no es válido` };
  }

  const category = String(input.category ?? "").trim();
  if (!category) {
    return { ok: false, error: `Elegí la categoría del gasto ${row}` };
  }

  const currency = input.currency === "USD" ? "USD" : input.currency === "ARS" ? "ARS" : null;
  if (!currency) {
    return { ok: false, error: `La moneda del gasto ${row} no es válida` };
  }

  const arsRate =
    typeof input.arsRate === "number"
      ? input.arsRate
      : parseAmountInput(input.arsRate);
  if (
    currency === "USD" &&
    (!Number.isFinite(arsRate) || arsRate <= 0)
  ) {
    return { ok: false, error: `La cotización del gasto ${row} no es válida` };
  }

  return {
    ok: true,
    entry: {
      description,
      amount,
      paymentMethod: String(input.paymentMethod ?? "Débito").trim() || "Débito",
      category,
      currency,
      arsRate: currency === "USD" ? arsRate : null,
    },
  };
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
