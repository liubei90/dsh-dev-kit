# AGENTS.md — 归档的 Agent Note

class 目录下已归档的 Agent Note 是冻结的历史快照，不是当前行为的依据。永不编辑、重排、翻译、修补、删除或移动已封存文件；新的决策与事实写在活跃笔记或当前文档里。

归档变更只允许：移动单个笔记文件、在 `Status: implemented` 行下方插入 `Archived: YYYY-MM-DD` 行、重录清单哈希、修复或删除入站链接。不要检查、校验或修补归档笔记的出站链接。

归档按 [archive-agent-notes](../../skills/archive-agent-notes/SKILL.md) 的流程执行，并用 `pnpm run verify-archived-agent-notes --write` 追加新文件的哈希。常规校验会拒绝被改动或缺失的已封存文件、非法归档元数据与未知 class 目录；`--write` 同样受这些错误阻断，只追加、不覆盖已登记的哈希。
