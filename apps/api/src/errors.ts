// Error vocabulary for the API: ApiError carries an HTTP status and a stable
// wire code, and ok() wraps successful payloads in the shared ApiEnvelope.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data }
}
