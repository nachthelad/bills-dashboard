"use client";

import type {
  BudgetPreferences,
  FixedExpense,
  MonthlyBudgetSummary,
  SpendingLimit,
} from "@/lib/budget";

export async function fetchMonthlyBudget(token: string, month: string) {
  const data = await budgetRequest<{ summary: MonthlyBudgetSummary }>(
    token,
    `/api/budget/months/${month}`
  );
  return data.summary;
}

export async function saveMonthlyBudget(
  token: string,
  month: string,
  input: BudgetPreferences
) {
  const data = await budgetRequest<{ summary: MonthlyBudgetSummary }>(
    token,
    `/api/budget/months/${month}`,
    { method: "PUT", body: JSON.stringify(input) }
  );
  return data.summary;
}

export async function fetchBudgetPreferences(token: string) {
  const data = await budgetRequest<{ preferences: BudgetPreferences }>(
    token,
    "/api/budget/preferences"
  );
  return data.preferences;
}

export async function saveBudgetPreferences(
  token: string,
  input: BudgetPreferences
) {
  const data = await budgetRequest<{ preferences: BudgetPreferences }>(
    token,
    "/api/budget/preferences",
    { method: "PUT", body: JSON.stringify(input) }
  );
  return data.preferences;
}

export async function fetchFixedExpenses(token: string) {
  const data = await budgetRequest<{ fixedExpenses: FixedExpense[] }>(
    token,
    "/api/budget/fixed-expenses"
  );
  return data.fixedExpenses;
}

export async function createFixedExpense(
  token: string,
  input: Omit<FixedExpense, "id">
) {
  return budgetRequest<FixedExpense>(token, "/api/budget/fixed-expenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateFixedExpense(
  token: string,
  id: string,
  input: Omit<FixedExpense, "id">
) {
  return budgetRequest<FixedExpense>(
    token,
    `/api/budget/fixed-expenses/${id}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export async function deactivateFixedExpense(token: string, id: string) {
  await budgetRequest<void>(token, `/api/budget/fixed-expenses/${id}`, {
    method: "DELETE",
  });
}

export async function updateFixedExpensePeriod(
  token: string,
  id: string,
  month: string,
  input: {
    status: "pending" | "paid";
    actualAmount: number | null;
    sourceType?: "manual" | "document" | "expense" | "hoa";
    sourceId?: string | null;
  }
) {
  const data = await budgetRequest<{ summary: MonthlyBudgetSummary }>(
    token,
    `/api/budget/fixed-expenses/${id}/months/${month}`,
    { method: "PUT", body: JSON.stringify(input) }
  );
  return data.summary;
}

export async function fetchSpendingLimits(token: string, month: string) {
  const data = await budgetRequest<{ limits: SpendingLimit[] }>(
    token,
    `/api/budget/limits/${month}`
  );
  return data.limits;
}

export async function saveSpendingLimits(
  token: string,
  month: string,
  limits: SpendingLimit[]
) {
  const data = await budgetRequest<{ limits: SpendingLimit[] }>(
    token,
    `/api/budget/limits/${month}`,
    { method: "PUT", body: JSON.stringify({ limits }) }
  );
  return data.limits;
}

async function budgetRequest<T>(
  token: string,
  url: string,
  init: RequestInit = {}
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "No se pudo completar la operación");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
