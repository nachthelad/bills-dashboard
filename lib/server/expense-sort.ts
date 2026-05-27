type TimestampLike = {
  toDate?: () => Date;
};

export type ExpenseSortEntry = {
  id: string;
  date: unknown;
  createdAt?: unknown;
};

export function sortExpenseEntriesForDisplay<T extends ExpenseSortEntry>(
  entries: T[]
): T[] {
  return [...entries].sort(compareExpenseEntriesForDisplay);
}

function compareExpenseEntriesForDisplay(
  a: ExpenseSortEntry,
  b: ExpenseSortEntry
) {
  const dateDiff = compareMillisDesc(a.date, b.date);
  if (dateDiff !== 0) return dateDiff;

  const createdAtDiff = compareMillisDesc(a.createdAt, b.createdAt);
  if (createdAtDiff !== 0) return createdAtDiff;

  return a.id.localeCompare(b.id);
}

function compareMillisDesc(a: unknown, b: unknown) {
  const aMillis = toMillis(a);
  const bMillis = toMillis(b);

  if (aMillis === bMillis) return 0;
  return aMillis > bMillis ? -1 : 1;
}

function toMillis(value: unknown) {
  if (!value) return Number.NEGATIVE_INFINITY;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? Number.NEGATIVE_INFINITY
      : value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? Number.NEGATIVE_INFINITY
      : parsed.getTime();
  }

  if (typeof value === "object" && "toDate" in (value as TimestampLike)) {
    try {
      return toMillis((value as TimestampLike).toDate?.());
    } catch {
      return Number.NEGATIVE_INFINITY;
    }
  }

  return Number.NEGATIVE_INFINITY;
}
