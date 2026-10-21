# Agent Notes

这里放的是一种设计文档。**Agent Note** 记录影响本代码库的决策或提案——代码和文档承载不了的"为什么"与"放弃了什么"。本文件定义笔记放在哪里、什么时候写、以及[文件格式](#文件格式)。

## 布局与命名

每篇笔记的两个维度都编码在**路径**里：`{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`。

- **生命周期**（顶层目录）就是笔记的状态，状态变化时笔记在目录之间移动：
  - **`proposed/`** —— 实现前评审的提案，尚未建成（或只建成一部分）。
  - **`implemented/`** —— 决策已交付。文件记录决定了什么、否决了什么，并**与真实交付保持同步**：代码后来移动了文件、改了名字或默认值时，在同一次变更里更新笔记以匹配（只改事实——路径、名字、结构——不改决策本身）。见 [implemented/AGENTS.md](implemented/AGENTS.md)。
  - **`rejected/`** —— 提案被考虑并否决。只在它的理由还能阻止一个诱人且重要的错误时保留，否则连同文件一起删除。
  - **`archived/`** —— 不再指导后续工作的已交付笔记，冻结保存。见[归档与删除](#归档与删除)。
- **分类**（下一层目录）是决策的**种类**，见下面的[分类](#分类)。

文件名里的日期是主题**首次提出**的日期。笔记之间的交叉引用用相对 Markdown 链接，不要用裸散文或编号——这样机器可校验，也能在目录移动后存活。

活跃树本身就是工作清单：浏览它的生命周期/分类目录，或在仓库里搜索。**不要**新增集中的 `INDEX.md`；`scripts/agent-note-tree.ts` 是生命周期与分类封闭集的唯一来源，`pnpm run verify-agent-note-classification` 拒绝未知目录、错误的目录深度、不合规的文件名与 `INDEX.md`。

## 分类

每篇笔记属于下面封闭集里的一个分类；`scripts/agent-note-tree.ts` 是权威声明处。新增一个分类要同时更新该文件与本表。

| 分类 | 覆盖什么 |
|---|---|
| `feature` | 新的用户可见或对外可见的能力。 |
| `bug-fix` | 修正缺陷，或补上某个复盘暴露的缺口。 |
| `simplification` | 删除代码、行为或对外表面，而不新增能力。 |
| `architecture` | 关于**已交付源码**的结构性决策——模块之间怎么关联、运行时词汇是什么。 |
| `process` | 代码**周边**的工具、政策或流程——门禁、包管理器、依赖策略——而不是运行时行为。 |
| `testing` | 测试基础设施与策略。 |

`architecture` 与 `process` 的界线：**architecture** 说的是我们交付的源码，**process** 说的是周边工具与工作流。分类里刻意没有 `refactor`——它与 `simplification` 重叠，后者的判别标准"可观察行为是否改变"已经覆盖了它。

## 归档与删除

当已交付决策已经完成、且它的理由不太可能再指导后续工作时归档该笔记。当它的备选方案、所有权边界、否定性保证、持久或线上语义、安全规则、或重新引入的条件仍然有用时，保持它活跃。**永不归档 proposed 笔记**：过时的提案应该被否决。rejected 笔记只在还能阻止一个可信错误时保留，否则删除。用校准过的判断，而不是字数、年龄或配额。

归档路径是 `archived/{class}/yyyy-mm-dd-topic-title.md`；刻意没有 `implemented` 这一层，因为只有已实现笔记能进入归档。归档变更只允许：移动笔记文件、在 `Status: implemented` 行下方插入 `Archived: YYYY-MM-DD` 行、重录清单哈希、修复或删除入站链接。

一旦封存，归档笔记永久冻结：不要编辑、翻译、重排、更新、移动或删除它，也不要把它当作当前行为的依据。文档门禁跳过归档文件作为**源**（包括它们的出站链接）；活跃散文仍可链接进归档笔记以引用历史。`scripts/verify-archived-agent-notes.ts` 强制执行封闭分类树、归档元数据与只追加的封存清单：已登记的哈希永不改写，`--write` 只追加新文件且同样受校验错误阻断。归档流程见 [archive-agent-notes](../skills/archive-agent-notes/SKILL.md)。

被完全取代的已实现笔记可以合并进当前持有该决策的笔记并删除。删除前，持有者必须保留下每一份独有理由、备选方案、后果、所需验证与已命名的覆盖缺口；修复所有入站链接；并在同一次变更里删除该文件。部分取代不适用：保持两篇笔记互相链接，并更新其中每个仍然成立的事实。合并不得把旧文件改写成它的反面，也不得把 git 历史当成理由的唯一副本。

## 何时写一篇

每个非平凡变更**必须**在同一个 PR 里新增或更新至少一篇 Agent Note。变更属于非平凡，当它改变行为、架构、跨文件或跨包的契约、流程或工具、测试策略、磁盘/线上/配置格式，或任何维护者可能合理重新审视的决策。实质性的未来工作从 `proposed/` 开始；已经做出的决策直接从 `implemented/` 开始。选择与决策相符的分类目录。

更新已经持有该决策的笔记就算满足这条规则，不要制造重复。只有纯机械或局部、且不改变行为、契约、结构、流程或理由的编辑才豁免。**不要把一篇笔记编辑成另一个决策**：用新笔记取代它，并让两篇互相链接，除非旧笔记之后被完全合并。把已实现笔记编辑成"它的决策现在住在哪里"是必须做的事，不是禁止的事；见 [implemented/AGENTS.md](implemented/AGENTS.md)。

## 文件格式

每篇活跃笔记遵循同一套文件内格式，由 `pnpm run verify-agent-note-format`（属于 `doc-sync`）强制。归档笔记保留封存时的格式，外加状态行下方的归档日期行。

### 头部块

每篇笔记的前三行必须恰好是：

```markdown
# Agent Note: <title>

Status: <status>
```

`Status:` 只有三种取值，并且必须与文件所在的生命周期目录一致（门禁会交叉校验），全文件只允许出现一次 `Status:` 行：

- `Status: proposed`
- `Status: implemented`
- `Status: rejected — <一句话原因>`

状态不带日期也不带括号补充：文件名承载首次提出日期，git 承载其余一切。拒绝原因是唯一带内容的状态，因为读者来看的就是这篇笔记的裁决。

### 正文骨架

每篇笔记的正文以 `## Problem` 开头——动机，要能脱离解决方案独立成立。之后的内容取决于生命周期；重复出现的章节使用下面这些规范名字，除此之外不要自创同级标题，真正属于本主题的技术章节（模块拓扑、线上契约、数据库 schema）可以在必需章节之间自由书写。

#### `proposed/`

```markdown
## Problem
## Proposal
…本主题特有章节…
## Alternatives considered
## Acceptance criteria
## Risks
```

`## Proposal` 是打算做的改动，在尚未建成时可以用将来时——计划、迁移步骤与开放问题都属于这里。`## Acceptance criteria` 说明什么样的可观察状态算完成。`## Risks` 同时覆盖可能出错的地方与这次改动明知要放弃的东西。

#### `implemented/`

```markdown
## Problem
## Decision
…本主题特有章节…
## Alternatives considered
## Consequences
```

`## Decision` 用现在时描述已交付的现实，整篇文件按 [implemented/AGENTS.md](implemented/AGENTS.md) 与它保持同步。`## Consequences` 记录这次取舍**付出**了什么、**换来**了什么。提案期的标题在这里属于 spec-speak，门禁会拒绝：`## Proposal`、`## Plan`、`## Migration plan`、`## Acceptance criteria` 不得出现在已实现笔记里。`## Testing`、`## Deferred`、`## Related` 这类章节在陈述现在时事实时是允许的。

#### `rejected/`

被拒绝的笔记就是被冻结的提案：保留它提案期拥有的章节（包括 `## Acceptance criteria` 或 `## Plan`），裁决写在 `Status:` 行上。只有头部块、`## Problem` 开头、`## Proposal` 章节与下面强制的备选方案条款适用。

### Alternatives considered 必填

每篇笔记都要有 `## Alternatives considered` 章节：每个真实备选方案以及它为什么落选，一个备选一段（用粗体领起），争议大的可以用 `### 为什么不选 <X>?` 小节。没有记录打败过什么的决策，会招来反复重提——这正是 Agent Notes 要防止的失败。

备选方案是**记录**出来的，不是发明出来的。2026-07-05 之前的历史笔记如果无法从记录中重建备选方案，可以用下面这行精确注释代替该章节；门禁只对格式生效前的笔记接受它：

```markdown
<!-- agent-note-format: alternatives-not-recorded (pre-format Agent Note) -->
```

### 在生命周期之间移动

在生命周期目录之间移动文件意味着在同一次变更里更新 `Status:` 行并重新满足目标目录的骨架，否则门禁会让这次移动失败。具体地说，`proposed/` → `implemented/` 要把 `## Proposal` 改写成现在时的 `## Decision`，把 `## Acceptance criteria` 与 `## Risks` 折叠进 `## Consequences`（或一个现在时的 `## Testing`/`## Verification` 章节，用于记录现在钉住该行为的东西），并删掉计划、只留已交付的内容。`proposed/` → `rejected/` 只需在 `Status:` 行加上原因，然后冻结文件。

### 语言

笔记用中文写作。机器可读的标记保持英文原样：`# Agent Note: ` 前缀与 `Status:` 行。
