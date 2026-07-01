"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  fetchCreditCardCycles,
  fetchCreditCardPurchases,
  fetchCreditCardRecurringExpenses,
  fetchCreditCards,
} from "@/lib/credit-cards-client";
import type {
  CreditCard,
  CreditCardCycle,
  CreditCardPurchase,
  CreditCardRecurringExpense,
} from "@/lib/credit-card-utils";

type BinanceRate = {
  price: number;
  updatedAt: string;
};

export function useCreditCardData() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [purchases, setPurchases] = useState<CreditCardPurchase[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<
    CreditCardRecurringExpense[]
  >([]);
  const [rate, setRate] = useState<BinanceRate | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!user) throw new Error("Iniciá sesión para continuar.");
    return user.getIdToken();
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const [
        nextCards,
        nextCycles,
        nextPurchases,
        nextRecurringExpenses,
      ] = await Promise.all([
        fetchCreditCards(token),
        fetchCreditCardCycles(token),
        fetchCreditCardPurchases(token),
        fetchCreditCardRecurringExpenses(token),
      ]);
      setCards(nextCards);
      setCycles(nextCycles);
      setPurchases(nextPurchases);
      setRecurringExpenses(nextRecurringExpenses);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la información."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshRate = useCallback(async () => {
    setRateLoading(true);
    try {
      const response = await fetch("/api/binance-rate");
      if (!response.ok) throw new Error("La cotización no está disponible");
      const data = await response.json();
      if (typeof data.price !== "number" || data.price <= 0) {
        throw new Error("La cotización recibida no es válida");
      }
      setRate({ price: data.price, updatedAt: data.updatedAt });
    } catch {
      setRate(null);
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    refreshRate();
  }, [refreshRate]);

  return {
    cards,
    cycles,
    purchases,
    recurringExpenses,
    rate,
    rateLoading,
    loading,
    error,
    getToken,
    loadData,
    refreshRate,
  };
}
