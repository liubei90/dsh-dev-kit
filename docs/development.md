# 开发指南(Development)

从环境准备到日常流程的贡献者参考。命令总表见根 [AGENTS.md](../AGENTS.md)。

## 环境准备

- Node.js `>=24.9`(见 [package.json](../package.json) 的 `engines.node`);启用 Corepack 的 pnpm,仓库锁定 `pnpm@11.28.5`。
- `pnpm install` 安装依赖,并运行 `postinstall`([scripts/install-lefthook.mjs](../scripts/install-lefthook.mjs))配置 lefthook hooks。
- hooks 缺失(依赖从缓存恢复,或安装时跳过了 `postinstall`)时,手动补救:

```sh
node scripts/install-lefthook.mjs
```

- 首次 `pnpm run typecheck` 通过即环境就绪。

## 日常流程

1. 从 `main` 拉新分支;大功能先写 proposed Agent Note,生命周期与文件格式见 [Agent Notes](../.agents/notes/README.md)。
2. 实现并写测试,分层与选取规则见 [docs/testing.md](testing.md);文档与注释的写法见 [prose-standard](../.agents/skills/prose-standard/SKILL.md)。
3. 文档同步:`pnpm run doc-sync` 跑 7 个文档门禁;受影响的 README 与 JSDoc 和代码在同一变更里更新。
4. TypeScript 变更声明完成前跑 `pnpm run build`(先 `build:artifacts` 产出,再 `build:check` 校验);只改了源码且不涉及导出面时,`pnpm run typecheck` 已覆盖源码平面。
5. 推前用 [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md) 选最小证据:先 `pnpm run change-scope --base <base>` 看 diff 范围,再只跑覆盖该改动的测试与门禁。
6. 提交由 lefthook 把关:staged lint 与空白检查、Agent Note 分类与格式、归档封存、技能元数据;push 触发 `pnpm run typecheck` 与 `pnpm run test:affected`。
7. PR 评审用 [code-review](../.agents/skills/code-review/SKILL.md);合并时把 proposed 笔记改写为 implemented,状态行与骨架同时改。

## 构建与产物平面

- `pnpm run build:artifacts` 只产出构建产物:`tsc -b` 写 `apps/*/lib` 与 `packages/*/lib`,不检查消费者。
- `pnpm run build:check` 读取已有产物做两件事:`scripts/check-built-exports.ts` 验证每个 workspace 包声明的入口(`exports`/`main`/`types`)真实存在且能被 Node 加载;[tsconfig.artifacts.json](../tsconfig.artifacts.json) 把 `@devkit/shared` 指到 `lib` 声明,对 `apps/*/src` 做类型检查。
- `pnpm run build` 依次执行两者。只改了包导出面而只跑 `pnpm run typecheck` 会漏掉产物平面:源码平面的 `paths` 永远指向 `src`,看不见 `lib` 与 manifest 不一致。

## CI 组织

[.github/workflows/ci.yml](../.github/workflows/ci.yml) 分两个 job:

- `gates` 在 Node 24.9 与 26 上跑 `pnpm run lint`、`pnpm run typecheck`、`pnpm run test`、`pnpm run doc-sync`、`pnpm run test:coverage`、`pnpm run build`(含产物平面校验)。
- `e2e` 只在 PR 上跑,执行 `pnpm run test:e2e`;没有凭据或尚无 e2e 用例时不会失败,因为 [vitest.e2e.config.ts](../vitest.e2e.config.ts) 设了 `passWithNoTests: true`,单个用例用 `describe.skipIf` 在自己依赖的环境缺失时跳过。

`pnpm run check:all` 是本地全量(`doc-sync` + lint + typecheck + test + build)。hooks 只做秒级检查,全量证据由 CI 承担。

## TODO 标记

- `FIXME` — 应阻止发布的缺陷;发布前必须处理或经评审同意。
- `TODO` — 应尽快处理。
- `XXX` — 可能某天处理,不承诺。
