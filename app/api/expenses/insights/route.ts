import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  buildInsightsContext,
  formatInitialInsightsResponse,
  type InitialInsightsModelOutput,
  type InsightBill,
  type InsightExpenseEntry,
  type InsightHoaSummary,
  type InsightIncomeEntry,
} from "./insights-helpers";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InsightsRequestBody {
  entries: InsightExpenseEntry[];
  incomeEntries?: InsightIncomeEntry[];
  monthLabel: string;
  monthFilter: string;
  analysisMonthFilter?: string;
  analysisMonthLabel?: string;
  messages?: Message[];
}

type JsonSchema = {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
  };
};

type ResponsesCreateArgs = {
  model: string;
  input: Array<{
    role: string;
    content: Array<{ type: string; text: string }>;
  }>;
  text: {
    format: JsonSchema;
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

const MODELS = ["gpt-4.1-nano", "gpt-5-mini"];

const InitialInsightsResponseSchema = z.object({
  summary: z.string().min(1),
  fixedObservation: z.string().min(1),
  adjustableObservation: z.string().min(1),
  actions: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  caveat: z.string().min(1).nullable(),
});

const INITIAL_INSIGHTS_SCHEMA_BODY = {
  name: "expense_insights_initial",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      fixedObservation: { type: "string" },
      adjustableObservation: { type: "string" },
      actions: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
      caveat: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
    required: [
      "summary",
      "fixedObservation",
      "adjustableObservation",
      "actions",
      "caveat",
    ],
  },
} satisfies {
  name: string;
  schema: Record<string, unknown>;
};

const INITIAL_INSIGHTS_SCHEMA: JsonSchema = {
  type: "json_schema",
  name: INITIAL_INSIGHTS_SCHEMA_BODY.name,
  schema: INITIAL_INSIGHTS_SCHEMA_BODY.schema,
  json_schema: INITIAL_INSIGHTS_SCHEMA_BODY,
};

class OpenAIClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string
  ) {}

  responses = {
    create: async (body: ResponsesCreateArgs) => {
      const response = await fetch(`${this.baseUrl}/responses`, {
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

function getOpenAIBaseUrl(): string {
  return process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ?? "https://api.openai.com/v1";
}

function getOpenAIClient(): OpenAIClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAIClient(apiKey, getOpenAIBaseUrl());
}

function extractJsonFromResponse(response: OpenAIResponse): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    if (item.type === "message") {
      for (const content of "content" in item ? item.content ?? [] : []) {
        if (content.type === "output_text" && typeof content.text === "string") {
          return content.text.trim();
        }
      }
    }

    if ("text" in item && typeof item.text === "string" && item.text.trim()) {
      return item.text.trim();
    }
  }

  throw new Error("No JSON text found in OpenAI response");
}

function toDateString(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in (value as Record<string, unknown>) &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return ((value as { toDate: () => Date }).toDate() as Date).toISOString();
    } catch {
      return "";
    }
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function formatPromptContext(
  context: ReturnType<typeof buildInsightsContext>
): string {
  return JSON.stringify(
    {
      periodo: {
        etiqueta: context.analysisPeriod.monthLabel,
        mes: context.analysisPeriod.monthFilter,
        fallbackMesActual: context.analysisPeriod.usesCurrentMonthFallback,
      },
      totales: {
        ingresos: Math.round(context.totals.income),
        gastosDiarios: Math.round(context.totals.dailyExpenses),
        facturas: Math.round(context.totals.bills),
        expensas: Math.round(context.totals.hoa),
        gastosFijos: Math.round(context.totals.fixedExpenses),
        gastosAjustables: Math.round(context.totals.adjustableExpenses),
        gastoTotal: Math.round(context.totals.totalExpenses),
        promedioDiario: Math.round(context.totals.dailyAverage),
        balance:
          context.totals.balance != null ? Math.round(context.totals.balance) : null,
        ahorro:
          context.totals.savingsRate != null ? context.totals.savingsRate : null,
      },
      ingresos: context.incomeItems.map((item) => ({
        label: item.label,
        amount: Math.round(item.amount),
      })),
      gastosFijos: context.fixedItems.map((item) => ({
        label: item.label,
        amount: Math.round(item.amount),
      })),
      gastosAjustables: context.adjustableItems.map((item) => ({
        label: item.label,
        amount: Math.round(item.amount),
      })),
      banderas: {
        hayResumenTarjeta: context.hasCreditCardBill,
        gastosUsdSinCotizacion: context.skippedUsdCount,
      },
    },
    null,
    2
  );
}

function isModelUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /403|404|model_not_found|not allowed|does not exist|permission/i.test(
    error.message
  );
}

async function generateInitialInsights(
  context: ReturnType<typeof buildInsightsContext>
): Promise<InitialInsightsModelOutput> {
  const client = getOpenAIClient();
  const systemPrompt = `Sos un asesor financiero personal. Respondé en español rioplatense y devolvé SOLO JSON válido según el schema.

Reglas:
- Analizá únicamente el período provisto.
- Tratá facturas, servicios, expensas y resúmenes de tarjeta como compromisos fijos del mes.
- No sugieras "ahorrar" directamente sobre esos gastos fijos salvo anomalía concreta.
- Enfocate en los gastos ajustables para las acciones concretas.
- No inventes montos, porcentajes, categorías ni comparaciones que no estén en el contexto.
- Si faltan ingresos o cotizaciones de USD, mencioná ese límite en caveat de forma breve.
- summary, fixedObservation y adjustableObservation deben ser breves, claras y sin markdown.`;

  const userPrompt = `Contexto del período:
${formatPromptContext(context)}`;

  let lastError: Error | null = null;
  for (const model of MODELS) {
    try {
      const response = await client.responses.create({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
        text: {
          format: INITIAL_INSIGHTS_SCHEMA,
        },
      });

      const jsonText = extractJsonFromResponse(response);
      return InitialInsightsResponseSchema.parse(JSON.parse(jsonText));
    } catch (error) {
      if (isModelUnavailable(error)) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("No available model found");
}

function buildFollowUpSystemPrompt(
  context: ReturnType<typeof buildInsightsContext>
): string {
  return `Sos un asesor financiero personal. Respondé en español rioplatense, breve y claro.

Contexto cerrado:
- Período analizado: ${context.analysisPeriod.monthLabel} (${context.analysisPeriod.monthFilter})
- Ingresos: ${context.totals.income}
- Gasto total real: ${context.totals.totalExpenses}
- Gastos fijos: ${context.totals.fixedExpenses}
- Gastos ajustables: ${context.totals.adjustableExpenses}
- Promedio diario: ${Math.round(context.totals.dailyAverage)}
- Balance: ${context.totals.balance ?? "sin datos"}
- Ahorro: ${
   context.totals.savingsRate != null ? `${context.totals.savingsRate}%` : "sin datos"
 }

Gastos fijos:
${context.fixedItems
  .map((item) => `- ${item.label}: ${Math.round(item.amount)}`)
  .join("\n") || "- Sin gastos fijos"}

Gastos ajustables:
${context.adjustableItems
  .map((item) => `- ${item.label}: ${Math.round(item.amount)}`)
  .join("\n") || "- Sin gastos ajustables"}

Reglas:
- Respondé solo con datos de este período.
- Si el usuario pregunta algo fuera de este período o fuera de estos datos, decilo explícitamente.
- No inventes montos, porcentajes ni categorías.
- No sugieras ahorrar sobre servicios, expensas o resúmenes de tarjeta como si fueran opcionales.`;
}

async function createFollowUpStream(messages: Message[], systemPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  let openaiRes: Response | null = null;
  for (const model of MODELS) {
    const res = await fetch(`${getOpenAIBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (res.ok) {
      openaiRes = res;
      break;
    }

    const errorText = await res.text();
    if (
      res.status === 404 ||
      res.status === 403 ||
      /model_not_found|not allowed|does not exist|permission/i.test(errorText)
    ) {
      console.warn(`Model ${model} not available for follow-up, trying next...`);
      continue;
    }

    console.error("OpenAI API error:", errorText);
    throw new Error("Failed to get insights from AI");
  }

  if (!openaiRes) {
    throw new Error("No available model found");
  }

  return new ReadableStream({
    async start(controller) {
      const reader = openaiRes.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) {
                controller.enqueue(new TextEncoder().encode(text));
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const body = (await request.json()) as InsightsRequestBody;
    const messages = body.messages ?? [];

    const db = getAdminFirestore();

    const billsSnap = await db
      .collection("documents")
      .where("userId", "==", uid)
      .get();
    const bills: InsightBill[] = billsSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        providerName: String(
          data.providerNameDetected ?? data.provider ?? data.fileName ?? "Factura"
        ),
        totalAmount:
          typeof data.totalAmount === "number" ? data.totalAmount : 0,
        category: typeof data.category === "string" ? data.category : null,
        dueDate: toDateString(data.dueDate),
        issueDate: toDateString(data.issueDate),
        periodStart: toDateString(data.periodStart),
      };
    });

    const hoaSnap = await db
      .collection("hoaSummaries")
      .where("userId", "==", uid)
      .get();
    const hoaSummaries: InsightHoaSummary[] = hoaSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        periodKey: typeof data.periodKey === "string" ? data.periodKey : undefined,
        periodLabel:
          typeof data.periodLabel === "string" ? data.periodLabel : undefined,
        totalToPayUnit:
          typeof data.totalToPayUnit === "number" ? data.totalToPayUnit : 0,
      };
    });

    const context = buildInsightsContext({
      entries: body.entries,
      incomeEntries: body.incomeEntries ?? [],
      bills,
      hoaSummaries,
      monthFilter: body.monthFilter,
      analysisMonthFilter: body.analysisMonthFilter,
      analysisMonthLabel: body.analysisMonthLabel,
    });

    if (messages.length === 0) {
      const modelOutput = await generateInitialInsights(context);
      const responseText = formatInitialInsightsResponse(context, modelOutput);

      return new Response(responseText, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    const stream = await createFollowUpStream(
      messages,
      buildFollowUpSystemPrompt(context)
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Insights route error:", error);
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      { error: "No se pudo generar el análisis" },
      { status: 500 }
    );
  }
}
