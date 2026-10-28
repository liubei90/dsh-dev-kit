# Agent Note: 同步到当前 DeepSeek Harness 开发体系

Status: implemented

## Problem

本模板的开发体系是从某个较早的 DeepSeek Harness 版本抽出的，一年后上游与本地都出现了同一类问题：**宣称的体系与实际执行的体系脱节**。工具链停在 ESLint 9 / Vitest 2 / pnpm 9 / TypeScript 5.6；`postinstall` 缺失导致 lefthook hooks 从未被安装，pre-commit 与 pre-push 全部形同不存在；`verify-md-links` 与 `verify-md-wrap` 不在任何自动入口，`main` 上还留着两条指向不存在目录的断链；`test:affected` 用"同名文件映射"选测，对本仓库把测试放在包级 `tests/` 的布局永远选不到用例；文档预算按空白分词计数，对中文文档余量超过 400%，等于没有约束；分类门禁对未知目录静默跳过。同一时期上游恰好修掉了这些缺陷本身：Markdown 门禁改成基于 mdast 并校验锚点，归档清单改成只追加且与 git 基线比对，笔记分类改成单一来源的封闭集。

## Decision

本仓库的开发体系整体同步到当前 DSH，并保持"通用全栈 TypeScript monorepo 模板"的定位。

- **工具链完全对齐**：`pnpm@11.28.5`、Node `>=24.9.0`、TypeScript 6、Vitest 4.1、lefthook 2，lint 从 ESLint 换成 oxlint 1.81 + oxlint-tsgolint（保留 `@stylistic` 与 `sonarjs` 两个 JS 插件规则集，`.oxlintrc.json` 只负责规则）。
- **门禁按当前实现移植**：`.agents/notes` 的生命周期与分类封闭集收敛到 `scripts/agent-note-tree.ts` 单一来源，并新增分类门禁；格式门禁增加"第 4 行必须空行""全文件只允许一个 `Status:` 行""`implemented/` 禁止提案期标题"；归档从"三件套"改成单文件封存，哈希清单只追加，`--write` 同样受校验错误阻断；Markdown 门禁改用 mdast，`verify-md-links` **校验锚点**，`verify-md-wrap` 按 AST 段落判定折行。
- **门禁的读取与并发成本有上限**：Markdown 门禁每篇文档每轮只解析一次（`markdownHeadingLines`/`markdownProseLines` 接受已解析树，`markdownLinkCache` 同时缓存解析结果与存在性探针），`repo-files` 每轮共享目录列表；`scripts/parallelism.ts` 给本地 lint 设线程上限（CI 用满 CPU，`OXLINT_THREADS` 可覆盖）。
- **文档预算改成 CJK 感知计数**：CJK 字符各计 1，非 CJK 的空白分隔 token 各计 1，让中文文档与英文文档在同一把尺子上计量。
- **`doc-sync` 真的覆盖文档门禁并进入 CI**：`doc-sync` 覆盖全部文档门禁（清单见根 `AGENTS.md` 的 Commands 小节）；`check:all` 在它之上加 lint / typecheck / test / build；CI 的 gates job 在 Node 24.9 与 26 上跑 lint、typecheck、test、doc-sync、coverage。
- **防御模式按 artifact 分页**：`docs/defensive-patterns/` 由一个通用页（时序、所有权、生命周期、迁移）和服务端与 API、客户端组件、共享契约三个 artifact 页组成，README 提供五条评审原则与"改什么读哪页"的路由表；评审强制规则放在这一层，类型语义仍在 `docs/architecture.md`。
- **源码平面与产物平面分开验证**：`build:artifacts` 只产出，`build:check` 读取产物校验包入口可加载并把消费端按 `lib` 声明做类型检查，`build` 依次执行两者；`typecheck` 继续覆盖 `src + tests + scripts` 的源码平面。
- **技能**：原有 6 个升级到当前 DSH 版本，新增 `archive-agent-notes`、`client-ui-ux`、`speed-up-perf`、`responsive-ui`、`error-handling`，共 11 个；保持无 `dsh-` 前缀，内容去掉 DSH 专属机制。
- **语言策略**：常驻文档与 Agent Notes 用中文，`.agents/skills/` 保持英文，机器可读标记（`# Agent Note: `、`Status:` 行、代码与命令）保持英文。
- **明确不启用双语配对**：删除全部 `.zh.md`、sidecar 与 pairing 规则，以及依赖它们的技能；这是"不启用"，不是"可选"。

## Alternatives considered

- **整体复制 DSH** —— 否决：模板的价值在通用性，把 Cordis、session log、双语文档站与网站投影搬进来，会让门禁依赖本仓库不存在的目录，回到"宣称与执行脱节"的老问题。
- **只修 P0 缺陷、不做版本同步** —— 否决：上游已经修好的正是本仓库的缺陷类别，只打补丁会把版本漂移留给下一轮，且技能与文档会继续引用旧机制。
- **保留 ESLint，只升级它的版本** —— 否决：与当前 DSH 并存两套 lint 栈，会让技能与文档对"跑什么检查"的描述分叉，而这正是本次要消除的问题类型。
- **保留双语配对并补上门禁** —— 否决：在中文单语定位下这是纯成本；确有第二语言需求时，应按 DSH 的 pairing 机制整体引入，而不是留下没有门禁的规则文本。

## Consequences

- 门禁从"写在文档里"变成"会被执行"：`pnpm install` 会通过 `postinstall` 安装 hooks，`doc-sync` 覆盖链接与锚点，`check:all` 覆盖全量，本地与 CI 的命令一致。
- 悬空引用清零：文档、技能与配置里引用的每个脚本、技能与文件都真实存在，并且由 `verify-md-links` 持续守住。
- 产物平面有了独立证据：包入口与 `lib` 声明由 `build:check` 校验，源码平面的 `paths` 不再能掩盖 manifest 与构建产物不一致。
- 代价：`package.json` 依赖面变大（oxlint 两个 JS 插件包、mdast 三件套、js-yaml）；归档封存引入 `manifest.json`，归档动作需要显式跑一次 `--write`；引擎下限提高到 Node 24.9，使用者的本地 Node 必须跟上；`build` 现在是两段式，改了导出面却只跑 `typecheck` 会漏掉产物平面。
- 已知未覆盖：`packages/shared` 目前只有契约类型，`apps/web` 仍是占位实现，因此 e2e 门禁在仓库初始状态下没有用例（配置以 `passWithNoTests` 与用例内自跳过处理，不阻塞 CI）。
