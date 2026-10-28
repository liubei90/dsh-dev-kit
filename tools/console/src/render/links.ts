/**
 * URL construction for console pages. Every link goes through the reserved
 * `/_console` prefix and encodes its query values.
 */

import { CONSOLE_BASE_PATH } from '../config.js'

/**
 * Build one console URL.
 * @param path - path below the console prefix, starting with `/` or empty.
 * @param params - query pairs; undefined values are omitted.
 * @returns a relative URL safe to place in `href` or a form action.
 */
export function consoleHref(
  path: string,
  params: ReadonlyArray<readonly [string, string | undefined]> = [],
): string {
  const query = new URLSearchParams()
  for (const [key, value] of params) {
    if (value !== undefined && value !== '') query.set(key, value)
  }
  const search = query.toString()
  return search === '' ? `${CONSOLE_BASE_PATH}${path}` : `${CONSOLE_BASE_PATH}${path}?${search}`
}
