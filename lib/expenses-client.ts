"use client";

export type ExpenseEntry = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  paymentMethod: "Débito" | "Crédito" | "Efectivo" | "Transferencia";
  category: string;
  currency: string;
  arsRate: number | null;
};

export const EXPENSE_CATEGORIES = [
  "Compra",
  "Comida",
  "Servicios",
  "Tarjeta",
  "Salud",
  "Fútbol",
  "Transporte",
  "Otros",
] as const;

export const PAYMENT_METHODS = [
  "Débito",
  "Crédito",
  "Efectivo",
  "Transferencia",
] as const;

export async function fetchExpenseEntries(
  token: string
): Promise<ExpenseEntry[]> {
  const response = await fetch("/api/expenses", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "No se pudieron cargar los gastos");
  }

  const payload = await response.json();
  return (payload.entries ?? []).map((entry: any) => ({
    id: entry.id,
    date: normalizeDateInput(entry.date),
    description: entry.description ?? "",
    amount: entry.amount ?? 0,
    paymentMethod: entry.paymentMethod ?? "Débito",
    category: entry.category ?? "Otros",
    currency: entry.currency ?? "ARS",
    arsRate: typeof entry.arsRate === "number" ? entry.arsRate : null,
  }));
}

export async function addExpenseEntry(
  token: string,
  data: {
    date: Date;
    description: string;
    amount: number;
    paymentMethod: string;
    category: string;
    currency?: string;
    arsRate?: number | null;
  }
): Promise<ExpenseEntry> {
  const response = await fetch("/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      date: data.date.toISOString(),
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      category: data.category,
      currency: data.currency ?? "ARS",
      arsRate: data.arsRate ?? null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "No se pudo agregar el gasto");
  }

  const entry = await response.json();
  return {
    id: entry.id,
    date: normalizeDateInput(entry.date),
    description: entry.description ?? "",
    amount: entry.amount ?? 0,
    paymentMethod: entry.paymentMethod ?? "Débito",
    category: entry.category ?? "Otros",
    currency: entry.currency ?? "ARS",
    arsRate: typeof entry.arsRate === "number" ? entry.arsRate : null,
  };
}

export async function updateExpenseEntry(
  token: string,
  id: string,
  data: {
    date: Date;
    description: string;
    amount: number;
    paymentMethod: string;
    category: string;
    currency?: string;
    arsRate?: number | null;
  }
): Promise<ExpenseEntry> {
  const response = await fetch(`/api/expenses/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      date: data.date.toISOString(),
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      category: data.category,
      currency: data.currency ?? "ARS",
      arsRate: data.arsRate ?? null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "No se pudo actualizar el gasto");
  }

  const entry = await response.json();
  return {
    id: entry.id,
    date: normalizeDateInput(entry.date),
    description: entry.description ?? "",
    amount: entry.amount ?? 0,
    paymentMethod: entry.paymentMethod ?? "Débito",
    category: entry.category ?? "Otros",
    currency: entry.currency ?? "ARS",
    arsRate: typeof entry.arsRate === "number" ? entry.arsRate : null,
  };
}

export async function deleteExpenseEntry(
  token: string,
  id: string
): Promise<void> {
  const response = await fetch(`/api/expenses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "No se pudo eliminar el gasto");
  }
}

export async function fetchExpenseCategories(token: string): Promise<string[]> {
  const response = await fetch("/api/expense-categories", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [...EXPENSE_CATEGORIES];
  const data = await response.json();
  const custom: string[] = data.customCategories ?? [];
  return [
    ...EXPENSE_CATEGORIES,
    ...custom.filter((c) => !(EXPENSE_CATEGORIES as readonly string[]).includes(c)),
  ];
}

export async function addExpenseCategory(
  token: string,
  category: string
): Promise<void> {
  const response = await fetch("/api/expense-categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ category }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "No se pudo agregar la categoría");
  }
}

function normalizeDateInput(value: unknown): Date {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in (value as Record<string, unknown>)
  ) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return new Date();
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}
