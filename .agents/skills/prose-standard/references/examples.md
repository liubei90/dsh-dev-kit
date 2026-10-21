# Distilled prose examples

Use these examples to identify the governing principle, not as text templates. “Balanced” preserves every load-bearing proposition with the least explanation needed at that location.

## Preserve every factual clause

**Original:** “The coordinator carefully serializes writes per account, flushes buffered rows before disposal resolves, and reports database failures to the caller.”

**Over-trimmed:** “The coordinator serializes persistence.”

**Balanced:** “The coordinator serializes writes per account, flushes buffered rows before disposal resolves, and reports database failures to the caller.”

Remove decoration and repetition, not propositions. Actor, per-account scope, disposal ordering, and failure visibility are separate facts.

## Explicit skill scope is functional

**Over-trimmed:** “Read the sources and use judgment.”

**Balanced:** “This skill is guidance, not a complete checklist. Use judgment beyond the named checks; documented requirements still apply.”

**Over-detailed:** Several paragraphs defending why lists cannot replace independent reasoning.

Keep the explicit limitation because it changes how an agent applies the workflow. Trim repeated persuasion, not the guardrail.

## A guide keeps action and verification

**Over-trimmed:** “Add tests for the endpoint.”

**Balanced:** “Cover the handler at unit level, exercise the route through the real HTTP entry in an integration test, and assert both the persisted row and the response envelope. Verify that the assertion observes external state rather than the handler's own report.”

**Over-detailed:** A walkthrough of every fixture file and assertion already visible in the example code.

Keep the test tiers, required action, real entry path, and observable verification. Remove fixture narration.

## Preserve ownership and timing

**Over-trimmed:** “Upstream work is cancelled during teardown.”

**Balanced:** “The runtime requests upstream cancellation before releasing the child scope; the client remains responsible for joining its workers before disposal resolves.”

**Over-detailed:** A chronological account of every promise and callback used to implement teardown.

The actor, ordering, point where ownership changes, and completion guarantee are separate factual clauses.

## Handler JSDoc preserves boundary timing

**Over-trimmed:** “Composes and caches the request prefix.”

**Balanced:** “Composes the request prefix once before the first handler step and the upstream call. Listener appends join the current request, and the per-step accounting receives the composed prefix.”

**Over-detailed:** A walkthrough of the loop helpers, cache fields, and promise callbacks that implement the ordering.

Request order and its current-request consequence are caller-visible behavior, not implementation narration.

## Orient complicated code without narrating it

**Over-trimmed:** “Worker pool support.”

**Balanced:** “Owns the worker pool and its host bridge. Pool initialization is single-shot; disposal terminates the workers and rejects later calls. See the worker-isolation design note for the protocol rationale.”

**Over-detailed:** A paragraph-by-paragraph preview of the classes and helper functions below.

Keep the module's role, dependencies, responsibilities, and non-obvious lifecycle behavior. Link architecture rationale and let the code show local control flow.

## Public JSDoc includes failures

**Over-trimmed:** “Returns the initialized pool.”

**Balanced:** “Returns the initialized pool. Throws if initialization has not completed or the pool has already been disposed.”

**Over-detailed:** The internal state-machine branches and exact helper calls that lead to each throw.

Throws and state preconditions are caller-visible contract facts.

## Keep a concise implementation mapping

**Over-trimmed:** “Search client backed by an external API.”

**Balanced:** “Maps each provider result to the shared search-result fields, preserving the title, URL, and text while dropping provider-only ranking metadata.”

**Over-detailed:** A field-by-field restatement of the mapping code, including fields with identical names and obvious assignments.

Keep mapping details that explain where an adapter drops or changes information.

## Link rationale while keeping the local contract

**Over-trimmed:** “Disposal is documented in the lifecycle Agent Note.”

**Balanced:** “Disposal aborts the run and waits for upstream quiescence. See the lifecycle Agent Note for ownership and race handling.”

**Over-detailed:** Repeating the Agent Note's promise choreography and rejected ownership models beside every disposer.

Keep the behavior and completion guarantee where callers need them. Link aggressively for the algorithm and rationale; a link cannot replace the local contract.

## Implemented Agent Notes retain verification contracts

**Over-trimmed:** Deleting the entire Testing section because the Agent Note has already shipped.

**Balanced:** “Unit tests cover cancellation before and after publication and disposal quiescence. An integration test covers the real HTTP entry path; browser coverage is deferred because the transport is process-specific.”

**Over-detailed:** A file-by-file walkthrough of fixtures and assertions with no additional behavioral distinction.

Remove migration tasks and test narration. Keep the tiers, the behaviors they pin, the real entry path, and named coverage gaps.

## A security boundary may need one concrete example

**Over-trimmed:** “Background jobs share the API process's authority.”

**Balanced:** “Background jobs share the API process's authority; for example, a job holding the database credential can read every tenant's rows.”

**Over-detailed:** A list of every resource a job could misuse and every hypothetical exploit.

Keep one example when it makes an otherwise abstract security limit operationally clear.

## Delete reasoning transcripts entirely

**Over-detailed:** “First the loop checks whether the value is absent. If it is absent, the next branch returns early. Otherwise it continues, which is why the final assertion is safe.”

**Balanced:** No comment when the code already expresses those branches. If the early return protects a non-obvious invariant, state only that invariant.

Do not compress a reasoning transcript into shorter narration; remove it.

## Configuration comments explain what the tree cannot

**Over-detailed:** “This entry registers the auth middleware, followed by the rate limiter, followed by the routes,” when the adjacent entries already show that order.

**Balanced:** “Mount the auth middleware before the routes it protects so no handler runs unauthenticated.”

Keep the consequence of order, a surprising scope rule, or a security boundary. Let the configuration show its own inventory.

## Do not trim for word count alone

**Current:** “The client converts upstream errors into the shared error type so callers can handle authentication, rate-limit, and transient failures uniformly.”

**Shorter but worse:** “The client normalizes upstream errors.”

**Balanced decision:** Keep the current sentence unless a link or surrounding contract already lists the failure categories. The shorter version loses the consequence and distinctions without improving structure.

## Generated contract text follows ownership

**Over-trimmed:** “The endpoint returns errors when validation fails.”

**Over-detailed:** Copying another module's error strings into this module's README.

**Balanced:** Quote stable error text and codes owned by this module. Link the shared DTOs and the API reference for text another module owns; state only this module's conditions or deltas locally.

Wording that reaches a user is behavior, but duplication still drifts. Exactness belongs at the owner.

A prose-only audit may identify suspect wording but must not silently change it when no owning test or contract exists. Leave it unchanged and report the deferral, or expand the authorized change to include the owner.

## Extracted summaries must stand alone

**Over-trimmed:** “Approval request and policy service.” The owner explains policy order and audit logging later, but the generator exports only its first sentence.

**Over-detailed:** Moving the service's full lifecycle and notice behavior into the extracted sentence.

**Balanced:** “Approval service that applies request policy before answerers and logs every ask and outcome to the originating request.” Keep non-extracted detail in later sentences.

Know what the generator extracts. That fragment must preserve the contract needed on its generated output.

## Limitations are contracts, not debt inventories

**Over-trimmed:** Omitting a process-lifetime cache that makes configuration changes require a restart.

**Over-detailed:** Listing private helper cleanup and unused test-only accessors with no caller or maintainer consequence.

**Balanced:** “Provider selection is cached for the process lifetime; changing the selected provider requires a restart.” Keep ordinary cleanup in its TODO or Agent Note.

Retain gaps and non-obvious constraints that affect use or safe maintenance. A module README is not a backlog dump.
