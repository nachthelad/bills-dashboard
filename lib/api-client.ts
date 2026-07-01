"use client"

import { z } from "zod"

import type { BillDocument } from "@/lib/firestore-helpers"
import {
  listDocumentsResponseSchema,
  createDocumentRequestSchema,
  createDocumentResponseSchema,
  parseDocumentRequestSchema,
  parseDocumentResponseSchema,
  dashboardSummarySchema,
  dashboardSummaryResponseSchema,
  saveDashboardSummaryResponseSchema,
  uploadResponseSchema,
  type ApiBillDocument,
  type CreateDocumentPayload,
  type DashboardSummaryPayload,
} from "./api-schemas"

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message)
    this.name = "ApiError"
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

export type DashboardSummary = DashboardSummaryPayload
export type CreateDocumentInput = CreateDocumentPayload

export type ApiClient = ReturnType<typeof createApiClient>

type ApiClientOptions = {
  getToken: () => Promise<string | null>
  baseUrl?: string
  retries?: number
  retryDelayMs?: number
}

type RequestOptions<T> = RequestInit & { schema: z.ZodType<T> }

export function createApiClient(options: ApiClientOptions) {
  const { getToken, baseUrl, retries = 2, retryDelayMs = 400 } = options

  const request = async <T>(path: string, init: RequestOptions<T>): Promise<T> => {
    const url = baseUrl ? new URL(path, baseUrl).toString() : path
    const { schema, ...fetchInit } = init
    let attempt = 0
    while (true) {
      try {
        const token = await getToken()
        if (!token) {
          throw new ApiError("Necesitás iniciar sesión", { status: 401 })
        }

        const headers = new Headers(fetchInit.headers)
        headers.set("Authorization", `Bearer ${token}`)
        if (!(fetchInit.body instanceof FormData)) {
          headers.set("Accept", "application/json")
        }

        const response = await fetch(url, {
          ...fetchInit,
          headers,
        })

        const parsedBody = await parseResponseBody(response)

        if (!response.ok) {
          throw toApiError(response.status, parsedBody)
        }

        return schema.parse(parsedBody)
      } catch (error) {
        const shouldRetry =
          error instanceof ApiError
            ? RETRYABLE_STATUSES.has(error.status)
            : error instanceof TypeError
        if (shouldRetry && attempt < retries) {
          await delay(retryDelayMs * (attempt + 1))
          attempt += 1
          continue
        }
        throw error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  return {
    async listDocuments(): Promise<BillDocument[]> {
      const payload = await request("/api/documents", {
        method: "GET",
        schema: listDocumentsResponseSchema,
      })
      return payload.documents.map(convertDocument)
    },
    async createDocument(input: CreateDocumentInput): Promise<string> {
      const body = createDocumentRequestSchema.parse(input)
      const payload = await request("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        schema: createDocumentResponseSchema,
      })
      return payload.documentId
    },
    async triggerParse(documentId: string): Promise<void> {
      const body = parseDocumentRequestSchema.parse({ documentId })
      await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        schema: parseDocumentResponseSchema,
      })
    },
    async fetchDashboardSummary(): Promise<DashboardSummary | null> {
      const payload = await request("/api/dashboard-summary", {
        method: "GET",
        schema: dashboardSummaryResponseSchema,
      })
      return payload.summary
    },
    async saveDashboardSummary(summary: DashboardSummary): Promise<void> {
      const body = dashboardSummarySchema.parse(summary)
      await request("/api/dashboard-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        schema: saveDashboardSummaryResponseSchema,
      })
    },
    async uploadFile(file: File, fileName = file.name): Promise<string> {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("fileName", fileName)
      const payload = await request("/api/upload", {
        method: "POST",
        body: formData,
        schema: uploadResponseSchema,
      })
      return payload.storageUrl
    },
  }
}

async function parseResponseBody(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toApiError(status: number, body: unknown) {
  let message = `La solicitud falló con el estado ${status}`
  let code: string | undefined
  if (body && typeof body === "object") {
    if (typeof (body as any).error === "string") {
      message = (body as any).error
    } else if (
      (body as any).error &&
      typeof (body as any).error === "object"
    ) {
      const errorObject = (body as { error?: { message?: string; code?: string } }).error
      if (errorObject?.message) {
        message = errorObject.message
      }
      if (errorObject?.code) {
        code = errorObject.code
      }
    }
  }
  return new ApiError(message, { status, code, details: body })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function convertDocument(doc: ApiBillDocument): BillDocument {
  return {
    id: doc.id,
    userId: doc.userId ?? "",
    fileName: doc.fileName,
    storageUrl: doc.storageUrl ?? null,
    pdfUrl: doc.pdfUrl ?? undefined,
    uploadedAt: normalizeDate(doc.uploadedAt),
    provider: doc.provider ?? null,
    providerId: doc.providerId ?? null,
    providerNameDetected: doc.providerNameDetected ?? null,
    category: doc.category ?? null,
    amount: doc.amount ?? null,
    totalAmount: doc.totalAmount ?? null,
    currency: doc.currency ?? null,
    dueDate: doc.dueDate ?? null,
    issueDate: doc.issueDate ?? null,
    periodStart: doc.periodStart ?? null,
    periodEnd: doc.periodEnd ?? null,
    status: doc.status,
    textExtract: doc.textExtract ?? null,
    errorMessage: doc.errorMessage ?? null,
    lastParsedAt: doc.lastParsedAt ? normalizeDate(doc.lastParsedAt) : null,
    hoaDetails: doc.hoaDetails ?? null,
    manualEntry: doc.manualEntry ?? false,
    updatedAt: doc.updatedAt ? normalizeDate(doc.updatedAt) : null,
  }
}

function normalizeDate(value?: string | null): Date {
  if (!value) return new Date()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}
