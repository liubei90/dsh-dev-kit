# @devkit/console

模板自带的参考控制台：只看当前仓库，把 Agent Notes、技能、文档预算、门禁与相对链接图渲染成服务端 HTML。它是框架资产，不属于业务应用。

## 运行

```sh
pnpm run console
```

打开 `http://127.0.0.1:4310/_console`。所有页面与接口都在 `/_console` 下，`/` 返回 404；该前缀是保留命名空间，业务路由不得占用。

| 变量 | 默认值 | 含义 |
|---|---|---|
| `DEVKIT_CONSOLE_PORT` | `4310` | 监听端口 |
| `DEVKIT_CONSOLE_REPO_ROOT` | 本仓库根 | 要投影的仓库 |
| `DEVKIT_CONSOLE_GATE_TIMEOUT_MS` | `300000` | 单次门禁运行超时 |

## 技术栈

- `node:http` 路由、服务端拼 HTML、一份 CSS、一份渐进增强 JS；没有 Fastify、React 或客户端打包。
- 数据来自 `@devkit/repo/readers`，每次请求重新读取仓库文件，不缓存。
- 契约与读取器在 `packages/devkit-repo`；本目录只负责 HTTP、渲染与门禁执行。

## 页面与接口

| 路径 | 说明 |
|---|---|
| `/_console` | 健康：笔记、技能、文档预算、门禁四个标签页 |
| `/_console/graph` | 图谱：按类型分列，按归属着色，带图例与文字兜底；节点悬停显示仓库路径；Ctrl+滚轮或按钮缩放，拖拽平移；选中节点时右侧详情与画布等高、内部滚动并显示文件路径，正文在下方不设高度上限 |
| `/_console/gates` | 门禁：目录、运行表单、最近运行 |
| `/_console/gates/runs/:id` | 单次运行状态与输出 |
| `/_console/api/health`、`/api/graph`、`/api/gates` | JSON |
| `POST /_console/api/gates/:script/runs` | 启动一次运行，`202` 返回 run id |
| `GET /_console/api/gates/runs/:id` | 运行状态 |

## 门禁执行

- 默认开启；只接受 `package.json` 里 `verify-*` 与聚合脚本，请求只给脚本名。
- 一次只运行一个，第二个请求返回 409；超时或服务关闭时杀掉整个进程树。
- 每路输出截断在 256 KiB，运行记录只留在内存，最多 20 条。
- 只绑定 `127.0.0.1`；校验 `Host`，并拒绝跨站 `Origin`/`Sec-Fetch-Site` 的写请求。
- 运行会写入仓库产物（例如 `build` 写 `lib/`），这是运行门禁的固有结果。

## 渐进增强

`assets/console.js` 不参与构建：运行中的门禁页会轮询状态并在结束后刷新；图谱节点悬停或聚焦时高亮关联边；图谱可按住左键拖动平移，Ctrl+滚轮或放大、缩小、重置三个按钮缩放，工具条由脚本显示；普通滚轮仍滚动页面。禁用 JS 时链接、表单、`meta refresh` 与静态 SVG 仍然完整可用。

## 归属

框架资产：项目保留并随模板更新，不要直接改；要不同的界面就在业务应用里另建，而不是分叉这里。`docs/asset-ownership.md` 是分类的权威说明，`docs/asset-ownership.json` 是机器可读规则。
