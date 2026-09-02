# dsh-dev-kit

以 AI 代理/编程助手(Claude Code、Codex 等)为主导的全栈 TypeScript monorepo 模板(pnpm workspaces)。迁移自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(MIT)的 AI 开发体系:分层 AGENTS.md + Agent Notes + 技能 + 机械门禁。

> 本模板是**通用骨架**,业务类型(管理后台、客户端、API 服务等)留白,复制改名即可开始。

## 已迁移的组件

| 组件 | 位置 | 说明 |
|---|---|---|
| 分层 AGENTS.md | `AGENTS.md` + `CLAUDE.md`(符号链接)+ `docs/AGENTS.md` | 站立命令 + 文档标准;Conventions 已按全栈 TS 重写 |
| Agent Notes | `.agents/notes/` | 决策记录系统:proposed/implemented/rejected/archived + 门禁格式 + 冻结归档 |
| 技能 | `.agents/skills/` | 6 个方法论技能(prose-standard、trim-cot-leakage、code-review、ci-test-reliability、pre-push-checks、find-simplifications) |
| 机械门禁 | `lefthook.yml` + `scripts/` + `.github/workflows/ci.yml` | pre-commit/pre-push hooks、doc-sync 聚合、CI 全量 |

## 从 DSH 丢弃的部分(及原因)

- session 快照回放(agent 产品特有,本项目用 E2E 替代)
- Cordis 能力缝/插件约定(非插件架构)
- 双语配对(可选,需要时按 docs/AGENTS.md 恢复)
- 100% 逐文件覆盖率(阈值按项目调)
- dsh-doc / dsh-translate-docs 技能(kind 模板与双语是 DSH 特有)

## 快速开始

```sh
pnpm install          # 安装依赖并配置 lefthook hooks
pnpm run typecheck    # 全仓类型检查
pnpm run test         # 单元测试
pnpm run doc-sync     # 文档门禁
pnpm run change-scope --base origin/main   # 查看本次 diff 范围
```

## 改名指南(复制到新项目时)

1. `git clone` 或复制本目录到新项目根,删除 `.git/` 后 `git init`;
2. 全局替换 `dsh-dev-kit` → 你的项目名、`@devkit/` → `@你的组织/`;
3. 更新 `package.json` 的 name/description、`tsconfig.json` references、CI workflow;
4. 按业务类型填充 `apps/api`、`apps/web`、`packages/shared`;
5. 提交首个 commit,并写第一份 Agent Note(如"初始化项目")。

## 开发一个功能的流程

见 [docs/AGENTS.md](docs/AGENTS.md) 与根 [AGENTS.md](AGENTS.md):先写 proposed Agent Note → 按 Conventions 实现 → 分层测试 → 文档同步 → pre-push-checks 选最小证据 → hooks 把关提交 → code-review → 合并时把笔记改成 implemented。

## 来源声明

本模板的体系设计与门禁脚本改编自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(MIT License, Copyright (c) 2026 DeepSeek)。各文件内已注明改编来源。
