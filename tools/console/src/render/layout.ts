/**
 * The shared HTML shell for every console page: title, primary navigation,
 * stylesheet, progressive-enhancement script, and footer.
 */

import { CONSOLE_BASE_PATH } from '../config.js'
import { escapeHtml } from '../escape.js'
import { t } from '../i18n/zh-CN.js'

/** Main console sections; one is marked as the active navigation item. */
export type ConsoleSection = 'health' | 'graph' | 'gates'

/** Inputs for the shared page shell. */
export interface LayoutOptions {
  readonly title: string
  readonly section: ConsoleSection
  readonly body: string
  /** Add a meta refresh while a gate run is still settling. */
  readonly refreshSeconds?: number
}

/** Render one navigation item. */
function navItem(section: ConsoleSection, active: ConsoleSection, href: string, label: string): string {
  const current = section === active ? ' aria-current="page"' : ''
  return `<a class="nav__link" href="${href}"${current}>${escapeHtml(label)}</a>`
}

/**
 * Render one complete HTML page.
 * @param options - title, active section, and already-rendered body.
 * @returns the escaped HTML document.
 */
export function renderLayout(options: LayoutOptions): string {
  const refresh = options.refreshSeconds === undefined
    ? ''
    : `<meta http-equiv="refresh" content="${String(options.refreshSeconds)}">`
  const nav = [
    navItem('health', options.section, CONSOLE_BASE_PATH, t('nav.health')),
    navItem('graph', options.section, `${CONSOLE_BASE_PATH}/graph`, t('nav.graph')),
    navItem('gates', options.section, `${CONSOLE_BASE_PATH}/gates`, t('nav.gates')),
  ].join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${refresh}
<title>${escapeHtml(options.title)} · ${escapeHtml(t('app.title'))}</title>
<link rel="stylesheet" href="${CONSOLE_BASE_PATH}/assets/styles.css">
<script type="module" src="${CONSOLE_BASE_PATH}/assets/console.js" defer></script>
</head>
<body>
<header class="topbar">
  <a class="brand" href="${CONSOLE_BASE_PATH}">${escapeHtml(t('app.brand'))}</a>
  <nav class="nav" aria-label="${escapeHtml(t('nav.label'))}">${nav}</nav>
</header>
<main class="console" id="main">${options.body}</main>
<footer class="footer">${escapeHtml(t('app.footer'))}</footer>
</body>
</html>`
}

/**
 * Render one error page.
 * @param status - HTTP status to show in the heading.
 * @param message - escaped-by-this-function error message.
 * @returns the complete error page.
 */
export function renderErrorPage(status: number, message: string): string {
  return renderLayout({
    title: message,
    section: 'health',
    body: `<section class="panel error">
  <p class="error__status">${escapeHtml(String(status))}</p>
  <h1>${escapeHtml(message)}</h1>
  <p><a class="button" href="${CONSOLE_BASE_PATH}">${escapeHtml(t('error.home'))}</a></p>
</section>`,
  })
}
