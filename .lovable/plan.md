# Accurate shipping from the product sheet

Add per-product **packing data** (CBM, weight, carton count, default ship mode) and **pickup address** (ISO country + postcode + free-text address) to the designer's curator-pick editor. Mirror those onto `trade_products` via the existing sync trigger. When a product is added to a quote, prefill `trade_quote_items.ship_*` from the catalogue so the per-line shipping estimator returns an accurate figure on day one instead of waiting for the studio to type CBM/weight per line.

---

## 1. Database (single migration)

Add the same shipping columns to **both** tables (curator picks = source of truth, trade_products = consumed by quotes):

```text
designer_curator_picks  +  trade_products
─────────────────────────────────────────
pack_cbm              numeric(8,3)   -- per unit, includes crating
pack_weight_kg        numeric(10,2)  -- per unit, gross
pack_carton_count     integer        -- # cartons / crates per unit
default_ship_mode     text           -- sea_lcl | sea_fcl | air | road | courier
pickup_country        text           -- ISO-2 (FR, IT, DE…)
pickup_postcode       text
pickup_address        text           -- free-text street/atelier, internal use
```

Constraints:
- `default_ship_mode` CHECK matches the existing `trade_quote_items.ship_mode` check (`sea_lcl|sea_fcl|air|road|courier`).
- `pickup_country` is ISO-2; the existing free-text `origin` column stays for display.

Update `sync_curator_pick_to_trade_product()` to mirror the seven new columns with the same COALESCE-only pattern (never wipes a trade_products value) and include them in the INSERT branch.

## 2. Editor UI — `CuratorPicksManager` in `src/pages/TradeDesignersAdmin.tsx`

New collapsible **"Logistics & packing"** section in the form, between Dimensions and PDFs:

```text
Logistics & packing
───────────────────
Packing CBM (m³)      [ 0.50 ]    Weight (kg) [ 84 ]    Cartons [ 1 ]
Default ship mode     [ Air freight ▾ ]   (sea LCL / sea FCL / air / road / courier)

Pickup point
Country (ISO-2)       [ FR ]      Postcode    [ 75011 ]
Address (internal)    [ Atelier Lemaire, 12 rue de Charonne, Paris ]
```

- All optional; placeholders show defaults (`0.5 m³`, mode auto-resolved from destination).
- Existing free-text `origin` field stays for marketing copy.
- Extend the inline `Pick` type and the create/update mutations.

## 3. Quote line prefill

Change the three INSERT call sites so a new line carries packing defaults from the catalogue:

- `src/pages/TradeProductPage.tsx:450` ("Add to Quote")
- `src/pages/TradeFavorites.tsx:88` and `:183` (single + bulk)
- `src/components/trade/concierge/CreateQuoteFromBoard.tsx:158` (board → quote)

Before insert, fetch the product's `pack_cbm / pack_weight_kg / default_ship_mode / pickup_country` from `trade_products` and write them into `ship_cbm / ship_weight_kg / ship_mode / ship_origin_country`. If the catalogue values are NULL, leave the line NULL (the estimator's existing fallbacks kick in).

## 4. QuoteDetail editor

No structural change — the existing inline editors at `QuoteDetail.tsx:1976-2042` already let the studio override the prefilled values per line. Add a small "(from catalogue)" hint when the line value matches the product default, so the user knows where the number came from.

## 5. Shipping estimator

No change needed. `usePerLineShipping` already reads `ship_cbm / ship_weight_kg / ship_origin_country / ship_mode` per line and falls back to defaults — once lines are prefilled, accuracy improves automatically.

---

## Technical details

- Migration is schema-only (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`) plus a `CREATE OR REPLACE FUNCTION` for the sync trigger. Backfill is not required: NULL = "use defaults", which is the current behaviour.
- Brand normalization unchanged — the sync still matches on `(designers.name, curator_pick.title)`.
- ISO-2 for `pickup_country` keeps the estimator path simple (it already maps ISO codes via `toIsoCountry`). The free-text `origin` field is kept untouched for display copy.
- No edge function changes.
- `default_ship_mode` is a *hint*: the estimator still respects `defaultModeFor(destCountry)` when the line has no override, but if the product is e.g. fragile lighting that must fly, the catalogue value wins on prefill.
- Files touched: 1 migration, `TradeDesignersAdmin.tsx`, `TradeProductPage.tsx`, `TradeFavorites.tsx`, `CreateQuoteFromBoard.tsx`, minor hint in `QuoteDetail.tsx`. Supabase types regenerate automatically after migration.

## Out of scope (flag, do not build now)

- Multi-carton packing list (per-box dims L×W×H) — current scope uses per-unit aggregate CBM + carton count, which is what carriers price on. Add later if needed.
- HS code / customs tariff fields — separate concern from freight rating; can be a follow-up.
- Auto-rerun of the estimator when the catalogue is edited after a quote is sent — out of scope; existing quotes keep their snapshot values.
