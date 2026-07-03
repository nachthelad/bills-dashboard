import type { MoneyCurrency } from "@/lib/budget";

export const PERSONAL_FIXED_EXPENSES = [
  ["expensas", "Expensas", "Vivienda", 201_339],
  ["hominis", "Hominis", "Salud", 131_198],
  ["luz", "Luz", "Servicios", 70_564],
  ["gas", "Gas", "Servicios", 13_778],
  ["agua", "Agua", "Servicios", 30_718],
  ["abl", "ABL", "Impuestos", 20_800],
  ["telecentro", "Telecentro", "Servicios", 18_377],
  ["la-meridional", "La Meridional", "Seguro", 12_651],
  ["celular", "Celular", "Servicios", 6_000],
] as const;

export const PERSONAL_SPENDING_LIMITS = [
  ["Compra", 320_000],
  ["Salidas", 100_000],
  ["Comida comprada", 60_000],
  ["Hobbies", 100_000],
  ["Transporte", 30_000],
  ["Otros", 50_000],
  ["Gatos", 80_000],
  ["Salud", 70_000],
  ["Fútbol", 40_000],
] as const;

export const PERSONAL_INCOME_SOURCES: ReadonlyArray<{
  key: string;
  name: string;
  currency: MoneyCurrency;
  expectedAmount: number;
  isVariable: boolean;
}> = [
  {
    key: "argentek-base",
    name: "Argentek sueldo base",
    currency: "USD",
    expectedAmount: 650,
    isVariable: false,
  },
  {
    key: "integra-base",
    name: "Integra sueldo base",
    currency: "USDT",
    expectedAmount: 800,
    isVariable: false,
  },
  {
    key: "argentek-comisiones",
    name: "Argentek comisiones",
    currency: "USD",
    expectedAmount: 0,
    isVariable: true,
  },
];

export function buildPersonalBudgetSeed(uid: string, month: string) {
  return {
    fixedExpenses: PERSONAL_FIXED_EXPENSES.map(
      ([key, name, category, estimatedAmount]) => ({
        id: `${uid}_preset_${key}`,
        data: {
          userId: uid,
          name,
          category,
          estimatedAmount,
          dueDay: null,
          activeFrom: month,
          inactiveFrom: null,
          sourceType: "manual" as const,
          sourceKey: null,
        },
      })
    ),
    limits: PERSONAL_SPENDING_LIMITS.map(([category, limitAmount]) => ({
      id: `${uid}_${month}_${slug(category)}`,
      data: { userId: uid, month, category, limitAmount },
    })),
    incomeSources: PERSONAL_INCOME_SOURCES.map((source) => ({
      id: `${uid}_preset_${source.key}`,
      data: {
        userId: uid,
        name: source.name,
        currency: source.currency,
        expectedAmount: source.expectedAmount,
        isVariable: source.isVariable,
        isActive: true,
      },
    })),
  };
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
