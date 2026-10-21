import { describe, expect, it } from 'vitest'
import {
  extendArchiveManifest,
  parseArchiveManifest,
  renderArchiveManifest,
  validateArchiveArtifacts,
  validateArchiveManifestExtension,
  type ArchiveManifest,
} from './archived-agent-notes.ts'

const STEM = '2026-07-26-example'
const NOTE_PATH = `process/${STEM}.md`

/** One archived note carrying the required metadata, keyed by its archive-relative path. */
function fixture(): Map<string, Buffer> {
  return new Map([
    [NOTE_PATH, Buffer.from('# Agent Note: Example\n\nStatus: implemented\nArchived: 2026-07-26\n\n## Problem\n\nExample.\n')],
  ])
}

describe('archived Agent Notes', () => {
  it('accepts one implemented note with matching archive metadata', () => {
    expect(validateArchiveArtifacts(fixture())).toEqual([])
  })

  it.each(['# Agent Note: Example', '# Historical decision'])('preserves historical formatting: %s', (title) => {
    const artifacts = fixture()
    artifacts.set(NOTE_PATH, Buffer.from(`${title}\nStatus: implemented\nArchived: 2026-07-26\n`))
    expect(validateArchiveArtifacts(artifacts)).toEqual([])
  })

  it.each([
    ['Status: proposed\nArchived: 2026-07-26', /requires `Status: implemented`/],
    ['Status: implemented\n\nArchived: 2026-07-26', /immediately after the status/],
    ['Status: implemented\nArchived: 2026-02-30', /valid date/],
    ['Status: implemented\nArchived: 2026-07-25', /predates the note filename/],
  ])('rejects invalid archive metadata: %s', (metadata, error) => {
    const artifacts = fixture()
    artifacts.set(NOTE_PATH, Buffer.from(`# Historical decision\n${metadata}\n`))
    expect(validateArchiveArtifacts(artifacts).join('\n')).toMatch(error)
  })

  it('rejects an archived file outside a class folder or with an undated filename', () => {
    const artifacts = fixture()
    artifacts.set('bogus/2026-07-26-example.md', Buffer.from('# Agent Note: Example\n\nStatus: implemented\nArchived: 2026-07-26\n'))
    artifacts.set('process/example.md', Buffer.from('# Agent Note: Example\n\nStatus: implemented\nArchived: 2026-07-26\n'))
    const errors = validateArchiveArtifacts(artifacts).join('\n')
    expect(errors).toMatch(/unknown Agent Note class "bogus"/)
    expect(errors).toMatch(/expected \{class\}\/yyyy-mm-dd-topic\.md/)
  })

  it('extends the manifest without permitting a sealed change or removal', () => {
    const artifacts = fixture()
    const empty: ArchiveManifest = { version: 1, files: {} }
    const first = extendArchiveManifest(empty, artifacts)
    expect(first.errors).toEqual([])
    expect(first.added).toHaveLength(1)

    const sealed: ArchiveManifest = { version: 1, files: first.files }
    const changed = new Map(artifacts)
    changed.set(NOTE_PATH, Buffer.from('changed'))
    expect(extendArchiveManifest(sealed, changed).errors).toEqual([
      `${NOTE_PATH}: sealed content hash changed`,
    ])
    changed.delete(NOTE_PATH)
    expect(extendArchiveManifest(sealed, changed).errors).toContain(
      `${NOTE_PATH}: sealed artifact is missing`,
    )
  })

  it('rejects replacing manifest seals alongside changed archive content', () => {
    const artifacts = fixture()
    const initial = extendArchiveManifest({ version: 1, files: {} }, artifacts)
    const baseline: ArchiveManifest = { version: 1, files: initial.files }
    const changedArtifacts = new Map(artifacts)
    changedArtifacts.set(NOTE_PATH, Buffer.from('changed'))
    const replacement = extendArchiveManifest({ version: 1, files: {} }, changedArtifacts)
    const current: ArchiveManifest = { version: 1, files: replacement.files }

    expect(extendArchiveManifest(current, changedArtifacts).errors).toEqual([])
    expect(validateArchiveManifestExtension(baseline, current)).toEqual([
      `${NOTE_PATH}: sealed manifest hash changed`,
    ])
    const removed: ArchiveManifest = {
      version: 1,
      files: Object.fromEntries(Object.entries(current.files).filter(([candidate]) => candidate !== NOTE_PATH)),
    }
    expect(validateArchiveManifestExtension(baseline, removed)).toContain(
      `${NOTE_PATH}: sealed manifest entry is missing`,
    )
  })

  it('permits appends only, never a seal transition on an existing entry', () => {
    const before = `sha256:${'a'.repeat(64)}`
    const after = `sha256:${'b'.repeat(64)}`
    const manifest = (files: Record<string, string>): ArchiveManifest => ({ version: 1, files })
    expect(validateArchiveManifestExtension(manifest({ [NOTE_PATH]: before }), manifest({ [NOTE_PATH]: before }))).toEqual([])
    expect(validateArchiveManifestExtension(manifest({ [NOTE_PATH]: before }), manifest({ [NOTE_PATH]: before, 'process/other.md': after }))).toEqual([])
    expect(validateArchiveManifestExtension(manifest({ [NOTE_PATH]: before }), manifest({ [NOTE_PATH]: after }))).toEqual([
      `${NOTE_PATH}: sealed manifest hash changed`,
    ])
    expect(validateArchiveManifestExtension(manifest({ [NOTE_PATH]: before }), manifest({}))).toEqual([
      `${NOTE_PATH}: sealed manifest entry is missing`,
    ])
  })

  it('round-trips the deterministic manifest schema', () => {
    const content = renderArchiveManifest({ 'process/z.md': `sha256:${'a'.repeat(64)}` })
    expect(parseArchiveManifest(content)).toEqual({
      version: 1,
      files: { 'process/z.md': `sha256:${'a'.repeat(64)}` },
    })
  })
})
