/**
 * Gate pages: the catalog with one run form per script, the recent run list,
 * and the single-run result page that refreshes while the process is active.
 */

import type { GateInsight, GateRun } from '@devkit/repo'
import { CONSOLE_BASE_PATH } from '../config.js'
import { escapeHtml } from '../escape.js'
import { runStatusLabel, t } from '../i18n/zh-CN.js'
import { renderLayout } from './layout.js'
import { consoleHref } from './links.js'

/** Inputs for the gate list page. */
export interface GatesPageOptions {
  readonly gates: readonly GateInsight[]
  readonly runs: readonly GateRun[]
}

/** Inputs for one run page. */
export interface GateRunPageOptions {
  readonly run: GateRun
}

/** Format one duration for display, or an empty string while running. */
function durationText(run: GateRun): string {
  return run.durationMs === undefined ? '' : t('gates.run.durationValue', { ms: run.durationMs })
}

/** Render one status badge. */
function statusBadge(run: GateRun): string {
  return `<span class="status status--${run.status}">${escapeHtml(runStatusLabel(run.status))}</span>`
}

/** Render one run link. */
function runLink(run: GateRun): string {
  return `<a href="${consoleHref('/gates/runs/' + run.id)}"><code>${escapeHtml(run.script)}</code></a>`
}

/**
 * Render the gate catalog and recent runs.
 * @param options - catalog and in-memory runs, newest first.
 * @returns the complete gate page.
 */
export function renderGatesPage(options: GatesPageOptions): string {
  const catalog = options.gates.length === 0
    ? `<p class="empty">${escapeHtml(t('health.empty.gates'))}</p>`
    : `<table class="table">
  <thead><tr><th>${escapeHtml(t('gates.script'))}</th><th>${escapeHtml(t('gates.command'))}</th><th>${escapeHtml(t('gates.action'))}</th></tr></thead>
  <tbody>${options.gates.map(gate => `<tr>
  <td class="mono">${escapeHtml(gate.script)}</td>
  <td class="mono">${escapeHtml(gate.command)}</td>
  <td><form method="post" action="${consoleHref('/gates/' + encodeURIComponent(gate.script) + '/run')}">
    <button class="button" type="submit">${escapeHtml(t('gates.run'))}</button>
  </form></td>
</tr>`).join('')}</tbody>
</table>`

  const runs = options.runs.length === 0
    ? `<p class="empty">${escapeHtml(t('gates.empty'))}</p>`
    : `<table class="table">
  <thead><tr><th>${escapeHtml(t('gates.script'))}</th><th>${escapeHtml(t('gates.run.status'))}</th><th>${escapeHtml(t('gates.run.started'))}</th><th>${escapeHtml(t('gates.run.duration'))}</th><th>${escapeHtml(t('gates.run.exit'))}</th></tr></thead>
  <tbody>${options.runs.map(run => `<tr>
  <td>${runLink(run)}</td>
  <td>${statusBadge(run)}</td>
  <td class="mono">${escapeHtml(run.startedAt)}</td>
  <td>${escapeHtml(durationText(run))}</td>
  <td class="mono">${run.exitCode === null ? '' : String(run.exitCode)}</td>
</tr>`).join('')}</tbody>
</table>`

  const body = `<header class="page-head">
  <h1>${escapeHtml(t('gates.title'))}</h1>
  <p>${escapeHtml(t('gates.subtitle'))}</p>
</header>
<section class="panel">
  <h2>${escapeHtml(t('gates.catalog'))}</h2>
  <p class="meta">${escapeHtml(t('gates.run.allowed'))}</p>
  ${catalog}
</section>
<section class="panel">
  <h2>${escapeHtml(t('gates.runs'))}</h2>
  ${runs}
</section>`

  return renderLayout({ title: t('gates.title'), section: 'gates', body })
}

/**
 * Render one gate run's status and output.
 * @param options - the run to render.
 * @returns the complete run page, refreshing every two seconds while running.
 */
export function renderGateRunPage(options: GateRunPageOptions): string {
  const { run } = options
  const running = run.status === 'running'
  const facts = [
    `<dt>${escapeHtml(t('gates.run.status'))}</dt><dd>${statusBadge(run)}</dd>`,
    `<dt>${escapeHtml(t('gates.run.started'))}</dt><dd class="mono">${escapeHtml(run.startedAt)}</dd>`,
    `<dt>${escapeHtml(t('gates.run.duration'))}</dt><dd>${escapeHtml(durationText(run))}</dd>`,
    `<dt>${escapeHtml(t('gates.run.exit'))}</dt><dd class="mono">${run.exitCode === null ? '' : String(run.exitCode)}</dd>`,
  ].join('')

  const output = (label: string, value: string): string => `<h3>${escapeHtml(label)}</h3><pre class="prose output">${escapeHtml(value === '' ? t('gates.run.emptyOutput') : value)}</pre>`

  const body = `<header class="page-head">
  <p><a href="${CONSOLE_BASE_PATH}/gates">${escapeHtml(t('gates.run.back'))}</a></p>
  <h1>${escapeHtml(t('gates.run.title'))} · <code>${escapeHtml(run.script)}</code></h1>
  <p class="mono">${escapeHtml(run.command)}</p>
</header>
<section class="panel" data-run-id="${escapeHtml(run.id)}" data-run-status="${run.status}">
  <dl class="facts">${facts}</dl>
  ${running ? `<p class="meta">${escapeHtml(t('gates.run.refresh'))}</p>` : ''}
  ${run.truncated ? `<p class="badge badge--over">${escapeHtml(t('gates.run.truncated'))}</p>` : ''}
  ${output(t('gates.run.stdout'), run.stdout)}
  ${output(t('gates.run.stderr'), run.stderr)}
</section>`

  return renderLayout({
    title: t('gates.run.title'),
    section: 'gates',
    body,
    ...(running ? { refreshSeconds: 2 } : {}),
  })
}
