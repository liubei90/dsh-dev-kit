---
name: speed-up-perf
description: 'Use when investigating or optimizing performance in this repository — React rendering and first paint, API latency, database queries, bundle size, build duration — designing realistic benchmarks or performance gates, or turning performance evidence into measured behavior-preserving fixes.'
---

# Speed Up Performance Work

Turn a broad “make it faster” request into reproducible user-path measurements and small, evidence-backed fixes. This is guidance, not a quota or a script: survey broadly, follow measured cost, and reject attractive changes that do not improve the workload users actually run.

## Establish scope and current authority

Read [AGENTS.md](../../../AGENTS.md), [architecture](../../../docs/architecture.md), [testing policy](../../../docs/testing.md), [defensive patterns](../../../docs/defensive-patterns/README.md), and the affected modules' instructions and Agent Notes. Use [CI test reliability](../ci-test-reliability/SKILL.md) for processes, clocks, browser tests, and asynchronous cleanup.

Agree on the user-visible endpoint, workload range, resource constraints, acceptable minor behavior differences, and stopping rule. Keep browser and server end-to-end measurements separate: a fast handler or a fast client-side fold does not prove fast transport, paint, scrolling, or input response. Exclude external-service latency when measuring local overhead, and state that exclusion rather than calling the result complete product latency.

Inspect the exact current base, not just the running checkout. Study final merged diffs, owning source, tests, and resolved review threads; a PR body can describe an abandoned implementation. Separate merged, closed-unmerged, superseded, estimated, and newly measured evidence.

## Survey user paths, then rank candidates

Delegate independent domains when breadth helps; require measurements and production call sites, not guesses. Useful scenarios include:

- **React rendering and first paint:** initial route render, first contentful paint, route transitions, list virtualization, re-render storms from context or state updates, and expensive derived state.
- **API latency:** hot endpoints, request serialization overhead, N+1 upstream calls, connection-pool limits, and middleware added per request.
- **Database queries:** missing indexes, full scans, N+1 loads, oversized result sets, and transaction scope held across awaits.
- **Bundle size:** entry chunk growth, missing code splitting, duplicate copies of a dependency, and imports that defeat tree-shaking.
- **Build duration:** project-reference rebuilds, per-package `tsc` cost, incremental and cache behavior, and work repeated in every workspace.

Vary independent cost drivers: rows, payload bytes, rendered DOM nodes, component instances, concurrent requests, and build inputs are different quantities. Do not call a large count of tiny identical records “realistic” without checking which user operation it stresses. Include typical and tail workloads, but avoid a combinatorial matrix with no decision value.

Rank candidates by observed user latency, CPU and allocations, retained memory, occurrence, and confidence. For each, name the production consumer, the repeated work, the expected complexity, the smallest falsifiable intervention, and the behavior that must remain stable. A suspicious loop, unused cache, or large file alone is not evidence of a bottleneck.

## Build realistic synthetic benchmarks first

Extend an existing benchmark or performance lane rather than creating competing calibration or reporting infrastructure. Module-local diagnostics remain beside their owner; cross-cutting required cases live where the measured user path lives.

If the user authorizes local data inspection, extract only aggregate workload characteristics. Never copy payloads, outputs, paths, identities, ids, credentials, recordings, or recognizable snippets into fixtures, logs, screenshots, PRs, or artifacts. Generate fixed inputs from reviewed constants; no benchmark depends on the user's home directory, an ambient repository, a network service, or private data.

Before implementation, record a measurement card:

| Field | Required decision |
|---|---|
| User operation | Exact action and externally observable completion condition |
| Workload | Fixed dimensions, distributions, construction seed or constants, and why they exercise ordinary and tail use |
| Entry path | Production calls and composition, built artifacts, and mocked external boundaries |
| Clock | Included setup, cold and warm state, timing start and end, and excluded costs |
| Memory | Reachable endpoint objects, baseline, GC policy, retained versus transient limits |
| Verdict | Raw samples, chosen aggregate, calibrated absolute, ratio, or memory limits, and the negative control |
| Behavior | Owning functional tests and permitted minor differences |

Measure built JavaScript under plain Node for server-side CPU work (`pnpm run build` first); source-loader overhead and module resolution are not the shipped path. Browser cases use the built web assets through the real app entry. Do not add a production export solely for measurement or copy the algorithm into a “benchmark implementation.”

Use fresh processes and private temporary roots for cold and process-memory samples. Warm samples explicitly retain the intended cache; never let fixture setup secretly warm a cold scenario. Keep the same input, validations, completion condition, and reachable output on both sides. A parse-and-discard baseline is not comparable with validated retained data.

Report all samples and the aggregate that decides the result. Keep manual browser diagnostics threshold-free. A required browser performance case needs an explicit lane decision and repeated measurements on its actual CI browser and runner before adopting timing budgets; a machine multiplier alone is not browser calibration. Budgets are source constants, not environment overrides. Serialize measured work against other owned CPU-heavy jobs; measure reference and candidate under comparable conditions. Do not widen a budget or select a lucky run to hide a regression.

Measure end-to-end latency independently from component phases. Track retained memory with the intended objects still reachable, and transient pressure separately through constrained-heap completion or an appropriate peak measurement. Faster execution with unbounded retention is not an automatic win.

For browser responsiveness, use real browser input and observe the resulting UI update. Include the final stall in frame and input measurements, distinguish scheduled timers from actual input, and bound synthetic producers so catch-up bursts do not invent a different workload. State whether first paint, scrolling, paging, live updates, and hidden-but-mounted views are covered. Node folds and fake DOMs alone cannot establish browser responsiveness.

## Prove the regression, then remove work

Run the unoptimized workload before changing production code. Save the command, revision, runtime and platform, fixture dimensions, raw measurements, and verdict. Reduce a failing scenario until it still exercises the real bottleneck, then rank falsifiable hypotheses before patching. Use profiles, allocation samples, work counts, or phase timings to distinguish them.

Common patterns worth testing, not automatic prescriptions:

- Keep compact representations compact through downstream readers; avoid per-row objects when the consumer needs settled content or one aggregate.
- Remove duplicate parsing, copying, freezing, and validation only after identifying the actual ownership and trust transition. Typed same-process borrowing is not permission to weaken durable or wire parsing.
- Stream large transformations and bound intermediate state rather than retaining every generation. Include publication, verification, and readiness obligations where the user operation requires them.
- Separate read-only preparation from write and publication work without moving awaited work past a correctness-required endpoint.
- Defer hidden-view and collapsed-detail work; measure first activation and retained state too. Deferral is not deletion, and viewport highlighting is not full virtualization.
- Stabilize identities and narrow subscriptions so one changed node does not invalidate an entire list; preserve update ordering and immediate-event behavior.
- Prefer a suitable data structure to repeated shifting, scanning, or rebuilding. Measure the whole consumer path, not just the isolated container operation.
- Use revision-keyed reuse or singleflight only with explicit invalidation, bounded retention, independent waiter cancellation, and disposal ownership. Avoid caching expanded representations merely to make repeated benchmarks look fast.

Change one causal factor at a time. Re-run both the focused scenario and its end-to-end parent. Require a negative control: the tightened assertion fails on the original implementation or on a controlled reintroduction of the targeted cost. A threshold so generous that the regression passes is not protection; a budget below a verified noise floor is not reliable either.

## Preserve behavior and resource ownership

Performance measurements complement functional evidence; they do not replace it. Run or add the narrow owning tests for output, ordering, paging, error paths, cancellation, concurrency, and disposal as applicable. Preserve equivalence of externally observable output, atomic publication, required validation, and readiness guarantees. Do not silently truncate data, skip work the user asked for, or change lifecycle semantics to reach a number.

State any deliberate minor visible difference and verify it through the owning test. Reject an optimization when gains disappear end-to-end, a typical workload regresses materially, complexity outweighs a small gain, or cancellation, retention, and durability cannot be explained and tested. Record the rejected hypothesis briefly instead of expanding scope to justify it.

## Deliver a bounded, reviewable result

Use [the Agent Note rules](../../notes/README.md) for durable rationale, alternatives, calibration, exclusions, and remaining risks. Check for superseded relevant notes without turning performance work into a corpus-wide prose cleanup. Keep the reusable procedure here and scenario-specific truth with its benchmark or module owner.

Keep each change mergeable: benchmark or measurement infrastructure can land separately to protect the measured baseline, and the optimization change then carries its fix, functional coverage, and tighter budget. Independent bottlenecks may be separate changes. Fix a finding in its owning change before propagating upward.

Apply [pre-push checks](../pre-push-checks/SKILL.md), report only executed evidence, and inspect CI rather than assuming local timing proves runner stability. After marking ready, evaluate review findings against code and executable evidence; reply with the reason or fix and resolve addressed threads. Do not dismiss a report merely because it came from a bot.

Summarize each result as: workload → before and after absolute values and ratio → endpoint and memory semantics → behavior evidence → negative control → exact checks → exclusions. Separate author-reported historical numbers, fresh local measurements, and CI evidence. Stop at the agreed scenario and fix scope; retain a short ranked follow-up list instead of chasing unrelated opportunities.
