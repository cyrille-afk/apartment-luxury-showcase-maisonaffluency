Three PDF-only bugs in `src/lib/quotePdf.ts` (line rendering) plus the meta payload built in `src/components/trade/QuoteDetail.tsx` (~L1386-1453). Nothing to change on the on-screen quote — it already matches the desired behavior.

## 1. Product name overlaps QTY column

Currently `productName` is passed as one string ("Frenchmen Street Lounge Chair by Sebastian Herkner") and `splitTextToSize` wraps mid-phrase, overflowing into QTY.

Fix in `quotePdf.ts` around L925:
- Before wrap, split `productName` at the last ` by ` (case-insensitive) into `titleMain` + `by Designer`.
- Wrap each piece separately with `splitTextToSize(..., colDesc - 12)` and stack them (main bold, "by Designer" bold on next line). Keeps the title inside `colDesc` and always breaks at the natural boundary.
- Adjust `titleHeight` and `metaY` to account for the added line.

## 2. Duplicate finish labels — add a "Finishes:" title block below image

Currently swatches render as thumbnails only, and `Fabric: Aries Pietra` / `Selected finishes: Mist Oak · Aries Pietra` render as meta text on the right, producing the duplicated "Fabric: Aries Pietra" the user circled.

Fix:
- In `QuoteDetail.tsx` meta payload (L910-924): drop `finishSwatchLabel` and `fabricLabel` from the `meta` array whenever `finishSwatches[idx]` will render swatches with names (i.e., `variantSwatches.length > 0` or `fabricSwatchUrl` present). Keep `woodFinishLabel` only when `resolveWoodFinishLabel` returns a value that isn't already in the swatch strip (existing logic).
- In `quotePdf.ts` swatch drawing block (L962-975): after drawing each swatch tile, render a small "Finishes:" caption once above the first swatch row (small caps, muted, 7pt) and the swatch name beneath each tile (7pt, muted, centered under the 20×20 square). This mirrors the on-screen quote (screenshot 2/).
- Recompute `rowH` to include the caption + label line (adds ~14pt above the swatch grid, ~10pt below each row of tiles).

## 3. Shipping line rendered when user hasn't chosen shipping

L920-922 emits `Shipping: …` whenever any of `shipOriginCountry / shipMode / shipCbm / shipWeightKg` is truthy. `shipOriginCountry` falls back to `product.origin` (defaulting to `FR`) so it is essentially always set → the row always prints.

Fix:
- In `QuoteDetail.tsx` (L1449-1452), only pass `shipOrigin*` fields to the PDF line when the user has actually configured shipping for that line — i.e. gate on `item.ship_mode` being explicitly set (user-chosen mode) OR the parent quote having a computed shipping estimate (`shippingEstimateCents > 0`). Otherwise pass `null` for all four fields.
- Also in `quotePdf.ts` L920, keep the guard as-is; with the caller no longer sending stub values the line naturally disappears.

## Files touched

- `src/lib/quotePdf.ts` — title wrapping around " by ", swatch caption + labels, height math
- `src/components/trade/QuoteDetail.tsx` — suppress redundant `fabricLabel`/`finishSwatchLabel` meta when swatches will render; only pass ship fields when a shipping choice has been made

## Verification

- Run `TradeTearsheetsPrintParity` and any existing quote PDF tests (`tsgo --noEmit`, `bunx vitest run src/pages/__tests__/TradeTearsheetsPrintParity.test.ts`).
- Regenerate a live PDF via the running preview for the quote in the screenshot and visually inspect: title wraps on `by Designer`, no `Fabric:` meta duplication, `Finishes:` block with named swatches below image, no `Shipping:` line unless a mode was picked.
