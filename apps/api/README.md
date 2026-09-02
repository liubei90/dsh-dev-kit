# @devkit/api — HTTP API 服务

Fastify 5 + better-sqlite3。业务逻辑在 route handler 内调 service/repository 层;所有表访问在 `src/db/`。

## 配置(环境变量,示例见根 `.env.example`)

- `JWT_SECRET` — 必填,HS256 签名密钥(测试外缺失会启动失败)。
- `DATABASE_PATH` — SQLite 文件路径,缺省 `apps/api/data/dev.sqlite`(已 gitignore);测试用 `:memory:`。
- `JWT_TTL` — token 有效期(缺省 `1h`);`PORT` — 监听端口(缺省 3000)。

## 迁移

- `apps/api/migrations/NNNN_*.sql` 按序执行,已应用记录在 `schema_migrations`;启动时与 `pnpm migrate` 都会跑,幂等。
- schema 变更必须带迁移文件且向后兼容(根 AGENTS.md)。

## 认证契约

- `POST /auth/register|login`、`GET /auth/me`(Bearer)、`POST /auth/logout`(204,客户端丢弃 token,无状态 JWT 无法服务端撤销)。
- 密码以 Node scrypt 自描述哈希(`scrypt$N$r$p$<salt>$<hash>`)存储,`timingSafeEqual` 校验。
- 契约类型/校验/错误码单一来源在 `@devkit/shared`;错误统一 `ApiEnvelope`,认证失败码 `EMAIL_INVALID / PASSWORD_TOO_SHORT / EMAIL_TAKEN / INVALID_CREDENTIALS / UNAUTHORIZED`。

## 运行与测试

- `pnpm dev`(tsx watch)、`pnpm migrate`;集成测试经 `app.inject` 走真 HTTP + `:memory:` 真引擎;E2E(`tests/*.e2e.ts`)spawn 真实入口进程走真 TCP,无需外部凭据。
