# Historical simplification patterns

Use these patterns to calibrate a candidate whose value is not established by an unused-symbol search. They describe recurring decision shapes; verify the current owner and any durable-data obligation before applying one.

## Require a complete effect path

A declaration, serializer branch, and test can form convincing-looking support without an effective feature. Trace both ends: something must produce the value, and an implementation must honor it. Removing reserved variants with no emitters is a clean cut; a knob rejected by every consumer is dead, while a working field a caller can set is not. Deletion includes declarations, forwarding, rejection-only tests, and generated documentation.

Zero fixed call sites is weaker evidence than unreachability. A deliberate extension point for third-party or out-of-tree consumers can be intentional; inspect how consumers discover and invoke it before calling it dead.

## Reduce distinctions where consumers decide

Map every public variant to the consumer action it enables. Projecting several internal states onto one usable status can delete registration methods, invalidation logic, and combination tests, provided routing keeps the internal distinctions it needs.

Do not erase distinct durable facts merely because one renderer ignores them. If persisted records need start and completion markers for recovery, inspection, or empty-failed-run reporting, simplify the projection, not the record.

## Trade general behavior for a smaller explicit promise

A used feature can still be an expensive way to satisfy the required outcome. Replacing a general recurrence engine with a fixed interval, or automatic rollback with explicit failure reporting, can delete a parser, an evaluator, durable variants, and backlog states. State the loss as clearly as the deletion, and reject the trade when the data or behavior is required rather than merely convenient.

## Make assumptions explicit at their consuming operation

Look for a local default that has acquired shared storage, synchronization, or confirmation machinery. Moving an assumption to the operation that consumes it — an explicit time zone, an explicit tenant, a caller-supplied limit — can remove cross-request defaults, conflict state, and wrapper layers.

Do not move a requirement past the place that must enforce it. Removing duplicate client-side validation is safe only while the server still validates before lookup and invocation; name the cost, such as later failure discovery.

## Derive at use or reuse an existing delivery owner

For each cache or subscription, ask when the consumer needs the value and whether an authoritative source already retains it. Reading the canonical record at use time can delete a continuously copied buffer and its listeners; sorting current summaries can replace persisted history when manual ordering is separate user state.

The timing promise decides whether this works: derive-time filtering differs from capture-time filtering, and a cache remains necessary when no authoritative source is retained. Name such residual obligations instead of declaring all caches redundant.

## Remove accidental composition owners

Inspect actual launch and resolution paths before trusting names such as demo, support, or example. Duplicate compositions, pass-through settings, and resolver-only workspaces disappear when tests, guides, and shipped assets move to their owners; explicit deployment policy can replace inference from a sibling module's presence.

A smaller module count is not sufficient. Separate caller intents may have different ownership and completion timing; prove the replacement's real composition and dependency behavior, and account for all remaining configuration and lifecycle glue.

## Use rejected experiments to test parity claims

A past rejection is a scoped falsifier, not a permanent package blacklist. A nominally equivalent builtin or library can defeat deterministic fake-clock tests, or can omit configured bounds, security rules, lifecycle ownership, or deployment behavior the hand-rolled code enforces. Revisit a rejection only with new evidence addressing the failed premise, and measure the implementation, glue, tests, dependencies, and supported behavior together.
