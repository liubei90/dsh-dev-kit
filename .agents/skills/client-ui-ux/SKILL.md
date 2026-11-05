---
name: client-ui-ux
description: 'Design and review client UI changes in the React app — alignment, spacing, icons, visual foundation, component geometry and interaction. Use before UI changes in apps/web, or when reviewing such a PR.'
---

# Client UI/UX

Use this skill as the entry point for UI design and review. It owns the workflow, visual foundation, geometry and interaction guidance; alignment, spacing and icon details live in its references. Load only the references relevant to the task; examples explain judgment, not coverage. Copy quality itself follows [prose-standard](../prose-standard/SKILL.md).

## Architecture prerequisites

Read these first; this skill only adds judgment on top of them:

- [Client component defensive patterns](../../../docs/defensive-patterns/client-components.md): component responsibility, state ownership, and effect rules for client work.
- [AGENTS.md](../../../AGENTS.md) `Conventions`: the standing repository rules for package boundaries, shared contracts, and user-facing copy.

Neither page is restated here, and their rules stay authoritative: this skill's checks apply to a change that already conforms to them.

<a id="ui-change-workflow"></a>
## UI change workflow

Use applicable design rules for UI changes, including visible loading, error, disabled, expanded and focus states. Choose effort by impact and regression risk; ordinary development does not require a full design audit.

| Change | Required inspection | Additional records |
|---|---|---|
| Local copy, icon reuse, color or spacing | Inspect the actual page, affected neighbors and relevant states; run applicable tests. Apply the minimum checks below. | Briefly report results and material gaps. No separate plan, axis drawing, scene inventory, source snapshot or screenshot report is required by default. |
| Page layout, shared components or global styles | Identify affected relationships and consumers; inspect distinct affected layout, content and state variants in assembled pages. Reuse evidence only for justified equivalents. | Briefly state scope. Preserve the starting version and comparable images when requested or needed to explain broad changes or assess regression risk. |
| Explicit comprehensive review | Cover the agreed regions and relevant states; distinguish inspected results, defects and uninspected scope. | Record coverage, findings and supporting evidence; a comparison request alone does not require a product-wide audit. |

### Minimum checks for affected UI

These checks apply even to small changes; optional documentation does not make inspection optional. Open the actual page and inspect the changed element with its directly affected neighbors, rather than judging CSS or an isolated component alone.

- **Color or opacity:** inspect light and dark themes, including affected foreground/background and state combinations.
- **Layout, spacing, typography or sizing:** inspect a constrained container and long or wrapping content; check both sides of a changed breakpoint, alignment, clipping and access to actions.
- **Interaction:** exercise the changed path and affected focus, disabled, loading, error, expanded and overlapping states. Check only states the change can affect, not every possible combination.
- **Shared components or global styles:** trace affected consumers and inspect distinct assembled layouts and states; one isolated example cannot establish coverage.

If a required scene is unavailable, state what was not checked, why and how it can be verified; a labeled production-component fixture can provide partial evidence, not an actual-page pass. Do not claim verification complete while required checks remain missing. Run the original applicable tests; source inspection and passing tests alone do not establish the rendered result.

Read unchanged owners once; consult examples for uncertain judgments. Inspect relevant states and actual usage sizes, not a fixed screenshot count or every width × theme × state combination. Batch related edits and reuse a current application instance and valid evidence. Documentation-only changes and refactors with evidence of unchanged rendering need no new UI captures; state that basis.

When a before/after comparison is needed, preserve the actual starting implementation, including uncommitted work, and use comparable capture conditions. Never recreate a missing before image and present it as an original. Protect existing work regardless of whether extra evidence is needed.

Before handoff, review or push, check only new cumulative interactions, missing required checks and invalidated evidence; do not repeat completed verification at each stage. Report results and material gaps accurately.

These effort levels change only the additional design-review procedure. Existing test requirements and [design review escalation](#design-review-escalation) still apply, including to local changes when their original triggers are met.

## Select the rule owners

For layout changes, read the alignment and spacing references. Read the icon reference when selecting, drawing or reviewing artwork, or when adding, changing or reviewing icon buttons, icon-only actions or informational icons, including reuse without artwork changes. Other tasks use the relevant sections below. Do not load all references by default.

| Decision needed before implementation | Section or reference |
|---|---|
| Shared axes, text starts, centering, indentation, complete icon boxes | [Alignment](references/alignment.md) |
| Semantic groups, inner/outer gaps, repeated rhythm, section separation | [Spacing and grouping](references/spacing.md) |
| Interface icon selection and artwork; icon buttons and icon-only actions, tooltips, informational hover content, accessible labels and focus | [Icons](references/icons.md) |
| Color, typography and existing treatments | [Visual foundation](#visual-foundation); [Web styling](../../../docs/web-styling.md) owns tokens/materials |
| Component geometry, nested contours and state fills | [Component geometry](#component-geometry) |
| Feedback lifetime, loading, overlays and scrolling | [Interaction and feedback](#interaction-and-feedback); [error handling](../error-handling/SKILL.md) owns failure guarantees |
| Responsive layout rules, mobile-specific interactions, and truncation rules | [Responsive UI](../responsive-ui/SKILL.md) |
| Copy, locale ownership and component semantics | [Prose standard](../prose-standard/SKILL.md) |

## Reuse before adding

- **Extend an existing component, container, or interaction before creating a new one.** A new capability that fits an existing surface (an extra menu item, a new prop on an existing component) beats a parallel element stacked beside it.
- **Icons come from the existing icon set.** Pick the semantically closest existing icon; a new glyph needs design review before it lands, so a PR that adds one should request it. See [Icons](references/icons.md#reuse-existing-icons-first).
- **Icon-only actions whose meaning is not obvious get a Tooltip.** Informational content the pointer must rest on or select uses a HoverCard instead. Prefer shared primitives over ad-hoc `title` attributes.
- Before restructuring, read the [client component defensive patterns](../../../docs/defensive-patterns/client-components.md) for component/state ownership and layering.

## Visual foundation

- **Use the existing design tokens for color, radius, and spacing.** Before introducing a literal value, search the target page and its nearest established sibling for the token or value already in use, and adopt it. The same applies to whole treatments — toasts, menus, previews, tab layout, clearance rules, page padding: reuse the established component or rule wherever one exists instead of inventing a parallel one.
- **Verify every color in both light and dark mode.** An ink and background pair must stay readable under both themes before it ships. Dimmed tones are the standing counter-example: they suit decorative surfaces, but on text they routinely fall below readability in one theme — never put a dimmed color on text without checking both.
- **Font weight tops out at 500 in feature CSS you add or change.** Do not use 600 or heavier for emphasis; differentiate with size or ink instead. Typography tokens owned by the shared theme are the standing exception.
- **Pick font sizes from the shared type scale when an existing role matches, otherwise from the page's existing scale.** Parallel content shares one size; never invent a size for a single element, and keep the number of distinct sizes on a page small. When the page itself has no precedent, borrow the size and spacing ratios of the most similar existing page.
- **Icons, text, and neighbouring elements stay proportionate and aligned.** Every element lines up with its siblings along a deliberate axis (baseline, vertical center, or shared edge), and an icon's size stays in proportion to the text beside it; never ship an element that aligns to nothing or visibly outweighs its neighbours. See [Alignment](references/alignment.md).

## Component geometry

Choose the component role and size variant, then its container relationship. Compare height, radius, curve, inset and material together; equal radii alone do not establish coherence, and wrapping or expansion alone does not justify larger radii. [Web styling](../../../docs/web-styling.md) owns token values and exceptions.

- **Inset:** coordinate inner and outer curves. Radius subtraction is exact for concentric circular arcs; for softer superellipse corners, subtraction is only a nominal sizing rule, so inspect diagonal whitespace as well as side gaps.
- **Flush or adjoining:** the enclosure owns exposed corners; internal joins stay square. Hover fills and pseudo-elements follow that contour without clipping menus or focus.
- **Independent child card or group:** use its own role and size tier, not the dialog radius or subtraction of all parent padding.
- **Circles and capsules:** preserve the shape, including avatar container and image; ordinary controls use the shared curve.

Keep fills, strokes and overlays geometrically stable across hover, pressed, selected, loading and disabled states. Reuse established card and elevation materials; retain semantic state-colored borders without doubling neutral edges.

Compare related controls, including small selection controls, at actual size in affected themes and states, and in relevant long-label or narrow layouts. Static checks reject unsupported declarations; rendered comparison judges fit.

## Interaction and feedback

### Feedback surfaces

Failure reports follow [error-handling](../error-handling/SKILL.md): typed failures, an explicit handling owner, and a visible, actionable report.

Choose the surface by the lifetime of the message relative to the surface that produced it:

- **Transient operation outcomes use the app-wide toast primitive**, not in-place notices, and the toast's state and rendering live in a host that outlives the reporting surface — a toast rendered by the panel itself unmounts with that panel. A deletion can close the panel or tab that requested it; only a toast held outside that surface survives the close. Report success and failure; do not report still-pending states.
- **A failed operation keeps the data visible.** A failed deletion keeps its row; the toast announces the failure. Never blank content to show an error for a transient operation.
- **In-place notices are for states tied to the surface itself**: a query failure with its Retry action, field validation on the form that owns the field. A populated panel keeps a compact notice beside its retained content; only an empty panel centers a full error state.
- **Error copy is plain language, and short.** No internal jargon or technical nouns unless an error code must be exposed for debugging. Prefer one clear sentence; anything explainable in two sentences must not grow into paragraphs. The notice must not break the existing layout — reserve its space or overlay it; never shift neighbouring elements.

### Loading states

- Lists use their skeleton; every other page-level load centers a bare spinner. Never place a spinner in a corner of the page.
- One loading treatment per page or component — concurrent regions must not each flash their own style.
- No loading text unless the context needs it (narrow sidebars almost never do).

### Overlays and menus

Every menu, popover, tooltip, and modal must be verified for all three before merge:

- **Dismissable**: outside click (and Escape where focusable) closes it.
- **Viewport-fitting**: it slides or flips to stay inside the window with an edge margin, and flips only into a side that actually fits (no oscillation when neither side fits).
- **Unclipped**: it escapes `overflow` ancestors and containing blocks (portal to `body` where needed) and is never covered by neighbouring elements.

Scrollbars stay inside their container: use the shared scrollbar styles rather than component-specific selectors, and verify the bar neither overflows the container nor gets clipped by its rounded corners or edges — keep a small inset instead of letting it sit flush against the container edge.

## Check the rules together

Inspect the composition, then affected internal and cross-group relationships, distant peers and expanded content. Match both endpoints of axes; compare complete icon boxes before optical adjustments. Preserve popup and focus visibility, field feedback, narrow-layout actions and drafts. Check affected theme and material combinations. Full-interface claims cover all regions; fixtures and crops establish only what they render.

## Maintain one owner per rule

Update the owning section or reference within this skill; do not expose its design specialties as separate skills. Keep examples local; AGENTS and review workflows link here instead of duplicating rules.

Rule changes state applicability, decisions, exceptions and observable verification; update a distinguishing case and remove superseded statements elsewhere. Declare migration versus future-edit scope without implying existing UI conforms. Automate only mechanically decidable checks.

## Responsive layout

Responsive behavior, mobile and touch detection, text truncation, title wrapping, icon-only controls, and focus preservation during width changes follow [responsive-ui](../responsive-ui/SKILL.md). This skill does not repeat its decision order; apply that order before judging visual polish here.

## Design review escalation

- A PR with extensive UI changes, or any clearly user-perceivable change to UI or interaction, must get a design or product review. When no approver holds that role, request one before merge rather than merging on engineering review alone.
