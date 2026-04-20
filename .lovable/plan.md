

# Transportation Management System (TMS) — Trade Portal

Build an integrated shipping estimator that gives trade users an indicative freight quote at the time of order, then refreshes it on balance-payment day with a firm rate. Phased rollout starting with high-volume lanes (Italy/France/Germany → SG/HK/AE/US).

## Phase 1 — Foundation: Rate Matrix + Manual Quoting (this build)

We start here. No third-party API yet — get the data model + UX live first, then layer in carrier APIs and AI parsing in later phases.

### What trade users get

- A **Shipping Estimator** widget on every order timeline card and on the quote detail page
- A standalone **/trade/shipping-estimator** page for ad-hoc quotes (no order required)
- An estimate breakdown: freight + fuel surcharge + insurance + duties + customs clearance + last-mile, in the order's currency
- An "Estimate" badge until balance is paid; auto-refreshes to "Confirmed Rate" on balance-paid event
- Saved as a line item on `order_timeline` so it persists and is auditable

### What admins get

- **/trade/admin/shipping-rates** — CRUD for the Rate Matrix (origin lane → destination zone → carrier → rate brackets by volume/weight)
- **/trade/admin/shipping-surcharges** — fuel %, insurance %, customs flat fees, duty % by HS chapter
- A "Refresh quote" action on each `order_timeline` card that recomputes using current matrix
- CSV import for bulk rate updates (carrier rate sheets arrive monthly)

### Data model (new tables)

```text
shipping_lanes
  id, origin_country, origin_city, dest_country, dest_zone,
  carrier_name, mode (sea_lcl|sea_fcl|air|road|courier),
  transit_days_min, transit_days_max, active, notes

shipping_rate_brackets
  id, lane_id, min_volume_cbm, max_volume_cbm,
  min_weight_kg, max_weight_kg,
  base_rate_cents, currency, valid_from, valid_to

shipping_surcharges
  id, surcharge_type (fuel|insurance|customs|handling|last_mile),
  scope (global|lane|carrier), lane_id (nullable), carrier_name (nullable),
  calc_method (percent|flat|per_cbm|per_kg), value_cents_or_pct,
  currency, active

shipping_duty_rates
  id, dest_country, hs_chapter, category (furniture|lighting|art|textile),
  duty_percent, vat_percent, notes

shipping_quotes
  id, quote_id (nullable, fk trade_quotes), order_timeline_id (nullable),
  user_id, origin_address, dest_address, dest_country,
  total_volume_cbm, total_weight_kg, declared_value_cents, currency,
  selected_lane_id, selected_carrier,
  freight_cents, fuel_cents, insurance_cents, duty_cents,
  customs_cents, last_mile_cents, total_cents,
  status (estimate|confirmed|expired), valid_until,
  computed_breakdown jsonb, created_at, confirmed_at
```

RLS: admins manage all rate tables; trade users read lanes/surcharges, manage own `shipping_quotes`.

### Calculation engine (`src/lib/shippingEstimator.ts`)

Pure TS function — no AI required for v1:

```text
input: { origin, dest_country, items[{cbm, kg, value, hs_chapter}] }
  → pick best lane (cheapest matching mode for total cbm)
  → look up rate bracket
  → apply surcharges in order: freight × (1 + fuel%) + insurance% × declared_value
  → look up duty by hs_chapter + dest_country
  → add flat customs clearance + last-mile by zone
  → return breakdown + total
```

Falls back to "Contact for quote" if lane missing.

### UI components

- `ShippingEstimatorModal.tsx` — opened from order card / quote detail
- `ShippingBreakdown.tsx` — itemized table (freight, fuel, insurance, duty, customs, last-mile, total)
- `ShippingEstimatorPage.tsx` — standalone /trade/shipping-estimator
- `AdminShippingRatesPage.tsx` — matrix editor with CSV import
- `AdminShippingSurchargesPage.tsx`
- Order timeline card gets a small "Est. shipping: €X,XXX" line + refresh icon

### Auto-refresh on balance paid

When `order_timeline.balance_paid_at` flips from null → timestamp, an edge function (`refresh-shipping-quote`) recomputes the linked `shipping_quotes` row using current matrix, marks status `confirmed`, locks `valid_until` to delivery + 14 days, and emails the user.

### Initial rate matrix scope (start narrow per your guidance)

We seed only these high-frequency lanes:
- IT (Milan/Como) → SG, HK, AE
- FR (Paris) → SG, HK, AE, US-East
- DE (Cologne) → SG, HK, AE
- Modes: sea LCL (default), air (express)

Everything else returns "Contact for quote."

## Phase 2 — Carrier API integration (separate build, after Phase 1 ships)

Once the matrix + UX is proven, plug in **one** carrier aggregator. Recommendation: **Freightos / WebCargo API** for international LCL+air (better trade-side coverage than Wisor for furniture lanes; CargoWise is enterprise-only with 6-month onboarding — not viable). Edge function `fetch-live-rates` queries on demand, caches 24h in `shipping_rate_brackets` with `source='freightos'`.

Requires: Freightos API key (paid account, ~$200/mo) + your account credentials. We'll request via the secrets flow when you're ready.

## Phase 3 — AI document intake (separate build)

Edge function `parse-shipment-document` accepts PDF/email upload → Gemini 2.5 Pro extracts origin, dest, items, dimensions, weight, HS codes → pre-fills `shipping_quotes` form. Uses existing Lovable AI gateway (no extra key).

## Phase 4 — Automated customs & duties (separate build)

Integrate **Zonos** or **Avalara Cross-Border** for live duty/VAT calculation per HS code + destination. Replaces the static `shipping_duty_rates` table. Same secrets-flow pattern.

---

## Technical notes

- All new pages gated behind `isTradeUser || isAdmin` (matches existing portal pattern)
- Currency conversion uses existing FX logic from `trade_quote_system_logic`
- Trade discount (8%) does **not** apply to shipping — pass-through cost
- Rate matrix CSV format: `origin_country,origin_city,dest_country,dest_zone,carrier,mode,min_cbm,max_cbm,base_rate,currency,valid_from,valid_to`
- `shipping_quotes` linked to `order_timeline` via FK; deleting timeline cascades
- Public side: no shipping estimator — trade-only feature (per dual-side mandate, public stays "Price on Request")

## What ships in this round

Phase 1 only: tables, RLS, calculation engine, trade-facing estimator (modal + standalone page), admin rate/surcharge editors, CSV import, auto-refresh edge function, seed data for the 4 lanes above.

Phases 2–4 are scoped but not built — confirm Phase 1 in production, then we tackle them one at a time.

