export function formatAmount(
  amount: number,
  currency = "ARS",
  showAmounts = true
): string {
  if (!showAmounts) return "••••••";
  if (currency === "ARS") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return `${currency} ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatAmountWithUsd(
  amount: number,
  currency: string,
  arsRate: number | null | undefined,
  showAmounts = true
): string {
  if (!showAmounts) return "••••••";
  if (currency !== "USD") return formatAmount(amount, currency, showAmounts);
  if (arsRate != null) {
    const arsFormatted = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount * arsRate);
    const usdFormatted = new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 2,
    }).format(amount);
    return `${arsFormatted} (${usdFormatted} USD)`;
  }
  return formatAmount(amount, "USD", showAmounts);
}
