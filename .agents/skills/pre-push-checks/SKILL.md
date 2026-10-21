---
name: pre-push-checks
description: 'Use before pushing, force-pushing, marking ready for review, or claiming checks pass on a branch, to select the smallest tests and checks that cover the outgoing diff without reflexively running the full repository suite.'
---

# Pre-Push Checks

Use this skill to run relevant local evidence once before a push. Git hooks are intentionally narrow: pre-commit fixes staged lint, checks staged whitespace, and validates changed Agent Notes and skill metadata; pre-push runs the incremental typecheck and the affected-test selection. CI owns exhaustive coverage and the platform matrix.

## Inspect the outgoing change

1. Confirm the checkout and branch.

```sh
git status --short --branch
git rev-parse --show-toplevel
```

2. Verify the live PR base (usually `main`), fetch that ref, and inspect the complete scope against it.

```sh
pnpm --silent run change-scope --base <verified-base-ref>
```

`change-scope` requires `--base` and never guesses or fetches one; supply the ref verified from current remote or PR state, and add `--head <ref>` when inspecting a commit other than `HEAD`. Its versioned JSON report carries the base, head, and resolved merge base plus the committed, staged, unstaged, and untracked partitions; `scripts/change-scope.ts` owns the field names. After merging a changed base, rerun the report, reassess which behavior the combined scope can affect, and rerun only checks invalidated by the merge.

## Select relevant evidence

There is no universal local baseline beyond the hooks. Every behavior change needs the narrowest available test or purpose-built check that would fail for its regression; add broader checks only for surfaces the diff actually reaches.

When the outgoing change adds or changes a resource-owning or asynchronous test, fixture, helper, or CI execution path, use [ci-test-reliability](../ci-test-reliability/SKILL.md) first to decide whether restoration, negative-control, quiescent-teardown, or concurrent-process evidence applies. This skill still selects the commands and avoids repeating evidence that already passed.

- **App or package behavior:** run the owning Vitest file or focused test name. Add adjacent tests when a shared contract in `packages/shared` changes; leave repository-wide coverage to CI unless the change is genuinely cross-cutting or the user requests it.
- **Cross-process behavior:** run the owning integration or E2E spec when the changed contract crosses HTTP, the database, or the browser; a unit test alone does not cover a real boundary.
- **Documentation, Agent Notes, or doc-linked contracts:** run `pnpm run doc-sync`; run `pnpm run lint` when the documentation workflow requires it.
- **User-visible output:** run the focused test that owns the rendered text or interaction.
- **Build configuration, exported entry points, or shared DTOs:** run `pnpm run build` plus the owning consumer test, so a broken emit is caught before CI.
- **Test and script types against artifacts:** `pnpm run build` only produces artifacts. To check that the tests and scripts still type-check against that output, run `pnpm run build:check`, which reads the existing artifacts and does not rebuild. Run it after the latest build, or just run `pnpm run build`, before claiming completion.
- **External behavior:** run the relevant `pnpm run test:e2e` target when credentials are available; never print secrets.
- **Unknown blast radius:** `pnpm run test:affected` selects the tests reached by the outgoing diff and is also the pre-push hook's selection.

Do not manually repeat a passing check merely because commit or push follows. In particular, do not run typecheck immediately before pushing solely to duplicate the pre-push hook.

Pass Vitest file and name filters directly after the script name with `pnpm run`; do not insert a standalone `--`, which reaches Vitest and can disable `-t` filtering. For example:

```sh
pnpm run test packages/shared/tests/envelope.spec.ts -t 'rejects an unknown kind'
```

Check the reported selected test count before treating a filtered run as focused evidence.

### Focus unit coverage on the affected source

Test selection and coverage selection are separate. A Vitest file filter chooses which tests run, while the repository configuration otherwise measures every file under `apps/*/src` and `packages/*/src`. When unit coverage is relevant, name both the owning tests and the source files or package whose coverage those tests must prove:

```sh
pnpm exec vitest run packages/shared/tests/envelope.spec.ts \
  --coverage \
  --coverage.include='packages/shared/src/**/*.ts'
```

Use an exact source file when the behavior is truly confined to one module. Repeat `--coverage.include` for multiple affected files or packages, and pass every owning test file needed to exercise that scope. The thresholds in `vitest.config.ts` still apply inside the selected source scope.

When the owning tests are unclear, use Vitest's dependency graph to discover a candidate set, then inspect the selected tests before treating the run as evidence:

```sh
pnpm exec vitest related packages/shared/src/envelope.ts \
  --run \
  --coverage \
  --coverage.include='packages/shared/src/envelope.ts'
```

`vitest related` cannot discover behavior reached only through configuration, dynamic imports, subprocesses, workers, built artifacts, or external providers; select those owning tests explicitly. Do not use `--passWithNoTests`, lower coverage thresholds, or narrow `--coverage.include` merely to hide an uncovered affected file. If a selected scope fails because one focused test does not cover it, add its other relevant owning tests or narrow the source scope only when the excluded modules cannot be affected by the change.

## Full local rehearsal

Run the complete local approximation (`pnpm run check:all`) only when the user explicitly requests it, while diagnosing a CI failure, or when the change spans the repository so broadly that no narrower set is credible.

## Protect history-rewriting pushes

Rebase is allowed for standalone branches, including after review. Before a history rewrite, fetch the current remote branch and record its exact OID; publish with `--force-with-lease=<branch>:<observed-oid>` so a concurrent update aborts the push. Raw `--force` is never allowed.

After any rewritten push, fetch the live heads again and re-audit unresolved review threads, approvals, mergeability, and checks. Commit hashes and inline-comment anchors from before the rewrite are not current evidence.

## Handle failures

If a relevant check fails before a push, stop and fix or explain the blocker. Do not push and hope CI differs.

If a failure looks environment-specific, prove it:

- Record the exact command, failing test, and platform-specific mismatch.
- Confirm the relevant non-platform evidence.
- Prefer fixing cross-platform nondeterminism when the check is required.
- Bypass a local hook only when the user explicitly asks or agrees, and report exactly what failed and why CI is expected to differ.

## Push procedure

1. Run the selected relevant checks once.
2. Commit normally and inspect any files changed by the pre-commit fixer before continuing.
3. Push normally, or with the exact lease for an authorized rewritten branch, so the pre-push hooks run.
4. Verify the remote ref matches local `HEAD`.

```sh
git rev-parse HEAD origin/$(git branch --show-current)
```

For GitHub PRs, inspect remote CI after the push:

```sh
gh pr checks
```

Report pending checks as pending. Inspect failures before attributing them to the branch or the environment.

When `gh pr checks` reports "no checks reported" and the workflow-runs query for the head sha returns `total_count: 0`, read mergeability before suspecting the push or a dropped GitHub event:

```sh
gh pr view <number> --json mergeable,mergeStateStatus
```

GitHub creates no `pull_request` workflow runs while a PR is `CONFLICTING`/`DIRTY`, so the absent signal is the conflict, not infrastructure. Resolving the conflict is the only fix; empty commits, `--allow-empty` pushes, draft/ready toggles, and revert-and-restore bounces all leave the count at zero and add junk history. Confirm the conflicting paths with `git merge-tree --write-tree HEAD origin/main` when the branch cannot be merged locally yet.
