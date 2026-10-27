# Agent Note: 持久化变更记录与文档类型检查

Status: implemented

## Problem

模板此前没有机制把两类容易腐烂的事实钉住。其一，`apps/api/migrations/*.sql` 改变了持久化 schema，却没有任何留痕：评审只能逐行读 diff，破坏性变更与兼容性结论不会被记录，也没有东西提醒"改完迁移要补一条说明"。其二，文档里的 TypeScript 示例从不编译：类型改名、字段调整后，示例继续以错误的形状留在文档里，直到有人照抄才暴露。

DeepSeek Harness 用 persistence-changes 与 doc-typecheck 两套门禁解决同类问题，但两者都不能直接照搬：前者的机制绑定 Session JSONL 与生成 schema（约 30 个脚本、199 个记录文件），后者包含 `type-equiv` 与生成目录分支，而本仓库既没有 Session 格式，也没有可对齐的类型目录。

## Decision

- **持久化面定义为 SQL 迁移**：`apps/api/migrations/*.sql` 按文件名顺序解析成规范化 schema（表、列、索引），对规范化文本取 sha256 作为摘要。`docs/persistence-catalog.md` 由生成器拥有，`verify-persistence-catalog` 逐字节校验新鲜度。
- **每次 schema 变化必须留一条记录**：`docs/persistence-changes/yyyy-mm-dd-<slug>.md`，头部写 `Schema-Digest` 与前驱文件名，正文必须有 `## 变更`、`## 兼容性`、`## 验证与回滚`。`verify-persistence-changes` 校验文件名与日期、前驱链、相邻摘要不同，以及链尾摘要等于当前 schema 摘要。
- **空状态合法**：没有迁移文件时 schema 为空、记录链为空，两个门禁都通过；第一次迁移落地时机制立即生效，不需要占位记录。
- **文档类型检查只覆盖 ```ts**：` ```ts ` 块用仓库自带的 tsc 编译，` ```ts ignore-check ` 跳过并计入豁免比例，上限 25%；不移植 `type-equiv`、生成目录与副本复用分支。
- **新增 `docs/web-styling.md`**：只写与实现无关的样式原则，并给出设计系统落地后的迁移路线（token 层 → 基础组件 → 页面迁移 → 门禁 → 更新文档 → 决策记录）。

## Alternatives considered

- **照搬 DSH 的 persistence 机制** —— 否决：它描述的是 Session 文件格式与生成 schema，与 SQL 迁移没有对应关系；照搬会带来数百 KB 的解析器，却仍然检查不到本仓库真正的持久化面。
- **只靠评审、不加记录** —— 否决：schema 变化没有可执行的提醒，破坏性变更最容易在评审里被放过。
- **把 doc-typecheck 扩展成 type-equiv** —— 否决：需要类型目录与逐块 manifest，模板没有可对齐的类型目录，收益低于维护成本。
- **现在就写完整的 web-styling（token 与组件路径）** —— 否决：`apps/web` 还没有设计系统，写死路径会立刻成为悬空引用；先写原则与路线，落地时再替换占位路径。

## Consequences

- `doc-sync` 从 7 个门禁变成 10 个，CI 与本地耗时略增；换来的是两类漂移（schema 无记录、文档示例不编译）会被拦住。
- SQL 解析器只支持声明的子集：`CHECK` 约束、块注释、索引表达式、schema 限定名等会带文件名与行号报错；扩展语法必须先扩解析器及其测试。
- `docs/persistence-catalog.md` 是生成物，不纳入文档预算；新增表会让它自然变长。
- `web-styling` 目前是约束未来实现的标准，不是对现状的描述；设计系统落地时按文末路线逐步替换，并把规则变成门禁。
