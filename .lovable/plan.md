## What's actually wrong on QU-22A02A

After inspecting `src/pages/TradeQuotesAdmin.tsx` (the admin detail view) and the underlying data for QU-22A02A (currency=EUR, 2 items: Reda Amalou Lady Bug Side Table, Pierre Bonnefille Stone D Coffee Table), here's a direct answer to each issue and the fix for each.

### 1) Lead time is not displayed next to the item — because we never render it

The admin detail row only renders: image, product name, brand, dimensions, and (sometimes) "Catalog: …". There is **no JSX** at all that reads lead time. Meanwhile a perfectly good DB function `effective_product_availability(_product_id)` already returns `(lead_weeks_min, lead_weeks_max, stock_status, source)` cascading product override → brand default → fallback. For these two specific items, both the product overrides and `brand_lead_times` are empty, so we'd get the default `made_to_order` with no weeks — which is itself a content gap to flag, but we should still show *something* (e.g. "Made to order — lead time TBC").

**Fix:** in the detail loader, batch-call `effective_product_availability` for each `product_id` and render under the dimensions line as `Lead time: 12–14 weeks` (or `Made to order — TBC` when null). Same line on mobile.

### 2) "Catalog: …" — what it actually means and why it's confusing here

It's the **fallback unit price** the admin tool resolved for that line, in the source product's own currency, used to pre-fill the editable Unit Price input. It comes from two sources, in order:

1. `trade_products.trade_price_cents` for the exact product, OR
2. A fuzzy match against any other priced `trade_products` row (token overlap + brand boost).

For QU-22A02A both items have `trade_price_cents = NULL`, so the admin saw whatever the fuzzy matcher pulled (which may not even be the same product). The label "Catalog" is misleading because (a) it's not necessarily the catalog price of *this* product, and (b) for already-priced lines (where `unit_price_cents` is set, like on QU-22A02A: €2,300 and €35,000) it's redundant noise.

**Fix:**
- Rename "Catalog" → "Suggested (catalog)" only when the line has **no** `unit_price_cents` yet (i.e. we actually used it to pre-fill).
- Hide it entirely once the admin has set/saved a `unit_price_cents`.
- When the price came from a fuzzy match (not the same product), append "≈ from {matched product name}" so the admin knows it's a guess.

### 3) Discounted price is not visible — because the admin view ignores tier discounts entirely

The admin pricing view only shows: Unit Price input, Subtotal, GST (SGD only), Total. It never reads `useTradeDiscount` / `current_trade_discount_pct()` and never shows the discounted unit, line or grand totals. The trade user receiving the quote sees the discount on their side, but the admin pricing the quote can't sanity-check what the client will actually pay.

(Side note specific to QU-22A02A: the requesting account is `gregoire@maisonaffluency.com` whose `profiles.trade_tier = 'standard'` — which `useTradeDiscount` normalizes to **silver / 8%**. So even if discount lookup worked, this particular user resolves to 8%. We can still display it.)

**Fix:**
- Look up the **quote owner's** tier (not the admin's): `select trade_tier from profiles where id = quote.user_id`, then `tier_discount_pct(tier)` from `trade_tier_config` (fall back to 8%).
- Per row: under the Unit Price input show `After {pct}% trade: € X,XXX.XX`.
- In the totals block: add a `Trade discount ({pct}%)` line subtracting from subtotal, then compute GST/Total off the discounted subtotal.

### 4) GST is applied to a EUR quote — bug in the totals block

Lines 522–527 and 532 apply GST whenever `currency === "SGD"`. QU-22A02A is EUR so GST should never appear — and indeed the **condition is correct**. The reason GST is *visually* showing on QU-22A02A is something else: the unit-price input pre-fill uses `formatPrice` / inputs in EUR but the *individual product rows still carry `currency = 'SGD'` in `trade_products`*, and we render the input prefix from `quote.currency` (EUR) — that part is fine. So GST should not actually be in the DOM for this quote.

I'd like to verify this by looking at the live page once we're in build mode, but the most likely culprit is one of:
- `quote.currency` is being read as undefined → `currency` defaults to `"SGD"` (line 353: `quote?.currency || "SGD"`) — happens during the initial render before `quote` resolves. The GST row then briefly mounts and may be screenshotting that state.
- Or the user is looking at the **trade-side** view (not admin), which has its own GST logic.

**Fix:**
- Guard the GST row strictly: only render once `quote` has loaded AND `quote.currency === 'SGD'` (replace the `currency` local with `quote?.currency` directly in those two lines so the SGD fallback can't sneak in).
- Audit the parallel trade-side quote view (`src/pages/TradeQuotes.tsx` — same currency check should exist) and apply the same strict guard.

---

## Files to change

- `src/pages/TradeQuotesAdmin.tsx`
  - Add `effective_product_availability` batch fetch + render lead time on each row (desktop + mobile).
  - Rename/hide the "Catalog" line per the rules above; mark fuzzy-matched suggestions clearly.
  - Fetch the **quote owner's** tier + `trade_tier_config`, render per-line discounted price and a "Trade discount" totals row; recompute GST/Total off the discounted subtotal.
  - Strict GST guard: render only when `quote?.currency === 'SGD'`.
- `src/pages/TradeQuotes.tsx` (trade-user view) — apply the same strict GST guard so it can never appear on a EUR quote.

## Out of scope (flagging only)

- Both QU-22A02A products (`Lady Bug Side Table`, `Stone D Limonite D'Eau Coffee Table`) have `trade_price_cents = NULL` and no entry in `brand_lead_times` for Reda Amalou or Pierre Bonnefille. That's why "Catalog" was misleading and lead time would render as "TBC". Worth a separate pass to enrich those products + add brand lead-time defaults.
