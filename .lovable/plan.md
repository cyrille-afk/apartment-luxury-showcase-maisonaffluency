
## Root causes

**1) Pierre Bonnefille lead time missing in admin (but visible in trade editor)**
- `trade_products.lead_time` is `NULL` for both Pierre Bonnefille and Reda Amalou items.
- Admin set per-line overrides on the quote: `lead_time_weeks_override = 16` (Reda Amalou) and `14` (Pierre Bonnefille). These ARE in `trade_quote_items` and visible in the network response.
- The trade-side `QuoteDetail.tsx` uses `item.lead_time_weeks_override ?? parseLeadWeeks(product?.lead_time)` (line 411) — so it works there.
- The admin `TradeQuotesAdmin.tsx` only calls `formatLeadTime(leadTimes[item.id])` from the `effective_product_availability` RPC, which returns NULL for both because there's no brand_lead_times row and no product-level override. The per-line override is **never read**.

**2) FX rates not loading**
- Network log shows: `GET https://api.frankfurter.app/latest?from=EUR&to=GBP → Failed to fetch` (CORS / blocked in the Lovable preview environment).
- Result: `fxEurGbp` stays `null` indefinitely → panel sits at "Loading FX rates…" forever and `gbp.ready` is always `false`.

**3) GBP DDP click "freezes" everything**
- It is not a real freeze — it's the same FX failure: when the user flips the totals toggle to "GBP DDP", every line shows `…` and never resolves because `fxEurGbp` is null. There is no fallback path and no error message, so the UI looks stuck.
- Same applies to the "Download UK DDP estimate (PDF)" button — it's still clickable but would generate a PDF with zeroed values.

## Fixes

### A. Admin lead-time display (`src/pages/TradeQuotesAdmin.tsx`)

In the line-item render around line 547, prefer the per-line override:

```text
leadLabel =
  item.lead_time_weeks_override
    ? `Lead time: ${item.lead_time_weeks_override} weeks`
    : formatLeadTime(leadTimes[item.id])
```

This mirrors the trade view's behaviour and immediately surfaces the 14-week / 16-week values the admin already saved.

### B. Resilient FX fetcher (`src/hooks/useGbpLandedCost.ts` + `src/components/trade/UkLandedCostPanel.tsx`)

- Add a small helper `fetchFx(from, to)` that:
  1. Tries `https://api.frankfurter.app/latest?from=...&to=...` with a 4 s `AbortController` timeout.
  2. On failure, falls back to `https://api.exchangerate.host/latest?base=...&symbols=...` (CORS-enabled, free, no key).
  3. On second failure, falls back to a **hardcoded sensible default** keyed by currency pair (e.g. `EUR→GBP ≈ 0.85`, `SGD→EUR ≈ 0.69`, `USD→EUR ≈ 0.92`) and exposes a flag `fxIsFallback = true`.
- Hook now always resolves `ready=true` after the attempts; `fxEurGbp` and `fxQuoteEur` are guaranteed non-null.
- When `fxIsFallback` is true, the panel and the totals GBP block render an amber notice: *"Live FX unavailable — using fallback rate. Treat the GBP figure as approximate."* and the disclaimer copy is updated. The PDF inherits the same flag and prints the warning.

### C. GBP DDP toggle no longer "freezes" (`src/pages/TradeQuotesAdmin.tsx`, `src/components/trade/QuoteDetail.tsx`)

- Because `gbp.ready` is now guaranteed (B), the toggle never stays stuck.
- Add a defensive guard: if after 8 s any rate is still missing, show the amber notice and a **"Switch back to {QUOTE_CCY}"** inline button so the user can recover with one click.
- When `fxIsFallback` is true, set the GBP toggle to a slightly muted style and append "≈" before the GBP total so the approximation is visible at a glance.

### D. Files touched

```text
src/pages/TradeQuotesAdmin.tsx           # lead time fix + fallback notice on totals
src/components/trade/QuoteDetail.tsx     # fallback notice on totals (uses same hook)
src/hooks/useGbpLandedCost.ts            # multi-source FX fetcher + fxIsFallback flag
src/components/trade/UkLandedCostPanel.tsx # surface FX fallback + amber notice
src/lib/ukDdpPdf.ts                      # print "(approx.)" + warning when fallback used
```

No DB changes needed.

## Verification (after build)

- Open `QU-22A02A` in admin → both lines should show "Lead time: 14 weeks" / "Lead time: 16 weeks".
- Toggle totals to **GBP DDP** → values render within 4–8 s either with live rate or with the amber "fallback rate" notice; never stuck on `…`.
- Click **Download UK DDP estimate (PDF)** → PDF opens with values, including the fallback notice if applicable.
