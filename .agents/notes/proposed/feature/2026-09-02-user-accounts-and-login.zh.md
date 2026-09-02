# Agent Note: User accounts and login

Status: proposed

## 问题

产品需要身份:一个人用邮箱与密码注册、登录,受保护的路由能识别调用者是谁。目前什么都没有——没有 users 表、没有认证代码、没有客户端接线——而且两个 app 尚无运行时技术栈。本提案在[运行时技术栈提案](../architecture/2026-09-02-bootstrap-runtime-stack.zh.md)之上定义 MVP 能力(注册、登录、登出、当前用户、鉴权守卫);角色、找回密码、邮箱验证与 refresh-token 轮换不在本次范围内。

## 提案

数据模型:users 表(id TEXT 主键,存放 crypto.randomUUID 值;email TEXT 唯一且存储前转小写并去空白;password_hash TEXT;created_at TEXT),由第一份 schema 迁移创建,email 上有唯一索引;用户 id 跨进程边界时使用 branded UserId 类型,遵循根 AGENTS.md 的 id 规则。

密码用 Node 内置 crypto.scrypt 哈希:每用户 16 字节随机盐,固定参数(N=16384, r=8, p=1),以自描述的 `scrypt$N$r$p$<salt b64>$<hash b64>` 存储,将来参数可改而不破坏存量哈希;校验用 timingSafeEqual 比较。注册要求语法合法的邮箱与至少 8 字符的密码;归一化与校验助手在 packages/shared 中只写一份,API 在路由边界应用。

认证端点,线上契约收在共享 DTO,每个响应都遵循 ApiEnvelope 形态:

- POST /auth/register { email, password } → 201 返回公开 user;邮箱非法或密码过短返回 400(EMAIL_INVALID、PASSWORD_TOO_SHORT),邮箱已占用返回 409(EMAIL_TAKEN)。
- POST /auth/login { email, password } → 200 { token, user };任何凭据失败都返回同一个 401 INVALID_CREDENTIALS,登录不可枚举账号。
- GET /auth/me(带 Authorization: Bearer <token>)→ 200 { user };token 缺失、过期或非法返回 401 UNAUTHORIZED。
- POST /auth/logout → 204;无状态 JWT 下该端点存在是为了记录"客户端丢弃其存储的 token"这一语义——它无法在服务端撤销。

令牌:@fastify/jwt 用 JWT_SECRET 环境变量签发 HS256 JWT,payload 为 sub = 用户 id,过期时间来自 JWT_TTL 环境变量(缺省 1 小时)。鉴权守卫助手校验 Bearer token、挂载用户,并把失败转成 UNAUTHORIZED envelope;只有守卫之后的路由能看见用户。JWT_SECRET 在测试之外必填并在 .env.example 记录;测试注入固定 secret。

Web(apps/web):登录页在单一 MVP 视图中同时渲染登录与注册表单,由一个小型 typed fetch 包装驱动:它附带 Bearer token、存进 localStorage,收到 401 就清除并回到登录。登录成功存 token 并请求 /auth/me 展示已登录邮箱与登出动作。所有可见文案来自 apps/web 内的 typed 字典模块(缺省中文):字段标签、占位符、按钮,以及上述错误码到文案的稳定映射,组件不硬编码任何字符串,遵循根 AGENTS.md 的 i18n 规则。

开发接线:Vite dev server 把 /auth 代理到 API 源(VITE_API_PROXY_URL env),开发时页面与 API 同源;部署在网关后同源服务。

## 备选方案

- **httpOnly 会话 cookie 与服务端 session** — 否决:产品选择无状态 JWT,换取更简单的跨源故事与无 session 表;代价——无法服务端撤销——已接受并记入风险。
- **短命 access JWT + refresh token** — MVP 否决:refresh 的存储与轮换给客户端与服务端增加首个切片用不上的面;当会话需要活过 TTL 时再议。
- **bcrypt 或 argon2 做密码哈希** — 否决:两者都是原生依赖;scrypt 随 Node 内置、内存硬,配合 timingSafeEqual 比较在无编译步骤的前提下满足同一需求。
- **注册即自动登录(直接返回 token)** — 否决:注册与登录保持正交、各有一个清晰契约;登录页把两步流程显式化。
- **管理员创建或邀请制账号** — MVP 否决:开放注册是诉求形态;角色与邀请属于后续决策。
- **认证失败只返回裸 HTTP 状态** — 否决:包括 401 路径在内每个响应都保持 ApiEnvelope 形态,客户端只有一条解析路径。

## 验收标准

在内存数据库之上走真实 HTTP:register → login → /auth/me 全链路贯通;重复邮箱注册返回 409 EMAIL_TAKEN;错误密码与未知邮箱都返回完全相同的 401 INVALID_CREDENTIALS;/auth/me 无 token、畸形或过期 token 返回 UNAUTHORIZED envelope,合法 token 返回用户。密码哈希永不等于明文密码,且永不出现在响应或日志。web 从 typed 字典渲染登录/注册视图,对着 dev 代理走通两个流程,/auth/me 后展示已登录邮箱,登出回到登录。E2E 在环境允许时用真数据库驱动真实页面,否则按仓库 E2E 约定自跳过。单元测试覆盖邮箱归一化、校验规则、密码哈希/校验往返,包括错误密码与被篡改哈希。

## 风险

无状态 JWT 无法撤销:被盗 token 在 JWT_TTL 前一直有效,登出只丢弃客户端副本。缓解是短缺省 TTL 与部署环境使用 HTTPS;若会话必须可撤销,服务端 denylist 或 refresh 轮换是已记录的后续项。

token 存在 localStorage,XSS 读取即可外泄。缓解是 React 转义、禁用 dangerouslySetInnerHTML,以及部署的 web 应用加 Content-Security-Policy;若威胁模型要求,把 token 移进 httpOnly cookie 是已记录的后续项。

MVP 不含暴力破解防护(限流、锁定);API 公网暴露前应部署在限流器之后或补上限流。

开放注册接纳任何持有效邮箱的人,并通过 409 EMAIL_TAKEN 泄露哪些邮箱已被占用;这是开放注册的固有问题,MVP 接受。

密码策略只有长度(至少 8 字符);复杂度规则与泄露密码库检查延后,因哈希自描述,收紧无需 schema 变更。
