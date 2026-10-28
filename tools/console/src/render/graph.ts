/**
 * Knowledge graph page: an inline SVG laid out in one column per node kind,
 * colored by asset ownership, with a detail panel, legend, and text fallback.
 * The browser script adds zoom and pan around the static layout; every node
 * carries its repository path as the SVG tooltip.
 */

import type { AssetCategory, Graph, GraphNode, GraphNodeKind } from '@devkit/repo'
import { escapeHtml, toDisplayText, truncateLabel } from '../escape.js'
import { kindLabel, ownershipLabel, t } from '../i18n/zh-CN.js'
import { renderLayout } from './layout.js'
import { consoleHref } from './links.js'

/** Node kinds in column order. */
const KINDS = ['note', 'doc', 'skill'] as const

/** Asset categories in legend order. */
const OWNERSHIPS = ['framework', 'mixed', 'project'] as const

/** Horizontal center of each kind's column in the SVG view box. */
const COLUMN_X: Readonly<Record<GraphNodeKind, number>> = { note: 150, doc: 450, skill: 750 }

const SVG_WIDTH = 900
const SVG_HEIGHT = 640
const COLUMN_TOP = 56
const COLUMN_BOTTOM = 600

/** Filter value for one node kind; `all` disables the filter. */
type KindFilter = 'all' | GraphNodeKind

/** Filter value for one asset category; `all` disables the filter. */
type OwnershipFilter = 'all' | AssetCategory

/** Inputs for one graph page render. */
export interface GraphPageOptions {
  readonly graph: Graph
  readonly search: URLSearchParams
  /** Body of the selected node, already read by the server. */
  readonly selectedContent?: string
}

/**
 * Parse the kind filter.
 * @param value - raw `kind` query value.
 * @returns a known kind or `all`.
 */
export function parseKindFilter(value: string | null): KindFilter {
  return KINDS.some(kind => kind === value) ? value as GraphNodeKind : 'all'
}

/**
 * Parse the ownership filter.
 * @param value - raw `ownership` query value.
 * @returns a known category or `all`.
 */
export function parseOwnershipFilter(value: string | null): OwnershipFilter {
  return OWNERSHIPS.some(category => category === value) ? value as AssetCategory : 'all'
}

/** Build one node-detail link that preserves the active filters. */
function nodeHref(node: GraphNode, kind: KindFilter, ownership: OwnershipFilter): string {
  return consoleHref('/graph', [
    ['kind', kind === 'all' ? undefined : kind],
    ['ownership', ownership === 'all' ? undefined : ownership],
    ['node', node.id],
  ])
}

/** Render one `<option>` with its selected state. */
function option(value: string, label: string, selected: boolean): string {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`
}

/** Render one placed node as an SVG anchor whose tooltip is the repository path. */
function renderNode(node: GraphNode, x: number, y: number, href: string): string {
  const label = truncateLabel(node.title, 28)
  return `<a class="graph-node-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(`${kindLabel(node.kind)} ${node.title} · ${node.id}`)}">
  <g class="graph-node graph-node--${node.ownership}" data-node="${escapeHtml(node.id)}">
    <circle cx="${String(x)}" cy="${String(y)}" r="11"></circle>
    <text x="${String(x + 18)}" y="${String(y + 4)}">${escapeHtml(label)}</text>
    <title>${escapeHtml(node.id)}</title>
  </g>
</a>`
}

/** Render the zoom controls; the browser script reveals them and wires the buttons. */
function renderZoomTools(): string {
  return `<div class="graph-tools" data-graph-tools hidden>
  <span class="meta">${escapeHtml(t('graph.zoom.hint'))}</span>
  <button class="button" type="button" data-graph-zoom="out">${escapeHtml(t('graph.zoom.out'))}</button>
  <button class="button" type="button" data-graph-zoom="in">${escapeHtml(t('graph.zoom.in'))}</button>
  <button class="button" type="button" data-graph-zoom="reset">${escapeHtml(t('graph.zoom.reset'))}</button>
</div>`
}

/** Render the detail panel for the selected node; it lists dependencies only. */
function renderDetail(
  selected: GraphNode | undefined,
  graph: Graph,
  kind: KindFilter,
  ownership: OwnershipFilter,
): string {
  if (selected === undefined) {
    return `<aside class="panel graph-detail"><h2>${escapeHtml(t('graph.detail.title'))}</h2><p class="meta">${escapeHtml(t('graph.detail.none'))}</p></aside>`
  }

  const outbound = graph.edges.filter(edge => edge.from === selected.id)
  const inbound = graph.edges.filter(edge => edge.to === selected.id)
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  const link = (id: string): string => {
    const node = byId.get(id)
    if (node === undefined) return `<li><code>${escapeHtml(id)}</code></li>`
    return `<li><a href="${escapeHtml(nodeHref(node, kind, ownership))}">${escapeHtml(node.title)}</a> <code>${escapeHtml(node.id)}</code></li>`
  }
  const list = (ids: readonly string[]): string => ids.length === 0
    ? `<p class="meta">${escapeHtml(t('graph.detail.noLinks'))}</p>`
    : `<ul>${ids.map(link).join('')}</ul>`

  return `<aside class="panel graph-detail">
  <h2>${escapeHtml(t('graph.detail.title'))}</h2>
  <h3>${escapeHtml(selected.title)}</h3>
  <p class="meta"><code>${escapeHtml(selected.id)}</code></p>
  <h3>${escapeHtml(t('graph.detail.outbound'))}</h3>
  ${list(outbound.map(edge => edge.to))}
  <h3>${escapeHtml(t('graph.detail.inbound'))}</h3>
  ${list(inbound.map(edge => edge.from))}
</aside>`
}

/** Render the selected node's body in the area below the graph. */
function renderContent(
  selected: GraphNode | undefined,
  content: string | undefined,
): string {
  if (selected === undefined) {
    return `<section class="panel graph-content">
  <h2>${escapeHtml(t('graph.content.title'))}</h2>
  <p class="meta">${escapeHtml(t('graph.content.empty'))}</p>
</section>`
  }

  const body = content === undefined
    ? `<p class="meta">${escapeHtml(t('graph.content.missing'))}</p>`
    : `<pre class="prose">${escapeHtml(toDisplayText(content))}</pre>`

  return `<section class="panel graph-content">
  <h2>${escapeHtml(t('graph.content.title'))}</h2>
  <h3>${escapeHtml(selected.title)}</h3>
  <p class="meta">${escapeHtml(kindLabel(selected.kind))} · ${escapeHtml(ownershipLabel(selected.ownership))} · <code>${escapeHtml(selected.id)}</code></p>
  ${body}
</section>`
}

/**
 * Render the complete graph page.
 * @param options - graph projection and query values for filters and selection.
 * @returns the complete page document.
 */
export function renderGraphPage(options: GraphPageOptions): string {
  const { graph, search } = options
  const kind = parseKindFilter(search.get('kind'))
  const ownership = parseOwnershipFilter(search.get('ownership'))
  const visible = graph.nodes.filter(node =>
    (kind === 'all' || node.kind === kind) && (ownership === 'all' || node.ownership === ownership))
  const visibleIds = new Set(visible.map(node => node.id))
  const visibleEdges = graph.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to))
  const selected = graph.nodes.find(node => node.id === search.get('node'))

  const placed: Array<{ readonly node: GraphNode; readonly x: number; readonly y: number }> = []
  for (const nodeKind of KINDS) {
    const group = visible.filter(node => node.kind === nodeKind)
    group.forEach((node, index) => {
      const ratio = (index + 1) / (group.length + 1)
      placed.push({ node, x: COLUMN_X[nodeKind], y: COLUMN_TOP + ratio * (COLUMN_BOTTOM - COLUMN_TOP) })
    })
  }
  const positions = new Map(placed.map(entry => [entry.node.id, entry]))
  const edges = visibleEdges.map((edge) => {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (from === undefined || to === undefined) return ''
    return `<line class="edge" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}" x1="${String(from.x)}" y1="${String(from.y)}" x2="${String(to.x)}" y2="${String(to.y)}"></line>`
  }).join('')
  const nodes = placed.map(entry => renderNode(entry.node, entry.x, entry.y, nodeHref(entry.node, kind, ownership))).join('')
  const columns = KINDS.map(nodeKind => `<text class="graph-column" x="${String(COLUMN_X[nodeKind])}" y="28">${escapeHtml(kindLabel(nodeKind))}</text>`).join('')
  const svg = visible.length === 0
    ? `<p class="empty">${escapeHtml(t('graph.empty'))}</p>`
    : `<svg class="graph" viewBox="0 0 ${String(SVG_WIDTH)} ${String(SVG_HEIGHT)}" role="img" aria-label="${escapeHtml(t('graph.title'))}" data-graph>
  <g class="graph-viewport" data-graph-viewport>
    <g class="graph-columns">${columns}</g>
    <g class="graph-edges">${edges}</g>
    <g class="graph-nodes">${nodes}</g>
  </g>
</svg>`
  const graphPanel = visible.length === 0 ? svg : `${svg}${renderZoomTools()}`

  const legend = OWNERSHIPS.map((category) => {
    const count = graph.nodes.filter(node => node.ownership === category).length
    return `<li class="legend__item"><span class="swatch swatch--${category}"></span>${escapeHtml(ownershipLabel(category))} <span class="meta">${escapeHtml(t('graph.legend.count', { count }))}</span></li>`
  }).join('')

  const kindOptions = [
    option('all', t('graph.filter.all'), kind === 'all'),
    ...KINDS.map(nodeKind => option(nodeKind, kindLabel(nodeKind), kind === nodeKind)),
  ].join('')
  const ownershipOptions = [
    option('all', t('graph.filter.all'), ownership === 'all'),
    ...OWNERSHIPS.map(category => option(category, ownershipLabel(category), ownership === category)),
  ].join('')

  const body = `<header class="page-head">
  <h1>${escapeHtml(t('graph.title'))}</h1>
  <p>${escapeHtml(t('graph.subtitle'))}</p>
</header>
<form class="filters" method="get" action="${consoleHref('/graph')}" aria-label="${escapeHtml(t('graph.filter.legend'))}">
  <label class="filters__field">${escapeHtml(t('graph.filter.kind'))}<select name="kind">${kindOptions}</select></label>
  <label class="filters__field">${escapeHtml(t('graph.filter.ownership'))}<select name="ownership">${ownershipOptions}</select></label>
  <button class="button" type="submit">${escapeHtml(t('graph.filter.apply'))}</button>
</form>
<div class="split split--graph${visible.length === 0 ? '' : ' split--graph--bounded'}">
  <section class="panel graph-panel">${graphPanel}</section>
  ${renderDetail(selected, graph, kind, ownership)}
</div>
<section class="panel">
  <h2>${escapeHtml(t('graph.legend'))}</h2>
  <ul class="legend">${legend}</ul>
</section>
${renderContent(selected, options.selectedContent)}`

  return renderLayout({ title: t('graph.title'), section: 'graph', body })
}
