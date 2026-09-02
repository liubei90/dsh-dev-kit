# Agent Note: Adopt the DeepSeek Harness development system

Status: implemented

## Problem

A new full-stack TypeScript project needs an AI-agent-first development system: layered instructions for coding agents (Claude Code/Codex), a decision-record corpus, reusable workflows, and mechanical gates. DeepSeek Harness (MIT) runs its own development on exactly this pattern; its conventions are Cordis/agent-specific, but the four-component organization (layered AGENTS.md, Agent Notes, skills, gates) transfers to any TypeScript project.

## Decision

This repository adopts the four-component organization from DeepSeek Harness, with content rewritten for a general full-stack TS monorepo:

- Layered `AGENTS.md` standing orders (root + subtree rules) whose conventions cover full-stack concerns absent from the source: frontend/backend contract, DB migrations, security, error envelopes.
- Agent Notes under `.agents/notes/` with the same lifecycle folders, classification, gated format, and frozen archive.
- Six methodology skills under `.agents/skills/` (prose-standard, trim-cot-leakage, code-review, ci-test-reliability, pre-push-checks, find-simplifications), renamed without the `dsh-` prefix.
- Mechanical gates: lefthook pre-commit/pre-push, verify scripts aggregated by `doc-sync`, CI.

Discarded from the source: session-snapshot replay, Cordis capability seams, bilingual doc pairing (optional), per-file 100% coverage (threshold adjusted), `dsh-doc`/`dsh-translate-docs` skills.

## Alternatives considered

- **Copy the source AGENTS.md verbatim** — rejected: its Conventions are Cordis/agent vocabulary; a full-stack project needs contract, DB, and security rules instead.
- **Adopt only Agent Notes** — rejected: the value is the four-component closure; notes without skills and gates drift back to ADR-by-convention.
- **Keep the `dsh-` skill prefix** — rejected: the prefix names the source project; skills here are generic methodology.

## Consequences

- Every non-trivial change carries an Agent Note; implemented notes describe shipped reality in the present tense.
- Gates are mechanical: agents follow enforced rules more reliably than prose conventions.
- The template remains general: business type (admin console, client app, API service) is left to the consumer.
