import type { HoaDetails, HoaRubro, HoaRubroItem } from "@/types/hoa";
import { logger as baseLogger, type Logger } from "@/lib/server/logger";
import { z } from "zod";

export type BillingParseResult = {
  text: string | null;
  providerId: string | null;
  providerNameDetected: string | null;
  category: string | null;
  totalAmount: number | null;
  currency: string | null;
  issueDate: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  hoaDetails: HoaDetails | null;
  foreignAmountUSD: number | null;
};

const hoaRubroItemSchema = z.object({
  label: z.string().nullable(),
  detail: z.string().nullable(),
  amount: z.number().nullable(),
});

const hoaRubroSchema = z.object({
  rubroNumber: z.number().nullable(),
  label: z.string().nullable(),
  total: z.number().nullable(),
  items: z.array(hoaRubroItemSchema).nullable().optional(),
});

const hoaDetailsSchema = z
  .object({
    buildingCode: z.string().nullable(),
    buildingAddress: z.string().nullable(),
    unitCode: z.string().nullable(),
    unitLabel: z.string().nullable(),
    ownerName: z.string().nullable(),
    periodLabel: z.string().nullable(),
    periodYear: z.number().nullable(),
    periodMonth: z.number().nullable(),
    firstDueAmount: z.number().nullable(),
    secondDueAmount: z.number().nullable(),
    totalBuildingExpenses: z.number().nullable(),
    totalToPayUnit: z.number().nullable(),
    rubros: z.array(hoaRubroSchema).nullable(),
  })
  .nullable();

const BillingParseResultSchema = z.object({
  text: z.string().nullable(),
  providerId: z.string().nullable(),
  providerNameDetected: z.string().nullable(),
  category: z.string().nullable(),
  totalAmount: z.number().nullable(),
  currency: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  hoaDetails: hoaDetailsSchema,
  foreignAmountUSD: z.number().nullable(),
});

type JsonSchema = {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
  };
};

const BILLING_SCHEMA_BODY = {
  name: "billing_parse_result",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      providerId: { anyOf: [{ type: "string" }, { type: "null" }] },
      providerNameDetected: { anyOf: [{ type: "string" }, { type: "null" }] },
      category: { anyOf: [{ type: "string" }, { type: "null" }] },
      totalAmount: { anyOf: [{ type: "number" }, { type: "null" }] },
      currency: { anyOf: [{ type: "string" }, { type: "null" }] },
      issueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
      dueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
      periodStart: { anyOf: [{ type: "string" }, { type: "null" }] },
      periodEnd: { anyOf: [{ type: "string" }, { type: "null" }] },
      foreignAmountUSD: { anyOf: [{ type: "number" }, { type: "null" }] },
      hoaDetails: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              buildingCode: { anyOf: [{ type: "string" }, { type: "null" }] },
              buildingAddress: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              unitCode: { anyOf: [{ type: "string" }, { type: "null" }] },
              unitLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
              ownerName: { anyOf: [{ type: "string" }, { type: "null" }] },
              periodLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
              periodYear: { anyOf: [{ type: "number" }, { type: "null" }] },
              periodMonth: { anyOf: [{ type: "number" }, { type: "null" }] },
              firstDueAmount: { anyOf: [{ type: "number" }, { type: "null" }] },
              secondDueAmount: {
                anyOf: [{ type: "number" }, { type: "null" }],
              },
              totalBuildingExpenses: {
                anyOf: [{ type: "number" }, { type: "null" }],
              },
              totalToPayUnit: { anyOf: [{ type: "number" }, { type: "null" }] },
              rubros: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    rubroNumber: {
                      anyOf: [{ type: "number" }, { type: "null" }],
                    },
                    label: { anyOf: [{ type: "string" }, { type: "null" }] },
                    total: { anyOf: [{ type: "number" }, { type: "null" }] },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          label: {
                            anyOf: [{ type: "string" }, { type: "null" }],
                          },
                          detail: {
                            anyOf: [{ type: "string" }, { type: "null" }],
                          },
                          amount: {
                            anyOf: [{ type: "number" }, { type: "null" }],
                          },
                        },
                        required: ["label", "detail", "amount"],
                      },
                    },
                  },
                  required: ["rubroNumber", "label", "total", "items"],
                },
              },
            },
            required: [
              "buildingCode",
              "buildingAddress",
              "unitCode",
              "unitLabel",
              "ownerName",
              "periodLabel",
              "periodYear",
              "periodMonth",
              "firstDueAmount",
              "secondDueAmount",
              "totalBuildingExpenses",
              "totalToPayUnit",
              "rubros",
            ],
          },
        ],
      },
    },
    required: [
      "text",
      "providerId",
      "providerNameDetected",
      "category",
      "totalAmount",
      "currency",
      "issueDate",
      "dueDate",
      "periodStart",
      "periodEnd",
      "hoaDetails",
      "foreignAmountUSD",
    ],
  },
};
export const BILL_PARSER_SCHEMA: JsonSchema = {
  type: "json_schema",
  name: BILLING_SCHEMA_BODY.name,
  schema: BILLING_SCHEMA_BODY.schema,
  json_schema: BILLING_SCHEMA_BODY,
};

export const OPENAI_SYSTEM_PROMPT = `You are a meticulous assistant that extracts structured billing data from PDF text.
CRITICAL: For HOA (Expensas) bills, you MUST distinguish between the individual unit's total and the collective building total.
- 'totalAmount': Set this to the INDIVIDUAL amount the unit owner must pay (e.g., 'Total a Pagar', 'Total Unidad', 'Current Month Total').
- 'hoaDetails.totalToPayUnit': This MUST match the individual share.
- 'hoaDetails.totalBuildingExpenses': Set this to the larger collective total of the entire building.
- 'hoaDetails.rubros': Extract each expense category/rubro total.
- 'hoaDetails.rubros[].items': When a rubro lists individual charges, extract each line item with a concise provider/service label, the remaining description in detail, and the line amount. Use an empty array when the rubro has no itemized rows.
CREDIT CARD STATEMENTS (Resúmenes de tarjeta de crédito):
- 'totalAmount': ALWAYS set to the ARS total actually owed (the "Total a Pagar en Pesos", "Importe Total en $", or equivalent ARS summary line). Must be in ARS even when individual purchases were in USD.
- 'currency': ALWAYS set to "ARS" for Argentine credit card statements.
- 'foreignAmountUSD': If the statement contains USD-denominated charges (purchases billed in USD/U$S), set this to the total USD amount charged (sum of all USD line items, or the explicit USD subtotal if present). Set to null if no USD charges exist.
Always respond with JSON that strictly matches the provided schema.`;

export const OPENAI_USER_PROMPT = `Analyze the following PDF text and extract any billing related metadata. For HOA/Expensas, pay close attention to the Unit Number and its specific total to pay. return null when information cannot be determined.`;

type ResponsesCreateArgs = {
  model: string;
  input: Array<{
    role: string;
    content: Array<{ type: string; text?: string; image_url?: string }>;
  }>;
  text?: {
    format?: JsonSchema;
  };
};

type OpenAIMessageOutput = {
  type: "message";
  content?: Array<{ type: string; text?: string }>;
};

type OpenAITextOutput = {
  type: string;
  text?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<OpenAIMessageOutput | OpenAITextOutput>;
};

class OpenAIClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string
  ) {}

  private get url() {
    return this.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";
  }

  responses = {
    create: async (body: ResponsesCreateArgs) => {
      const response = await fetch(`${this.url}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI request failed with ${response.status}: ${errorText}`
        );
      }

      return (await response.json()) as OpenAIResponse;
    },
  };
}

// ---------------------------------------------------------------------------
// Gemini client
// ---------------------------------------------------------------------------

const GEMINI_BILLING_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    providerId: { type: "string", nullable: true },
    providerNameDetected: { type: "string", nullable: true },
    category: { type: "string", nullable: true },
    totalAmount: { type: "number", nullable: true },
    currency: { type: "string", nullable: true },
    issueDate: { type: "string", nullable: true },
    dueDate: { type: "string", nullable: true },
    periodStart: { type: "string", nullable: true },
    periodEnd: { type: "string", nullable: true },
    foreignAmountUSD: { type: "number", nullable: true },
    hoaDetails: {
      type: "object",
      nullable: true,
      properties: {
        buildingCode: { type: "string", nullable: true },
        buildingAddress: { type: "string", nullable: true },
        unitCode: { type: "string", nullable: true },
        unitLabel: { type: "string", nullable: true },
        ownerName: { type: "string", nullable: true },
        periodLabel: { type: "string", nullable: true },
        periodYear: { type: "number", nullable: true },
        periodMonth: { type: "number", nullable: true },
        firstDueAmount: { type: "number", nullable: true },
        secondDueAmount: { type: "number", nullable: true },
        totalBuildingExpenses: { type: "number", nullable: true },
        totalToPayUnit: { type: "number", nullable: true },
        rubros: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rubroNumber: { type: "number", nullable: true },
              label: { type: "string", nullable: true },
              total: { type: "number", nullable: true },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", nullable: true },
                    detail: { type: "string", nullable: true },
                    amount: { type: "number", nullable: true },
                  },
                  required: ["label", "detail", "amount"],
                },
              },
            },
            required: ["rubroNumber", "label", "total", "items"],
          },
        },
      },
      required: [
        "buildingCode",
        "buildingAddress",
        "unitCode",
        "unitLabel",
        "ownerName",
        "periodLabel",
        "periodYear",
        "periodMonth",
        "firstDueAmount",
        "secondDueAmount",
        "totalBuildingExpenses",
        "totalToPayUnit",
        "rubros",
      ],
    },
  },
  required: [
    "text",
    "providerId",
    "providerNameDetected",
    "category",
    "totalAmount",
    "currency",
    "issueDate",
    "dueDate",
    "periodStart",
    "periodEnd",
    "hoaDetails",
    "foreignAmountUSD",
  ],
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

class GeminiClient {
  constructor(private readonly apiKey: string) {}

  async generateContent(
    model: string,
    body: Record<string, unknown>
  ): Promise<GeminiResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini request failed with ${response.status}: ${errorText}`
      );
    }
    return (await response.json()) as GeminiResponse;
  }
}

let cachedGeminiClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!cachedGeminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    cachedGeminiClient = new GeminiClient(apiKey);
  }
  return cachedGeminiClient;
}

function extractGeminiText(response: GeminiResponse): string {
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || text.trim().length === 0) {
    throw new Error("No text in Gemini response");
  }
  return text.trim();
}

export async function parseBillingTextWithGemini(
  fullText: string,
  scopedLogger: Logger = baseLogger
): Promise<BillingParseResult> {
  const log = scopedLogger;
  const trimmedText = fullText?.trim();
  if (!trimmedText) {
    throw new Error("Cannot parse empty text extract");
  }

  const parseStart = Date.now();
  try {
    const relevantText = extractRelevantText(fullText);
    const client = getGeminiClient();
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    const response = await callGeminiWithRetry(
      () =>
        client.generateContent(model, {
          systemInstruction: {
            role: "system",
            parts: [{ text: OPENAI_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `${OPENAI_USER_PROMPT}\n\n${relevantText}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_BILLING_SCHEMA,
          },
        }),
      log
    );

    const jsonText = extractGeminiText(response);
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(jsonText);
    } catch (error) {
      log.error("Failed to parse Gemini response payload", { error });
      throw new Error("Failed to parse Gemini response");
    }

    let validated: z.infer<typeof BillingParseResultSchema>;
    try {
      validated = BillingParseResultSchema.parse(parsedPayload);
    } catch (error) {
      log.error("Gemini response validation failed", { error });
      throw error;
    }
    const sanitized = sanitizeBillingResult(validated);
    return {
      ...sanitized,
      text: sanitized.text ?? (fullText.length > 0 ? fullText : null),
    };
  } finally {
    const durationMs = Date.now() - parseStart;
    log.debug("parseBillingTextWithGemini completed", {
      durationMs: Number(durationMs.toFixed(2)),
    });
  }
}

export async function parseBillingImageWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  scopedLogger: Logger = baseLogger
): Promise<BillingParseResult> {
  const log = scopedLogger;
  const parseStart = Date.now();
  try {
    const base64 = imageBuffer.toString("base64");
    const client = getGeminiClient();
    const model =
      process.env.GEMINI_VISION_MODEL ??
      process.env.GEMINI_MODEL ??
      "gemini-2.5-flash";

    const response = await callGeminiWithRetry(
      () =>
        client.generateContent(model, {
          systemInstruction: {
            role: "system",
            parts: [{ text: OPENAI_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: OPENAI_USER_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_BILLING_SCHEMA,
          },
        }),
      log
    );

    const jsonText = extractGeminiText(response);
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(jsonText);
    } catch (error) {
      log.error("Failed to parse Gemini vision response payload", { error });
      throw new Error("Failed to parse Gemini vision response");
    }

    let validated: z.infer<typeof BillingParseResultSchema>;
    try {
      validated = BillingParseResultSchema.parse(parsedPayload);
    } catch (error) {
      log.error("Gemini vision response validation failed", { error });
      throw error;
    }
    const sanitized = sanitizeBillingResult(validated);
    return {
      ...sanitized,
      text: sanitized.text ?? "[parsed from image]",
    };
  } finally {
    const durationMs = Date.now() - parseStart;
    log.debug("parseBillingImageWithGemini completed", {
      durationMs: Number(durationMs.toFixed(2)),
    });
  }
}

// ---------------------------------------------------------------------------

let cachedClient: OpenAIClient | null = null;
type Pdf2JsonConstructor = new () => {
  on(event: string, handler: (...args: any[]) => void): void;
  parseBuffer(buffer: Buffer): void;
  removeAllListeners?: () => void;
};
type Pdf2JsonTextRun = { T?: string };
type Pdf2JsonText = { R?: Pdf2JsonTextRun[] };
type Pdf2JsonPage = { Texts?: Pdf2JsonText[] };
type Pdf2JsonDocument = { Pages?: Pdf2JsonPage[] };
let cachedPdf2Json: Pdf2JsonConstructor | null = null;

export function getOpenAIClient(): OpenAIClient {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    const baseUrl = process.env.OPENAI_BASE_URL;
    cachedClient = new OpenAIClient(apiKey, baseUrl);
  }
  return cachedClient;
}

function sanitizeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function sanitizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = trimmed.replace(/[^0-9.,-]+/g, "");
  if (!numeric) {
    return null;
  }

  const commaCount = (numeric.match(/,/g) ?? []).length;
  const dotCount = (numeric.match(/\./g) ?? []).length;
  let normalized = numeric;

  if (commaCount && dotCount) {
    const lastComma = numeric.lastIndexOf(",");
    const lastDot = numeric.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = numeric.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = numeric.replace(/,/g, "");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    normalized = numeric.replace(/,/g, ".");
  } else if (commaCount > 1 && dotCount === 0) {
    normalized = numeric.replace(/,/g, "");
  } else if (dotCount > 1 && commaCount === 0) {
    normalized = numeric.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeInteger(value: unknown): number | null {
  const numeric = sanitizeNumber(value);
  if (numeric === null) return null;
  const rounded = Math.round(numeric);
  return Number.isFinite(rounded) ? rounded : null;
}

function sanitizeHoaRubroItems(value: unknown): HoaRubroItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { label: null, detail: null, amount: null };
    }
    const rubroItem = item as Record<string, unknown>;
    return {
      label: sanitizeString(rubroItem.label),
      detail: sanitizeString(rubroItem.detail),
      amount: sanitizeNumber(rubroItem.amount),
    };
  });
}

function sanitizeHoaRubros(value: unknown): HoaRubro[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { rubroNumber: null, label: null, total: null, items: [] };
    }
    const rubro = item as Record<string, unknown>;
    return {
      rubroNumber: sanitizeInteger(rubro.rubroNumber),
      label: normalizeRubroLabel(sanitizeString(rubro.label)),
      total: sanitizeNumber(rubro.total),
      items: sanitizeHoaRubroItems(rubro.items),
    };
  });
}

function normalizeRubroLabel(label: string | null): string | null {
  if (!label) return null;
  // Remove " (Rubro X)" or "(Rubro X)" case insensitive
  return label.replace(/\s*\(Rubro\s*\d+\)/i, "").trim();
}

function sanitizeHoaDetails(value: unknown): HoaDetails | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const details = value as Record<string, unknown>;
  return {
    buildingCode: sanitizeString(details.buildingCode),
    buildingAddress: sanitizeString(details.buildingAddress),
    unitCode: sanitizeString(details.unitCode),
    unitLabel: sanitizeString(details.unitLabel),
    ownerName: sanitizeString(details.ownerName),
    periodLabel: sanitizeString(details.periodLabel),
    periodYear: sanitizeInteger(details.periodYear),
    periodMonth: sanitizeInteger(details.periodMonth),
    firstDueAmount: sanitizeNumber(details.firstDueAmount),
    secondDueAmount: sanitizeNumber(details.secondDueAmount),
    totalBuildingExpenses: sanitizeNumber(details.totalBuildingExpenses),
    totalToPayUnit: sanitizeNumber(details.totalToPayUnit),
    rubros: sanitizeHoaRubros(details.rubros),
  };
}

export function sanitizeBillingResult(value: unknown): BillingParseResult {
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    text: sanitizeString(data.text),
    providerId: sanitizeString(data.providerId),
    providerNameDetected: sanitizeString(data.providerNameDetected),
    category: sanitizeString(data.category),
    totalAmount: sanitizeNumber(data.totalAmount),
    currency: sanitizeString(data.currency),
    issueDate: sanitizeString(data.issueDate),
    dueDate: sanitizeString(data.dueDate),
    periodStart: sanitizeString(data.periodStart),
    periodEnd: sanitizeString(data.periodEnd),
    hoaDetails: sanitizeHoaDetails(data.hoaDetails),
    foreignAmountUSD: sanitizeNumber(data.foreignAmountUSD) ?? null,
  };
}

function isMessageOutput(
  item: OpenAIMessageOutput | OpenAITextOutput
): item is OpenAIMessageOutput {
  return item.type === "message";
}

function isTextOutput(
  item: OpenAIMessageOutput | OpenAITextOutput
): item is OpenAITextOutput & { text: string } {
  return (
    "text" in item &&
    typeof item.text === "string" &&
    item.text.trim().length > 0
  );
}

export function extractJsonFromResponse(response: OpenAIResponse): string {
  if (response.output_text && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item) continue;
      if (isMessageOutput(item) && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content?.text) {
            return content.text;
          }
        }
      }
      if (isTextOutput(item)) {
        return item.text.trim();
      }
    }
  }

  throw new Error("No JSON text found in OpenAI response");
}

function toLines(fullText: string): string[] {
  return fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function extractRelevantText(fullText: string): string {
  const lines = toLines(fullText);
  const firstLines = lines.slice(0, 60);
  const lastLines = lines.slice(-40);
  const moneyLines = lines.filter((line) =>
    /(\$|TOTAL|Total|Importe|Vencim|VENCIM|Periodo|Período)/i.test(line)
  );
  const uniqueMoneyLines = Array.from(new Set(moneyLines));
  const combined = [
    "=== FIRST LINES ===",
    ...firstLines,
    "=== MONEY LINES ===",
    ...uniqueMoneyLines,
    "=== LAST LINES ===",
    ...lastLines,
  ].join("\n");

  const MAX_CHARS = 8000;
  return combined.slice(0, MAX_CHARS);
}

async function loadPdfParse() {
  const module = await import("pdf-parse");
  const pdfParse =
    (module as { default?: (buffer: Buffer) => Promise<{ text?: string }> })
      .default ?? module;
  if (typeof pdfParse !== "function") {
    throw new Error("Invalid pdf-parse module");
  }
  return pdfParse as (buffer: Buffer) => Promise<{ text?: string }>;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function loadPdf2Json(): Promise<Pdf2JsonConstructor> {
  if (cachedPdf2Json) {
    return cachedPdf2Json;
  }
  const module = (await import("pdf2json")) as {
    default?: Pdf2JsonConstructor;
    PDFParser?: Pdf2JsonConstructor;
  };
  const ParserClass =
    module?.default ??
    module?.PDFParser ??
    (module as unknown as Pdf2JsonConstructor);
  if (typeof ParserClass !== "function") {
    throw new Error("Invalid pdf2json module");
  }
  cachedPdf2Json = ParserClass;
  return cachedPdf2Json;
}

function decodePdf2JsonText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function extractTextWithPdf2Json(pdfBuffer: Buffer): Promise<string> {
  const PDFParser = await loadPdf2Json();
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    const cleanup = () => {
      if (typeof parser.removeAllListeners === "function") {
        parser.removeAllListeners();
      }
    };
    parser.on("pdfParser_dataError", (error: { parserError?: unknown }) => {
      cleanup();
      reject(error?.parserError ?? error);
    });
    parser.on("pdfParser_dataReady", (data: Pdf2JsonDocument) => {
      cleanup();
      const pages = Array.isArray(data?.Pages) ? data.Pages : [];
      const textChunks = pages
        .map((page) => {
          const texts = Array.isArray(page?.Texts) ? page.Texts : [];
          const line = texts
            .map((text) => {
              const runs = Array.isArray(text?.R) ? text.R : [];
              return runs.map((run) => decodePdf2JsonText(run?.T)).join("");
            })
            .join(" ");
          return normalizeWhitespace(line);
        })
        .filter((chunk) => chunk.length > 0);
      resolve(textChunks.join("\n"));
    });
    parser.parseBuffer(pdfBuffer);
  });
}

export async function extractPdfText(
  pdfBuffer: Buffer,
  log: Logger
): Promise<string> {
  try {
    const text = await extractTextWithPdf2Json(pdfBuffer);
    if (text.trim().length > 0) {
      return text;
    }
    log.warn("pdf2json extracted empty text, falling back to pdf-parse");
  } catch (error) {
    log.warn("pdf2json text extraction failed, falling back to pdf-parse", {
      error,
    });
  }
  const pdfParse = await loadPdfParse();
  const pdfData = await pdfParse(pdfBuffer);
  return typeof pdfData?.text === "string" ? pdfData.text : "";
}

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function isGemini5xxError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Gemini request failed with 5\d\d/i.test(error.message)
  );
}

async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  log: Logger,
  delays = [2000, 4000]
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isGemini5xxError(error) || attempt === delays.length) {
        throw error;
      }
      log.warn("Gemini 5xx error, retrying", {
        attempt: attempt + 1,
        delayMs: delays[attempt],
        error,
      });
      await wait(delays[attempt]);
    }
  }
  throw lastError ?? new Error("Gemini request failed");
}

async function callOpenAIWithRetry(
  requestFactory: () => Promise<OpenAIResponse>,
  log: Logger,
  options: RetryOptions = {}
): Promise<{ response: OpenAIResponse; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    const attemptStart = Date.now();
    try {
      const response = await requestFactory();
      return { response, attempts: attempt };
    } catch (error) {
      lastError = error;
      const durationMs = Date.now() - attemptStart;
      // Don't retry quota/auth errors — they won't resolve on retry
      const isNonRetryable =
        error instanceof Error &&
        /403|429|insufficient_quota|invalid_api_key|billing|model_not_found/i.test(
          error.message
        );
      if (attempt >= maxAttempts || isNonRetryable) {
        log.error("OpenAI request failed after retries", {
          attempts: attempt,
          durationMs,
          error,
        });
        throw error;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      log.warn("OpenAI request attempt failed", {
        attempt,
        durationMs,
        delayMs,
        error,
      });
      await wait(delayMs);
    }
  }

  throw lastError ?? new Error("OpenAI request failed");
}

export async function parseBillingTextWithOpenAI(
  fullText: string,
  scopedLogger: Logger = baseLogger,
  options: { model?: string } = {}
): Promise<BillingParseResult> {
  const log = scopedLogger;
  const trimmedText = fullText?.trim();
  if (!trimmedText) {
    throw new Error("Cannot parse empty text extract");
  }

  const parseStart = Date.now();
  try {
    const relevantText = extractRelevantText(fullText);
    const client = getOpenAIClient();
    const openAiStart = Date.now();

    const { response, attempts } = await callOpenAIWithRetry(
      () =>
        client.responses.create({
          model: options.model ?? "gpt-5-mini",
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: OPENAI_SYSTEM_PROMPT,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `${OPENAI_USER_PROMPT}\n\n${relevantText}`,
                },
              ],
            },
          ],
          text: {
            format: BILL_PARSER_SCHEMA,
          },
        }),
      log
    );

    const openAiDuration = Date.now() - openAiStart;
    log.debug("OpenAI responses.create completed", {
      durationMs: Number(openAiDuration.toFixed(2)),
      attempts,
    });

    let parsedPayload: unknown;
    try {
      const jsonText = extractJsonFromResponse(response);
      parsedPayload = JSON.parse(jsonText);
    } catch (error) {
      log.error("Failed to parse OpenAI response payload", { error });
      throw new Error("Failed to parse OpenAI response");
    }

    let validated: z.infer<typeof BillingParseResultSchema>;
    try {
      validated = BillingParseResultSchema.parse(parsedPayload);
    } catch (error) {
      log.error("OpenAI response validation failed", { error });
      throw error;
    }
    const sanitized = sanitizeBillingResult(validated);
    return {
      ...sanitized,
      text: sanitized.text ?? (fullText.length > 0 ? fullText : null),
    };
  } finally {
    const durationMs = Date.now() - parseStart;
    log.debug("parseBillingTextWithOpenAI completed", {
      durationMs: Number(durationMs.toFixed(2)),
    });
  }
}

export async function parsePdfWithOpenAI(
  pdfBuffer: Buffer,
  scopedLogger: Logger = baseLogger
): Promise<BillingParseResult> {
  const log = scopedLogger;
  const parseStart = Date.now();
  try {
    const fullText = await extractPdfText(pdfBuffer, log);
    return await parseBillingTextWithOpenAI(fullText, log);
  } finally {
    const durationMs = Date.now() - parseStart;
    log.debug("parsePdfWithOpenAI completed", {
      durationMs: Number(durationMs.toFixed(2)),
    });
  }
}

export async function parseBillingImageWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string,
  scopedLogger: Logger = baseLogger,
  options: { model?: string } = {}
): Promise<BillingParseResult> {
  const log = scopedLogger;
  const parseStart = Date.now();
  try {
    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const client = getOpenAIClient();
    const openAiStart = Date.now();

    const { response, attempts } = await callOpenAIWithRetry(
      () =>
        client.responses.create({
          model: options.model ?? process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: OPENAI_SYSTEM_PROMPT }],
            },
            {
              role: "user",
              content: [
                { type: "input_image", image_url: dataUrl },
                { type: "input_text", text: OPENAI_USER_PROMPT },
              ],
            },
          ],
          text: { format: BILL_PARSER_SCHEMA },
        }),
      log
    );

    const openAiDuration = Date.now() - openAiStart;
    log.debug("OpenAI vision completed", {
      durationMs: Number(openAiDuration.toFixed(2)),
      attempts,
    });

    let parsedPayload: unknown;
    try {
      const jsonText = extractJsonFromResponse(response);
      parsedPayload = JSON.parse(jsonText);
    } catch (error) {
      log.error("Failed to parse OpenAI vision response payload", { error });
      throw new Error("Failed to parse OpenAI vision response");
    }

    let validated: z.infer<typeof BillingParseResultSchema>;
    try {
      validated = BillingParseResultSchema.parse(parsedPayload);
    } catch (error) {
      log.error("OpenAI vision response validation failed", { error });
      throw error;
    }
    const sanitized = sanitizeBillingResult(validated);
    return {
      ...sanitized,
      text: sanitized.text ?? "[parsed from image]",
    };
  } finally {
    const durationMs = Date.now() - parseStart;
    log.debug("parseBillingImageWithOpenAI completed", {
      durationMs: Number(durationMs.toFixed(2)),
    });
  }
}
