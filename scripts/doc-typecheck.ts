/**
 * Typecheck Markdown `ts` fences: every fenced TypeScript block must compile
 * under the repository's own TypeScript. `ts ignore-check` fences are skipped
 * and counted, so opt-outs stay a minority of the recognized fences.
 *
 * Each checked block becomes an isolated file in a throwaway project under the
 * system temp directory; compiler diagnostics are mapped back to the document
 * line of the failing fence body.
 */

import { execFileSync } from 'node:child_process'
import { globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { markdownFences } from './markdown.ts'

/** Repository root, resolved from this script's location. */
const root = resolve(import.meta.dirname, '..')

/** Behavior this gate assigns to one recognized fence. */
export type BlockKind = 'check' | 'ignore'

/** One recognized TypeScript fence. */
export interface TsBlock {
  /** Document path relative to the repository root, `/`-separated. */
  file: string
  /** 1-based source line of the opening fence. */
  line: number
  /** Whether the fence compiles or only counts as an exemption. */
  kind: BlockKind
  /** Fence body without the delimiters. */
  code: string
}

/** Largest tolerated `ignore-check` share of the recognized fences. */
export const IGNORE_RATIO_LIMIT = 0.25

/** Markdown documents this gate scans, relative to the repository root. */
const markdownGlobs = ['docs/**/*.md', 'AGENTS.md', 'README.md']

/**
 * Classify one fence info string.
 * @param info - full info string after the opening backticks, e.g. `ts ignore-check`.
 * @returns `check` for `ts`, `ignore` for `ts ignore-check`, otherwise undefined.
 */
export function classifyInfo(info: string): BlockKind | undefined {
  switch (info.trim().replace(/\s+/g, ' ')) {
    case 'ts':
      return 'check'
    case 'ts ignore-check':
      return 'ignore'
    default:
      return undefined
  }
}

/**
 * Extract the TypeScript fences of one Markdown document, in source order.
 * @param source - Markdown source to scan.
 * @param file - document path the extracted blocks belong to.
 * @returns one entry per `ts` or `ts ignore-check` fence; other fences are dropped.
 */
export function extractTsBlocks(source: string, file: string): TsBlock[] {
  return markdownFences(source).flatMap((fence) => {
    const kind = classifyInfo(fence.info)
    return kind === undefined ? [] : [{ file, line: fence.line, kind, code: fence.code }]
  })
}

/**
 * Share of the recognized fences that opt out of checking.
 * @param blocks - recognized fences of one or more documents.
 * @returns ignored / recognized, or 0 when nothing was recognized.
 */
export function ignoreRatio(blocks: readonly TsBlock[]): number {
  if (blocks.length === 0) return 0
  return blocks.filter(block => block.kind === 'ignore').length / blocks.length
}

/**
 * Whether the opt-out share is above {@link IGNORE_RATIO_LIMIT}; the exact limit passes.
 * @param blocks - recognized fences of one or more documents.
 * @returns true only when the ratio is strictly above the limit.
 */
export function ignoreRatioExceeded(blocks: readonly TsBlock[]): boolean {
  return ignoreRatio(blocks) > IGNORE_RATIO_LIMIT
}

/** Repository-relative documents to scan, `/`-separated and sorted. */
function scannedDocuments(): string[] {
  const found = new Set<string>()
  for (const pattern of markdownGlobs) {
    for (const match of globSync(pattern, { cwd: root })) found.add(match.replaceAll('\\', '/'))
  }
  return [...found].sort()
}

/** Deterministic temporary file name for one checked block. */
function blockFileName(index: number, file: string): string {
  const slug = file.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  return `block-${index}-${slug === '' ? 'document' : slug}.ts`
}

/**
 * Compiler settings for the throwaway project. Paths are absolute because the
 * project lives outside the repository; `typeRoots` keeps `types: ["node"]`
 * resolvable from there.
 */
function tempConfigSource(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      types: ['node'],
      typeRoots: [resolve(root, 'node_modules/@types')],
      paths: { '@devkit/shared': [resolve(root, 'packages/shared/src/index.ts')] },
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
      composite: false,
      declaration: false,
      allowImportingTsExtensions: true,
    },
    include: ['block-*.ts'],
  }, null, 2)
}

/** Run the repository's tsc over the throwaway project; diagnostics text, if any. */
function runTsc(projectDir: string): string | undefined {
  try {
    execFileSync(
      process.execPath,
      [join(root, 'node_modules/typescript/bin/tsc'), '--project', join(projectDir, 'tsconfig.json'), '--noEmit'],
      { cwd: root, stdio: 'pipe' },
    )
    return undefined
  } catch (error: unknown) {
    // A non-zero exit is the diagnostic channel; anything else also surfaces here.
    const failed = error as { stdout?: Buffer; stderr?: Buffer }
    return `${failed.stdout?.toString() ?? ''}${failed.stderr?.toString() ?? ''}`
  }
}

/** One parsed `file(line,col): error TSxxxx: message` diagnostic. */
interface ParsedDiagnostic {
  file: string
  line: number
  severity: string
  code: string
  message: string
}

const diagnosticPattern = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/

/** Parse one tsc diagnostic line, or undefined for a continuation or summary line. */
function parseDiagnostic(line: string): ParsedDiagnostic | undefined {
  const match = diagnosticPattern.exec(line)
  if (match === null) return undefined
  const file = match[1]
  const lineText = match[2]
  const severity = match[4]
  const code = match[5]
  const message = match[6]
  if (file === undefined || lineText === undefined || severity === undefined || code === undefined || message === undefined) {
    return undefined
  }
  return { file, line: Number(lineText), severity, code, message }
}

/** Last path segment of a compiler-reported file name, on either host separator. */
function baseName(pathText: string): string {
  const segments = pathText.split(/[\\/]/)
  return segments.at(-1) ?? pathText
}

/**
 * Map compiler output back to document fences.
 * @param output - combined stdout and stderr of the tsc run.
 * @param blocks - checked blocks keyed by their temporary file name.
 * @returns one line per diagnostic: `doc:line [block line n] error TSxxxx: message`,
 * plus any diagnostic that does not belong to a block file, reported as tsc printed it.
 */
function mapDiagnostics(output: string, blocks: ReadonlyMap<string, TsBlock>): string[] {
  const rows: string[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const text = rawLine.trim()
    if (text === '' || /^Found \d+ error/.test(text)) continue
    const diagnostic = parseDiagnostic(text)
    const block = diagnostic === undefined ? undefined : blocks.get(baseName(diagnostic.file))
    if (diagnostic === undefined || block === undefined) {
      // Continuation lines (elaborated types, missing properties) extend the row above.
      const previous = rows.length - 1
      if (previous >= 0 && diagnostic === undefined) rows[previous] = `${rows[previous] ?? ''} ${text}`
      else rows.push(text)
      continue
    }
    const documentLine = block.line + diagnostic.line
    rows.push(`${block.file}:${documentLine} [block line ${diagnostic.line}] ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`)
  }
  return rows
}

/**
 * Compile the checked fences in a throwaway project and report failures.
 * @param blocks - fences whose bodies must compile.
 * @returns diagnostic rows; empty when every block compiles.
 */
function checkFences(blocks: readonly TsBlock[]): string[] {
  const projectDir = mkdtempSync(join(tmpdir(), 'doc-typecheck-'))
  try {
    const byFileName = new Map<string, TsBlock>()
    blocks.forEach((block, index) => {
      const fileName = blockFileName(index, block.file)
      byFileName.set(fileName, block)
      writeFileSync(join(projectDir, fileName), block.code.endsWith('\n') ? block.code : `${block.code}\n`)
    })
    writeFileSync(join(projectDir, 'tsconfig.json'), tempConfigSource())
    const output = runTsc(projectDir)
    return output === undefined ? [] : mapDiagnostics(output, byFileName)
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) {
  const blocks = scannedDocuments().flatMap(file => extractTsBlocks(readFileSync(resolve(root, file), 'utf8'), file))
  const checked = blocks.filter(block => block.kind === 'check')
  const ignored = blocks.filter(block => block.kind === 'ignore')

  if (checked.length === 0) {
    console.log('doc-typecheck: 0 fenced ts blocks.')
    process.exit(0)
  }

  const failures = checkFences(checked)
  const ratio = ignoreRatio(blocks)
  const summary = `doc-typecheck: ${checked.length} fenced ts block(s) checked, `
    + `${ignored.length} ignore-check (${(ratio * 100).toFixed(0)}% opt-out), ${failures.length} failure(s).`

  if (failures.length > 0) {
    console.error('doc-typecheck: documentation code blocks failed to compile.')
    for (const failure of failures) console.error(failure)
    console.error(summary)
    process.exit(1)
  }

  if (ignoreRatioExceeded(blocks)) {
    console.error(`doc-typecheck: ${ignored.length}/${blocks.length} fenced ts blocks opt out with ignore-check `
      + `(limit ${(IGNORE_RATIO_LIMIT * 100).toFixed(0)}%). Give them real types or drop the sketch.`)
    console.error(summary)
    process.exit(1)
  }

  console.log(summary)
  process.exit(0)
}
