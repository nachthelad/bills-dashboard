"use client";

import type {
  CurrencyConversion,
  IncomeSource,
} from "@/lib/budget";

export async function fetchIncomeSources(token: string) {
  const data = await fundingRequest<{ sources: IncomeSource[] }>(
    token,
    "/api/income-sources"
  );
  return data.sources;
}

export async function createIncomeSource(
  token: string,
  input: Omit<IncomeSource, "id">
) {
  return fundingRequest<IncomeSource>(token, "/api/income-sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateIncomeSource(
  token: string,
  id: string,
  input: Omit<IncomeSource, "id">
) {
  return fundingRequest<IncomeSource>(token, `/api/income-sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteIncomeSource(token: string, id: string) {
  await fundingRequest(token, `/api/income-sources/${id}`, {
    method: "DELETE",
  });
}

export async function fetchCurrencyConversions(token: string) {
  const data = await fundingRequest<{ conversions: CurrencyConversion[] }>(
    token,
    "/api/currency-conversions"
  );
  return data.conversions;
}

export async function createCurrencyConversion(
  token: string,
  input: Omit<CurrencyConversion, "id" | "arsReceived">
) {
  return fundingRequest<CurrencyConversion>(
    token,
    "/api/currency-conversions",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function deleteCurrencyConversion(token: string, id: string) {
  await fundingRequest(token, `/api/currency-conversions/${id}`, {
    method: "DELETE",
  });
}

export async function updateCurrencyConversion(
  token: string,
  id: string,
  input: Omit<CurrencyConversion, "id" | "arsReceived">
) {
  return fundingRequest<CurrencyConversion>(
    token,
    `/api/currency-conversions/${id}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

async function fundingRequest<T>(
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
  return response.json() as Promise<T>;
}
