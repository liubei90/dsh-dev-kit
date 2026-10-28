/**
 * HTML escaping and the plain-text rendering used by note bodies. Every value
 * that originates in a repository file passes through `escapeHtml` before it
 * reaches a response; note bodies are rendered as text, never parsed as HTML.
 */

/** Escape the characters that can change HTML structure. */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escape one value for HTML text and attribute contexts.
 * @param value - untrusted text.
 * @returns the escaped text.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, character => HTML_ESCAPES[character] ?? character)
}

const TABLE_SEPARATOR = /^:?-{2,}:?$/u

const INLINE_LINK = /\[([^\]]+)\]\([^)]+\)/gu

/**
 * Strip the Markdown markers the plain-text view cannot render.
 * @param body - one note section body.
 * @returns display text with emphasis, code ticks, links, and list markers removed.
 */
export function toDisplayText(body: string): string {
  const lines = body.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) return line
    const cells = trimmed.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
    if (cells.every(cell => TABLE_SEPARATOR.test(cell))) return ''
    return cells.join(' · ')
  })

  return lines
    .join('\n')
    .replace(INLINE_LINK, '$1')
    .replace(/\*\*/gu, '')
    .replace(/`/gu, '')
    .replace(/^(\s*)[-*] /gmu, '$1')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

/**
 * Truncate one label for a fixed-size node or table cell.
 * @param value - full label.
 * @param length - maximum characters kept.
 * @returns the label, with an ellipsis when shortened.
 */
export function truncateLabel(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}
