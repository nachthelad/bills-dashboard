import type { CategoryValue } from "./categories";
import { normalizeSearchValue } from "@/lib/category-utils";

export type ProviderHint = {
  providerId: string;
  providerName: string;
  category: CategoryValue;
  keywords: string[];
};

export const PROVIDER_HINTS: ProviderHint[] = [
  {
    providerId: "personal",
    providerName: "Personal (Fibertel)",
    category: "internet",
    keywords: ["telecom personal", "personal.com.ar", "fibertel", "telecom argentina", "cablevision"],
  },
  {
    providerId: "flow",
    providerName: "Flow (Cablevisión Telecom)",
    category: "internet",
    keywords: ["flow", "fibertel flow", "flow empresas"],
  },
  {
    providerId: "telecentro",
    providerName: "Telecentro",
    category: "internet",
    keywords: ["telecentro"],
  },
  {
    providerId: "claro",
    providerName: "Claro",
    category: "internet",
    keywords: ["claro"],
  },
  {
    providerId: "movistar",
    providerName: "Movistar",
    category: "internet",
    keywords: ["movistar"],
  },
  {
    providerId: "movistar_tv",
    providerName: "Movistar TV",
    category: "internet",
    keywords: ["movistar tv", "movistar play"],
  },
  {
    providerId: "iplan",
    providerName: "iPlan",
    category: "internet",
    keywords: ["iplan", "iplan fiber"],
  },
  {
    providerId: "fibercorp",
    providerName: "Fibercorp",
    category: "internet",
    keywords: ["fibercorp", "telecom empresas"],
  },
  {
    providerId: "telecom",
    providerName: "Telecom Argentina",
    category: "internet",
    keywords: ["telecom argentina"],
  },
  {
    providerId: "edesur",
    providerName: "Edesur",
    category: "electricity",
    keywords: ["edesur"],
  },
  {
    providerId: "edenor",
    providerName: "Edenor",
    category: "electricity",
    keywords: ["edenor"],
  },
  {
    providerId: "epec",
    providerName: "EPEC (Córdoba)",
    category: "electricity",
    keywords: ["epec"],
  },
  {
    providerId: "edea",
    providerName: "EDEA",
    category: "electricity",
    keywords: ["edea"],
  },
  {
    providerId: "edesa",
    providerName: "EDESA",
    category: "electricity",
    keywords: ["edesa"],
  },
  {
    providerId: "epe_santafe",
    providerName: "EPE Santa Fe",
    category: "electricity",
    keywords: ["epe", "energia santafe"],
  },
  {
    providerId: "abl_agip",
    providerName: "ABL / Inmobiliario (AGIP)",
    category: "other",
    keywords: [
      "agip",
      "inmobiliario y abl",
      "alumbrado barrido",
      "administracion gubernamental de ingresos publicos",
    ],
  },
  {
    providerId: "aysa",
    providerName: "AySA",
    category: "water",
    keywords: ["aysa", "agua y saneamiento"],
  },
  {
    providerId: "aguas_cordobesas",
    providerName: "Aguas Cordobesas",
    category: "water",
    keywords: ["aguas cordobesas"],
  },
  {
    providerId: "metrogas",
    providerName: "Metrogas",
    category: "gas",
    keywords: ["metrogas"],
  },
  {
    providerId: "naturgy",
    providerName: "Naturgy",
    category: "gas",
    keywords: ["naturgy", "gas natural ban", "gasban"],
  },
  {
    providerId: "camuzzi",
    providerName: "Camuzzi Gas",
    category: "gas",
    keywords: ["camuzzi"],
  },
  {
    providerId: "expensas_genericas",
    providerName: "Expensas / Consorcio",
    category: "hoa",
    keywords: ["expensa", "consorcio", "administracion"],
  },
  {
    providerId: "visa",
    providerName: "Visa",
    category: "credit_card",
    keywords: ["visa"],
  },
  {
    providerId: "mastercard",
    providerName: "Mastercard",
    category: "credit_card",
    keywords: ["mastercard"],
  },
  {
    providerId: "amex",
    providerName: "American Express",
    category: "credit_card",
    keywords: ["amex", "american express"],
  },
  {
    providerId: "naranja",
    providerName: "Tarjeta Naranja X",
    category: "credit_card",
    keywords: ["naranja", "tarjeta naranja", "naranja x"],
  },
  {
    providerId: "cabal",
    providerName: "Cabal",
    category: "credit_card",
    keywords: ["cabal"],
  },
  {
    providerId: "maestro",
    providerName: "Maestro",
    category: "credit_card",
    keywords: ["maestro"],
  },
  {
    providerId: "coto",
    providerName: "Coto",
    category: "other",
    keywords: ["coto"],
  },
  {
    providerId: "mercadopago",
    providerName: "Mercado Pago",
    category: "other",
    keywords: ["mercado pago", "mp"],
  },
  {
    providerId: "uala",
    providerName: "Ualá",
    category: "other",
    keywords: ["uala"],
  },
  // Health / Prepaga
  {
    providerId: "osde",
    providerName: "OSDE",
    category: "health",
    keywords: ["osde"],
  },
  {
    providerId: "swiss_medical",
    providerName: "Swiss Medical",
    category: "health",
    keywords: ["swiss medical", "swiss", "smg"],
  },
  {
    providerId: "galeno",
    providerName: "Galeno",
    category: "health",
    keywords: ["galeno"],
  },
  {
    providerId: "medicus",
    providerName: "Medicus",
    category: "health",
    keywords: ["medicus"],
  },
  {
    providerId: "omint",
    providerName: "OMINT",
    category: "health",
    keywords: ["omint"],
  },
  {
    providerId: "sancor_salud",
    providerName: "Sancor Salud",
    category: "health",
    keywords: ["sancor salud", "sancor"],
  },
  {
    providerId: "federada_salud",
    providerName: "Federada Salud",
    category: "health",
    keywords: ["federada salud", "federada"],
  },
  {
    providerId: "accord_salud",
    providerName: "Accord Salud",
    category: "health",
    keywords: ["accord salud", "accord"],
  },
  {
    providerId: "premedic",
    providerName: "Premedic",
    category: "health",
    keywords: ["premedic"],
  },
  {
    providerId: "hominis",
    providerName: "Hominis",
    category: "health",
    keywords: ["hominis"],
  },
  // Generic Hints for Categories
  {
    providerId: "generic_health",
    providerName: "Health / Prepaga",
    category: "health",
    keywords: [
      "salud",
      "medicina",
      "prepaga",
      "obra social",
      "servicio de salud",
    ],
  },
  {
    providerId: "generic_electricity",
    providerName: "Servicio de electricidad",
    category: "electricity",
    keywords: ["luz", "energia", "electricidad", "electric"],
  },
  {
    providerId: "generic_water",
    providerName: "Servicio de agua",
    category: "water",
    keywords: ["agua", "aguas", "saneamiento"],
  },
  {
    providerId: "generic_gas",
    providerName: "Servicio de gas",
    category: "gas",
    keywords: ["gas", "gas natural"],
  },
  {
    providerId: "generic_internet",
    providerName: "Internet/Mobile Service",
    category: "internet",
    keywords: ["internet", "wifi", "fibra", "banda ancha", "movil", "celular"],
  },
  {
    providerId: "generic_hoa",
    providerName: "HOA / Expensas",
    category: "hoa",
    keywords: ["expensa", "consorcio", "administracion", "edificio"],
  },
  {
    providerId: "generic_credit_card",
    providerName: "Tarjeta de crédito",
    category: "credit_card",
    keywords: ["tarjeta", "credito", "resumen", "banco"],
  },
];

export const PROVIDER_HINT_KEYWORD_MAP: Map<string, ProviderHint> = new Map();

for (const hint of PROVIDER_HINTS) {
  for (const keyword of hint.keywords) {
    const normalizedKeyword = normalizeSearchValue(keyword);
    if (normalizedKeyword) {
      PROVIDER_HINT_KEYWORD_MAP.set(normalizedKeyword, hint);
    }
  }
}
