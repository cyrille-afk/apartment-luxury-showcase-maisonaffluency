## Goal
Allow each Ecart product quote line to add an upcharge = `fabric €/lm × meters`, where the per-fabric rate comes from a CAT A–E tier and the meters come from the product's COM requirement.

## 1. Schema (single migration)

**`fabrics`** — new columns:
- `tier` text — `'A' | 'B' | 'C' | 'D' | 'E'` (nullable)
- `price_per_lm_cents` integer (nullable; if NULL falls back to a tier→price lookup)
- `currency` text default `'EUR'`

**`designer_curator_picks`** — new column:
- `com_meters` numeric — linear meters of COM (Customer's Own Material) required to upholster this product (e.g. JMF 2-seater = 12)

**`trade_quote_items`** — new columns:
- `fabric_id` uuid → `fabrics(id)` ON DELETE SET NULL
- `fabric_meters` numeric — meters used (defaults from `com_meters`)
- `fabric_upcharge_cents` integer — frozen at line save so quote totals don't drift if fabric price changes later
- `fabric_currency` text

## 2. Seed data (Ecart from screenshot)

Tier prices (EUR / lm):
- CAT A = 150, CAT B = 200, CAT C = 275, CAT D = 350, CAT E = 750

Tag the 5 fabrics in screenshot:
- Elsa Pink → A · Elsa Greige → A · Nancy Beige → B · Eyre Beige → D · Cole Cinnamon → E

Set `com_meters = 12` on JMF *Upholstered Back Sofa c. 1930 (2-seater)*. Other Ecart products: leave NULL, admin can fill in later from spec sheets.

## 3. Admin UI

- **TradeAdminFabrics**: add Tier dropdown (A–E) + €/lm input columns per fabric row.
- **Product admin (curator pick editor)**: add `COM meters` number input near dimensions.

## 4. Quote builder (`QuoteDetail.tsx`)

For each line whose product has linked `product_fabrics`:
- Render a compact "Fabric (CAT X — €/lm × meters)" picker under variant/finish row.
- On fabric pick: prefill `fabric_meters` from product's `com_meters` (editable).
- Compute `fabric_upcharge_cents = price_per_lm_cents × meters` in fabric's currency, FX-convert to quote currency where existing item conversion logic runs, and add to the line subtotal.
- Persist `fabric_id`, `fabric_meters`, `fabric_upcharge_cents`, `fabric_currency` to `trade_quote_items` on save.
- Include the upcharge in: line total, room subtotals, quote totals, deposit calc, FF&E aggregation, and the printed/PDF quote.

Lines without a fabric pick behave exactly as today (no upcharge).

## 5. Out of scope (this pass)
- Public lightbox stays as "refer to product page".
- No fabric upcharge on Tearsheets/Mood Boards (quote-only, as approved).
- Bulk-tagging the 12 Ecart wood/fabric swatches added previously — you'll set tiers in the fabric admin.

## Technical notes
- `fabric_upcharge_cents` is snapshotted at save time (like `unit_price_cents`) so historical quotes stay stable.
- FX uses the same `fxRates` table the quote already uses.
- Trade discount: applies to base product only, not fabric upcharge (industry standard — confirm if you want otherwise).
