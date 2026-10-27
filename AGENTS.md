# AGENTS.md

全栈 TypeScript monorepo(pnpm workspaces),开发以 AI 代理/编程助手(Claude Code、Codex 等)为主导。本文件是给代理的站立命令:每条规则 1–3 行,详情链接到它唯一的家。改架构前先读 [docs/architecture.md](docs/architecture.md);文档标准见 [docs/AGENTS.md](docs/AGENTS.md);决策记录见 [.agents/notes/README.md](.agents/notes/README.md)。

## Repository layout

```text
apps/
  api/         后端服务:HTTP 路由、服务层、数据访问
  web/         前端应用:页面、组件、客户端状态
packages/
  shared/      前后端共享:类型、DTO、校验、常量
docs/          架构、开发、测试、防御模式与文档标准
.agents/       Agent Notes(notes/)与技能(skills/)
scripts/       门禁与工具脚本
```

包命名 `@devkit/<name>`(重命名项目时同步改)。`apps/*/` 是可独立运行的入口;`packages/*/` 是被消费的库,不独立运行。根 `tsconfig.json` 是类型检查工程(覆盖 `src` + `tests` + `scripts` 与根配置,`noEmit`);`apps/*`、`packages/*` 各自的 `tsconfig.json` 负责构建产出;`tsconfig.base.json` 用 `paths` 把 `@devkit/shared` 指到源码(源码平面),`tsconfig.artifacts.json` 把它指到构建后的声明(产物平面),两者分开验证。

改仓库文件前先确认[资产归属](docs/asset-ownership.md):框架资产跟随模板,混合资产按结构合并,项目资产可直接改。

## Commands

```sh
pnpm install            # pnpm workspaces,node >=24.9;postinstall 自动安装 lefthook hooks
pnpm run build          # build:artifacts + build:check
pnpm run build:artifacts # tsc -b apps/api apps/web packages/shared:只产出 artifacts
pnpm run build:check    # 读已有产物:校验包入口可加载,并把消费端按 lib 声明做类型检查
pnpm run typecheck      # tsc -p tsconfig.json,覆盖 src + tests + scripts(源码平面)
pnpm run lint           # oxlint,规则在 .oxlintrc.json;lint:fix 加 --fix
pnpm run test           # vitest run:单元与集成
pnpm run test:coverage  # vitest run --coverage
pnpm run test:e2e       # 端到端(真浏览器/真 API,无凭据自跳过)
pnpm run test:affected  # 只跑本次 diff 影响的测试
pnpm run doc-sync       # 文档门禁聚合(scripts/run-gates.ts doc-sync)
pnpm run check:all      # doc-sync + lint + typecheck + test + build
pnpm run change-scope --base <base>   # 本次 diff 范围;必须带 --base,否则报错退出 2
```

`pnpm run doc-sync` 覆盖 markdown 链接与锚点、折行、文档 TypeScript 编译、笔记分类、笔记格式、归档封存、持久化目录、持久化变更、文档预算、技能元数据这十个门禁;每个门禁是一条独立 `pnpm run` 脚本,聚合器只列名并支持 `needs` 与 fail-fast,未知 mode 退出 2。单跑某个门禁:pnpm run verify-md-links、verify-md-wrap、doc-typecheck、verify-agent-note-classification、verify-agent-note-format、verify-archived-agent-notes、verify-persistence-catalog、verify-persistence-changes、verify-doc-budgets、verify-skill-invocation-metadata。`doc-sync` 必须进 CI。

### 本地只跑相关检查

推前用 [pre-push-checks](.agents/skills/pre-push-checks/SKILL.md) 选最小证据集,报告只列实际跑过的命令:行为变更跑所属 vitest 或 `pnpm run test:affected`,文档变更跑 `pnpm run doc-sync`,lint/类型变更跑对应命令,构建或导出变更跑 `pnpm run build`。`build:artifacts` 只检查包工程;声明 TypeScript 变更完成前,要在最新一次 `build:artifacts` 之后跑 `build:check`(它读已有产物、不重新构建),或直接跑 `build`。CI 拥有全量与矩阵;不要为提交或推送默认重跑整套。

## Secrets / .env

密钥只进 gitignored 的 `.env`(根目录),永不提交凭据;E2E 无凭据时自跳过。本模板不绑定任何模型供应商,需要哪些环境变量由项目自行声明。

## Conventions

**前后端契约**
- `packages/shared` 是契约的单一来源:API 变更同 PR 更新共享 DTO、校验与消费端类型;后端只经共享 DTO 收发字段,前端不手写与后端重复的模型类型。

**数据库与迁移**
- schema 变更必须带迁移文件;迁移向后兼容,破坏性变更需显式评审。
- 持久化 schema(`apps/api/migrations/*.sql`)变更必须在同一 PR 里重新生成 `docs/persistence-catalog.md`(`pnpm run gen-persistence-catalog`)并新增一条 [持久化变更记录](docs/persistence-changes/README.md);`verify-persistence-changes` 会拒绝没有记录的 schema 变化。
- SQL 一律参数化,禁止字符串拼接;新访问路径带索引评审。

**安全与权限**
- 所有写接口必须过鉴权/授权中间件,越权路径必测;敏感字段永不落日志,日志带 request id。
- 错误响应统一 `ApiEnvelope`:`{ ok, data } | { ok: false, error: { code, message } }`。

**API 与错误**
- 控制器薄、服务层承载业务、数据访问隔离在仓储/DAO;跨层传参用显式 DTO,不用裸 `any`。
- 通用编排层(路由分发、事务、日志、网关)不吸收业务分支;业务规则放在自己的模块/包,通过注册面或投影数据接入,而不是在共享层里加条件分支。
- 业务错误与系统错误分层,HTTP 状态码语义正确;失败按 [error-handling](.agents/skills/error-handling/SKILL.md) 定义类型、处理主人、止损与最终可见报告。

**代码纪律**
- strict TS(`strict`、`noImplicitAny`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`)下编译;每个 `any` 必须解释为何无法收窄。
- 禁止新增 `as unknown` 断言(`as unknown` 或 `<unknown>`),也不要用 `as any` 绕过类型;替代写法用类型化值或在边界校验(`.oxlintrc.json` 已启用 `typescript/no-explicit-any` 等类型规则)。
- 注册/订阅/连接/定时器/流必须有 teardown 并返回 disposer:disposer 由注册面直接返回,或通过其文档化的注册句柄返回;disposer 幂等,创建者负责释放,进程重启与测试隔离下都必须可清理;生命周期、并发、子进程与异步 teardown 详见 [docs/defensive-patterns/general.md](docs/defensive-patterns/general.md)。
- 共享状态挂在服务或实例上并指定主人:禁止新增模块级可变缓存、单例、`globalThis`/`window.__X__` 或 `Symbol.for` 旁路来隐藏主人;需要上下文时从当前作用域派生。
- 无硬编码可调参数:部署差异进环境变量或配置,不写死在代码里。
- 跨边界 id 用 branded type(如 `type UserId = string & { readonly __brand: 'UserId' }`),不用裸 string。
- 信任类型化的同进程边界:跨进程、HTTP、DB、文件、队列与 worker 边界的值在边界做运行时校验;同进程类型化边界信任 TS,不为接口已保证的值添加运行时校验、兜底行为或敌意输入测试。
- 每个事实只有一个家:同一条规则只陈述一次,其余改为链接(层级见 [docs/AGENTS.md](docs/AGENTS.md))。
- 注释保持本地:不复述代码,不展开无关注释([prose-standard](.agents/skills/prose-standard/SKILL.md))。
- 客户端 UI 文案走 i18n 字典,不硬编码进组件;英文文案用 sentence case(只首词、专有名词与产品名大写,如 `Git worktrees`),中文按自身习惯。
- 文件以单个尾随换行结尾;`git diff --cached --check`(pre-commit)把关。
- 非平凡变更必须在同一 PR 附带 Agent Note;仅机械/局部编辑豁免,更新已拥有该决策的笔记即算([规则](.agents/notes/README.md)、[implemented 笔记](.agents/notes/implemented/AGENTS.md))。

**测试**
- 分层:单元(纯逻辑)→ 集成(真 DB/真服务/真 HTTP)→ E2E(真浏览器/真 API);mock 只用于昂贵或不确定的边界(网络、时钟),详见 [docs/testing.md](docs/testing.md)。
- 测试真实入口:后端经 HTTP,前端经真实组件挂载,不手拼绕过 bootstrap 的调用;断言验证外部状态,不验证自述。
- 资源自有:测试内创建的资源立即登记释放,失败/重试/超时也释放;共享 fixture 收敛到测试目录的 harness 文件,不放另一个 E2E 文件。
- 资源性、异步或平台敏感测试遵循 [ci-test-reliability](.agents/skills/ci-test-reliability/SKILL.md);评审按 [code-review](.agents/skills/code-review/SKILL.md)。

## Defensive patterns

改 package 导出与构建面、API、客户端组件与状态、共享契约,或涉及生命周期、并发、子进程与异步 teardown 前,先读 [docs/defensive-patterns/](docs/defensive-patterns/README.md) 的对应页面;其[五条评审原则](docs/defensive-patterns/README.md#为什么是这些规则)按 artifact 适用。

## Type safety and documentation

一切在 `strict: true` + `noImplicitAny` 下编译;每个模块与导出有简洁 JSDoc,函数式导出带 `@param`/`@returns`。注释与文档陈述完整契约与上下文,不写推理转写。措辞直接具体:写 `response fields`、`JSON validation`、`ESM exports` 这类准确名称,不用 `shape`、`boundary`、`surface` 指代它们;`contract` 只留给前置条件、后置条件、不变量与兼容性承诺([prose-standard](.agents/skills/prose-standard/SKILL.md))。文档随代码同步更新:受影响的 README、JSDoc 与契约同 PR 改完。

## Editing these instructions

`CLAUDE.md` 符号链接指向本文件;编辑真实文件。规则自包含并链接详情;清晰度不受损时先浓缩,文字确实需要空间时才在预算内提上限(见 [docs/AGENTS.md](docs/AGENTS.md))。

---

*模板来源:DeepSeek Harness(deepseek-ai/deepseek-harness)的 AGENTS.md 体系,按通用全栈 TypeScript 项目重写。原仓库为 MIT 协议。*
