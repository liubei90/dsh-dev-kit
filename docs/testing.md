# 测试策略(Testing policy)

如何分层测试、各层的职责与门禁。命令见根 [AGENTS.md](../AGENTS.md)。

## 分层

- **单元**(`pnpm run test`):vitest 覆盖 `apps/*/tests/**`、`packages/*/tests/**` 与 `scripts/*.spec.ts`;测试与代码同区域;优先边界、错误路径、事件顺序、并发竞态。
- **覆盖率**(`pnpm run test:coverage`):门禁运行;覆盖率阈值按项目在 vitest 配置里设定,不要求逐文件全覆盖。未覆盖行常是死代码,删而非补测。覆盖率必要但不充分:它只证明某行跑过,不证明功能按预期工作。
- **集成**:真 DB、真服务、真 HTTP 调用;mock 只用于昂贵或不确定的边界(网络、时钟)。
- **E2E**(`pnpm run test:e2e`):真浏览器/真 API。无凭据或暂无用例时自跳过:[vitest.e2e.config.ts](../vitest.e2e.config.ts) 设 `passWithNoTests: true`,单个用例用 `describe.skipIf(...)` 在自己依赖的环境缺失时跳过,缺少密钥的 CI 保持绿。
- **受影响用例**(`pnpm run test:affected`,`--base <ref>`):按改动文件所属 workspace 包选取该包 tests 目录下的用例;无匹配时不运行用例并正常退出。

## 规则

- **验证外部状态,不验证自述**:e2e 断言重跑命令或重读文件;断言未触碰的文件逐字节一致。
- **测试真实入口**:后端经 HTTP,前端经真实挂载;不手拼绕过应用启动流程的调用。
- **资源自有**:测试内创建资源,`afterEach` 释放(失败/重试/超时也释放);共享 fixture 放所属包的 tests 目录下单一 harness 文件,不放另一个 e2e 用例文件。
- **回归必须能红**:新门禁先引入被拒用例,观察失败再修复。
- **资源性/异步/平台敏感测试**遵循 [ci-test-reliability](../.agents/skills/ci-test-reliability/SKILL.md):资源原子分配、全局状态恢复、同步于状态而非固定 sleep、teardown 到静默。

## 何时需要 E2E/集成

每个非平凡的对外可见变更(用户可见或接口可见),同一 PR 带对应层级的测试;mock-only 证据不替代组装后的真实入口测试。
