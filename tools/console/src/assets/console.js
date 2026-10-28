// Progressive enhancement only: every page works without this file.
// 1. Poll an active gate run and reload once it settles.
// 2. Highlight the edges and endpoints around a hovered or focused graph node.

const BASE = '/_console'

function pollActiveRun() {
  const panel = document.querySelector('[data-run-id]')
  if (!(panel instanceof HTMLElement)) return
  if (panel.dataset.runStatus !== 'running') return

  const refresh = document.querySelector('meta[http-equiv="refresh"]')
  if (refresh) refresh.remove()

  const runId = panel.dataset.runId
  if (!runId) return

  const tick = async () => {
    try {
      const response = await fetch(`${BASE}/api/gates/runs/${encodeURIComponent(runId)}`)
      if (!response.ok) return
      const payload = await response.json()
      if (!payload.ok) return
      if (payload.data.status !== 'running') {
        window.location.reload()
        return
      }
    } catch {
      // The server may be shutting down; the meta-refresh fallback is gone,
      // so stop silently and let the user reload.
      return
    }
    window.setTimeout(tick, 1000)
  }
  window.setTimeout(tick, 500)
}

function highlightGraph() {
  const svg = document.querySelector('[data-graph]')
  if (!(svg instanceof SVGSVGElement)) return

  const edges = Array.from(svg.querySelectorAll('[data-from]'))
  const nodes = Array.from(svg.querySelectorAll('[data-node]'))

  const clear = () => {
    for (const edge of edges) edge.classList.remove('edge--active')
    for (const node of nodes) node.classList.remove('graph-node--related')
  }

  const activate = (id) => {
    if (!id) return
    const related = new Set([id])
    for (const edge of edges) {
      const active = edge.dataset.from === id || edge.dataset.to === id
      edge.classList.toggle('edge--active', active)
      if (active) {
        if (edge.dataset.from) related.add(edge.dataset.from)
        if (edge.dataset.to) related.add(edge.dataset.to)
      }
    }
    for (const node of nodes) {
      node.classList.toggle('graph-node--related', related.has(node.dataset.node))
    }
  }

  const nodeFromEvent = (event) => {
    const target = event.target
    return target instanceof Element ? target.closest('[data-node]') : null
  }

  svg.addEventListener('pointerover', (event) => {
    const node = nodeFromEvent(event)
    if (node) activate(node.getAttribute('data-node'))
  })
  svg.addEventListener('pointerout', clear)
  svg.addEventListener('focusin', (event) => {
    const node = nodeFromEvent(event)
    if (node) activate(node.getAttribute('data-node'))
  })
  svg.addEventListener('focusout', clear)
}

pollActiveRun()
highlightGraph()
