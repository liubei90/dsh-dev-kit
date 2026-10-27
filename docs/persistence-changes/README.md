# 持久化变更记录

`apps/api/migrations/*.sql` 决定持久化 schema。schema 摘要变化时，同一 PR 必须新增一条变更记录，说明改了什么、为什么兼容、怎么验证与回滚。目录里只放 `README.md` 和 `yyyy-mm-dd-<slug>.md` 记录；当前没有迁移文件时目录只有本文，记录链为空是合法状态。

## 什么属于这里

这里记录的是**已写入磁盘的数据格式**：它的旧字节在代码更新后仍必须被正确读取。kit 当前的持久化面是 `apps/api/migrations/*.sql` 定义的数据库 schema——迁移 N 写出的行，必须能被迁移 N+1 的代码读取。

不属于这里、由别的机制承担的变更：

- **API wire 契约**（`packages/shared` 的 DTO）：请求与响应是瞬时的、不落盘；破坏性变更由同 PR 更新消费端类型与评审承担，需要对外留痕时写升级指南，不写本目录。
- **配置与环境变量**：运维可改，不是数据格式。
- **设计决策与被否决的备选**：写 Agent Notes。
- **行为变化**：由测试与评审承担。

判断标准只有一条：**这次变化会不会改变"已经写出的字节"如何被解释**。会，就写记录；不会，就不要写——本目录不是功能变更日志。与 schema 变更配套的编码规则见根 [AGENTS.md](../../AGENTS.md) 的"数据库与迁移"。

## 记录格式

文件名必须是 `yyyy-mm-dd-<slug>.md`：日期是真实日历日期，slug 只含小写字母、数字和单个连字符。文件头必须依次为标题、空行、摘要、前驱：

```
# 持久化变更：<title>

Schema-Digest: sha256:<64 位小写十六进制>
Predecessor: <上一条记录的文件名 | none>
```

文件头之后必须出现 `## 变更`、`## 兼容性`、`## 验证与回滚` 三个二级标题，顺序不限。`## 变更` 写 schema 变化与受影响的表、列、索引；`## 兼容性` 写旧数据与新读者是否仍安全，破坏性变更要写明评审结论；`## 验证与回滚` 写跑过的检查与撤回迁移的方式。

摘要来自当前迁移文件解析后的规范化 schema：按文件名顺序应用迁移，表与索引按名字排序，列与表级约束保持声明顺序，再对规范化文本取 sha256。摘要值用 `node scripts/verify-persistence-changes.ts` 的输出或 `docs/persistence-catalog.md` 的 `Schema 摘要` 行确认。

## 校验规则

`node scripts/verify-persistence-changes.ts` 读取本目录内的记录并校验：

- 每条记录的文件名、日期与三个必需章节合法；
- 第一条记录写 `Predecessor: none`，之后每条指向上一条记录的文件名；
- 相邻记录摘要必须不同，即每条记录都代表一次真实的 schema 变化；
- 链上最后一条的 `Schema-Digest` 必须等于当前 schema 摘要。

空链只有一种合法情形：没有任何迁移文件，schema 摘要等于空 schema 的 sha256。迁移文件非空而记录链为空时，校验会失败并提示新增记录；不要用占位记录绕过，记录本身也要描述真实变化。

## 命令

- `pnpm run gen-persistence-catalog`：重新生成 [持久化 schema 目录](../persistence-catalog.md)，打印写入路径与摘要。该文件由生成器拥有，不要手改。
- `pnpm run verify-persistence-catalog`：把磁盘上的目录文件与重新生成的结果逐字节比较，漂移或缺失即失败。
- `pnpm run verify-persistence-changes`：校验记录链与当前 schema 摘要一致。

解析器支持 `CREATE TABLE`（列定义与表级 `PRIMARY KEY`、`UNIQUE`、`FOREIGN KEY`）、`CREATE [UNIQUE] INDEX`、`ALTER TABLE ... ADD COLUMN`、`DROP TABLE`、`DROP INDEX`、`--` 行注释与双引号、反引号、方括号标识符。`CHECK` 约束、块注释、索引表达式等未支持的形式会带着文件名、行号和语句原文报错，不会静默跳过；需要新语法时先扩展 [解析器](../../scripts/persistence-schema.ts) 及其测试。
