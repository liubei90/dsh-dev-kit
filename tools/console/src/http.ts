/**
 * HTTP response helpers shared by every console route: the JSON envelope,
 * common security headers, and HTML/JSON/redirect writers.
 */

import type { ServerResponse } from 'node:http'

/** Success or failure envelope for the console's JSON API. */
export type ConsoleEnvelope<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/**
 * Wrap one JSON payload in the success envelope.
 * @param data - serializable payload.
 * @returns the success envelope.
 */
export function ok<T>(data: T): ConsoleEnvelope<T> {
  return { ok: true, data }
}

/**
 * Wrap one failure in the error envelope.
 * @param code - stable error code.
 * @param message - operator-facing message.
 * @returns the failure envelope.
 */
export function fail(code: string, message: string): ConsoleEnvelope<never> {
  return { ok: false, error: { code, message } }
}

/** Headers every response carries. */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
}

/**
 * Send one response body with the console's security headers.
 * @param response - response to write.
 * @param status - HTTP status.
 * @param body - encoded body.
 * @param contentType - response media type.
 * @param extraHeaders - headers merged after the security defaults.
 */
function send(
  response: ServerResponse,
  status: number,
  body: string,
  contentType: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Content-Length': String(Buffer.byteLength(body, 'utf8')),
    ...extraHeaders,
  })
  response.end(body)
}

/**
 * Send an HTML response.
 * @param response - response to write.
 * @param status - HTTP status.
 * @param html - complete document.
 */
export function sendHtml(response: ServerResponse, status: number, html: string): void {
  send(response, status, html, 'text/html; charset=utf-8')
}

/**
 * Send a JSON envelope response.
 * @param response - response to write.
 * @param status - HTTP status.
 * @param payload - envelope to serialize.
 * @param extraHeaders - headers merged after the defaults.
 */
export function sendJson<T>(
  response: ServerResponse,
  status: number,
  payload: ConsoleEnvelope<T>,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  send(response, status, JSON.stringify(payload), 'application/json; charset=utf-8', extraHeaders)
}

/**
 * Send a redirect.
 * @param response - response to write.
 * @param location - absolute path on this server.
 */
export function sendRedirect(response: ServerResponse, location: string): void {
  send(response, 303, '', 'text/plain; charset=utf-8', { Location: location })
}

/**
 * Send one static asset.
 * @param response - response to write.
 * @param status - HTTP status.
 * @param body - file contents.
 * @param contentType - asset media type.
 */
export function sendAsset(response: ServerResponse, status: number, body: string, contentType: string): void {
  send(response, status, body, contentType)
}
