# Agent Note: Bootstrap the runtime stack for the first feature

Status: proposed

## 问题

apps/api 与 apps/web 仍是占位符:api 导出的 createServer 只打印一行,web 导出的 mountApp 只往 DOM 写一个字符串。仓库里没有任何 HTTP 框架、数据库或 UI 框架,因此计划中的用户体系功能([feature 提案](../feature/2026-09-02-user-accounts-and-login.zh.md))在仓库采用运行时技术栈之前无法开工。框架、持久化与前端选型会决定此后每个功能的包拓扑、构建接线、开发工作流与契约位置,因此它们是一次定下并记录的架构决策。

## 提案

apps/api 变成 Fastify 应用:src/index.ts 仍是入口,一个 server 工厂组合各 feature 的路由模块与插件;路由文件保持薄,把逻辑推进 service 与 repository 层,遵循根 AGENTS.md 约定(控制器薄、服务层承载业务)。

持久化用 better-sqlite3 驱动 SQLite,置于 repository 层之后:只用参数化 SQL(禁止字符串拼接),所有表访问收在 apps/api 的 repositories 内,以便将来换 PostgreSQL 时改动可控;连接从环境变量 DATABASE_PATH 读取,缺省指向已 gitignore 的本地文件 apps/api/data/dev.sqlite,测试使用内存数据库。

schema 变更以有序 SQL 迁移文件形式落在 apps/api/migrations(NNNN_name.sql),由一个小 runner 执行并把已应用文件记录进 schema_migrations 表;runner 在 API 启动时与 pnpm migrate 脚本中都运行,记录表保证两者幂等。

apps/web 原地变成 Vite + React 应用:包名保持 @devkit/web,src 布局新增 Vite 入口(index.html、src/main.tsx、JSX 组件);其 tsconfig 在仓库 strict 旗标下编译 JSX 与 DOM lib;dev 脚本从 tsx watch 换成 vite;web 与 api 一样经 package exports 从 @devkit/shared 导入契约类型。

共享契约留在 packages/shared:已有的 ApiEnvelope 类型将扩展出本功能需要的共享 auth DTO 类型与校验助手,仍是零依赖的纯 TypeScript。

配置全部走环境变量:每个可调项(数据库路径、JWT secret、TTL)来自 .env.example 中记录的 env,不硬编码,遵循根 AGENTS.md 的"无硬编码可调参数"规则。

根编排保持原样:tsc -b 构建并类型检查三个包,vitest include 模式已覆盖 apps 与 packages,lefthook 与 CI 只需 lockfile 变化,无需结构性改动。

## 备选方案

- **Express 而非 Fastify** — 否决:Fastify 的 schema 校验、插件模型与 TS 类型化 request/response 更契合先契约后代码的约定(共享 DTO、ApiEnvelope),其生态还包含本功能使用的 JWT 插件。
- **ORM(Drizzle 或 Prisma)而非裸 SQL** — 暂缓:两张表不值得引入依赖与生成面;repositories 集中了 SQL,数据模型长大后 ORM 仍是可控的后续决策。
- **Node 内置 node:sqlite 而非 better-sqlite3** — 否决:仓库引擎下限是 Node 20.19,node:sqlite 在该范围仍为实验性且需 flag;better-sqlite3 提供预编译二进制与同步 API,让 repositories 保持简单。
- **Vue 或无框架 web 而非 React** — 否决:React 是既定产品方向,仓库的组件与 i18n 技能(vercel-react-best-practices、vercel-composition-patterns、web-design-guidelines)也面向它。
- **PostgreSQL 而非 SQLite** — 本阶段否决:SQLite 让本地与 CI 对真数据库零配置运行,满足分层测试标准;迁移与 repositories 保持可移植,Postgres 只是环境切换而非重写。
- **暂不定运行时技术栈** — 否决:用户体系功能及之后每个功能都被它阻塞;拖延只是把同一决策推进更大的 diff。

## 验收标准

干净检出上 pnpm install 成功,新栈下 pnpm run typecheck、pnpm run test、pnpm run lint、pnpm run doc-sync 全部通过。api 启动真实 Fastify 服务器,路由模块与 repository 层接线完成,一份迁移经 runner 应用并留下 schema_migrations 记录。web 提供 Vite 应用,其 tsconfig 在 DOM 与 JSX 支持下通过仓库类型检查。除 env 驱动配置外无硬编码可调项,.env.example 列出本功能读取的每个键。

## 风险

better-sqlite3 是原生依赖:若环境没有匹配 Node 版本的预编译二进制就必须现场编译,可能在 CI 镜像上失败;合并前固定版本并在 CI Node 22 镜像上验证安装可覆盖此风险。

引入 Vite 改变 web 解析 @devkit/shared 的方式(bundler 下的 package exports);shared 包保持静态 exports 映射,类型检查门禁让 web 走 tsc -b 以捕获解析漂移。

React 与 Vite 给原本零依赖的 apps 带来大量依赖与工具面;缓解手段是仓库的 React 技能,以及组件保持薄、逻辑放在类型化模块。

技术栈选型早于产品形态确定;repositories、路由模块与共享契约让缝隙足够小,框架级后悔只限于单个 app。催生本选择的 [feature 提案](../feature/2026-09-02-user-accounts-and-login.zh.md)承载用户可见行为及其自身风险。
