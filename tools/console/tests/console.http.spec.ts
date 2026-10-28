import { request as httpRequest } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConsole, type ConsoleHandle } from '../src/server.js'
import { createTempRepo, writeFixture, type TempRepo } from './fixture.js'

type Envelope<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

interface RunView {
  readonly id: string
  readonly script: string
  readonly status: string
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
  readonly truncated: boolean
  readonly durationMs?: number
}

interface HealthView {
  readonly notes: unknown[]
  readonly skills: unknown[]
  readonly budgets: unknown[]
  readonly gates: Array<{ readonly script: string }>
}

interface GraphView {
  readonly nodes: Array<{ readonly id: string; readonly ownership: string }>
  readonly edges: unknown[]
}

let repo: TempRepo
let handle: ConsoleHandle
let base: string

beforeEach(async () => {
  repo = createTempRepo()
  writeFixture(repo)
  handle = createConsole({
    repoRoot: repo.root,
    port: 0,
    log: false,
    gateTimeoutMs: 5_000,
    gateOutputBytes: 128,
  })
  base = await handle.listen()
})

afterEach(async () => {
  await handle.close()
  repo.cleanup()
})

/** Read one JSON envelope. */
async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  return await response.json() as Envelope<T>
}

/** Start one gate through the JSON API. */
async function startRun(script: string): Promise<RunView> {
  const response = await fetch(`${base}/_console/api/gates/${encodeURIComponent(script)}/runs`, { method: 'POST' })
  expect(response.status).toBe(202)
  expect(response.headers.get('location')).toBeDefined()
  const payload = await readEnvelope<RunView>(response)
  if (!payload.ok) throw new Error(`run start failed: ${payload.error.code}`)
  return payload.data
}

/** Poll one run until it settles. */
async function waitForSettled(id: string): Promise<RunView> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await fetch(`${base}/_console/api/gates/runs/${encodeURIComponent(id)}`)
    expect(response.status).toBe(200)
    const payload = await readEnvelope<RunView>(response)
    if (!payload.ok) throw new Error(`run read failed: ${payload.error.code}`)
    if (payload.data.status !== 'running') return payload.data
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })
  }
  throw new Error('run did not settle')
}

/** Send one request with an explicit Host header. */
function requestWithHost(url: string, host: string): Promise<number> {
  return new Promise<number>((resolveStatus, rejectStatus) => {
    const request = httpRequest(url, { headers: { host } }, (response) => {
      response.resume()
      response.once('end', () => {
        resolveStatus(response.statusCode ?? 0)
      })
    })
    request.once('error', rejectStatus)
    request.end()
  })
}

describe('console pages', () => {
  it('serves only under /_console and escapes repository text', async () => {
    const root = await fetch(`${base}/`)
    expect(root.status).toBe(404)
    expect(await root.text()).toContain('/_console')

    const page = await fetch(`${base}/_console`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toContain('text/html')
    const html = await page.text()
    expect(html).toContain('仓库健康')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('href="/_console/graph"')
    expect(html).toContain('href="/_console/gates"')
  })

  it('renders tabs and filters server-side', async () => {
    const skills = await (await fetch(`${base}/_console?tab=skills`)).text()
    expect(skills).toContain('示例技能')

    const budgets = await (await fetch(`${base}/_console?tab=budgets`)).text()
    expect(budgets).toContain('README.md')

    const gates = await (await fetch(`${base}/_console?tab=gates`)).text()
    expect(gates).toContain('verify-ok')

    const filtered = await (await fetch(`${base}/_console?tab=notes&lifecycle=proposed`)).text()
    expect(filtered).toContain('没有匹配的笔记')
  })

  it('renders the graph with ownership colors and a legend', async () => {
    const html = await (await fetch(`${base}/_console/graph`)).text()
    expect(html).toContain('graph-node--framework')
    expect(html).toContain('graph-node--mixed')
    expect(html).toContain('graph-node--project')
    expect(html).toContain('data-node=".agents/skills/demo/SKILL.md"')
    expect(html).toContain('data-from="docs/architecture.md"')
    expect(html).toContain('图例')
    expect(html).toContain('文档内容')
    expect(html).not.toContain('节点清单')
  })

  it('shows the repository path on node hover and exposes the zoom controls', async () => {
    const html = await (await fetch(`${base}/_console/graph`)).text()
    expect(html).toContain('<title>.agents/skills/demo/SKILL.md</title>')
    expect(html).toContain('<title>docs/architecture.md</title>')
    expect(html).toContain('aria-label="技能 demo · .agents/skills/demo/SKILL.md"')
    expect(html).toContain('data-graph-viewport')
    expect(html).toContain('data-graph-tools hidden')
    expect(html).toContain('data-graph-zoom="in"')
    expect(html).toContain('data-graph-zoom="out"')
    expect(html).toContain('data-graph-zoom="reset"')
    expect(html).toContain('Ctrl + 滚轮缩放，拖拽平移')
  })

  it('shows the selected node body outside the dependency panel', async () => {
    const html = await (await fetch(`${base}/_console/graph?node=README.md`)).text()
    expect(html).toContain('README_CONTENT_MARKER')
    expect(html).toContain('<pre class="prose">')
    expect(html).toContain('split split--graph split--graph--bounded')

    const detailStart = html.indexOf('class="panel graph-detail"')
    const detailEnd = html.indexOf('</aside>', detailStart)
    expect(detailStart).toBeGreaterThan(-1)
    expect(detailEnd).toBeGreaterThan(detailStart)
    const detail = html.slice(detailStart, detailEnd)
    expect(detail).toContain('<code>README.md</code>')
    expect(detail).not.toContain('README_CONTENT_MARKER')
  })

  it('filters nodes by ownership', async () => {
    const html = await (await fetch(`${base}/_console/graph?ownership=framework`)).text()
    expect(html).toContain('data-node=".agents/skills/demo/SKILL.md"')
    expect(html).not.toContain('data-node="apps/web/README.md"')
  })

  it('drops the fixed canvas height when the filters leave no nodes', async () => {
    const html = await (await fetch(`${base}/_console/graph?kind=note&ownership=framework`)).text()
    expect(html).toContain('没有匹配的节点')
    expect(html).not.toContain('split--graph--bounded')
  })

  it('renders the gate catalog with forms', async () => {
    const html = await (await fetch(`${base}/_console/gates`)).text()
    expect(html).toContain('verify-ok')
    expect(html).toContain('action="/_console/gates/verify-ok/run"')
    expect(html).toContain('doc-sync')
  })

  it('serves assets with a strict content security policy', async () => {
    const css = await fetch(`${base}/_console/assets/styles.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toContain('text/css')
    expect(css.headers.get('content-security-policy')).toContain("default-src 'none'")

    const js = await fetch(`${base}/_console/assets/console.js`)
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toContain('text/javascript')
    const source = await js.text()
    expect(source.match(/addEventListener\('wheel'/gu) ?? []).toHaveLength(1)
    expect(source).toContain('if (!event.ctrlKey && !event.metaKey) return')
    expect((await fetch(`${base}/_console/assets/missing.js`)).status).toBe(404)
  })

  it('rejects other methods and unknown routes', async () => {
    const wrongMethod = await fetch(`${base}/_console`, { method: 'POST' })
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('allow')).toBe('GET')
    expect((await fetch(`${base}/_console/unknown`)).status).toBe(404)
  })
})

describe('console security', () => {
  it('rejects a foreign Host header', async () => {
    await expect(requestWithHost(`${base}/_console`, 'evil.example')).resolves.toBe(403)
  })

  it('rejects a cross-site gate run', async () => {
    const response = await fetch(`${base}/_console/api/gates/verify-ok/runs`, {
      method: 'POST',
      headers: { Origin: 'http://evil.example' },
    })
    expect(response.status).toBe(403)
  })

  it('accepts a same-origin gate run', async () => {
    const response = await fetch(`${base}/_console/api/gates/verify-ok/runs`, {
      method: 'POST',
      headers: { Origin: base },
    })
    expect(response.status).toBe(202)
  })
})

describe('console JSON API', () => {
  it('serves health, graph, and gate projections', async () => {
    const health = await readEnvelope<HealthView>(await fetch(`${base}/_console/api/health`))
    if (!health.ok) throw new Error(health.error.message)
    expect(health.data.notes).toHaveLength(1)
    expect(health.data.skills).toHaveLength(1)
    expect(health.data.budgets).toHaveLength(2)
    expect(health.data.gates.map(gate => gate.script)).toContain('verify-ok')

    const graph = await readEnvelope<GraphView>(await fetch(`${base}/_console/api/graph`))
    if (!graph.ok) throw new Error(graph.error.message)
    const skill = graph.data.nodes.find(node => node.id === '.agents/skills/demo/SKILL.md')
    expect(skill?.ownership).toBe('framework')
    expect(graph.data.edges.length).toBeGreaterThan(0)

    const gates = await readEnvelope<{ gates: Array<{ script: string }>; runs: RunView[] }>(
      await fetch(`${base}/_console/api/gates`),
    )
    if (!gates.ok) throw new Error(gates.error.message)
    expect(gates.data.gates.map(gate => gate.script)).toContain('verify-ok')
    expect(gates.data.runs).toEqual([])
  })

  it('returns a JSON envelope for an unknown API route', async () => {
    const response = await fetch(`${base}/_console/api/missing`)
    expect(response.status).toBe(404)
    const payload = await readEnvelope<never>(response)
    expect(payload.ok).toBe(false)
  })
})

describe('gate runs', () => {
  it('runs a successful gate through the JSON API', async () => {
    const run = await startRun('verify-ok')
    const settled = await waitForSettled(run.id)
    expect(settled.status).toBe('success')
    expect(settled.exitCode).toBe(0)
    expect(settled.stdout).toContain('ok')
  })

  it('reports a failing exit code', async () => {
    const run = await startRun('verify-fail')
    const settled = await waitForSettled(run.id)
    expect(settled.status).toBe('failed')
    expect(settled.exitCode).toBe(3)
  })

  it('kills a run that exceeds the timeout', async () => {
    const run = await startRun('verify-slow')
    const settled = await waitForSettled(run.id)
    expect(settled.status).toBe('timeout')
  }, 15_000)

  it('truncates output at the configured cap', async () => {
    const run = await startRun('verify-loud')
    const settled = await waitForSettled(run.id)
    expect(settled.status).toBe('success')
    expect(settled.truncated).toBe(true)
    expect(Buffer.byteLength(settled.stdout, 'utf8')).toBeLessThanOrEqual(128)
  })

  it('rejects an unknown script', async () => {
    const response = await fetch(`${base}/_console/api/gates/dev/runs`, { method: 'POST' })
    expect(response.status).toBe(404)
  })

  it('rejects a second run while one is active', async () => {
    await startRun('verify-slow')
    const second = await fetch(`${base}/_console/api/gates/verify-ok/runs`, { method: 'POST' })
    expect(second.status).toBe(409)
  })

  it('starts from the HTML form and redirects to the run page', async () => {
    const response = await fetch(`${base}/_console/gates/verify-ok/run`, { method: 'POST', redirect: 'manual' })
    expect(response.status).toBe(303)
    const location = response.headers.get('location')
    expect(location).toMatch(/^\/_console\/gates\/runs\//u)
    const page = await (await fetch(`${base}${location ?? ''}`)).text()
    expect(page).toContain('verify-ok')
    expect(page).toContain('data-run-id')
  })

  it('returns 404 for an unknown run id', async () => {
    const response = await fetch(`${base}/_console/api/gates/runs/not-a-run`)
    expect(response.status).toBe(404)
  })

  it('closes idempotently', async () => {
    await handle.close()
    await handle.close()
  })
})
