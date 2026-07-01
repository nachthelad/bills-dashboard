"use client";

import type React from "react";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import type { BillDocument } from "@/lib/firestore-helpers";
import { Button } from "@/components/ui/button";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { Input } from "@/components/ui/input";
import { CATEGORY_OPTIONS } from "@/config/billing/categories";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { createApiClient, type CreateDocumentInput } from "@/lib/api-client";
import { getLocalTodayIso } from "@/lib/date-picker";

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<Partial<BillDocument>>({
    provider: "",
    amount: undefined,
    dueDate: "",
    periodStart: "",
    periodEnd: "",
    issueDate: "",
    category: CATEGORY_OPTIONS[0]?.value ?? "other",
    currency: "ARS",
  });

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  const handleManualSubmit = async () => {
    if (!user || !apiClient) return;
    setManualLoading(true);
    setManualError(null);
    try {
      const payload: CreateDocumentInput = {
        fileName:
          manualForm.provider?.trim() || manualForm.category?.trim()
            ? `${
                manualForm.provider?.trim() || manualForm.category?.trim()
              } (manual)`
            : `Factura manual ${getLocalTodayIso()}`,
        storageUrl: null,
        provider: manualForm.provider?.trim() || null,
        category: manualForm.category || null,
        amount: manualForm.amount ?? null,
        currency: manualForm.currency || null,
        dueDate: manualForm.dueDate || null,
        issueDate: manualForm.issueDate || null,
        periodStart: manualForm.periodStart || null,
        periodEnd: manualForm.periodEnd || null,
        manualEntry: true,
        textExtract: null,
      };

      const documentId = await apiClient.createDocument(payload);
      router.push(`/documents/${documentId}`);
    } catch (err) {
      console.error("Manual doc error:", err);
      setManualError(
        err instanceof Error ? err.message : "No se pudo guardar la factura manual"
      );
    } finally {
      setManualLoading(false);
    }
  };

  const isManualValid =
    Boolean(manualForm.provider?.trim() || manualForm.category?.trim()) &&
    Boolean(manualForm.amount !== undefined && manualForm.amount !== null) &&
    Boolean(manualForm.dueDate);

  return (
    <div className="space-y-8">
      <Link
        href="/documents"
        className="flex items-center gap-2 text-emerald-300 hover:underline"
      >
        <ChevronLeft className="w-4 h-4" />
        Volver a boletas
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Agregar factura manual</h1>
        <p className="text-slate-400">
          Ingresá los datos de la factura manualmente para registrarla en tu panel.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ManualInput
            label="Proveedor"
            value={manualForm.provider ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({ ...prev, provider: value }))
            }
          />
          <ManualSelect
            label="Categoría"
            value={manualForm.category ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({ ...prev, category: value }))
            }
          />
          <ManualInput
            label="Monto"
            type="number"
            value={manualForm.amount?.toString() ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({
                ...prev,
                amount: value ? Number.parseFloat(value) : undefined,
              }))
            }
          />
          <ManualInput
            label="Moneda"
            value={manualForm.currency ?? "ARS"}
            onChange={(value) =>
              setManualForm((prev) => ({
                ...prev,
                currency: value.toUpperCase(),
              }))
            }
            placeholder="ARS"
          />
          <ManualDateInput
            label="Fecha de vencimiento"
            value={manualForm.dueDate ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({ ...prev, dueDate: value }))
            }
          />
          <ManualDateInput
            label="Fecha de emisión"
            value={manualForm.issueDate ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({ ...prev, issueDate: value }))
            }
          />
          <ManualDateInput
            label="Inicio del período"
            value={manualForm.periodStart ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({ ...prev, periodStart: value }))
            }
          />
          <ManualDateInput
            label="Fin del período"
            value={manualForm.periodEnd ?? ""}
            onChange={(value) =>
              setManualForm((prev) => ({ ...prev, periodEnd: value }))
            }
          />
        </div>

        {manualError && (
          <div className="text-sm text-red-400">{manualError}</div>
        )}

        <Button
          onClick={handleManualSubmit}
          disabled={!user || manualLoading || !isManualValid}
          className="w-full md:w-auto bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {manualLoading ? "Guardando..." : "Guardar factura manual"}
        </Button>
      </div>
    </div>
  );
}

type ManualInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
};

function ManualInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: ManualInputProps) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2 text-slate-200">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        size="lg"
        className="w-full border-slate-800 bg-slate-900/40 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>
  );
}

type ManualDateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function ManualDateInput({ label, value, onChange }: ManualDateInputProps) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2 text-slate-200">
        {label}
      </label>
      <DatePickerPopover
        value={value}
        onChange={onChange}
        inputClassName="w-full border-slate-800 bg-slate-900/40 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/50"
        buttonClassName="text-slate-400 hover:text-slate-100"
      />
    </div>
  );
}

type ManualSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function ManualSelect({ label, value, onChange, disabled }: ManualSelectProps) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2 text-slate-200">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          size="lg"
          className="w-full border-slate-800 bg-slate-900/40 text-slate-100 focus:ring-2 focus:ring-emerald-500/50"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
