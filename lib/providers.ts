export type ProviderSeed = {
  id: string
  name: string
  category: "electricity" | "gas" | "water" | "telecom" | "credit_card" | "hoa" | "other"
  aliases: string[]
}

export const PROVIDERS: ProviderSeed[] = [
  {
    id: "edesur",
    name: "Edesur",
    category: "electricity",
    aliases: ["Edesur", "EDESUR S.A."],
  },
  {
    id: "aysa",
    name: "AySA",
    category: "water",
    aliases: ["AySA", "AGUA Y SANEAMIENTO", "Aysa"],
  },
  {
    id: "metrogas",
    name: "Metrogas",
    category: "gas",
    aliases: ["Metrogas", "METROGAS S.A."],
  },
  {
    id: "telecentro",
    name: "Telecentro",
    category: "telecom",
    aliases: ["Telecentro"],
  },
  {
    id: "visa",
    name: "Tarjeta Visa",
    category: "credit_card",
    aliases: ["VISA", "Resumen de Cuenta"],
  },
  {
    id: "mastercard",
    name: "Mastercard",
    category: "credit_card",
    aliases: ["MASTERCARD"],
  },
]
