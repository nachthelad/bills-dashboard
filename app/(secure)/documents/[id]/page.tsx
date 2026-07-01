"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { CATEGORY_OPTIONS } from "@/config/billing/categories";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  parsing: "Procesando",
  parsed: "Procesado",
  needs_review: "Requiere revisión",
  paid: "Pagado",
  error: "Error",
};

export default function DocumentDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [document, setDocument] = useState<BillDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BillDocument>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { showAmounts } = useAmountVisibility();

  const mapResponseToDocument = (data: any): BillDocument => ({
    ...data,
    uploadedAt: data.uploadedAt ? new Date(data.uploadedAt) : new Date(),
  });

  const applyFormState = (doc: BillDocument) => {
    setFormData({
      provider: doc.provider ?? doc.providerNameDetected ?? "",
      amount: doc.amount ?? doc.totalAmount ?? undefined,
      dueDate: doc.dueDate ?? "",
      issueDate: doc.issueDate ?? "",
      periodStart: doc.periodStart ?? "",
      periodEnd: doc.periodEnd ?? "",
      status: doc.status,
      category: doc.category ?? "",
      currency: doc.currency ?? "ARS",
    });
  };

  const fetchDocument = useCallback(
    async (withLoader = true) => {
      if (!user || !docId) return;
      if (withLoader) setLoading(true);
      setActionError(null);

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/documents/${docId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load document");
        }

        const data = await response.json();
        const mapped = mapResponseToDocument(data);
        setDocument(mapped);
        applyFormState(mapped);
      } catch (error) {
        console.error("Error fetching document:", error);
        setActionError(
          error instanceof Error ? error.message : "Failed to fetch document"
        );
      } finally {
        if (withLoader) {
          setLoading(false);
        }
      }
    },
    [docId, user]
  );

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const refreshDocument = useCallback(async () => {
    await fetchDocument(false);
  }, [fetchDocument]);

  const documentStatus = document?.status as string | undefined;
  const isDocumentParsing = documentStatus === "parsing";

  useEffect(() => {
    if (!isDocumentParsing) {
      return;
    }
    const interval = setInterval(() => {
      refreshDocument().catch((error) =>
        console.warn("Failed to refresh parsing document:", error)
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [isDocumentParsing, refreshDocument]);

  const handleSave = async () => {
    if (!docId || !user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: formData.provider ?? null,
          amount: formData.amount ?? null,
          dueDate: formData.dueDate ?? null,
          issueDate: formData.issueDate ?? null,
          periodStart: formData.periodStart ?? null,
          periodEnd: formData.periodEnd ?? null,
          category: formData.category ?? null,
          status: formData.status ?? document?.status ?? "pending",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save document");
      }

      const updated = mapResponseToDocument(await response.json());
      setDocument(updated);
      applyFormState(updated);
      setEditing(false);
      setActionError(null);
    } catch (error) {
      console.error("Error saving document:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to save document"
      );
    }
  };

  const handleParse = async () => {
    if (!docId || !user) return;
    setParseLoading(true);
    setParseError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId: docId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to parse document");
      }

      await refreshDocument();
    } catch (error) {
      console.error("Error parsing document:", error);
      setParseError(
        error instanceof Error ? error.message : "Unexpected error"
      );
    } finally {
      setParseLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!docId || !user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete document");
      }

      router.push("/documents");
    } catch (error) {
      console.error("Error deleting document:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Cargando boleta...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <p
          className={actionError ? "text-destructive" : "text-muted-foreground"}
        >
          {actionError ?? "Boleta no encontrada"}
        </p>
      </div>
    );
  }

  const hasParsedText = Boolean(document.textExtract);
  const shouldShowParseButton = true;
  const isParserBusy = parseLoading || isDocumentParsing;

  const InfoItem = ({
    label,
    value,
  }: {
    label: string;
    value?: string | number | null;
  }) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-base font-medium break-words">{value ?? "-"}</p>
    </div>
  );

  const formatCurrency = (value?: number | null) => {
    if (value === undefined || value === null) return "-";
    if (!showAmounts) return "****";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: document.currency ?? "ARS",
    }).format(value);
  };

  const formatDate = (value?: string | null) => value ?? "—";

  return (
    <div className="space-y-8">
      <Link
        href="/documents"
        className="flex items-center gap-2 mb-8 text-emerald-300 hover:underline"
      >
        <ChevronLeft className="w-4 h-4" />
        Volver a boletas
      </Link>

      <Card className="mb-6 border border-border text-foreground">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{document.fileName}</CardTitle>
                <AmountVisibilityToggle />
              </div>
              <p className="text-sm text-muted-foreground">
                Estado:{" "}
                {DOCUMENT_STATUS_LABELS[document.status] ?? document.status}
              </p>
            </div>
          </div>
          {shouldShowParseButton && (
            <Button
              onClick={handleParse}
              disabled={isParserBusy}
              variant="secondary"
            >
              {isParserBusy ? (
                <>
                  <span className="animate-spin mr-2 border-2 border-current border-t-transparent rounded-full w-4 h-4" />
                  Procesando...
                </>
              ) : hasParsedText ? (
                "Re-procesar"
              ) : (
                "Procesar"
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {parseError && (
            <p className="text-destructive text-sm">{parseError}</p>
          )}
          {!parseError && actionError && (
            <p className="text-destructive text-sm">{actionError}</p>
          )}
          {!parseError && !actionError && document.errorMessage && (
            <p className="text-sm text-destructive">
              Último error del parser: {document.errorMessage}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoItem
              label="Proveedor"
              value={document.provider ?? document.providerNameDetected}
            />
            <InfoItem label="ID proveedor" value={document.providerId} />
            <InfoItem label="Categoría" value={document.category} />
            <InfoItem
              label="Monto total"
              value={formatCurrency(document.totalAmount ?? document.amount)}
            />
            <InfoItem label="Moneda" value={document.currency ?? "ARS"} />
            {document.foreignAmountUSD != null && (
              <InfoItem
                label="Cargos en USD"
                value={`USD ${document.foreignAmountUSD.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            )}
            <InfoItem
              label="Fecha de emisión"
              value={formatDate(document.issueDate)}
            />
            <InfoItem label="Vencimiento" value={formatDate(document.dueDate)} />
            <InfoItem
              label="Inicio del período"
              value={formatDate(document.periodStart)}
            />
            <InfoItem
              label="Fin del período"
              value={formatDate(document.periodEnd)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 border border-border text-foreground">
        <CardHeader>
          <CardTitle>Edición manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium block mb-2">Proveedor</label>
              <input
                type="text"
                value={(formData.provider as string) || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, provider: e.target.value }))
                }
                disabled={!editing}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:bg-muted/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Categoría</label>
              <select
                value={(formData.category as string) || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                disabled={!editing}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground disabled:opacity-60 disabled:bg-muted/20"
              >
                <option value="">Seleccionar categoría</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Monto</label>
              <input
                type="number"
                value={formData.amount ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    amount: e.target.value
                      ? Number.parseFloat(e.target.value)
                      : undefined,
                  }))
                }
                disabled={!editing}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:bg-muted/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Fecha de emisión
              </label>
              <DatePickerPopover
                value={(formData.issueDate as string) || ""}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    issueDate: value,
                  }))
                }
                disabled={!editing}
                inputClassName="w-full border-border bg-background text-foreground placeholder:text-muted-foreground disabled:bg-muted/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Vencimiento</label>
              <DatePickerPopover
                value={(formData.dueDate as string) || ""}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, dueDate: value }))
                }
                disabled={!editing}
                inputClassName="w-full border-border bg-background text-foreground placeholder:text-muted-foreground disabled:bg-muted/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Estado</label>
              <select
                value={(formData.status as BillDocument["status"]) || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.value as BillDocument["status"],
                  }))
                }
                disabled={!editing}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground disabled:opacity-60 disabled:bg-muted/20"
              >
                <option value="pending">Pendiente</option>
                <option value="parsed">Procesado</option>
                <option value="needs_review">Requiere revisión</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Inicio del período
              </label>
              <DatePickerPopover
                value={(formData.periodStart as string) || ""}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    periodStart: value,
                  }))
                }
                disabled={!editing}
                inputClassName="w-full border-border bg-background text-foreground placeholder:text-muted-foreground disabled:bg-muted/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Fin del período
              </label>
              <DatePickerPopover
                value={(formData.periodEnd as string) || ""}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    periodEnd: value,
                  }))
                }
                disabled={!editing}
                inputClassName="w-full border-border bg-background text-foreground placeholder:text-muted-foreground disabled:bg-muted/20"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            {!editing ? (
              <>
                <Button onClick={() => setEditing(true)}>Editar</Button>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  variant="destructive"
                  className="ml-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleSave}>Guardar</Button>
                <Button onClick={() => setEditing(false)} variant="outline">
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border text-foreground">
        <CardHeader>
          <CardTitle>Texto extraído</CardTitle>
        </CardHeader>
        <CardContent>
          {document.textExtract ? (
            <div className="max-h-[400px] max-w-full overflow-auto rounded-md border border-border">
              <pre
                className="w-full max-w-full min-w-0 whitespace-pre-wrap text-sm text-foreground p-4"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                {document.textExtract}
              </pre>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin texto extraído. Ejecutá el parser para ver resultados.
            </p>
          )}
        </CardContent>
      </Card>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              ¿Eliminar documento?
            </h3>
            <p className="text-sm text-muted-foreground">
              Esta acción eliminará la factura y su historial de procesamiento.
              No podés deshacer esta operación.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  handleDelete();
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
