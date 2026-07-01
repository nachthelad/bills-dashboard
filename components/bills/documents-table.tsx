"use client";

import { useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Trash2,
  Calendar,
  CheckCircle,
} from "lucide-react";
import {
  getCategoryLabel,
  parseLocalDay,
  generateCalendarUrl,
} from "@/lib/billing-utils";
import { toggleBillStatus } from "@/lib/billing-actions";
import { CATEGORY_OPTIONS } from "@/config/billing/categories";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";
import { getDocumentStatusLabel } from "@/lib/ui-labels";

interface DocumentsTableProps {
  documents: BillDocument[];
  showAmounts: boolean;
  onDeleteComplete?: () => void;
}

export function DocumentsTable({
  documents,
  showAmounts,
  onDeleteComplete,
}: DocumentsTableProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<BillDocument | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [markAllDialogOpen, setMarkAllDialogOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = (
      doc.provider ||
      doc.providerNameDetected ||
      doc.fileName ||
      ""
    )
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const handleDelete = async () => {
    if (!documentToDelete || !user) return;
    setIsDeleting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/documents/${documentToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar la boleta");
      }

      onDeleteComplete?.();
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (doc: BillDocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const markAsPaid = async (docId: string) => {
    if (!user) return;
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    try {
      const token = await user.getIdToken();
      await toggleBillStatus(docId, doc.status, token);
      onDeleteComplete?.(); // Re-fetch documents
    } catch (error) {
      console.error("Error updating document status:", error);
    }
  };

  const handleMarkAllClick = () => {
    const pendingDocs = filteredDocuments.filter(
      (doc) => doc.status !== "paid"
    );
    if (pendingDocs.length === 0) return;
    setMarkAllDialogOpen(true);
  };

  const confirmMarkAll = async () => {
    if (!user) return;
    setIsMarkingAll(true);
    const pendingDocs = filteredDocuments.filter(
      (doc) => doc.status !== "paid"
    );

    try {
      for (const doc of pendingDocs) {
        await markAsPaid(doc.id);
      }
    } finally {
      setIsMarkingAll(false);
      setMarkAllDialogOpen(false);
    }
  };

  const addToCalendar = (doc: BillDocument) => {
    const url = generateCalendarUrl(doc);
    window.open(url, "_blank");
  };

  const statusStyles = {
    parsed:
      "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20",
    pending:
      "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
    needs_review:
      "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
    error: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20",
    paid: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar boletas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="parsed">Procesado</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="needs_review">Requiere revisión</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleMarkAllClick}
          disabled={filteredDocuments.every((doc) => doc.status === "paid")}
          title="Marcar todas las boletas visibles como pagadas"
        >
          Marcar todo como pagado
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor / Archivo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fecha de carga</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center w-[100px]">¿Pagado?</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron boletas.
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => {
                const dueDate = parseLocalDay(doc.dueDate);
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">
                          {doc.provider ||
                            doc.providerNameDetected ||
                            doc.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {getCategoryLabel(doc.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(doc.uploadedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dueDate ? formatDate(dueDate) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(doc.amount ?? doc.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusStyles[doc.status]}
                      >
                        {getDocumentStatusLabel(doc.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {doc.status !== "paid" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsPaid(doc.id)}
                          title="Marcar como pagada"
                          className="text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {doc.status === "paid" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsPaid(doc.id)}
                          title="Marcar como pendiente"
                          className="text-emerald-500 hover:text-amber-500 hover:bg-amber-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => addToCalendar(doc)}
                          title="Agregar a Google Calendar"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar boleta"
                          onClick={() => confirmDelete(doc)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/documents/${doc.id}`} aria-label="Ver detalle de la boleta">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        {doc.storageUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={doc.storageUrl}
                              aria-label="Abrir PDF"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4 shadow-lg">
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
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {markAllDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4 shadow-lg">
            <h3 className="text-xl font-semibold text-foreground">
              ¿Marcar todo como pagado?
            </h3>
            <p className="text-sm text-muted-foreground">
              ¿Confirmás marcar{" "}
              {filteredDocuments.filter((doc) => doc.status !== "paid").length}{" "}
              boletas como pagadas?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setMarkAllDialogOpen(false)}
                disabled={isMarkingAll}
              >
                Cancelar
              </Button>
              <Button onClick={confirmMarkAll} disabled={isMarkingAll}>
                {isMarkingAll ? "Procesando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
