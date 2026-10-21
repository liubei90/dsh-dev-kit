# Agent Note: 采用 DeepSeek Harness 的开发体系

Status: implemented

## Problem

一个新的全栈 TypeScript 项目需要一套"AI 代理主导"的开发体系：给编码代理（Claude Code、Codex 等）的分层指令、决策记录语料、可复用工作流，以及机械门禁。DeepSeek Harness（MIT）正是用这套组织方式跑自己的开发；它的规范内容绑定 Cordis 与 agent 产品，但四件套的组织方式（分层 AGENTS.md、Agent Notes、技能、门禁）可以迁移到任何 TypeScript 项目。

## Decision

本仓库采用 DeepSeek Harness 的四件套组织，内容按"通用全栈 TS monorepo"重写：

- 分层的 `AGENTS.md` 站立命令（根 + 子树），其规范覆盖源码项目缺失的全栈关注点：前后端契约、数据库迁移、安全与鉴权、错误封装。
- `.agents/notes/` 下的 Agent Notes：相同的生命周期目录、分类封闭集、受门禁约束的格式与冻结归档。
- `.agents/skills/` 下的方法论技能，去掉 `dsh-` 前缀；当前为 9 个（原始 6 个方法论技能，加上 `archive-agent-notes`、`client-ui-ux`、`speed-up-perf`）。
- 机械门禁：lefthook 的 pre-commit/pre-push、由 `doc-sync` 聚合的校验脚本、CI。

从来源项目丢弃：session 快照回放、Cordis 能力缝与插件约定、**双语文档配对（明确不启用，而非可选）**、逐文件 100% 覆盖率、`dsh-doc` 与 `dsh-translate-docs` 技能。

工具链与门禁实现之后整体同步到当前 DSH，见[同步到当前 DeepSeek Harness 开发体系](../process/2026-10-09-sync-to-current-dsh.md)。

## Alternatives considered

- **原样复制来源的 AGENTS.md** —— 否决：它的规范词汇是 Cordis 与 agent 产品的；全栈项目需要的是契约、数据库与安全规则。
- **只采用 Agent Notes** —— 否决：价值在于四件套的闭环；没有技能与门禁的笔记会退化成"靠约定维持的 ADR"。
- **保留 `dsh-` 技能前缀** —— 否决：前缀命名的是来源项目；这里的技能是通用方法论。

## Consequences

- 每个非平凡变更都带一篇 Agent Note；已实现的笔记用现在时描述真实交付。
- 门禁是机械的：代理对"被强制执行的规则"的遵循度高于散文约定。
- 模板保持通用：业务类型（管理后台、客户端应用、API 服务）留给使用者决定。
