export type HoaRubroItem = {
  label: string | null
  detail: string | null
  amount: number | null
}

export type HoaRubro = {
  rubroNumber: number | null
  label: string | null
  total: number | null
  items?: HoaRubroItem[]
}

export type HoaDetails = {
  buildingCode: string | null
  buildingAddress: string | null
  unitCode: string | null
  unitLabel: string | null
  ownerName: string | null
  periodLabel: string | null
  periodYear: number | null
  periodMonth: number | null
  firstDueAmount: number | null
  secondDueAmount: number | null
  totalBuildingExpenses: number | null
  totalToPayUnit: number | null
  rubros: HoaRubro[]
}

export type HoaSummary = {
  id: string
  userId: string
  buildingCode: string
  buildingAddress: string | null
  unitCode: string
  unitLabel: string | null
  ownerName: string | null
  periodKey: string
  periodYear: number
  periodMonth: number
  periodLabel: string
  totalToPayUnit: number | null
  totalBuildingExpenses: number | null
  rubros: HoaRubro[]
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}
