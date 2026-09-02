# @devkit/web — Web 应用

Vite + React 19。登录/注册页(MVP 单视图)与已登录面板(`/auth/me` 后展示邮箱 + 登出)。

## 运行

- `pnpm dev`(Vite dev server)、`pnpm build`、`pnpm preview`。
- dev server 把 `/auth` 代理到 `VITE_API_PROXY_URL`(缺省 `http://localhost:3000`),页面与 API 开发期同源;部署在网关后同源。

## 约定

- 契约类型来自 `@devkit/shared`(Vite 别名直指 shared 源码,热更新免重建;类型检查仍走包产物)。
- 全部可见文案在 `src/i18n/zh.ts` typed 字典,组件零硬编码字符串(根 AGENTS.md i18n 规则);服务端错误码经字典映射,未知码回退显示码本身。
- token 存 localStorage(`auth_token`),fetch 客户端自动附 `Authorization: Bearer`,收到 401 清 token 回登录(取舍与后续 httpOnly cookie 见 feature Agent Note)。
