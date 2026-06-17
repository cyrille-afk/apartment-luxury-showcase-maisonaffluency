# Sync Fabrics & Finishes swatches into curator-pick variant editor

A general capability on every curator pick in the admin variant editor: pull Metal/Stone (and other applicable) swatches from the Fabrics & Finishes library that are tagged to the pick's designer/brand, and merge them into the existing **Base × Top × Size** matrix without losing prices or dimensions already entered.

## Trigger & UX

In the existing **Variant Pricing** block of the editor (`src/pages/TradeDesignersAdmin.tsx`, next to *Add row* / *Apply price to all* / *Build matrix*), add:

- A **Sync Base from Library** button.
- Clicking it opens a small dialog that:
  1. Shows the swatches found for this pick's designer/brand (count + category filter chips: Metal, Stone, Wood, Leather, Glass, etc.).
  2. Lets the user tick which categories feed the Base axis (default: Metal + Stone).
  3. Previews a diff: rows that will be **added**, **kept** (price/dim preserved), and **removed** (existing Base values no longer in the swatch list — user can opt to keep them).
  4. *Apply* writes the merged matrix back to `size_variants`.

No new database tables. All logic is client-side on top of `material_swatches` and the existing `size_variants` JSONB.

## Brand/Designer matching rule

Auto-match by token overlap between `designers.name` (of the pick) and `material_swatches.brand_name`:

- Normalize both sides: lowercase, strip accents, split on non-alphanumerics, drop tokens shorter than 4 chars and stopwords (`and`, `the`, `studio`, `atelier`, `paris`, etc.).
- Match if **any significant token** of the designer name appears in the swatch's `brand_name`.
- Example: designer `Garnier & Linker - Guillaume Garnier & Florent Linker` → tokens `{garnier, linker, guillaume, florent}` → matches `brand_name = "Garnier & Linker"`.

If zero swatches match, the dialog says so and links to `/trade/admin/fabrics` to add them first.

## Merge algorithm

Inputs:
- `currentVariants = pick.size_variants` (rows of `{ base, top, label, price_cents }`).
- `swatches = filtered material_swatches[]` (by brand match + selected categories).

Steps:
1. Build `existingTops` = unique non-empty `top` values in `currentVariants` (preserve order). If empty → single Top axis with one synthetic blank entry.
2. Build `existingSizes` = unique non-empty `label` values (preserve order). If empty → one synthetic blank label.
3. Build `newBases` = unique swatch names (preserve swatch order).
4. Build a `priceMap`: key = `normalize(base)|normalize(top)|normalize(label)` → `{ price_cents, originalRow }`. Normalize = lowercase + collapse whitespace.
5. Cartesian product `newBases × existingTops × existingSizes` →
   - if key found in `priceMap`, copy `price_cents` and keep the original `label` casing.
   - else new row with `price_cents = 0`.
6. Preserve **orphan rows** (existing Base values not in `newBases`) only if the user ticks *Keep custom bases* in the dialog (default: on). Orphans append at the end.
7. Set `pick.base_axis_label` to the swatch's `material_type` (e.g. `Metal Finish`) **only if the current label is blank or matches a known truncation** like `Rod Fini`, `Finish`, `Base`. Never overwrite a curator-set custom label.
8. `updateField(pick.id, "size_variants", merged)` — does not auto-save; user still hits the existing **Save** button.

## Erato one-shot fix

As part of this change, run a one-line data update to fix the truncated axis label `Rod Fini` → `Rod Finish` on pick `743fdbd3-3d0c-45d3-9fde-1ae7f079877a`.

## Files

- `src/pages/TradeDesignersAdmin.tsx` — add the *Sync Base from Library* button + dialog state.
- `src/components/admin/SwatchSyncDialog.tsx` (new) — fetch, filter, preview diff, return merged matrix.
- `src/lib/swatchBrandMatch.ts` (new) — normalize + token-match helpers, exported for reuse.
- Data fix on `designer_curator_picks` for the Erato pick label.

## Technical notes

- All reads from `material_swatches` go through the existing supabase client; no new RLS or grants needed (table is already accessible to admins).
- The dialog never mutates `material_swatches` — it's read-only.
- Existing **Build matrix** behaviour is untouched; this is an additive button.
- Matching is intentionally permissive (token overlap) so non-canonical brand spellings still work; the diff preview is the safety net before writing.
- No change to the trade product sheet — the existing Base × Top × Size matrix already drives the three dropdowns.
