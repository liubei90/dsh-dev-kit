---
name: error-handling
description: Apply error-handling principles when designing or reviewing failures, error classes and codes, recovery, retries, background tasks, and user-visible error reports.
---

# Error handling

Define failures, their owners, and what remains safe after failure.

## Typed, structured failures

Expected failures need declared types, stable discriminants, and handling-relevant details. Reuse the owning package's error conventions, preserve causes, and separate machine identity from display text. Never route handling by parsing messages. Unexpected defects such as `assertNever` may remain plain `Error`; containment must never turn them into success.

## Catch, recover, or stop

For each failure, define handling and reporting owners, containment, and guarantees in the owning API documentation: valid invariants, absent/partial/committed/unknown effects, and cleanup responsibility. Background work retains these obligations.

Catching limits exception propagation, not mutations. Only the affected state's owner can establish safe continuation. Otherwise stop dependent work, discard invalid state or instances, or escalate. Logging alone is not recovery. Retries require safe repetition, cancellation, and an explicit owner; finite operations need budgets, while continuing supervision needs lifecycle ownership and observable degradation.

## Empty catch clauses

An empty `catch` has no statement other than `;` in its block, and it discards every failure its `try` raises. Use one only when every such failure is deliberately ignored: name the error and state in a comment why no handling is needed. Keep the `try` holding one statement; a wider `try` hides statements whose failures the clause also discards. `verify-empty-catch` enforces this rule, and [general.md](../../../docs/defensive-patterns/general.md) is its standing home.

```ts
// Rejected: three statements in one try; the clause hides two more failures.
try {
  await unlink(tempFile)
  registry.delete(id)
  emit('removed', id)
} catch (_cleanupFailed) {
  // A leftover temporary file holds no state anything reads.
}

// Accepted: one statement, a named error, and a reason.
try {
  await unlink(tempFile)
} catch (_cleanupFailed) {
  // The caller re-derives this path, so a stale file is harmless.
}
```

## Error codes

An error class carries a `name` and a `code` beside `message` and `cause`; consumers, logs and analytics route on those fields, never on message text.

- `name` is the class name in PascalCase ending in `Error`. Assign it as a string literal in the constructor, because a bundler may rename a colliding class binding.
- `code` matches `^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$` and names the condition by what the consumer does next, not where it happened: `DB_NOT_FOUND`, `AUTH_TOKEN_EXPIRED`.
- A code is a literal. Never build one from a template string, a status number, a path, an id or a foreign code.
- Reuse the owning domain's class and code before inventing one. Renaming or reclassifying a recorded code is an externally visible change.

## Localized, actionable, visible reports

Every final report needs a readable summary, affected operation, and safe next action. Localize through the receiving application's locale mechanism where one exists; other diagnostics use their existing output language. Keep sensitive internal details out of user-facing text.

An API boundary answers with a stable error code and an actionable summary only — `{ ok: false, error: { code, message } }` — while internal detail, causes, and stacks stay in logs.

Untrusted state or unknown outcomes must be visible through the UI or through default-enabled, accessible logs: report the impact, uncertainty, system disposition, and safe next step. Persistent invalid state needs persistent visibility. Never claim success, rollback, or safe retry without guarantees. Reporting failures need an independent fallback.

Verify resulting state and visible outcomes, not merely that an exception was caught.

## Foundations

Meyer's *Object-Oriented Software Construction* (1997): contracts and invariants; Sutter's *Exceptional C++* (1999): exception safety guarantees; Armstrong's [thesis](https://www.erlang.org/download/armstrong_thesis_2003.pdf) (2003): isolation and supervision.
