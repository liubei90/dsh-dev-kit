/**
 * Read-only projection of the repository link graph: Agent Notes, docs, and
 * skills are nodes; relative Markdown links between them are directed edges.
 * Links to paths outside the node set are dropped, as are external URLs,
 * anchors, and absolute paths.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes } from 'mdast'
import type { Graph, GraphEdge, GraphNode, GraphNodeKind } from './contracts.js'
import { readAgentNotes } from './notes.js'
import { loadOwnershipResolver } from './ownership.js'
import { readSkills } from './skills.js'

/** Markdown files outside `docs/` that still take part in the graph. */
const ROOT_DOCS = ['README.md', 'AGENTS.md'] as const

/** Directory whose Markdown files are documentation nodes. */
const DOCS_DIRECTORY = 'docs'

/** Directories that never contribute documentation nodes. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'lib',
  'dist',
  'coverage',
  '.data',
  '.pnpm-store',
  'tmp',
  '.artifacts',
])

/** Agent Note policy files that are documentation nodes, not note content. */
const NOTE_POLICY_ROOT = '.agents/notes'

/** Recursively visit one mdast tree in document order. */
function visitNodes(node: Nodes, visitor: (node: Nodes) => void): void {
  visitor(node)
  if ('children' in node) {
    for (const child of node.children) visitNodes(child, visitor)
  }
}

/** Text a reader sees from one Markdown node; raw HTML contributes none. */
function renderedText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? ''
  if (node.type === 'break') return ' '
  if ('children' in node) return node.children.map(child => renderedText(child)).join('')
  return ''
}

/** Read the first level-one heading, or fall back to the file name. */
function headingTitle(repoRoot: string, path: string): string {
  const tree = fromMarkdown(readFileSync(resolve(repoRoot, path), 'utf8'))
  let title: string | undefined
  visitNodes(tree, (node) => {
    if (title !== undefined || node.type !== 'heading' || node.depth !== 1) return
    const text = renderedText(node).trim()
    if (text !== '') title = text
  })
  return title ?? posix.basename(path, '.md')
}

/** Collect relative link targets from one Markdown source. */
function extractLinkTargets(source: string): string[] {
  const tree = fromMarkdown(source)
  const definitions = new Map<string, string>()
  visitNodes(tree, (node) => {
    if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node.url)
  })

  const targets: string[] = []
  visitNodes(tree, (node) => {
    if (node.type === 'link') {
      targets.push(node.url)
      return
    }
    if (node.type !== 'linkReference') return
    const url = definitions.get(node.identifier.toLowerCase())
    if (url !== undefined) targets.push(url)
  })
  return targets
}

/** Resolve one link target relative to the linking node. */
function resolveTarget(from: string, target: string): string | undefined {
  const boundary = target.search(/[?#]/u)
  const raw = (boundary === -1 ? target : target.slice(0, boundary)).trim()
  if (raw === '' || raw.startsWith('/') || raw.startsWith('//')) return undefined
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(raw)) return undefined

  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  }
  catch {
    decoded = raw
  }
  const resolved = posix.normalize(posix.join(posix.dirname(from), decoded))
  return resolved.startsWith('../') || resolved === '..' ? undefined : resolved
}

/** Walk one directory for Markdown files, returning repository-relative paths. */
function walkMarkdown(repoRoot: string, relativeDirectory: string): string[] {
  const absolute = resolve(repoRoot, relativeDirectory)
  if (!existsSync(absolute)) return []
  const files: string[] = []
  const visit = (directoryAbsolute: string, directoryRelative: string): void => {
    for (const entry of readdirSync(directoryAbsolute, { withFileTypes: true })) {
      const childAbsolute = resolve(directoryAbsolute, entry.name)
      const childRelative = `${directoryRelative}/${entry.name}`
      if (entry.isDirectory()) visit(childAbsolute, childRelative)
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(childRelative)
    }
  }
  visit(absolute, relativeDirectory)
  return files
}

/** List every `README.md` in the repository, excluding generated and dependency trees. */
function readmeFiles(repoRoot: string): string[] {
  const files: string[] = []
  const visit = (directoryAbsolute: string, directoryRelative: string): void => {
    for (const entry of readdirSync(directoryAbsolute, { withFileTypes: true })) {
      const childAbsolute = resolve(directoryAbsolute, entry.name)
      const childRelative = `${directoryRelative}/${entry.name}`
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) visit(childAbsolute, childRelative)
        continue
      }
      if (entry.isFile() && entry.name === 'README.md') files.push(childRelative.replace(/^\.\//u, ''))
    }
  }
  visit(repoRoot, '.')
  return files
}

/** List the Agent Note policy Markdown files (not note content). */
function notePolicyFiles(repoRoot: string): string[] {
  const files: string[] = []
  const readme = `${NOTE_POLICY_ROOT}/README.md`
  if (existsSync(resolve(repoRoot, readme))) files.push(readme)

  const visit = (directoryRelative: string): void => {
    const directoryAbsolute = resolve(repoRoot, directoryRelative)
    if (!existsSync(directoryAbsolute)) return
    for (const entry of readdirSync(directoryAbsolute, { withFileTypes: true })) {
      const childRelative = `${directoryRelative}/${entry.name}`
      if (entry.isDirectory()) visit(childRelative)
      else if (entry.isFile() && entry.name === 'AGENTS.md') files.push(childRelative)
    }
  }
  visit(NOTE_POLICY_ROOT)
  return files
}

/** List every documentation node path. */
function docFiles(repoRoot: string): string[] {
  const files = new Set<string>()
  for (const name of ROOT_DOCS) {
    if (existsSync(resolve(repoRoot, name))) files.add(name)
  }
  for (const path of walkMarkdown(repoRoot, DOCS_DIRECTORY)) files.add(path)
  for (const path of readmeFiles(repoRoot)) files.add(path)
  for (const path of notePolicyFiles(repoRoot)) files.add(path)
  return [...files].sort()
}

/** Build one graph node for a documentation file. */
function docNode(repoRoot: string, path: string, ownershipOf: (path: string) => GraphNode['ownership']): GraphNode {
  return {
    id: path,
    kind: 'doc' satisfies GraphNodeKind,
    title: headingTitle(repoRoot, path),
    ownership: ownershipOf(path),
    degree: 0,
  }
}

/**
 * Read the repository knowledge graph.
 *
 * @param repoRoot - repository root containing notes, docs, skills, and the ownership manifest.
 * @returns nodes and directed edges for the current working tree.
 * @throws When the ownership manifest or a node file cannot be read.
 */
export function readGraph(repoRoot: string): Graph {
  const ownership = loadOwnershipResolver(repoRoot)
  const nodes: GraphNode[] = []

  for (const note of readAgentNotes(repoRoot)) {
    nodes.push({
      id: note.path,
      kind: 'note',
      title: note.title,
      noteClass: note.noteClass,
      lifecycle: note.lifecycle,
      ownership: ownership.classify(note.path),
      degree: 0,
    })
  }
  for (const path of docFiles(repoRoot)) {
    nodes.push(docNode(repoRoot, path, candidate => ownership.classify(candidate)))
  }
  for (const skill of readSkills(repoRoot)) {
    nodes.push({
      id: skill.path,
      kind: 'skill',
      title: skill.name,
      ownership: ownership.classify(skill.path),
      degree: 0,
    })
  }
  nodes.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))

  const byId = new Map(nodes.map(node => [node.id, node]))
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    const source = readFileSync(resolve(repoRoot, node.id), 'utf8')
    for (const target of extractLinkTargets(source)) {
      const resolved = resolveTarget(node.id, target)
      if (resolved === undefined || resolved === node.id || !byId.has(resolved)) continue
      const key = `${node.id}\u0000${resolved}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ from: node.id, to: resolved })
    }
  }
  for (const edge of edges) {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (from !== undefined) from.degree += 1
    if (to !== undefined) to.degree += 1
  }
  return { nodes, edges }
}
