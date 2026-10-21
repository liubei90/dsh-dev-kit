/** Shared repository file discovery for documentation gates. */

import { readdirSync, realpathSync, statSync, type Dirent } from 'node:fs'
import { join, resolve } from 'node:path'

/** One authored path plus its canonical target for symlink deduplication. */
export interface RepoFile {
  /** Absolute path matched by the caller's glob. */
  abs: string
  /** Absolute canonical path used only for deduplication. */
  real: string
}

/** One walker match before canonicalization. */
interface GlobMatch {
  /** Repository-relative slash path. */
  path: string
  /** False only for a regular file reached through real directories alone. */
  viaSymlink: boolean
}

/** Whether a repository path is frozen Agent Note history, not evolving source prose. */
export function isArchivedAgentNotePath(path: string): boolean {
  return path.replaceAll('\\', '/').startsWith('.agents/notes/archived/')
}

/**
 * Whether a pattern segment matches a directory or file name. Supports `*` and
 * `?` inside a segment and mirrors node's glob `dot: false`: a segment whose
 * first character is a wildcard does not match dot names. `**` is handled as a
 * whole segment by the walker, never here.
 */
function segmentMatches(pattern: string, name: string): boolean {
  if (name.startsWith('.') && (pattern.startsWith('*') || pattern.startsWith('?'))) return false
  let expression = ''
  for (const character of pattern) {
    if (character === '*') expression += '.*'
    else if (character === '?') expression += '.'
    else expression += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${expression}$`).test(name)
}

/**
 * Reject glob syntax the walker does not model. Node's `fs.glob` understands
 * character classes, brace alternation, and extglobs; expanding those
 * silently as literals would match nothing and quietly shrink a gate's
 * corpus, so a pattern segment using them fails loudly instead. Pure literal
 * segments must therefore contain none of the rejected metacharacters
 * either, even where node glob would read them literally.
 */
const UNSUPPORTED_GLOB = /[[\]{}()!+@\\]/

function assertSupportedSegment(segment: string): void {
  if (UNSUPPORTED_GLOB.test(segment)) {
    throw new TypeError(`repo-files walker does not model glob syntax in segment: ${segment}`)
  }
}

/** Whether a pattern segment contains `*` or `?` and is therefore wildcard. */
function hasWildcard(segment: string): boolean {
  return segment.includes('*') || segment.includes('?')
}

/**
 * Walk `root` matching one repository-relative glob without node's `fs.glob`.
 * The repository's own walker exists because node's internal glob, from some
 * 24.x releases, lstat-probes `<matched>/<next segment>` for symlinked files
 * while expanding `**` and throws ENOTDIR instead of skipping. The walker
 * decides directoryhood from dirent types and stat results, never by probing a
 * path under a file, so the same tree enumerates identically on every node
 * version.
 *
 * Segment semantics: literal segments resolve through `stat`, so a literal
 * naming a symlinked directory enters that directory exactly as node glob
 * does — including a literal repeated across segments, which node glob
 * resolves each time; wildcard segments and `**` resolve through dirent
 * types, so they never enter symlinked directories and never match dot
 * names. `**` spans zero or more directories. The final segment matches files
 * and symlinks; a broken or cyclic symlink then fails loudly in the caller's
 * realpathSync rather than shrinking the scanned corpus, while a broken
 * symlink under a literal non-final segment matches nothing, again as node
 * glob does. Traversal terminates without a visited set: each literal segment
 * consumes one pattern segment per recursion, and `**` recurses only into real
 * directories, which form a finite tree because symlinked directories are
 * never expanded by it.
 *
 * Pattern segments support `*`, `?`, and literals that contain none of
 * `[]{}()!+@\`; other node-glob syntax, including a trailing `**`, `..`, and
 * empty segments, is rejected loudly up front, while a `.` segment is folded
 * away exactly as node glob normalizes it. Directory listings come from
 * `listDirectory`, which callers share across patterns so each directory is
 * read once. A directory for which `skipDirectory` returns true is never
 * entered. Returns repository-relative slash paths, sorted, each marked
 * `viaSymlink` unless it names a regular file reached only through real
 * directories.
 * @param root - absolute directory each pattern is resolved against.
 * @param pattern - one repository-relative glob pattern.
 * @param listDirectory - listing source, shared by the caller across patterns.
 * @param skipDirectory - predicate over each repository-relative directory before the walker lists it.
 * @returns matched repository-relative slash paths, sorted.
 */
function expandGlob(
  root: string,
  pattern: string,
  listDirectory: (dirAbs: string) => readonly Dirent[],
  skipDirectory: (relativeDirectory: string) => boolean,
): GlobMatch[] {
  const segments: string[] = []
  for (const segment of pattern.split('/')) {
    if (segment === '.') {
      // Node glob normalizes a `.` segment away; dropping it here keeps
      // `./README.md` and `a/./b` matching exactly as node glob does instead
      // of silently matching nothing.
      continue
    }
    if (segment === '..') {
      // A `..` segment escapes the scanned root and interacts with `**` in
      // ways node glob special-cases; no gate pattern uses one, so the walker
      // rejects the form loudly instead of silently matching nothing.
      throw new TypeError(`repo-files walker does not model .. segments in pattern: ${pattern}`)
    }
    if (segment === '') {
      // A leading, doubled, or trailing slash yields an empty segment that
      // can never match an entry; node glob would tolerate the form, so the
      // walker must reject it loudly instead of silently returning nothing.
      throw new TypeError(`repo-files walker does not model empty segments in pattern: ${pattern}`)
    }
    segments.push(segment)
  }
  if (segments.length === 0) {
    throw new TypeError(`repo-files walker does not model a pattern with no segments: ${pattern}`)
  }
  for (const segment of segments) {
    if (segment !== '**') assertSupportedSegment(segment)
  }
  // A trailing `**` would match files, directories, and symlinks below the
  // prefix; the walker models `**` only as a directory-spanning segment, so
  // it must reject the form loudly instead of silently returning nothing.
  if (segments[segments.length - 1] === '**') {
    throw new TypeError(`repo-files walker does not model a trailing ** segment in pattern: ${pattern}`)
  }
  const out: GlobMatch[] = []

  const visit = (dirAbs: string, dirRel: string, index: number, viaSymlink: boolean): void => {
    if (index >= segments.length) return
    if (segments[index] !== '**') {
      visitSegment(dirAbs, dirRel, index, viaSymlink)
      return
    }
    // `**` consumes zero directories here and one directory per recursion.
    visitSegment(dirAbs, dirRel, index + 1, viaSymlink)
    for (const entry of listDirectory(dirAbs)) {
      if (entry.name.startsWith('.') || !entry.isDirectory()) continue
      const childRel = dirRel === '.' ? entry.name : `${dirRel}/${entry.name}`
      if (skipDirectory(childRel)) continue
      visit(join(dirAbs, entry.name), childRel, index, viaSymlink)
    }
  }

  const visitSegment = (dirAbs: string, dirRel: string, index: number, viaSymlink: boolean): void => {
    if (index >= segments.length) return
    const segment = segments[index]
    if (segment === undefined) return
    if (segment === '**') {
      visit(dirAbs, dirRel, index, viaSymlink)
      return
    }
    const last = index === segments.length - 1
    for (const entry of listDirectory(dirAbs)) {
      if (!segmentMatches(segment, entry.name)) continue
      const childAbs = join(dirAbs, entry.name)
      const childRel = dirRel === '.' ? entry.name : `${dirRel}/${entry.name}`
      if (last) {
        // Files and symlinks match; a broken or cyclic symlink then fails
        // loudly in the caller's realpathSync exactly as node glob did,
        // rather than silently shrinking the scanned corpus.
        if (entry.isFile() || entry.isSymbolicLink()) {
          out.push({ path: childRel, viaSymlink: viaSymlink || !entry.isFile() })
        }
        continue
      }
      if (entry.isDirectory()) {
        if (!skipDirectory(childRel)) visitSegment(childAbs, childRel, index + 1, viaSymlink)
        continue
      }
      // A literal non-final segment resolves through stat like node glob's,
      // so it enters a symlinked directory; wildcard segments never reach
      // this branch because they are matched from dirent types above.
      if (!entry.isSymbolicLink() || hasWildcard(segment)) continue
      let target: ReturnType<typeof statSync>
      try {
        target = statSync(childAbs)
      } catch {
        // A broken symlink matches nothing under a literal segment, as node
        // glob silently returns no match for it.
        continue
      }
      if (!target.isDirectory() || skipDirectory(childRel)) continue
      visitSegment(childAbs, childRel, index + 1, true)
    }
  }

  visit(root, '.', 0, false)
  return out.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
}

/**
 * Expand one repository-relative glob against `root`.
 * @param root - absolute directory the pattern is resolved against.
 * @param pattern - one repository-relative glob pattern.
 * @param listDirectory - optional listing source, allowing a caller to share and observe it.
 * @param skipDirectory - optional predicate over each repository-relative directory before it is listed.
 * @returns matched repository-relative slash paths, sorted.
 */
export function expandRepoGlob(
  root: string,
  pattern: string,
  listDirectory: (dirAbs: string) => readonly Dirent[] = dirAbs => readdirSync(dirAbs, { withFileTypes: true }),
  skipDirectory: (relativeDirectory: string) => boolean = () => false,
): string[] {
  return expandGlob(root, pattern, listDirectory, skipDirectory).map(match => match.path)
}

/**
 * Expand repository-relative globs and deduplicate symlinked files.
 * Each directory is listed at most once per call, shared across patterns.
 * A regular file reached only through real directories canonicalizes to
 * `realpathSync(root)` joined with its relative path; every other match goes
 * through `realpathSync`, so a broken or cyclic symlink still throws.
 * @param root - absolute repository root.
 * @param patterns - repository-relative glob patterns, processed in order.
 * @param isExcluded - optional predicate over each matched relative path.
 * @param skipDirectory - optional predicate over each repository-relative directory before the walker
 *   lists it; return true only when `isExcluded` holds for every path below that directory.
 * @returns matched files in stable first-seen order.
 */
export function uniqueRepoFiles(
  root: string,
  patterns: readonly string[],
  isExcluded: (relativePath: string) => boolean = () => false,
  skipDirectory: (relativeDirectory: string) => boolean = () => false,
): RepoFile[] {
  const listings = new Map<string, readonly Dirent[]>()
  const listDirectory = (dirAbs: string): readonly Dirent[] => {
    let entries = listings.get(dirAbs)
    if (entries === undefined) {
      entries = readdirSync(dirAbs, { withFileTypes: true })
      listings.set(dirAbs, entries)
    }
    return entries
  }
  let realRoot: string | undefined
  const seen = new Set<string>()
  const files: RepoFile[] = []
  for (const pattern of patterns) {
    for (const { path: repoPath, viaSymlink } of expandGlob(root, pattern, listDirectory, skipDirectory)) {
      if (isExcluded(repoPath)) continue
      const abs = resolve(root, repoPath)
      const real = viaSymlink ? realpathSync(abs) : join(realRoot ??= realpathSync(root), repoPath)
      if (seen.has(real)) continue
      seen.add(real)
      files.push({ abs, real })
    }
  }
  return files
}
