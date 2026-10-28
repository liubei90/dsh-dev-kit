/**
 * Health page: tabbed read-only views of Agent Notes, skills, documentation
 * budgets, and the gate catalog.
 */

import { NOTE_CLASSES, NOTE_LIFECYCLES } from '@devkit/repo'
import type {
  AgentNoteInsight,
  DocBudgetInsight,
  GateInsight,
  Health,
  NoteClass,
  NoteLifecycle,
  SkillInsight,
} from '@devkit/repo'
import { CONSOLE_BASE_PATH } from '../config.js'
import { escapeHtml, toDisplayText } from '../escape.js'
import { classLabel, lifecycleLabel, t } from '../i18n/zh-CN.js'
import { renderLayout } from './layout.js'
import { consoleHref } from './links.js'

/** Tab ids of the health view. */
export type HealthTab = 'notes' | 'skills' | 'budgets' | 'gates'

/** Lifecycle filter value; `all` disables the filter. */
type LifecycleFilter = 'all' | NoteLifecycle

/** Class filter value; `all` disables the filter. */
type ClassFilter = 'all' | NoteClass

/** Inputs for one health page render. */
export interface HealthPageOptions {
  readonly health: Health
  readonly tab: HealthTab
  readonly search: URLSearchParams
}

/**
 * Parse the active health tab.
 * @param value - raw `tab` query value.
 * @returns the known tab, defaulting to notes.
 */
export function parseHealthTab(value: string | null): HealthTab {
  if (value === 'skills' || value === 'budgets' || value === 'gates') return value
  return 'notes'
}

function parseLifecycle(value: string | null): LifecycleFilter {
  return NOTE_LIFECYCLES.some(lifecycle => lifecycle === value) ? value as NoteLifecycle : 'all'
}

function parseClass(value: string | null): ClassFilter {
  return NOTE_CLASSES.some(noteClass => noteClass === value) ? value as NoteClass : 'all'
}

/** Render one `<option>` with its selected state. */
function option(value: string, label: string, selected: boolean): string {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`
}

/** Render one tab link with the item count. */
function tabLink(tab: HealthTab, label: string, count: number, active: HealthTab): string {
  const current = tab === active ? ' aria-current="page"' : ''
  return `<a class="tab" href="${consoleHref('', [['tab', tab]])}"${current}>${escapeHtml(label)} <span class="tab__count">${String(count)}</span></a>`
}

/** Render the Agent Notes tab. */
function renderNotes(health: Health, search: URLSearchParams): string {
  const lifecycle = parseLifecycle(search.get('lifecycle'))
  const noteClass = parseClass(search.get('class'))
  const notes = health.notes.filter(note =>
    (lifecycle === 'all' || note.lifecycle === lifecycle)
    && (noteClass === 'all' || note.noteClass === noteClass))
  const selectedPath = search.get('note')
  const selected = notes.find(note => note.path === selectedPath)

  const options = [
    option('all', t('health.filter.all'), lifecycle === 'all'),
    ...NOTE_LIFECYCLES.map(value => option(value, lifecycleLabel(value), lifecycle === value)),
  ].join('')
  const classOptions = [
    option('all', t('health.filter.all'), noteClass === 'all'),
    ...NOTE_CLASSES.map(value => option(value, classLabel(value), noteClass === value)),
  ].join('')

  const list = notes.length === 0
    ? `<p class="empty">${escapeHtml(t('health.empty.notes'))}</p>`
    : `<ul class="note-list">${notes.map(note => renderNoteRow(note, selected?.path === note.path)).join('')}</ul>`

  return `<form class="filters" method="get" action="${CONSOLE_BASE_PATH}" aria-label="${escapeHtml(t('health.filter.legend'))}">
  <input type="hidden" name="tab" value="notes">
  <label class="filters__field">${escapeHtml(t('health.filter.lifecycle'))}
    <select name="lifecycle">${options}</select>
  </label>
  <label class="filters__field">${escapeHtml(t('health.filter.class'))}
    <select name="class">${classOptions}</select>
  </label>
  <button class="button" type="submit">${escapeHtml(t('health.filter.apply'))}</button>
</form>
<div class="split split--health">
  ${list}
  ${selected === undefined ? '' : renderNoteDetail(selected)}
</div>`
}

/** Render one note list row. */
function renderNoteRow(note: AgentNoteInsight, active: boolean): string {
  const meta = t('health.note.meta', {
    lifecycle: lifecycleLabel(note.lifecycle),
    noteClass: classLabel(note.noteClass),
    date: note.date,
  })
  return `<li class="note-list__item${active ? ' is-active' : ''}">
  <a class="note-list__link" href="${escapeHtml(consoleHref('', [['tab', 'notes'], ['note', note.path]]))}">${escapeHtml(note.title)}</a>
  <p class="meta">${escapeHtml(meta)}</p>
</li>`
}

/** Render the selected note's summary and sections. */
function renderNoteDetail(note: AgentNoteInsight): string {
  const archived = note.archivedOn === undefined
    ? ''
    : `<p class="meta">${escapeHtml(t('health.note.archived', { date: note.archivedOn }))}</p>`
  const sections = note.sections.map(section => `<section class="note-section">
  <h3>${escapeHtml(section.heading)}</h3>
  <pre class="prose">${escapeHtml(toDisplayText(section.body))}</pre>
</section>`).join('')

  return `<article class="panel note-detail">
  <h2>${escapeHtml(note.title)}</h2>
  <p class="meta">${escapeHtml(lifecycleLabel(note.lifecycle))} · ${escapeHtml(classLabel(note.noteClass))} · <code>${escapeHtml(note.path)}</code></p>
  ${archived}
  <h3>${escapeHtml(t('health.note.summary'))}</h3>
  <p>${escapeHtml(note.summary === '' ? t('health.note.emptySummary') : note.summary)}</p>
  ${sections}
</article>`
}

/** Render the skills tab. */
function renderSkills(skills: readonly SkillInsight[]): string {
  if (skills.length === 0) return `<p class="empty">${escapeHtml(t('health.empty.skills'))}</p>`
  return `<ul class="cards">${skills.map(skill => `<li class="card">
  <h3>${escapeHtml(skill.name)}</h3>
  <p class="mono">${escapeHtml(skill.path)}</p>
  <p>${escapeHtml(skill.description === '' ? t('health.skill.emptyDescription') : skill.description)}</p>
</li>`).join('')}</ul>`
}

/** Render one budget row. */
function renderBudget(budget: DocBudgetInsight): string {
  const over = budget.used > budget.limit
  return `<tr class="${over ? 'is-over' : ''}">
  <td class="mono">${escapeHtml(budget.path)}</td>
  <td>${escapeHtml(t('health.budget.value', { used: budget.used, limit: budget.limit }))}</td>
  <td><progress max="${String(budget.limit)}" value="${String(Math.min(budget.used, budget.limit))}"></progress>${over ? ` <span class="badge badge--over">${escapeHtml(t('health.budget.over'))}</span>` : ''}</td>
</tr>`
}

/** Render the budgets tab. */
function renderBudgets(budgets: readonly DocBudgetInsight[]): string {
  if (budgets.length === 0) return `<p class="empty">${escapeHtml(t('health.empty.budgets'))}</p>`
  return `<table class="table">
  <thead><tr><th>${escapeHtml(t('health.budget.path'))}</th><th>${escapeHtml(t('health.budget.usage'))}</th><th></th></tr></thead>
  <tbody>${budgets.map(renderBudget).join('')}</tbody>
</table>`
}

/** Render the gates tab. */
function renderGates(gates: readonly GateInsight[]): string {
  if (gates.length === 0) return `<p class="empty">${escapeHtml(t('health.empty.gates'))}</p>`
  return `<p><a class="button" href="${CONSOLE_BASE_PATH}/gates">${escapeHtml(t('health.gate.open'))}</a></p>
<table class="table">
  <thead><tr><th>${escapeHtml(t('health.gate.script'))}</th><th>${escapeHtml(t('health.gate.command'))}</th></tr></thead>
  <tbody>${gates.map(gate => `<tr><td class="mono">${escapeHtml(gate.script)}</td><td class="mono">${escapeHtml(gate.command)}</td></tr>`).join('')}</tbody>
</table>`
}

/**
 * Render the complete health page.
 * @param options - projections, active tab, and query values for filters.
 * @returns the complete page document.
 */
export function renderHealthPage(options: HealthPageOptions): string {
  const { health, tab, search } = options
  const tabs = [
    tabLink('notes', t('health.tab.notes'), health.notes.length, tab),
    tabLink('skills', t('health.tab.skills'), health.skills.length, tab),
    tabLink('budgets', t('health.tab.budgets'), health.budgets.length, tab),
    tabLink('gates', t('health.tab.gates'), health.gates.length, tab),
  ].join('')
  const content = tab === 'notes'
    ? renderNotes(health, search)
    : tab === 'skills'
      ? renderSkills(health.skills)
      : tab === 'budgets'
        ? renderBudgets(health.budgets)
        : renderGates(health.gates)

  const body = `<header class="page-head">
  <h1>${escapeHtml(t('health.title'))}</h1>
  <p>${escapeHtml(t('health.subtitle'))}</p>
</header>
<nav class="tabs" aria-label="${escapeHtml(t('health.tabs.label'))}">${tabs}</nav>
${content}`

  return renderLayout({ title: t('health.title'), section: 'health', body })
}
