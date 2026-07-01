import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { getAdminStorage } from "@/lib/firebase-admin"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"
import { createRequestLogger } from "@/lib/server/logger"
import { maybeEnqueueMalwareScan } from "@/lib/server/malware-scanner"
import {
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
  describeAllowedFileTypes,
  formatMaxUploadSize,
  validateUploadConstraints,
} from "@/lib/upload-constraints"

export const runtime = "nodejs"

type StructuredErrorCode =
  | "FILE_REQUIRED"
  | "FILENAME_REQUIRED"
  | "VALIDATION_FAILED"
  | "AUTH_REQUIRED"
  | "UNKNOWN"

function buildErrorResponse(
  code: StructuredErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ?? {}),
      },
    },
    { status },
  )
}

export async function POST(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "POST /api/upload" },
  })
  let log = baseLogger
  try {
    const { uid } = await authenticateRequest(request)
    log = log.withContext({ userId: uid })

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return buildErrorResponse("FILE_REQUIRED", "Tenés que seleccionar un archivo.", 400)
    }

    const rawFileName = formData.get("fileName")
    if (typeof rawFileName !== "string" || !rawFileName.trim()) {
      return buildErrorResponse("FILENAME_REQUIRED", "El nombre original del archivo es obligatorio.", 400)
    }

    const userId = uid
    const originalName = rawFileName.trim()

    const validation = validateUploadConstraints({
      size: file.size,
      type: file.type,
      name: originalName || file.name,
    })
    if (!validation.ok) {
      return buildErrorResponse("VALIDATION_FAILED", validation.message, 400, validation.details)
    }
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `bills/${userId}/${Date.now()}_${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const checksum = createHash("sha256").update(buffer).digest("hex")
    const uploadedAtIso = new Date().toISOString()
    const resumable = file.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES
    const bucket = getAdminStorage().bucket()
    await bucket.file(filePath).save(buffer, {
      contentType: file.type || "application/octet-stream",
      resumable,
      metadata: {
        metadata: {
          userId,
          originalName,
          checksumSha256: checksum,
          uploadedAtIso,
          uploadedAtEpochMs: String(Date.now()),
          fileSizeBytes: String(file.size),
        },
      },
    })

    const storageUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`

    void maybeEnqueueMalwareScan(
      {
        bucketName: bucket.name,
        filePath,
        checksumSha256: checksum,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
      log,
    )

    return NextResponse.json({
      storageUrl,
      filePath,
      checksum,
      size: file.size,
      upload: {
        resumable,
        maxSize: formatMaxUploadSize(),
        allowedTypes: describeAllowedFileTypes(),
      },
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    log.error("Server upload error", { error })
    return buildErrorResponse("UNKNOWN", "No se pudo cargar el archivo", 500)
  }
}
