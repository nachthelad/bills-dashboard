"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, Pencil, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { IncomeSource, MoneyCurrency } from "@/lib/budget";
import {
  createIncomeSource,
  deleteIncomeSource,
  fetchIncomeSources,
  updateIncomeSource,
} from "@/lib/funding-client";
import { Button } from "@/components/ui/button";
import { AddIncomeModal } from "@/components/income/add-income-modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type IncomeSourceForm = Omit<IncomeSource, "id">;

const EMPTY_SOURCE: IncomeSourceForm = {
  name: "",
  currency: "USD",
  expectedAmount: 0,
  isVariable: false,
  isActive: true,
};

export function IncomeSourcesSettings() {
  const { user } = useAuth();
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [form, setForm] = useState(EMPTY_SOURCE);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void user.getIdToken().then(fetchIncomeSources).then((next) => {
      if (!cancelled) setSources(next);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function openDialog(source?: IncomeSource) {
    setEditing(source ?? null);
    setForm(source ? { ...source } : EMPTY_SOURCE);
    setError(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const saved = editing
        ? await updateIncomeSource(token, editing.id, form)
        : await createIncomeSource(token, form);
      setSources((current) =>
        (editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved]
        ).sort((a, b) => a.name.localeCompare(b.name, "es"))
      );
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!user) return;
    const token = await user.getIdToken();
    await deleteIncomeSource(token, id);
    setSources((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <Card id="income-sources">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Fuentes de cobro</CardTitle>
              <CardDescription className="mt-1">
                Identifican de dónde viene cada cobro y en qué moneda lo recibís.
              </CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <Plus className="size-4" /> Agregar fuente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Todavía no configuraste fuentes de ingreso.
            </p>
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.currency}
                    {" · "}
                    {source.isVariable ? "Variable" : "Recurrente"}
                    {!source.isActive ? " · inactiva" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {source.isActive ? (
                    <AddIncomeModal
                      presetSource={source}
                      trigger={
                        <Button size="sm" variant="outline">
                          <CircleDollarSign className="size-4" />
                          Registrar cobro
                        </Button>
                      }
                    />
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${source.name}`}
                    onClick={() => openDialog(source)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Eliminar ${source.name}`}
                    onClick={() => void remove(source.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar fuente" : "Agregar fuente"}
            </DialogTitle>
            <DialogDescription>
              Usá esta fuente para vincular cobros reales en Ingresos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-name">Nombre</Label>
              <Input
                id="source-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda de cobro</Label>
              <Select
                value={form.currency}
                onValueChange={(currency: MoneyCurrency) =>
                  setForm((current) => ({ ...current, currency }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="source-variable">Ingreso variable</Label>
              <Switch
                id="source-variable"
                checked={form.isVariable}
                onCheckedChange={(isVariable) =>
                  setForm((current) => ({ ...current, isVariable }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="source-active">Fuente activa</Label>
              <Switch
                id="source-active"
                checked={form.isActive}
                onCheckedChange={(isActive) =>
                  setForm((current) => ({ ...current, isActive }))
                }
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Guardando…" : "Guardar fuente"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
