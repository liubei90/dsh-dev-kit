# 架构(Architecture)

本文件是模块地图:应用如何组成、模块如何关联、扩展点在哪。**改架构前先读本页**,重大结构决策要写 Agent Note。

## 组成

```
apps/web(Vite + React)→ 经 HTTP 调用 apps/api(/auth 由 Vite dev 代理,部署走同源网关)
apps/api(Fastify)→ 路由模块 → 服务逻辑 → repository → SQLite(better-sqlite3)
packages/shared → ApiEnvelope、auth DTO/错误码、校验助手(契约单一来源)
```

- `apps/api` 与 `apps/web` 的合同见各自 README;`packages/shared` 的契约即 `src/index.ts`,是前后端共享的唯一事实源。
- 认证的决策与取舍见 [feature Agent Note](../.agents/notes/proposed/feature/2026-09-02-user-accounts-and-login.md) 与 [architecture Agent Note](../.agents/notes/proposed/architecture/2026-09-02-bootstrap-runtime-stack.md)。

## 分层规则

- 控制器薄、服务层承载业务、数据访问隔离在 repository(裸参数化 SQL,不拼接)。
- `apps/*` 之间的直接依赖禁止;共享经 `packages/shared`。
- 新能力先写 [proposed Agent Note](../.agents/notes/proposed/),评审后再实现。
- API 每个响应都走 `ApiEnvelope`;错误经 `ApiError`(status + 稳定 code)由 `setErrorHandler` 归一,404 同为 envelope(NOT_FOUND)。error handler 必须在插件注册前设置,封装上下文才会继承。

## 扩展点

- **鉴权守卫**:`apps/api/src/auth/authenticate.ts` 的 `authenticate(users)` 工厂产出 preHandler,新受保护路由挂 `{ preHandler: auth }` 即得 JWT 校验 + 用户挂载。
- **新功能路由**:在 `apps/api/src/routes/` 加 Fastify 插件并在 `createServer` 注册;服务与 repository 分文件隔离。
- **换存储**:SQL 集中在 `apps/api/src/db/`(users repository + 迁移 runner),换库只动这一层。

## 决策记录

架构决策与理由在 [Agent Notes](../.agents/notes/README.md);本页只放当前事实的地图。
