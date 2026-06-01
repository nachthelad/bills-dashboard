"use client";

import type {
  CreditCard,
  CreditCardCurrency,
  CreditCardCycle,
  CreditCardPurchase,
  CreditCardStatus,
} from "@/lib/credit-card-utils";

export async function fetchCreditCards(token: string) {
  const data = await requestJson<{ cards: CreditCard[] }>(
    token,
    "/api/credit-cards"
  );
  return data.cards ?? [];
}

export async function createCreditCard(token: string, name: string) {
  return requestJson<CreditCard>(token, "/api/credit-cards", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateCreditCard(
  token: string,
  id: string,
  updates: { name?: string; status?: CreditCardStatus }
) {
  return requestJson<CreditCard>(token, `/api/credit-cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function archiveCreditCard(token: string, id: string) {
  return requestJson<CreditCard>(token, `/api/credit-cards/${id}`, {
    method: "DELETE",
  });
}

export async function fetchCreditCardCycles(token: string, cardId?: string) {
  const search = cardId ? `?cardId=${encodeURIComponent(cardId)}` : "";
  const data = await requestJson<{ cycles: CreditCardCycle[] }>(
    token,
    `/api/credit-card-cycles${search}`
  );
  return data.cycles ?? [];
}

export async function createCreditCardCycle(
  token: string,
  input: Omit<CreditCardCycle, "id" | "createdAt" | "updatedAt">
) {
  return requestJson<CreditCardCycle>(token, "/api/credit-card-cycles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCreditCardCycle(
  token: string,
  id: string,
  updates: Pick<CreditCardCycle, "closingDate" | "dueDate">
) {
  return requestJson<CreditCardCycle>(
    token,
    `/api/credit-card-cycles/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
}

export async function deleteCreditCardCycle(token: string, id: string) {
  await requestJson<void>(
    token,
    `/api/credit-card-cycles/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function fetchCreditCardPurchases(token: string, cardId?: string) {
  const search = cardId ? `?cardId=${encodeURIComponent(cardId)}` : "";
  const data = await requestJson<{ purchases: CreditCardPurchase[] }>(
    token,
    `/api/credit-card-purchases${search}`
  );
  return data.purchases ?? [];
}

export async function createCreditCardPurchase(
  token: string,
  input: CreditCardPurchaseInput
) {
  return requestJson<CreditCardPurchase>(
    token,
    "/api/credit-card-purchases",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function updateCreditCardPurchase(
  token: string,
  id: string,
  input: CreditCardPurchaseInput
) {
  return requestJson<CreditCardPurchase>(
    token,
    `/api/credit-card-purchases/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function createCreditCardPurchases(
  token: string,
  purchases: CreditCardPurchaseInput[]
) {
  const data = await requestJson<{ purchases: CreditCardPurchase[] }>(
    token,
    "/api/credit-card-purchases/bulk",
    {
      method: "POST",
      body: JSON.stringify({ purchases }),
    }
  );
  return data.purchases ?? [];
}

export async function deleteCreditCardPurchase(token: string, id: string) {
  await requestJson<void>(token, `/api/credit-card-purchases/${id}`, {
    method: "DELETE",
  });
}

export type CreditCardPurchaseInput = {
  cardId: string;
  name: string;
  purchaseDate: string;
  totalAmount: number;
  currency: CreditCardCurrency;
  installments: number;
};

async function requestJson<T>(
  token: string,
  url: string,
  init: RequestInit = {}
): Promise<T> {
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
  return response.json();
}
