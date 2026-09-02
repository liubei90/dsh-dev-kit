// Shared types and utilities used by both apps.
export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
