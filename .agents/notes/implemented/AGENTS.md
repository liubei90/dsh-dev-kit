# AGENTS.md — 已实现的 Agent Note

这些笔记描述已交付的决策。遵循[根指令](../../../AGENTS.md)、[文档标准](../../../docs/AGENTS.md)与 [Agent Note 格式](../README.md#文件格式)；`pnpm run verify-agent-note-format` 校验生命周期对应的骨架。

## 让笔记与真实交付保持同步

改动路径、符号、默认值或机制时，在同一个变更里把笔记里的对应事实改对。就地改写过期事实，不追加变更史。

当一篇已交付笔记不太可能再指导后续工作时，通过 [archive-agent-notes](../../skills/archive-agent-notes/SKILL.md) 归档它，而不是继续维护。

### 这不是重写"决策"的许可

就地更新事实性的实现描述。推翻决策本身或它的理由需要一篇新笔记并互相链接；完全被取代的旧笔记只能按 [Agent Note 规则](../README.md)的合并条款删除。
