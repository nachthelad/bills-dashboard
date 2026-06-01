"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreditCard } from "@/lib/credit-card-utils";
import { ResponsiveModal } from "./responsive-modal";

type CardFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
  onSave: (name: string) => Promise<void>;
};

export function CardFormModal({
  open,
  onOpenChange,
  card,
  onSave,
}: CardFormModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(card?.name ?? "");
    setError(null);
  }, [card, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ingresá un nombre para la tarjeta.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={card ? "Renombrar tarjeta" : "Agregar tarjeta"}
      description="Usá el nombre con el que reconocés el resumen."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="credit-card-name">Nombre</Label>
          <Input
            id="credit-card-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. VISA Galicia"
            autoFocus
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar tarjeta"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
