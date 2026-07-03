import { SettingsForm } from "@/components/settings/settings-form"

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          Configuración
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Administrá la apariencia, privacidad y preferencias de la cuenta.
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        <SettingsForm />
      </div>
    </div>
  )
}
