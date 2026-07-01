import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"
import type { DecodedIdToken } from "firebase-admin/auth"

import { getAdminAuth } from "@/lib/firebase-admin"

export type AuthenticatedRequestContext = {
  uid: string
  email: string | null
  claims: DecodedIdToken
}

export type ClaimRequirement =
  | string
  | {
      key: string
      value?: unknown
      message?: string
    }

export type AuthenticateRequestOptions = {
  requireClaims?: ClaimRequirement[]
}

export class AuthError extends Error {
  readonly statusCode: number
  readonly code: "unauthorized" | "forbidden"
  readonly details?: Record<string, unknown>

  constructor(
    statusCode: 401 | 403,
    code: "unauthorized" | "forbidden",
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

const requestCache = new WeakMap<NextRequest, Promise<AuthenticatedRequestContext>>()

export async function authenticateRequest(
  request: NextRequest,
  options: AuthenticateRequestOptions = {},
): Promise<AuthenticatedRequestContext> {
  let cached = requestCache.get(request)

  if (!cached) {
    cached = verifyRequestAuthorization(request).catch((error) => {
      requestCache.delete(request)
      throw error
    })
    requestCache.set(request, cached)
  }

  const context = await cached

  if (options.requireClaims?.length) {
    ensureRequiredClaims(context, options.requireClaims)
  }

  return context
}

export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    const body: Record<string, unknown> = {
      error: error.code,
      message: error.message,
    }
    if (error.details) {
      body.details = error.details
    }
    return NextResponse.json(body, { status: error.statusCode })
  }
  return null
}

async function verifyRequestAuthorization(
  request: NextRequest,
): Promise<AuthenticatedRequestContext> {
  const rawHeader = request.headers.get("authorization") ?? ""
  const token = extractBearerToken(rawHeader)
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      claims: decoded,
    }
  } catch (error) {
    throw new AuthError(401, "unauthorized", "La sesión no es válida o venció", {
      cause: error instanceof Error ? error.message : "unknown",
    })
  }
}

function extractBearerToken(header: string) {
  const match = /^\s*Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    throw new AuthError(401, "unauthorized", "Falta una autorización válida")
  }
  const token = match[1]?.trim()
  if (!token) {
    throw new AuthError(401, "unauthorized", "Authorization token is empty")
  }
  return token
}

function ensureRequiredClaims(
  context: AuthenticatedRequestContext,
  requirements: ClaimRequirement[],
) {
  for (const requirement of requirements) {
    const { key, value, message } =
      typeof requirement === "string"
        ? { key: requirement, value: undefined, message: undefined }
        : requirement

    const claimValue = (context.claims as Record<string, unknown>)[key]
    const hasClaimValue = claimValue !== undefined && claimValue !== null

    if (value === undefined) {
      if (!hasClaimValue || claimValue === false) {
        throw new AuthError(403, "forbidden", message ?? `Missing required claim: ${key}`, {
          claim: key,
        })
      }
      continue
    }

    if (claimValue !== value) {
      throw new AuthError(403, "forbidden", message ?? `Claim ${key} must equal ${value}`, {
        claim: key,
        expected: value,
      })
    }
  }
}
