export type ExpenseDraftRow = {
  description: string;
  amount: string;
  currency: string;
  arsRate: string;
  paymentMethod: "Débito" | "Crédito" | "Efectivo" | "Transferencia";
  category: string;
};

export function createEmptyExpenseRow(
  defaults: Partial<ExpenseDraftRow> = {}
): ExpenseDraftRow {
  return {
    description: "",
    amount: "",
    currency: "ARS",
    arsRate: "",
    paymentMethod: "Débito",
    category: "Compra",
    ...defaults,
  };
}

export function isExpenseDraftRowBlank(row: ExpenseDraftRow) {
  return !row.description.trim() && !row.amount.trim();
}

export function createInheritedExpenseRow(
  previous: ExpenseDraftRow
): ExpenseDraftRow {
  return createEmptyExpenseRow({
    currency: previous.currency,
    category: previous.category,
    arsRate: previous.currency === "USD" ? previous.arsRate : "",
  });
}
