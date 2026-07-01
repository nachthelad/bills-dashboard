export const CATEGORY_OPTIONS = [
  { value: "electricity", label: "Electricidad" },
  { value: "water", label: "Agua" },
  { value: "gas", label: "Gas" },
  { value: "internet", label: "Internet / telefonía" },
  { value: "hoa", label: "Expensas" },
  { value: "health", label: "Salud" },
  { value: "credit_card", label: "Tarjeta de crédito" },
  { value: "other", label: "Otros" },
] as const;

export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];

export const CATEGORY_SET = new Set<CategoryValue>(
  CATEGORY_OPTIONS.map((option) => option.value)
);

/**
 * Get the display label for a category value
 */
export function getCategoryLabel(category: string | null | undefined): string {
  if (category === "daily_expenses") return "Gastos Diarios";
  const option = CATEGORY_OPTIONS.find((opt) => opt.value === category);
  return option?.label ?? "Otros";
}
