export const DOCUMENT_PROCESSING_STATUSES = [
  "pending",
  "parsed",
  "needs_review",
  "error",
] as const;

export type DocumentProcessingStatus =
  (typeof DOCUMENT_PROCESSING_STATUSES)[number];

export class DocumentStatusError extends Error {}

export function parseDocumentProcessingStatus(
  value: unknown
): DocumentProcessingStatus {
  if (
    typeof value === "string" &&
    DOCUMENT_PROCESSING_STATUSES.includes(value as DocumentProcessingStatus)
  ) {
    return value as DocumentProcessingStatus;
  }
  throw new DocumentStatusError(
    "El estado de la boleta debe representar su procesamiento"
  );
}

export function normalizeLegacyDocumentStatus(value: unknown) {
  return value === "paid" ? "parsed" : value;
}
