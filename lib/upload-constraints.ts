const BYTES_PER_MB = 1024 * 1024

export const MAX_UPLOAD_BYTES = 10 * BYTES_PER_MB
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 5 * BYTES_PER_MB

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/tiff",
]

export const ALLOWED_FILE_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".heif",
  ".webp",
  ".tif",
  ".tiff",
]

export type UploadValidationErrorCode = "FILE_EMPTY" | "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE"

export type UploadValidationResult =
  | { ok: true }
  | {
      ok: false
      code: UploadValidationErrorCode
      message: string
      details?: Record<string, unknown>
    }

export function describeAllowedFileTypes() {
  return "Archivos PDF o imágenes (PNG, JPG, HEIC, WebP, TIFF)"
}

export function formatMaxUploadSize() {
  const value = MAX_UPLOAD_BYTES / BYTES_PER_MB
  return value % 1 === 0 ? `${value} MB` : `${value.toFixed(1)} MB`
}

export function humanReadableFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) {
    return "0 B"
  }
  if (bytes === 0) {
    return "0 B"
  }
  const units = ["B", "KB", "MB", "GB", "TB"] as const
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export function isMimeTypeAllowed(type?: string | null, fileName?: string | null) {
  if (type && ALLOWED_MIME_TYPES.includes(type)) {
    return true
  }
  if (fileName) {
    const normalized = fileName.toLowerCase()
    return ALLOWED_FILE_EXTENSIONS.some((ext) => normalized.endsWith(ext))
  }
  return false
}

export function validateUploadConstraints(input: { size: number; type?: string | null; name?: string | null }): UploadValidationResult {
  if (!input.size || input.size <= 0) {
    return {
      ok: false,
      code: "FILE_EMPTY",
      message: "El archivo seleccionado está vacío.",
    }
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `El archivo debe pesar ${formatMaxUploadSize()} o menos.`,
      details: { limitBytes: MAX_UPLOAD_BYTES },
    }
  }
  if (!isMimeTypeAllowed(input.type, input.name)) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: `Solo se admiten ${describeAllowedFileTypes()}.`,
    }
  }
  return { ok: true }
}
