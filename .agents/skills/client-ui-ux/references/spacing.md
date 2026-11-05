# UI spacing and grouping

Apply within the [UI development loop](../SKILL.md#ui-change-workflow). Distance should explain which text, input and action belong together.

## Identify the group before choosing the gap

Group elements by one object, action or repeated unit, not DOM siblings, background or React component. State that relationship before positioning. Check each nesting level independently; larger outer gaps do not require larger inner gaps.

For example, a title and description introduce one section; three row actions form one operation group; member cards form a section separate from tasks. In a form, a checkbox and its label form an option, options form a field, fields form a group, and groups form a list. Check each relationship rather than applying one gap everywhere.

Without an explicit divider, comparable neighboring groups need visibly greater separation between groups than within them. Equality is only a lower bound against reversal. Repeated compositions share gaps, padding and alignment; label length does not justify unrelated spacing.

When wrapping, metadata, subgroups or independent actions increase complexity, increase enclosing separation enough to retain grouping. A compact icon/label pair and a section of multiline cards need different spacing levels. Do not derive gaps from card area or multiply every margin. Dividers and distinct surfaces may reinforce separation, but headings must remain closer to their own content than to preceding groups.

## Compare visible gaps, not margin ratios

Judge actual whitespace at normal size, including padding, line-height, glyph whitespace and borders. CSS margin ratios alone do not establish grouping; explanatory labels need one unambiguous owner. Declared margins can still leave a heading closer to the preceding content once line-height and container padding are included; compare rendered gaps rather than adopting a pair of numbers as a rule.

When matching two visible gaps, name both pairs of endpoints and include each container's padding, border and text line box. Equal visible gaps may require unequal margins. A control's painted edge and a text glyph's edge are different endpoints; keep that choice stable through review.

Reuse page spacing and [style tokens](../../../../docs/web-styling.md), preserve [alignment](alignment.md) axes, and prefer symmetry for parallel elements; an unexplained one-off gap usually signals a missed shared value. This reference defines no numeric scale.
