## Goal

In `src/components/PublicProductLightbox.tsx`, fix the spec rows so that on every product (including dual-axis ones like Amboseli, Cher, Garda):

1. **Finish always renders before dimensions.**
2. **The dimension row always shows the 📐 icon** (never the ⬗ finish diamond).
3. **The imperial conversion always renders on its own line below the metric line** (as small muted text, like the Ninfa screenshot) — never inline, so it can't wrap mid-`(W 31.1"`.
4. **There is always a space between the cm value and the imperial parenthetical** when they do appear together.

Only `PublicProductLightbox.tsx` changes. No data edits, no schema changes, no behavior changes to the dropdown / variant-matching logic.

## What's actually wrong today

The dual-axis branch (≈ lines 551–587) renders **base first, then top**, both with the ⬗ icon and both using `withImperialPerLine` for the text. For Amboseli / Cher / Garda the data is:

- `base_axis_label = "Size"`, base value = the dimension string
- `top_axis_label = "Finish"`, top value = the finish string

Each axis collapses to a single value, so `ExpandableSpec` renders them as plain `"{label}: {text}"` rows. Result: Size shows up first with the ⬗ diamond and the imperial inline (wrapping awkwardly), then Finish appears below.

Ninfa renders correctly only because it has no dual-axis variants and falls through to the dedicated dimensions branch with `secondaryText`.

## Changes

### 1. Helper inside the component

Add a small `isDimensionText(s: string)` helper (uses the existing `looksLikeDimension` already imported in this file) so we can detect when an axis is actually carrying dimensions rather than a finish/material.

### 2. Reorder the dual-axis block

In the `if (isDualAxis)` branch:

- Build the two `<ExpandableSpec>` nodes as variables (`baseNode`, `topNode`) instead of inlining them.
- Decide order:
  - If exactly one axis's text looks like a dimension → render the **non-dimension axis first**, dimension axis second.
  - Otherwise keep the current base-then-top order.
- For whichever axis is the dimension one, render that node with:
  - `icon={specIcon("📐")}` instead of `⬗`
  - `text={formatDimensionsMultiline(<value>)}` (metric only)
  - `secondaryText={formatImperialDimensions(<value>)}` (imperial below, small/muted — same pattern as the fallback dimensions branch on line 651)
  - Drop `withImperialPerLine` for that node so the imperial never appears inline.
- The non-dimension axis keeps `⬗` and its existing finish/material text.

### 3. Same treatment for the single-axis materials branch

The `materialOptions.length > 0` branch (≈ lines 588–604) can also collapse to a single dimension-like value when a product has one base variant whose label is a size. If `materialOptions.length === 1` and the value looks like a dimension, render it with the 📐 icon + `secondaryText` imperial instead of the ⬗ finish dropdown. Otherwise behavior is unchanged.

### 4. Guarantee the space between cm and `(`

The inline imperial is being removed for the cases that wrap (they move to `secondaryText`). For any remaining `withImperialPerLine` callsites, double-check the helper in `src/lib/formatDimensions.ts` already inserts `"  ("` (two spaces) — it does (`${t}  (${imp})`), so no change needed there. The reported missing-space cases all came from the dual-axis path being fixed in step 2.

## Files touched

- `src/components/PublicProductLightbox.tsx` — only the dual-axis and single-material spec-row JSX (≈ lines 538–605). No other files change.

## Verification

- Reload the four products from the screenshots in the public lightbox at 1054px width:
  - Amboseli Armchair, Cher Dining Table, Garda → Finish row first (⬗), then a dimensions row with the 📐 icon, metric on top, imperial as small muted line beneath. No mid-imperial wrapping.
  - Ninfa Centrepiece → unchanged (already correct).
- Confirm dual-axis products that legitimately use Base = finish / Top = size (e.g. Mangala) still render in the existing order, with the 📐 icon on the size row.
