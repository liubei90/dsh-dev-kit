# 测试策略(Testing policy)

如何分层测试、各层的职责与门禁。命令见根 [AGENTS.md](../AGENTS.md#commands)。

## 分层

- **单元**(`pnpm run test`):vitest 覆盖 `apps/*/tests/**` 与 `packages/*/tests/**`;测试与代码同区域;优先边界、错误路径、事件顺序、并发竞态。
- **覆盖率**(`pnpm run test:coverage`):门禁运行;`apps/*/src` 与 `packages/*/src` 的逐文件覆盖率;未覆盖行常是死代码,删而非补测。覆盖率必要但不充分。
- **集成**:真 DB、真服务、真 HTTP 调用;mock 只用于昂贵或不确定的边界(网络、时钟)。
- **E2E**(`pnpm run test:e2e`):真浏览器/真 API;无凭据自跳过。

## 规则

- **验证外部状态,不验证自述**:e2e 断言重跑命令或重读文件;断言未触碰文件逐字节一致。
- **测试真实入口**:后端经 HTTP,前端经真实挂载;不手拼绕过 bootstrap 的调用。
- **资源自有**:测试内创建资源,`afterEach` 释放(失败/重试/超时也释放);共享 fixture 放 `tests/harness.ts`,不放另一个 `*.e2e.ts`。
- **回归必须能红**:新门禁先引入被拒用例,观察失败再修复。
- **资源性/异步/平台敏感测试**遵循 [ci-test-reliability](../.agents/skills/ci-test-reliability/SKILL.md):资源原子分配、全局状态恢复、同步于状态而非固定 sleep、teardown 到静默。

## 何时需要 E2E/集成

每个非平凡的模型可见、协议可见或人可见变更,同一 PR 带对应层级的测试;mock-only 证据不替代组装后的真实入口测试。
