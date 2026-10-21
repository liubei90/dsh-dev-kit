/**
 * Source-discovery and fragment validation coverage for `verify-md-links`: a
 * `#fragment` onto a Markdown target — same-file anchors included — must name
 * a real heading slug or explicit `<a id>`, while non-Markdown fragments and
 * external targets stay out of scope.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { documentAnchors, findViolations, githubSlug, markdownLinkCache, markdownLinkSourcePaths } from './verify-md-links.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function layout(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'md-links-'))
  roots.push(root)
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), content)
  }
  return root
}

function violationsIn(root: string, rel: string): { url: string; reason: string }[] {
  return findViolations(join(root, rel), markdownLinkCache(), root).map(({ url, reason }) => ({ url, reason }))
}

describe('Markdown source discovery', () => {
  it('rejects broken links in docs and the root instructions', () => {
    const root = layout({
      'docs/README.md': '[removed page](removed.md)\n',
      'README.md': '[removed section](docs/removed.md)\n',
    })
    const sources = markdownLinkSourcePaths(root)
    const violations = sources.flatMap(file => findViolations(join(root, file), markdownLinkCache(), root))
    // Violation paths keep the host separator, so compare through a codepoint
    // order that does not depend on the locale's case collation.
    expect(violations.map(({ file, reason }) => ({ file, reason })).sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)))
      .toEqual([
        { file: join('README.md'), reason: 'target' },
        { file: join('docs', 'README.md'), reason: 'target' },
      ])
  })

  it('checks nested docs and skills while excluding frozen archived notes', () => {
    const root = layout({
      'docs/nested/probe.md': '[missing](missing.md)\n',
      '.agents/skills/prose-standard/SKILL.md': '[missing](../../missing.md)\n',
      '.agents/notes/archived/process/frozen.md': '[historical](missing.md)\n',
    })
    const sources = markdownLinkSourcePaths(root)
    const violations = sources.flatMap(file => findViolations(join(root, file), markdownLinkCache(), root))
    expect(violations.map(({ file }) => file).sort()).toEqual([
      join('.agents', 'skills', 'prose-standard', 'SKILL.md'),
      join('docs', 'nested', 'probe.md'),
    ])
  })

  it('still checks a link that points INTO an archived note', () => {
    const root = layout({
      '.agents/notes/README.md': '[frozen](archived/process/gone.md)\n',
      '.agents/notes/archived/process/gone.md': '# Gone\n',
    })
    const sources = markdownLinkSourcePaths(root)
    // Source discovery reports repository-relative slash paths on every host.
    expect(sources).toEqual(['.agents/notes/README.md'])
    const violations = sources.flatMap(file => findViolations(join(root, file), markdownLinkCache(), root))
    expect(violations).toEqual([])
  })
})

describe('documentAnchors', () => {
  it('slugs rendered heading text, suffixes repeats, and reads explicit <a id> anchors', () => {
    const anchors = documentAnchors([
      '# My Doc',
      '## Live `events` — mode!',
      '## Repeat',
      '## Repeat',
      '<a id="hand-anchor"></a>',
      '',
    ].join('\n'))
    expect(anchors).toEqual(new Set(['my-doc', 'live-events--mode', 'repeat', 'repeat-1', 'hand-anchor']))
    expect(githubSlug('Security and authority are non-goals')).toBe('security-and-authority-are-non-goals')
  })

  it('keeps underscores the way GitHub does', () => {
    expect(githubSlug('Showcase: web_fetch')).toBe('showcase-web_fetch')
    expect(documentAnchors('## Showcase: web_fetch\n')).toEqual(new Set(['showcase-web_fetch']))
  })

  it('slugs a CJK heading from its rendered text', () => {
    expect(githubSlug('写作规则')).toBe('写作规则')
    expect(documentAnchors('## 写作规则\n')).toEqual(new Set(['写作规则']))
  })

  it('slugs a heading containing a link from its rendered text', () => {
    expect(documentAnchors('## [Install](setup.md)\n')).toEqual(new Set(['install']))
  })

  it('bumps repeat suffixes past occupied slugs, matching GitHub', () => {
    const anchors = documentAnchors(['## Repeat', '## Repeat-1', '## Repeat', ''].join('\n'))
    expect(anchors).toEqual(new Set(['repeat', 'repeat-1', 'repeat-2']))
  })

  it('ignores <a id> inside code fences, inline code, and HTML comments', () => {
    const anchors = documentAnchors([
      '# Doc',
      '```md',
      '<a id="fenced"></a>',
      '```',
      'Inline `<a id="inline"></a>` sample.',
      '<!-- <a id="commented"></a> -->',
      '<a id="real"></a>',
      '',
    ].join('\n'))
    expect(anchors).toEqual(new Set(['doc', 'real']))
  })
})

describe('findViolations fragments', () => {
  it('accepts resolving same-file and cross-file fragments, non-md fragments, and externals', () => {
    const root = layout({
      'a.md': '# A\n\n## Deferred work\n\n[self](#deferred-work) [b](b.md#part-two) [code](x.ts#L10) [ext](https://x.example/#frag)\n',
      'b.md': '# B\n\n## Part two\n',
      'x.ts': 'export {}\n',
    })
    expect(violationsIn(root, 'a.md')).toEqual([])
  })

  it('rejects a same-file fragment that names no heading or <a id>', () => {
    const root = layout({ 'a.md': '# A\n\n[gone](#deferred-work)\n' })
    expect(violationsIn(root, 'a.md')).toEqual([{ url: '#deferred-work', reason: 'anchor' }])
  })

  it('rejects a case-variant fragment: element ids are case-sensitive', () => {
    const root = layout({ 'a.md': '# A\n\n## Default Loop\n\n[case](#Default-Loop)\n' })
    expect(violationsIn(root, 'a.md')).toEqual([{ url: '#Default-Loop', reason: 'anchor' }])
  })

  it('rejects a cross-file fragment missing from the target document', () => {
    const root = layout({
      'a.md': '# A\n\n[stale](b.md#old-heading)\n',
      'b.md': '# B\n\n## New heading\n',
    })
    expect(violationsIn(root, 'a.md')).toEqual([{ url: 'b.md#old-heading', reason: 'anchor' }])
  })

  it('rejects a CJK cross-file fragment that names no heading', () => {
    const root = layout({
      'a.md': '# A\n\n[rules](b.md#写作规则)\n',
      'b.md': '# B\n\n## 本地只跑相关检查\n',
    })
    expect(violationsIn(root, 'a.md')).toEqual([{ url: 'b.md#写作规则', reason: 'anchor' }])
  })

  it('resolves a percent-encoded path and anchor', () => {
    const root = layout({
      'a.md': '# A\n\n[enc](my%20file.md#part-two)\n',
      'my file.md': '# B\n\n## Part two\n',
    })
    expect(violationsIn(root, 'a.md')).toEqual([])
  })

  it('still rejects a missing target file, reported as target not anchor', () => {
    const root = layout({ 'a.md': '# A\n\n[ghost](missing.md#anything)\n' })
    expect(violationsIn(root, 'a.md')).toEqual([{ url: 'missing.md#anything', reason: 'target' }])
  })

  it('ignores protocol-relative and root-absolute targets', () => {
    const root = layout({ 'a.md': '# A\n\n[rel](//host/x.md) [abs](/x.md) [mail](mailto:x@example.com)\n' })
    expect(violationsIn(root, 'a.md')).toEqual([])
  })
})
