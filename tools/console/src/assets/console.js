// Progressive enhancement only: every page works without this file.
// 1. Poll an active gate run and reload once it settles.
// 2. Highlight the edges and endpoints around a hovered or focused graph node.
// 3. Pan the graph viewport by dragging and zoom it with the buttons or
//    Ctrl+wheel; a plain wheel keeps scrolling the page.

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

const GRAPH_MIN_SCALE = 0.5
const GRAPH_MAX_SCALE = 4
const GRAPH_DRAG_THRESHOLD = 3

function setupGraphViewport() {
  const svg = document.querySelector('[data-graph]')
  if (!(svg instanceof SVGSVGElement)) return
  const viewport = svg.querySelector('[data-graph-viewport]')
  if (!(viewport instanceof SVGGElement)) return

  const view = { scale: 1, x: 0, y: 0 }

  const apply = () => {
    viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.scale})`)
  }

  // Client coordinates to the SVG user space the viewport transform lives in.
  const toUser = (clientX, clientY) => {
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
  }

  const zoomAt = (factor, anchor) => {
    const next = Math.min(GRAPH_MAX_SCALE, Math.max(GRAPH_MIN_SCALE, view.scale * factor))
    if (next === view.scale) return
    const ratio = next / view.scale
    view.x = anchor.x - (anchor.x - view.x) * ratio
    view.y = anchor.y - (anchor.y - view.y) * ratio
    view.scale = next
    apply()
  }

  const center = () => {
    const box = svg.getBoundingClientRect()
    return toUser(box.left + box.width / 2, box.top + box.height / 2) ?? { x: 0, y: 0 }
  }

  // Plain wheels scroll the page; Ctrl/Cmd + wheel zooms around the cursor.
  svg.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return
    const anchor = toUser(event.clientX, event.clientY)
    if (!anchor) return
    event.preventDefault()
    // Line-mode wheels report small deltas; normalize so one notch zooms alike.
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1)
    zoomAt(Math.exp(-delta / 600), anchor)
  }, { passive: false })

  // Native anchor dragging would end the pointer stream mid-pan.
  svg.addEventListener('dragstart', (event) => event.preventDefault())

  let drag = null
  let suppressClick = false

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const point = toUser(event.clientX, event.clientY)
    if (!point) return
    drag = { id: event.pointerId, startX: point.x, startY: point.y, x: point.x, y: point.y, moved: false }
    suppressClick = false
  })

  svg.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return
    const point = toUser(event.clientX, event.clientY)
    if (!point) return
    if (!drag.moved) {
      if (Math.hypot(point.x - drag.startX, point.y - drag.startY) < GRAPH_DRAG_THRESHOLD) return
      // Capture only once the gesture is a pan, so a plain click still reaches
      // the node anchor and navigates.
      drag.moved = true
      svg.setPointerCapture(event.pointerId)
      svg.classList.add('is-panning')
    }
    view.x += point.x - drag.x
    view.y += point.y - drag.y
    drag.x = point.x
    drag.y = point.y
    apply()
  })

  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return
    const moved = drag.moved
    drag = null
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
    svg.classList.remove('is-panning')
    if (moved) suppressClick = true
  }
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)

  // A pan that began on a node must not navigate to that node.
  svg.addEventListener('click', (event) => {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }, true)

  const tools = document.querySelector('[data-graph-tools]')
  if (!(tools instanceof HTMLElement)) return
  tools.hidden = false
  tools.addEventListener('click', (event) => {
    const target = event.target
    const button = target instanceof Element ? target.closest('[data-graph-zoom]') : null
    if (!(button instanceof HTMLElement)) return
    const action = button.getAttribute('data-graph-zoom')
    if (action === 'reset') {
      view.scale = 1
      view.x = 0
      view.y = 0
      apply()
      return
    }
    if (action !== 'in' && action !== 'out') return
    zoomAt(action === 'in' ? 1.25 : 0.8, center())
  })
}

pollActiveRun()
highlightGraph()
setupGraphViewport()
