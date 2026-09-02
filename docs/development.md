# 开发指南(Development)

从环境准备到日常流程的贡献者参考。命令总表见根 [AGENTS.md](../AGENTS.md#commands)。

## 环境准备

- Node.js ≥ 20.19;启用 Corepack 的 pnpm。
- `pnpm install` 安装依赖并自动配置 lefthook hooks(`scripts/install-lefthook.mjs`);缺失时手动运行该脚本。
- 首次 `pnpm run typecheck` 通过即环境就绪。

## 日常流程

1. 从 `main` 拉新分支(或 GitHub stack);大功能先写 [proposed Agent Note](../.agents/notes/proposed/)。
2. 实现并写测试(分层见 [docs/testing.md](testing.md));文档/注释用 [prose-standard](../.agents/skills/prose-standard/SKILL.md)。
3. 推前用 [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md) 选最小证据:先 `pnpm run change-scope --base <base>` 看 diff,再跑所属测试/门禁。
4. 提交由 lefthook 把关(lint、空白、笔记格式);push 触发 typecheck。
5. PR 评审用 [code-review](../.agents/skills/code-review/SKILL.md);合并时把 proposed 笔记改写为 implemented。

## CI 组织

`pnpm run check:all` 本地全量;CI(见 `.github/workflows/ci.yml`)跑 lint、typecheck、test、coverage、doc-sync、e2e。hooks 只做秒级检查,全量进 CI。

## TODO 标记

- `FIXME` — 应阻止发布的缺陷;发布前必须处理或经评审同意。
- `TODO` — 应尽快处理。
- `XXX` — 可能某天处理,不承诺。

## 类型文档(可选,启用时)

在文档里粘贴源码类型用 ` ```ts type-equiv ` 并登记 manifest;`verify-type-equiv`(如启用)防止粘贴漂移。
