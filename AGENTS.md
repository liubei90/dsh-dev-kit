# AGENTS.md

全栈 TypeScript monorepo(pnpm workspaces),开发以 AI 代理/编程助手(Claude Code、Codex 等)为主导。本文件是给代理的站立命令:每条规则 1–3 行,详情链接到文档或 Agent Note。决策记录见 [.agents/notes/README.md](.agents/notes/README.md);文档标准见 [docs/AGENTS.md](docs/AGENTS.md)。

## Repository layout

```
apps/
  api/         后端服务:HTTP API、业务逻辑、数据访问(见 apps/api/README.md)
  web/         前端应用:页面、组件、客户端状态(见 apps/web/README.md)
packages/
  shared/      前后端共享:类型、DTO、校验、常量
docs/          架构、约定、cookbook、用户指南(见 docs/AGENTS.md)
.agents/       Agent Notes(`notes/`)与技能(`skills/`)
scripts/       门禁与工具脚本
```

包命名 `@devkit/<name>`(重命名项目时同步改)。`apps/*/` 是可独立运行的入口;`packages/*/` 是被消费的库,不独立运行。

## Commands

```sh
pnpm install             # 安装(会自动配置 lefthook hooks)
pnpm run dev             # 开发(各 app 内 tsx watch)
pnpm run typecheck       # 全仓 TS 检查(Project References)
pnpm run lint            # ESLint
pnpm run test            # 单元测试(vitest)
pnpm run test:coverage   # 覆盖率
pnpm run test:affected   # 只跑本次 diff 影响的测试
pnpm run test:e2e        # 端到端(真浏览器/真 DB,需环境)
pnpm run doc-sync        # 文档门禁聚合
pnpm run change-scope    # 输出本次 diff 的文件清单
pnpm run check:all       # 全部门禁(提交前可选全量)
```

### 本地只跑相关检查

推前用 [pre-push-checks](.agents/skills/pre-push-checks/SKILL.md) 选最小证据集;报告只列实际跑过的命令。规则:行为变更跑所属 vitest;文档变更跑 `doc-sync`;构建/导出变更跑 `build`;CI 拥有全量矩阵。

## Secrets / .env

密钥只进 gitignored 的 `.env`(根目录),`DEEPSEEK_API_KEY` 等按需添加;永不提交凭据。E2E 无凭据时自跳过。

## Conventions

**前后端契约**
- API 变更必须同步 OpenAPI/类型契约与消费端类型,同 PR 更新;`packages/shared` 是契约的单一来源。
- 后端只经共享 DTO 收发的字段;前端不手写与后端重复的模型类型。

**数据库与数据**
- schema 变更必须带迁移文件;迁移向后兼容;破坏性变更需显式评审。
- SQL 一律参数化,禁止字符串拼接;查询走索引,新访问路径带索引评审。

**安全与权限**
- 所有写接口必须过鉴权/授权中间件;越权测试必测。
- 错误响应格式统一 `ApiEnvelope`(`{ ok, data } | { ok: false, error: { code, message } }`)。
- 日志含 request id;敏感字段永不落日志。

**API 与错误**
- 控制器薄、服务层承载业务;跨层传参用显式 DTO,不用裸 `any`。
- 业务错误 vs 系统错误分层;HTTP 状态码语义正确。

**代码纪律**
- strict TS(`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`);`any` 必须解释为何无法收窄。
- 注册/订阅/连接必须可清理:disposer 返回、teardown 测试(HMR/热重载安全)。
- 资源(连接、定时器、进程、流)通过 teardown 释放到静默;见 [docs/defensive-patterns.md](docs/defensive-patterns.md)。
- 无硬编码可调参数:部署差异进环境变量或配置,不写死在代码里。
- 注释/JSDoc 用 [prose-standard](.agents/skills/prose-standard/SKILL.md):保留契约事实,删推理转写;函数导出带 `@param`/`@returns`。
- 跨边界 id 使用 branded type(如 `type UserId = string & { readonly __brand: 'UserId' }`),不用裸 string。
- 前后端之间跨越进程边界的值,在边界做运行时校验;同进程类型化边界信任 TS。
- 非平凡变更 MUST 在同一 PR 附带 Agent Note(见 [.agents/notes/README.md](.agents/notes/README.md#when-to-write-one))。
- 客户端 UI 文案走 i18n 字典,禁硬编码进 JSX/组件(检查脚本见 scripts/)。
- 文件以单个尾随换行结尾;`git diff --cached --check` 把关。

**测试**
- 分层:单元(纯逻辑)→ 集成(真 DB/真服务)→ E2E(真浏览器/真 API)。
- 测试验证外部状态,不验证自述;覆盖必要但不证明场景正确。
- 测试真实入口:后端经 HTTP,前端经真实组件挂载;不手拼绕过 bootstrap 的调用。
- 资源性/异步/平台敏感测试遵循 [ci-test-reliability](.agents/skills/ci-test-reliability/SKILL.md)。

## Defensive patterns

涉及生命周期、并发、子进程、异步 teardown 前读 [docs/defensive-patterns.md](docs/defensive-patterns.md)。

## Type safety and documentation

一切在 `strict: true` + `noImplicitAny` 下编译;每个模块与导出有简洁 JSDoc;注释与文档陈述完整契约而非推理过程。用词直接具体;文档随代码变更同步更新(README、JSDoc、契约)。

## Editing these instructions

`CLAUDE.md` 符号链接指向本文件;编辑真实文件。规则自包含并链接详情;超长时先浓缩,必要时才在预算内扩展(见 docs/AGENTS.md 词数预算)。

## Vendoring policy

引入外部源码副本(如有)遵循 vendor 目录规则:固定版本、记录来源、本地修改日志;升级走同步流程并重跑测试。

---

*模板来源:DeepSeek Harness(deepseek-ai/deepseek-harness)的 AGENTS.md 体系,按通用全栈 TS 项目重写。原仓库为 MIT 协议。*
