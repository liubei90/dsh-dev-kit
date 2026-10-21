# dsh-dev-kit

以 AI 代理/编程助手(Claude Code、Codex 等)为主导的全栈 TypeScript monorepo 模板(pnpm workspaces)。迁移自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(MIT)的 AI 开发体系:分层 AGENTS.md + Agent Notes + 技能 + 机械门禁。

> 本模板是**通用骨架**,业务类型(管理后台、客户端、API 服务等)留白,复制改名即可开始。

## 已迁移的组件

| 组件 | 位置 | 说明 |
|---|---|---|
| 分层 AGENTS.md | [AGENTS.md](AGENTS.md) + `CLAUDE.md`(符号链接)+ [docs/AGENTS.md](docs/AGENTS.md) | 站立命令 + 文档标准;Conventions 已按全栈 TS 重写 |
| Agent Notes | [.agents/notes/](.agents/notes/) | 决策记录系统:proposed/implemented/rejected/archived + 门禁格式 + 冻结归档 |
| 技能 | [.agents/skills/](.agents/skills/) | 11 个方法论技能:`prose-standard`、`trim-cot-leakage`、`code-review`、`ci-test-reliability`、`pre-push-checks`、`find-simplifications`、`archive-agent-notes`、`client-ui-ux`、`responsive-ui`、`error-handling`、`speed-up-perf` |
| 机械门禁 | [lefthook.yml](lefthook.yml) + [scripts/](scripts/) + [.github/workflows/ci.yml](.github/workflows/ci.yml) | pre-commit/pre-push hooks、`doc-sync` 聚合 7 个 gate(markdown 链接与锚点、markdown 折行、笔记分类、笔记格式、归档封存、文档预算、技能元数据)、CI 全量 |
| 工具链 | [package.json](package.json) + [.oxlintrc.json](.oxlintrc.json) | pnpm 11.28、Node `^22.19 || >=24`、TypeScript 6、Vitest 4、oxlint(不是 ESLint)、lefthook 2;`build:artifacts` 产出、`build:check` 校验产物平面 |

## 从 DSH 丢弃或偏离的部分(及原因)

- 录制会话回放(agent 产品特有,本项目用 E2E 替代)。
- 插件化能力缝与运行时组合约定(本项目不是插件架构)。
- 多语言对照文档:**已明确不启用**(不是可选);仓库只维护中文文档,不引入对照文件与一致性校验。
- 100% 逐文件覆盖率(覆盖率阈值按项目调,见 [docs/testing.md](docs/testing.md))。
- 文档 kind 模板与对照文档相关技能(DSH 特有)。
- lint 由 oxlint 承担,不用 ESLint:仓库不含 ESLint 配置与依赖,规则配置在 [.oxlintrc.json](.oxlintrc.json)。

## 文档

- [架构](docs/architecture.md):模块地图、分层规则、扩展点。
- [开发指南](docs/development.md):环境准备、日常流程、CI 组织。
- [测试策略](docs/testing.md):分层、规则、E2E 自跳过机制。
- [防御模式](docs/defensive-patterns/README.md):按 artifact 分页的评审规则(通用、服务端与 API、客户端组件、共享契约)。

## 快速开始

```sh
pnpm install                              # 安装依赖;postinstall 配置 lefthook hooks
pnpm run typecheck                        # 全仓类型检查
pnpm run test                             # 单元测试
pnpm run doc-sync                         # 文档门禁(7 个 gate)
pnpm run change-scope --base origin/main  # 查看本次 diff 范围
```

## 改名指南(复制到新项目时)

1. `git clone` 或复制本目录到新项目根,删除 `.git/` 后 `git init`;
2. 全局替换 `dsh-dev-kit` 与 `@devkit/` 作用域为你自己的名字;
3. 更新 `package.json` 的 name/description、`tsconfig.base.json` 里 `@devkit/shared` 的 `paths` 别名与包名、CI workflow;
4. 按业务类型填充 `apps/api`、`apps/web`、`packages/shared`;
5. 提交首个 commit,并写第一份 Agent Note(如"初始化项目",格式见 [.agents/notes/README.md](.agents/notes/README.md))。

## 开发一个功能的流程

见 [docs/AGENTS.md](docs/AGENTS.md) 与根 [AGENTS.md](AGENTS.md):先写 proposed Agent Note → 按 Conventions 实现 → 分层测试([docs/testing.md](docs/testing.md)) → `pnpm run doc-sync` → 用 [pre-push-checks](.agents/skills/pre-push-checks/SKILL.md) 选最小证据 → hooks 把关提交 → [code-review](.agents/skills/code-review/SKILL.md) 评审 → 合并时把笔记改成 implemented。

## 来源声明

本模板的体系设计与门禁脚本改编自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(MIT License, Copyright (c) 2026 DeepSeek)。各文件内已注明改编来源。
