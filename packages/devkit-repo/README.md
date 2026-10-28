# @devkit/repo

仓库投影的只读数据层：把 dshDevKit 的 Agent Notes、技能、文档预算、门禁与相对链接图读成类型化数据。它是框架资产，不包含 HTTP、页面或业务模型。

## 入口

- `@devkit/repo`：浏览器安全，只导出 `contracts.ts` 里的 zod schema 与类型。
- `@devkit/repo/readers`：Node 读取器，使用 `node:fs`，只应由服务端进程导入。

```ts
import type { Health } from '@devkit/repo'
import { readHealth, readGraph } from '@devkit/repo/readers'
```

## 边界

- 读取器接收 `repoRoot`，只读文件，不写仓库，不接受请求里的路径。
- 文件边界用 zod 校验；解析失败带仓库相对路径抛错，让调用方看到坏文件，而不是静默跳过。
- 归属分类读 `docs/asset-ownership.json`：规则按顺序匹配，未命中用 `default`。
- 文档预算的计数规则与 `scripts/verify-doc-budgets.ts` 一致；代表性输入由包测试固定。
- 链接图只认相对 Markdown 链接，围栏代码、外链、锚点、绝对路径不算边；节点覆盖所有 `README.md`、`docs/**/*.md`、笔记与技能，只保留两端都是节点的链接。

## 依赖方向

`tools/console` 与业务应用可以依赖本包；本包不 import `packages/shared`、`apps/*` 或 `scripts/*`。
