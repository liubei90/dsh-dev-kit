/**
 * The console's single copy dictionary. Every user-visible string comes from
 * here; callers pass values for placeholders instead of concatenating text.
 */

import type {
  AssetCategory,
  GateRunStatus,
  GraphNodeKind,
  NoteClass,
  NoteLifecycle,
} from '@devkit/repo'

const messages = {
  'app.title': '仓库控制台',
  'app.brand': 'DK 控制台',
  'app.footer': '只读投影 · 数据来自当前仓库文件',
  'nav.label': '控制台导航',
  'nav.health': '健康',
  'nav.graph': '图谱',
  'nav.gates': '门禁',

  'health.title': '仓库健康',
  'health.subtitle': '决策笔记、技能、文档预算与门禁的只读视图。',
  'health.tabs.label': '健康视图',
  'health.tab.notes': '决策笔记',
  'health.tab.skills': '技能',
  'health.tab.budgets': '文档预算',
  'health.tab.gates': '门禁',
  'health.empty.notes': '没有匹配的笔记。',
  'health.empty.skills': '仓库没有技能。',
  'health.empty.budgets': '没有预算条目。',
  'health.empty.gates': '没有门禁脚本。',
  'health.filter.legend': '筛选笔记',
  'health.filter.lifecycle': '生命周期',
  'health.filter.class': '分类',
  'health.filter.all': '全部',
  'health.filter.apply': '筛选',
  'health.note.meta': '{lifecycle} · {noteClass} · {date}',
  'health.note.archived': '归档于 {date}',
  'health.note.summary': '摘要',
  'health.note.emptySummary': '没有摘要。',
  'health.skill.path': '路径',
  'health.skill.emptyDescription': '没有说明。',
  'health.budget.path': '文件',
  'health.budget.usage': '用量',
  'health.budget.value': '{used} / {limit}',
  'health.budget.over': '超预算',
  'health.gate.script': '脚本',
  'health.gate.command': '命令',
  'health.gate.open': '打开门禁页',

  'graph.title': '仓库图谱',
  'graph.subtitle': '笔记、文档与技能之间的相对链接；颜色表示资产归属。',
  'graph.filter.legend': '筛选图谱',
  'graph.filter.kind': '类型',
  'graph.filter.ownership': '归属',
  'graph.filter.all': '全部',
  'graph.filter.apply': '筛选',
  'graph.legend': '图例',
  'graph.legend.count': '{count} 个',
  'graph.column.note': '笔记',
  'graph.column.doc': '文档',
  'graph.column.skill': '技能',
  'graph.empty': '没有匹配的节点。',
  'graph.detail.title': '节点详情',
  'graph.detail.none': '未选择节点。点击图中的节点查看依赖关系。',
  'graph.detail.outbound': '链接到',
  'graph.detail.inbound': '被链接',
  'graph.detail.noLinks': '无',
  'graph.content.title': '文档内容',
  'graph.content.empty': '在图中选择一个节点查看内容。',
  'graph.content.missing': '没有可展示的内容。',

  'gates.title': '门禁',
  'gates.subtitle': '列出门禁脚本并运行；同一时间只允许一个运行。',
  'gates.catalog': '门禁目录',
  'gates.script': '脚本',
  'gates.command': '命令',
  'gates.action': '操作',
  'gates.run': '运行',
  'gates.runs': '最近运行',
  'gates.empty': '还没有运行记录。',
  'gates.run.title': '门禁运行',
  'gates.run.back': '返回门禁列表',
  'gates.run.status': '状态',
  'gates.run.started': '开始时间',
  'gates.run.duration': '耗时',
  'gates.run.durationValue': '{ms} ms',
  'gates.run.exit': '退出码',
  'gates.run.output': '输出',
  'gates.run.stdout': '标准输出',
  'gates.run.stderr': '标准错误',
  'gates.run.emptyOutput': '没有输出。',
  'gates.run.truncated': '输出已截断。',
  'gates.run.refresh': '运行中，页面会自动刷新；也可以启用 console.js 自动更新。',
  'gates.run.allowed': '只允许运行目录中的门禁脚本。',
  'gates.status.running': '运行中',
  'gates.status.success': '成功',
  'gates.status.failed': '失败',
  'gates.status.timeout': '超时',
  'gates.status.error': '错误',

  'label.lifecycle.proposed': '提案',
  'label.lifecycle.implemented': '已实现',
  'label.lifecycle.rejected': '已否决',
  'label.lifecycle.archived': '已归档',
  'label.class.feature': '功能',
  'label.class.bug-fix': '缺陷修复',
  'label.class.simplification': '简化',
  'label.class.architecture': '架构',
  'label.class.process': '流程',
  'label.class.testing': '测试',
  'label.kind.note': '笔记',
  'label.kind.doc': '文档',
  'label.kind.skill': '技能',
  'label.ownership.framework': '框架资产',
  'label.ownership.mixed': '混合资产',
  'label.ownership.project': '项目资产',

  'error.notFound': '页面不存在。',
  'error.forbidden': '请求被拒绝。',
  'error.method': '不支持的方法。',
  'error.internal': '请求无法完成。',
  'error.invalid': '请求无法读取。',
  'error.runMissing': '运行记录不存在。',
  'error.busy': '已有门禁在运行。',
  'error.home': '打开控制台',
  'error.consoleHint': '控制台位于 /_console。',
} as const

/** Every copy key the console can render. */
export type MessageKey = keyof typeof messages

/**
 * Render one copy key, replacing `{name}` placeholders.
 * @param key - dictionary key.
 * @param values - placeholder values.
 * @returns the rendered copy.
 */
export function t(key: MessageKey, values?: Readonly<Record<string, string | number>>): string {
  const template = messages[key]
  if (values === undefined) return template
  return template.replace(/\{(\w+)\}/gu, (match: string, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * Label one Agent Note lifecycle.
 * @param lifecycle - note lifecycle.
 * @returns localized label.
 */
export function lifecycleLabel(lifecycle: NoteLifecycle): string {
  switch (lifecycle) {
    case 'proposed': return t('label.lifecycle.proposed')
    case 'implemented': return t('label.lifecycle.implemented')
    case 'rejected': return t('label.lifecycle.rejected')
    case 'archived': return t('label.lifecycle.archived')
  }
}

/**
 * Label one Agent Note class.
 * @param noteClass - note class.
 * @returns localized label.
 */
export function classLabel(noteClass: NoteClass): string {
  switch (noteClass) {
    case 'feature': return t('label.class.feature')
    case 'bug-fix': return t('label.class.bug-fix')
    case 'simplification': return t('label.class.simplification')
    case 'architecture': return t('label.class.architecture')
    case 'process': return t('label.class.process')
    case 'testing': return t('label.class.testing')
  }
}

/**
 * Label one graph node kind.
 * @param kind - node kind.
 * @returns localized label.
 */
export function kindLabel(kind: GraphNodeKind): string {
  switch (kind) {
    case 'note': return t('label.kind.note')
    case 'doc': return t('label.kind.doc')
    case 'skill': return t('label.kind.skill')
  }
}

/**
 * Label one asset category.
 * @param category - asset category.
 * @returns localized label.
 */
export function ownershipLabel(category: AssetCategory): string {
  switch (category) {
    case 'framework': return t('label.ownership.framework')
    case 'mixed': return t('label.ownership.mixed')
    case 'project': return t('label.ownership.project')
  }
}

/**
 * Label one gate run status.
 * @param status - run status.
 * @returns localized label.
 */
export function runStatusLabel(status: GateRunStatus): string {
  switch (status) {
    case 'running': return t('gates.status.running')
    case 'success': return t('gates.status.success')
    case 'failed': return t('gates.status.failed')
    case 'timeout': return t('gates.status.timeout')
    case 'error': return t('gates.status.error')
  }
}
