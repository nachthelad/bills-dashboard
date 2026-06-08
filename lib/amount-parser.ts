export function parseAmountInput(value: unknown): number {
  return typeof value === "number"
    ? value
    : parseAmountString(String(value ?? ""));
}

function parseAmountString(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/^\$|^ARS|^USD/i, "");

  if (!normalized) return Number.NaN;

  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }

  if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ""));
  }

  return Number(normalized);
}
