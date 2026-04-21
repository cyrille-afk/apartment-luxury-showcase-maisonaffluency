
Restyle the spec selectors to match the benchmark exactly: a clean borderless list with horizontal dividers between rows, no boxed/outlined select field, no pill look.

## What changes

**`src/components/ExpandableSpec.tsx` — visual overhaul of the multi-option selector**

Current problem: the multi-option selector is rendered as a bordered/rounded `SelectTrigger` (a pill-style boxed field). The benchmark shows a flat, borderless row with only a thin horizontal divider above and below — no border, no rounded background, no input-field look.

New trigger styling (when multiple options + placeholder):
- Remove all `border`, `rounded-md`, and background from the `SelectTrigger`.
- Render it as a full-width flat row: icon on the left, placeholder/selected text, chevron on the far right.
- Add a thin top divider (`border-t border-border/60`) and bottom divider (`border-b border-border/60`) so consecutive spec rows form a clean borderless list.
- Vertical padding `py-3`, no horizontal padding (aligns with adjacent text rows).
- Placeholder text stays muted; selected value switches to foreground (medium weight for dimensions).
- Chevron stays right-aligned, subtle muted color.

Single-option rows (plain text) and the inline expandable variant keep their current borderless look but also get the same top/bottom hairline dividers so the whole spec block reads as one continuous list matching the benchmark.

The dropdown panel itself (`SelectContent`) stays as the standard popover — that part is correct.

## What stays the same

- Selection logic, controlled `value`/`onChange`, autoSplit parsing, placeholder strings ("Select your material choice" / "Select your size").
- Trade pricing wiring to the top size selector.
- `PublicProductPage.tsx` and `TradeProductPage.tsx` usage — no prop changes needed.

## Files to update

- `src/components/ExpandableSpec.tsx` (styling only)

## Technical notes

- No new dependencies, no logic changes, no DB changes.
- Pure CSS/className refactor on the `SelectTrigger` and row wrappers to switch from "input field" appearance to "borderless list row" appearance.
