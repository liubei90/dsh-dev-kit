# AGENTS.md — 文档标准

本文定义文档结构、层级归属、写作规则、词数预算与交叉引用。放置与编辑判断用 [prose-standard](../.agents/skills/prose-standard/SKILL.md);决策记录规则见 [Agent Notes](../.agents/notes/README.md)。

## 文档结构与定位

- 面向人类的文档与 Agent Notes 分开:后者是决策记录,见 [Agent Note 规则](../.agents/notes/README.md)。
- 一份文档的位置决定其范围:描述自身主题的适当细节,只按目的、职责与高层行为指引直接子项;更底层的细节链接到持有它的下级文档,文档类型不扩大该范围。
- 每份在范围内文档分为**教程**或**参考**:教程按有序路径到达结果,只引入每步需要的概念,先立前置再渐进加深;参考定义查找范围与当前行为,无教学顺序。
- 写作顺序:在树中定位文档 → 设定允许的细节层 → 选教程或参考 →(教程则)按前置与难度排序概念 → 把下级持有的细节搬回其持有者 → 用链接替换下级解释。

## 层级分类:每个事实只有一个家

每个事实只有一个家,即职责所属的层级;别处只链接。

| 层级 | 职责 | 不属于这里 |
|---|---|---|
| 根 `AGENTS.md` | 站立命令:代理每个会话都需要的规则,每条 1–3 行并链接其家 | 故事、示例、情境流程、复述链接家的内容 |
| 子树 `AGENTS.md`(`docs/`、`.agents/notes/`) | 该子树专属的规则 | 仓库级规则(根文件已含) |
| [architecture.md](architecture.md) | 有序地图:应用组成、模块关系、扩展点;改架构前先读 | 类型定义、逐包细节、决策理由、实现状态标注 |
| [development.md](development.md) | 贡献者环境、日常流程与 CI 概览 | 运行时与版本理由(→ Agent Notes)、会随 `package.json` 漂移的逐项检查清单 |
| [testing.md](testing.md) | 测试分层、各层职责与门禁 | 测试实现走查 |
| [defensive-patterns/](defensive-patterns/README.md) | 实现前必读、评审时强制执行的规则,按 artifact 分页:一页通用 bug 类,外加服务端与 API、客户端组件、共享契约各一页 | 类型定义与语义(→ `architecture.md`)、决策理由(→ Agent Notes) |
| [persistence-changes/](persistence-changes/README.md) | 持久化 schema 的变更确认记录、当前目录与兼容性决定;`apps/api/migrations` 变化必须留痕 | 行为叙述(→ `architecture.md`)、决策理由(→ Agent Notes) |
| [web-styling.md](web-styling.md) | 浏览器端样式所有权与组件规则;设计系统未落地时只写与实现无关的原则 | 组件实现细节(→ 包 README)、具体 token 值(→ 主题包) |
| Agent Notes(`.agents/notes/`) | 活跃决策记录:为什么、放弃了什么、所需验证;`implemented/` 用现在时描述已交付现实([规则](../.agents/notes/README.md)) | 迁移计划、验收清单、spec-speak;归档笔记是冻结历史,不是当前权威 |
| Skills(`.agents/skills/`) | 可复用工作流与专项决策标准 | 产品与运行时契约(→ docs 或源码) |
| 包/app README | 该包契约:配置、语义、限制、扩展点 | JSDoc 复述、其他包的关注点 |

放置规则:理由 → Agent Notes;流程 → `docs/development.md`;类型 → 所属模块文档;包契约 → README;站立命令 → 根 `AGENTS.md` 并带理由链接;评审强制规则 → `defensive-patterns/`;持久化格式变更 → `persistence-changes/`。新增层级的方式是创建目录并在此表加一行。

## 写作规则

- **写当前状态,不写变更史。** 不写 "previously/now/no longer"、PR 或 commit;变更故事放 commit、PR 或 Agent Note。
- **每段一个物理行**(`verify-md-wrap` 会红):用编辑器软换行;代码块、表格与列表保持各自格式。
- **锚点链接必须指向真实存在的标题。** `verify-md-links` 校验目标文件与目标标题的 GitHub slug;锚点写不准就改成不带锚点的相对链接。
- **围栏 ```ts 块必须可编译**(`doc-typecheck`):文档里的 TypeScript 示例要能通过编译;示意性草图用 ```ts ignore-check,豁免比例不得超过 25%。
- **注释与 JSDoc 写完整契约,不是推理转写。** 保留行为、失败、时序、所有权、异常与后果;删叙述、测试走查、评审分析与代码复述;每个模块与导出有简洁 JSDoc,函数式导出带 `@param`/`@returns`([prose-standard](../.agents/skills/prose-standard/SKILL.md))。
- **直写:点名行为者与事实。** 不用隐喻;写准确的检查、类型、API、操作或行为,而不是含糊的"门禁""表面"。
- **非平凡变更必须在同一 PR 带 Agent Note。** 仅机械/局部编辑豁免;更新已拥有该决策的笔记即可,不要重复建([规则](../.agents/notes/README.md)、[implemented 笔记](../.agents/notes/implemented/AGENTS.md))。

## 词数预算

[scripts/doc-budgets.manifest.json](../scripts/doc-budgets.manifest.json) 设置常驻文档上限;`pnpm run verify-doc-budgets` 超限或漏文件即红。计数口径是 CJK 感知的:每个 CJK 字符计 1 个 unit,加上每个非 CJK 的空白分隔 token 计 1,中英文文档因此用同一把尺子衡量。

红时按顺序:1) 把属于其他层级的内容**搬迁**过去,必要时留一行链接;2) **浓缩**属于这里但可更短的内容;3) 仅在文字确实需要空间时**提高上限**,并在 PR 说明 manifest diff。上限是护栏,不是削减目标:在限内至少保留 5% 余量;超限则冻结上限直到搬迁或浓缩把它带回限内。

## 冗余(slop)清单

在任意文档中排查:

- 同一条规则在多个家重复。grep 一个特征短语;留一个家,其余改为链接。
- 变更史或战争故事:"previously"、"now"、"no longer"、"used to"、PR、commit。写当前事实,历史链接其持有者。
- 实现状态注释("implemented!"、"future: …")。状态会腐烂;目录结构与清单承载它。
- 手抄目录、JSDoc 或测试清单——当源码或生成器才权威时。
- 推理转写:逐步实现叙述、显然分支的证明、测试走查、被拒的局部方案。保留最终契约或持久理由,删掉推导路径。
- 兄弟方法旁重复的理由:在持有该能力或辅助处写一次。
- 段落墙:一段承载多条规则与插入语。拆分或降级到其家。
- 强调通胀:到处 bold/CAPS/"critically" 意味着没有重点。只在改变行为的从句用强调。
- `implemented/` Agent Note 里的 spec-speak:"should"、迁移计划、验收清单。implemented 笔记描述"是什么"([implemented 笔记](../.agents/notes/implemented/AGENTS.md))。

## 交叉引用:机器可查的链接

仓库内引用用相对 Markdown 路径,禁用裸文件名或编号;`verify-md-links` 同时校验目标文件存在,以及目标标题的锚点存在。链接失败时修文件——补上目标、改正锚点或去掉锚点——不要关掉门禁。
