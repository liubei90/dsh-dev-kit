---
name: code-review
description: Use when reviewing a pull request in this repository — orients the reviewer to the project's standards (AGENTS.md conventions, defensive patterns, quality gates) and the review-specific checks that code alone can't show
---

# Reviewing a PR in this repository

**This skill is guidance, not a complete checklist.** Verify and fetch the PR's live base and exact head, then run `pnpm --silent run change-scope --base <verified-base-ref> --head <verified-head-ref>` before reading the diff and enough surrounding code to understand the design. The report identifies paths and dirty layers but does not replace semantic review. Re-establish the base and rerun it after a retarget or merge. Prioritize correctness, lifecycle, security, and broken required behavior over style; a short review with one substantiated blocker is better than a list of nits.

## Sources of truth

- [AGENTS.md](../../../AGENTS.md): standing repository authoring rules.
- [docs/defensive-patterns.md](../../../docs/defensive-patterns.md): subprocess, callback, async-state, and disposal bug classes.
- [docs/AGENTS.md](../../../docs/AGENTS.md): documentation placement and prose discipline.
- [prose-standard](../prose-standard/SKILL.md): required coverage and editorial judgment for comments, docs, prompts, and visible strings.
- [ci-test-reliability](../ci-test-reliability/SKILL.md): isolation and regression-proof rules for resource-owning, asynchronous, or flaky tests and fixtures.
- [docs/testing.md](../../../docs/testing.md): required test tiers and gates.
- [Agent Notes](../../notes/README.md): design rationale. Treat disagreement with an Agent Note as a design discussion, not an automatic veto.
- For bilingual changes, read the repository's translation rules; the extended translation skill is outside automatic review and runs only on explicit user invocation.

## Blocking requirements

1. **New prose receives semantic review.** Use [prose-standard](../prose-standard/SKILL.md) to critically review every added or changed Markdown passage, JSDoc, comment, prompt, description, diagnostic, and visible string. Verify required coverage, accuracy, placement, and editorial quality against the owning code or behavior; automated checks do not establish those properties.
2. **Docs match the code.** Config, defaults, errors, API fields, events, and public behavior update the package README and JSDoc in the same diff. Comments state non-obvious contracts; flag implementation narration, test walkthroughs, review history, and duplicated rationale for deletion or a link to their one home.
3. **Public API docs match.** Changes to exported types, REST/gRPC contracts, or DB schemas update the owning reference (OpenAPI spec, type catalog, migration docs) in the same diff.
4. **Resources clean up.** Verify each new registry, listener, connection, subscription, or timer contribution passes the disposal tests required by the repository rules.
5. **Required evidence exists.** Verify the author ran the [relevant local checks](../../../AGENTS.md#run-relevant-checks-locally) for the diff and that CI covers the exhaustive matrix; review the semantic gaps neither can detect.
6. **Client UI copy is locale-owned.** Reject product text embedded in JSX, templates, helper returns, accessibility attributes, or primitive defaults. Require typed dictionary keys or explicit localized props, a UI-i18n check, and behavior evidence in each affected locale; preserve user/data/code tokens verbatim.

## Manual checks

- **Intent and interface contracts:** trace both sides of every changed interface. Confirm the implementation matches the PR and any Agent Note, including errors, cancellation, ownership, and disposal.
- **Lifecycle and concurrency:** for async setup, callbacks, processes, or teardown, apply [defensive-patterns.md](../../../docs/defensive-patterns.md). Check races before publication, cancellation during awaits, independent error reporting, callback containment, ownership before reentry, complete detach cleanup, and quiescent disposal.
- **Layering and consumer fit:** trace every current consumer, then flag consumer-specific behavior leaking into a shared module or generic service. Flag the inverse too: a new public method or exported type whose only caller is one internal consumer is an unnecessary API expansion.
- **Scope, ownership, and necessity:** map each abstraction, state machine, option, defensive copy, and compatibility path to its current contract and production consumer. Challenge unrelated features and speculative generality, then test the PR against [the root rules](../../../AGENTS.md#conventions).
- **Configuration and public choices:** ask what current-consumer evidence or prior art supports each default, public operation set, format, or imported external concept. Require an explicit choice or deferral when that evidence is absent.
- **Security and authorization:** follow every permission check to the operation that enforces it; exercise direct and alternate callers that can bypass validators, wrappers, or middleware ordering. Verify auth on every mutating endpoint, parameterized queries, and secret handling.
- **Borrowed and derived state:** determine whether each retained value is borrowed or owned under the module contract, then trace notifications and every cache, UI echo, and query view to the documented success point and authoritative source.
- **Bounds cover the final operation:** locate the owner of the complete emitted or retained result, including wrappers and metadata. Probe tiny and exact limits, oversized single chunks, and multibyte text for byte limits.
- **Real entry path:** tests exercise the shipped app entry, bin, worker, or HTTP server where relevant. A hand-invoked function does not catch invalid exports or bootstrap wiring.
- **Test strength:** assertions fail on the intended regression and verify external state, logs, events, DB rows, or disposal rather than restating the implementation or trusting an agent's report. Coverage is necessary but not evidence that the scenario is correct.
- **Test reliability:** for a resource-owning, asynchronous, platform-sensitive, or flaky test, apply [ci-test-reliability](../ci-test-reliability/SKILL.md) to the real worker/job topology, resource allocation, global-state restoration, synchronization, timeout budget, and quiescent teardown.
- **DB and migration review:** schema changes ship a backward-compatible migration; destructive operations are reviewed explicitly; indexes and query plans support the new access path.
- **Implemented Agent Notes match shipped reality:** when a PR implements a proposed Agent Note, move and rewrite it as present-tense shipped state in the same diff, then verify paths, names, and mechanisms against the implementation.
- **Bilingual changes:** compare meaning and terminology on both sides; a green pairing hash does not prove translation quality.

## Reporting findings

State the defect, location, impact, and evidence. Place a localized defect inline on the tightest relevant diff range; use a PR-level comment for cross-cutting architecture, scope, or review-wide synthesis. Separate blockers from suggestions and omit issues already enforced by a green gate. Use the existing GitHub review thread for replies. When receiving review, verify each claim and fix or rebut it on technical grounds without performative agreement.
