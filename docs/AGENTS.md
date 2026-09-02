# AGENTS.md — 文档标准

本文定义文档结构、Markdown 层级、写作规则与词数预算。放置与校验用 [dsh-doc 对应技能](../.agents/skills/prose-standard/SKILL.md)的定位与编辑判断;决策记录规则见 [Agent Notes](../.agents/notes/README.md)。

## 文档结构与定位

- 面向用户的文档与 Agent Notes 分开:后者是决策记录,见 [Agent Notes 规则](../.agents/notes/README.md)。
- 事故复盘(postmortem)是"按事件组织的参考",时间线记录证据而非教学顺序。
- 一份文档的位置决定其范围:描述自身主题的适当细节,只按目的/职责/高层行为指引直接子项;更底层细节链接到持有它的下级文档。

每份在范围内文档分为**教程**或**参考**:
- 教程:按有序路径到达结果,只引入每步需要的概念;先铺垫前置,再渐进深入,多余的进阶材料移到后面的教程或参考。
- 参考:定义查找范围与当前行为,无教学顺序。

写作顺序:先在树中定位文档 → 设定允许的细节层 → 选教程或参考 →(教程则)按前置与难度排序概念 → 把下级持有细节移到其持有者 → 用链接替换下级解释。

## 层级分类:每个事实只有一个家

| 层级 | 职责 | 不属于这里 |
|---|---|---|
| 根 `AGENTS.md` | 站立命令:代理每个会话都需要的规则,每条 1–3 行并链接其家 | 故事、示例、情境流程、复述链接家的内容 |
| 子树 `AGENTS.md`(`docs/`、`.agents/notes/`) | 该子树专属的规则 | 仓库级规则(根文件已含) |
| `docs/architecture.md` | 有序地图:应用组成、模块关系、扩展点;改架构前先读 | 类型定义、逐包细节、决策理由 |
| `docs/api.md`(或各 app README) | API 契约参考:端点、DTO、错误语义 | 行为叙述 |
| Agent Notes | 活跃决策记录:为什么、放弃了什么、所需验证;`implemented/` 用现在时描述已交付现实 | 迁移计划、验收清单、spec-speak |
| postmortem | 事故叙事(唯一允许"战争故事"的层级) | — |
| cookbook | 带编号验证步骤的教程 | 设计理由 |
| 用户指南(`docs/user/`) | 面向使用者的指南 | 生成表格、贡献流程 |
| 包/app README | 该包合同:配置、语义、限制、扩展点 | JSDoc 复述、其他包的关注点 |
| Skills(`.agents/skills/`) | 可复用工作流与专项决策标准 | 产品/运行时契约 |

放置规则:bug → postmortem;理由 → Agent Notes;流程 → cookbook;类型 → 所属模块文档;包合同 → README;站立命令 → 根 `AGENTS.md` 并带理由链接。

## 写作规则

- **写当前状态,不写变更史。** 避免 "previously/now/no longer"、PR、commit、stack 位置;写活着的机制。变更故事放 commit、PR、Agent Note 或 postmortem。
- **每个非平凡变更必须在同一 PR 带至少一份 Agent Note。** 更新持有者或新增;仅机械/局部编辑豁免(见 [Agent Notes 规则](../.agents/notes/README.md#when-to-write-one))。
- **每段一个物理行**(`verify-md-wrap`):用编辑器软换行。代码块、表格、列表结构保持原格式。
- **围栏 `ts` 块必须可编译**(`doc-typecheck`);粘贴源码类型用 ` ```ts type-equiv ` 并登记 manifest 防漂移(如项目启用)。
- **注释与 JSDoc 陈述完整契约,非推理转写。** 保留行为、失败、时序、所有权、异常、后果与非显然取向;删除叙述、测试走查、评审分析、代码复述。用 [prose-standard](../.agents/skills/prose-standard/SKILL.md)。
- **直写:点名行为者与事实。** 不用隐喻;说准确的名字:检查、类型、API、操作、行为。

## 词数预算

`scripts/doc-budgets.manifest.json` 设置常驻文档上限;`pnpm run verify-doc-budgets` 超限即红。

红时按顺序:1) 把属于其他层级的内容**搬迁**过去,必要时留一行链接;2) **浓缩**属于这里但可更短的内容;3) 仅在文字确实需要空间时**提高上限**,并在 PR 说明 manifest diff。上限是护栏,不是削减目标:在限内至少保留 5% 余量;超限则冻结上限直到搬迁/浓缩回到限内。

## 冗余(slop)清单

在任意文档中排查:

- 同一条规则在多个家重复。grep 一个特征短语;留一个家,其余链接。
- 叙事史或战争故事:"previously"、"now"、"no longer"、"used to"、PR、commit。写当前事实;需要时链接 Agent Note 或 postmortem。
- 实现状态注释("implemented!"、"future: …")。状态会腐烂;布局与清单承载它。
- 手抄目录、JSDoc、测试清单——当源码或生成器才权威时。
- 推理转写:逐步实现叙述、显然分支的证明、测试走查、被拒的局部方案。保留最终合同或持久理由,删推导路径。
- 兄弟方法旁重复的理由:在持有该能力/辅助处写一次。
- 段落墙:一段承载多条规则与插入语。拆分或降级到其家。
- 强调通胀:到处 bold/CAPS/"critically" 意味着没有重点。只在改变行为的从句用强调。
- `implemented/` Agent Note 里的 spec-speak:"should"、迁移计划、验收清单。implemented 笔记描述"是什么"。

## 交叉引用:机器可查的链接,不用自由散文

仓库内引用用相对 Markdown 路径,禁用裸文件名或编号。`verify-md-links` 拒绝缺失目标与死锚点。
