---
name: archive-agent-notes
description: 'Use when adding, auditing, pruning, archiving, or reviewing Agent Notes in this repository; checks every new note for superseded active records, deletes small UI and purely mechanical records, classifies other implemented notes by future decision value, deletes rejected notes that no longer prevent a tempting fallacy, and applies the frozen archived/{class} single-file and manifest rules.'
---

# Archive Agent Notes

Reduce the active decision corpus without erasing history that can still guide work. Judge every note semantically; word count and age are discovery aids, never archive criteria, and there is no target quota.

## Read the contracts

Read [the Agent Note rules](../../notes/README.md), [the archive instructions](../../notes/archived/AGENTS.md), and the applicable active lifecycle instructions before classifying. Use current code, configuration, app docs, newer Agent Notes, and inbound links to establish whether a rationale still owns or constrains anything.

## Check for superseded notes when adding one

Before drafting, apply the creation criteria in [the Agent Note rules](../../notes/README.md). Every new Agent Note triggers a scoped audit of active notes covering the same decision, mechanism, or rejected alternative. Classify each fully or partly superseded record while writing the new note: archive qualifying implemented notes in the same PR, retain and cross-link notes that are only partly superseded or still carry independently useful rationale, reject obsolete proposals, and delete rejected notes that no longer prevent a plausible mistake. Apply the Agent Note consolidation rule when the new owner absorbs every unique proposition; do not defer a known match to a later corpus audit.

## Classify by future value

Apply these lifecycle-specific outcomes:

- **Implemented — delete:** delete notes that only describe small UI adjustments or purely mechanical changes, and repair or remove inbound links. Local bug fixes, performance changes, new capabilities, and substantive behavior or ownership decisions do not qualify merely because they are implemented. Apply this criterion before keep or archive classification.
- **Implemented — keep active:** retain a note when its rationale, alternatives, negative guarantees, durable or wire semantics, ownership boundary, security rule, or reintroduction condition is likely to guide a future change. Classify the decision, not the mechanics of its implementation: a mechanical rename or type extraction can still record lasting naming, compatibility, or ownership rules. Length does not matter.
- **Implemented — archive:** archive a substantive historical decision when it is complete and unlikely to guide future work, but its historical rationale still warrants preservation. Do not archive records that meet the direct-deletion criterion.
- **Proposed — never archive:** keep a live proposal active; if it is no longer worth pursuing, reject it with an honest reason and satisfy the rejected lifecycle format.
- **Rejected — keep only as a guardrail:** retain a rejection only when the losing proposal remains a tempting, meaningful mistake and the note explains why it loses.
- **Rejected — delete:** delete the whole note when the rejected idea is obsolete, superseded, no longer plausible, or unlikely to prevent re-litigation. Repair or delete inbound links.

Do not archive toward a quota. Inspect every note in scope, classify analogous groups under one principle, use best judgment for close cases, and record genuinely borderline decisions for the handoff.

## Calibrated examples

These examples set the bar; the word counts demonstrate that size is not the test.

Delete implemented notes such as:

- a collapsed sidebar control rail — 533 words: a closed, minor UI behavior;
- a module-ownership change — a completed function relocation and import rewiring with unchanged behavior.

Keep implemented notes such as:

- the single-source persistence boundary — 248 words: foundational authority and durability boundary;
- the shared-contract ownership rule — 596 words: a cross-cutting ownership rule;
- the durable storage and identity policy — 628 words: a data-format obligation;
- a 400-word note that still guides check scheduling and resource tuning — borderline, but retained;
- a note stating a coordinated reintroduction condition — keep until the deferred capability lands.

For rejected notes:

- keep the note whose temptation to merge two modules remains meaningful;
- delete the note whose premise was resolved by a later decision;
- delete the note whose original question no longer arises.

## Archive one implemented note

1. Move the single `foo.md` file from `implemented/<class>/` to `archived/<class>/`; `implemented` is deliberately absent from the archive path.
2. Make no body edits. Insert only `Archived: YYYY-MM-DD` immediately below `Status: implemented`, using the archival date.
3. Re-record the note's sealed hash in `.agents/notes/archived/manifest.json` mechanically. Do not reformat, update facts, or repair links inside the note.
4. Search for inbound links from active prose. Redirect them to current authority, retarget them to the archived path only when the historical record is intentionally cited, or delete them. Never verify or repair links out of the archived note.
5. Run `pnpm run verify-archived-agent-notes --write`. Its append-only mode first proves every existing seal still matches, then appends only the new note's hash, and it refuses to write when an existing seal or the note itself is invalid. Run the normal verifier afterward.

Once sealed, never edit, move, reformat, or delete the note. An archived note remains a valid inbound-link target but is a historical record, not authority for current behavior.

## Validate and report

Run `pnpm run verify-archived-agent-notes`, `pnpm run doc-sync`, `pnpm run lint`, and `git diff --check`; select any additional evidence through [pre-push-checks](../pre-push-checks/SKILL.md).

Report active implemented notes kept, implemented notes deleted or archived, rejected notes kept or deleted, proposed notes rejected if any, and every genuinely borderline case with its word count and chosen outcome. Do not claim archived outbound links are valid: the archive verifier intentionally never checks them.
