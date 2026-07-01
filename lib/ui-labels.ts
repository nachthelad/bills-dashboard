const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  parsing: "Procesando",
  parsed: "Procesado",
  needs_review: "Requiere revisión",
  paid: "Pagado",
  completed: "Completado",
  error: "Error",
};

const INCOME_SOURCE_LABELS: Record<string, string> = {
  Salary: "Salario",
  Freelance: "Freelance",
  Investments: "Inversiones",
  Other: "Otros",
};

const HOA_DIFFERENCE_STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  removed: "Eliminado",
  increased: "Aumentado",
  decreased: "Disminuido",
};

export function getDocumentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}

export function getIncomeSourceLabel(source: string): string {
  return INCOME_SOURCE_LABELS[source] ?? source;
}

export function getHoaDifferenceStatusLabel(status: string): string {
  return HOA_DIFFERENCE_STATUS_LABELS[status] ?? "Sin cambios";
}
