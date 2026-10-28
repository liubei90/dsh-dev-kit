# Agent Note: 框架与业务资产的分离与独立升级

Status: proposed

## Problem

框架资产与业务资产住在同一个 git 仓库里，用 [资产归属清单](../../../../docs/asset-ownership.json) 区分框架、混合与项目三类。业务仓库从模板克隆后，框架升级等于把模板改动 `git merge` 回业务仓库：改动撞上业务编辑过的文件就要人工解冲突，升级节奏被业务发布节奏绑住，业务也无法确认自己落后框架多少。目标是让框架独立发布、独立升级，业务仓库只留业务代码、一份配置和少量必须落在仓库里的框架内容。

一个硬约束决定了分离的形态：`AGENTS.md`、`.agents/notes`、`.agents/skills` 是 agent 按路径读取的仓库文件，必须被 git 跟踪。这类内容不能被运行时“加载进来”，只能写进业务仓库并钉住版本。因此分离的对象是执行引擎，不是全部框架内容；纯服务托管模型无法覆盖内容资产。

## Proposal

按“引擎外置、内容随仓库、胶水随项目”三层拆分，框架以命令行工具发布，控制台降级为它的一个子命令。

- **引擎外置**：`packages/devkit-repo` 与 11 个文档门禁脚本移出业务仓库，成为独立仓库里的 `@devkit/cli`；`tools/console` 变成 `devkit console --root .`。现有读取器已全部接受 `repoRoot` 参数（[health.ts](../../../../packages/devkit-repo/src/health.ts)、[gates.ts](../../../../packages/devkit-repo/src/gates.ts)、[ownership.ts](../../../../packages/devkit-repo/src/ownership.ts)），控制台也已支持 `DEVKIT_CONSOLE_REPO_ROOT`（[config.ts](../../../../tools/console/src/config.ts)），所以进程边界不需要新的数据架构，只需要换掉调用方。
- **门禁目录反转**：现在门禁的执行依赖业务 `package.json` 里有 `verify-*` 脚本，框架只负责 `pnpm run <script>`（[gates.ts](../../../../packages/devkit-repo/src/gates.ts) 的白名单加 [run-gates.ts](../../../../scripts/run-gates.ts) 的固定工作目录）。改为 CLI 自带门禁实现与目录；需要项目工具链的检查通过显式契约调用 `node_modules/.bin/tsc`、`vitest run` 这类已安装的可执行文件，不依赖脚本命名。业务 `package.json` 只剩业务脚本。
- **仓库形状进配置**：新增 `devkit.config.json`，声明源码根（`sources`）、持久化目录与迁移目录、文档预算上限、控制台端口、`engineVersion` 与 `contentVersion`。今天硬编码在脚本里的布局假设（`apps/api/migrations`、README 发现规则、预算清单路径）改为从这里读，业务不再被迫采用 `apps/` 与 `packages/` 两级布局。
- **内容升级复用归属规则**：`devkit upgrade` 按资产归属做三方合并——`framework` 直接覆盖，`mixed` 逐行合并并列出冲突，`project` 保留；冲突清单即升级影响报告，图谱节点按同样分类标色。资产归属从审计工具升级为升级策略，这是本次分离最主要的复用，而不是新增机制。
- **扩展点收窄为注册**：业务要加门禁只能注册脚本、依赖顺序与标签，不能修改框架实现；注册面是唯一扩展点，超时、并发、进程树清理与输出截断仍由 CLI 控制。
- **胶水留在项目**：`.github/workflows`、`lefthook.yml`、`tsconfig*`、`package.json` 永远属于业务仓库，CLI 只能提供可粘贴的片段与 `devkit doctor` 的诊断结论，不能接管它们。
- **诊断与兼容**：`devkit doctor` 比对引擎版本、内容版本、Node 版本与工具链版本，报告偏移；框架声明最低 `contentVersion`，新门禁拒绝读旧格式内容时给出明确迁移提示。

## 开放问题

- 业务仓库数量决定收益：1–2 个仓库时，“独立升级”主要省的是合并冲突；5 个以上才形成发布节奏上的实际收益。
- 业务是否可以 `import` 框架的读取器：建议首版只发布 CLI，读取器不对外，避免业务的 `zod` 版本与框架绑定；若将来允许，读取器必须单独版本化。
- 升级由谁执行：人工跑 `devkit upgrade` 并评审冲突，还是由 agent 自动执行并产出报告；混合文件的合并质量比自动化程度更关键。
- 框架自身的开发回环：框架改动要在常驻的 fixture 业务仓库上跑门禁，demo 仓库可以承担这个角色，但需要固定分支与升级基线。

## Alternatives considered

- **保持模板合并（现状）** —— 落选：`git merge` 让框架改动与业务改动进入同一批提交，升级无法回滚到“只升级框架”，业务也无法确认落后程度。资产归属清单只能审计，不能推动升级。
- **框架做成常驻 web 服务，业务目录挂载** —— 落选：`AGENTS.md`、笔记与技能必须留在业务仓库供 agent 读取，服务无法交付这部分内容；若服务负责注入内容，业务仓库仍有文件副本，等于回到内容随仓库的方案再加一层运行时，收益不变而运维面变大。
- **git submodule 或 pnpm workspace 指向框架仓库** —— 落选：这解决代码同步，不解决内容合并与版本偏移报告；submodule 还会把 agent 指令钉在业务仓库自己的提交上，升级要改业务仓库指针，冲突转移到指针那一层。
- **只外置代码，不做内容同步** —— 落选：框架内容（指令、技能、防御模式、门禁规范）是升级收益的主体；只搬代码留下最难维护的一半，业务仍要手工合并文档改动。
- **把读取器留在业务仓库，只外置控制台** —— 落选：读取器与门禁共享笔记格式、预算计数、链接解析与归属规则；拆开会出现两份同类事实，门禁升级就失效。

## Acceptance criteria

- 新建业务仓库只需要 `devkit.config.json` 与一条 `devDependency`，不复制框架源码，`devkit check doc` 能跑通全部 11 个文档门禁。
- 业务 `package.json` 不含任何 `verify-*` 脚本，业务源码布局与 `apps/`、`packages/` 无关。
- 框架发布新版本后，`devkit upgrade` 在业务仓库产出一份可评审的改动集：`framework` 文件零人工编辑，`mixed` 冲突逐条列出，`project` 文件不被触碰。
- `devkit console --root .` 的路由、门禁目录、回环监听、`Host`/`Origin` 校验与 CSP 行为与当前 `pnpm run console` 一致。
- 框架自身 CI 用一个 fixture 业务仓库跑一遍完整门禁，覆盖“业务布局非默认”的场景。

## Risks

- **开发回环变长**：类型反馈从 `tsconfig` 源码平面变成声明文件，框架接口破坏要等 fixture 的构建才暴露；需要 fixture 的 `build:check` 进入框架 CI。
- **版本偏移**：引擎与内容独立升级，新门禁可能遇到旧格式内容；只能靠 `contentVersion` 下限与 `doctor` 提示兜底，兜底不完整时会以门禁报错的形式暴露在业务仓库。
- **混合文件无法独立升级**：`AGENTS.md`、`package.json`、`tsconfig*`、CI 工作流同时承载框架规则与业务选择，三方合并冲突是长期成本，不会随分离消失。
- **权限面变化**：CLI 在业务仓库执行门禁与写产物；若将来扩展成托管多个仓库的常驻服务，它同时握着多个仓库的写权限，回环监听与 CSP 只是最低要求。
- **迁移成本**：现有模板使用者要一次性搬迁仓库结构，这次搬迁本身没有测试基线；迁移工具的缺陷会以“门禁通过但内容缺失”的形式静默存在。
- **放弃的东西**：单仓库内“改一行框架代码立刻在业务里生效”的即时性，以及模板作为唯一自包含产物的简单性（新项目从 clone 一个仓库变成 clone 加安装 CLI）。
- **与既有笔记的关系**：实施后，[参考控制台](../../implemented/feature/2026-10-28-reference-console.md) 中“控制台位于 `tools/console`”的落点会被取代，其“数据层与渲染分层、不绑定 Web 框架”的决定继续有效。
