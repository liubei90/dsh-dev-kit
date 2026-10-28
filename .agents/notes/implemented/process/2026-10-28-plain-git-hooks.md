# Agent Note: 用纯 sh 脚本取代 lefthook 钩子

Status: implemented

## Problem

lefthook 2.2.0 的每个 pre-commit/pre-push 任务在本机 Windows 上直接失败，任务退出码 `0xc0000142`，``sh` 拉起 `bash` 时打印 `fatal error - NtCreateDirectoryObject(\BaseNamedObjects\msys-2.0S5-...): 0xC0000022`。失败的进程是被 lefthook(Go)用 `CreateProcess` 启动的 Git bash，不是 lefthook 自身。用 20 行 Go 程序复现了同一崩溃(Go 程序由 Git 的 `sh` 启动后再拉起 `bash`)，而 Node 与 `cmd` 启动的 bash 正常；把 Git 从 2.38.1 升到 2.56.0 后仍然失败，用任务计划器在干净会话里运行也失败。结果是本机没有任何提交能通过钩子，只能用 `--no-verify`，钩子提供的证据等于零。

## Decision

钩子改成提交在仓库里的 POSIX sh 脚本，由 Git 的 `core.hooksPath` 指向，`lefthook` 依赖、`lefthook.yml` 与安装脚本一并删除。

- `.githooks/pre-commit` 做空白检查、对 staged 的 `*.ts`/`*.tsx` 跑 `oxlint --fix` 并把修好的文件重新 `git add`；staged 文件命中 Agent Note、归档笔记或技能目录时，分别跑对应的校验脚本。
- `.githooks/pre-push` 跑 `pnpm run typecheck` 与 `pnpm run test:affected`。
- `scripts/install-git-hooks.mjs` 把 `core.hooksPath` 设成 `.githooks`，由 `postinstall` 调用；POSIX 上顺带补执行位。
- 钩子由 Git 自带的 `sh` 执行，钩子里的命令都是原生命令(`pnpm`、`git`)，Cygwin 进程只出现在最外层，不跨越 Go 程序。

## Alternatives considered

- **保留 lefthook，升级 Git** —— 落选：Git 2.38.1 升到 2.56.0 后同一崩溃仍在，问题在 lefthook 的 `CreateProcess` 路径，不在 MSYS 运行时版本。
- **用 Node、cmd、PowerShell 或 `start` 包一层再启动 lefthook** —— 落选：四种包装都复现同一崩溃；崩溃发生在 lefthook 启动 bash 的那一步，外层换什么进程都绕不过。
- **把 lefthook 的任务换成 `script:` + `runner: node`** —— 落选：仍要保留 lefthook 与它的 YAML，同时多出一批只为绕开 sh 存在的脚本；收益只剩 staged 过滤，成本高于直接写 sh。
- **自写 Node 钩子运行器** —— 落选：Node 能工作(它启动 bash 时不泄漏句柄)，但每个钩子多一层进程与一份自维护的任务模型；sh 脚本在 macOS、Linux、Windows 上都能直接跑。
- **只在 Windows 用 sh、其它平台保留 lefthook** —— 落选：同一组任务写成两份配置，改动要同步两处。
- **不装钩子** —— 落选：本地秒级检查是模板的一部分，CI 全量跑得慢，提交前拦不住明显问题。

## Consequences

- 失去 lefthook 的并行任务与 per-job glob：任务串行执行，文件选择改由 `git diff --cached --name-only -- <pathspec>` 决定。
- `oxlint --fix` 只重新暂存本次 lint 过的文件，不会把无关的未暂存改动带进索引。
- 钩子依赖 Git 自带的 `sh` 与已安装的 `node_modules`；`postinstall` 没跑时 `core.hooksPath` 不生效，钩子静默缺失，补救命令写在 [docs/development.md](../../../../docs/development.md)。
- 旧安装残留在 `.git/hooks/pre-commit` 的 lefthook 壳被 `core.hooksPath` 覆盖，不再执行，也不需要清理。
- 工作区依赖少一个(`lefthook` 与其平台包)，`postinstall` 不再下载二进制。
