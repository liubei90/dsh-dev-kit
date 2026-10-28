import { describe, expect, it } from 'vitest'
import { escapeHtml, toDisplayText, truncateLabel } from '../src/escape.js'

describe('escapeHtml', () => {
  it('escapes text and attribute characters', () => {
    expect(escapeHtml('<script>".*"</script>')).toBe('&lt;script&gt;&quot;.*&quot;&lt;/script&gt;')
    expect(escapeHtml("a & b 'c'")).toBe('a &amp; b &#39;c&#39;')
  })
})

describe('toDisplayText', () => {
  it('removes inline links, emphasis, code ticks, and list markers', () => {
    expect(toDisplayText('决定见 [架构](docs/a.md)，**重要**，`code`\n\n- 一项')).toBe('决定见 架构，重要，code\n\n一项')
  })

  it('turns table rows into plain cells', () => {
    expect(toDisplayText('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('a · b\n\n1 · 2')
  })
})

describe('truncateLabel', () => {
  it('keeps short labels and shortens long ones with an ellipsis', () => {
    expect(truncateLabel('短标题', 10)).toBe('短标题')
    expect(truncateLabel('1234567890abcdef', 10)).toBe('123456789…')
  })
})
