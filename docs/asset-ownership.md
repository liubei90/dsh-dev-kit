# 资产归属(Asset ownership)

本页按“谁负责更新”给仓库文件分类。用模板创建项目后,按这里决定哪些文件可以直接改、哪些要跟模板保持一致。类别是约定;机器可读规则在 [asset-ownership.json](asset-ownership.json),由 `verify-asset-ownership` 校验。归错类不会自动改文件,但模板更新时会冲突。

## 三类资产

| 类别 | 维护者 | 改动方式 | 典型路径 |
|---|---|---|---|
| 框架资产 | 模板 | 项目内不改;改进提上游,扩展用新文件 | 技能、防御模式、门禁、lint 与 hooks |
| 混合资产 | 模板 + 项目 | 保留模板段落与键,只追加项目内容 | `AGENTS.md`、开发/测试指南、`package.json`、CI、预算清单 |
| 项目资产 | 项目 | 直接改;模板更新不覆盖 | 笔记、架构、README、`apps/`、`packages/shared` |

## 路径对照

| 路径 | 类别 | 说明 |
|---|---|---|
| `.agents/skills/**` | 框架 | 方法论技能;项目专属技能新建 `project-<name>` 目录,不要改现有技能 |
| `.agents/notes/**` | 项目 | 本项目的决策记录;模板的笔记只是模板历史,不要随更新复制新笔记 |
| `.agents/notes/README.md` | 框架 | 笔记格式规则;项目自己的规则写进 `AGENTS.md` |
| `AGENTS.md` | 混合 | 模板段落保持原样,项目命令追加到对应小节 |
| `docs/AGENTS.md` | 框架 | 文档标准 |
| `docs/architecture.md` | 项目 | 项目自己的模块地图 |
| `docs/development.md` | 混合 | 通用流程保留,项目命令与环境补充 |
| `docs/testing.md` | 混合 | 分层规则保留,项目测试工具与命令补充 |
| `docs/defensive-patterns/**` | 框架 | 评审规则;项目专属规则放独立页面 |
| `docs/asset-ownership.md`、`docs/asset-ownership.json` | 框架 | 分类说明与机器可读规则;门禁校验 |
| `docs/web-styling.md` | 混合 | 样式原则保留,项目补充自己的令牌与组件路径 |
| `packages/devkit-repo/**` | 框架 | 仓库投影契约与读取器;改进提上游 |
| `tools/console/**` | 框架 | 参考控制台;项目保留,不直接改 |
| `scripts/verify-*.ts`、`run-gates.ts` 等 | 框架 | 门禁实现;项目新增门禁用新脚本并在 `package.json` 注册 |
| `scripts/doc-budgets.manifest.json` | 混合 | 机制属框架;每个文件的路径与上限属项目,更新时只补键 |
| `package.json` | 混合 | `name`、`version`、`description` 与业务脚本属项目;门禁脚本与工具链依赖属框架 |
| `.oxlintrc.json`、`lefthook.yml` | 框架 | 工具链规则;项目确有差异时单独说明 |
| `tsconfig*.json`、`vitest*.config.ts` | 混合 | 编译与测试基础设施;`paths` 与项目别名属项目 |
| `apps/**`、`packages/shared/**` | 项目 | 业务代码;框架库见上方的 `packages/devkit-repo` |
| `README.md` | 项目 | 项目说明;替换模板介绍 |
| `.env*`、`.data/`、`deploy/` | 项目 | 环境、数据与部署 |

## 判断规则

- 扩展框架能力时新建文件,不改已有文件:技能用 `.agents/skills/project-<name>/SKILL.md`,评审规则用 `docs/defensive-patterns/project-<topic>.md`,门禁用 `scripts/verify-<name>.ts` 并在 `package.json` 注册。
- 修改混合资产时保留模板段落与键,只追加项目内容。
- 项目资产不需要对照模板;模板更新时只对照框架与混合资产。

## 常见误区

- 把模板笔记复制进项目:笔记是决策记录,不是可下发资产;模板约定已经写在技能、门禁与防御模式里。
- 直接改现有技能:项目改动会挡住模板更新;需要差异就新建 `project-*` 技能,并考虑把通用改进提回模板。
- 整体覆盖 `doc-budgets.manifest.json`:会丢掉项目自己的预算条目。
- 整篇替换 `AGENTS.md`:会丢掉项目命令与本地流程。
