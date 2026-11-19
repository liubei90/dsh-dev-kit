/**
 * Reject empty `catch` clauses that discard a failure without naming it or saying why.
 *
 * An empty clause has no statement other than `;` in its block. Such a clause must name the
 * discarded error, explain in a comment why no handling is needed, and wrap a `try` that holds
 * exactly one statement; a wider `try` hides statements whose failures the clause also discards.
 * A clause with any other statement is out of scope: whether it handles the error is not decidable
 * from syntax.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** Repository root, used to resolve the default scan roots and to print relative paths. */
const ROOT = resolve(import.meta.dirname, '..')

/** Source areas the gate scans; a narrowed scan cannot pass silently. */
const SOURCE_ROOTS = ['apps', 'packages', 'tools', 'scripts'] as const

/** Source extensions the gate scans, including tests and configuration files. */
const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]s|[jt]sx)$/u

/** Directories that hold build output or dependencies, never first-party source. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'lib', 'dist', 'coverage'])

/** One condition of the empty-catch rule that a clause breaks. */
export type EmptyCatchDefect = 'unnamed' | 'unexplained' | 'wide-try'

/** One empty `catch` clause that breaks at least one condition. */
export interface EmptyCatchFinding {
  /** Repository-relative path with `/` separators. */
  readonly file: string
  /** 1-based line of the `catch` keyword. */
  readonly line: number
  /** Conditions this clause breaks, in reporting order. */
  readonly defects: readonly EmptyCatchDefect[]
}

/** Return the empty `catch` clauses of one source text that break the rule. */
export function checkSource(source: string, file: string): EmptyCatchFinding[] {
  const scriptKind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
  const findings: EmptyCatchFinding[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCatchClause(node)) {
      const defects = defectsOf(node, sourceFile)
      if (defects.length > 0) {
        findings.push({
          file,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          defects,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return findings
}

/** Return the conditions one clause breaks; an empty array means the clause is legal or out of scope. */
function defectsOf(node: ts.CatchClause, sourceFile: ts.SourceFile): EmptyCatchDefect[] {
  if (!isEmptyBody(node.block)) return []
  const defects: EmptyCatchDefect[] = []
  if (node.variableDeclaration === undefined) defects.push('unnamed')
  if (!hasReason(node.block, sourceFile)) defects.push('unexplained')
  const tryStatement = node.parent
  if (ts.isTryStatement(tryStatement) && tryStatement.tryBlock.statements.length !== 1) {
    defects.push('wide-try')
  }
  return defects
}

/** A clause body whose statements are all bare `;` (or none) is empty. */
function isEmptyBody(block: ts.Block): boolean {
  return block.statements.every(statement => ts.isEmptyStatement(statement))
}

/**
 * A reason is a single- or multi-line comment inside the clause block. The block is empty, so any
 * non-structural text between its braces is the comment.
 */
function hasReason(block: ts.Block, sourceFile: ts.SourceFile): boolean {
  const inner = sourceFile.text.slice(block.getStart(sourceFile) + 1, block.end - 1)
  return inner.includes('//') || inner.includes('/*')
}

/** Collect every first-party source file under the scan roots. */
function listSources(): string[] {
  const files: string[] = []
  const walk = (directory: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(directory)
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP_DIRECTORIES.has(entry)) continue
      const absolute = join(directory, entry)
      let isDirectory: boolean
      try {
        isDirectory = ts.sys.directoryExists(absolute)
      } catch {
        continue
      }
      if (isDirectory) {
        walk(absolute)
        continue
      }
      if (SOURCE_EXTENSIONS.test(entry)) files.push(absolute)
    }
  }
  for (const area of SOURCE_ROOTS) walk(join(ROOT, area))
  return files.sort()
}

function main(): void {
  const findings = listSources().flatMap(file =>
    checkSource(readFileSync(file, 'utf8'), relative(ROOT, file).replaceAll('\\', '/')),
  )
  for (const finding of findings) {
    console.error(
      `verify-empty-catch: ${finding.file}:${String(finding.line)} [${finding.defects.join(', ')}]`,
    )
  }
  console.log(
    `verify-empty-catch: ${String(findings.length)} finding(s) across ${String(listSources().length)} source file(s).`,
  )
  if (findings.length > 0) {
    console.error(
      'Name the discarded error, explain why no handling is needed, and keep one statement in the try.',
    )
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
