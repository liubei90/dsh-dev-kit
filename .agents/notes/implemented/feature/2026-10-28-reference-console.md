# Agent Note: 参考控制台

Status: implemented

## Problem

模板的 AI 开发体系只以文件形式存在:Agent Notes、技能、文档预算与门禁要读文件或跑命令才能感知,demo 仓库为此做了健康看板、知识图谱与门禁页。那套实现把读取器、HTTP、React 页面与多项目注册表放在一起,无法直接搬进模板:框架事实(笔记格式、预算计数、门禁目录、相对链接)与项目选择(React、路由、样式、注册表)混在同一层,复制到新项目后改进也不会回传。模板需要一个只看自己的参考控制台,把框架事实做成可浏览的数据,同时不绑定 Web 框架。

## Decision

模板新增自看式只读控制台:服务端渲染、`/_console` 前缀、无 Fastify/React,门禁默认可以运行。框架事实与业务交付分层。

- **数据层**:`packages/devkit-repo` 持有 zod 契约与读取器(笔记、技能、文档预算、门禁目录、链接图)以及归属分类器;根出口浏览器安全,`./readers` 使用 Node 文件系统。依赖方向只有 `tools/console → packages/devkit-repo`,框架包不 import `packages/shared`、`apps/*` 或 `scripts/*`。
- **控制台**:`tools/console` 用 `node:http` 路由、服务端拼 HTML、一份 CSS 与一份无构建的渐进增强 JS;标签页、筛选、详情与门禁表单都无需 JS。`/_console` 是保留前缀,`/` 返回 404,所有链接与表单 action 都从同一常量生成。图谱把仓库路径作为节点的 SVG 悬停标题与无障碍名称的一部分;画布可左键拖拽平移,缩放走 Ctrl+滚轮与工具条按钮,普通滚轮留给页面滚动;选中节点时详情显示文件路径、与画布等高并在面板内滚动,正文出现在下方且不设高度上限;拖拽后不会误触节点链接,脚本缺失时保持初始视图。
- **只看自己**:没有项目注册表、`dshDevKit` 标记校验、目录浏览或项目选择器;仓库根从模块位置推导,测试与环境变量覆盖。
- **门禁**:列表与运行都迁入;目录是 `verify-*` 加 `doc-sync`、`check:all`、`lint`、`typecheck`、`test`、`test:coverage`、`build`。默认开启,但请求只给脚本名,一次只运行一个,第二个返回 409;超时(默认 300 秒)、每路输出截断 256 KiB、超时或关闭时杀掉整个进程树;记录只在内存,最多 20 条。
- **安全**:只绑定 `127.0.0.1`;校验 `Host`,并拒绝跨站 `Origin`/`Sec-Fetch-Site` 的写请求;响应带 CSP 与 `nosniff`;所有仓库文本先转义,笔记正文按纯文本渲染。
- **归属**:`docs/asset-ownership.json` 是机器可读规则,`verify-asset-ownership` 校验每条规则至少命中一个文件、没有路径被两类同时认领,并要求清单把自身标为框架资产。图谱节点带 `ownership`,颜色区分框架/混合/项目,图例给出定义与数量;节点范围包含所有 `README.md`、`docs/**/*.md`、笔记与技能,选中节点时在下方内容区展示正文,右侧详情只列链接关系。
- **取代**:本决策取代 demo 仓库 `demo/dsh-dev-kit` 在提交 `985f153` 中做出的"不把控制台 UI 搬进模板"判断。那个控制台是多项目工具,demo 可能废弃;本控制台不依赖它的代码。
- **依赖**:`zod` 与 `mdast-util-from-markdown` 是框架包新增的运行时依赖;前者校验契约,后者解析 Markdown 链接,避免另写一套围栏与外链过滤。

## Alternatives considered

- **Fastify + React 照搬 demo** —— 否决:模板会绑定 Web 框架,空白骨架变成自带运维界面的应用;服务端渲染已够参考控制台使用。
- **vendor Fastify、React、zod** —— 否决:Fastify 与 ReactDOM 各自带依赖树,拉源码等于维护分叉;zod 零依赖可以 vendor,但只用于服务端文件边界,普通依赖的维护成本更低。契约集中在 `packages/devkit-repo`,将来真要零依赖只改这一处。
- **浏览器端 SPA(仍不用 React)** —— 否决:需要打包器、DOM 测试环境与手写路由,交互收益不足以抵消依赖与测试成本。
- **多项目注册表一起迁移** —— 否决:本模板只要看自己;注册表、标记、目录浏览与路径安全属于另一个产品范围,demo 可以保留。
- **门禁运行默认关闭** —— 否决:用户选择默认开启;代价用目录白名单、并发 1、超时、进程树清理、CSP、Host/Origin 校验与仅回环监听控制。
- **把控制台放 `apps/console`** —— 否决:`apps/**` 是业务项目资产,放进去会让框架工具与业务应用混在一起;`tools/console` 保持 `apps/` 留白。
- **整段复制 demo 的读取器与页面** —— 否决:会把框架事实复制成项目资产,预算计数、笔记格式、门禁目录与链接解析各多一份;抽出 `@devkit/repo` 后 demo 也可以反向消费。
- **不加归属门禁** —— 否决:颜色与图例依赖分类规则,没有门禁时规则会悄悄失效;新增第十一个文档门禁换取可验证的分类。
- **手写零依赖校验替代 zod** —— 否决:契约面覆盖笔记、技能、预算、门禁、图谱与运行结果,手写校验的维护成本高于一个零传递依赖的依赖;仍保留将来替换的出口。

## Consequences

- 模板新增 `packages/devkit-repo`、`tools/console` 与两个运行时依赖(`zod`、`mdast-util-from-markdown`),工作区项目从 5 个变为 6 个。
- `doc-sync` 从 10 个门禁变成 11 个;文档预算与 `AGENTS.md`、`README.md`、`docs/development.md`、`docs/asset-ownership.md` 在同一变更里更新。
- 门禁默认开启意味着本地控制台可以运行仓库脚本并写入产物(例如 `build` 写 `lib/`);这是用户选择的便利,边界靠目录白名单与回环监听,而不是权限系统。
- 进程树清理在 Windows 依赖 `taskkill /T /F`,失败时有 `exit` 与强制落定兜底;超时与关闭都会等运行结束。
- 控制台没有浏览器 E2E:无 JS 路径由 HTTP 测试覆盖,`console.js` 只做轮询与高亮,失效时页面仍可用。
- 图谱把仓库里所有 `README.md` 与 `docs/**/*.md` 纳入节点;源码与迁移文件仍不是节点,边只来自相对 Markdown 链接。
- demo 的控制台可以保留或废弃;本模板不再从它同步代码,只共享文件约定。

## Testing

- `packages/devkit-repo` 28 个单测覆盖笔记/技能/预算/门禁/图谱/归属与契约;`tools/console` 28 个测试用临时仓库与真实 HTTP 覆盖页面、JSON、转义、Host/Origin、资产、文档正文、路径悬停标题、详情文件路径、等高面板、缩放工具条、门禁运行、超时、截断、并发与关闭。
- `scripts/asset-ownership.spec.ts` 覆盖规则未命中、重复模式、跨类认领、版本与自分类,并与读取器的 glob 逐例对照。
- 手工冒烟:`pnpm run console` 后访问健康与图谱,再通过 API 运行 `verify-md-wrap` 并读到退出码 0。
