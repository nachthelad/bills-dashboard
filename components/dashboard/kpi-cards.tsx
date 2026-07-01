"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownIcon, ArrowUpIcon, Wallet, Calendar } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"

interface KpiCardsProps {
  totalExpenses: number
  totalIncome: number
  netIncome: number
  monthExpenses: number
  showAmounts: boolean
}

export function KpiCards({
  totalExpenses,
  totalIncome,
  netIncome,
  monthExpenses,
  showAmounts,
}: KpiCardsProps) {
  const isCompact = useMediaQuery("(max-width: 1024px) and (min-width: 768px)")

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••"
    
    if (isCompact && Math.abs(amount) >= 1000000) {
      const formatted = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 1,
      }).format(amount / 1000000)
      return formatted + "M"
    }

    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos totales del año</CardTitle>
          <ArrowDownIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
          <p className="text-xs text-muted-foreground">
            Gastos del año (facturas + diarios + expensas)
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos totales del año</CardTitle>
          <ArrowUpIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
          <p className="text-xs text-muted-foreground">
            Ingresos del año
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance neto del año</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${netIncome < 0 ? "text-destructive" : "text-emerald-500"}`}>
            {formatCurrency(netIncome)}
          </div>
          <p className="text-xs text-muted-foreground">
            Ingresos menos gastos
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Este mes</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(monthExpenses)}</div>
          <p className="text-xs text-muted-foreground">
            Gastos del mes actual
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
