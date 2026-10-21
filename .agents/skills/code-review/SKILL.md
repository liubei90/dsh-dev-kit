---
name: code-review
description: 'Use when reviewing a pull request in this repository — orients the reviewer to the project standards (AGENTS.md conventions, defensive patterns, Agent Note rules, quality gates) and the review-specific checks that code alone cannot show.'
---

# Reviewing a PR in this repository

**This skill is guidance, not a complete checklist.** Verify and fetch the PR's live base and exact head, then run `pnpm --silent run change-scope --base <verified-base-ref> --head <verified-head-ref>` before reading the diff and enough surrounding code to understand the design. The report identifies the paths in scope but does not replace semantic review. Re-establish the base and rerun it after a retarget or merge. Prioritize correctness, lifecycle, security, and broken required behavior over style; a short review with one substantiated blocker is better than a list of nits.

**Read the requirement before judging the diff.** Take the requirement from the PR description and the behavior it claims, map every changed path to the artifact it serves — component, route or service, shared DTO, package export, or document — and open that artifact's page in the [defensive patterns](../../../docs/defensive-patterns/README.md) directory before reading the diff. Code alone does not say what the change was meant to do; judge the diff against the claimed behavior, then against its artifact page.

## Sources of truth

- [AGENTS.md](../../../AGENTS.md): standing repository rules and conventions.
- [docs/architecture.md](../../../docs/architecture.md): app and module layout, contracts, and extension points.
- [docs/defensive-patterns/](../../../docs/defensive-patterns/README.md): mandatory review rules routed by artifact — [general](../../../docs/defensive-patterns/general.md), [server and API](../../../docs/defensive-patterns/server-and-api.md), [client components](../../../docs/defensive-patterns/client-components.md), [shared contracts](../../../docs/defensive-patterns/shared-contracts.md).
- [docs/AGENTS.md](../../../docs/AGENTS.md): documentation placement and prose discipline.
- [prose-standard](../prose-standard/SKILL.md): required coverage and editorial judgment for comments, docs, prompts, and visible strings.
- [error-handling](../error-handling/SKILL.md): typed failures, handling ownership, state guarantees, and visible failure reports.
- [ci-test-reliability](../ci-test-reliability/SKILL.md): isolation and regression-proof rules for resource-owning, asynchronous, or flaky tests and fixtures.
- [client-ui-ux](../client-ui-ux/SKILL.md): feedback-surface choice, overlay safety, and visual token discipline for user-visible UI changes.
- [docs/testing.md](../../../docs/testing.md): required test tiers and gates.
- [Agent Notes](../../notes/README.md): design rationale. Treat disagreement with an Agent Note as a design discussion, not an automatic veto.

## Blocking requirements

1. **New prose receives semantic review.** Use [prose-standard](../prose-standard/SKILL.md) to critically review every added or changed Markdown passage, JSDoc, comment, prompt, description, diagnostic, and visible string. Verify required coverage, accuracy, placement, and editorial quality against the owning code or behavior; automated checks do not establish those properties.
2. **Docs match the code.** Config, defaults, errors, API fields, events, and public behavior update the owning README and JSDoc in the same diff. Comments state non-obvious contracts; flag implementation narration, test walkthroughs, review history, and duplicated rationale for deletion or a link to their one home.
3. **Type and data contracts match.** Changes to exported types, the OpenAPI/HTTP contract, shared DTOs, or the database schema update the owning reference — the API reference, `packages/shared`, and the migration notes — in the same diff. Internal types need no reference entry.
4. **Resources clean up.** Verify each new subscription, listener, timer, connection, or pool contribution has a registered teardown and passes the disposal tests required by [the root rules](../../../AGENTS.md).
5. **Required evidence exists.** Verify the author ran the [relevant local checks](../../../AGENTS.md) for the diff and that CI covers the exhaustive matrix; review the semantic gaps neither can detect.
6. **Client UI copy is locale-owned.** Reject product text embedded in JSX, helper returns, accessibility attributes, or component defaults. Require typed copy-dictionary keys or explicit localized props, and behavior evidence for every changed string.

## Manual checks

- **Intent and interface contracts:** trace both sides of every changed interface. Confirm the implementation matches the PR and any Agent Note, including errors, cancellation, ownership, and disposal.
- **Lifecycle and concurrency:** for async setup, callbacks, processes, or teardown, apply [general defensive patterns](../../../docs/defensive-patterns/general.md). Check races before publication, cancellation during awaits, independent error reporting, callback containment, ownership before reentry, complete detach cleanup, and quiescent disposal.
- **Error handling:** apply [error-handling](../error-handling/SKILL.md) to every changed failure path — typed failures, handling ownership, state guarantees, and the final report a user sees. Reject catch-and-continue unless the owner of the affected state can show the preconditions of the dependent work still hold.
- **Layering and consumer fit:** trace every current consumer, then flag consumer-specific behavior leaking into a shared module or a generic service. Flag the inverse too: a new public method or exported type whose only caller is one internal consumer is an unnecessary API expansion; prefer a private function handed to that consumer.
- **Scope, ownership, and necessity:** map each abstraction, state machine, option, defensive copy, and compatibility path to its current contract and production consumer. Challenge unrelated features and speculative generality, then test the PR against [the root rules](../../../AGENTS.md).
- **Configuration and public choices:** ask what current-consumer evidence or prior art supports each default, public operation set, format, or imported external concept. Require an explicit choice or deferral when that evidence is absent.
- **Security and authorization:** follow every permission check to the operation that enforces it; exercise direct and alternate callers that can bypass validators, wrappers, or middleware ordering. Verify auth on every mutating endpoint, parameterized queries, and secret handling.
- **Client UI review:** for any user-visible change, apply [client-ui-ux](../client-ui-ux/SKILL.md) to feedback surfaces, overlay safety, theme contrast, loading states, and copy placement.
- **Borrowed and derived state:** determine whether each retained value is borrowed or owned under the module contract, then trace notifications and every cache, UI echo, and query view to the documented success point and authoritative source.
- **Bounds cover the final operation:** locate the owner of the complete emitted or retained result, including wrappers and metadata. Probe tiny and exact limits, oversized single chunks, and multibyte text for byte limits.
- **Real entry path:** tests exercise the shipped app entry, the HTTP server, or a real component mount where relevant. A hand-invoked function does not catch invalid exports or bootstrap wiring.
- **Test strength:** assertions fail on the intended regression and verify external state, logs, events, database rows, or disposal rather than restating the implementation or trusting an agent's report. Coverage is necessary but not evidence that the scenario is correct.
- **Test reliability:** for a resource-owning, asynchronous, platform-sensitive, or flaky test, apply [ci-test-reliability](../ci-test-reliability/SKILL.md) to the real worker/job topology, resource allocation, global-state restoration, synchronization, timeout budget, and quiescent teardown.
- **Negative controls:** verify a deliberately invalid case fails through the real runner for each changed acceptance rule.
- **Database and migration review:** schema changes ship a backward-compatible migration; destructive operations are reviewed explicitly; indexes and query plans support the new access path.
- **Implemented Agent Notes match shipped reality:** when a PR implements a proposed Agent Note, move and rewrite it as present-tense shipped state in the same diff, then verify paths, names, and mechanisms against the implementation.
- **Generated and visible output:** changes to OpenAPI output, shared DTOs, or user-facing copy update their owning expected output in the same diff. Review expected-output diffs as behavior changes, not formatting noise.

## Reporting findings

State the defect, location, impact, and evidence. Place a localized defect inline on the tightest relevant diff range; use a PR-level comment for cross-cutting architecture, scope, or review-wide synthesis. Separate blockers from suggestions and omit issues already enforced by a green gate. Use the existing GitHub review thread for replies. When receiving review, verify each claim and fix or rebut it on technical grounds without performative agreement.
