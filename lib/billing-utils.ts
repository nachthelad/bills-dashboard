import type { BillDocument } from "@/lib/firestore-helpers";
import {
  CATEGORY_OPTIONS,
  type CategoryValue,
  getCategoryLabel,
} from "@/config/billing/categories";

// Re-export for backward compatibility
export { getCategoryLabel };

const categoryOrder = CATEGORY_OPTIONS.map(
  (option) => option.value
) as CategoryValue[];

export function parseLocalDay(
  value: string | Date | null | undefined
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  // Handle YYYY-MM-DD strings explicitly as local time
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveDocDate(doc: BillDocument): Date | null {
  const candidates: (Date | string | null | undefined)[] = [
    doc.dueDate,
    doc.issueDate,
    doc.periodEnd,
    doc.periodStart,
    doc.uploadedAt,
  ];
  for (const candidate of candidates) {
    const date = parseLocalDay(candidate);
    if (date) return date;
  }
  return null;
}

export function defaultCategoryTotals(): Record<CategoryValue, number> {
  return categoryOrder.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<CategoryValue, number>);
}

export function generateCalendarUrl(doc: BillDocument): string {
  const title = `Pagar ${doc.provider || doc.providerNameDetected || "boleta"} $${
    doc.amount ?? doc.totalAmount ?? 0
  }`;
  const details = `Enlace al documento: ${doc.storageUrl || ""}`;

  let datesParam = "";
  if (doc.dueDate) {
    const dueDate = parseLocalDay(doc.dueDate);
    if (dueDate) {
      const yyyymmdd = dueDate.toISOString().replace(/-/g, "").split("T")[0];
      const nextDay = new Date(dueDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().replace(/-/g, "").split("T")[0];
      datesParam = `&dates=${yyyymmdd}/${nextDayStr}`;
    }
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&details=${encodeURIComponent(details)}${datesParam}`;
}
